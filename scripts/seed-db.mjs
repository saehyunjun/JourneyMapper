/**
 * seed-db.mjs
 *
 * Idempotent seed of the Drizzle/libSQL database from the canonical JSON
 * registries under src/lib/content/registries/. Reads each registry, drops +
 * recreates the corresponding tables (via the latest migration SQL), then
 * inserts rows.
 *
 * Idempotency strategy: drop + rebuild every run. Safe because the DB is
 * NOT yet the live source of truth — every page still reads from bundled
 * JSON. Once a downstream consumer starts querying the DB, switch to a
 * proper migrate-then-upsert flow.
 *
 * Loads DATABASE_URL from the environment if set, otherwise defaults to
 * the local dev file (file:./data/dev.db).
 *
 * Run: npm run db:seed
 */

import { readFileSync, readdirSync, unlinkSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@libsql/client';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const REGISTRY_DIR = `${ROOT}/src/lib/content/registries`;
const MIGRATIONS_DIR = `${ROOT}/drizzle`;

const DB_URL = process.env.DATABASE_URL ?? 'file:./data/dev.db';
const DB_AUTH = process.env.DATABASE_AUTH_TOKEN;

// For local file-based dev databases, rebuild from scratch on every run.
// Avoids the DROP-TABLE-with-self-ref-FK gotcha and keeps the seed truly
// idempotent. Remote (libsql://) URLs are left untouched — never want to
// blow away a hosted DB from a dev seed script.
const isLocalFileUrl = DB_URL.startsWith('file:') && !DB_URL.includes('://');
if (isLocalFileUrl) {
	const dbPath = DB_URL.replace(/^file:/, '');
	if (dbPath && existsSync(dbPath)) {
		unlinkSync(dbPath);
		console.log(`Removed existing ${dbPath} (rebuilding from scratch)`);
	}
	// Also clean up any -journal / -wal / -shm sidecar files.
	for (const ext of ['-journal', '-wal', '-shm']) {
		if (existsSync(dbPath + ext)) unlinkSync(dbPath + ext);
	}
}

const client = createClient({ url: DB_URL, ...(DB_AUTH ? { authToken: DB_AUTH } : {}) });

const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));

// --- Phase 1: apply migrations --------------------------------------------
//
// For file-based DBs we already unlinked the file above, so we're starting
// from an empty database. For remote DBs we trust the operator to have
// run db:push or db:migrate before seeding.

console.log(`Connecting to ${DB_URL}`);

// Apply every migration SQL file in lexicographic order. Each file is a
// multi-statement script delimited by `--> statement-breakpoint` markers
// emitted by drizzle-kit.
const migrationFiles = readdirSync(MIGRATIONS_DIR)
	.filter((f) => f.endsWith('.sql'))
	.sort();

for (const f of migrationFiles) {
	const sql = readFileSync(`${MIGRATIONS_DIR}/${f}`, 'utf8');
	const statements = sql
		.split('--> statement-breakpoint')
		.map((s) => s.trim())
		.filter((s) => s.length > 0);
	for (const stmt of statements) {
		await client.execute(stmt);
	}
	console.log(`  applied ${f} (${statements.length} statements)`);
}

// --- Phase 2: seed rows ----------------------------------------------------

const therapeuticAreas = readJson(`${REGISTRY_DIR}/therapeutic_areas.json`).items;
for (const ta of therapeuticAreas) {
	await client.execute({
		sql: `INSERT INTO therapeutic_areas (id, label, mesh_id, mesh_term) VALUES (?, ?, ?, ?)`,
		args: [ta.id, ta.label, ta.mesh_id ?? null, ta.mesh_term ?? null]
	});
}
console.log(`seeded therapeutic_areas: ${therapeuticAreas.length}`);

const indications = readJson(`${REGISTRY_DIR}/indications.json`).items;
for (const ind of indications) {
	await client.execute({
		sql: `INSERT INTO indications (id, label, abbreviation, mesh_id, mesh_term, description) VALUES (?, ?, ?, ?, ?, ?)`,
		args: [
			ind.id,
			ind.label,
			ind.abbreviation ?? null,
			ind.mesh_id ?? null,
			ind.mesh_term ?? null,
			ind.description ?? null
		]
	});
	for (const taId of ind.therapeutic_area_ids ?? []) {
		await client.execute({
			sql: `INSERT INTO indication_therapeutic_areas (indication_id, therapeutic_area_id) VALUES (?, ?)`,
			args: [ind.id, taId]
		});
	}
}
console.log(`seeded indications: ${indications.length}`);

