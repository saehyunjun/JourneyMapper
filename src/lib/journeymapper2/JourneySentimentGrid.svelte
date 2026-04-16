<script>
  import {
    STEP_WIDTH,
    LEFT_AXIS_WIDTH,
    totalWidth,
    sentimentToColor,
  } from './journeyConfig.js';
  import { hoveredIndex, selectedIndex } from './journeyStore.js';

  let { data = [] } = $props();

  const BAR_HEIGHT = 28;
  const SVG_HEIGHT = BAR_HEIGHT;

  const width = $derived(totalWidth(data.length));
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
      pointer-events="none"
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
      onmouseenter={() => hoveredIndex.set(i)}
      onmouseleave={() => hoveredIndex.set(-1)}
      onclick={() => selectedIndex.set($selectedIndex === i ? -1 : i)}
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