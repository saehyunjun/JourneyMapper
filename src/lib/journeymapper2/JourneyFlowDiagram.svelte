<script>
  import { buildStageColorMap } from './journeyConfig.js';
  import FlowStageCard from './FlowStageCard.svelte';
  import InterventionPalette from './JourneyInterventions/InterventionPalette.svelte';
  import FlowSentimentHUD from './FlowSentimentHUD.svelte';
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

    <div class="flow-step-slot">    
    <div class="flow-diagram-col" bind:this={flowColEl}>
      {#each stageGroups as group, gi}
            <span
              class="label-sm"
            >
              {group.stage}
            </span>
          <div class="flex flex-col items-start justify-baseline">
            <FlowStageCard
              {group}
              {data}
              stageColor={stageColorMap[group.stage_id]}
              layout="vertical"
              hideHeader
            />
          </div>
        {/each}
      </div>
    </div>
    <InterventionPalette />
  </div>

  <FlowSentimentHUD {data} scrollRef={flowColEl} />
</div>

<style>
  .flow-diagram-scroll {
    overflow-x: visible;
    overflow-y: auto;
    display: flex;
    flex-direction: row;
    align-items: stretch;
    justify-content: flex-start;
    z-index: 79;
  }

  /* ── VERTICAL LAYOUT ───────────────────────────────────────────────── */
  .flow-diagram-col {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-width: 0;
  }

</style>