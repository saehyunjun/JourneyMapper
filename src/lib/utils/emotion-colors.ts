/**
 * emotion-colors — resolves a Plutchik emotion id to its display colour(s).
 *
 * Intensity-level ids (low/medium/high of one primary) resolve to a single
 * shade. Dyad ids (blends of two primaries) resolve to the two primary colours
 * the blend is made from; UI surfaces render these as two slightly overlapping
 * circles rather than a gradient, so the picker and the transcript chips both
 * stay visually quiet while still conveying which emotion is which.
 */
import {
	EMOTION_PICKER,
	PLUTCHIK_DYADS,
	PLUTCHIK_EMOTIONS
} from '$lib/content/emotions/plutchik';

type Rgb = { r: number; g: number; b: number };

const hexToRgb = (hex: string): Rgb => {
	let h = hex.replace('#', '');
	if (h.length === 3) h = h.split('').map((c) => c + c).join('');
	return {
		r: parseInt(h.slice(0, 2), 16),
		g: parseInt(h.slice(2, 4), 16),
		b: parseInt(h.slice(4, 6), 16)
	};
};
const mixRgb = (a: Rgb, b: Rgb, t: number): Rgb => ({
	r: Math.round(a.r + (b.r - a.r) * t),
	g: Math.round(a.g + (b.g - a.g) * t),
	b: Math.round(a.b + (b.b - a.b) * t)
});
const rgbCss = ({ r, g, b }: Rgb) => `rgb(${r} ${g} ${b})`;
const WHITE: Rgb = { r: 255, g: 255, b: 255 };
const BLACK: Rgb = { r: 0, g: 0, b: 0 };

const emotionShades = (hex: string): Record<string, Rgb> => {
	const base = hexToRgb(hex);
	return { low: mixRgb(base, WHITE, 0.6), medium: base, high: mixRgb(base, BLACK, 0.34) };
};

type EmotionPrimary = {
	color: string;
	levels: { id: string; intensity: string }[];
};

const intensityShade = new Map<string, string>();
for (const p of EMOTION_PICKER as EmotionPrimary[]) {
	const shades = emotionShades(p.color);
	for (const lvl of p.levels) intensityShade.set(lvl.id, rgbCss(shades[lvl.intensity]));
}

const dyadColorMap = new Map<string, { c1: string; c2: string }>();
for (const group of Object.values(PLUTCHIK_DYADS) as {
	label: string;
	color_1: string;
	color_2: string;
}[][]) {
	for (const d of group) dyadColorMap.set(d.label, { c1: d.color_1, c2: d.color_2 });
}

export type EmotionDots = { c1: string; c2?: string };

export function emotionDots(id: string): EmotionDots {
	const dyad = dyadColorMap.get(id);
	if (dyad) return { c1: dyad.c1, c2: dyad.c2 };
	const c = intensityShade.get(id);
	if (c) return { c1: c };
	return { c1: '#94a3b8' };
}

const dyadConstituentsMap = new Map<string, { a: string; b: string }>();
for (const group of Object.values(PLUTCHIK_DYADS) as {
	label: string;
	emotion_1: string;
	emotion_2: string;
}[][]) {
	for (const d of group) dyadConstituentsMap.set(d.label, { a: d.emotion_1, b: d.emotion_2 });
}

/**
 * For a dyad id, return the two primary-emotion ids it blends. Returns null
 * for intensity-level ids (which have no constituents) or unknown ids.
 */
export function dyadConstituents(id: string): { a: string; b: string } | null {
	return dyadConstituentsMap.get(id) ?? null;
}

/** Title-case display label for any emotion id (intensity or dyad). */
export function emotionLabel(id: string): string {
	if (!id) return '';
	return id.charAt(0).toUpperCase() + id.slice(1);
}

// Intensity-level id → primary Plutchik emotion id (e.g. "apprehension" → "fear").
// Built once at module load so callers can look up valence/color in O(1).
type Valence = 'positive' | 'neutral' | 'negative';
type PrimaryRow = {
	id: string;
	color: string;
	valence: Valence;
	level_1: string;
	level_2: string;
	level_3: string;
};

const intensityToPrimary = new Map<string, PrimaryRow>();
for (const p of PLUTCHIK_EMOTIONS as PrimaryRow[]) {
	intensityToPrimary.set(p.level_1, p);
	intensityToPrimary.set(p.level_2, p);
	intensityToPrimary.set(p.level_3, p);
}

const dyadValenceMap = new Map<string, Valence>();
const primaryById = new Map(
	(PLUTCHIK_EMOTIONS as PrimaryRow[]).map((p) => [p.id, p] as const)
);
for (const group of Object.values(PLUTCHIK_DYADS) as {
	label: string;
	emotion_1: string;
	emotion_2: string;
}[][]) {
	for (const d of group) {
		const a = primaryById.get(d.emotion_1)?.valence;
		const b = primaryById.get(d.emotion_2)?.valence;
		// A dyad inherits its valence from its constituents: matching ones win,
		// any mismatch (positive+negative, positive+neutral, etc.) reads as
		// neutral. Reasonable for a one-token chart label; consumers needing
		// the underlying primaries can still call dyadConstituents().
		let v: Valence = 'neutral';
		if (a && b && a === b) v = a;
		dyadValenceMap.set(d.label, v);
	}
}

export type EmotionMeta = {
	id: string;
	label: string;
	/** Solid display color; for dyads this is the first constituent's color. */
	color: string;
	valence: Valence;
};

/**
 * Resolve any emotion id (primary, intensity level, or dyad) to a flat
 * { label, color, valence } record suitable for chart legends and bars.
 * Unknown ids fall back to a neutral slate so a chart never crashes on a
 * future tag the lexicon hasn't caught up with.
 */
export function getEmotionMeta(id: string): EmotionMeta {
	if (!id) return { id: '', label: '', color: '#94a3b8', valence: 'neutral' };
	const dots = emotionDots(id);
	const label = emotionLabel(id);
	const primary = intensityToPrimary.get(id) ?? primaryById.get(id);
	if (primary) {
		return { id, label, color: dots.c1, valence: primary.valence };
	}
	const dyadValence = dyadValenceMap.get(id);
	if (dyadValence) {
		return { id, label, color: dots.c1, valence: dyadValence };
	}
	return { id, label, color: '#94a3b8', valence: 'neutral' };
}
