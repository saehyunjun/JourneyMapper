<script lang="ts">
  import { scaleBand } from 'd3-scale';
  import type { CurveFactory } from 'd3-shape';
  import { curveCatmullRomClosed, curveLinearClosed, arc as d3Arc } from 'd3-shape';
  import { onMount } from 'svelte';

  import { Area, Axis, Chart, Spline, Points, Svg } from 'layerchart';

  import { sentimentToColor, buildStageColorMap } from './journeyConfig.js';
  import { hoveredIndex } from './journeyStore.js';
  import JourneyTooltip from './JourneyTooltip.svelte';

  // ── Types ──────────────────────────────────────────────────────────────────
  interface JourneyStep {
    step?: string;
    stage?: string;
    stage_id?: string | number;
    sentiment?: string | number;
    [key: string]: unknown;
  }

  interface ChartDatum {
    name: string;
    value: number;
    color: string;
    stage: string;
    stageId: string;
    index: number;
  }

  interface StageGroup {
    stageId: string;
    label: string;
    color: string;
    startIndex: number;
    endIndex: number;
  }

  // ── Props ──────────────────────────────────────────────────────────────────
  export let data: JourneyStep[] = [];
  export let metrics: { key: string; label: string; color: string }[] = [];
  export let curve: CurveFactory = curveCatmullRomClosed as CurveFactory;
  export let showZeroRing = true;
  export let showLabels   = true;

  // ── Derived chart data ─────────────────────────────────────────────────────
  $: chartData = data.map((d, i): ChartDatum => ({
    name:    (d.step    as string) ?? `Step ${i + 1}`,
    value:   parseFloat(String(d.sentiment ?? 0)),
    color:   sentimentToColor(d.sentiment ?? 0),
    stage:   (d.stage   as string) ?? '',
    stageId: String(d.stage_id ?? ''),
    index:   i,
  }));

  $: stageColorMap = buildStageColorMap(data) as Record<string, string>;

  // ── Stage groups ───────────────────────────────────────────────────────────
  $: stageGroups = (() => {
    const groups: StageGroup[] = [];
    let current: StageGroup | null = null;
    data.forEach((d, i) => {
      const id = String(d.stage_id ?? '');
      if (!current || id !== current.stageId) {
        current = { stageId: id, label: (d.stage as string) ?? '', color: stageColorMap[id] ?? '#888', startIndex: i, endIndex: i };
        groups.push(current);
      } else {
        current.endIndex = i;
      }
    });
    return groups;
  })();

  // ── Hover helpers ──────────────────────────────────────────────────────────
  $: anyHovered = $hoveredIndex >= 0;

  // ── Curve toggle helpers ───────────────────────────────────────────────────
  $: isSmooth = curve === curveCatmullRomClosed;
  function setSmooth() { curve = curveCatmullRomClosed as CurveFactory; }
  function setLinear()  { curve = curveLinearClosed  as CurveFactory; }

  // ── Measured container size ────────────────────────────────────────────────
  let wrapEl: HTMLDivElement;
  let svgSize = 0;

  function measureWrap() { if (wrapEl) svgSize = wrapEl.clientWidth; }

  onMount(() => {
    measureWrap();
    const ro = new ResizeObserver(measureWrap);
    ro.observe(wrapEl);
    return () => ro.disconnect();
  });

  // ── Radial geometry ────────────────────────────────────────────────────────
  const PADDING = 128;

  $: plotR    = svgSize / 2 - PADDING;
  $: arcInner = plotR + 32;
  $: arcOuter = arcInner + 8;

  $: n = chartData.length;
  $: stepAngle = n > 0 ? (2 * Math.PI) / n : 0;

  function stepStartAngle(idx: number) { return -Math.PI / 2 + idx * stepAngle - stepAngle / 2; }
  function stepEndAngle  (idx: number) { return -Math.PI / 2 + idx * stepAngle + stepAngle / 2; }
  function stepMidAngle  (idx: number) { return -Math.PI / 2 + idx * stepAngle; }

  // ── D3 arc generator ──────────────────────────────────────────────────────
  $: arcGen = d3Arc<{ startAngle: number; endAngle: number }>()
    .innerRadius(arcInner)
    .outerRadius(arcOuter)
    .startAngle(d => d.startAngle)
    .endAngle(d => d.endAngle)
    .padAngle(0.03425)
    .cornerRadius(0);

  // ── Stage arc data ─────────────────────────────────────────────────────────
  interface StageArc {
    group:         StageGroup;
    arcPath:       string;
    midAngle:      number;
    spanAngle:     number;
    labelX:        number;
    labelY:        number;
    labelAnchor:   string;
    labelBaseline: string;
  }

  const STAGE_LABEL_GAP = 20;

  $: stageArcs = (() => {
    if (!svgSize || !n) return [] as StageArc[];

    return stageGroups.map((g): StageArc => {
      const sa  = stepStartAngle(g.startIndex);
      const ea  = stepEndAngle(g.endIndex);
      const mid = (sa + ea) / 2;
      const span = ea - sa;

      const arcPath = arcGen({ startAngle: sa, endAngle: ea }) ?? '';

      const BASE_R = arcOuter + STAGE_LABEL_GAP;
      const dx = Math.cos(mid);
      const dy = Math.sin(mid);
      const EXTRA_OFFSET = 10;
      const lx = BASE_R * dx + dx * EXTRA_OFFSET;
      const ly = BASE_R * dy + dy * EXTRA_OFFSET;

      let anchor: 'start' | 'middle' | 'end' = 'middle';
      let baseline: 'middle' | 'hanging' | 'baseline' = 'middle';
      if (dx > 0.3)       anchor   = 'start';
      else if (dx < -0.3) anchor   = 'end';
      if (dy < -0.6)      baseline = 'baseline';
      else if (dy > 0.6)  baseline = 'hanging';

      return { group: g, arcPath, midAngle: mid, spanAngle: span,
               labelX: lx, labelY: ly, labelAnchor: anchor, labelBaseline: baseline };
    });
  })();

  // ── Step label geometry ────────────────────────────────────────────────────
  $: stepLabelR = plotR + (arcInner - plotR) / 2;

  interface StepLabel {
    x:      number;
    y:      number;
    angle:  number;
    anchor: string;
    lines:  string[];
  }

  $: stepLabels = (() => {
    if (!svgSize || !n) return [] as StepLabel[];

    return chartData.map((d, i): StepLabel => {
      const theta = stepMidAngle(i);
      const x = stepLabelR * Math.cos(theta);
      const y = stepLabelR * Math.sin(theta);

      const svgDeg      = theta * (180 / Math.PI) + 90;
      const inRightHalf = theta >= -Math.PI / 2 && theta <= Math.PI / 2;
      const degrees     = inRightHalf ? svgDeg : svgDeg + 180;
      const anchor      = inRightHalf ? 'end' : 'start';

      const words = d.name.split(' ');
      const lines: string[] = [];
      let current = '';
      for (const w of words) {
        const test = current ? `${current} ${w}` : w;
        if (test.length <= 11) { current = test; }
        else { if (current) lines.push(current); current = w; }
      }
      if (current) lines.push(current);

      return { x, y, angle: degrees, anchor, lines: lines.slice(0, 3) };
    });
  })();

  // ── Spoke geometry — drawn manually for per-spoke opacity control ──────────
  $: spokePoints = (() => {
    if (!svgSize || !n) return [] as { x1: number; y1: number; x2: number; y2: number }[];
    return chartData.map((_, i) => {
      const theta = stepMidAngle(i);
      const INNER_STUB = plotR * 0.08;
      return {
        x1: INNER_STUB * Math.cos(theta),
        y1: INNER_STUB * Math.sin(theta),
        x2: (plotR + 2) * Math.cos(theta),
        y2: (plotR + 2) * Math.sin(theta),
      };
    });
  })();

  // ── Hit circles at each plotted data point ────────────────────────────────
  // Mirrors Layerchart's radial scale: yDomain [-5,5], yPadding [0,1]
  $: hitPoints = (() => {
    if (!svgSize || !n) return [] as { x: number; y: number; r: number; index: number }[];
    return chartData.map((d, i) => {
      const theta = stepMidAngle(i);
      const effectiveMax = 6; // 5 + yPadding 1
      const scaledR = ((d.value + 5) / (effectiveMax + 5)) * plotR;
      return {
        x: Math.max(scaledR, 0) * Math.cos(theta),
        y: Math.max(scaledR, 0) * Math.sin(theta),
        r: 18,
        index: i,
      };
    });
  })();

  // ── Wide invisible lines along each spoke for easy spoke targeting ─────────
  $: spokeHitLines = (() => {
    if (!svgSize || !n) return [] as { x2: number; y2: number; index: number }[];
    return chartData.map((_, i) => {
      const theta = stepMidAngle(i);
      return {
        x2: arcInner * Math.cos(theta),
        y2: arcInner * Math.sin(theta),
        index: i,
      };
    });
  })();
