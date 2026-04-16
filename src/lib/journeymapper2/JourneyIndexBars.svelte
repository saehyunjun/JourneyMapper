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

  let {
    /** Journey step data array */
    data = [],
    /**
     * Metric definitions — each item: { key, color, label }
     * Matches the shape from journeyPersonas.json metrics array.
     */
    metrics = [],
    /** Called when a column is double-clicked (already zoomed) to open the drawer */
    onOpenDrawer = null,
  } = $props();

  // ── Bar layout ────────────────────────────────────────────────────────────
  const COL_GUTTER = 24; // px total inset per column (split left/right)
  const BAR_GAP    = 8;  // px gap between bars within a group

  function barWidth(n) {
    if (n === 0) return 0;
    const usable = STEP_WIDTH - COL_GUTTER;
    return Math.max(2, (usable - BAR_GAP * (n - 1)) / n);
  }

  function groupStartX(i, n) {
    const groupW = barWidth(n) * n + BAR_GAP * (n - 1);
    return stepToX(i) - groupW / 2;
  }

  const zeroY = valueToY(0);

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

  const n             = $derived(metrics.length);
  const width         = $derived(totalWidth(data.length));
  const stageColorMap = $derived(buildStageColorMap(data));

  function handleColumnClick(i) {
    if ($zoomedIndex === i) {
      onOpenDrawer?.({ index: i });
    } else {
      zoomedIndex.set(i);
      selectedIndex.set(i);
    }
  }
</script>

<!--
  JourneyIndexBars
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
      {@const val    = parseFloat(d[m.key])}
      {@const rect   = barRect(i, mi, val, n)}
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

      <!-- Top cap line -->
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

      <!-- Value label: only on hover/select -->
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
      onmouseenter={() => hoveredIndex.set(i)}
      onmouseleave={() => hoveredIndex.set(-1)}
      onclick={() => handleColumnClick(i)}
    />
  {/each}

</svg>

<style>
</style>