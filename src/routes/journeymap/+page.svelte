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

  import { STEP_WIDTH, LEFT_AXIS_WIDTH, valueToY } from '$lib/journeymapper2/journeyConfig.js';
  import { selectedIndex } from '$lib/journeymapper2/journeyStore.js';
  import personaFile from '$lib/journeymapper2/journeyPersonas.json';

  const { metrics, personas } = personaFile;

  /** @type {Record<string, any>} */
  const experienceWheels = personaFile.experienceWheels ?? {};

  // ── Active persona ────────────────────────────────────────────────────
  let activePersonaId = personas?.[0]?.id ?? '';

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

  // Auto-open step drawer when a step is selected
  $: if ($selectedIndex >= 0 && drawerMode !== 'step') drawerMode = 'step';

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

  // ── Tab photo error tracking ──────────────────────────────────────────
  /** @type {Record<string, boolean>} */
  let tabImgError = {};
  let stripImgError = false;

  /** @type {HTMLDivElement | null} */
  let scrollEl = null;
</script>

<div class="journey-wrapper">

  <!-- ── Nav bar ──────────────────────────────────────────────────────── -->
  <span class="title-bar h3 heading">Journey Index</span>
  <nav class="nav-bar">
    <!-- Persona switcher tabs -->
    <div class="nav-left">
      {#each personas as p}
        <button
          class="persona-tab"
          class:persona-tab--active={p.id === activePersonaId}
          on:click={() => switchPersona(p.id)}
          aria-pressed={p.id === activePersonaId}
        >
          <span class="tab-avatar-wrap">
            {#if !tabImgError[p.id]}
              <img
                src="/assets/profiles/{p.profile.imageFile}"
                alt={p.profile.name}
                class="tab-photo"
                on:error={() => { tabImgError[p.id] = true; tabImgError = { ...tabImgError }; }}
              />
            {:else}
              <span class="tab-initials">{p.profile.initials}</span>
            {/if}
          </span>
          <span class="tab-meta">
            <span class="tab-name">{p.profile.name}</span>
            <span class="tab-type">{p.type}</span>
          </span>
        </button>
      {/each}
    </div>

    <div class="nav-right">
      <button
        class="plutchik-btn"
        class:plutchik-btn--active={drawerMode === 'plutchik'}
        on:click={() => { drawerMode = drawerMode === 'plutchik' ? null : 'plutchik'; selectedIndex.set(-1); }}
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
          <circle cx="6"    cy="6"    r="1.5"  fill="currentColor" opacity="0.9"/>
          <circle cx="6"    cy="2"    r="1.25" fill="currentColor" opacity="0.55"/>
          <circle cx="6"    cy="10"   r="1.25" fill="currentColor" opacity="0.55"/>
          <circle cx="2"    cy="6"    r="1.25" fill="currentColor" opacity="0.55"/>
          <circle cx="10"   cy="6"    r="1.25" fill="currentColor" opacity="0.55"/>
          <circle cx="2.93" cy="2.93" r="1.1"  fill="currentColor" opacity="0.35"/>
          <circle cx="9.07" cy="2.93" r="1.1"  fill="currentColor" opacity="0.35"/>
          <circle cx="2.93" cy="9.07" r="1.1"  fill="currentColor" opacity="0.35"/>
          <circle cx="9.07" cy="9.07" r="1.1"  fill="currentColor" opacity="0.35"/>
        </svg>
        About Plutchik
      </button>
    </div>

  </nav>

  <!-- ── Persona strip — CLICKABLE ──────────────────────────────────────── -->
  <button
    class="persona-strip"
    class:persona-strip--open={drawerMode === 'persona'}
    on:click={openPersonaDrawer}
    aria-label="Open {personaProfile.name} persona profile"
  >
    <!-- Photo / fallback -->
    <div class="strip-photo-ring">
      {#if !stripImgError}
        <img
          src="/assets/profiles/{personaProfile.imageFile}"
          alt={personaProfile.name}
          class="strip-photo"
          on:error={() => stripImgError = true}
        />
      {:else}
        <div class="strip-initials">{personaProfile.initials}</div>
      {/if}
    </div>

    <!-- Name / role -->
    <div class="strip-name-block">
      <span class="strip-name">{personaProfile.name}</span>
      <span class="strip-role">{personaProfile.role}</span>
    </div>

    <div class="strip-divider" aria-hidden="true" />

    <!-- Quick-look fields -->
    {#each [
      ['Age',        personaProfile.age],
      ['Occupation', personaProfile.occupation],
      ['Preference', personaProfile.preference],
      ['Diagnosed',  personaProfile.diagnosed],
    ] as [key, val]}
      <div class="strip-field">
        <span class="strip-key">{key}</span>
        <span class="strip-val">{val}</span>
      </div>
    {/each}

    <!-- View-profile cue -->
    <div class="" aria-hidden="true">
      <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
        <path d="M1.5 5.5h8M5.5 1.5l4 4-4 4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      Profile
    </div>
  </button>
  <JourneyLegend items={metrics} />
  <!-- ── Chart area ────────────────────────────────────────────────────── -->
  <div class="journey-index">
    <div class="shared-scroll" bind:this={scrollEl}>
      <JourneyStages data ={journeyData} />
      <JourneySentiment data={journeyData} />

      <JourneyGrid data={journeyData}>
        {#each metrics as m}
          <JourneyLine  data={journeyData} metricKey={m.key} color={m.color} label={m.label} />
        {/each}
        {#each metrics as m, mi}
          <JourneyNodes data={journeyData} metricKey={m.key} color={m.color} offsets={nodeOffsets[mi]} />
        {/each}
      </JourneyGrid>
      <JourneySteps data={journeyData} />
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


  .journey-wrapper {
  display: flex;
  flex-direction: column;
  height: 100%;
}


.nav-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.nav-divider {
  width: 1px;
  height: 20px;
  background: #d1d5db;
}

.persona-tabs {
  display: flex;
  gap: 8px;
  padding: 12px 24px;
  border-bottom: 1px solid #e5e7eb;
}

.persona-tab {
  padding: 6px 10px;
  border-radius: 6px;
  border: 1px solid #e5e7eb;
  cursor: pointer;
}

.persona-tab.active {
  background: #111;
  color: white;
}

.journey-container {
  flex: 1;
  overflow-x: auto;
  padding: 24px;
}
</style>