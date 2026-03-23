<script>
  import { tweened } from 'svelte/motion';
  import { cubicInOut } from 'svelte/easing';
  import { fade } from 'svelte/transition';
  import { createEventDispatcher } from 'svelte';
  import { selectedIndex } from './journeyStore.js';
  import ExperienceWheel from './ExperienceWheel.svelte';
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
    <h2 class="heading text-3xl">
      {step.step}
    </h2>

    <!-- ── Sentiment + Emotion row ──────────────────────────────── -->
    <div class="flex flex-row gap-4 w-full justify-between">
      
      <!-- Sentiment -->
      <div class="flex flex-col w-8/12 gap-1">
        <div class="flex items-center gap-2">
          <div
            class="w-4 h-4 ring-1 ring-slate-800 rounded-full shrink-0"
            style="background: {sentimentColor};">
          </div>

          <span class="label uppercase font-semibold">{sentimentLabel}</span>
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
        <span class="label-sm">Overall Sentiment</span>
        {#key $selectedIndex}
        <span
          class="label-sm"
          style="color: {sentimentColor};"
          in:fade={{ duration: 200, delay: 60 }}
          out:fade={{ duration: 100 }}
        >
          {sentimentTweenVal > 0 ? '+' : ''}{sentimentTweenVal.toFixed(1)}
        </span>
      {/key}
      </div>


      <!-- Emotion tag — clickable, opens Plutchik sub-drawer -->
      <div class="emotion-section">
        <span class="label-sm pb-1">Emotional State</span>
        <button
          class="plutchik-tag-btn"
          on:click={() => dispatch('openEmotionDetail')}
          aria-label="Learn about {step.plutchik_score} — open emotion detail"
          title="About Plutchik emotions"
        >
          <div class="plutchik-tag-row">
            {#each emotionSwatches as color}
              <span class="emotion-swatch-dot" style="background: {color};" />
            {/each}
            <span class="label uppercase font-semibold">{step.plutchik_score}</span>
          </div>
          <span class="emotion-expand-icon">
            <ArrowSquareOutRegular size={10} />
          </span>
        </button>
      </div>
    </div>

    <div class="divider"></div>

    <!-- ── Step Quote ─────────────────────────────────────────────── -->
    {#if step.quote}
      <div class="">
        <QuotesRegular class="quote-icon" weight="fill" />
        <p class="text-body quote-text">{step.quote}</p>
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
      <span class="heading-sm">Index Metrics</span>
      {#each metrics as m, i}
        {@const tweenedVal = metricVals[i] ?? 0}
        <div class="metric-row">
          <div class="metric-label-row">
            <span class="metric-dot" style="background: {m.color};" />
            <span class="metric-name">{m.label}</span>
            {#key $selectedIndex}
              <span
                class="metric-value"
                style="color: {m.color};"
                in:fade={{ duration: 180, delay: 60 + i * 40 }}
                out:fade={{ duration: 80 }}
              >
                {tweenedVal > 0 ? '+' : ''}{tweenedVal.toFixed(1)}
              </span>
            {/key}
          </div>

          <!-- Score squares -->
          <div class="score-squares">
            {#each METRIC_STOPS as stop, si}
              {@const activePos = (tweenedVal + 5) / 10 * (METRIC_STOPS.length - 1)}
              {@const isActive  = si === Math.round(activePos)}
              {@const dist      = Math.abs(si - activePos)}
              {@const opacity   = isActive ? 1 : Math.max(0.12, 1 - dist * 0.28)}
              {@const squareColor = stop < 0
                ? `color-mix(in srgb, #C0392B ${Math.round((Math.abs(stop) / 5) * 100)}%, ${m.color})`
                : `color-mix(in srgb, ${m.color} ${Math.round((stop / 5) * 100)}%, #C0392B)`}
              <div
                class="score-square"
                class:score-square--active={isActive}
                style="background: {squareColor}; opacity: {opacity};"
              />
            {/each}
          </div>
        </div>
      {/each}
    </div>

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

  /* ── Sentiment value ─────────────────────────────────────────── */
  .label-sm {
    font-family: 'Space Mono', monospace;
    font-size: 11px;
    font-weight: bold;
  }

  /* ── Score squares (sentiment + metrics) ────────────────────── */
  .score-squares {
    display: flex;
    flex-direction: row;
    gap: 2px;
    width: 100%;
  }
  .score-square {
    flex: 1;
    height: 10px;
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

  /* ── Quote block ─────────────────────────────────────────────── */
  .quote-block {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 10px 12px;
    background: #EDE5D8;
    border-left: 2px solid #DFC3A8;
    border-radius: 2px;
  }

  .quote-block :global(.quote-icon) {
    color: #C4956A;
    width: 14px;
    height: 14px;
    flex-shrink: 0;
  }

  .quote-text {
    font-style: italic;
    color: #7A5A3A;
  }

  /* ── Emotion section ─────────────────────────────────────────── */
  .emotion-section {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .plutchik-tag-btn {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 5px;
    background: #EDE5D8;
    border: 1px solid #DFC3A8;
    border-radius: 3px;
    padding: 6px 8px;
    cursor: pointer;
    text-align: left;
    transition: background 0.15s ease, border-color 0.15s ease;
  }

  .plutchik-tag-btn:hover {
    background: #E2D4C0;
    border-color: #C4956A;
  }

  .plutchik-tag-btn:focus-visible {
    outline: 2px solid #C4956A;
    outline-offset: 2px;
  }

  .plutchik-tag-row {
    display: flex;
    align-items: center;
    gap: 5px;
  }

  .emotion-swatch-dot {
    display: inline-block;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    border: 1px solid rgba(0, 0, 0, 0.15);
    flex-shrink: 0;
  }

  .emotion-expand-icon {
    color: #BFA080;
    line-height: 1;
  }

  /* ── Metric rows ─────────────────────────────────────────────── */
  .metrics-section { display: flex; flex-direction: column; gap: 14px; }

  .metric-row { display: flex; flex-direction: column; gap: 6px; }

  .metric-label-row { display: flex; align-items: center; gap: 8px; }

  .metric-dot {
    width: 8px; height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
    opacity: 0.9;
  }

  .metric-name { font-size: 11px; color: #7A5A3A; flex: 1; }

  .metric-value {
    font-family: 'Space Mono', monospace;
    font-size: 11px;
    font-weight: bold;
  }

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