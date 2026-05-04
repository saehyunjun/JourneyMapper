<!--
  InterventionPalette.svelte
  ─────────────────────────────────────────────────────────────────────────────
  Sticky right-side palette listing sponsor intervention types.

  Key architectural decisions
  ───────────────────────────
  1. The `items` array passed to svelte-dnd-action is ALWAYS rebuilt from the
     filtered subset on every finalize AND whenever the filter/search changes.
     This avoids the `display:none` trick (which desyncs dndzone's internal
     child-count tracking and breaks cursor/grab across the whole page).

  2. Copy-on-drag uses the canonical DRAG_STARTED clone-insertion pattern:
     during `consider`, when the trigger is DRAG_STARTED, we splice a fresh
     clone (new id) into the position the dragged item vacated. The dragged
     ghost keeps its original id and lands in the destination unchanged.

  3. After finalize (whether dropped externally or cancelled), `items` is
     reset to a fresh clone of the current filtered set so the palette is
     always fully replenished.
-->

<script lang="ts">
    import { dndzone, TRIGGERS } from 'svelte-dnd-action';
    import { flip } from 'svelte/animate';
  
    import IconLightbulbRegular       from 'phosphor-icons-svelte/IconLightbulbRegular.svelte';
    import IconMagnifyingGlassRegular from 'phosphor-icons-svelte/IconMagnifyingGlassRegular.svelte';
    import IconXRegular               from 'phosphor-icons-svelte/IconXRegular.svelte';
    import IconFunnelRegular          from 'phosphor-icons-svelte/IconFunnelRegular.svelte';
    import IconCaretDownRegular       from 'phosphor-icons-svelte/IconCaretDownRegular.svelte';
    import IconCaretUpRegular         from 'phosphor-icons-svelte/IconCaretUpRegular.svelte';
  
    import interventionData from '$lib/data/dataConfig/sponsor_interventions.json';
  
    // ── Types ──────────────────────────────────────────────────────────────────
    interface InterventionItem {
      id: string;
      label: string;
      category: string;
    }
  
    // ── Category metadata ──────────────────────────────────────────────────────
    const CATEGORY_MAP: Record<string, { label: string; color: string }> = {
      awareness:          { label: 'Awareness',           color: '#3b6ea8' },
      diagnosis:          { label: 'Diagnosis',           color: '#7a5fc7' },
      referral:           { label: 'Referral',            color: '#2d9e62' },
      trial_enrollment:   { label: 'Trial Enrollment',    color: '#c48a1a' },
      trial_retention:    { label: 'Trial Retention',     color: '#cc6324' },
      treatment_access:   { label: 'Treatment Access',    color: '#e05c5c' },
      adherence:          { label: 'Adherence',           color: '#4a9e7f' },
      caregiver_support:  { label: 'Caregiver Support',   color: '#9b6bc4' },
      long_term_outcomes: { label: 'Long-Term Outcomes',  color: '#3a7fc1' },
    };
  
    function humanise(id: string): string {
      return id.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    }
  
    function categoryColor(cat: string): string {
      return CATEGORY_MAP[cat]?.color ?? 'var(--gray)';
    }
  
    function resolveCategory(typeId: string): string {
      const initiative = interventionData.sponsor_initiatives.find((si) => si.id === typeId);
      if (initiative) return initiative.category;
      if (typeId.includes('trial') || typeId.includes('recruitment') ||
          typeId.includes('retention') || typeId.includes('eligibility')) return 'trial_enrollment';
      if (typeId.includes('caregiver')) return 'caregiver_support';
      if (typeId.includes('diagnostic') || typeId.includes('patient_identification')) return 'diagnosis';
      if (typeId.includes('education') || typeId.includes('campaign') ||
          typeId.includes('community')) return 'awareness';
      if (typeId.includes('adherence')) return 'adherence';
      if (typeId.includes('financial') || typeId.includes('access') ||
          typeId.includes('travel')) return 'treatment_access';
      if (typeId.includes('kol') || typeId.includes('field_medical') ||
          typeId.includes('site')) return 'referral';
      if (typeId.includes('real_world') || typeId.includes('post_marketing')) return 'long_term_outcomes';
      return 'awareness';
    }
  
    /** Master seed — never mutated directly. */
    const ALL_ITEMS: InterventionItem[] = interventionData.intervention_types.map((typeId, i) => ({
      id: `intv-${typeId}-${i}`,
      label: humanise(typeId),
      category: resolveCategory(typeId),
    }));
  
    // ── Reactive state ─────────────────────────────────────────────────────────
    let searchQuery  = $state('');
    let activeFilter = $state<string | null>(null);
    let collapsed    = $state(false);
    let filterOpen   = $state(false);
  
    /** Build a fresh filtered+cloned items array with unique ids. */
    function buildItems(): InterventionItem[] {
      let base = ALL_ITEMS;
      if (activeFilter) base = base.filter((it) => it.category === activeFilter);
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        base = base.filter(
          (it) => it.label.toLowerCase().includes(q) || it.category.toLowerCase().includes(q)
        );
      }
      // Fresh ids on every rebuild so svelte-dnd-action never sees stale ghosts
      return base.map((it) => ({
        ...it,
        id: `${it.id}--${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      }));
    }
  
    let items = $state<InterventionItem[]>(buildItems());
  
    // Rebuild items whenever filter or search changes
    $effect(() => {
      // Touch both reactive deps
      void searchQuery;
      void activeFilter;
      items = buildItems();
    });
  
    let categoryCounts = $derived.by(() => {
      const counts: Record<string, number> = {};
      ALL_ITEMS.forEach((it) => { counts[it.category] = (counts[it.category] ?? 0) + 1; });
      return counts;
    });
  
    // ── DnD: copy-on-drag ─────────────────────────────────────────────────────
    const FLIP_DURATION = 150;
  
    function handleConsider(e: CustomEvent) {
      const { items: incoming, info } = e.detail;
  
      if (info.trigger === TRIGGERS.DRAG_STARTED) {
        // The lib removed the dragged item from `incoming`. Find the original
        // and re-insert a clone with a fresh id at its former position.
        const origIdx = items.findIndex((it) => it.id === info.id);
        const original = origIdx !== -1 ? items[origIdx] : null;
        if (original) {
          const clone: InterventionItem = {
            ...original,
            id: `intv-clone-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          };
          incoming.splice(origIdx, 0, clone);
        }
      }
  
      items = incoming;
    }
  
    function handleFinalize(e: CustomEvent) {
      // Whether dropped externally or cancelled, reset to full filtered set.
      items = buildItems();
    }
  </script>
  
  <aside
    class="intervention-palette"
    class:intervention-palette--collapsed={collapsed}
    aria-label="Sponsor intervention palette"
  >
    <!-- ── Header ─────────────────────────────────────────────────────────── -->
    <div class="toolbar-light-sm">
      <div class="flex flex-row items-center gap-2">
        <span class="label-sm uppercase">
            Recommended Sponsor Actions
        </span>
        <!-- <span class="label-xs" style="color: var(--gray);">
          {items.length}
        </span> -->
      </div>
  
      <div class="flex flex-row items-center gap-1">
        <button
          class="btn-sm"
          onclick={() => (filterOpen = !filterOpen)}
          aria-label="Toggle category filter"
          aria-expanded={filterOpen}
        >
          <IconFunnelRegular />
        </button>
  
        <button
          class="btn-sm"
          onclick={() => (collapsed = !collapsed)}
          aria-label={collapsed ? 'Expand palette' : 'Collapse palette'}
        >
          {#if collapsed}<IconCaretUpRegular />{:else}<IconCaretDownRegular />{/if}
        </button>
      </div>
    </div>
  
    {#if !collapsed}
      <!-- ── Search ───────────────────────────────────────────────────────── -->
      <div class="flex flex-row items-center gap-2 px-2 py-1"
           style="border-bottom: 0.5px solid var(--panel-dark);">
        <IconMagnifyingGlassRegular style="color: var(--gray); flex-shrink:0;" />
        <input
          type="text"
          bind:value={searchQuery}
          placeholder="Search interventions…"
          class="palette-search"
          aria-label="Filter interventions by name"
        />
        {#if searchQuery}
          <button
            class="btn-sm"
            onclick={() => (searchQuery = '')}
            aria-label="Clear search"
            style="width:1.5em; height:1.5em;"
          >
            <IconXRegular />
          </button>
        {/if}
      </div>
  
      <!-- ── Category filter pills ────────────────────────────────────────── -->
      {#if filterOpen}
        <div class="flex flex-row flex-wrap gap-1 px-2 py-1"
             style="border-bottom: 0.5px solid var(--panel-dark);">
          <button
            class="pill-sm"
            class:palette-filter--active={!activeFilter}
            onclick={() => (activeFilter = null)}
          >All</button>
  
          {#each Object.entries(CATEGORY_MAP) as [key, meta]}
            {#if categoryCounts[key]}
              <button
                class="pill-sm"
                class:palette-filter--active={activeFilter === key}
                style={activeFilter === key
                  ? `background:${meta.color}; color:#fff; border-color:${meta.color};`
                  : `border-color:${meta.color}; color:${meta.color};`}
                onclick={() => (activeFilter = activeFilter === key ? null : key)}
              >
                {meta.label}
                <span class="label-xs" style="opacity:0.7; margin-left:2px;">
                  {categoryCounts[key]}
                </span>
              </button>
            {/if}
          {/each}
        </div>
      {/if}
  
      <!-- ── Draggable list ───────────────────────────────────────────────── -->
      <div
        class="palette-list"
        use:dndzone={{
          items,
          type: 'intervention',
          dropFromOthersDisabled: true,
          flipDurationMs: FLIP_DURATION,
          centreDraggedOnCursor: true,
        }}
        onconsider={handleConsider}
        onfinalize={handleFinalize}
      >
        {#each items as item (item.id)}
          <div
            class="palette-item"
            animate:flip={{ duration: FLIP_DURATION }}
            tabindex="0"
            role="option"
            aria-label="Drag {item.label} intervention"
          >
            <span
              class="palette-item__dot"
              style="background: {categoryColor(item.category)};"
              aria-hidden="true"
            ></span>
  
            <div class="flex flex-col gap-0 min-w-0">
              <span class="palette-item__label">{item.label}</span>
              <span class="palette-item__cat">
                {CATEGORY_MAP[item.category]?.label ?? item.category}
              </span>
            </div>
          </div>
        {/each}
      </div>
  
      {#if items.length === 0}
        <div class="flex items-center justify-center p-4">
          <span class="label-sm" style="color:var(--gray);">No matching interventions</span>
        </div>
      {/if}
    {/if}
  </aside>
  
  <style>
    .intervention-palette {
      position: sticky;
      top: 0;
      align-self: flex-start;
      display: flex;
      flex-direction: column;
      width: 260px;
      min-width: 220px;
      max-height: 100vh;
      background: var(--paper);
      border-left: 0.5px solid var(--panel-dark);
      z-index: 10;
      flex-shrink: 0;
    }
  
    .intervention-palette--collapsed { max-height: fit-content; }
  
    .palette-search {
      flex: 1;
      min-width: 0;
      border: none;
      outline: none;
      background: transparent;
      font-family: var(--font-body);
      font-size: 0.75rem;
      color: var(--ink);
      padding: 0.25em 0;
    }
    .palette-search::placeholder { color: var(--gray); opacity: 0.6; }
  
    .palette-filter--active { font-weight: 700; }
  
    .palette-list {
      flex: 1;
      overflow-y: auto;
      overflow-x: hidden;
      display: flex;
      flex-direction: column;
      gap: 2px;
      padding: 0.25rem;
      min-height: 3rem;
    }
  
    .palette-item {
      display: flex;
      flex-direction: row;
      align-items: center;
      gap: 0.5rem;
      padding: 0.35rem 0.5rem;
      border-radius: 6px;
      border: 1px solid transparent;
      cursor: grab;
      user-select: none;
      transition:
        background   150ms ease,
        border-color 150ms ease,
        box-shadow   150ms ease;
    }
  
    .palette-item:hover {
      background: var(--lightgrayblue);
      border-color: var(--midgrayblue);
      box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
    }
  
    .palette-item:active { cursor: grabbing; }
  
    .palette-item__dot {
      width: 6px;
      height: 6px;
      border-radius: 100%;
      flex-shrink: 0;
    }
  
    .palette-item__label {
      font-family: var(--font-body);
      font-size: 0.6875rem;
      font-weight: 500;
      color: var(--ink);
      line-height: 1.3;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  
    .palette-item__cat {
      font-family: var(--font-mono);
      font-size: 0.5625rem;
      font-weight: 400;
      color: var(--gray);
      text-transform: uppercase;
      letter-spacing: 0.04em;
      line-height: 1;
    }
  </style>