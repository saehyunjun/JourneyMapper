/**
 * lexicon-stats.ts — study-wide aggregate stats for one keyword or theme group.
 *
 * Powers the secondary "group stats" drawer: given a keyword id or a theme id,
 * returns how often the group is invoked across every participant transcript,
 * the sentiment and emotions of the speech around it, the themes it travels
 * with, and a per-participant breakdown.
 *
 * Built on the same joins as analysis.ts so the numbers agree with the
 * analysis page. Reusable — import `groupStats` (or `keywordStats` /
 * `themeStats`) anywhere a keyword/theme aggregate is needed.
 */
import {
	segments,
	annotations,
	themeTags,
	titleCase,
	SENTIMENT_LABELS,
	type Annotation
} from './analysis';
import { categories, keywordTags, keywordCounts } from './keywords';
import { countWords } from './word-tokenize';

export type GroupKind = 'keyword' | 'theme';

export type GroupStats = {
	kind: GroupKind;
	id: string;
	label: string;
	/** A keyword's category, or a theme's codebook description. */
	context: string;
	/** Headline count and the unit it is measured in. */
	invocations: number;
	invocationUnit: string;
	segmentCount: number;
	participantCount: number;
	/** Sentiment -2..2 distribution across the annotated speech. */
	sentiment: { value: number; label: string; count: number }[];
	avgSentiment: number | null;
	emotions: { id: string; label: string; count: number }[];
	/** Themes the group co-occurs with (a keyword) or is co-tagged with (a theme). */
	relatedThemes: { id: string; label: string; count: number }[];
	/** Most common content words in the group's segments (stoplist applied). */
	commonWords: { word: string; count: number }[];
	perParticipant: { interviewId: string; label: string; count: number }[];
};

// --- One-time indexes over the study data -----------------------------------

const annById = new Map(annotations.map((a) => [a.segment_id, a]));
const segById = new Map(segments.map((s) => [s.segment_id, s]));
const themeById = new Map(themeTags.map((t) => [t.id, t]));

// keyword id -> { label, category label }
const keywordMeta = new Map<string, { label: string; categoryLabel: string }>();
for (const cat of categories) {
	for (const kw of cat.keywords) {
		keywordMeta.set(kw.id, { label: kw.label, categoryLabel: cat.label });
	}
}

// keyword id -> segment ids whose text contains it (distinct per segment).
const segmentsByKeyword = new Map<string, string[]>();
for (const seg of segments) {
	for (const kw of keywordTags(seg.text).keywords) {
		const list = segmentsByKeyword.get(kw.id) ?? [];
		list.push(seg.segment_id);
		segmentsByKeyword.set(kw.id, list);
	}
}

// keyword id -> total surface mentions across every transcript.
const mentionsByKeyword = new Map<string, number>();
for (const c of keywordCounts(segments.map((s) => s.text))) {
	mentionsByKeyword.set(c.keywordId, c.count);
}

// --- Shared aggregation ------------------------------------------------------

/** Sentiment / emotion / co-theme rollup over a set of segment annotations. */
function aggregate(segmentIds: string[]) {
	const anns = segmentIds
		.map((id) => annById.get(id))
		.filter((a): a is Annotation => !!a);

	const sentiment = [-2, -1, 0, 1, 2].map((value) => ({
		value,
		label: SENTIMENT_LABELS[value],
		count: anns.filter((a) => a.sentiment === value).length
	}));
	const avgSentiment = anns.length
		? anns.reduce((n, a) => n + a.sentiment, 0) / anns.length
		: null;

	const emoTally = new Map<string, number>();
	for (const a of anns) for (const e of a.emotions) emoTally.set(e, (emoTally.get(e) ?? 0) + 1);
	const emotions = [...emoTally]
		.map(([id, count]) => ({ id, label: titleCase(id), count }))
		.sort((a, b) => b.count - a.count);

	const themeTally = new Map<string, number>();
	for (const a of anns) for (const t of a.themes) themeTally.set(t, (themeTally.get(t) ?? 0) + 1);

	const commonWords = countWords(
		segmentIds.map((id) => segById.get(id)?.text ?? '').filter(Boolean)
	).slice(0, 12);

	return { sentiment, avgSentiment, emotions, themeTally, commonWords };
}

/** Per-participant counts for a set of segment ids, busiest first. */
function perParticipant(segmentIds: string[]) {
	const tally = new Map<string, number>();
	for (const id of segmentIds) {
		const iv = segById.get(id)?.interview_id;
		if (iv) tally.set(iv, (tally.get(iv) ?? 0) + 1);
	}
	return [...tally]
		.map(([interviewId, count]) => ({ interviewId, label: titleCase(interviewId), count }))
		.sort((a, b) => b.count - a.count);
}

// --- Public API --------------------------------------------------------------

/** Study-wide stats for one lexicon keyword. */
export function keywordStats(keywordId: string): GroupStats {
	const meta = keywordMeta.get(keywordId);
	const segmentIds = segmentsByKeyword.get(keywordId) ?? [];
	const agg = aggregate(segmentIds);
	const mentions = mentionsByKeyword.get(keywordId) ?? 0;
	return {
		kind: 'keyword',
		id: keywordId,
		label: meta?.label ?? titleCase(keywordId),
		context: meta?.categoryLabel ?? '',
		invocations: mentions,
		invocationUnit: mentions === 1 ? 'mention' : 'mentions',
		segmentCount: segmentIds.length,
		participantCount: new Set(
			segmentIds.map((id) => segById.get(id)?.interview_id).filter(Boolean)
		).size,
		sentiment: agg.sentiment,
		avgSentiment: agg.avgSentiment,
		emotions: agg.emotions,
		relatedThemes: [...agg.themeTally]
			.map(([id, count]) => ({ id, label: titleCase(id), count }))
			.sort((a, b) => b.count - a.count),
		commonWords: agg.commonWords,
		perParticipant: perParticipant(segmentIds)
	};
}

/** Study-wide stats for one codebook theme. */
export function themeStats(themeId: string): GroupStats {
	const anns = annotations.filter((a) => a.themes.includes(themeId));
	const segmentIds = anns.map((a) => a.segment_id);
	const agg = aggregate(segmentIds);
	return {
		kind: 'theme',
		id: themeId,
		label: titleCase(themeId),
		context: themeById.get(themeId)?.description ?? '',
		invocations: anns.length,
		invocationUnit: anns.length === 1 ? 'tagged segment' : 'tagged segments',
		segmentCount: anns.length,
		participantCount: new Set(anns.map((a) => a.interview_id)).size,
		sentiment: agg.sentiment,
		avgSentiment: agg.avgSentiment,
		emotions: agg.emotions,
		relatedThemes: [...agg.themeTally]
			.filter(([id]) => id !== themeId)
			.map(([id, count]) => ({ id, label: titleCase(id), count }))
			.sort((a, b) => b.count - a.count),
		commonWords: agg.commonWords,
		perParticipant: perParticipant(segmentIds)
	};
}

/** Stats for either group kind — the entry point the stats drawer calls. */
export function groupStats(kind: GroupKind, id: string): GroupStats {
	return kind === 'keyword' ? keywordStats(id) : themeStats(id);
}
