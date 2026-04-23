<script>
  /**
   * FlowSentimentSidebar
   * ─────────────────────────────────────────────────────────────────────────────
   * Vertical sentiment-only line chart pinned to the right of the flow diagram.
   * Nodes are vertically aligned to step card centres via measured stepYOffsets.
   *
   * Props:
   *   data           — full journey data array
   *   stepYOffsets   — number[] of measured Y centres per step (from parent)
   *   stepSlotHeight — fallback uniform slot height in px (default 160)
   *   width          — sidebar width in px (default 180)
   */

  import { sentimentToColor, ratingToLabel, buildStageColorMap } from './journeyConfig.js';
  import { selectedIndex, hoveredIndex } from './journeyStore.js';

  export let data           = [];
  /** Measured Y-centre of each step card relative to flowDiagramEl top (px) */
  export let stepYOffsets   = /** @type {number[]} */ ([]);
  /** Fallback uniform slot height when stepYOffsets is absent */
  export let stepSlotHeight = 160;
  /** Sidebar total width */
  export let width          = 180;

  // ── Dimensions ────────────────────────────────────────────────────────────
  const PAD_LEFT   = 28;  // room for ±5 axis labels
  const PAD_RIGHT  = 12;
  const PAD_TOP    = 16;
  const PAD_BOTTOM = 24;

  $: chartW = width - PAD_LEFT - PAD_RIGHT;

  // ── Y position for step i ─────────────────────────────────────────────────
  // stepYOffsets[i] is already the centre of the step card relative to
  // flowDiagramEl top. We add PAD_TOP so the SVG has breathing room at the top.
  function stepY(i) {
    if (stepYOffsets.length > i) return PAD_TOP + stepYOffsets[i];
    return PAD_TOP + i * stepSlotHeight + stepSlotHeight / 2;
  }

  // Total SVG height — driven by the last measured offset so the chart
  // grows/shrinks as event cards expand the flow diagram.
  $: svgH = stepYOffsets.length > 0
    ? PAD_TOP + stepYOffsets[stepYOffsets.length - 1] + PAD_BOTTOM
    : PAD_TOP + data.length * stepSlotHeight + PAD_BOTTOM;

  // ── X mapping: sentiment −5…+5 → pixel within chart area ──────────────────
  function valueToX(val) {
    const n = Math.max(-5, Math.min(5, parseFloat(val) || 0));
    return PAD_LEFT + ((n + 5) / 10) * chartW;
  }

  // ── Stage color map ───────────────────────────────────────────────────────
  $: stageColorMap = buildStageColorMap(data);

  // ── Sentiment segments (colored per-segment average) ──────────────────────
  $: sentimentSegments = data.slice(0, -1).map((d, i) => {
    const next = data[i + 1];
    const avg  = (parseFloat(d.sentiment) + parseFloat(next.sentiment)) / 2;
    return {
      x1: valueToX(d.sentiment),    y1: stepY(i),
      x2: valueToX(next.sentiment), y2: stepY(i + 1),
      color: sentimentToColor(avg),
      indexA: i,
      indexB: i + 1,
    };
  });

  // ── Grid values ───────────────────────────────────────────────────────────
  const GRID_VALUES = [-4, -2, 0, 2, 4];

  // ── Active step ───────────────────────────────────────────────────────────
  $: activeIndex = $hoveredIndex >= 0 ? $hoveredIndex : $selectedIndex;

  // ── Hover tooltip ─────────────────────────────────────────────────────────
  let hoveredStep = -1;
  let tooltipX = 0;
  let tooltipY = 0;

  function onNodeEnter(i, e) {
    hoveredStep = i;
    hoveredIndex.set(i);
    tooltipX = e.clientX;
    tooltipY = e.clientY;
  }
  function onNodeMove(e) {
    tooltipX = e.clientX;
    tooltipY = e.clientY;
  }
  function onNodeLeave() {
    hoveredStep = -1;
    hoveredIndex.set(-1);
  }

  $: tooltipStep = hoveredStep >= 0 ? data[hoveredStep] : null;
</script>

<!-- ── Sidebar shell ─────────────────────────────────────────────────────── -->
<aside
  class="flow-sentiment-sidebar"
  style="width:{width}px;"
  aria-label="Journey sentiment sidebar"
