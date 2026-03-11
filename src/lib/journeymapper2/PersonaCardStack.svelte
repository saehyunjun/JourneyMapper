<script>
    import { createEventDispatcher } from 'svelte';
    import { fly, fade } from 'svelte/transition';
    import { cubicOut, cubicInOut } from 'svelte/easing';
    import PersonaProfileCard from './PersonaProfileCard.svelte';
  
    const dispatch = createEventDispatcher();
  
    /** Array of persona objects from journeyPersonas.json */
    export let personas = [];
  
    /** ID of the currently active persona */
    export let activePersonaId = '';
  
    /** Called when the user wants to open the full persona drawer */
    export let onOpenDetails = () => {};
  
    /** Whether the sidebar starts expanded */
    export let defaultOpen = true;
  
    let open = defaultOpen;
    let hoveredId = null;
    let thumbImgError = false;
  
    $: activeIndex  = personas.findIndex(p => p.id === activePersonaId);
    $: beforeActive = personas.slice(0, activeIndex);
    $: activePersona = personas[activeIndex] ?? null;
    $: afterActive  = personas.slice(activeIndex + 1);
  
    // Reset thumb error state whenever active persona changes
    $: if (activePersonaId) thumbImgError = false;
  
    function toggle() { open = !open; }
  
    function select(id) {
      if (id !== activePersonaId) dispatch('select', { id });
    }
  </script>
  
  <!-- ── Outer wrapper — drives the width transition ──────────────────── -->
  <div class="sidebar" class:sidebar--open={open} aria-label="Persona selector">
  
    <!-- ── Toggle button — always visible ──────────────────────────────── -->
    <button
      class="toggle-btn"
      class:toggle-btn--open={open}
      on:click={toggle}
      aria-label={open ? 'Collapse persona panel' : 'Expand persona panel'}
      title={open ? 'Collapse' : 'Expand'}
    >
      <!-- Chevron left/right -->
      <svg width="10" height="10" viewBox="0 0 256 256" aria-hidden="true">
        {#if open}
          <path d="M165.66,202.34a8,8,0,0,1-11.32,11.32l-80-80a8,8,0,0,1,0-11.32l80-80a8,8,0,0,1,11.32,11.32L91.31,128Z" fill="currentColor"/>
        {:else}
          <path d="M181.66,133.66l-80,80a8,8,0,0,1-11.32-11.32L164.69,128,90.34,53.66a8,8,0,0,1,11.32-11.32l80,80A8,8,0,0,1,181.66,133.66Z" fill="currentColor"/>
        {/if}
      </svg>
    </button>
  
    <!-- ── COLLAPSED state: square active-persona thumbnail ────────────── -->
    {#if !open}
      <button
        class="thumb"
        on:click={toggle}
        title="Expand — {activePersona?.profile?.name ?? ''}"
        aria-label="Expand persona panel"
        transition:fade={{ duration: 160 }}
      >
        {#if activePersona}
          {#if !thumbImgError}
            <img
              class="thumb-photo"
              src="/assets/profiles/{activePersona.profile.imageFile}"
              alt={activePersona.profile.name}
              on:error={() => (thumbImgError = true)}
            />
          {:else}
            <span class="thumb-initials">{activePersona.profile.initials}</span>
          {/if}
          <!-- Gradient + name overlay -->
          <div class="thumb-overlay">
            <span class="thumb-name">{activePersona.profile.initials}</span>
          </div>
        {/if}
      </button>
    {/if}
  
    <!-- ── EXPANDED state: full card stack ──────────────────────────────── -->
    {#if open}
      <div
        class="stack"
        transition:fly={{ x: -16, duration: 220, easing: cubicOut }}
      >
        <!-- Heading -->
        <div class="stack-heading">
          <span class="stack-label">Personas</span>
          <span class="stack-count">{personas.length}</span>
        </div>
  
        <!-- Cards before active -->
        {#each beforeActive as persona (persona.id)}
          <!-- svelte-ignore a11y-click-events-have-key-events -->
          <div
            class="mini-card"
            class:mini-card--hovered={hoveredId === persona.id}
            on:click={() => select(persona.id)}
            on:mouseenter={() => (hoveredId = persona.id)}
            on:mouseleave={() => (hoveredId = null)}
            role="button"
            tabindex="0"
            aria-label="Select {persona.profile.name}"
            on:keydown={(e) => e.key === 'Enter' && select(persona.id)}
          >
            <div class="mini-photo-wrap">
              <img class="mini-photo" src="/assets/profiles/{persona.profile.imageFile}" alt={persona.profile.name}
                on:error={(e) => { e.currentTarget.style.display = 'none'; }} />
              <div class="mini-photo-overlay" />
            </div>
            <div class="mini-info">
              <span class="mini-name">{persona.profile.name}</span>
              <span class="mini-role">{persona.profile.role}</span>
            </div>
            <div class="mini-arrow" aria-hidden="true">
              <svg width="11" height="11" viewBox="0 0 256 256"><path d="M221.66,133.66l-72,72a8,8,0,0,1-11.32-11.32L196.69,136H40a8,8,0,0,1,0-16H196.69L138.34,61.66a8,8,0,0,1,11.32-11.32l72,72A8,8,0,0,1,221.66,133.66Z" fill="currentColor"/></svg>
            </div>
          </div>
        {/each}
  
        {#if beforeActive.length > 0}
          <div class="gap-rule" />
        {/if}
  
        <!-- Active card -->
        {#if activePersona}
          {#key activePersona.id}
            <div class="active-card-wrap" in:fly={{ y: 10, duration: 260, easing: cubicOut }}>
              <PersonaProfileCard
                personaProfile={activePersona.profile}
                onOpenDetails={onOpenDetails}
              />
            </div>
          {/key}
        {/if}
  
        {#if afterActive.length > 0}
          <div class="gap-rule" />
        {/if}
  
        <!-- Cards after active -->
        {#each afterActive as persona (persona.id)}
          <!-- svelte-ignore a11y-click-events-have-key-events -->
          <div
            class="mini-card"
            class:mini-card--hovered={hoveredId === persona.id}
            on:click={() => select(persona.id)}
            on:mouseenter={() => (hoveredId = persona.id)}
            on:mouseleave={() => (hoveredId = null)}
            role="button"
            tabindex="0"
            aria-label="Select {persona.profile.name}"
            on:keydown={(e) => e.key === 'Enter' && select(persona.id)}
          >
            <div class="mini-photo-wrap">
              <img class="mini-photo" src="/assets/profiles/{persona.profile.imageFile}" alt={persona.profile.name}
                on:error={(e) => { e.currentTarget.style.display = 'none'; }} />
              <div class="mini-photo-overlay" />
            </div>
            <div class="mini-info">
              <span class="mini-name">{persona.profile.name}</span>
              <span class="mini-role">{persona.profile.role}</span>
            </div>
            <div class="mini-arrow" aria-hidden="true">
              <svg width="11" height="11" viewBox="0 0 256 256"><path d="M221.66,133.66l-72,72a8,8,0,0,1-11.32-11.32L196.69,136H40a8,8,0,0,1,0-16H196.69L138.34,61.66a8,8,0,0,1,11.32-11.32l72,72A8,8,0,0,1,221.66,133.66Z" fill="currentColor"/></svg>
            </div>
          </div>
        {/each}
  
      </div>
    {/if}
  
  </div>
  
  <style>
    /* ── Sidebar shell ────────────────────────────────────────────────── */
    .sidebar {
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: center;
      flex-shrink: 0;
      /* Collapsed width fits just the thumb + toggle */
      width: 56px;
      padding: 0 0 0 1em;
      gap: 10px;
      transition: width 280ms cubic-bezier(0.4, 0, 0.2, 1);
    }
  
    .sidebar--open {
      width: 264px;      /* 240px card + 24px breathing room */
      align-items: flex-start;
    }
  
    /* ── Toggle button ────────────────────────────────────────────────── */
    .toggle-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 24px;
      height: 24px;
      border-radius: 50%;
      border: 1px solid rgba(196, 149, 106, 0.35);
      background: rgba(196, 149, 106, 0.10);
      color: #A08060;
      cursor: pointer;
      flex-shrink: 0;
      transition: background 0.15s, border-color 0.15s, color 0.15s;
      /* In collapsed state, centre it above the thumb */
      align-self: center;
    }
  
    .toggle-btn:hover {
      background: rgba(196, 149, 106, 0.22);
      border-color: #C4956A;
      color: #7A5C38;
    }
  
    /* In expanded state push the button to the right edge of the header row */
    .sidebar--open .toggle-btn {
      align-self: flex-end;
      margin-right: 2px;
    }
  
    /* ── Collapsed thumbnail ──────────────────────────────────────────── */
    .thumb {
      position: relative;
      width: 48px;
      height: 48px;
      border-radius: 12px;
      overflow: hidden;
      border: none;
      padding: 0;
      cursor: pointer;
      background: #1a1a1a;
      flex-shrink: 0;
      boxShadow: 0px 1px 1px rgba(0, 0, 0, 0.03), 0px 3px 6px;
      transition: transform 0.2s cubic-bezier(0.34, 1.4, 0.64, 1), box-shadow 0.2s ease;
    }
  
    .thumb:hover {
      transform: scale(1.07);
      box-shadow: 0 8px 22px rgba(0,0,0,0.26);
    }
  
    .thumb-photo {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }
  
    .thumb-initials {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: var(--font-heading, 'IBM Plex Sans', sans-serif);
      font-size: 1rem;
      font-weight: 700;
      color: #fff;
      background: #C4956A;
    }
  
    .thumb-overlay {
      position: absolute;
      inset: 0;
      background: linear-gradient(to top, rgba(0,0,0,0.55) 0%, transparent 55%);
      display: flex;
      align-items: flex-end;
      justify-content: center;
      padding-bottom: 5px;
      pointer-events: none;
    }
  
    .thumb-name {
      font-family: var(--font-mono, 'IBM Plex Mono', monospace);
      font-size: 0.5rem;
      font-weight: 700;
      letter-spacing: 0.06em;
      color: rgba(255,255,255,0.85);
      text-transform: uppercase;
    }
  
    /* ── Expanded stack ───────────────────────────────────────────────── */
    .stack {
      display: flex;
      flex-direction: column;
      align-items: stretch;
      width: 240px;
      gap: 6px;
      /* prevent content flashing during collapse transition */
      overflow: hidden;
    }
  
    /* ── Heading row ──────────────────────────────────────────────────── */
    .stack-heading {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 2px 4px;
    }
  
    .stack-label {
      font-family: var(--font-mono, 'IBM Plex Mono', monospace);
      font-size: 0.6rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: var(--text-muted, #A08060);
      user-select: none;
    }
  
    .stack-count {
      font-family: var(--font-mono, 'IBM Plex Mono', monospace);
      font-size: 0.6rem;
      font-weight: 600;
      color: var(--text-muted, #A08060);
      background: rgba(196, 149, 106, 0.15);
      padding: 1px 6px;
      border-radius: 100px;
      user-select: none;
    }
  
    /* ── Active card wrapper ──────────────────────────────────────────── */
    .active-card-wrap {
      flex-shrink: 0;
    }
  
    /* ── Gap rule ─────────────────────────────────────────────────────── */
    .gap-rule {
      height: 14px;
      flex-shrink: 0;
      position: relative;
    }
  
    .gap-rule::after {
      content: '';
      position: absolute;
      top: 50%;
      left: 8px;
      right: 8px;
      height: 1px;
      background: linear-gradient(
        to right,
        transparent,
        rgba(196, 149, 106, 0.35) 20%,
        rgba(196, 149, 106, 0.35) 80%,
        transparent
      );
    }
  
    /* ── Mini card ────────────────────────────────────────────────────── */
    .mini-card {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 7px 10px 7px 7px;
      border-radius: 12px;
      background: rgba(196, 149, 106, 0.08);
      border: 1px solid rgba(196, 149, 106, 0.18);
      cursor: pointer;
      transition:
        background 0.18s ease,
        border-color 0.18s ease,
        transform 0.18s cubic-bezier(0.34, 1.4, 0.64, 1);
      outline: none;
      user-select: none;
    }
  
    .mini-card:hover,
    .mini-card--hovered {
      background: rgba(196, 149, 106, 0.16);
      border-color: rgba(196, 149, 106, 0.4);
      transform: translateX(3px);
    }
  
    .mini-card:focus-visible {
      outline: 2px solid #C4956A;
      outline-offset: 2px;
    }
  
    .mini-photo-wrap {
      position: relative;
      width: 40px;
      height: 40px;
      border-radius: 8px;
      overflow: hidden;
      flex-shrink: 0;
      background: #2a2a2a;
    }
  
    .mini-photo {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }
  
    .mini-photo-overlay {
      position: absolute;
      inset: 0;
      background: linear-gradient(135deg, transparent 40%, rgba(0,0,0,0.25));
      pointer-events: none;
    }
  
    .mini-info {
      display: flex;
      flex-direction: column;
      gap: 2px;
      flex: 1;
      min-width: 0;
    }
  
    .mini-name {
      font-family: var(--font-heading, 'IBM Plex Sans', sans-serif);
      font-size: 0.8rem;
      font-weight: 600;
      color: var(--text, #1a1a1a);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  
    .mini-role {
      font-family: var(--font-mono, 'IBM Plex Mono', monospace);
      font-size: 0.55rem;
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 0.07em;
      color: var(--text-muted, #A08060);
    }
  
    .mini-arrow {
      color: rgba(160, 128, 96, 0.5);
      flex-shrink: 0;
      transition: color 0.18s ease, transform 0.18s ease;
    }
  
    .mini-card:hover .mini-arrow,
    .mini-card--hovered .mini-arrow {
      color: #C4956A;
      transform: translateX(2px);
    }
  </style>