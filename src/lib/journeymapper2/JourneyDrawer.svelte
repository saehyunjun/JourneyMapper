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
    transition:fade={{ duration: 200 }}
    on:click={close}
    aria-hidden="true"
  />

  <!-- Drawer shell -->
  <aside
    class="drawer w-8/12"
    transition:fly={{ x: 120, duration: 320, easing: cubicOut }}
    role="complementary"
    aria-label={title || 'Detail panel'}
  >

  {#if $$slots.footer}
  <div class="drawer-nav pt-2">
    <button class="btn-sm" on:click={close} aria-label="Close panel">
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
  .backdrop {
    position: fixed;
    inset: 0;
    background: rgba(56, 56, 56, 0.725);
    backdrop-filter: blur(1px);
    z-index: 200;
    cursor: pointer;
  }

  /* ── Shell ──────────────────────────────────────────────────── */
  .drawer {
    position: fixed;
    top: 0;
    right: 0;
    bottom: 0;
    z-index: 201;
    display: flex;
    flex-direction: row;
    background: #fff;;
    border-left: 4px solid #161616;
    overflow: hidden;
  }
  /* ── Footer ─────────────────────────────────────────────────── */
  .drawer-nav {
    display: flex;
    flex-direction: column;
    gap:0;
    align-items: start;
    justify-content: start;
    background-color: #e0e0e0;
  }
</style>