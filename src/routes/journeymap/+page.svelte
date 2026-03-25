<script lang="ts">
  import JourneyLayoutToggle from '$lib/journeymapper2/JourneyLayoutToggle.svelte';
  import JourneyIndexBars from '$lib/journeymapper2/JourneyIndexBars.svelte';
  import JourneyLegend        from '$lib/journeymapper2/JourneyLegend.svelte';
  import JourneySteps         from '$lib/journeymapper2/JourneySteps.svelte';
  import JourneyStages        from '$lib/journeymapper2/JourneyStages.svelte';
  import JourneySentiment     from '$lib/journeymapper2/JourneySentiment.svelte';
  import JourneyFlowDiagram from '$lib/journeymapper2/JourneyFlowDiagram.svelte';
  import InflectionDetailContent from '$lib/journeymapper2/InflectionDetailContent.svelte';
  import DiseaseSelectDropdowns from '$lib/journeymapper2/DiseaseSelectDropdowns.svelte';

  import PersonaStory         from '$lib/journeymapper2/PersonaStory.svelte';
  import JourneyTooltip       from '$lib/journeymapper2/JourneyTooltip.svelte';
  import JourneyInfoSidebar from '$lib/journeymapper2/JourneyInfoSidebar.svelte';

  import JourneyDrawer        from '$lib/journeymapper2/JourneyDrawer.svelte';
   
  import JourneySubDrawer from '$lib/journeymapper2/JourneySubDrawer.svelte';
  import PlutchikContent  from '$lib/journeymapper2/PlutchikContent.svelte';

  import StepDetailContent    from '$lib/journeymapper2/StepDetailContent.svelte';
  import PersonaDetailContent from '$lib/journeymapper2/PersonaDetailContent.svelte';
  import PersonaTopSelector   from '$lib/journeymapper2/PersonaTopSelector.svelte';

  import { STEP_WIDTH, LEFT_AXIS_WIDTH, valueToY } from '$lib/journeymapper2/journeyConfig.js';
  import { selectedIndex, selectedInflectionIndex, selectedInflectionPath } from '$lib/journeymapper2/journeyStore.js';
  import CaretRight from "phosphor-icons-svelte/IconCaretRightRegular.svelte";
  import CaretLeft  from "phosphor-icons-svelte/IconCaretLeftRegular.svelte";
  import IconChartLineRegular    from "phosphor-icons-svelte/IconChartLineRegular.svelte";
  import IconFlowArrowRegular    from "phosphor-icons-svelte/IconFlowArrowRegular.svelte";

  import personaFile from '$lib/journeymapper2/journeyPersonas.json';
  

  const { metrics, personas } = personaFile;
 
 $: filteredPersonas = personas.filter((p) => {
   if (selectedTherapeuticArea && p.therapeutic_area !== selectedTherapeuticArea) return false;
   if (selectedIndication      && p.indication       !== selectedIndication)       return false;
   return true;
 });
  
 $: stepIllustration = selectedStep
  ? `lib/static/illustrations/Regression1.jpeg`
  : 'lib/static/illustrations/Regression1.jpeg';

 // Reset active persona when the current one is filtered out
 $: if (filteredPersonas.length && !filteredPersonas.find((p) => p.id === activePersonaId)) {
   activePersonaId = filteredPersonas[0].id;
 }
   
  /** @type {Record<string, any>} */
  const experienceWheels = personaFile.experienceWheels ?? {};
  // ── Layout toggle ─────────────────────────────────────────────────────
  
  /** @type {'horizontal' | 'vertical'} */
  let layout = 'horizontal';
  $: isVertical = layout === 'vertical';
  
  // ── Chart view toggle ─────────────────────────────────────────────────
  /** @type {'chart' | 'flow'} */
  let chartView = 'chart';
  
  let selectedTherapeuticArea: string | undefined;
  let selectedIndication: string | undefined;
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

  // Auto-open step drawer when a step is selected
  $: if ($selectedIndex >= 0 && drawerMode !== 'step') drawerMode = 'step';

  // Auto-open inflection drawer when a fork path card is clicked
  $: if ($selectedInflectionIndex >= 0 && drawerMode !== 'inflection') drawerMode = 'inflection';

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
  /** @type {'step' | 'plutchik' | 'persona' | 'inflection' | null} */
  let drawerMode = null;

  $: drawerOpen = drawerMode !== null;

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
    selectedInflectionIndex.set(-1);
    selectedInflectionPath.set(null);
  }

  function handleChange(e) {
    selectedTherapeuticArea = e.detail.therapeuticArea;
    selectedIndication = e.detail.indication;
  }


