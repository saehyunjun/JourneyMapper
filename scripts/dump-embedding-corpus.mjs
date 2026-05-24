/**
 * dump-embedding-corpus.mjs
 *
 * Phase 3 prep: emits a JSONL corpus of every taxonomy entity (lexicon
 * cluster, drug, MOA, burden category) as a single text-to-embed line.
 * Output is a deterministic input file for an offline embedding job —
 * pipe it through OpenAI / Voyage / Cohere in batch mode, then load the
 * resulting vectors back into the `embedding` columns on each entity.
 *
 * No API calls are made here. This script is intentionally cheap and
 * idempotent: re-running produces the same output bytes (modulo entity
 * additions). Source-of-truth for the entity rows is the bundled JSON
 * registries + the lexicon, NOT the DB, so the corpus is fully
 * reproducible without DATABASE_URL set.
 *
 * Output: data/embedding_corpus.jsonl (gitignored). Each row:
 *   { "entity_type": "cluster" | "drug" | "moa" | "burden",
 *     "id": "<entity id>",
 *     "text": "<concatenated label + description + variants/brand_names>",
 *     "metadata": { ... narrow envelope to round-trip back to the entity }
 *   }
 *
 * Run: npm run embeddings:dump
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const REGISTRY_DIR = `${ROOT}/src/lib/content/registries`;
const LEXICON = `${ROOT}/src/lib/content/wctglpdemo-data/keyword_lexicon.json`;
const OUTPUT_DIR = `${ROOT}/data`;
const OUTPUT = `${OUTPUT_DIR}/embedding_corpus.jsonl`;

const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));

if (!existsSync(OUTPUT_DIR)) mkdirSync(OUTPUT_DIR, { recursive: true });

const rows = [];

// --- Clusters ---------------------------------------------------------------
// text = label + description + variants joined. Variants carry the patient-
// voice signal the embedding should learn against.

const lex = readJson(LEXICON);
for (const c of lex.clusters) {
	const variants = Array.isArray(c.variants) ? c.variants.join(' · ') : '';
	const text = [c.label, c.description ?? '', variants].filter(Boolean).join('\n');
	rows.push({
		entity_type: 'cluster',
		id: c.id,
		text,
		metadata: {
			parent_theme: c.parent_theme,
			parent_subtheme: c.parent_subtheme,
			indications: c.indications ?? [],
			burden_category_ids: c.burden_category_ids ?? [],
			drug_id: c.drug_id ?? null
		}
	});
}

// --- Drugs ------------------------------------------------------------------
// text = label + description + brand_names joined. The generic name is
// already in `label`. MOA is captured in metadata so consumers can build
// MOA-level embeddings by averaging child drug vectors if useful.

const drugs = readJson(`${REGISTRY_DIR}/drugs.json`).items;
for (const d of drugs) {
	const brandLine = Array.isArray(d.brand_names) && d.brand_names.length
		? `brand names: ${d.brand_names.join(', ')}`
		: '';
	const text = [d.label, d.description ?? '', brandLine].filter(Boolean).join('\n');
	rows.push({
		entity_type: 'drug',
		id: d.id,
		text,
		metadata: {
			moa_id: d.moa_id,
			sponsor_id: d.sponsor_id,
			stage: d.stage,
			indication_ids: d.indication_ids ?? []
		}
	});
}

// --- MOAs -------------------------------------------------------------------
// text = label + description. MOAs sit above drugs in the taxonomy and
// the description is the primary discriminator.

const moas = readJson(`${REGISTRY_DIR}/mechanisms_of_action.json`).items;
for (const m of moas) {
	const text = [m.label, m.description ?? ''].filter(Boolean).join('\n');
	rows.push({
		entity_type: 'moa',
		id: m.id,
		text,
		metadata: {}
	});
}

// --- Burden categories ------------------------------------------------------
// text = label + description. parent_id captured in metadata so the
// embedding can later be checked against the tree structure (a leaf's
// vector should be close to its parent's vector).

const burdens = readJson(`${REGISTRY_DIR}/burden_categories.json`).items;
for (const b of burdens) {
	const text = [b.label, b.description ?? ''].filter(Boolean).join('\n');
	rows.push({
		entity_type: 'burden',
		id: b.id,
		text,
		metadata: { parent_id: b.parent_id ?? null }
	});
}

// --- Write ------------------------------------------------------------------

const jsonl = rows.map((r) => JSON.stringify(r)).join('\n') + '\n';
writeFileSync(OUTPUT, jsonl, 'utf8');

const byType = rows.reduce((acc, r) => {
	acc[r.entity_type] = (acc[r.entity_type] ?? 0) + 1;
	return acc;
}, {});

console.log(`Wrote ${OUTPUT}`);
console.log(`  total rows: ${rows.length}`);
for (const [t, n] of Object.entries(byType)) console.log(`  ${t.padEnd(10)} ${n}`);
console.log('');
console.log('Next step: pipe this file through your embedding provider in batch mode.');
console.log('Example shape consumers expect back:');
console.log('  { "id": "<entity id>", "entity_type": "...", "embedding": [..1536 floats..] }');
