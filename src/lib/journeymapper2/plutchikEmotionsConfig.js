export const PLUTCHIK_EMOTIONS = [
  {
    id: 'joy',
    label: 'Joy',
    color: '#FFE953',
    textColor: '#5A3E28',
    valence: 'positive',
    level_1: 'serenity',
    level_2: 'joy',
    level_3: 'ecstasy',
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
  },
];

// Quick lookup maps
export const EMOTION_COLOR_MAP = Object.fromEntries(
  PLUTCHIK_EMOTIONS.map(e => [e.id, e.color])
);

export const EMOTION_LEVELS_MAP = Object.fromEntries(
  PLUTCHIK_EMOTIONS.map(e => [e.id, [e.level_1, e.level_2, e.level_3]])
);

// Attach colors to dyads
/** @param {{ emotion_1: string, emotion_2: string, label: string }[]} dyads */
const withColors = (dyads) =>
  dyads.map(d => ({
    ...d,
    color_1: EMOTION_COLOR_MAP[d.emotion_1],
    color_2: EMOTION_COLOR_MAP[d.emotion_2],
  }));

export const PLUTCHIK_DYADS = {
  primary: withColors([
    { emotion_1: 'joy', emotion_2: 'trust', label: 'love' },
    { emotion_1: 'trust', emotion_2: 'fear', label: 'submission' },
    { emotion_1: 'fear', emotion_2: 'surprise', label: 'alarm' },
    { emotion_1: 'surprise', emotion_2: 'sadness', label: 'disappointment' },
    { emotion_1: 'sadness', emotion_2: 'disgust', label: 'remorse' },
    { emotion_1: 'disgust', emotion_2: 'anger', label: 'contempt' },
    { emotion_1: 'anger', emotion_2: 'anticipation', label: 'aggression' },
    { emotion_1: 'anticipation', emotion_2: 'joy', label: 'optimism' },
  ]),

  secondary: withColors([
    { emotion_1: 'joy', emotion_2: 'fear', label: 'guilt' },
    { emotion_1: 'trust', emotion_2: 'surprise', label: 'curiosity' },
    { emotion_1: 'fear', emotion_2: 'sadness', label: 'despair' },
    { emotion_1: 'surprise', emotion_2: 'disgust', label: 'unbelief' },
    { emotion_1: 'sadness', emotion_2: 'anger', label: 'envy' },
    { emotion_1: 'disgust', emotion_2: 'anticipation', label: 'cynicism' },
    { emotion_1: 'anger', emotion_2: 'joy', label: 'pride' },
    { emotion_1: 'anticipation', emotion_2: 'trust', label: 'hope' },
  ]),

  tertiary: withColors([
    { emotion_1: 'joy', emotion_2: 'surprise', label: 'delight' },
    { emotion_1: 'trust', emotion_2: 'sadness', label: 'sentimentality' },
    { emotion_1: 'fear', emotion_2: 'disgust', label: 'shame' },
    { emotion_1: 'surprise', emotion_2: 'anger', label: 'outrage' },
    { emotion_1: 'sadness', emotion_2: 'anticipation', label: 'pessimism' },
    { emotion_1: 'disgust', emotion_2: 'joy', label: 'morbideness' },
    { emotion_1: 'anger', emotion_2: 'trust', label: 'dominance' },
    { emotion_1: 'anticipation', emotion_2: 'fear', label: 'anxiety' },
  ]),

  opposite: withColors([
    { emotion_1: 'joy', emotion_2: 'sadness', label: 'bittersweetness' },
    { emotion_1: 'trust', emotion_2: 'disgust', label: 'ambivalence' },
    { emotion_1: 'fear', emotion_2: 'anger', label: 'frozenness' },
    { emotion_1: 'surprise', emotion_2: 'anticipation', label: 'confusion' },
  ]),
};

// ── Segment-tag drawer picker ────────────────────────────────────────────
// Picker-ready Plutchik taxonomy: each primary emotion paired with its three
// intensity levels and every dyad it takes part in. SegmentTagDrawer uses
// this to drive the "click a primary → reveal its levels + blends" flow.
//
// Tag ids are the lowercased emotion words and MUST stay in sync with
// codebook.json `emotion_tags`, which the server validates saved emotions
// against (ALL_EMOTION_IDS is the full list, for that cross-check).

const ALL_DYADS = [
  ...PLUTCHIK_DYADS.primary,
  ...PLUTCHIK_DYADS.secondary,
  ...PLUTCHIK_DYADS.tertiary,
  ...PLUTCHIK_DYADS.opposite,
];

export const EMOTION_PICKER = PLUTCHIK_EMOTIONS.map((e) => ({
  id: e.id,
  label: e.label,
  color: e.color,
  textColor: e.textColor,
  valence: e.valence,
  levels: [
    { id: e.level_1, intensity: 'low' },
    { id: e.level_2, intensity: 'medium' },
    { id: e.level_3, intensity: 'high' },
  ],
  dyads: ALL_DYADS.filter(
    (d) => d.emotion_1 === e.id || d.emotion_2 === e.id
  ).map((d) => ({
    id: d.label,
    with: d.emotion_1 === e.id ? d.emotion_2 : d.emotion_1,
  })),
}));

// Every valid emotion tag id — 24 intensity levels + 28 dyads.
export const ALL_EMOTION_IDS = [
  ...PLUTCHIK_EMOTIONS.flatMap((e) => [e.level_1, e.level_2, e.level_3]),
  ...ALL_DYADS.map((d) => d.label),
];