<script>
  export let states = [];
</script>

<div class="story-screen">
  <div class="content-wrap gap-4">

    <h2 class="heading-serif-md">Current State</h2>

    {#each states as s}
      <div>
        <div class="jm-content-row">
          <span class="text-body-sm">{s.label}</span>
          <span class="label-sm">{s.value}</span>
        </div>

        <div class="sentiment-track">
          <div
            class="sentiment-fill"
            style="width:{((s.value + 5)/10)*100}%; background:{s.color ?? 'var(--grayblue)'}">
          </div>
        </div>
      </div>
    {/each}

  </div>
</div>