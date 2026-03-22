<script>
  import { fly, fade } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import { selectedIndex, hoveredIndex, hoveredInflectionIndex } from './journeyStore.js';
  import { sentimentToColor, emotionColor, DYAD_BY_ID, SCORE_ALIASES } from './journeyConfig.js';
  import PersonaProfileCard from './PersonaProfileCard.svelte';

  import UserRegular          from 'phosphor-icons-svelte/IconUserRegular.svelte';
  import HeartRegular         from 'phosphor-icons-svelte/IconHeartRegular.svelte';
  import BriefcaseRegular     from 'phosphor-icons-svelte/IconBriefcaseRegular.svelte';
  import CalendarRegular      from 'phosphor-icons-svelte/IconCalendarRegular.svelte';
  import ArrowRightRegular    from 'phosphor-icons-svelte/IconArrowRightRegular.svelte';
  import ArrowUpRegular       from 'phosphor-icons-svelte/IconArrowUpRegular.svelte';
  import ArrowDownRegular     from 'phosphor-icons-svelte/IconArrowDownRegular.svelte';
  import LightbulbRegular     from 'phosphor-icons-svelte/IconLightbulbRegular.svelte';
  import ChartLineRegular     from 'phosphor-icons-svelte/IconChartLineRegular.svelte';
  import MapPinRegular        from 'phosphor-icons-svelte/IconMapPinRegular.svelte';

  /** Active persona object — full shape from journeyPersonas.json */
  export let activePersona = null;

  /** Full journey data array for the current persona */
  export let data = [];

  /** Metrics config array */
  export let metrics = [];

  // ── Derived: which step to show ──────────────────────────────────────
  // Prefer selected; fall back to hovered; fall back to null
  $: displayIndex = $selectedIndex >= 0
    ? $selectedIndex
    : $hoveredIndex >= 0
    ? $hoveredIndex
    : -1;

  $: step = displayIndex >= 0 ? data[displayIndex] : null;
  $: profile = activePersona?.profile ?? {};

  // ── Derived: inflection panel ─────────────────────────────────────────
  $: inflStep   = $hoveredInflectionIndex >= 0 ? data[$hoveredInflectionIndex] : null;
  $: inflDetail = inflStep?.inflection_detail ?? null;
  $: showInflPanel = inflStep !== null;

  // ── Persona photo ──────────────────────────────────────────────────
  let imgError = false;
  $: { imgError = false; } // reset when persona changes

  // ── Emotion swatches (same logic as StepDetailContent) ────────────
  $: emotionSwatches = (() => {
    if (!step) return [];
    const raw = step.plutchik_score?.toLowerCase().trim() ?? '';
    const dyad = DYAD_BY_ID[raw];
    if (dyad) return dyad.primary.map(pid => emotionColor(pid));
    const id = SCORE_ALIASES[raw] ?? raw;
    return [emotionColor(id)];
  })();

  // ── Sentiment helpers ──────────────────────────────────────────────
  function toPercent(val) {
    return ((parseFloat(val) + 5) / 10) * 100;
  }

  function sentimentLabel(val) {
    const n = parseFloat(val);
    if (n >= 3)  return 'Very Positive';
    if (n >= 1)  return 'Positive';
    if (n === 0) return 'Neutral';
    if (n >= -2) return 'Negative';
    return 'Very Negative';
  }
</script>

