<script>
  import { onMount, createEventDispatcher } from 'svelte';
  import {
    STEP_WIDTH,
    LEFT_AXIS_WIDTH,
    totalWidth,
    buildStageColorMap,
  } from './journeyConfig.js';
  import { hoveredIndex, selectedIndex } from './journeyStore.js';

  const dispatch = createEventDispatcher();

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

  // ── Layout + wrapping ───────────────────────────────────────────────────
  const HEADER_HEIGHT = 0;
  const LABEL_PAD_X = 8;
  const LABEL_PAD_Y = 8;
  const LINE_HEIGHT = 16;

  let measureCtx;
  function ensureMeasureCtx() {
    if (measureCtx) return;
    const canvas = document.createElement('canvas');
    measureCtx = canvas.getContext('2d');
    measureCtx.font = '500 10px system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif';
  }

  function wrapToWidth(text, maxWidthPx) {
    const t = (text ?? '').toString().trim();
    if (!t) return [''];
    if (!measureCtx) {
      const approxChars = Math.max(8, Math.floor(maxWidthPx / 7));
      const words = t.split(/\s+/);
      const lines = [];
      let line = '';
      for (const w of words) {
        const next = line ? `${line} ${w}` : w;
        if (next.length <= approxChars) line = next;
        else { if (line) lines.push(line); line = w; }
      }
      if (line) lines.push(line);
      return lines.length ? lines : [t];
    }
    const words = t.split(/\s+/);
    const lines = [];
    let line = '';
    for (const w of words) {
      const next = line ? `${line} ${w}` : w;
      if (measureCtx.measureText(next).width <= maxWidthPx) {
        line = next;
      } else {
        if (line) lines.push(line);
        if (measureCtx.measureText(w).width > maxWidthPx) {
          let chunk = '';
          for (const ch of w) {
            const test = chunk + ch;
            if (measureCtx.measureText(test).width <= maxWidthPx) chunk = test;
            else { if (chunk) lines.push(chunk); chunk = ch; }
          }
          line = chunk;
        } else { line = w; }
      }
    }
    if (line) lines.push(line);
    return lines.length ? lines : [t];
  }

  onMount(() => { ensureMeasureCtx(); });

  $: labelMaxWidth = Math.max(20, STEP_WIDTH - LABEL_PAD_X * 2);
  $: wrappedSteps = data.map((d) => wrapToWidth(d.step, labelMaxWidth));
  $: labelRowHeight =
    Math.max(1, ...wrappedSteps.map((lines) => lines.length)) * LINE_HEIGHT + LABEL_PAD_Y * 2;
  $: svgHeight = labelRowHeight;

  function stageWidth(group) {
    return (group.endIndex - group.startIndex + 1) * STEP_WIDTH;
  }

 
</script>

<svg width={width} height={svgHeight} class="stages-svg">

  <!-- ── Per-stage column fill ─────────────────────────────────────────── -->
  {#each stageGroups as group}
    <rect
      x={LEFT_AXIS_WIDTH + group.startIndex * STEP_WIDTH} y="0"
      width={stageWidth(group)} height={svgHeight}
      fill={stageColorMap[group.stage_id]}
      opacity="0.3"
    />
  {/each}

  <!-- Border lines -->
  <line x1="0" y1="0" x2={width} y2="0" stroke="#E8E8E8" stroke-width="1" />


  <!-- Left axis gutter -->
  <rect x="0" y="0" width={LEFT_AXIS_WIDTH} height={svgHeight} fill="#fff" />

  <!-- ── Column highlight bands ─────────────────────────────────────────── -->
  {#each data as _d, i}
    {#if $hoveredIndex === i}
      <rect
        x={LEFT_AXIS_WIDTH + i * STEP_WIDTH}
        width={STEP_WIDTH} height={svgHeight}
        fill="#F9564E" opacity="0.25"
        pointer-events="none"
      />
    {/if}
  {/each}

  <!-- ── Vertical column dividers ──────────────────────────────────────── -->
  {#each data as _d, i}
    {@const isHovered = $hoveredIndex === i}
    <line
      x1={LEFT_AXIS_WIDTH + i * STEP_WIDTH} y1="0"
      x2={LEFT_AXIS_WIDTH + i * STEP_WIDTH} y2={svgHeight}
      stroke={ isHovered ? "#F9564E" : "#EBEBEB"}
      stroke-width={ isHovered ? 2 : 0.5}
      opacity={ isHovered ? 0.8 : 1}
      pointer-events="none"
    />
  {/each}

  <!-- ── Step names ─────────────────────────────────────────────────────── -->
  {#each data as d, i}
    {@const x0 = LEFT_AXIS_WIDTH + i * STEP_WIDTH + LABEL_PAD_X}
    {@const y0 = HEADER_HEIGHT + LABEL_PAD_Y + LINE_HEIGHT * 0.825}
    {@const isHovered = $hoveredIndex === i}

    <text
      x={x0} y={y0}
      class="label-sm"
      fill={ isHovered ? "#0B0245" : "#767676"}
    >

      {#each wrappedSteps[i] as line, li}
        <tspan x={x0} dy={li === 0 ? 0 : LINE_HEIGHT}>{line}</tspan>
      {/each}
    </text>

  {/each}

  <!-- ── Full-column hit areas ─────────────────────────────────────────── -->
  {#each data as _d, i}
    <rect
      x={LEFT_AXIS_WIDTH + i * STEP_WIDTH} y={HEADER_HEIGHT}
      width={STEP_WIDTH} height={svgHeight - HEADER_HEIGHT}
      fill="transparent"
      style="cursor: pointer;"
      on:mouseenter={() => hoveredIndex.set(i)}
      on:mouseleave={() => hoveredIndex.set(-1)}
      on:click={() => handleColumnClick(i)}
    />
  {/each}

</svg>

<style>
</style>