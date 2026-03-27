<script>
    import IconArrowRightBold from 'phosphor-icons-svelte/IconArrowRightBold.svelte';
    import IconArrowsLeftRightBold from 'phosphor-icons-svelte/IconArrowsLeftRightBold.svelte';


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
      <p class="text-body">
        Robert Plutchik's psychoevolutionary theory (1980) proposes <strong>8 primary emotions</strong> arranged
        in opposing pairs. Emotions vary by <em>intensity</em> (inner = mild, outer = intense) and combine
        to form <em>dyads</em> — blended emotions that describe complex affective states.
      </p>
      <p class="text-body">
        In this journey map, each step is tagged with a Plutchik emotion or dyad derived from
        qualitative patient narratives. These scores inform the <strong>Overall Sentiment</strong> track
        and the emotional state metric.
      </p>
    </div>
  
  
    <!-- Primary emotions -->
    <h2 class="heading-sm">The Eight Primary Emotions</h2>
    <div class="emotions-grid">
      {#each primaryEmotions as e}
        <div class="card-body">
          <div class="toolbar-sm-empty">
            <span class="jm-swatch-round" style="background: {e.color};"> </span>
            <span class="label uppercase">{e.name}</span>
            <IconArrowsLeftRightBold class="text-sm" />
            <span class="label uppercase font-medium"> {e.opposite}</span>
          </div>
          <p class="text-body-sm">{e.description}</p>
          <div class="toolbar-sm-empty mt-2">
            {#each e.intensity as level, idx}
              <span
                class="pill-label"
                style="opacity: {0.45 + idx * 0.275}; background: {e.color}; color:var(--ink)"
              >{level}</span>
            {/each}
          </div>
          {#if e.journeyExamples.length}
            <div class="toolbar-sm-empty mt-8 pt-2"
            style="border-top: 1px solid var(--panel-dark)">
              <span class="text-body">In this journey:</span>
              <div class="flex flex-row gap-1">
              {#each e.journeyExamples as ex}
                <span class="pill-sm"
                style="background: {e.color}; color:var(--ink); font-size:.525em font-weight:400">{ex}</span>
              {/each}
              </div>
            </div>
          {/if}
        </div>
      {/each}
    </div>
  
  
    <!-- Dyads -->
  <div class="flex flex-col gap-2">
  <div class="flex flex-col gap-1 mb-4">
    <h3 class="heading-sm uppercase">Dyads Used in This Journey</h3>
    <p class="text-body">Dyads are blended emotions formed when two adjacent primary emotions combine.</p>
  </div>
    
    <div class="flex flex-col gap-2">
      {#each dyads as d}
        <div class="flex flex-row gap-2 align-middle">
          <span class="jm-swatch-lg" 
          style="background: {d.color};"></span>
          
          <div class="flex flex-col align-bottom">
            <div class="flex flex-row gap-2 align-bottom justify-start">
              <span class="label uppercase my-auto">
                {d.components[0]} + {d.components[1]}</span>
            <IconArrowRightBold class="text-sm" />
            <span class="label uppercase">{d.name}</span>
          </div>
            <p class="text-body-sm">{d.note}</p>
          </div>
        </div>
      {/each}
    </div>
  </div>
  
    <!-- Scoring -->
  <div class="flex flex-col gap-2">
    <div class="heading-sm uppercase"
    >Scoring in This Map</div>
    <p class="text-body">
      Each Plutchik tag is translated to a <strong>−5 to +5 sentiment score</strong> reflecting the
      valence and intensity of the emotion at that journey step. Positive emotions (joy, trust, anticipation)
      trend above zero; negative emotions (grief, alarm, sadness) trend below. Neutral or ambivalent
      states (surprise, some dyads) sit near zero.
    </p>

  </div>
</div>
  
  <style>
    .content-wrap {
      padding: 20px;
      display: flex;
      flex-direction: column;
      gap: 18px;
    }

  
    /* ── Emotion cards ──────────────────────────────────────────── */
    .emotions-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
    }

  
 
  
  </style>