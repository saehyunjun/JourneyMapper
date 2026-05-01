<script>
  import { onMount, tick } from 'svelte';
  import cloud from 'd3-cloud';
  import { selectedIndex } from './journeyStore.js';
  import ExperienceWheel from './ExperienceWheel.svelte';

  export let data = [];
  export let metrics = [];
  /** Optional experience wheel data — renders below metrics when present */
  export let wheelData = /** @type {any} */ (null);
  /** Optional persona id so the word cloud resolves the correct persona */
  export let personaId = null;
  /** Optional preloaded word cloud dataset from journeyPersonaWordclouds.json */
  export let wordcloudData = [];

  let cloudWidth = 640;
  let cloudHeight = 320;
  let cloudWrapEl;
  let placedWords = [];
  let cloudReady = false;

  $: step = $selectedIndex >= 0 ? data[$selectedIndex] : null;

  $: selectedPersonaWordcloud = resolvePersonaWordcloud();
  $: selectedWordcloudStep = resolveWordcloudStep();
  $: cloudWords = (selectedWordcloudStep?.words ?? []).map((word) => ({
    ...word,
    size: word.size ?? Math.max(14, (word.value || 1) * 4)
  }));

  $: if (step && cloudWords.length) {
    queueCloudLayout();
  } else {
    placedWords = [];
    cloudReady = false;
  }

  function sentimentToColor(val) {
    const n = Math.max(-5, Math.min(5, parseFloat(val)));
    const t = (n + 5) / 10;
    let r, g, b;
    if (t < 0.5) {
      const u = t / 0.5;
      r = Math.round(192 + (212 - 192) * u);
      g = Math.round(57 + (138 - 57) * u);
      b = Math.round(43 + (27 - 43) * u);
    } else {
      const u = (t - 0.5) / 0.5;
      r = Math.round(212 + (39 - 212) * u);
      g = Math.round(138 + (174 - 138) * u);
      b = Math.round(27 + (96 - 27) * u);
    }
    return `rgb(${r},${g},${b})`;
  }

  function toPercent(val) {
    return ((parseFloat(val) + 5) / 10) * 100;
  }

  function driverColor(sentiment) {
    return sentiment === 'positive' ? '#6F8F73' : '#A45B5B';
  }

  function driverOpacity(sentiment) {
    return sentiment === 'positive' ? 0.95 : 0.88;
  }

  function resolvePersonaWordcloud() {
    if (!Array.isArray(wordcloudData) || !step) return null;

    if (personaId) {
      return wordcloudData.find((persona) => persona.persona_id === personaId) ?? null;
    }

    return (
      wordcloudData.find((persona) =>
        (persona.steps ?? []).some(
          (candidate) =>
            String(candidate.stage_id) === String(step.stage_id) &&
            String(candidate.step_id) === String(step.step_id)
        )
      ) ?? null
    );
  }

  function resolveWordcloudStep() {
    if (!selectedPersonaWordcloud || !step) return null;

    return (
      (selectedPersonaWordcloud.steps ?? []).find(
        (candidate) =>
          String(candidate.stage_id) === String(step.stage_id) &&
          String(candidate.step_id) === String(step.step_id)
      ) ?? null
    );
  }

  async function queueCloudLayout() {
    await tick();
    measureCloud();
    runCloudLayout();
  }

  function measureCloud() {
    if (!cloudWrapEl) return;
    const bounds = cloudWrapEl.getBoundingClientRect();
    if (!bounds.width) return;
    cloudWidth = Math.max(280, Math.floor(bounds.width));
    cloudHeight = 320;
  }

  function runCloudLayout() {
    if (!cloudWords.length) {
      placedWords = [];
      cloudReady = false;
      return;
    }

    cloudReady = false;

    const layoutWords = cloudWords.map((word) => ({ ...word }));

    cloud()
      .size([cloudWidth, cloudHeight])
      .words(layoutWords)
      .padding(5)
      .rotate(() => 0)
      .font('Inter, Arial, sans-serif')
      .fontSize((d) => d.size)
      .spiral('archimedean')
      .on('end', (words) => {
        placedWords = words;
        cloudReady = true;
      })
      .start();
  }

  function handleResize() {
    if (selectedWordcloudStep?.words?.length) {
      measureCloud();
      runCloudLayout();
    }
  }

  onMount(() => {
    measureCloud();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  });
