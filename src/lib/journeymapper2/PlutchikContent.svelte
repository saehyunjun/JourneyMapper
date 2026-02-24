<script>
    const primaryEmotions = [
      {
        name: 'Joy',
        color: '#F4C430',
        opposite: 'Sadness',
        intensity: ['Serenity', 'Joy', 'Ecstasy'],
        description: 'Positive affect, associated with community, connection, and hope.',
        journeyExamples: ['Joining Online Communities'],
      },
      {
        name: 'Trust',
        color: '#7BC67E',
        opposite: 'Disgust',
        intensity: ['Acceptance', 'Trust', 'Admiration'],
        description: 'Confidence in others; critical in provider relationships.',
        journeyExamples: ['Initial Care'],
      },
      {
        name: 'Fear',
        color: '#9DC4B0',
        opposite: 'Anger',
        intensity: ['Apprehension', 'Fear', 'Terror'],
        description: 'Anticipation of threat; common at diagnosis and symptom onset.',
        journeyExamples: [],
      },
      {
        name: 'Surprise',
        color: '#A8D8EA',
        opposite: 'Anticipation',
        intensity: ['Distraction', 'Surprise', 'Amazement'],
        description: 'Response to the unexpected — can be positive or negative.',
        journeyExamples: ['Misdiagnosis'],
      },
      {
        name: 'Sadness',
        color: '#7B9EA8',
        opposite: 'Joy',
        intensity: ['Pensiveness', 'Sadness', 'Grief'],
        description: 'Loss-driven affect; deepens with severity of setbacks.',
        journeyExamples: ["Parkinson's Diagnosis", 'Continued Regression'],
      },
      {
        name: 'Disgust',
        color: '#9B6B4C',
        opposite: 'Trust',
        intensity: ['Boredom', 'Disgust', 'Loathing'],
        description: 'Rejection of ideas, systems, or outcomes that feel wrong.',
        journeyExamples: [],
      },
      {
        name: 'Anger',
        color: '#E07B54',
        opposite: 'Fear',
        intensity: ['Annoyance', 'Anger', 'Rage'],
        description: 'Frustration or injustice; often surfaces after misdiagnosis.',
        journeyExamples: [],
      },
      {
        name: 'Anticipation',
        color: '#F4A460',
        opposite: 'Surprise',
        intensity: ['Interest', 'Anticipation', 'Vigilance'],
        description: 'Forward-looking orientation; hope and uncertainty intertwined.',
        journeyExamples: ['Referral to Neurologist', 'Choosing Between Trials'],
      },
    ];
  
    const dyads = [
      { name: 'Alarm',   components: ['Fear', 'Surprise'],      color: '#B0C8D4', note: 'Initial symptom onset — sudden and threatening.' },
      { name: 'Hope',    components: ['Anticipation', 'Trust'], color: '#B8D4B0', note: 'Optimism tempered by uncertainty.' },
      { name: 'Grief',   components: ['Sadness', 'Fear'],       color: '#8AA0A8', note: 'Deep loss combined with ongoing dread.' },
      { name: 'Outrage', components: ['Anger', 'Surprise'],     color: '#D4906C', note: 'Shock-triggered anger; unexpected bad news.' },
    ];
  </script>
  
  <div class="content-wrap">
  
    <!-- Intro -->
    <div class="intro-block">
      <p class="body-text">
        Robert Plutchik's psychoevolutionary theory (1980) proposes <strong>8 primary emotions</strong> arranged
        in opposing pairs. Emotions vary by <em>intensity</em> (inner = mild, outer = intense) and combine
        to form <em>dyads</em> — blended emotions that describe complex affective states.
      </p>
      <p class="body-text">
        In this journey map, each step is tagged with a Plutchik emotion or dyad derived from
        qualitative patient narratives. These scores inform the <strong>Overall Sentiment</strong> track
        and the emotional state metric.
      </p>
    </div>
  
    <div class="divider" />
  
    <!-- Primary emotions -->
    <div class="section-heading">8 Primary Emotions</div>
    <div class="emotions-grid">
      {#each primaryEmotions as e}
        <div class="emotion-card">
          <div class="emotion-header">
            <span class="emotion-swatch" style="background: {e.color};" />
            <span class="emotion-name">{e.name}</span>
            <span class="emotion-opp">↔ {e.opposite}</span>
          </div>
          <div class="emotion-intensities">
            {#each e.intensity as level, idx}
              <span
                class="intensity-chip"
                style="opacity: {0.45 + idx * 0.275}; background: {e.color};"
              >{level}</span>
            {/each}
          </div>
          <p class="emotion-desc">{e.description}</p>
          {#if e.journeyExamples.length}
            <div class="journey-tags">
              <span class="tags-label">In this journey:</span>
              {#each e.journeyExamples as ex}
                <span class="journey-tag">{ex}</span>
              {/each}
            </div>
          {/if}
        </div>
      {/each}
    </div>
  
    <div class="divider" />
  
    <!-- Dyads -->
    <div class="section-heading">Dyads Used in This Journey</div>
    <p class="sub-note">Dyads are blended emotions formed when two adjacent primary emotions combine.</p>
    <div class="dyads-list">
      {#each dyads as d}
        <div class="dyad-row">
          <span class="dyad-swatch" style="background: {d.color};" />
          <div class="dyad-content">
            <div class="dyad-name-row">
              <span class="dyad-name">{d.name}</span>
              <span class="dyad-components">{d.components[0]} + {d.components[1]}</span>
            </div>
            <p class="dyad-note">{d.note}</p>
          </div>
        </div>
      {/each}
    </div>
  
    <div class="divider" />
  
    <!-- Scoring -->
    <div class="section-heading">Scoring in This Map</div>
    <p class="body-text">
      Each Plutchik tag is translated to a <strong>−5 to +5 sentiment score</strong> reflecting the
      valence and intensity of the emotion at that journey step. Positive emotions (joy, trust, anticipation)
      trend above zero; negative emotions (grief, alarm, sadness) trend below. Neutral or ambivalent
      states (surprise, some dyads) sit near zero.
    </p>
  
  </div>
  
  <style>
    .content-wrap {
      padding: 20px;
      display: flex;
      flex-direction: column;
      gap: 18px;
    }
  
    /* ── Type ───────────────────────────────────────────────────── */
    .body-text {
      font-family: 'DM Sans', sans-serif;
      font-size: 11px;
      color: #7A5A3A;
      line-height: 1.7;
      margin: 0;
    }
  
    .body-text strong { color: #5A3E28; font-weight: 600; }
    .body-text em     { font-style: italic; }
  
    .section-heading {
      font-family: 'DM Sans', sans-serif;
      font-size: 9px;
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: #A08060;
      margin-bottom: 2px;
    }
  
    .sub-note {
      font-family: 'DM Sans', sans-serif;
      font-size: 10px;
      color: #BFA080;
      font-style: italic;
      margin: 0 0 6px;
      line-height: 1.5;
    }
  
    .divider {
      height: 1px;
      background: #DFC3A8;
      margin: 0 -20px;
    }
  
    /* ── Intro ──────────────────────────────────────────────────── */
    .intro-block { display: flex; flex-direction: column; gap: 10px; }
  
    /* ── Emotion cards ──────────────────────────────────────────── */
    .emotions-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
    }
  
    .emotion-card {
      background: #EDE5D8;
      border: 1px solid #DFC3A8;
      border-radius: 3px;
      padding: 10px 10px 8px;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
  
    .emotion-header { display: flex; align-items: center; gap: 7px; }
  
    .emotion-swatch {
      width: 10px; height: 10px;
      border-radius: 50%;
      flex-shrink: 0;
    }
  
    .emotion-name {
      font-family: 'Space Mono', monospace;
      font-size: 10px;
      font-weight: 700;
      color: #5A3E28;
      flex: 1;
    }
  
    .emotion-opp {
      font-family: 'DM Sans', sans-serif;
      font-size: 8px;
      color: #BFA080;
      letter-spacing: 0.04em;
      white-space: nowrap;
    }
  
    .emotion-intensities { display: flex; gap: 4px; flex-wrap: wrap; }
  
    .intensity-chip {
      font-family: 'DM Sans', sans-serif;
      font-size: 8px;
      color: #3A2010;
      padding: 2px 6px;
      border-radius: 20px;
      white-space: nowrap;
      letter-spacing: 0.03em;
    }
  
    .emotion-desc {
      font-family: 'DM Sans', sans-serif;
      font-size: 9.5px;
      color: #8A6A4A;
      line-height: 1.55;
      margin: 0;
    }
  
    .journey-tags { display: flex; align-items: center; flex-wrap: wrap; gap: 4px; margin-top: 2px; }
  
    .tags-label {
      font-family: 'DM Sans', sans-serif;
      font-size: 8px;
      text-transform: uppercase;
      letter-spacing: 0.07em;
      color: #BFA080;
      flex-shrink: 0;
    }
  
    .journey-tag {
      font-family: 'Space Mono', monospace;
      font-size: 7.5px;
      color: #7A5A3A;
      background: #F4EFE5;
      border: 1px solid #DFC3A8;
      border-radius: 2px;
      padding: 2px 5px;
      white-space: nowrap;
    }
  
    /* ── Dyads ──────────────────────────────────────────────────── */
    .dyads-list { display: flex; flex-direction: column; gap: 10px; }
  
    .dyad-row { display: flex; align-items: flex-start; gap: 10px; }
  
    .dyad-swatch {
      width: 28px; height: 28px;
      border-radius: 3px;
      flex-shrink: 0;
      margin-top: 2px;
      opacity: 0.85;
    }
  
    .dyad-content { flex: 1; display: flex; flex-direction: column; gap: 3px; }
  
    .dyad-name-row { display: flex; align-items: baseline; gap: 8px; }
  
    .dyad-name {
      font-family: 'Space Mono', monospace;
      font-size: 10px;
      font-weight: 700;
      color: #5A3E28;
      text-transform: capitalize;
    }
  
    .dyad-components {
      font-family: 'DM Sans', sans-serif;
      font-size: 9px;
      color: #BFA080;
      letter-spacing: 0.03em;
    }
  
    .dyad-note {
      font-family: 'DM Sans', sans-serif;
      font-size: 10px;
      color: #8A6A4A;
      margin: 0;
      line-height: 1.55;
    }
  </style>