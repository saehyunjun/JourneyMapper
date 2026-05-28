/**
 * Slide model for the Executive Summary story mode.
 *
 * A discriminated union of editorial slide types. Every slide carries a
 * single focal data point; deeper evidence (driver clusters, sub-themes,
 * tagged quotes) lives in an optional `detail` payload that the host can
 * render in a side drawer when the user clicks an inline link-button or
 * an explicit "view details" CTA.
 */
import type {
	Finding,
	SummaryQuote
} from '$lib/content/wctglpdemo-data/executive-summary';
import type { ThemeFragment } from '$lib/content/wctglpdemo-data/analysis';
import type { ParticipantProfile } from '$lib/types/participant-profile';
import type { RadialFlowTheme } from '$lib/charts/glp/RadialImpactFlow.types';
import type { SearchInterviewAlignment } from '$lib/content/wctglpdemo-data/search-interview-alignment';
import type { TopicAlignment } from '$lib/content/wctglpdemo-data/topic-alignment';

export type SlideTone = 'positive' | 'negative' | 'divisive' | 'neutral';

/**
 * 5-band sentiment bucket — keys are stringified -2..+2 scores. Matches the
 * SENTIMENT_COLORS palettes used across the chart components.
 */
export type SentimentBucket = '-2' | '-1' | '0' | '1' | '2';

/**
 * What the persistent corpus dot-grid should show on a given slide. The
 * grid stays mounted across slide transitions and morphs in place; slides
 * that participate declare a spec rather than rendering their own viz.
 *
 *   uniform   — every dot the same color (scope scene-setter)
 *   sentiment — dots distributed across the 5-band palette by raw counts
 *   highlight — a subset of dot indices lit in a focus color, rest fade
 *               back; the "pull a sub-theme out of the corpus" mode
 */
export type CorpusVizSpec =
	| { mode: 'uniform'; color: string }
	| { mode: 'sentiment'; counts: Record<SentimentBucket, number> }
	| { mode: 'highlight'; matchingIndices: Set<number>; highlightColor: string; baseColor: string };

/** A small stat — only used internally by the assembler; not surfaced on a slide. */
export type StoryStat = { value: number; label: string };

/** The terminal "go deeper" links — mirrors the in-page explore cards. */
export type StoryExploreLink = { href: string; title: string; blurb: string };

/** Support visualization for a hero-stat slide. One viz per slide. */
export type HeroSupport =
	| { kind: 'none' }
	| { kind: 'ring'; value: number; total: number; tone: SlideTone }
	| { kind: 'waffle'; value: number; total: number; tone: SlideTone }
	/**
	 * Sphere-in-ring composition. Owns its own % display, so the slide
	 * template suppresses its big-figure block when this kind is used.
	 */
	| { kind: 'sphere-ring'; value: number }
	/**
	 * Constellation: a transparent outlined "container" ring whose size
	 * reads as the total denominator, with N (typically 2–4) colored
	 * bubbles packed inside representing the top drivers. The ring and the
	 * bubbles animate in sequentially on slide enter.
	 */
	| { kind: 'bubble-cluster'; total: number; tone: SlideTone; bubbles: BubbleSpec[] };

/** One bubble inside a cluster stage. */
export type BubbleSpec = {
	id: string;
	label: string;
	value: number;
	color?: string;
	opacity?: number;
	primary?: boolean;
};

/**
 * One row of supporting evidence — a named driver (cluster, sub-theme,
 * keyword) with its own sentiment breakdown. Drivers live in the detail
 * drawer, not on the slide itself.
 */
export type Driver = {
	label: string;
	positive: number;
	neutral: number;
	negative: number;
};

/** One labelled group of drivers in the detail drawer. */
export type DetailSection = {
	label: string;
	tone?: SlideTone;
	drivers: Driver[];
};

/**
 * What a slide hands to the detail drawer when its link-button or CTA fires.
 * The drawer renders header (eyebrow + headline + summary) → driver sections
 * → optional list of tagged quotes (CodedFragmentCard).
 */
export type SlideDetail = {
	eyebrow: string;
	headline: string;
	summary: string;
	sections: DetailSection[];
	fragments?: ThemeFragment[];
};

