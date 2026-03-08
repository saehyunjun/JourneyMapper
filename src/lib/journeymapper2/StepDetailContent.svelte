<script>
  import { selectedIndex } from './journeyStore.js';
  import ExperienceWheel from './ExperienceWheel.svelte';
  import { emotionColor, DYAD_BY_ID, SCORE_ALIASES } from './journeyConfig.js';

  export let data    = [];
  export let metrics = [];
  /** Optional experience wheel data — renders below metrics when present */
  export let wheelData = /** @type {any} */ (null);

  $: step = $selectedIndex >= 0 ? data[$selectedIndex] : null;

  /**
   * For the current step's plutchik_score, resolve to a canonical id,
   * then check if it's a dyad. If so, return the two primary emotion colors.
   * If it's a primary emotion, return just that one color in an array.
   *
   * Priority: DYAD_BY_ID first (raw label may be a dyad like "hope"),
   * then SCORE_ALIASES (for intensity variants like "alarm" → "fear"),
   * then treat as a primary emotion id directly.
   */
  $: emotionSwatches = (() => {
    if (!step) return [];
    const raw = step.plutchik_score?.toLowerCase().trim() ?? '';
    // 1. Check dyads by raw label first — "hope", "grief", etc. are dyad ids
    const dyad = DYAD_BY_ID[raw];
    if (dyad) {
      return dyad.primary.map(pid => emotionColor(pid));
    }
    // 2. Fall back to alias (intensity variants → primary id)
    const id = SCORE_ALIASES[raw] ?? raw;
    return [emotionColor(id)];
  })();

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
</script>

{#if step}
  <div class="content-wrap">

    <!-- Step name -->
    <h2 class="heading">
      {step.step}
    </h2>
    <div class="flex flex-row gap-4 w-full justify-between">
        <!-- Sentiment bar -->
        <div class="flex flex-col w-9/12">
          <span class="label-sm pb-2">
            Overall Sentiment</span>
          <div class="label-sm pb-2">
            <div
              class="w-4 h-4 ring-1 ring-slate-800 rounded-full"
              style="background: {sentimentToColor(step.sentiment)};"
            />
            <span class="sentiment-value" style="color: {sentimentToColor(step.sentiment)};">
              {parseFloat(step.sentiment) > 0 ? '+' : ''}{step.sentiment}
            </span>
            <span class="label uppercase">{step.plutchik_score}</span>
          </div>
        </div>
    
        <!-- Emotion tag -->
        <div class="emotion-section">
          <span class="label-sm pb-2">
            Emotional State</span>
          <div class="plutchik-tag-row">
            {#each emotionSwatches as color}
              <span class="w-4 h-4 ring-1 ring-slate-800" style="background: {color};" />
            {/each}
            <span class="label uppercase">{step.plutchik_score}</span>
          </div>
        </div>
      </div>
    <div class="divider" />

    <!-- Narrative description -->
    {#if step.narrative_description}
      <div class="jm-content-row">
        <span class="label-lg">Step Narrative</span>
        <p class="text-body">{step.narrative_description}</p>
      </div>
    {/if}


    <div class="divider" />

    <!-- Metric bars -->
    <div class="metrics-section">
      <span class="section-heading">Index Metrics</span>
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

    <div class="divider" />

    

  </div>

  <!-- ── Experience Wheel — renders flush below when data is available ── -->
  {#if wheelData}
    <div class="wheel-section">
      <div class="wheel-section-label">
        <span class="wheel-icon" aria-hidden="true">◎</span>
        Experience Wheel
      </div>
      <ExperienceWheel
        data={wheelData}
        stepName={step.step}
        stageName={step.stage}
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

  .divider {
    height: 1px;
    background: #DFC3A8;
    margin: 0 -2em;
  }

  .section-heading {
    display: block;
    font-family: 'DM Sans', sans-serif;
    font-size: 9px;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: #A08060;
    margin-bottom: 10px;
  }

  /* ── Narrative ──────────────────────────────────────────────── */
  .narrative-section { display: flex; flex-direction: column; }

  .narrative-text {
    font-family: 'DM Sans', sans-serif;
    font-size: 11px;
    color: #7A5A3A;
    line-height: 1.7;
    margin: 0;
  }

  /* ── Sentiment bar ──────────────────────────────────────────── */
  .sentiment-section { display: flex; flex-direction: column; }

  .sentiment-bar-track {
    position: relative;
    height: 6px;
    background: #919191;
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

  .sentiment-value {
    position: absolute;
    right: 0;
    font-family: 'Space Mono', monospace;
    font-size: 11px;
    font-weight: bold;
    transform: translateX(calc(100% + 8px));
  }

  /* ── Metric bars ────────────────────────────────────────────── */
  .metrics-section { display: flex; flex-direction: column; gap: 14px; }

  .metric-row { display: flex; flex-direction: column; gap: 6px; }

  .metric-label-row { display: flex; align-items: center; gap: 8px; }

  .metric-dot {
    width: 8px; height: 8px;
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
    left: 50%; top: 0; bottom: 0;
    width: 1px;
    background: #DFC3A8;
    z-index: 1;
  }

  .metric-bar-fill {
    position: absolute;
    top: 0; bottom: 0;
    border-radius: 2px;
    transition: width 0.3s ease, left 0.3s ease;
    opacity: 0.85;
  }

  /* ── Emotion tag ────────────────────────────────────────────── */
  .emotion-section { display: flex; flex-direction: column; }

  .plutchik-tag-row {
    display: flex;
    align-items: center;
    gap: 6px;
    align-self: flex-start;
  }

  .dyad-square {
    display: inline-block;
    width: 10px;
    height: 10px;
    border-radius: 2px;
    border: 1px solid rgba(0, 0, 0, 0.18);
    flex-shrink: 0;
  }

  .plutchik-tag {
    display: inline-block;
    font-family: 'Space Mono', monospace;
    font-size: 11px;
    letter-spacing: 0.08em;
    text-transform: capitalize;
    color: #7A5A3A;
    background: #EDE5D8;
    border: 1px solid #DFC3A8;
    border-radius: 2px;
    padding: 5px 10px;
  }

  /* ── Experience Wheel section ───────────────────────────────── */
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
</style>