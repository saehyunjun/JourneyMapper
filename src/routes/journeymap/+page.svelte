<script>
  import JourneyGrid          from '$lib/journeymapper2/JourneyGrid.svelte';
  import JourneyLine          from '$lib/journeymapper2/JourneyLine.svelte';
  import JourneyNodes         from '$lib/journeymapper2/JourneyNodes.svelte';
  import JourneyLegend        from '$lib/journeymapper2/JourneyLegend.svelte';
  import JourneySteps         from '$lib/journeymapper2/JourneySteps.svelte';
  import JourneyStages        from '$lib/journeymapper2/JourneyStages.svelte';
  import JourneySentiment     from '$lib/journeymapper2/JourneySentiment.svelte';
  import JourneyTooltip       from '$lib/journeymapper2/JourneyTooltip.svelte';
  import JourneyDrawer        from '$lib/journeymapper2/JourneyDrawer.svelte';
  import StepDetailContent    from '$lib/journeymapper2/StepDetailContent.svelte';
  import PlutchikContent      from '$lib/journeymapper2/PlutchikContent.svelte';
  import PersonaDetailContent from '$lib/journeymapper2/PersonaDetailContent.svelte';
  import PersonaSelectorSidebar from '$lib/journeymapper2/PersonaSelectorSidebar.svelte';
  import PersonaProfileCard   from '$lib/journeymapper2/PersonaProfileCard.svelte';
  import { STEP_WIDTH, LEFT_AXIS_WIDTH, valueToY } from '$lib/journeymapper2/journeyConfig.js';
  import { selectedIndex } from '$lib/journeymapper2/journeyStore.js';
  import personaFile from '$lib/journeymapper2/journeyPersonas.json';
  

  const { metrics, personas } = personaFile;

  /** @type {Record<string, any>} */
  const experienceWheels = personaFile.experienceWheels ?? {};

  // ── Active persona ────────────────────────────────────────────────────


  let activePersonaId = personas[0].id;
  /** @type {any} */
  $: activePersona = personas.find((p) => p.id === activePersonaId) ?? personas?.[0] ?? null;

  /** @type {any[]} */
  $: journeyData = activePersona?.journey ?? [];

  /** @type {any} */
  $: personaProfile = activePersona?.profile ?? {};

  // Wheel data for the currently selected step
  $: selectedStep      = $selectedIndex >= 0 ? (journeyData[$selectedIndex] ?? null) : null;
  $: selectedWheelData = selectedStep?.step_id ? (experienceWheels[selectedStep.step_id] ?? null) : null;

  // ── Jitter offsets for coincident nodes ──────────────────────────────
  const JITTER = 7;

  /**
   * @param {any[]} data
   * @param {{ key: string }[]} mets
   */
  function computeOffsets(data, mets) {
    const ns = data.length, nm = mets.length;
    const offs = mets.map(() => new Array(ns).fill(0));
    for (let si = 0; si < ns; si++) {
      const g = new Map();
      for (let mi = 0; mi < nm; mi++) {
        const key = Math.round(valueToY(data[si]?.[mets[mi].key]));
        if (!g.has(key)) g.set(key, []);
        g.get(key).push(mi);
      }
      for (const grp of g.values()) {
        if (grp.length < 2) continue;
        const half = (grp.length - 1) / 2;
        grp.forEach((mi, slot) => { offs[mi][si] = (slot - half) * JITTER; });
      }
    }
    return offs;
  }

  $: nodeOffsets = computeOffsets(journeyData, metrics);

  // ── Drawer state: 'step' | 'plutchik' | 'persona' | null ─────────────
  /** @type {'step' | 'plutchik' | 'persona' | null} */
  let drawerMode = null;
  $: drawerOpen = drawerMode !== null;


  // ── Timeline active state (collapses persona sidebar) ────────────────────
  // True when the user is interacting with the main timeline (step selected or drawer open)
  $: timelineActive = $selectedIndex >= 0 || drawerOpen;

  // Auto-open step drawer when a step is selected
  $: if ($selectedIndex >= 0 && drawerMode !== 'step') drawerMode = 'step';
  function handlePersonaSelect(event) {
    switchPersona(event.detail.id);
  }

  /** @param {string} id */
  function switchPersona(id) {
    activePersonaId = id;
    selectedIndex.set(-1);
    if (drawerMode === 'step') drawerMode = null;
  }

  function openPersonaDrawer() {
    selectedIndex.set(-1);
    drawerMode = drawerMode === 'persona' ? null : 'persona';
  }

  function handleDrawerClose() {
    drawerMode = null;
    selectedIndex.set(-1);
  }

  $: drawerEyebrow =
    drawerMode === 'plutchik' ? 'Methodology' :
    drawerMode === 'persona'  ? ((activePersona?.type ?? '').charAt(0).toUpperCase() + (activePersona?.type ?? '').slice(1)) :
    journeyData?.[$selectedIndex]?.stage ?? '';

  $: drawerTitle =
    drawerMode === 'plutchik' ? "Plutchik's Wheel of Emotions" :
    drawerMode === 'persona'  ? (activePersona?.profile?.name ?? '') :
    drawerMode === 'step' && journeyData?.[$selectedIndex]
      ? `${$selectedIndex + 1} / ${journeyData.length}` : '';

  $: drawerWidth = drawerMode === 'persona' ? 460 : (drawerMode === 'step' && selectedWheelData) ? 740 : 520;

  /** @type {HTMLDivElement | null} */
  let scrollEl = null;

  