<aside class="sticky-panel" aria-label="Persona & step details">

  <!-- ═══════════════════════════════════════════════════════════════
       SECTION 1 — PERSONA BIO
  ════════════════════════════════════════════════════════════════ -->
  {#if activePersona}
    {#key activePersona.id}
      <div class="sidebar-section persona-section" 
      in:fly={{ y: 8, duration: 220, easing: cubicOut }}>

        <!-- Bio + Goals — collapse when a step is active -->
        <div class="bio-goals-wrap" class:bio-goals-wrap--hidden={displayIndex >= 0}>

          <PersonaProfileCard 
          personaProfile={activePersona.profile}
              />
                <!-- Quick fields -->
                <div class="flex flex-col">
                  {#if profile.age}
                    <div class="flex flex-row">
                      <UserRegular class="w-3" />
                      <span class="label-sm">Age</span>
                    </div>
                    <span class="body-text font-medium capitalize">{profile.age}</span>
                  {/if}
                  {#if profile.occupation}
                    <div class="field-row">
                      <BriefcaseRegular class="w-3" />
                      <span class="label-sm">Occupation</span>
                      <span class="label-sm">{profile.occupation}</span>
                    </div>
                  {/if}
                  {#if profile.diagnosed}
                    <div class="field-row">
                      <CalendarRegular class="w-3" />
                      <span class="label-sm">Diagnosed</span>
                      <span class="label-sm">{profile.diagnosed}</span>
                    </div>
                  {/if}
                  {#if profile.preference}
                    <div class="field-row">
                      <HeartRegular class="w-3" />
                      <span class="label-sm">Preference</span>
                      <span class="label-sm">{profile.preference}</span>
                    </div>
                  {/if}
                </div>
          {#if profile.bio}
            <div class="bio-block">
              <p class="text-body-sm">{profile.bio}</p>
            </div>
          {/if}

          {#if profile.goal1 || profile.goal2 || profile.goal3}
            <div class="goals-block">
              <div class="jm-section-bar" style="margin-bottom: 8px;">
                <span class="label-sm">Goals</span>
              </div>
              {#each [profile.goal1, profile.goal2, profile.goal3].filter(Boolean) as goal}
                <div class="goal-row">
                  <ArrowRightRegular size={10} />
                  <span class="text-body-sm">{goal}</span>
                </div>
              {/each}
            </div>
          {/if}
        </div>

      </div>
    {/key}
  {/if}

  <!-- ═══════════════════════════════════════════════════════════════
       DIVIDER
  ════════════════════════════════════════════════════════════════ -->
  <div class="divider" />

  <!-- ═══════════════════════════════════════════════════════════════
       SECTION 2 — INFLECTION DETAIL (hover on inflection cards)
  ════════════════════════════════════════════════════════════════ -->
  {#if showInflPanel && inflDetail}
    {#key $hoveredInflectionIndex}
      <div
        class="sidebar-section inflection-section"
        in:fly={{ y: 6, duration: 180, easing: cubicOut }}
      >

        <!-- Header -->
        <div class="jm-section-bar">
          <span class="jm-kicker">{inflDetail.label}</span>
        </div>

        <!-- Step name + description -->
        <div class="infl-name-block">
          <span class="label-bold" style="font-size:0.8rem;">{inflStep?.step}</span>
          {#if inflDetail.description}
            <p class="text-body-sm infl-desc">{inflDetail.description}</p>
          {/if}
        </div>

        <!-- Paths -->
        {#if inflDetail.paths?.length}
          <div class="infl-sub-block">
            <span class="jm-kicker" style="margin-bottom:0.35rem;">Paths</span>
            <div class="infl-paths">
              {#each inflDetail.paths as path}
                <div class="infl-path infl-path--{path.direction}">
                  <span class="infl-path-icon">
                    {#if path.direction === 'positive'}
                      <ArrowUpRegular size={11} />
                    {:else}
                      <ArrowDownRegular size={11} />
                    {/if}
                  </span>
                  <div class="infl-path-body">
                    <span class="label-bold" style="font-size:0.72rem;">{path.label}</span>
                    <span class="text-body-sm infl-path-outcome">{path.outcome}</span>
                    {#if path.key_driver}
                      <span class="label-heading infl-path-driver">{path.key_driver}</span>
                    {/if}
                  </div>
                </div>
              {/each}
            </div>
          </div>
        {/if}

        <!-- Sponsor opportunity -->
        {#if inflDetail.sponsor_opportunity}
          <div class="infl-sub-block">
            <span class="jm-kicker" style="margin-bottom:0.35rem;">Sponsor Opportunity</span>
            <div class="infl-opportunity">
              <span class="infl-opportunity-icon"><LightbulbRegular size={11} /></span>
              <span class="text-body-sm">{inflDetail.sponsor_opportunity}</span>
            </div>
          </div>
        {/if}

        <!-- Data needed -->
        {#if inflDetail.data_needed}
          <div class="infl-data-needed">
            <span class="label-heading" style="color:#8090a8;">Data needed</span>
            <span class="text-body-sm" style="color:#606878;">{inflDetail.data_needed}</span>
          </div>
        {/if}

      </div>
    {/key}

    <div class="divider" />
  {/if}

  <!-- ═══════════════════════════════════════════════════════════════
       SECTION 3 — STEP DETAILS
  ════════════════════════════════════════════════════════════════ -->
  <div class="sidebar-section step-section">

    {#if step}
      {#key displayIndex}
        <div in:fly={{ y: 6, duration: 180, easing: cubicOut }}>

          <!-- Step header -->
          <div class="step-header">
            <div class="jm-section-bar" style="margin-bottom: 6px;">
              <span class="label-sm">{step.stage}</span>
              <span class="step-index-badge">{displayIndex + 1} / {data.length}</span>
            </div>
            <p class="step-name">{step.step}</p>
          </div>

          <!-- Sentiment -->
          <div class="metric-block">
            <div class="jm-section-bar" style="margin-bottom: 6px;">
              <span class="label-sm">Sentiment</span>
              <span class="sentiment-score" style="color: {sentimentToColor(step.sentiment)};">
                {parseFloat(step.sentiment) > 0 ? '+' : ''}{step.sentiment}
              </span>
            </div>
            <div class="sentiment-track">
              <div
                class="sentiment-fill"
                style="width: {toPercent(step.sentiment)}%; background: {sentimentToColor(step.sentiment)};"
              />
            </div>
            <span class="sentiment-label-text" style="color: {sentimentToColor(step.sentiment)};">
              {sentimentLabel(step.sentiment)}
            </span>
          </div>

          <!-- Emotional state -->
          <div class="metric-block">
            <div class="jm-section-bar" style="margin-bottom: 6px;">
              <span class="label-sm">Emotion</span>
            </div>
            <div class="emotion-row">
              <div class="swatches">
                {#each emotionSwatches as color}
                  <span class="jm-swatch-circle" style="background: {color};" />
                {/each}
              </div>
              <span class="text-body-sm-uppercase">{step.plutchik_score}</span>
            </div>
          </div>

          <!-- Index metrics -->
          {#if metrics.length}
            <div class="metric-block">
              <div class="jm-section-bar" style="margin-bottom: 8px;">
                <span class="label-sm">Index Metrics</span>
                <ChartLineRegular class="w-3" />
              </div>

              <div class="metrics-list">
                {#each metrics as m}
                  {@const val = parseFloat(step[m.key] ?? 0)}
                  {@const pct = Math.abs(((val + 5) / 10) * 100 - 50)}
                  {@const left = val >= 0 ? 50 : ((val + 5) / 10) * 100}
                  <div class="index-metric-row">
                    <div class="index-metric-label-row">
                      <span class="jm-mini-swatch" style="background: {m.color};" />
                      <span class="index-metric-name">{m.label}</span>
                      <span class="index-metric-val" style="color: {m.color};">
                        {val > 0 ? '+' : ''}{val}
                      </span>
                    </div>
              
                    <div class="index-track">
                      <div class="index-zero" />
                      <div
                        class="index-fill"
                        style="width: {pct}%; left: {left}%; background: {m.color};"
                      />
                    </div>
                  </div>
                {/each}
              </div>
            </div>
          {/if}

          <!-- Narrative -->
          {#if step.narrative_description}
            <div class="narrative-block">
              <div class="jm-section-bar" style="margin-bottom: 6px;">
                <span class="label-sm">Narrative</span>
              </div>
              <p class="text-body-sm">{step.narrative_description}</p>
            </div>
          {/if}

        </div>
      {/key}
        {/if}
  </div>

</aside>

<style>
  /* ── Sidebar shell ────────────────────────────────────────────── */
  .info-sidebar {
    position: sticky;
    top: 0;
    width: 12.5%; /* 1/6 screen */
    min-width: 320px;
    height: 100vh;
    display: flex;
    flex-direction: column;
    overflow-y: auto;
    overflow-x: hidden;
    flex-shrink: 0;
    scrollbar-width: thin;
  }

  /* ── Sections ────────────────────────────────────────────────── */
  .sidebar-section {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 14px 14px 12px;
  }

  .divider {
    height: 2px;
    background: #1a1a1a;
    margin: 0;
    flex-shrink: 0;
  }

  /* ── Persona avatar row ──────────────────────────────────────── */
  .persona-avatar-row {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .avatar-frame {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    overflow: hidden;
    border: 1.5px solid #1a1a1a;
    background: #DFC3A8;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .avatar-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .avatar-initials-lg {
    font-family: var(--font-mono, 'IBM Plex Mono', monospace);
    font-size: 0.7rem;
    font-weight: 700;
    color: #5A3E28;
    letter-spacing: 0.05em;
  }

  .persona-name-block {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
  }

  /* ── Persona fields ──────────────────────────────────────────── */
  .persona-fields {
    display: flex;
    flex-direction: column;
    gap: 5px;
  }


  /* ── Bio + Goals collapse ────────────────────────────────────── */
  .bio-goals-wrap {
    display: flex;
    flex-direction: column;
    gap: 12px;
    max-height: 600px;
    opacity: 1;
    overflow: hidden;
    transition: max-height 0.3s cubic-bezier(0.4, 0, 0.2, 1),
                opacity 0.2s ease;
  }

  .bio-goals-wrap--hidden {
    max-height: 0;
    opacity: 0;
  }

  /* ── Bio block ───────────────────────────────────────────────── */
  .bio-block {
    border-top: 1px solid #DFC3A8;
    padding-top: 10px;
  }

  /* ── Goals ───────────────────────────────────────────────────── */
  .goals-block {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .goal-row {
    display: grid;
    grid-template-columns: 12px 1fr;
    gap: 5px;
    align-items: start;
    color: #73726c;
  }

  /* ── Step header ─────────────────────────────────────────────── */
  .step-section {
    flex: 1;
  }

  .step-header {
    margin-bottom: 4px;
  }

  .step-index-badge {
    font-family: var(--font-mono, 'IBM Plex Mono', monospace);
    font-size: 0.55rem;
    font-weight: 700;
    color: #A08060;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .step-name {
    font-family: var(--font-heading, serif);
    font-size: 0.95rem;
    font-weight: 500;
    line-height: 1.25;
    color: #1a1a1a;
    margin: 0;
  }

  /* ── Metric blocks ───────────────────────────────────────────── */
  .metric-block {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .narrative-block {
    border-top: 1px solid #DFC3A8;
    padding-top: 10px;
  }

  /* ── Sentiment bar ───────────────────────────────────────────── */
  .sentiment-track {
    height: 5px;
    border-radius: 2px;
    background: rgba(0, 0, 0, 0.08);
    overflow: hidden;
    position: relative;
  }

  .sentiment-fill {
    height: 100%;
    border-radius: 2px;
    transition: width 0.35s cubic-bezier(0.4, 0, 0.2, 1),
                background 0.35s ease;
  }

  .sentiment-score {
    font-family: var(--font-mono, 'IBM Plex Mono', monospace);
    font-size: 0.6rem;
    font-weight: 700;
    letter-spacing: 0.04em;
  }

  .sentiment-label-text {
    font-family: var(--font-mono, 'IBM Plex Mono', monospace);
    font-size: 0.55rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    opacity: 0.8;
  }


  .swatches {
    display: flex;
    gap: 3px;
  }

  .index-metric-row {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .index-metric-label-row {
    display: grid;
    grid-template-columns: 10px 1fr auto;
    align-items: center;
    gap: 5px;
  }

  .index-metric-name {
    font-family: var(--font-mono, 'IBM Plex Mono', monospace);
    font-size: 0.55rem;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: #5A3E28;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .index-metric-val {
    font-family: var(--font-mono, 'IBM Plex Mono', monospace);
    font-size: 0.6rem;
    font-weight: 700;
    letter-spacing: 0.03em;
    tabular-nums: auto;
  }

  .index-track {
    height: 4px;
    background: rgba(0, 0, 0, 0.07);
    border-radius: 2px;
    position: relative;
    overflow: hidden;
  }

  .index-zero {
    position: absolute;
    left: 50%;
    top: 0;
    bottom: 0;
    width: 1px;
    background: rgba(0, 0, 0, 0.2);
  }

  .index-fill {
    position: absolute;
    height: 100%;
    border-radius: 2px;
    transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1),
                left 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }

  /* ── Empty state ─────────────────────────────────────────────── */
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 10px;
    padding: 32px 16px;
    color: #BFA080;
    text-align: center;
    flex: 1;
  }

  /* ── Inflection detail panel ─────────────────────────────────── */
  .inflection-section {
    gap: 10px;
  }

  .infl-name-block {
    display: flex;
    flex-direction: column;
    gap: 5px;
  }

  .infl-desc {
    margin: 0;
    color: #4a5568;
    line-height: 1.5;
  }

  .infl-sub-block {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .infl-paths {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .infl-path {
    display: flex;
    flex-direction: row;
    align-items: flex-start;
    gap: 0.4rem;
    padding: 0.4rem 0.5rem;
    border-radius: 3px;
  }

  .infl-path--positive {
    background-color: rgba(40, 183, 152, 0.08);
    border-left: 2px solid #28b798;
  }

  .infl-path--negative {
    background-color: rgba(192, 57, 43, 0.07);
    border-left: 2px solid #C0392B;
  }

  .infl-path-icon {
    display: flex;
    align-items: center;
    flex-shrink: 0;
    margin-top: 2px;
  }

  .infl-path--positive .infl-path-icon { color: #28b798; }
  .infl-path--negative .infl-path-icon { color: #C0392B; }

  .infl-path-body {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
  }

  .infl-path-outcome {
    color: #5a6070;
    line-height: 1.45;
  }

  .infl-path-driver {
    color: #8090a8;
    font-style: italic;
    margin-top: 0.1rem;
    font-size: 0.65rem;
  }

  .infl-opportunity {
    display: flex;
    flex-direction: row;
    align-items: flex-start;
    gap: 0.4rem;
    padding: 0.4rem 0.5rem;
    background-color: rgba(63, 115, 255, 0.06);
    border-left: 2px solid #3f73ff;
    border-radius: 3px;
  }

  .infl-opportunity-icon {
    color: #3f73ff;
    flex-shrink: 0;
    margin-top: 2px;
  }

  .infl-data-needed {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
    padding-top: 0.5rem;
    border-top: 0.5px solid #DFC3A8;
  }
</style>