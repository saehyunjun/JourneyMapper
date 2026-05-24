/**
 * migrate-lexicon-drug-fk.mjs
 *
 * Upgrades keyword_lexicon.json from schema 3.4 → 3.5.
 *
 * Adds an optional `drug_id` FK to lexicon clusters that represent a specific
 * drug. The drug entity itself lives at src/lib/content/registries/drugs.json,
 * which carries the structured pharmacologic metadata (MOA, sponsor, stage,
 * indications) that doesn't belong in the variant-matching lexicon.
 *
 *   cluster.drug_id  →  drugs.json items[].id
 *   drug.moa_id      →  mechanisms_of_action.json items[].id
 *   drug.sponsor_id  →  sponsors.json items[].id  (nullable for generics)
 *   drug.indication_ids[] → indications.json items[].id
 *
 * The matcher is intentionally NOT changed: cluster.variants stays the
 * authoritative match source. Drug brand names are duplicated between
 * variants[] and drugs.brand_names[] until a follow-up rewires the matcher
 * to inline brand names from the drug registry.
 *
 * Populates drug_id on every cluster whose id matches a row in drugs.json.
 * Clusters representing drug CLASSES (glp_1, calcineurin_inhibitors, ace_arb)
 * or non-drug treatment concepts (multitarget_therapy, iv_infusion,
 * compounded_medication) get no drug_id.
 *
 * Validates the full FK chain on every run.
 *
 * Idempotent: re-running on 3.5 only re-asserts FKs and refreshes drug_id
 * assignments.
 *
 * Run: node scripts/migrate-lexicon-drug-fk.mjs
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const DATA_DIR = 'src/lib/content/wctglpdemo-data';
const LEXICON = `${DATA_DIR}/keyword_lexicon.json`;
const BACKUP = `${DATA_DIR}/keyword_lexicon.v3.4-backup.json`;
const REGISTRY_DIR = 'src/lib/content/registries';
const INDICATIONS_FILE = `${REGISTRY_DIR}/indications.json`;
const DRUGS_FILE = `${REGISTRY_DIR}/drugs.json`;
const MOAS_FILE = `${REGISTRY_DIR}/mechanisms_of_action.json`;
const SPONSORS_FILE = `${REGISTRY_DIR}/sponsors.json`;

const fail = (msg) => {
	console.error(`[ERROR] ${msg}`);
	process.exit(1);
};

// --- Load registries -------------------------------------------------------

const indications = JSON.parse(readFileSync(resolve(ROOT, INDICATIONS_FILE), 'utf8'));
const drugs = JSON.parse(readFileSync(resolve(ROOT, DRUGS_FILE), 'utf8'));
const moas = JSON.parse(readFileSync(resolve(ROOT, MOAS_FILE), 'utf8'));
const sponsors = JSON.parse(readFileSync(resolve(ROOT, SPONSORS_FILE), 'utf8'));

const indicationIds = new Set(indications.items.map((i) => i.id));
const drugIds = new Set(drugs.items.map((d) => d.id));
const moaIds = new Set(moas.items.map((m) => m.id));
const sponsorIds = new Set(sponsors.items.map((s) => s.id));

// --- Validate the drug registry's outgoing FKs -----------------------------

const seenDrug = new Set();
for (const d of drugs.items) {
	if (seenDrug.has(d.id)) fail(`drugs.json: duplicate id "${d.id}"`);
	seenDrug.add(d.id);
	if (d.moa_id !== null && !moaIds.has(d.moa_id))
		fail(`drugs.json: "${d.id}" references unknown moa_id "${d.moa_id}"`);
	if (d.sponsor_id !== null && !sponsorIds.has(d.sponsor_id))
		fail(`drugs.json: "${d.id}" references unknown sponsor_id "${d.sponsor_id}"`);
	for (const id of d.indication_ids ?? []) {
		if (!indicationIds.has(id))
			fail(`drugs.json: "${d.id}" references unknown indication "${id}"`);
	}
	if (!Array.isArray(d.brand_names))
		fail(`drugs.json: "${d.id}" missing brand_names[] array`);
}
console.log(
	`drugs.json: OK — ${drugs.items.length} drugs, ${moas.items.length} MOAs, ${sponsors.items.length} sponsors validated`
);

// --- Apply lexicon migration -----------------------------------------------

const lex = JSON.parse(readFileSync(resolve(ROOT, LEXICON), 'utf8'));
const fromVersion = lex.meta?.schema_version ?? 'unknown';

if (fromVersion !== '3.4' && fromVersion !== '3.5') {
	fail(`expected schema 3.4 or 3.5, found "${fromVersion}". Run prior migrations first.`);
}

let assigned = 0;
let preserved = 0;
const converted = lex.clusters.map((c) => {
	// Cluster id matches a drug id? Wire the FK.
	const matched = drugIds.has(c.id);
	const drug_id = matched ? c.id : c.drug_id ?? undefined;
	if (matched && c.drug_id !== c.id) assigned++;
	if (drug_id && !matched) {
		if (!drugIds.has(drug_id))
			fail(`cluster "${c.id}" has drug_id "${drug_id}" which is not in drugs.json`);
		preserved++;
	}
	const next = {
		id: c.id,
		label: c.label,
		description: c.description ?? '',
		indications: c.indications ?? [],
		burden_category_ids: c.burden_category_ids ?? [],
		parent_theme: c.parent_theme,
		parent_subtheme: c.parent_subtheme,
		variants: c.variants
	};
	if (drug_id) next.drug_id = drug_id;
	return next;
});

// Final cross-FK pass on the new lexicon.
for (const c of converted) {
	if (c.drug_id && !drugIds.has(c.drug_id))
		fail(`cluster "${c.id}" drug_id "${c.drug_id}" missing in drugs.json (post-merge)`);
	for (const id of c.indications) {
		if (!indicationIds.has(id))
			fail(`cluster "${c.id}" references unknown indication "${id}"`);
	}
}

// --- Update meta ------------------------------------------------------------

lex.meta.schema_version = '3.5';
lex.meta.supersedes = `keyword_lexicon.json @ ${fromVersion}`;
lex.meta.description =
	'Keyword cluster catalog, schema 3.5. Adds the DRUG axis: clusters[].drug_id is an optional FK into registries/drugs.json for clusters that represent a specific drug. The drug entity carries structured metadata (mechanism of action, sponsor, stage, indications) that doesn\'t belong in the variant-matching lexicon. Drug-class clusters (glp_1, calcineurin_inhibitors, ace_arb) and non-drug treatment concepts (multitarget_therapy, iv_infusion) carry no drug_id. The matcher still uses cluster.variants — brand names are duplicated between variants[] and drugs.brand_names[] until a follow-up rewires the matcher. Indication, therapeutic-area, and burden registries continue to live under src/lib/content/registries/. Variants are SUGGESTION FUEL ONLY — they rank cluster suggestions in the segment tag drawer; they do NOT auto-tag any occurrence. Per-instance tag rows live in keyword_tags.json keyed by (cluster_id, segment_id, char_start, char_end).';

lex.meta.cluster_shape = {
	...lex.meta.cluster_shape,
	drug_id:
		'Optional string FK → registries/drugs.json items[].id. Set only on clusters that map 1:1 to a specific drug entity (not classes or non-drug treatment concepts). Drug metadata (MOA, sponsor, stage, indications) is resolved through the drug entity, not duplicated on the cluster.'
};

const newAssignments = converted.filter((c) => c.drug_id).map((c) => c.id);
lex.meta.changelog = [
	...(lex.meta.changelog ?? []),
	`3.5 — drug entity FK. Added optional drug_id slot on clusters; populated on ${newAssignments.length} cluster(s) whose id matches a drugs.json entity (${newAssignments.slice(0, 5).join(', ')}${newAssignments.length > 5 ? `, +${newAssignments.length - 5} more` : ''}). Drug registry validates against MOA + sponsor + indication registries. Backup: ${BACKUP.split('/').pop()}. Migration: scripts/migrate-lexicon-drug-fk.mjs.`
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
console.log(`  clusters: ${converted.length}`);
console.log(`  drug_id assignments: ${newAssignments.length}`);
console.log(`    by id: ${newAssignments.join(', ')}`);
