<script>
  import { buildScreenBackground } from '$lib/journeymapper2/storyConfig.js';
  import QuotesIcon from 'phosphor-icons-svelte/IconQuotesDuotone.svelte';

  let { profile = {}, accent = 'var(--purple)', theme = null } = $props();

  let resolvedLabel = $derived(theme?.labelColor ?? accent);
  let bg = $derived(theme ? buildScreenBackground(theme) : 'rgba(255,255,255,0.85)');
</script>

<div class="screen" style="background: {bg};" role="article">
  <div class="screen-inner">

    <!-- Decorative quote glyph -->
    <div class="quote-icon" style="color: {resolvedLabel};" aria-hidden="true">
      <QuotesIcon size={36} weight="duotone" />
    </div>

    <!-- Pull quote — large editorial serif -->
    <p class="quote-body pull-quote-lg">
      {profile?.quote ?? 'No quote available.'}
    </p>

    <!-- Attribution -->
    <div class="quote-attribution" style="--rule-color: {resolvedLabel}30;">
      <span class="quote-name">{profile?.name}</span>
      {#if profile?.role}
        <span class="quote-role">{profile.role}</span>
      {/if}
    </div>

  </div>
</div>

<style>
  /* ── Shell — centered layout ─────────────────────────────────────── */
  .screen {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    transition: background 400ms ease;
  }

  .screen-inner {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 18px;
    padding: 32px 28px;
    max-width: 360px;
  }

  /* ── Quote icon ──────────────────────────────────────────────────── */
  .quote-icon {
    opacity: 0.55;
    animation: storyFadeUp 360ms 60ms cubic-bezier(0.22, 1, 0.36, 1) both;
  }

  /* ── Pull quote body ─────────────────────────────────────────────── */
  .quote-body {
    color: rgba(255, 255, 255, 0.96);
    font-style: italic;
    line-height: 1.25;
    margin: 0;
    text-indent: 0;
    animation: storyFadeUp 480ms 180ms cubic-bezier(0.22, 1, 0.36, 1) both;
  }

  /* ── Attribution ─────────────────────────────────────────────────── */
  .quote-attribution {
    margin-top: 4px;
    padding-top: 14px;
    border-top: 1px solid var(--rule-color, rgba(255,255,255,0.18));
    width: 60%;

    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;

    animation: storyFadeUp 420ms 320ms cubic-bezier(0.22, 1, 0.36, 1) both;
  }

  .quote-name {
    font-family: var(--font-mono, monospace);
    font-size: 0.65em;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: rgba(255, 255, 255, 0.7);
  }

  .quote-role {
    font-family: var(--font-mono, monospace);
    font-size: 0.58em;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: rgba(255, 255, 255, 0.4);
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