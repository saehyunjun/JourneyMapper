<script>
  import { fly, fade } from 'svelte/transition';
  import { cubicOut, cubicInOut } from 'svelte/easing';
  import { createEventDispatcher } from 'svelte';

  const dispatch = createEventDispatcher();

  /** Array of persona objects from journeyPersonas.json */
  export let personas = [];

  /** Currently active persona id */
  export let activePersonaId = '';

  /**
   * When true, the sidebar collapses to a narrow rail.
   * Set this to true when the user is interacting with the timeline.
   */
  export let timelineActive = false;

  /** Expanded width in px */
  export let expandedWidth = 220;

  /** Collapsed rail width in px */
  export let collapsedWidth = 48;

  // Internal open/closed state — auto-collapses when timeline is active
  let open = true;

  // Close when timeline becomes active
  $: if (timelineActive) open = false;

  function toggle() {
    open = !open;
  }

  /** @param {string} id */
  function selectPersona(id) {
    dispatch('select', { id });
  }

  /** @param {any} persona */
  function imgSrc(persona) {
    return `/assets/profiles/${persona.profile.imageFile}`;
  }

  /** Track per-persona image errors */
  let imgErrors = {};
</script>

<aside
  class="pss"
  class:pss--open={open}
  style="width: {open ? expandedWidth : collapsedWidth}px;"
  aria-label="Persona selector"
