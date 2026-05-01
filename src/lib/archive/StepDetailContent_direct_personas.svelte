<script>
  import { onMount } from 'svelte';
  import cloud from 'd3-cloud';
  import { selectedIndex } from './journeyStore.js';
  import ExperienceWheel from './ExperienceWheel.svelte';

  export let data = [];
  export let metrics = [];
  /** Optional experience wheel data — renders below metrics when present */
  export let wheelData = /** @type {any} */ (null);
  /** Optional full journeyPersonas.json object or just its `personas` array */
  export let journeyPersonas = null;
  /** Optional active persona id, e.g. persona_1 */
  export let personaId = '';

  let cloudWidth = 640;
  let cloudHeight = 260;
  let placedWords = [];
  let cloudReady = false;

  const STOPWORDS = new Set([
    'a','an','and','are','as','at','be','because','begins','both','brings','but','by','can','clearly','deeply','determined',
    'does','even','feel','feels','finally','for','from','future','gains','grow','grows','had','has','have','he','her','herself',
    'him','his','how','in','into','is','it','itself','label','leaves','less','like','long','may','more','not','of','on','or','over',
    'partially','proactive','provide','provides','regains','she','so','some','something','soften','still','subtle','that','the','their',
    'there','they','this','to','temporary','uncertain','under','up','when','will','with','without','what','while'
  ]);

  const POSITIVE_WORDS = new Set([
    'agency','better','calm','clarity','confidence','connected','connection','control','coping','determined','encouraged',
    'empowered','energy','engaged','forward','gain','gains','grounded','heard','help','helpful','hope','hopeful','improvement',
    'insight','knowledge','manageable','normalize','normalized','optimism','positive','prepared','practical','proactive',
    'progress','reassured','reassuring','relief','resilient','resolve','responsive','safe','stability','stable','strategic','strength',
    'supported','support','trust','understand','understanding','validation','validated'
  ]);

  const NEGATIVE_WORDS = new Set([
    'afraid','alarm','alone','anxiety','anxious','burden','confused','confusion','decline','difficult','disruption','doubt','dropped',
    'dropping','drops','drop','exhaustion','fear','fatigue','frustrated','frustration','grief','hard','incomplete','isolated','logistical',
    'loss','misdiagnosis','overwhelmed','pain','progression','risk','scary','serious','strain','stress','symptoms','uncertain','uneasy',
    'unheard','unsettled','worries','worry','worsening'
  ]);

  $: step = $selectedIndex >= 0 ? data[$selectedIndex] : null;

  $: personas = Array.isArray(journeyPersonas)
    ? journeyPersonas
    : (journeyPersonas?.personas ?? []);

  $: activePersona = personas.find((p) => p.id === personaId) ?? personas[0] ?? null;

  $: personaJourneyStep = activePersona && step
    ? activePersona.journey?.find((s) => String(s.stage_id) === String(step.stage_id) && String(s.step_id) === String(step.step_id))
    : null;

  $: resolvedStep = personaJourneyStep ?? step;

  $: derivedWordData = resolvedStep ? buildWordData(resolvedStep, activePersona) : { positiveDrivers: [], negativeDrivers: [], words: [] };

  $: if (resolvedStep && derivedWordData.words.length) {
    runLayout();
  } else {
    placedWords = [];
    cloudReady = false;
  }

  onMount(() => {
    if (resolvedStep && derivedWordData.words.length) runLayout();
  });

  function sentimentToColor(val) {
    const n = Math.max(-5, Math.min(5, parseFloat(val)));
    const t = (n + 5) / 10;
    let r, g, b;
    if (t < 0.5) {
      const u = t / 0.5;
      r = Math.round(192 + (212 - 192) * u);
      g = Math.round(57  + (138 - 57)  * u);
      b = Math.round(43  + (27  - 43)  * u);
    } else {
      const u = (t - 0.5) / 0.5;
      r = Math.round(212 + (39  - 212) * u);
      g = Math.round(138 + (174 - 138) * u);
      b = Math.round(27  + (96  - 27)  * u);
    }
    return `rgb(${r},${g},${b})`;
  }

  function toPercent(val) {
    return ((parseFloat(val) + 5) / 10) * 100;
  }

  function normalizeWord(word) {
    return word
      .toLowerCase()
      .replace(/[^a-z0-9\-']/g, '')
      .replace(/^'+|'+$/g, '');
  }

  function titleWord(text) {
    return text
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }

  function scoreToken(token, stepData) {
    let score = 1;
    if (token.length >= 8) score += 1;
    if (POSITIVE_WORDS.has(token) || NEGATIVE_WORDS.has(token)) score += 2;
    if (token === normalizeWord(stepData.plutchik_score || '')) score += 3;
    return score;
  }

  function inferSentiment(token, stepData) {
    if (POSITIVE_WORDS.has(token)) return 'positive';
    if (NEGATIVE_WORDS.has(token)) return 'negative';
    const sentiment = parseFloat(stepData.sentiment ?? 0);
    return sentiment >= 0 ? 'positive' : 'negative';
  }

  function buildWordData(stepData, persona) {
    const personaName = persona?.profile?.name ?? persona?.name ?? '';
    const sourceText = [
      stepData.stage,
      stepData.step,
      stepData.plutchik_score,
      stepData.narrative_description
    ].filter(Boolean).join(' ');

    /** @type {Map<string, { text: string, value: number, size: number, sentiment: string, persona_id: string, persona_name: string, stage_id: string, stage: string, step_id: string, step: string }>} */
    const bucket = new Map();

    const rawTokens = sourceText
      .split(/\s+/)
      .map(normalizeWord)
      .filter((token) => token && token.length > 2 && !STOPWORDS.has(token));

    for (const token of rawTokens) {
      const text = titleWord(token.replace(/-/g, ' '));
      const sentiment = inferSentiment(token, stepData);
      const value = scoreToken(token, stepData);
      if (!bucket.has(token)) {
        bucket.set(token, {
          text,
          value,
          size: 14 + value * 4,
          sentiment,
          persona_id: persona?.id ?? '',
          persona_name: personaName,
          stage_id: String(stepData.stage_id ?? ''),
          stage: stepData.stage ?? '',
          step_id: String(stepData.step_id ?? ''),
          step: stepData.step ?? ''
        });
      } else {
        const existing = bucket.get(token);
        existing.value += value;
        existing.size = 14 + existing.value * 3;
      }
    }

    const emotionToken = normalizeWord(stepData.plutchik_score || '');
    if (emotionToken && !bucket.has(emotionToken)) {
      bucket.set(emotionToken, {
        text: titleWord(emotionToken),
        value: 5,
        size: 30,
        sentiment: inferSentiment(emotionToken, stepData),
        persona_id: persona?.id ?? '',
        persona_name: personaName,
        stage_id: String(stepData.stage_id ?? ''),
        stage: stepData.stage ?? '',
        step_id: String(stepData.step_id ?? ''),
        step: stepData.step ?? ''
      });
    }

    const words = [...bucket.values()]
      .sort((a, b) => b.value - a.value)
      .slice(0, 24);

    let positiveDrivers = words.filter((w) => w.sentiment === 'positive').slice(0, 10);
    let negativeDrivers = words.filter((w) => w.sentiment === 'negative').slice(0, 10);

    if (!positiveDrivers.length) {
      positiveDrivers = [
        {
          text: 'Hope', value: 4, size: 26, sentiment: 'positive',
          persona_id: persona?.id ?? '', persona_name: personaName,
          stage_id: String(stepData.stage_id ?? ''), stage: stepData.stage ?? '', step_id: String(stepData.step_id ?? ''), step: stepData.step ?? ''
        },
        {
          text: 'Agency', value: 3, size: 22, sentiment: 'positive',
          persona_id: persona?.id ?? '', persona_name: personaName,
          stage_id: String(stepData.stage_id ?? ''), stage: stepData.stage ?? '', step_id: String(stepData.step_id ?? ''), step: stepData.step ?? ''
        }
      ];
    }

    if (!negativeDrivers.length) {
      negativeDrivers = [
        {
          text: 'Uncertainty', value: 4, size: 26, sentiment: 'negative',
          persona_id: persona?.id ?? '', persona_name: personaName,
          stage_id: String(stepData.stage_id ?? ''), stage: stepData.stage ?? '', step_id: String(stepData.step_id ?? ''), step: stepData.step ?? ''
        },
        {
          text: 'Burden', value: 3, size: 22, sentiment: 'negative',
          persona_id: persona?.id ?? '', persona_name: personaName,
          stage_id: String(stepData.stage_id ?? ''), stage: stepData.stage ?? '', step_id: String(stepData.step_id ?? ''), step: stepData.step ?? ''
        }
      ];
    }

    return {
      positiveDrivers,
      negativeDrivers,
      words: [...positiveDrivers, ...negativeDrivers, ...words]
        .filter((word, index, arr) => arr.findIndex((w) => w.text === word.text && w.sentiment === word.sentiment) === index)
        .sort((a, b) => b.value - a.value)
        .slice(0, 26)
    };
  }

  function runLayout() {
    cloudReady = false;

    cloud()
      .size([cloudWidth, cloudHeight])
      .words(derivedWordData.words.map((d) => ({ ...d })))
      .padding(4)
      .rotate(() => 0)
      .font('Inter, Arial, sans-serif')
      .fontSize((d) => d.size)
      .spiral('archimedean')
      .on('end', (out) => {
        placedWords = out;
        cloudReady = true;
      })
      .start();
  }

  function wordColor(sentiment) {
    return sentiment === 'positive' ? '#5B8A72' : '#A85C52';
  }
</script>

{#if resolvedStep}
  <div class="content-wrap">
    <div class="jm-hero">
      <h2 class="jm-title">{resolvedStep.step}</h2>

      {#if resolvedStep.narrative_description}
        <div class="jm-content-col">
          <span class="jm-kicker">Step Narrative</span>
          <p class="text-body">{resolvedStep.narrative_description}</p>
        </div>
      {/if}
    </div>

    <div class="divider" />

    <div class="jm-content-row metrics-grid">
      <div class="jm-content-col sentiment-section">
        <span class="jm-kicker">Overall Sentiment</span>
        <div class="sentiment-row">
          <div class="sentiment-bar-track">
            <div
              class="sentiment-bar-fill"
              style="width: {toPercent(resolvedStep.sentiment)}%; background: {sentimentToColor(resolvedStep.sentiment)};"
            />
          </div>
          <span class="sentiment-value-inline" style="color: {sentimentToColor(resolvedStep.sentiment)};">
            {parseFloat(resolvedStep.sentiment) > 0 ? '+' : ''}{resolvedStep.sentiment}
          </span>
        </div>
      </div>

      <div class="jm-content-col">
        <span class="jm-kicker">Index Metrics</span>
        {#each metrics as m}
          {@const pct = toPercent(resolvedStep[m.key])}
          {@const val = parseFloat(resolvedStep[m.key])}
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
                style="
                  width: {Math.abs(pct - 50)}%;
                  left: {val >= 0 ? '50%' : `${pct}%`};
                  background: {m.color};
                "
              />
            </div>
          </div>
        {/each}
      </div>
    </div>

    <div class="divider" />

    <div class="emotion-section">
      <span class="jm-kicker">Emotional State</span>
      <span class="plutchik-tag">{resolvedStep.plutchik_score}</span>
    </div>

    {#if derivedWordData.words.length}
      <div class="divider" />

      <div class="wordcloud-section">
        <div class="wordcloud-head">
          <div>
            <span class="jm-kicker">Sentiment Drivers</span>
            <div class="wordcloud-subtitle">
              {activePersona?.profile?.name ?? 'Active persona'} — {resolvedStep.stage}
            </div>
          </div>
          <div class="wordcloud-legend">
            <span class="legend-item"><span class="legend-dot positive"></span>Positive</span>
            <span class="legend-item"><span class="legend-dot negative"></span>Negative</span>
          </div>
        </div>

        <div class="wordcloud-canvas">
          <svg width={cloudWidth} height={cloudHeight} viewBox={`0 0 ${cloudWidth} ${cloudHeight}`} aria-label="Word cloud">
            <g transform={`translate(${cloudWidth / 2}, ${cloudHeight / 2})`}>
              {#each placedWords as word}
                <text
                  text-anchor="middle"
                  font-size={word.size}
                  font-family={word.font}
                  fill={wordColor(word.sentiment)}
                  transform={`translate(${word.x}, ${word.y}) rotate(${word.rotate ?? 0})`}
                >
                  {word.text}
                </text>
              {/each}
            </g>
          </svg>
          {#if !cloudReady}
            <div class="wordcloud-loading">Rendering…</div>
          {/if}
        </div>

        <div class="driver-lists">
          <div class="driver-block">
            <span class="driver-title">Positive drivers</span>
            <div class="chips">
              {#each derivedWordData.positiveDrivers as word}
                <span class="chip positive">{word.text}</span>
              {/each}
            </div>
          </div>

          <div class="driver-block">
            <span class="driver-title">Negative drivers</span>
            <div class="chips">
              {#each derivedWordData.negativeDrivers as word}
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
      <div class="label-sm">
        <span class="wheel-icon" aria-hidden="true">◎</span>
        Experience Wheel
      </div>
      <ExperienceWheel
        data={wheelData}
        stepName={resolvedStep.step}
        stageName={resolvedStep.stage}
      />
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

  .metrics-grid {
    display: grid;
    grid-template-columns: minmax(180px, 220px) minmax(0, 1fr);
    gap: 20px;
    align-items: start;
  }

  .sentiment-section {
    min-width: 0;
  }

  .sentiment-row {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .sentiment-bar-track {
    position: relative;
    height: 6px;
    background: #EDE5D8;
    border-radius: 3px;
    overflow: visible;
    display: flex;
    align-items: center;
    flex: 1;
  }

  .sentiment-bar-fill {
    height: 100%;
    border-radius: 3px;
    transition: width 0.3s ease;
  }

  .sentiment-value-inline {
    font-family: 'Space Mono', monospace;
    font-size: 11px;
    font-weight: bold;
    white-space: nowrap;
  }

  .metric-row { display: flex; flex-direction: column; gap: 6px; }
  .metric-label-row { display: flex; align-items: center; gap: 8px; }

  .metric-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
    opacity: 0.9;
  }

  .metric-name { font-size: 11px; color: #7A5A3A; flex: 1; }

  .metric-value {
    font-family: 'Space Mono', monospace;
    font-size: 11px;
    font-weight: bold;
  }

  .metric-bar-track {
    position: relative;
    height: 4px;
    background: #EDE5D8;
    border-radius: 2px;
    overflow: hidden;
  }

  .zero-mark {
    position: absolute;
    left: 50%;
    top: 0;
    bottom: 0;
    width: 1px;
    background: #DFC3A8;
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
    gap: 6px;
  }

  .wordcloud-section {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .wordcloud-head {
    display: flex;
    justify-content: space-between;
    gap: 16px;
    align-items: flex-start;
    flex-wrap: wrap;
  }

  .wordcloud-subtitle {
    margin-top: 4px;
    font-size: 12px;
    color: #8F735B;
  }

  .wordcloud-legend {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
    font-size: 11px;
    color: #7A5A3A;
  }

  .legend-item {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }

  .legend-dot {
    width: 9px;
    height: 9px;
    border-radius: 999px;
    display: inline-block;
  }

  .legend-dot.positive { background: #5B8A72; }
  .legend-dot.negative { background: #A85C52; }

  .wordcloud-canvas {
    position: relative;
    background: #FCF8F2;
    border: 1px solid #E6D7C5;
    border-radius: 12px;
    overflow: hidden;
    min-height: 260px;
  }

  .wordcloud-canvas svg {
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
    color: #8F735B;
    background: rgba(252, 248, 242, 0.72);
  }

  .driver-lists {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
  }

  .driver-block {
    background: #FCF8F2;
    border: 1px solid #E6D7C5;
    border-radius: 10px;
    padding: 12px;
  }

  .driver-title {
    display: block;
    margin-bottom: 10px;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #8F735B;
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
    padding: 6px 10px;
    font-size: 12px;
    line-height: 1;
  }

  .chip.positive {
    background: #E3EFE8;
    color: #426C56;
  }

  .chip.negative {
    background: #F5E5E1;
    color: #8A4F47;
  }

  .wheel-section {
    border-top: 1px solid #DFC3A8;
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
    color: #A08060;
    background: #EDE5D8;
    border-bottom: 1px solid #DFC3A8;
  }

  .wheel-icon {
    font-size: 11px;
    color: #C4956A;
  }

  @media (max-width: 760px) {
    .metrics-grid,
    .driver-lists {
      grid-template-columns: 1fr;
    }
  }
</style>
