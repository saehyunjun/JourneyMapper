/**
 * build-keyword-usage.mjs
 *
 * Companion to the interview analysis pipeline: deterministic keyword counts.
 *
 * Reads the categorized term taxonomy in `keyword_lexicon.json` and the
 * participant speech in `segments.json`, and counts how often each keyword
 * (across all its surface variants) appears. Output is fully reproducible:
 * same lexicon + same segments -> identical output, no AI.
 *
 * The lexicon itself is a judgment artifact (deciding that "Wegovy" belongs to
 * "Medications & products" is editorial) and is edited by hand. This script is
 * the deterministic half: it only matches and counts.
 *
 * Produces, per category and keyword:
 *   - count            : total mentions across all participant segments.
 *   - by_participant   : the same count split per interview.
 *   - matches          : every hit, with the segment it came from and the
 *                        absolute char offsets it occupies in the source file
 *                        (segment.char_start + local offset), so a count
 *                        traces back to a span of text like a quote does.
 * Plus a by_participant rollup of mentions per category.
 *
 * Matching rules (see keyword_lexicon.json meta.matching_notes):
 *   - case-insensitive;
 *   - within a variant, runs of spaces/hyphens match any run of whitespace or
 *     hyphens, so "out of pocket" also matches "out-of-pocket";
 *   - matches must sit on non-alphanumeric boundaries, so "oral" does not match
 *     inside "orally" unless "orally" is itself a listed variant;
 *   - each keyword is matched independently — overlapping spans across keywords
 *     (e.g. "oral GLP-1" counting for both oral_medication and glp_1) are NOT
 *     de-duplicated. This is intentional and documented in the lexicon.
 *
 * Surface-form resolution (since lexicon schema 3.6): clusters that carry a
 * `drug_id` FK do NOT duplicate the drug entity's generic_name + brand_names in
 * `cluster.variants[]` — those names live in registries/drugs.json and this
 * script inlines them at regex-build time. So the effective match set for any
 * cluster is the union of (cluster.variants, drug.generic_name, drug.brand_names).
 * A cluster with `drug_id` and an empty variants[] is valid as long as the drug
 * entity contributes at least one surface form. The output's `clusters[].variants`
 * field reflects the EFFECTIVE list (what the regex matched against), so a
 * downstream consumer sees the surface forms that produced the counts.
 *
 * Known limitation: no stemming/lemmatization. Coverage of a keyword is exactly
 * the variants listed for it in the lexicon plus any drug-entity names — nothing more.
 *
 * Validates before writing: on any integrity failure it logs and exit(1)s
 * without writing output.
 *
 * Run: node scripts/build-keyword-usage.mjs
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const LEXICON_FILE = 'src/lib/content/wctglpdemo-data/keyword_lexicon.json';
const SEGMENTS_FILE = 'src/lib/content/wctglpdemo-data/segments.json';
const DRUGS_FILE = 'src/lib/content/registries/drugs.json';
const OUTPUT_FILE = 'src/lib/content/wctglpdemo-data/keyword_usage.json';

/** Collected integrity failures; if non-empty at the end, nothing is written. */
const errors = [];

// --- Load inputs ---
const lexicon = JSON.parse(readFileSync(resolve(ROOT, LEXICON_FILE), 'utf8'));
const segmentsData = JSON.parse(readFileSync(resolve(ROOT, SEGMENTS_FILE), 'utf8'));
const drugsRegistry = JSON.parse(readFileSync(resolve(ROOT, DRUGS_FILE), 'utf8'));
const drugById = new Map(drugsRegistry.items.map((d) => [d.id, d]));

/**
 * Resolve the effective surface forms for a cluster.
 *
 * Since lexicon schema 3.6, clusters carrying `drug_id` no longer duplicate the
 * drug entity's generic_name + brand_names in `variants[]` — the matcher pulls
 * them from the drug registry at regex-build time. So the effective surface
 * forms for matching = (cluster.variants ∪ drug.generic_name ∪ drug.brand_names),
 * lowercased, with empties dropped. A cluster with `drug_id` and an empty
 * variants[] is valid as long as the drug entity contributes at least one name.
 */
