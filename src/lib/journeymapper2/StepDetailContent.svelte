<script>
    import { selectedIndex } from './journeyStore.js';
    import ExperienceWheel from './ExperienceWheel.svelte';
  
    export let data    = [];
    export let metrics = [];
    /** Optional experience wheel data — renders below metrics when present */
    export let wheelData = /** @type {any} */ (null);
  
    $: step = $selectedIndex >= 0 ? data[$selectedIndex] : null;
  
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
      <h2 class="jm-title">{step.step}</h2>
  

    <!-- Narrative description -->
      {#if step.narrative_description}
        <div class="narrative-section">
          <span class="jm-kicker">Step Narrative</span>
          <p class="narrative-text">{step.narrative_description}</p>
</div>
{/if}

      <!-- Sentiment bar -->
  
      <div class="divider" />
  
      <!-- Metric bars -->
      <div class="metrics-section">

        <div class="even-col">
          <span class="jm-kicker">Overall Sentiment</span>
        </div>
        <div class="sentiment-bar-track">
          <div
            class="sentiment-bar-fill"
            style="width: {toPercent(step.sentiment)}%; background: {sentimentToColor(step.sentiment)};"
          />
          <span class="sentiment-value" style="color: {sentimentToColor(step.sentiment)};">
            {parseFloat(step.sentiment) > 0 ? '+' : ''}{step.sentiment}
          </span>
        </div>
        <span class="jm-kicker">Index Metrics</span>
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
  
      <!-- Emotion tag -->
      <div class="emotion-section">
        <span class="jm-kicker">Emotional State</span>
        <span class="plutchik-tag">{step.plutchik_score}</span>
      </div>
  
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
  
    /* ── Sentiment bar ──────────────────────────────────────────── */

    .sentiment-bar-track {
      position: relative;
      height: 6px;
      background: #EDE5D8;
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