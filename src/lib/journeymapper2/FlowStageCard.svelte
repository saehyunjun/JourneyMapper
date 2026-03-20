<script>
  import FlowStepCard  from './FlowStepCard.svelte';
  import FlowConnector from './FlowConnector.svelte';

  /** Stage group object: { stage_id, stage, steps[] } */
  export let group;

  /** Full journey data array — passed through to FlowStepCard */
  export let data = [];

  /** Accent color for this stage (hex) */
  export let stageColor = '#6b7280';
</script>

<div class="flow-stage">

  <!-- Stage header -->
  <div class="section-header" style="background-color:{stageColor};">
    <span class="label-heading" style="color:#fff; letter-spacing:0.08em;">
      {group.stage}
    </span>
    <span class="flow-stage-count label-heading" style="color:rgba(255,255,255,0.65);">
      {group.steps.length}
    </span>
  </div>

  <!-- Steps row -->
  <div class="flow-steps-row">
    {#each group.steps as step, si}

      <FlowStepCard {step} {data} {stageColor} />

      {#if si < group.steps.length - 1}
        <FlowConnector variant="step" />
      {/if}

    {/each}
  </div>

</div>

<style>
  .flow-stage {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }


  .flow-stage-count { opacity: 0.8; }

  .flow-steps-row {
    display: flex;
    flex-direction: row;
    align-items: flex-start;
    gap: 0;
  }
</style>