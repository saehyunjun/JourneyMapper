/**
 * Segment merging — POST endpoint.
 *
 * The upload review page posts a set of selected segment ids here; if they are
 * sequential within one turn they are merged into a single segment in
 * segments.json, with annotations re-keyed in segment_tags.json. Returns the
 * interview's updated segment list.
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { mergeSegments } from '$lib/server/segments';

export const POST: RequestHandler = async ({ request }) => {
	let body: Record<string, unknown>;
	try {
		body = await request.json();
	} catch {
		return json({ ok: false, error: 'Invalid JSON body.' }, { status: 400 });
	}

	const interviewId = typeof body.interview_id === 'string' ? body.interview_id : '';
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
