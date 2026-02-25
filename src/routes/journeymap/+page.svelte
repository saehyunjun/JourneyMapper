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
  import JourneyInfoSources from '$lib/journeymapper2/JourneyInfoSources.svelte';


  import { STEP_WIDTH, LEFT_AXIS_WIDTH, valueToY } from '$lib/journeymapper2/journeyConfig.js';
  import { selectedIndex, zoomedIndex } from '$lib/journeymapper2/journeyStore.js';
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

  // True when the user is interacting with the main timeline
  $: timelineActive = $selectedIndex >= 0 || drawerOpen;

  function handlePersonaSelect(event) {
    switchPersona(event.detail.id);
  }

  /** @param {string} id */
  function switchPersona(id) {
    activePersonaId = id;
    selectedIndex.set(-1);
    zoomedIndex.set(-1);
    if (drawerMode === 'step') drawerMode = null;
  }

  function openPersonaDrawer() {
    selectedIndex.set(-1);
    drawerMode = drawerMode === 'persona' ? null : 'persona';
  }

  function handleDrawerClose() {
    drawerMode = null;
    selectedIndex.set(-1);
    zoomedIndex.set(-1);
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

  // ── Zoom: smooth-scroll + scale around the active step ──────────────────
  let zoomScale = 1;
  /** @type {string} */
  let zoomOriginX = '70%';

  $: {
    if ($zoomedIndex >= 0 && scrollEl) {
      const stepCenterX = LEFT_AXIS_WIDTH + $zoomedIndex * STEP_WIDTH + STEP_WIDTH / 2;
      const containerWidth = scrollEl.clientWidth;
      scrollEl.scrollTo({ left: Math.max(0, stepCenterX - containerWidth / 3), behavior: 'smooth' });
      zoomScale = 1.28;
      zoomOriginX = `${stepCenterX}px`;
    } else {
      zoomScale = 1;
      zoomOriginX = '50%';
    }
  }

  /** Handles the openDrawer event dispatched by chart components on second click */
  function handleOpenDrawer(/** @type {CustomEvent} */ e) {
    const idx = e?.detail?.index ?? $zoomedIndex;
    selectedIndex.set(idx);
    drawerMode = 'step';
  }

  /** Escape: first press clears zoom, second press closes drawer */
  function handleGlobalKeydown(/** @type {KeyboardEvent} */ e) {
    if (e.key === 'Escape') {
      if (drawerMode) {
        drawerMode = null;
        selectedIndex.set(-1);
        zoomedIndex.set(-1);
      } else if ($zoomedIndex >= 0) {
        zoomedIndex.set(-1);
        selectedIndex.set(-1);
      }
    }
  }
</script>

<svelte:window on:keydown={handleGlobalKeydown} />

<div class="journey-wrapper">

  <!-- ── Title bar ────────────────────────────────────────────────────── -->
  <div class="title-bar">
    <span class="h3 heading blue">JourneyMapper</span>
    <span class="nav-title">Powered by PatientlyIQ</span>

    <!-- Plutchik button lives in the nav bar, right-aligned -->
    <div class="nav-right">
      <button
        class="plutchik-btn"
        class:plutchik-btn--active={drawerMode === 'plutchik'}
        on:click={() => { drawerMode = drawerMode === 'plutchik' ? null : 'plutchik'; selectedIndex.set(-1); }}
      >
        About Plutchik
      </button>
    </div>
  </div>

  <!-- ── Body row: sidebar + main ─────────────────────────────────────── -->
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

      <!-- Persona profile strip -->
      <PersonaProfileCard
        {personaProfile}
        isOpen={drawerMode === 'persona'}
        onClick={openPersonaDrawer}
      />

      <!-- ── Chart area ──────────────────────────────────────────────── -->
      <div class="journey-index">
        <div class="chart-zoom-clip">

          <!-- BUG FIX: shared-scroll properly wraps ALL chart children -->
          <div
            class="shared-scroll"
            bind:this={scrollEl}
            style="transform: scale({zoomScale}); transform-origin: {zoomOriginX} center; transition: transform 380ms cubic-bezier(0.34, 1.2, 0.64, 1);"
          >
            <JourneyStages data={journeyData} />
            <JourneySentiment data={journeyData} on:openDrawer={handleOpenDrawer} />

            <JourneyGrid data={journeyData} on:openDrawer={handleOpenDrawer}>
              {#each metrics as m}
                <JourneyLine  data={journeyData} metricKey={m.key} color={m.color} label={m.label} />
              {/each}
              {#each metrics as m, mi}
                <JourneyNodes data={journeyData} metricKey={m.key} color={m.color} offsets={nodeOffsets[mi]} />
              {/each}
            </JourneyGrid>

            <JourneySteps data={journeyData} on:openDrawer={handleOpenDrawer} />

            <JourneyLegend items={metrics} />
            <JourneyInfoSources data={journeyData} />

            <JourneyTooltip
              data={journeyData}
              metrics={metrics}
              anchorEl={scrollEl}
              stepWidth={STEP_WIDTH}
              axisWidth={LEFT_AXIS_WIDTH}
            />
          </div><!-- end shared-scroll -->

        </div><!-- end chart-zoom-clip -->
      </div><!-- end journey-index -->

    </div><!-- end journey-main -->
  </div><!-- end journey-body -->

</div><!-- end journey-wrapper -->

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

<style>
  :global(body) { background: #FAF9F5; margin: 0; padding: 0; }

  /* ── Wrapper ────────────────────────────────────────────────────────── */
  .journey-wrapper {
    display: flex;
    flex-direction: column;
    height: 100vh;
  }

  /* ── Title bar ──────────────────────────────────────────────────────── */
  .title-bar {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 0 20px;
    height: 44px;
    background: #EDE5D8;
    border-bottom: 1px solid #DFC3A8;
    flex-shrink: 0;
  }

  .nav-right {
    margin-left: auto;
  }

  .plutchik-btn {
    font-family: 'DM Sans', sans-serif;
    font-size: 11px;
    font-weight: 500;
    color: #A08060;
    background: none;
    border: 1px solid #DFC3A8;
    border-radius: 3px;
    padding: 5px 10px;
    cursor: pointer;
    transition: background 0.14s, color 0.14s;
  }

  .plutchik-btn:hover,
  .plutchik-btn--active {
    background: #DFC3A8;
    color: #5A3E28;
  }

  /* ── Body row ───────────────────────────────────────────────────────── */
  .journey-body {
    display: flex;
    flex-direction: row;
    flex: 1;
    overflow: hidden;
    min-height: 0;
  }

  /* ── Main column ────────────────────────────────────────────────────── */
  .journey-main {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-width: 0;
    overflow: hidden;
  }

  /* ── Chart area ─────────────────────────────────────────────────────── */
  .journey-index {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
    overflow: hidden;
  }

  .chart-zoom-clip {
    flex: 1;
    overflow: hidden;
    position: relative;
  }

  .shared-scroll {
    overflow-x: auto;
    overflow-y: visible;
    width: 100%;
    height: 50vh;
    /* transform applied inline via Svelte binding */
  }

  /* Scrollbar styling */
  .shared-scroll::-webkit-scrollbar { height: 6px; }
  .shared-scroll::-webkit-scrollbar-track { background: transparent; }
  .shared-scroll::-webkit-scrollbar-thumb { background: #DFC3A8; border-radius: 3px; }
</style>