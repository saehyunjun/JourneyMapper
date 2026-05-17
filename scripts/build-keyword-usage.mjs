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
 * Known limitation: no stemming/lemmatization. Coverage of a keyword is exactly
 * the variants listed for it in the lexicon — nothing more.
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
const OUTPUT_FILE = 'src/lib/content/wctglpdemo-data/keyword_usage.json';

/** Collected integrity failures; if non-empty at the end, nothing is written. */
const errors = [];

// --- Load inputs ---
const lexicon = JSON.parse(readFileSync(resolve(ROOT, LEXICON_FILE), 'utf8'));
const segmentsData = JSON.parse(readFileSync(resolve(ROOT, SEGMENTS_FILE), 'utf8'));

// --- Validate the lexicon shape ---
const categoryIds = new Set();
const keywordIds = new Set();
if (!Array.isArray(lexicon.categories) || lexicon.categories.length === 0) {
	errors.push('Lexicon has no categories.');
}
for (const cat of lexicon.categories ?? []) {
	if (!cat.id) errors.push('A category is missing an id.');
	if (categoryIds.has(cat.id)) errors.push(`Duplicate category id: ${cat.id}`);
	categoryIds.add(cat.id);
	if (!Array.isArray(cat.keywords) || cat.keywords.length === 0) {
		errors.push(`Category "${cat.id}" has no keywords.`);
	}
	for (const kw of cat.keywords ?? []) {
		if (!kw.id) errors.push(`A keyword in "${cat.id}" is missing an id.`);
		if (keywordIds.has(kw.id)) errors.push(`Duplicate keyword id across lexicon: ${kw.id}`);
		keywordIds.add(kw.id);
		if (!Array.isArray(kw.variants) || kw.variants.length === 0) {
			errors.push(`Keyword "${kw.id}" has no variants.`);
		}
	}
}

/** Normalise curly apostrophes so lexicon variants and segment text agree. */
const normalize = (s) => s.replace(/[‘’]/g, "'");

/** Escape regex metacharacters in a literal string. */
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Build one case-insensitive regex per keyword: an alternation of all its
 * variants, longest first (so a longer phrase wins over a shorter prefix),
 * bounded by non-alphanumeric lookarounds. Space/hyphen runs in a variant are
 * made flexible.
 */
function keywordRegex(kw) {
	const alts = [...kw.variants]
		.map(normalize)
		.sort((a, b) => b.length - a.length)
		.map((v) => escapeRegex(v).replace(/[\s-]+/g, '[\\s-]+'));
	return new RegExp(`(?<![A-Za-z0-9])(?:${alts.join('|')})(?![A-Za-z0-9])`, 'gi');
}

// --- Index segments ---
const segments = segmentsData.segments;
const interviewIds = [...new Set(segments.map((s) => s.interview_id))].sort();

// --- Match every keyword against every segment ---
const categoriesOut = [];
// by_participant[id] = { total_mentions, by_category: { catId: count } }
const byParticipant = {};
for (const id of interviewIds) {
	byParticipant[id] = { total_mentions: 0, by_category: {} };
	for (const cat of lexicon.categories) byParticipant[id].by_category[cat.id] = 0;
}

for (const cat of lexicon.categories) {
	const keywordsOut = [];
	let categoryTotal = 0;

	for (const kw of cat.keywords) {
		const regex = keywordRegex(kw);
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

				// Integrity: the matched span must sit inside the segment's
				// declared source range.
				if (absEnd > seg.char_end) {
					errors.push(
						`Keyword "${kw.id}" match in ${seg.segment_id} runs past segment end ` +
							`(${absEnd} > ${seg.char_end}).`
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

		// Integrity: per-participant counts must sum to the total.
		const summed = Object.values(perParticipant).reduce((n, v) => n + v, 0);
		if (summed !== count) {
			errors.push(`Keyword "${kw.id}": by_participant sums to ${summed}, expected ${count}.`);
		}

		categoryTotal += count;
		for (const id of interviewIds) {
			byParticipant[id].by_category[cat.id] += perParticipant[id];
			byParticipant[id].total_mentions += perParticipant[id];
		}

		keywordsOut.push({
			id: kw.id,
			label: kw.label,
			variants: kw.variants,
			count,
			by_participant: perParticipant,
			matches
		});
	}

	keywordsOut.sort((a, b) => b.count - a.count || a.id.localeCompare(b.id));

	categoriesOut.push({
		id: cat.id,
		label: cat.label,
		description: cat.description,
		total_mentions: categoryTotal,
		keywords_present: keywordsOut.filter((k) => k.count > 0).length,
		keywords_total: keywordsOut.length,
		keywords: keywordsOut
	});
}

// --- Bail out before writing if anything failed integrity ---
if (errors.length) {
	console.error(`build-keyword-usage.mjs: ${errors.length} integrity failure(s), nothing written:`);
	for (const e of errors) console.error(`  - ${e}`);
	process.exit(1);
}

const grandTotal = categoriesOut.reduce((n, c) => n + c.total_mentions, 0);

const output = {
	meta: {
		schema_version: '1.0',
		study_id: segmentsData.meta.study_id,
		generated_at: new Date().toISOString(),
		generator: 'scripts/build-keyword-usage.mjs',
		sources: [LEXICON_FILE, SEGMENTS_FILE],
		lexicon_version: lexicon.meta.schema_version,
		scope: 'participant segments',
		notes: [
			'Deterministic, code-counted keyword frequencies. Same lexicon + segments produces identical output.',
			'Counts participant speech only; interviewer prompts are not in segments.json.',
			'Coverage of each keyword is exactly the variants listed in keyword_lexicon.json — no stemming.',
			'Keywords are counted independently; overlapping spans across keywords are not de-duplicated.',
			'Every match carries absolute source char offsets (segment.char_start + local offset).'
		]
	},
	totals: {
		categories: categoriesOut.length,
		keywords: keywordIds.size,
		mentions: grandTotal
	},
	categories: categoriesOut,
	by_participant: byParticipant
};

writeFileSync(resolve(ROOT, OUTPUT_FILE), JSON.stringify(output, null, 2) + '\n', 'utf8');

console.log(`Wrote ${OUTPUT_FILE}`);
console.log(`  ${categoriesOut.length} categories, ${keywordIds.size} keywords, ${grandTotal} mentions`);
for (const c of categoriesOut) {
	console.log(`  ${c.id}: ${c.total_mentions} mentions across ${c.keywords_present}/${c.keywords_total} keywords`);
}
for (const id of interviewIds) {
	console.log(`  ${id}: ${byParticipant[id].total_mentions} mentions`);
}
