<script lang="ts">
    import { createSelect, melt } from '@melt-ui/svelte';
    import { fly } from 'svelte/transition';
    import { createEventDispatcher } from 'svelte';
    import CaretDownRegular from 'phosphor-icons-svelte/IconCaretDownRegular.svelte';
    import CheckRegular from 'phosphor-icons-svelte/IconCheckRegular.svelte';
  
    import diseaseList from './diseaseList.json';
  
    // ── Types ──────────────────────────────────────────────────────────────────
    type TherapeuticArea = {
      therapeutic_area: string;
      indications: string[];
    };
  
    // ── Data ───────────────────────────────────────────────────────────────────
    const therapeuticAreas: TherapeuticArea[] = diseaseList.therapeutic_areas;
  
    const dispatch = createEventDispatcher<{
      change: { therapeuticArea: string | undefined; indication: string | undefined };
    }>();
  
    // ── Therapeutic Area Select ────────────────────────────────────────────────
    const taItems = therapeuticAreas.map((a) => ({
      value: a.therapeutic_area,
      label: a.therapeutic_area,
    }));
  
    const {
      elements: {
        trigger: taTrigger,
        menu: taMenu,
        option: taOption,
      },
      states: {
        open: taOpen,
        selected: taSelected,
      },
      helpers: { isSelected: taIsSelected },
    } = createSelect<string>({
      positioning: null,
      items: taItems,
    });
  
    // ── Derived State ──────────────────────────────────────────────────────────
    $: currentArea = therapeuticAreas.find(
      (a) => a.therapeutic_area === $taSelected?.value
    );
  
    $: currentIndications = currentArea?.indications ?? [];
  
    // ── Indication Select ──────────────────────────────────────────────────────
    $: indItems = currentIndications.map((i) => ({
      value: i,
      label: i,
    }));
  
    const {
      elements: {
        trigger: indTrigger,
        menu: indMenu,
        option: indOption,
      },
      states: {
        open: indOpen,
        selected: indSelected,
      },
      helpers: { isSelected: indIsSelected },
    } = createSelect<string>({
      positioning: null,
      items: indItems,
    });
  
    // ── Controlled side-effects ────────────────────────────────────────────────
    let prevTA: string | undefined;
    let prevInd: string | undefined;
  
    $: if ($taSelected?.value !== prevTA) {
      prevTA = $taSelected?.value;
      indSelected.set(undefined);
  
      dispatch('change', {
        therapeuticArea: prevTA,
        indication: undefined,
      });
    }
  
    $: if ($indSelected?.value !== prevInd) {
      prevInd = $indSelected?.value;
  
      dispatch('change', {
        therapeuticArea: $taSelected?.value,
        indication: prevInd,
      });
    }
  </script>
  
  <div class="selector-group">
  
    <!-- ── Therapeutic Area ───────────────────────────────────────────────── -->
    <div class="selector-field">
      <button
        class="selector-trigger btn-base"
        use:melt={$taTrigger}
        aria-label="Select therapeutic area"
      >
        <span class="label-sm" class:selector-value--placeholder={!$taSelected}>
          {$taSelected?.label ?? 'Therapeutic area'}
        </span>
        <span class="selector-caret" class:selector-caret--open={$taOpen}>
          <CaretDownRegular class="h-4" />
        </span>
      </button>
  
      {#if $taOpen}
        <div
          class="selector-menu jm-surface"
          use:melt={$taMenu}
          transition:fly={{ duration: 120, y: -6 }}
        >
          {#each taItems as item}
            <div
              class="selector-item"
              class:selector-item--selected={$taIsSelected(item.value)}
              use:melt={$taOption(item)}
            >
              <span class="selector-item-label label-lg">{item.label}</span>
              {#if $taIsSelected(item.value)}
                <span class="selector-check"><CheckRegular class="h-4" /></span>
              {/if}
            </div>
          {/each}
        </div>
      {/if}
    </div>
  
    <!-- ── Indication ─────────────────────────────────────────────────────── -->
    <div class="selector-field">
      <button
        class="selector-trigger btn-base"
        class:selector-trigger--disabled={!$taSelected}
        use:melt={$indTrigger}
        disabled={!$taSelected}
        aria-label="Select indication"
      >
        <span class="label-sm" class:selector-value--placeholder={!$indSelected}>
          {#if !$taSelected}
            Select therapeutic area
          {:else}
            {$indSelected?.label ?? 'Indication…'}
          {/if}
        </span>
        <span class="selector-caret" class:selector-caret--open={$indOpen}>
          <CaretDownRegular class="h-4" />
        </span>
      </button>
  
      {#if $indOpen && indItems.length}
        <div
          class="selector-menu jm-surface"
          use:melt={$indMenu}
          transition:fly={{ duration: 120, y: -6 }}
        >
          {#each indItems as item}
            <div
              class="selector-item"
              class:selector-item--selected={$indIsSelected(item.value)}
              use:melt={$indOption(item)}
            >
              <span class="selector-item-label label-lg">{item.label}</span>
              {#if $indIsSelected(item.value)}
                <span class="selector-check"><CheckRegular class="h-4" /></span>
              {/if}
            </div>
          {/each}
        </div>
      {/if}
    </div>
  
  </div>
  
  <style>
    .selector-group {
      display: flex;
      flex-direction: row;
      gap: .35rem;
    }
  
    .selector-field {
      display: flex;
      flex-direction: column;
      gap: 0.375rem;
      position: relative;
    }
  
    .selector-trigger {
      width: 10.5rem;
      justify-content: space-between;
      border-radius: 20px;
      height: 2.5rem;
      padding: 0 0.75rem;
      text-align: left;
    }
  
    .selector-trigger--disabled {
      opacity: 0.4;
      cursor: not-allowed;
      pointer-events: none;
    }
  
    .selector-value--placeholder {
      color: var(--gray);
    }
  
    .selector-caret {
      flex-shrink: 0;
      color: var(--gray);
      transition: transform 180ms ease;
      display: flex;
      align-items: center;
    }
  
    .selector-caret--open {
      transform: rotate(180deg);
    }
  
    .selector-menu {
      position: absolute;
      z-index: 500;
      width: 100%;
      max-height: 220px;
      overflow-y: auto;
      padding: 4px;
      border-radius: 4px;
      display: flex;
      flex-direction: column;
      gap: 1px;
    }
  
    .selector-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      padding: 7px 10px;
      border-radius: 2px;
      cursor: pointer;
      user-select: none;
      transition: background 120ms ease;
    }
  
    .selector-item:hover {
      background: var(--card);
    }
  
    .selector-item--selected {
      background: rgba(35, 171, 171, 0.1);
    }
  
    .selector-item-label {
      flex: 1;
      color: var(--ink);
    }
  
    .selector-check {
      color: var(--teal);
      display: flex;
      align-items: center;
      flex-shrink: 0;
    }
  </style>