<script>
  import ArrowCounterClockwiseRegular from "phosphor-icons-svelte/IconArrowCounterClockwiseRegular.svelte";

  export let personaProfile = {};
  export let personaType = '';        // ← new: pass p.type from parent
  export let currentState = [];
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

  // ── Accent color ─────────────────────────────────────────────────────────
  $: isCaregiver = personaType?.toLowerCase().includes('caregiver');
  $: accentColor = isCaregiver ? 'var(--orange)' : 'var(--purple, #23abab)';

  // ── Bio tooltip ───────────────────────────────────────────────────────────
  let hovered = false;
  let mouseX  = 0;
  let mouseY  = 0;

  // Distinct per-category colors — matches PersonaStory
  const STATE_BAR_COLORS = [
    '#5B8DB8', '#7CB98A', '#C47E5A', '#9B7EC8', '#C4A84F', '#5BADA8',
  ];
  const stateBarColor = (i) => STATE_BAR_COLORS[i % STATE_BAR_COLORS.length];

  const TIP_W    = 300;
  const OFFSET_X = 16;
  const OFFSET_Y = 12;

  function onMouseMove(e) { mouseX = e.clientX; mouseY = e.clientY; }

  $: vpW      = typeof window !== 'undefined' ? window.innerWidth : 9999;
  $: flipLeft = mouseX + OFFSET_X + TIP_W > vpW - 12;
  $: tipX     = flipLeft ? mouseX - TIP_W - OFFSET_X : mouseX + OFFSET_X;
  $: tipY     = mouseY + OFFSET_Y;
</script>

<svelte:window on:mousemove={onMouseMove} />
<!-- svelte-ignore a11y-click-events-have-key-events -->
<!-- svelte-ignore a11y-no-static-element-interactions -->
<div
  class="card-scene"
  onclick={toggle}
  onmouseenter={() => (hovered = true)}
  onmouseleave={() => (hovered = false)}
  style="--accent: {accentColor};"
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
            onerror={() => (imgError = true)}
          />
        {:else}
          <div class="card-initials">
            {personaProfile.initials}
          </div>
        {/if}
      </div>

      <!-- gradient + name -->
      <div class="card-gradient"></div>

      <!-- biobar -->
      <div class="biobar">
        <div class="bioname">
          <h3 class="text-sm text-white">{personaProfile.name}</h3>
        </div>
      </div>


      <!-- flip hint -->
      <div class="flex flex-row w-full absolute top-10 left-2">
        <div class="flex flex-col justify-start gap-1 mix-blend-inclusion">
          <span class="pill-white w-fit">{personaProfile.role}</span>
          <span class="pill-white w-fit">{personaProfile.age}</span>
        </div>
      </div>
      
            <div class="flex flex-col w-fit absolute bottom-2 right-2">
              <ArrowCounterClockwiseRegular class="text-white" />

            </div>
    </div>  

    <!-- ── BACK ──────────────────────────────────────────────────── -->
    <div class="card-face card-back" aria-hidden={!flipped}>
      <div class="flex flex-col w-full gap-2">
        <div class="biobar">
          <h3 class="text-sm text-white">{personaProfile.name}</h3>
          <span class="pill-white">{personaProfile.role}</span>
        </div>

        <div class="back-metrics">
          {#if currentState.length}
            <div class="back-state-bars">
              <div class="flex flex-col gap-2">
                {#each currentState as s, i}
                  {@const color = stateBarColor(i)}
                  {@const leansMax = s.value > 0.5}
                  {@const leansMin = s.value < 0.5}
                  <div class="flex flex-col gap-1">
                    <span class="label-xs">{s.label}</span>
                    <div class="sentiment-track">
                      <div class="sentiment-fill" style="width:{s.value * 100}%;background:{color}"></div>
                    </div>
                    <div class="flex justify-between">
                      <span
                        class="label-sm"
                        style="{leansMin ? `opacity:1;font-weight:800;color:${color}` : 'font-weight:400;opacity:0.45'}"
                      >{s.minLabel}</span>
                      <span
                        class="label-sm"
                        style="{leansMax ? `opacity:1;font-weight:800;color:${color}` : 'font-weight:400;opacity:0.45'}"
                      >{s.maxLabel}</span>
                    </div>
                  </div>
                {/each}
              </div>
            </div>
          {/if}
        </div>
      </div>
    </div>

  </div>
</div>

<style>
  /* ── Scene: holds the perspective so preserve-3d works correctly ──── */
  .card-scene {
    cursor: pointer;
    flex-shrink: 0;
  }

  /* ── Outer lift on hover — isolated from the flip ────────────────── */
  .card-scene:hover .card-body {
    transform: translateY(-5px);
    box-shadow: 0 30px 60px -12px rgba(50, 50, 93, 0.25), 0 18px 36px -18px rgba(0, 0, 0, 0.3);
  }

  .card-scene:hover .card-body.is-flipped {
    transform: rotateY(180deg) translateY(-10px);
  }

  /* ── Card body ────────────────────────────────────────────────────── */
  .card-body {
    position: relative;
    width: 100%;
    height: 100%;

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
      rgba(10, 10, 10, 0.9) 0%,
      rgba(10, 10, 10, 0.8) 20%,
      rgba(0, 0, 0, 0.20) 40%,
      rgba(0, 0, 0, 0.10) 65%,
      rgba(20, 20, 10, 0.10) 100%
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

  /* Flip hint icon — fades out once flipped */
  .flip-hint {
    position: absolute;
    bottom: .5em;
    display: flex;
    flex-direction: row;
    width: 100%;
    padding: 0 .5em 0 .5em;
    align-items: center;
    justify-content: space-between;

    color: rgba(255, 255, 255, 0.55);
    transition: opacity 0.2s;
    pointer-events: none;
}


  /* ── BACK ─────────────────────────────────────────────────────────── */
  .card-back {
    background: var(--panel, #f4efe5);
    transform: rotateY(180deg);
    display: flex;
    align-items: stretch;
  }

  /* ── Metric rows ──────────────────────────────────────────────────── */
  .back-metrics {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: .25em;
    flex: 1;
  }

  /* ── Biobar accent ────────────────────────────────────────────────── */
  :global(.card-scene .biobar) {
    background-color: var(--accent, var(--purple, #23abab));
  }
</style>