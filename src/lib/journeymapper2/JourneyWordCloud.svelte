<script lang="ts">
  import { onMount } from 'svelte';
  import cloud from 'd3-cloud';
  import * as d3 from 'd3';

  import wordcloudData from './journeyPersonaWordclouds.json';

  type WordDatum = {
    text: string;
    value: number;
    size: number;
    sentiment: 'positive' | 'negative';
    persona_id: string;
    persona_name: string;
    stage_id: string;
    stage: string;
    step_id: string;
    step: string;
  };

  type StepDatum = {
    stage_id: string;
    stage: string;
    step_id: string;
    step: string;
    sentiment_score?: number;
    positiveDrivers: WordDatum[];
    negativeDrivers: WordDatum[];
    words: WordDatum[];
  };

  type PersonaDatum = {
    persona_id: string;
    persona_name: string;
    persona_type?: string;
    steps: StepDatum[];
  };

  type CloudWord = WordDatum & {
    x?: number;
    y?: number;
    rotate?: number;
    font?: string;
  };

  const data = wordcloudData as PersonaDatum[];

  let selectedPersonaId = data?.[0]?.persona_id ?? '';
  let selectedStepKey = '';

  let width = 760;
  let height = 420;

  let placedWords: CloudWord[] = [];
  let isReady = false;

  $: personas = data ?? [];

  $: selectedPersona =
    personas.find((p) => p.persona_id === selectedPersonaId) ?? personas[0];

  $: personaSteps = selectedPersona?.steps ?? [];

  $: {
    if (!selectedStepKey && personaSteps.length) {
      selectedStepKey = `${personaSteps[0].stage_id}__${personaSteps[0].step_id}`;
    }
  }

  $: selectedStep =
    personaSteps.find(
      (s) => `${s.stage_id}__${s.step_id}` === selectedStepKey
    ) ?? personaSteps[0];

  $: words = (selectedStep?.words ?? []).map((d) => ({
    ...d,
    size: d.size ?? Math.max(14, d.value * 4)
  }));

  $: if (selectedPersona && selectedStep && words.length) {
    runLayout();
  }

  function stepLabel(step: StepDatum) {
    return `${step.stage} — ${step.step}`;
  }

  function sentimentColor(sentiment: string) {
    return sentiment === 'positive' ? '#7A9E7E' : '#B56E6E';
  }

  function sentimentOpacity(sentiment: string) {
    return sentiment === 'positive' ? 0.95 : 0.88;
  }

  function resetStepToFirst() {
    if (personaSteps.length) {
      selectedStepKey = `${personaSteps[0].stage_id}__${personaSteps[0].step_id}`;
    } else {
      selectedStepKey = '';
    }
  }

  function runLayout() {
    if (!words.length) {
      placedWords = [];
      return;
    }

    isReady = false;

    const layoutWords: CloudWord[] = words.map((w) => ({ ...w }));

    cloud<CloudWord>()
      .size([width, height])
      .words(layoutWords)
      .padding(4)
      .rotate(() => 0)
      .font('Inter, Arial, sans-serif')
      .fontSize((d) => d.size)
      .spiral('archimedean')
      .on('end', (out) => {
        placedWords = out;
        isReady = true;
      })
      .start();
  }

  onMount(() => {
    if (personaSteps.length && !selectedStepKey) {
      resetStepToFirst();
    }
    if (words.length) runLayout();
  });
</script>

