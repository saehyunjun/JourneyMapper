/**
 * corpora/types.ts
 *
 * The unified evidence record (Fragment) and supporting types. Every analysis
 * downstream of source ingestion operates on Fragments — themes, journey
 * stages, sentiment, persona matching, weighting. Source-specific structural
 * files (segments.json, transcripts, paper-extract pipelines) remain canonical
 * for their own pipelines; fragments are the cross-source projection used by
 * analysis.
 *
 * Layout (per corpus):
 *   src/lib/content/corpora/<corpus_id>/
 *     manifest.json
 *     fragments/<content_source>.json
 *     annotations/<content_source>.json   (joined by fragment_id; annotations
 *                                          live in a sibling tree so the
 *                                          codebook can re-derive them)
 *
 * See README.md in this folder for rationale and migration path.
 */

import type { ContentSourceId, IndicationId } from '../registries/types';

// === IDs =====================================================================

/** Globally unique fragment id, conventionally prefixed by content_source for
 *  debuggability. Examples:
 *    'iv-participant_07-s142'   (interview)
 *    'rd-r_mcrpc-1k4j2-c9'      (reddit comment)
 *    'yt-_abc-04220-08400'      (youtube caption span)
 *  Format is convention, not enforced. Uniqueness within a corpus IS enforced. */
export type FragmentId = string;

/** Ingestion-batch id. Decoupled from indication so cross-cutting corpora are
 *  possible (e.g. a general clinical-trial-skepticism corpus spanning oncology
 *  + nephrology). Examples: 'wct_glp1_2025q4', 'mcrpc_pluvicto_2026q2'. */
export type CorpusId = string;

// === Three-state attribute model =============================================

/** Evidence provenance for any speaker attribute. Critical for heterogeneous
 *  sources: persona predicates must be able to distinguish
 *    - missing key                        → attribute never considered
 *    - { evidence: 'unknown', value: null } → asked but couldn't determine
 *    - { evidence: 'inferred', value, confidence } → derived from context
 *    - { evidence: 'stated', value, source_quote } → speaker said so explicitly
 *
 *  Without this distinction, a persona filter like
 *  `distance_to_coe_band >= '100-300mi'` silently drops every Reddit/paper
 *  fragment (since the attribute is rarely stated), making personas
 *  interview-only by accident. */
export type AttrEvidence = 'stated' | 'inferred' | 'unknown';

export type SpeakerAttr<T> = {
	value: T | null;
	evidence: AttrEvidence;
	/** Required when evidence = 'inferred'; otherwise omitted. */
	confidence?: number;
	/** Recommended when evidence = 'stated' and the supporting span is in the
	 *  fragment text or a sibling fragment. May be omitted when the source
	 *  lives outside the fragment store (e.g. recruitment intake, analyst-
	 *  authored profile data). */
	source_quote?: string;
};

// === Speaker attribute value types ===========================================

export type SpeakerRole =
	| 'patient'
	| 'caregiver'
	| 'clinician'
	| 'researcher'
	| 'advocate'
	| 'other';

export type AgeBand = '<18' | '18-25' | '26-35' | '36-45' | '46-55' | '56-65' | '65+';

export type SocioeconomicBand =
	| 'low'
	| 'lower_middle'
	| 'middle'
	| 'upper_middle'
	| 'high';

export type GenderValue = 'female' | 'male' | 'nonbinary' | 'other';

export type DistanceToCoeBand = '<25mi' | '25-100mi' | '100-300mi' | '>300mi';

export type TrialHistory =
	| 'none'
	| 'screened_only'
	| 'enrolled'
	| 'completed'
	| 'multiple';

/** Sparse, provenanced speaker attributes. Each entry is optional — absent key
 *  means the attribute was never considered for this fragment (NOT the same as
 *  asked-and-unknown; see AttrEvidence).
 *
 *  Extensible per-indication: new domains (e.g. line-of-therapy, comorbidity
 *  burden band) can be added as additional optional fields. */
