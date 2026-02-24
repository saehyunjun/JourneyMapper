<script>
  import {
    ROW_VALUES,
    GRID_HEIGHT,
    STEP_WIDTH,
    LEFT_AXIS_WIDTH,
    TOP_PADDING,
    SVG_HEIGHT,
    valueToY,
    stepToX,
    totalWidth,
    buildStageColorMap,
  } from './journeyConfig.js';
  
  import { hoveredIndex, selectedIndex } from './journeyStore.js';

  export let data = [];
  $: stageColorMap = buildStageColorMap(data);

  /**
   * Metric definitions — same array used by JourneyLine/JourneyNodes on the page.
   * When provided, the grid renders the sentiment line at full opacity and dims
   * the metric lines at rest, restoring them when any column is hovered/selected.
   */
  export let metrics = [];

  $: width = totalWidth(data.length);

  // ── Sentiment line points ────────────────────────────────────────────────
  $: sentimentPoints = data
    .map((d, i) => `${stepToX(i)},${valueToY(d.sentiment)}`)
    .join(' ');

  // ── Per-metric polyline points ───────────────────────────────────────────
  $: metricPolylines = metrics.map(m => ({
    ...m,
    points: data.map((d, i) => `${stepToX(i)},${valueToY(d[m.key])}`).join(' '),
  }));

  // Dim metrics at rest; restore on any column interaction
  $: anyActive = $hoveredIndex >= 0 || $selectedIndex >= 0;
</script>


<div class = "header">
  <span class="heading h3 h-small text-blue">
    Journey Index
  </span>
  </div>
<svg
  width={width}
  height={SVG_HEIGHT}
  class="journey-svg"
  overflow="visible"
>
  <!-- ── Per-column stage color bands (0.6 opacity) ─────────────────────── -->
  {#each data as d, i}
    {#if stageColorMap[d.stage_id]}
      <rect
        x={LEFT_AXIS_WIDTH + i * STEP_WIDTH} y={TOP_PADDING}
        width={STEP_WIDTH} height={GRID_HEIGHT}
        fill={stageColorMap[d.stage_id]}
        opacity="0.125"
        pointer-events="none"
      />
    {/if}
  {/each}

  <!-- ── Column highlight bands ──────────────────────────────────────────── -->
  {#each data as _d, i}
    {#if $selectedIndex === i}
      <rect
        x={LEFT_AXIS_WIDTH + i * STEP_WIDTH} y={TOP_PADDING}
        width={STEP_WIDTH} height={GRID_HEIGHT}
        fill="#C4956A" opacity="0.12" pointer-events="none"
      />
    {/if}
    {#if $hoveredIndex === i}
      <rect
        x={LEFT_AXIS_WIDTH + i * STEP_WIDTH} y={TOP_PADDING}
        width={STEP_WIDTH} height={GRID_HEIGHT}
        fill="#C4956A" opacity="0.06" pointer-events="none"
      />
    {/if}
  {/each}

  <!-- ── Horizontal grid lines + axis labels ─────────────────────────────── -->
  {#each ROW_VALUES as rowVal}
    {@const y      = valueToY(rowVal)}
    {@const isZero = rowVal === 0}

    <line
      x1={LEFT_AXIS_WIDTH} y1={y}
      x2={width}           y2={y}
      stroke={isZero ? "#A08060" : "#DFC3A8"}
      stroke-width={isZero ? 2.275 : 0.75}
      stroke-dasharray={isZero ? undefined : "4 4"}
      pointer-events="none"
    />

    <text
      x={LEFT_AXIS_WIDTH - 6} y={y + 4}
      text-anchor="end"
      class="label-bold"
      fill={isZero ? "#141413" : "#BFA080"}
      pointer-events="none"
    >{rowVal}</text>
  {/each}

  <!-- ── Vertical column dividers ──────────────────────────────────────── -->
  {#each data as _step, i}
    {@const isActive = $hoveredIndex === i || $selectedIndex === i}
    <line
      x1={LEFT_AXIS_WIDTH + i * STEP_WIDTH} y1={TOP_PADDING}
      x2={LEFT_AXIS_WIDTH + i * STEP_WIDTH} y2={TOP_PADDING + GRID_HEIGHT}
      stroke={isActive ? "#F9564E" : "#c9c4c4"}
      stroke-width={isActive ? 3 : 0.75}
      opacity={isActive ? 1 : .825}
      pointer-events="none"
    />
  {/each}
  <!-- Right edge -->
  <line
    x1={width} y1={TOP_PADDING}
    x2={width} y2={TOP_PADDING + GRID_HEIGHT}
    stroke="#c9c4c4" stroke-width="1.5" pointer-events="none"
/>

  <!-- ── Slot: lines, nodes, callouts ────────────────────────────────────── -->
  <slot />

  <!-- ── Full-column hit areas ─────────────────────────────────────────── -->
  {#each data as _d, i}
    <rect
      x={LEFT_AXIS_WIDTH + i * STEP_WIDTH} y={TOP_PADDING}
      width={STEP_WIDTH} height={GRID_HEIGHT}
      fill="transparent"
      style="cursor: pointer;"
      on:mouseenter={() => hoveredIndex.set(i)}
      on:mouseleave={() => hoveredIndex.set(-1)}
      on:click={() => selectedIndex.set($selectedIndex === i ? -1 : i)}
    />
  {/each}

</svg>

<style>
  .journey-svg {
    display: block;
    background: #F4EFE5;
  }

</style>