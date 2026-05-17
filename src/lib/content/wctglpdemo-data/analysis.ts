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
	semantic_tags: string[];
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
	semantic_tags: string[];
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
	description: string;
	subthemes?: { id: string; description: string }[];
};

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
export const interviews = (interviewsRaw as { interviews: Interview[] }).interviews;
export const segments = (segmentsRaw as { segments: Segment[] }).segments;
export const wordUsage = wordUsageRaw as {
	overall_word_usage: WordCount[];
	by_participant: Record<string, { total_words: number; unique_words: number; word_usage: WordCount[] }>;
};

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

/** Theme counts across all segment annotations, each with its subtheme breakdown. */
export function themeFrequency(): { id: string; count: number; subthemes: { id: string; count: number }[] }[] {
	const themeRows = tally(annotations.map((a) => a.themes));
	const subCounts = new Map<string, number>();
	for (const a of annotations) for (const s of a.subthemes) subCounts.set(s, (subCounts.get(s) ?? 0) + 1);
	return themeRows.map((t) => ({
		...t,
		subthemes: [...subCounts]
			.filter(([id]) => subthemeParent.get(id) === t.id)
			.map(([id, count]) => ({ id, count }))
			.sort((a, b) => b.count - a.count)
	}));
}

export const emotionFrequency = (): { id: string; count: number }[] =>
	tally(annotations.map((a) => a.emotions));

/** Theme counts across the segment annotations matching an optional predicate. */
export function themeCounts(
	predicate: (a: Annotation) => boolean = () => true
): { id: string; count: number }[] {
	return tally(annotations.filter(predicate).map((a) => a.themes));
}

export type ThemeBlock = { sentiment: number; interview_id: string };

/**
 * Per-theme breakdown: one block per contributing segment annotation, carrying
 * the data needed to colour it (sentiment, interviewee). Sorted by count desc.
 */
export function themeBreakdown(
	predicate: (a: Annotation) => boolean = () => true
): { id: string; count: number; blocks: ThemeBlock[] }[] {
	const rows = new Map<string, ThemeBlock[]>();
	for (const a of annotations.filter(predicate)) {
		for (const t of a.themes) {
			const list = rows.get(t) ?? [];
			list.push({ sentiment: a.sentiment, interview_id: a.interview_id });
			rows.set(t, list);
		}
	}
	return [...rows.entries()]
		.map(([id, blocks]) => ({ id, count: blocks.length, blocks }))
		.sort((a, b) => b.count - a.count);
}

// segment_id -> the pull quote that contains it (if any).
const quoteBySegment = new Map<string, string>();
for (const q of quotes) for (const sid of q.segment_ids) quoteBySegment.set(sid, q.quote_id);

export type ThemeFragment = {
	segment_id: string;
	text: string;
	char_start: number;
	char_end: number;
	interview_id: string;
	question_id: string;
	sentiment: number;
	flags: string[];
	in_pull_quote: boolean;
	quote_id: string | null;
};

/**
 * Every segment fragment tagged with `themeId` (optionally filtered), joined to
 * its text and flagged with whether it is already part of a pull quote.
 */
export function segmentsForTheme(
	themeId: string,
	predicate: (a: Annotation) => boolean = () => true
): ThemeFragment[] {
	const segById = new Map(segments.map((s) => [s.segment_id, s]));
	return annotations
		.filter((a) => a.themes.includes(themeId) && predicate(a))
		.map((a) => {
			const seg = segById.get(a.segment_id);
			return {
				segment_id: a.segment_id,
				text: seg?.text ?? '',
				char_start: seg?.char_start ?? 0,
				char_end: seg?.char_end ?? 0,
				interview_id: a.interview_id,
				question_id: a.question_id,
				sentiment: a.sentiment,
				flags: seg?.flags ?? [],
				in_pull_quote: quoteBySegment.has(a.segment_id),
				quote_id: quoteBySegment.get(a.segment_id) ?? null
			};
		});
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

/** Counts of each sentiment value (-2..2) across annotations. */
export function sentimentDistribution(): { value: number; count: number }[] {
	return [-2, -1, 0, 1, 2].map((value) => ({
		value,
		count: annotations.filter((a) => a.sentiment === value).length
	}));
}

export const SENTIMENT_LABELS: Record<number, string> = {
	[-2]: 'Strongly negative',
	[-1]: 'Negative',
	0: 'Neutral / mixed',
	1: 'Positive',
	2: 'Strongly positive'
};
