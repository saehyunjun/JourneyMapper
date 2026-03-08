<script>
  import { valueToY, stepToX } from './journeyConfig.js';
  import { hoveredIndex, selectedIndex } from './journeyStore.js';

  export let data      = [];
  export let metricKey = '';
  /** Static color string — used when colorFn is not provided */
  export let color     = '#ffffff';
  /** Optional per-value color function (val: number) => string */
  export let colorFn   = null;
  export let radius    = 6;
  /** Optional per-step Y offsets (pixels) to separate coincident nodes */
  export let offsets   = [];
  /** Resting opacity for non-active nodes */
  export let opacity   = 0.725;

  /** Resolve color for a given data value */
  function resolveColor(val) {
    return colorFn ? colorFn(parseFloat(val)) : color;
  }

  /** Diamond polygon points centered on (cx, cy) with half-size s */
  function diamondPoints(cx, cy, s) {
    return `${cx},${cy - s} ${cx + s},${cy} ${cx},${cy + s} ${cx - s},${cy}`;
  }
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
    {@const nodeColor  = resolveColor(d[metricKey])}
    {@const nodeOpacity = active ? 0.95 : anyActive ? 0.18 : opacity}
    {@const baseSize   = active ? radius * 1.75 : radius * 1}

    {#if d.inflection === 'Y'}
      <!-- Diamond node for inflection steps -->
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
      <!-- Standard circle node -->
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