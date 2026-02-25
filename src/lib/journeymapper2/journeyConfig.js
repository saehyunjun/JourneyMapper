// ─── Shared Journey Map Configuration ────────────────────────────────────────

export const ROW_VALUES  = [5, 4, 3, 2, 1, 0, -1, -2, -3, -4, -5];
export const GRID_HEIGHT = 340;
export const STEP_WIDTH  = 225;
export const LEFT_AXIS_WIDTH = 36;
export const TOP_PADDING = 16;
export const SVG_HEIGHT  = GRID_HEIGHT + TOP_PADDING * 1.25;

export function valueToY(val) {
  const n = parseFloat(val);
  return TOP_PADDING + ((5 - n) / 10) * GRID_HEIGHT;
}

export function stepToX(index) {
  return LEFT_AXIS_WIDTH + index * STEP_WIDTH + STEP_WIDTH / 2;
}

export function totalWidth(dataLength) {
  return LEFT_AXIS_WIDTH + dataLength * STEP_WIDTH;
}

export function ratingToLabel(val) {
  const n = parseFloat(val);
  if (n >= 4)  return 'Very Positive';
  if (n >= 2)  return 'Positive';
  if (n >= 1)  return 'Leans Positive';
  if (n === 0) return 'Neutral / Mixed';
  if (n >= -1) return 'Leans Negative';
  if (n >= -3) return 'Negative';
  return 'Very Negative';
}

// ── Stage color palette ───────────────────────────────────────────────────────
export const STAGE_COLORS = [
  '#006363ff', // Desert Sand
  '#237674ff', // Desert Sand 2
  '#468A85ff', // Desert Sand 3
  '#699D97ff', // Almond Cream
  '#8CB0A8ff', // Almond Cream 2
  '#AFC4B9ff', // Almond Cream 3
  '#D2D7CAff', // Soft Linen
];

/**
 * Given journey data, return a map of stage_id → hex color.
 * Cycles through STAGE_COLORS if there are more stages than palette entries.
 */
export function buildStageColorMap(data) {
  const seen = new Map();
  let gi = 0;
  for (const d of data) {
    if (!seen.has(d.stage_id)) {
      seen.set(d.stage_id, STAGE_COLORS[gi % STAGE_COLORS.length]);
      gi++;
    } 
  }
  return Object.fromEntries(seen);
}


// ─── Plutchik Emotion Registry ────────────────────────────────────────────────
//
// Single source of truth for all Plutchik emotion identifiers, display labels,
// wheel colors (taken directly from Plutchik_Dyads_1.svg), and readable text
// colors for rendering labels on top of each emotion's background.
//
// Ordered clockwise from Joy (12 o'clock) — matches PlutchikWheel.svelte layout.
//
// Usage:
//   import { PLUTCHIK_EMOTIONS, emotionColor, emotionTextColor } from './journeyConfig.js';
//
//   const color = emotionColor('anger');           // → '#D50000'
//   const text  = emotionTextColor('joy');         // → '#5A3E28'
//   const meta  = PLUTCHIK_EMOTIONS.find(e => e.id === 'trust');

export const PLUTCHIK_EMOTIONS = [
  {
    id:        'joy',
    label:     'Joy',
    color:     '#FFE953',   // golden yellow — from SVG circle fill
    textColor: '#5A3E28',   // dark brown — legible on yellow
    wheelAngle: 0,          // degrees clockwise from 12 o'clock
    valence:   'positive',
  },
  {
    id:        'trust',
    label:     'Trust',
    color:     '#53FF53',   // bright green
    textColor: '#1a3a1a',
    wheelAngle: 45,
    valence:   'positive',
  },
  {
    id:        'fear',
    label:     'Fear',
    color:     '#442568',   // dark purple
    textColor: '#ffffff',
    wheelAngle: 90,
    valence:   'negative',
  },
  {
    id:        'surprise',
    label:     'Surprise',
    color:     '#008AE1',   // sky blue
    textColor: '#ffffff',
    wheelAngle: 135,
    valence:   'neutral',
  },
  {
    id:        'sadness',
    label:     'Sadness',
    color:     '#0000C9',   // deep blue
    textColor: '#ffffff',
    wheelAngle: 180,
    valence:   'negative',
  },
  {
    id:        'disgust',
    label:     'Disgust',
    color:     '#DF00DF',   // magenta
    textColor: '#ffffff',
    wheelAngle: 225,
    valence:   'negative',
  },
  {
    id:        'anger',
    label:     'Anger',
    color:     '#D50000',   // deep red
    textColor: '#ffffff',
    wheelAngle: 270,
    valence:   'negative',
  },
  {
    id:        'anticipation',
    label:     'Anticipation',
    color:     '#FF7E00',   // orange
    textColor: '#ffffff',
    wheelAngle: 315,
    valence:   'positive',
  },
];

// ── Dyads — blends of two adjacent primary emotions ───────────────────────────
// `primary` lists the two emotion ids that combine to form this dyad.
// `type`: 'primary' (adjacent), 'secondary' (one apart), 'tertiary' (two apart).

