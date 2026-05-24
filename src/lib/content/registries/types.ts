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

/** Content source ids — the closed vocabulary of WHERE a piece of patient
 *  voice originated. Parallel to indications and burdens as a cross-cutting
 *  axis. Distinct from SourceTypeId, which is dataset PROVENANCE (how data
 *  got into the system). A YouTube transcript can be content_source:
 *  'youtube_transcript' AND dataset source.type: 'third_party_provider'. */
export type ContentSourceId =
	| 'interview'
	| 'social_post'
	| 'youtube_transcript'
	| 'forum_post'
	| 'blog_post'
	| 'search_query'
	| 'podcast_transcript';

/** Pharma sponsor ids — commercial owner / developer of a drug. Add new ids to
 *  registries/sponsors.json first, then extend this union. */
export type SponsorId =
	| 'novo_nordisk'
	| 'eli_lilly'
	| 'astrazeneca'
	| 'gsk'
	| 'aurinia'
	| 'roche';

/** Mechanism-of-action ids — pharmacologic class. Add new ids to
 *  registries/mechanisms_of_action.json first, then extend this union. */
export type MoaId =
	| 'antimetabolite'
	| 'alkylating_agent'
	| 'calcineurin_inhibitor'
	| 'anti_blys'
	| 'corticosteroid'
	| 'antimalarial'
	| 'anti_cd20'
	| 'type_i_interferon_antagonist'
	| 'glp1_agonist'
	| 'dual_glp1_gip_agonist'
	| 'triple_agonist'
	| 'amylin_analog'
	| 'biguanide'
	| 'sympathomimetic'
	| 'ace_inhibitor_or_arb';

/** Drug ids — specific drugs (not classes). Add new ids to
 *  registries/drugs.json first, then extend this union. */
export type DrugId =
	| 'mycophenolate'
	| 'cyclophosphamide'
	| 'voclosporin'
	| 'belimumab'
	| 'corticosteroids'
	| 'hydroxychloroquine'
	| 'azathioprine'
	| 'rituximab'
	| 'anifrolumab'
	| 'obinutuzumab'
	| 'semaglutide'
	| 'tirzepatide'
	| 'cagrilintide'
	| 'retatrutide'
	| 'orforglipron'
	| 'metformin'
	| 'phentermine';

export type DrugStage =
	| 'approved'
	| 'phase_3'
	| 'phase_2'
	| 'phase_1'
	| 'preclinical';

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

export type ContentSource = {
	id: ContentSourceId;
	label: string;
	description: string;
	/** Metadata fields typically attached to content of this source type — a
	 *  hint to downstream ingestion code, not a hard schema. Phase 5 (multi-
	 *  source ingestion) defines the actual per-source-type envelope. */
	typical_metadata: string[];
};

export type BurdenCategory = {
	id: BurdenCategoryId;
	label: string;
	/** Null for top-level categories; otherwise the parent's id. */
	parent_id: BurdenCategoryId | null;
	description: string;
};

export type Sponsor = {
	id: SponsorId;
	label: string;
	headquarters_country: string | null;
};

/** Shape of an embedding vector field. Phase-1-closure addition: every taxonomy
 *  entity (cluster, drug, MOA, burden) eventually carries a precomputed
 *  embedding used by the retrieval-first annotation path (Phase 3). The slot
 *  is OPTIONAL today — no entity in this repo carries an embedding yet, and
 *  no code reads or writes the field. The type only declares the contract so
 *  the schema doesn't break when Phase 3 starts populating values.
 *
 *  Convention: 1536-dim float vectors (compatible with text-embedding-3-small
 *  / Voyage / similar). The provider + model id is stored on the same entity
 *  via `embedding_provider` and `embedding_model` siblings if needed; for now
 *  a single embedding per entity is enough. */
export type Embedding = number[];

export type MechanismOfAction = {
	id: MoaId;
	label: string;
	description: string;
	/** Phase 3 lever — precomputed embedding for retrieval. See Embedding type. */
	embedding?: Embedding;
};

export type Drug = {
	id: DrugId;
	label: string;
	generic_name: string;
	brand_names: string[];
	moa_id: MoaId | null;
	sponsor_id: SponsorId | null;
	stage: DrugStage;
	indication_ids: IndicationId[];
	description?: string;
	/** Phase 3 lever — precomputed embedding for retrieval. See Embedding type. */
	embedding?: Embedding;
};
