/**
 * Key Findings — loads participant profiles so quote modules can render
 * attribution (name, avatar). The board itself lives in the browser
 * (localStorage), so nothing board-specific is loaded here.
 */
import { readProfiles } from '$lib/server/participant-profiles';
import { readHighlights } from '$lib/server/highlights';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const [participantProfiles, { starredQuoteIds }] = await Promise.all([
		readProfiles(),
		readHighlights()
	]);
	return { participantProfiles, starredQuoteIds, sectionTitle: 'Key Findings' };
};
