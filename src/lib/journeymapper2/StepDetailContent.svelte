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
  import ArrowElbowDownRight from "phosphor-icons-svelte/IconArrowElbowDownRightDuotone.svelte";
 
  const dispatch = createEventDispatcher();
 
  export let data    = [];
  export let metrics = [];
  /** Optional experience wheel data — renders below metrics when present */
  export let wheelData = /** @type {any} */ (null);
  /**
   * Illustration image src for the current step.
   * Pass a dynamic value from the parent (e.g. keyed by step_id or stage_id).
   * Defaults to the placeholder illustration.
   */
  export let illustrationSrc = 'illustrations/Regression1.jpeg';
 
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
 
  // ── Illustration error fallback ───────────────────────────────────────
  let imgError = false;
  $: if (illustrationSrc) imgError = false; // reset on src change
</script>
{#if step}
  <div class="content-wrap">
    <div class="toolbar py-2">        
      <div class="btn-extranote-empty ml-2">
        <div class="w-3 h-3 ring-1 ring-slate-500"          
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
          <span class="w-2 h-2 rounded-full ring-1" style="background: {color};"></span> 
        {/each}
        </div>
        <span class="label uppercase font-semibold">{step.plutchik_score}
        </span>
        <ArrowSquareOutRegular class="icon-dark" />
      </button>
  </div>

    
    <!-- ── Step illustration ──────────────────────────────────────── -->
    {#key illustrationSrc}
      <div class="step-illustration h-50" in:fade={{ duration: 300 }}>
        {#if !imgError}
          <img
            src={illustrationSrc}
            alt="Illustration for {step.step}"
            class="step-illustration__img"
            on:error={() => (imgError = true)}
          />
        {:else}
          <div class="step-illustration__fallback stats-animation-gradient__gradient--night bg-slate-900">
          </div>
        {/if}
      </div>
    {/key}
 
    
    <div class="flex flex-col gap-4 w-full pb-2">
    <div class="toolbar-dark px-4 h-20">
      <h2 class="heading text-3xl text-slate-50">
        {step.step}
    </h2> 
    <h3 class="heading-xs text-slate-50">
      {step.stage}
    </h3>
  </div>
    <!-- ── Narrative description ──────────────────────────────────── -->
    {#if step.narrative_description}
    <div class="jm-content-col pl-4">
      <p class="text-body">{step.narrative_description}</p>
    </div>
    {/if}
  </div>


    <!-- ── Step Quote ─────────────────────────────────────────────── -->
    {#if step.quote}
    <div class="flex flex-col gap-4 w-full mt-4 pb-4">
      <div class="toolbar py-2 px-4">
      <h2 class="heading-xs">
        Key Quotes
      </h2>
    </div>
      <div class="card-quote ml-8">
      <p class="pull-quote p-8 text-slate-800 text-pretty">
          &ldquo;{step.quote}&rdquo;
        </p>
        <div class="detail-bar">
          topic 1
        </div>
      </div>
      </div>
      
    {/if}


    

    <!-- ── Index Metrics ──────────────────────────────────────────── -->
    <div class="flex flex-col gap-4 w-full">
      <div class="toolbar py-2 px-4">
        <h3 class="heading-sm">Sentiment</h3>
      </div>
      <div class="flex flex-row pl-8">

         <!-- Score squares -->
        <div class="score-squares flex-2/3">
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
          <span class="pill ml-12 mr-2" style="background-color:{sentimentColor}">
        {sentimentLabel}</span>
        </div>
        <div class="toolbar py-2 px-4">
          <h3 class="heading-sm">Sentiment Drivers</h3>
        </div>
        <div class="flex flex-col px-8">
          <!-- ── Index Metrics ──────────────────────────────────────────── -->
          <IndexMetricBars
            {metrics}
            {metricVals}
            selectedIndex={$selectedIndex}
          />    
        </div>
      </div>
 
    

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
  }
  .score-square {
    flex: 1;
    height: 1.5em;
    filter: saturate(.15);
    opacity: 20%;
    transition: opacity 0.125s cubic-bezier(0.4, 0, 0.2, 1);
  }
  .score-square--active {
    outline: 1.5px solid var(--grayblue);
    outline-offset: 2px;
    filter: saturate(1);
    opacity: 100%;
  }


  /* ── Experience Wheel section ────────────────────────────────── */
  .wheel-section {
    border-top: 1px solid #DFC3A8;
  }

  .wheel-icon {
    font-size: 11px;
    color: #C4956A;
  }
</style>