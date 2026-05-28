/**
 * Key Findings — data model.
 *
 * A board is an ordered list of cards laid out in a responsive grid. Each card
 * is sized to one of two presets (square / landscape) and holds an ordered list
 * of content blocks. Blocks are a discriminated union limited to four approved
 * types: rich text, patient quote, sentiment/theme distribution, and word
 * cloud. Non-text blocks start as blank placeholders (`configured: false`) and
 * are set up from the contextual right drawer.
 *
 * The whole model is plain JSON: it round-trips through localStorage and is
 * cloned for undo/redo, so every field must stay serialisable.
 */

/** Shared filter state for data-driven blocks (distribution, word cloud).
 *  Only the fields a block's drawer exposes are used; the rest stay null. */
export type BlockFilters = {
	participantId: string | null;
	theme: string | null;
	/** -2..2, or null for all. */
	sentiment: number | null;
	questionId: string | null;
	source: string | null;
	role: string | null;
	dateFrom: string | null;
	dateTo: string | null;
};

export function emptyFilters(): BlockFilters {
	return {
		participantId: null,
		theme: null,
		sentiment: null,
		questionId: null,
		source: null,
		role: null,
		dateFrom: null,
		dateTo: null
	};
}

export type RichTextBlock = {
	id: string;
	kind: 'richtext';
	/** Serialised TipTap/ProseMirror HTML. */
	html: string;
	/** Font-size multiplier (1 = default), adjusted with the A−/A+ controls. */
	fontScale?: number;
};

export type QuoteReveal = 'none' | 'fade' | 'typewriter' | 'word';
export type QuoteLayout = 'pull' | 'card' | 'banner';

export type QuoteBlock = {
	id: string;
	kind: 'quote';
	/** False until a quote is chosen or written; drives the placeholder state. */
	configured: boolean;
	/** quote_bank id when sourced from the bank; null for a hand-written quote. */
	quoteId: string | null;
	text: string;
	sentiment: number;
	interviewId: string;
	questionId: string;
	themes: string[];
	/** Free-text attribution fields the analyst can override. */
	attribution: string;
	persona: string;
	role: string;
	source: string;
	layout: QuoteLayout;
	reveal: QuoteReveal;
	/** Font-size multiplier (1 = default), adjusted with the A−/A+ controls. */
	fontScale?: number;
	/** Filters that narrow the quote picker list in the drawer. */
	filters: BlockFilters;
};

export type DistChartType = 'bar' | 'donut' | 'semi-arc';
export type DistMetric = 'sentiment' | 'theme';

export type DistributionBlock = {
	id: string;
	kind: 'distribution';
	configured: boolean;
	chartType: DistChartType;
	metric: DistMetric;
	title: string;
	caption: string;
	filters: BlockFilters;
};

export type WordCloudBlock = {
	id: string;
	kind: 'wordcloud';
	configured: boolean;
	/** Preset id from widgets.ts (e.g. 'overall', 'positive'). */
	preset: string;
	title: string;
	caption: string;
	filters: BlockFilters;
};

/**
 * ComparisonBlock — two cohorts shown side by side, big-number-first.
 *
 * Inspired by the "Chile vs Germany" share format: one subject per side, a
 * dominant hero metric, a small supporting micro-viz, and a brand-coloured
 * accent. Each side is described by a CohortSpec serialised inline so the
 * board stays JSON-only (the live Cohort is rebuilt by `buildCohort` at
 * render time).
 *
 * Spec lives in `data-shapes.ts` as `CohortSpec` — re-imported as a plain
 * JSON-safe object here. We don't import the type to keep types.ts free of
 * downstream dependencies; the renderer re-asserts the shape.
 */
export type CohortSpecJSON =
	| { kind: 'custom'; label: string; sublabel?: string; value: number; unit?: string; caption?: string; color?: string }
	| { kind: 'theme'; themeId: string; label?: string; color?: string; filters: BlockFilters }
	| { kind: 'sentiment'; sentimentBucket: -2 | -1 | 0 | 1 | 2; label?: string; color?: string; filters: BlockFilters };

export type ComparisonMicroKind = 'topThemes' | 'sentiment' | 'none';
export type ComparisonLayout = 'split' | 'stacked';

