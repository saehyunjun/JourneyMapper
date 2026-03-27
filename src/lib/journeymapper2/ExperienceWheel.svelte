<script lang="ts">
    import { PLUTCHIK_EMOTIONS } from './journeyConfig.js';
    import ArrowsOutVertical from 'phosphor-icons-svelte/IconArrowsOutLineVerticalRegular.svelte'; 
    import Smiley from 'phosphor-icons-svelte/IconSmileyRegular.svelte';
    import Question from 'phosphor-icons-svelte/IconQuestionRegular.svelte';
    /** @type {any} */
    export let data = null;
  
    export let stepName = '';
    export let stageName = '';
  
    $: touchpoints    = /** @type {any[]} */ (data?.touchpoints ?? []);
    $: ec             = /** @type {any} */   (data?.emotional_context ?? {});
    $: inflection     = /** @type {any} */   (data?.inflection_analysis ?? {});
    $: sponsorActions = /** @type {any[]} */ (data?.sponsor_actions ?? []);
  
    const CX = 240, CY = 240;
    const RING_INNER = 120;
    const RING_OUTER = 140;
  
    const PHASES = [
      { label: 'BEFORE', startDeg: 180, endDeg: 30 },
      { label: 'DURING', startDeg: 330, endDeg: 90  },
      { label: 'AFTER',  startDeg: 90,  endDeg: 210 },
    ];
  
    /** @param {number} d */
    function degToRad(d) { return (d * Math.PI) / 180; }
  
    /**
     * @param {number} r
     * @param {number} deg
     */
    function polar(r, deg) {
      const rad = degToRad(deg);
      return { x: CX + r * Math.cos(rad), y: CY + r * Math.sin(rad) };
    }
  
    /**
     * @param {number} ri
     * @param {number} ro
     * @param {number} startDeg
     * @param {number} endDeg
     */
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
  
    $: tpAngles = touchpoints.map((/** @type {any} */ _, /** @type {number} */ i) =>
      -90 + (360 / Math.max(touchpoints.length, 1)) * i
    );
  
    /** @param {string} s */
    function sentimentColor(s) {
      if (s === 'negative')            return '#C0483B';
      if (s === 'leans_negative')      return '#D4906C';
      if (s === 'neutral_to_negative') return '#C8902A';
      if (s === 'mixed')               return '#A08060';
      if (s === 'positive')            return '#4a9e7f';
      return '#BFA080';
    }
  
    const PHASE_COLORS = ['#7DBFA7', '#EDCAAA', '#DFC3A8'];
  
    /** @param {number} deg */
    function textAnchor(deg) {
      const cos = Math.cos(degToRad(deg));
      if (cos > 0.2) return 'start';
      if (cos < -0.2) return 'end';
      return 'middle';
    }
  
    /** @param {string} id */
    function primaryEmotionColor(id) {
      const e = PLUTCHIK_EMOTIONS?.find(em => em.id === id);
      return e?.color ?? '#DFC3A8';
    }
  
    $: primaryColor = primaryEmotionColor(ec.primary_emotion);
  
    /** @type {number | null} */
    let hoveredTp = null;
  
    /**
     * Tooltip positioning (absolute overlay so it doesn't affect layout)
     * We position within the 480x480 viewBox coordinate space.
     */
    const TOOLTIP_W = 320;   // keep in sync with CSS max-width/width
    const TOOLTIP_H = 120;   // rough clamp height; OK for compact content
    const TOOLTIP_PAD = 10;
  
    /** @param {number} v */
    const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  
    $: tooltipPos = (() => {
      if (hoveredTp === null) return null;
  
      const deg = tpAngles[hoveredTp];
  
      // Anchor point slightly outside the ring, near label area
      const anchor = polar(RING_OUTER + 70, deg);
  
      // Push tooltip left/right depending on which side of circle we're on
      const dx = Math.cos(degToRad(deg)) >= 0 ? 14 : -TOOLTIP_W - 14;
      const dy = -TOOLTIP_H / 2;
  
      const x0 = anchor.x + dx;
      const y0 = anchor.y + dy;
  
      // Clamp within the 480x480 coordinate box
      const x = clamp(x0, TOOLTIP_PAD, 480 - TOOLTIP_W - TOOLTIP_PAD);
      const y = clamp(y0, TOOLTIP_PAD, 480 - TOOLTIP_H - TOOLTIP_PAD);
  
      return { x, y };
    })();
  </script>
  
  <div class="wheel-wrap">
  

    <div class="wheel-svg-wrap">
      <svg viewBox="0 0 480 480" width="100%" class="wheel-svg" overflow="visible">
        {#each PHASES as phase, pi}
          <path
            d={phaseArcFill(RING_INNER, RING_OUTER, phase.startDeg, phase.endDeg)}
            fill={PHASE_COLORS[pi]}
            opacity="0.7"
            stroke-width="0.5"
          />
        {/each}
  
        <circle cx={CX} cy={CY} r={RING_OUTER} fill="var(--panel-dark)" stroke="var(--panel-mid)" stroke-width="2.25" />
  
        {#each PHASES as phase}
          {@const pi = polar(RING_INNER, phase.startDeg)}
          {@const po = polar(RING_OUTER + 8, phase.startDeg)}
          <line x1={pi.x} y1={pi.y} x2={po.x} y2={po.y} stroke="#DFC3A8" stroke-width="1" />
        {/each}
  
        {#each PHASES as phase}
          {@const midDeg = (phase.startDeg + (phase.endDeg <= phase.startDeg ? phase.endDeg + 360 : phase.endDeg)) / 2}
          {@const pt = polar(RING_OUTER + 26, midDeg)}
          <text x={pt.x} y={pt.y} text-anchor="middle" dominant-baseline="middle" class="phase-label">{phase.label}</text>
        {/each}
  
        {#each touchpoints as tp, i}
          {@const deg       = tpAngles[i]}
          {@const nodePt    = polar((RING_INNER + RING_OUTER) / 2, deg)}
          {@const labelPt   = polar(RING_OUTER + 60, deg)}
          {@const isHovered = hoveredTp === i}
          {@const sc        = sentimentColor(tp.sentiment)}
          {@const outerEdge  = polar(RING_OUTER + 4, deg)}
          {@const labelStart = polar(RING_OUTER + 48, deg)}
  
          <line
            x1={outerEdge.x} y1={outerEdge.y}
            x2={labelStart.x} y2={labelStart.y}
            stroke={isHovered ? sc : 'var(--ink)'}
            stroke-width={isHovered ? 1.5 : 0.75}
            opacity="0.7"
          />
  
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <circle
            cx={nodePt.x} cy={nodePt.y}
            r={isHovered ? 14 : 10}
            fill={sc}
            opacity={isHovered ? 1 : 0.82}
            stroke="var(--panel-dark)"
            stroke-width="2"
            role="button"
            aria-label={tp.moment}
            style="transition: r 0.15s, opacity 0.15s; cursor: pointer;"
            on:mouseenter={() => hoveredTp = i}
            on:mouseleave={() => hoveredTp = null}></circle>
  
          {#if tp.make_or_break}
            <text x={nodePt.x} y={nodePt.y + 1} text-anchor="middle" dominant-baseline="middle" class="node-icon" pointer-events="none">◀</text>
          {/if}
  
          {#if tp.data_needed}
            {@const iconPt = polar((RING_INNER + RING_OUTER) / 2 + 16, deg + 8)}
            <text x={iconPt.x} y={iconPt.y} text-anchor="middle" dominant-baseline="middle" class="data-icon" pointer-events="none">ⓘ</text>
          {/if}
  
          <foreignObject
            x={labelPt.x - 52} y={labelPt.y - 20}
            width="104" height="40"
            style="pointer-events: none; overflow: visible;"
          >
            <div
              xmlns="http://www.w3.org/1999/xhtml"
              class="label-sm"
              style="text-align: {textAnchor(deg)}; color: {isHovered ? '#5A3E28' : '#8A6A4A'}; font-weight: {isHovered ? '500' : '400'};"
            >
              {tp.moment}
            </div>
          </foreignObject>
        {/each}
  
        <circle cx={CX} cy={CY} r={RING_INNER} 
        fill="var(--paper)" stroke="var(--panel-dark)" stroke-width="2.2" />
  
        <text x={CX} y={CY - 22} text-anchor="middle" class="center-step">{stepName}</text>

        <text x={CX} y={CY - 6}  text-anchor="middle" class="center-stage">{stageName}</text>
        <rect x={CX - 36} y={CY + 2} width="72" height="16" rx="2" fill={primaryColor} opacity="0.25" />
        
        <text x={CX} y={CY + 13} text-anchor="middle" class="center-emotion" style="fill: {primaryColor};">{ec.primary_emotion ?? ''}

        </text>
        <text x={CX} y={CY + 34} text-anchor="middle" class="center-score">{(ec.emotional_valence ?? 0) >= 0 ? '+' : ''}{ec.emotional_valence ?? ''}</text>
        <text x={CX} y={CY + 47} text-anchor="middle" class="center-score-label">overall valence</text>
      </svg>
  
      {#if hoveredTp !== null && tooltipPos}
        {@const tp = touchpoints[hoveredTp]}
        <div
          class="tooltip jm-surface"
          style="left: {tooltipPos.x}px; top: {tooltipPos.y}px;"
        >
          <div class="pill w-fit">{tp.type.replace(/_/g, ' ')}</div>
          <div class="label">{tp.moment}</div>
          <div class="tooltip-divider"></div>
  
          {#if tp.positive_design_opportunity}
            <div class="tooltip-row">
              <Smiley class="w-6" />
              <span class="text-body">{tp.positive_design_opportunity}</span>
            </div>
          {/if}
  
          {#if tp.data_needed}
            <div class="tooltip-row">
              <span class="tooltip-icon info">ⓘ</span>
              <span class="tooltip-text">{tp.data_needed}</span>
            </div>
          {/if}
  
          {#if tp.make_or_break}
            <div class="tooltip-mob">
              <ArrowsOutVertical />
              <span>Make-or-break moment</span>
            </div>
          {/if}
        </div>
      {/if}
    </div>
    <div class="grid grid-cols-3 gap-2">
      <div class="pill gap-2">
        <Smiley class="icon-toolbar-dark" />
        <span class="label">Positive design opportunity</span>
        </div>
        
        <div class="pill gap-2">
          <ArrowsOutVertical class="icon-toolbar-dark"/>
          <span class="label">Make-or-break moment</span></div>
        
          <div class="pill gap-2">
          <Question class="icon-toolbar-dark"/>
          <span class="label">Information gaps</span>
        </div>
        </div>

    <span class="label-lg uppercase">
      Inflection Analysis</span>
    
      <div class="jm-content-col">
         <div class="toolbar-light">
          <span class="label uppercase">Risk level</span>
          <span class="pill label risk-{inflection.risk_level}">{inflection.risk_level}</span>
        </div>

        <div class="toolbar-light">          
          <span class="label-sm">Dropout risk</span>
          <span class="pill uppercase text-slate-800">{inflection.dropout_risk}</span>
        </div>
        
        <div class="panel-row panel-row--col">
          <span class="label uppercase">
            Trial perception</span>
          <span class="text-body">
            {inflection.trial_perception_shift?.replace(/_/g, ' ')}
          </span>
        </div>

        {#if inflection.sponsor_opportunity_category?.length}
          <div class="panel-row panel-row--col">
            <span class="label uppercase">
              Opportunities</span>
            <div class="tag-list">
              {#each inflection.sponsor_opportunity_category as cat}
                <span class="text-body">{cat.replace(/_/g, ' ')}</span>
              {/each}
            </div>
          </div>
        {/if}

  
      <div class="panel">
        <div class="panel-heading">Sponsor Actions</div>
        {#each sponsorActions as action}
          <div class="action-row">
            <div class="action-cat">{action.category}</div>
            <div class="action-text">{action.action}</div>
            <div class="action-timing">⏱ {action.timing}</div>
          </div>
        {/each}
      </div>
    </div>
  </div>
  
  
  <style>
    .wheel-wrap { display: flex; flex-direction: column; overflow-y: scroll;}
  

    .wheel-svg-wrap {
      display: flex;
      justify-content: center;
      align-items: flex-start;
      padding: 1em;
      position: relative; /* required for absolute tooltip positioning */
      gap: 12px;
    }

    .wheel-svg { 
      display: block; overflow: visible; max-width: 600px; }
  

    .bottom-panels { display: grid; grid-template-columns: 1fr 1fr; border-top: 1px solid #DFC3A8; }

    .panel { padding: 12px 14px; display: flex; flex-direction: column; gap: 7px; border-right: 1px solid #DFC3A8; }
    .panel:last-child { border-right: none; }
    .panel-heading { font-family: 'DM Sans', sans-serif; font-size: 8px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.1em; color: #BFA080; padding-bottom: 4px; border-bottom: 1px solid #EDE5D8; }
    .panel-row { display: flex; align-items: center; gap: 8px; }
    .panel-row--col { flex-direction: column; align-items: flex-start; gap: 3px; }
    .panel-key { font-size: 7.5px; text-transform: uppercase; letter-spacing: 0.07em; color: #BFA080; flex-shrink: 0; min-width: 72px; }
    .panel-val { font-family: 'Space Mono', monospace; font-size: 8.5px; color: #5A3E28; }
    .panel-val.small { font-family: 'DM Sans', sans-serif; font-size: 8.5px; color: #7A5A3A; }
    .risk-badge { font-family: 'Space Mono', monospace; font-size: 7.5px; letter-spacing: 0.06em; text-transform: uppercase; padding: 2px 6px; border-radius: 2px; }
    .risk-high   { background: rgba(192,72,59,0.12);  color: #C0483B; border: 1px solid rgba(192,72,59,0.25); }
    .risk-medium { background: rgba(200,144,42,0.12); color: #C8902A; border: 1px solid rgba(200,144,42,0.25); }
    .risk-low    { background: rgba(74,158,127,0.12); color: #4a9e7f; border: 1px solid rgba(74,158,127,0.25); }
    .tag-list { display: flex; flex-wrap: wrap; gap: 3px; }
    .tag { font-family: 'DM Sans', sans-serif; font-size: 7.5px; color: #7A5A3A; background: #EDE5D8; border: 1px solid #DFC3A8; border-radius: 2px; padding: 2px 5px; text-transform: capitalize; }
    .action-row { display: flex; flex-direction: column; gap: 2px; padding: 5px 0; border-bottom: 1px solid #EDE5D8; }
    .action-row:last-child { border-bottom: none; }
    .action-cat { font-size: 7px; text-transform: uppercase; letter-spacing: 0.09em; color: #BFA080; font-weight: 500; }
    .action-text { font-size: 1em; color: #5A3E28; line-height: 1.25; }
    .action-timing { font-family: 'Space Mono', monospace; font-size: 7.5px; color: #A08060; font-style: italic; }
  </style>