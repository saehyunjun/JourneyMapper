/**
 * Transcript upload — server actions.
 *
 * parse         — runs the deterministic pipeline stages on pasted/uploaded
 *                 transcript text: step 1 parse, step 4 segment. Writes the raw
 *                 text, interviews_structured.json, and segments.json. Returns
 *                 any existing question_map.json mappings so the review view
 *                 pre-fills with them.
 * saveQuestions — records the human review of question-normalization (step 3):
 *                 confirms/corrects the per-turn question, writes
 *                 question_map.json, and propagates question_ids into segments.
 *                 The initial mapping is auto-proposed by
 *                 scripts/propose-questions.mjs; this action only confirms it.
 *
 * Note: these write into the source tree, so they are dev/demo-time operations.
 */
import { fail } from '@sveltejs/kit';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Actions, PageServerLoad } from './$types';
import questionBank from '$lib/content/wctglpdemo-data/questions.json';
import { readHighlights } from '$lib/server/highlights';
import { readAnnotationsFor } from '$lib/server/segment-tags';
import { getJob, startAutotag, type AutotagJob } from '$lib/server/autotag';
import type { Annotation } from '$lib/types/segment-tags';

const DATA_DIR = 'src/lib/content/wctglpdemo-data';
const STRUCTURED_PATH = `${DATA_DIR}/interviews_structured.json`;
const SEGMENTS_PATH = `${DATA_DIR}/segments.json`;
const QUESTION_MAP_PATH = `${DATA_DIR}/question_map.json`;
const UPLOADS_DIR = `${DATA_DIR}/uploads`;

// Tolerates `**interviewer:**`, `Interviewer:`, `Participant:` and similar.
const SPEAKER_RE = /^\s*\*{0,2}\s*(interviewer|participant)\s*:?\s*\*{0,2}\s*:?\s*/i;
const TITLE_PARTICIPANT_RE = /participant\s+(\d+)/i;

// Words that take a trailing period without ending a sentence.
const ABBREV = new Set([
	'dr', 'mr', 'mrs', 'ms', 'etc', 'vs', 'inc', 'st', 'jr', 'sr', 'no', 'fig',
	'dept', 'approx', 'ph', 'e.g', 'i.e', 'a.m', 'p.m', 'u.s', 'u.k'
]);

const VALID_QUESTION_IDS = new Set(questionBank.questions.map((q) => q.question_id));

type Turn = {
	turn_index: number;
	speaker: string;
	text: string;
	char_start: number;
	char_end: number;
};

type Segment = {
	segment_id: string;
	interview_id: string;
	turn_index: number;
	segment_index: number;
	question_id: string | null;
	speaker: string;
	text: string;
	char_start: number;
	char_end: number;
	word_count: number;
	flags: string[];
};

const pad = (n: number) => String(n).padStart(2, '0');

function parseGender(raw: string): string | null {
	const s = raw.toLowerCase();
	if (s.includes('female')) return 'female';
	if (s.includes('male')) return 'male';
	return null;
}

function isAbbrev(word: string): boolean {
	const w = word.toLowerCase().replace(/[^a-z.]/g, '');
	if (w.length === 1) return true; // single-letter initial
	return ABBREV.has(w) || ABBREV.has(w.replace(/\.$/, ''));
}

