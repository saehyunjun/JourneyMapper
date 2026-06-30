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
	| 'endocrinology'
	| 'neurology';

export type IndicationId =
	| 'lupus_nephritis'
	| 'melanoma'
	| 'obesity'
	| 'multiple_sclerosis'
	| 'pku'
	| 'sjogrens'
	| 'iga_nephropathy';

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
	| 'social_comment'
	| 'youtube_transcript'
	| 'forum_post'
	| 'forum_comment'
	| 'blog_post'
	| 'blog_comment'
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
	| 'roche'
	| 'biogen'
	| 'novartis'
	| 'tg_therapeutics'
	| 'kyverna'
	| 'cabaletta_bio'
	| 'cartesian_therapeutics';

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
	| 'ace_inhibitor_or_arb'
	| 's1p_modulator'
	| 'alpha_4_integrin'
	| 'car_t_autologous';

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
	| 'phentermine'
	| 'ocrelizumab'
	| 'ofatumumab'
	| 'ublituximab'
	| 'natalizumab'
	| 'fingolimod'
	| 'kyv_101'
	| 'caba_201'
	| 'descartes_08';

export type DrugStage =
	| 'approved'
	| 'phase_3'
	| 'phase_2'
	| 'phase_1'
	| 'preclinical';

/** Content-strategy archetype ids — top level of the content-suggestor tree.
 *  Add new ids to registries/content_strategies.json first, then extend this
 *  union. Strategies declare which burden categories, codebook subthemes, and
 *  journey stages they address; the mapping layer intersects those arrays to
 *  score fit. */
export type ContentStrategyId =
	| 'unbranded_awareness'
	| 'patient_education_clinical'
	| 'advocacy_partnership'
	| 'peer_storytelling'
	| 'hcp_enablement'
	| 'trial_recruitment_support'
	| 'caregiver_enablement'
	| 'payer_navigation'
	| 'lifestyle_normalization'
	| 'early_engagement_serp';

/** Advocacy / patient-organization ids — referenced by tactics that pair a
 *  strategy with a specific partnership. Add new orgs to
 *  registries/advocacy_partners.json first, then extend this union. */
export type AdvocacyPartnerId =
	| 'lupus_foundation_america'
	| 'lupus_research_alliance'
	| 'kaleidoscope_fighting_lupus'
	| 'sle_lupus_foundation'
	| 'lupus_and_allied_diseases_association'
	| 'nephcure'
	| 'american_kidney_fund'
	| 'global_healthy_living_foundation'
	| 'molly_meanswell_lupus'
	| 'lupus_la';

/** Content format ids — the leaf level of the content-suggestor tree. Each
 *  format declares the channels it can run on and the strategies/stages it
 *  fits best. Add new formats to registries/content_formats.json first, then
 *  extend this union. */
export type ContentFormatId =
	| 'long_form_explainer'
	| 'short_explainer_video'
	| 'patient_story_video'
	| 'patient_story_essay'
	| 'podcast_episode'
	| 'decision_aid_worksheet'
	| 'interactive_symptom_checker'
	| 'infographic'
	| 'reddit_ama'
	| 'advocacy_webinar'
	| 'search_seo_landing_page'
	| 'caregiver_guide'
	| 'financial_navigation_worksheet'
	| 'hcp_cme_module'
	| 'peer_mentor_program'
	| 'social_short_post'
	| 'clinic_handout';

/** LN patient-journey stage ids. Mirrors journeys/lupus_nephritis.json. The
 *  content_strategies registry's `fits_journey_stages` references these. When
 *  we generalize to other indications, this union will likely move to a
 *  per-indication map; for now LN is the only typed journey. */
export type LnJourneyStageId =
	| 'pre_diagnosis'
	| 'diagnostic_odyssey'
	| 'induction_treatment'
	| 'stable_maintenance'
	| 'flare_or_refractory_cycle'
	| 'trial_consideration'
	| 'in_trial_experience'
	| 'post_trial';

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

/** A content-strategy archetype — top level of the content-suggestor tree.
 *  `addresses_subthemes` references codebook.json subtheme ids (typed loosely
 *  as string here because the subtheme union lives in the codebook layer, not
 *  this file). Validate at build time that every entry exists. */
export type ContentStrategy = {
	id: ContentStrategyId;
	label: string;
	description: string;
	fits_journey_stages: LnJourneyStageId[];
	addresses_burden_categories: BurdenCategoryId[];
	addresses_subthemes: string[];
	typical_kpis: string[];
	competitive_pattern: string;
};

/** An advocacy / patient organization. `partnership_modes` is a coarse
 *  vocabulary of formats the org has historically supported — not an offer of
 *  partnership and not a hard schema. */
export type AdvocacyPartner = {
	id: AdvocacyPartnerId;
	label: string;
	url: string;
	indication_ids: IndicationId[];
	/** Adjacent indications the partner engages secondarily. Free-text because
	 *  these spill outside the IndicationId union (e.g. fsgs, iga_nephropathy,
	 *  systemic_lupus_erythematosus). Promote to typed ids if those indications
	 *  ever join the registry. */
	secondary_indication_relevance: string[];
	focus_areas: string[];
	audience_segments: string[];
	channels: string[];
	/** Qualitative until we have actual reach numbers: national / regional /
	 *  local / niche. */
	estimated_reach: 'national' | 'regional' | 'local' | 'niche';
	partnership_modes: string[];
	description: string;
};

/** A content format — leaf level of the content-suggestor tree. Production
 *  complexity is qualitative (low / medium / high); evidence_requirement is
 *  free-text so authors can describe nuanced needs (e.g. 'consented_patient_
 *  story', 'accredited_medical_review'). */
export type ContentFormat = {
	id: ContentFormatId;
	label: string;
	format_class: 'narrative' | 'explainer' | 'tool' | 'event' | 'community';
	channels: string[];
	production_complexity: 'low' | 'medium' | 'high';
	best_for_stages: LnJourneyStageId[];
	best_for_strategies: ContentStrategyId[];
	evidence_requirement: string;
	description: string;
};
