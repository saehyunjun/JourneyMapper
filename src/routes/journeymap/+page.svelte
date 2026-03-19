<script>
    import JourneyIndexBars from '$lib/journeymapper2/JourneyIndexBars.svelte';
    import JourneyLegend        from '$lib/journeymapper2/JourneyLegend.svelte';
    import JourneySteps         from '$lib/journeymapper2/JourneySteps.svelte';
    import JourneyStages        from '$lib/journeymapper2/JourneyStages.svelte';
    import JourneySentiment     from '$lib/journeymapper2/JourneySentiment.svelte';
    import JourneyFlowDiagram from '$lib/journeymapper2/JourneyFlowDiagram.svelte';
    import PersonaStory         from '$lib/journeymapper2/PersonaStory.svelte';
    import JourneyTooltip       from '$lib/journeymapper2/JourneyTooltip.svelte';
    import JourneyInfoSidebar from '$lib/journeymapper2/JourneyInfoSidebar.svelte';

    import JourneyDrawer        from '$lib/journeymapper2/JourneyDrawer.svelte';
    import StepDetailContent    from '$lib/journeymapper2/StepDetailContent.svelte';
    import PlutchikContent      from '$lib/journeymapper2/PlutchikContent.svelte';
    import PersonaDetailContent from '$lib/journeymapper2/PersonaDetailContent.svelte';
    import PersonaTopSelector   from '$lib/journeymapper2/PersonaTopSelector.svelte';
  
    import { STEP_WIDTH, LEFT_AXIS_WIDTH, valueToY } from '$lib/journeymapper2/journeyConfig.js';
    import { selectedIndex } from '$lib/journeymapper2/journeyStore.js';
  
    import CaretRight from "phosphor-icons-svelte/IconCaretRightRegular.svelte";
    import CaretLeft  from "phosphor-icons-svelte/IconCaretLeftRegular.svelte";
  
    import personaFile from '$lib/journeymapper2/journeyPersonas.json';
  
    const { metrics, personas } = personaFile;
  
    /** @type {Record<string, any>} */
    const experienceWheels = personaFile.experienceWheels ?? {};
  
    // ── Story overlay ─────────────────────────────────────────────────────
    let storyOpen    = false;
    /** @type {HTMLElement | null} */
    let storyOriginEl = null;
  
    // ── Active persona ────────────────────────────────────────────────────
    let activePersonaId = personas[0].id;
    /** @type {any} */
    $: activePersona  = personas.find((p) => p.id === activePersonaId) ?? personas?.[0] ?? null;
    /** @type {any[]} */
    $: journeyData    = activePersona?.journey ?? [];
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
  
    // ── Drawer state ──────────────────────────────────────────────────────
    /** @type {'step' | 'plutchik' | 'persona' | null} */
    let drawerMode = null;
    $: drawerOpen = drawerMode !== null;
  
    // Auto-open step drawer when a step is selected
    $: if ($selectedIndex >= 0 && drawerMode !== 'step') drawerMode = 'step';
  
    $: timelineActive = $selectedIndex >= 0 || drawerOpen;
  
    function handlePersonaSelect(e) {
      activePersonaId = e.detail.id;
      selectedIndex.set(-1);
    }
  
    function handlePersonaStory(e) {
      storyOriginEl = e.detail.originEl;
      storyOpen = true;
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
  
<div class="journey-wrapper overflow-x-scroll">

  <!-- ── Nav bar ─────────────────────────────────~─────────────────────── -->
  <div class="title-bar flex flex-row min-w-full">
    <span class="h3 nav-title">JourneyMapper</span>
    <span class="nav-title">Powered by PatientlyIQ</span>
  </div>

  <!-- ── Body ──────────────────────────────────────────────────────────── -->
  <div class="journey-body">
    <div class="journey-main">

      <!-- ── Persona selector — on:story wired here ─────────────────── -->
      <PersonaTopSelector
        {personas}
        {activePersonaId}
        on:select={handlePersonaSelect}
        on:story={handlePersonaStory}
      />

      <!-- ── Chart area ─────────────────────────────────────────────── -->
      <div class="journey-index">
        <JourneyFlowDiagram data={journeyData} />

        <div class="shared-scroll" bind:this={scrollEl}>

          <JourneyStages data={journeyData} />
          <JourneySteps  data={journeyData} />

          <JourneySentiment data={journeyData} />

          <div class="spacer"></div>
          <JourneyIndexBars data={journeyData} {metrics} />
          <JourneyLegend items={metrics} />

        </div>
      </div>

    </div>  

       <!-- RIGHT sidebar — 1/6 width, full height -->
       <JourneyInfoSidebar
       {activePersona}
       data={journeyData}
       {metrics}
     />
   </div>
  </div>



<!-- ── Drawer ────────────────────────────────────────────────────────────── -->
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
        class="btn-base"
        disabled={$selectedIndex <= 0}
        on:click={() => selectedIndex.update(i => i - 1)}
        aria-label="Previous step"
      ><CaretLeft /></button>

      <button
        class="btn-base"
        disabled={$selectedIndex >= journeyData.length - 1}
        on:click={() => selectedIndex.update(i => i + 1)}
        aria-label="Next step"
      ><CaretRight /></button>

    {:else if drawerMode === 'plutchik'}
      <span class="cite">
        Plutchik, R. (1980). <em>Emotion: A Psychoevolutionary Synthesis.</em> Harper & Row.
      </span>
      <button class="btn-sm" on:click={handleDrawerClose}>Close</button>

    {:else if drawerMode === 'persona'}
      <span class="persona-footer-note">
        {activePersona.journey.length} steps ·
        {[...new Set(activePersona.journey.map(d => d.stage_id))].length} stages
      </span>
      <button class="btn-sm" on:click={handleDrawerClose}>Close</button>
    {/if}
  </svelte:fragment>
</JourneyDrawer>

<!-- ── Story overlay ─────────────────────────────────────────────────────── -->
<PersonaStory
  bind:open={storyOpen}
  {personas}
  activeIndex={personas.findIndex(p => p.id === activePersonaId)}
  originEl={storyOriginEl}
  on:close={() => storyOpen = false}
  on:select={e => { activePersonaId = e.detail.id; }}
/>

<style>
  .shared-scroll {
    position: relative;
    overflow-x: scroll;
    z-index: 1;
    height: 100px;
  }
</style>