>

  <!-- ── Header ────────────────────────────────────────────────────────── -->
  <div class="sidebar-header">
    <span class="jm-kicker">Sentiment</span>
    <div class="axis-labels" aria-hidden="true">
      <span class="axis-label axis-label--pos">+5</span>
      <span class="axis-label">0</span>
      <span class="axis-label axis-label--neg">−5</span>
    </div>
  </div>

  <!-- ── Chart ─────────────────────────────────────────────────────────── -->
  <div class="chart-wrap">
    <svg
      {width}
      height={svgH}
      class="sidebar-svg"
      overflow="visible"
      role="img"
      aria-label="Vertical sentiment line chart, one node per journey step"
    >

      <!-- Stage color bands -->
      {#each data as d, i}
        {@const y0 = i === 0               ? PAD_TOP              : (stepY(i - 1) + stepY(i)) / 2}
        {@const y1 = i === data.length - 1 ? svgH - PAD_BOTTOM    : (stepY(i) + stepY(i + 1)) / 2}
        <rect
          x={PAD_LEFT} y={y0}
          width={chartW} height={y1 - y0}
          fill={stageColorMap[d.stage_id] ?? 'transparent'}
          opacity="0.07"
          pointer-events="none"
        />
      {/each}

      <!-- Grid lines -->
      {#each GRID_VALUES as v}
        <line
          x1={valueToX(v)} y1={PAD_TOP}
          x2={valueToX(v)} y2={svgH - PAD_BOTTOM}
          stroke={v === 0 ? 'var(--hairline, rgba(0,0,0,0.15))' : 'var(--hairline, rgba(0,0,0,0.06))'}
          stroke-width={v === 0 ? 1 : 0.75}
          stroke-dasharray={v === 0 ? '3 5' : 'none'}
          pointer-events="none"
        />
      {/each}

      <!-- Sentiment line segments -->
      {#each sentimentSegments as seg}
        {@const active    = activeIndex === seg.indexA || activeIndex === seg.indexB}
        {@const anyActive = activeIndex >= 0}
        <line
          x1={seg.x1} y1={seg.y1}
          x2={seg.x2} y2={seg.y2}
          stroke={seg.color}
          stroke-width="2.5"
          stroke-linecap="round"
          opacity={active ? 1 : anyActive ? 0.18 : 0.8}
          pointer-events="none"
        />
      {/each}

      <!-- Nodes -->
      {#each data as d, i}
        {@const cx        = valueToX(d.sentiment)}
        {@const cy        = stepY(i)}
        {@const isActive  = activeIndex === i}
        {@const anyActive = activeIndex >= 0}
        {@const color     = sentimentToColor(d.sentiment)}
        {@const isInfl    = d.inflection === 'Y' || d.inflection_detail != null}

        <!-- Transparent hit area -->
        <circle
          {cx} {cy} r="16"
          fill="transparent"
          style="cursor:pointer;"
          role="button"
          tabindex="0"
          aria-label="Step {i + 1}: {d.step}, {ratingToLabel(d.sentiment)}"
          onmouseenter={(e) => onNodeEnter(i, e)}
          onmousemove={onNodeMove}
          onmouseleave={onNodeLeave}
          onclick={() => selectedIndex.update(s => s === i ? -1 : i)}
          onkeydown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              selectedIndex.update(s => s === i ? -1 : i);
            }
          }}
        />

        <!-- Inflection = diamond, normal = circle -->
        {#if isInfl}
          {@const s = isActive ? 9 : 6}
          <polygon
            points="{cx},{cy - s} {cx + s},{cy} {cx},{cy + s} {cx - s},{cy}"
            fill={color}
            opacity={isActive ? 1 : anyActive ? 0.18 : 0.85}
            pointer-events="none"
          />
        {:else}
          <circle
            {cx} {cy}
            r={isActive ? 8 : 5}
            fill={color}
            opacity={isActive ? 1 : anyActive ? 0.18 : 0.85}
            pointer-events="none"
          />
        {/if}

        <!-- Selection ring -->
        {#if $selectedIndex === i}
          <circle
            {cx} {cy} r="13"
            fill="none"
            stroke={color}
            stroke-width="1"
            stroke-dasharray="2 3"
            opacity="0.55"
            pointer-events="none"
          />
        {/if}

        <!-- Step index label -->
        <text
          x={cx + (isActive ? 13 : 10)}
          y={cy}
          dominant-baseline="middle"
          class="step-num-label"
          opacity={isActive ? 1 : anyActive ? 0.28 : 0.48}
          pointer-events="none"
        >{i + 1}</text>

      {/each}

    </svg>
  </div>

</aside>

<!-- Tooltip -->
{#if tooltipStep}
  <div
    class="sidebar-tooltip"
    style="left:{tooltipX + 14}px; top:{tooltipY - 32}px;"
    role="tooltip"
    aria-live="polite"
  >
    <span class="label-xs sidebar-tooltip__step">{tooltipStep.step}</span>
    <span
      class="label-xs sidebar-tooltip__val"
      style="color:{sentimentToColor(tooltipStep.sentiment)};"
    >{ratingToLabel(tooltipStep.sentiment)}</span>
  </div>
{/if}


<style>
  .flow-sentiment-sidebar {
    display: flex;
    flex-direction: column;
    background: var(--paper);
    overflow: hidden;
  }

  .sidebar-header {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    padding: 10px 12px 6px;
    border-bottom: 1px solid var(--hairline, rgba(0,0,0,0.06));
    flex-shrink: 0;
  }

  .axis-labels {
    display: flex;
    flex-direction: row;
    gap: 6px;
    align-items: center;
  }

  .axis-label {
    font-size: 0.5rem;
    font-family: 'Space Mono', monospace;
    color: var(--grayblue, #a0a8b8);
    letter-spacing: 0.03em;
  }

  .axis-label--pos { color: var(--midgreen, #4a9e7f); }
  .axis-label--neg { color: var(--red, #c0392b); }

  /* Chart area scrolls in sync with flowDiagramEl via the parent */
  .chart-wrap {
    flex: 1;
    overflow: visible;
  }

  .sidebar-svg { display: block; }

  .step-num-label {
    font-family: 'Space Mono', monospace;
    font-size: 8px;
    fill: var(--grayblue, #a0a8b8);
  }

  .sidebar-tooltip {
    position: fixed;
    z-index: 9999;
    pointer-events: none;
    display: flex;
    flex-direction: column;
    gap: 2px;
    background: var(--paper, #faf9f6);
    border: 1px solid var(--hairline, rgba(0,0,0,0.1));
    border-radius: 6px;
    padding: 5px 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.08);
    max-width: 200px;
  }

  .sidebar-tooltip__step {
    color: var(--ink, #1a1a1a);
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .sidebar-tooltip__val { font-weight: 500; }
</style>