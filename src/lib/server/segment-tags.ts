/**
 * Segment-tag confirmation — shared read/write helpers.
 *
 * Backs the upload review page's per-segment tag drawer. `upsertAnnotation`
 * is the single-segment counterpart to the /tag page's batch `saveTags`
 * action: it validates one segment's tags against codebook.json and merges
 * the result into segment_tags.json as a confirmed, human-sourced annotation.
 *
 * Note: writes into the source tree, so this is a dev/demo-time operation —
 * see the matching note in $lib/server/highlights.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Annotation } from '$lib/types/segment-tags';

const DATA_DIR = 'src/lib/content/wctglpdemo-data';
const SEGMENTS_PATH = `${DATA_DIR}/segments.json`;
const TAGS_PATH = `${DATA_DIR}/segment_tags.json`;
const CODEBOOK_PATH = `${DATA_DIR}/codebook.json`;

const read = (path: string) => JSON.parse(readFileSync(resolve(path), 'utf8'));

type CodebookTheme = { id: string; subthemes?: { id: string }[] };

/**
 * Codebook integrity lookups — the same rules build-segment-tags.mjs enforces.
 * Read fresh from disk on each call so themes added via the tag drawer's
 * keyword/theme menu are immediately valid to tag.
 */
function codebookLookups() {
	const codebook = read(CODEBOOK_PATH);
	const themes = codebook.theme_tags as CodebookTheme[];
	const subthemeParent = new Map<string, string>();
	for (const t of themes) {
		for (const s of t.subthemes ?? []) subthemeParent.set(s.id, t.id);
	}
	return {
		themeIds: new Set(themes.map((t) => t.id)),
		emotionIds: new Set((codebook.emotion_tags as { id: string }[]).map((e) => e.id)),
		subthemeParent
	};
}

/** One segment's tags, as posted by the drawer (pre-validation). */
export type SegmentTagDraft = {
	segment_id: string;
	interview_id: string;
	question_id: string | null;
	themes: string[];
	subthemes: string[];
	emotions: string[];
	sentiment: number;
	reviewer_notes: string;
};

/** Existing annotations for one interview, keyed by segment_id. */
export function readAnnotationsFor(interviewId: string): Record<string, Annotation> {
	const tagData = read(TAGS_PATH);
	const out: Record<string, Annotation> = {};
	for (const a of tagData.annotations as Annotation[]) {
		if (a.interview_id === interviewId) out[a.segment_id] = a;
	}
	return out;
}

/**
 * Confirm one segment's tags: validate against the codebook, upsert into
 * segment_tags.json as a human-sourced, confirmed annotation, and recompute
 * the interview's tagged/pending status. Throws on invalid input.
 */
export function upsertAnnotation(draft: SegmentTagDraft): Annotation {
	const dedupe = (xs: unknown): string[] => [
		...new Set(Array.isArray(xs) ? xs.map((x) => String(x)) : [])
	];

	const themes = dedupe(draft.themes);
	const subthemes = dedupe(draft.subthemes);
	const emotions = dedupe(draft.emotions);
	let sentiment = Number(draft.sentiment ?? 0);
	if (!Number.isInteger(sentiment) || sentiment < -2 || sentiment > 2) sentiment = 0;

	const { themeIds, emotionIds, subthemeParent } = codebookLookups();
	for (const t of themes) if (!themeIds.has(t)) throw new Error(`Unknown theme "${t}".`);
	for (const e of emotions) if (!emotionIds.has(e)) throw new Error(`Unknown emotion "${e}".`);
	for (const s of subthemes) {
		const parent = subthemeParent.get(s);
		if (!parent) throw new Error(`Unknown subtheme "${s}".`);
		if (!themes.includes(parent)) {
			throw new Error(`Subtheme "${s}" needs its parent theme "${parent}".`);
		}
	}

	const tagData = read(TAGS_PATH);
	const annotations = tagData.annotations as Annotation[];
	const existing = annotations.find((a) => a.segment_id === draft.segment_id);

	const updated: Annotation = {
		segment_id: draft.segment_id,
		interview_id: draft.interview_id,
		question_id: draft.question_id ?? null,
		// Preserve emergent topic ids — they are owned by the topic pipeline.
		topics: existing?.topics ?? [],
		themes,
		subthemes,
		emotions,
		sentiment,
		confidence: 1,
		source: 'human',
		review_status: 'confirmed',
		reviewer_notes: typeof draft.reviewer_notes === 'string' ? draft.reviewer_notes.trim() : ''
	};

	if (existing) Object.assign(existing, updated);
	else annotations.push(updated);
	annotations.sort((a, b) => a.segment_id.localeCompare(b.segment_id));

	// An interview is "tagged" once every participant segment carries a
	// confirmed (or discarded) annotation; until then it stays "pending".
	const segData = read(SEGMENTS_PATH);
	const segIds = (segData.segments as { segment_id: string; interview_id: string }[])
		.filter((s) => s.interview_id === draft.interview_id)
		.map((s) => s.segment_id);
	const byId = new Map(annotations.map((a) => [a.segment_id, a]));
	const fullyReviewed =
		segIds.length > 0 &&
		segIds.every((id) => {
			const a = byId.get(id);
			return !!a && (a.review_status === 'confirmed' || a.review_status === 'discarded');
		});

	const tagged = new Set<string>(tagData.meta.tagged_interviews ?? []);
	const pending = new Set<string>(tagData.meta.pending_interviews ?? []);
	if (fullyReviewed) {
		tagged.add(draft.interview_id);
		pending.delete(draft.interview_id);
	}
	tagData.meta.tagged_interviews = [...tagged].sort();
	tagData.meta.pending_interviews = [...pending].sort();
	tagData.meta.generated_at = new Date().toISOString();

	writeFileSync(resolve(TAGS_PATH), JSON.stringify(tagData, null, 2) + '\n', 'utf8');
	return updated;
}

/**
 * Untag one segment: drop its annotation from segment_tags.json. The segment's
 * interview can no longer be fully reviewed, so it is removed from
 * `tagged_interviews`. Returns the affected interview id, or null if the
 * segment had no annotation to remove.
 */
export function deleteAnnotation(segmentId: string): { interview_id: string } | null {
	const tagData = read(TAGS_PATH);
	const annotations = tagData.annotations as Annotation[];
	const idx = annotations.findIndex((a) => a.segment_id === segmentId);
	if (idx === -1) return null;

	const [removed] = annotations.splice(idx, 1);

	const tagged = new Set<string>(tagData.meta.tagged_interviews ?? []);
	tagged.delete(removed.interview_id);
	tagData.meta.tagged_interviews = [...tagged].sort();
	tagData.meta.generated_at = new Date().toISOString();

	writeFileSync(resolve(TAGS_PATH), JSON.stringify(tagData, null, 2) + '\n', 'utf8');
	return { interview_id: removed.interview_id };
}
