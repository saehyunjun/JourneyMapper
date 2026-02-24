<script>
  import { onMount } from 'svelte';
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

  // ── Layout + wrapping ───────────────────────────────────────────────────
  const HEADER_HEIGHT = 22;
  const LABEL_PAD_X = 8;
  const LABEL_PAD_Y = 8;
  const LINE_HEIGHT = 16;

  let measureCtx;
  function ensureMeasureCtx() {
    if (measureCtx) return;
    const canvas = document.createElement('canvas');
    measureCtx = canvas.getContext('2d');
    // Keep in sync with .step-label font styling
    measureCtx.font = '500 13px system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif';
  }

  function wrapToWidth(text, maxWidthPx) {
    const t = (text ?? '').toString().trim();
    if (!t) return [''];

    // Fallback if we can't measure yet (e.g., SSR)
    if (!measureCtx) {
      const approxChars = Math.max(8, Math.floor(maxWidthPx / 7));
      const words = t.split(/\s+/);
      const lines = [];
      let line = '';
      for (const w of words) {
        const next = line ? `${line} ${w}` : w;
        if (next.length <= approxChars) line = next;
        else {
          if (line) lines.push(line);
          line = w;
        }
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
        // If a single word is too long, hard-break it.
        if (measureCtx.measureText(w).width > maxWidthPx) {
          let chunk = '';
          for (const ch of w) {
            const test = chunk + ch;
            if (measureCtx.measureText(test).width <= maxWidthPx) chunk = test;
            else {
              if (chunk) lines.push(chunk);
              chunk = ch;
            }
          }
          line = chunk;
        } else {
          line = w;
        }
      }
    }
    if (line) lines.push(line);
    return lines.length ? lines : [t];
  }

  onMount(() => {
    ensureMeasureCtx();
  });

  $: labelMaxWidth = Math.max(20, STEP_WIDTH - LABEL_PAD_X * 2);
  $: wrappedSteps = data.map((d) => wrapToWidth(d.step, labelMaxWidth));
  $: labelRowHeight =
    Math.max(1, ...wrappedSteps.map((lines) => lines.length)) * LINE_HEIGHT + LABEL_PAD_Y * 2;
  $: svgHeight = HEADER_HEIGHT + labelRowHeight;


  function stageWidth(group) {
    return (group.endIndex - group.startIndex + 1) * STEP_WIDTH;
  }
</script>

<svg width={width} height={svgHeight} class="stages-svg">

  <!-- ── Per-stage column fill (full opacity) ─────────────────────────────── -->
  {#each stageGroups as group}
    <rect
      x={LEFT_AXIS_WIDTH + group.startIndex * STEP_WIDTH} y="0"
      width={stageWidth(group)} height={svgHeight}
      fill={stageColorMap[group.stage_id]}
      opacity="0.3"

    />
  {/each}

  <!-- Border lines for section label row -->
  <line x1="0" y1="0" x2={width} y2="0" stroke="#DFC3A8" stroke-width="1" />
  <line x1="0" y1={HEADER_HEIGHT} x2={width} y2={HEADER_HEIGHT} stroke="#DFC3A8" stroke-width="1" />

  <!-- Left axis gutter — neutral so stage color doesn't bleed into labels -->
  <rect x="0" y="0" width={LEFT_AXIS_WIDTH} height={svgHeight} fill="#F4EFE5" />

  <!-- ── Column highlight bands ─────────────────────────────────────────── -->
  {#each data as _d, i}
    {#if $selectedIndex === i}
      <rect
        x={LEFT_AXIS_WIDTH + i * STEP_WIDTH} y={HEADER_HEIGHT}
        width={STEP_WIDTH} height={svgHeight - HEADER_HEIGHT}
        fill="#C4956A" opacity="0.15"
      />
    {/if}
    {#if $hoveredIndex === i}
      <rect
        x={LEFT_AXIS_WIDTH + i * STEP_WIDTH} y={HEADER_HEIGHT}
        width={STEP_WIDTH} height={svgHeight - HEADER_HEIGHT}
        fill="#F9564E" opacity="0.08"
      />
    {/if}
  {/each}

  <!-- ── Vertical column dividers ──────────────────────────────────────── -->
  {#each data as _d, i}
    {@const isActive = $hoveredIndex === i || $selectedIndex === i}
    <line
      x1={LEFT_AXIS_WIDTH + i * STEP_WIDTH} y1="0"
      x2={LEFT_AXIS_WIDTH + i * STEP_WIDTH} y2={svgHeight}
      stroke={isActive ? "#F9564E" : "#DFC3A8"}
      stroke-width={isActive ? 2 : 0.75}
      opacity={isActive ? 0.6 : 1}
    />
  {/each}


  <!-- ── Step names — wrapped within each column ───────────────────────── -->
  {#each data as d, i}
    {@const x0 = LEFT_AXIS_WIDTH + i * STEP_WIDTH + LABEL_PAD_X}
    {@const y0 = HEADER_HEIGHT + LABEL_PAD_Y + LINE_HEIGHT * 0.825}
    {@const isActive = $hoveredIndex === i || $selectedIndex === i}
    <text
      x={x0} y={y0}
      class="label"
      fill={isActive ? "#28211E" : "#8A6A4A"}
    >
      {#each wrappedSteps[i] as line, li}
        <tspan x={x0} dy={li === 0 ? 0 : LINE_HEIGHT}>{line}</tspan>
      {/each}
    </text>

    <!-- ── Experience Wheel indicator dot ──────────────────────── -->
    {#if d.has_experience_wheel}
      <!-- Sits at the "start" (bottom) of the rotated label — top of the column -->
      {@const dotCx = LEFT_AXIS_WIDTH + i * STEP_WIDTH + STEP_WIDTH / 2}
      {@const dotCy = HEADER_HEIGHT / 2 + 1}
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
      x={LEFT_AXIS_WIDTH + i * STEP_WIDTH} y={HEADER_HEIGHT}
      width={STEP_WIDTH} height={svgHeight - HEADER_HEIGHT}
      fill="transparent"
      style="cursor: pointer;"
      on:mouseenter={() => hoveredIndex.set(i)}
      on:mouseleave={() => hoveredIndex.set(-1)}
      on:click={() => selectedIndex.set($selectedIndex === i ? -1 : i)}
    />
  {/each}

</svg>

<style>

  .wheel-dot-label {
    font-family: 'Space Mono', monospace;
    font-size: 5px;
    font-weight: 700;
    fill: #F4EFE5;
  }

</style>