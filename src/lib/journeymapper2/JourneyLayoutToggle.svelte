<script lang="ts">
    import ArrowDown    from 'phosphor-icons-svelte/IconArrowDownBold.svelte';
    import ArrowRight from 'phosphor-icons-svelte/IconArrowRightBold.svelte';
  
    /** Bound by parent via `bind:layout` */
    export let layout: 'horizontal' | 'vertical' = 'horizontal';
  </script>
  
  <div class="flex flex-row w-full justify-end gap-1 mt-2 pr-2" 
  role="group" aria-label="Chart layout">
    <button
    class="btn-sm"
    class:layout-btn--active={layout === 'horizontal'}
    aria-pressed={layout === 'horizontal'}
    onclick={() => (layout = 'horizontal')}
    title="Horizontal layout"
  >
    <ArrowRight class="w-6" />
  </button>

  <button
    class="btn-sm"
    class:layout-btn--active={layout === 'vertical'}
    aria-pressed={layout === 'vertical'}
    onclick={() => (layout = 'vertical')}
    title="Vertical layout"
  >
    <ArrowDown class="w-4" />
  </button>
</div>

  <style>

  </style>