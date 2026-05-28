/**
 * Key Findings — block library + data builders.
 *
 * Only four block types are offered (rich text, patient quote, distribution,
 * word cloud). The registry (`WIDGETS`) is what the palette renders and what
 * drag-and-drop reads; `createBlock()` mints a *blank placeholder* for each
 * (non-text blocks are configured later from the right drawer).
 *
 * Distribution and word-cloud data derive from the bundled analysis helpers and
 * honour a shared `BlockFilters`, so the same filter dropdowns drive both.
 */
import {
	Type,
	Quote as QuoteIcon,
	BarChart3,
	Cloud,
	SquareSplitHorizontal,
	Sigma,
	MessageSquareQuote
} from '@lucide/svelte';
import type { Component } from 'svelte';
import {
	sentimentDistribution,
	fragmentsMatching,
	participantLabel,
	questionLabel,
	themedParticipantIds,
	themedQuestionIds,
	themeTags,
	SENTIMENT_LABELS
} from '$lib/content/wctglpdemo-data/analysis';
import { themeFrequency } from '$lib/content/wctglpdemo-data/analysis';
import { analyzeWords } from '$lib/content/wctglpdemo-data/word-frequency';
import type { WordCloudDatum } from '$lib/charts/glp/WordCloud.svelte';
import {
	newId,
	emptyFilters,
	type Block,
	type BlockKind,
	type BlockFilters,
	type DistMetric
} from './types';
import {
	annPredFromFilters,
	sentimentColor,
	themeLabel,
	THEME_PALETTE,
	type DataShape
} from './data-shapes';

// Re-export the shared helpers so existing callers (drawer, blocks) keep working
// after the move into data-shapes.ts.
export {
	annPredFromFilters,
	matchPredFromFilters,
	sentimentColor,
	themeLabel,
	THEME_PALETTE
} from './data-shapes';

// ---- Distribution data ------------------------------------------------------

export type DistDatum = { label: string; value: number; color: string };

/** A label/value/color series for the chosen metric, honouring the filters. */
export function buildDistribution(metric: DistMetric, filters: BlockFilters): DistDatum[] {
	const pred = annPredFromFilters(filters);
	if (metric === 'sentiment') {
		return sentimentDistribution(pred).map((d) => ({
			label: SENTIMENT_LABELS[d.value],
			value: d.count,
			color: sentimentColor(d.value)
		}));
	}
	return themeFrequency(pred)
		.slice(0, 8)
		.map((t, i) => ({
			label: themeLabel(t.id),
			value: t.count,
			color: THEME_PALETTE[i % THEME_PALETTE.length]
		}));
}

// ---- Word cloud data --------------------------------------------------------

export type WordCloudPreset = { id: string; label: string; apply: (f: BlockFilters) => BlockFilters };

export const WORDCLOUD_PRESETS: WordCloudPreset[] = [
	{ id: 'overall', label: 'All words', apply: (f) => ({ ...f, sentiment: null }) },
	{ id: 'positive', label: 'Positive moments', apply: (f) => ({ ...f, sentiment: 2 }) },
	{ id: 'negative', label: 'Pain points', apply: (f) => ({ ...f, sentiment: -2 }) }
];

/** Tokenise the segments matching the filters and rank the words. Because it
 *  runs over filtered annotated segments, theme / sentiment / persona /
 *  question filters all take effect. */
export function buildWordCloud(filters: BlockFilters, limit = 90): WordCloudDatum[] {
	const frags = fragmentsMatching(annPredFromFilters(filters));
	const scoped = frags.map((f) => ({ text: f.text, sentiment: f.sentiment }));
	const { words } = analyzeWords(scoped, { limit });
	return words.map((w) => ({ text: w.text, value: w.value, sentiment: w.sentiment }));
}

// ---- Filter option lists (for the drawer dropdowns) -------------------------

export const PERSONA_OPTIONS = themedParticipantIds.map((id) => ({ id, label: participantLabel(id) }));
export const THEME_OPTIONS = themeTags.map((t) => ({ id: t.id, label: themeLabel(t.id) }));
export const QUESTION_OPTIONS = themedQuestionIds.map((id) => ({ id, label: questionLabel(id) }));
export const SENTIMENT_OPTIONS = [2, 1, 0, -1, -2].map((v) => ({ id: String(v), value: v, label: SENTIMENT_LABELS[v] }));

// ---- Registry ---------------------------------------------------------------

