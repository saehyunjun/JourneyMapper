<script>
  /**
   * PersonaStory.svelte
   * Dynamic story screens built from persona JSON.
   * Screens are computed at runtime — any screen whose data is absent is skipped.
   *
   * Story order:
   *  1.  profile-hero    — image + quote
   *  2.  bio1            — Bio 1
   *  3.  themes          — Discussion Themes
   *  4.  bio2            — Bio 2
   *  5.  current-state   — Current State bars
   *  6.  goals-barriers  — Goals + Barriers
   *  7.  inflection-lead — Inflection step stage/step + quote
   *  8.  inflection-data — Inflection narrative + journey metrics
   *  9.  inflection-detail — Inflection detail block
   * 10.  paths           — Positive / Negative paths
   * 11.  final-lead      — Final journey step stage/step + quote
   * 12.  final-data      — Final narrative + journey metrics
   */

  import { createEventDispatcher } from 'svelte';

  import IconXRegular        from 'phosphor-icons-svelte/IconXRegular.svelte';
  import IconUserRegular     from 'phosphor-icons-svelte/IconUserRegular.svelte';
  import IconQuotesRegular   from 'phosphor-icons-svelte/IconQuotesRegular.svelte';
  import IconChatsRegular    from 'phosphor-icons-svelte/IconChatsRegular.svelte';
  import IconTargetRegular   from 'phosphor-icons-svelte/IconTargetRegular.svelte';
  import IconWarningRegular  from 'phosphor-icons-svelte/IconWarningRegular.svelte';
  import IconArrowUpRight    from 'phosphor-icons-svelte/IconArrowUpRightRegular.svelte';
  import IconArrowDownRight  from 'phosphor-icons-svelte/IconArrowDownRightRegular.svelte';
  import IconFlagRegular     from 'phosphor-icons-svelte/IconFlagRegular.svelte';
  import IconLightningRegular from 'phosphor-icons-svelte/IconLightningRegular.svelte';
  import IconPathRegular     from 'phosphor-icons-svelte/IconPathRegular.svelte';

  const dispatch = createEventDispatcher();

  export let personas    = [];
  export let activeIndex = 0;
  export let originEl    = null;
  export let open        = false;

  let screenIdx = 0;
  let imgError  = false;

  // ── Derived persona data ──────────────────────────────────────────────────
  $: persona  = personas[activeIndex] ?? null;
  $: profile  = persona?.profile ?? {};
  $: goals    = [profile.goal1, profile.goal2, profile.goal3].filter(Boolean);
  $: barriers = [profile.barrier1, profile.barrier2, profile.barrier3].filter(Boolean);
  $: themes   = persona?.discussionThemes ?? [];
  $: states   = persona?.currentState ?? [];
  $: journey  = persona?.journey ?? [];

  // Inflection step: first journey entry that has inflection_detail
  $: inflectionStep = journey.find(s => s.inflection_detail) ?? null;

  // Final step: last entry in journey array
  $: finalStep = journey.length ? journey[journey.length - 1] : null;

  // ── Dynamic screen list ───────────────────────────────────────────────────
  $: SCREENS = [
    // 1. Profile hero — needs at least a name or image
    (profile.quote || profile.imageFile)
      ? { id: 'profile-hero', label: 'Profile' }
      : null,

    // 2. Bio 1
    profile.bio_1
      ? { id: 'bio1', label: 'Background' }
      : null,

    // 3. Discussion Themes
    themes.length
      ? { id: 'themes', label: 'Discussion Themes' }
      : null,

    // 4. Bio 2
    profile.bio_2
      ? { id: 'bio2', label: 'Approach' }
      : null,

    // 5. Current State
    states.length
      ? { id: 'current-state', label: 'Current State' }
      : null,

    // 6. Goals + Barriers — show if either is present
    (goals.length || barriers.length)
      ? { id: 'goals-barriers', label: 'Goals & Barriers' }
      : null,

    // 7. Inflection lead — stage/step + step quote
    inflectionStep
      ? { id: 'inflection-lead', label: 'Key Moment' }
      : null,

    // 8. Inflection narrative + metrics
    inflectionStep
      ? { id: 'inflection-data', label: 'Experience' }
      : null,

    // 9. Inflection detail block
    inflectionStep?.inflection_detail
      ? { id: 'inflection-detail', label: 'Clinical Insight' }
      : null,

    // 10. Positive path
    inflectionStep?.inflection_detail?.paths?.some(p => p.direction === 'positive')
      ? { id: 'path-pos', label: 'Positive Path' }
      : null,

    // 11. Negative path
    inflectionStep?.inflection_detail?.paths?.some(p => p.direction === 'negative')
      ? { id: 'path-neg', label: 'Negative Path' }
      : null,

    // 11. Final step lead
    (finalStep && finalStep !== inflectionStep)
      ? { id: 'final-lead', label: 'Journey End' }
      : null,

    // 12. Final step data
    (finalStep && finalStep !== inflectionStep)
      ? { id: 'final-data', label: 'Final State' }
      : null,

  ].filter(Boolean);

  $: screen = SCREENS[screenIdx]?.id ?? '';

  $: if (open) { screenIdx = 0; imgError = false; }
  $: if (activeIndex !== undefined) imgError = false;

  // ── Navigation ────────────────────────────────────────────────────────────
  function advance() {
    if (screenIdx < SCREENS.length - 1) screenIdx++;
    else close();
  }

  function rewind() {
    if (screenIdx > 0) screenIdx--;
  }

  function close() {
    open = false;
    dispatch('close');
  }

  function onKeydown(/** @type {KeyboardEvent} */ e) {
    if (!open) return;
    if (e.key === 'ArrowRight') advance();
    else if (e.key === 'ArrowLeft') rewind();
    else if (e.key === 'Escape') close();
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  /**
   * Maps a 0–1 sentiment value (as stored in discussionThemes) to a hex/rgb
   * color using the SENTIMENT_SCALE from journeyConfig.
   * Rescales to the −5…+5 input range sentimentToColor expects.
   */
  function sentimentToColor(val) {
    // Rescale 0–1 → −5…+5
    const scaled = parseFloat(val) * 10 - 5;
    const norm   = Math.max(0, Math.min(10, scaled + 5)) / 10; // 0–1
    const SCALE  = [
      '#a50026', '#d73027', '#f46d43', '#FF9473', '#FDAE61',
      '#91C938', '#a6d96a', '#66bd63', '#1a9850', '#006837',
    ];
    const pos = norm * (SCALE.length - 1);
    const lo  = Math.floor(pos);
    const hi  = Math.min(lo + 1, SCALE.length - 1);
    const u   = pos - lo;
    const n1  = parseInt(SCALE[lo].slice(1), 16);
    const n2  = parseInt(SCALE[hi].slice(1), 16);
    const r   = Math.round(((n1 >> 16) & 255) + (((n2 >> 16) & 255) - ((n1 >> 16) & 255)) * u);
    const g   = Math.round(((n1 >>  8) & 255) + (((n2 >>  8) & 255) - ((n1 >>  8) & 255)) * u);
    const b   = Math.round(( n1        & 255) + (( n2        & 255) - ( n1        & 255)) * u);
    return `rgb(${r},${g},${b})`;
  }

  /** Average of a 0–1 sentiment array → label string */
  function avgSentimentLabel(sentiments) {
    if (!sentiments?.length) return '—';
    const avg = sentiments.reduce((a, b) => a + b, 0) / sentiments.length;
    const scaled = avg * 10 - 5;
    if (scaled >=  4) return 'Very Positive';
    if (scaled >=  2) return 'Positive';
    if (scaled >=  1) return 'Leans Positive';
    if (scaled ===  0) return 'Neutral';
    if (scaled >= -1) return 'Leans Negative';
    if (scaled >= -3) return 'Negative';
    return 'Very Negative';
  }

  // Emotional valence → color + label
  function valenceColor(v) {
    if (v >=  3) return '#23abab';
    if (v >=  1) return '#6db898';
    if (v ===  0) return '#b5b86e';
    if (v >= -2) return '#e0935c';
    return '#e05c5c';
  }
  function valenceLabel(v) {
    if (v >=  3) return 'Very Positive';
    if (v >=  1) return 'Positive';
    if (v ===  0) return 'Neutral';
    if (v >= -2) return 'Negative';
    return 'Very Negative';
  }

  // Normalise a raw journey metric (–5 … +5 typical) to 0–1 for display
  function normMetric(val, lo = -5, hi = 5) {
    if (val == null) return null;
    return Math.max(0, Math.min(1, (val - lo) / (hi - lo)));
  }

  const firstName = (name) => name?.split(' ')[0] ?? '';
</script>

<svelte:window on:keydown={onKeydown} />

{#if open && persona}

  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div class="backdrop" on:click={close} role="presentation" />

  <div
    class="story-panel jm-surface"
    role="dialog"
    aria-modal="true"
    aria-label="Persona story: {profile.name}"
  >

    <!-- Progress pips -->
    <div class="story-pips" aria-hidden="true">
      {#each SCREENS as _, i}
        <div class="pip" class:pip--active={i === screenIdx} class:pip--done={i < screenIdx} />
      {/each}
    </div>

    <!-- Header -->
    <div class="story-header">
      <div class="flex items-center gap-2">
        <div class="story-avatar" class:story-avatar--caregiver={persona.type === 'caregiver'}>
          {#if !imgError && profile.imageFile}
            <img class="story-avatar-img" src="/assets/profiles/{profile.imageFile}" alt={profile.name} on:error={() => imgError = true} />
          {:else}
            <span class="label-heading">{profile.initials ?? '?'}</span>
          {/if}
        </div>
        <div class="flex flex-col">
          <span class="label-uppercase-bold">{profile.name}</span>
          <span class="label-heading">{SCREENS[screenIdx]?.label ?? ''}</span>
        </div>
      </div>
      <button class="btn-base-sm" on:click|stopPropagation={close} aria-label="Close story">
        <IconXRegular />
      </button>
    </div>

    <!-- Invisible click zones -->
    <!-- svelte-ignore a11y-click-events-have-key-events -->
    <!-- svelte-ignore a11y-no-static-element-interactions -->
    <div class="click-zone click-zone--left"  on:click={rewind}> </div>
    <!-- svelte-ignore a11y-click-events-have-key-events -->
    <!-- svelte-ignore a11y-no-static-element-interactions -->
    <div class="click-zone click-zone--right" on:click={advance}> </div>


    <!-- ══ SCREEN: PROFILE HERO ══════════════════════════════════════════════
         Image + quote
    ═══════════════════════════════════════════════════════════════════════ -->
    {#if screen === 'profile-hero'}
      <div class="story-screen">
        <div class="bio-hero">
          {#if !imgError && profile.imageFile}
            <img class="photo-full" src="/assets/profiles/{profile.imageFile}" alt={profile.name} on:error={() => imgError = true} />
          {:else}
            <div class="bio-photo-fallback"><IconUserRegular size={72} /></div>
          {/if}
          <div class="bio-scrim" aria-hidden="true" />
          <div class="bio-overlay">
            <span class="pill-white w-fit px-2">
              {(persona.type ?? 'persona').charAt(0).toUpperCase() + (persona.type ?? 'persona').slice(1)}
            </span>
            <h2 class="heading" style="color:#fff;font-size:1.4rem">{profile.name}</h2>
          </div>
        </div>

        {#if profile.quote}
          <div class="content-wrap">
            <div class="flex justify-center"><IconQuotesRegular /></div>
            <blockquote class="pull-quote text-center" style="margin:0">{profile.quote}</blockquote>
          </div>
        {/if}
      </div>


    <!-- ══ SCREEN: BIO 1 ══════════════════════════════════════════════════════ -->
    {:else if screen === 'bio1'}
      <div class="story-screen">
        <div class="content-wrap">
          <div class="jm-kicker flex items-center gap-2">
            <IconUserRegular /> Background
          </div>
          <div class="jm-section-bar">
            <span class="label-lg">{firstName(profile.name)}'s story</span>
          </div>
          <p class="text-body-sm">{profile.bio_1}</p>
        </div>
      </div>


    <!-- ══ SCREEN: DISCUSSION THEMES ════════════════════════════════════════
         Each sentiment entry → a 5×5px square colored via sentimentToColor.
         Squares are laid out as a left-to-right row, wrapping naturally.
    ═══════════════════════════════════════════════════════════════════════ -->
    {:else if screen === 'themes'}
      <div class="story-screen">
        <div class="content-wrap">
          <div class="jm-kicker flex items-center gap-2">
            <IconChatsRegular /> Discussion Themes
          </div>
          <div class="jm-section-bar">
            <span class="label-lg capitalize">What {firstName(profile.name)} talks about</span>
          </div>

          <div class="flex flex-col gap-5">
            {#each themes as theme}
              {@const avg = theme.sentiments?.length
                ? theme.sentiments.reduce((a,b)=>a+b,0) / theme.sentiments.length
                : null}
              <div class="theme-row">

                <!-- Label + summary label -->
                <div class="theme-row-header">
                  <span class="text-body-sm" style="font-weight:500;flex:1">{theme.label}</span>
                  {#if avg != null}
                    <span class="theme-avg-label" style="color:{sentimentToColor(avg)}">
                      {avgSentimentLabel(theme.sentiments)}
                    </span>
                  {/if}
                </div>

                <!-- Pixel squares row -->
                {#if theme.sentiments?.length}
                  <div class="squares-row" aria-hidden="true">
                    {#each theme.sentiments as val}
                      <span
                        class="sentiment-sq"
                        style="background:{sentimentToColor(val)}"
                        title="{Math.round(val * 100)}"
                      />
                    {/each}
                  </div>
                {/if}

              </div>
            {/each}
          </div>

          <!-- Colour scale legend -->
          <div class="sentiment-legend" aria-label="Sentiment scale">
            <span class="label-heading" style="font-size:0.5rem;opacity:0.55">Negative</span>
            <div class="legend-strip" aria-hidden="true">
              {#each Array(20) as _, i}
                <div class="legend-cell" style="background:{sentimentToColor(i/19)}" />
              {/each}
            </div>
            <span class="label-heading" style="font-size:0.5rem;opacity:0.55">Positive</span>
          </div>

        </div>
      </div>


    <!-- ══ SCREEN: BIO 2 ══════════════════════════════════════════════════════ -->
    {:else if screen === 'bio2'}
      <div class="story-screen">
        <div class="content-wrap">
          <div class="jm-kicker flex items-center gap-2">
            <IconUserRegular /> Approach
          </div>
          <div class="jm-section-bar">
            <span class="label-lg">How {firstName(profile.name)} navigates care</span>
          </div>
          <p class="text-body-sm">{profile.bio_2}</p>
        </div>
      </div>


    <!-- ══ SCREEN: CURRENT STATE ════════════════════════════════════════════ -->
    {:else if screen === 'current-state'}
      <div class="story-screen">
        <div class="content-wrap">
          <div class="jm-kicker flex items-center gap-2">
            <IconFlagRegular /> Current State
          </div>
          <div class="jm-section-bar">
            <span class="label-lg">Where {firstName(profile.name)} stands today</span>
          </div>
          <div class="flex flex-col gap-4">
            {#each states as s}
              <div class="flex flex-col gap-1">
                <div class="flex justify-between">
                  <span class="label-heading">{s.label}</span>
                  <span class="label-heading" style="font-family:var(--font-mono)">{Math.round(s.value * 100)}</span>
                </div>
                <div class="state-track">
                  <div class="state-fill" style="width:{s.value * 100}%" />
                </div>
                <div class="flex justify-between">
                  <span class="label-heading" style="font-size:0.5rem;opacity:0.6">{s.minLabel}</span>
                  <span class="label-heading" style="font-size:0.5rem;opacity:0.6">{s.maxLabel}</span>
                </div>
              </div>
            {/each}
          </div>
        </div>
      </div>


    <!-- ══ SCREEN: GOALS + BARRIERS ═════════════════════════════════════════ -->
    {:else if screen === 'goals-barriers'}
      <div class="story-screen">
        <div class="content-wrap">

          {#if goals.length}
            <div class="jm-kicker flex items-center gap-2">
              <IconTargetRegular /> Goals
            </div>
            <div class="jm-section-bar">
              <span class="label-lg">What {firstName(profile.name)} is working toward</span>
            </div>
            <ol class="flex flex-col gap-3" style="list-style:none;padding:0;margin:0 0 20px">
              {#each goals as goal, i}
                <li class="flex gap-3 items-start">
                  <span class="item-num">{i + 1}</span>
                  <p class="text-body-sm" style="margin:0">{goal}</p>
                </li>
              {/each}
            </ol>
          {/if}

          {#if barriers.length}
            <div class="jm-kicker flex items-center gap-2">
              <IconWarningRegular /> Barriers
            </div>
            <div class="jm-section-bar">
              <span class="label-lg">What's standing in the way</span>
            </div>
            <ol class="flex flex-col gap-3" style="list-style:none;padding:0;margin:0">
              {#each barriers as barrier, i}
                <li class="flex gap-3 items-start">
                  <span class="item-num item-num--barrier">{i + 1}</span>
                  <p class="text-body-sm" style="margin:0">{barrier}</p>
                </li>
              {/each}
            </ol>
          {/if}

        </div>
      </div>


    <!-- ══ SCREEN: INFLECTION LEAD ═══════════════════════════════════════════
         Stage + step label, step-level quote
    ═══════════════════════════════════════════════════════════════════════ -->
    {:else if screen === 'inflection-lead' && inflectionStep}
      <div class="story-screen">
        <div class="journey-stage-hero">
          <div class="journey-stage-scrim" aria-hidden="true" />
          <div class="journey-stage-overlay">
            <span class="pill-white w-fit px-2" style="font-size:0.6rem;letter-spacing:0.06em">
              {inflectionStep.stage}
            </span>
            <h2 class="heading" style="color:#fff;font-size:1.2rem;line-height:1.25">
              {inflectionStep.step}
            </h2>
          </div>
        </div>

        {#if inflectionStep.quote}
          <div class="content-wrap">
            <div class="flex justify-center"><IconQuotesRegular /></div>
            <blockquote class="pull-quote text-center" style="margin:0">{inflectionStep.quote}</blockquote>
          </div>
        {/if}
      </div>


    <!-- ══ SCREEN: INFLECTION DATA ═══════════════════════════════════════════
         Narrative description + emotional valence, provider trust,
         medical self-efficacy, logistical capacity
    ═══════════════════════════════════════════════════════════════════════ -->
    {:else if screen === 'inflection-data' && inflectionStep}
      <div class="story-screen">
        <div class="content-wrap">
          <div class="jm-kicker flex items-center gap-2">
            <IconLightningRegular /> Experience
          </div>
          <div class="jm-section-bar">
            <span class="label-lg">{inflectionStep.stage} · {inflectionStep.step}</span>
          </div>

          {#if inflectionStep.narrative_description}
            <p class="text-body-sm">{inflectionStep.narrative_description}</p>
          {/if}

          <div class="metrics-grid">
            {#if inflectionStep.emotional_valence != null}
              {@const vc = valenceColor(inflectionStep.emotional_valence)}
              <div class="metric-tile">
                <span class="metric-label">Emotional Valence</span>
                <span class="metric-val" style="color:{vc}">{valenceLabel(inflectionStep.emotional_valence)}</span>
                <div class="metric-bar-track">
                  <div class="metric-bar-fill" style="width:{normMetric(inflectionStep.emotional_valence)*100}%;background:{vc}" />
                </div>
              </div>
            {/if}
            {#if inflectionStep.provider_trust != null}
              {@const n = normMetric(inflectionStep.provider_trust)}
              <div class="metric-tile">
                <span class="metric-label">Provider Trust</span>
                <span class="metric-val" style="font-family:var(--font-mono)">{inflectionStep.provider_trust > 0 ? '+' : ''}{inflectionStep.provider_trust}</span>
                <div class="metric-bar-track">
                  <div class="metric-bar-fill" style="width:{n*100}%;background:var(--ink)" />
                </div>
              </div>
            {/if}
            {#if inflectionStep.medical_self_efficacy != null}
              {@const n = normMetric(inflectionStep.medical_self_efficacy)}
              <div class="metric-tile">
                <span class="metric-label">Self-Efficacy</span>
                <span class="metric-val" style="font-family:var(--font-mono)">{inflectionStep.medical_self_efficacy > 0 ? '+' : ''}{inflectionStep.medical_self_efficacy}</span>
                <div class="metric-bar-track">
                  <div class="metric-bar-fill" style="width:{n*100}%;background:var(--ink)" />
                </div>
              </div>
            {/if}
            {#if inflectionStep.logistical_capacity != null}
              {@const n = normMetric(inflectionStep.logistical_capacity)}
              <div class="metric-tile">
                <span class="metric-label">Logistical Capacity</span>
                <span class="metric-val" style="font-family:var(--font-mono)">{inflectionStep.logistical_capacity > 0 ? '+' : ''}{inflectionStep.logistical_capacity}</span>
                <div class="metric-bar-track">
                  <div class="metric-bar-fill" style="width:{n*100}%;background:var(--ink)" />
                </div>
              </div>
            {/if}
          </div>
        </div>
      </div>


    <!-- ══ SCREEN: INFLECTION DETAIL ══════════════════════════════════════════
         inflection_detail block: label, description, risk, dropout risk,
         sponsor opportunity, data needed
    ═══════════════════════════════════════════════════════════════════════ -->
    {:else if screen === 'inflection-detail' && inflectionStep?.inflection_detail}
      {@const detail = inflectionStep.inflection_detail}
      <div class="story-screen">
        <div class="content-wrap">
          <div class="jm-kicker flex items-center gap-2">
            <IconLightningRegular /> Clinical Insight
          </div>

          {#if detail.label}
            <div class="jm-section-bar">
              <span class="label-lg">{detail.label}</span>
            </div>
          {/if}

          {#if detail.description}
            <p class="text-body-sm">{detail.description}</p>
          {/if}

          <!-- Risk badges -->
          {#if detail.risk_level || detail.dropout_risk}
            <div class="flex gap-2 flex-wrap">
              {#if detail.risk_level}
                <div class="risk-badge risk-badge--{detail.risk_level}">
                  <span class="label-heading" style="font-size:0.5rem;letter-spacing:0.08em;text-transform:uppercase;opacity:0.7">Risk</span>
                  <span class="label-heading capitalize">{detail.risk_level}</span>
                </div>
              {/if}
              {#if detail.dropout_risk}
                <div class="risk-badge risk-badge--{detail.dropout_risk}">
                  <span class="label-heading" style="font-size:0.5rem;letter-spacing:0.08em;text-transform:uppercase;opacity:0.7">Dropout Risk</span>
                  <span class="label-heading capitalize">{detail.dropout_risk}</span>
                </div>
              {/if}
            </div>
          {/if}

          {#if detail.sponsor_opportunity}
            <div class="insight-block insight-block--opportunity">
              <span class="label-uppercase-bold" style="font-size:0.55rem">Sponsor Opportunity</span>
              <p class="text-body-sm" style="margin:0">{detail.sponsor_opportunity}</p>
            </div>
          {/if}

          {#if detail.data_needed}
            <div class="insight-block insight-block--data">
              <span class="label-uppercase-bold" style="font-size:0.55rem">Data Needed</span>
              <p class="text-body-sm" style="margin:0">{detail.data_needed}</p>
            </div>
          {/if}

        </div>
      </div>


    <!-- ══ SCREEN: PATHS (POSITIVE/NEGATIVE) ══════════════════════════════════
         Positive and negative path cards, split into separate screens
    ═══════════════════════════════════════════════════════════════════════ -->
    {:else if (screen === 'path-pos' || screen === 'path-neg') && inflectionStep?.inflection_detail?.paths}
      {@const paths = inflectionStep.inflection_detail.paths.filter(p => p.direction === (screen === 'path-pos' ? 'positive' : 'negative'))}
      {@const isPosScreen = screen === 'path-pos'}
      <div class="story-screen">
        <div class="content-wrap">
          <div class="jm-kicker flex items-center gap-2">
            <IconPathRegular /> {isPosScreen ? 'Positive Path' : 'Negative Path'}
          </div>
          <div class="jm-section-bar">
            <span class="label-lg">
              {isPosScreen ? 'Best-case progression' : 'Risk trajectory'}
            </span>
          </div>

          <div class="flex flex-col gap-4">
            {#each paths as path}
              <div class="path-card path-card--{path.direction}">
                <div class="path-card-header">
                  {#if isPosScreen}
                    <IconArrowUpRight />
                  {:else}
                    <IconArrowDownRight />
                  {/if}
                  <span class="label-uppercase-bold" style="font-size:0.6rem">
                    {isPosScreen ? 'Positive Path' : 'Negative Path'}
                  </span>
                  {#if path.sentiment_delta != null}
                    <span class="path-delta"
                      class:path-delta--pos={isPosScreen}
                      class:path-delta--neg={!isPosScreen}>
                      {path.sentiment_delta > 0 ? '+' : ''}{path.sentiment_delta}
                    </span>
                  {/if}
                </div>

                {#if path.label}
                  <p class="text-body-sm" style="font-weight:600;margin:0 0 4px">{path.label}</p>
                {/if}

                {#if path.outcome}
                  <p class="text-body-sm" style="margin:0 0 6px">{path.outcome}</p>
                {/if}

                {#if path.key_driver}
                  <div class="path-driver">
                    <span class="label-heading" style="font-size:0.55rem;text-transform:uppercase;letter-spacing:0.07em;opacity:0.65">
                      Key driver
                    </span>
                    <p class="text-body-sm" style="margin:0;font-size:0.72rem">
                      {path.key_driver}
                    </p>
                  </div>
                {/if}
              </div>
            {/each}
          </div>
        </div>
      </div>


    <!-- ══ SCREEN: FINAL STEP LEAD ════════════════════════════════════════════
         Last journey step — stage/step label + quote
    ═══════════════════════════════════════════════════════════════════════ -->
    {:else if screen === 'final-lead' && finalStep}
      <div class="story-screen">
        <div class="journey-stage-hero journey-stage-hero--final">
          <div class="journey-stage-scrim" aria-hidden="true" />
          <div class="journey-stage-overlay">
            <span class="pill-white w-fit px-2" style="font-size:0.6rem;letter-spacing:0.06em">
              {finalStep.stage}
            </span>
            <h2 class="heading" style="color:#fff;font-size:1.2rem;line-height:1.25">
              {finalStep.step}
            </h2>
          </div>
        </div>

        {#if finalStep.quote}
          <div class="content-wrap">
            <div class="flex justify-center"><IconQuotesRegular /></div>
            <blockquote class="pull-quote text-center" style="margin:0">{finalStep.quote}</blockquote>
          </div>
        {/if}
      </div>


    <!-- ══ SCREEN: FINAL STEP DATA ════════════════════════════════════════════
         Final step narrative + metrics
    ═══════════════════════════════════════════════════════════════════════ -->
    {:else if screen === 'final-data' && finalStep}
      <div class="story-screen">
        <div class="content-wrap">
          <div class="jm-kicker flex items-center gap-2">
            <IconFlagRegular /> Journey End
          </div>
          <div class="jm-section-bar">
            <span class="label-lg">{finalStep.stage} · {finalStep.step}</span>
          </div>

          {#if finalStep.narrative_description}
            <p class="text-body-sm">{finalStep.narrative_description}</p>
          {/if}

          <div class="metrics-grid">
            {#if finalStep.emotional_valence != null}
              {@const vc = valenceColor(finalStep.emotional_valence)}
              <div class="metric-tile">
                <span class="metric-label">Emotional Valence</span>
                <span class="metric-val" style="color:{vc}">{valenceLabel(finalStep.emotional_valence)}</span>
                <div class="metric-bar-track">
                  <div class="metric-bar-fill" style="width:{normMetric(finalStep.emotional_valence)*100}%;background:{vc}" />
                </div>
              </div>
            {/if}
            {#if finalStep.provider_trust != null}
              {@const n = normMetric(finalStep.provider_trust)}
              <div class="metric-tile">
                <span class="metric-label">Provider Trust</span>
                <span class="metric-val" style="font-family:var(--font-mono)">{finalStep.provider_trust > 0 ? '+' : ''}{finalStep.provider_trust}</span>
                <div class="metric-bar-track">
                  <div class="metric-bar-fill" style="width:{n*100}%;background:var(--ink)" />
                </div>
              </div>
            {/if}
            {#if finalStep.medical_self_efficacy != null}
              {@const n = normMetric(finalStep.medical_self_efficacy)}
              <div class="metric-tile">
                <span class="metric-label">Self-Efficacy</span>
                <span class="metric-val" style="font-family:var(--font-mono)">{finalStep.medical_self_efficacy > 0 ? '+' : ''}{finalStep.medical_self_efficacy}</span>
                <div class="metric-bar-track">
                  <div class="metric-bar-fill" style="width:{n*100}%;background:var(--ink)" />
                </div>
              </div>
            {/if}
            {#if finalStep.logistical_capacity != null}
              {@const n = normMetric(finalStep.logistical_capacity)}
              <div class="metric-tile">
                <span class="metric-label">Logistical Capacity</span>
                <span class="metric-val" style="font-family:var(--font-mono)">{finalStep.logistical_capacity > 0 ? '+' : ''}{finalStep.logistical_capacity}</span>
                <div class="metric-bar-track">
                  <div class="metric-bar-fill" style="width:{n*100}%;background:var(--ink)" />
                </div>
              </div>
            {/if}
          </div>

          <!-- Final quote echoed at bottom of data screen -->
          {#if finalStep.quote}
            <div class="final-quote-block">
              <IconQuotesRegular />
              <p class="text-body-sm" style="font-style:italic;margin:0">{finalStep.quote}</p>
            </div>
          {/if}

        </div>
      </div>
    {/if}

    {#if screenIdx === 0}
      <div class="tap-hint">
        <span class="label-heading">Tap to advance</span>
      </div>
    {/if}

  </div>
{/if}


<style>

  /* ── Panel shell ──────────────────────────────────────────────────────── */
  .story-panel {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    z-index: 710;
    width: min(400px, 92vw);
    height: min(680px, 88vh);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  /* ── Progress pips ────────────────────────────────────────────────────── */
  .story-pips {
    display: flex;
    gap: 3px;
    padding: 10px 12px 0;
    flex-shrink: 0;
    position: relative;
    z-index: 2;
  }
  .pip {
    flex: 1;
    height: 2px;
    border-radius: 2px;
    background: rgba(49, 47, 40, 0.15);
    transition: background 200ms;
  }
  .pip--done   { background: rgba(49, 47, 40, 0.45); }
  .pip--active { background: var(--ink, #312F28); }

  /* ── Header ───────────────────────────────────────────────────────────── */
  .story-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 10px 6px 12px;
    flex-shrink: 0;
    position: relative;
    z-index: 2;
  }

  /* ── Avatar ───────────────────────────────────────────────────────────── */
  .story-avatar {
    width: 34px; height: 34px;
    border-radius: 50%;
    border: 2px solid var(--ink, #312F28);
    overflow: hidden;
    flex-shrink: 0;
    background: #e8e5de;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .story-avatar--caregiver { border-color: var(--teal, #23abab); }
  .story-avatar-img { width: 100%; height: 100%; object-fit: cover; }

  /* ── Click zones ──────────────────────────────────────────────────────── */
  .click-zone {
    position: absolute;
    top: 80px; bottom: 0;
    z-index: 5;
    cursor: pointer;
  }
  .click-zone--left  { left: 0;  width: 38%; }
  .click-zone--right { right: 0; width: 62%; }

  /* ── Story screen wrapper ─────────────────────────────────────────────── */
  .story-screen {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    overscroll-behavior: contain;
    position: relative;
    z-index: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }

  /* ── Hero image block (profile + inflection + final) ─────────────────── */
  .bio-hero,
  .journey-stage-hero {
    position: relative;
    width: 100%;
    height: 220px;
    flex-shrink: 0;
    background: #2a2825;
    overflow: hidden;
  }
  .journey-stage-hero { background: #1e2c2c; }
  .journey-stage-hero--final { background: #1e1e2c; }

  .photo-full {
    width: 100%; height: 100%;
    object-fit: cover;
    object-position: top center;
    display: block;
  }
  .bio-photo-fallback {
    width: 100%; height: 100%;
    display: flex; align-items: center; justify-content: center;
    color: #b0a898;
  }

  .bio-scrim,
  .journey-stage-scrim {
    position: absolute; inset: 0;
    background: linear-gradient(to bottom, transparent 30%, rgba(0,0,0,0.72) 100%);
  }

  .bio-overlay,
  .journey-stage-overlay {
    position: absolute;
    bottom: 0; left: 0; right: 0;
    padding: 12px 16px;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  /* ── Content wrap (scrollable body beneath hero or standalone) ────────── */
  .content-wrap {
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    flex: 1;
  }

  /* ── State / metric bars ──────────────────────────────────────────────── */
  .state-track,
  .metric-bar-track {
    height: 4px;
    border-radius: 2px;
    background: rgba(0,0,0,0.1);
    overflow: hidden;
  }
  .state-fill,
  .metric-bar-fill {
    height: 100%;
    border-radius: 2px;
    background: var(--ink);
    transition: width 0.4s cubic-bezier(0.4,0,0.2,1);
  }

  /* ── Metrics 2-col grid ───────────────────────────────────────────────── */
  .metrics-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }
  .metric-tile {
    background: rgba(49,47,40,0.05);
    border: 1px solid rgba(49,47,40,0.1);
    border-radius: 6px;
    padding: 8px 10px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .metric-label {
    font-size: 0.55rem;
    font-weight: 600;
    letter-spacing: 0.07em;
    text-transform: uppercase;
    opacity: 0.55;
    font-family: var(--font-mono);
  }
  .metric-val {
    font-size: 0.75rem;
    font-weight: 600;
    line-height: 1;
  }

  /* ── Goals / Barriers item badges ────────────────────────────────────── */
  .item-num {
    font-family: var(--font-mono);
    font-size: 0.7rem;
    font-weight: 700;
    color: var(--ink);
    background: rgba(49,47,40,0.08);
    border-radius: 4px;
    width: 22px; height: 22px;
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0;
  }
  .item-num--barrier {
    background: rgba(224,92,92,0.12);
    color: #b83232;
  }

  /* ── Insight blocks (sponsor opportunity / data needed) ──────────────── */
  .insight-block {
    border-radius: 6px;
    padding: 10px 12px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .insight-block--opportunity {
    background: rgba(35,171,171,0.07);
    border: 1px solid rgba(35,171,171,0.2);
  }
  .insight-block--data {
    background: rgba(181,184,110,0.08);
    border: 1px solid rgba(181,184,110,0.25);
  }

  /* ── Risk badges ──────────────────────────────────────────────────────── */
  .risk-badge {
    display: flex;
    flex-direction: column;
    gap: 1px;
    padding: 5px 10px;
    border-radius: 6px;
    border: 1px solid;
    min-width: 72px;
  }
  .risk-badge--high,
  .risk-badge--moderate {
    background: rgba(224,92,92,0.08);
    border-color: rgba(224,92,92,0.3);
    color: #b83232;
  }
  .risk-badge--low {
    background: rgba(109,184,152,0.08);
    border-color: rgba(109,184,152,0.3);
    color: #2e7d5c;
  }

  /* ── Path cards ───────────────────────────────────────────────────────── */
  .path-card {
    border-radius: 8px;
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    border: 1px solid;
  }
  .path-card--positive {
    background: rgba(35,171,171,0.06);
    border-color: rgba(35,171,171,0.2);
  }
  .path-card--negative {
    background: rgba(224,92,92,0.06);
    border-color: rgba(224,92,92,0.2);
  }
  .path-card-header {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .path-delta {
    margin-left: auto;
    font-family: var(--font-mono);
    font-size: 0.7rem;
    font-weight: 700;
    padding: 1px 6px;
    border-radius: 4px;
  }
  .path-delta--pos { background: rgba(35,171,171,0.15); color: #1a8080; }
  .path-delta--neg { background: rgba(224,92,92,0.15);  color: #b83232; }
  .path-driver {
    margin-top: 2px;
    padding: 7px 9px;
    border-radius: 4px;
    background: rgba(49,47,40,0.05);
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  /* ── Final quote echo ─────────────────────────────────────────────────── */
  .final-quote-block {
    display: flex;
    gap: 8px;
    align-items: flex-start;
    padding: 10px 12px;
    border-radius: 6px;
    background: rgba(49,47,40,0.05);
    border: 1px solid rgba(49,47,40,0.1);
    margin-top: 4px;
  }

  /* ── Tap hint ─────────────────────────────────────────────────────────── */
  .tap-hint {
    position: absolute;
    bottom: 12px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 6;
    pointer-events: none;
    opacity: 0.45;
    white-space: nowrap;
  }

  /* ── Discussion theme rows ────────────────────────────────────────────── */
  .theme-row {
    display: flex;
    flex-direction: column;
    gap: 5px;
  }
  .theme-row-header {
    display: flex;
    align-items: baseline;
    gap: 8px;
  }
  .theme-avg-label {
    font-size: 0.58rem;
    font-weight: 600;
    letter-spacing: 0.04em;
    flex-shrink: 0;
    font-family: var(--font-mono);
  }

  /* Row of 5×5 sentiment squares */
  .squares-row {
    display: flex;
    flex-wrap: wrap;
    gap: 2px;
  }
  .sentiment-sq {
    display: inline-block;
    width: 1em;
    height: 1em;
    border-radius: 1px;
    flex-shrink: 0;
  }

  /* Gradient legend at the bottom of the themes screen */
  .sentiment-legend {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 4px;
  }
  .legend-strip {
    flex: 1;
    display: flex;
    height: 4px;
    border-radius: 2px;
    overflow: hidden;
  }
  .legend-cell {
    flex: 1;
    height: 100%;
  }
</style>