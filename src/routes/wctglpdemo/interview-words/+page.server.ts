/**
 * Interview-words page — loads the analyst-starred quote and segment ids (for
 * the key quotes section) and every participant's profile (for the participant
 * drawer) so both render in the right state on first paint.
 */
import { readHighlights } from '$lib/server/highlights';
import { readProfiles } from '$lib/server/participant-profiles';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => {
	const { starredQuoteIds, starredSegmentIds } = readHighlights();
	return { starredQuoteIds, starredSegmentIds, participantProfiles: readProfiles() };
};
