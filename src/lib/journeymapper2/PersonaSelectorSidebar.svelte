<script>
  import { fly, fade } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import { createEventDispatcher } from 'svelte';

  const dispatch = createEventDispatcher();

  /** Array of persona objects from journeyPersonas.json */
  export let personas = [];

  /** ID of the currently active persona */
  export let activePersonaId = '';

  /** Whether the sidebar starts open */
  export let defaultOpen = true;

  /** Width when expanded */
  export let expandedWidth = 220;

  /** Width when collapsed */
  export let collapsedWidth = 52;

  let open = defaultOpen;

  /** @type {Record<string, boolean>} */
  let imgErrors = {};

  function toggle() {
    open = !open;
  }

  /** @param {string} id */
  function selectPersona(id) {
    dispatch('select', { id });
  }

  $: cssWidth = open ? expandedWidth : collapsedWidth;
</script>

<aside
  class="persona-sidebar"
  class:persona-sidebar--open={open}
  style="width: {cssWidth}px;"
  aria-label="Persona selector"
>
  <!-- ── Header ──────────────────────────────────────────────────────── -->
  <div class="sidebar-header">
    {#if open}
      <span class="sidebar-title" transition:fade={{ duration: 140, delay: 60 }}>
        Personas
      </span>
    {/if}
    <button
      class="toggle-btn"
      class:toggle-btn--flipped={!open}
      on:click={toggle}
      aria-label={open ? 'Collapse personas' : 'Expand personas'}
      title={open ? 'Collapse' : 'Expand'}
    >
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
        <path
          d="M9 2L4 7L9 12"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    </button>
  </div>

  <!-- ── Body ────────────────────────────────────────────────────────── -->
  <div class="sidebar-body">

    {#if open}
      <!-- Expanded: full persona cards -->
      <div
        class="cards-list"
        transition:fly={{ x: -16, duration: 220, easing: cubicOut }}
      >
        {#each personas as p (p.id)}
          {@const active = p.id === activePersonaId}
          <button
            class="persona-card"
            class:persona-card--active={active}
            on:click={() => selectPersona(p.id)}
            aria-pressed={active}
            aria-label="Select {p.profile.name}"
          >
            <!-- Avatar -->
            <div class="avatar-ring" class:avatar-ring--active={active}>
              {#if !imgErrors[p.id]}
                <img
                  src="/assets/profiles/{p.profile.imageFile}"
                  alt={p.profile.name}
                  class="avatar-photo"
                  on:error={() => { imgErrors[p.id] = true; imgErrors = { ...imgErrors }; }}
                />
              {:else}
                <span class="avatar-initials">{p.profile.initials}</span>
              {/if}
            </div>

            <!-- Meta -->
            <div class="card-meta">
              <span class="card-name">{p.profile.name}</span>
              <span class="card-role">{p.type}</span>
              <span class="card-detail">{p.profile.age} · {p.profile.occupation}</span>
            </div>

            <!-- Active indicator -->
            {#if active}
              <div class="active-pip" transition:fade={{ duration: 120 }} />
            {/if}
          </button>
        {/each}
      </div>

    {:else}
      <!-- Collapsed: stacked avatar bubbles -->
      <div class="rail">
        {#each personas as p (p.id)}
          {@const active = p.id === activePersonaId}
          <button
            class="rail-avatar"
            class:rail-avatar--active={active}
            on:click={() => { selectPersona(p.id); open = true; }}
            aria-pressed={active}
            title={p.profile.name}
            aria-label="Select {p.profile.name}"
          >
            {#if !imgErrors[p.id]}
              <img
                src="/assets/profiles/{p.profile.imageFile}"
                alt={p.profile.name}
                class="rail-photo"
                on:error={() => { imgErrors[p.id] = true; imgErrors = { ...imgErrors }; }}
              />
            {:else}
              <span class="rail-initials">{p.profile.initials}</span>
            {/if}
            {#if active}
              <span class="rail-pip" />
            {/if}
          </button>
        {/each}
      </div>
    {/if}

  </div>
</aside>

<style>
  /* ── Shell ──────────────────────────────────────────────────────────── */
  .persona-sidebar {
    display: flex;
    flex-direction: column;
    min-height: 100%;
    background: #F4EFE5;
    border-right: 1px solid #DFC3A8;
    font-family: 'IBM Plex Sans', sans-serif;
    transition: width 280ms cubic-bezier(0.4, 0, 0.2, 1);
    overflow: hidden;
    flex-shrink: 0;
  }

  /* ── Header ─────────────────────────────────────────────────────────── */
  .sidebar-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 8px;
    height: 40px;
    background: #EDE5D8;
    border-bottom: 0.5px dotted #5E5E5E;
    flex-shrink: 0;
    gap: 8px;
  }

  .sidebar-title {
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

  .toggle-btn {
    width: 26px;
    height: 26px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: none;
    border: none;
    color: #A08060;
    cursor: pointer;
    flex-shrink: 0;
    border-radius: 4px;
    transition: background 0.15s, color 0.15s;
  }

  .toggle-btn:hover {
    background: #DFC3A8;
    color: #5A3E28;
  }

  .toggle-btn--flipped svg {
    transform: scaleX(-1);
  }

  /* ── Body ───────────────────────────────────────────────────────────── */
  .sidebar-body {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
  }

  .sidebar-body::-webkit-scrollbar { width: 4px; }
  .sidebar-body::-webkit-scrollbar-track { background: transparent; }
  .sidebar-body::-webkit-scrollbar-thumb { background: #DFC3A8; border-radius: 2px; }

  /* ── Expanded cards ─────────────────────────────────────────────────── */
  .cards-list {
    display: flex;
    flex-direction: column;
    padding: 8px 0;
    gap: 2px;
  }

  .persona-card {
    position: relative;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px 10px 14px;
    background: none;
    border: none;
    cursor: pointer;
    text-align: left;
    width: 100%;
    transition: background 0.14s;
  }

  .persona-card:hover {
    background: #EDE5D8;
  }

  .persona-card--active {
    background: #E8DDD0;
  }

  .persona-card--active:hover {
    background: #E3D5C5;
  }

  /* Avatar */
  .avatar-ring {
    width: 38px;
    height: 38px;
    border-radius: 50%;
    overflow: hidden;
    flex-shrink: 0;
    background: #C4956A;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 2px solid transparent;
    transition: border-color 0.18s;
  }

  .avatar-ring--active {
    border-color: #C4956A;
  }

  .avatar-photo {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .avatar-initials {
    font-family: 'Space Mono', monospace;
    font-size: 11px;
    font-weight: 700;
    color: #F4EFE5;
    letter-spacing: 0.04em;
  }

  /* Card text */
  .card-meta {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
    flex: 1;
  }

  .card-name {
    font-family: 'Space Mono', monospace;
    font-size: 10px;
    font-weight: 700;
    color: #5A3E28;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    letter-spacing: 0.02em;
  }

  .card-role {
    font-family: 'DM Sans', sans-serif;
    font-size: 8px;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #A08060;
  }

  .card-detail {
    font-family: 'DM Sans', sans-serif;
    font-size: 9px;
    color: #BFA080;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* Active pip (right edge accent) */
  .active-pip {
    position: absolute;
    left: 0;
    top: 50%;
    transform: translateY(-50%);
    width: 3px;
    height: 24px;
    background: #C4956A;
    border-radius: 0 2px 2px 0;
  }

  /* ── Collapsed rail ─────────────────────────────────────────────────── */
  .rail {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 10px 0;
    gap: 10px;
  }

  .rail-avatar {
    position: relative;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    overflow: visible;
    background: #C4956A;
    border: 2px solid transparent;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: border-color 0.18s, transform 0.14s;
    padding: 0;
    flex-shrink: 0;
  }

  .rail-avatar:hover {
    transform: scale(1.08);
    border-color: #DFC3A8;
  }

  .rail-avatar--active {
    border-color: #C4956A;
  }

  .rail-photo {
    width: 100%;
    height: 100%;
    object-fit: cover;
    border-radius: 50%;
  }

  .rail-initials {
    font-family: 'Space Mono', monospace;
    font-size: 10px;
    font-weight: 700;
    color: #F4EFE5;
    letter-spacing: 0.04em;
    pointer-events: none;
  }

  /* Small dot below avatar when active */
  .rail-pip {
    position: absolute;
    bottom: -6px;
    left: 50%;
    transform: translateX(-50%);
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: #C4956A;
  }
</style>