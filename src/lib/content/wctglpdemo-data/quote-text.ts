/**
 * quote-text.ts — combined keyword + theme highlighting for quote/segment text.
 *
 * Keyword variants (keyword_lexicon.json) are matched for semibold display;
 * theme `terms` (codebook.json, schema 1.3+) are matched for a dotted
 * underline. `quoteRuns()` splits text so each run knows which — if either —
 * span it sits inside; a run may carry both. Powers KeywordText.svelte
 * wherever participant speech is shown, so highlighting is consistent.
 */
import codebookRaw from './codebook.json';
import { keywordRuns, type KeywordSpan } from './keywords';

type CodebookTheme = { id: string; terms?: string[] };

/** Normalise curly apostrophes so terms and source text agree. */
const normalize = (s: string) => s.replace(/[‘’]/g, "'");
const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const titleCase = (id: string) =>
	id.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

/**
 * Bounded, whitespace-flexible, case-insensitive regex for one literal phrase —
 * the same construction keywords.ts uses, so matching rules stay identical.
 */
function phraseRegex(phrase: string): RegExp {
	const v = escapeRegex(normalize(phrase)).replace(/[\s-]+/g, '[\\s-]+');
	return new RegExp(`(?<![A-Za-z0-9])(?:${v})(?![A-Za-z0-9])`, 'gi');
}

// Every theme term compiled once, with a back-pointer to its theme.
const themeTerms = (codebookRaw.theme_tags as CodebookTheme[]).flatMap((theme) =>
	(theme.terms ?? []).map((term) => ({
		themeId: theme.id,
		themeLabel: titleCase(theme.id),
		regex: phraseRegex(term)
	}))
);

export type ThemeSpan = { start: number; end: number; themeId: string; themeLabel: string };

/** Non-overlapping theme-term matches in `text` (earliest-then-longest wins). */
function themeMatches(text: string): ThemeSpan[] {
	if (!themeTerms.length) return [];
	const norm = normalize(text);
	const raw: ThemeSpan[] = [];
	for (const { themeId, themeLabel, regex } of themeTerms) {
		regex.lastIndex = 0;
		for (const m of norm.matchAll(regex)) {
			const start = m.index ?? 0;
			raw.push({ start, end: start + m[0].length, themeId, themeLabel });
		}
	}
	raw.sort((a, b) => a.start - b.start || b.end - a.end);
	const picked: ThemeSpan[] = [];
	let lastEnd = -1;
	for (const s of raw) {
		if (s.start >= lastEnd) {
			picked.push(s);
			lastEnd = s.end;
		}
	}
	return picked;
}

export type QuoteRun = { text: string; keyword?: KeywordSpan; theme?: ThemeSpan };

/**
 * Split `text` into runs annotated with the keyword and/or theme span each run
 * sits inside. A run may carry both — keyword (semibold) and theme (dotted
 * underline) highlighting are independent.
 */
export function quoteRuns(text: string): QuoteRun[] {
	if (!text) return [];

	// Positioned keyword spans, from the existing non-overlapping keyword runs.
	const kSpans: { start: number; end: number; span: KeywordSpan }[] = [];
	let offset = 0;
	for (const run of keywordRuns(text)) {
		if (run.span) kSpans.push({ start: offset, end: offset + run.text.length, span: run.span });
		offset += run.text.length;
	}
	const tSpans = themeMatches(text);
	if (!kSpans.length && !tSpans.length) return [{ text }];

	// Cut at every span boundary, then label each slice by the spans covering it.
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