export type SpeakerAttrs = {
	role?: SpeakerAttr<SpeakerRole>;
	age_band?: SpeakerAttr<AgeBand>;
	gender?: SpeakerAttr<GenderValue>;
	/** ISO-3166 alpha-2. */
	country?: SpeakerAttr<string>;
	/** Sub-national location freetext — state/province/city/region. Kept open
	 *  because the unit varies by corpus (US states vs UK cities vs metros). */
	region?: SpeakerAttr<string>;
	/** Analyst-estimated socioeconomic band. Always `inferred` in practice;
	 *  the corpus rarely contains income data directly. */
	ses?: SpeakerAttr<SocioeconomicBand>;
	/** A journey-stage id from the per-indication stage registry (TBD). String
	 *  for now; will narrow to an enum once the stage registry lands. */
	condition_stage_at_speech?: SpeakerAttr<string>;
	distance_to_coe_band?: SpeakerAttr<DistanceToCoeBand>;
	trial_history?: SpeakerAttr<TrialHistory>;
	caregiver_present?: SpeakerAttr<boolean>;
};

// === Source references =======================================================

/** Structural back-pointer to the upstream source. Discriminated by `kind`,
 *  which is 1:1 with the analytically-relevant subset of ContentSourceId.
 *
 *  PII NOTE: the fragments store contains only deidentified text. SourceRefs
 *  may include URLs and (keyed-hash) author tokens. Author hashes use a salt
 *  that is destroyed after ingestion, giving within-corpus author-level
 *  grouping without enabling re-identification. The deid_rules_version field
 *  on the Fragment pins which scrubbing rules ran. */
export type SourceRef =
	| {
			kind: 'interview';
			interview_id: string;
			segment_id?: string;
			char_start: number;
			char_end: number;
	  }
	| {
			kind:
				| 'social_post'
				| 'social_comment'
				| 'forum_post'
				| 'forum_comment'
				| 'blog_post'
				| 'blog_comment';
			platform: string;
			/** Public URL of the post / comment. Optional because analyst-handed
			 *  datasets often arrive de-identified without source URLs. */
			url?: string;
			/** Platform-native post id when available; otherwise a stable id
			 *  composed from the dataset's hierarchy (thread/conversation). */
			post_id: string;
			comment_id?: string;
			/** ISO timestamp of when we fetched it (NOT when it was authored —
			 *  that's on the Fragment as date_observed). Optional for analyst-
			 *  handed datasets where capture provenance isn't recorded. */
			captured_at?: string;
			/** Keyed hash; salt destroyed post-ingest. Enables within-corpus author
			 *  dedup without re-identification. */
			author_handle_hash?: string;
			/** Present when this fragment is a sub-segment of a longer post /
			 *  comment (split_long_fragments fired during ingest). Offsets are
			 *  relative to the parent post's normalized text. Siblings share
			 *  `post_id` + `comment_id`; ordering follows char_start. */
			char_start?: number;
			char_end?: number;
	  }
	| {
			kind: 'youtube_transcript' | 'podcast_transcript';
			/** Source URL when known (video/episode link). Optional because
			 *  analyst-pasted transcripts may not carry one. */
			url?: string;
			/** Stable id for the media unit — for ingested-from-text uploads this
			 *  is the slugified episode id; for proper audio pipelines it's the
			 *  platform-native video/episode id. */
			media_id: string;
			/** Episode-level grouping id so per-segment fragments cluster together
			 *  (analogous to forum_post's post_id). For pasted-text ingest this is
			 *  derived from corpus + episode slug. */
			post_id?: string;
			/** Optional in/out timestamps. Populated by real audio-stamped
			 *  pipelines; absent when the transcript was pasted as plain text. */
			start_ms?: number;
			end_ms?: number;
			/** Character offsets relative to the parent transcript text. Used by
			 *  the pasted-text ingest in place of audio timestamps so siblings can
			 *  be re-ordered. */
			char_start?: number;
			char_end?: number;
			captured_at?: string;
	  }
	| {
			kind: 'search_query';
			source_dataset: string;
			query_text: string;
			locale?: string;
	  };

