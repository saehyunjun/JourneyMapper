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
  $: makeOrBreak = data?.sponsor_make_or_break ?? [];

  const CX = 240, CY = 240;
  const RING_INNER = 50;
  const RING_OUTER = 100;

  const PHASES = [
    { label: 'BEFORE', startDeg: 180, endDeg: 30 },
    { label: 'DURING', startDeg: 330, endDeg: 90 },
    { label: 'AFTER',  startDeg: 90,  endDeg: 210 }
  ];

  const PHASE_COLORS = ['#7DBFA7', '#EDCAAA', '#DFC3A8'];

  let hoveredTp = null;
  let containerEl;
  let nodeRefs = [];

  $: nodeRefs = new Array(touchpoints.length);

  function degToRad(d) { return (d * Math.PI) / 180; }

  function polar(r, deg) {
    const rad = degToRad(deg);
    return { x: CX + r * Math.cos(rad), y: CY + r * Math.sin(rad) };
  }

  function textAnchor(deg) {
    const cos = Math.cos(degToRad(deg));
    if (cos > 0.3) return 'start';
    if (cos < -0.3) return 'end';
    return 'middle';
  }

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

  // ✅ Phase-based angle calculation
  $: tpAngles = (() => {
    const groups = { before: [], during: [], after: [] };

    touchpoints.forEach((tp, i) => {
      const key = tp.phase || 'during';
      groups[key]?.push({ tp, i });
    });

    const angles = new Array(touchpoints.length);

    PHASES.forEach((phaseDef) => {
      const key = phaseDef.label.toLowerCase();
      const items = groups[key] || [];

      if (!items.length) return;

      let start = phaseDef.startDeg;
      let end = phaseDef.endDeg;
      if (end <= start) end += 360;

      const span = end - start;

      items.forEach((item, j) => {
        const t = (j + 0.5) / items.length;
        const deg = start + t * span;
        angles[item.i] = deg % 360;
      });
    });

    return angles;
  })();

  function phaseArcFill(ri, ro, startDeg, endDeg) {
    let end = endDeg;
    if (end <= startDeg) end += 360;

    const large = (end - startDeg) > 180 ? 1 : 0;

    const s  = polar(ri, startDeg);
    const e  = polar(ri, end % 360);
    const so = polar(ro, startDeg);
    const eo = polar(ro, end % 360);

    return `
      M ${so.x} ${so.y}
      A ${ro} ${ro} 0 ${large} 1 ${eo.x} ${eo.y}
      L ${e.x} ${e.y}
      A ${ri} ${ri} 0 ${large} 0 ${s.x} ${s.y}
      Z
    `;
  }

  // Tooltip positioning
  $: tooltipPos = (() => {
    if (hoveredTp === null || !containerEl || !nodeRefs[hoveredTp]) return null;

    const nodeRect = nodeRefs[hoveredTp].getBoundingClientRect();
    const containerRect = containerEl.getBoundingClientRect();

    const W = 320, H = 140, OFFSET = 12;

    let x = nodeRect.right - containerRect.left + OFFSET;
    let y = nodeRect.top - containerRect.top + nodeRect.height / 2 - H / 2;

    if (x + W > containerRect.width) {
      x = nodeRect.left - containerRect.left - W - OFFSET;
    }

    y = Math.max(8, Math.min(y, containerRect.height - H - 8));

    return { x, y };
  })();
</script>

  <!-- Legend -->
  <div class="toolbar-sm-light-left">
    <div class="pill gap-2">
      <Smiley class="icon-toolbar-dark-sm"/>
      <span class="label-sm">Positive Experience Opportunity</span>
    </div>

    <div class="pill gap-2" 
    style="border-color: var(--red)">
      <ArrowsOutVertical class="icon-toolbar-red-sm"/>
      <span class="label-sm">Make-or-Break Moment</span>
    </div>

    <div class="pill gap-2"
      style="border-color: var(--orange)">
      <Question class="icon-toolbar-light-sm"/>
      <span class="label-sm"
      style="color: var(--orange)">
      Info gaps</span>
    </div>
  </div>

