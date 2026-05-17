/**
 * Analysis page — loads the current analyst-starred quote ids so star buttons
 * render in the right state on first paint. Reads the file fresh on each load
 * (the dev watcher ignores highlights.json), so it always reflects the latest
 * toggles.
 */
import { readHighlights } from '$lib/server/highlights';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => {
	const { starredQuoteIds } = readHighlights();
	return { starredQuoteIds };
};
