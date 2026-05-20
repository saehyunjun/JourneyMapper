/**
 * Segment merging / unmerging — POST endpoint.
 *
 * The upload review page posts here to merge sequential segments or to split
 * a previously merged one back into sentences. The body's `action` field
 * selects the operation; the default is "merge" for backward compatibility.
 *
 *   { action: 'merge',   interview_id, segment_ids: string[2..] }
 *   { action: 'unmerge', interview_id, segment_id:  string     }
 *
 * Returns the interview's updated segment list.
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { mergeSegments, unmergeSegment, editSegmentText } from '$lib/server/segments';

export const POST: RequestHandler = async ({ request }) => {
	let body: Record<string, unknown>;
	try {
		body = await request.json();
	} catch {
		return json({ ok: false, error: 'Invalid JSON body.' }, { status: 400 });
	}

	const interviewId = typeof body.interview_id === 'string' ? body.interview_id : '';
	const action = typeof body.action === 'string' ? body.action : 'merge';

	if (action === 'edit_text') {
		const segmentId = typeof body.segment_id === 'string' ? body.segment_id : '';
		const find = typeof body.find === 'string' ? body.find : '';
		const replace = typeof body.replace === 'string' ? body.replace : '';
		if (!interviewId || !segmentId || !find) {
			return json(
				{ ok: false, error: 'interview_id, segment_id, and find are required.' },
				{ status: 400 }
			);
		}
		try {
			const segments = editSegmentText(interviewId, segmentId, find, replace);
			return json({ ok: true, segments });
		} catch (e) {
			return json(
				{ ok: false, error: e instanceof Error ? e.message : 'Could not edit segment text.' },
				{ status: 400 }
			);
		}
	}

	if (action === 'unmerge') {
		const segmentId = typeof body.segment_id === 'string' ? body.segment_id : '';
		if (!interviewId || !segmentId) {
			return json(
				{ ok: false, error: 'interview_id and segment_id are required.' },
				{ status: 400 }
			);
		}
		try {
			const segments = unmergeSegment(interviewId, segmentId);
			return json({ ok: true, segments });
		} catch (e) {
			return json(
				{ ok: false, error: e instanceof Error ? e.message : 'Could not unmerge segment.' },
				{ status: 400 }
			);
		}
	}

	const segmentIds = Array.isArray(body.segment_ids)
		? body.segment_ids.filter((x): x is string => typeof x === 'string')
		: [];
	if (!interviewId || segmentIds.length < 2) {
		return json(
			{ ok: false, error: 'interview_id and at least two segment_ids are required.' },
			{ status: 400 }
		);
	}

	try {
		const segments = mergeSegments(interviewId, segmentIds);
		return json({ ok: true, segments });
	} catch (e) {
		return json(
			{ ok: false, error: e instanceof Error ? e.message : 'Could not merge segments.' },
			{ status: 400 }
		);
	}
};
