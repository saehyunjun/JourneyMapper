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
  import { hoveredIndex, selectedIndex } from './journeyStore.js';

  export let data = [];

  /**
   * Map of stage_id → hex color, shared from the page via buildStageColorMap().
   */
  export let stageColorMap = {};

  $: width = totalWidth(data.length);

  const S_GRID_HEIGHT = GRID_HEIGHT / 2;
  const S_SVG_HEIGHT  = S_GRID_HEIGHT + TOP_PADDING * 2;

  function valueToY(val) {
    const n = parseFloat(val);
    return TOP_PADDING + ((5 - n) / 10) * S_GRID_HEIGHT;
  }

  function sentimentToColor(val) {
    const n = Math.max(-5, Math.min(5, parseFloat(val)));
    const t = (n + 5) / 10;
    let r, g, b;
    if (t < 0.5) {
      const u = t / 0.5;
      r = Math.round(192 + (212 - 192) * u);
      g = Math.round(57  + (138 - 57)  * u);
      b = Math.round(43  + (27  - 43)  * u);
    } else {
      const u = (t - 0.5) / 0.5;
      r = Math.round(212 + (39  - 212) * u);
      g = Math.round(138 + (174 - 138) * u);
      b = Math.round(27  + (96  - 27)  * u);
    }
    return `rgb(${r},${g},${b})`;
  }

  $: segments = data.slice(0, -1).map((d, i) => {
    const next = data[i + 1];
    const avg  = (parseFloat(d.sentiment) + parseFloat(next.sentiment)) / 2;
    return {
      x1: stepToX(i),     y1: valueToY(d.sentiment),
      x2: stepToX(i + 1), y2: valueToY(next.sentiment),
      color: sentimentToColor(avg),
    };
  });

  $: nodePoints = data.map((d, i) => ({
    cx:    stepToX(i),
    cy:    valueToY(d.sentiment),
    color: sentimentToColor(parseFloat(d.sentiment)),
    index: i,
  }));

  const RADIUS = 4;
</script>

<div class = "header">
<span class="heading h3 h-small text-blue">
  Current Experience
</span>
</div>

<svg width={width} height={S_SVG_HEIGHT} class="sentiment-svg">

  <!-- ── Per-column stage color bands (0.6 opacity) ─────────────────────── -->
  {#each data as d, i}
    {#if stageColorMap[d.stage_id]}
      <rect
        x={LEFT_AXIS_WIDTH + i * STEP_WIDTH} y={TOP_PADDING}
        width={STEP_WIDTH} height={S_GRID_HEIGHT}
        fill={stageColorMap[d.stage_id]}
        opacity="0.6"
      />
    {/if}
  {/each}

  <!-- ── Column highlight bands ────────────────────────────────────────── -->
  {#each data as _d, i}
    {#if $selectedIndex === i}
      <rect
        x={LEFT_AXIS_WIDTH + i * STEP_WIDTH} y={TOP_PADDING}
        width={STEP_WIDTH} height={S_GRID_HEIGHT}
        fill="#F9564E" opacity="0.08"
      />
    {/if}
    {#if $hoveredIndex === i}
      <rect
        x={LEFT_AXIS_WIDTH + i * STEP_WIDTH} y={TOP_PADDING}
        width={STEP_WIDTH} height={S_GRID_HEIGHT}
        fill="#C4956A" opacity="0.06"
      />
    {/if}
  {/each}

  <!-- ── Horizontal grid lines + axis labels ──────────────────────────── -->
  {#each ROW_VALUES as rowVal}
    {@const y      = valueToY(rowVal)}
    {@const isZero = rowVal === 0}

    <line
      x1={LEFT_AXIS_WIDTH} y1={y}
      x2={width}           y2={y}
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
    {@const isActive = $hoveredIndex === i || $selectedIndex === i}
    <line
      x1={LEFT_AXIS_WIDTH + i * STEP_WIDTH} y1={TOP_PADDING}
      x2={LEFT_AXIS_WIDTH + i * STEP_WIDTH} y2={TOP_PADDING + S_GRID_HEIGHT}
      stroke={isActive ? "#F9564E" : "#DFC3A8"}
      stroke-width={isActive ? 2 : 0.75}
      opacity={isActive ? 0.6 : 1}
    />
  {/each}
  <!-- Right edge -->
  <line
    x1={width} y1={TOP_PADDING}
    x2={width} y2={TOP_PADDING + S_GRID_HEIGHT}
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
      {@const isHovered  = $hoveredIndex  === pt.index}
      {@const isSelected = $selectedIndex === pt.index}
      {@const active     = isHovered || isSelected}

      <circle cx={pt.cx} cy={pt.cy}
        r={active ? RADIUS * 3.5 : RADIUS * 2.25}
        fill={pt.color} opacity="1"
      />
      {#if isSelected}
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
      on:click={() => selectedIndex.set($selectedIndex === i ? -1 : i)}
    />
  {/each}

</svg>

<style>
  .section-label {
    color: #8A6A4A;
    padding: 4px 12px;
    background: #F4EFE5;
    border-top: 1px solid #DFC3A8;
    border-bottom: 1px solid #DFC3A8;
  }

  .sentiment-svg {
    display: block;
    background: #F4EFE5;
  }

  .axis-label {
    letter-spacing: 0.02em;
    user-select: none;
  }
</style>