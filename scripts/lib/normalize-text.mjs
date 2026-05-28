/**
 * normalize-text.mjs — shared text-normalization helper.
 *
 * Imported by:
 *   - scripts/import-forum-as-fragments.mjs (applies at ingest time)
 *   - scripts/normalize-fragment-text.mjs (one-off cleanup over existing
 *     corpora ingested before this helper existed)
 *
 * Living in its own module so cleanup scripts can import the function without
 * triggering top-level ingester code.
 */

const HTML_ENTITIES = {
	'&lt;': '<',
	'&gt;': '>',
	'&amp;': '&',
	'&quot;': '"',
	'&#39;': "'",
	'&apos;': "'",
	'&nbsp;': ' '
};

// Zero-width chars commonly leaked by forum exports.
// U+200B zero-width space, U+200C/U+200D joiners, U+FEFF BOM.
const ZERO_WIDTH_RE = /[​-‍﻿]/g;

/**
 * Normalize a forum post / comment text for stable display:
 *   - decode `\uXXXX` JSON-style escapes that survived stringify round-trips
 *   - decode common HTML entities (&lt; &gt; &amp; &quot; &#39; &apos; &nbsp;)
 *   - decode numeric entities (&#123; / &#x7B;)
 *   - collapse runs of newlines into a single space (the corpus UI renders
 *     fragments inline; runs of \n break visual flow)
 *   - strip zero-width characters
 *   - collapse runs of horizontal whitespace
 *   - trim surrounding whitespace
 */
export function normalizeText(s) {
	if (typeof s !== 'string') return '';
	let out = s;
	out = out.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) =>
		String.fromCharCode(parseInt(hex, 16))
	);
	for (const [k, v] of Object.entries(HTML_ENTITIES)) out = out.split(k).join(v);
	out = out.replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
	out = out.replace(/&#x([0-9a-fA-F]+);/g, (_, n) => String.fromCharCode(parseInt(n, 16)));
	out = out.replace(ZERO_WIDTH_RE, '');
	out = out.replace(/\n+/g, ' ');
	out = out.replace(/[ \t]+/g, ' ');
	return out.trim();
}