</script>

<div class="journey-wrapper">

  <!-- ── Nav bar ──────────────────────────────────────────────────────── -->
  <div class="title-bar flex flex-row min-w-full">
  <span class="h3 heading blue">JourneyMapper</span> 
  <span class="nav-title">Powered by PatientlyIQ</span>
  </div>

  <nav class="nav-bar">
    <div class="nav-left">
      <!-- Persona switcher tabs removed (moved to sidebar) -->
    </div>

  <!-- ── Body row: sidebar + main content ─────────────────────────────── -->
  <div class="journey-body">

    <!-- LEFT: Persona selector sidebar -->
    <PersonaSelectorSidebar
      {personas}
      {activePersonaId}
      {timelineActive}
      on:select={handlePersonaSelect}
    />

    <!-- RIGHT: main content column -->
    <div class="journey-main">

      <!-- ── Persona Profile Card (extracted component) ──────────────── -->
      <PersonaProfileCard
        {personaProfile}
        isOpen={drawerMode === 'persona'}
        onClick={openPersonaDrawer}
      />



      <!-- ── Chart area ──────────────────────────────────────────────── -->
      <div class="journey-index">
        <div class="shared-scroll" bind:this={scrollEl}>
          <JourneyStages data={journeyData} />
          <JourneySteps data={journeyData} />

          <JourneySentiment data={journeyData} />

          <JourneyGrid data={journeyData}>
            {#each metrics as m}
              <JourneyLine  data={journeyData} metricKey={m.key} color={m.color} label={m.label} />
            {/each}
            {#each metrics as m, mi}
              <JourneyNodes data={journeyData} metricKey={m.key} color={m.color} offsets={nodeOffsets[mi]} />
            {/each}
          </JourneyGrid>
          <JourneyLegend items={metrics} />
          <JourneyTooltip
            data={journeyData}
            metrics={metrics}
            anchorEl={scrollEl}
            stepWidth={STEP_WIDTH}
            axisWidth={LEFT_AXIS_WIDTH}
          />
        </div>
      </div>

    </div>
  </div>

</div>

<!-- ── Shared drawer ──────────────────────────────────────────────────── -->
<JourneyDrawer
  bind:open={drawerOpen}
  eyebrow={drawerEyebrow}
  title={drawerTitle}
  width={drawerWidth}
  on:close={handleDrawerClose}
>
  {#if drawerMode === 'step'}
    <StepDetailContent data={journeyData} metrics={metrics} wheelData={selectedWheelData} />
  {:else if drawerMode === 'plutchik'}
    <PlutchikContent />
  {:else if drawerMode === 'persona'}
    <PersonaDetailContent persona={activePersona} />
  {/if}

  <svelte:fragment slot="footer">
    {#if drawerMode === 'step'}
      <button
        class="nav-btn"
        disabled={$selectedIndex <= 0}
        on:click={() => selectedIndex.update(i => i - 1)}
        aria-label="Previous step"
      >
        Prev
      </button>
      <div class="step-dots">
        {#each journeyData as _, i}
          <button
            class="step-dot"
            class:active={i === $selectedIndex}
            on:click={() => selectedIndex.set(i)}
            aria-label="Go to step {i + 1}"
          />
        {/each}
      </div>
      <button
        class="nav-btn"
        disabled={$selectedIndex >= journeyData.length - 1}
        on:click={() => selectedIndex.update(i => i + 1)}
        aria-label="Next step"
      >
        Next
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M6 3L11 8L6 13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>

    {:else if drawerMode === 'plutchik'}
      <span class="cite">
        Plutchik, R. (1980). <em>Emotion: A Psychoevolutionary Synthesis.</em> Harper & Row.
      </span>
      <button class="close-btn" on:click={handleDrawerClose}>Close</button>

    {:else if drawerMode === 'persona'}
      <span class="persona-footer-note">
        {activePersona.journey.length} steps ·
        {[...new Set(activePersona.journey.map(d => d.stage_id))].length} stages
      </span>
      <button class="close-btn" on:click={handleDrawerClose}>Close</button>
    {/if}
  </svelte:fragment>
</JourneyDrawer>
<button
class="nav-btn"
class:plutchik-btn--active={drawerMode === 'plutchik'}
on:click={() => { drawerMode = drawerMode === 'plutchik' ? null : 'plutchik'; selectedIndex.set(-1); }}
>
About Plutchik
</button>


<style>

  :global(body) { background: #FAF9F5; margin: 0; padding: 0; }

  .journey-wrapper {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  /* ── Body row ─────────────────────────────────────────────────────── */
  .journey-body {
    display: flex;
    flex-direction: row;
    flex: 1;
    overflow: hidden;
    min-height: 0;
  }

</style>