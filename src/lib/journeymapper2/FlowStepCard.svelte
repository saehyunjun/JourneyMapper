<script>
  import { hoveredIndex, selectedIndex, hoveredInflectionIndex } from './journeyStore.js';
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

  $: d = data[step.index];
  $: infl = d?.inflection === 'Y';
  $: inflDet = d?.inflection_detail ?? null;

  $: events = (d?.events ?? []).slice().sort((a, b) => a.step_position - b.step_position);
  $: hasEvents = events.length > 0;

  // ── Sentiment label from config ───────────────────────────────
  $: sentimentLabel = ratingToLabel(d?.sentiment);

  // ── Emotion resolution (color + label) ────────────────────────
  $: emotionData = (() => {
    const raw = d?.plutchik_score?.toLowerCase().trim() ?? '';
    if (!raw) return { colors: [], label: '' };

    const dyad = DYAD_BY_ID[raw];
    if (dyad) {
      return {
        colors: dyad.primary.map((pid) => emotionColor(pid)),
        label: dyad.label
      };
    }

    const id = SCORE_ALIASES[raw] ?? raw;

    return {
      colors: [emotionColor(id)],
      label: EMOTION_BY_ID[id]?.label ?? raw
    };
  })();
</script>

<div class="flow-step-slot">
  <button
    class="card-sm flow-step-card"
    class:flow-step-card--hovered={$hoveredIndex === step.index}
    class:flow-step-card--selected={$selectedIndex === step.index}
    onmouseenter={() => {
      hoveredIndex.set(step.index);
      hoveredInflectionIndex.set(-1);
    }}
    onmouseleave={() => hoveredIndex.set(-1)}
    onclick={handleClick}
    aria-pressed={$selectedIndex === step.index}
  >
    <div class="flow-step-card__body">
      <div class="flow-step-card__title-row">
        <span class="label uppercase text-center flow-step-card__title">
          {step.step}
        </span>
      </div>
    </div>

    <!-- ── Bottom metadata row ─────────────────────────────────── -->
    <div class="flow-step-card__meta">
      <!-- Sentiment -->
      <div class="flow-step-card__meta-item">
        <span class="flow-step-card__meta-label">{sentimentLabel}</span>
        <div class="flow-step-card__swatch-wrap">
          <div
            class="jm-swatch flow-step-card__sentiment-swatch"
            style="background-color:{sentimentToColor(d?.sentiment)};"
          ></div>
        </div>
      </div>

      <!-- Emotion -->
      <div class="flow-step-card__meta-item">
        <span class="flow-step-card__meta-label">{emotionData.label}</span>
        <div class="flow-step-card__swatch-wrap flow-step-card__emotion-wrap">
          {#if emotionData.colors.length}
            {#each emotionData.colors as color}
              <div
                class="jm-swatch-round-sm flow-step-card__emotion-swatch"
                style="background:{color};"
              ></div>
            {/each}
          {/if}
        </div>
      </div>
    </div>
  </button>

  {#if hasEvents}
    <div class="event-connector"></div>
    <div class="event-cluster">
      {#each events as ev (ev.event_id)}
        <JourneyEventCard
          type={ev.type}
          label={ev.label}
          shortLabel={ev.short_label}
          tooltip={ev.tooltip ?? ''}
          compact={true}
        />
      {/each}
    </div>
  {/if}

  {#if infl}
    <div class="flow-inflection-connector"></div>
    <div
      class="card"
      style="border-color:{stageColor};"
      onmouseenter={() => {
        hoveredInflectionIndex.set(step.index);
        hoveredIndex.set(-1);
      }}
      onmouseleave={() => hoveredInflectionIndex.set(-1)}
    >
      {#if inflDet}
        <div class="flex flex-row p-2">
          <span class="text-body-sm">{inflDet.label}</span>
        </div>
      {/if}
    </div>
  {/if}
</div>


<style>
  .flow-step-slot {
    display: flex;
    flex-direction: column;
    align-items: center;
    place-items: center;
    place-content: center;
    justify-content: center;
  }

  .flow-step-card {
    width: 225px;
    min-height: 110px;
    display: flex;
    flex-direction: column;
    align-items: stretch;
    justify-content: space-between;
    padding: 8px;
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

  .flow-step-card__meta-label {
    font-size: 0.52rem;
    line-height: 1;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--gray, #767676);
    text-align: center;
    white-space: nowrap;
  }

  .flow-step-card__swatch-wrap {
    min-height: 22px;
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .flow-step-card__sentiment-swatch {
    width: 100%;
    max-width: 56px;
    height: 10px;
    border-radius: 999px;
  }

  .flow-step-card__emotion-wrap {
    gap: 0;
  }

  .flow-step-card__emotion-swatch {
    box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.9);
  }

  .flow-step-card__emotion-placeholder {
    width: 24px;
    height: 10px;
  }

  /* Event cluster */

  .event-connector {
    width: 1px;
    height: 14px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    border-left: 1.5px dashed rgba(160, 168, 184, 0.6);
    flex-shrink: 0;
  }

  .event-cluster {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
    width: 180px;
  }

  /* Inflection */

  .flow-inflection-connector {
    width: 2px;
    height: 20px;
    border-left: 1.5px dashed #a0a8b8;
    flex-shrink: 0;
  }

  .flow-inflection-card--hovered {
    background-color: var(--panel);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08), 0 0 0 1px rgba(63, 115, 255, 0.18);
  }

  .flow-inflection-card--selected {
    opacity: 1;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  }

  .infl-placeholder-empty {
    font-size: 0.5rem;
    color: #a0a8b8;
    font-style: italic;
  }
</style>