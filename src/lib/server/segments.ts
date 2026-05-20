/**
 * Segment merging and unmerging — combine sequential participant segments
 * into one, or split a previously merged segment back into sentences.
 *
 * Backs the upload review page's "merge" and "unmerge" actions. Sentence
 * segmentation can over-split a turn; merging lets a reviewer recombine
 * adjacent segments, and unmerging reverses that by re-running the sentence
 * splitter on the merged text. Both mutate segments.json and re-key
 * segment_tags.json so annotations follow the renumbered segment ids.
 *
 * Note: writes into the source tree, so this is a dev/demo-time operation —
 * see the matching note in $lib/server/segment-tags.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Annotation } from '$lib/types/segment-tags';

const DATA_DIR = 'src/lib/content/wctglpdemo-data';
const SEGMENTS_PATH = `${DATA_DIR}/segments.json`;
const TAGS_PATH = `${DATA_DIR}/segment_tags.json`;

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

const read = (path: string) => JSON.parse(readFileSync(resolve(path), 'utf8'));
const pad = (n: number) => String(n).padStart(2, '0');

// --- Sentence splitter ------------------------------------------------------
// Local copy of the segmenter's splitSentences (see scripts/build-segments.mjs
// and the parser in routes/wctglpdemo/upload/+page.server.ts), used by the
// reverse "unmerge" operation to re-split a merged segment back into its
// constituent sentences.

const ABBREV = new Set([
	'dr', 'mr', 'mrs', 'ms', 'etc', 'vs', 'inc', 'st', 'jr', 'sr', 'no', 'fig',
	'dept', 'approx', 'ph', 'e.g', 'i.e', 'a.m', 'p.m', 'u.s', 'u.k'
]);

function isAbbrev(word: string): boolean {
	const w = word.toLowerCase().replace(/[^a-z.]/g, '');
	if (w.length === 1) return true; // single-letter initial
	return ABBREV.has(w) || ABBREV.has(w.replace(/\.$/, ''));
}

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

const wordCountOf = (text: string) => text.split(/\s+/).filter(Boolean).length;

/**
 * Merge a set of segments — which must all belong to one interview, sit in
 * one turn, and have contiguous segment_index values — into a single segment.
 * The turn's segments are renumbered, ids regenerated, and any annotations on
 * the merged segments collapse into one (union of tags) under the new id.
 * Returns the interview's full updated, sorted segment list.
 */
