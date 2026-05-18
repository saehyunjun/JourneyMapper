/**
 * Autotag jobs — status (GET) and start/retry (POST) endpoint.
 *
 * The upload page polls GET while an uploaded interview is being autotagged,
 * and POSTs to retry if a job errored. The upload `parse` action starts the
 * first job itself, so a POST here is only needed for retries.
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getJob, startAutotag } from '$lib/server/autotag';

export const GET: RequestHandler = ({ url }) => {
	const interviewId = url.searchParams.get('interview') ?? '';
	if (!interviewId) {
		return json({ ok: false, error: 'interview query param is required.' }, { status: 400 });
	}
	return json({ ok: true, job: getJob(interviewId) });
};

export const POST: RequestHandler = async ({ request }) => {
	let body: Record<string, unknown>;
	try {
		body = await request.json();
	} catch {
		return json({ ok: false, error: 'Invalid JSON body.' }, { status: 400 });
	}

	const interviewId = typeof body.interview_id === 'string' ? body.interview_id : '';
	if (!interviewId) {
		return json({ ok: false, error: 'interview_id is required.' }, { status: 400 });
	}

	return json({ ok: true, job: startAutotag(interviewId) });
};
