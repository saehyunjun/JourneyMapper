<script>
    import { buildStageColorMap, sentimentToColor } from './journeyConfig.js';
    import { hoveredIndex, selectedIndex } from './journeyStore.js';
    import ArrowRightRegular from 'phosphor-icons-svelte/IconArrowRightRegular.svelte';
    import ArrowUpRegular from 'phosphor-icons-svelte/IconArrowUpRegular.svelte';
    import ArrowDownRegular from 'phosphor-icons-svelte/IconArrowDownRegular.svelte';
    import LightbulbRegular from 'phosphor-icons-svelte/IconLightbulbRegular.svelte';
    import WarningRegular from 'phosphor-icons-svelte/IconWarningRegular.svelte';
    /** @type {any[]} */
    export let data = [];
  
    // ── Derive stage groups ────────────────────────────────────────────────────
    /** @type {{ stage_id: string; stage: string; steps: { step: string; step_id: string; index: number }[] }[]} */
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
  
    /** @param {number} globalIndex */
    function handleStepClick(globalIndex) {
      selectedIndex.update(i => i === globalIndex ? -1 : globalIndex);
    }
  
    /** Maps risk_level string to a display color */
    /** @param {string} level */
    function riskColor(level) {
      if (level === 'critical') return '#C0392B';
      if (level === 'high')     return '#E67E22';
      if (level === 'moderate') return '#F1C40F';
      return '#7F8C8D';
    }
  </script>
  
  <!-- ── Outer scroll wrapper: matches .shared-scroll pattern ──────────────── -->
  <div class="flow-diagram-scroll shared-scroll" role="region" aria-label="Journey flow diagram">
    <div class="flow-diagram-row">
  
      {#each stageGroups as group, gi}
  
        <!-- ── Stage group ─────────────────────────────────────────────── -->
        <div class="flow-stage">
  
          <!-- Stage header pill -->
          <div
            class="flow-stage-header"
            style="background-color: {stageColorMap[group.stage_id]};"
          >
            <span class="label-heading" style="color: #fff; letter-spacing: 0.08em;">
              {group.stage}
            </span>
            <span class="flow-stage-count label-heading" style="color: rgba(255,255,255,0.65);">
              {group.steps.length}
            </span>
          </div>
  
          <!-- Steps row inside the stage -->
          <div class="flow-steps-row">
            {#each group.steps as step, si}
  
              <!-- ── Step slot: card + optional inflection branch below ── -->
              <div class="flow-step-slot">
  
                <!-- Step card -->
                <button
                  class="flow-step-card"
                  class:flow-step-card--hovered={$hoveredIndex === step.index}
                  class:flow-step-card--selected={$selectedIndex === step.index}
                  style="border-top-color: {stageColorMap[group.stage_id]};"
                  on:mouseenter={() => hoveredIndex.set(step.index)}
                  on:mouseleave={() => hoveredIndex.set(-1)}
                  on:click={() => handleStepClick(step.index)}
                  aria-pressed={$selectedIndex === step.index}
                >
                  <!-- Top row: sentiment dot + step number -->
                  <span class="flow-step-top-row">
                    <span
                      class="flow-sentiment-dot"
                      style="background-color: {sentimentToColor(data[step.index]?.sentiment)};"
                      aria-label="Sentiment: {data[step.index]?.sentiment}"
                    />
                    <span class="flow-step-index nav-title" style="color: {stageColorMap[group.stage_id]};">
                      {step.index + 1}
                    </span>
                  </span>
  
                  <!-- Step label -->
                  <span class="flow-step-label label-bold">
                    {step.step}
                  </span>
                </button>
  
                <!-- ── Inflection branch ─────────────────────────────── -->
                {#if data[step.index]?.inflection === 'Y'}
                  {@const detail = data[step.index]?.inflection_detail}
                  <div class="flow-inflection-connector" aria-hidden="true"></div>
                  <div
                    class="flow-inflection-card"
                    class:flow-inflection-card--hovered={$hoveredIndex === step.index}
                    class:flow-inflection-card--selected={$selectedIndex === step.index}
                    style="border-top-color: {stageColorMap[group.stage_id]};"
                  >
                    {#if detail}
  
                      <!-- ── Header: label + risk badge ─────────────── -->
                      <div class="infl-header">
                        <span class="infl-label nav-title">{detail.label}</span>
                        {#if detail.risk_level}
                          <span
                            class="infl-risk-badge label-heading"
                            style="color: {riskColor(detail.risk_level)}; border-color: {riskColor(detail.risk_level)};"
                          >
                            <WarningRegular size={9} />
                            {detail.risk_level}
                          </span>
                        {/if}
                      </div>
  
                      <!-- ── Description ────────────────────────────── -->
                      {#if detail.description}
                        <p class="infl-description text-body-sm">{detail.description}</p>
                      {/if}
  
                      <!-- ── Paths ──────────────────────────────────── -->
                      {#if detail.paths?.length}
                        <div class="infl-paths">
                          {#each detail.paths as path}
                            <div class="infl-path infl-path--{path.direction}">
                              <span class="infl-path-icon">
                                {#if path.direction === 'positive'}
                                  <ArrowUpRegular size={10} />
                                {:else}
                                  <ArrowDownRegular size={10} />
                                {/if}
                              </span>
                              <div class="infl-path-body">
                                <span class="infl-path-label label-bold">{path.label}</span>
                                <span class="infl-path-outcome text-body-sm">{path.outcome}</span>
                                {#if path.key_driver}
                                  <span class="infl-path-driver label-heading">{path.key_driver}</span>
                                {/if}
                              </div>
                            </div>
                          {/each}
                        </div>
                      {/if}
  
                      <!-- ── Sponsor opportunity ────────────────────── -->
                      {#if detail.sponsor_opportunity}
                        <div class="infl-opportunity">
                          <span class="infl-opportunity-icon">
                            <LightbulbRegular size={10} />
                          </span>
                          <span class="text-body-sm">{detail.sponsor_opportunity}</span>
                        </div>
                      {/if}
  
                      <!-- ── Data needed ────────────────────────────── -->
                      {#if detail.data_needed}
                        <div class="infl-data-needed">
                          <span class="label-heading" style="color: #8090a8;">Data needed</span>
                          <span class="text-body-sm" style="color: #606878;">{detail.data_needed}</span>
                        </div>
                      {/if}
  
                    {:else}
                      <!-- Fallback: no detail yet populated -->
                      <span class="infl-empty label-heading">No detail available</span>
                    {/if}
                  </div>
                {/if}
  
              </div>
  
              <!-- Arrow connector between steps (not after last) -->
              {#if si < group.steps.length - 1}
                <span class="flow-connector" aria-hidden="true">
                  <ArrowRightRegular size={12} />
                </span>
              {/if}
  
            {/each}
          </div>
  
        </div>
  
        <!-- Arrow connector between stage groups (not after last) -->
        {#if gi < stageGroups.length - 1}
          <span class="flow-stage-connector" aria-hidden="true">
            <ArrowRightRegular size={16} />
          </span>
        {/if}
  
      {/each}
  
    </div>
  </div>
  
  <style>
    /* ── Outer scroll container ─────────────────────────────────────────── */
    .flow-diagram-scroll {
      overflow-x: auto;
      overflow-y: visible;
      padding: 1rem 1.25rem 1.25rem;
    }
  
    /* ── Top-level horizontal row of stage groups ───────────────────────── */
    .flow-diagram-row {
      display: flex;
      flex-direction: row;
      align-items: flex-start;
      gap: 0.25rem;
      width: max-content;
    }
  
    /* ── Stage group container ──────────────────────────────────────────── */
    .flow-stage {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }
  
    /* ── Stage header band ──────────────────────────────────────────────── */
    .flow-stage-header {
      display: flex;
      flex-direction: row;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem;
      padding: 0.3rem 0.65rem;
    }
  
    .flow-stage-count {
      opacity: 0.8;
    }
  
    /* ── Row of step cards within a stage ──────────────────────────────── */
    .flow-steps-row {
      display: flex;
      flex-direction: row;
      align-items: flex-start;
      gap: 0;
    }
  
    /* ── Column slot: card stacked above its inflection branch ─────────── */
    .flow-step-slot {
      display: flex;
      flex-direction: column;
      align-items: center;
    }
  
    /* ── Individual step card ───────────────────────────────────────────── */
    .flow-step-card {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 0.3rem;
      padding: 0.6rem 0.75rem;
  
      width: 140px;
      min-height: 72px;
  
      background-color: var(--card, #d8deed);
      border: 0.5px solid #c8cdd8;
      border-top-width: 3px;
      
  
      cursor: pointer;
      text-align: left;
  
      transition:
        background-color 120ms ease,
        box-shadow 120ms ease,
        transform 120ms ease;
    }
  
    .flow-step-card:hover,
    .flow-step-card--hovered {
      background-color: #eaeff8;
      box-shadow:
        0 2px 6px rgba(0, 0, 0, 0.1),
        0 0 0 1px rgba(63, 115, 255, 0.18);
      transform: translateY(-1px);
      z-index: 1;
    }
  
    .flow-step-card--selected {
      background-color: var(--paper, #fffff0);
      box-shadow:
        0 4px 12px rgba(0, 0, 0, 0.14),
        0 0 0 2px #3f73ff;
      transform: translateY(-2px);
      z-index: 2;
    }
  
    /* Top row: sentiment dot + step index side by side */
    .flow-step-top-row {
      display: flex;
      flex-direction: row;
      align-items: center;
      justify-content: space-between;
      width: 100%;
    }
  
    /* Sentiment dot */
    .flow-sentiment-dot {
      width: 9px;
      height: 9px;
      border-radius: 50%;
      flex-shrink: 0;
      border: 1.5px solid rgba(0, 0, 0, 0.15);
    }
  
    /* Step index badge */
    .flow-step-index {
      font-size: 0.55rem;
      letter-spacing: 0.1em;
    }
  
    /* Step label text */
    .flow-step-label {
      font-size: 0.75rem;
      line-height: 1.3;
      color: var(--ink, #312f28);
    }
  
    /* ── Connector arrows between steps ────────────────────────────────── */
    .flow-connector {
      display: flex;
      align-items: center;
      justify-content: center;
      color: #b0b8c8;
      padding: 0 0.1rem;
      flex-shrink: 0;
    }
  
    /* ── Connector arrows between stage groups ──────────────────────────── */
    .flow-stage-connector {
      display: flex;
      align-items: center;
      justify-content: center;
      color: #8090a8;
      padding: 0 0.35rem;
      margin-top: calc(36px + 0.5rem + 0.5rem);
      flex-shrink: 0;
    }
  
    /* ── Dotted vertical connector to inflection card ──────────────────── */
    .flow-inflection-connector {
      width: 1px;
      height: 20px;
      border-left: 1.5px dashed #a0a8b8;
      flex-shrink: 0;
    }
  
    /* ── Inflection branch card ─────────────────────────────────────────── */
    .flow-inflection-card {
      width: 140px;
  
      background-color: var(--paper, #fffff0);
      border: 0.5px dashed #a0a8b8;
      border-top-width: 3px;
      border-top-style: solid;
      
  
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      padding: 0.6rem 0.65rem 0.7rem;
  
      opacity: 0.75;
      transition:
        opacity 120ms ease,
        box-shadow 120ms ease;
    }
  
    .flow-inflection-card--hovered,
    .flow-inflection-card--selected {
      opacity: 1;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
    }
  
    /* Header row: label + risk badge */
    .infl-header {
      display: flex;
      flex-direction: row;
      align-items: flex-start;
      justify-content: space-between;
      gap: 0.25rem;
      padding-bottom: 0.35rem;
      border-bottom: 0.5px solid #d0d8e8;
    }
  
    .infl-label {
      font-size: 0.5rem;
      color: #4a5568;
      letter-spacing: 0.09em;
      line-height: 1.3;
    }
  
    .infl-risk-badge {
      display: inline-flex;
      align-items: center;
      gap: 2px;
      font-size: 0.48rem;
      font-weight: 700;
      letter-spacing: 0.07em;
      text-transform: uppercase;
      border: 1px solid;
      border-radius: 3px;
      padding: 1px 4px;
      white-space: nowrap;
      flex-shrink: 0;
    }
  
    /* Description */
    .infl-description {
      font-size: 0.62rem;
      line-height: 1.45;
      color: #4a5568;
      margin: 0;
    }
  
    /* Paths */
    .infl-paths {
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
    }
  
    .infl-path {
      display: flex;
      flex-direction: row;
      align-items: flex-start;
      gap: 0.3rem;
      padding: 0.35rem 0.4rem;
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
      margin-top: 1px;
    }
  
    .infl-path--positive .infl-path-icon { color: #28b798; }
    .infl-path--negative .infl-path-icon { color: #C0392B; }
  
    .infl-path-body {
      display: flex;
      flex-direction: column;
      gap: 0.15rem;
    }
  
    .infl-path-label {
      font-size: 0.62rem;
      line-height: 1.2;
    }
  
    .infl-path-outcome {
      font-size: 0.58rem;
      line-height: 1.4;
      color: #5a6070;
    }
  
    .infl-path-driver {
      font-size: 0.52rem;
      color: #8090a8;
      font-style: italic;
      margin-top: 0.1rem;
    }
  
    /* Sponsor opportunity */
    .infl-opportunity {
      display: flex;
      flex-direction: row;
      align-items: flex-start;
      gap: 0.3rem;
      padding: 0.35rem 0.4rem;
      background-color: rgba(63, 115, 255, 0.06);
      border-left: 2px solid #3f73ff;
      border-radius: 3px;
    }
  
    .infl-opportunity-icon {
      color: #3f73ff;
      flex-shrink: 0;
      margin-top: 1px;
    }
  
    .infl-opportunity .text-body-sm {
      font-size: 0.58rem;
      line-height: 1.4;
      color: #3a4a6a;
    }
  
    /* Data needed */
    .infl-data-needed {
      display: flex;
      flex-direction: column;
      gap: 0.1rem;
      padding-top: 0.25rem;
      border-top: 0.5px solid #d0d8e8;
    }
  
    .infl-data-needed .text-body-sm {
      font-size: 0.58rem;
      line-height: 1.4;
    }
  
    /* Empty fallback */
    .infl-empty {
      color: #a0a8b8;
      font-size: 0.58rem;
      font-style: italic;
    }
  </style>