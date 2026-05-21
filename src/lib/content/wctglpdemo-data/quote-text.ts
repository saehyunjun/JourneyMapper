/**
 * quote-text.ts — combined keyword + theme highlighting for quote/segment text.
 *
 * Cluster variants (keyword_lexicon.json) are matched for semibold display.
 *
 * Codebook 2.0 note: theme-term highlighting (the dotted underline path) is
 * currently a no-op. The old `theme.terms[]` list was retired in codebook 2.0;
 * its role is now subsumed by per-instance cluster tagging. The `theme` field
 * on a QuoteRun is therefore always undefined; the API surface is preserved so
 * KeywordText.svelte continues to render correctly without changes. A future
 * iteration may re-introduce theme highlighting by drawing from the segment's
 * applied subtheme tags rather than a separate term list.
 */
import { keywordRuns, type KeywordSpan, type InstanceKeywordTag } from './keywords';

export type ThemeSpan = { start: number; end: number; themeId: string; themeLabel: string };

function themeMatches(_text: string): ThemeSpan[] {
	return [];
}

export type QuoteRun = { text: string; keyword?: KeywordSpan; theme?: ThemeSpan };

/**
 * Split `text` into runs annotated with the keyword and/or theme span each run
 * sits inside. Theme spans are currently always empty (see file header).
 *
 * `instanceTags` (optional, text-relative offsets) override variant matches at
 * their range so different occurrences of the same surface form can resolve to
 * different clusters.
 */
export function quoteRuns(text: string, instanceTags: InstanceKeywordTag[] = []): QuoteRun[] {
	if (!text) return [];

	const kSpans: { start: number; end: number; span: KeywordSpan }[] = [];
	let offset = 0;
	for (const run of keywordRuns(text, instanceTags)) {
		if (run.span) kSpans.push({ start: offset, end: offset + run.text.length, span: run.span });
		offset += run.text.length;
	}
	const tSpans = themeMatches(text);
	if (!kSpans.length && !tSpans.length) return [{ text }];

	const bounds = new Set<number>([0, text.length]);
	for (const s of kSpans) {
		bounds.add(s.start);
		bounds.add(s.end);
	}
	for (const s of tSpans) {
		bounds.add(s.start);
		bounds.add(s.end);
	}
	const points = [...bounds].sort((a, b) => a - b);
	const runs: QuoteRun[] = [];
	for (let i = 0; i < points.length - 1; i++) {
		const a = points[i];
		const b = points[i + 1];
		if (a === b) continue;
		const kw = kSpans.find((s) => s.start <= a && s.end >= b);
		const th = tSpans.find((s) => s.start <= a && s.end >= b);
		runs.push({ text: text.slice(a, b), keyword: kw?.span, theme: th });
	}
	return runs;
}
