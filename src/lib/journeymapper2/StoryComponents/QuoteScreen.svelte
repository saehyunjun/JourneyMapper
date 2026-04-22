<script>
  import { buildScreenBackground } from '$lib/journeymapper2/storyConfig.js';
  import QuotesIcon from 'phosphor-icons-svelte/IconQuotesDuotone.svelte';

  let { profile = {}, accent = 'var(--purple)', theme = null } = $props();

  let resolvedLabel = $derived(theme?.labelColor ?? accent);
  let bg = $derived(theme ? buildScreenBackground(theme) : 'rgba(255,255,255,0.85)');
</script>

<div class="screen" style="background: {bg};" role="article">
  <div class="screen-inner">
    <QuotesIcon class="text-xl text-slate-50" />
    <p class="pull-quote ">
      {profile?.quote ?? 'No quote available.'}
    </p>

    <div class="quote-attribution">
      <span class="quote-name">{profile?.name}</span>
    </div>
  </div>
</div>

<style>
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
    gap: 12px;
    padding: 32px 28px;
    z-index: 1;
  }

  .screen-label {
    font-family: var(--font-mono, monospace);
    font-size: 0.65em;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.1em;
  }

  .quote-mark {
    font-family: var(--font-serif, Georgia, serif);
    font-size: 4rem;
    line-height: 0.7;
    opacity: 0.5;
    margin-bottom: -4px;
  }


  .quote-attribution {
    margin-top: 8px;
    padding-top: 12px;
    border-top: 1px solid rgba(255,255,255,0.12);
    width: 60%;
  }

  .quote-name {
    font-family: var(--font-mono, monospace);
    font-size: 0.65em;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: rgba(255,255,255,0.4);
  }
</style>