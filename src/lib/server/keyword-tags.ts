/**
 * Keyword cluster tags — per-instance, span-level cluster assignments.
 *
 * Backs the segment tag drawer's "tag this phrase to a keyword cluster" flow.
 * One row per (cluster, span). The same surface form may belong to different
 * clusters in different segments — context determines the cluster, not the
 * string. Variants in keyword_lexicon.json only rank suggestions in the
 * drawer; they do not auto-create rows here.
 *
 * Validates against keyword_lexicon.json (cluster must exist) and segments.json
 * (span must sit inside the named segment and match its text verbatim).
 *
 * Backed by the local source file in dev and the KV store in prod.
 */
import bundledTags from '$lib/content/wctglpdemo-data/keyword_tags.json';
import bundledLexicon from '$lib/content/wctglpdemo-data/keyword_lexicon.json';
import bundledSegments from '$lib/content/wctglpdemo-data/segments.json';
import { loadDoc, saveDoc } from './kv-store';

const DATA_DIR = 'src/lib/content/wctglpdemo-data';
const TAGS_PATH = `${DATA_DIR}/keyword_tags.json`;
const LEXICON_PATH = `${DATA_DIR}/keyword_lexicon.json`;
const SEGMENTS_PATH = `${DATA_DIR}/segments.json`;
const TAGS_KEY = 'wctglpdemo:keyword_tags';
const LEXICON_KEY = 'wctglpdemo:keyword_lexicon';
const SEGMENTS_KEY = 'wctglpdemo:segments';

export type KeywordTagSource = 'human' | 'ai_proposed';
export type KeywordTagReviewStatus = 'confirmed' | 'pending';

export type KeywordTag = {
	keyword_id: string;
	segment_id: string;
	interview_id: string;
	char_start: number;
	char_end: number;
	surface: string;
	source: KeywordTagSource;
	confidence?: number | null;
	review_status: KeywordTagReviewStatus;
	created_at: string;
	reviewer_notes?: string;
};

type TagsFile = {
	tags: KeywordTag[];
	meta: { generated_at?: string; [k: string]: unknown };
	[k: string]: unknown;
};

type Cluster = {
	id: string;
	label: string;
	description?: string;
	parent_theme: string;
	parent_subtheme: string;
	variants: string[];
};
type LexiconFile = { clusters: Cluster[]; [k: string]: unknown };

type Segment = {
	segment_id: string;
	interview_id: string;
	text: string;
	char_start: number;
	char_end: number;
	[k: string]: unknown;
};
type SegmentsFile = { segments: Segment[]; [k: string]: unknown };

const readTags = () => loadDoc<TagsFile>(TAGS_KEY, TAGS_PATH, bundledTags as TagsFile);
const readLexicon = () =>
	loadDoc<LexiconFile>(LEXICON_KEY, LEXICON_PATH, bundledLexicon as LexiconFile);
const readSegments = () =>
	loadDoc<SegmentsFile>(SEGMENTS_KEY, SEGMENTS_PATH, bundledSegments as SegmentsFile);

/** Returned after every edit so consumers can refresh. */
export type KeywordTagsState = { tags: KeywordTag[] };

function snapshot(data: TagsFile): KeywordTagsState {
	return { tags: data.tags ?? [] };
}

/** Find a cluster by id in the flat clusters[] list. */
function findCluster(lex: LexiconFile, clusterId: string): Cluster | undefined {
	return lex.clusters.find((c) => c.id === clusterId);
}

/** Sort tags so a write produces a stable, diff-friendly file. */
function sortTags(tags: KeywordTag[]): KeywordTag[] {
	return tags.sort((a, b) => {
		if (a.segment_id !== b.segment_id) return a.segment_id.localeCompare(b.segment_id);
		if (a.char_start !== b.char_start) return a.char_start - b.char_start;
		if (a.char_end !== b.char_end) return a.char_end - b.char_end;
		return a.keyword_id.localeCompare(b.keyword_id);
	});
}

/**
 * Add a per-instance cluster tag. The span must sit inside the named segment;
 * its surface (the substring at [char_start, char_end)) is derived from the
 * segment text and stored verbatim. If `expectedSurface` is passed, it must
 * match the derived surface — guards against stale offsets from the drawer.
 *
 * Duplicate inserts (same natural key) are silently skipped, matching the
 * variant-add behavior in phrases.ts.
 */
