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
import {
	listCorpusBundles,
	listJourneys,
	loadProfilesForCorpus
} from '$lib/server/corpus-store';
import type { PageServerLoad } from './$types';

export type { FragmentAnnotation } from '$lib/server/corpus-store';

export type ParticipantProfile = {
	first_name?: string;
	last_initial?: string;
	gender?: string;
	country?: string;
	age_range?: string;
	avatar_url?: string | null;
};

export const load: PageServerLoad = async () => {
	const corpora = await listCorpusBundles();
	const journeys = await listJourneys();
	const profilesByCorpus: Record<string, Record<string, ParticipantProfile>> = {};
	for (const c of corpora) {
		const profiles = await loadProfilesForCorpus(c.manifest.id);
		profilesByCorpus[c.manifest.id] = profiles as Record<string, ParticipantProfile>;
	}

	return {
		personas: listPersonas(),
		corpora,
		journeys,
		profilesByCorpus
	};
};
