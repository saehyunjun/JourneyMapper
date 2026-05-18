/**
 * Segment merging — combine sequential participant segments into one.
 *
 * Backs the upload review page's "merge" action. Sentence segmentation can
 * over-split a turn; merging lets a reviewer recombine adjacent segments.
 * Mutates segments.json and re-keys segment_tags.json so existing annotations
 * follow the renumbered segment ids.
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
			semantic_tags: union((a) => a.semantic_tags),
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