/**
 * Generative poster spec — the IndicationPoster's flattened prop bag, derived
 * once by the assembler from the indication's corpus telemetry. Stays small
 * (primitives + short arrays) so it can serialize through slide payloads.
 */
export type PosterAnchor = {
	id: string;
	quote?: string;
	sentiment?: number;
	themes?: string[];
	participant?: string;
};

export type PosterSpec = {
	totalQuotes: number;
	posPct: number;
	negPct: number;
	neutralPct: number;
	themeSizes: number[];
	interviewAnchors: PosterAnchor[];
	sentimentTimeline: number[];
	seed: number;
	variant: 'default' | 'warm' | 'cool';
};

/** Cover slide: project title + lead paragraph. No stat grid — the cover stays magazine-clean. */
export type OpeningSlide = {
	kind: 'opening';
	eyebrow: string;
	title: string;
	body: string;
	/** Generative background poster — animates in behind the title text. */
	poster?: PosterSpec;
};

/** A scene-setter slide: one big count, one caption. No drillable detail. */
export type ScopeSlide = {
	kind: 'scope';
	eyebrow: string;
	headline: string;
	value: number;
	label: string;
	body?: string;
	/**
	 * If present, the slide hands its visual region over to the persistent
	 * corpus grid. The slide template skips its own DotGrid and only renders
	 * the caption beneath where the shared grid sits.
	 */
	viz?: CorpusVizSpec;
};

/**
 * Recolor slide: piggybacks on the persistent corpus grid to morph the same
 * dots into a new color story (sentiment distribution, sub-theme highlight,
 * etc.). The slide carries only narrative — the grid lives in the shell.
 *
 * Headlines on recolor slides should be at sub-theme or sub-population
 * granularity. Corpus-wide claims ("the corpus runs positive") are too
 * broad to read as an insight and belong in the executive summary text, not
 * a slide.
 */
export type RecolorSlide = {
	kind: 'recolor';
	eyebrow: string;
	headline: string;
	body: string;
	/** Substring of `body` to render as an inline link-button. */
	bodyHighlight?: string;
	total: number;
	viz: CorpusVizSpec;
	/** Caption rendered under the grid (e.g. legend text). */
	caption?: string;
	detail?: SlideDetail;
};

/** Sentiment lean as a single percent. Detail surfaces pos/neg driver clusters. */
export type LeanSlide = {
	kind: 'lean';
	eyebrow: string;
	headline: string;
	body: string;
	/** Substring of `body` to render as an inline link-button that opens the drawer. */
	bodyHighlight?: string;
	value: number;
	tone: SlideTone;
	total: number;
	detail?: SlideDetail;
};

/** A hero-stat slide: one dominant number + headline + optional single-value viz. */
export type HeroStatSlide = {
	kind: 'hero-stat';
	eyebrow: string;
	stat: { value: string; caption: string };
	headline: string;
	body: string;
	/** Substring of `body` to render as an inline link-button that opens the drawer. */
	bodyHighlight?: string;
	tone: SlideTone;
	support: HeroSupport;
	detail?: SlideDetail;
};

/** A patient-voice slide — large editorial quote, attributed. */
export type QuoteSlide = {
	kind: 'quote';
	eyebrow: string;
	quote: SummaryQuote;
};

/** Terminal closing slide — narrative tee-up to the deeper views. */
export type ClosingSlide = {
	kind: 'closing';
	eyebrow: string;
	headline: string;
	body: string;
	links: StoryExploreLink[];
};

/**
 * Radial impact-flow slide — full-bleed hub-and-cluster map of every theme
 * and subtheme in the corpus. The slide owns its own hover/select state; the
 * deck does not open the side drawer from it.
 */
export type FlowSlide = {
	kind: 'flow';
	eyebrow: string;
	headline: string;
	total: number;
	themes: RadialFlowTheme[];
};

/** One row in the per-theme sentiment-bar small-multiples. */
export type ThemeSentimentRow = {
	themeId: string;
	themeLabel: string;
	total: number;
	counts: Record<SentimentBucket, number>;
	posPct: number;
	negPct: number;
};

