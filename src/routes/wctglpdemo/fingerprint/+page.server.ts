/**
 * Fingerprint page — loads the analyst-starred quote and segment ids (for the
 * key quotes section and the theme drawer's star buttons) and every
 * participant's profile (for the participant drawer). Merged with the
 * `?interview=` resolution done in +page.ts.
 */
import { readHighlights } from '$lib/server/highlights';
import { readProfiles } from '$lib/server/participant-profiles';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const [{ starredQuoteIds, starredSegmentIds }, participantProfiles] = await Promise.all([
		readHighlights(),
		readProfiles()
	]);
	return { starredQuoteIds, starredSegmentIds, participantProfiles };
};
