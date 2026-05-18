/**
 * Analysis page — loads the analyst-starred quote ids and the per-quote review
 * decisions so star buttons and approve/reject controls render in the right
 * state on first paint. Both files are read fresh on each load (the dev watcher
 * ignores them), so the page always reflects the latest toggles.
 */
import { readHighlights } from '$lib/server/highlights';
import { readQuoteReviews } from '$lib/server/quote-reviews';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => {
	const { starredQuoteIds } = readHighlights();
	return { starredQuoteIds, quoteReviews: readQuoteReviews() };
};
