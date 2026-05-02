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

    <!-- ── Header block: kicker + meta + title ─────────────────────── -->
    <div class="screen-head">
      {#if kicker}
        <span
          class="screen-kicker"
          style="--kicker-color: {resolvedLabel}; --kicker-border: {resolvedLabel}40;"
        >
          {kicker}
        </span>
      {/if}

      {#if meta}
        <span class="screen-meta">{meta}</span>
      {/if}

      {#if title}
        <h2 class="screen-title heading-serif-md">{title}</h2>
      {/if}
    </div>

    <!-- ── Body content ─────────────────────────────────────────────── -->
    {#if content}
      <div
        class="screen-content"
        style="border-color: {resolvedLabel}40;"
      >
        <p class="text-body">{@html content}</p>
      </div>
    {/if}

    {@render children?.()}
  </div>
</div>

<style>
  /* ── Shell — bottom-anchored editorial layout ─────────────────────── */
  .screen {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    padding: 0 0 12px;
    transition: background 400ms ease;
  }

  .screen-inner {
    display: flex;
    flex-direction: column;
    gap: 18px;
    padding: 20px 24px 12px;
  }

  /* ── Header block ─────────────────────────────────────────────────── */
  .screen-head {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  /* Pill-style kicker — matches reference card "STARTUP SPOTLIGHT" badge */
  .screen-kicker {
    display: inline-flex;
    align-self: flex-start;
    align-items: center;
    padding: 4px 10px;
    border: 1px solid var(--kicker-border, rgba(255,255,255,0.25));
    border-radius: 100em;

    font-family: var(--font-mono, monospace);
    font-size: 0.6em;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--kicker-color, rgba(255,255,255,0.85));

    animation: storyFadeUp 360ms 60ms cubic-bezier(0.22, 1, 0.36, 1) both;
  }

  .screen-meta {
    font-family: var(--font-mono, monospace);
    font-size: 0.65em;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: rgba(255, 255, 255, 0.55);
    animation: storyFadeUp 360ms 120ms cubic-bezier(0.22, 1, 0.36, 1) both;
  }

  /* Editorial serif title — overrides heading-serif-md color/size for dark surface */
  .screen-title {
    color: rgba(255, 255, 255, 0.97);
    font-style: italic;
    font-size: clamp(1.6rem, 5.5vw, 2.1rem);
    line-height: 1.1;
    letter-spacing: -0.01em;
    margin: 0;
    text-transform: none;
    animation: storyFadeUp 420ms 180ms cubic-bezier(0.22, 1, 0.36, 1) both;
  }

  /* ── Body content ─────────────────────────────────────────────────── */
  .screen-content {
    border-left: 2px solid;
    padding-left: 16px;
    margin-top: 4px;
    animation: storyFadeUp 420ms 280ms cubic-bezier(0.22, 1, 0.36, 1) both;
  }

  :global(.screen-content .text-body) {
    font-size: 0.86em;
    line-height: 1.65;
    color: rgba(255, 255, 255, 0.78);
    margin: 0;
  }

  /* ── Entrance animation ───────────────────────────────────────────── */
  @keyframes storyFadeUp {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
</style>