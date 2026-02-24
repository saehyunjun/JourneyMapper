<script>
  import { valueToY, stepToX } from './journeyConfig.js';
  import { hoveredIndex, selectedIndex } from './journeyStore.js';

  export let data      = [];
  export let metricKey = '';
  export let color     = '#ffffff';
  export let radius    = 4;
  /** Optional per-step Y offsets (pixels) to separate coincident nodes */
  export let offsets   = [];
  /** Resting opacity for non-active nodes */
  export let opacity   = 0.725;
</script>

<g class="journey-nodes" pointer-events="none">
  {#each data as d, i}
    {@const cx         = stepToX(i)}
    {@const baseY      = valueToY(d[metricKey])}
    {@const cy         = baseY + (offsets[i] ?? 0)}
    {@const isHovered  = $hoveredIndex  === i}
    {@const isSelected = $selectedIndex === i}
    {@const active     = isHovered || isSelected}
    {@const anyActive  = $hoveredIndex >= 0 || $selectedIndex >= 0}

    <!-- Inner filled dot -->
    <circle
      {cx} {cy}
      r={active ? radius * 1.75 : radius * 1}
      fill={color}
      opacity={active ? 0.95 : anyActive ? 0.18 : opacity}
    />
    <!-- Selected dotted outer ring -->
    {#if isSelected}
      <circle
        {cx} {cy}
        r={radius + 8}
        fill="none"
        stroke={color}
        stroke-width="1"
        opacity="0.35"
        stroke-dasharray="1 3"
      />
    {/if}
  {/each}
</g>