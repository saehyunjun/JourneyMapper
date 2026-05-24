/**
 * keywords.ts
 *
 * Runtime keyword matcher over the lexicon — the UI-side counterpart to
 * scripts/build-keyword-usage.mjs. Same lexicon, same matching rules
 * (case-insensitive; space/hyphen runs flexible; non-alphanumeric boundaries),
 * so what gets bolded on screen and what build-keyword-usage.mjs counts agree.
 *
 * Two ways to use this module:
 *
 *   1. **Factory (preferred, indication-scoped).** Call
 *      `buildKeywordMatcher(clusters, themes)` with a slice fetched from
 *      `/api/lexicon?indication=<id>` (or the server's `getLexiconSlice`).
 *      Use this for any new consumer — it avoids pulling the full lexicon
 *      into the client bundle and lets the toggle UI swap matchers per
 *      indication.
 *
 *   2. **Default matcher (legacy, full-bundle).** The module-level exports
 *      (`keywordRuns`, `keywordTags`, `keywordCounts`, `keywordBlocks`,
 *      `clusters`, `categories`) are built lazily from the statically-
 *      imported `keyword_lexicon.json` + `codebook.json`. This forces the
 *      whole lexicon into every page's bundle. Existing consumers still use
 *      this path; migrate them to the factory + the `/api/lexicon` endpoint
 *      as you touch them. New code should NOT use the default matcher.
 *
 * Codebook 2.0 note: clusters declare parent_theme + parent_subtheme. The
 * exported `categoryId` / `categoryLabel` field names on spans/counts carry
 * the parent_subtheme id and the subtheme's display label respectively — kept
 * under those names for compatibility with downstream consumers
 * (KeywordOrbit, ThemeHeatmap, analysis-page).
 */
import lexiconRaw from './keyword_lexicon.json';
import codebookRaw from './codebook.json';

// --- Types ------------------------------------------------------------------

export type Cluster = {
	id: string;
	label: string;
	description?: string;
	/** Lexicon 3.2+: string[] FK → registries/indications.json items[].id.
	 *  Empty array = cross-cutting (visible under every indication). Optional
	 *  on reads so legacy 3.1 rows with singular `indication: string` still
	 *  parse. */
	indications?: string[];
	/** Lexicon 3.4: string[] FK → registries/burden_categories.json items[].id.
	 *  Empty array = unclassified. Cross-cutting axis parallel to indications. */
	burden_category_ids?: string[];
	parent_theme: string;
	parent_subtheme: string;
	variants: string[];
};

type Lexicon = { meta?: unknown; clusters: Cluster[] };

type CodebookSubtheme = { id: string; label?: string; description?: string };
type CodebookTheme = { id: string; label?: string; subthemes?: CodebookSubtheme[] };
type Codebook = { themes: CodebookTheme[] };

export type Keyword = Cluster;
export type Category = { id: string; label: string; description: string; keywords: Keyword[] };

export type KeywordSpan = {
	start: number;
	end: number;
	text: string;
	keywordId: string;
	keywordLabel: string;
	categoryId: string; // = cluster.parent_subtheme (transitional name)
	categoryLabel: string; // = label of that parent subtheme
	/** True when the span came from a per-instance keyword_tags row, not the
	 *  lexicon's variant regex. Used by KeywordText to mark the DOM span so the
	 *  drawer's right-click handler can target the per-instance row. */
	isInstance?: boolean;
};

/** Per-instance keyword tag, in text-relative offsets. Source-of-truth lives in
 *  keyword_tags.json keyed on (segment_id, char_start, char_end); the caller is
 *  responsible for filtering to the current segment and subtracting the
 *  segment's char_start before passing in. */
export type InstanceKeywordTag = { start: number; end: number; keywordId: string };

export type TextRun = { text: string; span?: KeywordSpan };

export type KeywordTags = {
	categories: { id: string; label: string }[];
	keywords: { id: string; label: string; categoryId: string }[];
};

export type KeywordCount = {
	keywordId: string;
	keywordLabel: string;
	categoryId: string;
	categoryLabel: string;
	count: number;
};

export type KeywordBlocks = {
	keywordId: string;
	keywordLabel: string;
	categoryId: string;
	categoryLabel: string;
	blocks: { sentiment: number }[];
};

/** The full matcher API. Returned by `buildKeywordMatcher`; the module-level
 *  exports are this same shape, built from the bundled lexicon. */
export type KeywordMatcher = {
	clusters: Cluster[];
	categories: Category[];
	keywordRuns(text: string, instanceTags?: InstanceKeywordTag[]): TextRun[];
	keywordTags(text: string): KeywordTags;
	keywordCounts(texts: string[]): KeywordCount[];
	keywordBlocks(fragments: { text: string; sentiment: number }[]): KeywordBlocks[];
};

// --- Internal helpers (pure, no module-level state) -------------------------

