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
  } from './journeyConfig.js';
  import { hoveredIndex, selectedIndex, zoomedIndex } from './journeyStore.js';
  import { createEventDispatcher } from 'svelte';

  const dispatch = createEventDispatcher();

  export let data = [];
  export let stageColorMap = {};
  export let metrics = [];

  $: width = totalWidth(data.length);

  $: sentimentPoints = data
    .map((d, i) => `${stepToX(i)},${valueToY(d.sentiment)}`)
    .join(' ');

  $: metricPolylines = metrics.map(m => ({
    ...m,
    points: data.map((d, i) => `${stepToX(i)},${valueToY(d[m.key])}`).join(' '),
  }));

  $: anyActive = $hoveredIndex >= 0 || $zoomedIndex >= 0;

  function handleColumnClick(i) {
    if ($zoomedIndex === i) {
      dispatch('openDrawer', { index: i });
    } else {
      zoomedIndex.set(i);
      selectedIndex.set(i);
    }
  }
</script>


<svg
  width={width}
  height={SVG_HEIGHT}
  class="journey-svg"
  overflow="visible"
>
  <!-- ── Per-column stage color bands ───────────────────────────────────── -->
  {#each data as d, i}
    {#if stageColorMap[d.stage_id]}
      <rect
        x={LEFT_AXIS_WIDTH + i * STEP_WIDTH} y={TOP_PADDING}
        width={STEP_WIDTH} 
        height={GRID_HEIGHT}
        fill={stageColorMap[d.stage_id]}
        opacity="0.525"
        pointer-events="none"
      />
    {/if}
  {/each}

  <!-- ── Column highlight bands ──────────────────────────────────────────── -->
  {#each data as _d, i}
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
      x1={LEFT_AXIS_WIDTH} y1={y} x2={width} y2={y}
      stroke={isZero ? "#5E5A5B" : "#D6D6D6"}
      stroke-width={isZero ? 1. : 0.725}
      pointer-events="none"
    />
  
  {/each}

  

  <!-- ── Vertical column dividers ──────────────────────────────────────── -->
  {#each data as _step, i}
    {@const isZoomed  = $zoomedIndex  === i}
    {@const isHovered = $hoveredIndex === i}
    <line
      x1={LEFT_AXIS_WIDTH + i * STEP_WIDTH} y1={TOP_PADDING}
      x2={LEFT_AXIS_WIDTH + i * STEP_WIDTH} y2={TOP_PADDING + GRID_HEIGHT}
      stroke={isHovered ? "#F9564E" : "#CACCB7"}
      stroke-width= {isHovered ? 2 : 1}
      opacity={isZoomed ? 0.9 : isHovered ? 0.85 : 1}
      pointer-events="none"
    />
  {/each}
  <!-- Right edge -->
  <line
    x1={width} y1={TOP_PADDING} x2={width} y2={TOP_PADDING + GRID_HEIGHT}
    stroke="#DFC3A8" stroke-width="1.25" pointer-events="none"
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
      on:click={() => handleColumnClick(i)}
    />
  {/each}

</svg>

<style>
  .journey-svg {
    display: block;
    background: #fff;
    z-index: 1;
  }
</style>