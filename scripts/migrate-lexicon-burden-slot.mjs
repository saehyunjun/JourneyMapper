/**
 * migrate-lexicon-burden-slot.mjs
 *
 * Upgrades keyword_lexicon.json from schema 3.3 → 3.4.
 *
 * Adds an empty `burden_category_ids: []` slot to every cluster. The slot is
 * the schema-level home for cluster-to-burden mappings; populating it (manual
 * or LLM-driven) happens in a follow-up. The taxonomy itself lives at
 * src/lib/content/registries/burden_categories.json.
 *
 * Also validates the burden-category tree on every run (no orphan parent_ids,
 * no cycles, no duplicate ids) so the registry stays sound as it evolves.
 *
 * Idempotent: re-running on 3.4 only validates and re-asserts the field
 * exists; it doesn't overwrite any populated mappings.
 *
 * Run: node scripts/migrate-lexicon-burden-slot.mjs
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const DATA_DIR = 'src/lib/content/wctglpdemo-data';
const LEXICON = `${DATA_DIR}/keyword_lexicon.json`;
const BACKUP = `${DATA_DIR}/keyword_lexicon.v3.3-backup.json`;
const BURDEN_REGISTRY = 'src/lib/content/registries/burden_categories.json';

const fail = (msg) => {
	console.error(`[ERROR] ${msg}`);
	process.exit(1);
};

// --- Validate burden taxonomy tree -----------------------------------------

const burdens = JSON.parse(readFileSync(resolve(ROOT, BURDEN_REGISTRY), 'utf8'));
const burdenIds = new Set();
for (const b of burdens.items) {
	if (burdenIds.has(b.id)) fail(`burden_categories.json: duplicate id "${b.id}"`);
	burdenIds.add(b.id);
}
for (const b of burdens.items) {
	if (b.parent_id !== null && !burdenIds.has(b.parent_id)) {
		fail(`burden_categories.json: "${b.id}" has unknown parent_id "${b.parent_id}"`);
	}
}
// Cycle detection: every node's ancestor chain must terminate at null.
for (const start of burdens.items) {
	const seen = new Set();
	let cur = start;
	while (cur) {
		if (seen.has(cur.id))
			fail(`burden_categories.json: cycle detected at "${cur.id}" (started from "${start.id}")`);
		seen.add(cur.id);
		if (cur.parent_id === null) break;
		cur = burdens.items.find((x) => x.id === cur.parent_id);
	}
}
console.log(`burden_categories.json: OK — ${burdens.items.length} nodes, tree validated`);

// --- Apply lexicon migration -----------------------------------------------

const lex = JSON.parse(readFileSync(resolve(ROOT, LEXICON), 'utf8'));
const fromVersion = lex.meta?.schema_version ?? 'unknown';
if (fromVersion === '3.4') {
	// Idempotent: re-assert every cluster has the slot.
	let fixed = 0;
	for (const c of lex.clusters) {
		if (!Array.isArray(c.burden_category_ids)) {
			c.burden_category_ids = [];
			fixed++;
		}
		// Validate any already-populated ids.
		for (const id of c.burden_category_ids) {
			if (!burdenIds.has(id))
				fail(`cluster "${c.id}" references unknown burden_category_id "${id}"`);
		}
	}
	if (fixed > 0) {
		writeFileSync(resolve(ROOT, LEXICON), JSON.stringify(lex, null, 2) + '\n', 'utf8');
		console.log(`Restored ${fixed} missing burden_category_ids slots on schema-3.4 file.`);
	} else {
		console.log(`keyword_lexicon.json already at schema 3.4 with all slots present — nothing to do.`);
	}
	process.exit(0);
}
if (fromVersion !== '3.3') {
	fail(`expected schema 3.3, found "${fromVersion}". Run prior migrations first.`);
}

// Add the slot. Preserve canonical field order: id, label, description,
// indications, burden_category_ids, parent_theme, parent_subtheme, variants.
const converted = lex.clusters.map((c) => ({
	id: c.id,
	label: c.label,
	description: c.description ?? '',
	indications: c.indications,
	burden_category_ids: [],
	parent_theme: c.parent_theme,
	parent_subtheme: c.parent_subtheme,
	variants: c.variants
}));

lex.meta.schema_version = '3.4';
lex.meta.supersedes = 'keyword_lexicon.json @ 3.3';
lex.meta.description =
	'Keyword cluster catalog, schema 3.4. Adds the BURDEN axis: clusters[].burden_category_ids: string[] is a cross-cutting FK into registries/burden_categories.json. Empty arrays are valid and mean "not yet classified". The taxonomy is tree-structured (parent_id resolves to another burden id or null at the top level), so aggregations can roll a leaf-level tag up to its top-level parent. Indication + therapeutic-area registries live exclusively under src/lib/content/registries/ (since 3.3). Each cluster also declares parent_theme + parent_subtheme as FKs into codebook.json. Variants are SUGGESTION FUEL ONLY — they rank cluster suggestions in the segment tag drawer; they do NOT auto-tag any occurrence. Per-instance tag rows live in keyword_tags.json keyed by (cluster_id, segment_id, char_start, char_end).';

lex.meta.cluster_shape = {
	...lex.meta.cluster_shape,
	burden_category_ids:
		'string[] FK → registries/burden_categories.json items[].id. Empty array is valid (unclassified). Multi-element arrays let one cluster carry multiple burden facets — e.g. steroid_side_effects can be both physical_side_effects and physical_appearance. Prefer leaf-level ids; top-level parents are valid too when ambiguity rules out a leaf.'
};

lex.meta.changelog = [
	...(lex.meta.changelog ?? []),
	`3.4 — added burden_category_ids[] slot on every cluster (initialized empty). Taxonomy registry at registries/burden_categories.json (status: draft) — ${burdens.items.length} nodes, ${burdens.items.filter((b) => b.parent_id === null).length} top-level. Backup: ${BACKUP.split('/').pop()}. Migration: scripts/migrate-lexicon-burden-slot.mjs.`
];

lex.clusters = converted;

if (!existsSync(resolve(ROOT, BACKUP))) {
	writeFileSync(resolve(ROOT, BACKUP), readFileSync(resolve(ROOT, LEXICON), 'utf8'), 'utf8');
	console.log(`Wrote backup ${BACKUP}`);
} else {
	console.log(`Backup ${BACKUP} already exists — left untouched.`);
}

writeFileSync(resolve(ROOT, LEXICON), JSON.stringify(lex, null, 2) + '\n', 'utf8');

console.log(`Wrote ${LEXICON}`);
console.log(`  schema_version: ${lex.meta.schema_version}`);
console.log(`  clusters: ${converted.length} (all with empty burden_category_ids[])`);
