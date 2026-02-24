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
  <nav class="journey-nav">

    <div class="nav-left">
      <span class="nav-title">Journey Index</span>
      <span class="nav-divider" aria-hidden="true" />
      <JourneyLegend items={metrics} />
    </div>

    <!-- Persona switcher tabs -->
    <div class="nav-personas">
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
    <div class="strip-cue" aria-hidden="true">
      <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
        <path d="M1.5 5.5h8M5.5 1.5l4 4-4 4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      Profile
    </div>
  </button>

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
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M10 3L5 8L10 13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
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
    display: flex; flex-direction: column;
    background: #FAF9F5; color: #5A3E28; min-height: 100vh;
  }

  /* ── Nav ─────────────────────────────────────────────────────────────── */
  .journey-nav {
    position: sticky; top: 0; z-index: 100;
    display: flex; align-items: center;
    height: 52px; background: #EDE5D8; border-bottom: 1px solid #DFC3A8;
    padding: 0 16px 0 20px;
  }

  .nav-left { display: flex; align-items: center; gap: 14px; flex-shrink: 0; }

  .nav-title {
    font-family: 'Space Mono', monospace; font-size: 10px; font-weight: 700;
    letter-spacing: 0.1em; text-transform: uppercase; color: #7A5A3A; white-space: nowrap;
  }

  .nav-divider { width: 1px; height: 20px; background: #DFC3A8; flex-shrink: 0; }

  /* Persona tabs */
  .nav-personas {
    display: flex; align-items: center; gap: 4px;
    flex: 1; justify-content: center; padding: 0 16px;
  }

  .persona-tab {
    display: flex; align-items: center; gap: 8px;
    padding: 5px 12px 5px 6px;
    background: transparent; border: 1px solid transparent; border-radius: 3px;
    cursor: pointer; white-space: nowrap;
    transition: background 0.15s, border-color 0.15s;
  }

  .persona-tab:hover { background: #F4EFE5; border-color: #DFC3A8; }

  .persona-tab--active {
    background: #F4EFE5; border-color: #C4956A;
    box-shadow: 0 1px 3px rgba(90,62,40,0.08);
  }

  .tab-avatar-wrap {
    width: 26px; height: 26px; border-radius: 50%; overflow: hidden;
    border: 1.5px solid #DFC3A8; flex-shrink: 0;
    background: #DFC3A8; transition: border-color 0.15s;
  }

  .persona-tab--active .tab-avatar-wrap { border-color: #C4956A; }

  .tab-photo { width: 100%; height: 100%; object-fit: cover; display: block; }

  .tab-initials {
    width: 100%; height: 100%; background: #C4956A; color: #F4EFE5;
    font-family: 'Space Mono', monospace; font-size: 8px; font-weight: 700;
    display: flex; align-items: center; justify-content: center;
  }

  .tab-meta { display: flex; flex-direction: column; gap: 1px; }

  .tab-name {
    font-family: 'Space Mono', monospace; font-size: 9px; font-weight: 700;
    color: #5A3E28; line-height: 1.2;
  }

  .tab-type {
    font-family: 'DM Sans', sans-serif; font-size: 8px;
    text-transform: uppercase; letter-spacing: 0.08em; color: #A08060;
  }

  .nav-right { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }

  .plutchik-btn {
    display: flex; align-items: center; gap: 6px;
    font-family: 'Space Mono', monospace; font-size: 9px;
    letter-spacing: 0.07em; text-transform: uppercase;
    color: #A08060; background: #F4EFE5; border: 1px solid #DFC3A8; border-radius: 2px;
    padding: 5px 10px; cursor: pointer; white-space: nowrap;
    transition: background 0.15s, color 0.15s, border-color 0.15s;
  }

  .plutchik-btn:hover   { background: #DFC3A8; color: #5A3E28; border-color: #C4956A; }
  .plutchik-btn--active { background: #C4956A; color: #F4EFE5; border-color: #C4956A; }

  /* ── Persona strip ───────────────────────────────────────────────────── */
  .persona-strip {
    display: flex; align-items: center; gap: 14px;
    width: 100%; padding: 8px 20px;
    background: #F4EFE5; border: none;
    border-bottom: 1px solid #DFC3A8;
    cursor: pointer; text-align: left;
    transition: background 0.14s;
    flex-wrap: wrap;
  }

  .persona-strip:hover { background: #EDE5D8; }

  .persona-strip--open {
    background: #EDE5D8;
    box-shadow: inset 0 -2px 0 #C4956A;
  }

  .strip-photo-ring {
    width: 32px; height: 32px; border-radius: 50%; overflow: hidden;
    border: 2px solid #DFC3A8; flex-shrink: 0; background: #EDE5D8;
  }

  .strip-photo { width: 100%; height: 100%; object-fit: cover; display: block; }

  .strip-initials {
    width: 100%; height: 100%; background: #C4956A; color: #F4EFE5;
    font-family: 'Space Mono', monospace; font-size: 10px; font-weight: 700;
    display: flex; align-items: center; justify-content: center;
  }

  .strip-name-block { display: flex; flex-direction: column; gap: 1px; flex-shrink: 0; }

  .strip-name {
    font-family: 'Space Mono', monospace; font-size: 10px; font-weight: 700;
    color: #5A3E28; letter-spacing: 0.02em;
  }

  .strip-role {
    font-family: 'DM Sans', sans-serif; font-size: 8px;
    text-transform: uppercase; letter-spacing: 0.08em; color: #A08060;
  }

  .strip-divider { width: 1px; height: 24px; background: #DFC3A8; flex-shrink: 0; }

  .strip-field { display: flex; flex-direction: column; gap: 1px; flex-shrink: 0; }

  .strip-key {
    font-family: 'DM Sans', sans-serif; font-size: 8px; font-weight: 500;
    text-transform: uppercase; letter-spacing: 0.08em; color: #BFA080;
  }

  .strip-val { font-family: 'Space Mono', monospace; font-size: 9px; color: #5A3E28; }

  .strip-cue {
    margin-left: auto; display: flex; align-items: center; gap: 5px; flex-shrink: 0;
    font-family: 'Space Mono', monospace; font-size: 8px;
    letter-spacing: 0.06em; text-transform: uppercase; color: #BFA080;
    transition: color 0.14s;
  }

  .persona-strip:hover .strip-cue,
  .persona-strip--open .strip-cue { color: #C4956A; }

  /* ── Chart ────────────────────────────────────────────────────────────── */
  .journey-index { display: flex; flex-direction: column; }

  .shared-scroll { overflow-x: auto; overflow-y: visible; background: #F4EFE5; position: relative; }

  /* ── Drawer footer ────────────────────────────────────────────────────── */
  .nav-btn {
    display: flex; align-items: center; gap: 6px;
    font-family: 'Space Mono', monospace; font-size: 10px; letter-spacing: 0.05em;
    color: #8A6A4A; background: none; border: 1px solid #DFC3A8; border-radius: 2px;
    padding: 5px 10px; cursor: pointer;
    transition: background 0.15s, color 0.15s;
  }

  .nav-btn:hover:not(:disabled) { background: #F4EFE5; color: #5A3E28; }
  .nav-btn:disabled { opacity: 0.35; cursor: default; }

  .step-dots { display: flex; gap: 5px; align-items: center; }

  .step-dot {
    width: 6px; height: 6px; border-radius: 50%;
    background: #DFC3A8; border: none; padding: 0; cursor: pointer;
    transition: background 0.15s, transform 0.15s;
  }

  .step-dot.active { background: #A08060; transform: scale(1.4); }
  .step-dot:hover:not(.active) { background: #BFA080; }

  .cite {
    font-family: 'DM Sans', sans-serif; font-size: 9px;
    color: #BFA080; font-style: italic; line-height: 1.5; flex: 1;
  }

  .cite em { font-style: normal; text-decoration: underline; text-decoration-style: dotted; text-underline-offset: 2px; }

  .close-btn {
    font-family: 'Space Mono', monospace; font-size: 9px; letter-spacing: 0.05em;
    color: #8A6A4A; background: none; border: 1px solid #DFC3A8; border-radius: 2px;
    padding: 5px 10px; cursor: pointer; flex-shrink: 0;
    transition: background 0.15s, color 0.15s;
  }

  .close-btn:hover { background: #F4EFE5; color: #5A3E28; }

  .persona-footer-note {
    font-family: 'DM Sans', sans-serif; font-size: 9px; color: #BFA080;
    font-style: italic; flex: 1;
  }
</style>