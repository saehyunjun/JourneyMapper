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
</style>