export const PLUTCHIK_DYADS = [
  // Primary dyads (inner band of the wheel)
  { id: 'love',            label: 'Love',            primary: ['joy', 'trust'],             type: 'primary' },
  { id: 'submission',      label: 'Submission',       primary: ['trust', 'fear'],            type: 'primary' },
  { id: 'awe',             label: 'Awe',              primary: ['fear', 'surprise'],         type: 'primary' },
  { id: 'disapproval',     label: 'Disapproval',      primary: ['surprise', 'sadness'],      type: 'primary' },
  { id: 'remorse',         label: 'Remorse',          primary: ['sadness', 'disgust'],       type: 'primary' },
  { id: 'contempt',        label: 'Contempt',         primary: ['disgust', 'anger'],         type: 'primary' },
  { id: 'aggressiveness',  label: 'Aggressiveness',   primary: ['anger', 'anticipation'],    type: 'primary' },
  { id: 'optimism',        label: 'Optimism',         primary: ['anticipation', 'joy'],      type: 'primary' },

  // Secondary dyads (outer ring of the wheel)
  { id: 'hope',            label: 'Hope',             primary: ['joy', 'anticipation'],      type: 'secondary' },
  { id: 'guilt',           label: 'Guilt',            primary: ['joy', 'fear'],              type: 'secondary' },
  { id: 'curiosity',       label: 'Curiosity',        primary: ['trust', 'surprise'],        type: 'secondary' },
  { id: 'despair',         label: 'Despair',          primary: ['fear', 'sadness'],          type: 'secondary' },
  { id: 'unbelief',        label: 'Unbelief',         primary: ['surprise', 'disgust'],      type: 'secondary' },
  { id: 'envy',            label: 'Envy',             primary: ['sadness', 'anger'],         type: 'secondary' },
  { id: 'cynicism',        label: 'Cynicism',         primary: ['disgust', 'anticipation'],  type: 'secondary' },
  { id: 'pride',           label: 'Pride',            primary: ['anger', 'joy'],             type: 'secondary' },

  // Tertiary dyads (cross-wheel arcs — opposite pairings)
  { id: 'delight',         label: 'Delight',          primary: ['joy', 'surprise'],          type: 'tertiary' },
  { id: 'sentimentality',  label: 'Sentimentality',   primary: ['trust', 'sadness'],         type: 'tertiary' },
  { id: 'shame',           label: 'Shame',            primary: ['fear', 'disgust'],          type: 'tertiary' },
  { id: 'outrage',         label: 'Outrage',          primary: ['surprise', 'anger'],        type: 'tertiary' },
  { id: 'pessimism',       label: 'Pessimism',        primary: ['sadness', 'anticipation'],  type: 'tertiary' },
  { id: 'morbidness',      label: 'Morbidness',       primary: ['disgust', 'joy'],           type: 'tertiary' },
  { id: 'dominance',       label: 'Dominance',        primary: ['anger', 'trust'],           type: 'tertiary' },
  { id: 'anxiety',         label: 'Anxiety',          primary: ['anticipation', 'fear'],     type: 'tertiary' },
];


// ── Convenience lookup helpers ────────────────────────────────────────────────

/** Map of emotion id → full emotion object. Built once at module load. */
export const EMOTION_BY_ID = Object.fromEntries(
  PLUTCHIK_EMOTIONS.map(e => [e.id, e])
);

/** Map of dyad id → full dyad object. */
export const DYAD_BY_ID = Object.fromEntries(
  PLUTCHIK_DYADS.map(d => [d.id, d])
);

/**
 * Returns the wheel color for an emotion id, or a neutral fallback.
 * Safe to call with any string (including raw plutchik_score values from data).
 *
 * @param {string} id  — emotion id e.g. 'anger', 'joy'
 * @returns {string}   — hex color string
 */
export function emotionColor(id) {
  return EMOTION_BY_ID[id]?.color ?? '#BFA080';
}

/**
 * Returns the text color suitable for rendering on top of an emotion's background.
 *
 * @param {string} id  — emotion id
 * @returns {string}   — hex color string
 */
export function emotionTextColor(id) {
  return EMOTION_BY_ID[id]?.textColor ?? '#5A3E28';
}

/**
 * Given a raw plutchik_score string from journey data (e.g. "alarm", "grief"),
 * attempts to map it to a known emotion id for color lookup.
 * Falls back to the neutral parchment tone if no match is found.
 *
 * Extend SCORE_ALIASES below as new data values appear in the wild.
 *
 * @param {string} score  — raw plutchik_score value from journey data
 * @returns {string}      — hex color string
 */
export function plutchikScoreToColor(score) {
  const normalized = score?.toLowerCase().trim();
  const alias      = SCORE_ALIASES[normalized];
  const id         = alias ?? normalized;
  return emotionColor(id);
}

/**
 * Alias map: raw plutchik_score values from journey data → canonical emotion ids.
 * Add entries here whenever data uses non-standard labels.
 */
export const SCORE_ALIASES = {
  alarm:        'fear',
  hope:         'anticipation',   // 'hope' is a dyad — closest primary is anticipation
  grief:        'sadness',
  ecstasy:      'joy',
  admiration:   'trust',
  terror:       'fear',
  amazement:    'surprise',
  loathing:     'disgust',
  rage:         'anger',
  vigilance:    'anticipation',
};