<script lang="ts">
  import { PLUTCHIK_EMOTIONS } from './journeyConfig.js';
  import ArrowsOutVertical from 'phosphor-icons-svelte/IconArrowsOutLineVerticalRegular.svelte'; 
  import Smiley from 'phosphor-icons-svelte/IconSmileyRegular.svelte';
  import Question from 'phosphor-icons-svelte/IconQuestionRegular.svelte';

  export let data = null;
  export let stepName = '';
  export let stageName = '';

  $: touchpoints    = data?.touchpoints ?? [];
  $: ec             = data?.emotional_context ?? {};
  $: inflection     = data?.inflection_analysis ?? {};
  $: sponsorActions = data?.sponsor_actions ?? [];

  const CX = 240, CY = 240;
  const RING_INNER = 120;
  const RING_OUTER = 140;

  let hoveredTp = null;

  // NEW: DOM refs
  let containerEl;
  let nodeRefs = [];

  function textAnchor(deg) {
  const cos = Math.cos(degToRad(deg));
  if (cos > 0.3) return 'start';
  if (cos < -0.3) return 'end';
  return 'middle';
}

  function degToRad(d) { return (d * Math.PI) / 180; }

  function polar(r, deg) {
    const rad = degToRad(deg);
    return { x: CX + r * Math.cos(rad), y: CY + r * Math.sin(rad) };
  }

  $: tpAngles = touchpoints.map((_, i) =>
    -90 + (360 / Math.max(touchpoints.length, 1)) * i
  );

  function sentimentColor(s) {
    if (s === 'negative') return '#C0483B';
    if (s === 'positive') return '#4a9e7f';
    return '#A08060';
  }

  function primaryEmotionColor(id) {
    const e = PLUTCHIK_EMOTIONS?.find(em => em.id === id);
    return e?.color ?? '#DFC3A8';
  }

  $: primaryColor = primaryEmotionColor(ec.primary_emotion);

  // NEW: DOM-based tooltip positioning
  $: tooltipPos = (() => {
    if (hoveredTp === null || !containerEl || !nodeRefs[hoveredTp]) return null;

    const nodeRect = nodeRefs[hoveredTp].getBoundingClientRect();
    const containerRect = containerEl.getBoundingClientRect();

    const TOOLTIP_W = 320;
    const TOOLTIP_H = 140;
    const OFFSET = 12;

    let x = nodeRect.right - containerRect.left + OFFSET;
    let y = nodeRect.top - containerRect.top + nodeRect.height / 2 - TOOLTIP_H / 2;

    if (x + TOOLTIP_W > containerRect.width) {
      x = nodeRect.left - containerRect.left - TOOLTIP_W - OFFSET;
    }

    y = Math.max(8, Math.min(y, containerRect.height - TOOLTIP_H - 8));

    return { x, y };
  })();
</script>

