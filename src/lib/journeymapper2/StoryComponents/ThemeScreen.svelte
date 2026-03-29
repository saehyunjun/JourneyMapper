<script lang="ts">
  import JourneyLayoutToggle       from '$lib/journeymapper2/JourneyLayoutToggle.svelte';
  import JourneyIndexBars          from '$lib/journeymapper2/JourneyIndexBars.svelte';
  import JourneyLegend             from '$lib/journeymapper2/JourneyLegend.svelte';
  import JourneySteps              from '$lib/journeymapper2/JourneySteps.svelte';
  import JourneyStages             from '$lib/journeymapper2/JourneyStages.svelte';
  import JourneySentiment          from '$lib/journeymapper2/JourneySentiment.svelte';
  import JourneyFlowDiagram        from '$lib/journeymapper2/JourneyFlowDiagram.svelte';
  import InflectionDetailContent   from '$lib/journeymapper2/InflectionDetailContent.svelte';
  import DiseaseSelectDropdowns    from '$lib/journeymapper2/DiseaseSelectDropdowns.svelte';
  import PersonaStory              from '$lib/journeymapper2/PersonaStory.svelte';
  import JourneyTooltip            from '$lib/journeymapper2/JourneyTooltip.svelte';
  import JourneyInfoSidebar        from '$lib/journeymapper2/JourneyInfoSidebar.svelte';
  import JourneyDrawer             from '$lib/journeymapper2/JourneyDrawer.svelte';
  import JourneySubDrawer          from '$lib/journeymapper2/JourneySubDrawer.svelte';
  import PlutchikContent           from '$lib/journeymapper2/PlutchikContent.svelte';
  import StepDetailContent         from '$lib/journeymapper2/StepDetailContent.svelte';
  import PersonaDetailContent      from '$lib/journeymapper2/PersonaDetailContent.svelte';
  import PersonaTopSelector        from '$lib/journeymapper2/PersonaTopSelector.svelte';

  import { STEP_WIDTH, LEFT_AXIS_WIDTH, valueToY } from '$lib/journeymapper2/journeyConfig.js';
  import { selectedIndex, selectedInflectionIndex, selectedInflectionPath } from '$lib/journeymapper2/journeyStore.js';

  import CaretRight               from 'phosphor-icons-svelte/IconCaretRightRegular.svelte';
  import CaretLeft                from 'phosphor-icons-svelte/IconCaretLeftRegular.svelte';
  import IconChartLineRegular     from 'phosphor-icons-svelte/IconChartLineRegular.svelte';
  import IconFlowArrowRegular     from 'phosphor-icons-svelte/IconFlowArrowRegular.svelte';

  import personaFile from '$lib/journeymapper2/journeyPersonas.json';

  // ── Static data ───────────────────────────────────────────────────────
  const { metrics, personas } = personaFile;
  const experienceWheels: Record<string, any> = personaFile.experienceWheels ?? {};

  // ── Filter state ──────────────────────────────────────────────────────
  let selectedTherapeuticArea = $state<string | undefined>(undefined);
  let selectedIndication      = $state<string | undefined>(undefined);

  let filteredPersonas = $derived(
    personas.filter((p) => {
      if (selectedTherapeuticArea && p.therapeutic_area !== selectedTherapeuticArea) return false;
      if (selectedIndication      && p.indication       !== selectedIndication)       return false;
      return true;
    })
  );

  // ── Active persona ────────────────────────────────────────────────────
  let activePersonaId = $state(personas[0].id);

  // Reset to first filtered persona if the active one is filtered out
  $effect(() => {
    if (filteredPersonas.length && !filteredPersonas.find((p) => p.id === activePersonaId)) {
      activePersonaId = filteredPersonas[0].id;
    }
  });

  let activePersona  = $derived(personas.find((p) => p.id === activePersonaId) ?? personas[0]);
  let journeyData    = $derived(activePersona?.journey ?? []);
  let personaProfile = $derived(activePersona?.profile ?? {});

  // ── Selected step ─────────────────────────────────────────────────────
  let selectedStep      = $derived($selectedIndex >= 0 ? (journeyData[$selectedIndex] ?? null) : null);
  let selectedWheelData = $derived(selectedStep?.step_id ? (experienceWheels[selectedStep.step_id] ?? null) : null);

  let stepIllustration = $derived(
    selectedStep ? 'lib/static/illustrations/Regression1.jpeg' : 'lib/static/illustrations/Regression1.jpeg'
  );

  // ── Layout / view toggles ─────────────────────────────────────────────
  let layout    = $state<'horizontal' | 'vertical'>('horizontal');
  let chartView = $state<'chart' | 'flow'>('chart');

  // ── Drawer state ──────────────────────────────────────────────────────
  let drawerMode = $state<'step' | 'plutchik' | 'persona' | 'inflection' | null>(null);
  let drawerOpen = $derived(drawerMode !== null);

  // Auto-open step drawer when a step is selected
  $effect(() => {
    if ($selectedIndex >= 0 && drawerMode !== 'step') drawerMode = 'step';
  });

  // Auto-open inflection drawer when a fork path card is clicked
  $effect(() => {
    if ($selectedInflectionIndex >= 0 && drawerMode !== 'inflection') drawerMode = 'inflection';
  });

  let timelineActive = $derived($selectedIndex >= 0 || drawerOpen);

  let drawerEyebrow = $derived(
    drawerMode === 'plutchik' ? 'Methodology' :
    drawerMode === 'persona'  ? ((activePersona?.type ?? '').charAt(0).toUpperCase() + (activePersona?.type ?? '').slice(1)) :
    journeyData?.[$selectedIndex]?.stage ?? ''
  );

  let drawerTitle = $derived(
    drawerMode === 'plutchik' ? "Plutchik's Wheel of Emotions" :
    drawerMode === 'step' && journeyData?.[$selectedIndex]
      ? `${$selectedIndex + 1} / ${journeyData.length}` : ''
  );

  // ── Sub-drawer: emotion detail ────────────────────────────────────────
  let emotionSubDrawerOpen = $state(false);

  // Close sub-drawer when main drawer closes
  $effect(() => { if (!drawerOpen) emotionSubDrawerOpen = false; });

  // ── Story overlay (PersonaStory in a SubDrawer) ───────────────────────
  let storyOpen = $state(false);

  // ── Jitter offsets for coincident nodes ──────────────────────────────
  const JITTER = 7;

  function computeOffsets(data: any[], mets: { key: string }[]) {
    const ns = data.length, nm = mets.length;
    const offs = mets.map(() => new Array(ns).fill(0));
    for (let si = 0; si < ns; si++) {
      const g = new Map<number, number[]>();
      for (let mi = 0; mi < nm; mi++) {
        const key = Math.round(valueToY(data[si]?.[mets[mi].key]));
        if (!g.has(key)) g.set(key, []);
        g.get(key)!.push(mi);
      }
      for (const grp of g.values()) {
        if (grp.length < 2) continue;
        const half = (grp.length - 1) / 2;
        grp.forEach((mi, slot) => { offs[mi][si] = (slot - half) * JITTER; });
      }
    }
    return offs;
  }

  let nodeOffsets = $derived(computeOffsets(journeyData, metrics));

  // ── Scroll container ref ──────────────────────────────────────────────
  let scrollEl = $state<HTMLDivElement | null>(null);

  // ── Event handlers ────────────────────────────────────────────────────
  function handlePersonaSelect(id: string) {
    activePersonaId = id;
    selectedIndex.set(-1);
  }

  function handlePersonaStory() {
    storyOpen = true;
  }

  function handleDrawerClose() {
    drawerMode = null;
    selectedIndex.set(-1);
    selectedInflectionIndex.set(-1);
    selectedInflectionPath.set(null);
  }

  function handleFilterChange(therapeuticArea: string | undefined, indication: string | undefined) {
    selectedTherapeuticArea = therapeuticArea;
    selectedIndication = indication;
  }

  function openEmotionDetail() {
    emotionSubDrawerOpen = true;
  }
