/**
 * Marketing detail page loader — seeds the embedded JourneyMapView with the
 * real LN / SLE CAR-T journey-map artifact + its supporting fragments,
 * journey taxonomy, and speaker profiles.
 *
 * The same data path the product route uses, with the corpus / persona
 * pinned to the demo selection.
 */

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadProfilesForCorpus } from '$lib/server/corpora';
import type { Fragment } from '$lib/content/corpora/types';
import type { JourneyMap } from '$lib/content/journeys/types';
import type { JourneyMapArtifact } from '$lib/components/journey-map/types';
import type { PageServerLoad } from './$types';

const DEMO_CORPUS = 'ln_reddit_2026q1';
const DEMO_PERSONA = 'ln_sle_carT_curious_patients';

export const load: PageServerLoad = async () => {
	const cwd = process.cwd();

	const artifactPath = resolve(
		cwd,
		`src/lib/content/corpora/${DEMO_CORPUS}/artifacts/journey-map-${DEMO_PERSONA}.json`
	);
	const artifact = JSON.parse(readFileSync(artifactPath, 'utf8')) as JourneyMapArtifact;

	const fragmentsById: Record<string, Fragment> = {};
	const fragmentsDir = resolve(cwd, `src/lib/content/corpora/${DEMO_CORPUS}/fragments`);
	if (existsSync(fragmentsDir)) {
		for (const f of readdirSync(fragmentsDir).filter((f) => f.endsWith('.json'))) {
			const doc = JSON.parse(readFileSync(resolve(fragmentsDir, f), 'utf8')) as {
				fragments?: Fragment[];
			};
			for (const fr of doc.fragments ?? []) fragmentsById[fr.id] = fr;
		}
	}

	const journeyPath = resolve(
		cwd,
		`src/lib/content/journeys/${artifact.meta.journey_indication}.json`
	);
	const journey = existsSync(journeyPath)
		? (JSON.parse(readFileSync(journeyPath, 'utf8')) as JourneyMap)
		: null;

	const profiles = loadProfilesForCorpus(DEMO_CORPUS);

	return { artifact, fragmentsById, journey, profiles };
};
