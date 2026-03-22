<script>
  import FlowStepCard  from './FlowStepCard.svelte';
  import FlowConnector from './FlowConnector.svelte';

  /** Stage group object: { stage_id, stage, steps[] } */
  export let group;

  /** Full journey data array — passed through to FlowStepCard */
  export let data = [];

  /** Accent color for this stage (hex) */
  export let stageColor = '#6b7280';

  /**
   * When true the stage header pill is hidden.
   * Used in vertical layout where the stage label lives in the left rail instead.
   */
  export let hideHeader = false;

  /**
   * Layout orientation forwarded from JourneyFlowDiagram.
   * 'horizontal' — step cards in a horizontal row (default)
   * 'vertical'   — step cards stacked top-to-bottom
   */
  export let layout = 'horizontal';

  $: isVertical = layout === 'vertical';
</script>

<div class="flow-stage" class:flow-stage--vertical={isVertical}>

  <!-- Stage header — hidden in vertical mode (label lives in the left rail) -->
  {#if !hideHeader}
    <div class="section-header" style="background-color:{stageColor};">
      <span class="label-heading" style="color:#fff">
        {group.stage}
      </span>
      <span class="flow-stage-count label-heading" style="color:rgba(255,255,255,0.65);">
        {group.stage_id}
      </span>
    </div>
  {/if}

  <!-- Steps — horizontal row or vertical column depending on layout -->
  <div class="flow-steps-row" class:flow-steps-col={isVertical}>
    {#each group.steps as step, si}

      <FlowStepCard {step} {data} {stageColor} {layout} />

      {#if si < group.steps.length - 1}
        <FlowConnector variant="step" {layout} />
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

  /* In vertical mode the outer container needs no extra gap —
     spacing is handled by the step cards and connectors themselves */
  .flow-stage--vertical {
    gap: 0;
  }

  .flow-stage-count { opacity: 0.8; }

  /* ── Horizontal: default row of step cards ───────────────────────────── */
  .flow-steps-row {
    display: flex;
    flex-direction: row;
    align-items: flex-start;  
    padding: 1em;
    gap: 1em;
  }

  /* ── Vertical: column of step cards ─────────────────────────────────── */
  .flow-steps-col {
    flex-direction: column;
    align-items: flex-start;
  }
</style>