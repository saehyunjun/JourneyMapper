<script>
  import {
    STEP_WIDTH,
    LEFT_AXIS_WIDTH,
    GRID_HEIGHT,
    TOP_PADDING,
    SVG_HEIGHT,
    valueToY,
    stepToX,
    totalWidth,
    buildStageColorMap,
  } from './journeyConfig.js';
  import { hoveredIndex, selectedIndex, zoomedIndex } from './journeyStore.js';
  import { createEventDispatcher } from 'svelte';

  /** Journey step data array */
  export let data = [];

  /**
   * Metric definitions — each item: { key, color, label }
   * Matches the shape from journeyPersonas.json metrics array.
   */
  export let metrics = [];

  // ── Bar layout ────────────────────────────────────────────────────────────
  // Leave a small gutter on each side of the column so bars don't crowd dividers
  const COL_GUTTER   = 24; // px total inset per column (split left/right)
  const BAR_GAP      = 24;  // px gap between bars within a group

  /**
   * Given the number of metrics and the step column width, compute the width
   * of a single bar so the whole group fits within the column minus gutters.
   * @param {number} n
   * @returns {number}
   */
  function barWidth(n) {
    if (n === 0) return 0;
    const usable = STEP_WIDTH - COL_GUTTER;
    return Math.max(2, (usable - BAR_GAP * (n - 1)) / n);
  }

  /**
   * X origin of the leftmost bar in a group, so the group is centred on stepToX(i).
   * @param {number} i   step index
   * @param {number} n   number of metrics
   */
  function groupStartX(i, n) {
    const groupW = barWidth(n) * n + BAR_GAP * (n - 1);
    return stepToX(i) - groupW / 2;
  }

  const zeroY = valueToY(0); // pixel y-position of the zero baseline

  /**
   * Compute the SVG rect attrs for a single metric bar at a given step.
   * Returns { x, y, width, height } — ready to spread onto <rect>.
   *
   * @param {number} i    step index
   * @param {number} mi   metric index within the group
   * @param {number} val  raw metric value
   * @param {number} n    total number of metrics
   */
  function barRect(i, mi, val, n) {
    const bw = barWidth(n);
    const x  = groupStartX(i, n) + mi * (bw + BAR_GAP);
    const y  = valueToY(val);
    return {
      x,
      y:      Math.min(y, zeroY),
      width:  bw,
      height: Math.abs(zeroY - y),
    };
  }

  $: n             = metrics.length;
  $: width         = totalWidth(data.length);
  $: stageColorMap = buildStageColorMap(data);

  const dispatch = createEventDispatcher();

  function handleColumnClick(i) {
    if ($zoomedIndex === i) {
      dispatch('openDrawer', { index: i });
    } else {
      zoomedIndex.set(i);
      selectedIndex.set(i);
    }
  }
</script>

<!--
  ourneyIndexBars
  ─────────────────────────────────────────────────────────────────────────────
  Grouped vertical bar chart for journey index metrics.
  Uses the same SVG dimensions as JourneyGrid so it can sit flush in the
  shared-scroll flow alongside JourneySentiment and JourneyIndex.
-->
<svg
  {width}
  height={SVG_HEIGHT}
  class="journey-svg journey-bars-svg"
  overflow="visible"
  aria-label="Journey index bar chart"