export type WidgetDef = {
	id: BlockKind;
	label: string;
	description: string;
	icon: Component;
	/**
	 * Data shapes this widget renders. A widget that lists 'cohort' here can be
	 * fed by any builder that returns a Cohort — that's what lets one component
	 * cover many datasets and what makes the library scale.
	 */
	accepts: DataShape[];
	/** Group used by the palette UI to cluster related widgets. */
	family: 'text' | 'quote' | 'distribution' | 'comparison' | 'tokens';
	/** True if the widget renders the same artwork better when the card is wide. */
	preferLandscape?: boolean;
};

export const WIDGETS: WidgetDef[] = [
	{
		id: 'richtext',
		label: 'Rich text',
		description: 'Headings, lists, links, highlights',
		icon: Type,
		accepts: [],
		family: 'text'
	},
	{
		id: 'quote',
		label: 'Patient quote',
		description: 'Pick a starred quote or write one',
		icon: QuoteIcon,
		accepts: ['quote'],
		family: 'quote'
	},
	{
		id: 'distribution',
		label: 'Sentiment / Theme',
		description: 'Bar or donut distribution',
		icon: BarChart3,
		accepts: ['series'],
		family: 'distribution'
	},
	{
		id: 'wordcloud',
		label: 'Word cloud',
		description: 'Filtered word frequencies',
		icon: Cloud,
		accepts: ['tokenCloud'],
		family: 'tokens'
	},
	{
		id: 'comparison',
		label: 'Comparison',
		description: 'Two cohorts, big numbers side by side',
		icon: SquareSplitHorizontal,
		accepts: ['cohort'],
		family: 'comparison',
		preferLandscape: true
	},
	{
		id: 'herostat',
		label: 'Hero stat',
		description: 'Big number with a one-line story',
		icon: Sigma,
		accepts: ['cohort'],
		family: 'comparison'
	},
	{
		id: 'quotepull',
		label: 'Quote pull',
		description: 'Poster-format quote, ready to share',
		icon: MessageSquareQuote,
		accepts: ['quote'],
		family: 'quote'
	}
];

export const WIDGETS_BY_ID = new Map(WIDGETS.map((w) => [w.id, w]));

/** Widgets grouped by data shape — used by the gallery panel as it grows. */
export function widgetsForShape(shape: DataShape): WidgetDef[] {
	return WIDGETS.filter((w) => w.accepts.includes(shape));
}

/** Mint a blank block for the given kind. Non-text blocks start unconfigured. */
export function createBlock(kind: BlockKind): Block {
	switch (kind) {
		case 'richtext':
			return { id: newId('blk'), kind: 'richtext', html: '<p></p>', fontScale: 1 };
		case 'quote':
			return {
				id: newId('blk'),
				kind: 'quote',
				configured: false,
				quoteId: null,
				text: '',
				sentiment: 0,
				interviewId: '',
				questionId: '',
				themes: [],
				attribution: '',
				persona: '',
				role: '',
				source: '',
				layout: 'pull',
				reveal: 'none',
				fontScale: 1,
				filters: emptyFilters()
			};
		case 'distribution':
			return {
				id: newId('blk'),
				kind: 'distribution',
				configured: false,
				chartType: 'bar',
				metric: 'sentiment',
				title: '',
				caption: '',
				filters: emptyFilters()
			};
		case 'wordcloud':
			return {
				id: newId('blk'),
				kind: 'wordcloud',
				configured: false,
				preset: 'overall',
				title: '',
				caption: '',
				filters: emptyFilters()
			};
		case 'comparison':
			return {
				id: newId('blk'),
				kind: 'comparison',
				configured: false,
				left: { kind: 'custom', label: 'Group A', value: 0, unit: '%', color: THEME_PALETTE[0] },
				right: { kind: 'custom', label: 'Group B', value: 0, unit: '%', color: THEME_PALETTE[2] },
				micro: 'topThemes',
				layout: 'split',
				title: '',
				caption: ''
			};
		case 'herostat':
			return {
				id: newId('blk'),
				kind: 'herostat',
				configured: false,
				cohort: { kind: 'custom', label: 'Subject', value: 0, unit: '%', caption: 'METRIC', color: THEME_PALETTE[0] },
				micro: 'topThemes',
				layout: 'centered',
				title: '',
				caption: ''
			};
		case 'quotepull':
			return {
				id: newId('blk'),
				kind: 'quotepull',
				configured: false,
				text: '',
				attribution: '',
				context: '',
				themeLabel: '',
				sentiment: 0,
				accentColor: THEME_PALETTE[1],
				background: 'light',
				reveal: 'fade',
				fontScale: 1
			};
	}
}
