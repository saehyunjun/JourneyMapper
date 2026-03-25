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
              color: {stageColorMap[group.stage_id]};
            "
          >
            <span class="stage-rail-text-rotated label-sm">
              {group.stage}
            </span>
          </div>
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
    align-items: middle;
    gap: 0.25rem;
    width: max-content;
  }

  /* ── VERTICAL: column of stage rows ──────────────────────────────────── */
  .flow-diagram-col {
    display: flex;
    flex-direction: column;
    min-width: 30vw;
    align-items: center;
    width: 100%;
  }

  /* One horizontal band per stage — stretches to the height of its steps */
  .stage-row {
    display: flex;
    flex-direction: row;
    min-height: 20vh;
    align-items: center;
    gap: 0.75rem;
    width: 100%;
  }

  /* Left rail: stage pill pinned to top + connector filling remaining height */
  .stage-rail {
    display: flex;
    flex-direction: column;
    align-items: center;
    flex-shrink: 0;
    width: 7rem;
    padding-top: 0.75rem;
  }
  .stage-rail-label {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  overflow: hidden; /* critical */
}

.stage-rail-text-rotated {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%) rotate(-90deg);
  transform-origin: center;
  white-space: nowrap;
}

  /* Step cards area — centered, scrolls horizontally if a stage has many steps */
  .stage-steps-row {
    flex: 1;
    display: flex;
    align-items: center;
    overflow-x: auto;
  }
</style>