/**
 * keywords.ts
 *
 * Runtime keyword matcher over keyword_lexicon.json — the UI-side counterpart
 * to scripts/build-keyword-usage.mjs. Same lexicon, same matching rules
 * (case-insensitive; space/hyphen runs flexible; non-alphanumeric boundaries),
 * so what gets bolded on screen and what build-keyword-usage.mjs counts agree.
 *
 * Codebook 2.0 note: clusters in the new lexicon are flat and declare
 * parent_theme + parent_subtheme. To keep the API surface stable for many
 * downstream consumers (KeywordOrbit, ThemeHeatmap, analysis-page), the
 * exported field names `categoryId` / `categoryLabel` now carry the cluster's
 * `parent_subtheme` id and the subtheme's display label respectively. The
 * "category" axis has been retired; what was once a domain category is now
 * always a codebook subtheme.
 */
import lexiconRaw from './keyword_lexicon.json';
import codebookRaw from './codebook.json';

export type Cluster = {
	id: string;
	label: string;
	description?: string;
	parent_theme: string;
	parent_subtheme: string;
	variants: string[];
};
type Lexicon = { meta?: unknown; clusters: Cluster[] };

type CodebookSubtheme = { id: string; label?: string; description?: string };
type CodebookTheme = { id: string; label?: string; subthemes?: CodebookSubtheme[] };
type Codebook = { themes: CodebookTheme[] };

const lexicon = lexiconRaw as Lexicon;
export const clusters = lexicon.clusters;

const codebook = codebookRaw as Codebook;
const subthemeLabel = new Map<string, string>();
for (const t of codebook.themes ?? []) {
	for (const s of t.subthemes ?? []) subthemeLabel.set(s.id, s.label ?? s.id);
}

/**
 * Codebook 2.0 transitional shim. The old `categories[].keywords[]` shape is
 * recreated here by grouping flat clusters under their `parent_subtheme`.
 * Consumers reading from this re-export get an equivalent tree; the "category"
 * label is the parent subtheme's display label.
 */
export type Keyword = Cluster;
export type Category = { id: string; label: string; description: string; keywords: Keyword[] };
export const categories: Category[] = (() => {
	const byParent = new Map<string, Keyword[]>();
	for (const c of clusters) {
		const list = byParent.get(c.parent_subtheme) ?? [];
		list.push(c);
		byParent.set(c.parent_subtheme, list);
	}
	return [...byParent.entries()].map(([id, keywords]) => ({
		id,
		label: subthemeLabel.get(id) ?? id,
		description: '',
		keywords
	}));
})();

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

const compiled = clusters.map((cluster) => ({
	cluster,
	regex: clusterRegex(cluster),
	parentSubthemeLabel: subthemeLabel.get(cluster.parent_subtheme) ?? cluster.parent_subtheme
}));

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

const clusterById = new Map(clusters.map((c) => [c.id, c]));

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

export type TextRun = { text: string; span?: KeywordSpan };

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
		categoryLabel: subthemeLabel.get(cluster.parent_subtheme) ?? cluster.parent_subtheme,
		isInstance: true
	};
}

/**
 * Split `text` into runs with optional per-cluster annotation. Per-instance
 * tags win at their range; variant matches that overlap an instance tag are
 * dropped so the same surface form can resolve to different clusters in
 * different occurrences within the same text.
 */
export function keywordRuns(text: string, instanceTags: InstanceKeywordTag[] = []): TextRun[] {
	// Resolve instance tags first and discard any that overlap each other
	// (later tag is dropped — the natural-key write path should already prevent
	// this, but be defensive at the renderer too).
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

export type KeywordTags = {
	categories: { id: string; label: string }[];
	keywords: { id: string; label: string; categoryId: string }[];
};

/**
 * The distinct clusters and their parent subthemes present in `text` — kept
 * under the old `keywords` / `categories` names for consumer compatibility.
 */
export function keywordTags(text: string): KeywordTags {
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
				label: subthemeLabel.get(cluster.parent_subtheme) ?? cluster.parent_subtheme
			});
		}
	}
	return { categories: cats, keywords };
}

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

export function keywordCounts(texts: string[]): KeywordCount[] {
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
				categoryLabel: subthemeLabel.get(cluster.parent_subtheme) ?? cluster.parent_subtheme,
				count
			});
		}
	}
	return out.sort((a, b) => b.count - a.count || a.keywordLabel.localeCompare(b.keywordLabel));
}

export function keywordBlocks(
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
				categoryLabel: subthemeLabel.get(cluster.parent_subtheme) ?? cluster.parent_subtheme,
				blocks
			});
		}
	}
	return out.sort(
		(a, b) => b.blocks.length - a.blocks.length || a.keywordLabel.localeCompare(b.keywordLabel)
	);
}
