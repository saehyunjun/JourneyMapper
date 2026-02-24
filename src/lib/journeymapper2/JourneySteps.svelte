<script>
  import {
    STEP_WIDTH,
    LEFT_AXIS_WIDTH,
    totalWidth,
    buildStageColorMap,
  } from './journeyConfig.js';
  import { hoveredIndex, selectedIndex } from './journeyStore.js';

  export let data = [];

  $: stageGroups = (() => {
    const groups = [];
    let current = null;
    data.forEach((d, i) => {
      if (!current || d.stage_id !== current.stage_id) {
        current = { stage_id: d.stage_id, stage: d.stage, startIndex: i, endIndex: i };
        groups.push(current);
      } else {
        current.endIndex = i;
      }
    });
    return groups;
  })();

  $: stageColorMap = buildStageColorMap(data);

  $: width = totalWidth(data.length);


  function stageWidth(group) {
    return (group.endIndex - group.startIndex + 1) * STEP_WIDTH;
  }
const STEP_LABEL_HEIGHT = 200;
const SVG_HEIGHT = STEP_LABEL_HEIGHT;
</script>

<svg width={width} height={STEP_LABEL_HEIGHT} class="stages-svg">

  <!-- ── Per-stage column fill (full opacity) ─────────────────────────────── -->
  {#each stageGroups as group}
    <rect
      x={LEFT_AXIS_WIDTH + group.startIndex * STEP_WIDTH} y="0"
      width={stageWidth(group)} height={STEP_LABEL_HEIGHT}
      fill={stageColorMap[group.stage_id]}
      opacity="0.3"

    />
  {/each}

  <!-- Border lines for section label row -->
  <line x1="0" y1="0" x2={width} y2="0" stroke="#DFC3A8" stroke-width="1" />
  <line x1="0" y1="22" x2={width} y2="22" stroke="#DFC3A8" stroke-width="1" />

  <!-- Left axis gutter — neutral so stage color doesn't bleed into labels -->
  <rect x="0" y="0" width={LEFT_AXIS_WIDTH} height={SVG_HEIGHT} fill="#F4EFE5" />

  <!-- ── Column highlight bands ─────────────────────────────────────────── -->
  {#each data as _d, i}
    {#if $selectedIndex === i}
      <rect
        x={LEFT_AXIS_WIDTH + i * STEP_WIDTH} y="22"
        width={STEP_WIDTH} height={SVG_HEIGHT}
        fill="#C4956A" opacity="0.15"
      />
    {/if}
    {#if $hoveredIndex === i}
      <rect
        x={LEFT_AXIS_WIDTH + i * STEP_WIDTH} y="22"
        width={STEP_WIDTH} height={SVG_HEIGHT}
        fill="#F9564E" opacity="0.08"
      />
    {/if}
  {/each}

  <!-- ── Vertical column dividers ──────────────────────────────────────── -->
  {#each data as _d, i}
    {@const isActive = $hoveredIndex === i || $selectedIndex === i}
    <line
      x1={LEFT_AXIS_WIDTH + i * STEP_WIDTH} y1="0"
      x2={LEFT_AXIS_WIDTH + i * STEP_WIDTH} y2={SVG_HEIGHT}
      stroke={isActive ? "#F9564E" : "#DFC3A8"}
      stroke-width={isActive ? 2 : 0.75}
      opacity={isActive ? 0.6 : 1}
    />
  {/each}


  <!-- ── Step names — rotated 90° ─────────────────────────────────────── -->
  {#each data as d, i}
    {@const cx      = LEFT_AXIS_WIDTH + i * STEP_WIDTH + STEP_WIDTH / 2}
    {@const anchorY = STEP_LABEL_HEIGHT}
    {@const isActive = $hoveredIndex === i || $selectedIndex === i}
    <text
      x={cx} y={anchorY}
      text-anchor="start"
      dominant-baseline="middle"
      class="step-label"
      fill={isActive ? "#5A3E28" : "#8A6A4A"}
      transform={`rotate(-90, ${cx}, ${anchorY})`}
    >{d.step}</text>

    <!-- ── Experience Wheel indicator dot ──────────────────────── -->
    {#if d.has_experience_wheel}
      <!-- Sits at the "start" (bottom) of the rotated label — top of the column -->
      {@const dotCx = cx}
      {@const dotCy = 32}
      <circle
        cx={dotCx} cy={dotCy} r="5"
        fill="#C4956A" opacity="0.15"
        pointer-events="none"
      />
      <circle
        cx={dotCx} cy={dotCy} r="3.5"
        fill="#C4956A" opacity="0.9"
        pointer-events="none"
      />
      <text
        x={dotCx} y={dotCy + 0.5}
        text-anchor="middle" dominant-baseline="middle"
        class="wheel-dot-label"
        pointer-events="none"
      >W</text>
    {/if}
  {/each}
  <!-- ── Full-column hit areas ─────────────────────────────────────────── -->
  {#each data as _d, i}
    <rect
      x={LEFT_AXIS_WIDTH + i * STEP_WIDTH} y="22"
      width={STEP_WIDTH} height={SVG_HEIGHT - 22}
      fill="transparent"
      style="cursor: pointer;"
      on:mouseenter={() => hoveredIndex.set(i)}
      on:mouseleave={() => hoveredIndex.set(-1)}
      on:click={() => selectedIndex.set($selectedIndex === i ? -1 : i)}
    />
  {/each}

</svg>

<style>
  .stages-svg {
    display: block;
    background: #F4EFE5;
  }

  .step-label {
    font-size: .825em;
    letter-spacing: 0.04em;
    transition: fill 0.15s ease;
  }

  .wheel-dot-label {
    font-family: 'Space Mono', monospace;
    font-size: 5px;
    font-weight: 700;
    fill: #F4EFE5;
  }

</style>