<div class="wheel-wrap">

  <!-- SVG -->
  <div class="wheel-svg-wrap" bind:this={containerEl}>
    <svg viewBox="0 0 480 480" class="wheel-svg">

      {#each touchpoints as tp, i}
      {@const deg = tpAngles[i]}
      {@const nodePt = polar((RING_INNER + RING_OUTER)/2, deg)}
      {@const sc = sentimentColor(tp.sentiment)}
    
      {@const outerEdge = polar(RING_OUTER + 4, deg)}
      {@const labelStart = polar(RING_OUTER + 28, deg)}
      {@const labelPt = polar(RING_OUTER + 60, deg)}
    
      <!-- connector line -->
      <line
        x1={outerEdge.x}
        y1={outerEdge.y}
        x2={labelStart.x}
        y2={labelStart.y}
        stroke="var(--ink)"
        stroke-width="0.75"
        opacity="0.6"
      />
    
      <!-- node -->
      <circle
        bind:this={nodeRefs[i]}
        cx={nodePt.x}
        cy={nodePt.y}
        r={hoveredTp === i ? 14 : 10}
        fill="var(--midgrayblue)"
        on:mouseenter={() => hoveredTp = i}
        on:mouseleave={() => hoveredTp = null}
      />
    
      <!-- label -->
      <text
        x={labelPt.x}
        y={labelPt.y}
        text-anchor={textAnchor(deg)}
        dominant-baseline="middle"
        class="label-sm"
        style="pointer-events: none;"
      >
        {tp.moment}
      </text>
    {/each}

      <circle cx={CX} cy={CY} r={RING_INNER} fill="var(--panel)" />


      <text x={CX} y={CY + 10} text-anchor="middle" class="label-sm">
        {stageName}
      </text>
    </svg>

    <!-- Tooltip -->
    {#if hoveredTp !== null && tooltipPos}
      {@const tp = touchpoints[hoveredTp]}

      <div
        class="tooltip jm-surface"
        style="left:{tooltipPos.x}px; top:{tooltipPos.y}px;"
      >
        <div class="pill w-fit">
          {tp.type?.replace(/_/g, ' ')}
        </div>

        <div class="label">
          {tp.moment}
        </div>

        <div class="divider"></div>

        {#if tp.positive_design_opportunity}
          <div class="jm-content-row">
            <Smiley class="icon-toolbar-dark-sm"/>
            <span class="text-body">
              {tp.positive_design_opportunity}
            </span>
          </div>
        {/if}

        {#if tp.data_needed}
          <div class="jm-content-row">
            <Question class="icon-toolbar-light-sm"/>
            <span class="text-body">
              {tp.data_needed}
            </span>
          </div>
        {/if}

        {#if tp.make_or_break}
          <div class="jm-content-row">
            <ArrowsOutVertical class="icon-toolbar-dark-sm"/>
            <span class="text-body">
              Make-or-break moment
            </span>
          </div>
        {/if}
      </div>
    {/if}
  </div>

  <!-- Legend -->
  <div class="jm-content-row gap-2 px-2">
    <div class="pill gap-2">
      <Smiley class="icon-toolbar-dark-sm"/>
      <span class="label-sm">Positive</span>
    </div>

    <div class="pill gap-2">
      <ArrowsOutVertical class="icon-toolbar-dark-sm"/>
      <span class="label-sm">Inflection</span>
    </div>

    <div class="pill gap-2">
      <Question class="icon-toolbar-light-sm"/>
      <span class="label-sm">Info gaps</span>
    </div>
  </div>

  <!-- Inflection -->
  <div class="detail-section">
    <div class="jm-section-bar">
      <span class="label-uppercase-bold">Inflection Analysis</span>
    </div>

    <div class="jm-content-col gap-2">

      <div class="jm-content-row-divider-sm">
        <span class="label-sm">Risk level</span>
        <span class="pill">{inflection.risk_level}</span>
      </div>

      <div class="jm-content-row-divider-sm">
        <span class="label-sm">Dropout risk</span>
        <span class="pill">{inflection.dropout_risk}</span>
      </div>

      <div class="jm-content-col gap-1">
        <span class="label-sm uppercase">Trial perception</span>
        <span class="text-body">
          {inflection.trial_perception_shift?.replace(/_/g, ' ')}
        </span>
      </div>
    </div>

    {#if inflection.sponsor_opportunity_category?.length}
      <div class="jm-content-col gap-1">
        <span class="label-sm uppercase">Opportunities</span>

        <div class="jm-content-row gap-1 flex-wrap">
          {#each inflection.sponsor_opportunity_category as cat}
            <span class="pill-sm">
              {cat.replace(/_/g, ' ')}
            </span>
          {/each}
        </div>
      </div>
    {/if}
  </div>

  <!-- Actions -->
  <div class="detail-section">
    <div class="jm-section-bar">
      <span class="label-uppercase-bold">Sponsor Actions</span>
    </div>

    <div class="jm-content-col gap-3">
      {#each sponsorActions as action}
        <div class="jm-surface content-col gap-2">

          <div class="jm-content-row">
            <span class="label-xs">{action.category}</span>
            <span class="label-xs">⏱ {action.timing}</span>
          </div>

          <div class="text-body">
            {action.action}
          </div>

        </div>
      {/each}
    </div>
  </div>

</div>

<style>
  .wheel-wrap {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .wheel-svg-wrap {
    position: relative;
    display: flex;
    background-color: var(--panel-mid);
    justify-content: center;
  }

  .wheel-svg {
    max-width: 600px;
  }

  .tooltip {
    position: absolute;
    pointer-events: none;
    z-index: 300;

    width: 500px;

    display: flex;
    flex-direction: column;
    gap: 0.5em;

    padding: 12px;

    opacity: 0;
    transform: translateY(4px);

    transition:
      opacity 120ms ease,
      transform 120ms var(--ease-smooth);
  }

  .tooltip[style] {
    opacity: 1;
    transform: translateY(0);
  }
</style>