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
</script>

<!-- ── Flow diagram ──────────────────────────────────────────────────────── -->
<div class="flow-diagram-scroll shared-scroll" role="region" aria-label="Journey flow diagram">

  <div class="flow-diagram-row">
    {#each stageGroups as group, gi}

      <FlowStageCard
        {group}
        {data}
        stageColor={stageColorMap[group.stage_id]}
      />

      {#if gi < stageGroups.length - 1}
        <FlowConnector variant="stage" />
      {/if}

    {/each}
  </div>

</div>

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
</style>