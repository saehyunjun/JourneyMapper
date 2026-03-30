<script>
  import { fly, fade } from 'svelte/transition';
  import { cubicOut, cubicInOut } from 'svelte/easing';
  import { tweened } from 'svelte/motion';

  import QuoteScreen      from './StoryComponents/QuoteScreen.svelte';
  import ThemesScreen     from './StoryComponents/ThemeScreen.svelte';
  import BaseStoryScreen  from './StoryComponents/BaseScreen.svelte';
  import CurrentStateScreen from './StoryComponents/CurrentStateScreen.svelte';

  import XRegular         from 'phosphor-icons-svelte/IconXRegular.svelte';
  import { highlightAll } from '$lib/journeymapper2/textUtils.js';
  import CaretLeftRegular from 'phosphor-icons-svelte/IconCaretLeftRegular.svelte';
  import CaretRightRegular from 'phosphor-icons-svelte/IconCaretRightRegular.svelte';

  // ── Props ─────────────────────────────────────────────────────────────
  let {
    open = $bindable(false),
    persona = {},
    steps   = [],
    onclose = undefined,
  } = $props();

  // ── Derived persona data ──────────────────────────────────────────────
  let profile  = $derived(persona?.profile ?? {});

  // JSON uses camelCase keys and flat goal/barrier fields
  let states   = $derived(persona?.currentState ?? persona?.current_state ?? []);
  let themes   = $derived(persona?.discussionThemes ?? persona?.themes ?? []);

  let goals = $derived((() => {
    const p = persona?.profile ?? {};
    return [p.goal1, p.goal2, p.goal3].filter(Boolean);
  })());

  let barriers = $derived((() => {
    const p = persona?.profile ?? {};
    return [p.barrier1, p.barrier2, p.barrier3].filter(Boolean);
  })());
  let inflectionStep = $derived(steps?.find(s => s.inflection) ?? null);
  let finalStep      = $derived(steps?.[steps.length - 1] ?? null);
  let isCaregiver    = $derived(persona?.type?.toLowerCase().includes('caregiver') ?? false);
  let accentColor    = $derived(isCaregiver ? 'var(--orange)' : 'var(--purple, #23abab)');

  /** Highlight durations + clinical terms in a bio/narrative string */
  function h(text = '') {
    return highlightAll(text ?? '');
  }

  function firstName(name) {
    return name?.split(' ')?.[0] ?? '';
  }

  // ── Story flow ────────────────────────────────────────────────────────
  const DEFAULT_FLOW = [
    'intro', 'key-quote', 'event-1', 'themes', 'bio2',
    'current-state', 'goal', 'barrier',
    'inflection-lead', 'inflection-data', 'inflection-detail',
    'path-pos', 'path-neg', 'final-lead', 'final-data',
  ];

  let STORY_FLOW = $derived(persona?.story_flow ?? DEFAULT_FLOW);

  // ── Navigation ────────────────────────────────────────────────────────
  let screenIndex = $state(0);
  let direction   = $state(1); // 1 = forward, -1 = back
  let screen      = $derived(STORY_FLOW[screenIndex]);

  function next() {
    if (screenIndex < STORY_FLOW.length - 1) {
      direction = 1;
      screenIndex += 1;
    } else {
      close();
    }
  }

  function prev() {
    if (screenIndex > 0) {
      direction = -1;
      screenIndex -= 1;
    }
  }

  function goTo(i) {
    direction = i > screenIndex ? 1 : -1;
    screenIndex = i;
  }

  function close() {
    open = false;
    onclose?.();
  }

  function onKeydown(e) {
    if (!open) return;
    if (e.key === 'Escape') close();
    if (e.key === 'ArrowRight') next();
    if (e.key === 'ArrowLeft')  prev();
  }

  // ── Auto-advance progress bar ─────────────────────────────────────────
  const AUTO_ADVANCE_MS = 8000;
  let progress = $state(0);
  let paused   = $state(false);
  let rafId    = null;
  let startTime = null;
  let elapsed   = 0;

  function startProgress() {
    cancelAnimationFrame(rafId);
    startTime = performance.now() - elapsed;
    function tick(now) {
      if (paused) return;
      elapsed = now - startTime;
      progress = Math.min(elapsed / AUTO_ADVANCE_MS, 1);
      if (progress >= 1) {
        elapsed = 0;
        next();
        return;
      }
      rafId = requestAnimationFrame(tick);
    }
    rafId = requestAnimationFrame(tick);
  }

  function resetProgress() {
    cancelAnimationFrame(rafId);
    elapsed = 0;
    progress = 0;
    if (open && !paused) startProgress();
  }

  $effect(() => {
    if (open) {
      screenIndex = 0;
      resetProgress();
    } else {
      cancelAnimationFrame(rafId);
      elapsed = 0;
      progress = 0;
    }
    return () => cancelAnimationFrame(rafId);
  });

  // Reset timer on screen change
  $effect(() => {
    screenIndex; // track
    resetProgress();
  });

  // ── Screen registry ───────────────────────────────────────────────────
  let SCREEN_REGISTRY = $derived({
    intro: {
      component: BaseStoryScreen,
      props: { title: profile?.name, 
        content: `<span class="pull-quote">${h(profile?.tagline)}</span>`, accent: accentColor }
    },
    'key-quote': {
      component: QuoteScreen,
      props: { profile, accent: accentColor }
    },
    'event-1': {
      component: BaseStoryScreen,
      props: { title: 'How It Began', content: h(profile?.bio_1), accent: accentColor }
    },
    themes: {
      component: ThemesScreen,
      props: { themes, profile, accent: accentColor }
    },
    bio2: {
      component: BaseStoryScreen,
      props: { title: `How ${firstName(profile?.name)} navigates care`, content: h(profile?.bio_2), accent: accentColor }
    },
    'current-state': {
      component: CurrentStateScreen,
      props: { states, accent: accentColor }
    },
    goal: {
      component: BaseStoryScreen,
      props: { title: `${firstName(profile?.name)}'s Goals`, content: h(goals?.map(g => `• ${g}`).join('<br/>')), accent: accentColor }
    },
    barrier: {
      component: BaseStoryScreen,
      props: { title: 'Barriers', content: h(barriers?.map(b => `• ${b}`).join('<br/>')), accent: accentColor }
    },
    'inflection-lead': {
      component: BaseStoryScreen,
      props: { kicker: 'Inflection Point', title: inflectionStep?.step, meta: inflectionStep?.stage, content: h(inflectionStep?.quote), accent: accentColor }
    },
    'inflection-data': {
      component: BaseStoryScreen,
      props: { title: 'What happens here', content: h(inflectionStep?.narrative_description), accent: accentColor }
    },
    'inflection-detail': {
      component: BaseStoryScreen,
      props: { title: inflectionStep?.inflection_detail?.label, content: h(inflectionStep?.inflection_detail?.description), accent: accentColor }
    },
    'path-pos': {
      component: BaseStoryScreen,
      props: {
        title: 'Best Case Path',
        content: h(inflectionStep?.inflection_detail?.paths?.filter(p => p.direction === 'positive')?.map(p => p.outcome)?.join('<br/><br/>')),
        accent: accentColor
      }
    },
    'path-neg': {
      component: BaseStoryScreen,
      props: {
        title: 'Risk Path',
        content: h(inflectionStep?.inflection_detail?.paths?.filter(p => p.direction === 'negative')?.map(p => p.outcome)?.join('<br/><br/>')),
        accent: accentColor
      }
    },
    'final-lead': {
      component: BaseStoryScreen,
      props: { kicker: 'Outcome', title: finalStep?.step, meta: finalStep?.stage, content: h(finalStep?.quote), accent: accentColor }
    },
    'final-data': {
      component: BaseStoryScreen,
      props: { title: 'Final State', content: h(finalStep?.narrative_description), accent: accentColor }
    },
  });

  let currentDef = $derived(SCREEN_REGISTRY[screen]);

  // ── Avatar image error ────────────────────────────────────────────────
  let imgError = $state(false);
  $effect(() => { if (persona) imgError = false; });