function effectiveSurfaceForms(cluster) {
	const surfaces = [...(cluster.variants ?? [])];
	if (cluster.drug_id) {
		const drug = drugById.get(cluster.drug_id);
		if (drug) {
			if (drug.generic_name) surfaces.push(drug.generic_name);
			for (const b of drug.brand_names ?? []) surfaces.push(b);
		}
	}
	return [...new Set(surfaces.map((s) => s.toLowerCase().trim()).filter(Boolean))];
}

// --- Validate the lexicon shape ---
const clusterIds = new Set();
if (!Array.isArray(lexicon.clusters) || lexicon.clusters.length === 0) {
	errors.push('Lexicon has no clusters.');
}
for (const cluster of lexicon.clusters ?? []) {
	if (!cluster.id) errors.push('A cluster is missing an id.');
	if (clusterIds.has(cluster.id)) errors.push(`Duplicate cluster id: ${cluster.id}`);
	clusterIds.add(cluster.id);
	if (!cluster.parent_theme || !cluster.parent_subtheme) {
		errors.push(`Cluster "${cluster.id}" is missing parent_theme or parent_subtheme.`);
	}
	if (cluster.drug_id && !drugById.has(cluster.drug_id)) {
		errors.push(`Cluster "${cluster.id}" references unknown drug_id "${cluster.drug_id}".`);
	}
	if (effectiveSurfaceForms(cluster).length === 0) {
		errors.push(
			`Cluster "${cluster.id}" has no effective surface forms (no variants[] and no drug_id contributing names).`
		);
	}
}

/** Normalise curly apostrophes so lexicon variants and segment text agree. */
const normalize = (s) => s.replace(/[‘’]/g, "'");

/** Escape regex metacharacters in a literal string. */
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Build one case-insensitive regex per cluster: an alternation of all its
 * effective surface forms (cluster.variants ∪ drug.generic_name ∪ drug.brand_names
 * when drug_id is set), longest first (so a longer phrase wins over a shorter
 * prefix), bounded by non-alphanumeric lookarounds. Space/hyphen runs in a
 * variant are made flexible.
 */
function clusterRegex(cluster) {
	const alts = effectiveSurfaceForms(cluster)
		.map(normalize)
		.sort((a, b) => b.length - a.length)
		.map((v) => escapeRegex(v).replace(/[\s-]+/g, '[\\s-]+'));
	return new RegExp(`(?<![A-Za-z0-9])(?:${alts.join('|')})(?![A-Za-z0-9])`, 'gi');
}

// --- Index segments ---
const segments = segmentsData.segments;
const interviewIds = [...new Set(segments.map((s) => s.interview_id))].sort();

// --- Match every cluster against every segment ---
const clustersOut = [];
// by_participant[id] = { total_mentions, by_subtheme: { subthemeId: count } }
const byParticipant = {};
const subthemesSeen = new Set();
for (const cluster of lexicon.clusters) subthemesSeen.add(cluster.parent_subtheme);
for (const id of interviewIds) {
	byParticipant[id] = { total_mentions: 0, by_subtheme: {} };
	for (const s of subthemesSeen) byParticipant[id].by_subtheme[s] = 0;
}

