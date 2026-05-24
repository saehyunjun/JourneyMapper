/**
 * migrate-lexicon-registry-consolidation.mjs
 *
 * Upgrades keyword_lexicon.json from schema 3.2 → 3.3.
 *
 * The lexicon used to carry its own `meta.indications[]` and
 * `meta.therapeutic_areas[]` registries — duplicating the rows in
 * `src/lib/content/registries/`. This migration drops those fields. The
 * registry files are now the single source of truth; the lexicon only
 * references their ids via `clusters[].indications[]`.
 *
 * Before dropping, validates that every cluster's indications[] entry
 * resolves against the registry. Fails loudly if not.
 *
 * Idempotent: re-running on 3.3 is a no-op.
 *
 * Run: node scripts/migrate-lexicon-registry-consolidation.mjs
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const DATA_DIR = 'src/lib/content/wctglpdemo-data';
const LEXICON = `${DATA_DIR}/keyword_lexicon.json`;
const BACKUP = `${DATA_DIR}/keyword_lexicon.v3.2-backup.json`;
const REGISTRY_DIR = 'src/lib/content/registries';
const INDICATIONS_FILE = `${REGISTRY_DIR}/indications.json`;
const TAS_FILE = `${REGISTRY_DIR}/therapeutic_areas.json`;

const fail = (msg) => {
	console.error(`[ERROR] ${msg}`);
	process.exit(1);
};

const lex = JSON.parse(readFileSync(resolve(ROOT, LEXICON), 'utf8'));
const indicationsRegistry = JSON.parse(readFileSync(resolve(ROOT, INDICATIONS_FILE), 'utf8'));
const tasRegistry = JSON.parse(readFileSync(resolve(ROOT, TAS_FILE), 'utf8'));

const fromVersion = lex.meta?.schema_version ?? 'unknown';
if (fromVersion === '3.3') {
	console.log(`keyword_lexicon.json already at schema 3.3 — nothing to do.`);
	process.exit(0);
}
if (fromVersion !== '3.2') {
	fail(
		`expected schema 3.2, found "${fromVersion}". Run prior migrations first.`
	);
}

// --- Validate every cluster's indications[] against the registry ----------

const indicationIds = new Set(indicationsRegistry.items.map((i) => i.id));
const taIds = new Set(tasRegistry.items.map((a) => a.id));

for (const c of lex.clusters) {
	if (!Array.isArray(c.indications))
		fail(`cluster "${c.id}" missing indications[] (schema 3.2 expected)`);
	for (const id of c.indications) {
		if (!indicationIds.has(id))
			fail(
				`cluster "${c.id}" references indication "${id}" which is not in registries/indications.json`
			);
	}
}

// Also assert the indication registry's therapeutic_area_ids resolve.
for (const ind of indicationsRegistry.items) {
	for (const id of ind.therapeutic_area_ids ?? []) {
		if (!taIds.has(id))
			fail(`registries/indications.json: "${ind.id}" references unknown therapeutic_area "${id}"`);
	}
}

// --- Drop meta.indications + meta.therapeutic_areas + cluster_shape.indication

delete lex.meta.indications;
delete lex.meta.therapeutic_areas;

lex.meta.schema_version = '3.3';
lex.meta.supersedes = 'keyword_lexicon.json @ 3.2';
lex.meta.description =
	'Keyword cluster catalog, schema 3.3. The indication and therapeutic-area registries no longer live here — they moved to src/lib/content/registries/ (indications.json + therapeutic_areas.json), which is the single source of truth. Clusters reference indication ids via clusters[].indications: string[] (empty array = cross-cutting). Each cluster also declares parent_theme + parent_subtheme as FKs into codebook.json. Variants are SUGGESTION FUEL ONLY — they rank cluster suggestions in the segment tag drawer; they do NOT auto-tag any occurrence. Per-instance tag rows live in keyword_tags.json keyed by (cluster_id, segment_id, char_start, char_end).';

lex.meta.changelog = [
	...(lex.meta.changelog ?? []),
	`3.3 — registry consolidation. Removed meta.indications[] and meta.therapeutic_areas[] from the lexicon; both registries now live exclusively under src/lib/content/registries/. Clusters validated against the registry before drop: ${lex.clusters.length} total, all indication FKs resolved. Backup: ${BACKUP.split('/').pop()}. Migration: scripts/migrate-lexicon-registry-consolidation.mjs.`
];

// --- Write (backup once, then overwrite) ------------------------------------

if (!existsSync(resolve(ROOT, BACKUP))) {
	writeFileSync(resolve(ROOT, BACKUP), readFileSync(resolve(ROOT, LEXICON), 'utf8'), 'utf8');
	console.log(`Wrote backup ${BACKUP}`);
} else {
	console.log(`Backup ${BACKUP} already exists — left untouched.`);
}

writeFileSync(resolve(ROOT, LEXICON), JSON.stringify(lex, null, 2) + '\n', 'utf8');

console.log(`Wrote ${LEXICON}`);
console.log(`  schema_version: ${lex.meta.schema_version}`);
console.log(`  meta.indications: ${lex.meta.indications ? 'still present!' : 'removed'}`);
console.log(`  meta.therapeutic_areas: ${lex.meta.therapeutic_areas ? 'still present!' : 'removed'}`);
console.log(`  clusters: ${lex.clusters.length}`);
