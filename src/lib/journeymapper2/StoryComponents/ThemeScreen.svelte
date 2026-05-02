<script>
  import { buildScreenBackground } from '$lib/journeymapper2/storyConfig.js';

  let { themes = [], profile = {}, accent = 'var(--purple)', theme = null } = $props();

  let resolvedLabel = $derived(theme?.labelColor ?? accent);
  let bg = $derived(theme ? buildScreenBackground(theme) : 'rgba(255,255,255,0.85)');
</script>

<div class="screen" style="background: {bg};" role="article">
  <div class="screen-inner">

    <!-- ── Header block ─────────────────────────────────────────────── -->
    <div class="screen-head">
      <span
        class="screen-kicker"
        style="--kicker-color: {resolvedLabel}; --kicker-border: {resolvedLabel}40;"
      >
        Themes
      </span>

      <h2 class="screen-title heading-serif-md">
        What defines<br />{profile?.name}
      </h2>
    </div>

    <!-- ── Themes list ──────────────────────────────────────────────── -->
    <div class="themes-list" role="list">
      {#each themes as t, i}
        <div
          class="theme-row"
          style="animation-delay: {280 + i * 70}ms;"
          role="listitem"
        >
          <span
            class="theme-dot"
            aria-hidden="true"
            style="background: {t.color ?? resolvedLabel};"
          ></span>
          <span class="theme-label">{t.label ?? t}</span>
          {#if t.sentiment}
            <span
              class="theme-pill"
              style="border-color: {t.color ?? resolvedLabel}33; color: {t.color ?? resolvedLabel};"
            >
              {t.sentiment}
            </span>
          {/if}
        </div>
      {/each}
    </div>

  </div>
</div>

<style>
  /* ── Shell — bottom-anchored ─────────────────────────────────────── */
  .screen {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    padding-bottom: 12px;
    transition: background 400ms ease;
  }

  .screen-inner {
    display: flex;
    flex-direction: column;
    gap: 18px;
    padding: 20px 24px 12px;
  }

  /* ── Header (matches BaseScreen treatment) ───────────────────────── */
  .screen-head {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

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

  /* ── Themes list ─────────────────────────────────────────────────── */
  .themes-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: 4px;
  }

  .theme-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.08);
    animation: storyFadeUp 380ms cubic-bezier(0.22, 1, 0.36, 1) both;
  }

  .theme-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .theme-label {
    flex: 1;
    font-size: 0.82em;
    color: rgba(255, 255, 255, 0.85);
    font-weight: 500;
  }

  .theme-pill {
    font-family: var(--font-mono, monospace);
    font-size: 0.6em;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    padding: 3px 8px;
    border-radius: 20px;
    border: 1px solid;
    background: rgba(255, 255, 255, 0.03);
  }

  /* ── Entrance animation ──────────────────────────────────────────── */
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