<script>
  import { onMount, tick } from 'svelte';
  import { hoveredIndex, selectedIndex } from './journeyStore.js';
  import { sentimentToColor } from './journeyConfig.js';

  /** @type {any[]} */
  export let data = [];

  /**
   * Ref to the flow-diagram scroll container. The rail measures the
   * `.flow-step-slot` elements inside it (in DOM order, which matches the
   * flat `data` array order) to get exact per-step y-positions, so
   * sentiment nodes align to the vertical centre of each step card
   * regardless of how many event cards are present.
   * @type {HTMLElement | null}
   */
  export let flowRef = null;

  // Mirrors .flow-step-card min-height in FlowStepCard.svelte
  const STEP_CARD_H = 110;
  const NODE_CENTER = STEP_CARD_H / 2;

  // ── Horizontal scale: sentiment −5 → +5 mapped to rail x-coordinates ──
  const RAIL_W   = 225;
  const PAD_L    = 0;                     // left padding inside the rail SVG
  const PAD_R    = 0;                     // right padding
  const PLOT_W   = RAIL_W - PAD_L - PAD_R; // usable chart width

  /** Map a sentiment value (−5…+5) to an SVG x-coordinate. */
  function sentimentToX(val) {
    const clamped = Math.max(-5, Math.min(5, parseFloat(val ?? 0)));
    return PAD_L + ((clamped + 5) / 10) * PLOT_W;
  }

  // Grid lines at key sentiment values; 0 is emphasised
  const GRID_LINES = [-5, -4, -3, -2, -1,  0, 1, 2, 3, 4, 5];

  /** Measured y-centres for each step, in rail-container coordinates. */
  let nodeYs = /** @type {(number | null)[]} */ ([]);
  /** Bottom edge of each step slot, used for horizontal divider lines. */
  let slotBottoms = /** @type {(number | null)[]} */ ([]);
  let railHeight = 0;

  /** @type {HTMLElement | null} */
  let railColEl;

  function measure() {
    if (!flowRef || !railColEl) return;

    const ys = /** @type {(number | null)[]} */ (new Array(data.length).fill(null));
    const bots = /** @type {(number | null)[]} */ (new Array(data.length).fill(null));
    const railTop = railColEl.getBoundingClientRect().top;

    const slots = flowRef.querySelectorAll('.flow-step-slot');
    let maxBottom = 0;

    for (let i = 0; i < data.length; i++) {
      const slot = slots[i];
      if (!(slot instanceof HTMLElement)) continue;

      const rect = slot.getBoundingClientRect();
      ys[i] = rect.top - railTop + NODE_CENTER;
      bots[i] = rect.bottom - railTop;

      if (bots[i] > maxBottom) maxBottom = bots[i];
    }

    nodeYs = ys;
    slotBottoms = bots;
    railHeight = maxBottom;
  }

  /** @type {ResizeObserver | undefined} */
  let ro;
  /** @type {MutationObserver | undefined} */
  let mo;
  let mounted = false;

  function setupObservers() {
    if (!flowRef) return;

    ro?.disconnect();
    mo?.disconnect();

    ro = new ResizeObserver(measure);
    ro.observe(flowRef);
    flowRef.querySelectorAll('.flow-step-slot').forEach((el) => ro?.observe(el));

    mo = new MutationObserver(() => {
      flowRef?.querySelectorAll('.flow-step-slot').forEach((el) => ro?.observe(el));
      measure();
    });
    mo.observe(flowRef, { childList: true, subtree: true });

    measure();
  }

  onMount(() => {
    mounted = true;
    setupObservers();
    window.addEventListener('resize', measure);

    return () => {
      ro?.disconnect();
      mo?.disconnect();
      window.removeEventListener('resize', measure);
    };
  });

  // React to flowRef arriving after mount (parent bind:this resolution order)
  $: if (mounted && flowRef) setupObservers();

  // Re-measure whenever data changes (step count / event counts may shift)
  $: if (data && flowRef) {
    tick().then(measure);
  }
</script>

<aside
  class="sentiment-rail"
  role="complementary"
  aria-label="Journey sentiment"
>
  <div class="sentiment-rail__header">
    <span class="label-sm">Sentiment</span>
  </div>

  <div
    class="sentiment-rail__col"
    bind:this={railColEl}
    style="min-height:{railHeight}px;"
  >
    <!-- SVG overlay: vertical line chart with x = sentiment, y = step position -->
    <svg
      class="sentiment-rail__overlay"
      width={RAIL_W}
      height={railHeight}
      viewBox="0 0 {RAIL_W} {railHeight}"
      aria-hidden="true"
    >
      <!-- Sentiment grid lines -->
      {#each GRID_LINES as gv}
        {@const gx = sentimentToX(gv)}
        <line
          x1={gx} y1="0"
          x2={gx} y2={railHeight}
          stroke={gv === 0 ? 'var(--midgrayblue, #a0a8b8)' : 'var(--gray, #e5e5e5)'}
          stroke-width={gv === 0 ? 1 : 0.25}
          stroke-dasharray={gv === 0 ? '4 3' : 'none'}
        />
      {/each}

      <!-- Horizontal step dividers (drawn at the bottom edge of each slot except the last) -->
      {#each slotBottoms as bot, i}
        {#if bot != null && i < data.length - 1}
          <line
            x1={PAD_L} y1={bot}
            x2={RAIL_W - PAD_R} y2={bot}
            stroke="var(--gray)"
            stroke-width="0.25"
          />
        {/if}
      {/each}

      <!-- Straight segments between consecutive nodes -->
      {#each nodeYs as y, i}
        {#if i > 0 && nodeYs[i - 1] != null && y != null}
          <line
            x1={sentimentToX(data[i - 1]?.sentiment)}
            y1={nodeYs[i - 1]}
            x2={sentimentToX(data[i]?.sentiment)}
            y2={y}
            stroke="var(--grayblue, #a0a8b8)"
            stroke-width="2.25"
          />
        {/if}
      {/each}

      <!-- Nodes: circles at each step's sentiment position -->
      {#each nodeYs as y, i}
        {#if y != null && data[i]}
          <circle
            cx={sentimentToX(data[i]?.sentiment)}
            cy={y}
            r={$selectedIndex === i ? 12 : $hoveredIndex === i ? 12 : 6}
            fill={sentimentToColor(data[i]?.sentiment)}
            stroke="var(--panel, #fff)"
            stroke-width="2.25"
            style="transition: r 160ms ease, cx 260ms ease;"
          />
        {/if}
      {/each}
    </svg>
  </div>
</aside>


<style>
  .sentiment-rail {
    flex-shrink: 0;
    width: 225px;
    max-width: 15vw;
    display: flex;
    flex-direction: column;
    border-left: 1px solid var(--hairline, #e5e5e5);
    background: var(--paper, #fff);
  }

  .sentiment-rail__header {
    padding: 0.75rem 1rem;
    border-bottom: 1px solid var(--hairline, #e5e5e5);
    display: flex;
    align-items: center;
    justify-content: flex-start;
  }

  .sentiment-rail__col {
    position: relative;
    flex: 1;
    width: 100%;
  }

  .sentiment-rail__overlay {
    position: absolute;
    top: 0;
    left: 0;
    pointer-events: none;
  }
</style>