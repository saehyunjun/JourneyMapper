<script>
  import { hoveredIndex, selectedIndex, hoveredInflectionIndex, selectedInflectionIndex, selectedInflectionPath } from './journeyStore.js';
  import {
    sentimentToColor,
    emotionColor,
    DYAD_BY_ID,
    SCORE_ALIASES,
    ratingToLabel,
    EMOTION_BY_ID
  } from './journeyConfig.js';
  import JourneyEventCard from './JourneyEventCard.svelte';

  export let step;
  export let data = [];
  export let stageColor = '#6b7280';

  function handleClick() {
    selectedIndex.update((i) => (i === step.index ? -1 : step.index));
  }

  $: d       = data[step.index];
  $: infl    = d?.inflection === 'Y';
  $: inflDet = d?.inflection_detail ?? null;

  $: allEvents = (d?.events ?? []).slice().sort((a, b) => a.step_position - b.step_position);

  $: experienceEvents = allEvents.filter(e =>
    ['roadblock', 'hospitalization', 'progress', 'community'].includes(e.type)
  );
  $: sponsorEvents = allEvents.filter(e =>
    ['info_source', 'intervention'].includes(e.type)
  );

  $: hasExperience = experienceEvents.length > 0;
  $: hasSponsor    = sponsorEvents.length > 0;
  $: hasEvents     = hasExperience || hasSponsor;
  $: hasBothTypes  = hasExperience && hasSponsor;

  $: sentimentLabel = ratingToLabel(d?.sentiment);

  $: emotionData = (() => {
    const raw = d?.plutchik_score?.toLowerCase().trim() ?? '';
    if (!raw) return { colors: [], label: '' };
    const dyad = DYAD_BY_ID[raw];
    if (dyad) return { colors: dyad.primary.map(pid => emotionColor(pid)), label: dyad.label };
    const id = SCORE_ALIASES[raw] ?? raw;
    return { colors: [emotionColor(id)], label: EMOTION_BY_ID[id]?.label ?? raw };
  })();

  // ── Fork-bracket geometry (mirrors FlowStageCard vertical constants) ──────
  const LINE_COLOR  = 'var(--midgrayblue)';
  const BRACKET_H   = 28;      // height of the diverge / converge SVG panel
  const CARD_W      = 325;     // width of each event-pill column
  const GAP         = 48;      // gap between the two columns
  const SVG_W       = CARD_W * 2 + GAP;
  const MID_X       = SVG_W / 2;
</script>

