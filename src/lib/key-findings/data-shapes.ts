/**
 * Data-shape contracts for the Key Findings widget library.
 *
 * Every visual widget in the library is parameterised by the *shape* of data it
 * consumes — not by the dataset it was first wired up to. The six shapes below
 * are the lingua franca that lets one widget render any dataset that produces a
 * compatible shape, and lets a single dataset feed multiple widgets.
 *
 * Widgets declare which shapes they accept via `WidgetDef.accepts`. The builder
 * functions here adapt analysis helpers + `BlockFilters` to the shape types,
 * and are the only place that knows how a research corpus maps onto a shape.
 *
 * Shape types are deliberately plain JSON: widgets must stay round-trippable
 * through the localStorage board state, and the same shapes will be reused for
 * server-side export rendering down the road.
 */
import {
	annotations,
	themeTags,
	titleCase,
	SENTIMENT_LABELS,
	type Annotation,
	type KeywordMatchContext
} from '$lib/content/wctglpdemo-data/analysis';
import type { BlockFilters } from './types';

// ---- Shape catalogue --------------------------------------------------------

export type DataShape =
	| 'series' // label/value list (bars, donuts, top-N, sparkline)
	| 'matrix' // row × col cells (heatmaps)
	| 'flow' // directed source→target value (sankey, chord)
	| 'cohort' // one subject with a hero metric + optional micro-viz
	| 'quote' // one quote with attribution + tags
	| 'tokenCloud'; // weighted tokens (wordclouds, lexicon)

/** Human label for the data-shape pickers in the authoring UI. */
export const SHAPE_LABEL: Record<DataShape, string> = {
	series: 'Series',
	matrix: 'Matrix',
	flow: 'Flow',
	cohort: 'Cohort',
	quote: 'Quote',
	tokenCloud: 'Token cloud'
};

// ---- Shape types ------------------------------------------------------------

export type SeriesDatum = {
	label: string;
	value: number;
	color?: string;
	/** -2..2 when the series is sentiment-aware; omitted otherwise. */
	sentiment?: number;
};
export type Series = SeriesDatum[];

export type MatrixCell = { row: string; col: string; value: number; color?: string };
export type Matrix = { rows: string[]; cols: string[]; cells: MatrixCell[] };

export type FlowEdge = { source: string; target: string; value: number; color?: string };
export type Flow = FlowEdge[];

/**
 * One self-contained subject — the unit a comparison or hero-stat card renders.
 * The big-number visual is `(value, unit)`; `micro` is an optional supporting
 * series (e.g. top-3 themes shown as bubbles, or a sentiment microbar).
 */
export type Cohort = {
	/** Subject name shown above the big number (e.g. "Newly diagnosed"). */
	label: string;
	/** Optional small line under the label (e.g. "of 12 participants"). */
	sublabel?: string;
	value: number;
	/** Display suffix appended to the value (e.g. '%', 'M', 'mentions'). */
	unit?: string;
	/** Accent / brand colour for this cohort, hex. */
	color?: string;
	/** Caption shown under the big number, often a metric name. */
	caption?: string;
	/** Tiny supporting series — typically 1–6 marks. */
	micro?: Series;
};

/**
 * How a cohort is sourced. `custom` is hand-typed (marketing-style cards), the
 * others derive from the corpus via the matching filter predicate.
 */
export type CohortSpec =
	| {
			kind: 'custom';
			label: string;
			sublabel?: string;
			value: number;
			unit?: string;
			caption?: string;
			color?: string;
	  }
	| { kind: 'theme'; themeId: string; label?: string; color?: string; filters: BlockFilters }
	| {
			kind: 'sentiment';
			sentimentBucket: -2 | -1 | 0 | 1 | 2;
			label?: string;
			color?: string;
			filters: BlockFilters;
	  };

export type QuoteDatum = {
	text: string;
	sentiment: number;
	attribution?: string;
	themes?: string[];
};

export type TokenDatum = { token: string; weight: number; sentiment?: number };
export type TokenCloud = TokenDatum[];

// ---- Shared colour + label helpers -----------------------------------------
//
// These live here (rather than in widgets.ts) because every shape builder needs
// them; placing them in widgets.ts would create a cycle once widgets.ts imports
// DataShape back from this file.

