<script>
  import { RotateClockwise } from "carbon-icons-svelte";
  import UserBold          from 'phosphor-icons-svelte/IconUserBold.svelte';
  import BriefcaseRegular  from 'phosphor-icons-svelte/IconBriefcaseRegular.svelte';
  import CalendarRegular   from 'phosphor-icons-svelte/IconCalendarRegular.svelte';
  import HeartRegular      from 'phosphor-icons-svelte/IconHeartRegular.svelte';

  export let personaProfile = {};
  export let onOpenDetails = () => {};

function toggle(e) {
  if (e?.target?.closest?.('.open-btn')) return;
  flipped = !flipped;
}

  let flipped = false;
  let imgError = false;

  function flip() {
    flipped = !flipped;
  }

  function openDetails(e) {
    e.stopPropagation();
    onOpenDetails();
  }

  // ── Bio tooltip ───────────────────────────────────────────────────────────
  let hovered = false;
  let mouseX  = 0;
  let mouseY  = 0;

  const TIP_W    = 300;
  const OFFSET_X = 16;
  const OFFSET_Y = 12;

  function onMouseMove(e) { mouseX = e.clientX; mouseY = e.clientY; }

  $: vpW     = typeof window !== 'undefined' ? window.innerWidth  : 9999;
  $: flipLeft = mouseX + OFFSET_X + TIP_W > vpW - 12;
  $: tipX    = flipLeft ? mouseX - TIP_W - OFFSET_X : mouseX + OFFSET_X;
  $: tipY    = mouseY + OFFSET_Y;
</script>

<svelte:window on:mousemove={onMouseMove} />

<!-- svelte-ignore a11y-click-events-have-key-events -->
<!-- svelte-ignore a11y-no-static-element-interactions -->
<div
  class="card-scene"
  on:click={flip}
  on:mouseenter={() => (hovered = true)}
  on:mouseleave={() => (hovered = false)}
  title="Click to flip"
>
  <div class="card-body" class:is-flipped={flipped}>

    <!-- ── FRONT ─────────────────────────────────────────────────── -->
    <div class="card-face card-front" aria-hidden={flipped}>
      <div class="card-gradient">

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
    </div>
    
      

      <!-- gradient + name -->
      <div class="card-gradient">
      </div>
      <!-- flip hint -->
      <div class="biobar">
      <div class="bioname">
      <h3 class="text-sm text-white">{personaProfile.name}</h3>
    </div>
        <span class="pill-white">{personaProfile.role}</span>
      </div>
      <div class="flip-hint">
        <!-- Phosphor "ArrowsClockwise" regular -->
        <RotateClockwise class="text-white" />
      </div>
    </div>


    <!-- ── BACK ──────────────────────────────────────────────────── -->
    <div class="card-face card-back" aria-hidden={!flipped}>
      <div class="flex flex-col w-full gap-2">
        <div class="biobar">
          <h3 class="text-sm text-white">{personaProfile.name}</h3>
          <span class="pill-white">{personaProfile.role}</span>
        </div>

        <!-- Quick profile fields -->
        <div class="">
          {#if personaProfile.age}
            <div class="jm-content-row">
              <UserBold class="back-profile-icon" />
              <div class="back-profile-text">
                <span class="metric-label">Age Range</span>
                <span class="back-profile-value">{personaProfile.age}</span>
              </div>
            </div>
          {/if}
          {#if personaProfile.occupation}
            <div class="jm-content-row">
              <BriefcaseRegular class="back-profile-icon" />
              <div class="back-profile-text">
                <span class="metric-label">Occupation</span>
                <span class="back-profile-value">{personaProfile.occupation}</span>
              </div>
            </div>
          {/if}
          {#if personaProfile.diagnosed}
            <div class="jm-content-row">
              <CalendarRegular class="back-profile-icon" />
              <div class="back-profile-text">
                <span class="metric-label">Diagnosed</span>
                <span class="back-profile-value">{personaProfile.diagnosed}</span>
              </div>
            </div>
          {/if}
          {#if personaProfile.preference}
            <div class="jm-content-row">
              <HeartRegular class="back-profile-icon" />
              <div class="back-profile-text">
                <span class="metric-label">Current Goal</span>
                <span class="back-profile-value">{personaProfile.preference}</span>
              </div>
            </div>
          {/if}
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

        {#if personaProfile.currentState?.length}
        <div class="back-metrics pt-8">
          {#each personaProfile.currentState as item}
      
            <div class="metric-row">
              <span class="metric-label">{item.label}</span>
      
              <div class="metric-bar-track">
                <div
                  class="metric-bar-fill"
                  style="width: {item.value * 100}%"
                />
              </div>
      
              <span class="metric-value">
                {Math.round(item.value * 100)}
              </span>
            </div>
      
            <!-- THIS is what you're currently missing -->
            <div class="metric-minmax">
              <span>{item.minLabel}</span>
              <span>{item.maxLabel}</span>
            </div>
      
          {/each}
        </div>
      {/if}

        <button
  class="open-btn"
  on:click={(e) => {
    e.stopPropagation();
    onOpenDetails(persona);
  }}
>
  Open Details
</button>

      </div>

    </div>

  </div>
</div>

<style>
  /* ── Scene: holds the perspective so preserve-3d works correctly ──── */
  .card-scene {
    height: 300px;
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

  /* ── Back profile fields (age, occupation, diagnosed, goal) ──── */
  .jm-content-rows {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .jm-content-row {
    display: flex;
    align-items: flex-start;
    gap: 6px;
  }

  .back-profile-icon {
    flex-shrink: 0;
    width: 12px;
    height: 12px;
    margin-top: 1px;
    color: var(--text-muted, #6b6050);
  }

  .back-profile-text {
    display: flex;
    flex-direction: column;
    gap: 0;
    min-width: 0;
  }

  .back-profile-value {
    font-size: 0.68rem;
    font-weight: 600;
    color: var(--text, #1a1a1a);
    text-transform: capitalize;
    line-height: 1.3;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* ── Metric rows ──────────────────────────────────────────────────── */
  .back-metrics {
    display: flex;
    flex-direction: column;
    gap: 10px;
    flex: 1;
  }

  .metric-minmax {
  display: flex;
  justify-content: space-between;
  font-size: 0.55rem;
  font-family: var(--font-mono, 'IBM Plex Mono', monospace);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-muted, #9a8f80);
  margin-top: -6px;
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