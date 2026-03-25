<script>
  import { fade, fly } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';

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

  /**
   * Build a 10-stop light→dark ramp from a CSS hex color.
   * Stop 0 = very light tint (≈10 % opacity blend toward white).
   * Stop 9 = the full saturated base color.
   *
   * We use `color-mix(in srgb, …)` which is supported in all modern
   * browsers and avoids any JS color-parsing overhead.
   */
  function buildRamp(baseColor) {
    return STOPS.map((_, si) => {
      // si=0 → 10% base, si=9 → 100% base
      const pct = Math.round(10 + (si / (STOPS.length - 1)) * 90);
      return `color-mix(in srgb, ${baseColor} ${pct}%, white)`;
    });
  }

  /**
   * Derive per-square opacity based on distance from the active position.
   * Active square → 1; neighbours fall off; floor at 0.12.
   */
  function squareOpacity(si, activePos) {
    const isActive = si === Math.round(activePos);
    const dist     = Math.abs(si - activePos);
    return isActive ? 1 : Math.max(0.12, 1 - dist * 0.28);
  }
</script>

<div class="index-metric-bars" class:index-metric-bars--compact={compact}>
  {#if !compact}
    <span class="label-sm">Index Metrics</span>
  {/if}

  {#each metrics as m, i}
    {@const tweenedVal = metricVals[i] ?? 0}
    {@const ramp       = buildRamp(m.color)}
    {@const activePos  = (tweenedVal + 5) / 10 * (STOPS.length - 1)}

    <div
      class="jm-content-col-full w-9/12"
      in:fly={{ y: 4, duration: 200, delay: 60 + i * 40, easing: cubicOut }}
    >
      <!-- Label row -->
      <div class="jm-content-row-stretch align-middle">
      <div class="flex flex-row gap-2 align-middle">
        <div class="w-3 h-3 ring-1" style="background: {m.color};"></div>
        <span class="label-heading">{m.label}</span>
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

      <!-- Score squares — monochromatic light→dark ramp -->
      <div class="imb-squares">
        {#each STOPS as _stop, si}
          {@const opacity  = squareOpacity(si, activePos)}
          {@const isActive = si === Math.round(activePos)}
          <div
            class="imb-square"
            class:imb-square--active={isActive}
            style="background: {ramp[si]}; opacity: {opacity};"
          />
        {/each}
      </div>
    </div>
  {/each}
</div>

<style>
  /* ── Container ───────────────────────────────────────────────── */
  .index-metric-bars {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .index-metric-bars--compact {
    gap: 10px;
  }
  
  /* ── Score squares ───────────────────────────────────────────── */
  .imb-squares {
    display: flex;
    flex-direction: row;
    gap: .125em;
    width: 100%;
  }

  .imb-square {
    flex: 1;
    height: 1.25em;
    width: 1.25em;
    filter: saturate(0.25);
    opacity: 50%;
    transition: opacity 0.15s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .imb-square--active {
    outline: 1.5px solid rgba(0, 0, 0, 0.5);
    outline-offset: 1px;
    opacity: 100%;
    border-radius: 1px;
    filter: saturate(1);
  }
</style>