<script>
    import { fly, fade } from 'svelte/transition';
    import { cubicOut } from 'svelte/easing';
  
    /** Whether the sidebar starts open */
    export let defaultOpen = true;
  
    /** Sidebar title shown in the header */
    export let title = 'Journey Filters';
  
    /** Width of the expanded sidebar in px */
    export let expandedWidth = 260;
  
    /** Width of the collapsed rail in px */
    export let collapsedWidth = 44;
  
    /** Which side the sidebar sits on */
    export let side = 'left'; // 'left' | 'right'
  
    /**
     * Sections array. Each item:
     *   { id, label, icon?, component?, props? }
     *
     * Pass a Svelte component via the `component` field and its props via `props`.
     * If you just want plain text, use the `content` string field.
     *
     * Example:
     *   import MyFilters from './MyFilters.svelte';
     *   sections = [{ id: 'filters', label: 'Filters', icon: '⊞', component: MyFilters, props: { data } }]
     */
    export let sections = [];
  
    let open = defaultOpen;
    let expandedSections = {};
  
    function toggle() {
      open = !open;
      if (!open) expandedSections = {};
    }
  
    function toggleSection(id) {
      expandedSections[id] = !expandedSections[id];
      expandedSections = { ...expandedSections };
    }
  
    /** Programmatically open to a specific section (called from rail) */
    function openToSection(id) {
      open = true;
      expandedSections[id] = true;
      expandedSections = { ...expandedSections };
    }
  
    $: cssWidth = open ? expandedWidth : collapsedWidth;
  </script>
  
  <!-- ── Shell ─────────────────────────────────────────────────────────────── -->
  <aside
    class="sidebar"
    class:sidebar--right={side === 'right'}
    class:sidebar--open={open}
    style="width: {cssWidth}px;"
    aria-label={title}
  >
  
    <!-- ── Top header ──────────────────────────────────────────────────────── -->
    <div class="sidebar-header">
      {#if open}
        <span class="sidebar-title" transition:fade={{ duration: 140, delay: 80 }}>
          {title}
        </span>
      {/if}
  
      <button
        class="toggle-btn"
        class:toggle-btn--flipped={side === 'right' ? open : !open}
        on:click={toggle}
        aria-label={open ? 'Collapse sidebar' : 'Expand sidebar'}
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
  
    <!-- ── Scrollable body ─────────────────────────────────────────────────── -->
    <div class="sidebar-body">
  
      {#if open}
        <div
          class="sidebar-content"
          transition:fly={{ x: side === 'right' ? 20 : -20, duration: 220, easing: cubicOut }}
        >
  
          <!-- Slot for arbitrary top content -->
          <slot name="top" />
  
          <!-- ── Accordion sections ──────────────────────────────────────── -->
          {#each sections as section}
            <div class="section" class:section--expanded={expandedSections[section.id]}>
  
              <button
                class="section-header"
                on:click={() => toggleSection(section.id)}
                aria-expanded={!!expandedSections[section.id]}
              >
                {#if section.icon}
                  <span class="section-icon" aria-hidden="true">{section.icon}</span>
                {/if}
                <span class="section-label">{section.label}</span>
                <svg
                  class="chevron"
                  class:chevron--open={expandedSections[section.id]}
                  width="10" height="10" viewBox="0 0 10 10" fill="none"
                  aria-hidden="true"
                >
                  <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </button>
  
              {#if expandedSections[section.id]}
                <div
                  class="section-body"
                  transition:fly={{ y: -6, duration: 200, easing: cubicOut }}
                >
                  <!--
                    Content strategy (in priority order):
                    1. Svelte component passed via section.component
                    2. Plain text via section.content
                    3. Nothing (empty panel)
                  -->
                  {#if section.component}
                    <svelte:component this={section.component} {...(section.props ?? {})} />
                  {:else if section.content}
                    <p class="section-placeholder">{section.content}</p>
                  {/if}
                </div>
              {/if}
  
            </div>
          {/each}
  
          <!-- Slot for arbitrary bottom content -->
          <slot name="bottom" />
  
        </div>
      {:else}
  
        <!-- ── Collapsed rail ──────────────────────────────────────────────── -->
        <div class="rail-icons">
          {#each sections as section}
            <button
              class="rail-btn"
              title={section.label}
              on:click={() => openToSection(section.id)}
              aria-label="Open {section.label}"
            >
              {#if section.icon}
                <span class="rail-icon" aria-hidden="true">{section.icon}</span>
              {:else}
                <span class="rail-dot" />
              {/if}
            </button>
          {/each}
        </div>
  
      {/if}
  
    </div>
  
    <!-- ── Footer ─────────────────────────────────────────────────────────── -->
    {#if open}
      <div class="sidebar-footer" transition:fade={{ duration: 140 }}>
        <slot name="footer" />
      </div>
    {/if}
  
  </aside>
  
  <style>
    /* ── Shell ─────────────────────────────────────────────────────────────── */
    .sidebar {
      display: flex;
      flex-direction: column;
      min-height: 100%;
      background: #F4EFE5;
      border-right: 1px solid #5E5E5E;
      font-family: 'IBM Plex Sans', sans-serif;
      transition: width 280ms cubic-bezier(0.4, 0, 0.2, 1);
      overflow: hidden;
      flex-shrink: 0;
      position: relative;
    }
  
    .sidebar--right {
      border-right: none;
      border-left: 1px solid #DFC3A8;
    }
  
    /* ── Header ────────────────────────────────────────────────────────────── */
    .sidebar-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 8px;
      height: 40px;
      background: #EDE5D8;
      border-bottom: .5px dotted #5E5E5E;
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
  
    /* ── Toggle button ─────────────────────────────────────────────────────── */
    .toggle-btn {
      width: 26px;
      height: 26px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #A08060;
      cursor: pointer;
      flex-shrink: 0;
      transition: background 0.15s, color 0.15s, transform 0.28s cubic-bezier(0.4, 0, 0.2, 1);
    }
  
    .toggle-btn:hover {
      background: #DFC3A8;
      color: #5A3E28;
    }
  
    /* Flip the chevron when sidebar is right-docked or collapsed-left */
    .toggle-btn--flipped svg {
      transform: scaleX(-1);
    }
  
    /* ── Body ──────────────────────────────────────────────────────────────── */
    .sidebar-body {
      flex: 1;
      overflow: hidden;
      position: relative;
    }
  
    .sidebar-content {
      position: absolute;
      inset: 0;
      overflow-y: auto;
      overflow-x: hidden;
      padding: 10px 0;
    }
  
    /* Subtle scrollbar */
    .sidebar-content::-webkit-scrollbar { width: 4px; }
    .sidebar-content::-webkit-scrollbar-track { background: transparent; }
    .sidebar-content::-webkit-scrollbar-thumb { background: #DFC3A8; border-radius: 2px; }
  
    /* ── Accordion sections ─────────────────────────────────────────────────── */
    .section {
      border-bottom: 1px solid #DFC3A8;
    }
  
    .section-header {
      width: 100%;
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 9px 14px;
      background: none;
      border: none;
      cursor: pointer;
      text-align: left;
      transition: background 0.12s;
    }
  
    .section-header:hover {
      background: #EDE5D8;
    }
  
    .section-icon {
      font-size: 13px;
      width: 16px;
      text-align: center;
      flex-shrink: 0;
      opacity: 0.75;
    }
  
    .section-label {
      font-family: 'IBM Plex Sans', sans-serif;
      font-size: 10px;
      font-weight: 800;
      text-transform: uppercase;
      color: #7A5A3A;
      flex: 1;
    }
  
    .chevron {
      color: #BFA080;
      flex-shrink: 0;
      transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    }
  
    .chevron--open {
      transform: rotate(180deg);
    }
  
    .section-body {
      padding: 8px 14px 14px;
      background: #FAF7F2;
      border-top: 1px solid #EDE5D8;
    }
  
    .section-placeholder {
      font-family: 'IBM Plex Sans', sans-serif;
      font-size: 1em;
      color: #A08060;
      margin: 0;
    }
  
    /* ── Collapsed rail ─────────────────────────────────────────────────────── */
    .rail-icons {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 8px 0;
      gap: 4px;
    }
  
    .rail-btn {
      width: 30px;
      height: 30px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: none;
      border: 1px solid transparent;
      border-radius: 2px;
      cursor: pointer;
      color: #A08060;
      transition: background 0.12s, border-color 0.12s, color 0.12s;
    }
  
    .rail-btn:hover {
      background: #EDE5D8;
      border-color: #DFC3A8;
      color: #5A3E28;
    }
  
    .rail-icon {
      font-size: 14px;
      display: block;
      line-height: 1;
    }
  
    .rail-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #C4956A;
      opacity: 0.6;
    }
  
    /* ── Footer ─────────────────────────────────────────────────────────────── */
    .sidebar-footer {
      border-top: 1px solid #DFC3A8;
      background: #EDE5D8;
      padding: 10px 14px;
      flex-shrink: 0;
      font-size: 10px;
      color: #A08060;
    }
  </style>