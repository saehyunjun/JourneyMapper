<script lang="ts">
  import { createSelect, melt } from '@melt-ui/svelte';
  import { fly } from 'svelte/transition';
  import CaretDownRegular from 'phosphor-icons-svelte/IconCaretDownRegular.svelte';
  import CheckRegular from 'phosphor-icons-svelte/IconCheckRegular.svelte';

  // ── Types ──────────────────────────────────────────────────────────────────
  type Persona = {
    id: string;
    therapeutic_area?: string;
    indication?: string;
    [key: string]: unknown;
  };

  type SelectOption<T> = { value: T; label: string; disabled?: boolean };

  function single<T>(s: SelectOption<T> | SelectOption<T>[] | undefined): SelectOption<T> | undefined {
    if (!s) return undefined;
    return Array.isArray(s) ? s[0] : s;
  }

  // ── Props ──────────────────────────────────────────────────────────────────
  let {
    personas = [] as Persona[],
    onchange = undefined as ((therapeuticArea: string | undefined, indication: string | undefined) => void) | undefined,
  } = $props();

  // ── Derive therapeutic area options ────────────────────────────────────────
  let taItems = $derived(
    [...new Set(personas.map(p => p.therapeutic_area).filter(Boolean) as string[])]
      .sort()
      .map(ta => ({ value: ta, label: ta, disabled: false }))
  );

  // ── Derive indication options ───────────────────────────────────────────────
  let allIndications = $derived(
    [...new Set(personas.map(p => p.indication).filter(Boolean) as string[])].sort()
  );

  let indItems = $derived(
    allIndications.map(ind => ({
      value: ind,
      label: ind,
      disabled: !personas.some(p =>
        p.indication === ind &&
        (!taSelectedOption || p.therapeutic_area === taSelectedOption.value)
      ),
    }))
  );

  // ── Therapeutic Area Select ────────────────────────────────────────────────
  const {
    elements: { trigger: taTrigger, menu: taMenu, option: taOption },
    states:   { open: taOpen, selected: taSelected },
    helpers:  { isSelected: taIsSelected },
  } = createSelect<string>({ positioning: null });

  let taSelectedOption = $derived(single($taSelected));

  // ── Indication Select ──────────────────────────────────────────────────────
  const {
    elements: { trigger: indTrigger, menu: indMenu, option: indOption },
    states:   { open: indOpen, selected: indSelected },
    helpers:  { isSelected: indIsSelected },
  } = createSelect<string>({ positioning: null });

  let indSelectedOption = $derived(single($indSelected));

  // ── Side-effects ───────────────────────────────────────────────────────────
  let prevTA: string | undefined;
  let prevInd: string | undefined;

  $effect(() => {
    const ta = taSelectedOption?.value;
    if (ta !== prevTA) {
      prevTA = ta;
      indSelected.set(undefined);
      onchange?.(prevTA, undefined);
    }
  });

  $effect(() => {
    const ind = indSelectedOption?.value;
    if (ind !== prevInd) {
      prevInd = ind;
      onchange?.(taSelectedOption?.value, prevInd);
    }
  });
</script>

<div class="selector-group">

  <!-- ── Therapeutic Area ─────────────────────────────────────────────────── -->
  <div class="selector-field">
    <button
      class="selector-trigger btn-base"
      use:melt={$taTrigger}
      aria-label="Select therapeutic area"
    >
      <span class="label-sm" class:selector-value--placeholder={!taSelectedOption}>
        {taSelectedOption?.label ?? 'Therapeutic area'}
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

  <!-- ── Indication ───────────────────────────────────────────────────────── -->
  <div class="selector-field">
    <button
      class="selector-trigger btn-base"
      class:selector-trigger--disabled={!taSelectedOption}
      use:melt={$indTrigger}
      disabled={!taSelectedOption}
      aria-label="Select indication"
    >
      <span class="label-sm" class:selector-value--placeholder={!indSelectedOption}>
        {#if !taSelectedOption}
          Indication
        {:else}
          {indSelectedOption?.label ?? 'Indication…'}
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
            class:selector-item--disabled={item.disabled}
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

  .selector-item:hover:not(.selector-item--disabled) {
    background: var(--card);
  }

  .selector-item--selected {
    background: rgba(35, 171, 171, 0.1);
  }

  .selector-item--disabled {
    opacity: 0.35;
    cursor: not-allowed;
    pointer-events: none;
  }

  .selector-item-label {
    flex: 1;
    color: var(--ink);
  }

  .selector-check {
    color: var(--purple);
    display: flex;
    align-items: center;
    flex-shrink: 0;
  }
</style>
