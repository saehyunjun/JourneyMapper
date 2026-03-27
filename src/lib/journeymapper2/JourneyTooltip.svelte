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

  const PHASES = [
    { label: 'BEFORE', startDeg: 180, endDeg: 30 },
    { label: 'DURING', startDeg: 330, endDeg: 90  },
    { label: 'AFTER',  startDeg: 90,  endDeg: 210 },
  ];

  function degToRad(d) { return (d * Math.PI) / 180; }

  function polar(r, deg) {
    const rad = degToRad(deg);
    return { x: CX + r * Math.cos(rad), y: CY + r * Math.sin(rad) };
  }

  function phaseArcFill(ri, ro, startDeg, endDeg) {
    let end = endDeg;
    if (end <= startDeg) end += 360;
    const large = (end - startDeg) > 180 ? 1 : 0;
    const s  = polar(ri, startDeg);
    const e  = polar(ri, end % 360);
    const so = polar(ro, startDeg);
    const eo = polar(ro, end % 360);
    return `M ${so.x} ${so.y} A ${ro} ${ro} 0 ${large} 1 ${eo.x} ${eo.y} L ${e.x} ${e.y} A ${ri} ${ri} 0 ${large} 0 ${s.x} ${s.y} Z`;
  }

  $: tpAngles = touchpoints.map((_, i) =>
    -90 + (360 / Math.max(touchpoints.length, 1)) * i
  );

  function sentimentColor(s) {
    if (s === 'negative') return '#C0483B';
    if (s === 'leans_negative') return '#D4906C';
    if (s === 'neutral_to_negative') return '#C8902A';
    if (s === 'mixed') return '#A08060';
    if (s === 'positive') return '#4a9e7f';
    return '#BFA080';
  }

  function textAnchor(deg) {
    const cos = Math.cos(degToRad(deg));
    if (cos > 0.2) return 'start';
    if (cos < -0.2) return 'end';
    return 'middle';
  }

  function primaryEmotionColor(id) {
    const e = PLUTCHIK_EMOTIONS?.find(em => em.id === id);
    return e?.color ?? '#DFC3A8';
  }

  $: primaryColor = primaryEmotionColor(ec.primary_emotion);

  let hoveredTp = null;

  const TOOLTIP_W = 320;
  const TOOLTIP_H = 120;
  const TOOLTIP_PAD = 10;

  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

  $: tooltipPos = (() => {
    if (hoveredTp === null) return null;
    const deg = tpAngles[hoveredTp];
    const anchor = polar(RING_OUTER + 70, deg);

    const dx = Math.cos(degToRad(deg)) >= 0 ? 14 : -TOOLTIP_W - 14;
    const dy = -TOOLTIP_H / 2;

    const x0 = anchor.x + dx;
    const y0 = anchor.y + dy;

    return {
      x: clamp(x0, TOOLTIP_PAD, 480 - TOOLTIP_W - TOOLTIP_PAD),
      y: clamp(y0, TOOLTIP_PAD, 480 - TOOLTIP_H - TOOLTIP_PAD)
    };
  })();
</script>

<div class="wheel-wrap">

  <!-- SVG unchanged -->
  <div class="wheel-svg-wrap">
    <svg viewBox="0 0 480 480" class="wheel-svg">
      {#each PHASES as phase, pi}
        <path d={phaseArcFill(RING_INNER, RING_OUTER, phase.startDeg, phase.endDeg)}
          fill={['#7DBFA7','#EDCAAA','#DFC3A8'][pi]} opacity="0.7"/>
      {/each}

      <circle cx={CX} cy={CY} r={RING_OUTER} fill="var(--panel-dark)" stroke="var(--panel-mid)" stroke-width="2.25"/>

      {#each touchpoints as tp, i}
        {@const deg = tpAngles[i]}
        {@const nodePt = polar((RING_INNER + RING_OUTER)/2, deg)}
        {@const sc = sentimentColor(tp.sentiment)}

        <circle
          cx={nodePt.x}
          cy={nodePt.y}
          r={hoveredTp === i ? 14 : 10}
          fill={sc}
          on:mouseenter={() => hoveredTp = i}
          on:mouseleave={() => hoveredTp = null}
        />
      {/each}

      <circle cx={CX} cy={CY} r={RING_INNER} fill="var(--paper)"/>
      <text x={CX} y={CY - 10} text-anchor="middle" class="label">{stepName}</text>
      <text x={CX} y={CY + 10} text-anchor="middle" class="label-sm">{stageName}</text>
    </svg>

    {#if hoveredTp !== null && tooltipPos}
      {@const tp = touchpoints[hoveredTp]}
      <div class="tooltip jm-surface" style="left:{tooltipPos.x}px; top:{tooltipPos.y}px;">
        <div class="pill">{tp.type}</div>
        <div class="label">{tp.moment}</div>
        <div class="divider"></div>

        {#if tp.positive_design_opportunity}
          <div class="jm-content-row">
            <Smiley class="icon-toolbar-dark-sm"/>
            <span class="text-body">{tp.positive_design_opportunity}</span>
          </div>
        {/if}

        {#if tp.data_needed}
          <div class="jm-content-row">
            <Question class="icon-toolbar-light-sm"/>
            <span class="text-body">{tp.data_needed}</span>
          </div>
        {/if}

        {#if tp.make_or_break}
          <div class="jm-content-row">
            <ArrowsOutVertical class="icon-toolbar-dark-sm"/>
            <span class="text-body">Make-or-break moment</span>
          </div>
        {/if}
      </div>
    {/if}
  </div>

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
  
  <!-- INFLECTION SECTION -->
  <div class="detail-section">
  
    <div class="jm-section-bar">
      <span class="label-uppercase-bold">Inflection Analysis</span>
    </div>
  
    <!-- Metrics -->
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
  
    <!-- Opportunities -->
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
  
  <!-- SPONSOR ACTIONS -->
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
    justify-content: center;
  }

  .wheel-svg {
    max-width: 600px;
  }
</style>