const normalize = (s: string) => s.replace(/[‘’]/g, "'");
const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * One case-insensitive regex per cluster: an alternation of all its variants,
 * longest first, bounded by non-alphanumeric lookarounds, with space/hyphen
 * runs made flexible. Identical construction to build-keyword-usage.mjs.
 */
function clusterRegex(c: Cluster): RegExp {
	const alts = [...c.variants]
		.map(normalize)
		.sort((a, b) => b.length - a.length)
		.map((v) => escapeRegex(v).replace(/[\s-]+/g, '[\\s-]+'));
	return new RegExp(`(?<![A-Za-z0-9])(?:${alts.join('|')})(?![A-Za-z0-9])`, 'gi');
}

function subthemeLabelMap(themes: CodebookTheme[]): Map<string, string> {
	const m = new Map<string, string>();
	for (const t of themes ?? []) {
		for (const s of t.subthemes ?? []) m.set(s.id, s.label ?? s.id);
	}
	return m;
}

// --- Factory ----------------------------------------------------------------

/**
 * Build a matcher from an explicit clusters slice and codebook themes — the
 * indication-scoped path. Consumers fetch a slice from `/api/lexicon` (or
 * `getLexiconSlice` server-side) and pass it through here, so only the active
 * indication's clusters plus every cross-cutting cluster (indications: [])
 * get compiled into regexes and shipped to the client.
 */
export function buildKeywordMatcher(
	clusters: Cluster[],
	themes: CodebookTheme[]
): KeywordMatcher {
	const subLabel = subthemeLabelMap(themes);
	const compiled = clusters.map((cluster) => ({
		cluster,
		regex: clusterRegex(cluster),
		parentSubthemeLabel: subLabel.get(cluster.parent_subtheme) ?? cluster.parent_subtheme
	}));
	const clusterById = new Map(clusters.map((c) => [c.id, c]));

	/** Codebook 2.0 transitional shim — group flat clusters under their
	 *  parent_subtheme so consumers expecting the old `categories[].keywords[]`
	 *  shape keep working. */
	const categories: Category[] = (() => {
		const byParent = new Map<string, Keyword[]>();
		for (const c of clusters) {
			const list = byParent.get(c.parent_subtheme) ?? [];
			list.push(c);
			byParent.set(c.parent_subtheme, list);
		}
		return [...byParent.entries()].map(([id, keywords]) => ({
			id,
			label: subLabel.get(id) ?? id,
			description: '',
			keywords
		}));
	})();

	/** Every cluster match in `text`, possibly overlapping across clusters. */
	function rawMatches(text: string): KeywordSpan[] {
		const norm = normalize(text);
		const out: KeywordSpan[] = [];
		for (const { cluster, regex, parentSubthemeLabel } of compiled) {
			regex.lastIndex = 0;
			for (const m of norm.matchAll(regex)) {
				const start = m.index ?? 0;
				const end = start + m[0].length;
				out.push({
					start,
					end,
					text: text.slice(start, end),
					keywordId: cluster.id,
					keywordLabel: cluster.label,
					categoryId: cluster.parent_subtheme,
					categoryLabel: parentSubthemeLabel
				});
			}
		}
		return out;
	}

	function instanceTagToSpan(tag: InstanceKeywordTag, text: string): KeywordSpan | null {
		const cluster = clusterById.get(tag.keywordId);
		if (!cluster) return null;
		if (tag.start < 0 || tag.end > text.length || tag.end <= tag.start) return null;
		return {
			start: tag.start,
			end: tag.end,
			text: text.slice(tag.start, tag.end),
			keywordId: cluster.id,
			keywordLabel: cluster.label,
			categoryId: cluster.parent_subtheme,
			categoryLabel: subLabel.get(cluster.parent_subtheme) ?? cluster.parent_subtheme,
			isInstance: true
		};
	}

	function keywordRuns(text: string, instanceTags: InstanceKeywordTag[] = []): TextRun[] {
		const instanceCandidates = instanceTags
			.map((t) => instanceTagToSpan(t, text))
			.filter((s): s is KeywordSpan => !!s)
			.sort((a, b) => a.start - b.start || b.end - a.end);
		const instanceSpans: KeywordSpan[] = [];
		let lastInstanceEnd = -1;
		for (const s of instanceCandidates) {
			if (s.start >= lastInstanceEnd) {
				instanceSpans.push(s);
				lastInstanceEnd = s.end;
			}
		}

		const overlapsInstance = (a: number, b: number) =>
			instanceSpans.some((is) => is.start < b && a < is.end);
		const variantSpans = rawMatches(text).filter((vs) => !overlapsInstance(vs.start, vs.end));

		const spans = [...instanceSpans, ...variantSpans].sort(
			(a, b) => a.start - b.start || b.end - a.end
		);
		const picked: KeywordSpan[] = [];
		let lastEnd = -1;
		for (const s of spans) {
			if (s.start >= lastEnd) {
				picked.push(s);
				lastEnd = s.end;
			}
		}
		if (!picked.length) return [{ text }];

		const runs: TextRun[] = [];
		let cursor = 0;
		for (const s of picked) {
			if (s.start > cursor) runs.push({ text: text.slice(cursor, s.start) });
			runs.push({ text: text.slice(s.start, s.end), span: s });
			cursor = s.end;
		}
		if (cursor < text.length) runs.push({ text: text.slice(cursor) });
		return runs;
	}

	function keywordTags(text: string): KeywordTags {
		const matches = rawMatches(text);
		const keywordIds = new Set(matches.map((m) => m.keywordId));
		const categoryIds = new Set(matches.map((m) => m.categoryId));

		const seenCats = new Set<string>();
		const cats: KeywordTags['categories'] = [];
		const keywords: KeywordTags['keywords'] = [];
		for (const cluster of clusters) {
			if (keywordIds.has(cluster.id))
				keywords.push({ id: cluster.id, label: cluster.label, categoryId: cluster.parent_subtheme });
			if (categoryIds.has(cluster.parent_subtheme) && !seenCats.has(cluster.parent_subtheme)) {
				seenCats.add(cluster.parent_subtheme);
				cats.push({
					id: cluster.parent_subtheme,
					label: subLabel.get(cluster.parent_subtheme) ?? cluster.parent_subtheme
				});
			}
		}
		return { categories: cats, keywords };
	}

	function keywordCounts(texts: string[]): KeywordCount[] {
		const tally = new Map<string, number>();
		for (const t of texts) {
			for (const m of rawMatches(t)) tally.set(m.keywordId, (tally.get(m.keywordId) ?? 0) + 1);
		}
		const out: KeywordCount[] = [];
		for (const cluster of clusters) {
			const count = tally.get(cluster.id) ?? 0;
			if (count > 0) {
				out.push({
					keywordId: cluster.id,
					keywordLabel: cluster.label,
					categoryId: cluster.parent_subtheme,
					categoryLabel: subLabel.get(cluster.parent_subtheme) ?? cluster.parent_subtheme,
					count
				});
			}
		}
		return out.sort((a, b) => b.count - a.count || a.keywordLabel.localeCompare(b.keywordLabel));
	}

	function keywordBlocks(
		fragments: { text: string; sentiment: number }[]
	): KeywordBlocks[] {
		const blocksByKw = new Map<string, { sentiment: number }[]>();
		for (const f of fragments) {
			const ids = new Set<string>();
			for (const m of rawMatches(f.text)) ids.add(m.keywordId);
			for (const id of ids) {
				let list = blocksByKw.get(id);
				if (!list) {
					list = [];
					blocksByKw.set(id, list);
				}
				list.push({ sentiment: f.sentiment });
			}
		}
		const out: KeywordBlocks[] = [];
		for (const cluster of clusters) {
			const blocks = blocksByKw.get(cluster.id);
			if (blocks && blocks.length) {
				out.push({
					keywordId: cluster.id,
					keywordLabel: cluster.label,
					categoryId: cluster.parent_subtheme,
					categoryLabel: subLabel.get(cluster.parent_subtheme) ?? cluster.parent_subtheme,
					blocks
				});
			}
		}
		return out.sort(
			(a, b) => b.blocks.length - a.blocks.length || a.keywordLabel.localeCompare(b.keywordLabel)
		);
	}

	return { clusters, categories, keywordRuns, keywordTags, keywordCounts, keywordBlocks };
}

