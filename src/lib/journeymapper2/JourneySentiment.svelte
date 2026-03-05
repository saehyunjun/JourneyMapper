<script>
  import {
    STEP_WIDTH,
    LEFT_AXIS_WIDTH,
    totalWidth,
  } from './journeyConfig.js';
  import { hoveredIndex, selectedIndex } from './journeyStore.js';

  export let data = [];

  const BAR_HEIGHT = 28;
  const SVG_HEIGHT = BAR_HEIGHT;

  $: width = totalWidth(data.length);

  function sentimentToColor(val) {
    const n = Math.max(-5, Math.min(5, parseFloat(val)));
    const t = (n + 5) / 10;
    let r, g, b;
    if (t < 0.25) {
      // Deep red → red  (-5 → -2.5)
      const u = t / 0.25;
      r = Math.round(120 + (192 - 120) * u);
      g = Math.round(20  + (57  - 20)  * u);
      b = Math.round(20  + (43  - 20)  * u);
    } else if (t < 0.5) {
      // Red → yellow  (-2.5 → 0)
      const u = (t - 0.25) / 0.25;
      r = Math.round(192 + (212 - 192) * u);
      g = Math.round(57  + (138 - 57)  * u);
      b = Math.round(43  + (27  - 43)  * u);
    } else if (t < 0.75) {
      // Yellow → green  (0 → 2.5)
      const u = (t - 0.5) / 0.25;
      r = Math.round(212 + (80  - 212) * u);
      g = Math.round(138 + (180 - 138) * u);
      b = Math.round(27  + (60  - 27)  * u);
    } else {
      // Green → deep green  (2.5 → 5)
      const u = (t - 0.75) / 0.25;
      r = Math.round(80  + (30  - 80)  * u);
      g = Math.round(180 + (140 - 180) * u);
      b = Math.round(60  + (40  - 60)  * u);
    }
    return `rgb(${r},${g},${b})`;
  }
</script>

<svg {width} height={SVG_HEIGHT} class="sentiment-svg">

    <!-- ── Axis gutter (neutral background + label) ──────────────────────── -->
    <rect x={0} y={0} width={LEFT_AXIS_WIDTH} height={BAR_HEIGHT} fill="#F4EFE5" />
    <text
      x={LEFT_AXIS_WIDTH - 4} y={BAR_HEIGHT / 2 + 3.5}
      text-anchor="end"
      class="axis-label"
    >SENT</text>

    <!-- ── Per-step sentiment fill ──────────────────────────────────────── -->
    {#each data as d, i}
      <rect
        x={LEFT_AXIS_WIDTH + i * STEP_WIDTH}
        y={0}
        width={STEP_WIDTH}
        height={BAR_HEIGHT}
        fill={sentimentToColor(d.sentiment)}
      />
    {/each}

    <!-- ── Hover / selection highlight overlay ─────────────────────────── -->
    {#each data as _d, i}
      {#if $selectedIndex === i}
        <rect
          x={LEFT_AXIS_WIDTH + i * STEP_WIDTH} y={0}
          width={STEP_WIDTH} height={BAR_HEIGHT}
          fill="white" opacity="0.22"
          pointer-events="none"
        />
      {:else if $hoveredIndex === i}
        <rect
          x={LEFT_AXIS_WIDTH + i * STEP_WIDTH} y={0}
          width={STEP_WIDTH} height={BAR_HEIGHT}
          fill="white" opacity="0.12"
          pointer-events="none"
        />
      {/if}
    {/each}

    <!-- ── Column dividers ──────────────────────────────────────────────── -->
    {#each data as _d, i}
      <line
        x1={LEFT_AXIS_WIDTH + i * STEP_WIDTH} y1={0}
        x2={LEFT_AXIS_WIDTH + i * STEP_WIDTH} y2={BAR_HEIGHT}
        stroke="rgba(0,0,0,0.12)" stroke-width="1"
        pointer-events="none"
      />
    {/each}
    <!-- Right edge -->
    <line
      x1={width} y1={0}
      x2={width} y2={BAR_HEIGHT}
      stroke="rgba(0,0,0,0.12)" stroke-width="1"
      pointer-events="none"
    />

    <!-- ── Full-column hit areas ─────────────────────────────────────────── -->
    {#each data as _d, i}
      <rect
        x={LEFT_AXIS_WIDTH + i * STEP_WIDTH} y={0}
        width={STEP_WIDTH} height={BAR_HEIGHT}
        fill="transparent"
        style="cursor: pointer;"
        on:mouseenter={() => hoveredIndex.set(i)}
        on:mouseleave={() => hoveredIndex.set(-1)}
        on:click={() => selectedIndex.set($selectedIndex === i ? -1 : i)}
      />
    {/each}

  </svg>

<style>
  .sentiment-svg {
    display: block;
    background: #F4EFE5;
  }

  .axis-label {
    font-family: 'IBM Plex Mono', monospace;
    font-size: 8px;
    font-weight: 500;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    fill: #8A6A4A;
    user-select: none;
  }
</style>