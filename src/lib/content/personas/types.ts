/**
 * personas/types.ts
 *
 * A persona is a SAVED QUERY over the fragment pool — not a roster of
 * specific participants. The same persona applied to different corpora /
 * source mixes will return different fragment sets.
 *
 * Persona evaluation is in evaluate.ts; example persona JSONs live alongside.
 *
 * Three-state attribute semantics (from corpora/types.ts) are honored:
 *   - `allow_unknown: false` (default) rejects fragments where the attr is
 *     missing OR evidence='unknown'.
 *   - `allow_unknown: true` keeps them in. Use this for attrs that are
 *     rarely stated outside interviews (e.g. distance_to_coe_band on
 *     Reddit) when you want the persona to span source types instead of
 *     silently excluding everything that didn't volunteer the attribute.
 *   - `allow_inferred: true` (default) counts evidence='inferred' values.
 *     Set false for strict in-text-stated-only persona definitions.
 */

import type { ContentSourceId, IndicationId } from '../registries/types';

export type PersonaId = string;

/** Matcher for a single speaker_attrs field. */
export type AttrMatcher = {
	/** Allowed values for the attr. Fragment matches when its resolved value
	 *  is in this list. */
	in: (string | number | boolean)[];
	/** If true, fragments where the attr is missing OR evidence='unknown'
	 *  still pass. Defaults to false (strict). */
	allow_unknown?: boolean;
	/** If false, only evidence='stated' counts. Defaults to true. */
	allow_inferred?: boolean;
};

/** Annotation-level filter clauses. All sub-clauses combine with AND semantics.
 *  Each sub-clause is evaluated against the fragment's annotation entry (the
 *  multi-dimensional record with `stages`, `segment_tags`, …). Fragments
 *  without a relevant annotation dimension do NOT match — there's no
 *  three-state model here yet because annotations are produced by our own
 *  pipeline, so "missing" means "we haven't tagged it" rather than "the
 *  speaker didn't say." Tighten this if/when annotation coverage matters.
 *
 *  This is fragment-level, not person-level: a persona built on
 *  has_step: ['cost_pressure'] returns the cost-pressure MOMENTS in the
 *  corpus, not "people who are cost-anxious." Aggregating across a person's
 *  fragments is a separate abstraction we haven't built yet. */
export type AnnotationMatcher = {
	/** Fragment matches if ANY of its `stages.values[].stage_id` is in this list. */
	has_stage?: string[];
	/** Fragment matches if ANY of its `stages.values[].step_id` is in this list. */
	has_step?: string[];
	/** Fragment's `segment_tags.sentiment_score` must fall in [min, max] inclusive. */
	sentiment?: { min?: number; max?: number };
	/** Fragment matches if ANY of its `segment_tags.emotions` is in this list. */
	has_emotion?: string[];
	/** Fragment matches if ANY of its `segment_tags.themes` is in this list. */
	has_theme?: string[];
	/** Fragment matches if ANY of its `segment_tags.subthemes` is in this list. */
	has_subtheme?: string[];
};

/** The filter clause of a persona. All top-level clauses combine with AND semantics. */
export type PersonaFilter = {
	/** Allowed content_source values. Omit to allow all. */
	content_source?: ContentSourceId[];
	/** A fragment matches when ANY of its indications is in this list.
	 *  Omit to allow any indication. */
	indications?: IndicationId[];
	/** Per-attr matchers on speaker_attrs. Keys are SpeakerAttrs field names. */
	speaker_attrs?: Record<string, AttrMatcher>;
	/** Annotation-level clauses. Requires the evaluator to be passed an
	 *  annotations map (otherwise these clauses no-op as if absent). */
	annotations?: AnnotationMatcher;
};

/** How matched fragments are weighted in aggregations. v0 supports a small set;
 *  extend as analyst needs surface. */
export type WeightingStrategy =
	| { type: 'uniform' }
	| { type: 'source_default' }
	| { type: 'custom_multipliers'; multipliers: Partial<Record<ContentSourceId, number>> };

/** Hand-asserted attribute value used by Phase B protocol-friction scoring.
 *  Production path is to derive attributes by aggregating over the persona's
 *  filtered fragment pool — this shape stays compatible. */
export type AttrValue =
	| { kind: 'band'; band: string }
	| { kind: 'enum'; value: string }
	| { kind: 'num'; value: number }
	| { kind: 'bool'; value: boolean };

/** Optional demo-only shim attached to a persona JSON. Carries asserted
 *  attribute values for friction rules to read. The `demo_only: true` marker
 *  is required so consumers can distinguish shimmed values from derived ones
 *  once aggregation lands. See PROTOCOL_PERSONA_DEMO_PLAN.md §5. */
export type PersonaDemoProfile = {
	demo_only: true;
	provenance?: string;
	attrs: Record<string, AttrValue>;
};

export type Persona = {
	id: PersonaId;
	label: string;
	description: string;
	/** Indications this persona is meaningful for. The UI uses this to scope
	 *  the persona to compatible corpora. */
	applicable_indications: IndicationId[];
	filter: PersonaFilter;
	weighting: WeightingStrategy;
	/** Signature color (hex) used in visualizations when "color by persona"
	 *  is selected. Optional — the UI falls back to a slate gray default. */
	color?: string;
	/** Generated or uploaded avatar URL. Narrative-backed personas default to
	 *  a deterministic DiceBear Micah avatar when this is absent. */
	avatar_url?: string;
	demo_profile?: PersonaDemoProfile;
};
