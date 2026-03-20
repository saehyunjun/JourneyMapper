<script>
  import { hoveredIndex, hoveredInflectionIndex } from './journeyStore.js';
  import { ratingToLabel, emotionColor, plutchikScoreToColor, DYAD_BY_ID, SCORE_ALIASES } from './journeyConfig.js';

  import QuotesRegular from "phosphor-icons-svelte/IconQuotesRegular.svelte";

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

  // ── Resolve which step to show ─────────────────────────────────────────────
  // hoveredIndex (main card) takes priority; inflection card is the fallback.
  $: activeIndex = $hoveredIndex >= 0
    ? $hoveredIndex
    : $hoveredInflectionIndex >= 0
      ? $hoveredInflectionIndex
      : -1;

  $: step = activeIndex >= 0 ? data[activeIndex] : null;

  // ── Flag when we're showing data via the inflection sub-card ──────────────
  $: isInflection = $hoveredIndex < 0 && $hoveredInflectionIndex >= 0;

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
  // Priority: DYAD_BY_ID on the raw label first, then SCORE_ALIASES for
  // intensity variants. Matches the lookup order used everywhere else.
  $: emotionSwatches = (() => {
    if (!step) return [];
    const raw  = step.plutchik_score?.toLowerCase().trim() ?? '';
    const dyad = DYAD_BY_ID[raw];
    if (dyad) return dyad.primary.map(pid => emotionColor(pid));
    const id = SCORE_ALIASES[raw] ?? raw;
    return [emotionColor(id)];
  })();

  // ── Quote ──────────────────────────────────────────────────────────────────
  $: hasQuote = !!(step?.quote?.trim());

  // ── Tooltip dimensions ─────────────────────────────────────────────────────
  const TIP_W    = 375;
  const TIP_H    = 40 + metrics.length * 28 + 80;
  const OFFSET_X = 14;
  const OFFSET_Y = 12;

  // ── Edge-flip: keep tooltip inside the viewport ────────────────────────────
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

    <!-- ── Header ─────────────────────────────────────────────────────── -->
    <div class="jm-section">
      <span class="label-sm">{step.stage}</span>
      <p class="label-lg">{step.step}</p>
      {#if isInflection}
        <span class="pill-sm w-fit">Inflection Point</span>
      {/if}
    </div>

    <!-- ── Sentiment + Emotion ────────────────────────────────────────── -->
    <div class="jm-content-row-stretch">

      <!-- Sentiment -->
      <div class="jm-content-col gap-1">
        <div class="flex items-center gap-2">
          <span class="tip-dot" style="background:{sentimentColor}" />
          <span class="text-body-sm-uppercase">{sentimentLabel}</span>
        </div>
        <span class="label-xs">Overall Sentiment</span>
      </div>

      <!-- Emotion / Plutchik -->
      <div class="flex flex-col gap-1">
        <div class="flex items-center gap-2">
          <div class="flex gap-1">
            {#each emotionSwatches as color}
              <span class="jm-mini-swatch" style="background:{color}" />
            {/each}
          </div>
          <span class="text-body-sm-uppercase">{step.plutchik_score}</span>
        </div>
        <span class="label-xs">Emotion</span>
      </div>

    </div>

    <!-- ── Quote ──────────────────────────────────────────────────────── -->
    {#if hasQuote}
      <div class="tip-quote-block">
        <span class="tip-quote-icon" aria-hidden="true">
          <QuotesRegular size={12} />
        </span>
        <p class="tip-quote-text">"{step.quote}"</p>
      </div>
    {/if}

    <!-- ── Metrics ────────────────────────────────────────────────────── -->
    <div class="jm-metrics">
      {#each metrics as m}
        <div class="jm-metric-row">
          <span class="jm-mini-swatch" style="background:{m.color}" />
          <span class="label-sm">{m.label}</span>
          <span class="text-body-sm">{ratingToLabel(step[m.key])}</span>
        </div>
      {/each}
    </div>

  </div>
{/if}

<style>
  .tooltip {
    position: fixed;
    pointer-events: none;
    z-index: 990;
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

  /* ── Quote block ────────────────────────────────────────────────────── */
  .tip-quote-block {
    display: flex;
    gap: 7px;
    align-items: flex-start;
    padding: 8px 10px;
    background: #EDE5D8;
    border-left: 2px solid #C4956A;
    border-radius: 2px;
  }

  .tip-quote-icon {
    color: #C4956A;
    flex-shrink: 0;
    margin-top: 1px;
    display: flex;
    align-items: flex-start;
  }

  .tip-quote-text {
    font-family: 'DM Sans', sans-serif;
    font-size: 10px;
    color: #5A3E28;
    line-height: 1.6;
    margin: 0;
    font-style: italic;
    display: -webkit-box;
    -webkit-line-clamp: 4;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
</style>