// --- Legacy default matcher (deprecated — full-bundle path) -----------------
// The exports below build a matcher from the statically-imported lexicon +
// codebook. This forces the whole lexicon into every page that imports this
// module. Existing consumers (KeywordOrbit, ThemeHeatmap, analysis +page,
// interview-words +page, topicTree, journey, lexicon-stats, quote-text) still
// use this path; migrate them to `buildKeywordMatcher` + `/api/lexicon` as
// each one is touched. Once all callers have migrated, delete the static
// imports above and the block below.

const defaultMatcher: KeywordMatcher = buildKeywordMatcher(
	(lexiconRaw as Lexicon).clusters,
	(codebookRaw as Codebook).themes
);

/** @deprecated Use `buildKeywordMatcher(slice.clusters, slice.themes).clusters` with a slice from `/api/lexicon`. */
export const clusters = defaultMatcher.clusters;
/** @deprecated Use `buildKeywordMatcher(...).categories`. */
export const categories = defaultMatcher.categories;
/** @deprecated Use `buildKeywordMatcher(...).keywordRuns`. */
export const keywordRuns = defaultMatcher.keywordRuns;
/** @deprecated Use `buildKeywordMatcher(...).keywordTags`. */
export const keywordTags = defaultMatcher.keywordTags;
/** @deprecated Use `buildKeywordMatcher(...).keywordCounts`. */
export const keywordCounts = defaultMatcher.keywordCounts;
/** @deprecated Use `buildKeywordMatcher(...).keywordBlocks`. */
export const keywordBlocks = defaultMatcher.keywordBlocks;