// === Weighting ===============================================================

/** Per-source raw signals used to compute weight multipliers at query time.
 *  Sparse — only the relevant subset is populated per source. The final
 *  multiplier is a function of (signals, persona's chosen weighting strategy),
 *  NOT a stored field — so we don't have to rewrite fragments when the
 *  strategy changes. */
export type WeightSignals = {
	upvotes?: number;
	reply_count?: number;
	citation_count?: number;
	peer_reviewed?: boolean;
	sample_size?: number;
	/** Years between date_observed and "now"; cached for convenience. Recompute
	 *  at query time if precision matters. */
	age_years?: number;
};

// === Licensing ===============================================================

/** Redistribution gating, NOT privacy gating. Privacy is handled upstream by
 *  the deid pipeline. This field governs whether the *deidentified text* can
 *  be republished verbatim under copyright/TOS — papers and some forum posts
 *  remain quotation-restricted even after deid. */
export type License =
	| 'public_domain'
	| 'cc_by'
	| 'research_fair_use'
	| 'consented_research'
	| 'no_redistribute';

// === The Fragment ============================================================

export type Fragment = {
	id: FragmentId;
	corpus_id: CorpusId;
	/** Single-indication for most fragments; multi-valued only when the fragment
	 *  is genuinely cross-cutting (e.g. a general clinical-trial-skepticism post
	 *  applicable across diseases). */
	indications: IndicationId[];

	/** Analytic source taxonomy, registry-aligned. */
	content_source: ContentSourceId;
	/** Structural back-pointer; discriminated by `kind`. */
	source_ref: SourceRef;

	/** Deidentified, analyzable text. The raw pre-deid text is NOT stored here
	 *  — it lives in a separate access-controlled archive. */
	text: string;
	/** ISO-639-1, default 'en'. */
	lang: string;

	/** When the speech act happened (interview date, post date, paper pub date). */
	date_observed: string;
	/** What time the speaker is talking ABOUT, if extractable. Usually null —
	 *  most fragments speak about "now." When set, lets stage-tagging reason
	 *  about temporal displacement (someone in 2026 narrating their 2018
	 *  diagnosis). */
	date_referenced?: string | null;

	speaker_attrs: SpeakerAttrs;

	/** Default per content_source (see DEFAULT_WEIGHT_BASE); overridable per
	 *  fragment if the analyst wants to up/downweight a specific item. */
	weight_base: number;
	weight_signals: WeightSignals;

	/** For cross-source near-duplicate detection (same Reddit quote scraped
	 *  twice, or a paper that quotes a participant who's also in our interview
	 *  corpus). */
	dedup_hash?: string;
	/** If this fragment is derived from one or more others, pointer(s) back.
	 *  Two production cases:
	 *    - summarization (a paper's abstract sentence summarizing a cohort) —
	 *      single id back-pointer to the cited source
	 *    - analyst merge (combining multiple comments into one comprehensive
	 *      quote) — array of ids the merge synthesized from
	 *  Single-id readers can normalize with
	 *  `Array.isArray(d) ? d[0] : d`. */
	derived_from?: FragmentId | FragmentId[] | null;

	license: License;
	/** Derived from license; UI reads this to gate quote-vs-summarize. */
	redistribute_verbatim: boolean;

	// Provenance
	deidentified_at: string;
	/** Pipeline version, e.g. 'deid-pipeline@0.4'. */
	deidentifier_version: string;
	/** Which scrub-rule set ran (names, dates, locations, employer, etc.).
	 *  Pinned so we know which fragments need reprocessing when rules tighten. */
	deid_rules_version: string;
	ingested_at: string;
	/** Ingester version, e.g. 'import-interviews@1.0'. Re-ingestion under a new
	 *  version produces new fragment ids rather than mutating old ones; old
	 *  annotations follow old fragment ids. Analyst cuts over deliberately. */
	ingester_version: string;
};

