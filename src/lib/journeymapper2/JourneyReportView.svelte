<script lang="ts">
  import {
    ratingToLabel,
    metricScoreLabel,
    sentimentToColor,
    SENTIMENT_SCALE,
    buildStageColorMap,
  } from './journeyConfig.js';

  import IconHeartHalfRegular       from 'phosphor-icons-svelte/IconHeartHalfRegular.svelte';
  import IconBrainRegular           from 'phosphor-icons-svelte/IconBrainRegular.svelte';
  import IconShieldCheckRegular     from 'phosphor-icons-svelte/IconShieldCheckRegular.svelte';
  import IconSparkleFill            from 'phosphor-icons-svelte/IconSparkleFill.svelte';
  import IconPackageRegular         from 'phosphor-icons-svelte/IconPackageRegular.svelte';
  import IconQuotesRegular          from 'phosphor-icons-svelte/IconQuotesRegular.svelte';
  import IconWarningRegular         from 'phosphor-icons-svelte/IconWarningRegular.svelte';
  import IconArrowUpRegular         from 'phosphor-icons-svelte/IconArrowUpRegular.svelte';
  import IconArrowDownRegular       from 'phosphor-icons-svelte/IconArrowDownRegular.svelte';
  import IconLightbulbRegular       from 'phosphor-icons-svelte/IconLightbulbRegular.svelte';
  import IconBookOpenRegular        from 'phosphor-icons-svelte/IconBookOpenRegular.svelte';
  import IconSyringeRegular         from 'phosphor-icons-svelte/IconSyringeRegular.svelte';
  import IconHospitalRegular        from 'phosphor-icons-svelte/IconHospitalRegular.svelte';
  import IconUsersThreeRegular      from 'phosphor-icons-svelte/IconUsersThreeRegular.svelte';
  import IconArrowsOutLineVerticalRegular from 'phosphor-icons-svelte/IconArrowsOutLineVerticalRegular.svelte';

  /** @type {any[]} */
  export let data: any[] = [];

  /** @type {{ key: string; color: string; label: string }[]} */
  export let metrics: { key: string; color: string; label: string }[] = [];

  // ── Stage groups ──────────────────────────────────────────────────────────
  $: stageGroups = (() => {
    const map = new Map<string, { stage_id: string; stage: string; steps: any[] }>();
    data.forEach((d) => {
      if (!map.has(d.stage_id)) map.set(d.stage_id, { stage_id: d.stage_id, stage: d.stage, steps: [] });
      map.get(d.stage_id)!.steps.push(d);
    });
    return [...map.values()];
  })();

  $: stageColorMap = buildStageColorMap(data);

  // ── Metric bar helpers ────────────────────────────────────────────────────
  /** Convert –5..+5 to a 0–100 percent for bar width */
  function toPercent(val: number): number {
    return ((val + 5) / 10) * 100;
  }

  /** Bar fill color: positive = metric color, negative = muted red */
  function barColor(val: number, metricColor: string): string {
    return val >= 0 ? metricColor : '#e05c5c';
  }

  /** Sentiment swatch color for a given step */
  function stepSentimentColor(step: any): string {
    return sentimentToColor(step.sentiment ?? 0);
  }

  // ── Event icon helpers ────────────────────────────────────────────────────
  const EVENT_ICONS: Record<string, any> = {
    roadblock:       IconWarningRegular,
    progress:        IconArrowUpRegular,
    community:       IconUsersThreeRegular,
    hospitalization: IconHospitalRegular,
    info_source:     IconBookOpenRegular,
    intervention:    IconLightbulbRegular,
  };

  function eventIcon(type: string) {
    return EVENT_ICONS[type] ?? IconPackageRegular;
  }

  function eventSentimentClass(impact: number): string {
    if (impact > 0) return 'event-badge--pos';
    if (impact < 0) return 'event-badge--neg';
    return 'event-badge--neutral';
  }

  // ── Total step count for progress indicator ───────────────────────────────
  $: totalSteps = data.length;

  // ── Step global index lookup ──────────────────────────────────────────────
  $: stepGlobalIndex = (() => {
    const m = new Map<string, number>();
    data.forEach((d, i) => m.set(d.step_id, i));
    return m;
  })();
</script>

<!-- ══════════════════════════════════════════════════════════════════════════
     REPORT VIEW — full vertical scroll
     ══════════════════════════════════════════════════════════════════════════ -->
