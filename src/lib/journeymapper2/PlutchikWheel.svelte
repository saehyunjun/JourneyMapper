<script>
    import { hoveredEmotions, hoverOne, hoverClear } from './plutchikStore.js';
  
    // 8 primary emotions — colors[0]=outermost/lightest, colors[2]=innermost/darkest
    const EMOTIONS = [
      { id: 'joy',          label: 'Joy',          colors: ['#FFF176', '#FFD600', '#F9A825'] },
      { id: 'trust',        label: 'Trust',        colors: ['#A5D6A7', '#43A047', '#1B5E20'] },
      { id: 'fear',         label: 'Fear',         colors: ['#C5E1A5', '#7CB342', '#33691E'] },
      { id: 'surprise',     label: 'Surprise',     colors: ['#B3E5FC', '#039BE5', '#01579B'] },
      { id: 'sadness',      label: 'Sadness',      colors: ['#BBDEFB', '#1E88E5', '#0D47A1'] },
      { id: 'disgust',      label: 'Disgust',      colors: ['#E1BEE7', '#8E24AA', '#4A148C'] },
      { id: 'anger',        label: 'Anger',        colors: ['#FFCDD2', '#E53935', '#B71C1C'] },
      { id: 'anticipation', label: 'Anticipation', colors: ['#FFE0B2', '#FB8C00', '#E65100'] },
    ];
  
    // All dyads — used to expand a single hovered emotion to its dyad partners
    const DYADS = [
      ['joy', 'trust'], ['trust', 'fear'], ['fear', 'surprise'], ['surprise', 'sadness'],
      ['sadness', 'disgust'], ['disgust', 'anger'], ['anger', 'anticipation'], ['anticipation', 'joy'],
      // secondary
      ['joy', 'fear'], ['trust', 'surprise'], ['fear', 'sadness'], ['surprise', 'disgust'],
      ['sadness', 'anger'], ['disgust', 'anticipation'], ['anger', 'joy'], ['anticipation', 'trust'],
      // tertiary
      ['joy', 'surprise'], ['trust', 'sadness'], ['fear', 'disgust'], ['surprise', 'anger'],
      ['sadness', 'anticipation'], ['disgust', 'joy'], ['anger', 'trust'], ['anticipation', 'fear'],
      // opposite
      ['joy', 'sadness'], ['trust', 'disgust'], ['fear', 'anger'], ['surprise', 'anticipation'],
    ];
  
    /**
     * Given the current hoveredEmotions Set, compute the full "lit" set:
     * - Start with all ids in hoveredEmotions
     * - For each, add dyad partners (only when single-emotion hover from wheel)
     */
    function getLit(hovered) {
      if (hovered.size === 0) return new Set();
      // If hovering a pair (from combinations list), just light those two
      if (hovered.size >= 2) return new Set(hovered);
      // Single emotion from wheel — expand to dyad partners
      const [id] = hovered;
      const lit = new Set([id]);
      for (const [a, b] of DYADS) {
        if (a === id) lit.add(b);
        if (b === id) lit.add(a);
      }
      return lit;
    }
  
    $: lit = getLit($hoveredEmotions);
    $: anyHovered = $hoveredEmotions.size > 0;
  
    function petalOp(id) {
      if (!anyHovered) return 1;
      return lit.has(id) ? 1 : 0.1;
    }
    function labelOp(id) {
      if (!anyHovered) return 1;
      return lit.has(id) ? 1 : 0.15;
    }
  
    // ── SVG geometry ────────────────────────────────────────────────────────
    const CX = 200, CY = 200;
    const N = 8;
    const SLICE = (Math.PI * 2) / N;
    const RINGS = [40, 82, 126, 168];
    const CORE_R = 38;
    const OFFSET = -Math.PI / 2 - SLICE / 2; // Joy at top
    const GAP = 0.03;
  
    function xy(r, a) { return [CX + r * Math.cos(a), CY + r * Math.sin(a)]; }
  
    function petalPath(ei, ri) {
      const a1 = OFFSET + ei * SLICE + GAP;
      const a2 = OFFSET + (ei + 1) * SLICE - GAP;
      const rI = RINGS[ri], rO = RINGS[ri + 1];
      const lg = (a2 - a1) > Math.PI ? 1 : 0;
      const [ax, ay] = xy(rI, a1), [bx, by] = xy(rO, a1);
      const [cx2, cy2] = xy(rO, a2), [dx, dy] = xy(rI, a2);
      return `M${ax} ${ay} L${bx} ${by} A${rO} ${rO} 0 ${lg} 1 ${cx2} ${cy2} L${dx} ${dy} A${rI} ${rI} 0 ${lg} 0 ${ax} ${ay}Z`;
    }
  
    function labelPos(ei) {
      return xy(RINGS[3] + 20, OFFSET + ei * SLICE + SLICE / 2);
    }
  
    function anchor(ei) {
      const a = OFFSET + ei * SLICE + SLICE / 2;
      const dx = Math.cos(a);
      return dx > 0.25 ? 'start' : dx < -0.25 ? 'end' : 'middle';
    }
  </script>
  
  <svg
    viewBox="0 0 400 400"
    width="400"
    height="400"
    class="wheel"
    role="img"
    aria-label="Plutchik emotion wheel"
    overflow="visible"
  >
    {#each EMOTIONS as em, ei}
      {#each [2, 1, 0] as ri}
        <path
          d={petalPath(ei, ri)}
          fill={em.colors[ri]}
          stroke="#F4EFE5"
          stroke-width="1.25"
          opacity={petalOp(em.id)}
          style="transition: opacity 0.18s ease; cursor: pointer;"
          on:mouseenter={() => hoverOne(em.id)}
          on:mouseleave={hoverClear}
        />
      {/each}
  
      <text
        x={labelPos(ei)[0]}
        y={labelPos(ei)[1]}
        text-anchor={anchor(ei)}
        dominant-baseline="middle"
        class="em-label"
        opacity={labelOp(em.id)}
        style="transition: opacity 0.18s ease;"
        pointer-events="none"
      >{em.label}</text>
    {/each}
  
    <!-- Core -->
    <circle cx={CX} cy={CY} r={CORE_R} fill="#EDE5D8" stroke="#DFC3A8" stroke-width="1.25" />
    <text x={CX} y={CY - 5} text-anchor="middle" dominant-baseline="middle" class="core-label" pointer-events="none">Plutchik</text>
    <text x={CX} y={CY + 7} text-anchor="middle" dominant-baseline="middle" class="core-label" pointer-events="none">Wheel</text>
  </svg>
  
  <style>
    .wheel { display: block; overflow: visible; }
  
    .em-label {
      font-family: 'DM Sans', sans-serif;
      font-size: 10.5px;
      font-weight: 500;
      letter-spacing: 0.04em;
      fill: #5A3E28;
      user-select: none;
    }
  
    .core-label {
      font-size: 9px;
      letter-spacing: 0.09em;
      text-transform: uppercase;
      fill: #A08060;
      user-select: none;
    }
  </style>