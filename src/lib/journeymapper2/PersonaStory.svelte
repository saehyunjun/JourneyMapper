<script>
  /**
   * PersonaStory.svelte
   * Dynamic story screens built from persona JSON.
   * Screens are computed at runtime — any screen whose data is absent is skipped.
   */

  import { createEventDispatcher } from 'svelte';
  import { highlightAll } from './textUtils.js';

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

  $: inflectionStep = journey.find(s => s.inflection_detail) ?? null;
  $: finalStep = journey.length ? journey[journey.length - 1] : null;

  // ── Dynamic screen list ───────────────────────────────────────────────────
  $: SCREENS = [
    profile.name
      ? { id: 'intro', label: 'Introduction' }
      : null,
    (profile.quote || profile.imageFile)
      ? { id: 'key-quote', label: 'Key Quote' }
      : null,
    profile.bio_1
      ? { id: 'event-1', label: 'Inciting Event' }
      : null,
    themes.length
      ? { id: 'themes', label: 'Discussion Themes' }
      : null,
    profile.bio_2
      ? { id: 'bio2', label: 'Approach' }
      : null,
    states.length
      ? { id: 'current-state', label: 'Current State' }
      : null,
    goals.length
      ? { id: 'goal', label: 'Goals' }
      : null,
    barriers.length
      ? { id: 'barrier', label: 'Barriers' }
      : null,
    inflectionStep
      ? { id: 'inflection-lead', label: 'Key Moment' }
      : null,
    inflectionStep
      ? { id: 'inflection-data', label: 'Experience' }
      : null,
    inflectionStep?.inflection_detail
      ? { id: 'inflection-detail', label: 'Clinical Insight' }
      : null,
    inflectionStep?.inflection_detail?.paths?.some(p => p.direction === 'positive')
      ? { id: 'path-pos', label: 'Positive Path' }
      : null,
    inflectionStep?.inflection_detail?.paths?.some(p => p.direction === 'negative')
      ? { id: 'path-neg', label: 'Negative Path' }
      : null,
    (finalStep && finalStep !== inflectionStep)
      ? { id: 'final-lead', label: 'Journey End' }
      : null,
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
  function sentimentToColor(val) {
    const scaled = parseFloat(val) * 10 - 5;
    const norm   = Math.max(0, Math.min(10, scaled + 5)) / 10;
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

  function avgSentimentLabel(sentiments) {
    if (!sentiments?.length) return '—';
    const avg    = sentiments.reduce((a, b) => a + b, 0) / sentiments.length;
    const scaled = avg * 10 - 5;
    if (scaled >=  4) return 'Very Positive';
    if (scaled >=  2) return 'Positive';
    if (scaled >=  1) return 'Leans Positive';
    if (scaled ===  0) return 'Neutral';
    if (scaled >= -1) return 'Leans Negative';
    if (scaled >= -3) return 'Negative';
    return 'Very Negative';
  }

  function valenceColor(v) {
    if (v >=  3) return 'var(--teal)';
    if (v >=  1) return 'var(--green)';
    if (v ===  0) return 'var(--gray)';
    if (v >= -2) return 'var(--orange)';
    return 'var(--red)';
  }
  function valenceLabel(v) {
    if (v >=  3) return 'Very Positive';
    if (v >=  1) return 'Positive';
    if (v ===  0) return 'Neutral';
    if (v >= -2) return 'Negative';
    return 'Very Negative';
  }

  function normMetric(val, lo = -5, hi = 5) {
    if (val == null) return null;
    return Math.max(0, Math.min(1, (val - lo) / (hi - lo)));
  }

  const firstName = (name) => name?.split(' ')[0] ?? '';

  const STATE_BAR_COLORS = [
    '#5B8DB8', '#7CB98A', '#C47E5A', '#9B7EC8', '#C4A84F', '#5BADA8',
  ];
  const stateBarColor = (i) => STATE_BAR_COLORS[i % STATE_BAR_COLORS.length];
</script>

<svelte:window on:keydown={onKeydown} />

{#if open && persona}

  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div class="backdrop" on:click={close} role="presentation"></div>

  <div
    class="story-panel jm-surface"
    role="dialog"
    aria-modal="true"
    aria-label="Persona story: {profile.name}"
  >

    <!-- Progress pips -->
    <div class="flex flex-row gap-1 pt-2 pl-1 pr-2" aria-hidden="true">
      {#each SCREENS as _, i}
        <div class="pip" class:pip--active={i === screenIdx} class:pip--done={i < screenIdx}></div>
      {/each}
    </div>

    <!-- Header -->
    <div class="jm-content-row pt-2 px-2">
      <div
        class="persona-avatar-sm"
        class:persona-avatar-sm--caregiver={persona.type === 'caregiver'}
      >
        {#if !imgError && profile.imageFile}
          <img class="persona-avatar-sm-img" src="/assets/profiles/{profile.imageFile}" alt={profile.name} on:error={() => imgError = true} />
        {:else}
          <span class="label-sm">{profile.initials ?? '?'}</span>
        {/if}
      </div>

      <div class="flex flex-col items-end">
        <span class="label uppercase">{profile.name}</span>
        <span class="label-sm">{SCREENS[screenIdx]?.label ?? ''}</span>
      </div>
    </div>

    <!-- Click zones -->
    <!-- svelte-ignore a11y-click-events-have-key-events -->
    <!-- svelte-ignore a11y-no-static-element-interactions -->
    <div class="click-zone click-zone--left"  on:click={rewind}></div>
    <!-- svelte-ignore a11y-click-events-have-key-events -->
    <!-- svelte-ignore a11y-no-static-element-interactions -->
    <div class="click-zone click-zone--right" on:click={advance}></div>


    <!-- ══ INTRO ══════════════════════════════════════════════════════════════ -->
    {#if screen === 'intro'}
      <div class="story-screen">
        <div class="content-wrap items-center text-center">
          <div class="aspect-3/2 object-cover">
            {#if !imgError && profile.imageFile}
              <img
                class="persona-avatar-sm-img"
                src="/assets/profiles/{profile.imageFile}"
                alt={profile.name}
                on:error={() => imgError = true}
              />
            {:else}
              <span class="label-sm">{profile.initials ?? '?'}</span>
            {/if}
          </div>
          <p class="pull-quote text-center px-4">
            {profile.name} is a <span class="underline underline-offset-3">{persona.type ?? 'persona'}</span>
            living with <span class="underline underline-offset-3 lowercase">{profile.indication}</span>
            in {profile.gender === 'Male' ? 'his' : profile.gender === 'Female' ? 'her' : 'their'}
            {profile.age ?? '—'}, who hopes to
            <span class="underline underline-offset-3 lowercase">{profile.preference ?? '—'}</span>.
          </p>
        </div>
      </div>


    <!-- ══ KEY QUOTE ══════════════════════════════════════════════════════════ -->
    {:else if screen === 'key-quote'}
      <div class="story-screen">
        {#if profile.quote}
          <div class="content-wrap stats-animation-gradient__gradient--night">
            <div class="flex flex-col justify-center pt-8 items-center">
              <IconQuotesRegular class="text-white mb-8" />
              <blockquote class="pull-quote-lg text-center text-white px-4">
                {profile.quote}
              </blockquote>
            </div>
          </div>
        {/if}
      </div>


    <!-- ══ BIO 1 ══════════════════════════════════════════════════════════════ -->
    {:else if screen === 'event-1'}
      <div class="story-screen">
        <div class="content-wrap">
          <div class="flex flex-col gap-4">
            <h2 class="heading-serif-md">How It Began</h2>
            <p class="text-body">{@html highlightAll(profile.bio_1)}</p>
          </div>
        </div>
      </div>


    <!-- ══ DISCUSSION THEMES ══════════════════════════════════════════════════ -->
    {:else if screen === 'themes'}
      <div class="story-screen">
        <div class="content-wrap">
          <h2 class="heading-serif-md">Topics {firstName(profile.name)} discusses most</h2>
          <div class="flex flex-col gap-4">
            {#each themes as theme}
              {@const avg = theme.sentiments?.length
                ? theme.sentiments.reduce((a, b) => a + b, 0) / theme.sentiments.length
                : null}
              <div class="flex flex-col gap-1">
                <div class="jm-content-row">
                  <span class="label-sm uppercase">{theme.label}</span>
                  {#if avg != null}
                    <span class="pill-sm" style="color:{sentimentToColor(avg)};border-color:{sentimentToColor(avg)};">
                      {avgSentimentLabel(theme.sentiments)}
                    </span>
                  {/if}
                </div>
                {#if theme.sentiments?.length}
                  <div class="flex flex-row gap-1" aria-hidden="true">
                    {#each theme.sentiments as val}
                      <span class="jm-swatch" style="background:{sentimentToColor(val)}" title="{Math.round(val * 100)}"></span>
                    {/each}
                  </div>
                {/if}
              </div>
            {/each}
          </div>

          <div class="sentiment-legend" aria-label="Sentiment scale">
            <span class="label-sm">Negative</span>
            <div class="legend-strip" aria-hidden="true">
              {#each Array(20) as _, i}
                <div class="legend-cell" style="background:{sentimentToColor(i/19)}"></div>
              {/each}
            </div>
            <span class="label-sm">Positive</span>
          </div>
        </div>
      </div>


    <!-- ══ BIO 2 ══════════════════════════════════════════════════════════════ -->
    {:else if screen === 'bio2'}
      <div class="story-screen">
        <div class="content-wrap">
          <h2 class="heading-serif-md">How {firstName(profile.name)} navigates care</h2>
          <p class="text-body">{@html highlightAll(profile.bio_2)}</p>
        </div>
      </div>


    <!-- ══ CURRENT STATE ══════════════════════════════════════════════════════ -->
    {:else if screen === 'current-state'}
      <div class="story-screen">
        <div class="content-wrap">
          <h2 class="heading-serif-md">Where {firstName(profile.name)} stands today</h2>
          <div class="flex flex-col gap-4">
            {#each states as s, i}
              {@const color = stateBarColor(i)}
              {@const leansMax = s.value > 0.5}
              {@const leansMin = s.value < 0.5}
              <div class="flex flex-col gap-1">
                <span class="label-sm">{s.label}</span>
                <div class="sentiment-track">
                  <div class="sentiment-fill" style="width:{s.value * 100}%;background:{color};"></div>
                </div>
                <div class="jm-content-row">
                  <span class="label-sm" style="{leansMin ? `opacity:1;font-weight:700;color:${color}` : 'opacity:0.4'}">{s.minLabel}</span>
                  <span class="label-sm" style="{leansMax ? `opacity:1;font-weight:700;color:${color}` : 'opacity:0.4'}">{s.maxLabel}</span>
                </div>
              </div>
            {/each}
          </div>
        </div>
      </div>


    <!-- ══ GOALS ══════════════════════════════════════════════════════════════ -->
    {:else if screen === 'goal'}
      <div class="story-screen">
        <div class="content-wrap">
          <h2 class="heading-serif-md" style="color:var(--green)">{firstName(profile.name)}'s Key Goals</h2>
          <ol class="flex flex-col gap-3">
            {#each goals as goal, i}
              <li class="flex gap-3 items-start">
                <span class="icon-toolbar-dark-sm label-sm flex-shrink-0">{i + 1}</span>
                <p class="text-body">{goal}</p>
              </li>
            {/each}
          </ol>
        </div>
      </div>


    <!-- ══ BARRIERS ═══════════════════════════════════════════════════════════ -->
    {:else if screen === 'barrier'}
      <div class="story-screen">
        <div class="content-wrap">
          <h2 class="heading-serif-md">What's standing in the way</h2>
          <ol class="flex flex-col gap-3">
            {#each barriers as barrier, i}
              <li class="flex gap-3 items-start">
                <span class="icon-toolbar-red-sm label-sm flex-shrink-0">{i + 1}</span>
                <p class="text-body-sm">{barrier}</p>
              </li>
            {/each}
          </ol>
        </div>
      </div>


    <!-- ══ INFLECTION LEAD ════════════════════════════════════════════════════ -->
    {:else if screen === 'inflection-lead' && inflectionStep}
      <div class="story-screen">
        <div class="journey-stage-hero">
          <div class="journey-stage-scrim" aria-hidden="true"></div>
          <div class="journey-stage-overlay">
            <span class="pill-white w-fit">{inflectionStep.stage}</span>
            <h2 class="heading-serif-md" style="color:#fff">{inflectionStep.step}</h2>
          </div>
        </div>
        {#if inflectionStep.quote}
          <div class="content-wrap">
            <div class="flex justify-center"><IconQuotesRegular class="quote-icon" /></div>
            <blockquote class="pull-quote text-center">{inflectionStep.quote}</blockquote>
          </div>
        {/if}
      </div>


    <!-- ══ INFLECTION DATA ════════════════════════════════════════════════════ -->
    {:else if screen === 'inflection-data' && inflectionStep}
      <div class="story-screen">
        <div class="content-wrap">
          <div class="jm-kicker flex items-center gap-2">
            <IconLightningRegular /> Experience
          </div>
          <div class="toolbar-sm-empty">
            <span class="label-sm">{inflectionStep.stage} · {inflectionStep.step}</span>
          </div>
          {#if inflectionStep.narrative_description}
            <p class="text-body-sm">{inflectionStep.narrative_description}</p>
          {/if}
          <div class="metrics-grid">
            {#if inflectionStep.emotional_valence != null}
              {@const vc = valenceColor(inflectionStep.emotional_valence)}
              <div class="metric-tile">
                <span class="label-sm">Emotional Valence</span>
                <span class="label font-semibold" style="color:{vc}">{valenceLabel(inflectionStep.emotional_valence)}</span>
                <div class="sentiment-track">
                  <div class="sentiment-fill" style="width:{normMetric(inflectionStep.emotional_valence)*100}%;background:{vc}"></div>
                </div>
              </div>
            {/if}
            {#if inflectionStep.provider_trust != null}
              <div class="metric-tile">
                <span class="label-sm">Provider Trust</span>
                <span class="label font-semibold" style="font-family:var(--font-mono)">{inflectionStep.provider_trust > 0 ? '+' : ''}{inflectionStep.provider_trust}</span>
                <div class="sentiment-track">
                  <div class="sentiment-fill" style="width:{normMetric(inflectionStep.provider_trust)*100}%;background:var(--grayblue)"></div>
                </div>
              </div>
            {/if}
            {#if inflectionStep.medical_self_efficacy != null}
              <div class="metric-tile">
                <span class="label-sm">Self-Efficacy</span>
                <span class="label font-semibold" style="font-family:var(--font-mono)">{inflectionStep.medical_self_efficacy > 0 ? '+' : ''}{inflectionStep.medical_self_efficacy}</span>
                <div class="sentiment-track">
                  <div class="sentiment-fill" style="width:{normMetric(inflectionStep.medical_self_efficacy)*100}%;background:var(--grayblue)"></div>
                </div>
              </div>
            {/if}
            {#if inflectionStep.logistical_capacity != null}
              <div class="metric-tile">
                <span class="label-sm">Logistical Capacity</span>
                <span class="label font-semibold" style="font-family:var(--font-mono)">{inflectionStep.logistical_capacity > 0 ? '+' : ''}{inflectionStep.logistical_capacity}</span>
                <div class="sentiment-track">
                  <div class="sentiment-fill" style="width:{normMetric(inflectionStep.logistical_capacity)*100}%;background:var(--grayblue)"></div>
                </div>
              </div>
            {/if}
          </div>
        </div>
      </div>


    <!-- ══ INFLECTION DETAIL ══════════════════════════════════════════════════ -->
    {:else if screen === 'inflection-detail' && inflectionStep?.inflection_detail}
      {@const detail = inflectionStep.inflection_detail}
      <div class="story-screen">
        <div class="content-wrap">
          <div class="jm-kicker flex items-center gap-2">
            <IconLightningRegular /> Clinical Insight
          </div>
          {#if detail.label}
            <div class="toolbar-sm-empty">
              <span class="label-sm">{detail.label}</span>
            </div>
          {/if}
          {#if detail.description}
            <p class="text-body-sm">{detail.description}</p>
          {/if}

          {#if detail.risk_level || detail.dropout_risk}
            <div class="flex gap-2 flex-wrap">
              {#if detail.risk_level}
                <div class="risk-badge risk-badge--{detail.risk_level}">
                  <span class="label-sm opacity-60">Risk</span>
                  <span class="label capitalize">{detail.risk_level}</span>
                </div>
              {/if}
              {#if detail.dropout_risk}
                <div class="risk-badge risk-badge--{detail.dropout_risk}">
                  <span class="label-sm opacity-60">Dropout Risk</span>
                  <span class="label uppercase">{detail.dropout_risk}</span>
                </div>
              {/if}
            </div>
          {/if}

          {#if detail.sponsor_opportunity}
            <div class="insight-block--opportunity flex flex-col gap-1 rounded-md p-3">
              <span class="label-sm uppercase">Sponsor Opportunity</span>
              <p class="text-body-sm" style="margin:0">{detail.sponsor_opportunity}</p>
            </div>
          {/if}
          {#if detail.data_needed}
            <div class="insight-block--data flex flex-col gap-1 rounded-md p-3">
              <span class="label-sm uppercase">Data Needed</span>
              <p class="text-body-sm" style="margin:0">{detail.data_needed}</p>
            </div>
          {/if}
        </div>
      </div>


    <!-- ══ PATH — POSITIVE ════════════════════════════════════════════════════ -->
    {:else if screen === 'path-pos' && inflectionStep?.inflection_detail?.paths}
      {@const paths = inflectionStep.inflection_detail.paths.filter(p => p.direction === 'positive')}
      <div class="story-screen path-screen" style="background:color-mix(in srgb, var(--midgreen) 14%, var(--paper));">
        <div class="path-wrap">
          <div class="toolbar-sm-empty mb-2">
            <IconArrowUpRight class="icon-toolbar-dark-sm" />
            <span class="label-sm uppercase">Positive Path Opportunities</span>
          </div>
          <div class="flex flex-col gap-3">
            {#each paths as path}
              <div class="path-card path-card--pos">
                <div class="flex items-center gap-2">
                  <IconArrowUpRight class="icon-toolbar-dark-sm flex-shrink-0" />
                  {#if path.label}
                    <span class="label-sm uppercase">{path.label}</span>
                  {/if}
                </div>
                {#if path.outcome}
                  <p class="text-body-sm">{path.outcome}</p>
                {/if}
                {#if path.key_driver}
                  <div class="path-driver">
                    <span class="label-sm uppercase">Key driver</span>
                    <p class="text-body-sm">{path.key_driver}</p>
                  </div>
                {/if}
              </div>
            {/each}
          </div>
        </div>
      </div>


    <!-- ══ PATH — NEGATIVE ════════════════════════════════════════════════════ -->
    {:else if screen === 'path-neg' && inflectionStep?.inflection_detail?.paths}
      {@const paths = inflectionStep.inflection_detail.paths.filter(p => p.direction === 'negative')}
      <div class="story-screen path-screen" style="background:color-mix(in srgb, var(--red) 7%, var(--paper));">
        <div class="path-wrap">
          <div class="toolbar-sm-empty mb-2">
            <IconArrowDownRight class="icon-toolbar-red-sm" />
            <span class="label-sm uppercase">Negative Path Risks</span>
          </div>
          <div class="flex flex-col gap-3">
            {#each paths as path}
              <div class="path-card path-card--neg">
                <div class="flex items-center gap-2">
                  <IconArrowDownRight class="icon-toolbar-red-sm flex-shrink-0" />
                  {#if path.label}
                    <span class="label-sm uppercase">{path.label}</span>
                  {/if}
                </div>
                {#if path.outcome}
                  <p class="text-body-sm">{path.outcome}</p>
                {/if}
                {#if path.key_driver}
                  <div class="path-driver">
                    <span class="label-sm uppercase">Key driver</span>
                    <p class="text-body-sm">{path.key_driver}</p>
                  </div>
                {/if}
              </div>
            {/each}
          </div>
        </div>
      </div>


    <!-- ══ FINAL LEAD ══════════════════════════════════════════════════════════ -->
    {:else if screen === 'final-lead' && finalStep}
      <div class="story-screen">
        <div class="journey-stage-hero">
          <div class="journey-stage-scrim" aria-hidden="true"></div>
          <div class="journey-stage-overlay">
            <span class="pill-white w-fit">{finalStep.stage}</span>
            <h2 class="heading-serif-md" style="color:#fff">{finalStep.step}</h2>
          </div>
        </div>
        {#if finalStep.quote}
          <div class="content-wrap">
            <div class="flex justify-center"><IconQuotesRegular class="quote-icon" /></div>
            <blockquote class="pull-quote text-center">{finalStep.quote}</blockquote>
          </div>
        {/if}
      </div>


    <!-- ══ FINAL DATA ══════════════════════════════════════════════════════════ -->
    {:else if screen === 'final-data' && finalStep}
      <div class="story-screen">
        <div class="content-wrap">
          <div class="jm-kicker flex items-center gap-2">
            <IconFlagRegular /> Journey End
          </div>
          <div class="toolbar-sm-empty">
            <span class="label-sm">{finalStep.stage} · {finalStep.step}</span>
          </div>
          {#if finalStep.narrative_description}
            <p class="text-body-sm">{finalStep.narrative_description}</p>
          {/if}
          <div class="metrics-grid">
            {#if finalStep.emotional_valence != null}
              {@const vc = valenceColor(finalStep.emotional_valence)}
              <div class="metric-tile">
                <span class="label-sm">Emotional Valence</span>
                <span class="label font-semibold" style="color:{vc}">{valenceLabel(finalStep.emotional_valence)}</span>
                <div class="sentiment-track">
                  <div class="sentiment-fill" style="width:{normMetric(finalStep.emotional_valence)*100}%;background:{vc}"></div>
                </div>
              </div>
            {/if}
            {#if finalStep.provider_trust != null}
              <div class="metric-tile">
                <span class="label-sm">Provider Trust</span>
                <span class="label" style="font-family:var(--font-mono)">{finalStep.provider_trust > 0 ? '+' : ''}{finalStep.provider_trust}</span>
                <div class="sentiment-track">
                  <div class="sentiment-fill" style="width:{normMetric(finalStep.provider_trust)*100}%;background:var(--grayblue)"></div>
                </div>
              </div>
            {/if}
            {#if finalStep.medical_self_efficacy != null}
              <div class="metric-tile">
                <span class="label-sm">Self-Efficacy</span>
                <span class="label" style="font-family:var(--font-mono)">{finalStep.medical_self_efficacy > 0 ? '+' : ''}{finalStep.medical_self_efficacy}</span>
                <div class="sentiment-track">
                  <div class="sentiment-fill" style="width:{normMetric(finalStep.medical_self_efficacy)*100}%;background:var(--grayblue)"></div>
                </div>
              </div>
            {/if}
            {#if finalStep.logistical_capacity != null}
              <div class="metric-tile">
                <span class="label-sm">Logistical Capacity</span>
                <span class="label" style="font-family:var(--font-mono)">{finalStep.logistical_capacity > 0 ? '+' : ''}{finalStep.logistical_capacity}</span>
                <div class="sentiment-track">
                  <div class="sentiment-fill" style="width:{normMetric(finalStep.logistical_capacity)*100}%;background:var(--grayblue)"></div>
                </div>
              </div>
            {/if}
          </div>

          {#if finalStep.quote}
            <div class="card-quote flex flex-row gap-2 p-3 mt-2">
              <IconQuotesRegular class="quote-icon flex-shrink-0" />
              <p class="text-body-sm" style="font-style:italic;margin:0">{finalStep.quote}</p>
            </div>
          {/if}
        </div>
      </div>
    {/if}

    {#if screenIdx === 0}
      <div class="tap-hint">
        <span class="label-sm">Tap to advance</span>
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
    border-radius: 10px;
    border: 2.5px solid var(--grayblue);
  }

  /* ── Progress pips ────────────────────────────────────────────────────── */
  .pip {
    flex: 1;
    height: .25em;
    background: var(--panel-dark);
    transition: background 200ms;
  }
  .pip--done   { background: var(--grayblue); }
  .pip--active { background: var(--orange); }

  /* ── Click zones ──────────────────────────────────────────────────────── */
  .click-zone {
    position: absolute;
    top: 80px; bottom: 0;
    z-index: 5;
    cursor: pointer;
  }
  .click-zone--left  { left: 0;  width: 38%; }
  .click-zone--right { right: 0; width: 62%; }

  /* ── Story screen ─────────────────────────────────────────────────────── */
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
    transition: background 300ms ease;
  }

  /* ── Hero image block ─────────────────────────────────────────────────── */
  .journey-stage-hero {
    position: relative;
    width: 100%;
    height: 200px;
    flex-shrink: 0;
    background: var(--graybluedark);
    overflow: hidden;
  }
  .journey-stage-scrim {
    position: absolute; inset: 0;
    background: linear-gradient(to bottom, transparent 30%, rgba(0,0,0,0.68) 100%);
  }
  .journey-stage-overlay {
    position: absolute;
    bottom: 0; left: 0; right: 0;
    padding: 12px 16px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  /* ── Metrics 2-col grid ───────────────────────────────────────────────── */
  .metrics-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
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

  /* ── Insight blocks ───────────────────────────────────────────────────── */
  .insight-block--opportunity {
    background: rgba(35,171,171,0.07);
    border: 1px solid rgba(35,171,171,0.2);
  }
  .insight-block--data {
    background: rgba(181,184,110,0.08);
    border: 1px solid rgba(181,184,110,0.25);
  }

  /* ── Sentiment legend (themes screen) ────────────────────────────────── */
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
  .legend-cell { flex: 1; height: 100%; }

  /* ── Path screens ─────────────────────────────────────────────────────── */
  /* Override story-screen so it doesn't stretch — content sits at top */
  .path-screen {
    justify-content: flex-start;
  }

  /* Padding wrapper that replaces content-wrap for path screens */
  .path-wrap {
    padding: 1em;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    width: 100%;
  }

  /* Full-width card replacing card-sm (which has fixed 250px width) */
  .path-card {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    width: 100%;
    padding: 0.75rem;
    border-radius: 6px;
    border: 1.25px solid;
    background-color: var(--paper);
    box-shadow: rgba(55, 39, 37, 0.05) 0 4px 12px;
  }
  .path-card--pos {
    border-color: var(--midgreen);
    background-color: color-mix(in srgb, var(--midgreen) 6%, var(--paper));
  }
  .path-card--neg {
    border-color: rgba(224, 92, 92, 0.4);
    background-color: color-mix(in srgb, var(--red) 4%, var(--paper));
  }

  /* Key driver block inside a path card */
  .path-driver {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    padding-top: 0.5rem;
    margin-top: 0.25rem;
    border-top: 0.5px solid var(--panel-mid);
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
</style>