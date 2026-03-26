<script>
  import { fly, fade } from 'svelte/transition';
  import { cubicOut, cubicInOut } from 'svelte/easing';
  import { tweened } from 'svelte/motion';
  import { selectedIndex, hoveredIndex, hoveredInflectionIndex } from './journeyStore.js';
  import { sentimentToColor, emotionColor, DYAD_BY_ID, SCORE_ALIASES, SENTIMENT_SCALE } from './journeyConfig.js';
  import PersonaProfileCard from './PersonaProfileCard.svelte';
  import IndexMetricBars from './IndexMetricBars.svelte';


  import UserBold       from 'phosphor-icons-svelte/IconUserBold.svelte';
  import HeartRegular      from 'phosphor-icons-svelte/IconHeartRegular.svelte';
  import BriefcaseRegular  from 'phosphor-icons-svelte/IconBriefcaseRegular.svelte';
  import CalendarRegular   from 'phosphor-icons-svelte/IconCalendarRegular.svelte';
  import ArrowRightRegular from 'phosphor-icons-svelte/IconArrowRightRegular.svelte';
  import ArrowUpRegular    from 'phosphor-icons-svelte/IconArrowUpRegular.svelte';
  import ArrowDownRegular  from 'phosphor-icons-svelte/IconArrowDownRegular.svelte';
  import LightbulbRegular  from 'phosphor-icons-svelte/IconLightbulbRegular.svelte';
  import ChartLineRegular  from 'phosphor-icons-svelte/IconChartLineRegular.svelte';
  import MapPinRegular     from 'phosphor-icons-svelte/IconMapPinRegular.svelte';

  // 10 evenly-spaced stops for index metric square rows (−5 → +5)
  const METRIC_STOPS = Array.from({ length: 10 }, (_, i) => -5 + i * (10 / 9));

  const TWEEN_OPTS = { duration: 400, easing: cubicInOut };

  /** Active persona object — full shape from journeyPersonas.json */
  export let activePersona = null;

  /** Full journey data array for the current persona */
  export let data = [];

  /** Metrics config array */
  export let metrics = [];

  // ── Derived: which step to show ──────────────────────────────────────
  $: displayIndex = $selectedIndex >= 0
    ? $selectedIndex
    : $hoveredIndex >= 0
    ? $hoveredIndex
    : -1;

  $: step    = displayIndex >= 0 ? data[displayIndex] : null;
  $: profile = activePersona?.profile ?? {};

  // ── Derived: inflection panel ─────────────────────────────────────────
  $: inflStep      = $hoveredInflectionIndex >= 0 ? data[$hoveredInflectionIndex] : null;
  $: inflDetail    = inflStep?.inflection_detail ?? null;
  $: showInflPanel = inflStep !== null;

  // ── Persona photo reset ────────────────────────────────────────────
  let imgError = false;
  $: { imgError = false; }

  // ── Emotion swatches ─────────────────────────────────────────────────
  $: emotionSwatches = (() => {
    if (!step) return [];
    const raw = step.plutchik_score?.toLowerCase().trim() ?? '';
    const dyad = DYAD_BY_ID[raw];
    if (dyad) return dyad.primary.map(pid => emotionColor(pid));
    const id = SCORE_ALIASES[raw] ?? raw;
    return [emotionColor(id)];
  })();

  // ── Sentiment helpers ─────────────────────────────────────────────────
  function sentimentLabel(val) {
    const n = parseFloat(val);
    if (n >= 3)  return 'Very Positive';
    if (n >= 1)  return 'Positive';
    if (n === 0) return 'Neutral';
    if (n >= -2) return 'Negative';
    return 'Very Negative';
  }

  // ── Tweened sentiment store ───────────────────────────────────────────
  const sentimentTween = tweened(0, TWEEN_OPTS);
  $: if (step) sentimentTween.set(parseFloat(step.sentiment ?? 0));
  $: sentimentTweenVal = $sentimentTween;
  $: sentimentColor    = sentimentToColor($sentimentTween);

  // ── Tweened metric stores ─────────────────────────────────────────────
  // One tweened store per metric, stored as a plain array.
  // We subscribe to each individually and keep a parallel metricVals array
  // that Svelte can react to normally — avoids the $store-in-array problem.
  let metricTweens = /** @type {ReturnType<typeof tweened>[]} */ ([]);
  let metricVals   = /** @type {number[]} */ ([]);

  // Grow stores array when metrics arrives / changes length
  $: if (metrics.length > metricTweens.length) {
    const toAdd = metrics.length - metricTweens.length;
    for (let j = 0; j < toAdd; j++) {
      const store = tweened(0, TWEEN_OPTS);
      const idx   = metricTweens.length;
      // Subscribe so metricVals stays in sync
      store.subscribe(v => {
        metricVals[idx] = v;
        metricVals = [...metricVals]; // trigger reactivity
      });
      metricTweens = [...metricTweens, store];
    }
  }

  // Push new target values whenever the active step changes
  $: if (step) {
    metrics.forEach((m, i) => {
      metricTweens[i]?.set(parseFloat(step[m.key] ?? 0));
    });
  }
