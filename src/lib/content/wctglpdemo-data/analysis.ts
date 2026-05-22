/**
 * analysis.ts
 *
 * Typed loader + join helpers over the interview-analysis pipeline outputs.
 * Backs the review interface at /wctglpdemo/analysis.
 *
 * Codebook 2.0: three top-level themes (treatment, clinical_trials,
 * condition_specific), each with subthemes. Annotations carry both axes:
 * a.themes (broad, max 3) and a.subthemes (specific, the actual tag detail).
 * The frequency/breakdown helpers iterate themes as the outer axis and
 * subthemes as the inner axis — same shape as before, finer-grained inside.
 */
import interviewsRaw from './interviews_structured.json';
import wordUsageRaw from './word_usage.json';
import questionsRaw from './questions.json';
import segmentsRaw from './segments.json';
import segmentTagsRaw from './segment_tags.json';
import codebookRaw from './codebook.json';
import quoteBankRaw from './quote_bank.json';
import keywordUsageRaw from './keyword_usage.json';

export type WordCount = { word: string; count: number };

export type Quote = {
	quote_id: string;
	interview_id: string;
	question_id: string;
	segment_ids: string[];
	text: string;
	char_start: number;
	char_end: number;
	verbatim_verified: boolean;
	themes: string[];
	subthemes: string[];
	emotions: string[];
	sentiment: number;
	quote_score: {
		clarity: number;
		emotional_intensity: number;
		strategic_value: number;
		specificity: number;
		overall: number;
	};
	recommended_uses: string[];
	source: string;
	review_status: string;
	reviewer_notes: string;
};

export type Annotation = {
	segment_id: string;
	interview_id: string;
	question_id: string;
	themes: string[];
	subthemes: string[];
	emotions: string[];
	sentiment: number;
	confidence: number;
	review_status: string;
};

export type Segment = {
	segment_id: string;
	interview_id: string;
	turn_index: number;
	segment_index: number;
	question_id: string | null;
	speaker: string;
	text: string;
	char_start: number;
	char_end: number;
	word_count: number;
	flags: string[];
};

export type Question = {
	question_id: string;
	type: string;
	order: number;
	canonical_question: string;
};

export type Subtheme = {
	id: string;
	label?: string;
	description?: string;
};

export type ThemeTag = {
	id: string;
	label?: string;
	description: string;
	subthemes?: Subtheme[];
};

type Interview = { interview_id: string; turn_count: number };

export const quotes = (quoteBankRaw as { quotes: Quote[] }).quotes;

const segmentTags = segmentTagsRaw as {
	meta: { tagged_interviews?: string[]; pending_interviews?: string[] };
	annotations: Annotation[];
};
export const annotations = segmentTags.annotations;

export const pendingInterviews: string[] = segmentTags.meta.pending_interviews ?? [];
export const questions = (questionsRaw as { questions: Question[] }).questions;

/** The three top-level themes from codebook 2.0, each carrying its subthemes. */
export const themeTags = (codebookRaw as { themes: ThemeTag[] }).themes;

/** Flat list of every subtheme, with its parent theme id attached as `group`. */
export const subthemeTags: (Subtheme & { group: string })[] = themeTags.flatMap((t) =>
	(t.subthemes ?? []).map((s) => ({ ...s, group: t.id }))
);

export type TagGroup = { id: string; label: string; description: string };

/**
 * Codebook 2.0 transitional shim: the old `tag_groups` axis is retired —
 * h3 themes ARE the groups in 2.0. We export them in the old TagGroup shape
 * (`{id, label, description}`) so existing consumer components that expect
 * groups don't crash. UI density degrades from 8 groups to 3.
 */
export const tagGroups: TagGroup[] = themeTags.map((t) => ({
	id: t.id,
	label: t.label ?? titleCase(t.id),
	description: t.description ?? ''
}));

export const interviews = (interviewsRaw as { interviews: Interview[] }).interviews;
export const segments = (segmentsRaw as { segments: Segment[] }).segments;
export const wordUsage = wordUsageRaw as {
	overall_word_usage: WordCount[];
	by_participant: Record<string, { total_words: number; unique_words: number; word_usage: WordCount[] }>;
};

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

const questionById = new Map(questions.map((q) => [q.question_id, q]));

/** Canonical wording for a question_id. */
export function questionLabel(id: string): string {
	return questionById.get(id)?.canonical_question ?? id;
}

