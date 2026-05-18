/**
 * Segment-tag types shared across the tagging UI and server.
 *
 * Type-only module (no runtime code) so it is safe to import from both
 * `$lib/server` code and Svelte components.
 */

/** One segment's tag annotation, as stored in segment_tags.json. */
export type Annotation = {
	segment_id: string;
	interview_id: string;
	question_id: string | null;
	/** Emergent topic ids — set by the topic pipeline, not edited in the drawer. */
	topics: string[];
	themes: string[];
	subthemes: string[];
	emotions: string[];
	sentiment: number;
	semantic_tags: string[];
	confidence: number;
	source: string;
	review_status: string;
	reviewer_notes: string;
};

/** The minimal segment shape the tag drawer needs to render and save. */
export type TaggableSegment = {
	segment_id: string;
	interview_id: string;
	question_id: string | null;
	text: string;
	word_count: number;
	flags: string[];
	/** Character offsets into the raw transcript — shown in the tag drawer. */
	char_start?: number;
	char_end?: number;
};
