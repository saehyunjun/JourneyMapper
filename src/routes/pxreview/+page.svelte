<script lang="ts">
  import AppSidebar from '$lib/pageElements/Appsidebar.svelte';
  import IconListRegular from 'phosphor-icons-svelte/IconListRegular.svelte';
  import IconFlowArrowRegular from 'phosphor-icons-svelte/IconFlowArrowRegular.svelte';

  // Default open on wide screens; AppSidebar reads this to decide its mode
  let sidebarOpen = $state(true);

  function toggleSidebar() {
    sidebarOpen = !sidebarOpen;
  }
</script>

<!-- ── Root shell ────────────────────────────────────────────────────────── -->
<div class="app-shell">

  <!-- ── Body row: sidebar + main ─────────────────────────────────────── -->
  <div class="app-body">

    <!-- Sidebar: inline on wide, overlay on narrow -->
    <AppSidebar bind:open={sidebarOpen} />
    <button
    class="btn-sm"
    onclick={toggleSidebar}
    aria-label={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
    aria-expanded={sidebarOpen}
  >
    <IconListRegular class="text-sm"/>
  </button>

    <!-- Main content grows to fill remaining space -->
    <main class="app-main">
      <slot />
    </main>

  </div>

</div>

<style>
  .app-shell {
    display: flex;
    flex-direction: column;
    height: 100dvh;
    width: 100%;
    overflow: hidden;
    background-color: var(--paper);
  }

  .app-topbar {
    flex-shrink: 0;
    z-index: 200;
  }

  /* Horizontal flex row that contains sidebar + main */
  .app-body {
    display: flex;
    flex-direction: row;
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }

  .app-main {
    flex: 1;
    min-width: 0;
    min-height: 0;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }
</style>