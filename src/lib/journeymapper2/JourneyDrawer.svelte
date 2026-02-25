<script>
  import { fly, fade } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import { createEventDispatcher } from 'svelte';

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
    <!-- Header -->
     
    <div class="header">
    
      <div class="header-meta">
        {#if title}
          <span class="h2 heading">{title}</span>
        {/if}
        {#if eyebrow}
          <span class="label-uppercase">{eyebrow}</span>
        {/if}
        <!-- Named slot so callers can fully replace the header text region -->
        <slot name="header-meta" />
      </div>

      <div class="header-actions">
        <!-- Optional header-level actions (e.g. nav arrows) -->
        <slot name="header-actions" />

        <button class="close-btn" on:click={close} aria-label="Close panel">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M2 2L14 14M14 2L2 14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
        </button>
      </div>

    <!-- Footer -->
  </div>
  {#if $$slots.footer}
  <div class="drawer-nav">
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
    flex-direction: column;
    background: #FAF9F5;
    border-left: 5px solid #23ABAB;
    overflow: hidden;
  }

  .header-meta {
    display: flex;
    flex-direction: column;
    gap: 3px;
    flex: 1;
    min-width: 0;
  }
  /* ── Footer ─────────────────────────────────────────────────── */
  .drawer-nav {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 20px;
    border-top: 1px solid #DFC3A8;
    background: #EDE5D8;
    flex-shrink: 0;
  }
</style>