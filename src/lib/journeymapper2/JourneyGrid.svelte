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
  $: metricGlowOpacity = anyActive ? 0.06 : 0.015;
  $: metricLineOpacity  = anyActive ? 0.88 : 0.22;

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
        width={STEP_WIDTH} height={GRID_HEIGHT}
        fill={stageColorMap[d.stage_id]}
        opacity="0.525"
        pointer-events="none"
      />
    {/if}
  {/each}

  <!-- ── Column highlight bands ──────────────────────────────────────────── -->
  {#each data as _d, i}
    {#if $zoomedIndex === i}
      <rect
        x={LEFT_AXIS_WIDTH + i * STEP_WIDTH} y={TOP_PADDING}
        width={STEP_WIDTH} height={GRID_HEIGHT}
        fill="#C4956A" opacity="0.14" pointer-events="none"
      />
    {:else if $hoveredIndex === i}
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
      stroke={isZero ? "#A08060" : "#DFC3A8"}
      stroke-width={isZero ? 2.275 : 0.75}
      stroke-dasharray={isZero ? undefined : "4 4"}
      pointer-events="none"
    />
    <text
      x={LEFT_AXIS_WIDTH - 6} y={y + 4}
      text-anchor="end"
      class="axis-label"
      fill={isZero ? "#8A6A4A" : "#BFA080"}
      pointer-events="none"
    >{rowVal}</text>
  {/each}

  <!-- ── Vertical column dividers ──────────────────────────────────────── -->
  {#each data as _step, i}
    {@const isZoomed  = $zoomedIndex  === i}
    {@const isHovered = $hoveredIndex === i}
    <line
      x1={LEFT_AXIS_WIDTH + i * STEP_WIDTH} y1={TOP_PADDING}
      x2={LEFT_AXIS_WIDTH + i * STEP_WIDTH} y2={TOP_PADDING + GRID_HEIGHT}
      stroke={isZoomed ? "#C4956A" : isHovered ? "#F9564E" : "#DFC3A8"}
      stroke-width={isZoomed ? 3 : isHovered ? 3 : 0.75}
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
    background: #F4EFE5;
  }
  .axis-label {
    font-size: 9px;
    letter-spacing: 0.02em;
    user-select: none;
  }
</style>