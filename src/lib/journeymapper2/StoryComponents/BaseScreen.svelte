<script>
  import { buildScreenBackground } from '$lib/journeymapper2/storyConfig.js';

  let {
    title    = '',
    kicker   = '',
    content  = '',
    meta     = null,
    accent   = 'var(--purple)',
    theme    = null,
    children,
  } = $props();

  let resolvedLabel = $derived(theme?.labelColor ?? accent);
  let bg = $derived(theme ? buildScreenBackground(theme) : 'rgba(0,0,0,0.85)');
</script>

<div class="screen" style="background: {bg};" role="article">
  <div class="screen-inner">

    {#if kicker}
      <span class="screen-kicker" style="color: {resolvedLabel}; border-color: {resolvedLabel}20;">
        {kicker}
      </span>
    {/if}

    {#if meta}
      <span class="screen-meta">{meta}</span>
    {/if}

    {#if title}
      <h2 class="screen-title">{title}</h2>
    {/if}

    {#if content}
      <div class="screen-content" style="border-color: {resolvedLabel}30;">
        <p class="text-body">{@html content}</p>
      </div>
    {/if}

    {@render children?.()}
  </div>
</div>

<style>
  .screen {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    padding: 0 0 8px;
    transition: background 400ms ease;
  }

  .screen-inner {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 20px 22px 10px;
  }

  .screen-kicker {
    display: inline-flex;
    width: fit-content;
    font-family: var(--font-mono, monospace);
    font-size: 0.65em;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    padding: 3px 10px;
    border-radius: 20px;
    border: 1px solid;
    background: rgba(255,255,255,0.04);
  }

  .screen-meta {
    font-family: var(--font-mono, monospace);
    font-size: 0.65em;
    font-weight: 500;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: rgba(255,255,255,0.45);
  }

  .screen-title {
    font-family: var(--font-serif, Georgia, serif);
    font-size: clamp(1.4rem, 5vw, 1.9rem);
    font-weight: 600;
    line-height: 1.2;
    color: rgba(255,255,255,0.97);
    letter-spacing: -0.02em;
    margin: 0;
  }

  .screen-content {
    border-left: 2px solid;
    padding-left: 14px;
    margin-top: 2px;
  }

  :global(.screen-content .text-body) {
    font-size: 0.82em;
    line-height: 1.65;
    color: rgba(255,255,255,0.72);
    margin: 0;
  }
</style>