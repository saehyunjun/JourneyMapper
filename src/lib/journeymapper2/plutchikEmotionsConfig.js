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
  PLUTCHIK_EMOTIONS.map(e => [e.id, e.levels])
);

// Attach colors to dyads
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