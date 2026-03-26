<script>
  /** Array of { label, value, minLabel, maxLabel } — value is 0–1 */
  export let states = [];

  const STATE_BAR_COLORS = [
    '#5B8DB8', '#7CB98A', '#C47E5A', '#9B7EC8', '#C4A84F', '#5BADA8',
  ];
  const stateBarColor = (i) => STATE_BAR_COLORS[i % STATE_BAR_COLORS.length];
</script>

{#if states.length}
  <div class="flex flex-col gap-4">
    {#each states as s, i}
      {@const color = stateBarColor(i)}
      {@const leansMax = s.value > 0.5}
      {@const leansMin = s.value < 0.5}
      <div class="flex flex-col gap-1">
        <span class="label-sm">{s.label}</span>
        <div class="state-track">
          <div class="state-fill" style="width:{s.value * 100}%;background:{color}" />
        </div>
        <div class="flex justify-between">
          <span
            class="label-lg"
            style="font-size:0.5rem;{leansMin ? `opacity:1;font-weight:700;color:${color}` : 'opacity:0.45'}"
          >{s.minLabel}</span>
          <span
            class="label-lg"
            style="font-size:0.5rem;{leansMax ? `opacity:1;font-weight:700;color:${color}` : 'opacity:0.45'}"
          >{s.maxLabel}</span>
        </div>
      </div>
    {/each}
  </div>
{/if}

<style>
  .state-track {
    height: 4px;
    border-radius: 2px;
    background: rgba(0, 0, 0, 0.1);
    overflow: hidden;
  }

  .state-fill {
    height: 100%;
    border-radius: 2px;
    transition: width 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  }
</style>