<script>
  import { valueToY, stepToX, totalWidth } from './journeyConfig.js';
  import { hoveredIndex, selectedIndex } from './journeyStore.js';

  /** The full journey data array */
  export let data = [];

  /** The key to read from each data object e.g. "emotional_state" */
  export let metricKey = '';

  /** Stroke color for this line — ignored when useGradient is true */
  export let color = '#ffffff';

  /** Optional label for debugging / accessibility */
  export let label = '';

  /** Resting opacity for non-active segments */
  export let opacity = 0.9;

  /**
   * When true, ignores `color` and paints the line with a per-step gradient
   * running red (−5) → yellow (0) → green (+5) along the x-axis.
   */
  export let useGradient = false;

  // ── Unique gradient id so multiple instances don't collide ──────────────
  const gradientId = `line-gradient-${metricKey}`;

  // ── Segment geometry ─────────────────────────────────────────────────────
  $: segments = data.slice(0, -1).map((d, i) => ({
    x1: stepToX(i),
    y1: valueToY(d[metricKey]),
    x2: stepToX(i + 1),
    y2: valueToY(data[i + 1][metricKey]),
    indexA: i,
    indexB: i + 1,
  }));

  // ── Gradient stops — one per data point, positioned by x percentage ──────
  $: svgWidth = totalWidth(data.length);

  $: gradientStops = data.map((d, i) => ({
    offset: svgWidth > 0 ? (stepToX(i) / svgWidth) * 100 : 0,
    color:  valueToGradientColor(parseFloat(d[metricKey])),
  }));

  /**
   * Maps a −5…+5 value to a color:
   *   -5  → #F9564E  (bright red)
   *    0  → #F4D35E  (warm yellow)
   *   +5  → #44BBA4  (bright green)
   */
  function valueToGradientColor(val) {
    const n = Math.max(-5, Math.min(5, val));
    if (n < 0) {
      // red → yellow
      const t = (n + 5) / 5;
      const r = Math.round(249 + (244 - 249) * t);
      const g = Math.round(86  + (211 - 86)  * t);
      const b = Math.round(78  + (94  - 78)  * t);
      return `rgb(${r},${g},${b})`;
    } else {
      // yellow → green
      const t = n / 5;
      const r = Math.round(244 + (68  - 244) * t);
      const g = Math.round(211 + (187 - 211) * t);
      const b = Math.round(94  + (164 - 94)  * t);
      return `rgb(${r},${g},${b})`;
    }
  }
</script>

{#if segments.length}
  <g class="journey-line" aria-label={label}>

    <!-- Gradient definition — only rendered when useGradient is true -->
    {#if useGradient}
      <defs>
        <linearGradient
        id={gradientId}
        gradientUnits="userSpaceOnUse"
        x1={stepToX(0)}
        y1="0"
        x2={stepToX(data.length - 1)}
        y2="0"
      >
          {#each gradientStops as stop}
            <stop offset="{stop.offset}%" stop-color={stop.color} />
          {/each}
        </linearGradient>
      </defs>
    {/if}

    {#each segments as seg}
      {@const active    = $hoveredIndex === seg.indexA || $hoveredIndex === seg.indexB ||
                          $selectedIndex === seg.indexA || $selectedIndex === seg.indexB}
      {@const anyActive = $hoveredIndex >= 0 || $selectedIndex >= 0}
      {@const stroke    = useGradient ? `url(#${gradientId})` : color}

   
      <!-- Main line -->
      <line
        x1={seg.x1} y1={seg.y1}
        x2={seg.x2} y2={seg.y2}
        stroke={stroke}
        stroke-width="1.25"
        stroke-linecap="round"
        opacity={active ? opacity : anyActive ? 0.18 : opacity}
      />
    {/each}

  </g>
{/if}