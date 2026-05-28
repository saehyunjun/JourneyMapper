/**
 * Corpus autotag jobs — status (GET) + start (POST) endpoint.
 *
 * The /patientlyiq/upload page polls GET while the propose-fragment-* chain
 * runs after an analyst opted in during a corpus paste, or after they click
 * the toolbar Autotag button. POST starts a new chain for the given corpus
 * (the propose scripts self-skip already-tagged batches, so it's safe to
 * call on a partially-tagged corpus — only untagged fragments get processed).
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getCorpusAutotagJob, startCorpusAutotag } from '$lib/server/corpus-autotag';

export const GET: RequestHandler = async ({ url }) => {
	const corpusId = url.searchParams.get('corpus') ?? '';
	if (!corpusId) {
		return json({ ok: false, error: 'corpus query param is required.' }, { status: 400 });
	}
	return json({ ok: true, job: getCorpusAutotagJob(corpusId) });
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
		const { job, started } = startCorpusAutotag(corpusId);
		return json({ ok: true, job, started });
	} catch (err) {
		return json({ ok: false, error: (err as Error).message }, { status: 503 });
	}
};
