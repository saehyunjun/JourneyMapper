/**
 * Key-phrase lexicon — shared read/write helpers.
 *
 * Backs the segment tag drawer's right-click "as a key phrase" menu. A
 * key_phrase is a canonical label (e.g. "Recurrent past weight gain") with a
 * list of surface variants — the actual highlighted snippets from segments —
 * each carrying its segment_id and interview_id so the canonical phrase can
 * back-link to the participant utterances it stands for.
 *
 * Unlike keyword_lexicon.json (lexical surface forms, deterministic regex
 * matching), key-phrase variants are semantic: two variants under one phrase
 * may share no surface form. Tagging is always manual from the drawer.
 *
 * Backed by the local source file in dev and the KV store in prod.
 */
import bundledPhrases from '$lib/content/wctglpdemo-data/phrase_lexicon.json';
import { loadDoc, saveDoc } from './kv-store';

const DATA_DIR = 'src/lib/content/wctglpdemo-data';
const PHRASES_PATH = `${DATA_DIR}/phrase_lexicon.json`;
const KV_KEY = 'wctglpdemo:phrase_lexicon';

type PhrasesFile = { key_phrases: KeyPhrase[]; [k: string]: unknown };

const read = () => loadDoc<PhrasesFile>(KV_KEY, PHRASES_PATH, bundledPhrases as PhrasesFile);

export type PhraseVariant = {
	text: string;
	segment_id: string;
	interview_id: string;
	created_at: string;
};

export type KeyPhrase = {
	id: string;
	label: string;
	variants: PhraseVariant[];
};

/** Returned after every edit so the drawer can refresh its menus. */
export type PhraseState = { key_phrases: KeyPhrase[] };

const MAX_LEN = 160;

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

const titleCase = (t: string) => t.replace(/\b\w/g, (c) => c.toUpperCase());

/** Slug suitable for a key-phrase id, derived from highlighted text. */
function slugify(t: string): string {
	return t
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '_')
		.replace(/^_+|_+$/g, '')
		.slice(0, 48);
}

function uniqueId(base: string, taken: Set<string>): string {
	const root = base || 'phrase';
	let id = root;
	let n = 2;
	while (taken.has(id)) id = `${root}_${n++}`;
	return id;
}

async function snapshot(): Promise<PhraseState> {
	const data = await read();
	return { key_phrases: data.key_phrases ?? [] };
}

/**
 * Add a highlighted snippet as a variant of an existing key phrase. Skips the
 * write if the same segment already contributes the same text.
 */
export async function addPhraseVariant(
	keyPhraseId: string,
	rawText: string,
	segmentId: string,
	interviewId: string
): Promise<PhraseState> {
	const text = cleanText(rawText);
	if (!segmentId || !interviewId) throw new Error('segment_id and interview_id are required.');
	const data = await read();
	const phrases = data.key_phrases;
	const phrase = phrases.find((p) => p.id === keyPhraseId);
	if (!phrase) throw new Error(`Unknown key phrase "${keyPhraseId}".`);
	const dup = phrase.variants.some(
		(v) => v.segment_id === segmentId && v.text.toLowerCase() === text.toLowerCase()
	);
	if (!dup) {
		phrase.variants.push({
			text,
			segment_id: segmentId,
			interview_id: interviewId,
			created_at: new Date().toISOString()
		});
		await saveDoc(KV_KEY, PHRASES_PATH, data);
	}
	return snapshot();
}

/**
 * Create a new key phrase, seeded with the highlighted snippet as its first
 * variant. Label defaults to a title-cased version of the snippet; the
 * reviewer can rename later by editing phrase_lexicon.json directly.
 */
export async function createKeyPhrase(
	rawText: string,
	segmentId: string,
	interviewId: string,
	label?: string
): Promise<PhraseState> {
	const text = cleanText(rawText);
	if (!segmentId || !interviewId) throw new Error('segment_id and interview_id are required.');
	const data = await read();
	const phrases = data.key_phrases;
	const taken = new Set(phrases.map((p) => p.id));
	const cleanLabel = label ? cleanText(label) : titleCase(text);
	phrases.push({
		id: uniqueId(slugify(cleanLabel), taken),
		label: cleanLabel,
		variants: [
			{
				text,
				segment_id: segmentId,
				interview_id: interviewId,
				created_at: new Date().toISOString()
			}
		]
	});
	await saveDoc(KV_KEY, PHRASES_PATH, data);
	return snapshot();
}