export type ComparisonBlock = {
	id: string;
	kind: 'comparison';
	configured: boolean;
	left: CohortSpecJSON;
	right: CohortSpecJSON;
	micro: ComparisonMicroKind;
	layout: ComparisonLayout;
	title: string;
	caption: string;
};

/**
 * HeroStatBlock — single-cohort hero-metric poster.
 *
 * The library's most-used shape: one subject, one big number, one optional
 * micro-viz. Reuses `CohortSpecJSON` so the same custom/theme/sentiment
 * sourcing applies. Layout swaps between number-centered (square posters) and
 * corner-anchored (label top-left, number bottom-right) for variety.
 */
export type HeroStatMicro = 'topThemes' | 'sentiment' | 'none';
export type HeroStatLayout = 'centered' | 'corner';

export type HeroStatBlock = {
	id: string;
	kind: 'herostat';
	configured: boolean;
	cohort: CohortSpecJSON;
	micro: HeroStatMicro;
	layout: HeroStatLayout;
	title: string;
	caption: string;
};

/**
 * QuotePullBlock — a poster-format quote, optimised for square LinkedIn export.
 *
 * Distinct from `QuoteBlock`: that one is a corpus-aware picker with rich
 * attribution. This one is a paste-and-style poster — the analyst already has
 * the text and wants a bold, brand-coloured artwork. Background, accent, and
 * reveal animation are first-class so it can be re-themed without re-typing.
 */
export type QuotePullBackground = 'light' | 'dark' | 'accent';
export type QuotePullReveal = 'none' | 'fade' | 'word' | 'typewriter';

export type QuotePullBlock = {
	id: string;
	kind: 'quotepull';
	configured: boolean;
	text: string;
	attribution: string;
	context: string;
	themeLabel: string;
	/** -2..2; drives the small sentiment dot. */
	sentiment: number;
	accentColor: string;
	background: QuotePullBackground;
	reveal: QuotePullReveal;
	fontScale: number;
};

export type Block =
	| RichTextBlock
	| QuoteBlock
	| DistributionBlock
	| WordCloudBlock
	| ComparisonBlock
	| HeroStatBlock
	| QuotePullBlock;
export type BlockKind = Block['kind'];

/** Block kinds whose configuration happens in the right drawer (not inline). */
export const DRAWER_KINDS: BlockKind[] = [
	'quote',
	'distribution',
	'wordcloud',
	'comparison',
	'herostat',
	'quotepull'
];

export type Priority = 'none' | 'low' | 'medium' | 'high';
export type CardSize = 'square' | 'landscape';

export type CardAnimation = {
	mode: 'static' | 'animated';
	loop: boolean;
};

export type Card = {
	id: string;
	title: string;
	blocks: Block[];
	/** Layout preset — square (1 grid column) or landscape (2 columns). */
	size: CardSize;
	tags: string[];
	category: string;
	priority: Priority;
	animation: CardAnimation;
};

export type Board = {
	version: 2;
	title: string;
	cards: Card[];
};

export const PRIORITIES: Priority[] = ['none', 'low', 'medium', 'high'];

export const PRIORITY_META: Record<Priority, { label: string; dot: string }> = {
	none: { label: 'No priority', dot: 'bg-slate-300' },
	low: { label: 'Low', dot: 'bg-sky-400' },
	medium: { label: 'Medium', dot: 'bg-amber-400' },
	high: { label: 'High', dot: 'bg-rose-500' }
};

/** CSS for each size preset: grid span + aspect ratio (grows for tall content). */
export const SIZE_META: Record<CardSize, { label: string; spanClass: string; aspect: string }> = {
	square: { label: 'Square', spanClass: '', aspect: '1 / 1' },
	landscape: { label: 'Landscape', spanClass: 'md:col-span-2', aspect: '16 / 10' }
};

let idSeq = 0;
export function newId(prefix = 'kf'): string {
	idSeq += 1;
	return `${prefix}_${Date.now().toString(36)}_${idSeq.toString(36)}`;
}

export function emptyBoard(): Board {
	return { version: 2, title: 'Key Findings', cards: [] };
}

export function blankCard(overrides: Partial<Card> = {}): Card {
	return {
		id: newId('card'),
		title: '',
		blocks: [],
		size: 'square',
		tags: [],
		category: '',
		priority: 'none',
		animation: { mode: 'static', loop: false },
		...overrides
	};
}
