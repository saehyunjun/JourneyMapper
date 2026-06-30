/**
 * Entity registry types — the data model behind ENTITY_REGISTRY.md.
 *
 * An entity is a NAMED THING that appears in patient/caregiver text — a
 * drug, biomarker, sponsor, symptom, concept, trial, or condition.
 * Entities are the unit of matching (surface_forms → entity_id);
 * themes are the unit of categorization (analyst-assigned per span).
 *
 * The two layers are orthogonal: a span can carry both an entity match
 * (entity.drug.dapagliflozin) AND multiple theme tags
 * (hrqol.general_health + util.coverage) simultaneously.
 *
 * Phase 1 of the codebook migration (parallel data model): this file
 * defines the schema; per-kind JSON files hold the data. Nothing reads
 * either yet — the dual-source matcher wiring lands in Phase 2.
 */
import type { IndicationId, TherapeuticAreaId } from '$lib/content/registries/types';

export type EntityKind =
	| 'drug'
	| 'biomarker'
	| 'sponsor'
	| 'concept'
	| 'symptom'
	| 'trial'
	| 'condition';

/** EntityId is dotted: `entity.<kind>.<slug>` — e.g. `entity.drug.dapagliflozin`. */
export type EntityId = `entity.${EntityKind}.${string}`;

export type EntityProvenance = 'registry' | 'extracted' | 'analyst';

export type EntityStatus = 'active' | 'deprecated';

/** Drug-specific metadata. `class` is the MOA family (SGLT2_inhibitor,
 *  APRIL_inhibitor, etc.); brand_names is for surface-form derivation
 *  during ingest. */
export type DrugMetadata = {
	class?: string;
	mechanism?: string;
	approval_status?: 'approved' | 'investigational' | 'discontinued' | string;
	brand_names?: string[];
	routes?: string[];
	generic_name?: string;
	/** FK to a Sponsor EntityId. Optional — generics may have no single sponsor. */
	sponsor_id?: EntityId;
	/** Back-compat link to the legacy drugs.json id during migration. */
	original_id?: string;
};

export type BiomarkerMetadata = {
	measurement_type?: 'numeric' | 'categorical';
	normal_range?: string;
	clinical_use?: string;
};

export type SponsorMetadata = {
	sponsor_type?: 'pharma' | 'biotech' | 'academic' | 'cro' | 'unknown';
	parent_org?: string;
	headquarters_country?: string;
	original_id?: string;
};

export type SymptomMetadata = {
	severity_scale?: 'none' | 'clinician' | 'patient';
	icd10_codes?: string[];
};

export type TrialMetadata = {
	nct_id?: string;
	phase?: '1' | '2' | '3' | '4' | 'preclinical' | string;
	status?: 'recruiting' | 'active' | 'completed' | 'suspended' | 'terminated' | string;
	sponsor_id?: EntityId;
};

export type ConditionMetadata = {
	icd10_codes?: string[];
	/** True for primary indications (also surface in registries/indications.json).
	 *  False for comorbidities that patients reference alongside their primary. */
	is_primary_indication?: boolean;
};

export type EntityMetadata =
	| DrugMetadata
	| BiomarkerMetadata
	| SponsorMetadata
	| SymptomMetadata
	| TrialMetadata
	| ConditionMetadata
	| Record<string, unknown>;

export type Entity = {
	id: EntityId;
	kind: EntityKind;
	label: string;
	/** Every surface form that could appear in patient text — brand names,
	 *  abbreviations, slang. The matcher fails silently on missing forms. */
	surface_forms: string[];
	/** Multi-indication membership. Empty array means cross-cutting (applies
	 *  to every indication). */
	indications: IndicationId[];
	/** Derived from indications; stored for query speed. */
	therapeutic_areas: TherapeuticAreaId[];
	/** FKs into the theme registry. Default themes this entity is typically
	 *  discussed in the context of — SUGGESTIONS for the tagger UI, never
	 *  authoritative. Per-span theme assignment lives in ThemeTag rows. */
	theme_links: string[];
	metadata: EntityMetadata;
	provenance: EntityProvenance;
	description?: string;
	status: EntityStatus;
};

/** A per-span entity match. Many EntityMention rows can coexist on the
 *  same span when multiple entities are mentioned together. Theme tags
 *  on the span live in separate ThemeTag rows. */
export type EntityMention = {
	segment_id: string;
	span: { start: number; end: number; text: string };
	entity_id: EntityId;
	matched_surface_form: string;
};

/** Top-level shape of per-kind JSON files (drugs.json, biomarkers.json,
 *  etc.) — matches the existing registry pattern. */
export type EntityRegistry = {
	schema_version: string;
	description: string;
	items: Entity[];
};