<div class="wheel-wrap">
  <div class="wheel-svg-wrap" bind:this={containerEl}>
    <svg viewBox="0 0 480 480" class="wheel-svg">

      <!-- Phase arcs -->
      {#each PHASES as phase, i}
        <path
          d={phaseArcFill(RING_INNER, RING_OUTER, phase.startDeg, phase.endDeg)}
          fill={PHASE_COLORS[i]}
          opacity="0.25"
        />
      {/each}

      <!-- Nodes -->
      {#each touchpoints as tp, i}
        {@const deg = tpAngles[i]}
        {@const nodePt = polar((RING_INNER + RING_OUTER)/2, deg)}
        {@const outerEdge = polar(RING_OUTER + 4, deg)}
        {@const labelPt = polar(RING_OUTER + 60, deg)}

        <line
          x1={outerEdge.x}
          y1={outerEdge.y}
          x2={labelPt.x}
          y2={labelPt.y}
          stroke="var(--ink)"
          stroke-width="0.75"
          opacity="0.5"
        />

        <circle
          bind:this={nodeRefs[i]}
          cx={nodePt.x}
          cy={nodePt.y}
          r={hoveredTp === i ? 10 : 8}
          fill="var(--midgrayblue)"
          cursor="pointer"
          on:mouseenter={() => hoveredTp = i}
          on:mouseleave={() => hoveredTp = null}>
        </circle>

        <foreignObject
          x={labelPt.x - 20}
          y={labelPt.y - 10}
          width="120"
          height="100"
          style="pointer-events:none;"
        >
          <div
            xmlns="http://www.w3.org/1999/xhtml"
            class="text-xs p-1"
            style="
              max-width:140px;
              text-align:{textAnchor(deg)};
              word-break:break-word;
            "
          >
            {tp.moment}
          </div>
        </foreignObject>
      {/each}

      <circle cx={CX} cy={CY} r={RING_INNER} fill="var(--panel)" />
    </svg>

    <!-- Tooltip -->
    {#if hoveredTp !== null && tooltipPos}
      {@const tp = touchpoints[hoveredTp]}
      <div class="tooltip jm-surface" style="left:{tooltipPos.x}px; top:{tooltipPos.y}px;">
        
        <div class="pill">
          <span class="label-sm">{tp.type?.replace(/_/g,' ')}</span>
        </div>

        <h3 class="label uppercase">{tp.moment}</h3>

        <div class="divider"></div>

        {#if tp.positive_design_opportunity}
          <div class="jm-content-row">
            <Smiley class="icon-toolbar-dark-sm"/>
            <p class="text-body-sm">{tp.positive_design_opportunity}</p>
          </div>
        {/if}

        {#if tp.data_needed}
          <div class="jm-content-row">
            <Question class="icon-toolbar-light-sm"/>
            <p class="text-body-sm">{tp.data_needed}</p>
          </div>
        {/if}

        {#if tp.make_or_break}
          <div class="jm-content-row">
            <ArrowsOutVertical class="icon-toolbar-dark-sm"/>
            <p class="text-body-sm">Make-or-break moment</p>
          </div>
        {/if}
      </div>
    {/if}
  </div>
</div>
  <!-- Inflection -->
  <div class="detail-section">
    <div class="jm-section-bar">
      <span class="label-sm">Inflection Analysis</span>
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
      <span class="label-sm">Sponsor Actions</span>
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



<style>
  .wheel-wrap {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .wheel-svg-wrap {
    position: relative;
    display: flex;
    justify-content: center;
    background: var(--lightgrayblue);
  }

  .wheel-svg {
    max-width: 720px;
    overflow: visible;
  }

  .tooltip {
    position: absolute;
    z-index: 300;
    width: 320px;
    padding: 12px;
  }
</style>