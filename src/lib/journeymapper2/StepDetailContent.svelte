<script>
  import { tweened } from 'svelte/motion';
  import { cubicInOut } from 'svelte/easing';
  import { fade } from 'svelte/transition';
  import { createEventDispatcher } from 'svelte';
  import { selectedIndex } from './journeyStore.js';
  import ExperienceWheel from './ExperienceWheel.svelte';
  import IndexMetricBars from './IndexMetricBars.svelte';

  import { emotionColor, ratingToLabel, DYAD_BY_ID, SCORE_ALIASES, SENTIMENT_SCALE, sentimentToColor } from './journeyConfig.js';
  import QuotesRegular from 'phosphor-icons-svelte/IconQuotesRegular.svelte';
  import ArrowSquareOutRegular from 'phosphor-icons-svelte/IconArrowSquareOutRegular.svelte';

  const dispatch = createEventDispatcher();

  export let data    = [];
  export let metrics = [];
  /** Optional experience wheel data — renders below metrics when present */
  export let wheelData = /** @type {any} */ (null);

  const TWEEN_OPTS = { duration: 400, easing: cubicInOut };

  // 10 evenly-spaced stops for index metric square rows (−5 → +5)
  const METRIC_STOPS = Array.from({ length: 10 }, (_, i) => -5 + i * (10 / 9));

  $: step = $selectedIndex >= 0 ? data[$selectedIndex] : null;
  $: sentimentLabel = step ? ratingToLabel(step.sentiment) : '';

  $: emotionSwatches = (() => {
    if (!step) return [];
    const raw = step.plutchik_score?.toLowerCase().trim() ?? '';
    const dyad = DYAD_BY_ID[raw];
    if (dyad) return dyad.primary.map(pid => emotionColor(pid));
    const id = SCORE_ALIASES[raw] ?? raw;
    return [emotionColor(id)];
  })();

  // ── Tweened sentiment ─────────────────────────────────────────────────
  const sentimentTween = tweened(0, TWEEN_OPTS);
  $: if (step) sentimentTween.set(parseFloat(step.sentiment ?? 0));
  $: sentimentTweenVal = $sentimentTween;
  $: sentimentColor    = sentimentToColor($sentimentTween);

  // ── Tweened metric stores ─────────────────────────────────────────────
  let metricTweens = /** @type {ReturnType<typeof tweened>[]} */ ([]);
  let metricVals   = /** @type {number[]} */ ([]);

  $: if (metrics.length > metricTweens.length) {
    const toAdd = metrics.length - metricTweens.length;
    for (let j = 0; j < toAdd; j++) {
      const store = tweened(0, TWEEN_OPTS);
      const idx   = metricTweens.length;
      store.subscribe(v => {
        metricVals[idx] = v;
        metricVals = [...metricVals];
      });
      metricTweens = [...metricTweens, store];
    }
  }

  $: if (step) {
    metrics.forEach((m, i) => {
      metricTweens[i]?.set(parseFloat(step[m.key] ?? 0));
    });
  }

  function toPercent(val) {
    return ((parseFloat(val) + 5) / 10) * 100;
  }
</script>