</script>

<div class="flex flex-col gap-3">

  <!-- ── Header ─────────────────────────────────────────────────────────── -->
  <div class="jm-section-bar">
    <span class="jm-kicker">Sentiment Arc</span>
    <div class="flex items-center gap-3">
      <div class="flex items-center gap-1">
        <button class="btn-base" class:active={isSmooth}  on:click={setSmooth}
          style="font-size:0.7rem;height:1.75rem;padding:0 0.6rem;">Smooth</button>
        <button class="btn-base" class:active={!isSmooth} on:click={setLinear}
          style="font-size:0.7rem;height:1.75rem;padding:0 0.6rem;">Linear</button>
      </div>
      <button class="btn-base" on:click={() => (showZeroRing = !showZeroRing)}
        style="font-size:0.7rem;height:1.75rem;padding:0 0.6rem;">
        {showZeroRing ? 'Hide' : 'Show'} Neutral Ring
      </button>
    </div>
  </div>

  <!-- ── Chart ──────────────────────────────────────────────────────────── -->
  <div class="radial-chart-wrap" bind:this={wrapEl}>
    {#if chartData.length > 0 && svgSize > 0}
      <Chart
        data={chartData}
        x="name"
        xScale={scaleBand()}
        y="value"
        yDomain={[-5, 5]}
        yPadding={[0, 1]}
        padding={{ top: PADDING, bottom: PADDING, left: PADDING, right: PADDING }}
        radial
      >
        <Svg center>

          <!-- Grid rings — always fully visible -->
          <Axis placement="radius"
            grid={{ class: 'stroke-(--ink) opacity-10' }}
            ticks={[-4, -2, 0, 2, 4]}
            format={() => ''} />

          {#if showZeroRing}
            <Axis placement="radius"
              grid={{ class: 'stroke-(--ink) opacity-30', style: 'stroke-dasharray:4 3;' }}
              ticks={[0]}
              format={() => ''} />
          {/if}

          <!-- Layerchart angle axis — hidden; we draw our own spokes below -->
          <Axis placement="angle"
            grid={{ class: 'opacity-0' }}
            tickLength={0}
            format={() => ''} />

          <!-- ── Fills — whole-group dim on any hover ──────────────────── -->
          <g style="opacity:{anyHovered ? 0.08 : 1}; transition:opacity 200ms ease;">
            <Area data={chartData}
              y0={() => 0}
              y1={(d: ChartDatum) => Math.max(0, d.value)}
              {curve}
              class="fill-[#27ae60] opacity-20" />
          </g>

          <g style="opacity:{anyHovered ? 0.08 : 1}; transition:opacity 200ms ease;">
            <Area data={chartData}
              y0={(d: ChartDatum) => Math.min(0, d.value)}
              y1={() => 0}
              {curve}
              class="fill-[#c0392b] opacity-20" />
          </g>

          <!-- ── Spline — dims on any hover ────────────────────────────── -->
          <g style="opacity:{anyHovered ? 0.1 : 1}; transition:opacity 200ms ease;">
            <Spline data={chartData} y="value" {curve}
              class="stroke-(--ink) stroke-[1.5px] fill-none" />
          </g>

          <!-- Layerchart Points suppressed — replaced by D3 overlay dots -->
          <g class="opacity-0" aria-hidden="true">
            <Points data={chartData} y="value" r={0} />
          </g>

          <!-- Radius axis labels — always visible -->
          <Axis placement="radius"
            rule={{ y: 'top', class: 'stroke-(--ink) opacity-20' }}
            ticks={[-4, 0, 4]}
            format={(v: number) => (v > 0 ? `+${v}` : `${v}`)} />

          <!-- ── D3 overlay ──────────────────────────────────────────────── -->
          <g>

            <!-- Per-spoke axis lines — dim non-active spokes on hover -->
            {#each spokePoints as sp, i}
              {@const isActive = $hoveredIndex === i}
              <line
                x1={sp.x1} y1={sp.y1}
                x2={sp.x2} y2={sp.y2}
                stroke="var(--ink)"
                stroke-width={isActive ? 1.5 : 0.75}
                opacity={anyHovered ? (isActive ? 0.55 : 0.06) : 0.12}
                style="transition: opacity 200ms ease, stroke-width 150ms ease;"
                pointer-events="none"
              />
            {/each}

            <!-- Stage arc bands — always visible -->
            {#each stageArcs as arc}
              <path d={arc.arcPath} fill={arc.group.color} opacity="0.85" pointer-events="none" />
            {/each}

            <!-- Stage labels — always visible -->
            {#each stageArcs as arc}
              <text
                x={arc.labelX}
                y={arc.labelY}
                text-anchor={arc.labelAnchor}
                dominant-baseline="start"
                class="label"
                pointer-events="none"
              >{arc.group.label}</text>
            {/each}

            <!-- Per-step data point dots — dim non-active on hover -->
            {#each chartData as d, i}
              {@const hp = hitPoints[i]}
              {@const isActive = $hoveredIndex === i}
              {#if hp}
                <circle
                  cx={hp.x} cy={hp.y}
                  r={isActive ? 6 : 4}
                  fill={d.color}
                  stroke="var(--ink)"
                  stroke-width={isActive ? 1.5 : 0.75}
                  opacity={anyHovered ? (isActive ? 1 : 0.08) : 0.8}
                  style="transition: opacity 200ms ease;"
                  pointer-events="none"
                />
              {/if}
            {/each}

            <!-- Active point highlight ring -->
            {#if $hoveredIndex >= 0 && hitPoints[$hoveredIndex]}
              {@const hp = hitPoints[$hoveredIndex]}
              {@const hd = chartData[$hoveredIndex]}
              <circle
                cx={hp.x} cy={hp.y} r={11}
                fill={hd.color} opacity="0.9"
                pointer-events="none"
              />
              <circle
                cx={hp.x} cy={hp.y} r={17}
                fill="none"
                stroke={hd.color}
                stroke-width="1.5"
                opacity="0.5"
                stroke-dasharray="2 3"
                pointer-events="none"
              />
            {/if}

            <!-- ── Step labels — hover on the text itself ─────────────────
                 Targets: the label text + the step's spoke + the data point.
                 All three share the same mouseenter/mouseleave handlers.    -->
            {#if showLabels}
              {#each stepLabels as lbl, i}
                {@const isActive = $hoveredIndex === i}
                <text
                  transform="translate({lbl.x},{lbl.y}) rotate({lbl.angle})"
                  text-anchor={lbl.anchor}
                  class="label-sm step-label"
                  dominant-baseline="end"
                  opacity={anyHovered ? (isActive ? 1 : 0.1) : 0.85}
                  style="transition: opacity 200ms ease; cursor: default;"
                  on:mouseenter={() => hoveredIndex.set(i)}
                  on:mouseleave={() => hoveredIndex.set(-1)}
                >
                  {#each lbl.lines as line, li}
                    <tspan x="0" dy={li === 0 ? -(lbl.lines.length - 1) * 5 : 10}>{line}</tspan>
                  {/each}
                </text>
              {/each}
            {/if}

            <!-- ── Wide invisible spoke hit areas ────────────────────────── -->
            {#each spokeHitLines as sh}
              <line
                x1="0" y1="0"
                x2={sh.x2} y2={sh.y2}
                stroke="transparent"
                stroke-width="28"
                style="cursor: crosshair;"
                on:mouseenter={() => hoveredIndex.set(sh.index)}
                on:mouseleave={() => hoveredIndex.set(-1)}
              />
            {/each}

            <!-- ── Invisible hit circles at each data point ──────────────── -->
            {#each hitPoints as pt}
              <circle
                cx={pt.x} cy={pt.y} r={pt.r}
                fill="transparent"
                style="cursor: crosshair;"
                on:mouseenter={() => hoveredIndex.set(pt.index)}
                on:mouseleave={() => hoveredIndex.set(-1)}
              />
            {/each}

          </g>

        </Svg>
      </Chart>
    {:else}
      <div class="empty-state">
        <span class="label-heading">No data</span>
      </div>
    {/if}
  </div>

  <!-- ── Legend ─────────────────────────────────────────────────────────── -->
  <div class="flex items-center gap-4 justify-center flex-wrap">
    <div class="flex items-center gap-1.5">
      <span class="legend-swatch" style="background:#27ae60;opacity:0.6;"></span>
      <span class="label-heading">Positive</span>
    </div>
    <div class="flex items-center gap-1.5">
      <span class="legend-swatch" style="background:#c0392b;opacity:0.6;"></span>
      <span class="label-heading">Negative</span>
    </div>
    <div class="flex items-center gap-1.5">
      <span class="legend-swatch"
        style="background:linear-gradient(90deg,#c0392b,{sentimentToColor(0)},#27ae60);"></span>
      <span class="label-heading">Sentiment (−5 → +5)</span>
    </div>
    {#each stageGroups as sg}
      <div class="flex items-center gap-1.5">
        <span class="legend-swatch" style="background:{sg.color};"></span>
        <span class="label-heading">{sg.label}</span>
      </div>
    {/each}
  </div>

</div>

<!-- ── Tooltip ────────────────────────────────────────────────────────────── -->
<JourneyTooltip {data} {metrics} />

<style>
  .radial-chart-wrap {
    width: 100%;
    aspect-ratio: 1 / 1;
    max-width: 1080px;
    padding: 1em;
    margin: 0 auto;
    overflow: visible;
  }

  .empty-state {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
  }

  .legend-swatch {
    display: inline-block;
    width: 24px;
    height: 8px;
    border-radius: 2px;
    border: 0.5px solid var(--ink);
    flex-shrink: 0;
  }

  .btn-base.active {
    background-color: var(--ink);
    color: var(--paper);
  }

  /* SVG text needs explicit pointer-events to fire mouseenter/mouseleave */
  .step-label {
    pointer-events: all;
  }
</style>