<script>
  import { onMount } from 'svelte';
  import {
    STEP_WIDTH,
    LEFT_AXIS_WIDTH,
    totalWidth,
    buildStageColorMap
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
  const LABEL_PAD_Y = 2;
  const LINE_HEIGHT = 16;

  let measureCtx;
  function ensureMeasureCtx() {
    if (measureCtx) return;
    const canvas = document.createElement('canvas');
    measureCtx = canvas.getContext('2d');
    // Keep in sync with .label / app.css mono text, but SVG text uses its own font resolution.
    measureCtx.font = '700 11px ui-monospace, SFMono-Regular, Menlo, monospace';
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

  onMount(() => ensureMeasureCtx());

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
  {#each stageGroups as group}
    <rect
      x={LEFT_AXIS_WIDTH + group.startIndex * STEP_WIDTH}
      y="0"
      width={stageWidth(group)}
      height={svgHeight}
      fill={stageColorMap[group.stage_id]}
      opacity="0.3"
    />
  {/each}

  <!-- Rules -->
  <line x1="0" y1="0" x2={width} y2="0" stroke="var(--jm-rule)" stroke-width="1" />
  <line
    x1="0"
    y1={HEADER_HEIGHT}
    x2={width}
    y2={HEADER_HEIGHT}
    stroke="var(--jm-rule)"
    stroke-width="1"
  />

  <!-- Left gutter -->
  <rect x="0" y="0" width={LEFT_AXIS_WIDTH} height={svgHeight} fill="var(--jm-paper)" />

  <!-- Highlight bands -->
  {#each data as _d, i}
    {#if $selectedIndex === i}
      <rect
        x={LEFT_AXIS_WIDTH + i * STEP_WIDTH}
        y={HEADER_HEIGHT}
        width={STEP_WIDTH}
        height={svgHeight - HEADER_HEIGHT}
        fill="var(--jm-select)"
        opacity="0.15"
      />
    {/if}
    {#if $hoveredIndex === i}
      <rect
        x={LEFT_AXIS_WIDTH + i * STEP_WIDTH}
        y={HEADER_HEIGHT}
        width={STEP_WIDTH}
        height={svgHeight - HEADER_HEIGHT}
        fill="var(--jm-hover)"
        opacity="0.08"
      />
    {/if}
  {/each}

  <!-- Column dividers -->
  {#each data as _d, i}
    <line
      x1={LEFT_AXIS_WIDTH + i * STEP_WIDTH}
      y1="0"
      x2={LEFT_AXIS_WIDTH + i * STEP_WIDTH}
      y2={svgHeight}
      stroke={$hoveredIndex === i || $selectedIndex === i ? 'var(--jm-hover)' : 'var(--jm-rule)'}
      stroke-width={$hoveredIndex === i || $selectedIndex === i ? 2 : 0.75}
      opacity={$hoveredIndex === i || $selectedIndex === i ? 0.6 : 1}
    />
  {/each}

  <!-- Step labels -->
  {#each data as d, i}
    {@const x0 = LEFT_AXIS_WIDTH + i * STEP_WIDTH + LABEL_PAD_X}
    {@const y0 = HEADER_HEIGHT + LABEL_PAD_Y + LINE_HEIGHT * 0.825}
    {@const isActive = $hoveredIndex === i || $selectedIndex === i}

    <text
      x={x0}
      y={y0}
      class="label"
      fill={isActive ? 'var(--jm-ink)' : 'var(--jm-muted)'}
    >
      {#each wrappedSteps[i] as line, li}
        <tspan x={x0} dy={li === 0 ? 0 : LINE_HEIGHT}>{line}</tspan>
      {/each}
    </text>

    {#if d.has_experience_wheel}
      {@const dotCx = LEFT_AXIS_WIDTH + i * STEP_WIDTH + STEP_WIDTH / 2}
      {@const dotCy = HEADER_HEIGHT / 2 + 1}

      <circle
        cx={dotCx}
        cy={dotCy}
        r="5"
        fill="var(--jm-select)"
        opacity="0.15"
        pointer-events="none"
      />
      <circle
        cx={dotCx}
        cy={dotCy}
        r="3.5"
        fill="var(--jm-select)"
        opacity="0.9"
        pointer-events="none"
      />
      <text
        x={dotCx}
        y={dotCy + 0.5}
        text-anchor="middle"
        dominant-baseline="middle"
        class="wheel-dot-label"
        pointer-events="none"
      >
        W
      </text>
    {/if}
  {/each}

  <!-- Hit areas -->
  {#each data as _d, i}
    <rect
      x={LEFT_AXIS_WIDTH + i * STEP_WIDTH}
      y={HEADER_HEIGHT}
      width={STEP_WIDTH}
      height={svgHeight - HEADER_HEIGHT}
      fill="transparent"
      style="cursor: pointer;"
      on:mouseenter={() => hoveredIndex.set(i)}
      on:mouseleave={() => hoveredIndex.set(-1)}
      on:click={() => selectedIndex.set($selectedIndex === i ? -1 : i)}
    />
  {/each}
</svg>