<div class="flow-step-slot">

  <!-- ── Step card ─────────────────────────────────────────────────────── -->
  <button
    class="card-sm flow-step-card"
    class:flow-step-card--hovered={$hoveredIndex === step.index}
    class:flow-step-card--selected={$selectedIndex === step.index}
    style="border-color:{stageColor};"    
    onmouseenter={() => { hoveredIndex.set(step.index); hoveredInflectionIndex.set(-1); }}
    onmouseleave={() => hoveredIndex.set(-1)}
    onclick={handleClick}
    aria-pressed={$selectedIndex === step.index}flow-step-card__swatch-wrap
  >
    <div class="flow-step-card__body">
      <div class="flow-step-card__title-row">
        <span class="label uppercase text-center flow-step-card__title">{step.step}</span>
      </div>
    </div>

    <div class="flow-step-card__meta">
      <div class="flow-step-card__meta-item">
        <div class="flow-step-card__swatch-wrap">
          <div
            class="jm-swatch-sm"
            style="background-color:{sentimentToColor(d?.sentiment)};"
          ></div>
        </div>
        <span class="label-xs">{sentimentLabel}</span>
      </div>
      <div class="flow-step-card__meta-item">
        <div class="flow-step-card__swatch-wrap flow-step-card__emotion-wrap">
          {#each emotionData.colors as color}
            <div class="jm-swatch-round-sm flow-step-card__emotion-swatch" style="background:{color};"></div>
          {/each}
        </div>
        <span class="label-xs">{emotionData.label}</span>
      </div>
    </div>
  </button>

  <!-- ── Events: fork layout (both types) or centered single column ──── -->
  {#if hasEvents}

    {#if hasBothTypes}
      <!-- Short stem from card bottom into the diverge bracket -->
      <div class="fork-stem" aria-hidden="true"></div>

      <!-- Diverge bracket SVG -->
      <svg
        class="fork-bracket"
        width={SVG_W}
        height={BRACKET_H}
        viewBox="0 0 {SVG_W} {BRACKET_H}"
        aria-hidden="true"
      >
        <line x1={MID_X}              y1="0"
              x2={MID_X}              y2={BRACKET_H / 2}  stroke={LINE_COLOR} stroke-width="1"/>
        <line x1={CARD_W / 2}         y1={BRACKET_H / 2}
              x2={CARD_W + GAP + CARD_W / 2} y2={BRACKET_H / 2}  stroke={LINE_COLOR} stroke-width="1"/>
        <line x1={CARD_W / 2}         y1={BRACKET_H / 2}
              x2={CARD_W / 2}         y2={BRACKET_H}      stroke={LINE_COLOR} stroke-width="1"/>
        <line x1={CARD_W + GAP + CARD_W / 2} y1={BRACKET_H / 2}
              x2={CARD_W + GAP + CARD_W / 2} y2={BRACKET_H}      stroke={LINE_COLOR} stroke-width="1"/>
      </svg>

      <!-- Two event columns side-by-side -->
      <div class="fork-columns" style="gap:{GAP}px; width:{SVG_W}px;">

        <!-- Left: experience events -->
        <div class="fork-col fork-col--left" style="width:{CARD_W}px;">
          {#if hasExperience}
            <div class="label-sm fork-col__label pt-2" 
              style="color: var(--grayblue);">
              Patient Experience
            </div>
            
            {#each experienceEvents as ev (ev.event_id)}
              <JourneyEventCard event={ev} compact={true} />
            {/each}
          {/if}
        </div>

        <!-- Right: sponsor / info events -->
        <div class="fork-col fork-col--right" style="width:{CARD_W}px;">
          {#if hasSponsor}
            <div class="fork-col__label label-sm pt-2" 
            style="color: var(--grayblue);">
            Sponsor Opportunities
          </div>
            {#each sponsorEvents as ev (ev.event_id)}
              <JourneyEventCard event={ev} compact={true} />
            {/each}
          {/if}
        </div>

      </div>

      <!-- Converge bracket SVG -->
      <svg
        class="fork-bracket"
        width={SVG_W}
        height={BRACKET_H}
        viewBox="0 0 {SVG_W} {BRACKET_H}"
        aria-hidden="true"
      >
        <line x1={CARD_W / 2}         y1="0"
              x2={CARD_W / 2}         y2={BRACKET_H / 2}  stroke={LINE_COLOR} stroke-width="1"/>
        <line x1={CARD_W + GAP + CARD_W / 2} y1="0"
              x2={CARD_W + GAP + CARD_W / 2} y2={BRACKET_H / 2}  stroke={LINE_COLOR} stroke-width="1"/>
        <line x1={CARD_W / 2}         y1={BRACKET_H / 2}
              x2={CARD_W + GAP + CARD_W / 2} y2={BRACKET_H / 2}  stroke={LINE_COLOR} stroke-width="1"/>
        <line x1={MID_X}              y1={BRACKET_H / 2}
              x2={MID_X}              y2={BRACKET_H}      stroke={LINE_COLOR} stroke-width="1"/>
      </svg>

    {:else}
      <!-- Single-type: straight stem + centered column -->
      <div class="fork-stem" aria-hidden="true"></div>
      <div class="single-events-col" style="width:{CARD_W}px;">
        {#if hasExperience}
          
        <div class="label-sm fork-col__label pt-2" 
        style="color: var(--grayblue);">
          Patient Experience
        </div>
          
          {#each experienceEvents as ev (ev.event_id)}
            <JourneyEventCard event={ev} compact={true} />
          {/each}
        {/if}
        {#if hasSponsor}
          <div class="fork-col__label jm-kicker" style="color: #7a4d08;">Sponsor</div>
          {#each sponsorEvents as ev (ev.event_id)}
            <JourneyEventCard event={ev} compact={true} />
          {/each}
        {/if}
      </div>
    {/if}

  {/if}

  <!-- ── Inflection card ───────────────────────────────────────────────── -->
  {#if infl}
    <div class="flow-inflection-connector" aria-hidden="true"></div>
    <button
      class="card flow-inflection-card"
      style="border-color:{stageColor};"
      tabindex="0"
      aria-label="View inflection point{inflDet?.label ? `: ${inflDet.label}` : ''}"
      onmouseenter={() => { hoveredInflectionIndex.set(step.index); hoveredIndex.set(-1); }}
      onmouseleave={() => hoveredInflectionIndex.set(-1)}
      onclick={() => {
        selectedInflectionIndex.set(step.index);
        selectedInflectionPath.set(null);
      }}
      onkeydown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          selectedInflectionIndex.set(step.index);
          selectedInflectionPath.set(null);
        }
      }}
    >
      {#if inflDet}
        <div class="flex flex-row p-2">
          <span class="text-body-sm">{inflDet.label}</span>
        </div>
      {/if}
    </button>
  {/if}

</div>


<style>
  /* ── Outer slot ──────────────────────────────────────────────────────────── */
  .flow-step-slot {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;
  }

  /* ── Step card ───────────────────────────────────────────────────────────── */
  .flow-step-card {
    width: 225px;
    min-height: 110px;
    display: flex;
    flex-direction: column;
    align-items: stretch;
    justify-content: space-between;
    padding: 8px;
    margin-top: 1em;
    gap: 10px;
  }

  .flow-step-card__body {
    flex: 1 1 auto;
    display: flex;
    align-items: flex-start;
    justify-content: center;
  }

  .flow-step-card__title-row {
    width: 100%;
    display: flex;
    justify-content: center;
    align-items: flex-start;
  }

  .flow-step-card__title {
    display: block;
    width: 100%;
    line-height: 1.2;
    text-wrap: balance;
  }

  .flow-step-card__meta {
    margin-top: auto;
    width: 100%;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    align-items: end;
  }

  .flow-step-card__meta-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-end;
    min-width: 0;
    gap: 5px;
  }

  .label-xs {
    font-size: 0.52rem;
    line-height: 1;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--gray, #767676);
    text-align: center;
    white-space: nowrap;
  }

  .flow-step-card__swatch-wrap {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .flow-step-card__emotion-wrap { gap: 0; }

  .flow-step-card__emotion-swatch {
    box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.9);
  }

  /* ── Fork bracket system ─────────────────────────────────────────────────── */

  /* Short vertical stem between the step card and the diverge bracket */
  .fork-stem {
    width: 1px;
    height: 28px;
    border-left: 1.5px dashed rgba(160, 168, 184, 0.7);
    flex-shrink: 0;
    align-self: center;
  }

  .fork-bracket {
    flex-shrink: 0;
    display: block;
    overflow: visible;
  }

  /* Two event-pill columns rendered between the brackets */
  .fork-columns {
    display: flex;
    flex-direction: row;
    align-items: flex-start;
    flex-shrink: 0;
  }

  .fork-col {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-height: 24px; /* keeps column present even when empty */
  }

  /* Experience cards — right-justified so pills sit flush against the gap */
  .fork-col--left {
    align-items: flex-end;
  }

  /* Sponsor cards — left-justified so pills sit flush against the gap */
  .fork-col--right {
    align-items: flex-start;
  }

  .fork-col__label {
    margin-bottom: 2px;
  }

  /* ── Single-type event column (centered, no fork) ────────────────────────── */
  .single-events-col {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    flex-shrink: 0;
  }

  /* ── Inflection card ────────────────────────────────────────────────────────── */
  .flow-inflection-card {
    text-align: left;
    cursor: pointer;
    transition:
      box-shadow 160ms ease,
      transform  160ms ease;
  }

  .flow-inflection-card:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }

  .flow-inflection-card:focus-visible {
    outline: 2px solid var(--purple, #5830a2);
    outline-offset: 2px;
  }

  .flow-inflection-card:active {
    transform: scale(0.98);
  }

  /* ── Inflection connector ────────────────────────────────────────────────── */
  .flow-inflection-connector {
    width: 1px;
    height: 20px;
    border-left: 1.5px dashed #a0a8b8;
    flex-shrink: 0;
    align-self: center;
  }
</style>