for (const cluster of lexicon.clusters) {
	const regex = clusterRegex(cluster);
	const matches = [];
	const perParticipant = {};
	for (const id of interviewIds) perParticipant[id] = 0;

	for (const seg of segments) {
		const text = normalize(seg.text);
		for (const m of text.matchAll(regex)) {
			const local = m.index;
			const matched = m[0];
			const absStart = seg.char_start + local;
			const absEnd = absStart + matched.length;

			// Integrity: matched span must sit inside the segment's text. We
			// check against seg.text.length, not (seg.char_end - seg.char_start),
			// because segments edited via the drawer carry approximate char
			// offsets (their declared range no longer matches the rewritten text).
			if (local + matched.length > seg.text.length) {
				errors.push(
					`Cluster "${cluster.id}" match in ${seg.segment_id} runs past segment text length ` +
						`(${local + matched.length} > ${seg.text.length}).`
				);
			}

			matches.push({
				segment_id: seg.segment_id,
				interview_id: seg.interview_id,
				question_id: seg.question_id,
				text: matched,
				char_start: absStart,
				char_end: absEnd
			});
			perParticipant[seg.interview_id] += 1;
		}
	}

	const count = matches.length;

	const summed = Object.values(perParticipant).reduce((n, v) => n + v, 0);
	if (summed !== count) {
		errors.push(`Cluster "${cluster.id}": by_participant sums to ${summed}, expected ${count}.`);
	}

	for (const id of interviewIds) {
		byParticipant[id].by_subtheme[cluster.parent_subtheme] += perParticipant[id];
		byParticipant[id].total_mentions += perParticipant[id];
	}

	clustersOut.push({
		id: cluster.id,
		label: cluster.label,
		parent_theme: cluster.parent_theme,
		parent_subtheme: cluster.parent_subtheme,
		variants: effectiveSurfaceForms(cluster),
		count,
		by_participant: perParticipant,
		matches
	});
}

clustersOut.sort((a, b) => b.count - a.count || a.id.localeCompare(b.id));

// --- Bail out before writing if anything failed integrity ---
if (errors.length) {
	console.error(`build-keyword-usage.mjs: ${errors.length} integrity failure(s), nothing written:`);
	for (const e of errors) console.error(`  - ${e}`);
	process.exit(1);
}

const grandTotal = clustersOut.reduce((n, c) => n + c.count, 0);

// Build a transitional `categories` view by grouping clusters under their
// parent_subtheme — consumers built against the 1.x output shape continue
// reading without changes. New code should read `clusters` directly.
const categoriesShim = (() => {
	const byParent = new Map();
	for (const c of clustersOut) {
		const list = byParent.get(c.parent_subtheme) ?? [];
		list.push(c);
		byParent.set(c.parent_subtheme, list);
	}
	return [...byParent.entries()].map(([id, keywords]) => ({
		id,
		label: id,
		description: '',
		total_mentions: keywords.reduce((n, k) => n + k.count, 0),
		keywords_present: keywords.filter((k) => k.count > 0).length,
		keywords_total: keywords.length,
		keywords
	}));
})();

const output = {
	meta: {
		schema_version: '2.0',
		study_id: segmentsData.meta.study_id,
		generated_at: new Date().toISOString(),
		generator: 'scripts/build-keyword-usage.mjs',
		sources: [LEXICON_FILE, SEGMENTS_FILE, DRUGS_FILE],
		lexicon_version: lexicon.meta.schema_version,
		scope: 'participant segments',
		notes: [
			'Deterministic, code-counted cluster frequencies. Same lexicon + segments + drug registry produces identical output.',
			'Counts participant speech only; interviewer prompts are not in segments.json.',
			'Coverage of each cluster is its effective surface forms (cluster.variants ∪ drug.generic_name ∪ drug.brand_names when drug_id is set) — no stemming.',
			'Clusters are counted independently; overlapping spans across clusters are not de-duplicated.',
			'Every match carries absolute source char offsets (segment.char_start + local offset).',
			'Per-participant counts roll up to per-subtheme via the cluster\'s parent_subtheme.'
		]
	},
	totals: {
		clusters: clustersOut.length,
		clusters_present: clustersOut.filter((c) => c.count > 0).length,
		mentions: grandTotal
	},
	clusters: clustersOut,
	categories: categoriesShim,
	by_participant: byParticipant
};

writeFileSync(resolve(ROOT, OUTPUT_FILE), JSON.stringify(output, null, 2) + '\n', 'utf8');

console.log(`Wrote ${OUTPUT_FILE}`);
console.log(`  ${clustersOut.length} clusters (${output.totals.clusters_present} with matches), ${grandTotal} mentions`);
for (const id of interviewIds) {
	console.log(`  ${id}: ${byParticipant[id].total_mentions} mentions`);
}
