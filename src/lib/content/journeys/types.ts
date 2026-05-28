/**
 * journeys/types.ts
 *
 * Per-indication clinical-journey taxonomies. Each indication owns a
 * `<indication>.json` file describing the chronological arc a patient
 * (or caregiver) moves through — used by the stage-tagging pipeline and
 * the journey-map artifact view.
 *
 * Two distinct usages worth keeping separate:
 *
 *   1. **Fragment stage tag** — annotates "what stage is THIS fragment
 *      talking about?" Lives in corpora/<corpus>/annotations/ and is
 *      multi-label (a fragment can touch two stages). Source-agnostic.
 *
 *   2. **Speaker journey position** — speaker_attrs.condition_stage_at_speech
 *      on the Fragment itself, capturing "where is the SPEAKER currently
 *      in their own journey?" Distinct from (1) because someone in
 *      maintenance phase can reminisce about diagnosis.
 *
 * Both use the same stage/step ids from these registries.
 *
 * Stage ids are stable FKs — don't rename without migrating tags. New
 * stages can be inserted; the `order` field is re-numbered on insertion
 * (gaps not maintained on purpose, since the taxonomies are small).
 */

import type { IndicationId } from '../registries/types';

export type JourneyStep = {
	/** Stable id, snake_case, indication-scoped. */
	id: string;
	label: string;
	description: string;
};

export type JourneyStage = {
	id: string;
	/** Chronological order within the indication, 1-indexed. */
	order: number;
	label: string;
	/** 1-2 sentence description of what this stage covers. */
	description: string;
	/** Sub-stages. Optional — some stages have no useful subdivision. */
	steps: JourneyStep[];
};

export type JourneyMap = {
	meta: {
		schema_version: string;
		indication: IndicationId;
		label: string;
		notes: string[];
	};
	stages: JourneyStage[];
};
