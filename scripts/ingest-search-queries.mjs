/**
 * ingest-search-queries.mjs
 *
 * The first Phase 5 ingestion connector. Walks disease-insights/<id>/
 * manifests for datasets of type `search_volume_topics`, normalizes each
 * row into a content_item + segment, and writes to the Drizzle/libSQL DB.
 *
 * The shape contract:
 *   - One content_item per (indication, dataset, topic) triple
 *   - content_source_id = 'search_query'
 *   - raw_text = the topic phrase
 *   - source_metadata captures the dataset id, volume, unit, geography,
 *     time_period, and dataset source-of-record (manual_extract / provider)
 *   - One M2M row content_item_indications linking to the dataset's
 *     indication_id
 *   - One segment per content_item (1:1; queries are atomic enough that
 *     decomposition into multiple segments isn't useful)
 *
 * ID generation: sha256(indication_id + dataset_id + topic).slice(0, 16).
 * Deterministic so re-running the ingest is idempotent without duplicating
 * rows. Uses INSERT OR REPLACE on content_items + segments and explicitly
 * cleans + re-inserts M2M rows for each content_item.
 *
 * Run: npm run db:ingest:search-queries
 */

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { createClient } from '@libsql/client';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const INSIGHTS_DIR = `${ROOT}/src/lib/content/disease-insights`;
const DB_URL = process.env.DATABASE_URL ?? 'file:./data/dev.db';
const DB_AUTH = process.env.DATABASE_AUTH_TOKEN;

const fail = (msg) => {
	console.error(`[ERROR] ${msg}`);
	process.exit(1);
};

const sha = (s) => createHash('sha256').update(s).digest('hex').slice(0, 16);
const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));

// --- Discover every search_volume_topics dataset ----------------------------

if (!existsSync(INSIGHTS_DIR)) fail(`disease-insights directory missing: ${INSIGHTS_DIR}`);

const folders = readdirSync(INSIGHTS_DIR, { withFileTypes: true })
	.filter((d) => d.isDirectory())
	.map((d) => d.name);

const targets = []; // { indication_id, dataset, payloadPath }
for (const folder of folders) {
	const manifestPath = `${INSIGHTS_DIR}/${folder}/manifest.json`;
	if (!existsSync(manifestPath)) continue;
	const manifest = readJson(manifestPath);
	for (const ds of manifest.datasets ?? []) {
		if (ds.type === 'search_volume_topics') {
			targets.push({
				indication_id: manifest.id,
				dataset: ds,
				payloadPath: `${INSIGHTS_DIR}/${folder}/${ds.path}`
			});
		}
	}
}

if (targets.length === 0) {
	console.log('No search_volume_topics datasets found. Nothing to ingest.');
	process.exit(0);
}
console.log(`Found ${targets.length} search_volume_topics dataset(s):`);
for (const t of targets) console.log(`  - ${t.indication_id} / ${t.dataset.id}`);

// --- Connect ---------------------------------------------------------------

const client = createClient({ url: DB_URL, ...(DB_AUTH ? { authToken: DB_AUTH } : {}) });
console.log(`Connecting to ${DB_URL}`);

// Sanity: confirm the registry rows exist that we'll reference.
const csRow = await client.execute(`SELECT id FROM content_sources WHERE id = 'search_query'`);
if (csRow.rows.length === 0)
	fail(`content_sources row 'search_query' is missing — run npm run db:seed first.`);

// --- Ingest -----------------------------------------------------------------

let totalRows = 0;
let totalSkipped = 0;
const countsByIndication = {};

const now = Date.now();

for (const target of targets) {
	if (!existsSync(target.payloadPath))
		fail(`dataset payload missing: ${target.payloadPath}`);
	const payload = readJson(target.payloadPath);
	if (!Array.isArray(payload.data))
		fail(`dataset ${target.dataset.id}: missing data[] array`);

	// Sanity: confirm indication exists in registry.
	const indRow = await client.execute({
		sql: `SELECT id FROM indications WHERE id = ?`,
		args: [target.indication_id]
	});
	if (indRow.rows.length === 0) {
		console.log(
			`  SKIP dataset ${target.dataset.id} — indication ${target.indication_id} not in DB`
		);
		totalSkipped += payload.data.length;
		continue;
	}

	for (const row of payload.data) {
		const topic = String(row.topic ?? '').trim();
		if (!topic) {
			totalSkipped++;
			continue;
		}
		const itemId = sha(`${target.indication_id}|${target.dataset.id}|${topic}`);
		const sourceMeta = {
			dataset_id: target.dataset.id,
			dataset_title: payload.title ?? null,
			volume: row.volume ?? null,
			unit: payload.unit ?? null,
			geography: payload.geography ?? null,
			time_period: payload.time_period ?? null,
			source: payload.source ?? null
		};

		// Upsert content_item (INSERT OR REPLACE is safe — children only ref
		// the row by id and we always re-insert them below).
		await client.execute({
			sql: `INSERT OR REPLACE INTO content_items (
				id, content_source_id, raw_text, title, url, author_handle,
				author_attribution_type, platform, captured_at, published_at,
				source_metadata, embedding, created_at
			) VALUES (?, 'search_query', ?, ?, NULL, NULL, 'aggregated', ?, ?, NULL, ?, NULL, ?)`,
			args: [
				itemId,
				topic,
				payload.title ?? null,
				payload.geography ?? null,
				now,
				JSON.stringify(sourceMeta),
				now
			]
		});

		// M2M to indications — delete any prior link for this item, then insert.
		await client.execute({
			sql: `DELETE FROM content_item_indications WHERE content_item_id = ?`,
			args: [itemId]
		});
		await client.execute({
			sql: `INSERT INTO content_item_indications (content_item_id, indication_id) VALUES (?, ?)`,
			args: [itemId, target.indication_id]
		});

		// Segment — 1:1 with content_item; the entire query IS the segment.
		const segId = `${itemId}_seg0`;
		await client.execute({
			sql: `INSERT OR REPLACE INTO segments (
				id, content_item_id, text, char_start, char_end, segment_index,
				sentiment, confidence, review_status, embedding, created_at
			) VALUES (?, ?, ?, 0, ?, 0, NULL, NULL, 'pending', NULL, ?)`,
			args: [segId, itemId, topic, topic.length, now]
		});

		totalRows++;
		countsByIndication[target.indication_id] =
			(countsByIndication[target.indication_id] ?? 0) + 1;
	}
	console.log(`  ingested ${target.dataset.id}`);
}

// --- Summary ---------------------------------------------------------------

const totals = await Promise.all(
	['content_items', 'content_item_indications', 'segments'].map(async (tbl) => {
		const r = await client.execute(`SELECT COUNT(*) AS n FROM ${tbl}`);
		return { tbl, n: r.rows[0].n };
	})
);

console.log('');
console.log(`Ingest complete:`);
console.log(`  rows processed: ${totalRows}`);
console.log(`  rows skipped:   ${totalSkipped}`);
console.log(`  by indication:`);
for (const [ind, n] of Object.entries(countsByIndication)) console.log(`    ${ind}: ${n}`);
console.log('');
console.log(`Table totals:`);
for (const { tbl, n } of totals) console.log(`  ${tbl.padEnd(30)} ${n}`);

client.close();
