<script>
    import { selectedInflectionIndex, selectedInflectionPath } from './journeyStore.js';
    import { sentimentToColor, ratingToLabel, emotionColor, DYAD_BY_ID, SCORE_ALIASES } from './journeyConfig.js';
  
    import IconArrowsOutLineVerticalRegular from 'phosphor-icons-svelte/IconArrowsOutLineVerticalRegular.svelte';
    import IconArrowUpRegular               from 'phosphor-icons-svelte/IconArrowUpRegular.svelte';
    import IconArrowDownRegular             from 'phosphor-icons-svelte/IconArrowDownRegular.svelte';
    import IconWarningRegular               from 'phosphor-icons-svelte/IconWarningRegular.svelte';
    import IconLightbulbRegular             from 'phosphor-icons-svelte/IconLightbulbRegular.svelte';
  
    /** Full flat journey data array */
    export let data = [];
  
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
    
    // ── Sentiment label ──────────────────────────────────────────────────────
    $: sentimentLabel = step ? ratingToLabel(step.sentiment) : '';
  
    // ── Colour constants ──────────────────────────────────────────────────────
    const POS_COLOR = '#23abab';
    const NEG_COLOR = '#e05c5c';
  
    $: accentColor = direction === 'positive' ? POS_COLOR : NEG_COLOR;
    $: accentBg    = direction === 'positive' ? 'rgba(35,171,171,0.04)' : 'rgba(224,92,92,0.08)';
  
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
  
      <!-- ── Step context header ────────────────────────────────────────── -->
      <div class="header">
        <div class="toolbar-white">
          <IconArrowsOutLineVerticalRegular />
        </div>
        <span class="label-sm text-white">{step.stage}</span>
        <h2 class="heading-serif"
        style="color:var(--lightgrayblue); 
        font-size:2.5em">{step.step}</h2>
      </div>
  
      <div class="divider"></div>
  
      <!-- ── Path switcher tabs ─────────────────────────────────────────── -->
      <div class="path-tabs" role="tablist">
        <button
          class="path-tab"
          class:path-tab--active={direction === 'positive'}
          style="--tab-color:{POS_COLOR}"
          role="tab"
          aria-selected={direction === 'positive'}
          on:click={() => switchPath('positive')}
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
          on:click={() => switchPath('negative')}
        >
          <IconArrowDownRegular />
          <span>{negPath?.label ?? 'Negative Path'}</span>
        </button>
      </div>
  
      <!-- ── Active path detail ─────────────────────────────────────────── -->
      {#if activePath}
        <div class="path-card" style="border-color:{accentColor}44;">
  
          <!-- Direction badge -->
          <span class="direction-tag" style="color:{accentColor};">
            {#if direction === 'positive'}
              <IconArrowUpRegular />↑ Positive
            {:else}
              <IconArrowDownRegular />↓ Negative
            {/if}``
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
            <div class="jm-section-bar mt-2">
              <span class="label-sm uppercase">Sentiment shift</span>
            </div>
            <p class="text-body">{humanise(activePath.sentiment_shift)}</p>
          {/if}
  
          <!-- Barriers -->
          {#if activePath.barriers?.length}
            <div class="jm-section-bar mt-2">
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
            <div class="jm-section-bar mt-2">
              <span class="label-sm uppercase">Enablers</span>
            </div>
            <ul class="tag-list">
              {#each activePath.enablers as e}
                <li class="tag-item tag-item--pos">{humanise(e)}</li>
              {/each}
            </ul>
          {/if}
  
        </div>
      {/if}
  
      <!-- ── Other path (collapsed summary) ────────────────────────────── -->
      {#if otherPath}
        <button
          class="other-path-row"
          style="--other-color:{otherDirection === 'positive' ? POS_COLOR : NEG_COLOR}"
          on:click={() => switchPath(otherDirection)}
          aria-label="Switch to {otherDirection} path"
        >
          <span class="other-path-tag" style="color:{otherDirection === 'positive' ? POS_COLOR : NEG_COLOR}">
            {otherDirection === 'positive' ? '↑' : '↓'}
            {otherDirection === 'positive' ? 'Positive' : 'Negative'}
          </span>
          <span class="other-label-sm uppercase">{otherPath.label}</span>
          <span class="other-path-cta">View →</span>
        </button>
      {/if}
  
      <div class="divider"></div>
  
      <!-- ── Inflection analysis ────────────────────────────────────────── -->
      {#if analysis}
        <div class="jm-content-col gap-3">
          <div class="flex flex-row items-center gap-2">
            <IconWarningRegular />
            <span class="label-sm uppercase">Inflection Analysis</span>
          </div>
  
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
      {/if}
  
      <!-- ── Sponsor actions ────────────────────────────────────────────── -->
      {#if sponsorActions.length}
        <div class="divider"></div>
  
        <div class="jm-content-col gap-3">
          <div class="flex flex-row items-center gap-2">
            <IconLightbulbRegular />
            <span class="label-sm uppercase">Sponsor Actions</span>
          </div>
  
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
      {/if}
  
      <!-- ── Step emotion context ───────────────────────────────────────── -->
      <div class="divider"></div>
  
      <div class="emotion-row">
        <div class="jm-content-col">
          <span class="label-sm uppercase">Emotion</span>
          <div class="flex flex-row items-center mt-1">
            {#each emotionSwatches as color}
              <span class="jm-swatch-circle" style="background:{color};"></span>
            {/each}
            <span class="label capitalize">{step.plutchik_score}</span>
          </div>
        </div>
  
        <div class="jm-content-col">
          <span class="label-sm uppercase">Overall Sentiment</span>
          <div class="flex flex-row items-center align-center gap-2">
            <span class="jm-swatch" style="background:{sentimentToColor(step.sentiment)};"></span>
            <span class="label-sm" style="color:{sentimentToColor(step.sentiment)}">{sentimentLabel}</span>
          
          </div>
        </div>
      </div>
  
    </div>
  
  {:else if step}
    <!-- Step exists but no inflection_detail — shouldn't normally happen -->
    <div class="content-wrap">
      <p class="text-body">No inflection detail available for this step.</p>
    </div>
  {/if}
  
  <style>
    .content-wrap {
      padding: 2em;
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
    }
  
    /* ── Step header ─────────────────────────────────────────────────────── */
    .step-header {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }
  
    .stage-label {
      font-size: 0.72rem;
      color: var(--ink-muted, #73726c);
      text-transform: uppercase;
      letter-spacing: 0.07em;
      font-weight: 500;
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
  
    .label-sm uppercase {
      font-size: 0.9rem;
      font-weight: 600;
      color: var(--ink, #312F28);
      line-height: 1.25;
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
  
    .other-label-sm uppercase {
      flex: 1;
      font-size: 0.75rem;
      font-weight: 500;
      color: var(--ink, #312F28);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
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
  
    /* ── Tag lists ────────────────────────────────────────────────────────── */
    .tag-list {
      display: flex;
      flex-direction: row;
      flex-wrap: wrap;
      gap: 0.35rem;
      list-style: none;
      margin: 0;
      padding: 0;
    }
  
    .tag-item {
      font-size: 0.65rem;
      font-weight: 600;
      letter-spacing: 0.04em;
      border-radius: 4px;
      padding: 2px 8px;
    }
  
    .tag-item--pos {
      background: rgba(35,171,171,0.1);
      color: #23abab;
      border: 1px solid rgba(35,171,171,0.3);
    }
  
    .tag-item--neg {
      background: rgba(224,92,92,0.1);
      color: #e05c5c;
      border: 1px solid rgba(224,92,92,0.3);
    }
  
    .tag-item--neutral {
      background: rgba(160,168,184,0.12);
      color: var(--ink-muted, #73726c);
      border: 1px solid rgba(160,168,184,0.3);
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
  
    /* ── Emotion / sentiment footer row ─────────────────────────────────── */
    .emotion-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1rem;
    }
  
    .mt-1 { margin-top: 0.25rem; }
    .mt-2 { margin-top: 0.5rem; }
    .gap-2 { gap: 0.5rem; }
    .gap-3 { gap: 0.75rem; }
    .items-center { align-items: center; }
  </style>