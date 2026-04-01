/**
 * storyConfig.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Central visual configuration for the PersonaStory overlay.
 *
 * Each screen key maps to a `ScreenTheme` object consumed by all StoryComponent
 * screens. Screens receive the resolved theme as a `theme` prop.
 *
 * ScreenTheme shape:
 * {
 *   // Background: two gradient stops that blend with the dark shell base (#0f0d0b)
 *   gradientFrom:  string,   // CSS color — bottom of gradient (richest)
 *   gradientTo:    string,   // CSS color — top of gradient (fades out)
 *   gradientDir:   string,   // e.g. 'to top', 'to bottom', '160deg'
 *
 *   // Optional atmospheric radial glow layered over the gradient
 *   glowColor:     string | null,   // CSS color including opacity e.g. 'rgba(120,60,200,0.18)'
 *   glowPosition:  string,          // e.g. '50% 60%'
 *
 *   // Text surface color used for kickers, labels, rule lines
 *   // Screens fall back to the persona accentColor when null
 *   labelColor:    string | null,
 *
 *   // Overlay darkness at bottom (content legibility layer)
 *   // 0 = no scrim, 1 = fully black
 *   scrimStrength: number,
 *
 *   // Content layout hint consumed by BaseScreen
 *   layout: 'bottom' | 'center',
 * }
 */

/** @typedef {{ gradientFrom: string, gradientTo: string, gradientDir: string, glowColor: string|null, glowPosition: string, labelColor: string|null, scrimStrength: number, layout: 'bottom'|'center' }} ScreenTheme */

// ── Emotion-derived palette ───────────────────────────────────────────────────
// Colors map loosely to Plutchik wheel quadrants so the atmosphere shifts with
// the emotional arc of the persona journey.

const PALETTE = {
  // Anticipation / curiosity — warm amber
  anticipation:  { from: 'rgba(180, 100, 20, 0.55)',  to: 'rgba(100, 50, 10, 0.10)' },
  // Trust / stability — deep teal
  trust:         { from: 'rgba(20, 110, 100, 0.55)',  to: 'rgba(10, 60, 55, 0.08)'  },
  // Sadness / grief — cool slate blue
  sadness:       { from: 'rgba(40, 55, 110, 0.65)',   to: 'rgba(20, 30, 70, 0.10)'  },
  // Fear / tension — dark red-violet
  fear:          { from: 'rgba(100, 20, 60, 0.65)',   to: 'rgba(60, 10, 40, 0.10)'  },
  // Disgust / barriers — muted olive
  disgust:       { from: 'rgba(70, 80, 20, 0.55)',    to: 'rgba(40, 50, 10, 0.08)'  },
  // Anger / urgency — deep crimson
  anger:         { from: 'rgba(140, 25, 25, 0.65)',   to: 'rgba(80, 10, 10, 0.10)'  },
  // Joy / resolution — warm gold
  joy:           { from: 'rgba(160, 120, 20, 0.55)',  to: 'rgba(100, 70, 10, 0.08)' },
  // Surprise / inflection — electric violet
  surprise:      { from: 'rgba(80, 30, 160, 0.65)',   to: 'rgba(40, 15, 90, 0.10)'  },
  // Neutral / informational — near-black warm
  neutral:       { from: 'rgba(30, 25, 20, 0.90)',    to: 'rgba(15, 12, 10, 0.60)'  },
};

// ── Screen theme map ──────────────────────────────────────────────────────────

