<script>
  export let personaProfile = {};
  export let onOpenDetails = () => {};

  let flipped = false;
  let imgError = false;

  function flip() {
    flipped = !flipped;
  }

  function openDetails(e) {
    e.stopPropagation();
    onOpenDetails();
  }
</script>

<!-- svelte-ignore a11y-click-events-have-key-events -->
<!-- svelte-ignore a11y-no-static-element-interactions -->
<div
  class="card-scene"
  on:click={flip}
  title="Click to flip"
>
  <div class="card-body" class:is-flipped={flipped}>

    <!-- ── FRONT ─────────────────────────────────────────────────── -->
    <div class="card-face card-front" aria-hidden={flipped}>

      {#if !imgError}
        <img
          class="card-photo"
          src="/assets/profiles/{personaProfile.imageFile}"
          alt={personaProfile.name}
          on:error={() => (imgError = true)}
        />
      {:else}
        <div class="card-initials">
          {personaProfile.initials}
        </div>
      {/if}

      <!-- gradient + name -->
      <div class="card-gradient" />

      <div class="card-front-footer">
        <span class="card-name">{personaProfile.name}</span>
      </div>

      <div class="card-role-pill">
        <span class="pill-white">{personaProfile.role}</span>
      </div>

      <!-- flip hint -->
      <div class="flip-hint">
        <svg width="14" height="14" viewBox="0 0 256 256" fill="none" aria-hidden="true">
          <!-- Phosphor "ArrowsClockwise" regular -->
          <path
            d="M224,48V96a8,8,0,0,1-8,8H168a8,8,0,0,1,0-16h28.69L182.06,73.37a79.56,79.56,0,0,0-56.19-23.43C95.5,49.84,67.8,67.68,53.77,96a8,8,0,0,1-14.3-7.18C56.06,54.42,90.44,33.86,125.87,34a95.43,95.43,0,0,1,67.3,28.09L208,76.69V48a8,8,0,0,1,16,0ZM202.23,167.14A80.1,80.1,0,0,1,73.31,182.63L59.31,168.63H88a8,8,0,0,0,0-16H40a8,8,0,0,0-8,8v48a8,8,0,0,0,16,0V180.69l14.63,14.63a95.43,95.43,0,0,0,67.3,28.09c35.43.1,69.81-20.46,86.4-55.18a8,8,0,0,0-14.1-7.09Z"
            fill="currentColor"
          />
        </svg>
      </div>

    </div>

    <!-- ── BACK ──────────────────────────────────────────────────── -->
    <div class="card-face card-back" aria-hidden={!flipped}>

      <div class="card-back-inner">

        <div class="back-header">
          <span class="back-name">{personaProfile.name}</span>
          <span class="pill-dark">{personaProfile.role}</span>
        </div>

        <div class="back-metrics">
          <div class="metric-row">
            <span class="metric-label">Medical Understanding</span>
            <div class="metric-bar-track">
              <div class="metric-bar-fill" style="width: {(personaProfile.medicalUnderstanding / 10) * 100}%" />
            </div>
            <span class="metric-value">{personaProfile.medicalUnderstanding}</span>
          </div>
          <div class="metric-row">
            <span class="metric-label">Trust in Providers</span>
            <div class="metric-bar-track">
              <div class="metric-bar-fill" style="width: {(personaProfile.trust / 10) * 100}%" />
            </div>
            <span class="metric-value">{personaProfile.trust}</span>
          </div>
          <div class="metric-row">
            <span class="metric-label">Logistical Capacity</span>
            <div class="metric-bar-track">
              <div class="metric-bar-fill" style="width: {(personaProfile.logisticalCapacity / 10) * 100}%" />
            </div>
            <span class="metric-value">{personaProfile.logisticalCapacity}</span>
          </div>
        </div>

        <button class="open-btn" on:click={openDetails}>
          More about {personaProfile.name}
        </button>

      </div>

    </div>

  </div>
</div>


<style>
  /* ── Scene: holds the perspective so preserve-3d works correctly ──── */
  .card-scene {
    width: 30vw;
    height: 500px;
    max-width: 325px;
    perspective: 1000px;
    cursor: pointer;
    flex-shrink: 0;
  }

  /* ── Outer lift on hover — isolated from the flip ────────────────── */
  .card-scene:hover .card-body {
    /* only lift when NOT mid-flip */
    transform: translateY(-5px);
    box-shadow: 0 30px 60px -12px rgba(50, 50, 93, 0.25), 0 18px 36px -18px rgba(0, 0, 0, 0.3);
  }

  .card-scene:hover .card-body.is-flipped {
    transform: rotateY(180deg) translateY(-10px);
  }

  /* ── Card body: the thing that actually rotates ───────────────────── */
  .card-body {
    position: relative;
    width: 100%;
    height: 100%;
    border-radius: 16px;

    transform-style: preserve-3d;
    transition:
      transform 0.55s cubic-bezier(0.45, 0.05, 0.55, 0.95),
      box-shadow 0.25s ease;

    box-shadow: 0 30px 60px -12px rgba(50, 50, 93, 0.25), 0 18px 36px -18px rgba(0, 0, 0, 0.3);
    will-change: transform;
  }

  .card-body.is-flipped {
    transform: rotateY(180deg);
  }

  /* ── Shared face styles ───────────────────────────────────────────── */
  .card-face {
    position: absolute;
    inset: 0;
    border-radius: 16px;
    overflow: hidden;
    backface-visibility: hidden;
    -webkit-backface-visibility: hidden;
  }

  /* ── FRONT ────────────────────────────────────────────────────────── */
  .card-front {
    background: #1a1a1a;
  }

  .card-photo {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .card-initials {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: var(--font-heading);
    font-size: 36px;
    background: var(--card, #2a2a2a);
    color: #fff;
  }

  /* Gradient overlay for legibility */
  .card-gradient {
    position: absolute;
    inset: 0;
    background: linear-gradient(
      to top,
      rgba(0, 0, 0, 0.68) 0%,
      rgba(0, 0, 0, 0.20) 40%,
      rgba(0, 0, 0, 0.10) 65%,
      rgba(20, 20, 20, 0.30) 100%
    );
    pointer-events: none;
  }

  .card-front-footer {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    padding: 16px 18px;
  }

  .card-name {
    font-family: var(--font-heading);
    font-size: 1.6rem;
    font-weight: 500;
    letter-spacing: 0.03em;
    color: #fff;
    line-height: 1.1;
    display: block;
  }

  .card-role-pill {
    position: absolute;
    top: 12px;
    right: 12px;
    z-index: 2;
  }

  /* Flip hint icon — fades out once flipped (via parent class) */
  .flip-hint {
    position: absolute;
    bottom: 14px;
    right: 14px;
    color: rgba(255, 255, 255, 0.55);
    transition: opacity 0.2s;
    pointer-events: none;
  }

  .card-body.is-flipped .flip-hint {
    opacity: 0;
  }

  /* ── BACK ─────────────────────────────────────────────────────────── */
  .card-back {
    background: var(--panel, #f4efe5);
    transform: rotateY(180deg);
    display: flex;
    align-items: stretch;
  }

  .card-back-inner {
    display: flex;
    flex-direction: column;
    gap: 14px;
    padding: 20px 18px 18px;
    width: 100%;
  }

  .back-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 8px;
  }

  .back-name {
    font-family: var(--font-heading);
    font-size: 1.05rem;
    font-weight: 600;
    color: var(--text, #1a1a1a);
    line-height: 1.2;
  }

  /* ── Metric rows ──────────────────────────────────────────────────── */
  .back-metrics {
    display: flex;
    flex-direction: column;
    gap: 10px;
    flex: 1;
  }

  .metric-row {
    display: grid;
    grid-template-columns: 1fr auto auto;
    align-items: center;
    gap: 8px;
  }

  .metric-label {
    font-family: var(--font-mono, 'IBM Plex Mono', monospace);
    font-size: 0.6rem;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    color: var(--text-muted, #6b6050);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .metric-bar-track {
    width: 52px;
    height: 4px;
    border-radius: 2px;
    background: rgba(0, 0, 0, 0.1);
    overflow: hidden;
    flex-shrink: 0;
  }

  .metric-bar-fill {
    height: 100%;
    border-radius: 2px;
    background: #c4956a;
    transition: width 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .metric-value {
    font-family: var(--font-mono, 'IBM Plex Mono', monospace);
    font-size: 0.65rem;
    font-weight: 600;
    color: var(--text, #1a1a1a);
    width: 14px;
    text-align: right;
    flex-shrink: 0;
  }

  /* ── Pills ────────────────────────────────────────────────────────── */
  :global(.pill-white) {
    display: inline-flex;
    align-items: center;
    padding: 3px 8px;
    border-radius: 100px;
    background: rgba(255, 255, 255, 0.22);
    backdrop-filter: blur(6px);
    -webkit-backdrop-filter: blur(6px);
    font-family: var(--font-mono, 'IBM Plex Mono', monospace);
    font-size: 0.6rem;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: #fff;
    border: 1px solid rgba(255, 255, 255, 0.3);
  }

  .pill-dark {
    display: inline-flex;
    align-items: center;
    padding: 3px 8px;
    border-radius: 100px;
    background: rgba(0, 0, 0, 0.08);
    font-family: var(--font-mono, 'IBM Plex Mono', monospace);
    font-size: 0.6rem;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--text-muted, #6b6050);
    white-space: nowrap;
  }
</style>