/**
 * Per-theme sentiment small-multiples slide. Surfaces the spread that the
 * corpus-wide recolor hides — Treatment vs. Clinical Trials vs. Condition
 * almost always skew differently. One mini stacked-bar per theme.
 */
export type ThemeSentimentSlide = {
	kind: 'theme-sentiment';
	eyebrow: string;
	headline: string;
	body: string;
	bodyHighlight?: string;
	rows: ThemeSentimentRow[];
	detail?: SlideDetail;
};

/** One top-level burden category with rolled-up tag count. */
export type BurdenSlice = {
	id: string;
	label: string;
	count: number;
	/** Share of tagged moments touching this burden (0..1). May sum >1 since one
	 *  tag can touch multiple burden categories. */
	share: number;
};

/**
 * Burden-category split slide — surfaces the orthogonal axis the theme tree
 * doesn't show. Horizontal bar list, top-level burden categories ranked.
 */
export type BurdenSlide = {
	kind: 'burden-split';
	eyebrow: string;
	headline: string;
	body: string;
	bodyHighlight?: string;
	totalTagged: number;
	slices: BurdenSlice[];
};

/**
 * Search-vs-interview 1:1 slide — treatment-name alignment between the
 * search-volume signal and the interview-cluster signal. Renders the
 * existing SearchInterviewAlignment component inside the StorySlide grid.
 * Only emitted by the assembler when the host page passes alignment data.
 */
export type SearchAlignmentSlide = {
	kind: 'search-alignment';
	eyebrow: string;
	headline: string;
	body: string;
	bodyHighlight?: string;
	data: SearchInterviewAlignment;
};

/**
 * Topic-level search-vs-interview slide — categorical mirror chart that
 * rolls both signals up to the canonical topic categories (treatments,
 * symptoms, side effects, etc.). Companion to SearchAlignmentSlide; the
 * 1:1 view answers "do specific treatments match," this answers "do the
 * conversation areas match."
 */
export type TopicAlignmentSlide = {
	kind: 'topic-alignment';
	eyebrow: string;
	headline: string;
	body: string;
	bodyHighlight?: string;
	data: TopicAlignment;
};

export type Slide =
	| OpeningSlide
	| ScopeSlide
	| RecolorSlide
	| LeanSlide
	| HeroStatSlide
	| QuoteSlide
	| FlowSlide
	| ThemeSentimentSlide
	| BurdenSlide
	| SearchAlignmentSlide
	| TopicAlignmentSlide
	| ClosingSlide;

/** The minimal data shape the assembler needs from the host page. */
export type StoryInput = {
	title: string;
	summaryText: string;
	stats: StoryStat[];
	sentimentLean: {
		positive: number;
		neutral: number;
		negative: number;
		posPct: number;
		neutralPct: number;
		negPct: number;
		total: number;
		lean: 'positive' | 'negative' | 'mixed';
	};
	themes: {
		id: string;
		label: string;
		blocks: { sentiment: number }[];
		subthemes?: { id: string; label: string; blocks: { sentiment: number }[] }[];
	}[];
	findings: Finding[];
	explore: StoryExploreLink[];
	profiles: Record<string, ParticipantProfile>;
	/**
	 * Optional patient-burden breakdown — top-level burden categories ranked
	 * by count, rolled up from cluster occurrences via the burden taxonomy.
	 * When absent or empty, the assembler skips the burden-split slide.
	 */
	burdens?: {
		slices: BurdenSlice[];
		totalMentions: number;
	};
	/**
	 * Optional search-vs-interview alignment payload — one-to-one + categorical.
	 * Indication-scoped (currently only lupus_nephritis has both sides wired up).
	 * The host page populates this when the active indication has the data;
	 * the assembler emits the two alignment slides if either field is present.
	 */
	alignment?: {
		oneToOne?: SearchInterviewAlignment;
		topical?: TopicAlignment;
	};
	/**
	 * Optional indication identity — used to seed the generative poster on the
	 * opening slide so the same indication always cuts the same composition,
	 * and to pick the warm/cool background tint.
	 */
	posterSeed?: number;
	posterVariant?: 'default' | 'warm' | 'cool';
	posterAnchors?: PosterAnchor[];
};