>

  <!-- ── Per-column stage color bands ──────────────────────────────────── -->
  {#each data as d, i}
    {#if stageColorMap[d.stage_id]}
      <rect
        x={LEFT_AXIS_WIDTH + i * STEP_WIDTH} y={TOP_PADDING}
        width={STEP_WIDTH}
        height={GRID_HEIGHT}
        fill={stageColorMap[d.stage_id]}
        opacity="0"
        pointer-events="none"
      />
    {/if}
  {/each}

  <!-- ── Column hover / selection highlights ───────────────────────────── -->
  {#each data as _d, i}
    {#if $selectedIndex === i}
      <rect
        x={LEFT_AXIS_WIDTH + i * STEP_WIDTH} y={TOP_PADDING}
        width={STEP_WIDTH} height={GRID_HEIGHT}
        fill="var(--accent, #C4956A)" opacity="0.10"
        pointer-events="none"
      />
    {:else if $hoveredIndex === i}
      <rect
        x={LEFT_AXIS_WIDTH + i * STEP_WIDTH} y={TOP_PADDING}
        width={STEP_WIDTH} height={GRID_HEIGHT}
        fill="var(--accent, #C4956A)" opacity="0.05"
        pointer-events="none"
      />
    {/if}
  {/each}

  <!-- ── Horizontal grid lines ─────────────────────────────────────────── -->
  {#each [-4, -3, -2, -1, 0, 1, 2, 3, 4] as rowVal}
    {@const y      = valueToY(rowVal)}
    {@const isZero = rowVal === 0}
    <line
      x1={LEFT_AXIS_WIDTH} y1={y} x2={width} y2={y}
      stroke={isZero ? '#5E5A5B' : '#D6D6D6'}
      stroke-width={isZero ? 1 : 0.725}
      pointer-events="none"
    />
  {/each}

  <!-- ── Vertical column dividers ──────────────────────────────────────── -->
  {#each data as _d, i}
    {@const isHovered = $hoveredIndex === i}
    <line
      x1={LEFT_AXIS_WIDTH + i * STEP_WIDTH} y1={TOP_PADDING}
      x2={LEFT_AXIS_WIDTH + i * STEP_WIDTH} y2={TOP_PADDING + GRID_HEIGHT}
      stroke={isHovered ? '#F9564E' : '#CACCB7'}
      stroke-width={isHovered ? 2 : 1}
      opacity={isHovered ? 0.85 : 1}
      pointer-events="none"
    />
  {/each}
  <!-- Right edge -->
  <line
    x1={width} y1={TOP_PADDING}
    x2={width} y2={TOP_PADDING + GRID_HEIGHT}
    stroke="#DFC3A8" stroke-width="1.25"
    pointer-events="none"
  />

  <!-- ── Metric bars ────────────────────────────────────────────────────── -->
  {#each data as d, i}
    {#each metrics as m, mi}
      {@const val  = parseFloat(d[m.key])}
      {@const rect = barRect(i, mi, val, n)}
      {@const isActive = $hoveredIndex === i || $selectedIndex === i}

      <!-- Bar fill -->
      <rect
        x={rect.x}
        y={rect.y}
        width={rect.width}
        height={rect.height}
        fill={m.color}
        opacity={isActive ? 0.88 : 0.15}
        pointer-events="none"
      />

      <!-- Top cap line (improves readability at small heights) -->
      {#if rect.height > 2}
        <line
          x1={rect.x}
          y1={rect.y}
          x2={rect.x + rect.width}
          y2={rect.y}
          stroke={m.color}
          stroke-width="1.5"
          opacity={isActive ? 1 : 0.325}
          pointer-events="none"
        />
      {/if}

      <!-- Value label: only show on hover/select for cleanliness -->
      {#if isActive && rect.height > 10}
        {@const labelY = val >= 0 ? rect.y - 3 : rect.y + rect.height + 9}
        <text
          x={rect.x + rect.width / 2}
          y={labelY}
          text-anchor="middle"
          class="label-sm"
          fill={m.color}
          pointer-events="none"
        >
          {val > 0 ? '+' : ''}{val}
    </text>
      {/if}
    {/each}
  {/each}

  <!-- ── Left axis gutter (white mask over bar overflow) ───────────────── -->
  <rect
    x="0" y="0"
    width={LEFT_AXIS_WIDTH} height={SVG_HEIGHT}
    fill="#fff"
    pointer-events="none"
  />


  <!-- ── Full-column hit areas ─────────────────────────────────────────── -->
  {#each data as _d, i}
    <rect
      x={LEFT_AXIS_WIDTH + i * STEP_WIDTH} y={TOP_PADDING}
      width={STEP_WIDTH} height={GRID_HEIGHT}
      fill="transparent"
      style="cursor: pointer;"
      on:mouseenter={() => hoveredIndex.set(i)}
      on:mouseleave={() => hoveredIndex.set(-1)}
      on:click={() => handleColumnClick(i)}></rect>
  {/each}

</svg>

<style>

</style>