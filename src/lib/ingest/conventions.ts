/**
 * Shared ID + label conventions for transcript ingestion. Pure functions so the
 * upload dialog can render a live preview client-side using the same rules the
 * server applies on submit — no drift, no round-trip.
 *
 * Server callers should import these; the unified TranscriptUploadDialog reaches
 * them through a thin client-safe re-export (no node:fs / process imports).
 */
import type { ContentSourceId } from '$lib/content/registries/types';

// === Interview ==============================================================

/** Mirrors the parse() action: digit-only participant id, zero-padded to 2,
 *  produces interview ids like `participant_11`. Returns null if no digits
 *  found (caller falls back to title-line parsing). */
export function interviewIdFromParticipantId(raw: string): string | null {
	const m = String(raw ?? '').match(/\d+/);
	if (!m) return null;
	return `participant_${String(Number(m[0])).padStart(2, '0')}`;
}

/** Per-turn segment id used by buildSegments() in the interview pipeline. */
export function interviewSegmentIdPreview(opts: {
	interviewId: string;
	turnIndex: number;
	segmentIndex: number;
}): string {
	return `${opts.interviewId}_t${pad(opts.turnIndex)}_s${pad(opts.segmentIndex)}`;
}

// === Forum / social / blog row-based ========================================

export type RowKinds = {
	/** Content source for the first occurrence of a (thread, conversation) pair. */
	post: ContentSourceId;
	/** Content source for subsequent rows on the same thread/conversation. */
	comment: ContentSourceId;
};

export const FORUM_KINDS: RowKinds = { post: 'social_post', comment: 'social_comment' };
export const BLOG_KINDS: RowKinds = { post: 'blog_post', comment: 'blog_comment' };

/** Single source of truth for row → fragment id. The server's projectForumRows
 *  call site delegates here so dialog preview and the actual write agree. */
export function rowFragmentId(opts: {
	corpusId: string;
	thread: unknown;
	conversation: unknown;
	comment: unknown;
	rowIndex: number;
}): string {
	const t = String(opts.thread ?? '').trim().replace(/\s+/g, '');
	const c = String(opts.conversation ?? '').trim().replace(/\s+/g, '');
	const m = String(opts.comment ?? '').trim().replace(/\s+/g, '_').toLowerCase();
	const base = [t, c, m].filter(Boolean).join('-');
	if (base) return `fc-${opts.corpusId}-${base}`;
	return `fc-${opts.corpusId}-row${String(opts.rowIndex).padStart(5, '0')}`;
}

// === Transcript-to-corpus (podcast / youtube) ===============================

export type TranscriptKind = 'podcast_transcript' | 'youtube_transcript';

/** Short prefix that distinguishes podcast vs youtube fragments inside a
 *  shared corpus partition. */
export function transcriptKindPrefix(kind: TranscriptKind): 'pod' | 'yt' {
	return kind === 'podcast_transcript' ? 'pod' : 'yt';
}

/** Slugify a free-text episode identifier so it can ride inside a fragment id.
 *  Lowercase, non-alphanumerics → `_`, collapses runs, trims `_` ends, caps at
 *  64 chars (long episode titles otherwise blow out ids). Returns null on
 *  empty input so the caller can require an explicit episode id. */
export function transcriptEpisodeSlug(raw: string): string | null {
	const cleaned = String(raw ?? '')
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '_')
		.replace(/^_+|_+$/g, '')
		.slice(0, 64);
	return cleaned.length ? cleaned : null;
}

/** Per-segment fragment id for podcast / youtube transcripts. Mirrors the
 *  interview convention (`_s00`, `_s01`, …) so review UI ordering remains
 *  natural. */
export function transcriptFragmentId(opts: {
	corpusId: string;
	kind: TranscriptKind;
	episodeSlug: string;
	segmentIndex: number;
}): string {
	const prefix = transcriptKindPrefix(opts.kind);
	return `fc-${opts.corpusId}-${prefix}-${opts.episodeSlug}-s${pad(opts.segmentIndex)}`;
}

/** Shared `post_id` for every segment of a single transcript. Lets downstream
 *  thread grouping cluster all segments of one episode together. */
export function transcriptPostId(opts: {
	corpusId: string;
	kind: TranscriptKind;
	episodeSlug: string;
}): string {
	const prefix = transcriptKindPrefix(opts.kind);
	return `${opts.corpusId}-${prefix}-${opts.episodeSlug}`;
}

// === Tiny utils =============================================================

function pad(n: number): string {
	return String(n).padStart(2, '0');
}
