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

export type SlideTone = 'positive' | 'negative' | 'divisive' | 'neutral';

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
	| { kind: 'sphere-ring'; value: number };

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

/** Cover slide: project title + lead paragraph. No stat grid — the cover stays magazine-clean. */
export type OpeningSlide = {
	kind: 'opening';
	eyebrow: string;
	title: string;
	body: string;
};

/** A scene-setter slide: one big count, one caption. No drillable detail. */
export type ScopeSlide = {
	kind: 'scope';
	eyebrow: string;
	headline: string;
	value: number;
	label: string;
	body?: string;
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

export type Slide =
	| OpeningSlide
	| ScopeSlide
	| LeanSlide
	| HeroStatSlide
	| QuoteSlide
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
};