<div class="wordcloud-panel">
  <div class="controls">
    <div class="control-group">
      <label for="persona-select">Persona</label>
      <select
        id="persona-select"
        bind:value={selectedPersonaId}
        on:change={resetStepToFirst}
      >
        {#each personas as persona}
          <option value={persona.persona_id}>
            {persona.persona_name}
          </option>
        {/each}
      </select>
    </div>

    <div class="control-group">
      <label for="step-select">Journey step</label>
      <select id="step-select" bind:value={selectedStepKey}>
        {#each personaSteps as step}
          <option value={`${step.stage_id}__${step.step_id}`}>
            {stepLabel(step)}
          </option>
        {/each}
      </select>
    </div>
  </div>

  {#if selectedPersona && selectedStep}
    <div class="meta">
      <div class="meta-line">
        <span class="meta-label">Persona</span>
        <span>{selectedPersona.persona_name}</span>
      </div>
      <div class="meta-line">
        <span class="meta-label">Stage</span>
        <span>{selectedStep.stage}</span>
      </div>
      <div class="meta-line">
        <span class="meta-label">Step</span>
        <span>{selectedStep.step}</span>
      </div>
    </div>

    <div class="legend">
      <span class="legend-item">
        <span class="legend-dot positive"></span>
        Positive drivers
      </span>
      <span class="legend-item">
        <span class="legend-dot negative"></span>
        Negative drivers
      </span>
    </div>

    <div class="cloud-wrap">
      <svg {width} {height} viewBox={`0 0 ${width} ${height}`} aria-label="Word cloud">
        <g transform={`translate(${width / 2}, ${height / 2})`}>
          {#each placedWords as word}
            <text
              x={word.x}
              y={word.y}
              font-size={word.size}
              font-family={word.font}
              text-anchor="middle"
              transform={`translate(${word.x}, ${word.y}) rotate(${word.rotate ?? 0})`}
              fill={sentimentColor(word.sentiment)}
              fill-opacity={sentimentOpacity(word.sentiment)}
            >
              {word.text}
            </text>
          {/each}
        </g>
      </svg>

      {#if !isReady}
        <div class="loading">Rendering word cloud…</div>
      {/if}
    </div>

    <div class="driver-lists">
      <div class="driver-block">
        <h4>Positive drivers</h4>
        <div class="chips">
          {#each selectedStep.positiveDrivers as word}
            <span class="chip positive">{word.text}</span>
          {/each}
        </div>
      </div>

      <div class="driver-block">
        <h4>Negative drivers</h4>
        <div class="chips">
          {#each selectedStep.negativeDrivers as word}
            <span class="chip negative">{word.text}</span>
          {/each}
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .wordcloud-panel {
    display: grid;
    gap: 1rem;
    padding: 1rem;
    background: #f8f5ef;
    border: 1px solid #e4d8c8;
    border-radius: 16px;
  }

  .controls {
    display: grid;
    grid-template-columns: repeat(2, minmax(220px, 1fr));
    gap: 0.75rem;
  }

  .control-group {
    display: grid;
    gap: 0.35rem;
  }

  .control-group label {
    font-size: 0.85rem;
    font-weight: 600;
    color: #6d5d4f;
  }

  .control-group select {
    padding: 0.7rem 0.8rem;
    border-radius: 10px;
    border: 1px solid #d7c7b5;
    background: white;
    font: inherit;
  }

  .meta {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
    font-size: 0.92rem;
    color: #5e5246;
  }

  .meta-line {
    display: flex;
    gap: 0.4rem;
    align-items: center;
  }

  .meta-label {
    font-weight: 700;
    color: #8a745d;
  }

  .legend {
    display: flex;
    gap: 1rem;
    flex-wrap: wrap;
    font-size: 0.9rem;
    color: #5f554d;
  }

  .legend-item {
    display: inline-flex;
    gap: 0.45rem;
    align-items: center;
  }

  .legend-dot {
    width: 10px;
    height: 10px;
    border-radius: 999px;
    display: inline-block;
  }

  .legend-dot.positive {
    background: #7a9e7e;
  }

  .legend-dot.negative {
    background: #b56e6e;
  }

  .cloud-wrap {
    position: relative;
    min-height: 420px;
    background: #fcfaf7;
    border: 1px solid #eadfce;
    border-radius: 14px;
    overflow: hidden;
  }

  svg {
    display: block;
    width: 100%;
    height: auto;
  }

  .loading {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    font-size: 0.95rem;
    color: #7b6d60;
    background: rgba(252, 250, 247, 0.7);
  }

  .driver-lists {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 1rem;
  }

  .driver-block {
    background: white;
    border: 1px solid #e9dccb;
    border-radius: 12px;
    padding: 0.9rem;
  }

  .driver-block h4 {
    margin: 0 0 0.75rem 0;
    font-size: 0.95rem;
    color: #5e5246;
  }

  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .chip {
    display: inline-flex;
    align-items: center;
    border-radius: 999px;
    padding: 0.35rem 0.65rem;
    font-size: 0.82rem;
    line-height: 1;
  }

  .chip.positive {
    background: #e7f0e8;
    color: #48634c;
  }

  .chip.negative {
    background: #f4e5e5;
    color: #874f4f;
  }

  @media (max-width: 800px) {
    .controls,
    .driver-lists {
      grid-template-columns: 1fr;
    }
  }
</style>