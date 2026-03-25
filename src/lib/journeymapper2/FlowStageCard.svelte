<script>
  import { createEventDispatcher } from 'svelte';
  import FlowStepCard  from './FlowStepCard.svelte';
  import FlowConnector from './FlowConnector.svelte';
  import { selectedInflectionIndex, selectedInflectionPath } from './journeyStore.js';

  const dispatch = createEventDispatcher();

  /** Stage group object: { stage_id, stage, steps[] } */
  export let group;

  /** Full journey data array — passed through to FlowStepCard */
  export let data = [];

  /** Accent color for this stage (hex) */
  export let stageColor = '#6b7280';

  /**
   * When true the stage header pill is hidden.
   * Used in vertical layout where the stage label lives in the left rail instead.
   */
  export let hideHeader = false;

  /**
   * Layout orientation forwarded from JourneyFlowDiagram.
   * 'horizontal' — step cards in a horizontal row (default)
   * 'vertical'   — step cards stacked top-to-bottom
   */
  export let layout = 'horizontal';

  $: isVertical = layout === 'vertical';

  // ── Inflection card hover state ────────────────────────────────────────────
  /** Tracks which path card the cursor is over: `${stepIndex}-${'pos'|'neg'}` or null */
  let hoveredPathKey = null;

  function handlePathMouseEnter(key) { hoveredPathKey = key; }
  function handlePathMouseLeave()    { hoveredPathKey = null; }

  /**
   * Click a fork path card: write to stores and dispatch so the page
   * can open the inflection drawer.
   */
  function handlePathClick(stepIndex, direction) {
    selectedInflectionIndex.set(stepIndex);
    selectedInflectionPath.set(direction);
    dispatch('openInflectionDrawer', { index: stepIndex, direction });
  }

  // ── Inflection fork helpers ────────────────────────────────────────────────

  /** Returns true when the step should render as a fork wrapper. */
  function hasFork(step) {
    return !!(data[step.index]?.inflection_detail?.paths?.length);
  }

  /** Pull pos/neg path objects from the step's inflection_detail. */
  function getPaths(step) {
    const paths = data[step.index]?.inflection_detail?.paths ?? [];
    const pos = paths.find(p => p.direction === 'positive') ?? paths[0] ?? null;
    const neg = paths.find(p => p.direction === 'negative') ?? paths[1] ?? null;
    return { pos, neg };
  }

  // ── Colours ────────────────────────────────────────────────────────────────
  const POS_COLOR  = '#23abab';
  const NEG_COLOR  = '#e05c5c';
  const LINE_COLOR = 'rgba(160,168,184,0.7)';

  // ── Horizontal fork geometry ───────────────────────────────────────────────
  // Brackets are left/right SVG panels; path cards stack vertically inside.
  const H_BRACKET_W = 50;
  const H_CARD_H    = 90;
  const H_CARD_W    = 160;
  const H_GAP       = 20;
  const H_SVG_H     = H_CARD_H * 2 + H_GAP;
  const H_MID_Y     = H_SVG_H / 2;

  // ── Vertical fork geometry ─────────────────────────────────────────────────
  // Brackets are top/bottom SVG panels; path cards are placed side-by-side.
  const V_BRACKET_H = 28;
  const V_CARD_W    = 160;
  const V_CARD_H    = 100;
  const V_GAP       = 8;
  const V_SVG_W     = V_CARD_W * 2 + V_GAP;
  const V_MID_X     = V_SVG_W / 2;
</script>

