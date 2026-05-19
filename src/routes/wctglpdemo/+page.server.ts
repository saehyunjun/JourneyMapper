/**
 * Executive summary — loads the analyst-starred quote ids (so each finding can
 * prefer a starred quote over a merely high-scored one) and every participant's
 * profile (for the participant chips / drawer). Both files are read fresh on
 * each load, so the page always reflects the latest stars and profile edits.
 */
import { readHighlights } from '$lib/server/highlights';
import { readProfiles } from '$lib/server/participant-profiles';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => {
	const { starredQuoteIds } = readHighlights();
	return { starredQuoteIds, participantProfiles: readProfiles() };
};
