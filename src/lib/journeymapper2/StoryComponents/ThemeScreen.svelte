<script>
  import { buildScreenBackground } from '$lib/journeymapper2/storyConfig.js';

  let { themes = [], profile = {}, accent = 'var(--purple)', theme = null } = $props();

  let resolvedLabel = $derived(theme?.labelColor ?? accent);
  let bg = $derived(theme ? buildScreenBackground(theme) : 'rgba(255,255,255,0.85)');
</script>

<div class="screen" style="background: {bg};" role="article">
  <div class="screen-inner">

    <span class="screen-label" style="color: {resolvedLabel};">Themes</span>
    <h2 class="heading">What defines<br />{profile?.name}</h2>

    <div class="themes-list" role="list">
      {#each themes as t, i}
        <div
          class="theme-row"
          style="animation-delay: {i * 60}ms;"
          role="listitem"
        >
          <span
            class="theme-dot"
            aria-hidden="true"
            style="background: {t.color ?? resolvedLabel};"
          ></span>
          <span class="theme-label">{t.label ?? t}</span>
          {#if t.sentiment}
            <span class="theme-pill" style="border-color: {t.color ?? resolvedLabel}33; color: {t.color ?? resolvedLabel};">
              {t.sentiment}
            </span>
          {/if}
        </div>
      {/each}
    </div>

  </div>
</div>

<style>
  .screen {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    padding-bottom: 8px;
    transition: background 400ms ease;
  }

  .screen-inner {
    display: flex;
    flex-direction: column;
    justify-content: space-evenly;
    gap: 14px;
    padding: 20px 22px 10px;
  }

  .screen-label {
    font-family: var(--font-mono, monospace);
    font-size: 0.65em;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.1em;
  }

  .screen-title {
    font-family: var(--font-serif, Georgia, serif);
    font-size: clamp(1.3rem, 4.5vw, 1.7rem);
    font-weight: 600;
    line-height: 1.25;
    color: rgba(255,255,255,0.97);
    letter-spacing: -0.02em;
    margin: 0;
  }

  .themes-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .theme-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 9px 12px;
    border-radius: 10px;
    background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.07);
    animation: fadeUp 300ms ease both;
  }

  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(6px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  .theme-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .theme-label {
    flex: 1;
    font-size: 0.8em;
    color: rgba(255,255,255,0.82);
    font-weight: 500;
  }

  .theme-pill {
    font-family: var(--font-mono, monospace);
    font-size: 0.6em;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    padding: 2px 8px;
    border-radius: 20px;
    border: 1px solid;
    background: rgba(255,255,255,0.03);
  }
</style>