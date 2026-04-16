<!-- JourneyInfoBar.svelte -->
<!-- Bottom-anchored tray. Three zones stacked vertically:
     1. Handle row  — progress dots · stage/step label · expand toggle
     2. Metric strip — sentiment + index metrics, always visible when step active
     3. Body         — persona bio · narrative/inflection · (expanded only)

     Animation strategy:
     - Metric strip stays mounted once a step is active; NO remount on step
       change. Swatch opacities animate via reactive tweened stores.
       Only pill labels use {#key} for a lightweight crossfade, keyed on the
       derived label string so they only fire when the category actually changes.
     - Body slides open/closed with `slide`; narrative content uses {#key displayIndex}
       with a short fly-in. The body grid itself never remounts.
     - Expand auto-triggers only on the very first step selection. -->

     <script>
      import { fly, fade, slide } from 'svelte/transition';
      import { cubicOut, cubicInOut } from 'svelte/easing';
      import { tweened } from 'svelte/motion';
      import { selectedIndex, hoveredIndex, hoveredInflectionIndex } from './journeyStore.js';
      import { sentimentToColor, SENTIMENT_SCALE, metricScoreLabel } from './journeyConfig.js';
      import PersonaProfileCard from './PersonaProfileCard.svelte';
    
      import ArrowDownRightRegular from 'phosphor-icons-svelte/IconArrowElbowDownRightRegular.svelte';
      import ArrowUpRegular        from 'phosphor-icons-svelte/IconArrowUpRegular.svelte';
      import ArrowDownRegular      from 'phosphor-icons-svelte/IconArrowDownRegular.svelte';
      import HeartHalf             from 'phosphor-icons-svelte/IconHeartHalfRegular.svelte';
      import LightbulbRegular      from 'phosphor-icons-svelte/IconLightbulbRegular.svelte';
      import Flag                  from 'phosphor-icons-svelte/IconFlagBannerFill.svelte';
      import Barricade             from 'phosphor-icons-svelte/IconBarricadeFill.svelte';
      import CaretUpRegular        from 'phosphor-icons-svelte/IconCaretUpRegular.svelte';
      import CaretDownRegular      from 'phosphor-icons-svelte/IconCaretDownRegular.svelte';
      import SmileyBlank           from 'phosphor-icons-svelte/IconSmileyBlankRegular.svelte';
      import CalenderDots          from 'phosphor-icons-svelte/IconCalendarDotsRegular.svelte';
      import HandHeart             from 'phosphor-icons-svelte/IconHandHeartRegular.svelte';
      import Aclepius              from 'phosphor-icons-svelte/IconAsclepiusRegular.svelte';
    
      const TWEEN_OPTS = { duration: 380, easing: cubicInOut };
    
      export let activePersona = null;
      export let data          = [];
      export let metrics       = [];
    
      // ── Expand / collapse ────────────────────────────────────────────────
      let expanded = false;
    
      // ── Active step ──────────────────────────────────────────────────────
      $: displayIndex = $selectedIndex >= 0
        ? $selectedIndex
        : $hoveredIndex >= 0
        ? $hoveredIndex
        : -1;
    
      $: step    = displayIndex >= 0 ? data[displayIndex] : null;
      $: profile = activePersona?.profile ?? {};
    
      // Auto-expand body on first step selection only — don't fight user toggle
      $: if (step && !expanded) expanded = true;
    
      // ── Inflection panel ─────────────────────────────────────────────────
      $: inflStep      = $hoveredInflectionIndex >= 0 ? data[$hoveredInflectionIndex] : null;
      $: inflDetail    = inflStep?.inflection_detail ?? null;
      $: showInflPanel = inflStep !== null;
    
      // ── Persona photo reset ───────────────────────────────────────────────
      let imgError = false;
      $: { imgError = false; }
    
      // ── Sentiment ────────────────────────────────────────────────────────
      function sentimentLabel(val) {
        const n = parseFloat(val);
        if (n >= 3)  return 'Very Positive';
        if (n >= 1)  return 'Positive';
        if (n === 0) return 'Neutral';
        if (n >= -2) return 'Negative';
        return 'Very Negative';
      }
    
      const sentimentTween = tweened(0, TWEEN_OPTS);
      $: if (step) sentimentTween.set(parseFloat(step.sentiment ?? 0));
      $: sentimentColor    = sentimentToColor($sentimentTween);
      // Derive label string so {#key} only fires on category boundary crossings
      $: sentimentLabelStr = sentimentLabel($sentimentTween);
    
      // ── Metric tweens ────────────────────────────────────────────────────
      let metricTweens = [];
      let metricVals   = [];
    
      $: if (metrics.length > metricTweens.length) {
        const toAdd = metrics.length - metricTweens.length;
        for (let j = 0; j < toAdd; j++) {
          const store = tweened(0, TWEEN_OPTS);
          const idx   = metricTweens.length;
          store.subscribe(v => { metricVals[idx] = v; metricVals = [...metricVals]; });
          metricTweens = [...metricTweens, store];
        }
      }
    
      $: if (step) {
        metrics.forEach((m, i) => metricTweens[i]?.set(parseFloat(step[m.key] ?? 0)));
      }
    
      // ── Metric helpers ───────────────────────────────────────────────────
      const METRIC_ICONS = {
        emotional_valence:     SmileyBlank,
        logistical_capacity:   CalenderDots,
        provider_trust:        Aclepius,
        medical_self_efficacy: HandHeart,
      };
    
      const STOPS = Array.from({ length: 10 }, (_, i) => -5 + i * (10 / 9));
    
      function buildRamp(baseColor) {
        return STOPS.map((_, si) => {
          const pct = Math.round(10 + (si / (STOPS.length - 1)) * 45);
          return `color-mix(in srgb, ${baseColor} ${pct}%, white)`;
        });
      }
    
      function squareOpacity(si, activePos) {
        const dist = Math.abs(si - activePos);
        return si === Math.round(activePos) ? 1 : Math.max(0.15, 1 - dist * 0.8);
      }
    
      $: hasContent = !!(step || showInflPanel || activePersona);
    </script>
    
    <aside class="info-bar" aria-label="Persona & step details">
    
      <!-- ══════════════════════════════════════════════════════════════════
           ZONE 1 — HANDLE ROW
      ═══════════════════════════════════════════════════════════════════ -->
      <div class="info-bar-handle">
    
        <div class="flex flex-col gap-2 w-full">
        <div class="step-dots" aria-hidden="true">
          {#each data as _, i}
            <div
              class="step-dot"
              class:step-dot--active={i === displayIndex}
              class:step-dot--complete={i < displayIndex}
            ></div>
          {/each}
        </div>
    
        <div class="handle-label">
          {#if step}
            <!-- Wrapper stays mounted; only inner text crossfades on step change -->
            {#key displayIndex}
              <div
                class="flex flex-row items-baseline justify-between gap-4"
                in:fly={{ y: 3, duration: 260, easing: cubicOut }}
                out:fade={{ duration: 200 }}
              >
                <span class="label uppercase">{step.step}</span>
                <span class="label-xs">{step.stage}</span>
              </div>
            {/key}
          {:else if activePersona}
            <span class="label uppercase">
              {activePersona.profile?.name ?? 'Persona'}
            </span>
          {/if}
        </div>
      </div>
    
        {#if hasContent}
          <button
            class="btn-sm handle-toggle"
            aria-label={expanded ? 'Collapse detail bar' : 'Expand detail bar'}
            on:click={() => (expanded = !expanded)}
          >
            {#if expanded}
              <CaretDownRegular class="text-lg"/>
            {:else}
              <CaretUpRegular class="text-lg" />
            {/if}
          </button>
        {/if}
      </div>
    
      <!-- ══════════════════════════════════════════════════════════════════
           ZONE 2 — METRIC STRIP
           Mounted once when a step becomes active; never remounted on step
           change. Swatches animate via reactive opacity (CSS transition).
           Pills crossfade only when the qualitative label string changes.
      ═══════════════════════════════════════════════════════════════════ -->
      {#if step}
        <div
          class="metric-strip"
          in:fade={{ duration: 380, easing: cubicOut }}
          out:fade={{ duration: 450, easing: cubicInOut }}
        >
    
          <!-- Sentiment cell -->
          <div class="metric-cell metric-cell--sentiment">
            <div class="metric-cell-label">
              <HeartHalf class="text-lg" 
              style="color: var(--grayblue)"/>
              <span class="label-sm" 
              style="color: var(--grayblue)">Sentiment</span>
            </div>
    
            <div class="metric-cell-swatches">
              {#each SENTIMENT_SCALE as stopColor, i}
                {@const activePos = ($sentimentTween + 5) / 10 * (SENTIMENT_SCALE.length - 1)}
                {@const isActive  = i === Math.round(activePos)}
                {@const dist      = Math.abs(i - activePos)}
                {@const opacity   = isActive ? 1 : Math.max(0.12, 1 - dist * 0.8)}
                <div
                  class="jm-swatch-sm"
                  class:score-square--active={isActive}
                  style="background:{stopColor}; opacity:{opacity}; transition:opacity 320ms ease;"
                ></div>
              {/each}
            </div>
    
            <!-- {#key} on derived label string — only fires on category crossings -->
            {#key sentimentLabelStr}
              <span
                class="pill label-sm uppercase font-semibold sentiment-pill"
                style="border:1.5px solid {sentimentColor}; color:{sentimentColor}"
                in:fade={{ duration: 220 }}
                out:fade={{ duration: 100 }}
              >
                {sentimentLabelStr}
              </span>
            {/key}
          </div>
    
          {#if metrics.length}
            <div class="metric-strip-divider" aria-hidden="true"></div>
          {/if}
    
          <!-- Index metric cells — stable DOM order matches metrics array -->
          {#each metrics as m, i}
            {@const tweenedVal    = metricVals[i] ?? 0}
            {@const ramp          = buildRamp(m.color)}
            {@const activePos     = (tweenedVal + 5) / 10 * (STOPS.length - 1)}
            {@const IconComponent = METRIC_ICONS[m.key] ?? null}
            {@const qualLabel     = metricScoreLabel(m.key, tweenedVal)}
    
            <div class="metric-cell">
              <div class="metric-cell-label">
                {#if IconComponent}
                  <svelte:component
                    this={IconComponent}
                    class="text-lg"
                    style="color:{m.color}" />
                {:else}
                  <div class="w-2 h-2 rounded-full" style="color:{m.color};"></div>
                {/if}
                <span class="label-sm"
                style="color:{m.color}" >{m.label}</span>
              </div>
    
              <div class="metric-cell-swatches">
                {#each STOPS as _s, si}
                  {@const opacity  = squareOpacity(si, activePos)}
                  {@const isActive = si === Math.round(activePos)}
                  <div
                    class="jm-swatch-sm"
                    class:jm-swatch--active={isActive}
                    style="background:{ramp[si]}; opacity:{opacity}; transition:opacity 320ms ease;"
                  ></div>
                {/each}
              </div>
    
              {#key qualLabel}
                <span
                  class="pill label-sm font-semibold metric-pill"
                  style="border:1.5px solid {m.color}; color:{m.color};"
                  in:fade={{ duration: 220, delay: 30 }}
                  out:fade={{ duration: 100 }}
                >
                  {qualLabel}
                </span>
              {/key}
            </div>
          {/each}
    
        </div>
      {/if}
    
      <!-- ══════════════════════════════════════════════════════════════════
           ZONE 3 — BODY (expanded only)
           Height animates with `slide`; columns stay mounted once open.
           Narrative content {#key}s on displayIndex for a short fly-in.
      ═══════════════════════════════════════════════════════════════════ -->
      {#if expanded && hasContent}
        <div
          class="info-bar-body"
          in:slide={{ duration: 260, easing: cubicOut }}
          out:slide={{ duration: 180, easing: cubicInOut }}
        >
    
          <!-- COL A — PERSONA BIO: only remounts on persona change -->
          {#if activePersona}
            {#key activePersona.id}
                <PersonaProfileCard
                  personaProfile={activePersona.profile}
                  currentState={activePersona.currentState ?? []}
                  personaType={activePersona.type}
                />
              <div
                class="body-col body-col--persona"
                in:fade={{ duration: 220, easing: cubicOut }}
              >
    
                {#if profile.bio_1 && displayIndex < 0}
                  <p class="text-body-sm">{profile.bio_1}</p>
                {/if}
    
                <div class="flex flex-row gap-3">
                  {#if profile.goal1 || profile.goal2 || profile.goal3}
                    <div class="jm-content-col gap-1 flex-1">
                      <div class="toolbar-sm-light">
                        <Flag style="color:var(--green)" />
                        <span class="label-sm" style="color:var(--green)">Goals</span>
                      </div>
                      {#each [profile.goal1, profile.goal2, profile.goal3].filter(Boolean) as goal}
                        <div class="flex flex-row items-start gap-2">
                          <ArrowDownRightRegular />
                          <span class="text-body-sm">{goal}</span>
                        </div>
                      {/each}
                    </div>
                  {/if}
    
                  {#if profile.barrier1 || profile.barrier2 || profile.barrier3}
                    <div class="jm-content-col gap-1 flex-1">
                      <div class="toolbar-sm-light">
                        <Barricade style="color:var(--red)" />
                        <span class="label-sm" style="color:var(--red)">Barriers</span>
                      </div>
                      {#each [profile.barrier1, profile.barrier2, profile.barrier3].filter(Boolean) as barrier}
                        <div class="flex flex-row items-start gap-2">
                          <ArrowDownRightRegular />
                          <span class="text-body-sm">{barrier}</span>
                        </div>
                      {/each}
                    </div>
                  {/if}
                </div>
              </div>
            {/key}
          {/if}
    
          <!-- COL B — NARRATIVE / INFLECTION -->
          <div class="body-col body-col--narrative">
    
            {#if showInflPanel && inflDetail}
              {#key $hoveredInflectionIndex}
                <div
                  class="jm-content-col gap-2"
                  in:fly={{ y: 5, duration: 180, easing: cubicOut }}
                  out:fade={{ duration: 80 }}
                >
                  <span class="jm-kicker">{inflDetail.label}</span>
                  <span class="label-sm">{inflStep?.step}</span>
    
                  {#if inflDetail.description}
                    <p class="text-body-sm">{inflDetail.description}</p>
                  {/if}
    
                  {#if inflDetail.paths?.length}
                    <div class="jm-content-col gap-2">
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
                              <span class="text-body-sm" style="font-style:italic">{path.key_driver}</span>
                            {/if}
                          </div>
                        </div>
                      {/each}
                    </div>
                  {/if}
    
                  {#if inflDetail.sponsor_opportunity}
                    <div class="infl-opportunity flex items-start gap-2">
                      <LightbulbRegular class="shrink-0 mt-0.5" />
                      <span class="text-body-sm">{inflDetail.sponsor_opportunity}</span>
                    </div>
                  {/if}
    
                  {#if inflDetail.data_needed}
                    <div class="jm-content-col gap-0.5 pt-2 border-top">
                      <span class="text-body-sm capitalize">Data needed</span>
                      <span class="text-body-sm">{inflDetail.data_needed}</span>
                    </div>
                  {/if}
                </div>
              {/key}
    
            {:else if step}
              {#key displayIndex}
                <div
                  class="jm-content-col gap-2"
                  in:fly={{ y: 5, duration: 200, easing: cubicOut }}
                  out:fade={{ duration: 80 }}
                >
                  {#if step.narrative_description}
                    <span class="label-xs">Narrative</span>
                    <p class="text-body-sm">{step.narrative_description}</p>
                  {/if}
                </div>
              {/key}
            {/if}
    
          </div>
        </div>
      {/if}
    
    </aside>
    
    <style>
      /* ── Shell ───────────────────────────────────────────────────────── */
      .info-bar {
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
        z-index: 100;
        background: var(--paper);
        border-top: 2px solid var(--panel-dark);
        box-shadow:
          0 -4px 24px rgba(90, 62, 40, 0.10),
          0 -1px 0 rgba(0, 0, 0, 0.06);
        display: flex;
        flex-direction: column;
        min-height: 0;
      }
    
      /* ── Handle row ──────────────────────────────────────────────────── */
      .info-bar-handle {
        display: flex;
        flex-direction: row;
        align-items: center;
        gap: 12px;
        padding: 5px 12px;
        border-bottom: var(--hairline);
        min-height: 34px;
        flex-shrink: 0;
      }
    
      .handle-label {
        flex: 1;
        min-width: 0;
        display: flex;
        align-items: baseline;
        /* Reserve height so the handle row doesn't jump when label appears */
        min-height: 1.4em;
      }
    
      .handle-toggle {
        margin-left: auto;
        flex-shrink: 0;
      }
    
      /* Progress dots */
      .step-dots {
        display: flex;
        flex-direction: row;
        gap: 4px;
        align-items: center;
        flex-shrink: 0;
      }
    
      .step-dot {
        width: 5px;
        height: 5px;
        border-radius: 999px;
        background: var(--gray);
        opacity: 0.35;
        transition: background 250ms ease, opacity 250ms ease, transform 200ms ease;
      }
    
      .step-dot--complete {
        background: var(--grayblue);
        opacity: 0.825;
      }
    
      .step-dot--active {
        background: var(--teal);
        opacity: 1;
        transform: scale(1.4);
      }
    
      /* ── Metric strip ────────────────────────────────────────────────── */
      .metric-strip {
        display: flex;
        flex-direction: row;
        align-items: center;
        border-bottom: var(--hairline);
        overflow-x: auto;
        overflow-y: hidden;
        flex-shrink: 0;
        will-change: height;
      }
    
      .metric-strip::-webkit-scrollbar { height: 2px; }
      .metric-strip::-webkit-scrollbar-track { background: transparent; }
      .metric-strip::-webkit-scrollbar-thumb { background: #DFC3A8; border-radius: 2px; }
    
      .metric-cell {
        display: flex;
        flex-direction: row;
        align-items: center;
        gap: 8px;
        padding: 5px 14px;
        flex-shrink: 0;
      }
    
      .metric-cell--sentiment { padding-left: 12px; }
    
      .metric-cell-label {
        display: flex;
        flex-direction: row;
        align-items: center;
        gap: 5px;
        flex-shrink: 0;
        white-space: nowrap;
      }
    
      .metric-cell-swatches {
        display: flex;
        flex-direction: row;
        gap: 2px;
        align-items: center;
        flex-shrink: 0;
      }
    
      .metric-strip-divider {
        width: 1px;
        height: 26px;
        background: var(--panel-dark);
        flex-shrink: 0;
        margin: 0 4px;
        opacity: 0.4;
      }
    
      /* Fixed min-width on pills prevents layout shift during crossfade */
      .sentiment-pill {
        min-width: 88px;
        text-align: center;
      }
    
      .metric-pill {
        min-width: 72px;
        text-align: center;
      }
    
      /* Active swatch — shared with sidebar */
      :global(.score-square--active) {
        outline: 2px solid var(--grayblue);
        outline-offset: 1px;
        filter: saturate(1.5);
        transform: scaleY(1.15);
      }
    
      /* ── Body ────────────────────────────────────────────────────────── */
      .info-bar-body {
        display: grid;
        grid-template-columns: minmax(220px, 1fr) minmax(0, 2fr);
        gap: 0;
        max-height: 28vh;
        overflow-y: auto;
        overflow-x: hidden;
        flex-shrink: 0;
        will-change: height;
      }
    
      .info-bar-body::-webkit-scrollbar { width: 3px; }
      .info-bar-body::-webkit-scrollbar-track { background: transparent; }
      .info-bar-body::-webkit-scrollbar-thumb { background: #DFC3A8; border-radius: 2px; }
    
      .body-col {
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding: 10px 14px;
        overflow-y: auto;
        min-height: 0;
      }
    
      .body-col--persona {
        border-right: var(--hairline);
      }
    
      /* ── Inflection cards ────────────────────────────────────────────── */
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
    
      .infl-opportunity {
        padding: 0.4rem 0.5rem;
        background: rgba(63, 115, 255, 0.06);
        border-left: 2px solid #3f73ff;
        border-radius: 3px;
        color: #3f73ff;
      }
    
      .border-top { border-top: var(--hairline); }
    
      /* ── Narrow viewport ─────────────────────────────────────────────── */
      @media (max-width: 768px) {
        .info-bar-body {
          grid-template-columns: 1fr;
          max-height: 55vh;
        }
    
        .body-col--persona {
          border-right: none;
          border-bottom: var(--hairline);
        }
      }
    </style>