export function mergeSegments(interviewId: string, segmentIds: string[]): Segment[] {
	if (segmentIds.length < 2) throw new Error('Select at least two segments to merge.');

	const segData = read(SEGMENTS_PATH);
	const all = segData.segments as Segment[];

	const ids = new Set(segmentIds);
	const picked = all.filter((s) => ids.has(s.segment_id));
	if (picked.length !== ids.size) throw new Error('Some selected segments no longer exist.');
	if (!picked.every((s) => s.interview_id === interviewId)) {
		throw new Error('Segments belong to a different interview.');
	}
	const turnIndex = picked[0].turn_index;
	if (!picked.every((s) => s.turn_index === turnIndex)) {
		throw new Error('Only segments within the same turn can be merged.');
	}

	picked.sort((a, b) => a.segment_index - b.segment_index);
	for (let i = 1; i < picked.length; i++) {
		if (picked[i].segment_index !== picked[i - 1].segment_index + 1) {
			throw new Error('Only sequential segments can be merged.');
		}
	}

	const first = picked[0];
	const last = picked[picked.length - 1];
	const wordCount = picked.reduce((n, s) => n + s.word_count, 0);
	const merged: Segment = {
		segment_id: first.segment_id, // provisional — regenerated below
		interview_id: interviewId,
		turn_index: turnIndex,
		segment_index: first.segment_index, // provisional
		question_id: first.question_id,
		speaker: first.speaker,
		text: picked.map((s) => s.text).join(' '),
		char_start: first.char_start,
		char_end: last.char_end,
		word_count: wordCount,
		flags: wordCount < 3 ? ['merged', 'very_short'] : ['merged']
	};

	// Rebuild this turn's segment list — its untouched segments plus the
	// merged one — then renumber segment_index and regenerate segment_id.
	const turnSegs = all
		.filter((s) => s.interview_id === interviewId && s.turn_index === turnIndex && !ids.has(s.segment_id))
		.concat(merged)
		.sort((a, b) => a.segment_index - b.segment_index);

	const idRemap = new Map<string, string>(); // surviving segments: old id -> new id
	turnSegs.forEach((s, i) => {
		const newId = `${interviewId}_t${pad(turnIndex)}_s${pad(i)}`;
		if (s !== merged) idRemap.set(s.segment_id, newId);
		s.segment_index = i;
		s.segment_id = newId;
	});
	const mergedId = merged.segment_id;

	segData.segments = all
		.filter((s) => !(s.interview_id === interviewId && s.turn_index === turnIndex))
		.concat(turnSegs)
		.sort((a: Segment, b: Segment) => a.segment_id.localeCompare(b.segment_id));
	segData.meta.generated_at = new Date().toISOString();
	segData.meta.segment_count = segData.segments.length;
	writeFileSync(resolve(SEGMENTS_PATH), JSON.stringify(segData, null, 2) + '\n', 'utf8');

	// Re-key annotations: renumbered survivors follow their new id; the merged
	// group's annotations (if any) collapse into one under the merged id.
	const tagData = read(TAGS_PATH);
	const annotations = tagData.annotations as Annotation[];
	const mergedAnns = annotations.filter((a) => ids.has(a.segment_id));
	const kept = annotations.filter((a) => !ids.has(a.segment_id));
	for (const a of kept) {
		const newId = idRemap.get(a.segment_id);
		if (newId) a.segment_id = newId;
	}
	if (mergedAnns.length > 0) {
		const union = (pick: (a: Annotation) => string[]) => [...new Set(mergedAnns.flatMap(pick))];
		const withSentiment = mergedAnns.find((a) => a.sentiment !== 0);
		kept.push({
			segment_id: mergedId,
			interview_id: interviewId,
			question_id: merged.question_id,
			topics: union((a) => a.topics ?? []),
			themes: union((a) => a.themes),
			subthemes: union((a) => a.subthemes),
			emotions: union((a) => a.emotions),
			sentiment: withSentiment?.sentiment ?? 0,
			confidence: 1,
			source: 'human',
			review_status: mergedAnns.some((a) => a.review_status === 'confirmed')
				? 'confirmed'
				: mergedAnns[0].review_status,
			reviewer_notes: mergedAnns.map((a) => a.reviewer_notes).filter(Boolean).join(' ')
		});
	}
	kept.sort((a, b) => a.segment_id.localeCompare(b.segment_id));
	tagData.annotations = kept;
	tagData.meta.generated_at = new Date().toISOString();
	writeFileSync(resolve(TAGS_PATH), JSON.stringify(tagData, null, 2) + '\n', 'utf8');

	return (segData.segments as Segment[])
		.filter((s) => s.interview_id === interviewId)
		.sort((a, b) => a.segment_id.localeCompare(b.segment_id));
}

/**
 * Unmerge a previously merged segment — re-run the sentence splitter on its
 * text to produce N sub-segments, replacing the merged one in its turn. The
 * turn is renumbered, ids regenerated, and any annotation on the merged
 * segment is dropped (its unioned tags don't faithfully transfer back).
 * Char offsets are derived from the merged text, so they are approximate
 * relative to the raw transcript if the merge collapsed irregular whitespace.
 */
/**
 * Replace one phrase in a segment's text — used by the drawer's "Edit selection"
 * context-menu action. The reviewer highlights a phrase and provides a
 * replacement; we swap the first occurrence in segment.text, recompute
 * word_count, and re-evaluate the very_short flag (preserving merged etc.).
 * Char offsets stay anchored to the original transcript span and so become
 * approximate after an edit — matching the unmerge convention.
 */