// Burden categories must insert parents before children. Sort: parent_id=null first,
// then BFS layers. The current registry happens to be in BFS order, but sort defensively.
const burdens = readJson(`${REGISTRY_DIR}/burden_categories.json`).items;
const burdenById = new Map(burdens.map((b) => [b.id, b]));
const seenBurden = new Set();
function depthOf(id) {
	let d = 0;
	let cur = burdenById.get(id);
	while (cur && cur.parent_id) {
		d++;
		cur = burdenById.get(cur.parent_id);
	}
	return d;
}
const burdensSorted = [...burdens].sort((a, b) => depthOf(a.id) - depthOf(b.id));
for (const b of burdensSorted) {
	if (seenBurden.has(b.id)) continue;
	seenBurden.add(b.id);
	await client.execute({
		sql: `INSERT INTO burden_categories (id, label, parent_id, description) VALUES (?, ?, ?, ?)`,
		args: [b.id, b.label, b.parent_id, b.description]
	});
}
console.log(`seeded burden_categories: ${burdens.length}`);

const sponsors = readJson(`${REGISTRY_DIR}/sponsors.json`).items;
for (const s of sponsors) {
	await client.execute({
		sql: `INSERT INTO sponsors (id, label, headquarters_country) VALUES (?, ?, ?)`,
		args: [s.id, s.label, s.headquarters_country ?? null]
	});
}
console.log(`seeded sponsors: ${sponsors.length}`);

const moas = readJson(`${REGISTRY_DIR}/mechanisms_of_action.json`).items;
for (const m of moas) {
	await client.execute({
		sql: `INSERT INTO mechanisms_of_action (id, label, description, embedding) VALUES (?, ?, ?, ?)`,
		args: [m.id, m.label, m.description, m.embedding ? JSON.stringify(m.embedding) : null]
	});
}
console.log(`seeded mechanisms_of_action: ${moas.length}`);

const drugs = readJson(`${REGISTRY_DIR}/drugs.json`).items;
for (const d of drugs) {
	await client.execute({
		sql: `INSERT INTO drugs (id, label, generic_name, brand_names, moa_id, sponsor_id, stage, description, approved_at, embedding) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		args: [
			d.id,
			d.label,
			d.generic_name,
			JSON.stringify(d.brand_names ?? []),
			d.moa_id ?? null,
			d.sponsor_id ?? null,
			d.stage,
			d.description ?? null,
			d.approved_at ?? null,
			d.embedding ? JSON.stringify(d.embedding) : null
		]
	});
	for (const indId of d.indication_ids ?? []) {
		await client.execute({
			sql: `INSERT INTO drug_indications (drug_id, indication_id) VALUES (?, ?)`,
			args: [d.id, indId]
		});
	}
}
console.log(`seeded drugs: ${drugs.length}`);

const contentSources = readJson(`${REGISTRY_DIR}/content_sources.json`).items;
for (const c of contentSources) {
	await client.execute({
		sql: `INSERT INTO content_sources (id, label, description, typical_metadata) VALUES (?, ?, ?, ?)`,
		args: [c.id, c.label, c.description, JSON.stringify(c.typical_metadata ?? [])]
	});
}
console.log(`seeded content_sources: ${contentSources.length}`);

// --- Summary ---------------------------------------------------------------

const counts = await Promise.all(
	[
		'therapeutic_areas',
		'indications',
		'indication_therapeutic_areas',
		'burden_categories',
		'sponsors',
		'mechanisms_of_action',
		'drugs',
		'drug_indications',
		'content_sources'
	].map(async (tbl) => {
		const r = await client.execute(`SELECT COUNT(*) AS n FROM ${tbl}`);
		return { tbl, n: r.rows[0].n };
	})
);

console.log('');
console.log('Row counts:');
for (const { tbl, n } of counts) console.log(`  ${tbl.padEnd(30)} ${n}`);

client.close();
