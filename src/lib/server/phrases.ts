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
 * Note: writes into the source tree, so this is a dev/demo-time operation —
 * same caveat as $lib/server/segment-tags.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const DATA_DIR = 'src/lib/content/wctglpdemo-data';
const PHRASES_PATH = `${DATA_DIR}/phrase_lexicon.json`;

const read = (path: string) => JSON.parse(readFileSync(resolve(path), 'utf8'));
const write = (path: string, data: unknown) =>
	writeFileSync(resolve(path), JSON.stringify(data, null, 2) + '\n', 'utf8');

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

function snapshot(): PhraseState {
	return { key_phrases: read(PHRASES_PATH).key_phrases ?? [] };
}

/**
 * Add a highlighted snippet as a variant of an existing key phrase. Skips the
 * write if the same segment already contributes the same text.
 */
export function addPhraseVariant(
	keyPhraseId: string,
	rawText: string,
	segmentId: string,
	interviewId: string
): PhraseState {
	const text = cleanText(rawText);
	if (!segmentId || !interviewId) throw new Error('segment_id and interview_id are required.');
	const data = read(PHRASES_PATH);
	const phrases = data.key_phrases as KeyPhrase[];
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
		write(PHRASES_PATH, data);
	}
	return snapshot();
}

/**
 * Create a new key phrase, seeded with the highlighted snippet as its first
 * variant. Label defaults to a title-cased version of the snippet; the
 * reviewer can rename later by editing phrase_lexicon.json directly.
 */
export function createKeyPhrase(
	rawText: string,
	segmentId: string,
	interviewId: string,
	label?: string
): PhraseState {
	const text = cleanText(rawText);
	if (!segmentId || !interviewId) throw new Error('segment_id and interview_id are required.');
	const data = read(PHRASES_PATH);
	const phrases = data.key_phrases as KeyPhrase[];
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
	write(PHRASES_PATH, data);
	return snapshot();
}
