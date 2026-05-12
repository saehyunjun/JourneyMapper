<script lang="ts">
  import AppSidebar from '$lib/pageElements/Appsidebar.svelte';

  let { children } = $props();
  let sidebarOpen = $state(true);
</script>

<div class="app-shell">
  <div class="app-body">
    <AppSidebar bind:open={sidebarOpen} />

    <main class="app-main">
      {@render children?.()}
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