<div class="report-scroll" role="region" aria-label="Journey report">

  <!-- ── Stage sections ───────────────────────────────────────────────────── -->
  {#each stageGroups as group, gi}
    {@const stageColor = stageColorMap[group.stage_id] ?? '#264290'}

    <!-- Stage header row -->
    <div class="report-stage-header" style="border-left: 3px solid {stageColor};">
      <div class="flex flex-row items-center gap-3">
        <span
          class="stage-index-badge"
          style="background: {stageColor}20; color: {stageColor}; border-color: {stageColor}40;"
        >
          Stage {gi + 1}
        </span>
        <h2 class="heading-sm" style="color: {stageColor};">{group.stage}</h2>
      </div>
      <span class="label" style="color: var(--ink-muted);">
        {group.steps.length} {group.steps.length === 1 ? 'step' : 'steps'}
      </span>
    </div>

    <!-- ── Steps ─────────────────────────────────────────────────────────── -->
    {#each group.steps as step, si}
      {@const globalIdx   = stepGlobalIndex.get(step.step_id) ?? 0}
      {@const sentColor   = stepSentimentColor(step)}
      {@const sentLabel   = ratingToLabel(step.sentiment ?? 0)}
      {@const isInflection = step.inflection === 'Y'}

      <div
        class="report-row"
        class:report-row--inflection={isInflection}
        id="step-{step.step_id}"
      >

        <!-- ── LEFT COLUMN — labels + mini metrics ───────────────────────── -->
        <div class="report-left" style="border-top: 1.5px solid {stageColor}30;">

          <!-- Step label block -->
          <div class="report-step-meta">
            <div class="flex flex-row items-start gap-2 mb-3">
              <span class="pill-sm" style="background: {stageColor}15; color: {stageColor};">
                {globalIdx + 1}/{totalSteps}
              </span>
              {#if isInflection}
                <span class="inflection-badge">
                  <IconArrowsOutLineVerticalRegular class="text-xs" />
                  Inflection
                </span>
              {/if}
            </div>

            <p class="label-sm uppercase mb-1" style="color: {stageColor};">{step.stage}</p>
            <h3 class="report-step-title">{step.step}</h3>
          </div>

          <!-- Sentiment mini-display -->
          <div class="report-metric-block">
            <div class="report-metric-row">
              <div class="flex flex-row items-center gap-1">
                <IconHeartHalfRegular class="text-xs" style="color: {sentColor};" />
                <span class="label-xs" style="color: var(--ink-muted);">Sentiment</span>
              </div>
              <span
                class="report-metric-pill"
                style="color: {sentColor}; border-color: {sentColor}50; background: {sentColor}10;"
              >
                {sentLabel}
              </span>
            </div>

            <!-- Sentiment scale strip -->
            <div class="sentiment-strip" aria-hidden="true">
              {#each SENTIMENT_SCALE as stopColor, i}
                {@const activePos = ((step.sentiment ?? 0) + 5) / 10 * (SENTIMENT_SCALE.length - 1)}
                {@const isActive  = i === Math.round(activePos)}
                <div
                  class="sentiment-pip"
                  class:sentiment-pip--active={isActive}
                  style="background: {stopColor}; opacity: {isActive ? 1 : 0.18};"
                ></div>
              {/each}
            </div>
          </div>

          <!-- Index metric bars -->
          <div class="report-index-block">
            <span class="label-xs uppercase mb-2" style="color: var(--ink-muted);">Index Metrics</span>
            {#each metrics as m}
              {@const val = step[m.key] ?? 0}
              {@const pct = toPercent(val)}
              {@const fill = barColor(val, m.color)}
              {@const label = metricScoreLabel(m.key, val)}
              <div class="report-bar-row">
                <span class="report-bar-label" style="color: var(--ink-muted);">{m.label}</span>
                <div class="report-bar-track">
                  <!-- zero-line -->
                  <div class="report-bar-zero" aria-hidden="true"></div>
                  <!-- fill from center -->
                  {#if val >= 0}
                    <div
                      class="report-bar-fill report-bar-fill--pos"
                      style="width: {(val / 5) * 50}%; left: 50%; background: {fill};"
                    ></div>
                  {:else}
                    <div
                      class="report-bar-fill report-bar-fill--neg"
                      style="width: {(Math.abs(val) / 5) * 50}%; right: 50%; background: {fill};"
                    ></div>
                  {/if}
                </div>
                <span class="report-bar-value" style="color: {fill}; font-variant-numeric: tabular-nums;">
                  {val > 0 ? '+' : ''}{val.toFixed(1)}
                </span>
              </div>
            {/each}
          </div>

        </div><!-- /report-left -->

        <!-- ── RIGHT COLUMN — narrative content ─────────────────────────── -->
        <div class="report-right">

          <!-- Narrative -->
          {#if step.narrative_description}
            <p class="text-body report-narrative">{step.narrative_description}</p>
          {/if}

          <!-- Key quote -->
          {#if step.quote}
            <div class="flex flex-col gap-1 text-pretty">
              <IconQuotesRegular class="text-xl" style="color: {stageColor};" />
              <p class="text-xl text-slate-800">
                {step.quote}</p>
            </div>
          {/if}

          <!-- Sentiment drivers — if present -->
          {#if step.sentiment_reasons?.length}
            <div class="report-section">
              <span class="label-xs uppercase report-section-label">Sentiment Drivers</span>
              <ul class="report-driver-list">
                {#each step.sentiment_reasons as reason}
                  <li class="report-driver-item">
                    <span class="text-body-md">{reason}</span>
                  </li>
                {/each}
              </ul>
            </div>
          {/if}

          <!-- Metric explainers -->
          {#if step.metric_explainers && Object.keys(step.metric_explainers).length}
            <div class="report-section">
              <span class="label-xs uppercase report-section-label">Index Notes</span>
              <div class="flex flex-col gap-2 w-full">
                {#each metrics as m}
                  {#if step.metric_explainers[m.key]}
                    <div class="report-explainer-row">
                      <span class="label-sm" style="color: {m.color};">{m.label}</span>
                      <p class="text-body-sm report-explainer-text">{step.metric_explainers[m.key]}</p>
                    </div>
                  {/if}
                {/each}
              </div>
            </div>
          {/if}

          <!-- Events -->
          {#if step.events?.length}
            {@const journeyEvents   = step.events.filter((e: any) => ['roadblock','progress','community','hospitalization'].includes(e.type))}
            {@const infoSources     = step.events.filter((e: any) => e.type === 'info_source')}
            {@const interventions   = step.events.filter((e: any) => e.type === 'intervention')}

            {#if journeyEvents.length}
              <div class="report-section">
                <span class="label-xs uppercase report-section-label">Journey Events</span>
                <div class="report-events">
                  {#each journeyEvents as ev}
                    {@const Icon = eventIcon(ev.type)}
                    <div class="report-event-card {eventSentimentClass(ev.sentiment_impact ?? 0)}">
                      <div class="report-event-header">
                        <svelte:component this={Icon} class="report-event-icon" />
                        <span class="label-xs uppercase">{ev.label}</span>
                      </div>
                      {#if ev.description}
                        <p class="text-body-sm">{ev.description}</p>
                      {/if}
                    </div>
                  {/each}
                </div>
              </div>
            {/if}

            {#if infoSources.length}
              <div class="report-section">
                <span class="label-xs uppercase report-section-label">Information Sources</span>
                <div class="report-events">
                  {#each infoSources as ev}
                    {@const Icon = eventIcon(ev.type)}
                    <div class="report-event-card event-badge--neutral">
                      <div class="report-event-header">
                        <svelte:component this={Icon} class="report-event-icon" />
                        <span class="label-xs uppercase">{ev.label}</span>
                      </div>
                      {#if ev.description}
                        <p class="text-body-sm">{ev.description}</p>
                      {/if}
                    </div>
                  {/each}
                </div>
              </div>
            {/if}

            {#if interventions.length}
              <div class="report-section">
                <span class="label-xs uppercase report-section-label" style="color: var(--teal);">
                  Intervention Opportunities
                </span>
                <div class="report-events">
                  {#each interventions as ev}
                    <div class="report-event-card event-badge--intervention">
                      <div class="report-event-header">
                        <IconLightbulbRegular class="report-event-icon" />
                        <span class="label-xs uppercase">{ev.label}</span>
                        {#if ev.sentiment_impact}
                          <span class="intervention-impact" style="color: var(--teal);">
                            +{ev.sentiment_impact} impact
                          </span>
                        {/if}
                      </div>
                      {#if ev.description}
                        <p class="text-body-sm">{ev.description}</p>
                      {/if}
                    </div>
                  {/each}
                </div>
              </div>
            {/if}
          {/if}

          <!-- Inflection paths (collapsed summary) -->
          {#if isInflection && (step.inflection_paths_pos || step.inflection_paths_neg)}
            <div class="report-section">
              <span class="label-xs uppercase report-section-label">Inflection Paths</span>
              <div class="report-inflection-pair">
                {#if step.inflection_paths_pos}
                  <div class="report-inflection-chip report-inflection-chip--pos">
                    <IconArrowUpRegular class="text-xs" />
                    <span class="label-xs">{step.inflection_paths_pos?.label ?? 'Positive path'}</span>
                  </div>
                {/if}
                {#if step.inflection_paths_neg}
                  <div class="report-inflection-chip report-inflection-chip--neg">
                    <IconArrowDownRegular class="text-xs" />
                    <span class="label-xs">{step.inflection_paths_neg?.label ?? 'Negative path'}</span>
                  </div>
                {/if}
              </div>
            </div>
          {/if}

        </div><!-- /report-right -->
      </div><!-- /report-row -->
    {/each}

    <!-- Stage divider -->
    {#if gi < stageGroups.length - 1}
      <div class="report-stage-divider"></div>
    {/if}
  {/each}

</div><!-- /report-scroll -->

<style>
  /* ── Scroll container ────────────────────────────────────────────────────── */
  .report-scroll {
    overflow-y: auto;
    overflow-x: hidden;
    flex: 1;
    min-height: 0;
    padding: 0 0 4rem;
  }

  /* ── Stage header ────────────────────────────────────────────────────────── */
  .report-stage-header {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    padding: 1.25rem 2rem 1rem 1.5rem;
    background: var(--paper);
    position: sticky;
    top: 0;
    z-index: 10;
    border-bottom: var(--bluegray);
  }

  .stage-index-badge {
    font-family: var(--font-mono);
    font-size: 0.62rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    padding: 2px 8px;
    border-radius: 4px;
    border: 1px solid;
    white-space: nowrap;
  }

  .report-stage-divider {
    height: 1.5rem;
    background: var(--panel);
    border-top: var(--hairline);
    border-bottom: var(--hairline);
  }

  /* ── Row layout ──────────────────────────────────────────────────────────── */
  .report-row {
    display: grid;
    grid-template-columns: 260px 1fr;
    min-height: 0;
    border-bottom: var(--hairline);
  }

  .report-row--inflection {
    background: color-mix(in srgb, var(--panel) 60%, transparent);
  }

  /* ── LEFT column ─────────────────────────────────────────────────────────── */
  .report-left {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
    padding: 1.5rem 1.25rem 1.5rem 1.5rem;
    border-right: var(--hairline);
    position: sticky;
    top: 52px; /* clears the stage header */
    align-self: start;
  }

  .report-step-meta {
    display: flex;
    flex-direction: column;
  }

  .inflection-badge {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    font-family: var(--font-mono);
    font-size: 0.6rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--orange);
    background: color-mix(in srgb, var(--orange) 10%, transparent);
    border: 1px solid color-mix(in srgb, var(--orange) 30%, transparent);
    padding: 2px 7px;
    border-radius: 4px;
  }

  .report-step-title {
    font-family: var(--font-serif);
    font-size: 1.15rem;
    font-weight: 600;
    line-height: 1.3;
    letter-spacing: -0.015em;
    color: var(--ink);
    margin: 0;
  }

  /* ── Sentiment mini block ────────────────────────────────────────────────── */
  .report-metric-block {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .report-metric-row {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
  }

  .report-metric-pill {
    font-family: var(--font-mono);
    font-size: 0.58rem;
    font-weight: 700;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    padding: 2px 8px;
    border-radius: 20px;
    border: 1px solid;
    white-space: nowrap;
  }

  .sentiment-strip {
    display: flex;
    flex-direction: row;
    gap: 2px;
    align-items: center;
  }

  .sentiment-pip {
    flex: 1;
    height: 4px;
    border-radius: 2px;
    transition: opacity 0.2s ease;
  }

  .sentiment-pip--active {
    transform: scaleY(1.6);
    transform-origin: center;
  }

  /* ── Index metric bars ───────────────────────────────────────────────────── */
  .report-index-block {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .report-bar-row {
    display: grid;
    grid-template-columns: 1fr auto auto;
    gap: 0.5rem;
    align-items: center;
  }

  .report-bar-label {
    font-size: 0.62rem;
    font-weight: 500;
    line-height: 1.2;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .report-bar-track {
    position: relative;
    width: 60px;
    height: 5px;
    background: var(--panel-dark);
    border-radius: 3px;
    overflow: hidden;
  }

  .report-bar-zero {
    position: absolute;
    left: 50%;
    top: 0;
    width: 1px;
    height: 100%;
    background: var(--hairline-color, #ccc);
    opacity: 0.6;
    z-index: 1;
  }

  .report-bar-fill {
    position: absolute;
    top: 0;
    height: 100%;
    border-radius: 2px;
  }

  .report-bar-fill--pos { border-radius: 0 2px 2px 0; }
  .report-bar-fill--neg { border-radius: 2px 0 0 2px; }

  .report-bar-value {
    font-family: var(--font-mono);
    font-size: 0.6rem;
    font-weight: 600;
    width: 28px;
    text-align: right;
    flex-shrink: 0;
  }

  /* ── RIGHT column ────────────────────────────────────────────────────────── */
  .report-right {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    padding: 1.75rem 2.5rem 2rem 2rem;
  }

  .report-narrative {
    line-height: 1.7;
    max-width: 68ch;
  }

  /* ── Quote ───────────────────────────────────────────────────────────────── */
  .report-quote {
    display: flex;
    flex-direction: row;
    gap: 0.75rem;
    align-items: flex-start;
    padding: 1rem 1.25rem;
    background: var(--panel);
    border-radius: 6px;
    border-left: 3px solid var(--hairline-color, #ddd);
    max-width: 64ch;
  }

  .text-lg {
    flex-shrink: 0;
    margin-top: 0.15rem;
    opacity: 0.7;
    font-size: 1rem;
  }

  /* ── Report sections ─────────────────────────────────────────────────────── */
  .report-section {
    display: flex;
    flex-direction: column;
    gap: 0.625rem;
  }

  .report-section-label {
    color: var(--ink-muted);
    letter-spacing: 0.08em;
  }

  /* ── Sentiment driver list ───────────────────────────────────────────────── */
  .report-driver-list {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .report-driver-item {
    display: flex;
    flex-direction: row;
    align-items: flex-start;
    gap: 0.5rem;
  }

  .driver-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    flex-shrink: 0;
    margin-top: 0.375rem;
  }

  /* ── Metric explainers ───────────────────────────────────────────────────── */
  .report-explainers {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding: 0.75rem 1rem;
    background: var(--panel);
    border-radius: 6px;
  }

  .report-explainer-row {
    display: grid;
    grid-template-columns: 120px 1fr;
    gap: 0.75rem;
    align-items: baseline;
    border-top: 1px solid var(--panel-dark);
    padding-top: 0.625rem;
  }

  .report-explainer-row:first-child {
    border-top: none;
    padding-top: 0;
  }


  .report-events {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .report-event-card {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
    padding: 0.75rem 1rem;
    border-radius: 6px;
    border: 1px solid transparent;
  }

  .report-event-header {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 0.5rem;
  }

  .report-event-icon {
    flex-shrink: 0;
    font-size: 0.85rem;
  }

  /* Event type colors */
  .event-badge--pos {
    background: #f0faf4;
    border-color: #b7e4c7;
  }

  .event-badge--neg {
    background: #fff7f7;
    border-color: #f5c2c7;
  }

  .event-badge--neutral {
    background: var(--panel);
    border-color: var(--panel-dark);
  }

  .event-badge--intervention {
    background: color-mix(in srgb, var(--teal) 8%, white);
    border-color: color-mix(in srgb, var(--teal) 30%, transparent);
  }

  .intervention-impact {
    font-family: var(--font-mono);
    font-size: 0.6rem;
    font-weight: 700;
    margin-left: auto;
  }

  /* ── Inflection chips ────────────────────────────────────────────────────── */
  .report-inflection-pair {
    display: flex;
    flex-direction: row;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .report-inflection-chip {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    padding: 3px 10px;
    border-radius: 4px;
    font-size: 0.68rem;
    font-weight: 600;
    border: 1px solid transparent;
  }

  .report-inflection-chip--pos {
    background: #edfdf4;
    border-color: #23abab40;
    color: #23abab;
  }

  .report-inflection-chip--neg {
    background: #fff2f2;
    border-color: #e05c5c40;
    color: #e05c5c;
  }

  /* ── Scrollbar ───────────────────────────────────────────────────────────── */
  .report-scroll::-webkit-scrollbar { width: 4px; }
  .report-scroll::-webkit-scrollbar-track { background: transparent; }
  .report-scroll::-webkit-scrollbar-thumb { background: var(--panel-dark); border-radius: 2px; }

  /* ── Responsive ──────────────────────────────────────────────────────────── */
  @media (max-width: 860px) {
    .report-row {
      grid-template-columns: 1fr;
    }

    .report-left {
      position: static;
      border-right: none;
      border-bottom: var(--hairline);
      padding-bottom: 1rem;
    }

    .report-right {
      padding: 1.25rem 1.25rem 1.5rem;
    }
  }
</style>