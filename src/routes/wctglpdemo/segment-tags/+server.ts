/**
 * Segment-tag confirmation — POST / DELETE endpoint.
 *
 * POST   — the upload review page's tag drawer posts one segment's tags here;
 *          they are validated against codebook.json and upserted into
 *          segment_tags.json as a confirmed, human-sourced annotation.
 * DELETE — the review page's "untag" action drops one segment's annotation.
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { upsertAnnotation, deleteAnnotation } from '$lib/server/segment-tags';

export const POST: RequestHandler = async ({ request }) => {
	let body: Record<string, unknown>;
	try {
		body = await request.json();
	} catch {
		return json({ ok: false, error: 'Invalid JSON body.' }, { status: 400 });
	}

	const segmentId = typeof body.segment_id === 'string' ? body.segment_id : '';
	const interviewId = typeof body.interview_id === 'string' ? body.interview_id : '';
	if (!segmentId || !interviewId) {
		return json(
			{ ok: false, error: 'segment_id and interview_id are required.' },
			{ status: 400 }
		);
	}

	const asArray = (v: unknown): string[] =>
		Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];

	try {
		const annotation = await upsertAnnotation({
			segment_id: segmentId,
			interview_id: interviewId,
			question_id: typeof body.question_id === 'string' ? body.question_id : null,
			themes: asArray(body.themes),
			subthemes: asArray(body.subthemes),
			emotions: asArray(body.emotions),
			sentiment: Number(body.sentiment ?? 0),
			reviewer_notes: typeof body.reviewer_notes === 'string' ? body.reviewer_notes : ''
		});
		return json({ ok: true, annotation });
	} catch (e) {
		return json(
			{ ok: false, error: e instanceof Error ? e.message : 'Could not save tags.' },
			{ status: 400 }
		);
	}
};

export const DELETE: RequestHandler = async ({ request }) => {
	let body: Record<string, unknown>;
	try {
		body = await request.json();
	} catch {
		return json({ ok: false, error: 'Invalid JSON body.' }, { status: 400 });
	}

	const segmentId = typeof body.segment_id === 'string' ? body.segment_id : '';
	if (!segmentId) {
		return json({ ok: false, error: 'segment_id is required.' }, { status: 400 });
	}

	const removed = await deleteAnnotation(segmentId);
	return json({ ok: true, removed: !!removed });
};
