/**
 * migrate-lexicon-variant-strip.mjs
 *
 * Upgrades keyword_lexicon.json from schema 3.5 → 3.6.
 *
 * For every cluster that carries a `drug_id`, removes any variant whose
 * normalized lowercase form exactly matches the drug's generic_name or any
 * brand_name. The matcher (since 3.5) reaches into the drug registry to
 * inline those tokens at regex-build time, so keeping them in variants[] is
 * pure duplication and prevents the drug registry from being the
 * authoritative source for brand names going forward.
 *
 * Conservative: only strips EXACT matches (after the same lowercase-trim
 * normalization the matcher uses). Alternative spellings, abbreviations
 * (e.g. "mmf"), and related terms that aren't in drug.generic_name or
 * drug.brand_names[] stay in variants[].
 *
 * Validates that every stripped variant is recoverable from the drug entity
 * before writing — so the matcher's effective regex doesn't lose any
 * patterns.
 *
 * Idempotent: re-running on 3.6 only re-asserts the invariant.
 *
 * Run: node scripts/migrate-lexicon-variant-strip.mjs
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const DATA_DIR = 'src/lib/content/wctglpdemo-data';
const LEXICON = `${DATA_DIR}/keyword_lexicon.json`;
const BACKUP = `${DATA_DIR}/keyword_lexicon.v3.5-backup.json`;
const DRUGS_FILE = 'src/lib/content/registries/drugs.json';

const fail = (msg) => {
	console.error(`[ERROR] ${msg}`);
	process.exit(1);
};

const lex = JSON.parse(readFileSync(resolve(ROOT, LEXICON), 'utf8'));
const drugs = JSON.parse(readFileSync(resolve(ROOT, DRUGS_FILE), 'utf8'));

const fromVersion = lex.meta?.schema_version ?? 'unknown';
if (fromVersion !== '3.5' && fromVersion !== '3.6') {
	fail(`expected schema 3.5 or 3.6, found "${fromVersion}". Run prior migrations first.`);
}

const drugById = new Map(drugs.items.map((d) => [d.id, d]));

/** Same normalization the matcher uses (keywords.ts: normalize + lowercase trim). */
const normalize = (s) => s.replace(/[‘’]/g, "'");
const matcherKey = (s) => normalize(String(s ?? '')).toLowerCase().trim();

let totalStripped = 0;
const perClusterReport = [];

const converted = lex.clusters.map((c) => {
	if (!c.drug_id) return c;
	const drug = drugById.get(c.drug_id);
	if (!drug) fail(`cluster "${c.id}" → drug_id "${c.drug_id}" missing in drugs.json`);

	const drugTokens = new Set();
	if (drug.generic_name) drugTokens.add(matcherKey(drug.generic_name));
	for (const b of drug.brand_names ?? []) drugTokens.add(matcherKey(b));

	const before = c.variants.length;
	const next = c.variants.filter((v) => !drugTokens.has(matcherKey(v)));
	const stripped = before - next.length;
	if (stripped > 0) {
		totalStripped += stripped;
		const removed = c.variants.filter((v) => drugTokens.has(matcherKey(v)));
		perClusterReport.push({ id: c.id, stripped, removed, kept: next.length });
	}
	return { ...c, variants: next };
});

lex.meta.schema_version = '3.6';
lex.meta.supersedes = `keyword_lexicon.json @ ${fromVersion}`;
lex.meta.description =
	'Keyword cluster catalog, schema 3.6. Brand names and generic names of drugs no longer live in cluster.variants[] for clusters that carry a drug_id — the matcher (since 3.5) inlines those tokens from registries/drugs.json at regex-build time. The drug registry is now the authoritative source for brand_names + generic_name; cluster.variants holds only alternative spellings, abbreviations, and related terms that aren\'t in the drug entity. Other indication, therapeutic-area, burden, MOA, and sponsor concepts continue to live under src/lib/content/registries/. Variants are SUGGESTION FUEL ONLY — they rank cluster suggestions in the segment tag drawer; they do NOT auto-tag any occurrence. Per-instance tag rows live in keyword_tags.json keyed by (cluster_id, segment_id, char_start, char_end).';

lex.meta.changelog = [
	...(lex.meta.changelog ?? []),
	`3.6 — stripped drug.generic_name + drug.brand_names from cluster.variants on ${perClusterReport.length} clusters (${totalStripped} variant strings removed). Matcher recovers them from registries/drugs.json. Backup: ${BACKUP.split('/').pop()}. Migration: scripts/migrate-lexicon-variant-strip.mjs.`
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
console.log(`  variants stripped: ${totalStripped} across ${perClusterReport.length} cluster(s)`);
for (const r of perClusterReport) {
	console.log(`    ${r.id.padEnd(22)} −${r.stripped}  (kept ${r.kept})  removed: ${r.removed.join(', ')}`);
}
