/**
 * keywords.ts
 *
 * Runtime keyword matcher over keyword_lexicon.json — the UI-side counterpart
 * to scripts/build-keyword-usage.mjs. Same lexicon, same matching rules
 * (case-insensitive; space/hyphen runs flexible; non-alphanumeric boundaries),
 * so what gets bolded on screen and what build-keyword-usage.mjs counts agree.
 *
 * Two jobs:
 *   - keywordRuns(text)  — split text into runs for rendering, keyword runs
 *                          flagged so they can be shown semibold. Overlapping
 *                          matches are resolved to one non-overlapping set.
 *   - keywordTags(text)  — the distinct keywords and categories present, used
 *                          to deterministically tag a quote.
 */
import lexiconRaw from './keyword_lexicon.json';

export type Keyword = { id: string; label: string; variants: string[] };
export type Category = { id: string; label: string; description: string; keywords: Keyword[] };
type Lexicon = { meta: unknown; categories: Category[] };

export const lexicon = lexiconRaw as Lexicon;
export const categories = lexicon.categories;

/** Normalise curly apostrophes so lexicon variants and source text agree. */
const normalize = (s: string) => s.replace(/[‘’]/g, "'");

/** Escape regex metacharacters in a literal string. */
const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * One case-insensitive regex per keyword: an alternation of all its variants,
 * longest first, bounded by non-alphanumeric lookarounds, with space/hyphen
 * runs made flexible. Identical construction to build-keyword-usage.mjs.
 */
function keywordRegex(kw: Keyword): RegExp {
	const alts = [...kw.variants]
		.map(normalize)
		.sort((a, b) => b.length - a.length)
		.map((v) => escapeRegex(v).replace(/[\s-]+/g, '[\\s-]+'));
	return new RegExp(`(?<![A-Za-z0-9])(?:${alts.join('|')})(?![A-Za-z0-9])`, 'gi');
}

// Precompile every keyword once, keeping a back-pointer to its category.
const compiled = categories.flatMap((category) =>
	category.keywords.map((keyword) => ({ keyword, category, regex: keywordRegex(keyword) }))
);

export type KeywordSpan = {
	start: number;
	end: number;
	text: string;
	keywordId: string;
	keywordLabel: string;
	categoryId: string;
	categoryLabel: string;
};

/** Every keyword match in `text`, possibly overlapping across keywords. */
function rawMatches(text: string): KeywordSpan[] {
	const norm = normalize(text);
	const out: KeywordSpan[] = [];
	for (const { keyword, category, regex } of compiled) {
		regex.lastIndex = 0;
		for (const m of norm.matchAll(regex)) {
			const start = m.index ?? 0;
			const end = start + m[0].length;
			out.push({
				start,
				end,
				text: text.slice(start, end),
				keywordId: keyword.id,
				keywordLabel: keyword.label,
				categoryId: category.id,
				categoryLabel: category.label
			});
		}
	}
	return out;
}

export type TextRun = { text: string; span?: KeywordSpan };

/**
 * Split `text` into consecutive runs. Runs carrying a `span` are keyword hits
 * (render them semibold); the rest are plain. Overlapping matches are resolved
 * earliest-then-longest so each character belongs to at most one keyword run.
 */
export function keywordRuns(text: string): TextRun[] {
	const spans = rawMatches(text).sort((a, b) => a.start - b.start || b.end - a.end);
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
 * The distinct keywords and categories present in `text` — the deterministic
 * keyword tags for a quote. Unlike keywordRuns this keeps every match (so
 * "oral GLP-1" tags both `oral_medication` and `glp_1`); order follows the
 * lexicon. Returns empty arrays when nothing matches.
 */
export function keywordTags(text: string): KeywordTags {
	const matches = rawMatches(text);
	const keywordIds = new Set(matches.map((m) => m.keywordId));
	const categoryIds = new Set(matches.map((m) => m.categoryId));

	const keywords: KeywordTags['keywords'] = [];
	const cats: KeywordTags['categories'] = [];
	for (const category of categories) {
		if (categoryIds.has(category.id)) cats.push({ id: category.id, label: category.label });
		for (const kw of category.keywords) {
			if (keywordIds.has(kw.id))
				keywords.push({ id: kw.id, label: kw.label, categoryId: category.id });
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

/**
 * Total keyword mentions across a set of texts, ranked by count. Every match is
 * counted (overlaps included, same as keywordTags), so this is a deterministic
 * word-usage tally for whatever slice of participant speech is passed in.
 */
export function keywordCounts(texts: string[]): KeywordCount[] {
	const tally = new Map<string, number>();
	for (const t of texts) {
		for (const m of rawMatches(t)) tally.set(m.keywordId, (tally.get(m.keywordId) ?? 0) + 1);
	}
	const out: KeywordCount[] = [];
	for (const category of categories) {
		for (const kw of category.keywords) {
			const count = tally.get(kw.id) ?? 0;
			if (count > 0) {
				out.push({
					keywordId: kw.id,
					keywordLabel: kw.label,
					categoryId: category.id,
					categoryLabel: category.label,
					count
				});
			}
		}
	}
	return out.sort((a, b) => b.count - a.count || a.keywordLabel.localeCompare(b.keywordLabel));
}
