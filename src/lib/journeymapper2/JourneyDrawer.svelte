<script>
  import { fly, fade } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import X from "phosphor-icons-svelte/IconXRegular.svelte";

  let {
    open = $bindable(false),
    eyebrow = '',
    title = '',
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
  <!-- Backdrop -->
  <div
    class="backdrop"
    transition:fade={{ duration: 200 }}
    onclick={close}
    aria-hidden="true"
  ></div>

  <!-- Drawer shell -->
  <aside
    class="drawer w-7/12"
    transition:fly={{ x: 120, duration: 320, easing: cubicOut }}
    aria-label={title || 'Detail panel'}
  >
    {#if footer}
      <div class="toolbar-light">
        <button
          class="btn-sm bg-[#CC6324] text-white hover:bg-[#FF8341]"
          onclick={close}
          aria-label="Close panel"
        >
          <X />
        </button>
        {@render footer()}
      </div>
    {/if}

    <!-- Scrollable body -->
    <div class="drawer-body">
      {@render children?.()}
    </div>
  </aside>
{/if}