</script>

{#if step}
  <div class="content-wrap">
    <div class="jm-hero">
      <h2 class="jm-title">{step.step}</h2>

      {#if step.narrative_description}
        <div class="jm-content-col">
          <span class="jm-kicker">Step Narrative</span>
          <p class="text-body">{step.narrative_description}</p>
        </div>
      {/if}
    </div>

    <div class="divider" />

    <div class="jm-content-row metrics-layout">
      <div class="jm-content-col sentiment-col">
        <span class="jm-kicker">Overall Sentiment</span>
        <div class="sentiment-bar-row">
          <div class="sentiment-bar-track">
            <div
              class="sentiment-bar-fill"
              style="width: {toPercent(step.sentiment)}%; background: {sentimentToColor(step.sentiment)};"
            />
          </div>
          <div class="sentiment-value-wrap">
            <span class="sentiment-value" style="color: {sentimentToColor(step.sentiment)};">
              {parseFloat(step.sentiment) > 0 ? '+' : ''}{step.sentiment}
            </span>
          </div>
        </div>
      </div>

      <div class="jm-content-col metrics-col">
        <span class="jm-kicker">Index Metrics</span>
        <div class="metrics-section">
          {#each metrics as m}
            {@const pct = toPercent(step[m.key])}
            {@const val = parseFloat(step[m.key])}
            <div class="metric-row">
              <div class="metric-label-row">
                <span class="metric-dot" style="background: {m.color};" />
                <span class="metric-name">{m.label}</span>
                <span class="metric-value" style="color: {m.color};">
                  {val > 0 ? '+' : ''}{val}
                </span>
              </div>
              <div class="metric-bar-track">
                <div class="zero-mark" />
                <div
                  class="metric-bar-fill"
                  style="width: {Math.abs(pct - 50)}%; left: {val >= 0 ? '50%' : `${pct}%`}; background: {m.color};"
                />
              </div>
            </div>
          {/each}
        </div>
      </div>
    </div>

    <div class="divider" />

    <div class="emotion-section">
      <span class="jm-kicker">Emotional State</span>
      <span class="plutchik-tag">{step.plutchik_score}</span>
    </div>

    {#if selectedWordcloudStep}
      <div class="divider" />

      <div class="wordcloud-section">
        <div class="wordcloud-header">
          <div>
            <span class="jm-kicker">Sentiment Drivers</span>
            <div class="wordcloud-subtitle">
              {selectedPersonaWordcloud?.persona_name || selectedPersonaWordcloud?.profile?.name || 'Persona'}
            </div>
          </div>
          <div class="wordcloud-legend">
            <span class="legend-item"><span class="legend-dot positive"></span>Positive</span>
            <span class="legend-item"><span class="legend-dot negative"></span>Negative</span>
          </div>
        </div>

        <div class="wordcloud-wrap" bind:this={cloudWrapEl}>
          <svg
            width={cloudWidth}
            height={cloudHeight}
            viewBox={`0 0 ${cloudWidth} ${cloudHeight}`}
            class="wordcloud-svg"
            aria-label="Sentiment driver word cloud"
          >
            <g transform={`translate(${cloudWidth / 2}, ${cloudHeight / 2})`}>
              {#each placedWords as word}
                <text
                  text-anchor="middle"
                  font-size={word.size}
                  font-family={word.font || 'Inter, Arial, sans-serif'}
                  fill={driverColor(word.sentiment)}
                  fill-opacity={driverOpacity(word.sentiment)}
                  transform={`translate(${word.x || 0}, ${word.y || 0}) rotate(${word.rotate || 0})`}
                >
                  {word.text}
                </text>
              {/each}
            </g>
          </svg>

          {#if !cloudReady}
            <div class="wordcloud-loading">Rendering word cloud…</div>
          {/if}
        </div>

        <div class="driver-lists">
          <div class="driver-block">
            <span class="jm-kicker">Positive drivers</span>
            <div class="chips">
              {#each selectedWordcloudStep.positiveDrivers ?? [] as word}
                <span class="chip positive">{word.text}</span>
              {/each}
            </div>
          </div>

          <div class="driver-block">
            <span class="jm-kicker">Negative drivers</span>
            <div class="chips">
              {#each selectedWordcloudStep.negativeDrivers ?? [] as word}
                <span class="chip negative">{word.text}</span>
              {/each}
            </div>
          </div>
        </div>
      </div>
    {/if}
  </div>

  {#if wheelData}
    <div class="wheel-section">
      <div class="wheel-section-label">
        <span class="wheel-icon" aria-hidden="true">◎</span>
        Experience Wheel
      </div>
      <ExperienceWheel data={wheelData} stepName={step.step} stageName={step.stage} />
    </div>
  {/if}
{/if}

<style>
  .content-wrap {
    padding: 2em;
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .metrics-layout {
    display: grid;
    grid-template-columns: minmax(220px, 0.9fr) minmax(0, 1.1fr);
    gap: 20px;
    align-items: start;
  }

  .jm-content-col {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .sentiment-bar-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 12px;
    align-items: center;
  }

  .sentiment-bar-track {
    position: relative;
    height: 6px;
    background: #ede5d8;
    border-radius: 3px;
    overflow: visible;
    display: flex;
    align-items: center;
  }

  .sentiment-bar-fill {
    height: 100%;
    border-radius: 3px;
    transition: width 0.3s ease;
  }

  .sentiment-value-wrap {
    display: flex;
    align-items: center;
    justify-content: flex-end;
  }

  .sentiment-value {
    font-family: 'Space Mono', monospace;
    font-size: 11px;
    font-weight: bold;
    white-space: nowrap;
  }

  .metrics-section {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .metric-row {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .metric-label-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .metric-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
    opacity: 0.9;
  }

  .metric-name {
    font-size: 11px;
    color: #7a5a3a;
    flex: 1;
  }

  .metric-value {
    font-family: 'Space Mono', monospace;
    font-size: 11px;
    font-weight: bold;
  }

  .metric-bar-track {
    position: relative;
    height: 4px;
    background: #ede5d8;
    border-radius: 2px;
    overflow: hidden;
  }

  .zero-mark {
    position: absolute;
    left: 50%;
    top: 0;
    bottom: 0;
    width: 1px;
    background: #dfc3a8;
    z-index: 1;
  }

  .metric-bar-fill {
    position: absolute;
    top: 0;
    bottom: 0;
    border-radius: 2px;
    transition: width 0.3s ease, left 0.3s ease;
    opacity: 0.85;
  }

  .emotion-section {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .wordcloud-section {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .wordcloud-header {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 16px;
    flex-wrap: wrap;
  }

  .wordcloud-subtitle {
    margin-top: 6px;
    font-size: 12px;
    color: #8e745e;
  }

  .wordcloud-legend {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
    font-size: 11px;
    color: #8e745e;
  }

  .legend-item {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }

  .legend-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    display: inline-block;
  }

  .legend-dot.positive {
    background: #6f8f73;
  }

  .legend-dot.negative {
    background: #a45b5b;
  }

  .wordcloud-wrap {
    position: relative;
    width: 100%;
    min-height: 320px;
    background: #fcfaf7;
    border: 1px solid #e7d8c5;
    border-radius: 12px;
    overflow: hidden;
  }

  .wordcloud-svg {
    display: block;
    width: 100%;
    height: auto;
  }

  .wordcloud-loading {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    font-size: 12px;
    color: #8e745e;
    background: rgba(252, 250, 247, 0.72);
  }

  .driver-lists {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 14px;
  }

  .driver-block {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 12px;
    border: 1px solid #e7d8c5;
    border-radius: 12px;
    background: #fff;
  }

  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .chip {
    display: inline-flex;
    align-items: center;
    border-radius: 999px;
    padding: 5px 9px;
    font-size: 11px;
    line-height: 1;
  }

  .chip.positive {
    background: #e8f1e8;
    color: #547058;
  }

  .chip.negative {
    background: #f4e6e6;
    color: #8d5555;
  }

  .wheel-section {
    border-top: 1px solid #dfc3a8;
  }

  .wheel-section-label {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 16px;
    font-family: 'DM Sans', sans-serif;
    font-size: 9px;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: #a08060;
    background: #ede5d8;
    border-bottom: 1px solid #dfc3a8;
  }

  .wheel-icon {
    font-size: 11px;
    color: #c4956a;
  }

  @media (max-width: 760px) {
    .content-wrap {
      padding: 1.25em;
    }

    .metrics-layout,
    .driver-lists {
      grid-template-columns: 1fr;
    }
  }
</style>
