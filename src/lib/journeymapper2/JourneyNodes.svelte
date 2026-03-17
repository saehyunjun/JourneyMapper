<!-- JourneyNodes.svelte -->
<script>
import { valueToY, stepToX, STEP_WIDTH } from './journeyConfig.js';
import { hoveredIndex, selectedIndex } from './journeyStore.js';

  export let data      = [];
  export let metricKey = '';
  export let color     = '#ffffff';
  export let colorFn   = null;
  export let radius    = 6;
  export let offsets   = [];
  export let alignLeft = false;
  export let opacity   = 0.725;


  function resolveColor(val) {
    return colorFn ? colorFn(parseFloat(val)) : color;
  }

  function diamondPoints(cx, cy, s) {
    return `${cx},${cy - s} ${cx + s},${cy} ${cx},${cy + s} ${cx - s},${cy}`;
  }
</script>

<g class="journey-nodes" pointer-events="none">
  {#each data as d, i}
    {@const baseCx     = stepToX(i)}
    {@const cx         = alignLeft ? baseCx - STEP_WIDTH / 2 : baseCx}
    {@const baseY      = valueToY(d[metricKey])}
    {@const cy         = baseY + (offsets[i] ?? 0)}
    {@const isHovered  = $hoveredIndex  === i}
    {@const isSelected = $selectedIndex === i}
    {@const active     = isHovered || isSelected}
    {@const anyActive  = $hoveredIndex >= 0 || $selectedIndex >= 0}
    {@const nodeColor  = resolveColor(d[metricKey])}
    {@const nodeOpacity = active ? 0.95 : anyActive ? 0.18 : opacity}
    {@const baseSize   = active ? radius * 1.75 : radius * 1}

    {#if d.inflection === 'Y'}
      <polygon
        points={diamondPoints(cx, cy, baseSize * 1.85)}
        fill={nodeColor}
        opacity={nodeOpacity}
      />
      {#if isSelected}
        <polygon
          points={diamondPoints(cx, cy, radius + 10)}
          fill="none"
          stroke={nodeColor}
          stroke-width="1"
          opacity="0.75"
          stroke-dasharray="2 3"
        />
      {/if}
    {:else}
      <circle
        {cx} {cy}
        r={baseSize}
        fill={nodeColor}
        opacity={nodeOpacity}
      />
      {#if isSelected}
        <circle
          {cx} {cy}
          r={radius + 8}
          fill="none"
          stroke={nodeColor}
          stroke-width="1"
          opacity="0.35"
          stroke-dasharray="1 3"
        />
      {/if}
    {/if}
  {/each}
</g>