/**
 * analysis-keywords.ts
 *
 * Split out from analysis.ts because keyword_usage.json is 730 KB — the
 * single heaviest JSON in the wctglpdemo dataset. Keeping it in the main
 * analysis aggregator forced every route that imported anything from
 * analysis.ts (~40 files) to pay for the full keyword payload, blowing the
 * shared chunk to ~492 KB.
 *
 * Now keyword_usage.json is only bundled into chunks that actually need it
 * (the three radial/keyword routes + ThemeConstellation). Routes that just
 * need title-case helpers or the codebook get a leaner analysis.ts chunk.
 *
 * Depends on analysis.ts for: the codebook joins (themeBreakdown, themeTags,
 * subthemeLabel, titleCase) and the lookup maps over the lighter source data
 * (segmentById, annotationBySegment, quoteBySegment). One-way dependency —
 * analysis.ts knows nothing about this file at runtime (it only re-exports
 * the public types).
 */
import keywordUsageRaw from './keyword_usage.json';
import {
	type Annotation,
	type ThemeBlock,
	type ThemeFragment,
	annotationBySegment,
	quoteBySegment,
	segmentById,
	subthemeLabel,
	themeBreakdown,
	themeTags,
	titleCase
} from './analysis';

type KeywordUsageMatch = {
	segment_id: string;
	interview_id: string;
	question_id: string | null;
	text?: string;
	char_start?: number;
	char_end?: number;
};
type KeywordUsageCluster = {
	id: string;
	label: string;
	parent_theme?: string;
	parent_subtheme?: string;
	count: number;
	matches: KeywordUsageMatch[];
};
type KeywordUsage = { clusters: KeywordUsageCluster[] };

const keywordUsage = keywordUsageRaw as unknown as KeywordUsage;

/** Match context handed to keyword predicates — what every cluster match
 *  carries that callers can filter on. */
export type KeywordMatchContext = {
	segment_id: string;
	interview_id: string;
	question_id: string | null;
};

export type KeywordBreakdownRow = {
	id: string;
	label: string;
	count: number;
	parent_subtheme: string;
	parent_theme: string;
	blocks: ThemeBlock[];
};

/** A keyword a segment matched, plus the literal surface form spoken in it. */
export type SegmentKeyword = { id: string; label: string; surface: string };

/**
 * segment_id -> the single strongest keyword it matched in keyword_usage.json,
 * where "strongest" is the cluster with the highest corpus-wide mention count.
 * `surface` is the verbatim form spoken in that segment. Segments matching no
 * lexicon cluster are simply absent from the map.
 */
export const keywordBySegment: Map<string, SegmentKeyword> = (() => {
	const map = new Map<string, SegmentKeyword>();
	const ranked = (keywordUsage.clusters ?? []).slice().sort((a, b) => b.count - a.count);
	for (const kw of ranked)
		for (const m of kw.matches)
			if (!map.has(m.segment_id))
				map.set(m.segment_id, { id: kw.id, label: kw.label, surface: m.text ?? '' });
	return map;
})();

/** Every coded segment whose text matched the given keyword cluster, joined
 *  against the codebook annotations so each fragment carries sentiment +
 *  emotions for visual treatment. `predicate` filters the underlying match
 *  contexts (e.g. by participant or question). */
export function segmentsForKeyword(
	clusterId: string,
	predicate: (m: KeywordMatchContext) => boolean = () => true
): ThemeFragment[] {
	const cluster = keywordUsage.clusters.find((c) => c.id === clusterId);
	if (!cluster) return [];
	const seen = new Set<string>();
	const out: ThemeFragment[] = [];
	for (const m of cluster.matches) {
		if (!predicate(m)) continue;
		if (seen.has(m.segment_id)) continue;
		seen.add(m.segment_id);
		const seg = segmentById.get(m.segment_id);
		if (!seg) continue;
		const ann = annotationBySegment.get(m.segment_id);
		out.push({
			segment_id: m.segment_id,
			text: seg.text,
			char_start: seg.char_start,
			char_end: seg.char_end,
			interview_id: m.interview_id,
			question_id: m.question_id ?? ann?.question_id ?? '',
			sentiment: ann?.sentiment ?? 0,
			emotions: ann?.emotions ?? [],
			flags: seg.flags ?? [],
			in_pull_quote: quoteBySegment.has(m.segment_id),
			quote_id: quoteBySegment.get(m.segment_id) ?? null
		});
	}
	return out;
}

