<script>
  export let items = [];

  // Descriptor copy for each metric key
  const DESCRIPTORS = {
    emotional_valence: {
      title:   'Emotional Valence',
      body:    'The overall positive or negative quality of the patient\'s felt experience at this step — distinct from cognition. Ranges from deep distress (−5) to genuine wellbeing (+5).',
      range:   '−5 Distress → +5 Wellbeing',
    },
    provider_trust: {
      title:   'Trust in Providers',
      body:    'Degree of confidence and reliance the patient places in their clinical team. Erodes after misdiagnosis or poor communication; rebuilds through transparency and follow-through.',
      range:   '−5 Distrust → +5 Full Confidence',
    },
    medical_self_efficacy: {
      title:   'Medical Self-Efficacy',
      body:    'The patient\'s belief in their own capacity to understand, navigate, and advocate within the healthcare system. Low efficacy correlates with passivity and missed care.',
      range:   '−5 Helpless → +5 Empowered',
    },
    logistical_capacity: {
      title:   'Logistical Capacity',
      body:    'Ability to manage the practical burdens of care: scheduling, transport, insurance, caregiving coordination, and financial strain. Often the hidden driver of disengagement.',
      range:   '−5 Overwhelmed → +5 Fully Managed',
    },
  };

  // Fallback for metrics not in the map
  function getDescriptor(item) {
    return DESCRIPTORS[item.key] ?? {
      title: item.label,
      body:  'No description available.',
      range: '',
    };
  }

  let hoveredKey  = null;
  let mouseX      = 0;
  let mouseY      = 0;

  const TIP_W     = 280;
  const TIP_H_EST = 110; // approximate — enough for flip logic
  const OFFSET_X  = 14;
  const OFFSET_Y  = 10;

  function onMouseMove(e) {
    mouseX = e.clientX;
    mouseY = e.clientY;
  }

  $: vpW      = typeof window !== 'undefined' ? window.innerWidth  : 9999;
  $: vpH      = typeof window !== 'undefined' ? window.innerHeight : 9999;
  $: flipLeft = mouseX + OFFSET_X + TIP_W > vpW - 12;
  $: flipUp   = mouseY + OFFSET_Y + TIP_H_EST > vpH - 12;
  $: tipX     = flipLeft ? mouseX - TIP_W - OFFSET_X : mouseX + OFFSET_X;
  $: tipY     = flipUp   ? mouseY - TIP_H_EST - OFFSET_Y : mouseY + OFFSET_Y;

  $: activeDescriptor = hoveredKey ? getDescriptor({ key: hoveredKey, label: hoveredKey }) : null;
  $: activeItem       = items.find(i => i.key === hoveredKey) ?? null;
</script>

<svelte:window on:mousemove={onMouseMove} />

