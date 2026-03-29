<script>
  export let inflectionStep;
</script>

<div class="story-screen">
  <div class="content-wrap">
    <div class="jm-kicker">Experience</div>

    <div class="toolbar-sm-empty">
      <span class="label-sm">
        {inflectionStep.stage} · {inflectionStep.step}
      </span>
    </div>

    {#if inflectionStep.narrative_description}
      <p class="text-body-sm">{inflectionStep.narrative_description}</p>
    {/if}

    <div class="metrics-grid">
      {#if inflectionStep.provider_trust != null}
        <div class="metric-tile">
          <span class="label-sm">Provider Trust</span>
          <span class="label">
            {inflectionStep.provider_trust}
          </span>
        </div>
      {/if}
    </div>
  </div>
</div>