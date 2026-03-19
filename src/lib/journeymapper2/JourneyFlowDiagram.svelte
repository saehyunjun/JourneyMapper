<script>
    import { buildStageColorMap, sentimentToColor } from './journeyConfig.js';
    import { hoveredIndex, selectedIndex } from './journeyStore.js';
    import ArrowRightRegular from 'phosphor-icons-svelte/IconArrowRightRegular.svelte';
    import ArrowUpRegular    from 'phosphor-icons-svelte/IconArrowUpRegular.svelte';
    import ArrowDownRegular  from 'phosphor-icons-svelte/IconArrowDownRegular.svelte';
    import LightbulbRegular  from 'phosphor-icons-svelte/IconLightbulbRegular.svelte';
    import WarningRegular    from 'phosphor-icons-svelte/IconWarningRegular.svelte';
  
    /** @type {any[]} */
    export let data = [];
  
    // ── Stage groups ───────────────────────────────────────────────────────────
    $: stageGroups = (() => {
      /** @type {Map<string, { stage_id: string; stage: string; steps: { step: string; step_id: string; index: number }[] }>} */
      const map = new Map();
      data.forEach((d, i) => {
        if (!map.has(d.stage_id)) {
          map.set(d.stage_id, { stage_id: d.stage_id, stage: d.stage, steps: [] });
        }
        map.get(d.stage_id).steps.push({ step: d.step, step_id: d.step_id, index: i });
      });
      return [...map.values()];
    })();
  
    $: stageColorMap = buildStageColorMap(data);
  
    // ── Cursor tracking ────────────────────────────────────────────────────────
    let mouseX = 0;
    let mouseY = 0;
  
    /** @param {MouseEvent} e */
    function onMouseMove(e) {
      mouseX = e.clientX;
      mouseY = e.clientY;
    }
  
    // ── Inflection tooltip ────────────────────────────────────────────────────
    // Only visible when the hovered step has inflection === 'Y'
    $: hoveredStep      = $hoveredIndex >= 0 ? data[$hoveredIndex] : null;
    $: inflectionDetail = (hoveredStep?.inflection === 'Y') ? (hoveredStep?.inflection_detail ?? null) : null;
    $: showInflectionTip = inflectionDetail !== null;
  
    // ── Tooltip position — flips left when near right viewport edge ───────────
    const TIP_W    = 300;
    const OFFSET_X = 18;
    const OFFSET_Y = 12;
  
    $: vpW      = typeof window !== 'undefined' ? window.innerWidth : 9999;
    $: flipLeft = mouseX + OFFSET_X + TIP_W > vpW - 16;
    $: tipX     = flipLeft ? mouseX - TIP_W - OFFSET_X : mouseX + OFFSET_X;
    $: tipY     = mouseY + OFFSET_Y;
  
    // ── Helpers ────────────────────────────────────────────────────────────────
    /** @param {number} globalIndex */
    function handleStepClick(globalIndex) {
      selectedIndex.update(i => i === globalIndex ? -1 : globalIndex);
    }
  
    /** @param {string} level */
    function riskColor(level) {
      if (level === 'critical') return '#C0392B';
      if (level === 'high')     return '#E67E22';
      if (level === 'moderate') return '#c9a227';
      return '#7F8C8D';
    }
  </script>
  
  <svelte:window on:mousemove={onMouseMove} />
  
  <!-- ── Flow diagram ──────────────────────────────────────────────────────── -->
  <div class="flow-diagram-scroll shared-scroll" role="region" aria-label="Journey flow diagram">
    <div class="flow-diagram-row">
  
      {#each stageGroups as group, gi}
  
        <div class="flow-stage">
  
          <!-- Stage header -->
          <div class="flow-stage-header" style="background-color:{stageColorMap[group.stage_id]};">
            <span class="label-heading" style="color:#fff; letter-spacing:0.08em;">{group.stage}</span>
            <span class="flow-stage-count label-heading" style="color:rgba(255,255,255,0.65);">{group.steps.length}</span>
          </div>
  
          <!-- Steps row -->
          <div class="flow-steps-row">
            {#each group.steps as step, si}
  
              <div class="flow-step-slot">
  
                <!-- Step card -->
                <button
                  class="flow-step-card"
                  class:flow-step-card--hovered={$hoveredIndex === step.index}
                  class:flow-step-card--selected={$selectedIndex === step.index}
                  style="border-bottom-color:{stageColorMap[group.stage_id]};"
                  on:mouseenter={() => hoveredIndex.set(step.index)}
                  on:mouseleave={() => hoveredIndex.set(-1)}
                  on:click={() => handleStepClick(step.index)}
                  aria-pressed={$selectedIndex === step.index}
                >
                  <span class="flow-step-top-row">
                    <span
                      class="flow-sentiment-dot"
                      style="background-color:{sentimentToColor(data[step.index]?.sentiment)};"
                      aria-label="Sentiment: {data[step.index]?.sentiment}"
                    />
                    <span class="flow-step-index nav-title" style="color:{stageColorMap[group.stage_id]};">
                      {step.index + 1}
                    </span>
                  </span>
                  <span class="flow-step-label label-bold">{step.step}</span>
                </button>
  
                <!-- Inflection placeholder — minimal anchor; detail lives in tooltip -->
                {#if data[step.index]?.inflection === 'Y'}
                  <div class="flow-inflection-connector" aria-hidden="true"></div>
                  <div
                    class="flow-inflection-card"
                    class:flow-inflection-card--hovered={$hoveredIndex === step.index}
                    class:flow-inflection-card--selected={$selectedIndex === step.index}
                    style="border-top-color:{stageColorMap[group.stage_id]};"
                    role="region"
                    aria-label="Inflection point: {data[step.index]?.step}"
                    on:mouseenter={() => hoveredIndex.set(step.index)}
                    on:mouseleave={() => hoveredIndex.set(-1)}
                  >
                    {#if data[step.index]?.inflection_detail}
                      {@const d = data[step.index].inflection_detail}
                      <div class="infl-placeholder-row">
                        <span class="infl-placeholder-label nav-title">{d.label}</span>
                      </div>
                    {:else}
                      <span class="infl-placeholder-empty label-heading">Inflection point</span>
                    {/if}
                  </div>
                {/if}
  
              </div>
  
              {#if si < group.steps.length - 1}
                <span class="flow-connector" aria-hidden="true">
                  <ArrowRightRegular size={12} />
                </span>
              {/if}
  
            {/each}
          </div>
  
        </div>
  
        {#if gi < stageGroups.length - 1}
          <span class="flow-stage-connector" aria-hidden="true">
            <ArrowRightRegular size={16} />
          </span>
        {/if}
  
      {/each}
  
    </div>
  </div>
  
  <!-- ── Inflection detail tooltip ─────────────────────────────────────────── -->
  {#if showInflectionTip && inflectionDetail}
    <div
      class="infl-tooltip jm-surface"
      style="left:{tipX}px; top:{tipY}px; width:{TIP_W}px;"
      role="tooltip"
      aria-live="polite"
    >
  
      <!-- Header -->
      <div class="infl-tip-header jm-section-bar">
        <span class="jm-kicker">{inflectionDetail.label}</span>
      </div>
  
      <!-- Step name + description -->
      <div class="infl-tip-section">
        <span class="label-bold" style="font-size:0.8rem;">{hoveredStep?.step}</span>
        {#if inflectionDetail.description}
          <p class="text-body-sm infl-tip-desc">{inflectionDetail.description}</p>
        {/if}
      </div>
  
      <!-- Paths -->
      {#if inflectionDetail.paths?.length}
        <div class="infl-tip-section">
          <span class="jm-kicker" style="margin-bottom:0.35rem;">Paths</span>
          <div class="infl-paths">
            {#each inflectionDetail.paths as path}
              <div class="infl-path infl-path--{path.direction}">
                <span class="infl-path-icon">
                  {#if path.direction === 'positive'}
                    <ArrowUpRegular size={11} />
                  {:else}
                    <ArrowDownRegular size={11} />
                  {/if}
                </span>
                <div class="infl-path-body">
                  <span class="label-bold" style="font-size:0.72rem;">{path.label}</span>
                  <span class="text-body-sm infl-path-outcome">{path.outcome}</span>
                  {#if path.key_driver}
                    <span class="label-heading infl-path-driver">{path.key_driver}</span>
                  {/if}
                </div>
              </div>
            {/each}
          </div>
        </div>
      {/if}
  
      <!-- Sponsor opportunity -->
      {#if inflectionDetail.sponsor_opportunity}
        <div class="infl-tip-section">
          <span class="jm-kicker" style="margin-bottom:0.35rem;">Sponsor Opportunity</span>
          <div class="infl-opportunity">
            <span class="infl-opportunity-icon"><LightbulbRegular size={11} /></span>
            <span class="text-body-sm">{inflectionDetail.sponsor_opportunity}</span>
          </div>
        </div>
      {/if}
  
      <!-- Data needed -->
      {#if inflectionDetail.data_needed}
        <div class="infl-tip-data-needed">
          <span class="label-heading" style="color:#8090a8;">Data needed</span>
          <span class="text-body-sm" style="color:#606878;">{inflectionDetail.data_needed}</span>
        </div>
      {/if}
  
    </div>
  {/if}
  
  <style>
    /* ── Scroll wrapper ───────────────────────────────────────────────────── */
    .flow-diagram-scroll {
      overflow-x: auto;
      overflow-y: visible;
      padding: 1rem 1.25rem 1.25rem;
    }
  
    /* ── Top row of stage groups ─────────────────────────────────────────── */
    .flow-diagram-row {
      display: flex;
      flex-direction: row;
      align-items: flex-start;
      gap: 0.25rem;
      width: max-content;
    }
  
    /* ── Stage group ─────────────────────────────────────────────────────── */
    .flow-stage {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }
  
    .flow-stage-header {
      display: flex;
      flex-direction: row;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem;
      padding: 0.3rem 0.65rem;
      border-radius: 4px 4px 0 0;
    }
  
    .flow-stage-count { opacity: 0.8; }
  
    /* ── Steps row ───────────────────────────────────────────────────────── */
    .flow-steps-row {
      display: flex;
      flex-direction: row;
      align-items: flex-start;
      gap: 0;
    }
  
    /* ── Step slot ───────────────────────────────────────────────────────── */
    .flow-step-slot {
      display: flex;
      flex-direction: column;
      align-items: center;
    }
  
    /* ── Step card ───────────────────────────────────────────────────────── */
    .flow-step-card {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 0.25rem;
      padding: 0.25em 0.525em;
      width: 180px;
      min-height: 95px;
      background-color: var(--paper);
      border: 0.5px solid #c8cdd8;
      border-bottom-width: 3px;
      cursor: pointer;
      text-align: left;
      transition: background-color 120ms ease, box-shadow 120ms ease, transform 120ms ease;
    }
  
    .flow-step-card:hover,
    .flow-step-card--hovered {
      background-color: #eaeff8;
      box-shadow: 0 2px 6px rgba(0,0,0,0.1), 0 0 0 1px rgba(63,115,255,0.18);
      transform: translateY(-1px);
      z-index: 1;
    }
  
    .flow-step-card--selected {
      background-color: var(--paper, #fffff0);
      box-shadow: 0 4px 12px rgba(0,0,0,0.14), 0 0 0 2px #3f73ff;
      z-index: 2;
    }
  
    .flow-step-top-row {
      display: flex;
      flex-direction: row;
      align-items: center;
      justify-content: space-between;
      width: 100%;
    }
  
    .flow-sentiment-dot {
      width: 9px;
      height: 9px;
      border-radius: 50%;
      flex-shrink: 0;
      border: 1.5px solid rgba(0,0,0,0.15);
    }
  
    .flow-step-index {
      font-size: 0.55rem;
      letter-spacing: 0.1em;
    }
  
    .flow-step-label {
      font-size: 0.75rem;
      line-height: 1.125;
      color: var(--ink, #312f28);
    }
  
    /* ── Connectors ──────────────────────────────────────────────────────── */
    .flow-connector {
      display: flex;
      align-items: center;
      justify-content: center;
      color: #b0b8c8;
      padding: 0 0.1rem;
      flex-shrink: 0;
    }
  
    .flow-stage-connector {
      display: flex;
      align-items: center;
      justify-content: center;
      color: #8090a8;
      padding: 0 0.35rem;
      margin-top: calc(36px + 0.5rem + 0.5rem);
      flex-shrink: 0;
    }
  
    /* ── Inflection placeholder ──────────────────────────────────────────── */
    .flow-inflection-connector {
      width: 1px;
      height: 20px;
      border-left: 1.5px dashed #a0a8b8;
      flex-shrink: 0;
    }
  
    .flow-inflection-card {
      width: 140px;
      min-height: 32px;
      background-color: var(--paper, #fffff0);
      border: 0.5px dashed #a0a8b8;
      border-bottom-width: 3px;
      border-bottom-style: solid;
      border-radius: 0 0 4px 4px;
      padding: 0.4rem 0.6rem;
      cursor: default;
      opacity: 0.65;
      transition: opacity 120ms ease, box-shadow 120ms ease;
    }
  
    .flow-inflection-card--hovered,
    .flow-inflection-card--selected {
      opacity: 1;
      box-shadow: 0 2px 8px rgba(0,0,0,0.08);
    }
  
    .infl-placeholder-row {
      display: flex;
      flex-direction: row;
      align-items: center;
      justify-content: space-between;
      gap: 0.25rem;
    }
  
    .infl-placeholder-label {
      font-size: 0.5rem;
      color: #4a5568;
      letter-spacing: 0.09em;
      line-height: 1.3;
    }
  
    .infl-placeholder-empty {
      font-size: 0.5rem;
      color: #a0a8b8;
      font-style: italic;
    }
  
    /* ── Inflection tooltip ──────────────────────────────────────────────── */
    .infl-tooltip {
      position: fixed;
      pointer-events: none;
      z-index: 500;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      padding: 0.85rem 1rem 1rem;
      border-radius: 4px;
      transition: left 60ms linear, top 60ms linear;
    }
  
    .infl-tip-header {
      align-items: center;
    }
  
  
    .infl-tip-desc {
      margin: 0;
      color: #4a5568;
      line-height: 1.5;
    }
  
    .infl-paths {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }
  
    .infl-path {
      display: flex;
      flex-direction: row;
      align-items: flex-start;
      gap: 0.4rem;
      padding: 0.4rem 0.5rem;
      border-radius: 3px;
    }
  
    .infl-path--positive {
      background-color: rgba(40, 183, 152, 0.08);
      border-left: 2px solid #28b798;
    }
  
    .infl-path--negative {
      background-color: rgba(192, 57, 43, 0.07);
      border-left: 2px solid #C0392B;
    }
  
    .infl-path-icon {
      display: flex;
      align-items: center;
      flex-shrink: 0;
      margin-top: 2px;
    }
  
    .infl-path--positive .infl-path-icon { color: #28b798; }
    .infl-path--negative .infl-path-icon { color: #C0392B; }
  
    .infl-path-body {
      display: flex;
      flex-direction: column;
      gap: 0.2rem;
    }
  
    .infl-path-outcome {
      color: #5a6070;
      line-height: 1.45;
    }
  
    .infl-path-driver {
      color: #8090a8;
      font-style: italic;
      margin-top: 0.1rem;
      font-size: 0.65rem;
    }
  
    .infl-opportunity {
      display: flex;
      flex-direction: row;
      align-items: flex-start;
      gap: 0.4rem;
      padding: 0.4rem 0.5rem;
      background-color: rgba(63, 115, 255, 0.06);
      border-left: 2px solid #3f73ff;
      border-radius: 3px;
    }
  
    .infl-opportunity-icon {
      color: #3f73ff;
      flex-shrink: 0;
      margin-top: 2px;
    }
  
    .infl-tip-data-needed {
      display: flex;
      flex-direction: column;
      gap: 0.15rem;
      padding-top: 0.5rem;
      border-top: 0.5px solid #d0d8e8;
    }
  </style>