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
  <div class= "ContentRowWide border-bottom">
      <div class="tip-summary-item">
        <span class="label-heading">Overall Sentiment</span>
        <div class = "flex flex-row gap-2 align-middle items-baseline">
          <div
            class="w-2 h-2 ring-1 ring-slate-900"
            style="background: {sentimentColor};"
          />
        <span class="label">
           {sentimentLabel}
        </span>
      </div>
    </div>


      <div class="tip-summary-item tip-summary-item--plutchik">
        <span class="label-heading">
          Emotion
        </span>
        <div class = "flex flex-row gap-2 align-middle items-baseline">
          <div
          class="w-2 h-2 rounded-full ring-1 ring-slate-900"
          style="background: {plutchikBg};"
        />
      <span class="label capitalize">
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
          <span class="w-4 h-4" style="background: {m.color};" />
          <span class="label">{m.label}</span>
          <span class="label">{ratingToLabel(step[m.key])}</span>
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

</style>