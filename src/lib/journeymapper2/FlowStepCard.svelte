<script>
  import { hoveredIndex, selectedIndex, hoveredInflectionIndex } from './journeyStore.js';
  import { sentimentToColor, emotionColor, DYAD_BY_ID, SCORE_ALIASES } from './journeyConfig.js';

  /** The step data object from the journey array */
  export let step;          // { step: string, step_id: string, index: number }

  /** Full data array — needed to read inflection_detail at this index */
  export let data = [];

  /** The stage accent color (hex) for border and index label */
  export let stageColor = '#6b7280';

  /**
   * Layout orientation forwarded from the diagram.
   * 'horizontal' — inflection card hangs below (default)
   * 'vertical'   — inflection card sits to the right
   */
  export let layout = 'horizontal';

  $: isVertical = layout === 'vertical';

  function handleClick() {
    selectedIndex.update(i => i === step.index ? -1 : step.index);
  }

  $: d       = data[step.index];
  $: infl    = d?.inflection === 'Y';
  $: inflDet = d?.inflection_detail ?? null;

  // Resolve plutchik_score → one or two primary emotion colors
  $: emotionSwatches = (() => {
    const raw = d?.plutchik_score?.toLowerCase().trim() ?? '';
    if (!raw) return [];
    const dyad = DYAD_BY_ID[raw];
    if (dyad) return dyad.primary.map(pid => emotionColor(pid));
    const id = SCORE_ALIASES[raw] ?? raw;
    return [emotionColor(id)];
  })();
</script>

<!--
  In horizontal mode: step card stacks vertically with inflection below.
  In vertical mode:   step card sits in a row with inflection to the right,
                      and the whole slot is laid out horizontally so it reads
                      left-to-right within the vertical stage band.
-->
<div
  class="flow-step-slot"
  class:flow-step-slot--vertical={isVertical}
>

  <!-- Step card -->
  <button
    class="card-sm"
    class:flow-step-card--hovered={$hoveredIndex === step.index}
    class:flow-step-card--selected={$selectedIndex === step.index}
    style="border-bottom-color:{stageColor};"
    on:mouseenter={() => { hoveredIndex.set(step.index); hoveredInflectionIndex.set(-1); }}
    on:mouseleave={() => hoveredIndex.set(-1)}
    on:click={handleClick}
    aria-pressed={$selectedIndex === step.index}
  >
    <span class="flex flex-row w-full justify-between -my-1">
      <div
        class="w-16 h-2 ring-1"
        style="background-color:{sentimentToColor(d?.sentiment)};"
        aria-label="Sentiment: {d?.sentiment}"
      >
      </div>

      <!-- Emotion swatches -->
      {#if emotionSwatches.length}
        <div class="flex flex-row" aria-label="Emotion: {d?.plutchik_score}">
          {#each emotionSwatches as color}
            <div class="w-3 h-3 rounded-full ring-1"
              style="background:{color};">
            </div>
          {/each}
        </div>
      {/if}
    </span>

    <div class="flex flex-row p-2">
      <span class="text-body-lg">
        {step.step}
      </span>
    </div>
  </button>

  <!-- Inflection connector + card -->
  {#if infl}
    <!--
      Horizontal: dashed vertical line dropping down to the inflection card.
      Vertical:   dashed horizontal line extending right to the inflection card.
    -->
    <div
      class="flow-inflection-connector px-2"
      class:flow-inflection-connector--vertical={isVertical}
      aria-hidden="true"
    ></div>

    <div
      class="card-sm bg-slate-100"
      class:flow-inflection-card--hovered={$hoveredInflectionIndex === step.index}
      class:flow-inflection-card--selected={$selectedIndex === step.index}
      style="border-bottom-color:{stageColor};"
      role="region"
      aria-label="Inflection point: {d?.step}"
      on:mouseenter={() => { hoveredInflectionIndex.set(step.index); hoveredIndex.set(-1); }}
      on:mouseleave={() => hoveredInflectionIndex.set(-1)}
    >
      {#if inflDet}
        <div class="flex flex-row p-2">
          <span class="text-body-sm">{inflDet.label}</span>
        </div>
      {:else}
        <span class="infl-placeholder-empty label-heading">Inflection point</span>
      {/if}
    </div>
  {/if}

</div>

<style>
  /* ── Slot wrapper ─────────────────────────────────────────────────────── */

  /* Horizontal (default): step card on top, inflection below */
  .flow-step-slot {
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  /* Vertical: step card on the left, inflection to the right */
  .flow-step-slot--vertical {
    flex-direction: row;
    align-items: flex-start;
  }

  /* ── Inflection connector ─────────────────────────────────────────────── */

  /* Default: vertical dashed line dropping down */
  .flow-inflection-connector {
    width: 1px;
    height: 20px;
    border-left: 1.5px dashed #a0a8b8;
    flex-shrink: 0;
  }

  /* Vertical layout: horizontal dashed line extending right */
  .flow-inflection-connector--vertical {
    width: 20px;
    height: 1px;
    border-left: none;
    border-top: 1.5px dashed #a0a8b8;
    align-self: center;
  }

  .flow-inflection-card--hovered {
    background-color: #eaeff8;
    box-shadow: 0 2px 8px rgba(0,0,0,0.08), 0 0 0 1px rgba(63,115,255,0.18);
  }

  .flow-inflection-card--selected {
    opacity: 1;
    box-shadow: 0 2px 8px rgba(0,0,0,0.08);
  }


  .infl-placeholder-empty {
    font-size: 0.5rem;
    color: #a0a8b8;
    font-style: italic;
  }
</style>