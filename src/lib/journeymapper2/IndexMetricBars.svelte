<script>
    import { fade, fly } from 'svelte/transition';
    import { cubicOut } from 'svelte/easing';
    import SmileyBlank  from 'phosphor-icons-svelte/IconSmileyBlankBold.svelte';
    import CalenderDots from 'phosphor-icons-svelte/IconCalendarDotsBold.svelte';
    import HandHeart    from 'phosphor-icons-svelte/IconHandHeartBold.svelte';
    import Aclepius     from 'phosphor-icons-svelte/IconAsclepiusBold.svelte';
    import { metricScoreLabel } from './journeyConfig.js';
  
    /**
     * Array of metric config objects: { key, label, color }
     * `color` is the base hue used to derive the light→dark ramp.
     */
    export let metrics = /** @type {{ key: string; label: string; color: string }[]} */ ([]);
  
    /**
     * Parallel array of tweened/current values for each metric (−5 → +5).
     * Kept in sync by the parent via tweened stores.
     */
    export let metricVals = /** @type {number[]} */ ([]);
  
    /**
     * The currently active step index — used as a `{#key}` anchor so
     * value readouts fade-in whenever the step changes.
     */
    export let selectedIndex = -1;
  
    /**
     * Compact mode for the sidebar: tighter gaps, no section heading.
     * Set to false (default) for the full detail-panel presentation.
     */
    export let compact = false;
  
    // 10 evenly-spaced stops spanning −5 → +5
    const STOPS = Array.from({ length: 10 }, (_, i) => -5 + i * (10 / 9));
  
    /** Map each metric key to its icon component. */
    const METRIC_ICONS = {
      emotional_valence:     SmileyBlank,
      logistical_capacity:   CalenderDots,
      provider_trust:        Aclepius,
      medical_self_efficacy: HandHeart,
    };
  
    /**
     * Build a 10-stop light→dark ramp from a CSS hex color.
     */
    function buildRamp(baseColor) {
      return STOPS.map((_, si) => {
        const pct = Math.round(10 + (si / (STOPS.length - 1)) * 90);
        return `color-mix(in srgb, ${baseColor} ${pct}%, white)`;
      });
    }
  
    /**
     * Derive per-square opacity based on distance from the active position.
     * Active square → 1; neighbours fall off; floor at 0.12.
     */
    function squareOpacity(si, activePos) {
      const dist = Math.abs(si - activePos);
      return si === Math.round(activePos) ? 1 : Math.max(0.12, 1 - dist * 0.28);
    }
  </script>
  
  <div class="index-metric-bars" class:index-metric-bars--compact={compact}>
    <div class="imb-grid">
      {#each metrics as m, i}
        {@const tweenedVal    = metricVals[i] ?? 0}
        {@const ramp          = buildRamp(m.color)}
        {@const activePos     = (tweenedVal + 5) / 10 * (STOPS.length - 1)}
        {@const IconComponent = METRIC_ICONS[m.key] ?? null}
  
        <div
          class="imb-card"
          in:fly={{ y: 4, duration: 200, delay: 60 + i * 40, easing: cubicOut }}
        >
          <div class="flex flex-col gap-2">
  
            <!-- ── Label row ──────────────────────────────────────────── -->
            <div class="jm-content-row align-middle w-full">
              <div class="flex flex-row gap-2 w-full items-center justify-between">
  
                <div class="flex flex-row gap-2 align-middle items-center">
                  {#if IconComponent}
                    <span class="imb-icon" 
                    style="color: {m.color};">
                      <svelte:component this={IconComponent} class="h-4" />
                    </span>
                  {:else}
                    <div class="w-2 h-2 ring-1" 
                    style="background: {m.color};"></div>
                  {/if}
                  <span class="text-body-sm">{m.label}</span>
                </div>
  
            <!-- ── Qualitative label ───────────────────────────────────── -->
            {#key selectedIndex}
              <span
                class="pill font-semibold"
                style="border: 1px solid {m.color}; color: {m.color}"
                in:fade={{ duration: 200, delay: 80 + i * 40 }}
                out:fade={{ duration: 80 }}
              >
                {metricScoreLabel(m.key, tweenedVal)}
              </span>
            {/key}
              </div>
            </div>
  
            <!-- ── Squares ────────────────────────────────────────────── -->
            <div class="flex flex-row w-full justify-between">
            <div class="flex flex-row gap-1">
              {#each STOPS as _stop, si}
                {@const opacity  = squareOpacity(si, activePos)}
                {@const isActive = si === Math.round(activePos)}
                <div
                  class="jm-swatch-round"
                  class:imb-square--active={isActive}
                  class:jm-swatch--compact={compact}
                  style="background: {ramp[si]}; 
                  opacity: {opacity};"></div>
              {/each}
            </div>
              {#key selectedIndex}
              <span
                class="label"
                style="color: {m.color};"
                in:fade={{ duration: 180, delay: 60 + i * 40 }}
                out:fade={{ duration: 80 }}
              >
                {tweenedVal > 0 ? '+' : ''}{tweenedVal.toFixed(1)}
              </span>
            {/key}
            </div>

  
          </div>
        </div>
      {/each}
    </div>
  </div>
  
  <style>
    /* ── Container ───────────────────────────────────────────────── */
    .index-metric-bars {
      display: flex;
      flex-direction: column;
      gap: 1em;
    }
  
    .index-metric-bars--compact {
      display: flex;
      flex-direction: column;
    }
    .imb-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 2em;
}

.index-metric-bars--compact .imb-grid {
  display:flex;
    flex-direction: column;
    max-width: 300px;
}
  
    @media (max-width: 480px) {
      .imb-grid {
        grid-template-columns: 1fr;
      }
    }
  
    /* ── Metric icon ─────────────────────────────────────────────── */
    .imb-icon {
      display: flex;
      align-items: center;
      flex-shrink: 0;
      opacity: 0.85;
    }

    .imb-square--active {
      outline: 1.15px solid var(--grayblue);
      outline-offset: 1px;
      opacity: 100%;
      filter: saturate(1);
    }
  </style>