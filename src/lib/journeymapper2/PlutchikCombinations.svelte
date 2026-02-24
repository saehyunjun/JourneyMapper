<script>
  import { hoveredEmotions, hoverPair, hoverClear } from './plutchikStore.js';

  // Mid-ring colors from PlutchikWheel.svelte — the representative swatch per emotion
  const EC = {
    joy:          '#FFD600',
    trust:        '#43A047',
    fear:         '#7CB342',
    surprise:     '#039BE5',
    sadness:      '#1E88E5',
    disgust:      '#8E24AA',
    anger:        '#E53935',
    anticipation: '#FB8C00',
  };

  const COLUMNS = [
    {
      heading: 'Primary Dyads',
      dyads: [
        { name: 'Love',           emotions: ['joy', 'trust'] },
        { name: 'Submission',     emotions: ['trust', 'fear'] },
        { name: 'Alarm',          emotions: ['fear', 'surprise'] },
        { name: 'Disappointment', emotions: ['surprise', 'sadness'] },
        { name: 'Remorse',        emotions: ['sadness', 'disgust'] },
        { name: 'Contempt',       emotions: ['disgust', 'anger'] },
        { name: 'Aggression',     emotions: ['anger', 'anticipation'] },
        { name: 'Optimism',       emotions: ['anticipation', 'joy'] },
      ],
    },
    {
      heading: 'Secondary Dyads',
      dyads: [
        { name: 'Guilt',     emotions: ['joy', 'fear'] },
        { name: 'Curiosity', emotions: ['trust', 'surprise'] },
        { name: 'Despair',   emotions: ['fear', 'sadness'] },
        { name: 'Unbelief',  emotions: ['surprise', 'disgust'] },
        { name: 'Envy',      emotions: ['sadness', 'anger'] },
        { name: 'Cynicism',  emotions: ['disgust', 'anticipation'] },
        { name: 'Pride',     emotions: ['anger', 'joy'] },
        { name: 'Hope',      emotions: ['anticipation', 'trust'] },
      ],
    },
    {
      heading: 'Tertiary Dyads',
      dyads: [
        { name: 'Delight',        emotions: ['joy', 'surprise'] },
        { name: 'Sentimentality', emotions: ['trust', 'sadness'] },
        { name: 'Shame',          emotions: ['fear', 'disgust'] },
        { name: 'Outrage',        emotions: ['surprise', 'anger'] },
        { name: 'Pessimism',      emotions: ['sadness', 'anticipation'] },
        { name: 'Morbidness',     emotions: ['disgust', 'joy'] },
        { name: 'Dominance',      emotions: ['anger', 'trust'] },
        { name: 'Anxiety',        emotions: ['anticipation', 'fear'] },
      ],
    },
    {
      heading: 'Opposite Dyads',
      dyads: [
        { name: 'Bittersweetness', emotions: ['joy', 'sadness'] },
        { name: 'Ambivalence',     emotions: ['trust', 'disgust'] },
        { name: 'Frozenness',      emotions: ['fear', 'anger'] },
        { name: 'Confusion',       emotions: ['surprise', 'anticipation'] },
      ],
    },
  ];

  function rowOp(dyad) {
    if ($hoveredEmotions.size === 0) return 1;
    const [a, b] = dyad.emotions;
    return ($hoveredEmotions.has(a) || $hoveredEmotions.has(b)) ? 1 : 0.15;
  }
</script>

<div class="combinations">
  {#each COLUMNS as col}
    <div class="col">
      <div class="col-heading">{col.heading}</div>
      <ul class="dyad-list">
        {#each col.dyads as dyad}
          <li
            class="dyad-row"
            style="opacity: {rowOp(dyad)}; transition: opacity 0.18s ease;"
            on:mouseenter={() => hoverPair(dyad.emotions[0], dyad.emotions[1])}
            on:mouseleave={hoverClear}
          >
            <div class="swatches">
              <span class="swatch" style="background: {EC[dyad.emotions[0]]};" title={dyad.emotions[0]} />
              <span class="swatch" style="background: {EC[dyad.emotions[1]]};" title={dyad.emotions[1]} />
            </div>
            <span class="dyad-name">{dyad.name}</span>
            <span class="dyad-parents">{dyad.emotions[0]} + {dyad.emotions[1]}</span>
          </li>
        {/each}
      </ul>
    </div>
  {/each}
</div>

<style>
  .combinations {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 20px;
    padding: 16px 0;
  }

  .col {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .col-heading {
    font-family: 'DM Sans', sans-serif;
    font-size: 9px;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: #BFA080;
    padding-bottom: 6px;
    border-bottom: 1px solid #DFC3A8;
    margin-bottom: 4px;
    white-space: nowrap;
  }

  .dyad-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  .dyad-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 5px 6px;
    border-radius: 2px;
    cursor: default;
  }

  .dyad-row:hover {
    background: #EDE5D8;
  }

  .swatches {
    display: flex;
    gap: 2px;
    flex-shrink: 0;
  }

  .swatch {
    display: block;
    width: 8px;
    height: 8px;
    border-radius: 1px;
    flex-shrink: 0;
  }

  .dyad-name {
    font-family: 'Space Mono', monospace;
    font-size: 10px;
    color: #5A3E28;
    letter-spacing: 0.02em;
    flex: 1;
    white-space: nowrap;
  }

  .dyad-parents {
    font-family: 'DM Sans', sans-serif;
    font-size: 8.5px;
    color: #BFA080;
    white-space: nowrap;
    text-transform: capitalize;
  }
</style>