export function editSegmentText(
	interviewId: string,
	segmentId: string,
	find: string,
	replace: string
): Segment[] {
	if (!find) throw new Error('No text to replace.');

	const segData = read(SEGMENTS_PATH);
	const all = segData.segments as Segment[];
	const target = all.find(
		(s) => s.segment_id === segmentId && s.interview_id === interviewId
	);
	if (!target) throw new Error('Segment not found.');

	const idx = target.text.indexOf(find);
	if (idx === -1) {
		throw new Error(
			'The highlighted phrase no longer matches the segment text — re-select and try again.'
		);
	}

	const edited = (
		target.text.slice(0, idx) + replace + target.text.slice(idx + find.length)
	)
		.replace(/\s+/g, ' ')
		.trim();
	if (!edited) throw new Error('Segment text cannot be empty.');

	target.text = edited;
	target.word_count = wordCountOf(edited);
	target.flags = target.flags.filter((f) => f !== 'very_short');
	if (target.word_count < 3) target.flags = [...target.flags, 'very_short'];

	segData.meta.generated_at = new Date().toISOString();
	writeFileSync(resolve(SEGMENTS_PATH), JSON.stringify(segData, null, 2) + '\n', 'utf8');

	return (segData.segments as Segment[])
		.filter((s) => s.interview_id === interviewId)
		.sort((a, b) => a.segment_id.localeCompare(b.segment_id));
}

export function unmergeSegment(interviewId: string, segmentId: string): Segment[] {
	const segData = read(SEGMENTS_PATH);
	const all = segData.segments as Segment[];

	const target = all.find(
		(s) => s.segment_id === segmentId && s.interview_id === interviewId
	);
	if (!target) throw new Error('Segment not found.');
	if (!target.flags.includes('merged')) {
		throw new Error('Only merged segments can be unmerged.');
	}

	const parts = splitSentences(target.text);
	if (parts.length < 2) {
		throw new Error('No sentence boundary found — this segment cannot be unmerged.');
	}

	// Build the sub-segments. They inherit the merged segment's turn and
	// question, with offsets re-anchored to the merged char_start.
	const newSubs: Segment[] = parts.map((p, i) => {
		const wc = wordCountOf(p.text);
		const flags: string[] = [];
		if (wc < 3) flags.push('very_short');
		return {
			segment_id: target.segment_id, // provisional — regenerated below
			interview_id: interviewId,
			turn_index: target.turn_index,
			segment_index: target.segment_index + i, // provisional
			question_id: target.question_id,
			speaker: target.speaker,
			text: p.text,
			char_start: target.char_start + p.start,
			char_end: target.char_start + p.end,
			word_count: wc,
			flags
		};
	});

	// Rebuild this turn's segment list — its untouched segments plus the
	// sub-segments — then sort by char_start (monotonic across a turn) and
	// regenerate segment_index + segment_id.
	const subRefs = new Set<Segment>(newSubs);
	const turnIndex = target.turn_index;
	const turnSegs = all
		.filter(
			(s) =>
				s.interview_id === interviewId &&
				s.turn_index === turnIndex &&
				s.segment_id !== segmentId
		)
		.concat(newSubs)
		.sort((a, b) => a.char_start - b.char_start);

	const idRemap = new Map<string, string>(); // surviving segments: old id -> new id
	turnSegs.forEach((s, i) => {
		const newId = `${interviewId}_t${pad(turnIndex)}_s${pad(i)}`;
		if (!subRefs.has(s)) idRemap.set(s.segment_id, newId);
		s.segment_index = i;
		s.segment_id = newId;
	});

	segData.segments = all
		.filter((s) => !(s.interview_id === interviewId && s.turn_index === turnIndex))
		.concat(turnSegs)
		.sort((a: Segment, b: Segment) => a.segment_id.localeCompare(b.segment_id));
	segData.meta.generated_at = new Date().toISOString();
	segData.meta.segment_count = segData.segments.length;
	writeFileSync(resolve(SEGMENTS_PATH), JSON.stringify(segData, null, 2) + '\n', 'utf8');

	// Re-key annotations: drop any on the merged segment (its unioned tags
	// don't split back cleanly), and follow the renumbered survivors.
	const tagData = read(TAGS_PATH);
	const annotations = tagData.annotations as Annotation[];
	const kept = annotations.filter((a) => a.segment_id !== segmentId);
	for (const a of kept) {
		const newId = idRemap.get(a.segment_id);
		if (newId) a.segment_id = newId;
	}
	kept.sort((a, b) => a.segment_id.localeCompare(b.segment_id));
	tagData.annotations = kept;
	tagData.meta.generated_at = new Date().toISOString();
	writeFileSync(resolve(TAGS_PATH), JSON.stringify(tagData, null, 2) + '\n', 'utf8');

	return (segData.segments as Segment[])
		.filter((s) => s.interview_id === interviewId)
		.sort((a, b) => a.segment_id.localeCompare(b.segment_id));
}
