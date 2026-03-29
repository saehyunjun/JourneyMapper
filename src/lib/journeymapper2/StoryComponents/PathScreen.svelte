<script>
  export let paths = [];
  export let direction = 'positive';

  $: filtered = paths?.filter(p => p.direction === direction) ?? [];
</script>

<div class="story-screen path-screen">
  <div class="path-wrap">
    {#each filtered as path}
      <div class={`path-card ${direction === 'positive' ? 'path-card--pos' : 'path-card--neg'}`}>
        {#if path.label}
          <span class="label-sm uppercase">{path.label}</span>
        {/if}

        {#if path.outcome}
          <p class="text-body-sm">{path.outcome}</p>
        {/if}
      </div>
    {/each}
  </div>
</div>