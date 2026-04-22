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
  <div class="sceen-innerr">

    <div class="flex flex-col">
    {#if kicker}
      <span class="label-sm" 
      style="color: {resolvedLabel}; border-color: {resolvedLabel}20;">
        {kicker}
      </span>
    {/if}

    {#if meta}
      <span class="screen-meta">{meta}</span>
    {/if}

    {#if title}
      <h2 class="heading-md">{title}</h2>
    {/if}
  </div>

    {#if content}
      <div class="screen-content" 
      style="border-color: {resolvedLabel}30;">
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
    padding: 0 0 8px;
    transition: background 400ms ease;
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