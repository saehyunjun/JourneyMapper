<script>
  import {
    ROW_VALUES,
    GRID_HEIGHT,
    STEP_WIDTH,
    LEFT_AXIS_WIDTH,
    TOP_PADDING,
    stepToX,
    totalWidth,
  } from './journeyConfig.js';
  import { hoveredIndex, selectedIndex, zoomedIndex } from './journeyStore.js';
  import { createEventDispatcher } from 'svelte';

  const dispatch = createEventDispatcher();

  export let data = [];

  /** Map of stage_id → hex color, shared from the page via buildStageColorMap(). */
  export let stageColorMap = {};

  // ── Sentiment chart sizing ───────────────────────────────────────────────
  const S_GRID_HEIGHT = 80;
  const SVG_HEIGHT = S_GRID_HEIGHT + TOP_PADDING * 2;
  const RADIUS = 3;

  $: width = totalWidth(data.length);

  // ── Color per sentiment value ────────────────────────────────────────────
  function sentimentColor(v) {
    const n = parseFloat(v);
    if (n >= 3)  return '#2E7D32';
    if (n >= 1)  return '#7DB85A';
    if (n >= -1) return '#C8A84A';
    if (n >= -3) return '#C03030';
    return '#7A1A1A';
  }

  // ── Y within the sentiment mini-chart ───────────────────────────────────
  function sValToY(v) {
    const n = parseFloat(v);
    return TOP_PADDING + ((5 - n) / 10) * S_GRID_HEIGHT;
  }

  // ── Per-segment colored line points ─────────────────────────────────────
  $: segments = data.slice(0, -1).map((d, i) => ({
    x1: stepToX(i),
    y1: sValToY(d.sentiment),
    x2: stepToX(i + 1),
    y2: sValToY(data[i + 1].sentiment),
    color: sentimentColor((d.sentiment + data[i + 1].sentiment) / 2),
  }));

  $: nodePoints = data.map((d, i) => ({
    cx: stepToX(i),
    cy: sValToY(d.sentiment),
    color: sentimentColor(d.sentiment),
    index: i,
  }));

  function handleColumnClick(i) {
    if ($zoomedIndex === i) {
      dispatch('openDrawer', { index: i });
    } else {
      zoomedIndex.set(i);
      selectedIndex.set(i);
    }
  }
</script>

<svg width={width} height={SVG_HEIGHT} class="sentiment-svg">

  <!-- ── Per-column stage color bands ───────────────────────────────────── -->
  {#each data as d, i}
    {#if stageColorMap[d.stage_id]}
      <rect
        x={LEFT_AXIS_WIDTH + i * STEP_WIDTH} y={TOP_PADDING}
        width={STEP_WIDTH} height={S_GRID_HEIGHT}
        fill={stageColorMap[d.stage_id]}
        opacity="0.25"
        pointer-events="none"
      />
    {/if}
  {/each}

  <!-- ── Column highlight bands ──────────────────────────────────────────── -->
  {#each data as _d, i}
    {#if $zoomedIndex === i}
      <rect
        x={LEFT_AXIS_WIDTH + i * STEP_WIDTH} y={TOP_PADDING}
        width={STEP_WIDTH} height={S_GRID_HEIGHT}
        fill="#C4956A" opacity="0.16" pointer-events="none"
      />
    {:else if $hoveredIndex === i}
      <rect
        x={LEFT_AXIS_WIDTH + i * STEP_WIDTH} y={TOP_PADDING}
        width={STEP_WIDTH} height={S_GRID_HEIGHT}
        fill="#C4956A" opacity="0.07" pointer-events="none"
      />
    {/if}
  {/each}

  <!-- ── Horizontal grid lines ────────────────────────────────────────────── -->
  {#each ROW_VALUES as rowVal}
    {@const y      = sValToY(rowVal)}
    {@const isZero = rowVal === 0}
    <line
      x1={LEFT_AXIS_WIDTH} y1={y} x2={width} y2={y}
      stroke={isZero ? "#A08060" : "#DFC3A8"}
      stroke-width={isZero ? 1.5 : 0.75}
      stroke-dasharray={isZero ? undefined : "4 4"}
    />
    <text
      x={LEFT_AXIS_WIDTH - 6} y={y + 4}
      text-anchor="end"
      class="axis-label"
      fill={isZero ? "#8A6A4A" : "#BFA080"}
    >{rowVal}</text>
  {/each}

  <!-- ── Vertical column dividers ─────────────────────────────────────── -->
  {#each data as _d, i}
    {@const isZoomed  = $zoomedIndex  === i}
    {@const isHovered = $hoveredIndex === i}
    <line
      x1={LEFT_AXIS_WIDTH + i * STEP_WIDTH} y1={TOP_PADDING}
      x2={LEFT_AXIS_WIDTH + i * STEP_WIDTH} y2={TOP_PADDING + S_GRID_HEIGHT}
      stroke={isZoomed ? "#C4956A" : isHovered ? "#F9564E" : "#DFC3A8"}
      stroke-width={isZoomed ? 2.5 : isHovered ? 2 : 0.75}
      opacity={isZoomed ? 0.9 : isHovered ? 0.6 : 1}
    />
  {/each}
  <!-- Right edge -->
  <line
    x1={width} y1={TOP_PADDING} x2={width} y2={TOP_PADDING + S_GRID_HEIGHT}
    stroke="#DFC3A8" stroke-width="0.75"
  />

  <!-- ── Per-segment colored lines ────────────────────────────────────── -->
  {#each segments as seg}
    <line
      x1={seg.x1} y1={seg.y1} x2={seg.x2} y2={seg.y2}
      stroke={seg.color} stroke-width="2" stroke-linecap="round"
    />
  {/each}

  <!-- ── Per-point colored nodes ─────────────────────────────────────── -->
  <g pointer-events="none">
    {#each nodePoints as pt}
      {@const isZoomed   = $zoomedIndex  === pt.index}
      {@const isHovered  = $hoveredIndex === pt.index}
      {@const active     = isZoomed || isHovered}

      <circle cx={pt.cx} cy={pt.cy}
        r={active ? RADIUS * 3.5 : RADIUS * 2.25}
        fill={pt.color} opacity="1"
      />
      {#if isZoomed}
        <circle cx={pt.cx} cy={pt.cy}
          r={RADIUS * 5} fill="none"
          stroke={pt.color} stroke-width="2" opacity="0.725"
        />
      {/if}
    {/each}
  </g>

  <!-- ── Full-column hit areas ────────────────────────────────────────── -->
  {#each data as _d, i}
    <rect
      x={LEFT_AXIS_WIDTH + i * STEP_WIDTH} y={TOP_PADDING}
      width={STEP_WIDTH} height={S_GRID_HEIGHT}
      fill="transparent"
      style="cursor: pointer;"
      on:mouseenter={() => hoveredIndex.set(i)}
      on:mouseleave={() => hoveredIndex.set(-1)}
      on:click={() => handleColumnClick(i)}
    />
  {/each}

</svg>

<style>
  .sentiment-svg {
    display: block;
    background: #F4EFE5;
  }
  .axis-label {
    font-size: 9px;
    letter-spacing: 0.02em;
    user-select: none;
  }
</style>