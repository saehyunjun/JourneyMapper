/**
 * Label-fitting helpers for SVG charts.
 *
 * Width is approximated from font size and string length; no DOM measurement
 * is performed. The 0.55 ratio matches the heuristic already used in
 * BubbleChart's `charWidth()` for the Inter / IBM Plex stack.
 *
 * For tooltips: pair a truncated label with a sibling `<title>` element
 * containing the full text. The browser renders a native tooltip on hover.
 *
 *   {@const t = truncate(label, maxWidth, 12)}
 *   <text x={cx} y={cy} font-size="12">
 *     {t.text}{#if t.truncated}<title>{label}</title>{/if}
 *   </text>
 */

const CHAR_RATIO = 0.55;

export function approxTextWidth(text: string, fontSize: number): number {
	return text.length * fontSize * CHAR_RATIO;
}

export type TruncateResult = {
	text: string;
	truncated: boolean;
};

export function truncate(text: string, maxWidthPx: number, fontSize: number): TruncateResult {
	if (!text) return { text: '', truncated: false };
	if (approxTextWidth(text, fontSize) <= maxWidthPx) {
		return { text, truncated: false };
	}
	const charW = fontSize * CHAR_RATIO;
	const ellipsisW = charW;
	const available = maxWidthPx - ellipsisW;
	if (available <= 0) return { text: '…', truncated: true };
	const maxChars = Math.max(1, Math.floor(available / charW));
	return { text: text.slice(0, maxChars).trimEnd() + '…', truncated: true };
}

export function fitsWidth(text: string, maxWidthPx: number, fontSize: number): boolean {
	return approxTextWidth(text, fontSize) <= maxWidthPx;
}