export const THEME_PALETTE = [
	'#294457',
	'#7dbfa7',
	'#cc6324',
	'#446079',
	'#9b8bb4',
	'#c98a5e',
	'#5e9c8f',
	'#b0567f'
];

export function sentimentColor(s: number): string {
	switch (s) {
		case -2:
			return '#b91c1c';
		case -1:
			return '#fb7185';
		case 1:
			return '#34d399';
		case 2:
			return '#059669';
		default:
			return '#94a3b8';
	}
}

export const themeLabel = (id: string) =>
	themeTags.find((t) => t.id === id)?.label ?? titleCase(id);

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

// ---- Shape builders ---------------------------------------------------------

/** Reduce a filtered slice of the corpus to (top-K themes) as a Series. */
export function topThemesAsSeries(
	pred: (a: Annotation) => boolean,
	palette: string[] = THEME_PALETTE,
	limit = 3
): Series {
	const counts = new Map<string, number>();
	for (const a of annotations.filter(pred)) {
		for (const t of a.themes) counts.set(t, (counts.get(t) ?? 0) + 1);
	}
	return [...counts.entries()]
		.sort((a, b) => b[1] - a[1])
		.slice(0, limit)
		.map(([id, count], i) => ({
			label: themeLabel(id),
			value: count,
			color: palette[i % palette.length]
		}));
}

/** Reduce a filtered slice of the corpus to a 5-band sentiment Series. */
export function sentimentMicroSeries(pred: (a: Annotation) => boolean): Series {
	const counts = new Map<number, number>([
		[-2, 0],
		[-1, 0],
		[0, 0],
		[1, 0],
		[2, 0]
	]);
	for (const a of annotations.filter(pred)) {
		counts.set(a.sentiment, (counts.get(a.sentiment) ?? 0) + 1);
	}
	return [...counts.entries()].map(([s, count]) => ({
		label: SENTIMENT_LABELS[s] ?? String(s),
		value: count,
		color: sentimentColor(s),
		sentiment: s
	}));
}

/**
 * Build a Cohort from a spec. `custom` cohorts pass through; corpus-derived
 * cohorts compute value = matching-annotation count, fill in sublabel + micro.
 */
export function buildCohort(
	spec: CohortSpec,
	palette: string[] = THEME_PALETTE,
	microKind: 'topThemes' | 'sentiment' | 'none' = 'topThemes'
): Cohort {
	if (spec.kind === 'custom') {
		return {
			label: spec.label,
			sublabel: spec.sublabel,
			value: spec.value,
			unit: spec.unit,
			caption: spec.caption,
			color: spec.color
		};
	}

	if (spec.kind === 'theme') {
		const filtersWithTheme: BlockFilters = { ...spec.filters, theme: spec.themeId };
		const pred = annPredFromFilters(filtersWithTheme);
		const matched = annotations.filter(pred);
		const total = annotations.length || 1;
		return {
			label: spec.label ?? themeLabel(spec.themeId),
			sublabel: `${Math.round((matched.length / total) * 100)}% of ${total} moments`,
			value: matched.length,
			unit: '',
			caption: 'mentions',
			color: spec.color,
			micro:
				microKind === 'none'
					? undefined
					: microKind === 'sentiment'
						? sentimentMicroSeries(pred)
						: topThemesAsSeries((a) => pred(a) && !a.themes.includes(spec.themeId), palette, 3)
		};
	}

	const filtersWithSentiment: BlockFilters = { ...spec.filters, sentiment: spec.sentimentBucket };
	const pred = annPredFromFilters(filtersWithSentiment);
	const matched = annotations.filter(pred);
	return {
		label: spec.label ?? (SENTIMENT_LABELS[spec.sentimentBucket] ?? 'Sentiment'),
		sublabel: `${matched.length} moments`,
		value: matched.length,
		unit: '',
		caption: 'tagged',
		color: spec.color ?? sentimentColor(spec.sentimentBucket),
		micro:
			microKind === 'none'
				? undefined
				: microKind === 'sentiment'
					? sentimentMicroSeries(pred)
					: topThemesAsSeries(pred, palette, 3)
	};
}