/** "out_of_pocket_cost" -> "Out Of Pocket Cost" */
export function titleCase(id: string): string {
	return id.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export const participantLabel = titleCase;

/** subtheme id -> parent theme id */
export const subthemeParent = new Map<string, string>();
for (const t of themeTags) {
	for (const s of t.subthemes ?? []) subthemeParent.set(s.id, t.id);
}

/**
 * Codebook 2.0 transitional shim. The old `themeGroupOf` mapped a (specific)
 * theme id to its broader tag-group id. With tag_groups retired and themes
 * collapsed to 3 broad buckets, this map is now empty — each theme IS its own
 * "group." Kept for export-shape compatibility.
 */
export const themeGroupOf = new Map<string, string | undefined>(
	themeTags.map((t) => [t.id, undefined])
);

export const studyStats = {
	interviews: interviews.length,
	turns: interviews.reduce((n, iv) => n + iv.turn_count, 0),
	segments: segments.length,
	annotations: annotations.length,
	quotes: quotes.length,
	themes: themeTags.length
};

function tally(rows: string[][]): { id: string; count: number }[] {
	const counts = new Map<string, number>();
	for (const row of rows) for (const id of row) counts.set(id, (counts.get(id) ?? 0) + 1);
	return [...counts].map(([id, count]) => ({ id, count })).sort((a, b) => b.count - a.count);
}

/**
 * Theme counts across the annotations matching an optional predicate, each
 * with its subtheme breakdown. With no predicate, counts every annotation.
 */
export function themeFrequency(
	predicate: (a: Annotation) => boolean = () => true
): { id: string; count: number; subthemes: { id: string; count: number }[] }[] {
	const rows = annotations.filter(predicate);
	const themeRows = tally(rows.map((a) => a.themes));
	const subCounts = new Map<string, number>();
	for (const a of rows) for (const s of a.subthemes) subCounts.set(s, (subCounts.get(s) ?? 0) + 1);
	return themeRows.map((t) => ({
		...t,
		subthemes: [...subCounts]
			.filter(([id]) => subthemeParent.get(id) === t.id)
			.map(([id, count]) => ({ id, count }))
			.sort((a, b) => b.count - a.count)
	}));
}

export const emotionFrequency = (
	predicate: (a: Annotation) => boolean = () => true
): { id: string; count: number }[] => tally(annotations.filter(predicate).map((a) => a.emotions));

export function themeCounts(
	predicate: (a: Annotation) => boolean = () => true
): { id: string; count: number }[] {
	return tally(annotations.filter(predicate).map((a) => a.themes));
}

export type ThemeBlock = { sentiment: number; interview_id: string };

export type BreakdownRow = { id: string; count: number; blocks: ThemeBlock[] };
export type ThemeBreakdownRow = BreakdownRow & { subthemes: BreakdownRow[] };

export function themeBreakdown(
	predicate: (a: Annotation) => boolean = () => true
): ThemeBreakdownRow[] {
	const themeBlocks = new Map<string, ThemeBlock[]>();
	const subBlocks = new Map<string, ThemeBlock[]>();
	for (const a of annotations.filter(predicate)) {
		const block: ThemeBlock = { sentiment: a.sentiment, interview_id: a.interview_id };
		for (const t of a.themes) {
			const list = themeBlocks.get(t) ?? [];
			list.push(block);
			themeBlocks.set(t, list);
		}
		for (const s of a.subthemes) {
			const list = subBlocks.get(s) ?? [];
			list.push(block);
			subBlocks.set(s, list);
		}
	}
	return [...themeBlocks.entries()]
		.map(([id, blocks]) => ({
			id,
			count: blocks.length,
			blocks,
			subthemes: [...subBlocks.entries()]
				.filter(([sid]) => subthemeParent.get(sid) === id)
				.map(([sid, b]) => ({ id: sid, count: b.length, blocks: b }))
				.sort((a, b) => b.count - a.count)
		}))
		.sort((a, b) => b.count - a.count);
}

export function emotionBreakdown(
	predicate: (a: Annotation) => boolean = () => true
): BreakdownRow[] {
	const rows = new Map<string, ThemeBlock[]>();
	for (const a of annotations.filter(predicate)) {
		for (const e of a.emotions) {
			const list = rows.get(e) ?? [];
			list.push({ sentiment: a.sentiment, interview_id: a.interview_id });
			rows.set(e, list);
		}
	}
	return [...rows.entries()]
		.map(([id, blocks]) => ({ id, count: blocks.length, blocks }))
		.sort((a, b) => b.count - a.count);
}

const quoteBySegment = new Map<string, string>();
for (const q of quotes) for (const sid of q.segment_ids) quoteBySegment.set(sid, q.quote_id);

const segmentById = new Map(segments.map((s) => [s.segment_id, s]));
const annotationBySegment = new Map(annotations.map((a) => [a.segment_id, a]));

export type KeyQuote = {
	id: string;
	interview_id: string;
	question_id: string;
	text: string;
	sentiment: number;
	themes: string[];
	score: number | null;
};

export function keyQuotes(
	starredQuoteIds: string[],
	starredSegmentIds: string[] = []
): KeyQuote[] {
	const cards: KeyQuote[] = [];
	const covered = new Set<string>();

	for (const q of quotes) {
		if (!starredQuoteIds.includes(q.quote_id)) continue;
		for (const sid of q.segment_ids) covered.add(sid);
		cards.push({
			id: q.quote_id,
			interview_id: q.interview_id,
			question_id: q.question_id,
			text: q.text,
			sentiment: q.sentiment,
			themes: q.themes,
			score: q.quote_score.overall
		});
	}

	for (const sid of starredSegmentIds) {
		if (covered.has(sid)) continue;
		const seg = segmentById.get(sid);
		if (!seg) continue;
		const ann = annotationBySegment.get(sid);
		cards.push({
			id: sid,
			interview_id: seg.interview_id,
			question_id: seg.question_id ?? ann?.question_id ?? '',
			text: seg.text,
			sentiment: ann?.sentiment ?? 0,
			themes: ann?.themes ?? [],
			score: null
		});
	}

	return cards.sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
}

export type ThemeFragment = {
	segment_id: string;
	text: string;
	char_start: number;
	char_end: number;
	interview_id: string;
	question_id: string;
	sentiment: number;
	emotions: string[];
	flags: string[];
	in_pull_quote: boolean;
	quote_id: string | null;
};

function fragmentForAnnotation(a: Annotation): ThemeFragment {
	const seg = segmentById.get(a.segment_id);
	return {
		segment_id: a.segment_id,
		text: seg?.text ?? '',
		char_start: seg?.char_start ?? 0,
		char_end: seg?.char_end ?? 0,
		interview_id: a.interview_id,
		question_id: a.question_id,
		sentiment: a.sentiment,
		emotions: a.emotions,
		flags: seg?.flags ?? [],
		in_pull_quote: quoteBySegment.has(a.segment_id),
		quote_id: quoteBySegment.get(a.segment_id) ?? null
	};
}

export function fragmentsMatching(predicate: (a: Annotation) => boolean): ThemeFragment[] {
	return annotations.filter(predicate).map(fragmentForAnnotation);
}

export function segmentsForTheme(
	themeId: string,
	predicate: (a: Annotation) => boolean = () => true
): ThemeFragment[] {
	return fragmentsMatching((a) => a.themes.includes(themeId) && predicate(a));
}

export function segmentsForSubtheme(
	subthemeId: string,
	predicate: (a: Annotation) => boolean = () => true
): ThemeFragment[] {
	return fragmentsMatching((a) => a.subthemes.includes(subthemeId) && predicate(a));
}

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

/** Pretty label for a subtheme id, or title-cased fallback. */
export function subthemeLabel(id: string): string {
	return subthemeTags.find((s) => s.id === id)?.label ?? titleCase(id);
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

const questionOrder = new Map(questions.map((q) => [q.question_id, q.order]));

export const themedQuestionIds: string[] = [...new Set(annotations.map((a) => a.question_id))]
	.filter((id) => questionById.get(id)?.type !== 'admin')
	.sort((a, b) => (questionOrder.get(a) ?? 99) - (questionOrder.get(b) ?? 99));

export const themedParticipantIds: string[] = [
	...new Set(annotations.map((a) => a.interview_id))
].sort();

export function sentimentDistribution(
	predicate: (a: Annotation) => boolean = () => true
): { value: number; count: number }[] {
	const rows = annotations.filter(predicate);
	return [-2, -1, 0, 1, 2].map((value) => ({
		value,
		count: rows.filter((a) => a.sentiment === value).length
	}));
}

export const SENTIMENT_LABELS: Record<number, string> = {
	[-2]: 'Strongly negative',
	[-1]: 'Negative',
	0: 'Neutral / mixed',
	1: 'Positive',
	2: 'Strongly positive'
};