<div class="flow-stage" class:flow-stage--vertical={isVertical}>

  <!-- Stage header — hidden in vertical mode (label lives in the left rail) -->
  {#if !hideHeader}
    <div class="section-header" style="background-color:{stageColor};">
      <span class="label-heading" style="color:#fff">{group.stage}</span>
      <span class="flow-stage-count label-heading" style="color:rgba(255,255,255,0.65);">{group.stage_id}</span>
    </div>
  {/if}

  <!-- Steps row / column -->
  <div class="flow-steps-row" class:flow-steps-col={isVertical}>
    {#each group.steps as step, si}

      {#if hasFork(step)}
        <!-- ══════════════════════════════════════════════════════════════════
             INFLECTION FORK SLOT
             Horizontal: slot is flex-col — step card on top, fork below.
             Vertical:   slot is flex-row — step card on left, fork to the right.
             The slot participates in the parent flow row/column as one unit.
        ═══════════════════════════════════════════════════════════════════ -->
        {@const { pos, neg } = getPaths(step)}

        <div class="fork-slot" class:fork-slot--vertical={isVertical}>

          <!-- Standard step card — unchanged -->
          <FlowStepCard {step} {data} {stageColor} {layout} />

          <!-- Short connector from step card into the fork -->
          <div class="fork-stem" class:fork-stem--vertical={isVertical} aria-hidden="true" />

          <!-- Fork block: diverge bracket · path cards · converge bracket -->
          <div class="fork-body" class:fork-body--vertical={isVertical}>

            {#if !isVertical}
              <!-- ══ HORIZONTAL: path cards stacked top (pos) / bottom (neg) ══ -->

              <!-- Diverge bracket (left) -->
              <svg class="fork-bracket-h" width={H_BRACKET_W} height={H_SVG_H}
                   viewBox="0 0 {H_BRACKET_W} {H_SVG_H}" aria-hidden="true">
                <line x1="0"             y1={H_MID_Y}
                      x2={H_BRACKET_W/2} y2={H_MID_Y}                          stroke={LINE_COLOR} stroke-width="1"/>
                <line x1={H_BRACKET_W/2} y1={H_CARD_H/2}
                      x2={H_BRACKET_W/2} y2={H_CARD_H + H_GAP + H_CARD_H/2}   stroke={LINE_COLOR} stroke-width="1"/>
                <line x1={H_BRACKET_W/2} y1={H_CARD_H/2}
                      x2={H_BRACKET_W}   y2={H_CARD_H/2}                       stroke={LINE_COLOR} stroke-width="1"/>
                <line x1={H_BRACKET_W/2} y1={H_CARD_H + H_GAP + H_CARD_H/2}
                      x2={H_BRACKET_W}   y2={H_CARD_H + H_GAP + H_CARD_H/2}   stroke={LINE_COLOR} stroke-width="1"/>
              </svg>

              <!-- Path cards -->
              <div class="fork-cards-h" style="gap:{H_GAP}px;">
                <div class="fork-path-card fork-path-card--pos"
                     class:fork-path-card--hovered={hoveredPathKey === `${step.index}-pos`}
                     style="border-color:{POS_COLOR}44; width:{H_CARD_W}px; min-height:{H_CARD_H}px;"
                     role="button"
                     tabindex="0"
                     aria-label="Open positive inflection path"
                     on:mouseenter={() => handlePathMouseEnter(`${step.index}-pos`)}
                     on:mouseleave={handlePathMouseLeave}
                     on:click={() => handlePathClick(step.index, 'positive')}
                     on:keydown={e => e.key === 'Enter' && handlePathClick(step.index, 'positive')}>
                  <span class="fork-path-tag" style="color:{POS_COLOR}; background:{POS_COLOR}18;">↑ Positive</span>
                  {#if pos?.label}<span class="fork-path-label">{pos.label}</span>{/if}
                  {#if pos?.outcome}<p class="fork-path-outcome">{pos.outcome}</p>{/if}
                </div>
                <div class="fork-path-card fork-path-card--neg"
                     class:fork-path-card--hovered={hoveredPathKey === `${step.index}-neg`}
                     style="border-color:{NEG_COLOR}44; width:{H_CARD_W}px; min-height:{H_CARD_H}px;"
                     role="button"
                     tabindex="0"
                     aria-label="Open negative inflection path"
                     on:mouseenter={() => handlePathMouseEnter(`${step.index}-neg`)}
                     on:mouseleave={handlePathMouseLeave}
                     on:click={() => handlePathClick(step.index, 'negative')}
                     on:keydown={e => e.key === 'Enter' && handlePathClick(step.index, 'negative')}>
                  <span class="fork-path-tag" style="color:{NEG_COLOR}; background:{NEG_COLOR}18;">↓ Negative</span>
                  {#if neg?.label}<span class="fork-path-label">{neg.label}</span>{/if}
                  {#if neg?.outcome}<p class="fork-path-outcome">{neg.outcome}</p>{/if}
                </div>
              </div>

              <!-- Converge bracket (right) -->
              <svg class="fork-bracket-h" width={H_BRACKET_W} height={H_SVG_H}
                   viewBox="0 0 {H_BRACKET_W} {H_SVG_H}" aria-hidden="true">
                <line x1="0"             y1={H_CARD_H/2}
                      x2={H_BRACKET_W/2} y2={H_CARD_H/2}                       stroke={LINE_COLOR} stroke-width="1"/>
                <line x1="0"             y1={H_CARD_H + H_GAP + H_CARD_H/2}
                      x2={H_BRACKET_W/2} y2={H_CARD_H + H_GAP + H_CARD_H/2}   stroke={LINE_COLOR} stroke-width="1"/>
                <line x1={H_BRACKET_W/2} y1={H_CARD_H/2}
                      x2={H_BRACKET_W/2} y2={H_CARD_H + H_GAP + H_CARD_H/2}   stroke={LINE_COLOR} stroke-width="1"/>
                <line x1={H_BRACKET_W/2} y1={H_MID_Y}
                      x2={H_BRACKET_W}   y2={H_MID_Y}                          stroke={LINE_COLOR} stroke-width="1"/>
              </svg>

            {:else}
              <!-- ══ VERTICAL: cards side-by-side (pos left, neg right), brackets above/below ══ -->

              <!-- Diverge bracket (top) -->
              <svg class="fork-bracket-v" width={V_SVG_W} height={V_BRACKET_H}
                   viewBox="0 0 {V_SVG_W} {V_BRACKET_H}" aria-hidden="true">
                <line x1={V_MID_X}                        y1="0"
                      x2={V_MID_X}                        y2={V_BRACKET_H/2}   stroke={LINE_COLOR} stroke-width="1"/>
                <line x1={V_CARD_W/2}                     y1={V_BRACKET_H/2}
                      x2={V_CARD_W + V_GAP + V_CARD_W/2}  y2={V_BRACKET_H/2}   stroke={LINE_COLOR} stroke-width="1"/>
                <line x1={V_CARD_W/2}                     y1={V_BRACKET_H/2}
                      x2={V_CARD_W/2}                     y2={V_BRACKET_H}     stroke={LINE_COLOR} stroke-width="1"/>
                <line x1={V_CARD_W + V_GAP + V_CARD_W/2}  y1={V_BRACKET_H/2}
                      x2={V_CARD_W + V_GAP + V_CARD_W/2}  y2={V_BRACKET_H}    stroke={LINE_COLOR} stroke-width="1"/>
              </svg>

              <!-- Path cards side-by-side (pos left, neg right) -->
              <div class="fork-cards-v" style="gap:{V_GAP}px;">
                <div class="fork-path-card fork-path-card--pos"
                     class:fork-path-card--hovered={hoveredPathKey === `${step.index}-pos`}
                     style="border-color:{POS_COLOR}44; width:{V_CARD_W}px; min-height:{V_CARD_H}px;"
                     role="button"
                     tabindex="0"
                     aria-label="Open positive inflection path"
                     on:mouseenter={() => handlePathMouseEnter(`${step.index}-pos`)}
                     on:mouseleave={handlePathMouseLeave}
                     on:click={() => handlePathClick(step.index, 'positive')}
                     on:keydown={e => e.key === 'Enter' && handlePathClick(step.index, 'positive')}>
                  <span class="fork-path-tag" style="color:{POS_COLOR}; background:{POS_COLOR}18;">↑ Positive</span>
                  {#if pos?.label}<span class="fork-path-label">{pos.label}</span>{/if}
                  {#if pos?.outcome}<p class="fork-path-outcome">{pos.outcome}</p>{/if}
                </div>
                <div class="fork-path-card fork-path-card--neg"
                     class:fork-path-card--hovered={hoveredPathKey === `${step.index}-neg`}
                     style="border-color:{NEG_COLOR}44; width:{V_CARD_W}px; min-height:{V_CARD_H}px;"
                     role="button"
                     tabindex="0"
                     aria-label="Open negative inflection path"
                     on:mouseenter={() => handlePathMouseEnter(`${step.index}-neg`)}
                     on:mouseleave={handlePathMouseLeave}
                     on:click={() => handlePathClick(step.index, 'negative')}
                     on:keydown={e => e.key === 'Enter' && handlePathClick(step.index, 'negative')}>
                  <span class="fork-path-tag" style="color:{NEG_COLOR}; background:{NEG_COLOR}18;">↓ Negative</span>
                  {#if neg?.label}<span class="fork-path-label">{neg.label}</span>{/if}
                  {#if neg?.outcome}<p class="fork-path-outcome">{neg.outcome}</p>{/if}
                </div>
              </div>

              <!-- Converge bracket (bottom) -->
              <svg class="fork-bracket-v" width={V_SVG_W} height={V_BRACKET_H}
                   viewBox="0 0 {V_SVG_W} {V_BRACKET_H}" aria-hidden="true">
                <line x1={V_CARD_W/2}                     y1="0"
                      x2={V_CARD_W/2}                     y2={V_BRACKET_H/2}   stroke={LINE_COLOR} stroke-width="1"/>
                <line x1={V_CARD_W + V_GAP + V_CARD_W/2}  y1="0"
                      x2={V_CARD_W + V_GAP + V_CARD_W/2}  y2={V_BRACKET_H/2}  stroke={LINE_COLOR} stroke-width="1"/>
                <line x1={V_CARD_W/2}                     y1={V_BRACKET_H/2}
                      x2={V_CARD_W + V_GAP + V_CARD_W/2}  y2={V_BRACKET_H/2}  stroke={LINE_COLOR} stroke-width="1"/>
                <line x1={V_MID_X}                        y1={V_BRACKET_H/2}
                      x2={V_MID_X}                        y2={V_BRACKET_H}     stroke={LINE_COLOR} stroke-width="1"/>
              </svg>

            {/if}
          </div><!-- /fork-body -->
        </div><!-- /fork-slot -->

        {#if si < group.steps.length - 1}
          <FlowConnector variant="step" {layout} />
        {/if}

      {:else}
        <!-- ── Normal step ──────────────────────────────────────────────── -->
        <FlowStepCard {step} {data} {stageColor} {layout} />

        {#if si < group.steps.length - 1}
          <FlowConnector variant="step" {layout} />
        {/if}

      {/if}

    {/each}
  </div>

</div>

<style>
  .flow-stage {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .flow-stage--vertical { gap: 0; }
  .flow-stage-count { opacity: 0.8; }

  /* ── Steps row / col ─────────────────────────────────────────────────── */
  .flow-steps-row {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: center;
    padding: 1em;
    gap: 0;
  }
  .flow-steps-col {
    flex-direction: column;
    align-items: center;
    padding: 0.75rem 1rem;
    gap: 0;
  }

  /* ══════════════════════════════════════════════════════════════════════
     FORK SLOT — groups the step card + fork as one unit in the flow
  ════════════════════════════════════════════════════════════════════ */

  /* Horizontal: step card on left, fork block to the right — slot is a row */
  .fork-slot {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  /* Vertical: step card on top, fork block below — slot is a column */
  .fork-slot--vertical {
    flex-direction: column;
    align-items: center;
  }

  /* Short connecting line between the step card and the fork block */
  .fork-stem {
    /* Horizontal: short horizontal dashed line extending right */
    width: 16px;
    height: 1px;
    border-top: 1.5px dashed rgba(160,168,184,0.7);
    flex-shrink: 0;
  }
  .fork-stem--vertical {
    /* Vertical: short vertical dashed line dropping down */
    width: 1px;
    height: 16px;
    border-top: none;
    border-left: 1.5px dashed rgba(160,168,184,0.7);
    align-self: center;
  }

  /* ── Fork body — holds brackets + path cards ─────────────────────────── */
  .fork-body {
    display: flex;
    flex-direction: row;
    align-items: center;
  }
  .fork-body--vertical {
    /* top bracket → cards row → bottom bracket */
    flex-direction: column;
    align-items: center;
  }

  /* ── SVG bracket panels ──────────────────────────────────────────────── */
  .fork-bracket-h {
    flex-shrink: 0;
    display: block;
    overflow: visible;
    align-self: center;
  }
  .fork-bracket-v {
    flex-shrink: 0;
    display: block;
    overflow: visible;
  }

  /* ── Path card containers ────────────────────────────────────────────── */
  .fork-cards-h {
    display: flex;
    flex-direction: column;
    flex-shrink: 0;
    align-self: center;
  }
  .fork-cards-v {
    display: flex;
    flex-direction: row;
    flex-shrink: 0;
  }

  /* ── Individual path cards ───────────────────────────────────────────── */
  .fork-path-card {
    border: 1px solid;
    border-radius: 5px;
    padding: 7px 9px;
    display: flex;
    flex-direction: column;
    gap: 3px;
    overflow: hidden;
    flex-shrink: 0;
    box-sizing: border-box;
    cursor: pointer;
    transition: box-shadow 0.15s ease, transform 0.15s ease, filter 0.15s ease;
  }
  .fork-path-card:hover,
  .fork-path-card--hovered {
    transform: translateY(-1px);
    filter: brightness(0.97);
  }
  .fork-path-card--pos { background: rgba(35,171,171,0.05); }
  .fork-path-card--pos:hover,
  .fork-path-card--pos.fork-path-card--hovered {
    background: rgba(35,171,171,0.11);
    box-shadow: 0 0 0 1.5px rgba(35,171,171,0.35), 0 2px 6px rgba(35,171,171,0.15);
  }
  .fork-path-card--neg { background: rgba(224,92,92,0.05);  }
  .fork-path-card--neg:hover,
  .fork-path-card--neg.fork-path-card--hovered {
    background: rgba(224,92,92,0.11);
    box-shadow: 0 0 0 1.5px rgba(224,92,92,0.35), 0 2px 6px rgba(224,92,92,0.15);
  }

  .fork-path-tag {
    font-size: 0.5rem;
    font-weight: 700;
    letter-spacing: 0.07em;
    text-transform: uppercase;
    font-family: var(--font-mono);
    padding: 1px 5px;
    border-radius: 3px;
    width: fit-content;
    flex-shrink: 0;
  }
  .fork-path-label {
    font-size: 0.68rem;
    font-weight: 600;
    color: var(--ink, #312F28);
    line-height: 1.2;
    flex-shrink: 0;
  }
  .fork-path-outcome {
    font-size: 0.58rem;
    color: var(--ink-muted, #73726c);
    line-height: 1.35;
    margin: 0;
    overflow: hidden;
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
  }
</style>