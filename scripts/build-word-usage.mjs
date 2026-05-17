/**
 * build-word-usage.mjs
 *
 * Step 2 of the interview analysis system: deterministic word counts.
 *
 * Reads `segments.json` (participant speech, each segment carrying a
 * question_id) and `questions.json`, and produces real, code-counted word
 * frequencies — NOT the "thematic approximations" in glpInterviewWordUsage.json.
 * Output is fully reproducible: same input -> identical output, no AI.
 *
 * Produces three views:
 *   - overall_word_usage : every participant word, ranked.
 *   - by_participant     : the same, split per interview.
 *   - question_groups    : counts grouped by canonical question (admin
 *                          questions excluded), with a per-participant
 *                          breakdown. Possible now that segments carry
 *                          question_ids from the question-normalization pass.
 *
 * Known limitation: no stemming/lemmatization. "injection" and "injections"
 * are counted separately. This keeps the count transparent and deterministic.
 *
 * Run: node scripts/build-word-usage.mjs
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const SEGMENTS_FILE = 'src/lib/content/wctglpdemo-data/segments.json';
const QUESTIONS_FILE = 'src/lib/content/wctglpdemo-data/questions.json';
const OUTPUT_FILE = 'src/lib/content/wctglpdemo-data/word_usage.json';

const TOP_WORDS_PER_QUESTION = 20;
const TOP_WORDS_PER_PARTICIPANT_IN_QUESTION = 15;

// Standard English function-word stoplist (~NLTK), common contractions, and
// pure speech fillers. Deliberately conservative: content-bearing words like
// "think", "know", "really", "people" are kept. Downstream visualisations may
// apply an extended stoplist; this layer stays auditable.
const STOPWORDS = new Set(
	(
		`a an the and but or nor so if then than that this these those of to in on at for
		with as by from up out off over under into about above below again further once
		it its they them their theirs he she his her him hers we us our ours you your yours
		i me my mine is am are was were be been being do does did doing have has had having
		will would can could shall should may might must not no here there when where why how
		what which who whom whose all any both each few more most other some such only own
		same very too s t d ll m re o just now also because while during before after
		between against through above below
		dont doesnt didnt isnt arent wasnt werent havent hasnt hadnt wont wouldnt cant
		couldnt shouldnt im ive id ill youre youve youd youll were weve wed well theyre
		theyve theyd thats theres whats lets gonna wanna
		yeah yea okay ok oh um uh umm uhh hmm mm mmm mhm huh`
	)
		.split(/\s+/)
		.filter(Boolean)
);

// Extended stoplist: high-frequency conversational/discourse filler and vague
// words. Removing these is an editorial choice (not a pure count), so the list
// is kept explicit and is echoed into the output meta for auditability. Domain
// terms (weight, medication, injection, doctor, etc.) are deliberately NOT here.
const FILLER_WORDS = new Set(
	(
		`know knows knew knowing think thinks thinking thought mean means meant
		one ones even get gets getting got gotten go goes going went gone
		definitely maybe actually really basically honestly probably literally
		obviously absolutely kind kinda sort sorta lot lots like liked likes
		thing things something anything everything nothing someone anyone everyone
		somebody anybody everybody way ways said say says saying tell tells telling
		told want wants wanted wanting much many good great guess guessed
		gonna wanna gotta come comes coming came make makes making made put puts
		putting let lets letting look looks looking looked right sure stuff bit
		pretty anyway anyways still able yes yep yup nope nah`
	)
		.split(/\s+/)
		.filter(Boolean)
);

// Final stoplist applied during tokenization.
const STOPLIST = new Set([...STOPWORDS, ...FILLER_WORDS]);

/** Lowercase, normalise curly apostrophes, split into word tokens. */
function tokenize(text) {
	const cleaned = text.toLowerCase().replace(/[‘’]/g, "'");
	const raw = cleaned.match(/[a-z0-9]+(?:['-][a-z0-9]+)*/g) || [];
	return raw
		.map((tok) => tok.replace(/^'+|'+$/g, '')) // strip stray edge apostrophes
		.filter((tok) => {
			if (tok.length < 2) return false; // drop single chars
			if (!/[a-z]/.test(tok)) return false; // drop pure-number tokens (e.g. "36")
			if (STOPLIST.has(tok.replace(/'/g, ''))) return false; // contraction-safe lookup
			return true;
		});
}

/** Count tokens -> array of { word, count } sorted by count desc, then word asc. */
function toSortedCounts(tokens) {
	const counts = new Map();
	for (const tok of tokens) counts.set(tok, (counts.get(tok) ?? 0) + 1);
	return [...counts.entries()]
		.map(([word, count]) => ({ word, count }))
		.sort((a, b) => b.count - a.count || a.word.localeCompare(b.word));
}

// --- Load inputs ---
const segmentsData = JSON.parse(readFileSync(resolve(ROOT, SEGMENTS_FILE), 'utf8'));
const questionsData = JSON.parse(readFileSync(resolve(ROOT, QUESTIONS_FILE), 'utf8'));

// Tokenize every participant segment once, keeping its interview and question.
const tokenized = segmentsData.segments.map((s) => ({
	interview_id: s.interview_id,
	question_id: s.question_id,
	tokens: tokenize(s.text)
}));

const interviewIds = [...new Set(tokenized.map((t) => t.interview_id))].sort();

// --- Overall ---
const overallTokens = tokenized.flatMap((t) => t.tokens);
const overall = toSortedCounts(overallTokens);

// --- By participant ---
const byParticipant = {};
for (const id of interviewIds) {
	const toks = tokenized.filter((t) => t.interview_id === id).flatMap((t) => t.tokens);
	const counts = toSortedCounts(toks);
	byParticipant[id] = { total_words: toks.length, unique_words: counts.length, word_usage: counts };
}

// --- Question groups (admin questions excluded, ordered by interview guide) ---
const questionGroups = {};
const primaryQuestions = [...questionsData.questions]
	.filter((q) => q.type !== 'admin')
	.sort((a, b) => a.order - b.order);

for (const q of primaryQuestions) {
	const qSegs = tokenized.filter((t) => t.question_id === q.question_id);
	if (qSegs.length === 0) continue;

	const participantBreakdown = {};
	for (const id of interviewIds) {
		const pToks = qSegs.filter((t) => t.interview_id === id).flatMap((t) => t.tokens);
		if (pToks.length) {
			participantBreakdown[id] = toSortedCounts(pToks).slice(0, TOP_WORDS_PER_PARTICIPANT_IN_QUESTION);
		}
	}

	questionGroups[q.question_id] = {
		question: q.canonical_question,
		top_words: toSortedCounts(qSegs.flatMap((t) => t.tokens)).slice(0, TOP_WORDS_PER_QUESTION),
		participant_breakdown: participantBreakdown
	};
}

const output = {
	meta: {
		schema_version: '1.1',
		study_id: segmentsData.meta.study_id,
		generated_at: new Date().toISOString(),
		generator: 'scripts/build-word-usage.mjs',
		sources: [SEGMENTS_FILE, QUESTIONS_FILE],
		scope: 'participant segments',
		tokenization: {
			lowercased: true,
			curly_apostrophes_normalized: true,
			token_pattern: "[a-z0-9]+(?:['-][a-z0-9]+)*",
			min_length: 2,
			pure_numeric_tokens_dropped: true,
			stopword_list:
				'standard English function words + contractions + speech fillers + discourse/vague fillers',
			stopwords_count: STOPLIST.size,
			stemming: false
		},
		extended_stopwords: [...FILLER_WORDS].sort(),
		notes: [
			'Deterministic, code-counted frequencies. Same input produces identical output.',
			'Counts participant speech only; interviewer prompts are not in segments.json.',
			'No stemming: e.g. "injection" and "injections" are counted separately.',
			'question_groups are grouped by canonical question; admin questions (intro/closing) are excluded.',
			'extended_stopwords are conversational/vague fillers removed by editorial choice.'
		]
	},
	overall_word_usage: overall,
	by_participant: byParticipant,
	question_groups: questionGroups
};

writeFileSync(resolve(ROOT, OUTPUT_FILE), JSON.stringify(output, null, 2) + '\n', 'utf8');

console.log(`Wrote ${OUTPUT_FILE}`);
console.log(`  overall: ${overallTokens.length} counted words, ${overall.length} unique`);
for (const [id, p] of Object.entries(byParticipant)) {
	console.log(`  ${id}: ${p.total_words} counted words, ${p.unique_words} unique`);
}
console.log(`  ${Object.keys(questionGroups).length} question groups`);
