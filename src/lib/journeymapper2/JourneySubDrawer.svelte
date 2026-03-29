<script>
  import { fly, fade } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import XRegular from 'phosphor-icons-svelte/IconXRegular.svelte';

  let {
    open = $bindable(false),
    eyebrow = '',
    title = '',
    width = 550,
    onclose = undefined,
    children,
    footer = undefined,
  } = $props();

  function close() {
    open = false;
    onclose?.();
  }

  function onKeydown(e) {
    if (e.key === 'Escape') close();
  }
</script>

<svelte:window onkeydown={onKeydown} />

{#if open}
  <!-- Scrim sits between primary drawer (z-201) and this panel -->
  <div
    class="sub-scrim"
    transition:fade={{ duration: 180 }}
    onclick={close}
    aria-hidden="true"
  ></div>

  <aside
    class="sub-drawer"
    style="width: 65vw;"
    transition:fly={{ x: width, duration: 300, easing: cubicOut }}
    role="complementary"
    aria-label={title || 'Detail panel'}
  >
    <!-- Header -->
    <div class="toolbar pl-2">
      <div class="flex flex-col">
        {#if eyebrow}
          {#if title}
            <span class="label-sm">{title}</span>
          {/if}
          <span class="label uppercase">{eyebrow}</span>
        {/if}
      </div>
      <button class="btn-sm" onclick={close} aria-label="Close panel">
        <XRegular />
      </button>
    </div>

    <!-- Scrollable body -->
    <div class="sub-body">
      {@render children?.()}
    </div>

    <!-- Optional footer -->
    {#if footer}
      <div class="sub-footer">
        {@render footer()}
      </div>
    {/if}
  </aside>
{/if}

<style>
  .sub-scrim {
    position: fixed;
    inset: 0;
    background: rgba(30, 20, 10, 0.825);
    z-index: 9998;
    cursor: pointer;
  }

  .sub-drawer {
    position: fixed;
    top: 0;
    right: 0;
    bottom: 0;
    z-index: 9999;
    display: flex;
    flex-direction: column;
    background: var(--paper);
    border-left: 2.5px solid var(--panel-dark);
    box-shadow:
      -4px 0 24px rgba(90, 62, 40, 0.10),
      0px 0px 0px 1px rgba(0, 0, 0, 0.10);
    overflow: hidden;
  }

  .sub-body {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
  }
</style>
