<script>
  import { buildStageColorMap } from './journeyConfig.js';
  import FlowStageCard from './FlowStageCard.svelte';
  import JourneyFlowSentimentRail from './FlowSentimentSidebar.svelte';

  /** @type {any[]} */
  export let data = [];

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

  /** Ref passed to the sentiment rail so it can measure step-slot positions. */
  let flowColEl;
</script>

<div class="body-dotted">
  <div  
    class="flow-diagram-scroll"
    role="region"
    aria-label="Journey flow diagram"
  >
    <div class="flow-diagram-col" bind:this={flowColEl}>
      {#each stageGroups as group, gi}
        <div class="stage-row"
        style="background-color:{stageColorMap[group.stage_id]}1A;">
          <div
            class="stage-rail"
            style="background-color:{stageColorMap[group.stage_id]};"
          >
            <span
              class="stage-rail-label label-sm"
            >
              {group.stage}
            </span>
          </div>

          <div class="stage-steps-area">
            <FlowStageCard
              {group}
              {data}
              stageColor={stageColorMap[group.stage_id]}
              layout="vertical"
              hideHeader
            />
          </div>
        </div>

      {/each}
    </div>

    <JourneyFlowSentimentRail
      {data}
      flowRef={flowColEl}
    />
  </div>
</div>

<style>
  .flow-diagram-scroll {
    overflow-x: visible;
    overflow-y: auto;
    display: flex;
    flex-direction: row;
    align-items: stretch;
    justify-content: flex-start;
    z-index: 999;
  }

  /* ── VERTICAL LAYOUT ───────────────────────────────────────────────── */
  .flow-diagram-col {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-width: 0;
  }

  .stage-row {
    display: flex;
    flex-direction: row;
    align-items: stretch;
    justify-content: flex-start;
    width: 100%;
    min-height: 8rem;
  }


  /* ── LEFT RAIL ─────────────────────────────────────────────────────── */
  .stage-rail {
    flex-shrink: 0;
    width: 2.5em;
    display: flex;
    align-items: center;
    justify-content: center;
    align-self: stretch;
  }

  .stage-rail-label {
    writing-mode: vertical-rl;
    transform: rotate(180deg);
    color: var(--paper);
    display: flex;
    align-items: center;
    justify-content: center;
    text-align: center;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-height: 100%;
    padding: 0.5rem 0;
  }

  /* ── STEPS AREA ────────────────────────────────────────────────────── */
  .stage-steps-area {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: rgba(255, 255, 255, 0.6);
  }
</style>