/**
 * GET  /api/corpora/[corpus_id]/author-attrs
 * POST /api/corpora/[corpus_id]/author-attrs
 *
 * Round-trip the per-corpus author-attribute overrides edited from the
 * FragmentTagDrawer's "Person details" form. The file lives at
 * src/lib/content/corpora/<corpus_id>/author_attrs.json in dev and is
 * KV-shadowed in prod (see corpus-store.ts). Overlays are applied to every
 * matching fragment's speaker_attrs by loadCorpusBundle.
 *
 * GET response: the full file (or empty shape when no sidecar exists).
 * POST body: { author_handle_hash, attrs }
 *   - attrs is a SpeakerAttrs partial. Keys with `value === null` AND
 *     `evidence === 'unknown'` are deleted (i.e. "cleared this field").
 *   - All other keys upsert.
 *
 * The corpus_id path param is validated against loadCorpusBundle so an
 * attacker can't write outside the corpora directory.
 */
import { json, error } from '@sveltejs/kit';
import { loadAuthorAttrs, loadCorpusBundle, saveAuthorAttrs } from '$lib/server/corpus-store';
import type { SpeakerAttrs } from '$lib/content/corpora/types';
import type { RequestHandler } from './$types';

const SCHEMA_VERSION = '1.0';

export const GET: RequestHandler = async ({ params }) => {
	const corpusId = params.corpus_id;
	if (!corpusId) throw error(404, 'corpus_id is required.');
	const corpus = await loadCorpusBundle(corpusId);
	if (!corpus) throw error(404, `Corpus not found: ${corpusId}`);
	return json(await loadAuthorAttrs(corpusId));
};

export const POST: RequestHandler = async ({ params, request }) => {
	const corpusId = params.corpus_id;
	if (!corpusId) throw error(404, 'corpus_id is required.');
	const corpus = await loadCorpusBundle(corpusId);
	if (!corpus) throw error(404, `Corpus not found: ${corpusId}`);

	let body: { author_handle_hash?: string; attrs?: Partial<SpeakerAttrs> };
	try {
		body = await request.json();
	} catch {
		throw error(400, 'Body must be JSON.');
	}
	const handle = body.author_handle_hash?.trim();
	if (!handle) throw error(400, 'author_handle_hash is required.');
	if (!body.attrs || typeof body.attrs !== 'object') {
		throw error(400, 'attrs is required and must be an object.');
	}

	// Confirm the author exists somewhere in the corpus before writing — keeps
	// the sidecar from accumulating orphans when handle hashes change.
	const seen = corpus.fragments.some(
		(f) => (f.source_ref as { author_handle_hash?: string }).author_handle_hash === handle
	);
	if (!seen) {
		throw error(404, `author_handle_hash "${handle}" not found in corpus ${corpusId}.`);
	}

	const current = await loadAuthorAttrs(corpusId);
	const prev = current.authors[handle] ?? {};
	const next: SpeakerAttrs = { ...prev };

	for (const [k, v] of Object.entries(body.attrs)) {
		const key = k as keyof SpeakerAttrs;
		if (v == null) {
			delete next[key];
			continue;
		}
		const attr = v as { value: unknown; evidence?: string };
		if (attr.value == null && attr.evidence === 'unknown') {
			delete next[key];
			continue;
		}
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		(next as any)[key] = attr;
	}

	const updated = {
		meta: {
			schema_version: SCHEMA_VERSION,
			updated_at: new Date().toISOString()
		},
		authors: {
			...current.authors,
			[handle]: next
		}
	};

	// If every key was cleared, drop the author entry entirely.
	if (Object.keys(next).length === 0) {
		delete updated.authors[handle];
	}

	await saveAuthorAttrs(corpusId, updated);
	return json({ ok: true, attrs: next });
};