<div class="legend">
  {#each items as item}
    <div
      class="legend-item"
      class:legend-item--active={hoveredKey === item.key}
      role="button"
      tabindex="0"
      aria-label="{item.label} — hover for description"
      on:mouseenter={() => hoveredKey = item.key}
      on:mouseleave={() => hoveredKey = null}
      on:focus={() => hoveredKey = item.key}
      on:blur={() => hoveredKey = null}
    >
      <!-- Pill swatch — thicker than a plain dot to signal interactivity -->
      <span
        class="swatch"
        style="background: {item.color};"
        aria-hidden="true"
      />
      <span class="label">{item.label}</span>
      <!-- Subtle "?" hint -->
      <span class="hint" aria-hidden="true">?</span>
    </div>
  {/each}
</div>

<!-- ── Floating tooltip ───────────────────────────────────────────────────── -->
{#if hoveredKey && activeDescriptor && activeItem}
  <div
    class="metric-tooltip"
    style="left: {tipX}px; top: {tipY}px; width: {TIP_W}px;"
    role="tooltip"
    aria-live="polite"
  >
    <!-- Header -->
    <div class="tip-header">
      <span class="tip-swatch" style="background: {activeItem.color};" />
      <span class="tip-title">{activeDescriptor.title}</span>
    </div>

    <!-- Body -->
    <p class="tip-body">{activeDescriptor.body}</p>

    <!-- Range footer -->
    {#if activeDescriptor.range}
      <div class="tip-range">
        <span class="range-label">Scale</span>
        <span class="range-value">{activeDescriptor.range}</span>
      </div>
    {/if}
  </div>
{/if}

<style>
  /* ── Legend strip ─────────────────────────────────────────────────────── */
  .legend {
    display: flex;
    flex-direction: row;
    align-items: center;
    flex-wrap: wrap;
    gap: 4px 12px;
    padding: 4px 0;
  }

  .legend-item {
    display: flex;
    align-items: center;
    gap: 7px;
    padding: 3px 7px 3px 5px;
    border-radius: 3px;
    border: 1px solid transparent;
    cursor: default;
    transition: background 0.15s ease, border-color 0.15s ease;
    user-select: none;
    outline: none;
  }

  .legend-item:hover,
  .legend-item:focus,
  .legend-item--active {
    background: #EDE5D8;
    border-color: #DFC3A8;
  }

  .swatch {
    display: block;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    flex-shrink: 0;
    opacity: 0.9;
    transition: transform 0.15s ease;
  }

  .legend-item--active .swatch {
    transform: scale(1.3);
  }

  .label {
    font-family: 'DM Sans', sans-serif;
    font-size: 10px;
    color: #7A5A3A;
    letter-spacing: 0.02em;
    line-height: 1;
    transition: color 0.15s ease;
  }

  .legend-item--active .label {
    color: #5A3E28;
  }

  /* Subtle "?" badge — only visible on hover */
  .hint {
    font-family: 'Space Mono', monospace;
    font-size: 7px;
    color: #BFA080;
    background: #DFC3A8;
    border-radius: 50%;
    width: 12px;
    height: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0;
    transition: opacity 0.15s ease;
    flex-shrink: 0;
    line-height: 1;
  }

  .legend-item:hover .hint,
  .legend-item:focus .hint,
  .legend-item--active .hint {
    opacity: 1;
  }

  /* ── Tooltip ──────────────────────────────────────────────────────────── */
  .metric-tooltip {
    position: fixed;
    pointer-events: none;
    z-index: 400;
    background: #F4EFE5;
    border: 1px solid #DFC3A8;
    border-radius: 4px;
    padding: 10px 12px 12px;
    box-shadow: 0 4px 20px rgba(90, 62, 40, 0.16);
    display: flex;
    flex-direction: column;
    gap: 8px;
    transition: left 60ms linear, top 60ms linear;
  }

  /* Header row */
  .tip-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding-bottom: 8px;
    border-bottom: 0.5px dotted #5A3E28;
  }

  .tip-swatch {
    display: block;
    width: 8px;
    height: 14px;
    border-radius: 2px;
    flex-shrink: 0;
    opacity: 0.9;
  }

  .tip-title {
    font-family: 'Space Mono', monospace;
    font-size: 10px;
    font-weight: 700;
    color: #5A3E28;
    letter-spacing: 0.04em;
  }

  /* Body */
  .tip-body {
    font-family: 'DM Sans', sans-serif;
    font-size: 10.5px;
    color: #7A5A3A;
    line-height: 1.65;
    margin: 0;
  }

  /* Range footer */
  .tip-range {
    display: flex;
    align-items: center;
    gap: 8px;
    padding-top: 6px;
    border-top: 1px solid #EDE5D8;
  }

  .range-label {
    font-family: 'DM Sans', sans-serif;
    font-size: 8px;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: #BFA080;
    flex-shrink: 0;
  }

  .range-value {
    font-family: 'Space Mono', monospace;
    font-size: 8.5px;
    color: #8A6A4A;
    letter-spacing: 0.02em;
  }
</style>