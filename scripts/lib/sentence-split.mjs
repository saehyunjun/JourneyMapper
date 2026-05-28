/**
 * sentence-split.mjs — deterministic sentence splitter with char-offset round-trip.
 *
 * Imported by:
 *   - scripts/build-segments.mjs (sentence-splits interview participant turns)
 *   - scripts/import-forum-as-fragments.mjs (sentence-splits long social posts /
 *     comments at ingest, when split_long_fragments is enabled)
 *
 * Returns [{ text, start, end }] where text.slice(start, end) === text of the
 * sentence (after trimming leading whitespace). Idempotent: re-joining segments
 * by re-slicing the source reproduces the original whitespace structure exactly.
 *
 * Tuned for transcribed speech / forum prose: handles abbreviations + initials,
 * skips boundaries where the next char doesn't look like a sentence start.
 */

// Words that take a trailing period without ending a sentence.
export const ABBREV = new Set([
	'dr', 'mr', 'mrs', 'ms', 'etc', 'vs', 'inc', 'st', 'jr', 'sr', 'no', 'fig',
	'dept', 'approx', 'ph', 'e.g', 'i.e', 'a.m', 'p.m', 'u.s', 'u.k'
]);

export function isAbbrev(word) {
	const w = word.toLowerCase().replace(/[^a-z.]/g, '');
	if (w.length === 1) return true; // single-letter initial, e.g. "A."
	return ABBREV.has(w) || ABBREV.has(w.replace(/\.$/, ''));
}

/**
 * Split `text` into sentences. Returns [{ text, start, end }] with start/end
 * being offsets into `text` such that text.slice(start, end) === segment text.
 *
 * Options:
 *   - allowLowercaseStart (default false): when true, also accepts lowercase
 *     letters as a valid next-sentence start. The default is tuned for
 *     transcribed interview speech (sentences start capitalized); forum prose
 *     is frequently all-lowercase and needs this enabled or the splitter
 *     rejects every candidate boundary and returns the text as one sentence.
 */
export function splitSentences(text, { allowLowercaseStart = false } = {}) {
	const startChars = allowLowercaseStart
		? /[A-Za-z0-9"'‘“(]/
		: /[A-Z0-9"'‘“(]/;
	const boundaries = []; // exclusive end offsets, just after a terminator
	const re = /[.!?]+['"’”)\]]*(\s+|$)/g;
	let m;
	while ((m = re.exec(text)) !== null) {
		const trailingWs = m[1];
		const termEnd = m.index + m[0].length - trailingWs.length;

		// Skip if the word before the terminator is an abbreviation/initial.
		const before = text.slice(0, m.index);
		const lastWord = (before.match(/(\S+)$/) || [])[1] || '';
		if (isAbbrev(lastWord)) continue;

		// Skip if the next sentence does not begin like a sentence.
		const nextIdx = m.index + m[0].length;
		if (nextIdx < text.length && !startChars.test(text[nextIdx])) continue;

		boundaries.push(termEnd);
	}

	const segments = [];
	let prev = 0;
	for (const cut of [...boundaries, text.length]) {
		if (cut <= prev) continue;
		const raw = text.slice(prev, cut);
		const lead = raw.length - raw.trimStart().length;
		const trimmed = raw.trim();
		if (trimmed.length > 0) {
			segments.push({ text: trimmed, start: prev + lead, end: prev + lead + trimmed.length });
		}
		prev = cut;
	}
	return segments;
}
