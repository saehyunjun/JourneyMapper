/**
 * /wctglpdemo layout loader.
 *
 * Reads `?indication=<id>` from the URL and loads the matching lexicon slice
 * via getLexiconSlice. The slice carries:
 *   - active_indication (resolved id; falls back to first non-"general" if
 *     the requested id is missing or invalid)
 *   - indications + therapeutic_areas registries (powers the selector UI)
 *   - clusters (active indication + general) — for any consumer that wires
 *     itself onto buildKeywordMatcher
 *   - themes (codebook themes) — same
 *
 * Layout-level rather than per-page because the IndicationSelector lives in
 * the sidebar (always visible). Pages that need the clusters can read
 * data.slice from their own +page.server.ts via parent().
 *
 * SvelteKit re-runs this whenever the URL changes, so toggling indication
 * triggers a fresh server load and the sidebar / page both refresh.
 */
import type { LayoutServerLoad } from './$types';
import { getLexiconSlice } from '$lib/server/lexicon';

export const load: LayoutServerLoad = async ({ url }) => {
	const requested = url.searchParams.get('indication') ?? undefined;
	const slice = await getLexiconSlice(requested);
	return { slice };
};
