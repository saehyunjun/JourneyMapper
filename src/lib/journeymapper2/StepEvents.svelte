<script> 
  import { tweened } from 'svelte/motion';
  import { cubicInOut, cubicOut } from 'svelte/easing';
  import { fade, fly } from 'svelte/transition';
  import { selectedIndex } from './journeyStore.js';
  import ExperienceWheel from './ExperienceWheel.svelte';
  import StepEvents from './StepEvents.svelte';
  import JourneySubDrawer from './JourneySubDrawer.svelte';

  import { emotionColor, ratingToLabel, DYAD_BY_ID, SCORE_ALIASES, SENTIMENT_SCALE, sentimentToColor, metricScoreLabel, buildStageColorMap } from './journeyConfig.js';
  
  import QuotesRegular from 'phosphor-icons-svelte/IconQuotesDuotone.svelte';
  import ArrowSquareOutRegular from 'phosphor-icons-svelte/IconArrowSquareOutRegular.svelte';
  import SmileyBlank  from 'phosphor-icons-svelte/IconSmileyBlankBold.svelte';
  import Scroll from 'phosphor-icons-svelte/IconScrollRegular.svelte';
  import IconDiamondsFourRegular from 'phosphor-icons-svelte/IconDiamondsFourRegular.svelte';

  import CalenderDots from 'phosphor-icons-svelte/IconCalendarDotsBold.svelte';
  import HandHeart    from 'phosphor-icons-svelte/IconHandHeartBold.svelte';
  import Aclepius     from 'phosphor-icons-svelte/IconAsclepiusBold.svelte';
 
  export let data    = [];
  export let metrics = [];
  /** Optional experience wheel data — opens in sub-drawer when present */
  export let wheelData = /** @type {any} */ (null);
  export let illustrationSrc = '/static/illustrations/Regression1.jpeg';
  /** Callback prop — page owns the emotion sub-drawer */
  export let onopenEmotionDetail = () => {};

  /** Controls the Experience Wheel sub-drawer */
  let wheelDrawerOpen = false;
 
  const TWEEN_OPTS = { duration: 400, easing: cubicInOut };

  // Mirrors IndexMetricBars exactly
  const STOPS = Array.from({ length: 10 }, (_, i) => -5 + i * (10 / 9));

  const METRIC_ICONS = {
    emotional_valence:     SmileyBlank,
    logistical_capacity:   CalenderDots,
    provider_trust:        Aclepius,
    medical_self_efficacy: HandHeart,
  };

  /** Build a 10-stop light→dark ramp from a CSS hex color */
  function buildRamp(baseColor) {
    return STOPS.map((_, si) => {
      const pct = Math.round(10 + (si / (STOPS.length - 1)) * 90);
      return `color-mix(in srgb, ${baseColor} ${pct}%, white)`;
    });
  }

  /** Derive per-square opacity */
  function squareOpacity(si, activePos) {
    const dist = Math.abs(si - activePos);
    return si === Math.round(activePos) ? 1 : Math.max(0.12, 1 - dist * 0.28);
  }

  // ── Tooltip state ─────────────────────────────────────────────────────
  /** @type {string | null} */
  let hoveredMetricKey = null;
  let tooltipX = 0;
  let tooltipY = 0;

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

  // ── Stage color ───────────────────────────────────────────────────────
  $: stageColorMap = buildStageColorMap(data);
  $: stageColor = (step && stageColorMap[step.stage_id]) ? stageColorMap[step.stage_id] : 'var(--jm-icon-dark, #3a3a3a)';
 
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
 
  // ── Illustration error fallback ───────────────────────────────────────
  let imgError = false;
  $: if (illustrationSrc) imgError = false;
</script>

