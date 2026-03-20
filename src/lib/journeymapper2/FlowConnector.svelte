<script>
  import ArrowRightRegular from 'phosphor-icons-svelte/IconArrowRightRegular.svelte';

  /**
   * 'step'  — lightweight connector between steps within a stage
   * 'stage' — heavier connector between stage groups
   */
  export let variant = 'step'; // 'step' | 'stage'
</script>

{#if variant === 'stage'}
  <span class="flow-stage-connector" aria-hidden="true">
    <ArrowRightRegular />
  </span>
{:else}
  <span class="flow-connector" aria-hidden="true">
    <ArrowRightRegular />
  </span>
{/if}

<style>
  .flow-connector {
    display: flex;
    align-items: center;
    justify-content: center;
    color: #b0b8c8;
    padding: 0 0.2em;
    flex-shrink: 0;
  }

  .flow-stage-connector {
    display: flex;
    align-items: center;
    justify-content: center;
    color: #8090a8;
    padding: 0 0.35rem;
    /* vertically centers with the stage header row (header h ≈ 36px + gaps) */
    margin-top: calc(36px + 0.5rem + 0.5rem);
    flex-shrink: 0;
  }
</style>