<script>
  import { buildScreenBackground } from '$lib/journeymapper2/storyConfig.js';

  let { states = [], accent = 'var(--purple)', theme = null } = $props();

  let resolvedLabel = $derived(theme?.labelColor ?? accent);
  let bg = $derived(theme ? buildScreenBackground(theme) : 'rgba(0,0,0,0.85)');
</script>

<div class="screen" style="background: {bg};" role="article">
  <div class="screen-inner">

    <span class="screen-label" style="color: {resolvedLabel};">Right Now</span>
    <h2 class="screen-title">Current State</h2>

    <div class="states-list" role="list">
      {#each states as s, i}
        <div class="state-row" style="animation-delay: {i * 70}ms;" role="listitem">
          <div class="state-header">
            <span class="state-label">{s.label}</span>
            <span class="state-value" style="color: {s.color ?? resolvedLabel};">
              {Math.round(s.value * 100)}%
            </span>
          </div>
          <div class="state-track" role="progressbar" aria-valuenow={Math.round(s.value * 100)} aria-valuemin={0} aria-valuemax={100} aria-label={s.label}>
            <div
              class="state-fill"
              style="width:{s.value * 100}%; background: {s.color ?? resolvedLabel};"
            ></div>
          </div>
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

  .states-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .state-row {
    display: flex;
    flex-direction: column;
    gap: 6px;
    animation: fadeUp 320ms ease both;
  }

  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(8px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  .state-header {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
  }

  .state-label {
    font-size: 0.75em;
    font-weight: 500;
    color: rgba(255,255,255,0.65);
  }

  .state-value {
    font-family: var(--font-mono, monospace);
    font-size: 0.75em;
    font-weight: 700;
    letter-spacing: 0.04em;
  }

  .state-track {
    height: 4px;
    background: rgba(255,255,255,0.1);
    border-radius: 4px;
    overflow: hidden;
  }

  .state-fill {
    height: 100%;
    border-radius: 4px;
    transition: width 600ms cubic-bezier(0.34, 1.56, 0.64, 1);
  }
</style>