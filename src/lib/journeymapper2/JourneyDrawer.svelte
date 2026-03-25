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
    class="drawer w-8/12"
    transition:fly={{ x: 120, duration: 320, easing: cubicOut }}
    role="complementary"
    aria-label={title || 'Detail panel'}
  >

  {#if $$slots.footer}
  <div class="flex flex-col h-full bg-[#DBDFD3] ring-1 ring-slate-400 shadow-2xl">
    <button class="btn-sm bg-[#FF8341]" on:click={close} aria-label="Close panel">
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

<style>
  /* ── Backdrop ───────────────────────────────────────────────── */


  /* ── Shell ──────────────────────────────────────────────────── */
  .drawer {
    position: fixed;
    top: 0;
    right: 0;
    bottom: 0;
    z-index: 201;
    display: flex;
    flex-direction: row;
    background: #fff;
    border-left: .5px solid ##EAEFF8;
    box-shadow: 
    0px 0px 0px 1px rgba(0, 0, 0, 0.08),
    0px 1px 2px -1px rgba(0, 0, 0, 0.08),
    0px 2px 4px 0px rgba(0, 0, 0, 0.06);
    overflow: hidden;
  }
</style>