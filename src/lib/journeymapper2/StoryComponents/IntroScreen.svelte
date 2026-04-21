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
      <span class="intro-role" style="color: {resolvedLabel};">
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
            style="animation-delay: {i * 60}ms;"
            role="listitem"
          >
            <div class="state-header">
              <span class="label-sm text-slate-100">{s.label}</span>
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
                class="state-fill bg-slate-400"
                style="width: {s.value * 100}%;"
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
  }

  .screen-photo-fallback {
    position: absolute;
    inset: 0;
  }

  /* ── Scrim ──────────────────────────────────────────────────────────── */
  /* Two-stop scrim: transparent at top, heavy at bottom for legibility */
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
    position: relative; /* above scrim */
    display: flex;
    flex-direction: column;
    gap: 18px;
    padding: 20px 22px 10px;
  }

  /* ── Identity block ─────────────────────────────────────────────────── */
  .intro-identity {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .intro-role {
    font-family: var(--font-mono, monospace);
    font-size: 0.65em;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.1em;
  }

  .intro-name {
    font-family: var(--font-serif, Georgia, serif);
    font-size: clamp(1.5rem, 5.5vw, 2rem);
    font-weight: 600;
    line-height: 1.15;
    color: rgba(255, 255, 255, 0.97);
    letter-spacing: -0.02em;
    margin: 0;
  }

  .intro-indication {
    font-family: var(--font-mono, monospace);
    font-size: 0.68em;
    font-weight: 500;
    letter-spacing: 0.04em;
    color: rgba(255, 255, 255, 0.50);
    margin: 0;
  }

  /* ── State bars ─────────────────────────────────────────────────────── */
  .states-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .state-row {
    display: flex;
    flex-direction: column;
    gap: 5px;
    animation: fadeUp 320ms ease both;
  }

  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(6px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  .state-header {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
  }


  .state-value {
    font-family: var(--font-mono, monospace);
    font-size: 0.72em;
    font-weight: 700;
    letter-spacing: 0.04em;
  }

  .state-track {
    height: 3px;
    background: rgba(255, 255, 255, 0.12);
    border-radius: 4px;
    overflow: hidden;
  }

  .state-fill {
    height: 100%;
    border-radius: 4px;
    transition: width 600ms cubic-bezier(0.34, 1.56, 0.64, 1);
  }
</style>