/**
 * Typed views over the JSON registries in this folder. Kept narrow on purpose —
 * the JSON files are the source of truth, and these unions just give consumers
 * autocomplete on stable ids.
 *
 * If you add a new id to a registry JSON, add it to the matching union here.
 */

export type TherapeuticAreaId =
	| 'immunology'
	| 'nephrology'
	| 'oncology'
	| 'endocrinology';

export type IndicationId =
	| 'lupus_nephritis'
	| 'melanoma'
	| 'obesity';

export type DatasetTypeId =
	| 'keyword_clusters'
	| 'search_volume_topics'
	| 'community_engagement'
	| 'ad_spend_timeseries';

export type SourceTypeId = 'manual_extract' | 'primary_research' | 'third_party_provider';

/** Burden taxonomy ids — tree-structured (parent_id resolves to another
 *  BurdenCategoryId or null for top-level). Add new ids to the registry first,
 *  then extend this union. */
export type BurdenCategoryId =
	| 'financial'
	| 'financial_out_of_pocket'
	| 'financial_insurance'
	| 'financial_lost_income'
	| 'physical'
	| 'physical_symptoms'
	| 'physical_side_effects'
	| 'physical_appearance'
	| 'emotional'
	| 'emotional_fear'
	| 'emotional_grief'
	| 'emotional_isolation'
	| 'emotional_uncertainty'
	| 'regimen'
	| 'regimen_adherence'
	| 'regimen_monitoring'
	| 'regimen_appointments'
	| 'information'
	| 'information_knowledge_gaps'
	| 'information_decision_complexity'
	| 'information_navigation'
	| 'social'
	| 'social_stigma'
	| 'social_relationships'
	| 'social_disclosure'
	| 'logistical'
	| 'logistical_travel'
	| 'logistical_scheduling'
	| 'logistical_caregiver'
	| 'quality_of_life'
	| 'qol_functional'
	| 'qol_independence'
	| 'qol_normalcy';

export type TherapeuticArea = {
	id: TherapeuticAreaId;
	label: string;
	mesh_id: string | null;
	mesh_term: string | null;
};

export type Indication = {
	id: IndicationId;
	label: string;
	abbreviation: string | null;
	mesh_id: string | null;
	mesh_term: string | null;
	therapeutic_area_ids: TherapeuticAreaId[];
	/** Short prose summary shown in selectors/tooltips. Optional so the
	 *  registry can grow incrementally; consumers should treat missing as
	 *  empty string. */
	description?: string;
};

export type DatasetType = {
	id: DatasetTypeId;
	label: string;
	description: string;
};

export type SourceType = {
	id: SourceTypeId;
	label: string;
	description: string;
};

export type BurdenCategory = {
	id: BurdenCategoryId;
	label: string;
	/** Null for top-level categories; otherwise the parent's id. */
	parent_id: BurdenCategoryId | null;
	description: string;
};
