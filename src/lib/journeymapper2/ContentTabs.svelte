<script lang="ts">
  import { createToggle, melt } from '@melt-ui/svelte';
  import IconRowsRegular from 'phosphor-icons-svelte/IconRowsRegular.svelte';
  import IconColumnsRegular from 'phosphor-icons-svelte/IconColumnsRegular.svelte';

  /**
   * Controlled binding — parent passes `layout` and listens to `on:change`.
   * 'horizontal' = default horizontal scroll (steps left→right)
   * 'vertical'   = rotated vertical scroll (steps top→bottom)
   */
  export let layout: 'horizontal' | 'vertical' = 'horizontal';

  const {
    elements: { root },
    states: { pressed },
  } = createToggle({
    defaultPressed: layout === 'vertical',
    onPressedChange: ({ next }) => {
      layout = next ? 'vertical' : 'horizontal';
      return next;
    },
  });

  // Keep the internal Melt state in sync when the parent changes `layout`
  $: if ($pressed !== (layout === 'vertical')) {
    pressed.set(layout === 'vertical');
  }
</script>

<!--
  A compact two-state toggle that sits in the title bar.
  Uses `.btn-base` from app.css; active state is indicated via
  a warm fill consistent with the JourneyMapper palette.
-->
<div class="layout-toggle-wrap" role="group" aria-label="Chart layout">
  <!-- Horizontal option -->
  <button
    class="btn-base layout-btn"
    class:layout-btn--active={layout === 'horizontal'}
    on:click={() => {
      if (layout !== 'horizontal') {
        layout = 'horizontal';
        pressed.set(false);
      }
    }}
    aria-pressed={layout === 'horizontal'}
    title="Horizontal layout — steps left to right"
  >
    <IconRowsRegular size={14} />
    <span class="nav-title">Horizontal</span>
  </button>

  <!-- Melt toggle root drives the vertical state -->
  <button
    use:melt={$root}
    class="btn-base layout-btn"
    class:layout-btn--active={layout === 'vertical'}
    title="Vertical layout — steps top to bottom"
  >
    <IconColumnsRegular size={14} />
    <span class="nav-title">Vertical</span>
  </button>
</div>

<style>
  .layout-toggle-wrap {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    padding: 2px;
    background: rgba(0, 0, 0, 0.06);
    border-radius: 100rem;
  }

  .layout-btn {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    height: 1.75rem;
    padding: 0 0.625rem;
    border-radius: 100rem;
    background: transparent;
    box-shadow: none;
    color: #7A6A58;
    transition: background 0.15s ease, color 0.15s ease, box-shadow 0.15s ease;
  }

  .layout-btn:hover:not(.layout-btn--active) {
    background: rgba(196, 149, 106, 0.15);
    color: #5A3E28;
  }

  .layout-btn--active {
    background: #F4EFE5;
    color: #3B2A1A;
    box-shadow:
      0 1px 3px rgba(0, 0, 0, 0.12),
      0 0 0 1px rgba(0, 0, 0, 0.06);
  }
</style>