</script>

<aside class="sticky-panel flex flex-col overflow-y-auto overflow-x-hidden h-full" aria-label="Persona & step details">

  <!-- ═══════════════════════════════════════════════════════════════
       SECTION 1 — PERSONA BIO
  ════════════════════════════════════════════════════════════════ -->
  {#if activePersona}
    {#key activePersona.id}
      <div class="flex flex-col gap-3 px-4 pt-1 pb-4"
        in:fly={{ y: 8, duration: 220, easing: cubicOut }}>

        <!-- Bio + Goals — collapse when a step is active -->
        <div class="bio-goals-wrap pt-4" class:bio-goals-wrap--hidden={displayIndex >= 0}>

          <PersonaProfileCard personaProfile={activePersona.profile} />

          <!-- Quick fields -->
          <div class="flex flex-col gap-2">
            {#if profile.age}
                <div class="toolbar-sm-white align-middle">
                  <div class="flex flex-row gap-1">
                    <UserBold class="icon-toolbar-dark"/>
                    <div class="flex flex-col">
                    <span class="label-sm">Age Range</span>
                  <span class="font-semibold capitalize">{profile.age}</span>
                </div>
              </div>
                </div>
            {/if}
            {#if profile.occupation}
              <div class="flex flex-col">
                <span class="label-sm uppercase text-slate-400 flex items-center gap-1">
                  <BriefcaseRegular />Occupation
                </span>
                <span class="text-body-sm capitalize">{profile.occupation}</span>
              </div>
            {/if}
            {#if profile.diagnosed}
              <div class="flex flex-col">
                <span class="label-sm uppercase text-slate-400 flex items-center gap-1">
                  <CalendarRegular />Diagnosed
                </span>
                <span class="text-body-sm capitalize">{profile.diagnosed}</span>
              </div>
            {/if}
            {#if profile.preference}
              <div class="flex flex-col">
                <span class="label-sm uppercase text-slate-400 flex items-center gap-1">
                  <HeartRegular />Current Goal
                </span>
                <span class="text-body-sm capitalize">{profile.preference}</span>
              </div>
            {/if}
          </div>

          {#if profile.bio}
            <div class="border-bottom pt-2">
              <p class="text-body-sm">{profile.bio}</p>
            </div>
          {/if}

          {#if profile.goal1 || profile.goal2 || profile.goal3}
            <div class="jm-content-col gap-2">
              <div class="flex flex-col">
                <span class="label-sm uppercase text-slate-400">Goals
                  
                </span>
              </div>
              {#each [profile.goal1, profile.goal2, profile.goal3].filter(Boolean) as goal}
                <div class="flex items-start gap-1">
                  <ArrowRightRegular size={10} class="mt-0.5 shrink-0" />
                  <span class="text-body-sm">{goal}</span>
                </div>
              {/each}
            </div>
          {/if}

        </div><!-- /bio-goals-wrap -->
      </div>
    {/key}
  {/if}


  <!-- ═══════════════════════════════════════════════════════════════
       SECTION 2 — INFLECTION DETAIL (hover on inflection cards)
  ════════════════════════════════════════════════════════════════ -->
  {#if showInflPanel && inflDetail}
    {#key $hoveredInflectionIndex}
      <div
        class="flex flex-col gap-3 px-4 py-3 border-top"
        in:fly={{ y: 6, duration: 180, easing: cubicOut }}
      >
        <!-- Step name + description -->
        <div class="jm-content-col">
          <span class="jm-kicker">{inflDetail.label}</span>
          <span class="label-bold">{inflStep?.step}</span>
          {#if inflDetail.description}
            <p class="text-body-sm mt-1">{inflDetail.description}</p>
          {/if}
        </div>

        <!-- Paths -->
        {#if inflDetail.paths?.length}
          <div class="jm-content-col gap-2">
            <span class="jm-kicker">Paths</span>
            {#each inflDetail.paths as path}
              <div class="infl-path infl-path--{path.direction} flex items-start gap-2">
                <span class="infl-path-icon shrink-0 mt-0.5">
                  {#if path.direction === 'positive'}
                    <ArrowUpRegular />
                  {:else}
                    <ArrowDownRegular />
                  {/if}
                </span>
                <div class="jm-content-col gap-0.5">
                  <span class="label-bold">{path.label}</span>
                  <span class="text-body-sm">{path.outcome}</span>
                  {#if path.key_driver}
                    <span class="text-body-sm capitalize" style="font-style:italic;">{path.key_driver}</span>
                  {/if}
                </div>
              </div>
            {/each}
          </div>
        {/if}

        <!-- Sponsor opportunity -->
        {#if inflDetail.sponsor_opportunity}
          <div class="jm-content-col gap-1">
            <span class="jm-kicker">Sponsor Opportunity</span>
            <div class="infl-opportunity flex items-start gap-2">
              <LightbulbRegular class="shrink-0 mt-0.5" />
              <span class="text-body-sm">{inflDetail.sponsor_opportunity}</span>
            </div>
          </div>
        {/if}

        <!-- Data needed -->
        {#if inflDetail.data_needed}
          <div class="jm-content-col gap-0.5 pt-2 border-top">
            <span class="text-body-sm capitalize">Data needed</span>
            <span class="text-body-sm">{inflDetail.data_needed}</span>
          </div>
        {/if}

      </div>
    {/key}
  {/if}


  <!-- ═══════════════════════════════════════════════════════════════
       SECTION 3 — STEP DETAILS
       Text content uses crossfade keyed on displayIndex.
       Numeric bars (sentiment, metrics) tween continuously via
       svelte/motion stores so they glide rather than snap.
  ════════════════════════════════════════════════════════════════ -->
  <div class="flex flex-col gap-3 px-4 pt-1 pb-4 flex-1">

    {#if step}

      <!-- Step header — crossfades out/in when step changes -->
      {#key displayIndex}
        <div
          class="flex flex-row w-full justify-between"
          in:fly={{ y: 8, duration: 220, delay: 40, easing: cubicOut }}
          out:fade={{ duration: 120 }}
        >
        <div class="flex flex-col">
          <div class="step-circles mb-4">
            {#each data as _, i}
              <div
                class="step-circle"
                class:step-circle--active={i === displayIndex}
                class:step-circle--complete={i < displayIndex}>
              </div>
            {/each}
          </div>
          <span class="heading-sm">{step.stage}</span>
          <p class="heading-md">{step.step}</p>
        </div>
      </div>
      {/key}

      <!-- Narrative — crossfades on step change -->
      {#if step.narrative_description}
        {#key displayIndex}
          <div
            class="gap-1"
            in:fly={{ y: 6, duration: 220, delay: 100, easing: cubicOut }}
            out:fade={{ duration: 120 }}
          >
            <div class="flex flex-col">
              <span class="heading-sm">Narrative</span>
            </div>
            <p class="text-body-sm">{step.narrative_description}</p>
          </div>
        {/key}
      {/if}


      <div class="flex flex-col mt-12">
      <!-- Sentiment — row of colored squares, active square highlighted -->
      <span class="heading-sm">Sentiment</span>
      <div class="toolbar-sm-light">
        {#key displayIndex}
     
      {/key}
        <div class="score-squares">
          {#each SENTIMENT_SCALE as stopColor, i}
            {@const activePos = ($sentimentTween + 5) / 10 * (SENTIMENT_SCALE.length - 1)}
            {@const isActive  = i === Math.round(activePos)}
            {@const dist      = Math.abs(i - activePos)}
            {@const opacity   = isActive ? 1 : Math.max(0.12, 1 - dist * 0.28)}
            <div
              class="score-square"
              class:score-square--active={isActive}
              style="background: {stopColor}; opacity: {opacity};"
            />
          {/each}
        </div>
        <span
        class="pill uppercase font-semibold"
        style="border: 1px solid {sentimentColor};"
        in:fade={{ duration: 200, delay: 100 }}
        out:fade={{ duration: 100 }}
      >
        {sentimentLabel($sentimentTween)}
      </span>
      </div>

      <!-- Index metrics — labels crossfade, bars tween -->
      {#if metrics.length}
        <div class="flex flex-col mt-8">
          <div class="flex items-center gap-1 mb-2">
            <span class="heading-sm">Index Metrics</span>
          </div>
          <IndexMetricBars
            {metrics}
            {metricVals}
            selectedIndex={displayIndex}
            compact={true}
          />
        </div>
      {/if}
    </div>
      {/if}
    
  </div>

</aside>

<style>
  /* ── Bio + Goals collapse animation ─────────────────────────── */
  .bio-goals-wrap {
    display: flex;
    flex-direction: column;
    gap: 12px;
    opacity: 1;
    overflow: hidden;
    transition: max-height 0.3s cubic-bezier(0.4, 0, 0.2, 1),
                opacity    0.2s ease;
  }
  .bio-goals-wrap--hidden {
    max-height: 0;
    opacity: 0;
  }

  /* ── Score squares (sentiment + index metrics) ──────────────── */
  .score-squares {
    display: flex;
    flex-direction: row;
    gap: 1.725px;
    width: 100%;
  }
  .score-square {
    flex: 1;
    height: 1.5em;
    transition: opacity 0.15s cubic-bezier(0.4, 0, 0.2, 1);
  }
  .score-square--active {
    outline: 1px solid var(--ink);
    outline-offset: 1px;
  }

  /* ── Inflection path cards ───────────────────────────────────── */
  .infl-path {
    padding: 0.4rem 0.5rem;
    border-radius: 3px;
  }
  .infl-path--positive {
    background: rgba(40, 183, 152, 0.08);
    border-left: 2px solid #28b798;
  }
  .infl-path--positive .infl-path-icon { color: #28b798; }

  .infl-path--negative {
    background: rgba(192, 57, 43, 0.07);
    border-left: 2px solid #C0392B;
  }
  .infl-path--negative .infl-path-icon { color: #C0392B; }

  /* ── Sponsor opportunity card ────────────────────────────────── */
  .infl-opportunity {
    padding: 0.4rem 0.5rem;
    background: rgba(63, 115, 255, 0.06);
    border-left: 2px solid #3f73ff;
    border-radius: 3px;
    color: #3f73ff;
  }

  /* ── Section dividers ────────────────────────────────────────── */
  .border-top {
    border-top: var(--hairline);
  }
</style>