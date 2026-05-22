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
import { Type, Quote as QuoteIcon, BarChart3, Cloud } from '@lucide/svelte';
import type { Component } from 'svelte';
import {
	annotations,
	themeFrequency,
	sentimentDistribution,
	fragmentsMatching,
	themeTags,
	titleCase,
	participantLabel,
	questionLabel,
	themedParticipantIds,
	themedQuestionIds,
	SENTIMENT_LABELS,
	type Annotation,
	type KeywordMatchContext
} from '$lib/content/wctglpdemo-data/analysis';
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

export const themeLabel = (id: string) => themeTags.find((t) => t.id === id)?.label ?? titleCase(id);

const THEME_PALETTE = ['#294457', '#7dbfa7', '#cc6324', '#446079', '#9b8bb4', '#c98a5e', '#5e9c8f', '#b0567f'];

export function sentimentColor(s: number): string {
	switch (s) {
		case -2: return '#b91c1c';
		case -1: return '#fb7185';
		case 1: return '#34d399';
		case 2: return '#059669';
		default: return '#94a3b8';
	}
}

// ---- Filter predicates ------------------------------------------------------

export function annPredFromFilters(f: BlockFilters): (a: Annotation) => boolean {
	return (a) => {
		if (f.participantId && a.interview_id !== f.participantId) return false;
		if (f.theme && !a.themes.includes(f.theme)) return false;
		if (f.sentiment != null && a.sentiment !== f.sentiment) return false;
		if (f.questionId && a.question_id !== f.questionId) return false;
		return true;
	};
}

export function matchPredFromFilters(f: BlockFilters): (m: KeywordMatchContext) => boolean {
	return (m) => {
		if (f.participantId && m.interview_id !== f.participantId) return false;
		if (f.questionId && (m.question_id ?? '') !== f.questionId) return false;
		return true;
	};
}

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
};

export const WIDGETS: WidgetDef[] = [
	{ id: 'richtext', label: 'Rich text', description: 'Headings, lists, links, highlights', icon: Type },
	{ id: 'quote', label: 'Patient quote', description: 'Pick a starred quote or write one', icon: QuoteIcon },
	{ id: 'distribution', label: 'Sentiment / Theme', description: 'Bar or donut distribution', icon: BarChart3 },
	{ id: 'wordcloud', label: 'Word cloud', description: 'Filtered word frequencies', icon: Cloud }
];

export const WIDGETS_BY_ID = new Map(WIDGETS.map((w) => [w.id, w]));

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
	}
}
