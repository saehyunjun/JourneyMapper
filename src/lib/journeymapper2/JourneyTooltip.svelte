<script>
  import { hoveredIndex } from './journeyStore.js';
  import { ratingToLabel, emotionColor, emotionTextColor, plutchikScoreToColor, DYAD_BY_ID, SCORE_ALIASES } from './journeyConfig.js';

  export let data    = [];
  export let metrics = [];

  /** The scrollable container element — used for edge-flip calculations */
  export let anchorEl = null;

  // ── Cursor tracking ────────────────────────────────────────────────────────
  let mouseX = 0;
  let mouseY = 0;

  function onMouseMove(e) {
    mouseX = e.clientX;
    mouseY = e.clientY;
  }

  // ── Derived step data ──────────────────────────────────────────────────────
  $: step = $hoveredIndex >= 0 ? data[$hoveredIndex] : null;

  // ── Sentiment label and color ──────────────────────────────────────────────
  $: sentimentVal   = step ? parseFloat(step.sentiment) : 0;
  $: sentimentLabel = step ? ratingToLabel(step.sentiment) : '';
  $: sentimentColor = step ? (() => {
      const n = Math.max(-5, Math.min(5, sentimentVal));
      const t = (n + 5) / 10;
      let r, g, b;
      if (t < 0.5) {
        const u = t / 0.5;
        r = Math.round(192 + (212 - 192) * u);
        g = Math.round(57  + (138 - 57)  * u);
        b = Math.round(43  + (27  - 43)  * u);
      } else {
        const u = (t - 0.5) / 0.5;
        r = Math.round(212 + (39  - 212) * u);
        g = Math.round(138 + (174 - 138) * u);
        b = Math.round(27  + (96  - 27)  * u);
      }
      return `rgb(${r},${g},${b})`;
    })() : '#BFA080';

  // ── Plutchik dyad squares ──────────────────────────────────────────────────
  // Same priority logic as StepDetailContent: check DYAD_BY_ID first on the
  // raw label, then fall back to SCORE_ALIASES for intensity variants.
  $: emotionSwatches = (() => {
    if (!step) return [];
    const raw  = step.plutchik_score?.toLowerCase().trim() ?? '';
    const dyad = DYAD_BY_ID[raw];
    if (dyad) {
      return dyad.primary.map(pid => emotionColor(pid));
    }
    const id = SCORE_ALIASES[raw] ?? raw;
    return [emotionColor(id)];
  })();

  // ── Tooltip dimensions (must match CSS below) ──────────────────────────────
  const TIP_W    = 375;
  const TIP_H    = 40 + metrics.length * 28 + 60;
  const OFFSET_X = 14;
  const OFFSET_Y = 12;

  // ── Compute position: flip left if near right edge, flip up if near bottom ─
  $: vpW = typeof window !== 'undefined' ? window.innerWidth  : 9999;
  $: vpH = typeof window !== 'undefined' ? window.innerHeight : 9999;

  $: flipLeft = mouseX + OFFSET_X + TIP_W > vpW - 12;
  $: flipUp   = mouseY + OFFSET_Y + TIP_H > vpH - 12;

  $: tipX = flipLeft ? mouseX - TIP_W - OFFSET_X : mouseX + OFFSET_X;
  $: tipY = flipUp   ? mouseY - TIP_H - OFFSET_Y : mouseY + OFFSET_Y;
</script>

<svelte:window on:mousemove={onMouseMove} />

{#if step}
  <div
    class="tooltip jm-surface flex flex-col gap-2"
    style="left: {tipX}px; top: {tipY}px; width: {TIP_W}px;"
    role="tooltip"
    aria-live="polite"
  >

    <!-- Header -->
    <div class="jm-section">
      <span class="label-sm">{step.stage}</span>
      <p class="label-lg">{step.step}</p>
    </div>

    <!-- Sentiment + Emotion -->
    <div class="jm-content-row-stretch">

      <!-- Sentiment -->
      <div class="jm-content-col gap-1">
        <div class="flex items-center gap-2">
          <span
            class="tip-dot"
            style="background:{sentimentColor}"
          />
          <span class="text-body-sm-uppercase">{sentimentLabel}</span>
        </div>
        <span class="label-xs">Overall Sentiment</span>
      </div>

      <!-- Emotion -->
      <div class="flex flex-col gap-1 justify-right">
        <div class="flex items-center gap-2 justify-right">
          <div class="flex">
            {#each emotionSwatches as color}
              <span class="jm-mini-swatch" style="background:{color}" />
            {/each}
          </div>
          <span class="text-body-sm-uppercase">{step.plutchik_score}</span>
        </div>
        <span class="label-xs">Emotion</span>
      </div>

    </div>

    <!-- Metrics -->
    <div class="jm-metrics">
      {#each metrics as m}
        <div class="jm-metric-row">

          <span
            class="jm-mini-swatch"
            style="background:{m.color}"
          />

          <span class="label-sm">{m.label}</span>
          <span class="text-body-sm">
            {ratingToLabel(step[m.key])}
          </span>

        </div>
      {/each}
    </div>

  </div>
{/if}
<style>
.tooltip {
  position: fixed;
  pointer-events: none;
  z-index: 300;

  padding: 10px 12px 12px;
  border-radius: 4px;

  transition: left 60ms linear, top 60ms linear;
}

/* Sentiment dot */
.tip-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  border: 1px solid rgba(0,0,0,.5);
  flex-shrink: 0;
}

/* Emotion swatches */
.emotion-square {
  width: 10px;
  height: 10px;
  border: 1px solid rgba(0,0,0,.25);
}
</style>