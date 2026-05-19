/**
 * Keyword lexicon & theme term editing — shared read/write helpers.
 *
 * Backs the segment tag drawer's right-click "add to keyword / theme" menu.
 * Keyword variants are written into keyword_lexicon.json; theme terms into
 * codebook.json (`terms` list, schema 1.3+). Both are surface phrases a
 * reviewer highlighted in a transcript segment.
 *
 * Note: writes into the source tree, so this is a dev/demo-time operation —
 * the same caveat as $lib/server/segment-tags.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const DATA_DIR = 'src/lib/content/wctglpdemo-data';
const LEXICON_PATH = `${DATA_DIR}/keyword_lexicon.json`;
const CODEBOOK_PATH = `${DATA_DIR}/codebook.json`;

const read = (path: string) => JSON.parse(readFileSync(resolve(path), 'utf8'));
const write = (path: string, data: unknown) =>
	writeFileSync(resolve(path), JSON.stringify(data, null, 2) + '\n', 'utf8');

export type Keyword = { id: string; label: string; variants: string[] };
export type Category = { id: string; label: string; description: string; keywords: Keyword[] };
export type Theme = {
	id: string;
	description: string;
	subthemes?: { id: string; description: string }[];
	terms?: string[];
};

/** The lists the drawer renders — returned after every edit so it can refresh. */
export type LexiconState = { categories: Category[]; themes: Theme[] };

const MAX_LEN = 80;

/** Trim and collapse whitespace; throw if empty, too long, or all punctuation. */
function cleanText(raw: unknown): string {
	const t = String(raw ?? '')
		.replace(/\s+/g, ' ')
		.trim();
	if (!t) throw new Error('Nothing is selected.');
	if (t.length > MAX_LEN) throw new Error(`Selection is too long (max ${MAX_LEN} characters).`);
	if (!/[a-z0-9]/i.test(t)) throw new Error('Selection has no usable text.');
	return t;
}

/** Lowercased, whitespace-collapsed form stored as a matchable variant/term. */
const normalize = (t: string) => cleanText(t).toLowerCase();

const titleCase = (t: string) => t.replace(/\b\w/g, (c) => c.toUpperCase());

/** Slug suitable for a keyword/theme id, derived from highlighted text. */
function slugify(t: string): string {
	return t
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '_')
		.replace(/^_+|_+$/g, '')
		.slice(0, 40);
}

function uniqueId(base: string, taken: Set<string>): string {
	const root = base || 'item';
	let id = root;
	let n = 2;
	while (taken.has(id)) id = `${root}_${n++}`;
	return id;
}

function snapshot(): LexiconState {
	return { categories: read(LEXICON_PATH).categories, themes: read(CODEBOOK_PATH).theme_tags };
}

/** Add a highlighted phrase as a new variant of an existing keyword. */
export function addKeywordVariant(keywordId: string, rawText: string): LexiconState {
	const variant = normalize(rawText);
	const lex = read(LEXICON_PATH);
	let keyword: Keyword | undefined;
	for (const cat of lex.categories as Category[]) {
		keyword = cat.keywords.find((k) => k.id === keywordId);
		if (keyword) break;
	}
	if (!keyword) throw new Error(`Unknown keyword "${keywordId}".`);
	if (!keyword.variants.some((v) => v.toLowerCase() === variant)) {
		keyword.variants.push(variant);
		write(LEXICON_PATH, lex);
	}
	return snapshot();
}

/** Create a new keyword in a category, seeded from the highlighted phrase. */
export function createKeyword(categoryId: string, rawText: string): LexiconState {
	const text = cleanText(rawText);
	const lex = read(LEXICON_PATH);
	const category = (lex.categories as Category[]).find((c) => c.id === categoryId);
	if (!category) throw new Error(`Unknown category "${categoryId}".`);
	const taken = new Set<string>();
	for (const c of lex.categories as Category[]) for (const k of c.keywords) taken.add(k.id);
	category.keywords.push({
		id: uniqueId(slugify(text), taken),
		label: titleCase(text),
		variants: [text.toLowerCase()]
	});
	write(LEXICON_PATH, lex);
	return snapshot();
}

/** Add a highlighted phrase to an existing theme's `terms` list. */
export function addThemeTerm(themeId: string, rawText: string): LexiconState {
	const term = normalize(rawText);
	const codebook = read(CODEBOOK_PATH);
	const theme = (codebook.theme_tags as Theme[]).find((t) => t.id === themeId);
	if (!theme) throw new Error(`Unknown theme "${themeId}".`);
	if (!Array.isArray(theme.terms)) theme.terms = [];
	if (!theme.terms.some((v) => v.toLowerCase() === term)) {
		theme.terms.push(term);
		write(CODEBOOK_PATH, codebook);
	}
	return snapshot();
}

/** Create a new theme, seeded from the highlighted phrase as its first term. */
export function createTheme(rawText: string): LexiconState {
	const text = cleanText(rawText);
	const codebook = read(CODEBOOK_PATH);
	const taken = new Set<string>((codebook.theme_tags as Theme[]).map((t) => t.id));
	(codebook.theme_tags as Theme[]).push({
		id: uniqueId(slugify(text), taken),
		description: 'Added from the segment tag drawer; edit this description in codebook.json.',
		terms: [text.toLowerCase()]
	});
	write(CODEBOOK_PATH, codebook);
	return snapshot();
}
