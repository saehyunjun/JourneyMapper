/**
 * plutchik — the canonical Plutchik emotion taxonomy used by the lab book.
 *
 * Single source of truth for:
 *   - the 8 primary emotions, their colours, valence, and three intensity
 *     levels each (24 intensity-level ids total),
 *   - the 28 dyad blends (primary / secondary / tertiary / opposite groups),
 *   - the picker shape (`EMOTION_PICKER`) the tag drawers render from,
 *   - the flat id list (`ALL_EMOTION_IDS`) that `codebook.json#emotion_tags`
 *     is derived from and the autotag prompt validates against.
 *
 * Importers: emotion-colors.ts, SegmentTagDrawer, FragmentTagDrawer,
 * KeywordOrbit. The legacy `/journeymap` route carries its own private copy
 * in [journeymapper2/journeyConfig.js](../../journeymapper2/journeyConfig.js)
 * and is intentionally not migrated here — its shape diverged and the route
 * is on the deprecation track.
 *
 * Codebook sync: `ALL_EMOTION_IDS` MUST match the ids in
 * [codebook.json](../wctglpdemo-data/codebook.json) `emotion_tags`, since the
 * propose-fragment-sentiment / propose-segment-tags scripts validate model
 * output against the codebook list, and the drawer renders this taxonomy.
 * If you add an emotion here, regenerate the codebook entry.
 */

export type EmotionValence = 'positive' | 'neutral' | 'negative';

export type PrimaryEmotion = {
	/** Lowercase id used everywhere as the FK. */
	id: string;
	label: string;
	/** Hex; used to derive low/medium/high shades in emotion-colors.ts. */
	color: string;
	/** Hex; legible text colour over `color`. Picker only — not used for chart fills. */
	textColor: string;
	valence: EmotionValence;
	/** Mild intensity id (e.g. "serenity"). */
	level_1: string;
	/** Medium intensity id (e.g. "joy"). */
	level_2: string;
	/** High intensity id (e.g. "ecstasy"). */
	level_3: string;
	description_1: string;
	description_2: string;
	description_3: string;
};

/** Raw dyad definition before colour-merging. */
type DyadDefn = {
	emotion_1: string;
	emotion_2: string;
	label: string;
	description: string;
};

/** Dyad row as consumed downstream — colour-resolved from the two primaries. */
export type Dyad = DyadDefn & {
	color_1: string;
	color_2: string;
};

export const PLUTCHIK_EMOTIONS: PrimaryEmotion[] = [
	{
		id: 'joy',
		label: 'Joy',
		color: '#FFE953',
		textColor: '#5A3E28',
		valence: 'positive',
		level_1: 'serenity',
		level_2: 'joy',
		level_3: 'ecstasy',
		description_1: 'Mild joy — calm contentment or ease.',
		description_2: 'Joy — happiness or gladness.',
		description_3: 'Intense joy — elation or overwhelming delight.'
	},
	{
		id: 'trust',
		label: 'Trust',
		color: '#53FF53',
		textColor: '#1a3a1a',
		valence: 'positive',
		level_1: 'acceptance',
		level_2: 'trust',
		level_3: 'admiration',
		description_1: 'Mild trust — openness or willingness to go along.',
		description_2: 'Trust — confidence in a person, plan, or treatment.',
		description_3: 'Intense trust — deep respect, reverence, or gratitude.'
	},
	{
		id: 'fear',
		label: 'Fear',
		color: '#262626',
		textColor: '#ffffff',
		valence: 'negative',
		level_1: 'apprehension',
		level_2: 'fear',
		level_3: 'terror',
		description_1: 'Mild fear — unease or wariness about what may come.',
		description_2: 'Fear — alarm at a perceived threat.',
		description_3: 'Intense fear — dread or panic.'
	},
	{
		id: 'surprise',
		label: 'Surprise',
		color: '#ff1616',
		textColor: '#ffffff',
		valence: 'neutral',
		level_1: 'distraction',
		level_2: 'surprise',
		level_3: 'amazement',
		description_1: 'Mild surprise — being momentarily caught off guard.',
		description_2: 'Surprise — reaction to something unexpected.',
		description_3: 'Intense surprise — astonishment or being stunned.'
	},
	{
		id: 'sadness',
		label: 'Sadness',
		color: '#0000C9',
		textColor: '#ffffff',
		valence: 'negative',
		level_1: 'pensiveness',
		level_2: 'sadness',
		level_3: 'grief',
		description_1: 'Mild sadness — wistfulness or low mood.',
		description_2: 'Sadness — unhappiness or sorrow.',
		description_3: 'Intense sadness — deep sorrow or anguish.'
	},
	{
		id: 'disgust',
		label: 'Disgust',
		color: '#DF00DF',
		textColor: '#ffffff',
		valence: 'negative',
		level_1: 'boredom',
		level_2: 'disgust',
		level_3: 'loathing',
		description_1: 'Mild disgust — disinterest or weariness.',
		description_2: 'Disgust — aversion or distaste.',
		description_3: 'Intense disgust — revulsion or contempt.'
	},
	{
		id: 'anger',
		label: 'Anger',
		color: '#D50000',
		textColor: '#ffffff',
		valence: 'negative',
		level_1: 'annoyance',
		level_2: 'anger',
		level_3: 'rage',
		description_1: 'Mild anger — irritation or frustration.',
		description_2: 'Anger — displeasure or hostility.',
		description_3: 'Intense anger — fury or outrage.'
	},
	{
		id: 'anticipation',
		label: 'Anticipation',
		color: '#FF7E00',
		textColor: '#ffffff',
		valence: 'positive',
		level_1: 'interest',
		level_2: 'anticipation',
		level_3: 'vigilance',
		description_1: "Mild anticipation — curiosity or attentiveness toward what's ahead.",
		description_2: 'Anticipation — looking ahead to or expecting something.',
		description_3: 'Intense anticipation — keen focus, readiness, or resolve.'
	}
];

