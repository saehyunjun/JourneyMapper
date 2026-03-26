<script>
  import { hoveredIndex, selectedIndex, hoveredInflectionIndex } from './journeyStore.js';
  import { sentimentToColor, emotionColor, DYAD_BY_ID, SCORE_ALIASES } from './journeyConfig.js';
  import JourneyEventCard from './JourneyEventCard.svelte';

  /** The step data object from the journey array */
  export let step;          // { step: string, step_id: string, index: number }

  /** Full data array — needed to read inflection_detail at this index */
  export let data = [];

  /** The stage accent color (hex) for border and index label */
  export let stageColor = '#6b7280';

  function handleClick() {
    selectedIndex.update(i => i === step.index ? -1 : step.index);
  }

  $: d       = data[step.index];
  $: infl    = d?.inflection === 'Y';
  $: inflDet = d?.inflection_detail ?? null;

  /** Events attached to this step, sorted by step_position */
  $: events  = (d?.events ?? []).slice().sort((a, b) => a.step_position - b.step_position);
  $: hasEvents = events.length > 0;

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

<div class="flow-step-slot">

  <!-- ── Step card ────────────────────────────────────────────────────────── -->
  <button
    class="card-sm"
    class:flow-step-card--hovered={$hoveredIndex === step.index}
    class:flow-step-card--selected={$selectedIndex === step.index}
    on:mouseenter={() => { hoveredIndex.set(step.index); hoveredInflectionIndex.set(-1); }}
    on:mouseleave={() => hoveredIndex.set(-1)}
    on:click={handleClick}
    aria-pressed={$selectedIndex === step.index}
  >
    <span class="flex flex-row w-full justify-between -my-1">
      <div
        class="jm-emotion -mx-1"
        style="background-color:{sentimentToColor(d?.sentiment)};"
        aria-label="Sentiment: {d?.sentiment}"
      ></div>

      <!-- Emotion swatches -->
      {#if emotionSwatches.length}
        <div class="flex flex-row -mx-1" aria-label="Emotion: {d?.plutchik_score}">
          {#each emotionSwatches as color}
            <div class="w-3 h-3 rounded-full ring-1"
                 style="background:{color};">
            </div>
          {/each}
        </div>
      {/if}
    </span>

    <div class="flex flex-row p-2">
      <span class="text-body">
        {step.step}
      </span>
    </div>
  </button>

  <!-- ── Event pills ──────────────────────────────────────────────────────── -->
  {#if hasEvents}
    <div class="event-connector" aria-hidden="true"></div>

    <div
      class="event-cluster"
      role="list"
      aria-label="Events at this step"
    >
      {#each events as ev (ev.event_id)}
        <div role="listitem">
          <JourneyEventCard
            type={ev.type}
            label={ev.label}
            shortLabel={ev.short_label}
            tooltip={ev.tooltip ?? ''}
            compact={true}
          />
        </div>
      {/each}
    </div>
  {/if}

  <!-- ── Inflection connector + card ─────────────────────────────────────── -->
  {#if infl}
    <div class="flow-inflection-connector" aria-hidden="true"></div>
    <div
      class="card"
      class:flow-inflection-card--hovered={$hoveredInflectionIndex === step.index}
      class:flow-inflection-card--selected={$selectedIndex === step.index}
      style="border-color:{stageColor};"
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
  .flow-step-slot {
    display: flex;
    flex-direction: column;
    align-items: top;
    justify-content: center;
  } 

  /* ── Event cluster ─────────────────────────────────────────────────────── */

  /* Short connector from step card down to the event cluster */
  .event-connector {
    width: 1px;
    height: 14px;
    border-left: 1.5px dashed rgba(160, 168, 184, 0.6);
    flex-shrink: 0;
  }

  /* Wraps all pill cards for this step — stacks vertically, left-aligned */
  .event-cluster {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
    /* Constrain width to match the step card; pills truncate via their own overflow */
    width: 180px;
  }

  /* ── Inflection ────────────────────────────────────────────────────────── */
  .flow-inflection-connector {
    width: 2px;
    height: 20px;
    border-left: 1.5px dashed #a0a8b8;
    flex-shrink: 0;
  }

  .flow-inflection-card--hovered {
    background-color: var(--panel);
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