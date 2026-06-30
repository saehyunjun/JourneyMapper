/**
 * analysis.ts — STUBBED 2026-05-31
 *
 * The 8 top-level JSON imports (~940 KB) were dragging every importer of
 * `quotes` / `annotations` / `titleCase` / etc. into a single SSR module
 * graph. On dev that caused Vite SSR-fetch timeouts on /patientlyiq because
 * any HMR invalidation re-parsed the entire chain.
 *
 * Until the per-indication data layer lands (see PERFORMANCE_REFACTOR.md
 * "next architecture"), this module is intentionally stubbed: all exported
 * data is empty, all helper functions still work (they operate on the empty
 * data and naturally return empty results), all types are preserved. Pages
 * that import from here will render with empty cells/lists but will LOAD.
 *
 * Per-indication data should be loaded inside +page.server.ts via fragment
 * corpora (the fragment-corpus path already supports this for LN + MS) and
 * passed to the page via data props — NOT re-imported at the module top
 * level. Re-introducing eager imports here will resurrect the same hang.
 *
 * To restore real data temporarily for development, uncomment the imports
 * below and the original const initializers (each marked STUB).
 */

// import interviewsRaw from './interviews_structured.json';
// import wordUsageRaw from './word_usage.json';
// import questionsRaw from './questions.json';
// import segmentsRaw from './segments.json';
// import segmentTagsRaw from './segment_tags.json';
// import codebookRaw from './codebook.json';
// import quoteBankRaw from './quote_bank.json';
// import personaGoalsBarriersRaw from './persona_goals_barriers.json';

// Type-only re-exports for back-compat. The runtime lives in
// analysis-keywords.ts (which imports keyword_usage.json — 730 KB). Importers
// that only need the type continue to work without paying for the payload.
// Routes that need the runtime (buildRadialTree, keywordBreakdown,
// segmentsForKeyword, keywordBySegment) import directly from './analysis-keywords'.
export type {
	KeywordMatchContext,
	KeywordBreakdownRow,
	SegmentKeyword,
	RadialNode,
	RadialBlock
} from './analysis-keywords';

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

// STUB: was `(quoteBankRaw as { quotes: Quote[] }).quotes`
export const quotes: Quote[] = [];

// STUB: segment_tags.json was the heaviest single import here (290 KB).
export const annotations: Annotation[] = [];

// STUB: derived from segment_tags meta.
export const pendingInterviews: string[] = [];

// STUB: was `(questionsRaw as { questions: Question[] }).questions`.
export const questions: Question[] = [];

/**
 * AI-generated goals (what the participant is reaching for) and barriers
 * (specific obstacles they hit) per persona, sourced from their tagged
 * segments. Generated offline by scripts/propose-persona-goals-barriers.mjs;
 * stays empty until the script has been run. Each item carries 1–2
 * supporting segment_ids for click-through evidence in the persona drawer.
 */
export type PersonaGoalBarrier = {
	summary: string;
	supporting_segment_ids: string[];
	subtheme_id: string | null;
};
export type PersonaGoalsBarriers = {
	goals: PersonaGoalBarrier[];
	barriers: PersonaGoalBarrier[];
};
// STUB: was personaGoalsBarriersRaw.personas. Empty record keeps callers
// safe — goalsBarriersFor() simply returns null for every interview id.
export const personaGoalsBarriers: Record<string, PersonaGoalsBarriers> = {};

/** Goals + barriers for one participant, or null if the script hasn't run for them. */
export function goalsBarriersFor(interviewId: string): PersonaGoalsBarriers | null {
	return personaGoalsBarriers[interviewId] ?? null;
}

/** The three top-level themes from codebook 2.0, each carrying its subthemes. */
// STUB: was `(codebookRaw as { themes: ThemeTag[] }).themes`. Empty array
// is safe — every downstream join over themeTags becomes a no-op.
export const themeTags: ThemeTag[] = [];

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

// STUB: was `(interviewsRaw as { interviews: Interview[] }).interviews`.
export const interviews: Interview[] = [];
// STUB: was `(segmentsRaw as { segments: Segment[] }).segments` (275 KB).
export const segments: Segment[] = [];
// STUB: was `wordUsageRaw` (156 KB). Empty shape is structurally valid.
export const wordUsage: {
	overall_word_usage: WordCount[];
	by_participant: Record<string, { total_words: number; unique_words: number; word_usage: WordCount[] }>;
} = { overall_word_usage: [], by_participant: {} };

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

// Exported because analysis-keywords.ts joins keyword matches against these
// same lookup tables. Keep them as the single source of truth.
export const quoteBySegment = new Map<string, string>();
for (const q of quotes) for (const sid of q.segment_ids) quoteBySegment.set(sid, q.quote_id);

export const segmentById = new Map(segments.map((s) => [s.segment_id, s]));
export const annotationBySegment = new Map(annotations.map((a) => [a.segment_id, a]));

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

/** Pretty label for a subtheme id, or title-cased fallback. */
export function subthemeLabel(id: string): string {
	return subthemeTags.find((s) => s.id === id)?.label ?? titleCase(id);
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
