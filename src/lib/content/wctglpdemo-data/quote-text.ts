/**
 * quote-text.ts — combined keyword + theme + entity highlighting for
 * quote/segment text.
 *
 * Cluster variants (keyword_lexicon.json) are matched for semibold display.
 *
 * Codebook 2.0 note: theme-term highlighting (the dotted underline path) is
 * currently a no-op. The old `theme.terms[]` list was retired in codebook 2.0;
 * its role is now subsumed by per-instance cluster tagging. The `theme` field
 * on a QuoteRun is therefore always undefined; the API surface is preserved so
 * KeywordText.svelte continues to render correctly without changes.
 *
 * Phase 3 of the codebook migration adds an `entity` field on QuoteRun,
 * populated when the supplied matcher carries an entity slice. The render
 * layer (KeywordText) dispatches entity clicks to EntityDetailDrawer.
 * Cluster matches and entity matches CAN overlap at the same span — when
 * they do, both fields are populated and the render layer decides the
 * primary click target (entity wins by default).
 */
import {
	keywordRuns as legacyKeywordRuns,
	type KeywordMatcher,
	type KeywordSpan,
	type InstanceKeywordTag,
	type EntityMatch
} from './keywords';

export type ThemeSpan = { start: number; end: number; themeId: string; themeLabel: string };

function themeMatches(_text: string): ThemeSpan[] {
	return [];
}

export type QuoteRun = {
	text: string;
	keyword?: KeywordSpan;
	theme?: ThemeSpan;
	/** Phase 3: entity match that covers this run, if any. Populated only
	 *  when the matcher passed to quoteRuns has an entity slice (i.e.
	 *  was built via the indication-scoped path). The legacy default
	 *  matcher leaves this undefined. */
	entity?: EntityMatch;
};

/**
 * Split `text` into runs annotated with the keyword, theme, and/or entity
 * span each run sits inside.
 *
 * `instanceTags` (optional, text-relative offsets) override variant matches at
 * their range so different occurrences of the same surface form can resolve to
 * different clusters.
 *
 * `matcher` (optional) plugs in an indication-scoped KeywordMatcher built by
 * `buildKeywordMatcher(clusters, themes, drugs, entities)`. When omitted, falls
 * back to the static-lexicon path (legacy / interview side). Used by corpus
 * pages so highlighting respects the active indication's slice.
 */
export function quoteRuns(
	text: string,
	instanceTags: InstanceKeywordTag[] = [],
	matcher?: KeywordMatcher
): QuoteRun[] {
	if (!text) return [];

	const runner = matcher ? matcher.keywordRuns : legacyKeywordRuns;
	const kSpans: { start: number; end: number; span: KeywordSpan }[] = [];
	let offset = 0;
	for (const run of runner(text, instanceTags)) {
		if (run.span) kSpans.push({ start: offset, end: offset + run.text.length, span: run.span });
		offset += run.text.length;
	}
	const tSpans = themeMatches(text);
	// Phase 3: pull entity matches from the matcher. Falls back to empty
	// when no matcher or no entity slice — legacy callers see no change.
	const eSpans: EntityMatch[] = matcher?.entitySpans ? matcher.entitySpans(text) : [];

	if (!kSpans.length && !tSpans.length && !eSpans.length) return [{ text }];

	const bounds = new Set<number>([0, text.length]);
	for (const s of kSpans) {
		bounds.add(s.start);
		bounds.add(s.end);
	}
	for (const s of tSpans) {
		bounds.add(s.start);
		bounds.add(s.end);
	}
	for (const s of eSpans) {
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
		// Entity overlap: any EntityMatch that covers [a, b]. If multiple
		// entities overlap the same range (rare but possible — say a
		// concept and a drug both matching the same surface), we pick the
		// first hit. The multi-tag contract is preserved in the matcher's
		// entitySpans output; the render layer's choice here is just the
		// primary visible click target.
		const ent = eSpans.find((s) => s.start <= a && s.end >= b);
		runs.push({ text: text.slice(a, b), keyword: kw?.span, theme: th, entity: ent });
	}
	return runs;
}
