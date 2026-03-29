<script>
  import { fly, fade } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import { createEventDispatcher } from 'svelte';
  import X from "phosphor-icons-svelte/IconXRegular.svelte";


  const dispatch = createEventDispatcher();

  /** Controls visibility — bind this from the parent */
  export let open = false;

  /** Short uppercase eyebrow label shown above the title */
  export let eyebrow = '';

  /** Main title shown in the header */
  export let title = '';

  export function close() {
    open = false;
    dispatch('close');
  }

  function onKeydown(e) {
    if (e.key === 'Escape') close();
  }
  
</script>

<svelte:window on:keydown={onKeydown} />

{#if open}
  <!-- Backdrop -->
  <div
    class="backdrop"
    on:click={close}
    aria-hidden="true">
    </div>

  <!-- Drawer shell -->
  <aside
    class="drawer w-7/12"
    transition:fly={{ x: 120, duration: 320, easing: cubicOut }}
    aria-label={title || 'Detail panel'}
  >

  {#if $$slots.footer}
  <div class="toolbar-light">
    <button class="btn-sm bg-[#CC6324] text-white hover:bg-[#FF8341]" 
      on:click={close} aria-label="Close panel">
      <X />
    </button>
    <slot name="footer" />
  </div>
{/if}

    <!-- Scrollable body -->
    <div class="drawer-body">
      <slot />
    </div>

  </aside>
{/if}

