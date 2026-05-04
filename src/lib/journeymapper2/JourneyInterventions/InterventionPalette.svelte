<!--
  InterventionPalette.svelte
  ─────────────────────────────────────────────────────────────────────────────
  Sticky right-side palette listing all sponsor intervention types from
  sponsor_interventions.json.  Uses svelte-dnd-action's canonical copy-on-drag
  pattern: on DRAG_STARTED the source list is replenished IN PLACE with a
  freshly-id'd clone, and the dragged ghost carries the original id forward
  to its destination.  This guarantees every chip dropped into a zone has a
  globally unique id without any rewriting at the destination.

  Filtering by search/category is done by hiding non-matching rows (CSS),
  NOT by mutating the array passed to dndzone — the items array must stay
  in 1:1 sync with the rendered DOM children.
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
  
    /** Master list of intervention items — the seed for the source palette. */
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
  
    // The dndzone receives the FULL list. Filtering is applied via row visibility
    // (`.palette-item--hidden`), NOT by removing items from the array, because
    // svelte-dnd-action requires items[] to match the rendered children 1:1.
    let items = $state<InterventionItem[]>(structuredClone(ALL_ITEMS));
  
    function matches(item: InterventionItem): boolean {
      if (activeFilter && item.category !== activeFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        if (!item.label.toLowerCase().includes(q) &&
            !item.category.toLowerCase().includes(q)) return false;
      }
      return true;
    }
  
    let visibleCount = $derived(items.filter(matches).length);
  
    let categoryCounts = $derived.by(() => {
      const counts: Record<string, number> = {};
      items.forEach((it) => { counts[it.category] = (counts[it.category] ?? 0) + 1; });
      return counts;
    });
  
    // ── DnD: canonical copy-on-drag ────────────────────────────────────────────
    // On DRAG_STARTED the lib hands us items WITHOUT the dragged item. We
    // re-insert a fresh clone (new id) at the original index so the source list
    // is never depleted; the dragged ghost keeps the original id and lands in
    // the destination zone. Subsequent drags of the same row will use the
    // current clone's id, so every dropped chip is globally unique.
    const FLIP_DURATION = 150;
  
    function makeCloneId(): string {
      return `intv-clone-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    }
  
    function handleConsider(e: CustomEvent) {
      const { items: newItems, info } = e.detail;
  
      if (info.trigger === TRIGGERS.DRAG_STARTED) {
        const origIdx = items.findIndex((it) => it.id === info.id);
        const original = origIdx !== -1 ? items[origIdx] : null;
        if (original) {
          newItems.splice(origIdx, 0, { ...original, id: makeCloneId() });
        }
      }
  
      items = newItems;
    }
  
    function handleFinalize(e: CustomEvent) {
      // Source already replenished during consider — just commit the lib's view.
      items = e.detail.items;
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
        <span class="pill-round" style="background: var(--orange); color: var(--paper);">
          <IconLightbulbRegular />
        </span>
        <span class="label-sm uppercase">Interventions</span>
        <span class="label-xs" style="color: var(--gray);">
          {visibleCount}
        </span>
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
      <!-- NOTE: items is the FULL list. Non-matching rows are visually hidden
           but stay in the DOM so svelte-dnd-action's array stays consistent. -->
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
            class:palette-item--hidden={!matches(item)}
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
  
      {#if visibleCount === 0}
        <div class="flex items-center justify-center p-4">
          <span class="label-sm" style="color:var(--gray);">No matching interventions</span>
        </div>
      {/if}
    {/if}
  </aside>
  
  <style>
    /* ── Palette shell ─────────────────────────────────────────────────────── */
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
  
    /* ── Search input ──────────────────────────────────────────────────────── */
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
  
    /* ── Scrollable item list ──────────────────────────────────────────────── */
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
  
    /* ── Individual draggable item ─────────────────────────────────────────── */
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
  
    /* Filtered-out rows stay in the DOM (display:none) so svelte-dnd-action's
       items array remains in 1:1 sync with the rendered children. */
    .palette-item--hidden { display: none; }
  
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