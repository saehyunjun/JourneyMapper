/**
 * GET /api/lexicon?indication=<id>
 *
 * Returns the lexicon scoped to one indication — the active indication's
 * clusters plus every cross-cutting cluster (`indications: []`) that surfaces
 * under every condition. The condition-toggle UI fetches this when the analyst
 * switches indications so the drawer / orbit / word cloud only render clusters
 * relevant to the current study.
 *
 * Falls back to the first indication in meta.indications if no `indication`
 * query param is provided or the id is unknown.
 *
 * Response shape: LexiconSlice (see src/lib/server/lexicon.ts).
 *
 * Cache-Control: short — the lexicon changes rarely, but analysts edit it
 * through the drawer so we can't cache aggressively. 60s of edge caching with
 * stale-while-revalidate is the right tradeoff; tighten if the drawer starts
 * showing stale clusters after edits.
 */
import { json, error } from '@sveltejs/kit';
import { getLexiconSlice } from '$lib/server/lexicon';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
	const requested = url.searchParams.get('indication') ?? undefined;
	try {
		const slice = await getLexiconSlice(requested);
		return json(slice, {
			headers: {
				'cache-control': 'public, max-age=60, stale-while-revalidate=300'
			}
		});
	} catch (e) {
		const message = e instanceof Error ? e.message : String(e);
		throw error(500, message);
	}
};
