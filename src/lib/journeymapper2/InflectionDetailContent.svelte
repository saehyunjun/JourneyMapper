<script>
  import { selectedInflectionIndex, selectedInflectionPath } from './journeyStore.js';
  import { sentimentToColor, ratingToLabel, emotionColor, DYAD_BY_ID, SCORE_ALIASES, SENTIMENT_SCALE } from './journeyConfig.js';

  import IconArrowsOutLineVerticalRegular from 'phosphor-icons-svelte/IconArrowsOutLineVerticalRegular.svelte';
  import IconArrowUpRegular               from 'phosphor-icons-svelte/IconArrowUpRegular.svelte';
  import IconArrowDownRegular             from 'phosphor-icons-svelte/IconArrowDownRegular.svelte';
  import IconWarningRegular               from 'phosphor-icons-svelte/IconWarningRegular.svelte';
  import IconLightbulbRegular             from 'phosphor-icons-svelte/IconLightbulbRegular.svelte';
  import ArrowSquareOutRegular            from 'phosphor-icons-svelte/IconArrowSquareOutRegular.svelte';

  /** Full flat journey data array */
  export let data = [];
  export let onopenEmotionDetail = () => {};


  // ── Resolve active step from store ────────────────────────────────────────
  $: index     = $selectedInflectionIndex;
  $: direction = $selectedInflectionPath;   // 'positive' | 'negative' | null
  $: step      = index >= 0 ? data[index] : null;

  // ── Inflection detail block ────────────────────────────────────────────────
  $: detail  = step?.inflection_detail ?? null;
  $: paths   = detail?.paths ?? [];
  $: posPath = paths.find(p => p.direction === 'positive') ?? null;
  $: negPath = paths.find(p => p.direction === 'negative') ?? null;

  // ── Active path (the one that was clicked) ────────────────────────────────
  $: activePath = direction === 'positive' ? posPath : negPath;

  // ── Other path (shown collapsed for context) ─────────────────────────────
  $: otherPath      = direction === 'positive' ? negPath : posPath;
  $: otherDirection = direction === 'positive' ? 'negative' : 'positive';

  // ── Step-level inflection analysis (risk, dropout, etc.) ─────────────────
  $: analysis = step?.inflection_analysis ?? null;

  // ── Sponsor actions ───────────────────────────────────────────────────────
  $: sponsorActions = step?.sponsor_actions ?? [];

  // ── Emotion swatches for the step ────────────────────────────────────────
  $: emotionSwatches = (() => {
    if (!step) return [];
    const raw  = step.plutchik_score?.toLowerCase().trim() ?? '';
    const dyad = DYAD_BY_ID[raw];
    if (dyad) return dyad.primary.map(pid => emotionColor(pid));
    const id = SCORE_ALIASES[raw] ?? raw;
    return [emotionColor(id)];
  })();

  // ── Sentiment label + swatch ──────────────────────────────────────────────
  $: sentimentLabel  = step ? ratingToLabel(step.sentiment) : '';
  $: sentimentColor  = step ? sentimentToColor(step.sentiment) : 'transparent';

  // ── Colour constants ──────────────────────────────────────────────────────
  const POS_COLOR = '#23abab';
  const NEG_COLOR = '#e05c5c';

  $: accentColor = direction === 'positive' ? POS_COLOR : NEG_COLOR;

  // ── Risk badge colour ─────────────────────────────────────────────────────
  function riskColor(level) {
    if (level === 'high')   return '#e05c5c';
    if (level === 'medium') return '#c8902a';
    return '#4a9e7f';
  }

  // ── Switch which path is active without closing the drawer ────────────────
  function switchPath(dir) {
    selectedInflectionPath.set(dir);
  }

  // ── Humanise snake_case strings ──────────────────────────────────────────
  function humanise(str) {
    return (str ?? '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }
</script>

{#if step && detail}
  <div class="content-wrap">

    <!-- ── Top meta bar — matches StepDetailContent toolbar pattern ──────── -->
    <div class="toolbar p-2"
      style="border-bottom: 2.5px solid {accentColor}">
      <div class="flex flex-row gap-2 align-center items-center">
        <div class="sentiment-container">
          {#each SENTIMENT_SCALE as stopColor, i}
            {@const activePos = (parseFloat(step.sentiment ?? 0) + 5) / 10 * (SENTIMENT_SCALE.length - 1)}
            {@const isActive  = i === Math.round(activePos)}
            <div
              class="jm-swatch"
              class:score-square--active={isActive}
              style="background: {stopColor}; opacity: {isActive ? 1 : 0.2};"
            ></div>
          {/each}
        </div>
        <span class="label-sm" style="color:var(--ink)">{sentimentLabel}</span>
      </div>

      <!-- Emotion badge -->
      <button
        class="btn-nav"
        aria-label="Emotion: {step.plutchik_score}"
        title="Plutchik emotion for this step"
      >
        <div class="emotion-container">
          {#each emotionSwatches as color}
            <span class="jm-swatch-round-sm" style="background: {color};"></span>
          {/each}
        </div>
        <span class="label-sm">{step.plutchik_score}</span>
      </button>
    </div>

    <!-- ── Illustration fallback header ──────────────────────────────────── -->
    <div class="step-illustration__fallback stats-animation-gradient__gradient--bright pt-8">
      <div class="flex flex-col px-4">
        <span class="label-sm text-white">{step.stage}</span>
        <h2 class="heading-serif" style="color:var(--lightgrayblue); font-size:2.5em">{step.step}</h2>
      </div>
    </div>

    <!-- ── Path switcher header row ──────────────────────────────────────── -->
    <div class="header-row">
      <div class="flex flex-row gap-8 align-center">
        <IconArrowsOutLineVerticalRegular class="icon-header" />
        <h3 class="label uppercase my-auto">Inflection Paths</h3>
      </div>
    </div>

    <!-- ── Path tabs ─────────────────────────────────────────────────────── -->
    <div class="content-padding">
      <div class="path-tabs" role="tablist">
        <button
          class="path-tab"
          class:path-tab--active={direction === 'positive'}
          style="--tab-color:{POS_COLOR}"
          role="tab"
          aria-selected={direction === 'positive'}
          onclick={() => switchPath('positive')}
        >
          <IconArrowUpRegular />
          <span>{posPath?.label ?? 'Positive Path'}</span>
        </button>
        <button
          class="path-tab"
          class:path-tab--active={direction === 'negative'}
          style="--tab-color:{NEG_COLOR}"
          role="tab"
          aria-selected={direction === 'negative'}
          onclick={() => switchPath('negative')}
        >
          <IconArrowDownRegular />
          <span>{negPath?.label ?? 'Negative Path'}</span>
        </button>
      </div>
    </div>

    <!-- ── Active path detail ─────────────────────────────────────────────── -->
    {#if activePath}
      <section class="detail-section">
        <div class="content-padding">
          <div class="path-card" style="border-color:{accentColor}44;">

            <!-- Direction badge -->
            <span class="direction-tag" style="color:{accentColor};">
              {#if direction === 'positive'}
                <IconArrowUpRegular /> Positive
              {:else}
                <IconArrowDownRegular /> Negative
              {/if}
            </span>

            <!-- Label + outcome -->
            <div class="jm-content-col">
              <span class="label-sm uppercase">{activePath.label}</span>
              {#if activePath.outcome}
                <p class="text-body">{activePath.outcome}</p>
              {/if}
            </div>

            <!-- Sentiment shift -->
            {#if activePath.sentiment_shift}
              <div class="jm-section-bar">
                <span class="label-sm uppercase">Sentiment shift</span>
              </div>
              <p class="text-body">{humanise(activePath.sentiment_shift)}</p>
            {/if}

            <!-- Barriers -->
            {#if activePath.barriers?.length}
              <div class="jm-section-bar">
                <span class="label-sm uppercase">Barriers</span>
              </div>
              <ul class="tag-list">
                {#each activePath.barriers as b}
                  <li class="tag-item tag-item--neg">{humanise(b)}</li>
                {/each}
              </ul>
            {/if}

            <!-- Enablers -->
            {#if activePath.enablers?.length}
              <div class="jm-section-bar">
                <span class="label-sm uppercase">Enablers</span>
              </div>
              <ul class="tag-list">
                {#each activePath.enablers as e}
                  <li class="tag-item tag-item--pos">{humanise(e)}</li>
                {/each}
              </ul>
            {/if}

          </div>
        </div>
      </section>
    {/if}

    <!-- ── Other path (collapsed summary) ────────────────────────────────── -->
    {#if otherPath}
      <div class="content-padding">
        <button
          class="other-path-row"
          style="--other-color:{otherDirection === 'positive' ? POS_COLOR : NEG_COLOR}"
          onclick={() => switchPath(otherDirection)}
          aria-label="Switch to {otherDirection} path"
        >
          <span class="other-path-tag" style="color:{otherDirection === 'positive' ? POS_COLOR : NEG_COLOR}">
            {otherDirection === 'positive' ? '↑' : '↓'}
            {otherDirection === 'positive' ? 'Positive' : 'Negative'}
          </span>
          <span class="label-sm uppercase" style="flex:1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">{otherPath.label}</span>
          <span class="other-path-cta">View →</span>
        </button>
      </div>
    {/if}

    <!-- ── Inflection analysis ────────────────────────────────────────────── -->
    {#if analysis}
      <section class="detail-section">
        <div class="toolbar-light-sm">
          <IconWarningRegular class="icon-toolbar-dark-md" />
          <span class="label-sm">Inflection Analysis</span>
        </div>

        <div class="content-padding">
          <div class="jm-content-col gap-3">

            <!-- Risk + Dropout row -->
            <div class="analysis-row">
              {#if analysis.risk_level}
                <div class="analysis-cell">
                  <span class="label-sm uppercase">Risk level</span>
                  <span class="risk-badge" style="color:{riskColor(analysis.risk_level)}; border-color:{riskColor(analysis.risk_level)}44; background:{riskColor(analysis.risk_level)}12;">
                    {humanise(analysis.risk_level)}
                  </span>
                </div>
              {/if}
              {#if analysis.dropout_risk}
                <div class="analysis-cell">
                  <span class="label-sm uppercase">Dropout risk</span>
                  <span class="label capitalize">{humanise(analysis.dropout_risk)}</span>
                </div>
              {/if}
            </div>

            <!-- Trial perception shift -->
            {#if analysis.trial_perception_shift}
              <div class="jm-content-col">
                <span class="label-sm uppercase">Trial perception</span>
                <p class="text-body">{humanise(analysis.trial_perception_shift)}</p>
              </div>
            {/if}

            <!-- Sponsor opportunity categories -->
            {#if analysis.sponsor_opportunity_category?.length}
              <div class="jm-content-col">
                <span class="label-sm uppercase">Sponsor opportunity</span>
                <ul class="tag-list">
                  {#each analysis.sponsor_opportunity_category as cat}
                    <li class="tag-item tag-item--neutral">{humanise(cat)}</li>
                  {/each}
                </ul>
              </div>
            {/if}

            <!-- Convergent metrics -->
            {#if analysis.convergent_metrics?.length}
              <div class="jm-content-col">
                <span class="label-sm uppercase">Convergent metrics</span>
                <ul class="tag-list">
                  {#each analysis.convergent_metrics as m}
                    <li class="tag-item tag-item--neutral">{humanise(m)}</li>
                  {/each}
                </ul>
              </div>
            {/if}

          </div>
        </div>
      </section>
    {/if}

    <!-- ── Sponsor actions ────────────────────────────────────────────────── -->
    {#if sponsorActions.length}
      <section class="detail-section">
        <div class="toolbar-light-sm">
          <IconLightbulbRegular class="icon-toolbar-dark-md" />
          <span class="label-sm">Sponsor Actions</span>
        </div>

        <div class="content-padding">
          <div class="jm-content-col gap-3">
            {#each sponsorActions as action}
              <div class="sponsor-action-card">
                <div class="sponsor-action-header">
                  <span class="tag-item tag-item--neutral">{humanise(action.category)}</span>
                  {#if action.timing}
                    <span class="timing-label">{action.timing}</span>
                  {/if}
                </div>
                <p class="text-body">{action.action}</p>
              </div>
            {/each}
          </div>
        </div>
      </section>
    {/if}

  </div>

{:else if step}
  <div class="content-wrap">
    <p class="text-body">No inflection detail available for this step.</p>
  </div>
{/if}

<style>
  .content-wrap {
    display: flex;
    flex-direction: column;
    gap: 0;
  }

  /* ── Path switcher tabs ──────────────────────────────────────────────── */
  .path-tabs {
    display: flex;
    flex-direction: row;
    gap: 0.5rem;
  }

  .path-tab {
    flex: 1;
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: center;
    gap: 0.35rem;
    padding: 0.5rem 0.75rem;
    border: 1.5px solid rgba(160,168,184,0.4);
    border-radius: 6px;
    background: transparent;
    font-size: 0.72rem;
    font-weight: 600;
    color: var(--ink-muted, #73726c);
    cursor: pointer;
    transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
  }

  .path-tab--active {
    border-color: var(--tab-color);
    background: color-mix(in srgb, var(--tab-color) 10%, transparent);
    color: var(--tab-color);
  }

  /* ── Active path card ────────────────────────────────────────────────── */
  .path-card {
    border: 1.5px solid;
    border-radius: 8px;
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .direction-tag {
    font-size: 0.58rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    font-family: var(--font-mono);
    padding: 2px 8px;
    border-radius: 4px;
    width: fit-content;
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }

  /* ── Other path collapsed row ────────────────────────────────────────── */
  .other-path-row {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 0.6rem;
    padding: 0.6rem 0.85rem;
    border: 1px solid rgba(160,168,184,0.35);
    border-radius: 6px;
    background: transparent;
    cursor: pointer;
    width: 100%;
    text-align: left;
    transition: background 0.12s ease;
  }

  .other-path-row:hover {
    background: color-mix(in srgb, var(--other-color) 6%, transparent);
    border-color: var(--other-color);
  }

  .other-path-tag {
    font-size: 0.58rem;
    font-weight: 700;
    letter-spacing: 0.07em;
    text-transform: uppercase;
    font-family: var(--font-mono);
    flex-shrink: 0;
  }

  .other-path-cta {
    font-size: 0.68rem;
    font-weight: 600;
    color: var(--ink-muted, #73726c);
    flex-shrink: 0;
  }

  /* ── Analysis grid ───────────────────────────────────────────────────── */
  .analysis-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
  }

  .analysis-cell {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
  }

  .risk-badge {
    font-size: 0.68rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    border: 1px solid;
    border-radius: 4px;
    padding: 2px 8px;
    width: fit-content;
  }

  /* ── Sponsor action cards ────────────────────────────────────────────── */
  .sponsor-action-card {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    padding: 0.7rem 0.85rem;
    border: 1px solid rgba(160,168,184,0.25);
    border-radius: 6px;
    background: rgba(160,168,184,0.04);
  }

  .sponsor-action-header {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 0.5rem;
  }

  .timing-label {
    font-size: 0.6rem;
    color: var(--ink-muted, #73726c);
    font-style: italic;
  }

  /* ── Sentiment swatch active ring ────────────────────────────────────── */
  .score-square--active {
    outline: 1.5px solid var(--grayblue);
    outline-offset: 2px;
  }
</style>