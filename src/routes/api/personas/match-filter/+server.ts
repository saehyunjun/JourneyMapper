/**
 * POST /api/personas/match-filter
 *
 * Live preview for the workbench filter builder. Takes a PersonaFilter and a
 * corpus id, runs the filter over the corpus, and returns how many fragments
 * + distinct authors match, plus a small sample of matched fragments for the
 * analyst to spot-check.
 *
 * Body:
 *   {
 *     corpus_id: string,
 *     filter: PersonaFilter,
 *     sample_limit?: number   // default 6, max 24
 *   }
 *
 * Response: MatchFilterResponse (below).
 *
 * Notes:
 *   - Uses the SAME matchesFilter implementation the deriver uses, so the
 *     "save this filter as a persona" preview is exact, not an approximation.
 *   - We don't mutate the filter (e.g. inject indications) — the analyst owns
 *     it. If the analyst forgets `indications`, the response will include
 *     cross-indication matches; that's a feature for cross-corpus personas.
 */
import { json, error } from '@sveltejs/kit';
import { listCorpora } from '$lib/server/corpora';
import { matchesFilter } from '$lib/content/personas/derive.mjs';
import type { PersonaFilter } from '$lib/content/personas/types';
import type { RequestHandler } from './$types';

const SAMPLE_TEXT_CHARS = 360;
const DEFAULT_SAMPLE = 6;
const MAX_SAMPLE = 24;

export type SampleFragment = {
	id: string;
	author_handle_hash: string | null;
	text: string;
};

export type MatchFilterResponse = {
	fragment_count: number;
	author_count: number;
	annotated_match_count: number;
	sample_fragments: SampleFragment[];
};

export const POST: RequestHandler = async ({ request }) => {
	let body: { corpus_id?: string; filter?: PersonaFilter; sample_limit?: number };
	try {
		body = await request.json();
	} catch {
		throw error(400, 'Body must be JSON.');
	}

	const corpusId = body.corpus_id?.trim();
	if (!corpusId) throw error(400, 'corpus_id is required.');
	if (!body.filter || typeof body.filter !== 'object') {
		throw error(400, 'filter is required and must be an object.');
	}

	const sampleLimit = Math.max(
		1,
		Math.min(MAX_SAMPLE, Math.floor(body.sample_limit ?? DEFAULT_SAMPLE))
	);

	const corpus = listCorpora().find((c) => c.manifest.id === corpusId);
	if (!corpus) throw error(404, `Corpus not found: ${corpusId}`);

	let fragmentCount = 0;
	let annotatedMatchCount = 0;
	const matchedAuthors = new Set<string>();
	const samples: SampleFragment[] = [];

	for (const f of corpus.fragments) {
		if (!matchesFilter(f, body.filter, corpus.annotations)) continue;
		fragmentCount += 1;
		if (corpus.annotations[f.id] != null) annotatedMatchCount += 1;
		const h = (f.source_ref as { author_handle_hash?: string }).author_handle_hash;
		if (h) matchedAuthors.add(h);
		// Sample selection: keep the first N — they're the corpus's natural order
		// (load order). The analyst can re-roll by tightening the filter.
		if (samples.length < sampleLimit) {
			const t = f.text ?? '';
			samples.push({
				id: f.id,
				author_handle_hash: h ?? null,
				text: t.length > SAMPLE_TEXT_CHARS ? t.slice(0, SAMPLE_TEXT_CHARS) + '…' : t
			});
		}
	}

	const response: MatchFilterResponse = {
		fragment_count: fragmentCount,
		author_count: matchedAuthors.size,
		annotated_match_count: annotatedMatchCount,
		sample_fragments: samples
	};
	return json(response);
};
