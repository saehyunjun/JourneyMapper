/**
 * Pipeline overview — loads the analyst's quote-review decisions so the landing
 * page can show how far quote review has progressed. Interview and tagging
 * counts are derived statically in the page from the analysis data module.
 */
import { readQuoteReviews } from '$lib/server/quote-reviews';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => {
	return { quoteReviews: readQuoteReviews() };
};
