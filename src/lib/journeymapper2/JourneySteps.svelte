<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte';
  import {
    STEP_WIDTH,
    LEFT_AXIS_WIDTH,
    totalWidth,
    buildStageColorMap,
  } from './journeyConfig.js';
  import { hoveredIndex, selectedIndex } from './journeyStore.js';

  const dispatch = createEventDispatcher();

  // ── Types ────────────────────────────────────────────────────────────────
  interface StepDatum {
    stage_id: string;
    stage:    string;
    step:     string;
    [key: string]: unknown;
  }

  interface StageGroup {
    stage_id:   string;
    stage:      string;
    startIndex: number;
    endIndex:   number;
  }

  export let data: StepDatum[] = [];

  // ── Stage groups ─────────────────────────────────────────────────────────
  $: stageGroups = (() => {
    const groups: StageGroup[] = [];
    let current: StageGroup | null = null;
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

  // ── Layout constants ──────────────────────────────────────────────────────
  const HEADER_HEIGHT = 0;
  const LABEL_PAD_X   = 8;
  const LABEL_PAD_Y   = 6;
  const LINE_HEIGHT   = 14;

  // ── Canvas measurement context ────────────────────────────────────────────
  let measureCtx: CanvasRenderingContext2D | null = null;
  let ctxReady = false;

  function ensureMeasureCtx(): void {
    if (measureCtx) return;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.font = '400 9.5px "Space Mono", monospace';
    measureCtx = ctx;
  }

  onMount(() => {
    ensureMeasureCtx();
    ctxReady = true;
  });

  // ── Text wrapping ─────────────────────────────────────────────────────────
  $: labelMaxWidth = Math.max(20, STEP_WIDTH - LABEL_PAD_X * 2);

  function wrapToWidth(text: string, maxWidthPx: number): string[] {
    const t = (text ?? '').toString().trim();
    if (!t) return [''];

    // Pre-mount fallback — character-count approximation
    if (!measureCtx) {
      const approxChars = Math.max(8, Math.floor(maxWidthPx / 6.5));
      const words = t.split(/\s+/);
      const lines: string[] = [];
      let line = '';
      for (const w of words) {
        const next = line ? `${line} ${w}` : w;
        if (next.length <= approxChars) { line = next; }
        else { if (line) lines.push(line); line = w; }
      }
      if (line) lines.push(line);
      return lines.length ? lines : [t];
    }

    // Accurate pixel-based wrapping
    const ctx = measureCtx;
    const words = t.split(/\s+/);
    const lines: string[] = [];
    let line = '';
    for (const w of words) {
      const next = line ? `${line} ${w}` : w;
      if (ctx.measureText(next).width <= maxWidthPx) {
        line = next;
      } else {
        if (line) lines.push(line);
        if (ctx.measureText(w).width > maxWidthPx) {
          // Word wider than column — break by character
          let chunk = '';
          for (const ch of w) {
            const test = chunk + ch;
            if (ctx.measureText(test).width <= maxWidthPx) { chunk = test; }
            else { if (chunk) lines.push(chunk); chunk = ch; }
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

  // Separate statement so Svelte tracks both `ctxReady` and `data` as deps.
  // The comma-expression trick ($: x = dep, expr) doesn't work in Svelte's
  // reactive declaration analyser — it only tracks the last expression.
  $: wrappedSteps = (ctxReady, data).map((d: StepDatum) => wrapToWidth(d.step, labelMaxWidth));

  $: maxLines       = Math.max(1, ...wrappedSteps.map((lines: string[]) => lines.length));
  $: labelRowHeight = maxLines * LINE_HEIGHT + LABEL_PAD_Y * 2;
  $: svgHeight      = labelRowHeight;

  function stageWidth(group: StageGroup): number {
    return (group.endIndex - group.startIndex + 1) * STEP_WIDTH;
  }

  function handleColumnClick(i: number): void {
    dispatch('stepclick', { index: i });
    selectedIndex.set($selectedIndex === i ? -1 : i);
  }

  function handleColumnKeydown(e: KeyboardEvent, i: number): void {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleColumnClick(i);
    }
  }
</script>

<svg {width} height={svgHeight} class="stages-svg">
  <defs>
    {#each data as _d, i}
      <clipPath id="step-clip-{i}">
        <rect
          x={LEFT_AXIS_WIDTH + i * STEP_WIDTH + LABEL_PAD_X}
          y="0"
          width={STEP_WIDTH - LABEL_PAD_X * 2}
          height={svgHeight}
        />
      </clipPath>
    {/each}
  </defs>

  <!-- ── Per-stage column fills ────────────────────────────────────────── -->
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

  <!-- Top border -->
  <line x1="0" y1="0" x2={width} y2="0" stroke="#E8E8E8" stroke-width="1" />

  <!-- Left axis gutter -->
  <rect x="0" y="0" width={LEFT_AXIS_WIDTH} height={svgHeight} fill="#fff" />

  <!-- ── Hovered column highlight ──────────────────────────────────────── -->
  {#each data as _d, i}
    {#if $hoveredIndex === i}
      <rect
        x={LEFT_AXIS_WIDTH + i * STEP_WIDTH}
        y="0"
        width={STEP_WIDTH}
        height={svgHeight}
        fill="#F9564E"
        opacity="0.25"
        pointer-events="none"
      />
    {/if}
  {/each}

  <!-- ── Vertical column dividers ─────────────────────────────────────── -->
  {#each data as _d, i}
    {@const isHovered = $hoveredIndex === i}
    <line
      x1={LEFT_AXIS_WIDTH + i * STEP_WIDTH}
      y1="0"
      x2={LEFT_AXIS_WIDTH + i * STEP_WIDTH}
      y2={svgHeight}
      stroke={isHovered ? '#F9564E' : '#EBEBEB'}
      stroke-width={isHovered ? 2 : 0.5}
      opacity={isHovered ? 0.8 : 1}
      pointer-events="none"
    />
  {/each}

  <!-- ── Step name labels ──────────────────────────────────────────────── -->
  {#each data as d, i}
    {@const x0        = LEFT_AXIS_WIDTH + i * STEP_WIDTH + LABEL_PAD_X}
    {@const y0        = HEADER_HEIGHT + LABEL_PAD_Y + LINE_HEIGHT * 0.85}
    {@const isHovered = $hoveredIndex === i}
    {@const lines     = wrappedSteps[i] ?? [d.step]}

    <text
      x={x0}
      y={y0}
      class="label-xs"
      fill={isHovered ? '#0B0245' : '#767676'}
      clip-path="url(#step-clip-{i})"
    >
      {#each lines as line, li}
        <tspan x={x0} dy={li === 0 ? 0 : LINE_HEIGHT}>{line}</tspan>
      {/each}
    </text>
  {/each}

  <!-- ── Full-column hit areas ─────────────────────────────────────────── -->
  <!--
    SVG <rect> can't be a semantic button, but we add role="button",
    tabindex, and a keydown handler to satisfy a11y requirements.
  -->
  {#each data as d, i}
    <rect
      x={LEFT_AXIS_WIDTH + i * STEP_WIDTH}
      y={HEADER_HEIGHT}
      width={STEP_WIDTH}
      height={svgHeight - HEADER_HEIGHT}
      fill="transparent"
      role="button"
      tabindex="0"
      aria-label="Select step: {d.step}"
      style="cursor: pointer;"
      on:mouseenter={() => hoveredIndex.set(i)}
      on:mouseleave={() => hoveredIndex.set(-1)}
      on:click={() => handleColumnClick(i)}
      on:keydown={(e) => handleColumnKeydown(e, i)}
    />
  {/each}

</svg>

<style>

</style>