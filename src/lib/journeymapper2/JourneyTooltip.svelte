<script>
  import { hoveredIndex } from './journeyStore.js';
  import { ratingToLabel, emotionColor, emotionTextColor, plutchikScoreToColor } from './journeyConfig.js';

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

  // ── Plutchik score color ───────────────────────────────────────────────────
  $: plutchikBg      = step ? plutchikScoreToColor(step.plutchik_score) : '#BFA080';
  $: plutchikTextCol = step ? emotionTextColor(step.plutchik_score) : '#5A3E28';

  // ── Tooltip dimensions (must match CSS below) ──────────────────────────────
  const TIP_W = 375;
  const TIP_H = 40 + metrics.length * 28 + 60; // extra for sentiment + plutchik rows
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
    class="tooltip flex flex-col"
    style="left: {tipX}px; top: {tipY}px; width: {TIP_W}px;"
    role="tooltip"
    aria-live="polite"
  >

    <!-- Sentiment + Plutchik row -->
  <div class="tip-summary">
      <div class="tip-summary-item">
        <span class="text-2xs text-slate-500 font-semibold uppercase">Overall Sentiment</span>
        <div class = "flex flex-row gap-2 align-middle items-baseline">
          <div
            class="w-2 h-2 ring-1 ring-slate-900"
            style="background: {sentimentColor};"
          />
        <span class="text-xs text-slate-600">
           {sentimentLabel}
        </span>
      </div>
    </div>

      <div class="" />

      <div class="tip-summary-item tip-summary-item--plutchik">
        <span class="text-2xs text-slate-500 font-semibold uppercase">
          Emotion
        </span>
        <div class = "flex flex-row gap-2 align-middle items-baseline">
          <div
          class="w-2 h-2 rounded-full ring-1 ring-slate-900"
          style="background: {plutchikBg};"
        />
      <span class="text-xs text-slate-800 capitalize">
        {step.plutchik_score}
      </span>
    </div>
          
    </div>
  </div>

    <!-- Header: stage + step name -->
    <div class="tip-header flex flex-col w-full align-center justify-center py-2 gap-1">
      <p class="tip-stage flex text-2xs uppercase justify-center">{step.stage}</p>
      <p class="tip-step flex justify-center w-full text-lg font-medium leading-none">{step.step}</p>
    </div>



    <!-- Metric rows -->
    <div class="tip-metrics">
      {#each metrics as m}
        <div class="tip-row">
          <span class="tip-dot" style="background: {m.color};" />
          <span class="tip-label">{m.label}</span>
          <span class="tip-value">{ratingToLabel(step[m.key])}</span>
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
    background: #F4EFE5;
    border: 1px solid #DFC3A8;
    border-radius: 4px;
    padding: 10px 12px 12px;
    box-shadow: 0 4px 16px rgba(160, 100, 60, 0.14);
    transition: left 60ms linear, top 60ms linear;
  }

  /* ── Header ─────────────────────────────────────────────────── */
  .tip-header {
    border-bottom: #5A3E28 .5px dotted;
    justify-content: center;
    align-content: center;
  }

  /* ── Sentiment + Plutchik summary band ──────────────────────── */
  .tip-summary {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 0 8px;
    border-bottom: 1px solid #EDE5D8;
  }

  .tip-summary-item {
    display: flex;
    flex-direction: column;
    gap: 5px;
    flex: 1;
  }

  .tip-summary-divider {
    width: 1px;
    height: 36px;
    background: #DFC3A8;
    flex-shrink: 0;
  }
  
  /* ── Metric rows ─────────────────────────────────────────────── */
  .tip-metrics {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding-top: 8px;
  }

  .tip-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .tip-dot {
    width: .25em;
    height: .725em;
    border-radius: 2em;
    flex-shrink: 0;
    opacity: 0.9;
  }

  .tip-label {
    font-size: .825em;
    color: #7A5A3A;
    flex: 1;
  }

  .tip-value {
    font-size: .825em;
    color: #5A3E28;
    font-weight: 500;
    text-align: right;
    white-space: nowrap;
  }
</style>