<script>
  import { createEventDispatcher } from 'svelte';

  // ── Screen components (correct path) ─────────────────────────────
  import QuoteScreen from './StoryComponents/QuoteScreen.svelte';
  import ThemesScreen from './StoryComponents/ThemeScreen.svelte';
  import BaseStoryScreen from './StoryComponents/BaseScreen.svelte';
  import CurrentStateScreen from './StoryComponents/CurrentStateScreen.svelte';

  const dispatch = createEventDispatcher();

  // ── Props ────────────────────────────────────────────────────────
  export let persona = {};
  export let steps = [];

  // ── Derived data ─────────────────────────────────────────────────
  $: profile = persona?.profile ?? {};
  $: themes = persona?.themes ?? [];
  $: states = persona?.current_state ?? [];
  $: goals = persona?.goals ?? [];
  $: barriers = persona?.barriers ?? [];

  $: inflectionStep = steps?.find(s => s.inflection) ?? null;
  $: finalStep = steps?.[steps.length - 1] ?? null;

  function firstName(name) {
    return name?.split(' ')?.[0] ?? '';
  }

  // ── Story flow (order control layer) ─────────────────────────────
  const DEFAULT_FLOW = [
    'intro',
    'key-quote',
    'event-1',
    'themes',
    'bio2',
    'current-state',
    'goal',
    'barrier',
    'inflection-lead',
    'inflection-data',
    'inflection-detail',
    'path-pos',
    'path-neg',
    'final-lead',
    'final-data'
  ];

  $: STORY_FLOW = persona?.story_flow ?? DEFAULT_FLOW;

  // ── Navigation state ─────────────────────────────────────────────
  let screenIndex = 0;
  $: screen = STORY_FLOW[screenIndex];

  function next() {
    if (screenIndex < STORY_FLOW.length - 1) screenIndex += 1;
  }

  function prev() {
    if (screenIndex > 0) screenIndex -= 1;
  }

  // ── Registry helper ──────────────────────────────────────────────
  function screenDef(component, props) {
    return { component, props };
  }

  // ── Screen registry (render layer) ───────────────────────────────
  $: SCREEN_REGISTRY = {
    intro: screenDef(BaseStoryScreen, {
      title: profile?.name,
      content: `<span class="pull-quote">${profile?.tagline ?? ''}</span>`
    }),

    'key-quote': screenDef(QuoteScreen, { profile }),

    'event-1': screenDef(BaseStoryScreen, {
      title: 'How It Began',
      content: profile?.bio_1
    }),

    themes: screenDef(ThemesScreen, { themes, profile }),

    bio2: screenDef(BaseStoryScreen, {
      title: `How ${firstName(profile?.name)} navigates care`,
      content: profile?.bio_2
    }),

    'current-state': screenDef(CurrentStateScreen, {
      states
    }),

    goal: screenDef(BaseStoryScreen, {
      title: `${firstName(profile?.name)}'s Goals`,
      content: goals?.map(g => `• ${g}`).join('<br/>')
    }),

    barrier: screenDef(BaseStoryScreen, {
      title: "Barriers",
      content: barriers?.map(b => `• ${b}`).join('<br/>')
    }),

    'inflection-lead': screenDef(BaseStoryScreen, {
      kicker: 'Inflection Point',
      title: inflectionStep?.step,
      meta: inflectionStep?.stage,
      content: inflectionStep?.quote
    }),

    'inflection-data': screenDef(BaseStoryScreen, {
      title: 'What happens here',
      content: inflectionStep?.narrative_description
    }),

    'inflection-detail': screenDef(BaseStoryScreen, {
      title: inflectionStep?.inflection_detail?.label,
      content: inflectionStep?.inflection_detail?.description
    }),

    'path-pos': screenDef(BaseStoryScreen, {
      title: 'Best Case Path',
      content: inflectionStep?.inflection_detail?.paths
        ?.filter(p => p.direction === 'positive')
        ?.map(p => p.outcome)
        ?.join('<br/><br/>')
    }),

    'path-neg': screenDef(BaseStoryScreen, {
      title: 'Risk Path',
      content: inflectionStep?.inflection_detail?.paths
        ?.filter(p => p.direction === 'negative')
        ?.map(p => p.outcome)
        ?.join('<br/><br/>')
    }),

    'final-lead': screenDef(BaseStoryScreen, {
      kicker: 'Outcome',
      title: finalStep?.step,
      meta: finalStep?.stage,
      content: finalStep?.quote
    }),

    'final-data': screenDef(BaseStoryScreen, {
      title: 'Final State',
      content: finalStep?.narrative_description
    })
  };
</script>

<!-- ── Screen Renderer ───────────────────────────────────────────── -->
<svelte:component
  this={SCREEN_REGISTRY[screen]?.component}
  {...SCREEN_REGISTRY[screen]?.props}
/>

<!-- Fallback -->
{#if !SCREEN_REGISTRY[screen]}
  <div class="story-screen">
    <div class="content-wrap">
      <span class="label-sm">Unknown screen: {screen}</span>
    </div>
  </div>
{/if}

<!-- ── Navigation UI ─────────────────────────────────────────────── -->
<div class="toolbar-sm-white mt-2">
  <button class="btn-nav" on:click={prev} disabled={screenIndex === 0}>
    Prev
  </button>

  <div class="step-circles">
    {#each STORY_FLOW as _, i}
      <div
        class="step-circle"
        class:step-circle--active={i === screenIndex}
        class:step-circle--complete={i < screenIndex}
      />
    {/each}
  </div>

  <button
    class="btn-nav"
    on:click={next}
    disabled={screenIndex === STORY_FLOW.length - 1}
  >
    Next
  </button>
</div>