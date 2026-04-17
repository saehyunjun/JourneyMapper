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
   * 'vertical'             — stage header band per row, steps below
   */
  export let layout = 'horizontal';
  $: isVertical = layout === 'vertical';
</script>

<!-- ── Flow diagram ──────────────────────────────────────────────────────── -->
<div class="body-dotted">
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
       VERTICAL — left rail with rotated stage label, steps to the right
  ════════════════════════════════════════════════════════════════════ -->
  {:else}
    <div class="flow-diagram-col">
      {#each stageGroups as group, gi}

        <div class="stage-row">

          <!-- Left rail: colored bar + rotated stage name, stretches to row height -->
          <div
            class="stage-rail"
            style="background-color: {stageColorMap[group.stage_id]}1A;"
          >
            <span
              class="stage-rail-label label-sm"
              style="color: {stageColorMap[group.stage_id]};"
            >
              {group.stage}
            </span>
          </div>

          <!-- Step cards for this stage -->
          <div class="stage-steps-area">
            <FlowStageCard
              {group}
              {data}
              stageColor={stageColorMap[group.stage_id]}
              {layout}
              hideHeader
            />
          </div>

        </div>

        <!-- Inter-stage connector -->
        {#if gi < stageGroups.length - 1}
        <FlowConnector variant={isVertical ? 'stage-vertical' : 'stage'} />
        {/if}

      {/each}
    </div>
  {/if}

</div>
</div>

<style>
  /* ── Scroll wrapper ───────────────────────────────────────────────────── */
  .flow-diagram-scroll {
    overflow-x: auto;
    overflow-y: visible;
    z-index: 999;
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
    height: max-content;
    gap: 0.25rem;
  }

  /* ── VERTICAL: column of stage rows ──────────────────────────────────── */
  .flow-diagram-col {
    display: flex;
    flex-direction: column;
    min-width: 50vw;
    width: 100%;
    gap: 0.5rem;
  }

  /* One row per stage: left rail + steps to the right */
  .stage-row {
    display: flex;
    flex-direction: row;
    align-content: center;
    width: 100%;
    min-height: 8rem;
  }

  /* Left rail: fixed width, stretches to full row height via align-items: stretch */
  .stage-rail {
    flex-shrink: 0;
    width: 2rem;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  /* Rotated stage name — writing-mode keeps it upright and centered */
  .stage-rail-label {
    writing-mode: vertical-rl;
    transform: rotate(180deg);
    text-align: center;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-height: 100%;
    padding: 0.5rem 0;
    font-weight: 600;
    letter-spacing: 0.02em;
  }

  /* Steps area to the right of the rail */
  .stage-steps-area {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    min-width: 0;
    background: rgba(255, 255, 255, 0.6);
  }
</style>