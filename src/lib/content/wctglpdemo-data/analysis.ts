/**
 * analysis.ts
 *
 * Typed loader + join helpers over the interview-analysis pipeline outputs.
 * Backs the review interface at /wctglpdemo/analysis.
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
	/** null for freshly-uploaded segments not yet through question normalization. */
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

export type ThemeTag = {
	id: string;
	/** Broader tag-group this theme belongs to — see `tagGroups`. */
	group?: string;
	description: string;
	subthemes?: { id: string; description: string }[];
};

export type TagGroup = { id: string; label: string; description: string };

type Interview = { interview_id: string; turn_count: number };

export const quotes = (quoteBankRaw as { quotes: Quote[] }).quotes;

const segmentTags = segmentTagsRaw as {
	meta: { tagged_interviews: string[]; pending_interviews: string[] };
	annotations: Annotation[];
};
export const annotations = segmentTags.annotations;

/**
 * Interviews that have been parsed + segmented but not yet run through the
 * tagging / quote-bank stages — so they carry no themes, emotions, or quotes.
 * Surfaced in the UI so a freshly-uploaded interview reads as "pending" rather
 * than silently missing.
 */
export const pendingInterviews: string[] = segmentTags.meta.pending_interviews ?? [];
export const questions = (questionsRaw as { questions: Question[] }).questions;
export const themeTags = (codebookRaw as { theme_tags: ThemeTag[] }).theme_tags;
/** Broader theme groups from the codebook; each theme references one by `group`. */
export const tagGroups = (codebookRaw as { tag_groups: TagGroup[] }).tag_groups;
/** theme id -> its tag-group id */
export const themeGroupOf = new Map<string, string | undefined>(
	themeTags.map((t) => [t.id, t.group])
);
export const interviews = (interviewsRaw as { interviews: Interview[] }).interviews;
export const segments = (segmentsRaw as { segments: Segment[] }).segments;
export const wordUsage = wordUsageRaw as {
	overall_word_usage: WordCount[];
	by_participant: Record<string, { total_words: number; unique_words: number; word_usage: WordCount[] }>;
};

type KeywordUsage = {
	categories: {
		id: string;
		label: string;
		keywords: {
			id: string;
			label: string;
			count: number;
			matches: { segment_id: string; text?: string }[];
		}[];
	}[];
};

/** A keyword a segment matched, plus the literal surface form spoken in it. */
export type SegmentKeyword = { id: string; label: string; surface: string };

/**
 * segment_id -> the single strongest keyword it matched in keyword_usage.json,
 * where "strongest" is the keyword with the highest corpus-wide mention count.
 * `surface` is the verbatim form spoken in that segment. Segments matching no
 * lexicon keyword are simply absent from the map.
 */
export const keywordBySegment: Map<string, SegmentKeyword> = (() => {
	const map = new Map<string, SegmentKeyword>();
	const ranked = (keywordUsageRaw as KeywordUsage).categories
		.flatMap((c) => c.keywords)
		.sort((a, b) => b.count - a.count);
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

/** "participant_09" -> "Participant 09" */
export const participantLabel = titleCase;

/** subtheme id -> parent theme id */
export const subthemeParent = new Map<string, string>();
for (const t of themeTags) {
	for (const s of t.subthemes ?? []) subthemeParent.set(s.id, t.id);
}

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
 * Theme counts across the segment annotations matching an optional predicate,
 * each with its subtheme breakdown. With no predicate, counts every annotation.
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

/** Emotion counts across the segment annotations matching an optional predicate. */
export const emotionFrequency = (
	predicate: (a: Annotation) => boolean = () => true
): { id: string; count: number }[] => tally(annotations.filter(predicate).map((a) => a.emotions));

/** Theme counts across the segment annotations matching an optional predicate. */
export function themeCounts(
	predicate: (a: Annotation) => boolean = () => true
): { id: string; count: number }[] {
	return tally(annotations.filter(predicate).map((a) => a.themes));
}

export type ThemeBlock = { sentiment: number; interview_id: string };

export type BreakdownRow = { id: string; count: number; blocks: ThemeBlock[] };
export type ThemeBreakdownRow = BreakdownRow & { subthemes: BreakdownRow[] };

/**
 * Per-theme breakdown: one block per contributing segment annotation, carrying
 * the data needed to colour it (sentiment, interviewee). Each theme also lists
 * its subthemes with the same per-block detail. Sorted by count desc.
 */
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

/**
 * Per-emotion breakdown: one block per contributing segment annotation, so each
 * emotion's segments can be split by sentiment. Sorted by count desc.
 */
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

// segment_id -> the pull quote that contains it (if any).
const quoteBySegment = new Map<string, string>();
for (const q of quotes) for (const sid of q.segment_ids) quoteBySegment.set(sid, q.quote_id);

// segment_id lookups, shared by the join helpers below.
const segmentById = new Map(segments.map((s) => [s.segment_id, s]));
const annotationBySegment = new Map(annotations.map((a) => [a.segment_id, a]));

export type KeyQuote = {
	/** Unique key — a quote_id for quote-bank quotes, a segment_id for segments. */
	id: string;
	interview_id: string;
	question_id: string;
	text: string;
	sentiment: number;
	themes: string[];
	/** Quote-bank overall score, or null for a plain starred segment. */
	score: number | null;
};

/**
 * The analyst's "key quotes": every starred quote-bank quote plus every starred
 * segment that isn't already covered by one. Segments are starred on the review
 * page and the fingerprint theme drawer; quotes are starred on the analysis
 * page — this folds both into one ranked card list for KeyQuotesSection.
 */
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

	// Scored quotes first, best score down; starred segments after.
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

/** Join one coded annotation to its segment text and pull-quote provenance. */
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

/**
 * Every coded fragment whose annotation matches `predicate`, joined to its
 * segment text. The general join behind `segmentsForTheme` and the
 * participant drawer's theme / emotion / word row drill-downs.
 */
export function fragmentsMatching(predicate: (a: Annotation) => boolean): ThemeFragment[] {
	return annotations.filter(predicate).map(fragmentForAnnotation);
}

/**
 * Every segment fragment tagged with `themeId` (optionally filtered), joined to
 * its text and flagged with whether it is already part of a pull quote.
 */
export function segmentsForTheme(
	themeId: string,
	predicate: (a: Annotation) => boolean = () => true
): ThemeFragment[] {
	return fragmentsMatching((a) => a.themes.includes(themeId) && predicate(a));
}

const questionOrder = new Map(questions.map((q) => [q.question_id, q.order]));

/** Question ids with themed annotations — admin questions excluded, in interview-guide order. */
export const themedQuestionIds: string[] = [...new Set(annotations.map((a) => a.question_id))]
	.filter((id) => questionById.get(id)?.type !== 'admin')
	.sort((a, b) => (questionOrder.get(a) ?? 99) - (questionOrder.get(b) ?? 99));

/** Interview ids with themed annotations. */
export const themedParticipantIds: string[] = [
	...new Set(annotations.map((a) => a.interview_id))
].sort();

/**
 * Counts of each sentiment value (-2..2) across the segment annotations
 * matching an optional predicate. With no predicate, counts every annotation.
 */
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
