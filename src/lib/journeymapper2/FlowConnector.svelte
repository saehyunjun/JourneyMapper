<script>
  export let variant = 'step'; // 'step' | 'stage' | 'stage-vertical'
  export let layout  = 'horizontal'; // 'horizontal' | 'vertical'

  $: isVertical = layout === 'vertical';
</script>

{#if variant === 'stage'}
  <span class="flow-stage-connector arrow-line horizontal" aria-hidden="true"></span>

{:else if variant === 'stage-vertical'}
  <span class="flow-stage-connector--vertical arrow-line vertical" aria-hidden="true"></span>

{:else}
  <!-- step connector — direction follows layout -->
  <span
    class="flow-connector arrow-line"
    class:horizontal={!isVertical}
    class:vertical={isVertical}
    aria-hidden="true"
  ></span>
{/if}

<style>
  /* Base */
  .flow-connector,
  .flow-stage-connector,
  .flow-stage-connector--vertical {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    margin: 1.25em;
  }

  .flow-connector {
    color: var(--ink-muted, #8090a8);
  }
  .flow-connector.horizontal {
    padding: 0 0.12em;
    width: 24px;
    height: 2px;
  }
  .flow-connector.vertical {
    padding: 0.12em 0;
    width: 2px;
    height: 28px;
  }

  .flow-stage-connector {
    color: #8090a8;
    padding: 0 0.35rem;
    margin-top: calc(64px + 0.5rem + 0.5rem);
    width: 64px;
    height: 2px;
  }

  .flow-stage-connector--vertical {
    color: #8090a8;
    padding: 0.2rem 0;
    width: 2px;
    height: 100%;
    min-height: 24px;
    align-self: stretch;
  }

  /* ── Dashed line ───────────────────────────────────── */

  .arrow-line.horizontal::before {
    content: '';
    position: absolute;
    left: 0;
    right: 6px; /* leave space for arrowhead */
    top: 50%;
    height: 2px;
    transform: translateY(-50%);
    background-image: repeating-linear-gradient(
      to right,
      currentColor,
      currentColor 4px,
      transparent 4px,
      transparent 8px
    );
  }

  .arrow-line.vertical::before {
    content: '';
    position: absolute;
    top: 0;
    bottom: 6px; /* leave space for arrowhead */
    left: 50%;
    width: 2px;
    transform: translateX(-50%);
    background-image: repeating-linear-gradient(
      to bottom,
      currentColor,
      currentColor 4px,
      transparent 4px,
      transparent 8px
    );
  }

  /* ── Arrowhead ─────────────────────────────────────── */

  .arrow-line.horizontal::after {
    content: '';
    position: absolute;
    right: 0;
    top: 50%;
    transform: translateY(-50%);
    border-top: 5px solid transparent;
    border-bottom: 5px solid transparent;
    border-left: 6px solid currentColor;
  }

  .arrow-line.vertical::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: 50%;
    transform: translateX(-50%);
    border-left: 5px solid transparent;
    border-right: 5px solid transparent;
    border-top: 6px solid currentColor;
  }
</style>