export const EMOTION_COLOR_MAP: Record<string, string> = Object.fromEntries(
	PLUTCHIK_EMOTIONS.map((e) => [e.id, e.color])
);

export const EMOTION_LEVELS_MAP: Record<string, [string, string, string]> = Object.fromEntries(
	PLUTCHIK_EMOTIONS.map((e) => [e.id, [e.level_1, e.level_2, e.level_3]])
);

const withColors = (dyads: DyadDefn[]): Dyad[] =>
	dyads.map((d) => ({
		...d,
		color_1: EMOTION_COLOR_MAP[d.emotion_1],
		color_2: EMOTION_COLOR_MAP[d.emotion_2]
	}));

export const PLUTCHIK_DYADS: Record<'primary' | 'secondary' | 'tertiary' | 'opposite', Dyad[]> = {
	primary: withColors([
		{ emotion_1: 'joy', emotion_2: 'trust', label: 'love', description: 'Love — joy blended with trust.' },
		{ emotion_1: 'trust', emotion_2: 'fear', label: 'submission', description: 'Submission — trust blended with fear.' },
		{ emotion_1: 'fear', emotion_2: 'surprise', label: 'alarm', description: 'Alarm — fear blended with surprise.' },
		{ emotion_1: 'surprise', emotion_2: 'sadness', label: 'disappointment', description: 'Disappointment — surprise blended with sadness.' },
		{ emotion_1: 'sadness', emotion_2: 'disgust', label: 'remorse', description: 'Remorse — sadness blended with disgust.' },
		{ emotion_1: 'disgust', emotion_2: 'anger', label: 'contempt', description: 'Contempt — disgust blended with anger.' },
		{ emotion_1: 'anger', emotion_2: 'anticipation', label: 'aggression', description: 'Aggression — anger blended with anticipation.' },
		{ emotion_1: 'anticipation', emotion_2: 'joy', label: 'optimism', description: 'Optimism — anticipation blended with joy.' }
	]),

	secondary: withColors([
		{ emotion_1: 'joy', emotion_2: 'fear', label: 'guilt', description: 'Guilt — joy blended with fear.' },
		{ emotion_1: 'trust', emotion_2: 'surprise', label: 'curiosity', description: 'Curiosity — trust blended with surprise.' },
		{ emotion_1: 'fear', emotion_2: 'sadness', label: 'despair', description: 'Despair — fear blended with sadness.' },
		{ emotion_1: 'surprise', emotion_2: 'disgust', label: 'unbelief', description: 'Unbelief — surprise blended with disgust.' },
		{ emotion_1: 'sadness', emotion_2: 'anger', label: 'envy', description: 'Envy — sadness blended with anger.' },
		{ emotion_1: 'disgust', emotion_2: 'anticipation', label: 'cynicism', description: 'Cynicism — disgust blended with anticipation.' },
		{ emotion_1: 'anger', emotion_2: 'joy', label: 'pride', description: 'Pride — anger blended with joy.' },
		{ emotion_1: 'anticipation', emotion_2: 'trust', label: 'hope', description: 'Hope — anticipation blended with trust.' }
	]),

	tertiary: withColors([
		{ emotion_1: 'joy', emotion_2: 'surprise', label: 'delight', description: 'Delight — joy blended with surprise.' },
		{ emotion_1: 'trust', emotion_2: 'sadness', label: 'sentimentality', description: 'Sentimentality — trust blended with sadness.' },
		{ emotion_1: 'fear', emotion_2: 'disgust', label: 'shame', description: 'Shame — fear blended with disgust.' },
		{ emotion_1: 'surprise', emotion_2: 'anger', label: 'outrage', description: 'Outrage — surprise blended with anger.' },
		{ emotion_1: 'sadness', emotion_2: 'anticipation', label: 'pessimism', description: 'Pessimism — sadness blended with anticipation.' },
		{ emotion_1: 'disgust', emotion_2: 'joy', label: 'morbideness', description: 'Morbidness — disgust blended with joy.' },
		{ emotion_1: 'anger', emotion_2: 'trust', label: 'dominance', description: 'Dominance — anger blended with trust.' },
		{ emotion_1: 'anticipation', emotion_2: 'fear', label: 'anxiety', description: 'Anxiety — anticipation blended with fear.' }
	]),

	opposite: withColors([
		{ emotion_1: 'joy', emotion_2: 'sadness', label: 'bittersweetness', description: 'Bittersweetness — joy blended with sadness.' },
		{ emotion_1: 'trust', emotion_2: 'disgust', label: 'ambivalence', description: 'Ambivalence — trust blended with disgust.' },
		{ emotion_1: 'fear', emotion_2: 'anger', label: 'frozenness', description: 'Frozenness — fear blended with anger.' },
		{ emotion_1: 'surprise', emotion_2: 'anticipation', label: 'confusion', description: 'Confusion — surprise blended with anticipation.' }
	])
};

