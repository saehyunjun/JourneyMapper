/**
 * Corpus autotag jobs — status (GET) + start (POST) endpoint.
 *
 * GET returns the current job state for a corpus; the upload page polls this
 * while the propose-fragment-* chain runs. POST starts a new chain (and in
 * prod blocks until completion so the serverless function instance stays
 * alive — same pattern as the interview autotag POST).
 *
 * The propose-fragment-* steps self-skip already-tagged batches, so calling
 * POST on a partially-tagged corpus is safe — only untagged fragments get
 * processed.
 */
import { json } from '@sveltejs/kit';
import { dev } from '$app/environment';
import type { RequestHandler } from './$types';
import { getCorpusAutotagJob, startCorpusAutotag } from '$lib/server/corpus-autotag';

// Prod blocks on the chain (three Claude calls per batch × N batches). 300s
// is the Hobby ceiling; Pro + Fluid Compute can take this up to 800.
export const config = { maxDuration: 299 };

export const GET: RequestHandler = async ({ url }) => {
	const corpusId = url.searchParams.get('corpus') ?? '';
	if (!corpusId) {
		return json({ ok: false, error: 'corpus query param is required.' }, { status: 400 });
	}
	return json({ ok: true, job: await getCorpusAutotagJob(corpusId) });
};

export const POST: RequestHandler = async ({ request }) => {
	let body: { corpus_id?: unknown };
	try {
		body = await request.json();
	} catch {
		return json({ ok: false, error: 'Invalid JSON body.' }, { status: 400 });
	}
	const corpusId = typeof body.corpus_id === 'string' ? body.corpus_id : '';
	if (!corpusId) {
		return json({ ok: false, error: 'corpus_id is required.' }, { status: 400 });
	}
	try {
		const { job, started, completion } = await startCorpusAutotag(corpusId);
		// In prod the chain must complete within this function invocation —
		// nothing else will keep the serverless instance alive after we return.
		// Dev keeps the fire-and-forget pattern; the chain finishes in the
		// background and the page polls GET for state.
		if (!dev) await completion;
		return json({ ok: true, job: await getCorpusAutotagJob(corpusId), started });
	} catch (err) {
		return json({ ok: false, error: (err as Error).message }, { status: 503 });
	}
};
