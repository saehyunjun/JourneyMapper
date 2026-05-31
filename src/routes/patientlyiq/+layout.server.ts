/**
 * /wctglpdemo layout loader.
 *
 * Reads `?indication=<id>` from the URL and loads the matching lexicon slice
 * via getLexiconSlice. The slice carries:
 *   - active_indication (resolved id; falls back to the first registered
 *     indication if the requested id is missing or invalid)
 *   - indications + therapeutic_areas registries (powers the selector UI)
 *   - clusters (active indication's scoped clusters + every cross-cutting
 *     cluster with `indications: []`) — for any consumer that wires itself
 *     onto buildKeywordMatcher
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
import { listCorpusIds, loadCorpusManifest } from '$lib/server/corpus-store';

export const load: LayoutServerLoad = async ({ url }) => {
	const requested = url.searchParams.get('indication') ?? undefined;
	const slice = await getLexiconSlice(requested);

	// Set of indication ids that have at least one corpus. Drives the Ask
	// drawer's "Compare with" picker so we never offer to compare against an
	// indication the workbench has no fragments for. Only needs manifests, so
	// skip the fragment/annotation hydration.
	const ids = await listCorpusIds();
	const indSet = new Set<string>();
	for (const id of ids) {
		const m = await loadCorpusManifest(id);
		if (!m) continue;
		for (const ind of m.indications as string[]) indSet.add(ind);
	}
	const indicationsWithCorpora = Array.from(indSet);

	return { slice, indicationsWithCorpora };
};
