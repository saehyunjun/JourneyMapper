/**
 * Journey-map artifact render.
 *
 * Reads the generated artifact at
 *   corpora/<corpus_id>/artifacts/journey-map-<persona_id>.json
 * plus the corpus fragments + journey taxonomy + participant profiles, so the
 * render can resolve fragment_ids in observations to actual quote text.
 */

import { error } from '@sveltejs/kit';
import {
	loadCorpusArtifact,
	loadCorpusBundle,
	loadJourneySchema,
	loadProfilesForCorpus
} from '$lib/server/corpus-store';
import type { Fragment } from '$lib/content/corpora/types';
import type { JourneyMap } from '$lib/content/journeys/types';
import type { PageServerLoad } from './$types';
import type { JourneyMapArtifact } from '$lib/components/journey-map/types';

export type {
	Observation,
	ExternalObservation,
	StepMap,
	StageMap,
	DecisionPanelItem,
	DecisionPanel,
	ExternalObservationsProposerMeta,
	JourneyMapArtifact
} from '$lib/components/journey-map/types';

export const load: PageServerLoad = async ({ params }) => {
	const { corpus_id, persona_id } = params;

	const artifact = await loadCorpusArtifact<JourneyMapArtifact>(
		corpus_id,
		`journey-map-${persona_id}`
	);
	if (!artifact) {
		throw error(
			404,
			`No journey-map artifact for ${corpus_id} / ${persona_id}. Run scripts/synthesize-journey-map.mjs to generate.`
		);
	}

	// Resolve supporting_fragment_ids → text via the prod-safe corpus bundle.
	const bundle = await loadCorpusBundle(corpus_id);
	const fragmentsById: Record<string, Fragment> = {};
	for (const f of bundle?.fragments ?? []) fragmentsById[f.id] = f;

	const journey = (await loadJourneySchema(artifact.meta.journey_indication)) as JourneyMap | null;

	const profiles = await loadProfilesForCorpus(corpus_id);

	return {
		artifact,
		fragmentsById,
		journey,
		profiles
	};
};
