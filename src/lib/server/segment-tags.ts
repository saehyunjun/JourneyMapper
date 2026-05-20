/**
 * Segment-tag confirmation — shared read/write helpers.
 *
 * Backs the upload review page's per-segment tag drawer. `upsertAnnotation`
 * is the single-segment counterpart to the /tag page's batch `saveTags`
 * action: it validates one segment's tags against codebook.json and merges
 * the result into segment_tags.json as a confirmed, human-sourced annotation.
 *
 * Backed by the local source files in dev and the KV store in prod.
 */
import bundledSegments from '$lib/content/wctglpdemo-data/segments.json';
import bundledTags from '$lib/content/wctglpdemo-data/segment_tags.json';
import bundledCodebook from '$lib/content/wctglpdemo-data/codebook.json';
import type { Annotation } from '$lib/types/segment-tags';
import { loadDoc, saveDoc } from './kv-store';

const DATA_DIR = 'src/lib/content/wctglpdemo-data';
const SEGMENTS_PATH = `${DATA_DIR}/segments.json`;
const TAGS_PATH = `${DATA_DIR}/segment_tags.json`;
const CODEBOOK_PATH = `${DATA_DIR}/codebook.json`;
const SEGMENTS_KEY = 'wctglpdemo:segments';
const TAGS_KEY = 'wctglpdemo:segment_tags';
const CODEBOOK_KEY = 'wctglpdemo:codebook';

type SegmentsFile = {
	segments: { segment_id: string; interview_id: string }[];
	meta: Record<string, unknown>;
	[k: string]: unknown;
};
type TagsFile = {
	annotations: Annotation[];
	meta: {
		tagged_interviews?: string[];
		pending_interviews?: string[];
		generated_at?: string;
		[k: string]: unknown;
	};
	[k: string]: unknown;
};
type CodebookFile = {
	themes: CodebookTheme[];
	emotion_tags: { id: string }[];
	[k: string]: unknown;
};

const readSegments = () =>
	loadDoc<SegmentsFile>(SEGMENTS_KEY, SEGMENTS_PATH, bundledSegments as SegmentsFile);
const readTags = () => loadDoc<TagsFile>(TAGS_KEY, TAGS_PATH, bundledTags as TagsFile);
const readCodebook = () =>
	loadDoc<CodebookFile>(CODEBOOK_KEY, CODEBOOK_PATH, bundledCodebook as CodebookFile);

type CodebookTheme = { id: string; subthemes?: { id: string }[] };

/**
 * Codebook integrity lookups — the same rules build-segment-tags.mjs enforces.
 * Read fresh on each call so themes added via the tag drawer's keyword/theme
 * menu are immediately valid to tag.
 */
async function codebookLookups() {
	const codebook = await readCodebook();
	const themes = codebook.themes;
	const subthemeParent = new Map<string, string>();
	for (const t of themes) {
		for (const s of t.subthemes ?? []) subthemeParent.set(s.id, t.id);
	}
	return {
		themeIds: new Set(themes.map((t) => t.id)),
		emotionIds: new Set(codebook.emotion_tags.map((e) => e.id)),
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
export async function readAnnotationsFor(
	interviewId: string
): Promise<Record<string, Annotation>> {
	const tagData = await readTags();
	const out: Record<string, Annotation> = {};
	for (const a of tagData.annotations) {
		if (a.interview_id === interviewId) out[a.segment_id] = a;
	}
	return out;
}

/**
 * Confirm one segment's tags: validate against the codebook, upsert into
 * segment_tags as a human-sourced, confirmed annotation, and recompute the
 * interview's tagged/pending status. Throws on invalid input.
 */
export async function upsertAnnotation(draft: SegmentTagDraft): Promise<Annotation> {
	const dedupe = (xs: unknown): string[] => [
		...new Set(Array.isArray(xs) ? xs.map((x) => String(x)) : [])
	];

	const themes = dedupe(draft.themes);
	const subthemes = dedupe(draft.subthemes);
	const emotions = dedupe(draft.emotions);
	let sentiment = Number(draft.sentiment ?? 0);
	if (!Number.isInteger(sentiment) || sentiment < -2 || sentiment > 2) sentiment = 0;

	const { themeIds, emotionIds, subthemeParent } = await codebookLookups();
	for (const t of themes) if (!themeIds.has(t)) throw new Error(`Unknown theme "${t}".`);
	for (const e of emotions) if (!emotionIds.has(e)) throw new Error(`Unknown emotion "${e}".`);
	for (const s of subthemes) {
		const parent = subthemeParent.get(s);
		if (!parent) throw new Error(`Unknown subtheme "${s}".`);
		if (!themes.includes(parent)) {
			throw new Error(`Subtheme "${s}" needs its parent theme "${parent}".`);
		}
	}

	const [tagData, segData] = await Promise.all([readTags(), readSegments()]);
	const annotations = tagData.annotations;
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
	const segIds = segData.segments
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

	await saveDoc(TAGS_KEY, TAGS_PATH, tagData);
	return updated;
}

/**
 * Untag one segment: drop its annotation from segment_tags. The segment's
 * interview can no longer be fully reviewed, so it is removed from
 * `tagged_interviews`. Returns the affected interview id, or null if the
 * segment had no annotation to remove.
 */
export async function deleteAnnotation(
	segmentId: string
): Promise<{ interview_id: string } | null> {
	const tagData = await readTags();
	const annotations = tagData.annotations;
	const idx = annotations.findIndex((a) => a.segment_id === segmentId);
	if (idx === -1) return null;

	const [removed] = annotations.splice(idx, 1);

	const tagged = new Set<string>(tagData.meta.tagged_interviews ?? []);
	tagged.delete(removed.interview_id);
	tagData.meta.tagged_interviews = [...tagged].sort();
	tagData.meta.generated_at = new Date().toISOString();

	await saveDoc(TAGS_KEY, TAGS_PATH, tagData);
	return { interview_id: removed.interview_id };
}
