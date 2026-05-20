/**
 * emotion-colors — resolves a Plutchik emotion id to its display colour(s).
 *
 * Intensity-level ids (low/medium/high of one primary) resolve to a single
 * shade. Dyad ids (blends of two primaries) resolve to the two primary colours
 * the blend is made from; UI surfaces render these as two slightly overlapping
 * circles rather than a gradient, so the picker and the transcript chips both
 * stay visually quiet while still conveying which emotion is which.
 */
import { EMOTION_PICKER, PLUTCHIK_DYADS } from '$lib/journeymapper2/plutchikEmotionsConfig.js';

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
