/**
 * Journey-map artifact render.
 *
 * Reads the generated artifact at
 *   corpora/<corpus_id>/artifacts/journey-map-<persona_id>.json
 * plus the corpus fragments + journey taxonomy + participant profiles, so the
 * render can resolve fragment_ids in observations to actual quote text.
 */

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { error } from '@sveltejs/kit';
import { loadProfilesForCorpus } from '$lib/server/corpora';
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
	const cwd = process.cwd();

	const artifactPath = resolve(
		cwd,
		`src/lib/content/corpora/${corpus_id}/artifacts/journey-map-${persona_id}.json`
	);
	if (!existsSync(artifactPath)) {
		throw error(404, `No journey-map artifact for ${corpus_id} / ${persona_id}. Run scripts/synthesize-journey-map.mjs to generate.`);
	}
	const artifact = JSON.parse(readFileSync(artifactPath, 'utf8')) as JourneyMapArtifact;

	// Load fragments to resolve supporting_fragment_ids → text.
	const fragmentsById: Record<string, Fragment> = {};
	const fragmentsDir = resolve(cwd, `src/lib/content/corpora/${corpus_id}/fragments`);
	if (existsSync(fragmentsDir)) {
		for (const f of readdirSync(fragmentsDir).filter((f) => f.endsWith('.json'))) {
			const doc = JSON.parse(readFileSync(resolve(fragmentsDir, f), 'utf8')) as {
				fragments?: Fragment[];
			};
			for (const fr of doc.fragments ?? []) fragmentsById[fr.id] = fr;
		}
	}

	const journeyPath = resolve(cwd, `src/lib/content/journeys/${artifact.meta.journey_indication}.json`);
	const journey = existsSync(journeyPath)
		? (JSON.parse(readFileSync(journeyPath, 'utf8')) as JourneyMap)
		: null;

	const profiles = loadProfilesForCorpus(corpus_id);

	return {
		artifact,
		fragmentsById,
		journey,
		profiles
	};
};
