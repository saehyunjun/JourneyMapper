<script>
  import { hoveredIndex, hoveredInflectionIndex } from './journeyStore.js';
  import { ratingToLabel, emotionColor, buildStageColorMap, sentimentToColor, DYAD_BY_ID, SCORE_ALIASES } from './journeyConfig.js';

  import IconArrowsOutLineVerticalRegular from 'phosphor-icons-svelte/IconArrowsOutLineVerticalRegular.svelte';

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
  $: activeIndex = $hoveredIndex >= 0
    ? $hoveredIndex
    : $hoveredInflectionIndex >= 0
      ? $hoveredInflectionIndex
      : -1;

  $: step = activeIndex >= 0 ? data[activeIndex] : null;

  $: isInflection = $hoveredIndex < 0 && $hoveredInflectionIndex >= 0;

  // ── Stage color ────────────────────────────────────────────────────────────
  $: stageColorMap = buildStageColorMap(data);
  $: stageColor = (step && stageColorMap[step.stage_id]) ? stageColorMap[step.stage_id] : 'var(--jm-icon-dark, #3a3a3a)';

  // ── Sentiment label and color ──────────────────────────────────────────────
  $: sentimentLabel = step ? ratingToLabel(step.sentiment) : '';
  $: sentimentColor = step ? sentimentToColor(step.sentiment) : '#BFA080';

  // ── Plutchik dyad squares ──────────────────────────────────────────────────
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
  const TIP_W    = 450;
  const TIP_H    = 40 + metrics.length * 28 + 80;
  const OFFSET_X = 14;
  const OFFSET_Y = 8;

  $: vpW = typeof window !== 'undefined' ? window.innerWidth  : 9999;
  $: vpH = typeof window !== 'undefined' ? window.innerHeight : 9999;

  $: flipLeft = mouseX + OFFSET_X + TIP_W > vpW - 12;
  $: flipUp   = mouseY + OFFSET_Y + TIP_H > vpH - 12;

  $: tipX = flipLeft ? mouseX - TIP_W - OFFSET_X : mouseX + OFFSET_X;
  $: tipY = flipUp   ? mouseY - TIP_H - OFFSET_Y : mouseY + OFFSET_Y;
</script>

<!-- ── KEY FIX: onmousemove (Svelte 5 syntax) ─────────────────────────────── -->
<svelte:window onmousemove={onMouseMove} />

{#if step}
  <div
    class="tooltip flex flex-col gap-2"
    style="
      left: {tipX}px;
      top: {tipY}px;
      width: {TIP_W}px;
      border: 2.25px solid {stageColor};
      outline: 2px solid {stageColor};
      pointer-events: none;
    "
    role="tooltip"
    aria-live="polite"
  >

    <!-- ── Inflection badge ───────────────────────────────────────────── -->
    {#if isInflection}
      <div class="flex flex-row w-full justify-end">
        <span class="pill-sm">
          <IconArrowsOutLineVerticalRegular />
          Inflection Point
        </span>
      </div>
    {/if}

    <!-- ── Header: stage + step name ─────────────────────────────────── -->
    <div
      class="flex flex-col gap-1 items-center mb-2 pb-2"
      style="border-bottom: 2.25px solid {stageColor};"
    >
      <span class="label-xs text-center" style="color: {stageColor};">
        {step.stage}
      </span>
      <h3 class="heading-serif-sm text-center" style="color: {stageColor};">
        {step.step}
      </h3>
    </div>

    <!-- ── Quote ──────────────────────────────────────────────────────── -->
    {#if hasQuote}
      <div class="flex flex-col justify-center px-2">
        <p class="pull-quote text-center" style="color: var(--ink);">
          "{step.quote}"
        </p>
      </div>
    {/if}

    <!-- ── Sentiment + Emotion ────────────────────────────────────────── -->
    <div class="jm-content-row-stretch">
      <div class="sentiment-container items-center">
        <span class="jm-swatch-sm" style="background:{sentimentColor};"></span>
        <span class="label-xs uppercase">{sentimentLabel}</span>

        <div class="sentiment-container">
          <div class="emotion-container">
            {#each emotionSwatches as color}
              <span class="jm-swatch-round-sm" style="background:{color};"></span>
            {/each}
          </div>
          <div class="flex flex-col align-bottom">
            <span class="label-xs uppercase">{step.plutchik_score}</span>
          </div>
        </div>
      </div>
    </div>

  </div>
{/if}

<style>
</style>