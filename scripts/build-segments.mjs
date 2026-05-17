/**
 * build-segments.mjs
 *
 * Step 4 of the interview analysis system: response segmentation.
 *
 * Splits every PARTICIPANT turn in `interviews_structured.json` into
 * sentence-level, quote-sized analytical units. Each segment:
 *   - inherits the `question_id` of the most recent interviewer turn
 *     (from question_map.json), so it is filterable by question;
 *   - carries char offsets into the source file, so every future quote
 *     traces back to an exact location.
 *
 * Segmentation is deterministic (sentence boundaries), so this is a script
 * with a round-trip check, like steps 1-2. Idea-unit grouping and emotional-
 * phrase splitting are judgement calls and are deferred; v1 is one segment
 * per sentence. Trivially short segments are flagged, not merged.
 *
 * Run: node scripts/build-segments.mjs
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const STRUCTURED_FILE = 'src/lib/content/wctglpdemo-data/interviews_structured.json';
const QUESTION_MAP_FILE = 'src/lib/content/wctglpdemo-data/question_map.json';
const QUESTIONS_FILE = 'src/lib/content/wctglpdemo-data/questions.json';
const OUTPUT_FILE = 'src/lib/content/wctglpdemo-data/segments.json';

// Words that take a trailing period without ending a sentence.
const ABBREV = new Set([
	'dr', 'mr', 'mrs', 'ms', 'etc', 'vs', 'inc', 'st', 'jr', 'sr', 'no', 'fig',
	'dept', 'approx', 'ph', 'e.g', 'i.e', 'a.m', 'p.m', 'u.s', 'u.k'
]);

function isAbbrev(word) {
	const w = word.toLowerCase().replace(/[^a-z.]/g, '');
	if (w.length === 1) return true; // single-letter initial, e.g. "A."
	return ABBREV.has(w) || ABBREV.has(w.replace(/\.$/, ''));
}

/**
 * Split `text` into sentences. Returns [{ text, start, end }] with start/end
 * being offsets into `text` such that text.slice(start, end) === segment text.
 */
