<script>
  import { fly, fade } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import { createEventDispatcher } from 'svelte';
  import XRegular from 'phosphor-icons-svelte/IconXRegular.svelte';
  import ArrowLeftRegular from 'phosphor-icons-svelte/IconArrowLeftRegular.svelte';

  const dispatch = createEventDispatcher();

  /** Controls visibility */
  export let open = false;

  /** Short uppercase kicker above the title */
  export let eyebrow = '';

  /** Main title shown in the header */
  export let title = '';

  /** Pixel width of this sub-drawer */
  export let width = 380;

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
  <!-- Scrim sits between primary drawer (z-201) and this panel (z-202) -->
  <div
    class="sub-scrim"
    transition:fade={{ duration: 180 }}
    on:click={close}
    aria-hidden="true"
  />

  <aside
    class="sub-drawer"
    style="width: {width}px;"
    transition:fly={{ x: width, duration: 300, easing: cubicOut }}
    role="complementary"
    aria-label={title || 'Detail panel'}
  >
    <!-- Header -->
    <div class="sub-header">
      <button class="btn-base back-btn" on:click={close} aria-label="Close panel">
        <ArrowLeftRegular />
      </button>
      <div class="sub-header-text">
        {#if eyebrow}
          <span class="jm-kicker">{eyebrow}</span>
        {/if}
        {#if title}
          <span class="label-bold">{title}</span>
        {/if}
      </div>
      <button class="btn-base" on:click={close} aria-label="Close panel">
        <XRegular />
      </button>
    </div>

    <!-- Scrollable body -->
    <div class="sub-body">
      <slot />
    </div>

    <!-- Optional footer -->
    {#if $$slots.footer}
      <div class="sub-footer">
        <slot name="footer" />
      </div>
    {/if}
  </aside>
{/if}

<style>
  /* ── Scrim ───────────────────────────────────────────────────── */
  .sub-scrim {
    position: fixed;
    inset: 0;
    background: rgba(30, 20, 10, 0.22);
    z-index: 202;
    cursor: pointer;
  }

  /* ── Shell ───────────────────────────────────────────────────── */
  .sub-drawer {
    position: fixed;
    top: 0;
    right: 0;
    bottom: 0;
    z-index: 203;
    display: flex;
    flex-direction: column;
    background: #FAF8F4;
    border-left: 0.5px solid #DFC3A8;
    box-shadow:
      -4px 0 24px rgba(90, 62, 40, 0.10),
      0px 0px 0px 1px rgba(0, 0, 0, 0.06);
    overflow: hidden;
  }

  /* ── Header ──────────────────────────────────────────────────── */
  .sub-header {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 8px;
    padding: 10px 12px;
    background: #F0E8DC;
    border-bottom: 0.5px solid #DFC3A8;
    flex-shrink: 0;
  }

  .sub-header-text {
    display: flex;
    flex-direction: column;
    gap: 1px;
    flex: 1;
    min-width: 0;
  }

  .back-btn {
    flex-shrink: 0;
  }

  /* ── Body ────────────────────────────────────────────────────── */
  .sub-body {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
  }

  /* ── Footer ──────────────────────────────────────────────────── */
  .sub-footer {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 14px;
    border-top: 0.5px solid #DFC3A8;
    background: #F0E8DC;
    flex-shrink: 0;
    font-size: 10px;
    color: #A08060;
  }
</style>