{#if step}
  <div class="content-wrap">

    <!-- ── Top meta bar: sentiment + emotion ──────────────────────────── -->
    <div class="toolbar p-8" 
      style="border-bottom: 1.725px solid {stageColor}">
      <div class="flex flex-row gap-2 items-center">
        <div class="sentiment-container">
          {#each SENTIMENT_SCALE as stopColor, i}
            {@const activePos = ($sentimentTween + 5) / 10 * (SENTIMENT_SCALE.length - 1)}
            {@const isActive  = i === Math.round(activePos)}
            <div
              class="jm-swatch"
              class:score-square--active={isActive}
              style="background: {stopColor}; opacity: {isActive ? 1 : 0.125};"
            ></div>
          {/each}
        </div>

        <span
          class="pill-white"
          style="
            border: 2px solid {sentimentColor};
            color: {sentimentColor};
          "
        >
          {sentimentLabel}
        </span>
      </div>

      <button
        class="btn-nav"
        onclick={onopenEmotionDetail}
        aria-label="Learn about {step.plutchik_score} — open emotion detail"
        title="About Plutchik emotions"
      >
        <div class="emotion-container">
          {#each emotionSwatches as color}
            <span class="jm-swatch-round" 
            style="background: {color};"></span>
          {/each}
        </div>
        <span class="label-sm">{step.plutchik_score}</span>
        <ArrowSquareOutRegular class="icon-dark" />
      </button>
    </div>

    <div
      class="flex flex-col md:w-full md:grid md:grid-cols-3 gap-8 px-6 py-6"
      style="background-color: {stageColor}"
    >
      <div class="flex flex-col md:col-span-2 gap-6">
        <div class="flex flex-col gap-2">
          <span
            class="label-sm"
            style="color: var(--lightgrayblue);"
          >
            {step.stage}
          </span>
          
          <h2
            class="heading-serif"
            style="color: var(--lightgrayblue)"
          >
            {step.step}
          </h2>
        </div>
        
        <div class="flex flex-col gap-2">
          <h3
            class="label-sm"
            style="color: var(--lightgrayblue)"
          >
            Journey Narrative
          </h3>

          <p
            class="text-body-lg"
            style="color: var(--lightgrayblue)"
          >
            {step.narrative_description}
          </p>
        </div>
      </div>

      <div class="flex flex-row col-span-1 justify-end">
        {#if wheelData}
          <button
            class="btn-nav hover:pointer"
            onclick={() => (wheelDrawerOpen = true)}
            aria-label="Open experience wheel for {step.step}"
          >
            <span class="label-sm">View PX Wheel</span>
            <ArrowSquareOutRegular class="icon-toolbar-light-sm" />
          </button>
        {:else}
          <button
            class="btn-nav hover:pointer opacity-50 saturate-0 md:col-span-2"
            aria-label="Experience wheel not available for this step"
            disabled
          >
            <span class="label-sm">View PX Wheel</span>
            <ArrowSquareOutRegular class="icon-toolbar-light-sm" />
          </button>
        {/if}
      </div>
    </div>

    <!-- ── Quote ─────────────────────────────────────────────────────── -->
    {#if step.quote}
      <div
        class="flex flex-col gap-6 p-6"
        style="background-color: rgb(from {stageColor} r g b / 0.25);"
      >
        <h3
          class="label-sm uppercase"
          style="color: var(--grayblue)"
        >
          Key Quotes
        </h3>
         
        <div class="flex flex-col gap-2 md:w-7/12 md:justify-between">
          <QuotesRegular class="text-2xl text-slate-600" />
          <p class="text-4xl text-balance font-medium">
            {step.quote}
          </p>
        </div>
      </div>
    {/if}

    <!-- ── Index Metrics ─────────────────────────────────────────────── -->
    <div
      class="flex flex-col gap-6 p-6"
      style="background-color: rgb(from {stageColor} r g b / 0.1);"
    >
      <span class="label-sm">
        Index Metrics
      </span>
      
      <div class="metrics-wrap">
        <div class="imb-grid">
          {#each metrics as m, i}
            {@const tweenedVal    = metricVals[i] ?? 0}
            {@const ramp          = buildRamp(m.color)}
            {@const activePos     = (tweenedVal + 5) / 10 * (STOPS.length - 1)}
            {@const IconComponent = METRIC_ICONS[m.key] ?? null}
            {@const hasExplainer  = !!step.metric_explainers?.[m.key]}

            <div
              class="flex flex-col"
              in:fly={{ y: 4, duration: 200, delay: 60 + i * 40, easing: cubicOut }}
            >
              <!-- Header row: icon + label (left) | pill + value (right) -->
              <div class="flex flex-row w-full justify-between items-start">
                <div class="flex flex-row items-center gap-2">
                  {#if IconComponent}
                    <svelte:component
                      this={IconComponent}
                      class="text-lg"
                      style="color: {m.color}"
                    />
                  {:else}
                    <div class="w-2 h-2 ring-1" style="background: {m.color};"></div>
                  {/if}
                  <span class="label-sm">{m.label}</span>
                </div>

                <div class="flex flex-col items-end">
                  {#key $selectedIndex}
                    <span
                      class="pill-white"
                      style="border: 2px solid {m.color}; color: {m.color}"
                      in:fade={{ duration: 200, delay: 80 + i * 40 }}
                      out:fade={{ duration: 80 }}
                    >
                      {metricScoreLabel(m.key, tweenedVal)}
                    </span>
                  {/key}
                </div>
              </div>

              <!-- Scale + numeric value -->
              <div class="imb-card-scale flex flex-row items-center justify-between gap-3">
                <div
                  class="emotion-container"
                  class:imb-squares--interactive={hasExplainer}
                  onmouseenter={hasExplainer ? (e) => onSquareEnter(e, m.key) : undefined}
                  onmousemove={hasExplainer ? onSquareMove : undefined}
                  onmouseleave={hasExplainer ? onSquareLeave : undefined}
                  role="group"
                  aria-label="{m.label} scale"
                >
                  {#each STOPS as _stop, si}
                    {@const opacity  = squareOpacity(si, activePos)}
                    {@const isActive = si === Math.round(activePos)}
                    <div
                      class="jm-swatch-round"
                      class:imb-square--active={isActive}
                      style="background: {ramp[si]}; 
                      opacity: {opacity};"
                    ></div>
                  {/each}
                </div>

                {#key $selectedIndex}
                  <span
                    class="label imb-value"
                    style="color: {m.color};"
                    in:fade={{ duration: 180, delay: 60 + i * 40 }}
                    out:fade={{ duration: 80 }}
                  >
                    {tweenedVal > 0 ? '+' : ''}{tweenedVal.toFixed(1)}
                  </span>
                {/key}
              </div>
            </div>
          {/each}
        </div>
      </div>
    </div>

    <!-- ── Step Events ────────────────────────────────────────────────── -->
    <StepEvents events={step.events ?? []} />
  </div>
{/if}

<!-- ── Index Metric Tooltip ──────────────────────────────────────────── -->
{#if tooltipMetric}
  <div
    class="tooltip"
    style="position: fixed; left: {tooltipX}px; top: {tooltipY}px; z-index: 9999; pointer-events: none;"
    transition:fade={{ duration: 120 }}
  >
    <span class="label font-semibold" style="color: {tooltipMetric.color};">
      {tooltipMetric.label}
    </span>
    {#if tooltipText}
      <p class="text-body-sm mt-1">{tooltipText}</p>
    {/if}
  </div>
{/if}

<!-- ── Experience Wheel Sub-Drawer ───────────────────────────────────── -->
{#if wheelData && step}
  <JourneySubDrawer
    bind:open={wheelDrawerOpen}
    eyebrow={step.stage}
    title="Experience Wheel"
    width={650}
    onclose={() => (wheelDrawerOpen = false)}
  >
    <ExperienceWheel
      data={wheelData}
      stepName={step.step}
      stageName={step.stage}
    />
  </JourneySubDrawer>
{/if}

<style>
  /* ── Sentiment swatch active state ───────────────────────────────────── */
  .score-square--active {
    outline: 1.5px solid var(--panel-dark);
    outline-offset: 1px;
    transition:
      transform 0.55s cubic-bezier(0.45, 0.05, 0.55, 0.95),
      box-shadow 0.25s ease;

    box-shadow:
      0 10px 20px -22px rgba(50, 50, 10, 0.125),
      0 1em 1em -1em rgba(0, 0, 0, 0.125);
  }

  .imb-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 1.5rem;
  }

  .imb-value {
    white-space: nowrap;
  }

  .imb-square--active {
    outline: 1.25px solid var(--grayblue);
    outline-offset: 1px;
    scale: 125%;
    opacity: 100%;
    z-index: 9999;
    filter: saturate(1);
  }
</style>