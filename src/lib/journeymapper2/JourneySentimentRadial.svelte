<script lang="ts">
  import { scaleBand } from 'd3-scale';
  import type { CurveFactory } from 'd3-shape';
  import { curveCatmullRomClosed, curveLinearClosed, arc as d3Arc } from 'd3-shape';
  import { onMount } from 'svelte';

  import { Area, Axis, Chart, Spline, Points, Svg } from 'layerchart';

  import { sentimentToColor, buildStageColorMap } from './journeyConfig.js';

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

  $: plotR    = svgSize / 2 - PADDING;   // Layerchart plot radius
  $: arcInner = plotR + 32;              // inner edge of stage band (gap = step label lane)
  $: arcOuter = arcInner + 8;           // outer edge of stage band

  $: n = chartData.length;
  $: stepAngle = n > 0 ? (2 * Math.PI) / n : 0;

  // Angles measured from top (−π/2), clockwise — matches Layerchart scaleBand
  function stepStartAngle(idx: number) { return -Math.PI / 2 + idx * stepAngle - stepAngle / 2; }
  function stepEndAngle  (idx: number) { return -Math.PI / 2 + idx * stepAngle + stepAngle / 2; }
  function stepMidAngle  (idx: number) { return -Math.PI / 2 + idx * stepAngle; }

  // ── D3 arc generator for the stage band ───────────────────────────────────
  $: arcGen = d3Arc<{ startAngle: number; endAngle: number }>()
    .innerRadius(arcInner)
    .outerRadius(arcOuter)
    .startAngle(d => d.startAngle)
    .endAngle(d => d.endAngle)
    .padAngle(0.03425)
    .cornerRadius(0);

  // ── Stage arc data ─────────────────────────────────────────────────────────
  interface StageArc {
    group:       StageGroup;
    arcPath:     string;
    midAngle:    number;
    spanAngle:   number;
    // Flat label position outside the arc band
    labelX:      number;
    labelY:      number;
    labelAnchor: string;
    labelBaseline: string;
  }

  const STAGE_LABEL_GAP = 20; // px between arcOuter and label baseline

  $: stageArcs = (() => {
    if (!svgSize || !n) return [] as StageArc[];

    return stageGroups.map((g): StageArc => {
      const sa   = stepStartAngle(g.startIndex);
      const ea   = stepEndAngle(g.endIndex);
      const mid  = (sa + ea) / 2;
      const span = ea - sa;

      const arcPath = arcGen({ startAngle: sa, endAngle: ea }) ?? '';

      // Label sits at arcOuter + gap, pointing radially outward from midAngle
      const BASE_R = arcOuter + STAGE_LABEL_GAP;

// unit direction vector
const dx = Math.cos(mid);
const dy = Math.sin(mid);

// push further outward depending on quadrant
const EXTRA_OFFSET = 10;

const lx = (BASE_R * dx) + (dx * EXTRA_OFFSET);
const ly = (BASE_R * dy) + (dy * EXTRA_OFFSET);
      // Anchor by horizontal position: right side → start, left → end, top/bottom → middle
      const normMid = ((mid % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI); // 0–2π
      let anchor: 'start' | 'middle' | 'end' = 'middle';
      let baseline: 'middle' | 'hanging' | 'baseline' = 'middle';

      // Right side
      if (dx > 0.3) anchor = 'start';

      // Left side
      else if (dx < -0.3) anchor = 'end';

      // Top
      if (dy < -0.6) baseline = 'baseline';

      // Bottom
else if (dy > 0.6) baseline = 'hanging';

    return {
      group: g,
      arcPath,
      midAngle: mid,
      spanAngle: span,
      labelX: lx,
      labelY: ly,
      labelAnchor: anchor,
      labelBaseline: baseline
    };
        });
      })();

  // ── Step label geometry ────────────────────────────────────────────────────
  // Labels sit in the lane between plotR and arcInner
  $: stepLabelR = plotR + (arcInner - plotR) / 2;

  interface StepLabel {
    x: number;
    y: number;
    angle: number;
    anchor: string;
    lines: string[];
  }

  $: stepLabels = (() => {
    if (!svgSize || !n) return [] as StepLabel[];

    return chartData.map((d, i): StepLabel => {
      const theta = stepMidAngle(i);
      const x = stepLabelR * Math.cos(theta);
      const y = stepLabelR * Math.sin(theta);

      // Rotate text tangent to the circle. svgDeg converts from top-CW radians
      // to SVG right-CW degrees. Right half: anchor "end" (text grows toward arc).
      // Left half: flip 180°, anchor "start" (same visual effect).
      const svgDeg      = theta * (180 / Math.PI) + 90;
      const inRightHalf = theta >= -Math.PI / 2 && theta <= Math.PI / 2;
      const degrees     = inRightHalf ? svgDeg : svgDeg + 180;
      const anchor      = inRightHalf ? 'end' : 'start';

      // Word-wrap to ≤11 chars per line
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

          <!-- Grid rings -->
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

          <!-- Spokes -->
          <Axis placement="angle"
            grid={{ class: 'stroke-(--ink) opacity-8' }}
            tickLength={0}
            format={() => ''} />

          <!-- Positive fill -->
          <Area data={chartData}
            y0={() => 0}
            y1={(d: ChartDatum) => Math.max(0, d.value)}
            {curve}
            class="fill-[#27ae60] opacity-20" />

          <!-- Negative fill -->
          <Area data={chartData}
            y0={(d: ChartDatum) => Math.min(0, d.value)}
            y1={() => 0}
            {curve}
            class="fill-[#c0392b] opacity-20" />

          <!-- Spline -->
          <Spline data={chartData} y="value" {curve}
            class="stroke-(--ink) stroke-[1.5px] fill-none" />

          <!-- Points -->
          <Points data={chartData} y="value" r={4}
            class="stroke-(--ink) stroke-[1px] fill-transparent" />

          <!-- Radius labels -->
          <Axis placement="radius"
            rule={{ y: 'top', class: 'stroke-(--ink) opacity-20' }}
            ticks={[-4, 0, 4]}
            format={(v: number) => (v > 0 ? `+${v}` : `${v}`)} />

          <!-- ── D3 overlay ──────────────────────────────────────────────── -->
          <g aria-hidden="true">

            <!-- Stage arc bands -->
            {#each stageArcs as arc}
              <path d={arc.arcPath} fill={arc.group.color} opacity="0.85" />
            {/each}

            <!-- Stage labels — flat text outside the arc band -->
            {#each stageArcs as arc}
              <text
                x={arc.labelX}
                y={arc.labelY}
                text-anchor={arc.labelAnchor}
                dominant-baseline="start"
                class="label"
              >{arc.group.label}</text>
            {/each}

          
            <!-- ── Step labels radiating outward ────────────────────────── -->
            {#if showLabels}
              {#each stepLabels as lbl, i}
                <text
                  transform="translate({lbl.x},{lbl.y})"
                  text-anchor={lbl.anchor}
                  class="label-sm"
                  dominant-baseline="end"
                >
                  {#each lbl.lines as line, li}
                    <tspan
                      x="0"
                      dy={li === 0 ? -(lbl.lines.length - 1) * 5 : 10}
                    >{line}</tspan>
                  {/each}
                </text>
              {/each}
            {/if}

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

<style>
  .radial-chart-wrap {
    width: 100%;
    aspect-ratio: 1 / 1;
    max-width: 1080px;
    padding: 1em;
    margin: 0 auto;
    /* Extra overflow room for stage labels that sit outside the arc */
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

</style>