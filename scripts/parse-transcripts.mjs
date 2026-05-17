/**
 * parse-transcripts.mjs
 *
 * Step 1 of the interview analysis system: turn cleaned, de-identified
 * transcripts into `interviews_structured.json` — the canonical, deterministic
 * source of truth. No AI, no judgement: pure parsing.
 *
 * Everything downstream (word counts, segments, tags, quotes) derives from this
 * file, so provenance is baked in here: every turn carries a `turn_index` and
 * char offsets such that `sourceText.slice(char_start, char_end) === turn.text`.
 *
 * Assumptions for v1 (scope: two transcripts):
 *   - Transcripts are already cleaned and de-identified (no PHI pass here).
 *   - One speaker turn per line.
 *   - Title line carries the participant number; the line(s) between the title
 *     and the first speaker turn carry demographics.
 *
 * Run: node scripts/parse-transcripts.mjs
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const SCHEMA_VERSION = '1.0';
const STUDY_ID = 'wct_glp1';
const CONDITION = 'GLP-1 weight maintenance';

const INPUT_FILES = ['Example Interview.md', 'Example Interview 2.md'];
const OUTPUT_FILE = 'src/lib/content/wctglpdemo-data/interviews_structured.json';

// Tolerates `**interviewer:**`, `Interviewer:`, `Participant:` and similar.
const SPEAKER_RE = /^\s*\*{0,2}\s*(interviewer|participant)\s*:?\s*\*{0,2}\s*:?\s*/i;
const TITLE_PARTICIPANT_RE = /participant\s+(\d+)/i;

/** Pre-compute the start offset of every line in the source string. */
function lineOffsets(content) {
	const lines = content.split('\n');
	const offsets = [];
	let cur = 0;
	for (const line of lines) {
		offsets.push(cur);
		cur += line.length + 1; // +1 for the consumed '\n'
	}
	return { lines, offsets };
}

function parseGender(raw) {
	const s = raw.toLowerCase();
	if (s.includes('female')) return 'female'; // check before 'male' (substring)
	if (s.includes('male')) return 'male';
	return null;
}

function parseTranscript(relPath) {
	const content = readFileSync(resolve(ROOT, relPath), 'utf8');
	const { lines, offsets } = lineOffsets(content);
	const warnings = [];

	// --- Title (line 0) ---
	const titleLine = lines[0] ?? '';
	const titleMatch = titleLine.match(TITLE_PARTICIPANT_RE);
	if (!titleMatch) {
		warnings.push(`Could not find participant number in title: "${titleLine.trim()}"`);
	}
	const participantNum = titleMatch ? Number(titleMatch[1]) : null;
	const interviewId =
		participantNum != null
			? `participant_${String(participantNum).padStart(2, '0')}`
			: `unknown_${basename(relPath)}`;

	// --- Walk lines: demographics first, then speaker turns ---
	const turns = [];
	const demographicsLines = [];
	let seenFirstSpeaker = false;
	let turnIndex = 0;

	for (let i = 1; i < lines.length; i++) {
		const line = lines[i];
		if (line.trim() === '') continue;

		const speaker = line.match(SPEAKER_RE);
		if (!speaker) {
			// Before the first turn this is demographics; after it, it is noise.
			if (!seenFirstSpeaker) {
				demographicsLines.push(line.replace(/^[#\-*\s]+/, '').trim());
			} else {
				warnings.push(`Unrecognized line ${i + 1} (not a speaker turn), skipped: "${line.trim()}"`);
			}
			continue;
		}

		seenFirstSpeaker = true;
		const labelLen = speaker[0].length;
		const rawContent = line.slice(labelLen);
		const leading = rawContent.length - rawContent.trimStart().length;
		const text = rawContent.trim();

		if (text === '') {
			warnings.push(`Empty turn at line ${i + 1} (${speaker[1].toLowerCase()}), skipped.`);
			continue;
		}

		const charStart = offsets[i] + labelLen + leading;
		turns.push({
			turn_index: turnIndex++,
			speaker: speaker[1].toLowerCase(),
			text,
			char_start: charStart,
			char_end: charStart + text.length
		});
	}

	const demographicsRaw = demographicsLines.filter(Boolean).join('; ');

	return {
		interview: {
			interview_id: interviewId,
			source_file: relPath,
			source_title: titleLine.trim() || null,
			participant_metadata: {
				condition: CONDITION,
				demographics_raw: demographicsRaw || null,
				gender: demographicsRaw ? parseGender(demographicsRaw) : null
			},
			turn_count: turns.length,
			turns
		},
		content,
		warnings
	};
}

/** Round-trip check: offsets must reproduce the turn text exactly. */
function validate(interview, content) {
	const errors = [];
	for (const t of interview.turns) {
		const where = `${interview.interview_id} turn ${t.turn_index}`;
		if (content.slice(t.char_start, t.char_end) !== t.text) {
			errors.push(`${where}: offset slice does not match text.`);
		}
		if (t.text !== t.text.trim()) {
			errors.push(`${where}: text has surrounding whitespace.`);
		}
		if (SPEAKER_RE.test(t.text)) {
			errors.push(`${where}: text still begins with a speaker label.`);
		}
		if (t.text.length === 0) {
			errors.push(`${where}: empty text.`);
		}
	}
	return errors;
}

// --- Run ---
const interviews = [];
const allErrors = [];

for (const relPath of INPUT_FILES) {
	const { interview, content, warnings } = parseTranscript(relPath);
	const errors = validate(interview, content);
	allErrors.push(...errors);

	const iv = interview.turns.filter((t) => t.speaker === 'interviewer').length;
	const pt = interview.turns.filter((t) => t.speaker === 'participant').length;
	console.log(`\n${relPath}  ->  ${interview.interview_id}`);
	console.log(`  turns: ${interview.turn_count} (interviewer: ${iv}, participant: ${pt})`);
	console.log(`  demographics: ${interview.participant_metadata.demographics_raw ?? '(none)'}`);
	for (const w of warnings) console.log(`  ! ${w}`);
	for (const e of errors) console.log(`  x ${e}`);

	interviews.push(interview);
}

if (allErrors.length > 0) {
	console.error(`\nx Validation failed with ${allErrors.length} error(s). Output not written.`);
	process.exit(1);
}

const output = {
	meta: {
		schema_version: SCHEMA_VERSION,
		study_id: STUDY_ID,
		generated_at: new Date().toISOString(),
		generator: 'scripts/parse-transcripts.mjs',
		source_files: INPUT_FILES,
		notes: [
			'Canonical source-of-truth structure. All downstream outputs derive from this.',
			'char_start/char_end are JS string (UTF-16) indices into the source file; turn text equals source.slice(char_start, char_end).',
			'One turn per line; question normalization and response segmentation are separate later passes.'
		]
	},
	interviews
};

writeFileSync(resolve(ROOT, OUTPUT_FILE), JSON.stringify(output, null, 2) + '\n', 'utf8');
const totalTurns = interviews.reduce((n, iv) => n + iv.turn_count, 0);
console.log(`\n* Wrote ${OUTPUT_FILE} (${interviews.length} interviews, ${totalTurns} turns total).`);