const ALL_DYADS: Dyad[] = [
	...PLUTCHIK_DYADS.primary,
	...PLUTCHIK_DYADS.secondary,
	...PLUTCHIK_DYADS.tertiary,
	...PLUTCHIK_DYADS.opposite
];

export type EmotionPickerLevel = {
	id: string;
	intensity: 'low' | 'medium' | 'high';
	description: string;
};

export type EmotionPickerDyad = {
	id: string;
	with: string;
	description: string;
};

export type EmotionPickerEntry = {
	id: string;
	label: string;
	color: string;
	textColor: string;
	valence: EmotionValence;
	levels: EmotionPickerLevel[];
	dyads: EmotionPickerDyad[];
};

export const EMOTION_PICKER: EmotionPickerEntry[] = PLUTCHIK_EMOTIONS.map((e) => ({
	id: e.id,
	label: e.label,
	color: e.color,
	textColor: e.textColor,
	valence: e.valence,
	levels: [
		{ id: e.level_1, intensity: 'low' as const, description: e.description_1 },
		{ id: e.level_2, intensity: 'medium' as const, description: e.description_2 },
		{ id: e.level_3, intensity: 'high' as const, description: e.description_3 }
	],
	dyads: ALL_DYADS.filter((d) => d.emotion_1 === e.id || d.emotion_2 === e.id).map((d) => ({
		id: d.label,
		with: d.emotion_1 === e.id ? d.emotion_2 : d.emotion_1,
		description: d.description
	}))
}));

export const EMOTION_DESCRIPTIONS: Readonly<Record<string, string>> = Object.freeze(
	Object.fromEntries([
		...PLUTCHIK_EMOTIONS.flatMap((e) => [
			[e.level_1, e.description_1],
			[e.level_2, e.description_2],
			[e.level_3, e.description_3]
		]),
		...ALL_DYADS.map((d) => [d.label, d.description])
	])
);

/** Every valid emotion tag id — 24 intensity levels + 28 dyads. Must stay in
 * sync with `codebook.json` `emotion_tags` ids. */
export const ALL_EMOTION_IDS: string[] = [
	...PLUTCHIK_EMOTIONS.flatMap((e) => [e.level_1, e.level_2, e.level_3]),
	...ALL_DYADS.map((d) => d.label)
];
