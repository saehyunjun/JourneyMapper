/**
 * Journey Workbench server load.
 *
 * Discovers all corpora under src/lib/content/corpora/ and returns their
 * fragments + annotations, plus all journey taxonomies keyed by indication.
 * Profile sidecars are loaded per corpus where available (today only the WCT
 * GLP-1 corpus has them).
 *
 * The page picks an active corpus based on the user's persona selection.
 */

import { listPersonas } from '$lib/server/personas';
import { listCorpora, listJourneys, loadProfilesForCorpus } from '$lib/server/corpora';
import type { PageServerLoad } from './$types';

export type { StageTag, FragmentAnnotation } from '$lib/server/corpora';

export type ParticipantProfile = {
	first_name?: string;
	last_initial?: string;
	gender?: string;
	country?: string;
	age_range?: string;
	avatar_url?: string | null;
};

export const load: PageServerLoad = async () => {
	const corpora = listCorpora();
	const journeys = listJourneys();
	const profilesByCorpus: Record<string, Record<string, ParticipantProfile>> = {};
	for (const c of corpora) {
		profilesByCorpus[c.manifest.id] = loadProfilesForCorpus(c.manifest.id) as Record<
			string,
			ParticipantProfile
		>;
	}

	return {
		personas: listPersonas(),
		corpora,
		journeys,
		profilesByCorpus
	};
};