/** @type {Record<string, ScreenTheme>} */
export const SCREEN_THEMES = {

  // ── Intro: anticipation / first impression ──────────────────────────────
  intro: {
    gradientFrom:  PALETTE.anticipation.from,
    gradientTo:    PALETTE.anticipation.to,
    gradientDir:   'to top',
    glowColor:     'rgba(200, 120, 30, 0.14)',
    glowPosition:  '50% 75%',
    labelColor:    null, // uses persona accent
    scrimStrength: 0.80,
    layout:        'bottom',
  },

  // ── Key quote: centered, emotionally warm ───────────────────────────────
  'key-quote': {
    gradientFrom:  PALETTE.anticipation.from,
    gradientTo:    PALETTE.sadness.to,
    gradientDir:   '160deg',
    glowColor:     'rgba(200, 130, 40, 0.18)',
    glowPosition:  '50% 55%',
    labelColor:    null,
    scrimStrength: 0,   // no bottom scrim — layout is center
    layout:        'center',
  },

  // ── Event-1: how it began — undercurrent of fear/uncertainty ───────────
  'event-1': {
    gradientFrom:  PALETTE.fear.from,
    gradientTo:    PALETTE.fear.to,
    gradientDir:   'to top',
    glowColor:     'rgba(120, 30, 80, 0.12)',
    glowPosition:  '30% 80%',
    labelColor:    null,
    scrimStrength: 0.85,
    layout:        'bottom',
  },

  // ── Themes: trust-toned, stable ─────────────────────────────────────────
  themes: {
    gradientFrom:  PALETTE.trust.from,
    gradientTo:    PALETTE.trust.to,
    gradientDir:   'to top',
    glowColor:     'rgba(20, 140, 120, 0.10)',
    glowPosition:  '60% 70%',
    labelColor:    null,
    scrimStrength: 0.88,
    layout:        'bottom',
  },

  // ── Bio 2: navigating care — trust shifting to anticipation ─────────────
  bio2: {
    gradientFrom:  PALETTE.trust.from,
    gradientTo:    PALETTE.anticipation.to,
    gradientDir:   '140deg',
    glowColor:     'rgba(30, 100, 90, 0.12)',
    glowPosition:  '40% 65%',
    labelColor:    null,
    scrimStrength: 0.85,
    layout:        'bottom',
  },

  // ── Current state: clinical, cool, factual ──────────────────────────────
  'current-state': {
    gradientFrom:  PALETTE.sadness.from,
    gradientTo:    PALETTE.sadness.to,
    gradientDir:   'to top',
    glowColor:     'rgba(50, 70, 140, 0.12)',
    glowPosition:  '50% 60%',
    labelColor:    null,
    scrimStrength: 0.92,
    layout:        'bottom',
  },

  // ── Goal: warm optimism ─────────────────────────────────────────────────
  goal: {
    gradientFrom:  PALETTE.joy.from,
    gradientTo:    PALETTE.joy.to,
    gradientDir:   'to top',
    glowColor:     'rgba(180, 140, 30, 0.14)',
    glowPosition:  '50% 70%',
    labelColor:    null,
    scrimStrength: 0.82,
    layout:        'bottom',
  },

  // ── Barrier: tension, resistance ────────────────────────────────────────
  barrier: {
    gradientFrom:  PALETTE.disgust.from,
    gradientTo:    PALETTE.anger.to,
    gradientDir:   'to top',
    glowColor:     'rgba(90, 100, 20, 0.10)',
    glowPosition:  '50% 80%',
    labelColor:    null,
    scrimStrength: 0.90,
    layout:        'bottom',
  },

  // ── Inflection lead: high tension, surprise ─────────────────────────────
  'inflection-lead': {
    gradientFrom:  PALETTE.surprise.from,
    gradientTo:    PALETTE.fear.to,
    gradientDir:   '150deg',
    glowColor:     'rgba(100, 40, 200, 0.20)',
    glowPosition:  '50% 50%',
    labelColor:    'rgba(180, 140, 255, 0.90)',
    scrimStrength: 0.80,
    layout:        'bottom',
  },

  // ── Inflection data: analytical, tension held ───────────────────────────
  'inflection-data': {
    gradientFrom:  PALETTE.surprise.from,
    gradientTo:    PALETTE.neutral.to,
    gradientDir:   'to top',
    glowColor:     'rgba(80, 30, 160, 0.14)',
    glowPosition:  '40% 70%',
    labelColor:    'rgba(160, 120, 255, 0.85)',
    scrimStrength: 0.88,
    layout:        'bottom',
  },

  // ── Inflection detail: decisive moment ──────────────────────────────────
  'inflection-detail': {
    gradientFrom:  PALETTE.fear.from,
    gradientTo:    PALETTE.surprise.to,
    gradientDir:   '130deg',
    glowColor:     'rgba(100, 20, 60, 0.16)',
    glowPosition:  '60% 60%',
    labelColor:    'rgba(255, 160, 200, 0.85)',
    scrimStrength: 0.85,
    layout:        'bottom',
  },

  // ── Path positive: relief, joy, resolution ──────────────────────────────
  'path-pos': {
    gradientFrom:  PALETTE.joy.from,
    gradientTo:    PALETTE.trust.to,
    gradientDir:   '140deg',
    glowColor:     'rgba(160, 140, 30, 0.16)',
    glowPosition:  '50% 55%',
    labelColor:    'rgba(220, 190, 80, 0.90)',
    scrimStrength: 0.80,
    layout:        'bottom',
  },

  // ── Path negative: grief, fear ───────────────────────────────────────────
  'path-neg': {
    gradientFrom:  PALETTE.anger.from,
    gradientTo:    PALETTE.fear.to,
    gradientDir:   'to top',
    glowColor:     'rgba(140, 20, 20, 0.18)',
    glowPosition:  '50% 65%',
    labelColor:    'rgba(255, 120, 100, 0.90)',
    scrimStrength: 0.90,
    layout:        'bottom',
  },

  // ── Final lead: outcome, resolution ─────────────────────────────────────
  'final-lead': {
    gradientFrom:  PALETTE.trust.from,
    gradientTo:    PALETTE.joy.to,
    gradientDir:   '150deg',
    glowColor:     'rgba(30, 120, 110, 0.16)',
    glowPosition:  '50% 60%',
    labelColor:    null,
    scrimStrength: 0.80,
    layout:        'bottom',
  },

  // ── Final data: settled, informational ──────────────────────────────────
  'final-data': {
    gradientFrom:  PALETTE.trust.from,
    gradientTo:    PALETTE.neutral.to,
    gradientDir:   'to top',
    glowColor:     'rgba(20, 100, 90, 0.12)',
    glowPosition:  '50% 70%',
    labelColor:    null,
    scrimStrength: 0.88,
    layout:        'bottom',
  },
};