/** Port of splitSentences() from scripts/build-segments.mjs. */
function splitSentences(text: string): { text: string; start: number; end: number }[] {
	const boundaries: number[] = [];
	const re = /[.!?]+['"’”)\]]*(\s+|$)/g;
	let m: RegExpExecArray | null;
	while ((m = re.exec(text)) !== null) {
		const trailingWs = m[1];
		const termEnd = m.index + m[0].length - trailingWs.length;

		const before = text.slice(0, m.index);
		const lastWord = (before.match(/(\S+)$/) || [])[1] || '';
		if (isAbbrev(lastWord)) continue;

		const nextIdx = m.index + m[0].length;
		if (nextIdx < text.length && !/[A-Z0-9"'‘“(]/.test(text[nextIdx])) continue;

		boundaries.push(termEnd);
	}

	const segments: { text: string; start: number; end: number }[] = [];
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

/** Port of parseTranscript() from scripts/parse-transcripts.mjs. */
function parseTranscript(text: string) {
	const lines = text.split('\n');
	const offsets: number[] = [];
	let cur = 0;
	for (const line of lines) {
		offsets.push(cur);
		cur += line.length + 1; // +1 for the consumed '\n'
	}

	// A leading title line is optional for pasted text.
	let startLine = 0;
	let titleLine = '';
	if (lines.length > 0 && lines[0].trim() !== '' && !SPEAKER_RE.test(lines[0])) {
		titleLine = lines[0];
		startLine = 1;
	}

	const warnings: string[] = [];
	const turns: Turn[] = [];
	const demographicsLines: string[] = [];
	let seenFirstSpeaker = false;
	let turnIndex = 0;

	for (let i = startLine; i < lines.length; i++) {
		const line = lines[i];
		if (line.trim() === '') continue;

		const speaker = line.match(SPEAKER_RE);
		if (!speaker) {
			if (!seenFirstSpeaker) demographicsLines.push(line.replace(/^[#\-*\s]+/, '').trim());
			else warnings.push(`Line ${i + 1} skipped (not a speaker turn): "${line.trim().slice(0, 60)}"`);
			continue;
		}

		seenFirstSpeaker = true;
		const labelLen = speaker[0].length;
		const rawContent = line.slice(labelLen);
		const leading = rawContent.length - rawContent.trimStart().length;
		const turnText = rawContent.trim();
		if (turnText === '') {
			warnings.push(`Empty turn at line ${i + 1}, skipped.`);
			continue;
		}
		const charStart = offsets[i] + labelLen + leading;
		turns.push({
			turn_index: turnIndex++,
			speaker: speaker[1].toLowerCase(),
			text: turnText,
			char_start: charStart,
			char_end: charStart + turnText.length
		});
	}

	return {
		titleLine: titleLine.trim(),
		demographicsRaw: demographicsLines.filter(Boolean).join('; '),
		turns,
		warnings
	};
}

/** Port of the segmentation loop from scripts/build-segments.mjs. */
function buildSegments(interviewId: string, turns: Turn[]): Segment[] {
	const segments: Segment[] = [];
	for (const turn of turns) {
		if (turn.speaker !== 'participant') continue;
		const parts = splitSentences(turn.text);
		parts.forEach((part, segmentIndex) => {
			const charStart = turn.char_start + part.start;
			const wc = part.text.split(/\s+/).filter(Boolean).length;
			segments.push({
				segment_id: `${interviewId}_t${pad(turn.turn_index)}_s${pad(segmentIndex)}`,
				interview_id: interviewId,
				turn_index: turn.turn_index,
				segment_index: segmentIndex,
				question_id: null, // no question_map for a fresh upload
				speaker: 'participant',
				text: part.text,
				char_start: charStart,
				char_end: charStart + part.text.length,
				word_count: wc,
				flags: wc < 3 ? ['very_short'] : []
			});
		});
	}
	return segments;
}

/** turn_index -> question_id from question_map.json, for one interview. */
function readQuestionMap(interviewId: string): { turn_index: number; question_id: string }[] {
	let qmap: { interviews?: { interview_id: string; mappings: { turn_index: number; question_id: string }[] }[] };
	try {
		qmap = JSON.parse(readFileSync(resolve(QUESTION_MAP_PATH), 'utf8'));
	} catch {
		return [];
	}
	const entry = qmap.interviews?.find((iv) => iv.interview_id === interviewId);
	return (entry?.mappings ?? []).map((m) => ({
		turn_index: m.turn_index,
		question_id: m.question_id
	}));
}

// Page data: starred segment ids for the review view, the list of ingested
// interviews, and — when ?interview=<id> is set — that interview's turns,
// segments, and question mapping, so its review view reopens without the
// transcript being re-pasted and re-parsed.
export const load: PageServerLoad = ({ url }) => {
	const { starredSegmentIds } = readHighlights();

	const structured = JSON.parse(readFileSync(resolve(STRUCTURED_PATH), 'utf8'));
	const interviewIds: string[] = structured.interviews
		.map((iv: { interview_id: string }) => iv.interview_id)
		.sort();

	const wanted = url.searchParams.get('interview');
	let review:
		| {
				interviewId: string;
				turns: Turn[];
				segments: Segment[];
				questionMap: { turn_index: number; question_id: string }[];
				annotations: Record<string, Annotation>;
				autotagJob: AutotagJob | null;
		  }
		| null = null;
	if (wanted) {
		const interview = structured.interviews.find(
			(iv: { interview_id: string }) => iv.interview_id === wanted
		);
		if (interview) {
			const segData = JSON.parse(readFileSync(resolve(SEGMENTS_PATH), 'utf8'));
			const segments = (segData.segments as Segment[])
				.filter((s) => s.interview_id === wanted)
				.sort((a, b) => a.segment_id.localeCompare(b.segment_id));
			review = {
				interviewId: wanted,
				turns: interview.turns as Turn[],
				segments,
				questionMap: readQuestionMap(wanted),
				annotations: readAnnotationsFor(wanted),
				autotagJob: getJob(wanted)
			};
		}
	}

	return { starredSegmentIds, interviewIds, review };
};

export const actions: Actions = {
	// --- Step 1 (parse) + step 4 (segment) ---
	parse: async ({ request }) => {
		const fd = await request.formData();
		const raw = String(fd.get('transcript') ?? '');
		const idField = String(fd.get('participantId') ?? '').trim();

		const text = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
		if (text.trim().length < 20) {
			return fail(400, { error: 'Paste a transcript before submitting.' });
		}

		let num: number | null = null;
		if (idField) {
			const d = idField.match(/\d+/);
			if (d) num = Number(d[0]);
		}
		if (num == null) {
			const titleMatch = (text.split('\n')[0] ?? '').match(TITLE_PARTICIPANT_RE);
			if (titleMatch) num = Number(titleMatch[1]);
		}
		if (num == null) {
			return fail(400, {
				error:
					'Could not determine the participant number. Enter it in the field, or include a "Participant N" title line.'
			});
		}

		const interviewId = `participant_${String(num).padStart(2, '0')}`;
		// .txt (not .md) so the file is not picked up by the content `import.meta.glob`
		// in src/lib/content/index.ts, which would trigger a Vite full-page reload.
		const sourceFile = `${UPLOADS_DIR}/${interviewId}.txt`;

		const { titleLine, demographicsRaw, turns, warnings } = parseTranscript(text);
		if (turns.length === 0) {
			return fail(400, {
				error: 'No speaker turns found. Expected lines like "Interviewer: …" and "Participant: …".'
			});
		}
		for (const t of turns) {
			if (text.slice(t.char_start, t.char_end) !== t.text) {
				return fail(500, { error: `Parse error: offset mismatch on turn ${t.turn_index}.` });
			}
		}

		const segments = buildSegments(interviewId, turns);
		for (const s of segments) {
			if (text.slice(s.char_start, s.char_end) !== s.text) {
				return fail(500, { error: `Segmentation error: offset mismatch on ${s.segment_id}.` });
			}
		}

		mkdirSync(resolve(UPLOADS_DIR), { recursive: true });
		writeFileSync(resolve(sourceFile), text, 'utf8');

		const structured = JSON.parse(readFileSync(resolve(STRUCTURED_PATH), 'utf8'));
		const existed = structured.interviews.some(
			(iv: { interview_id: string }) => iv.interview_id === interviewId
		);
		structured.interviews = structured.interviews.filter(
			(iv: { interview_id: string }) => iv.interview_id !== interviewId
		);
		structured.interviews.push({
			interview_id: interviewId,
			source_file: sourceFile,
			source_title: titleLine || null,
			ingested_via: 'upload',
			ingested_at: new Date().toISOString(),
			participant_metadata: {
				condition: 'GLP-1 weight maintenance',
				demographics_raw: demographicsRaw || null,
				gender: demographicsRaw ? parseGender(demographicsRaw) : null
			},
			turn_count: turns.length,
			turns
		});
		structured.interviews.sort((a: { interview_id: string }, b: { interview_id: string }) =>
			a.interview_id.localeCompare(b.interview_id)
		);
		structured.meta.generated_at = new Date().toISOString();
		if (
			Array.isArray(structured.meta.source_files) &&
			!structured.meta.source_files.includes(sourceFile)
		) {
			structured.meta.source_files.push(sourceFile);
		}
		writeFileSync(resolve(STRUCTURED_PATH), JSON.stringify(structured, null, 2) + '\n', 'utf8');

		const segData = JSON.parse(readFileSync(resolve(SEGMENTS_PATH), 'utf8'));
		segData.segments = segData.segments.filter(
			(s: { interview_id: string }) => s.interview_id !== interviewId
		);
		segData.segments.push(...segments);
		segData.segments.sort((a: { segment_id: string }, b: { segment_id: string }) =>
			a.segment_id.localeCompare(b.segment_id)
		);
		segData.meta.generated_at = new Date().toISOString();
		segData.meta.segment_count = segData.segments.length;
		writeFileSync(resolve(SEGMENTS_PATH), JSON.stringify(segData, null, 2) + '\n', 'utf8');

		// Kick off the AI judgement steps (question mapping + segment tagging) in
		// the background; the review view polls and fills in when they finish.
		startAutotag(interviewId);

		return {
			stage: 'upload',
			success: true,
			interviewId,
			replaced: existed,
			turnCount: turns.length,
			interviewerTurns: turns.filter((t) => t.speaker === 'interviewer').length,
			participantTurns: turns.filter((t) => t.speaker === 'participant').length,
			segmentCount: segments.length,
			demographics: demographicsRaw || null,
			warnings
		};
	},

	// --- Step 3 (question normalization) — human-assigned ---
	saveQuestions: async ({ request }) => {
		const fd = await request.formData();
		const interviewId = String(fd.get('interviewId') ?? '').trim();
		if (!interviewId) return fail(400, { error: 'Missing interview id.' });

		let assignments: Record<string, string>;
		try {
			assignments = JSON.parse(String(fd.get('assignments') ?? '{}'));
		} catch {
			return fail(400, { error: 'Invalid question-assignment data.' });
		}

		// Keep only non-empty, valid question ids, keyed by turn index.
		const byTurn = new Map<number, string>();
		for (const [k, v] of Object.entries(assignments)) {
			if (!v) continue;
			if (!VALID_QUESTION_IDS.has(v)) {
				return fail(400, { error: `Unknown question id "${v}".` });
			}
			byTurn.set(Number(k), v);
		}

		const structured = JSON.parse(readFileSync(resolve(STRUCTURED_PATH), 'utf8'));
		const interview = structured.interviews.find(
			(iv: { interview_id: string }) => iv.interview_id === interviewId
		);
		if (!interview) return fail(404, { error: `Interview ${interviewId} not found.` });

		const turns: Turn[] = interview.turns;
		const interviewerTurns = turns.filter((t) => t.speaker === 'interviewer');

		// Existing mappings — the AI proposal from scripts/propose-questions.mjs.
		// Confirming a proposed turn keeps its turn_role/notes; only a changed
		// question_id falls back to the plain "question" role.
		const qmap = JSON.parse(readFileSync(resolve(QUESTION_MAP_PATH), 'utf8'));
		const priorEntry = qmap.interviews.find(
			(iv: { interview_id: string }) => iv.interview_id === interviewId
		);
		const priorByTurn = new Map<number, { question_id: string; turn_role: string; reviewer_notes?: string }>(
			(priorEntry?.mappings ?? []).map(
				(m: { turn_index: number; question_id: string; turn_role: string; reviewer_notes?: string }) => [
					m.turn_index,
					m
				]
			)
		);

		// Mappings: only interviewer turns the reviewer actually assigned.
		const mappings = interviewerTurns
			.filter((t) => byTurn.has(t.turn_index))
			.map((t) => {
				const questionId = byTurn.get(t.turn_index);
				const prior = priorByTurn.get(t.turn_index);
				const kept = prior && prior.question_id === questionId;
				return {
					turn_index: t.turn_index,
					question_id: questionId,
					turn_role: kept ? prior.turn_role : 'question',
					confidence: 1,
					source: 'human',
					review_status: 'confirmed',
					reviewer_notes: kept ? (prior.reviewer_notes ?? '') : ''
				};
			});

		// Write question_map.json.
		qmap.interviews = qmap.interviews.filter(
			(iv: { interview_id: string }) => iv.interview_id !== interviewId
		);
		qmap.interviews.push({ interview_id: interviewId, mapping_count: mappings.length, mappings });
		qmap.interviews.sort((a: { interview_id: string }, b: { interview_id: string }) =>
			a.interview_id.localeCompare(b.interview_id)
		);
		qmap.meta.generated_at = new Date().toISOString();
		writeFileSync(resolve(QUESTION_MAP_PATH), JSON.stringify(qmap, null, 2) + '\n', 'utf8');

		// Propagate question_id into segments — each inherits the most recent
		// assigned interviewer turn before it.
		const ordered = [...mappings].sort((a, b) => a.turn_index - b.turn_index);
		const inherited = (turnIndex: number): string | null => {
			let qid: string | null = null;
			for (const m of ordered) {
				if (m.turn_index < turnIndex) qid = m.question_id ?? null;
				else break;
			}
			return qid;
		};

		const segData = JSON.parse(readFileSync(resolve(SEGMENTS_PATH), 'utf8'));
		let segmentsUpdated = 0;
		for (const s of segData.segments) {
			if (s.interview_id !== interviewId) continue;
			s.question_id = inherited(s.turn_index);
			segmentsUpdated++;
		}
		segData.meta.generated_at = new Date().toISOString();
		writeFileSync(resolve(SEGMENTS_PATH), JSON.stringify(segData, null, 2) + '\n', 'utf8');

		const segments: Segment[] = (segData.segments as Segment[])
			.filter((s) => s.interview_id === interviewId)
			.sort((a, b) => a.segment_id.localeCompare(b.segment_id));

		return {
			stage: 'questionMap',
			success: true,
			interviewId,
			mappedCount: mappings.length,
			interviewerCount: interviewerTurns.length,
			segmentsUpdated,
			turns,
			segments,
			questionMap: mappings.map((m) => ({ turn_index: m.turn_index, question_id: m.question_id! })),
			annotations: readAnnotationsFor(interviewId)
		};
	}
};
