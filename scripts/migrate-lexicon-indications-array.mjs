/**
 * migrate-lexicon-indications-array.mjs
 *
 * Upgrades keyword_lexicon.json from schema 3.1 → 3.2.
 *
 * SHAPE CHANGE
 *   - clusters[].indication: string  →  clusters[].indications: string[]
 *   - The "general" sentinel goes away. Cross-cutting clusters get
 *     `indications: []` (empty array) and surface under every indication
 *     toggle. Indication-scoped clusters get `indications: [<id>]`. A cluster
 *     can now belong to multiple indications without duplication.
 *
 * REGISTRY CHANGE
 *   - meta.indications[] drops the synthetic "general" row. Real indications
 *     stay (currently obesity, lupus_nephritis).
 *
 * Idempotent: re-running on a 3.2 file is a no-op; re-running on 3.1
 *   re-applies the array conversion deterministically.
 *
 * Run: node scripts/migrate-lexicon-indications-array.mjs
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const DATA_DIR = 'src/lib/content/wctglpdemo-data';
const LEXICON = `${DATA_DIR}/keyword_lexicon.json`;
const BACKUP = `${DATA_DIR}/keyword_lexicon.v3.1-backup.json`;
const CODEBOOK = `${DATA_DIR}/codebook.json`;

const fail = (msg) => {
	console.error(`[ERROR] ${msg}`);
	process.exit(1);
};

const lex = JSON.parse(readFileSync(resolve(ROOT, LEXICON), 'utf8'));
const codebook = JSON.parse(readFileSync(resolve(ROOT, CODEBOOK), 'utf8'));

const fromVersion = lex.meta?.schema_version ?? 'unknown';
if (fromVersion === '3.2') {
	console.log(`keyword_lexicon.json already at schema 3.2 — nothing to do.`);
	process.exit(0);
}
if (fromVersion !== '3.1') {
	fail(
		`expected schema 3.1, found "${fromVersion}". Run scripts/migrate-lexicon-conditions.mjs first.`
	);
}

// Validate (theme, subtheme) pairs against the live codebook so we catch any
// drift while we're here.
const validPairs = new Set();
for (const t of codebook.themes) {
	for (const s of t.subthemes ?? []) validPairs.add(`${t.id}::${s.id}`);
}

// --- Convert clusters -------------------------------------------------------

const seen = new Set();
const converted = lex.clusters.map((c) => {
	if (seen.has(c.id)) fail(`duplicate cluster id "${c.id}"`);
	seen.add(c.id);
	const pair = `${c.parent_theme}::${c.parent_subtheme}`;
	if (!validPairs.has(pair))
		fail(`cluster "${c.id}" → invalid (theme, subtheme) (${c.parent_theme}, ${c.parent_subtheme})`);
	if (!Array.isArray(c.variants)) fail(`cluster "${c.id}" missing variants[]`);

	// indication: 'general'         → indications: []
	// indication: 'obesity'         → indications: ['obesity']
	// indication: 'lupus_nephritis' → indications: ['lupus_nephritis']
	// (missing)                     → indications: []   (treat as cross-cutting)
	const ind = c.indication;
	const indications = !ind || ind === 'general' ? [] : [ind];

	// Canonical field order; drop the old singular `indication` field.
	return {
		id: c.id,
		label: c.label,
		description: c.description ?? '',
		indications,
		parent_theme: c.parent_theme,
		parent_subtheme: c.parent_subtheme,
		variants: c.variants
	};
});

// --- Convert meta.indications: drop the synthetic "general" row -------------

const oldIndications = lex.meta?.indications ?? [];
const newIndications = oldIndications.filter((i) => i.id !== 'general');

// Validate every cluster's indications[] entry resolves against the new
// registry. Empty arrays (cross-cutting) are fine.
const indicationIds = new Set(newIndications.map((i) => i.id));
for (const c of converted) {
	for (const id of c.indications) {
		if (!indicationIds.has(id))
			fail(`cluster "${c.id}" references unknown indication "${id}" after migration`);
	}
}

// --- Sort: indication-bucket (cross-cutting first) → theme → subtheme → id --

const indPriority = (c) => {
	if (c.indications.length === 0) return 0; // cross-cutting first
	// Stable order by first indication's position in the registry
	const first = c.indications[0];
	return 1 + newIndications.findIndex((i) => i.id === first);
};

converted.sort((a, b) => {
	const pa = indPriority(a);
	const pb = indPriority(b);
	if (pa !== pb) return pa - pb;
	if (a.parent_theme !== b.parent_theme) return a.parent_theme.localeCompare(b.parent_theme);
	if (a.parent_subtheme !== b.parent_subtheme)
		return a.parent_subtheme.localeCompare(b.parent_subtheme);
	return a.id.localeCompare(b.id);
});

// --- Update meta ------------------------------------------------------------

const crossCount = converted.filter((c) => c.indications.length === 0).length;
const indCounts = {};
for (const c of converted) {
	for (const id of c.indications) indCounts[id] = (indCounts[id] ?? 0) + 1;
}

lex.meta.schema_version = '3.2';
lex.meta.supersedes = 'keyword_lexicon.json @ 3.1';
lex.meta.description =
	'Keyword cluster catalog, schema 3.2. The CONDITION axis is now multi-valued: clusters[].indications is a string[] FK into meta.indications[]. An empty array marks a cross-cutting cluster that surfaces under every indication toggle (trial mechanics, cost/access, visit logistics, generic decision/knowledge/adverse-event language). Single-element arrays scope a cluster to one indication; multi-element arrays let one cluster belong to several without duplication. Each cluster also declares parent_theme + parent_subtheme as FKs into codebook.json. Variants are SUGGESTION FUEL ONLY — they rank cluster suggestions in the segment tag drawer; they do NOT auto-tag any occurrence. Per-instance tag rows live in keyword_tags.json keyed by (cluster_id, segment_id, char_start, char_end).';
lex.meta.indications = newIndications;
lex.meta.cluster_shape = {
	...lex.meta.cluster_shape,
	indications:
		'string[] FK → meta.indications[].id. Empty array = cross-cutting (visible under every indication toggle). Non-empty = scoped to those indications. Multi-element arrays are allowed and preferred over duplicate per-indication clusters.'
};
delete lex.meta.cluster_shape.indication;

lex.meta.changelog = [
	...(lex.meta.changelog ?? []),
	`3.2 — multi-indication clusters. clusters[].indication: string → clusters[].indications: string[]. Dropped the "general" sentinel from meta.indications; cross-cutting clusters now use an empty array. Migration summary: ${crossCount} clusters cross-cutting; ${Object.entries(
		indCounts
	)
		.map(([id, n]) => `${id}: ${n}`)
		.join(
			', '
		)}. Backup of prior live: ${BACKUP.split('/').pop()}. Migration: scripts/migrate-lexicon-indications-array.mjs.`
];

lex.clusters = converted;

// --- Write (backup once, then overwrite) ------------------------------------

if (!existsSync(resolve(ROOT, BACKUP))) {
	writeFileSync(resolve(ROOT, BACKUP), readFileSync(resolve(ROOT, LEXICON), 'utf8'), 'utf8');
	console.log(`Wrote backup ${BACKUP}`);
} else {
	console.log(`Backup ${BACKUP} already exists — left untouched.`);
}

writeFileSync(resolve(ROOT, LEXICON), JSON.stringify(lex, null, 2) + '\n', 'utf8');

// --- Summary ----------------------------------------------------------------

console.log(`Wrote ${LEXICON}`);
console.log(`  total clusters: ${converted.length}`);
console.log(`  cross-cutting (indications: []): ${crossCount}`);
for (const [id, n] of Object.entries(indCounts)) console.log(`  ${id}: ${n}`);
