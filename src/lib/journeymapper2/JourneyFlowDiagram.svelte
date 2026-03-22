<script>
  import { buildStageColorMap } from './journeyConfig.js';
  import FlowStageCard from './FlowStageCard.svelte';
  import FlowConnector from './FlowConnector.svelte';

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

  /**
   * 'horizontal' (default) — stages left→right, steps below each stage header
   * 'vertical'             — stage labels on the left rail, steps in rows per stage
   */
  export let layout = 'horizontal';
  $: isVertical = layout === 'vertical';
</script>

<!-- ── Flow diagram ──────────────────────────────────────────────────────── -->
<div
  class="flow-diagram-scroll shared-scroll"
  class:flow-diagram-scroll--vertical={isVertical}
  role="region"
  aria-label="Journey flow diagram"
>

  <!-- ═══════════════════════════════════════════════════════════════════
       HORIZONTAL (default) — stages side-by-side, steps below each header
  ════════════════════════════════════════════════════════════════════ -->
  {#if !isVertical}
    <div class="flow-diagram-row">
      {#each stageGroups as group, gi}

        <FlowStageCard
          {group}
          {data}
          stageColor={stageColorMap[group.stage_id]}
          {layout}
        />

        {#if gi < stageGroups.length - 1}
          <FlowConnector variant="stage" />
        {/if}

      {/each}
    </div>

  <!-- ═══════════════════════════════════════════════════════════════════
       VERTICAL — left rail has stage label pills, steps flow right per row
  ════════════════════════════════════════════════════════════════════ -->
  {:else}
    <div class="flow-diagram-col">
      {#each stageGroups as group, gi}

        <div class="stage-row">

          <!-- Left rail: colored stage pill + vertical connector below -->
          <div class="stage-rail">
            <div
              class="stage-rail-label"
              style="
                background: {stageColorMap[group.stage_id]}22;
                border-color: {stageColorMap[group.stage_id]}88;
                color: {stageColorMap[group.stage_id]};
              "
            >
              <span class="stage-rail-text">{group.stage}</span>
            </div>

            {#if gi < stageGroups.length - 1}
              <div class="rail-connector">
                <FlowConnector variant="stage-vertical" />
              </div>
            {/if}
          </div>

          <!-- Right: step cards for this stage, scrollable if needed -->
          <div class="stage-steps-row">
            <FlowStageCard
              {group}
              {data}
              stageColor={stageColorMap[group.stage_id]}
              {layout}
              hideHeader
            />
          </div>

        </div>

      {/each}
    </div>
  {/if}

</div>

<style>
  /* ── Scroll wrapper ───────────────────────────────────────────────────── */
  .flow-diagram-scroll {
    overflow-x: auto;
    overflow-y: visible;
    padding: 1rem 1.25rem 1.25rem;
  }

  .flow-diagram-scroll--vertical {
    overflow-x: visible;
    overflow-y: auto;
  }

  /* ── HORIZONTAL: top row of stage groups ─────────────────────────────── */
  .flow-diagram-row {
    display: flex;
    flex-direction: row;
    align-items: flex-start;
    gap: 0.25rem;
    width: max-content;
  }

  /* ── VERTICAL: column of stage rows ──────────────────────────────────── */
  .flow-diagram-col {
    display: flex;
    flex-direction: column;
    width: 100%;
  }

  /* One horizontal band per stage */
  .stage-row {
    display: flex;
    flex-direction: row;
    align-items: flex-start;
    gap: 0.75rem;
    width: 100%;
  }

  /* Left rail: stage pill + connector */
  .stage-rail {
    display: flex;
    flex-direction: column;
    align-items: center;
    flex-shrink: 0;
    width: 7rem;
    padding-top: 0.25rem;
  }

  .stage-rail-label {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    padding: 0.4rem 0.5rem;
    border: 1px solid;
    border-radius: 4px;
    text-align: center;
  }

  .stage-rail-text {
    font-family: var(--font-mono);
    font-size: 0.6rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    line-height: 1.3;
    word-break: break-word;
  }

  /* Vertical connector between stage rail pills */
  .rail-connector {
    flex: 1;
    display: flex;
    align-items: stretch;
    justify-content: center;
    min-height: 1rem;
    padding: 0.1rem 0;
  }

  /* Step cards area — scrolls horizontally if a stage has many steps */
  .stage-steps-row {
    flex: 1;
    overflow-x: auto;
    padding-bottom: 0.75rem;
  }
</style>