export async function addKeywordTag(input: {
	keywordId: string;
	segmentId: string;
	charStart: number;
	charEnd: number;
	expectedSurface?: string;
	source?: KeywordTagSource;
	confidence?: number | null;
	reviewerNotes?: string;
}): Promise<KeywordTagsState> {
	const {
		keywordId,
		segmentId,
		charStart,
		charEnd,
		expectedSurface,
		source = 'human',
		confidence = null,
		reviewerNotes
	} = input;

	if (!keywordId) throw new Error('keywordId is required.');
	if (!segmentId) throw new Error('segmentId is required.');
	if (!Number.isInteger(charStart) || !Number.isInteger(charEnd)) {
		throw new Error('charStart and charEnd must be integers.');
	}
	if (charEnd <= charStart) throw new Error('charEnd must be greater than charStart.');

	const [lex, segData, tagData] = await Promise.all([readLexicon(), readSegments(), readTags()]);

	if (!findCluster(lex, keywordId)) {
		throw new Error(`Unknown keyword cluster "${keywordId}".`);
	}

	const segment = segData.segments.find((s) => s.segment_id === segmentId);
	if (!segment) throw new Error(`Unknown segment "${segmentId}".`);

	if (charStart < segment.char_start || charEnd > segment.char_end) {
		throw new Error(
			`Span [${charStart}, ${charEnd}) is outside segment ${segmentId} [${segment.char_start}, ${segment.char_end}).`
		);
	}
	const surface = segment.text.slice(
		charStart - segment.char_start,
		charEnd - segment.char_start
	);
	if (!surface || !surface.trim()) {
		throw new Error('Highlighted span is empty.');
	}
	if (expectedSurface !== undefined && expectedSurface !== surface) {
		throw new Error(
			`Surface mismatch — re-select the phrase and try again. Expected "${expectedSurface}", segment has "${surface}".`
		);
	}

	const tags = tagData.tags ?? [];
	const dup = tags.find(
		(t) =>
			t.keyword_id === keywordId &&
			t.segment_id === segmentId &&
			t.char_start === charStart &&
			t.char_end === charEnd
	);
	if (dup) return snapshot(tagData);

	const tag: KeywordTag = {
		keyword_id: keywordId,
		segment_id: segmentId,
		interview_id: segment.interview_id,
		char_start: charStart,
		char_end: charEnd,
		surface,
		source,
		confidence: source === 'ai_proposed' ? confidence : null,
		review_status: source === 'human' ? 'confirmed' : 'pending',
		created_at: new Date().toISOString()
	};
	if (reviewerNotes) tag.reviewer_notes = reviewerNotes;

	tags.push(tag);
	tagData.tags = sortTags(tags);
	tagData.meta.generated_at = new Date().toISOString();
	await saveDoc(TAGS_KEY, TAGS_PATH, tagData);
	return snapshot(tagData);
}

/** Remove a tag by its natural key. No-op if the row doesn't exist. */
export async function removeKeywordTag(input: {
	keywordId: string;
	segmentId: string;
	charStart: number;
	charEnd: number;
}): Promise<KeywordTagsState> {
	const { keywordId, segmentId, charStart, charEnd } = input;
	const tagData = await readTags();
	const before = tagData.tags?.length ?? 0;
	tagData.tags = (tagData.tags ?? []).filter(
		(t) =>
			!(
				t.keyword_id === keywordId &&
				t.segment_id === segmentId &&
				t.char_start === charStart &&
				t.char_end === charEnd
			)
	);
	if (tagData.tags.length === before) return snapshot(tagData);
	tagData.meta.generated_at = new Date().toISOString();
	await saveDoc(TAGS_KEY, TAGS_PATH, tagData);
	return snapshot(tagData);
}

/** All tags on a single segment, ordered by span start. */
export async function listKeywordTagsForSegment(segmentId: string): Promise<KeywordTag[]> {
	const tagData = await readTags();
	return (tagData.tags ?? [])
		.filter((t) => t.segment_id === segmentId)
		.sort((a, b) => a.char_start - b.char_start || a.char_end - b.char_end);
}

/** Full tag list — for analytics, exports, or initial drawer hydration. */
export async function listAllKeywordTags(): Promise<KeywordTag[]> {
	const tagData = await readTags();
	return tagData.tags ?? [];
}
