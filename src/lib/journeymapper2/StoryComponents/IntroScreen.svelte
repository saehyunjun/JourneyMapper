<script>
  import { buildScreenBackground } from '$lib/journeymapper2/storyConfig.js';

  let {
    profile = {},
    states  = [],
    accent  = 'var(--purple)',
    theme   = null,
  } = $props();

  let resolvedLabel = $derived(theme?.labelColor ?? accent);

  // Only used as a CSS fallback if there is no photo
  let bg = $derived(theme ? buildScreenBackground(theme) : 'rgba(0,0,0,0.85)');

  let imgError = $state(false);
</script>

<div class="screen" role="article">

  <!-- ── Full-bleed photo background ──────────────────────────────────── -->
  {#if !imgError && profile?.imageFile}
    <img
      src="/assets/profiles/{profile.imageFile}"
      alt=""
      class="screen-photo"
      aria-hidden="true"
      onerror={() => (imgError = true)}
    />
  {:else}
    <!-- Fallback gradient when no photo is available -->
    <div class="screen-photo-fallback" style="background: {bg};"></div>
  {/if}

  <!-- Dark scrim so text and bars are always legible -->
  <div class="screen-scrim"></div>

  <!-- ── Content pinned to the bottom ─────────────────────────────────── -->
  <div class="screen-inner">

    <!-- Identity -->
    <div class="intro-identity">
      <span
        class="intro-kicker"
        style="--kicker-color: {resolvedLabel}; --kicker-border: {resolvedLabel}40;"
      >
        {profile?.role ?? 'Patient'}
      </span>

      <h2 class="intro-name">{profile?.name ?? ''}</h2>

      {#if profile?.indication}
        <p class="intro-indication">{profile.indication}</p>
      {/if}
    </div>

    <!-- Current-state bars -->
    {#if states?.length}
      <div class="states-list" role="list" aria-label="Current state indicators">
        {#each states as s, i}
          <div
            class="state-row"
            style="animation-delay: {360 + i * 70}ms;"
            role="listitem"
          >
            <div class="state-header">
              <span class="state-label">{s.label}</span>
            </div>
            <div
              class="state-track"
              role="progressbar"
              aria-valuenow={Math.round(s.value * 100)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={s.label}
            >
              <div
                class="state-fill"
                style="width: {s.value * 100}%; background: {resolvedLabel};"
              ></div>
            </div>
          </div>
        {/each}
      </div>
    {/if}

  </div>
</div>

<style>
  /* ── Shell ──────────────────────────────────────────────────────────── */
  .screen {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    overflow: hidden;
  }

  /* ── Photo ──────────────────────────────────────────────────────────── */
  .screen-photo {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: center top;
    display: block;
    animation: photoFadeIn 600ms cubic-bezier(0.22, 1, 0.36, 1) both;
  }

  .screen-photo-fallback {
    position: absolute;
    inset: 0;
  }

  /* ── Scrim ──────────────────────────────────────────────────────────── */
  .screen-scrim {
    position: absolute;
    inset: 0;
    background: linear-gradient(
      to bottom,
      rgba(0, 0, 0, 0.10) 0%,
      rgba(0, 0, 0, 0.30) 35%,
      rgba(0, 0, 0, 0.82) 68%,
      rgba(0, 0, 0, 0.94) 100%
    );
  }

  /* ── Content ────────────────────────────────────────────────────────── */
  .screen-inner {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 22px;
    padding: 24px 24px 12px;
  }

  /* ── Identity block ─────────────────────────────────────────────────── */
  .intro-identity {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  /* Pill kicker — matches BaseScreen / ThemeScreen treatment */
  .intro-kicker {
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

    animation: storyFadeUp 380ms 80ms cubic-bezier(0.22, 1, 0.36, 1) both;
  }

  .intro-name {
    font-family: var(--font-heading-serif, 'Spectral', Georgia, serif);
    font-style: italic;
    font-size: clamp(1.7rem, 6vw, 2.2rem);
    font-weight: 500;
    line-height: 1.1;
    color: rgba(255, 255, 255, 0.98);
    letter-spacing: -0.015em;
    margin: 0;
    animation: storyFadeUp 460ms 180ms cubic-bezier(0.22, 1, 0.36, 1) both;
  }

  .intro-indication {
    font-family: var(--font-mono, monospace);
    font-size: 0.68em;
    font-weight: 500;
    letter-spacing: 0.04em;
    color: rgba(255, 255, 255, 0.55);
    margin: 0;
    animation: storyFadeUp 380ms 280ms cubic-bezier(0.22, 1, 0.36, 1) both;
  }

  /* ── State bars ─────────────────────────────────────────────────────── */
  .states-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .state-row {
    display: flex;
    flex-direction: column;
    gap: 6px;
    animation: storyFadeUp 380ms cubic-bezier(0.22, 1, 0.36, 1) both;
  }

  .state-header {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
  }

  .state-label {
    font-family: var(--font-mono, monospace);
    font-size: 0.65em;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: rgba(255, 255, 255, 0.78);
  }

  .state-track {
    height: 3px;
    background: rgba(255, 255, 255, 0.14);
    border-radius: 4px;
    overflow: hidden;
  }

  .state-fill {
    height: 100%;
    border-radius: 4px;
    transform-origin: left center;
    animation: stateFill 700ms 360ms cubic-bezier(0.22, 1, 0.36, 1) both;
  }

  /* ── Entrance animations ────────────────────────────────────────────── */
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

  @keyframes photoFadeIn {
    from { opacity: 0; transform: scale(1.04); }
    to   { opacity: 1; transform: scale(1); }
  }

  @keyframes stateFill {
    from { transform: scaleX(0); }
    to   { transform: scaleX(1); }
  }
</style>