let emotionSubDrawerOpen = false;
 
 function openEmotionDetail() {
   emotionSubDrawerOpen = true;
 }
  
 // Close sub-drawer when main drawer closes
 $: if (!drawerOpen) emotionSubDrawerOpen = false;

  $: drawerEyebrow =
    drawerMode === 'plutchik' ? 'Methodology' :
    drawerMode === 'persona'  ? ((activePersona?.type ?? '').charAt(0).toUpperCase() + (activePersona?.type ?? '').slice(1)) :
    journeyData?.[$selectedIndex]?.stage ?? '';

  $: drawerTitle =
    drawerMode === 'plutchik' ? "Plutchik's Wheel of Emotions" :
    drawerMode === 'persona'  ? (activePersona?.profile?.name ?? '') :
    drawerMode === 'step' && journeyData?.[$selectedIndex]
      ? `${$selectedIndex + 1} / ${journeyData.length}` : '';

      $: drawerWidth = drawerMode === 'persona' ? 460 : 520;

  /** @type {HTMLDivElement | null} */
  let scrollEl = null;
</script>

<!-- ── Page shell: full viewport height, no scroll on the outer wrapper ── -->
<div class="journey-wrapper flex flex-col h-screen overflow-hidden">


  <!-- ── Toolbar ──────────────────────────────────────────────────────── -->
  <div class="toolbar" role="tablist">
    <DiseaseSelectDropdowns
    {personas}
    on:change={handleChange}
      />
 
 <div class="flex flex-row gap-2 justify-start">
   <button
      class="btn-nav"
      class:view-tab--active={chartView === 'chart'}
      role="tab"
      aria-selected={chartView === 'chart'}
      on:click={() => chartView = 'chart'}
    >
      <IconChartLineRegular />
      <span class="label-sm">Journey Sentiment</span>
    </button>
    
    <button
      class="btn-nav"
      class:view-tab--active={chartView === 'flow'}
      role="tab"
      aria-selected={chartView === 'flow'}
      on:click={() => chartView = 'flow'}
    >
      <IconFlowArrowRegular />
      <span class="label-sm">Journey Flow</span>
    </button>
  </div>
  </div>

  <!-- ── Three-column body ────────────────────────────────────────────── -->
  <!--
    Left  : PersonaTopSelector  (fixed-width, full height, scrollable)
    Middle: chart / flow area   (flex-1, horizontally scrollable)
    Right : JourneyInfoSidebar  (fixed-width, full height, scrollable)
  -->
  <div class="journey-body flex flex-row flex-1 min-h-0">

    <!-- LEFT — persona selector column -->
    <div class="persona-col shrink-0 overflow-y-auto">
      <PersonaTopSelector
      personas={filteredPersonas}
      {activePersonaId}
      on:select={handlePersonaSelect}
      on:story={handlePersonaStory}
    />
    </div>

    <!-- MIDDLE — chart / flow, scrolls horizontally -->
    <div class="chart-col flex-1 min-w-0 overflow-x-auto overflow-y-hidden" bind:this={scrollEl}>
      {#if chartView === 'flow'}
      <div class="flex flex-col w-full justify-right">
      <JourneyLayoutToggle bind:layout />
      <JourneyFlowDiagram data={journeyData} {layout} />
      </div>
      {:else}
      <div class="toolbar px-4 py-2 w-full">
        <h3 class="heading-sm">Sentiment</h3>
      </div>
        <JourneyStages data={journeyData} />
        <JourneySteps  data={journeyData} />
        <JourneySentiment data={journeyData} />
        <div class="spacer"></div>
          <div class="toolbar px-4 py-2 w-full">
        <h3 class="heading-sm">Sentiment Drivers</h3>
      </div>

        <JourneyIndexBars data={journeyData} {metrics} />
        <JourneyLegend items={metrics} />
      {/if}

    </div>

    <!-- RIGHT — info sidebar column -->
    <div class="info-col shrink-0 overflow-y-auto">
      <JourneyInfoSidebar
        {activePersona}
        data={journeyData}
        {metrics}
      />
    </div>

  </div><!-- /journey-body -->

</div><!-- /journey-wrapper -->


<!-- ── Drawer ────────────────────────────────────────────────────────────── -->
<JourneyDrawer
  bind:open={drawerOpen}
  eyebrow={drawerEyebrow}
  title={drawerTitle}
  width={drawerWidth}
  on:close={handleDrawerClose}
>
  {#if drawerMode === 'step'}
<!-- AFTER -->
<StepDetailContent
  data={journeyData}
  metrics={metrics}
  illustrationSrc={stepIllustration}
  wheelData={selectedWheelData}
  on:openEmotionDetail={openEmotionDetail}
/>

{:else if drawerMode === 'plutchik'}
    <PlutchikContent />
  {:else if drawerMode === 'persona'}
    <PersonaDetailContent persona={activePersona} />
  {:else if drawerMode === 'inflection'}
    <InflectionDetailContent data={journeyData} />
  {/if}

  <svelte:fragment slot="footer">
    {#if drawerMode === 'step'}
    <div class="flex flex-row">
      <button
        class="btn-sm"
        disabled={$selectedIndex <= 0}
        on:click={() => selectedIndex.update(i => i - 1)}
        aria-label="Previous step"
        >
        <CaretLeft />
        </button>

      <button
        class="btn-sm-alt"
        disabled={$selectedIndex >= journeyData.length - 1}
        on:click={() => selectedIndex.update(i => i + 1)}
        aria-label="Next step"
        ><CaretRight /></button>
  </div>

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


<JourneySubDrawer
  bind:open={emotionSubDrawerOpen}
  eyebrow="Methodology"
  title="Plutchik's Wheel of Emotions"
  width={380}
  on:close={() => (emotionSubDrawerOpen = false)}
>
  <PlutchikContent />
 
  <svelte:fragment slot="footer">
    <span style="cite">
      Plutchik, R. (1980). <em>Emotion: A Psychoevolutionary Synthesis.</em> Harper &amp; Row.
    </span>
  </svelte:fragment>
</JourneySubDrawer>

<!-- ── Story overlay ─────────────────────────────────────────────────────── -->
<PersonaStory
  bind:open={storyOpen}
  personas={filteredPersonas}
  activeIndex={filteredPersonas.findIndex(p => p.id === activePersonaId)}
  originEl={storyOriginEl}
  on:close={() => storyOpen = false}
  on:select={e => { activePersonaId = e.detail.id; }}
/>

<JourneyTooltip data={journeyData} {metrics} />


<style>


  /* Middle scrolling chart area */
  .chart-col {
    position: relative;
    z-index: 1;
    padding-bottom: 1em;
    scrollbar-width: auto;
    overflow-x: scroll;   /* force horizontal scrollbar */
    overflow-y: hidden;   /* prevent vertical scrollbar */
    scrollbar-gutter: stable;    
    scrollbar-color: var(--color-orange-700);
    overflow: scroll;
  }

  /* Right info sidebar — fixed width, scrollable */
  .info-col {
    max-width: 320px; /* adjust to match JourneyInfoSidebar's natural width */
    border-left: 1px solid var(--jm-border, rgba(0,0,0,0.08));
  }
</style>