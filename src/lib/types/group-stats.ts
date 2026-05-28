/**
 * GroupStats — neutral type shared by every page that opens the stacked
 * stats drawer (GroupStatsDrawer). The wctglpdemo data pipeline computes it
 * via lexicon-stats.ts; the journey-workbench page computes it ad-hoc over
 * its active corpus annotations. Same shape, same drawer.
 */

export type GroupKind = 'keyword' | 'theme' | 'subtheme';

export type GroupStats = {
	kind: GroupKind;
	id: string;
	label: string;
	/** A keyword's category, a theme's codebook description, or a subtheme's
	 *  parent theme — surfaced as the drawer subtitle. */
	context: string;
	/** Headline count and the unit it is measured in. */
	invocations: number;
	invocationUnit: string;
	segmentCount: number;
	participantCount: number;
	/** Sentiment -2..2 distribution across the annotated speech. */
	sentiment: { value: number; label: string; count: number }[];
	avgSentiment: number | null;
	emotions: { id: string; label: string; count: number }[];
	/** Themes the group co-occurs with (keyword) or is co-tagged with (theme/subtheme). */
	relatedThemes: { id: string; label: string; count: number }[];
	/** Most common content words in the group's segments (stoplist applied). */
	commonWords: { word: string; count: number }[];
	perParticipant: { interviewId: string; label: string; count: number }[];
};
