<script> 
  import { tweened } from 'svelte/motion';
  import { cubicInOut, cubicOut } from 'svelte/easing';
  import { fade, fly } from 'svelte/transition';
  import { createEventDispatcher } from 'svelte';
  import { selectedIndex } from './journeyStore.js';
  import ExperienceWheel from './ExperienceWheel.svelte';

  import { emotionColor, ratingToLabel, DYAD_BY_ID, SCORE_ALIASES, SENTIMENT_SCALE, sentimentToColor, metricScoreLabel } from './journeyConfig.js';
  import QuotesRegular from 'phosphor-icons-svelte/IconQuotesRegular.svelte';
  import ArrowSquareOutRegular from 'phosphor-icons-svelte/IconArrowSquareOutRegular.svelte';
  import ArrowElbowDownRight from "phosphor-icons-svelte/IconArrowElbowDownRightDuotone.svelte";
  import SmileyBlank  from 'phosphor-icons-svelte/IconSmileyBlankBold.svelte';
  import CalenderDots from 'phosphor-icons-svelte/IconCalendarDotsBold.svelte';
  import HandHeart    from 'phosphor-icons-svelte/IconHandHeartBold.svelte';
  import Aclepius     from 'phosphor-icons-svelte/IconAsclepiusBold.svelte';
 
  const dispatch = createEventDispatcher();
 
  export let data    = [];
  export let metrics = [];
  /** Optional experience wheel data — renders below metrics when present */
  export let wheelData = /** @type {any} */ (null);
  export let illustrationSrc = 'illustrations/Regression1.jpeg';
 
  const TWEEN_OPTS = { duration: 400, easing: cubicInOut };

  // Mirrors IndexMetricBars exactly
  const STOPS = Array.from({ length: 10 }, (_, i) => -5 + i * (10 / 9));

  const METRIC_ICONS = {
    emotional_valence:     SmileyBlank,
    logistical_capacity:   CalenderDots,
    provider_trust:        Aclepius,
    medical_self_efficacy: HandHeart,
  };

  /** Build a 10-stop light→dark ramp from a CSS hex color — mirrors IndexMetricBars */
  function buildRamp(baseColor) {
    return STOPS.map((_, si) => {
      const pct = Math.round(10 + (si / (STOPS.length - 1)) * 90);
      return `color-mix(in srgb, ${baseColor} ${pct}%, white)`;
    });
  }

  /** Derive per-square opacity — mirrors IndexMetricBars */
  function squareOpacity(si, activePos) {
    const dist = Math.abs(si - activePos);
    return si === Math.round(activePos) ? 1 : Math.max(0.12, 1 - dist * 0.28);
  }

  // ── Tooltip state ─────────────────────────────────────────────────────
  /** @type {string | null} */
  let hoveredMetricKey = null;
  let tooltipX = 0;
  let tooltipY = 0;

  /**
   * @param {MouseEvent} e
   * @param {string} key
   */
  function onSquareEnter(e, key) {
    hoveredMetricKey = key;
    positionTooltip(e);
  }

  /** @param {MouseEvent} e */
  function onSquareMove(e) {
    positionTooltip(e);
  }

  function onSquareLeave() {
    hoveredMetricKey = null;
  }

  /** @param {MouseEvent} e */
  function positionTooltip(e) {
    const TIP_W  = 248;
    const TIP_H  = 80;
    const OFFSET = 12;
    let x = e.clientX + OFFSET;
    let y = e.clientY - TIP_H / 2;
    if (x + TIP_W > window.innerWidth) x = e.clientX - TIP_W - OFFSET;
    if (y < 8) y = 8;
    tooltipX = x;
    tooltipY = y;
  }

  $: tooltipMetric = hoveredMetricKey ? metrics.find(m => m.key === hoveredMetricKey) : null;
  $: tooltipText   = (hoveredMetricKey && step?.metric_explainers)
                       ? (step.metric_explainers[hoveredMetricKey] ?? null)
                       : null;
 
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
  $: if (illustrationSrc) imgError = false;
</script>

