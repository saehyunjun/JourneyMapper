<script>
  import { valueToY, stepToX, totalWidth, STEP_WIDTH } from './journeyConfig.js';
  import { hoveredIndex, selectedIndex } from './journeyStore.js';

  export let data      = [];
  export let metricKey = '';
  /** Static stroke color */
  export let color     = '#ffffff';
  /** Optional per-value color function (val: number) => string */
  export let colorFn   = null;
  export let label     = '';
  export let opacity   = 0.9;
  export let useGradient = false;
  /** When true, renders dashed ghost branches for inflection steps */
  export let showInflection = false;
  /** When true, places line endpoints on the left column edge instead of center */
  export let alignLeft = false;

  const gradientId = `line-gradient-${metricKey}`;

  function resolveColor(val) {
    return colorFn ? colorFn(parseFloat(val)) : color;
  }

  function nodeX(i) {
    return alignLeft ? stepToX(i) - STEP_WIDTH / 2 : stepToX(i);
  }

  // ── Main segments ────────────────────────────────────────────────────────
  $: segments = data.slice(0, -1).map((d, i) => {
    const next = data[i + 1];
    const avg  = (parseFloat(d[metricKey]) + parseFloat(next[metricKey])) / 2;
    return {
      x1: nodeX(i),     y1: valueToY(d[metricKey]),
      x2: nodeX(i + 1), y2: valueToY(next[metricKey]),
      stroke: resolveColor(avg),
      indexA: i,
      indexB: i + 1,
    };
  });

  // ── Gradient ──────────────────────────────────────────────────────────────
  $: svgWidth = totalWidth(data.length);

  $: gradientStops = data.map((d, i) => ({
    offset: svgWidth > 0 ? (nodeX(i) / svgWidth) * 100 : 0,
    color:  valueToGradientColor(parseFloat(d[metricKey])),
  }));

  function valueToGradientColor(val) {
    const n = Math.max(-5, Math.min(5, val));
    if (n < 0) {
      const t = (n + 5) / 5;
      const r = Math.round(249 + (244 - 249) * t);
      const g = Math.round(86  + (211 - 86)  * t);
      const b = Math.round(78  + (94  - 78)  * t);
      return `rgb(${r},${g},${b})`;
    } else {
      const t = n / 5;
      const r = Math.round(244 + (68  - 244) * t);
      const g = Math.round(211 + (187 - 211) * t);
      const b = Math.round(94  + (164 - 94)  * t);
      return `rgb(${r},${g},${b})`;
    }
  }

  // ── Inflection ghost segments ────────────────────────────────────────────
  $: ghostSegments = data.reduce((acc, d, i) => {
    if (d.inflection !== 'Y') return acc;

    const baseVal = parseFloat(d[metricKey]);
    const posVal  = baseVal + parseFloat(d.inflection_pos ?? 0);
    const negVal  = baseVal + parseFloat(d.inflection_neg ?? 0);
    const cx      = nodeX(i);
    const posCy   = valueToY(posVal);
    const negCy   = valueToY(negVal);

    if (i > 0) {
      const prevCy = valueToY(data[i - 1][metricKey]);
      const prevCx = nodeX(i - 1);
      acc.push({ x1: prevCx, y1: prevCy, x2: cx, y2: posCy, branch: 'pos' });
      acc.push({ x1: prevCx, y1: prevCy, x2: cx, y2: negCy, branch: 'neg' });
    }
    if (i < data.length - 1) {
      const nextCy = valueToY(data[i + 1][metricKey]);
      const nextCx = nodeX(i + 1);
      acc.push({ x1: cx, y1: posCy, x2: nextCx, y2: nextCy, branch: 'pos' });
      acc.push({ x1: cx, y1: negCy, x2: nextCx, y2: nextCy, branch: 'neg' });
    }

    return acc;
  }, []);
</script>

{#if segments.length}
  <g class="journey-line" aria-label={label}>

    {#if useGradient}
      <defs>
        <linearGradient
          id={gradientId}
          gradientUnits="userSpaceOnUse"
          x1={nodeX(0)} y1="0"
          x2={nodeX(data.length - 1)} y2="0"
        >
          {#each gradientStops as stop}
            <stop offset="{stop.offset}%" stop-color={stop.color} />
          {/each}
        </linearGradient>
      </defs>
    {/if}

    <!-- ── Ghost inflection branches (drawn first, behind main line) ──────── -->
    {#if showInflection}
      {#each ghostSegments as seg}
        <line
          x1={seg.x1} y1={seg.y1}
          x2={seg.x2} y2={seg.y2}
          stroke={seg.branch === 'pos' ? '#B6C0B1' : '#A5A8C7'}
          stroke-width="2.25"
          stroke-dasharray="1 5"
          stroke-linecap="square"
          opacity="0.95"
          pointer-events="none"
        />
      {/each}
    {/if}

    <!-- ── Main line segments ────────────────────────────────────────────── -->
    {#each segments as seg}
      {@const active    = $hoveredIndex === seg.indexA || $hoveredIndex === seg.indexB ||
                          $selectedIndex === seg.indexA || $selectedIndex === seg.indexB}
      {@const anyActive = $hoveredIndex >= 0 || $selectedIndex >= 0}
      {@const stroke    = useGradient ? `url(#${gradientId})` : seg.stroke}

      <line
        x1={seg.x1} y1={seg.y1}
        x2={seg.x2} y2={seg.y2}
        {stroke}
        stroke-width="2.25"
        stroke-linecap="square"
        opacity={active ? opacity : anyActive ? 0.18 : opacity}
        pointer-events="none"
      />
    {/each}

  </g>
{/if}