</script>

<svelte:window onkeydown={onKeydown} />

{#if open}
  <!-- Backdrop -->
  <div
    class="story-backdrop"
    transition:fade={{ duration: 200 }}
    onclick={close}
    aria-hidden="true"
  ></div>

  <!-- Story shell -->
  <div
    class="story-shell"
    transition:fly={{ y: 32, duration: 360, easing: cubicOut }}
    role="dialog"
    aria-modal="true"
    aria-label="Persona story: {profile?.name}"
  >

    <!-- ── Progress bars ─────────────────────────────────────────────── -->
    <div
      class="story-progress"
      role="tablist"
      aria-label="Story slides"
      onmouseenter={() => { paused = true; cancelAnimationFrame(rafId); }}
      onmouseleave={() => { paused = false; startProgress(); }}
    >
      {#each STORY_FLOW as _, i}
        <div
          class="progress-track"
          role="tab"
          aria-selected={i === screenIndex}
          aria-label="Slide {i + 1} of {STORY_FLOW.length}"
          tabindex={i === screenIndex ? 0 : -1}
          onclick={(e) => { e.stopPropagation(); goTo(i); }}
        >
          <div
            class="progress-fill"
            role="progressbar"
            aria-valuenow={i < screenIndex ? 100 : i === screenIndex ? Math.round(progress * 100) : 0}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-hidden="true"
            style="
              width: {i < screenIndex ? 100 : i === screenIndex ? progress * 100 : 0}%;
              background: {accentColor};
            "
          ></div>
        </div>
      {/each}
    </div>

    <!-- ── Story header ──────────────────────────────────────────────── -->
    <header class="story-header">
      <!-- Avatar + name -->
      <div class="story-avatar-row" role="group" aria-label="Persona identity">
        <div
          class="story-avatar-ring"
          style="border-color: {accentColor};"
          aria-hidden="true"
        >
          {#if !imgError && profile?.imageFile}
            <img
              src="/assets/profiles/{profile.imageFile}"
              alt={profile?.name}
              class="story-avatar-img"
              onerror={() => (imgError = true)}
            />
          {:else}
            <span class="story-avatar-initials" aria-hidden="true">{profile?.initials ?? '?'}</span>
          {/if}
        </div>
        <div class="story-persona-meta">
          <span class="story-persona-name">{profile?.name}</span>
          {#if persona?.type}
            <span class="story-persona-type" style="color: {accentColor};">{persona.type}</span>
          {/if}
        </div>
      </div>

      <!-- Close -->
      <button class="story-close" onclick={close} aria-label="Close story">
        <XRegular size={18} aria-hidden="true" />
      </button>
    </header>

    <!-- ── Screen content ────────────────────────────────────────────── -->
    <div
      class="story-content"
      role="region"
      aria-label="Slide {screenIndex + 1} of {STORY_FLOW.length}: {screen}"
      aria-live="polite"
      aria-atomic="true"
    >
      {#key screenIndex}
        <div
          class="story-screen-wrap"
          in:fly={{ x: direction * 24, duration: 280, delay: 40, easing: cubicOut }}
          out:fade={{ duration: 120 }}
        >
          {#if currentDef}
            <svelte:component this={currentDef.component} {...currentDef.props} />
          {:else}
            <div class="story-unknown" role="alert">Unknown screen: {screen}</div>
          {/if}
        </div>
      {/key}
    </div>

    <!-- ── Tap zones (left / right) ──────────────────────────────────── -->
    <button
      class="tap-zone tap-zone--left"
      onclick={(e) => { e.stopPropagation(); prev(); }}
      disabled={screenIndex === 0}
      aria-label="Go to previous slide"
    ></button>
    <button
      class="tap-zone tap-zone--right"
      onclick={(e) => { e.stopPropagation(); next(); }}
      aria-label={screenIndex === STORY_FLOW.length - 1 ? 'Close story' : 'Go to next slide'}
    ></button>

    <!-- ── Nav buttons ───────────────────────────────────────────────── -->
    <nav class="story-nav" aria-label="Story navigation">
      <button
        class="story-nav-btn"
        onclick={(e) => { e.stopPropagation(); prev(); }}
        disabled={screenIndex === 0}
        aria-label="Previous slide"
      >
        <CaretLeftRegular size={16} aria-hidden="true" />
      </button>
      <button
        class="story-nav-btn"
        onclick={(e) => { e.stopPropagation(); next(); }}
        aria-label={screenIndex === STORY_FLOW.length - 1 ? 'Finish story' : 'Next slide'}
      >
        {#if screenIndex === STORY_FLOW.length - 1}
          Done
        {:else}
          <CaretRightRegular size={16} aria-hidden="true" />
        {/if}
      </button>
    </nav>

  </div>
{/if}

<style>
  /* ── Backdrop ─────────────────────────────────────────────────────── */
  .story-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(10, 8, 6, 0.88);
    backdrop-filter: blur(6px);
    z-index: 9000;
    cursor: pointer;
  }

  /* ── Shell ────────────────────────────────────────────────────────── */
  .story-shell {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    z-index: 9001;

    width: min(420px, 96vw);
    height: min(780px, 94vh);

    display: flex;
    flex-direction: column;
    overflow: hidden;

    background: #0f0d0b;
    border-radius: 20px;
    box-shadow:
      0 0 0 1px rgba(255,255,255,0.06),
      0 32px 80px rgba(0,0,0,0.6),
      0 8px 24px rgba(0,0,0,0.4);
  }

  /* ── Progress bars ────────────────────────────────────────────────── */
  .story-progress {
    display: flex;
    gap: 3px;
    padding: 12px 12px 0;
    flex-shrink: 0;
    z-index: 10;
  }

  .progress-track {
    flex: 1;
    height: 2.5px;
    background: rgba(255,255,255,0.2);
    border-radius: 2px;
    overflow: hidden;
    cursor: pointer;
    position: relative;
  }

  .progress-fill {
    height: 100%;
    border-radius: 2px;
    transition: width 100ms linear;
  }

  /* ── Header ───────────────────────────────────────────────────────── */
  .story-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 14px 8px;
    flex-shrink: 0;
    z-index: 10;
  }

  .story-avatar-row {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .story-avatar-ring {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    border: 2px solid;
    overflow: hidden;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(255,255,255,0.1);
  }

  .story-avatar-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  .story-avatar-initials {
    font-size: 0.8em;
    font-weight: 700;
    color: rgba(255,255,255,0.9);
    font-family: var(--font-heading);
  }

  .story-persona-meta {
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  .story-persona-name {
    font-family: var(--font-heading);
    font-size: 0.8em;
    font-weight: 700;
    color: rgba(255,255,255,0.95);
    letter-spacing: 0.01em;
  }

  .story-persona-type {
    font-family: var(--font-mono, monospace);
    font-size: 0.65em;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  .story-close {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: rgba(255,255,255,0.1);
    border: 1px solid rgba(255,255,255,0.12);
    color: rgba(255,255,255,0.8);
    cursor: pointer;
    transition: background 150ms ease, color 150ms ease;
    flex-shrink: 0;
  }

  .story-close:hover {
    background: rgba(255,255,255,0.18);
    color: #fff;
  }

  /* ── Content ──────────────────────────────────────────────────────── */
  .story-content {
    flex: 1;
    position: relative;
    overflow: hidden;
  }

  .story-screen-wrap {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
  }

  .story-unknown {
    padding: 2rem;
    color: rgba(255,255,255,0.4);
    font-size: 0.8em;
  }

  /* ── Tap zones ────────────────────────────────────────────────────── */
  .tap-zone {
    position: absolute;
    top: 80px;
    bottom: 64px;
    width: 35%;
    background: transparent;
    border: none;
    cursor: pointer;
    z-index: 5;
  }

  .tap-zone--left  { left: 0; }
  .tap-zone--right { right: 0; }
  .tap-zone:disabled { cursor: default; }

  /* ── Nav buttons ──────────────────────────────────────────────────── */
  .story-nav {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 14px 16px;
    flex-shrink: 0;
    z-index: 10;
  }

  .story-nav-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 7px 14px;
    border-radius: 20px;
    background: rgba(255,255,255,0.08);
    border: 1px solid rgba(255,255,255,0.12);
    color: rgba(255,255,255,0.75);
    font-family: var(--font-mono, monospace);
    font-size: 0.7em;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    cursor: pointer;
    transition: background 150ms ease, color 150ms ease;
  }

  .story-nav-btn:hover {
    background: rgba(255,255,255,0.14);
    color: #fff;
  }

  .story-nav-btn:disabled {
    opacity: 0.25;
    cursor: default;
  }
</style>