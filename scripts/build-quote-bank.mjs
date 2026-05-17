/**
 * build-quote-bank.mjs
 *
 * Step 6 of the interview analysis system: the quote bank.
 *
 * Pulls high-value quotes for reporting and presentations. Each quote is one
 * or more CONTIGUOUS segments from a single participant turn, so it carries
 * exact char offsets and is VERBATIM-VALIDATED: the quote text must equal
 * source.slice(char_start, char_end), and each constituent segment's text must
 * appear within it. A quote that fails verbatim validation is never written.
 *
 * Quote selection and scoring are judgement calls — the QUOTES table is
 * AI-proposed, every quote is review_status "pending". Themes/emotions/
 * sentiment are inherited from segment_tags.json (not re-judged here).
 *
 * The script's job is integrity: segments exist, belong to one turn, are
 * contiguous, scores are in range, and the quote is verbatim. Exits non-zero
 * on any failure.
 *
 * Run: node scripts/build-quote-bank.mjs
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const STRUCTURED_FILE = 'src/lib/content/wctglpdemo-data/interviews_structured.json';
const SEGMENTS_FILE = 'src/lib/content/wctglpdemo-data/segments.json';
const SEGMENT_TAGS_FILE = 'src/lib/content/wctglpdemo-data/segment_tags.json';
const OUTPUT_FILE = 'src/lib/content/wctglpdemo-data/quote_bank.json';

const SCORE_DIMENSIONS = ['clarity', 'emotional_intensity', 'strategic_value', 'specificity'];

/**
 * AI-proposed pull quotes.
 * - segment_ids: one or more contiguous segments from a single participant turn.
 * - scores: [clarity, emotional_intensity, strategic_value, specificity], each 1-5.
 */
const QUOTES = [
	// --- participant_09 ---
	{
		segment_ids: ['participant_09_t03_s03', 'participant_09_t03_s04'],
		scores: [4, 3, 5, 4],
		uses: ['access barriers', 'trial recruitment strategy', 'payer engagement']
	},
	{
		segment_ids: ['participant_09_t03_s05', 'participant_09_t03_s06'],
		scores: [5, 4, 5, 5],
		uses: ['access barriers', 'cost messaging', 'patient journey map']
	},
	{
		segment_ids: ['participant_09_t03_s11', 'participant_09_t03_s12'],
		scores: [5, 4, 4, 5],
		uses: ['non-weight benefits', 'clinical value story']
	},
	{
		segment_ids: ['participant_09_t13_s01', 'participant_09_t13_s02'],
		scores: [5, 4, 4, 3],
		uses: ['injection burden', 'oral vs injectable', 'patient journey map']
	},
	{
		segment_ids: ['participant_09_t17_s02', 'participant_09_t17_s03'],
		scores: [4, 3, 4, 3],
		uses: ['trial motivation', 'recruitment messaging']
	},
	{
		segment_ids: ['participant_09_t21_s01', 'participant_09_t21_s02'],
		scores: [5, 3, 5, 5],
		uses: ['trial barriers', 'site selection', 'decentralized trial design']
	},
	{
		segment_ids: ['participant_09_t21_s04'],
		scores: [4, 3, 5, 4],
		uses: ['trial design', 'decentralized trial design', 'barrier mitigation']
	},
	{
		segment_ids: ['participant_09_t37_s01'],
		scores: [5, 4, 4, 4],
		uses: ['time burden', 'trial barriers', 'patient journey map']
	},
	{
		segment_ids: ['participant_09_t41_s01'],
		scores: [5, 3, 4, 3],
		uses: ['oral vs injectable', 'product preference']
	},

	// --- participant_10 ---
	{
		segment_ids: ['participant_10_t05_s05'],
		scores: [5, 5, 5, 4],
		uses: ['treatment dependency', 'maintenance positioning', 'patient journey map']
	},
	{
		segment_ids: ['participant_10_t07_s05'],
		scores: [4, 3, 4, 4],
		uses: ['drug switching', 'efficacy messaging']
	},
	{
		segment_ids: ['participant_10_t15_s02'],
		scores: [5, 4, 4, 3],
		uses: ['placebo acceptance', 'trial motivation']
	},
	{
		segment_ids: ['participant_10_t19_s00'],
		scores: [4, 3, 4, 5],
		uses: ['monthly dosing', 'product concern', 'trial design']
	},
	{
		segment_ids: ['participant_10_t25_s00'],
		scores: [4, 3, 4, 3],
		uses: ['incentive design', 'recruitment strategy']
	},
	{
		segment_ids: ['participant_10_t31_s00'],
		scores: [4, 4, 5, 3],
		uses: ['decentralized trial design', 'barrier mitigation']
	},
	{
		segment_ids: ['participant_10_t35_s04', 'participant_10_t35_s05'],
		scores: [5, 4, 5, 4],
		uses: ['maintenance positioning', 'lifestyle support', 'patient education']
	},
	{
		segment_ids: ['participant_10_t47_s00'],
		scores: [5, 4, 4, 4],
		uses: ['trial concerns', 'safety communication', 'recruitment messaging']
	},
	{
		segment_ids: ['participant_10_t49_s01'],
		scores: [5, 4, 4, 4],
		uses: ['education need', 'lifestyle support']
	},
	{
		segment_ids: ['participant_10_t51_s04'],
		scores: [5, 5, 3, 4],
		uses: ['weight loss history', 'patient journey map']
	},
	{
		segment_ids: ['participant_10_t51_s09'],
		scores: [5, 5, 4, 3],
		uses: ['weight loss history', 'patient journey map', 'emotional narrative']
	},
	{
		segment_ids: ['participant_10_t59_s02'],
		scores: [5, 4, 4, 5],
		uses: ['non-weight benefits', 'product value story']
	},
	{
		segment_ids: ['participant_10_t63_s03'],
		scores: [5, 5, 5, 3],
		uses: ['advocacy messaging', 'report headline']
	}
];

