<script> 
  import { tweened } from 'svelte/motion';
  import { cubicInOut, cubicOut } from 'svelte/easing';
  import { fade, fly } from 'svelte/transition';
  import { selectedIndex } from './journeyStore.js';
  import ExperienceWheel from './ExperienceWheel.svelte';
  import StepEvents from './StepEvents.svelte';
  import JourneySubDrawer from './JourneySubDrawer.svelte';

  import { emotionColor, ratingToLabel, DYAD_BY_ID, SCORE_ALIASES, SENTIMENT_SCALE, sentimentToColor, metricScoreLabel, buildStageColorMap } from './journeyConfig.js';
  
  import QuotesRegular from 'phosphor-icons-svelte/IconQuotesRegular.svelte';
  import ArrowSquareOutRegular from 'phosphor-icons-svelte/IconArrowSquareOutRegular.svelte';
  import SmileyBlank  from 'phosphor-icons-svelte/IconSmileyBlankBold.svelte';
  import Scroll from 'phosphor-icons-svelte/IconScrollRegular.svelte';
  import IconHeartHalfRegular from 'phosphor-icons-svelte/IconHeartHalfRegular.svelte';
  import IconDiamondsFourRegular from 'phosphor-icons-svelte/IconDiamondsFourRegular.svelte'

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
 
  function toPercent(val) {
    return ((parseFloat(val) + 5) / 10) * 100;
  }
 
  // ── Illustration error fallback ───────────────────────────────────────
  let imgError = false;
  $: if (illustrationSrc) imgError = false;
</script>

{#if step}
  <div class="content-wrap">

    <!-- Top meta bar -->
    <div class="toolbar p-2"
    style="border-bottom: 2.5px solid {stageColor}">
        <div class="flex flex-row gap-2 align-center items-center">
          <div class="sentiment-container">
            {#each SENTIMENT_SCALE as stopColor, i}
              {@const activePos = ($sentimentTween + 5) / 10 * (SENTIMENT_SCALE.length - 1)}
              {@const isActive  = i === Math.round(activePos)}
              <div
                class="jm-swatch"
                class:score-square--active={isActive}
                style="background: {stopColor}; opacity: {isActive ? 1 : 0.2};"
              >
              </div>
            {/each}
          </div>
          <span class="label-sm" 
          style="color:var(--ink)">
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
          <span class="jm-swatch-round-sm" style="background: {color};"></span>
          {/each}
        </div>
        <span class="label-sm">{step.plutchik_score}</span>
        <ArrowSquareOutRegular class="icon-dark" />
      </button>
    </div>

    <!-- Illustration -->
    {#key illustrationSrc}
      <div class="h-40" in:fade={{ duration: 300 }}>
        {#if !imgError}
          <img
            src={illustrationSrc}
            alt="Illustration for {step.step}"
            class="step-illustration__img"
            onerror={() => (imgError = true)}
          />
        {:else}
          <div class="step-illustration__fallback stats-animation-gradient__gradient--bright pt-8">
            <div class="flex flex-col px-4">
              <span class="label-sm text-white">{step.stage}</span>
              <h2 class="heading-serif"
              style="color:var(--lightgrayblue); 
              font-size:2.5em">{step.step}</h2>
            </div>
        </div>
          
        {/if}
      </div>
      {/key}
      
      <div class="header-row">
          <div class="flex flex-row gap-8 align-center">
          <Scroll class="icon-header" style="background-color: {stageColor}; outline-color: {stageColor};" />
          <h3 class="label uppercase my-auto">Journey Narrative</h3>
          </div>
          
          {#if wheelData}
                <button
                  class="btn-extranote-orange pl-2"
                  onclick={() => (wheelDrawerOpen = true)}
                  aria-label="Open experience wheel for {step.step}"
                >
                  <span class="">View Experience Wheel</span>
                  <ArrowSquareOutRegular class="icon-toolbar-light-sm"
                  style= "background-color: var(--lightorange); color: var(--orange)" />
                </button>
            {:else}
            <button
            class="btn-extranote pl-2 hover:cursor-not-allowed saturate-20 opacity-50"
            aria-label="Open experience wheel for {step.step}"
          >
            <span class="">View Experience Wheel</span>
            <ArrowSquareOutRegular class="icon-toolbar-light-sm" />
          </button>
            {/if}
          </div>  
          
  <div class="content-padding">

    <div class="flex flex-col w-2/3">
    <!-- Narrative -->
      {#if step.narrative_description}
          <p class="text-body">{step.narrative_description}</p>
      {/if}
    </div>

  
  </div>
  
  <div class="toolbar-light-sm">
    <QuotesRegular class="icon-toolbar-dark-md" style="background-color: {stageColor}; outline-color: {stageColor};"
    | />
    <span class="label-sm">Key Quote</span>
  </div>

    <!-- Quote -->
    {#if step.quote}
      <section class="detail-section">
        <div class="content-padding">
        <div class="card-quote">
          <p class="pull-quote">
            &ldquo;{step.quote}&rdquo;
          </p>
        </div>
        </div>
      </section>
    {/if}
    

    <!-- Metrics -->
    <section class="detail-section">
      <div class="toolbar-sm-white">
        <IconDiamondsFourRegular class="icon-toolbar-dark-md" style="background-color: {stageColor}; outline-color: {stageColor};"/>
        <span>Index Metrics</span>
      </div>

      <div class="metrics-wrap">
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
              <div class="imb-card-header">
                <div class="imb-card-title">
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
                    class="pill-white"
                    style="border: 1px solid {m.color}; color: {m.color}"
                    in:fade={{ duration: 200, delay: 80 + i * 40 }}
                    out:fade={{ duration: 80 }}
                  >
                    {metricScoreLabel(m.key, tweenedVal)}
                  </span>
                {/key}
              </div>

              <StepEvents events={step.events ?? []} />


              <div class="imb-card-scale">
                <div
                  class="imb-squares"
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
                      class="jm-swatch-round-sm"
                      class:imb-square--active={isActive}
                      style="background: {ramp[si]}; opacity: {opacity};"
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
    </section>
  </div>
{/if}

<!-- Index Metric Tooltip -->
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

<!-- Experience Wheel Sub-Drawer -->
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


.quote-block {
  display: flex;
  gap: 0.75rem;
  align-items: flex-start;
  margin-left: 2rem;
  padding: 1.25rem 1.5rem;
}

.sentiment-pill {
  white-space: nowrap;
}


.score-square--active {
  outline: 1.5px solid var(--grayblue);
  outline-offset: 2px;
}

.metrics-wrap {
  padding: 0 2rem;
}

.imb-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 2.25rem 4.25rem;
}

@media (max-width: 480px) {
  .imb-grid {
    grid-template-columns: 1fr;
  }

  .content-padding {
    grid-template-columns: 1fr;
  }
}

.imb-card {
  display: flex;
  flex-direction: column;
  gap: 0.275rem;
  min-width: 0;
}

.imb-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.imb-card-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
}

.imb-card-scale {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 0.75rem;
  align-items: center;
}

.imb-squares {
  display: flex;
  gap: 0.25rem;
  min-width: 0;
}

.imb-icon {
  display: flex;
  align-items: center;
  flex-shrink: 0;
  opacity: 0.85;
}

.imb-value {
  white-space: nowrap;
}

.imb-square--active {
  outline: 2.15px solid var(--grayblue);
  outline-offset: 1.5px;
  scale: 120%;
  opacity: 100%;
  filter: saturate(1);
}

.imb-squares--interactive {
  cursor: help;
}

</style>