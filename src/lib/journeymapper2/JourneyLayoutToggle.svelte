<script lang="ts">
    import ArrowSquareDown    from 'phosphor-icons-svelte/IconArrowSquareDownBold.svelte';
    import ArrowSquareRight from 'phosphor-icons-svelte/IconArrowSquareRightBold.svelte';
  
    /** Bound by parent via `bind:layout` */
    export let layout: 'horizontal' | 'vertical' = 'horizontal';
  </script>
  
  <div class="layout-toggle-wrap" role="group" aria-label="Chart layout">
  
    <button
      class="btn-base text-sm"
      class:layout-btn--active={layout === 'horizontal'}
      aria-pressed={layout === 'horizontal'}
      on:click={() => { layout = 'horizontal'; }}
      title="Horizontal layout"
    >
      <ArrowSquareRight class="w-4" />
      <span class="nav-title">Horizontal</span>
    </button>
  
    <button
      class="btn-base text-sm"
      class:layout-btn--active={layout === 'vertical'}
      aria-pressed={layout === 'vertical'}
      on:click={() => { layout = 'vertical'; }}
      title="Vertical layout"
    >
      <ArrowSquareDown class="w-4"/>
      <span class="nav-title">Vertical</span>
    </button>
  
  </div>
  
  <style>
    .layout-toggle-wrap {
      display: inline-flex;
      align-items: center;
      gap: .5em;
      padding: .25em 0 .35em .35em;
      border-radius: 100rem;
    }
  
  </style>