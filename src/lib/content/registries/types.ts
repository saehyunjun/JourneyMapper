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