<!-- ── Metric explainer tooltip ──────────────────────────────────────────── -->
{#if tooltipText && tooltipMetric}
  <div
    class="tooltip-sm jm-surface"
    style="left: {tooltipX}px; top: {tooltipY}px;
    border: 1px solid {tooltipMetric.color};"
    transition:fade={{ duration: 100 }}
    role="tooltip"
  >
    <div
      class="flex flex-row w-full gap-2"
    >
      <span class="label-heading" 
      style= "color:{tooltipMetric.color}"
      >
      {tooltipMetric.label}</span>
    </div>
    <p class="text-body">{tooltipText}</p>
  </div>
{/if}

{#if step}
  <div class="content-wrap">
    <div class="toolbar py-2">        
      <div class="btn-extranote-empty ml-2">
        <div class="w-3 h-3 ring-1 ring-slate-500" 
        style="background-color: {sentimentColor}">
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
        <span class="label uppercase font-semibold">{step.plutchik_score}</span>
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
        <h2 class="heading text-3xl text-slate-50">{step.step}</h2> 
        <h3 class="heading-xs text-slate-50">{step.stage}</h3>
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
          <h2 class="heading-xs">Key Quotes</h2>
        </div>
        <div class="card-quote ml-8">
          <p class="pull-quote p-8 text-slate-800 text-pretty">
            &ldquo;{step.quote}&rdquo;
          </p>
        </div>
      </div>
    {/if}

    <!-- ── Index Metrics ──────────────────────────────────────────── -->
    <div class="flex flex-col gap-4 w-full">
      <div class="toolbar py-2 px-4">
        <h3 class="heading-sm">Sentiment</h3>
      </div>
      <div class="flex flex-row pl-8">
        <!-- Overall sentiment score squares -->
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
          {sentimentLabel}
        </span>
      </div>

      <div class="toolbar py-2 px-4">
        <h3 class="heading-sm">Sentiment Drivers</h3>
      </div>

      <!-- ── Metric cards — mirrors IndexMetricBars, squares are tooltip trigger ── -->
      <div class="flex flex-col px-8">
        <div class="imb-grid">
          {#each metrics as m, i}
            {@const tweenedVal    = metricVals[i] ?? 0}
            {@const ramp          = buildRamp(m.color)}
            {@const activePos     = (tweenedVal + 5) / 10 * (STOPS.length - 1)}
            {@const IconComponent = METRIC_ICONS[m.key] ?? null}
            {@const hasExplainer  = !!step.metric_explainers?.[m.key]}

            <div
              class="imb-card"
              in:fly={{ y: 4, duration: 200, delay: 60 + i * 40, easing: cubicOut }}
            >
              <div class="flex flex-col gap-2">

                <!-- ── Label row ──────────────────────────────────────────── -->
                <div class="jm-content-row align-middle w-full">
                  <div class="flex flex-row gap-2 w-full items-center justify-between">
                    <div class="flex flex-row gap-2 align-middle items-center">
                      {#if IconComponent}
                        <span class="imb-icon" style="color: {m.color};">
                          <svelte:component this={IconComponent} size={14} />
                        </span>
                      {:else}
                        <div class="w-2 h-2 ring-1" style="background: {m.color};"></div>
                      {/if}
                      <span class="text-body-sm">{m.label}</span>
                    </div>
                    {#key $selectedIndex}
                      <span
                        class="pill font-semibold"
                        style="border: 1px solid {m.color}; color: {m.color}"
                        in:fade={{ duration: 200, delay: 80 + i * 40 }}
                        out:fade={{ duration: 80 }}
                      >
                        {metricScoreLabel(m.key, tweenedVal)}
                      </span>
                    {/key}
                  </div>
                </div>

                <!-- ── Squares — hover triggers metric explainer tooltip ── -->
                <div class="flex flex-row w-full justify-between">
                  <div
                    class="flex flex-row gap-1"
                    class:imb-squares--interactive={hasExplainer}
                    on:mouseenter={hasExplainer ? (e) => onSquareEnter(e, m.key) : undefined}
                    on:mousemove={hasExplainer  ? onSquareMove : undefined}
                    on:mouseleave={hasExplainer ? onSquareLeave : undefined}
                  >
                    {#each STOPS as _stop, si}
                      {@const opacity  = squareOpacity(si, activePos)}
                      {@const isActive = si === Math.round(activePos)}
                      <div
                        class="jm-swatch-lg"
                        class:imb-square--active={isActive}
                        style="background: {ramp[si]}; opacity: {opacity};"
                      ></div>
                    {/each}
                  </div>
                  {#key $selectedIndex}
                    <span
                      class="label"
                      style="color: {m.color};"
                      in:fade={{ duration: 180, delay: 60 + i * 40 }}
                      out:fade={{ duration: 80 }}
                    >
                      {tweenedVal > 0 ? '+' : ''}{tweenedVal.toFixed(1)}
                    </span>
                  {/key}
                </div>

              </div>
            </div>
          {/each}
        </div>
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

  /* ── Score squares (overall sentiment row) ───────────────────── */
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

  /* ── IndexMetricBars styles (mirrored) ───────────────────────── */
  .imb-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 2em;
  }

  @media (max-width: 480px) {
    .imb-grid { grid-template-columns: 1fr; }
  }

  .imb-icon {
    display: flex;
    align-items: center;
    flex-shrink: 0;
    opacity: 0.85;
  }

  .imb-square--active {
    outline: 1.15px solid var(--grayblue);
    outline-offset: 1px;
    opacity: 100%;
    filter: saturate(1);
  }

  /* ── Squares interactive state ───────────────────────────────── */
  .imb-squares--interactive {
    cursor: help;
  }

  /* ── Metric explainer tooltip ────────────────────────────────── */
  .metric-explainer-tooltip {
    position: fixed;
    z-index: 9999;
    width: 248px;
    pointer-events: none;
    border-radius: 6px;
    overflow: hidden;
    box-shadow:
      0 4px 16px rgba(90, 62, 40, 0.16),
      0 1px 3px  rgba(90, 62, 40, 0.10);
  }

  .tooltip-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .tooltip-body {
    padding: 8px 10px 10px;
    margin: 0;
    font-size: 11px;
    line-height: 1.55;
    color: #5A3E28;
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