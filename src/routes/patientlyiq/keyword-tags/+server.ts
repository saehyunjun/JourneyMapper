/**
 * Keyword cluster tags — POST endpoint.
 *
 * Backs the segment tag drawer's "Tag as keyword…" flow. A tag is an explicit
 * per-instance span: the same surface form may belong to different clusters in
 * different segments. Variants in keyword_lexicon.json only rank suggestions;
 * they do not auto-create tag rows.
 *
 * Actions:
 *   tag   — add a (cluster, segment, span) tag. expected_surface guards against
 *           stale offsets from the client; the server derives surface from the
 *           segment text and rejects a mismatch.
 *   untag — remove a tag by its natural key.
 *
 * Responds with the refreshed tags list so the drawer can keep its state in
 * sync within the session.
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	addKeywordTag,
	listAllKeywordTags,
	listKeywordTagsForSegment,
	removeKeywordTag,
	type KeywordTagsState
} from '$lib/server/keyword-tags';

const str = (v: unknown) => (typeof v === 'string' ? v : '');
const int = (v: unknown) => (typeof v === 'number' && Number.isInteger(v) ? v : NaN);

/** Read per-instance tags. With `?segment_id=…` returns only that segment's
 *  tags (the drawer's hot path); with no query, returns the full list. */
export const GET: RequestHandler = async ({ url }) => {
	const segmentId = url.searchParams.get('segment_id') ?? '';
	const tags = segmentId
		? await listKeywordTagsForSegment(segmentId)
		: await listAllKeywordTags();
	return json({ ok: true, tags });
};

export const POST: RequestHandler = async ({ request }) => {
	let body: Record<string, unknown>;
	try {
		body = await request.json();
	} catch {
		return json({ ok: false, error: 'Invalid JSON body.' }, { status: 400 });
	}

	const action = str(body.action);
	const keywordId = str(body.keyword_id);
	const segmentId = str(body.segment_id);
	const charStart = int(body.char_start);
	const charEnd = int(body.char_end);

	if (!keywordId || !segmentId) {
		return json(
			{ ok: false, error: 'keyword_id and segment_id are required.' },
			{ status: 400 }
		);
	}
	if (!Number.isFinite(charStart) || !Number.isFinite(charEnd)) {
		return json(
			{ ok: false, error: 'char_start and char_end must be integers.' },
			{ status: 400 }
		);
	}

	try {
		let state: KeywordTagsState;
		let message: string;
		switch (action) {
			case 'tag':
				state = await addKeywordTag({
					keywordId,
					segmentId,
					charStart,
					charEnd,
					expectedSurface: typeof body.expected_surface === 'string'
						? body.expected_surface
						: undefined,
					reviewerNotes: typeof body.reviewer_notes === 'string'
						? body.reviewer_notes
						: undefined
				});
				message = 'Tagged to keyword cluster.';
				break;
			case 'untag':
				state = await removeKeywordTag({ keywordId, segmentId, charStart, charEnd });
				message = 'Removed keyword cluster tag.';
				break;
			default:
				return json({ ok: false, error: `Unknown action "${action}".` }, { status: 400 });
		}
		return json({ ok: true, message, tags: state.tags });
	} catch (e) {
		return json(
			{ ok: false, error: e instanceof Error ? e.message : 'Could not update keyword tags.' },
			{ status: 400 }
		);
	}
};
