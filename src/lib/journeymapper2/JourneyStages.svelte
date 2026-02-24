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

  function stageX(group) {
    const startX = LEFT_AXIS_WIDTH + group.startIndex * STEP_WIDTH;
    const endX   = LEFT_AXIS_WIDTH + (group.endIndex + 1) * STEP_WIDTH;
    return (startX + endX) / 2;
  }

  function stageWidth(group) {
    return (group.endIndex - group.startIndex + 1) * STEP_WIDTH;
  }
const STAGE_BAND_HEIGHT = 32;
const SVG_HEIGHT = STAGE_BAND_HEIGHT
</script>

<svg width={width} height={SVG_HEIGHT} class="stages-svg">


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

  <!-- ── Stage group band ───────────────────────────────────────────────── -->
  {#each stageGroups as group}
    {@const gx    = LEFT_AXIS_WIDTH + group.startIndex * STEP_WIDTH}
    {@const gw    = stageWidth(group)}
    {@const midX  = stageX(group)}
    {@const bandY = 0}
    <rect
      x={gx + 0} y={bandY}
      width={gw} height={STAGE_BAND_HEIGHT }
      fill={stageColorMap[group.stage_id]}
    />
    <text x={midX} y={bandY + 19} text-anchor="middle" class="stage-label text-xs font-semibold uppercase text-slate-500">{group.stage}</text>
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

</style>