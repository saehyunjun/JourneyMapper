<script>
  import { buildStageColorMap } from './journeyConfig.js';
  import FlowStageCard from './FlowStageCard.svelte';
  import FlowConnector from './FlowConnector.svelte';

  /** @type {any[]} */
  export let data = [];

  export let layout = 'horizontal';

  $: isVertical = layout === 'vertical';

  // ── Stage groups ───────────────────────────────────────────────────────────
  $: stageGroups = (() => {
    /** @type {Map<string, { stage_id: string; stage: string; steps: { step: string; step_id: string; index: number }[] }>} */
    const map = new Map();

    data.forEach((d, i) => {
      if (!map.has(d.stage_id)) {
        map.set(d.stage_id, {
          stage_id: d.stage_id,
          stage: d.stage,
          steps: []
        });
      }

      map.get(d.stage_id).steps.push({
        step: d.step,
        step_id: d.step_id,
        index: i
      });
    });

    return [...map.values()];
  })();

  $: stageColorMap = buildStageColorMap(data);
</script>

<div class="body-dotted">
  <div
    class="flow-diagram-scroll shared-scroll"
    class:flow-diagram-scroll--vertical={isVertical}
    role="region"
    aria-label="Journey flow diagram"
  >
    {#if !isVertical}
      <!-- HORIZONTAL -->
      <div class="flow-diagram-row">
        {#each stageGroups as group, gi}
          <div class="flow-stage-shell">
            <FlowStageCard
              {group}
              {data}
              stageColor={stageColorMap[group.stage_id]}
              {layout}
            />
          </div>

          {#if gi < stageGroups.length - 1}
            <div class="flow-stage-connector flow-stage-connector--horizontal" aria-hidden="true">
              <FlowConnector variant="stage" {layout} />
            </div>
          {/if}
        {/each}
      </div>
    {:else}
      <!-- VERTICAL -->
      <div class="flow-diagram-col">
        {#each stageGroups as group, gi}
          <div class="stage-row">
            <div
              class="stage-rail"
              style="background-color:{stageColorMap[group.stage_id]}1A;"
            >
              <span
                class="stage-rail-label label-sm"
                style="color:{stageColorMap[group.stage_id]};"
              >
                {group.stage}
              </span>
            </div>

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

          {#if gi < stageGroups.length - 1}
            <div class="flow-stage-connector flow-stage-connector--vertical" aria-hidden="true">
              <FlowConnector variant="stage-vertical" {layout} />
            </div>
          {/if}
        {/each}
      </div>
    {/if}
  </div>
</div>

<style>
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

  /* ── HORIZONTAL LAYOUT ─────────────────────────────────────────────── */
  .flow-diagram-row {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: flex-start;
    width: max-content;
    min-width: 100%;
    gap: 0;
  }

  .flow-stage-shell {
    display: flex;
    align-items: center;
    justify-content: center;
    align-self: stretch;
  }

  .flow-stage-connector {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .flow-stage-connector--horizontal {
    align-self: stretch;
    min-width: 48px;
    padding-inline: 0.125rem;
  }

  /* ── VERTICAL LAYOUT ───────────────────────────────────────────────── */
  .flow-diagram-col {
    display: flex;
    flex-direction: column;
    width: 100%;
    min-width: 50vw;
    gap: 0;
  }

  .stage-row {
    display: flex;
    flex-direction: row;
    align-items: stretch;
    justify-content: flex-start;
    width: 100%;
    min-height: 8rem;
  }

  .flow-stage-connector--vertical {
    width: 100%;
    min-height: 44px;
    padding-block: 0.125rem;
  }

  /* ── LEFT RAIL ─────────────────────────────────────────────────────── */
  .stage-rail {
    flex-shrink: 0;
    width: 2rem;
    display: flex;
    align-items: center;
    justify-content: center;
    align-self: stretch;
  }

  .stage-rail-label {
    writing-mode: vertical-rl;
    transform: rotate(180deg);
    display: flex;
    align-items: center;
    justify-content: center;
    text-align: center;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-height: 100%;
    padding: 0.5rem 0;
    font-weight: 600;
    letter-spacing: 0.02em;
  }

  /* ── STEPS AREA ────────────────────────────────────────────────────── */
  .stage-steps-area {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 255, 255, 0.6);
  }
</style>