/**
 * Returns the resolved ScreenTheme for a given screen key.
 * Falls back to a neutral dark theme if the key isn't registered.
 * @param {string} screenKey
 * @returns {ScreenTheme}
 */
export function getScreenTheme(screenKey) {
  return SCREEN_THEMES[screenKey] ?? {
    gradientFrom:  PALETTE.neutral.from,
    gradientTo:    PALETTE.neutral.to,
    gradientDir:   'to top',
    glowColor:     null,
    glowPosition:  '50% 50%',
    labelColor:    null,
    scrimStrength: 0.88,
    layout:        'bottom',
  };
}

/**
 * Builds the CSS background string for a screen shell.
 * Layers: glow (optional) + gradient + dark base.
 * @param {ScreenTheme} theme
 * @returns {string} CSS background shorthand
 */
export function buildScreenBackground(theme) {
  const scrim = `rgba(0,0,0,${theme.scrimStrength})`;

  const gradient = [
    theme.glowColor
      ? `radial-gradient(ellipse at ${theme.glowPosition}, ${theme.glowColor} 0%, transparent 65%)`
      : null,
    `linear-gradient(${theme.gradientDir}, ${theme.gradientFrom} 0%, ${theme.gradientTo} 100%)`,
    `linear-gradient(to top, ${scrim} 0%, rgba(0,0,0,0.10) 55%, transparent 100%)`,
    `#0f0d0b`,
  ].filter(Boolean).join(', ');

  return gradient;
}