// --- Load inputs ---
const structured = JSON.parse(readFileSync(resolve(ROOT, STRUCTURED_FILE), 'utf8'));
const segmentsData = JSON.parse(readFileSync(resolve(ROOT, SEGMENTS_FILE), 'utf8'));
const tagsData = JSON.parse(readFileSync(resolve(ROOT, SEGMENT_TAGS_FILE), 'utf8'));

const segmentsById = new Map(segmentsData.segments.map((s) => [s.segment_id, s]));
const tagsBySegment = new Map(tagsData.annotations.map((a) => [a.segment_id, a]));
const sourceByInterview = new Map();
for (const iv of structured.interviews) {
	sourceByInterview.set(iv.interview_id, readFileSync(resolve(ROOT, iv.source_file), 'utf8'));
}

const errors = [];
const quotes = [];
const perInterviewCount = {};

QUOTES.forEach((entry, i) => {
	const where = `quote #${i + 1}`;
	const segs = entry.segment_ids.map((id) => segmentsById.get(id));

	if (segs.some((s) => !s)) {
		errors.push(`${where}: references an unknown segment_id.`);
		return;
	}
	// All segments must come from one participant turn of one interview.
	const interviewId = segs[0].interview_id;
	const turnIndex = segs[0].turn_index;
	const questionId = segs[0].question_id;
	if (segs.some((s) => s.interview_id !== interviewId || s.turn_index !== turnIndex)) {
		errors.push(`${where}: segments span more than one turn.`);
		return;
	}
	if (segs.some((s) => s.speaker !== 'participant')) {
		errors.push(`${where}: includes a non-participant segment.`);
		return;
	}
	// Segments must be contiguous (consecutive segment_index values).
	const ordered = [...segs].sort((a, b) => a.segment_index - b.segment_index);
	for (let k = 1; k < ordered.length; k++) {
		if (ordered[k].segment_index !== ordered[k - 1].segment_index + 1) {
			errors.push(`${where}: segments are not contiguous.`);
			return;
		}
	}

	// Scores: four integers in 1-5.
	if (entry.scores.length !== 4 || entry.scores.some((v) => !Number.isInteger(v) || v < 1 || v > 5)) {
		errors.push(`${where}: scores must be four integers in [1, 5].`);
		return;
	}

	// Verbatim validation: offsets reproduce the quote, and every segment is inside it.
	const charStart = ordered[0].char_start;
	const charEnd = ordered[ordered.length - 1].char_end;
	const source = sourceByInterview.get(interviewId);
	const text = source.slice(charStart, charEnd);
	let verbatim = true;
	for (const s of ordered) {
		if (!text.includes(s.text)) verbatim = false;
	}
	if (!verbatim) {
		errors.push(`${where}: quote text does not contain every constituent segment verbatim.`);
		return;
	}

	// Inherit tags from segment_tags.json (union; sentiment = rounded mean).
	const themes = new Set();
	const subthemes = new Set();
	const emotions = new Set();
	const semantic = new Set();
	const sentiments = [];
	for (const s of ordered) {
		const ann = tagsBySegment.get(s.segment_id);
		if (!ann) {
			errors.push(`${where}: segment ${s.segment_id} has no annotation in segment_tags.json.`);
			return;
		}
		ann.themes.forEach((t) => themes.add(t));
		ann.subthemes.forEach((t) => subthemes.add(t));
		ann.emotions.forEach((t) => emotions.add(t));
		ann.semantic_tags.forEach((t) => semantic.add(t));
		sentiments.push(ann.sentiment);
	}
	const sentiment = Math.round(sentiments.reduce((n, v) => n + v, 0) / sentiments.length);

	const [clarity, emotional, strategic, specificity] = entry.scores;
	const overall = Number(((clarity + emotional + strategic + specificity) / 4).toFixed(2));

	perInterviewCount[interviewId] = (perInterviewCount[interviewId] ?? 0) + 1;
	const quoteId = `q_${interviewId}_${String(perInterviewCount[interviewId]).padStart(3, '0')}`;

	quotes.push({
		quote_id: quoteId,
		interview_id: interviewId,
		question_id: questionId,
		segment_ids: ordered.map((s) => s.segment_id),
		text,
		char_start: charStart,
		char_end: charEnd,
		verbatim_verified: true,
		themes: [...themes],
		subthemes: [...subthemes],
		emotions: [...emotions],
		semantic_tags: [...semantic],
		sentiment,
		quote_score: {
			clarity,
			emotional_intensity: emotional,
			strategic_value: strategic,
			specificity,
			overall
		},
		recommended_uses: entry.uses,
		source: 'ai_proposed',
		review_status: 'pending',
		reviewer_notes: entry.note ?? ''
	});
});