// === Corpus manifest =========================================================

/** Per-corpus index. Lives at corpora/<corpus_id>/manifest.json. */
export type CorpusManifest = {
	id: CorpusId;
	label: string;
	indications: IndicationId[];
	created_at: string;
	updated_at: string;
	partitions: Array<{
		content_source: ContentSourceId;
		fragment_count: number;
		ingester_version: string;
		last_ingested_at: string;
	}>;
};

// === Annotations =============================================================

/** Per-fragment journey-stage annotation. One fragment can span multiple stages
 *  (an announcement post may touch trial enrollment AND prior treatment).
 *  Generated by scripts/propose-fragment-stages.mjs. */
export type StagesAnnotation = {
	values: Array<{
		stage_id: string;
		/** Finer-grained sub-step inside the stage. null when the fragment is
		 *  about the stage broadly but no specific step applies. */
		step_id: string | null;
		confidence: number;
	}>;
	overall_confidence: number;
	note: string;
	source: 'ai_proposed' | 'human';
	review_status: 'pending' | 'confirmed' | 'human_confirmed';
};

/** Per-fragment codebook annotation: themes/subthemes (from propose-fragment-
 *  themes.mjs) merged with sentiment/emotions (from propose-fragment-sentiment.mjs).
 *  Both pipelines write into this single block, preserving the other's fields. */
export type SegmentTagsAnnotation = {
	themes: string[];
	subthemes: string[];
	emotions: string[];
	topics: string[];
	sentiment_score: number | null;
	confidence: number | null;
	note: string;
	source: 'ai_proposed' | 'human';
	review_status: 'pending' | 'confirmed' | 'human_confirmed';
	/** Optional per-dimension generator provenance, set by the themes pass. */
	themes_generator?: string;
	themes_generated_at?: string;
	themes_confidence?: number;
	themes_note?: string;
};

/** One fragment's record in the annotations file. Each dimension key is
 *  optional — a fragment may carry only segment_tags, only stages, or both. */
export type FragmentAnnotation = {
	stages?: StagesAnnotation;
	segment_tags?: SegmentTagsAnnotation;
};

/** Shape of corpora/<id>/annotations/<content_source>.json. */
export type AnnotationFile = {
	meta: {
		schema_version: string;
		corpus_id: CorpusId;
		content_source: ContentSourceId;
		updated_at: string;
		dimensions?: Record<string, unknown>;
		notes?: string[];
	};
	annotations: Record<FragmentId, FragmentAnnotation>;
};

// === Journey schema ==========================================================

/** Per-indication journey taxonomy. Lives at content/journeys/<indication>.json.
 *  Powers the Stages section of the fragment-retag drawer. */
export type JourneySchema = {
	meta: {
		schema_version: string;
		indication: IndicationId;
		label: string;
		notes?: string[];
	};
	stages: Array<{
		id: string;
		order: number;
		label: string;
		description: string;
		steps: Array<{
			id: string;
			label: string;
			description: string;
		}>;
	}>;
};

// === Default weight bases ====================================================

/** Starting points only — analyst-tunable per corpus. Higher = stronger signal
 *  per fragment. Direct first-person voice (interview) tops the list;
 *  aggregated/secondary sources sit lower. Search queries are weakest because
 *  they reflect intent, not voice. */
export const DEFAULT_WEIGHT_BASE: Record<ContentSourceId, number> = {
	interview: 1.0,
	social_post: 0.5,
	forum_post: 0.5,
	blog_post: 0.5,
	youtube_transcript: 0.5,
	podcast_transcript: 0.5,
	search_query: 0.3
};
