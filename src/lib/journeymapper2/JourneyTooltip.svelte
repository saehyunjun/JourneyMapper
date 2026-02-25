<script>
  import { hoveredIndex } from './journeyStore.js';
  import { ratingToLabel, emotionTextColor, plutchikScoreToColor } from './journeyConfig.js';

  export let data = [];
  export let metrics = [];
  export let anchorEl = null;

  let mouseX = 0;
  let mouseY = 0;
  function onMouseMove(e) {
    mouseX = e.clientX;
    mouseY = e.clientY;
  }

  // ── Derived step data ──────────────────────────────────────────────────────
  $: step = $hoveredIndex >= 0 ? data[$hoveredIndex] : null;

  // ── Sentiment label and color ──────────────────────────────────────────────
  $: sentimentVal = step ? parseFloat(step.sentiment) : 0;
  $: sentimentLabel = step ? ratingToLabel(step.sentiment) : '';

  $: sentimentColor = step
    ? (() => {
        const n = Math.max(-5, Math.min(5, sentimentVal));
        const t = (n + 5) / 10;
        let r, g, b;
        if (t < 0.5) {
          const u = t / 0.5;
          r = Math.round(192 + (212 - 192) * u);
          g = Math.round(57 + (138 - 57) * u);
          b = Math.round(43 + (27 - 43) * u);
        } else {
          const u = (t - 0.5) / 0.5;  
          r = Math.round(212 + (39 - 212) * u);
          g = Math.round(138 + (174 - 138) * u);
          b = Math.round(27 + (96 - 27) * u);
        }
        return `rgb(${r},${g},${b})`;
      })()
    : '#BFA080';

  // ── Plutchik score color ───────────────────────────────────────────────────
  $: plutchikBg = step ? plutchikScoreToColor(step.plutchik_score) : '#BFA080';
  $: plutchikTextCol = step ? emotionTextColor(step.plutchik_score) : '#5A3E28';

  // ── Tooltip sizing + positioning (measure real size, don’t hardcode) ───────
  let tipEl;

  const OFFSET_X = 14;
  const OFFSET_Y = 12;

  $: vpW = typeof window !== 'undefined' ? window.innerWidth : 9999;
  $: vpH = typeof window !== 'undefined' ? window.innerHeight : 9999;

  // Fallbacks before first measure
  $: tipW = tipEl?.offsetWidth ?? 420;
  $: tipH = tipEl?.offsetHeight ?? 220;

  $: flipLeft = mouseX + OFFSET_X + tipW > vpW - 12;
  $: flipUp = mouseY + OFFSET_Y + tipH > vpH - 12;

  $: tipX = flipLeft ? mouseX - tipW - OFFSET_X : mouseX + OFFSET_X;
  $: tipY = flipUp ? mouseY - tipH - OFFSET_Y : mouseY + OFFSET_Y;
</script>

<svelte:window on:mousemove={onMouseMove} />

{#if step}
  <div
    bind:this={tipEl}
    class="tooltip"
    style="left: {tipX}px; top: {tipY}px;"
    role="tooltip"
    aria-live="polite"
  >
    <!-- Title block (matches wireframe: big step title, then rule) -->
    <div class="jm-block">
      <div class="kicker">{step.stage}</div>
      <div class="title">{step.step}</div>
    </div>

    <div class="rule"></div>

    <!-- Emotion analysis bar (matches wireframe dark label strip) -->
    <div class="section-bar">
      <span class="uppercase">Sentiment Snapshot</span>
    </div>

    <!-- Two-column row: sentiment (left) + emotion (right) -->
    <div class="emotion-row">
      <div class="sentiment">
        <span class="dot" style="background: {sentimentColor};"></span>
        <span class="value">{sentimentLabel}</span>
      </div>

      <div class="emotion">
        <span class="swatches">
          <span class="swatch" style="background: {plutchikBg};"></span>
          <span class="swatch" style="background: {plutchikBg}; opacity: 0.85;"></span>
        </span>
        <span class="value capitalize">
          {step.plutchik_score}
        </span>
      </div>
    </div>

    {#if metrics?.length}
      <div class="metrics">
        {#each metrics as m}
          <div class="metric-row">
            <span class="mini-swatch" style="background: {m.color};"></span>
            <span class="label">{m.label}</span>
            <span class="val">{ratingToLabel(step[m.key])}</span>
          </div>
        {/each}
      </div>
    {/if}
  </div>
{/if}

<style>
  .tooltip {
    position: fixed;
    pointer-events: none;
    z-index: 300;
    background: #f4efe5;
    border: 1px solid #ff0000;
    box-shadow: 0 10px 28px rgba(0, 0, 0, 0.18);

    width: 420px;
    padding: 16px 18px 14px;
    transition: left 60ms linear, top 60ms linear;
  }


  .kicker {
    font-size: 11px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #3b3b3b;
    font-weight: 700;
    margin-bottom: 4px;
  }

  .title {
    font-size: 18px;
    font-weight: 900;
    line-height: 1.15;
    color: #111;
  }

  .rule {
    height: 2px;
    background: #1a1a1a;
    margin: 8px 0 12px;
  }

  .section-bar {
    background: #4a4a4a;
    color: #fff;
    font-weight: 800;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    font-size: 12px;

    padding: 8px 10px;
    margin: 0 0 10px;
  }

  .emotion-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 14px;
    align-items: center;

    padding: 6px 2px 10px;
    border-bottom: 2px solid #1a1a1a;
  }

  .sentiment,
  .emotion {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 28px;
  }

  .dot {
    width: 20px;
    height: 20px;
    border-radius: 999px;
    border: 2px solid #1a1a1a;
    flex: 0 0 auto;
  }

  .swatches {
    display: inline-flex;
    border: 2px solid #1a1a1a;
    height: 18px;
    overflow: hidden;
  }

  .swatch {
    width: 18px;
    height: 18px;
    display: inline-block;
  }

  .value {
    font-weight: 900;
    font-size: 16px;
    color: #111;
    line-height: 1;
    text-transform: uppercase;
  }

  .metrics {
    padding-top: 10px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .metric-row {
    display: grid;
    grid-template-columns: 14px 1fr auto;
    gap: 10px;
    align-items: center;
  }

  .mini-swatch {
    width: 12px;
    height: 12px;
    border: 2px solid #1a1a1a;
    display: inline-block;
  }

  .label {
    font-size: 12px;
    font-weight: 700;
    color: #2a2a2a;
  }

  .val {
    font-size: 12px;
    font-weight: 800;
    color: #111;
    text-transform: uppercase;
  }
</style>