>

  <!-- ── Header ─────────────────────────────────────────────────────── -->
  <div class="pss-header">
    {#if open}
      <span class="pss-title" transition:fade={{ duration: 120, delay: 60 }}>Personas</span>
    {/if}
    <button
      class="pss-toggle"
      class:pss-toggle--flipped={!open}
      on:click={toggle}
      aria-label={open ? 'Collapse persona sidebar' : 'Expand persona sidebar'}
      title={open ? 'Collapse' : 'Expand'}
    >
      <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
        <path d="M8.5 2L3.5 6.5L8.5 11" stroke="currentColor" stroke-width="1.5"
          stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </button>
  </div>

  <!-- ── Body ───────────────────────────────────────────────────────── -->
  <div class="pss-body">

    {#if open}
      <!-- Expanded: full cards -->
      <div
        class="pss-list"
        transition:fly={{ x: -16, duration: 220, easing: cubicOut }}
      >
        {#each personas as p (p.id)}
          {@const active = p.id === activePersonaId}
          <button
            class="persona-card"
            class:persona-card--active={active}
            on:click={() => selectPersona(p.id)}
            aria-pressed={active}
          >
            <!-- Photo / initials -->
            <div class="card-photo-wrap" class:card-photo-wrap--active={active}>
              {#if !imgErrors[p.id]}
                <img
                  src={imgSrc(p)}
                  alt={p.profile.name}
                  class="card-photo"
                  on:error={() => { imgErrors[p.id] = true; imgErrors = { ...imgErrors }; }}
                />
              {:else}
                <div class="card-initials">{p.profile.initials}</div>
              {/if}
            </div>

            <!-- Text -->
            <div class="card-meta">
              <span class="card-name">{p.profile.name}</span>
              <span class="card-type">{p.type}</span>
              <span class="card-role">{p.profile.role}</span>
            </div>

            <!-- Active indicator bar -->
            {#if active}
              <div class="card-active-bar" transition:fade={{ duration: 140 }} />
            {/if}
          </button>
        {/each}
      </div>

    {:else}
      <!-- Collapsed: icon rail -->
      <div class="pss-rail" transition:fade={{ duration: 160 }}>
        {#each personas as p (p.id)}
          {@const active = p.id === activePersonaId}
          <button
            class="rail-btn"
            class:rail-btn--active={active}
            on:click={() => { open = true; selectPersona(p.id); }}
            title={p.profile.name}
            aria-label="Select {p.profile.name}"
          >
            {#if !imgErrors[p.id]}
              <img
                src={imgSrc(p)}
                alt={p.profile.name}
                class="rail-photo"
                on:error={() => { imgErrors[p.id] = true; imgErrors = { ...imgErrors }; }}
              />
            {:else}
              <div class="rail-initials">{p.profile.initials}</div>
            {/if}
            {#if active}
              <div class="rail-active-dot" />
            {/if}
          </button>
        {/each}
      </div>
    {/if}

  </div>

</aside>

<style>
  /* ── Shell ──────────────────────────────────────────────────────────── */
  .pss {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: #DFC3A8;
    border-right: 1px solid #DFC3A8;
    font-family: 'IBM Plex Sans', sans-serif;
    transition: width 280ms cubic-bezier(0.4, 0, 0.2, 1);
    overflow: hidden;
    flex-shrink: 0;
    position: relative;
    z-index: 10;
  }

  /* ── Header ─────────────────────────────────────────────────────────── */
  .pss-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 6px;
    height: 40px;
    padding: 0 8px;
    background: #F4EFE5;
    border-bottom: 0.5px dotted #5E5E5E;
    flex-shrink: 0;
  }

  .pss-title {
    font-family: 'Space Mono', monospace;
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: #A08060;
    white-space: nowrap;
    overflow: hidden;
    flex: 1;
  }

  .pss-toggle {
    width: 26px;
    height: 26px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #A08060;
    background: none;
    border: none;
    cursor: pointer;
    flex-shrink: 0;
    border-radius: 3px;
    transition: background 0.15s, color 0.15s;
  }

  .pss-toggle:hover {
    background: #DFC3A8;
    color: #5A3E28;
  }

  /* Flip chevron when collapsed */
  .pss-toggle--flipped svg {
    transform: scaleX(-1);
  }

  /* ── Body ───────────────────────────────────────────────────────────── */
  .pss-body {
    flex: 1;
    overflow: hidden;
    position: relative;
  }

  /* ── Expanded list ──────────────────────────────────────────────────── */
  .pss-list {
    position: absolute;
    inset: 0;
    overflow-y: auto;
    overflow-x: hidden;
    padding: 8px 0;
  }

  .pss-list::-webkit-scrollbar { width: 3px; }
  .pss-list::-webkit-scrollbar-track { background: transparent; }
  .pss-list::-webkit-scrollbar-thumb { background: #DFC3A8; border-radius: 2px; }

  /* ── Persona card ───────────────────────────────────────────────────── */
  .persona-card {
    position: relative;
    width: 100%;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 9px 12px 9px 10px;
    background: none;
    border: none;
    cursor: pointer;
    text-align: left;
    transition: background 0.13s;
    border-bottom: 1px solid #EDE5D8;
  }

  .persona-card:last-child { border-bottom: none; }

  .persona-card:hover {
    background: #EDE5D8;
  }

  .persona-card--active {
    background: #EDE5D8;
  }

  /* Active left bar */
  .card-active-bar {
    position: absolute;
    left: 0;
    top: 6px;
    bottom: 6px;
    width: 3px;
    background: #C4956A;
    border-radius: 0 2px 2px 0;
  }

  /* Photo ring */
  .card-photo-wrap {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    overflow: hidden;
    flex-shrink: 0;
    border: 1.5px solid #DFC3A8;
    background: #DFC3A8;
    transition: border-color 0.15s;
  }

  .card-photo-wrap--active {
    border-color: #C4956A;
  }

  .card-photo {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .card-initials {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: 'Space Mono', monospace;
    font-size: 10px;
    font-weight: 700;
    color: #F4EFE5;
    background: #C4956A;
  }

  /* Text */
  .card-meta {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
    flex: 1;
  }

  .card-name {
    font-family: 'Space Mono', monospace;
    font-size: 9.5px;
    font-weight: 700;
    color: #5A3E28;
    letter-spacing: 0.02em;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .card-type {
    font-family: 'DM Sans', sans-serif;
    font-size: 8px;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.09em;
    color: #C4956A;
  }

  .card-role {
    font-family: 'DM Sans', sans-serif;
    font-size: 9px;
    color: #A08060;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    line-height: 1.3;
  }

  /* ── Collapsed rail ─────────────────────────────────────────────────── */
  .pss-rail {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 8px 0;
    gap: 6px;
    overflow-y: auto;
    overflow-x: hidden;
  }

  .pss-rail::-webkit-scrollbar { display: none; }

  .rail-btn {
    position: relative;
    width: 34px;
    height: 34px;
    border-radius: 50%;
    overflow: visible;
    border: 1.5px solid #DFC3A8;
    background: none;
    cursor: pointer;
    flex-shrink: 0;
    padding: 0;
    transition: border-color 0.15s, transform 0.15s;
  }

  .rail-btn:hover {
    border-color: #C4956A;
    transform: scale(1.08);
  }

  .rail-btn--active {
    border-color: #C4956A;
  }

  .rail-photo {
    width: 100%;
    height: 100%;
    object-fit: cover;
    border-radius: 50%;
    display: block;
  }

  .rail-initials {
    width: 100%;
    height: 100%;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: 'Space Mono', monospace;
    font-size: 9px;
    font-weight: 700;
    color: #F4EFE5;
    background: #C4956A;
  }

  .rail-active-dot {
    position: absolute;
    bottom: -1px;
    right: -1px;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #C4956A;
    border: 1.5px solid #F4EFE5;
  }
</style>