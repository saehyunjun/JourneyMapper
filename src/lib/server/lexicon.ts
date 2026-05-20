/**
 * Keyword lexicon & theme term editing — shared read/write helpers.
 *
 * Backs the segment tag drawer's right-click "add to keyword / theme" menu.
 * Keyword variants are written into keyword_lexicon.json; theme terms into
 * codebook.json (`terms` list, schema 1.3+). Both are surface phrases a
 * reviewer highlighted in a transcript segment.
 *
 * Backed by the local source files in dev and the KV store in prod.
 */
import bundledLexicon from '$lib/content/wctglpdemo-data/keyword_lexicon.json';
import bundledCodebook from '$lib/content/wctglpdemo-data/codebook.json';
import { loadDoc, saveDoc } from './kv-store';

const DATA_DIR = 'src/lib/content/wctglpdemo-data';
const LEXICON_PATH = `${DATA_DIR}/keyword_lexicon.json`;
const CODEBOOK_PATH = `${DATA_DIR}/codebook.json`;
const LEXICON_KEY = 'wctglpdemo:keyword_lexicon';
const CODEBOOK_KEY = 'wctglpdemo:codebook';

type LexiconFile = { categories: Category[] };
type CodebookFile = { theme_tags: Theme[]; [k: string]: unknown };

const readLexicon = () =>
	loadDoc<LexiconFile>(LEXICON_KEY, LEXICON_PATH, bundledLexicon as LexiconFile);
const readCodebook = () =>
	loadDoc<CodebookFile>(CODEBOOK_KEY, CODEBOOK_PATH, bundledCodebook as CodebookFile);

export type Keyword = { id: string; label: string; variants: string[] };
export type Category = { id: string; label: string; description: string; keywords: Keyword[] };
export type Theme = {
	id: string;
	description: string;
	group?: string;
	subthemes?: { id: string; description: string }[];
	terms?: string[];
};

export type NewThemeInput = {
	/** Slug for the new theme. If absent or already taken, a unique suffix is appended. */
	id?: string;
	/** Required when creating a theme from the drawer — a real description, not a placeholder. */
	description?: string;
	/** Optional tag_groups id. Validated against the codebook's tag_groups list. */
	group?: string;
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

async function snapshot(): Promise<LexiconState> {
	const [lex, codebook] = await Promise.all([readLexicon(), readCodebook()]);
	return { categories: lex.categories, themes: codebook.theme_tags };
}

/** Add a highlighted phrase as a new variant of an existing keyword. */
export async function addKeywordVariant(
	keywordId: string,
	rawText: string
): Promise<LexiconState> {
	const variant = normalize(rawText);
	const lex = await readLexicon();
	let keyword: Keyword | undefined;
	for (const cat of lex.categories) {
		keyword = cat.keywords.find((k) => k.id === keywordId);
		if (keyword) break;
	}
	if (!keyword) throw new Error(`Unknown keyword "${keywordId}".`);
	if (!keyword.variants.some((v) => v.toLowerCase() === variant)) {
		keyword.variants.push(variant);
		await saveDoc(LEXICON_KEY, LEXICON_PATH, lex);
	}
	return snapshot();
}

/** Create a new keyword in a category, seeded from the highlighted phrase. */
export async function createKeyword(categoryId: string, rawText: string): Promise<LexiconState> {
	const text = cleanText(rawText);
	const lex = await readLexicon();
	const category = lex.categories.find((c) => c.id === categoryId);
	if (!category) throw new Error(`Unknown category "${categoryId}".`);
	const taken = new Set<string>();
	for (const c of lex.categories) for (const k of c.keywords) taken.add(k.id);
	category.keywords.push({
		id: uniqueId(slugify(text), taken),
		label: titleCase(text),
		variants: [text.toLowerCase()]
	});
	await saveDoc(LEXICON_KEY, LEXICON_PATH, lex);
	return snapshot();
}

/** Add a highlighted phrase to an existing theme's `terms` list. */
export async function addThemeTerm(themeId: string, rawText: string): Promise<LexiconState> {
	const term = normalize(rawText);
	const codebook = await readCodebook();
	const theme = codebook.theme_tags.find((t) => t.id === themeId);
	if (!theme) throw new Error(`Unknown theme "${themeId}".`);
	if (!Array.isArray(theme.terms)) theme.terms = [];
	if (!theme.terms.some((v) => v.toLowerCase() === term)) {
		theme.terms.push(term);
		await saveDoc(CODEBOOK_KEY, CODEBOOK_PATH, codebook);
	}
	return snapshot();
}

/**
 * Create a new theme, seeded from the highlighted phrase as its first term.
 * The reviewer supplies the id, description, and group via the drawer's "New
 * theme" dialog — none are auto-generated except as a fallback when the input
 * is omitted (the legacy direct-add path).
 */
export async function createTheme(
	rawText: string,
	opts: NewThemeInput = {}
): Promise<LexiconState> {
	const text = cleanText(rawText);
	const codebook = await readCodebook();
	const taken = new Set<string>(codebook.theme_tags.map((t) => t.id));

	// Validate the optional group against the codebook's known tag_groups.
	const tagGroups = (codebook.tag_groups as { id: string }[] | undefined) ?? [];
	const knownGroups = new Set(tagGroups.map((g) => g.id));
	const group =
		typeof opts.group === 'string' && opts.group.trim() ? opts.group.trim() : '';
	if (group && !knownGroups.has(group)) {
		throw new Error(`Unknown tag group "${group}".`);
	}

	const requestedId = (opts.id ?? '').trim();
	const baseId = requestedId ? slugify(requestedId) : slugify(text);
	if (!baseId) throw new Error('Theme id is empty after slugifying.');
	if (requestedId && taken.has(baseId)) {
		throw new Error(`A theme with id "${baseId}" already exists.`);
	}
	const id = uniqueId(baseId, taken);

	const description = (opts.description ?? '').trim();

	const theme: Theme = {
		id,
		description:
			description ||
			'Added from the segment tag drawer; edit this description in codebook.json.',
		terms: [text.toLowerCase()]
	};
	if (group) theme.group = group;

	codebook.theme_tags.push(theme);
	await saveDoc(CODEBOOK_KEY, CODEBOOK_PATH, codebook);
	return snapshot();
}