{#if step}
  <div class="content-wrap">

    <!-- Step name -->
  <div class="jm-content-row">
    <!-- Sentiment -->
    <div class="flex flex-col gap-1 w-9/12 justify-end">
    <h2 class="heading-sm">
      {step.stage}
    </h2>
    <h2 class="heading text-3xl">
      {step.step}
    </h2>
  </div>

  <div class="flex flex-col w-3/12 gap-2">        
    <div class="btn-extranote-empty">
      <div
        class="w-3 h-3 ring-1 ring-slate-800 shrink-0"
        style="background: {sentimentColor};">
      </div>
      <span class="label uppercase font-semibold">
        {sentimentLabel}
      </span>
    </div>
  
  

  <!-- Emotion tag — clickable, opens Plutchik sub-drawer -->  
    <button
      class="btn-extranote"
      on:click={() => dispatch('openEmotionDetail')}
      aria-label="Learn about {step.plutchik_score} — open emotion detail"
      title="About Plutchik emotions">
      <div class="flex flex-row w-fit gap-0">
        {#each emotionSwatches as color}
          <span class="w-4 h-4 rounded-full ring-1" style="background: {color};"></span> 
        {/each}
        </div>
        <span class="label uppercase font-semibold">{step.plutchik_score}
        </span>
        <ArrowSquareOutRegular class="icon-dark" />
      </button>
    </div>
  </div>
    <!-- ── Sentiment + Emotion row ──────────────────────────────── -->
    <div class="flex flex-row gap-4 w-full justify-between">



        </div>

    <div class="divider"></div>

    <!-- ── Step Quote ─────────────────────────────────────────────── -->
    {#if step.quote}
      <div class="card-quote ">
        <QuotesRegular class="quote-icon" />
        <p class="pull-quote">{step.quote}</p>
      </div>
      <div class="divider"></div>
    {/if}

    <!-- ── Narrative description ──────────────────────────────────── -->
    {#if step.narrative_description}
      <div class="jm-content-col gap-2 text-pretty">
        <span class="heading-sm">Step Narrative</span>
        <p class="text-body">{step.narrative_description}</p>
      </div>
    {/if}

    <div class="divider"></div>

    <!-- ── Index Metrics ──────────────────────────────────────────── -->
    <div class="metrics-section">
      <div class="jm-content-row-stretch">
        <span class="label-sm">Sentiment</span>
        <span class="label uppercase">{sentimentLabel}</span>
      </div>
         <!-- Score squares -->
        <div class="score-squares">
          {#each SENTIMENT_SCALE as stopColor, i}
          {@const activePos = ($sentimentTween + 5) / 10 * (SENTIMENT_SCALE.length - 1)}
          {@const isActive  = i === Math.round(activePos)}
          {@const dist      = Math.abs(i - activePos)}
          {@const opacity   = isActive ? 1 : Math.max(0.12, 1 - dist * 0.1)}
          <div
              class="score-square"
              class:score-square--active={isActive}
              style="background: {stopColor}; opacity: {opacity};">
          </div>
              {/each}
          </div>
    <!-- ── Index Metrics ──────────────────────────────────────────── -->
    <IndexMetricBars
      {metrics}
      {metricVals}
      selectedIndex={$selectedIndex}
    />    </div>

    <div class="divider"></div>

  </div>

  <!-- ── Experience Wheel — renders flush below when data is available ── -->
  {#if wheelData}
    <div class="wheel-section">
      <div class="wheel-section-label">
        <span class="wheel-icon" aria-hidden="true">◎</span>
        Experience Wheel
      </div>
      <ExperienceWheel
        data={wheelData}
        stepName={step.step}
        stageName={step.stage}
      />
    </div>
  {/if}
{/if}


<style>

  /* ── Score squares (sentiment + metrics) ────────────────────── */
  .score-squares {
    display: flex;
    flex-direction: row;
    gap: .25em;
    width: 100%;
  }
  .score-square {
    flex: 1;
    height: 1.25em;
    filter: saturate(.15);
    opacity: 20%;
    transition: opacity 0.125s cubic-bezier(0.4, 0, 0.2, 1);
  }
  .score-square--active {
    outline: 1.5px solid var(--grayblue);
    outline-offset: 1px;
    filter: saturate(1);
    opacity: 100%;
  }

  /* ── Metric rows ─────────────────────────────────────────────── */
  .metrics-section { display: flex; flex-direction: column; gap: 14px; }



  /* ── Experience Wheel section ────────────────────────────────── */
  .wheel-section {
    border-top: 1px solid #DFC3A8;
  }

  .wheel-section-label {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 16px;
    font-family: 'DM Sans', sans-serif;
    font-size: 9px;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: #A08060;
    background: #EDE5D8;
    border-bottom: 1px solid #DFC3A8;
  }

  .wheel-icon {
    font-size: 11px;
    color: #C4956A;
  }
</style>