if (errors.length > 0) {
	console.error(`x Validation failed with ${errors.length} error(s). Output not written.`);
	for (const e of errors) console.error(`  - ${e}`);
	process.exit(1);
}

const output = {
	meta: {
		schema_version: '1.0',
		study_id: structured.meta.study_id,
		generated_at: new Date().toISOString(),
		generator: 'scripts/build-quote-bank.mjs',
		sources: [STRUCTURED_FILE, SEGMENTS_FILE, SEGMENT_TAGS_FILE],
		labels_status: 'ai_proposed',
		quote_count: quotes.length,
		score_dimensions: SCORE_DIMENSIONS,
		notes: [
			'Quotes are AI-selected and AI-scored; every quote is review_status "pending".',
			'verbatim_verified is true only after the script confirms the quote equals source.slice(char_start, char_end) and contains each constituent segment.',
			'themes/emotions/sentiment are inherited from segment_tags.json, not re-judged here.',
			'A quote is one or more contiguous segments from a single participant turn.'
		]
	},
	quotes
};

writeFileSync(resolve(ROOT, OUTPUT_FILE), JSON.stringify(output, null, 2) + '\n', 'utf8');

console.log(`Wrote ${OUTPUT_FILE} (${quotes.length} quotes)`);
for (const [id, n] of Object.entries(perInterviewCount)) console.log(`  ${id}: ${n} quotes`);
console.log(`  all ${quotes.length} verbatim-verified against source`);
const avg = (quotes.reduce((n, q) => n + q.quote_score.overall, 0) / quotes.length).toFixed(2);
console.log(`  mean overall score: ${avg}`);
const top = [...quotes].sort((a, b) => b.quote_score.overall - a.quote_score.overall).slice(0, 3);
console.log('  highest-scoring:');
for (const q of top) {
	const t = q.text.length > 90 ? q.text.slice(0, 90) + '…' : q.text;
	console.log(`    ${q.quote_score.overall}  [${q.quote_id}] "${t}"`);
}