</script>

<!-- ── Page shell ──────────────────────────────────────────────────────── -->
<div class="journey-wrapper flex flex-col h-screen overflow-hidden">

  <!-- ── Toolbar ──────────────────────────────────────────────────────── -->
  <div class="toolbar" role="tablist">
    <DiseaseSelectDropdowns
      {personas}
      onchange={handleFilterChange}
    />

    <div class="flex flex-row gap-2 justify-start">
      <button
        class="btn-nav"
        class:view-tab--active={chartView === 'chart'}
        role="tab"
        aria-selected={chartView === 'chart'}
        onclick={() => chartView = 'chart'}
      >
        <IconChartLineRegular
          class="icon-toolbar"
          style="background: var(--orange); color: var(--lightorange);"
        />
        <span class="label-sm">Journey Sentiment</span>
      </button>

      <button
        class="btn-nav"
        class:view-tab--active={chartView === 'flow'}
        role="tab"
        aria-selected={chartView === 'flow'}
        onclick={() => chartView = 'flow'}
      >
        <IconFlowArrowRegular
          class="icon-toolbar"
          style="background: var(--orange); color: var(--lightorange);"
        />
        <span class="label-sm">Journey Flow</span>
      </button>
    </div>
  </div>

  <!-- ── Three-column body ────────────────────────────────────────────── -->
  <div class="journey-body flex flex-row flex-1 min-h-0">

    <!-- LEFT — persona selector column -->
    <div class="persona-col shrink-0 overflow-y-auto">
      <PersonaTopSelector
        personas={filteredPersonas}
        {activePersonaId}
        onselect={(id) => handlePersonaSelect(id)}
        onstory={() => handlePersonaStory()}
      />
    </div>

    <!-- MIDDLE — chart / flow, scrolls horizontally -->
    <div class="chart-col flex-1 min-w-0" bind:this={scrollEl}>
      {#if chartView === 'flow'}
        <div class="flex flex-col w-full justify-right">
          <JourneyLayoutToggle bind:layout />
          <JourneyFlowDiagram data={journeyData} {layout} />
        </div>
      {:else}
        <div class="px-4 py-2 w-full relative">
          <h3 class="heading-sm">Sentiment</h3>
        </div>

        <JourneyStages data={journeyData} />
        <JourneySteps  data={journeyData} />
        <JourneySentiment data={journeyData} />
        <div class="spacer"></div>

        <div class="px-4 py-2 w-full">
          <h3 class="heading-sm">Sentiment Drivers</h3>
        </div>

        <JourneyIndexBars data={journeyData} {metrics} />
      {/if}

      <JourneyLegend items={metrics} />
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


<!-- ── Main drawer ───────────────────────────────────────────────────────── -->
<JourneyDrawer
  bind:open={drawerOpen}
  eyebrow={drawerEyebrow}
  title={drawerTitle}
  onclose={handleDrawerClose}
>
  {#if drawerMode === 'step'}
    <StepDetailContent
      data={journeyData}
      {metrics}
      illustrationSrc={stepIllustration}
      wheelData={selectedWheelData}
      onopenEmotionDetail={openEmotionDetail}
    />
  {:else if drawerMode === 'plutchik'}
    <PlutchikContent />
  {:else if drawerMode === 'persona'}
    <PersonaDetailContent persona={activePersona} />
  {:else if drawerMode === 'inflection'}
    <InflectionDetailContent data={journeyData} />
  {/if}

  {#snippet footer()}
    {#if drawerMode === 'step'}
      <div class="flex flex-row">
        <button
          class="btn-sm"
          disabled={$selectedIndex <= 0}
          onclick={() => selectedIndex.update(i => i - 1)}
          aria-label="Previous step"
        >
          <CaretLeft />
        </button>
        <button
          class="btn-sm-alt"
          disabled={$selectedIndex >= journeyData.length - 1}
          onclick={() => selectedIndex.update(i => i + 1)}
          aria-label="Next step"
        >
          <CaretRight />
        </button>
      </div>

    {:else if drawerMode === 'plutchik'}
      <span class="cite">
        Plutchik, R. (1980). <em>Emotion: A Psychoevolutionary Synthesis.</em> Harper & Row.
      </span>
      <button class="btn-sm" onclick={handleDrawerClose}>Close</button>

    {:else if drawerMode === 'persona'}
      <span class="persona-footer-note">
        {activePersona.journey.length} steps ·
        {[...new Set(activePersona.journey.map((d: any) => d.stage_id))].length} stages
      </span>
      <button class="btn-sm" onclick={handleDrawerClose}>Close</button>
    {/if}
  {/snippet}
</JourneyDrawer>


<!-- ── Emotion detail sub-drawer ─────────────────────────────────────────── -->
<JourneySubDrawer
  bind:open={emotionSubDrawerOpen}
  eyebrow="Methodology"
  title="Plutchik's Wheel of Emotions"
  onclose={() => (emotionSubDrawerOpen = false)}
>
  <PlutchikContent />

  {#snippet footer()}
    <span class="cite">
      Plutchik, R. (1980). <em>Emotion: A Psychoevolutionary Synthesis.</em> Harper &amp; Row.
    </span>
  {/snippet}
</JourneySubDrawer>


<!-- ── Persona story overlay ─────────────────────────────────────────────── -->
<PersonaStory
  bind:open={storyOpen}
  persona={activePersona}
  steps={journeyData}
  onclose={() => (storyOpen = false)}
/>


<!-- ── Global tooltip (outside scroll containers) ────────────────────────── -->
<JourneyTooltip data={journeyData} {metrics} />


<style>
  /* Middle scrolling chart area */
  .chart-col {
    position: relative;
    z-index: 1;
    padding-bottom: 1em;
    overflow-x: scroll;
    overflow-y: hidden;
    scrollbar-width: auto;
    scrollbar-gutter: stable;
    scrollbar-color: var(--color-orange-700) transparent;
  }

  /* Right info sidebar — fixed width, scrollable */
  .info-col {
    max-width: 320px;
    border-left: 1px solid var(--jm-border, rgba(0, 0, 0, 0.08));
  }
</style>