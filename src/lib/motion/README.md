# Data viz motion

Shared motion system for Svelte + D3 + SVG visualisations in JourneyMapper.
Three modes drive every animated chart, with one set of presets and helpers
in [`viz.ts`](./viz.ts) plus a small CSS layer in
[`src/app.css`](../../app.css).

The marks always stay live SVG/D3 — animations apply to opacity, transforms,
stroke-dasharray sweeps, and per-frame data-derived attributes. **No Lottie,
no video shims.**

## Motion modes

| Mode        | When to use                                                                                 |
|-------------|---------------------------------------------------------------------------------------------|
| `none`      | Static export, print, tests, reduced-motion users.                                          |
| `dashboard` | Default in-app. Restrained intro that animates in once and settles.                         |
| `story`     | Exports, presentations, hero cards. Slower, deliberate, replayable, visually richer.        |

`prefers-reduced-motion: reduce` is honoured automatically — `resolveMotionMode`
collapses to `'none'` when the OS asks for it, and `.viz-*` CSS classes are
neutralised inside a `@media (prefers-reduced-motion: reduce)` block.

## Component API

Animated viz components accept this idiomatic Svelte 5 prop set:

```ts
type Props = {
  motionMode?: VizMotionMode;        // 'none' | 'dashboard' | 'story'
  replayKey?: number;                // bump to restart the intro
  stagger?: boolean;                 // honour preset stagger (default true)
  reducedMotion?: boolean;           // force-override the OS check
  animationDuration?: number;        // ms; overrides the preset duration
  onintrocomplete?: () => void;      // fires once the last mark + label settle
};
```

`SentimentDonut` is the reference implementation
([src/lib/components/SentimentDonut.svelte](../components/SentimentDonut.svelte)).

## How `replayKey` works

Every animated viz reads `replayKey` from `$effect` and restarts its
choreography when it changes. The change must be a *new* value — bumping is
the idiom:

```svelte
<script>
  let replayKey = $state(0);
</script>

<SentimentDonut
  positive={f.distribution.positive}
  neutral={f.distribution.neutral}
  negative={f.distribution.negative}
  motionMode="story"
  replayKey={replayKey}
/>

<button onclick={() => (replayKey += 1)}>Replay</button>
```

Data changes alone do **not** trigger a replay (data updates aren't a viewing
event). Bump `replayKey` explicitly when you want the intro to run again.

## Deterministic export

Story mode is designed to record cleanly:

- All delays come from `getStaggerDelay(index, mode)` — no `Math.random`.
- Easing is `cubicInOut` for story, `cubicOut` for dashboard. Both are
  re-implemented as CSS `cubic-bezier()` so SVG and CSS branches agree.
- The intro ends at a known time. Use `getIntroTotalDuration(mode, markCount)`
  to know exactly when to stop a recorder.
- Wrap a recording region in `.viz-export-safe`. That class forces
  `animation-iteration-count: 1` on every descendant so a stray infinite
  animation can't leak into the GIF.

## Avoiding misleading animation

The hard rule: **final geometry must match the data.** Patterns to follow:

- For arc sweeps, animate `stroke-dasharray` from `0` → its data-derived
  value. Set the final value directly on the last frame; don't lerp to a
  rounded approximation.
- For bar growth, animate `scaleY` from a tiny epsilon (e.g. 0.001) to 1.
  Never animate the bar's *value*; animate its visible reveal.
- For count-up labels, format with rounding only on the eased intermediate
  values — the final frame is always exact because progress hits 1.
- Don't animate axis ticks into values that aren't present in the data.
  Tick rings/labels should appear with the final scale or fade in alongside.
- Story mode's negative→neutral→positive reveal is a *display order*, not a
  data reordering. The slice positions around the donut are unchanged; only
  the per-band reveal slot moves.

## Utilities cheatsheet

```ts
import {
  getVizMotionPreset,    // preset numbers for a mode
  getStaggerDelay,       // deterministic per-index delay
  getArcTweenConfig,     // { duration, delay, ease } for an arc
  getBarTweenConfig,     // same shape, for bars
  getLabelRevealConfig,  // labels fade after marks settle
  getIntroTotalDuration, // end-of-intro timestamp
  sentimentRevealIndex,  // negative→neutral→positive sort key
  prefersReducedMotion,  // OS check (SSR-safe)
  resolveMotionMode,     // mode + reducedMotion → effective mode
  countUp,               // Svelte action: text 0→N with reset on replayKey
  type VizMotionMode
} from '$lib/motion/viz';
```

## CSS classes (SVG-safe)

| Class                    | What it does                                                            |
|--------------------------|-------------------------------------------------------------------------|
| `.viz-mark`              | Base mark — opacity 0 → 1 + tiny translateY on `.is-revealed`.          |
| `.viz-mark-dashboard`    | Uses the dashboard duration/easing tokens.                              |
| `.viz-mark-story`        | Uses the story duration/easing tokens.                                  |
| `.viz-bar-grow`          | `scaleY(0.001)` → `1` with `transform-origin: center bottom`.           |
| `.viz-arc-sweep`         | Fade hint; the actual dash sweep is JS-driven for data accuracy.        |
| `.viz-path-draw`         | Transitions `stroke-dashoffset` — caller sets the path length inline.   |
| `.viz-label`             | Label fade + 2px lift. Pair with `.is-revealed`.                        |
| `.viz-label-reveal`      | Alias for `.viz-label` used on `<text>` nodes.                          |
| `.viz-pulse-once`        | One-shot 720ms accent pulse (story-mode annotations).                   |
| `.viz-export-safe`       | Safety wrapper for recording regions.                                   |

All classes use `transform-box: fill-box` and `transform-origin: center` on
SVG so the animation pivots around the mark, not the SVG canvas. None of
them touch width/height — layout is never disturbed.

## Building a new animated viz

1. Add the standard prop set above.
2. Inside the script, derive `effectiveMode` via
   `resolveMotionMode(motionMode, reducedMotion)`.
3. Hold linear `elapsedMs` in `$state`, drive it from a single `rAF` loop
   started by `startIntro()`.
4. Read per-mark delays from `getArcTweenConfig` / `getBarTweenConfig` and
   compute each mark's local progress as
   `clamp((elapsedMs - delay) / duration)`, then ease it once.
5. Restart from `$effect` when `replayKey` or `effectiveMode` changes — wrap
   the restart call in `untrack(...)` so the effect tracks only the trigger.
6. If a `<text>` label is involved, schedule its fade with
   `getLabelRevealConfig(mode, bands.length)` so it lands after the marks
   settle.
7. If a numeric label is involved, use `countUp` so the value matches.

## Reference: SentimentDonut

- Dashboard: all three bands sweep in together, ~600ms easeOutCubic, no
  stagger; final dasharray equals the data-derived dash. Already used in
  every "key finding" card on
  [`/wctglpdemo`](../../routes/wctglpdemo/+page.svelte).
- Story: bands reveal negative → neutral → positive at 140ms stagger over
  ~1.1s each. A centred count-up of the segment total fades in after the
  last band settles.
- A replayable preview lives on the landing page beside the sentiment-lean
  bar so the same corpus numbers drive both the static and the animated
  view.
