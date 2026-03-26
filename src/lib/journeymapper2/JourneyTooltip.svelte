<script>
  import { hoveredIndex, hoveredInflectionIndex } from './journeyStore.js';
  import { ratingToLabel, emotionColor, plutchikScoreToColor, DYAD_BY_ID, SCORE_ALIASES, sentimentToColor } from './journeyConfig.js';

  import QuotesRegular from "phosphor-icons-svelte/IconQuotesRegular.svelte";
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

  // ── Sentiment label and color ──────────────────────────────────────────────
  $: sentimentVal   = step ? parseFloat(step.sentiment) : 0;
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
  const TIP_W    = 375;
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

<svelte:window on:mousemove={onMouseMove} />

{#if step}
  <div
    class="tooltip jm-surface flex flex-col gap-2"
    style="left: {tipX}px; top: {tipY}px; width: {TIP_W}px;"
    role="tooltip"
    aria-live="polite"
  >

    <!-- ── Header ─────────────────────────────────────────────────────── -->
    {#if isInflection}
    <div class="flex flex-row w-full justify-end">
    <span class="pill-sm">
      <IconArrowsOutLineVerticalRegular />
      Inflection Point</span>
    </div>
    {/if}
    

    <div class="header-row">
      <p class="label-sm font-bold">{step.step}</p>
      <span class="label-xs text-right">{step.stage}</span>
    </div>


    <!-- ── Quote ──────────────────────────────────────────────────────── -->
    {#if hasQuote}
      <div class="flex flex-col justify-center">
        <span class="tip-quote-icon" aria-hidden="true">
          <QuotesRegular class="h-12" />
        </span>
        <p class="pull-quote-sm">{step.quote}</p>
      </div>
    {/if}


    <!-- ── Sentiment + Emotion ────────────────────────────────────────── -->

  <div class="jm-content-row-divider">
      <div class="flex flex-row">

      <!-- Sentiment -->
       <div class ="jm-content-col">
        <div class="flex flex-col">
          <span class="w-full h-2 ring-1" 
          style="background:{sentimentColor}">
          </span>
          
        <div class="jm-content-col mt-1">
          <span class="label-sm">
            {sentimentLabel}
          </span>
          <span class="label-xs">
            Overall Sentiment
          </span>
      </div>
        </div>
      </div>
      </div>

      <!-- Emotion / Plutchik -->
      <div class="flex flex-col gap-1">
        <div class="flex flex-col">
          <div class="flex">
            {#each emotionSwatches as color}
              <span class="w-3 h-3 ring-1 rounded-full" style="background:{color}">
              </span>
            {/each}
          </div>
          
          <div class="jm-content-col mt-1">
            <span class="text-body-sm font-semibold capitalize">
            {step.plutchik_score}
          </span>
          <span class="label-xs">Emotion</span>
          </div>
        </div>
      </div>
  </div>
  </div>
{/if}
<style>
</style>