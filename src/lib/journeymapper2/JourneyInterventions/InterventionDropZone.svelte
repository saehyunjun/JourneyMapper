<!--
  InterventionDropZone.svelte
  ─────────────────────────────────────────────────────────────────────────────
  Per-step drop target. Sits to the right of each FlowStepCard.

  Accepts items of `type: 'intervention'` from InterventionPalette and from
  other drop zones. Items arrive with globally unique ids (the palette mints
  fresh ids on every rebuild), so no id rewriting is needed here.

  Source-of-truth is the shared `stepInterventions` store.
-->

<script lang="ts">
    import { dndzone } from 'svelte-dnd-action';
    import { flip } from 'svelte/animate';
  
    import IconPlusRegular from 'phosphor-icons-svelte/IconPlusRegular.svelte';
    import IconXRegular    from 'phosphor-icons-svelte/IconXRegular.svelte';
  
    import {
      stepInterventions,
      setStepInterventions,
      removeIntervention,
    } from './interventionStore.js';
  
    // ── Types ────────────────────────────────────────────────────────────────
    interface InterventionItem {
      id: string;
      label: string;
      category: string;
    }
  
    // ── Props ────────────────────────────────────────────────────────────────
    let { stepId }: { stepId: string } = $props();
  
    // ── Category accent ──────────────────────────────────────────────────────
    const CATEGORY_COLORS: Record<string, string> = {
      awareness:          '#3b6ea8',
      diagnosis:          '#7a5fc7',
      referral:           '#2d9e62',
      trial_enrollment:   '#c48a1a',
      trial_retention:    '#cc6324',
      treatment_access:   '#e05c5c',
      adherence:          '#4a9e7f',
      caregiver_support:  '#9b6bc4',
      long_term_outcomes: '#3a7fc1',
    };
  
    const FLIP_DURATION = 150;
  
    // ── Local state ──────────────────────────────────────────────────────────
    let items = $state<InterventionItem[]>([]);
    let dragActive = $state(false);
  
    // Sync from store when not mid-drag
    $effect(() => {
      const fromStore = ($stepInterventions.get(stepId) ?? []) as InterventionItem[];
      if (!dragActive) {
        items = [...fromStore];
      }
    });
  
    // ── DnD handlers ─────────────────────────────────────────────────────────
    function handleConsider(e: CustomEvent) {
      dragActive = true;
      items = e.detail.items;
    }
  
    function handleFinalize(e: CustomEvent) {
      items = e.detail.items;
      setStepInterventions(stepId, [...items]);
      dragActive = false;
    }
  
    function handleRemove(itemId: string) {
      removeIntervention(stepId, itemId);
    }
  
    let isEmpty = $derived(items.length === 0);
  </script>
  
  <div
    class="drop-zone"
    class:drop-zone--empty={isEmpty}
    use:dndzone={{
      items,
      type: 'intervention',
      flipDurationMs: FLIP_DURATION,
      dropTargetClasses: ['drop-zone--active'],
      dropTargetStyle: {},
    }}
    onconsider={handleConsider}
    onfinalize={handleFinalize}
    aria-label="Sponsor interventions for this step"
  >
    {#each items as item (item.id)}
      <div
        class="drop-zone-chip"
        animate:flip={{ duration: FLIP_DURATION }}
        style="--chip-accent: {CATEGORY_COLORS[item.category] ?? 'var(--gray)'};"
        title={item.label}
      >
        <span class="drop-zone-chip__dot" aria-hidden="true"></span>
        <span class="drop-zone-chip__label">{item.label}</span>
        <button
          class="drop-zone-chip__close"
          onclick={() => handleRemove(item.id)}
          aria-label="Remove {item.label}"
          type="button"
        >
          <IconXRegular />
        </button>
      </div>
    {/each}
  
    {#if isEmpty}
      <div class="drop-zone-empty" aria-hidden="true">
        <IconPlusRegular style="opacity:0.4;" />
        <span class="label-xs" style="color:var(--gray); opacity:0.7;">
          Drop intervention
        </span>
      </div>
    {/if}
  </div>
  
  <style>
    .drop-zone {
      display: flex;
      flex-direction: column;
      gap: 4px;
      width: 180px;
      min-height: 80px;
      padding: 6px;
      z-index: 999;
      border-radius: 6px;
      background: rgba(255, 255, 255, 0.4);
      border: 0.5px solid var(--panel-mid);
      transition:
        border-color 150ms ease,
        background   150ms ease;
    }
  
    .drop-zone--empty {
      background: transparent;
      border: 1px dashed var(--panel-mid);
    }
  
    :global(.drop-zone--active) {
      border-color: var(--orange) !important;
      border-style: solid !important;
      background: rgba(255, 131, 65, 0.06) !important;
    }
  
    .drop-zone-chip {
      display: flex;
      flex-direction: row;
      align-items: center;
      gap: 6px;
      padding: 3px 4px 3px 6px;
      border-radius: 4px;
      background: var(--paper);
      border: 0.5px solid var(--panel-mid);
      border-left: 3px solid var(--chip-accent, var(--gray));
      cursor: grab;
      user-select: none;
      transition: box-shadow 150ms ease;
    }
  
    .drop-zone-chip:hover  { box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08); }
    .drop-zone-chip:active { cursor: grabbing; }
  
    .drop-zone-chip__dot {
      width: 5px;
      height: 5px;
      border-radius: 100%;
      background: var(--chip-accent, var(--gray));
      flex-shrink: 0;
    }
  
    .drop-zone-chip__label {
      flex: 1;
      min-width: 0;
      font-family: var(--font-body);
      font-size: 0.625rem;
      font-weight: 500;
      color: var(--ink);
      line-height: 1.25;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  
    .drop-zone-chip__close {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 14px;
      height: 14px;
      background: transparent;
      border: none;
      border-radius: 100%;
      color: var(--gray);
      cursor: pointer;
      flex-shrink: 0;
      opacity: 0.4;
      transition:
        opacity    150ms ease,
        background 150ms ease,
        color      150ms ease;
    }
  
    .drop-zone-chip:hover .drop-zone-chip__close { opacity: 1; }
  
    .drop-zone-chip__close:hover {
      background: var(--lightorange);
      color: var(--orange);
    }
  
    .drop-zone-empty {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 4px;
      pointer-events: none;
    }
  </style>