/** Per-cluster breakdown from the live keyword lexicon. Each row's `blocks`
 *  are one per matched segment (deduped), carrying the segment's annotation
 *  sentiment (or 0 if the segment isn't annotated). `predicate` narrows by
 *  participant, question, etc. */
export function keywordBreakdown(
	predicate: (m: KeywordMatchContext) => boolean = () => true
): KeywordBreakdownRow[] {
	const out: KeywordBreakdownRow[] = [];
	for (const cluster of keywordUsage.clusters) {
		const seen = new Set<string>();
		const blocks: ThemeBlock[] = [];
		for (const m of cluster.matches) {
			if (!predicate(m)) continue;
			if (seen.has(m.segment_id)) continue;
			seen.add(m.segment_id);
			const ann = annotationBySegment.get(m.segment_id);
			blocks.push({ sentiment: ann?.sentiment ?? 0, interview_id: m.interview_id });
		}
		if (!blocks.length) continue;
		out.push({
			id: cluster.id,
			label: cluster.label,
			count: blocks.length,
			parent_subtheme: cluster.parent_subtheme ?? '',
			parent_theme: cluster.parent_theme ?? '',
			blocks
		});
	}
	return out.sort((a, b) => b.count - a.count);
}

// === Three-level radial tree (theme -> subtheme -> keyword) ==================

export type RadialBlock = { sentiment: number; interview_id: string };
export type RadialNode = {
	id: string;
	label: string;
	count: number;
	blocks: RadialBlock[];
	kind: 'theme' | 'subtheme' | 'keyword';
	description?: string;
	children?: RadialNode[];
};

/** A complete three-level hierarchy filtered by the given predicates, suitable
 *  for the zoomable RadialThemeChart. `annPred` filters the codebook
 *  annotations that drive theme + subtheme counts; `matchPred` filters the
 *  live keyword-lexicon matches that drive each subtheme's keyword children.
 *  Subthemes/themes with zero counts under the filter are dropped. */
export function buildRadialTree(
	annPred: (a: Annotation) => boolean = () => true,
	matchPred: (m: KeywordMatchContext) => boolean = () => true
): RadialNode[] {
	const themes = themeBreakdown(annPred);

	const keywordsBySubtheme = new Map<string, RadialNode[]>();
	for (const kw of keywordBreakdown(matchPred)) {
		const list = keywordsBySubtheme.get(kw.parent_subtheme) ?? [];
		list.push({
			id: kw.id,
			label: kw.label,
			count: kw.count,
			blocks: kw.blocks,
			kind: 'keyword'
		});
		keywordsBySubtheme.set(kw.parent_subtheme, list);
	}

	const themeMeta = new Map(themeTags.map((t) => [t.id, t] as const));

	return themes.map((t) => {
		const meta = themeMeta.get(t.id);
		return {
			id: t.id,
			label: meta?.label ?? titleCase(t.id),
			count: t.count,
			blocks: t.blocks,
			kind: 'theme',
			description: meta?.description,
			children: t.subthemes.map((s) => {
				const sMeta = (meta?.subthemes ?? []).find((x) => x.id === s.id);
				return {
					id: s.id,
					label: sMeta?.label ?? subthemeLabel(s.id),
					count: s.count,
					blocks: s.blocks,
					kind: 'subtheme',
					description: sMeta?.description,
					children: (keywordsBySubtheme.get(s.id) ?? []).sort((a, b) => b.count - a.count)
				};
			})
		};
	});
}