function splitSentences(text) {
	const boundaries = []; // exclusive end offsets, just after a terminator
	const re = /[.!?]+['"’”)\]]*(\s+|$)/g;
	let m;
	while ((m = re.exec(text)) !== null) {
		const trailingWs = m[1];
		const termEnd = m.index + m[0].length - trailingWs.length;

		// Skip if the word before the terminator is an abbreviation/initial.
		const before = text.slice(0, m.index);
		const lastWord = (before.match(/(\S+)$/) || [])[1] || '';
		if (isAbbrev(lastWord)) continue;

		// Skip if the next sentence does not begin like a sentence (transcribed
		// speech reliably starts sentences with a capital, digit, or quote).
		const nextIdx = m.index + m[0].length;
		if (nextIdx < text.length && !/[A-Z0-9"'‘“(]/.test(text[nextIdx])) continue;

		boundaries.push(termEnd);
	}

	const segments = [];
	let prev = 0;
	for (const cut of [...boundaries, text.length]) {
		if (cut <= prev) continue;
		const raw = text.slice(prev, cut);
		const lead = raw.length - raw.trimStart().length;
		const trimmed = raw.trim();
		if (trimmed.length > 0) {
			segments.push({ text: trimmed, start: prev + lead, end: prev + lead + trimmed.length });
		}
		prev = cut;
	}
	return segments;
}

const pad = (n) => String(n).padStart(2, '0');
const wordCount = (s) => s.split(/\s+/).filter(Boolean).length;

// --- Load inputs ---
const structured = JSON.parse(readFileSync(resolve(ROOT, STRUCTURED_FILE), 'utf8'));
const questionMap = JSON.parse(readFileSync(resolve(ROOT, QUESTION_MAP_FILE), 'utf8'));
const codebook = JSON.parse(readFileSync(resolve(ROOT, QUESTIONS_FILE), 'utf8'));
const validQuestionIds = new Set(codebook.questions.map((q) => q.question_id));

// interview_id -> [{ turn_index, question_id }] sorted ascending
const mapByInterview = new Map();
for (const iv of questionMap.interviews) {
	mapByInterview.set(
		iv.interview_id,
		iv.mappings.map((m) => ({ turn_index: m.turn_index, question_id: m.question_id }))
	);
}

/** question_id of the most recent interviewer turn before `turnIndex`. */
function inheritedQuestionId(interviewId, turnIndex) {
	const mappings = mapByInterview.get(interviewId) ?? [];
	let qid = null;
	for (const m of mappings) {
		if (m.turn_index < turnIndex) qid = m.question_id;
		else break;
	}
	return qid;
}

// --- Build segments ---
const segments = [];
const errors = [];
const perInterview = {};

for (const interview of structured.interviews) {
	const id = interview.interview_id;
	const source = readFileSync(resolve(ROOT, interview.source_file), 'utf8');
	perInterview[id] = { participant_turns: 0, segments: 0 };

	for (const turn of interview.turns) {
		if (turn.speaker !== 'participant') continue;
		perInterview[id].participant_turns++;

		const questionId = inheritedQuestionId(id, turn.turn_index);
		if (questionId === null) {
			errors.push(`${id} turn ${turn.turn_index}: no preceding interviewer turn to inherit question_id.`);
		} else if (!validQuestionIds.has(questionId)) {
			errors.push(`${id} turn ${turn.turn_index}: inherited unknown question_id "${questionId}".`);
		}

		const parts = splitSentences(turn.text);
		parts.forEach((part, segIndex) => {
			const charStart = turn.char_start + part.start;
			const charEnd = turn.char_start + part.end;
			const wc = wordCount(part.text);
			const flags = [];
			if (wc < 3) flags.push('very_short');

			segments.push({
				segment_id: `${id}_t${pad(turn.turn_index)}_s${pad(segIndex)}`,
				interview_id: id,
				turn_index: turn.turn_index,
				segment_index: segIndex,
				question_id: questionId,
				speaker: 'participant',
				text: part.text,
				char_start: charStart,
				char_end: charEnd,
				word_count: wc,
				flags
			});

			// Round-trip: offsets must reproduce the segment text from source.
			if (source.slice(charStart, charEnd) !== part.text) {
				errors.push(`${id} turn ${turn.turn_index} seg ${segIndex}: offset slice does not match text.`);
			}
		});
		perInterview[id].segments += parts.length;

		if (parts.length === 0) {
			errors.push(`${id} turn ${turn.turn_index}: produced no segments.`);
		}
	}
}

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
		generator: 'scripts/build-segments.mjs',
		sources: [STRUCTURED_FILE, QUESTION_MAP_FILE, QUESTIONS_FILE],
		segmentation: {
			unit: 'sentence',
			deterministic: true,
			idea_unit_grouping: 'deferred',
			short_segment_handling: 'flagged ("very_short"), not merged'
		},
		segment_count: segments.length,
		notes: [
			'One segment per sentence of participant speech; offsets round-trip against the source file.',
			'question_id is inherited from the most recent interviewer turn in question_map.json.',
			'Theme/emotion/sentiment tags are added by a later annotation pass, keyed by segment_id.'
		]
	},
	segments
};

writeFileSync(resolve(ROOT, OUTPUT_FILE), JSON.stringify(output, null, 2) + '\n', 'utf8');

console.log(`Wrote ${OUTPUT_FILE} (${segments.length} segments)`);
for (const [id, s] of Object.entries(perInterview)) {
	console.log(`  ${id}: ${s.segments} segments from ${s.participant_turns} participant turns`);
}
const shortCount = segments.filter((s) => s.flags.includes('very_short')).length;
console.log(`  ${shortCount} segment(s) flagged "very_short" (< 3 words)`);
