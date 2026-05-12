<script>
    import { onMount } from 'svelte';
    import {
      sentimentToColor,
      ratingToLabel,
      emotionColor,
      DYAD_BY_ID,
      SCORE_ALIASES,
      EMOTION_BY_ID,
      SENTIMENT_SCALE,
    } from './journeyConfig.js';
    import DyadGradient from './PlutchikDyadGradient.svelte';
  
    /** Full flat journey data array — same array passed to the flow diagram */
    export let data = [];
  
    /**
     * The scrollable container that holds the flow step slots.
     * The HUD observes `.flow-step-slot` elements inside this ref to determine
     * which step is currently topmost in the visible area.
     * @type {HTMLElement | null}
     */
    export let scrollRef = null;
  
    // ── Scroll-tracked active index ───────────────────────────────────────────
    // Starts at 0 so the HUD is populated immediately on mount.
    let visibleIndex = 0;
  
    /** @type {IntersectionObserver | null} */
    let observer = null;
  
    /**
     * Build (or rebuild) the IntersectionObserver whenever scrollRef changes.
     * We watch each .flow-step-slot; when multiple are intersecting we pick the
     * one with the highest intersection ratio (most visible), breaking ties by
     * lowest index (topmost wins).
     */
    function setupObserver() {
      observer?.disconnect();
      if (!scrollRef) return;
  
      // Map from DOM element → step index
      const slots = Array.from(scrollRef.querySelectorAll('.flow-step-slot'));
      if (!slots.length) return;
  
      /** Current intersection ratios keyed by slot index */
      const ratios = new Array(slots.length).fill(0);
  
      observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            const idx = slots.indexOf(entry.target);
            if (idx !== -1) ratios[idx] = entry.intersectionRatio;
          }
          // Pick the most-visible slot; on a tie take the topmost (lowest index)
          let best = -1;
          let bestRatio = -1;
          for (let i = 0; i < ratios.length; i++) {
            if (ratios[i] > bestRatio) {
              bestRatio = ratios[i];
              best = i;
            }
          }
          if (best !== -1) visibleIndex = best;
        },
        {
          root: scrollRef,
          // Fire when any pixel enters the root
          threshold: [0, 0.1, 0.25, 0.5, 0.75, 1.0],
        }
      );
  
      slots.forEach((el) => observer?.observe(el));
    }
  
    onMount(() => {
      setupObserver();
      return () => observer?.disconnect();
    });
  
    // Re-wire whenever scrollRef is bound (parent bind:this resolves after mount)
    $: if (scrollRef) setupObserver();
  
    // ── Active step ───────────────────────────────────────────────────────────
    $: step = data[visibleIndex] ?? data[0] ?? null;
    $: displayIndex = step ? visibleIndex : -1;
  
    // ── Sentiment ─────────────────────────────────────────────────────────────
    $: sentimentVal   = step?.sentiment ?? 0;
    $: sentimentColor = step ? sentimentToColor(sentimentVal) : 'transparent';
    $: sentimentLabel = step ? ratingToLabel(sentimentVal) : '';
  
    $: activeSwatchIdx = (() => {
      if (!step) return -1;
      const t = (Math.max(-5, Math.min(5, parseFloat(sentimentVal))) + 5) / 10;
      return Math.round(t * (SENTIMENT_SCALE.length - 1));
    })();
  
    // ── Emotion (Plutchik) ────────────────────────────────────────────────────
    $: plutchikScore = step?.plutchik_score?.toLowerCase().trim() ?? '';
  
    $: emotionLabel = (() => {
      if (!plutchikScore) return '';
      const dyad = DYAD_BY_ID[plutchikScore];
      if (dyad) return dyad.label;
      const id = SCORE_ALIASES[plutchikScore] ?? plutchikScore;
      return EMOTION_BY_ID[id]?.label ?? plutchikScore;
    })();
  
    $: emotionSwatches = (() => {
      if (!plutchikScore) return [];
      const dyad = DYAD_BY_ID[plutchikScore];
      if (dyad) return dyad.primary.map((pid) => emotionColor(pid));
      const id = SCORE_ALIASES[plutchikScore] ?? plutchikScore;
      return [emotionColor(id)];
    })();
  
    // ── Step label ────────────────────────────────────────────────────────────
    $: stepLabel = step?.step ?? '';
    $: stepNum   = displayIndex >= 0 ? displayIndex + 1 : null;
  </script>
  
  <div
    class="flow-hud"
    role="region"
    aria-live="off"
    aria-label="Current step sentiment and emotion"
  >
      <!-- Step indicator -->
      <div class="flow-hud__step-row">
        <span class="label-xs flow-hud__step-num">Step {stepNum}</span>
        <span class="label-xs flow-hud__step-name">{stepLabel}</span>
      </div>
  
      <div class="flow-hud__divider"></div>
  
      <!-- Sentiment gradient strip + label -->
      <div class="flow-hud__section">
        <span class="label-xs flow-hud__section-label">Sentiment</span>
        <div class="flow-hud__sentiment-row">
          <!-- Gradient strip: each swatch cell, active one highlighted -->
          <div class="flow-hud__gradient-strip" aria-hidden="true">
            {#each SENTIMENT_SCALE as stopColor, i}
              <div
                class="flow-hud__gradient-cell"
                class:flow-hud__gradient-cell--active={i === activeSwatchIdx}
                style="background-color: {stopColor};"
              ></div>
            {/each}
          </div>
          <!-- Active score pill -->
          <span
            class="pill-sm flow-hud__sentiment-pill"
            style="border-color: {sentimentColor}; color: {sentimentColor};"
          >
            {sentimentLabel}
          </span>
        </div>
      </div>
  
      <div class="flow-hud__divider"></div>
  
      <!-- Emotion / Plutchik dyad -->
      <div class="flow-hud__section">
        <span class="label-xs flow-hud__section-label">Emotion</span>
        <div class="flow-hud__emotion-row">
          {#if plutchikScore}
            <DyadGradient score={plutchikScore} size={72} />
          {:else}
            <!-- Fallback swatches when DyadGradient has no score -->
            <div class="flow-hud__emotion-swatches" aria-hidden="true">
              {#each emotionSwatches as color}
                <span class="jm-swatch-round-sm" style="background: {color};"></span>
              {/each}
            </div>
          {/if}
          <span class="label-sm flow-hud__emotion-label">{emotionLabel}</span>
        </div>
      </div>
  </div>
  
  <style>
    .flow-hud {
      position: sticky;
      top: 10.75rem;
      align-self: flex-start;
      z-index: 50;
  
      display: flex;
      flex-direction: column;
      gap: 0;
  
      width: 11rem;
      background: var(--panel, #fff);
      border: 1px solid var(--hairline, #e5e5e5);
      border-radius: 0.5rem;
      box-shadow: var(--shadow, 0 2px 8px rgba(0,0,0,0.08));
      overflow: hidden;
    }
  
    /* ── Step indicator row ─────────────────────────────────────────────────── */
    .flow-hud__step-row {
      display: flex;
      flex-direction: row;
      align-items: baseline;
      gap: 0.375rem;
      padding: 0.5rem 0.625rem 0.375rem;
      background: var(--lightgrayblue, #f0f2f6);
    }
  
    .flow-hud__step-num {
      flex-shrink: 0;
      color: var(--grayblue, #6b7ea8);
      font-weight: 700;
    }
  
    .flow-hud__step-name {
      color: var(--ink, #2a2a2a);
      font-weight: 500;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 7rem;
    }
  
    /* ── Divider ────────────────────────────────────────────────────────────── */
    .flow-hud__divider {
      height: 1px;
      background: var(--hairline, #e5e5e5);
      flex-shrink: 0;
    }
  
    /* ── Section wrapper (sentiment / emotion) ──────────────────────────────── */
    .flow-hud__section {
      display: flex;
      flex-direction: column;
      gap: 0.375rem;
      padding: 0.5rem 0.625rem;
    }
  
    .flow-hud__section-label {
      color: var(--grayblue, #8090a8);
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }
  
    /* ── Sentiment row ──────────────────────────────────────────────────────── */
    .flow-hud__sentiment-row {
      display: flex;
      flex-direction: column;
      gap: 0.375rem;
    }
  
    /* The horizontal gradient strip — 10 cells matching SENTIMENT_SCALE */
    .flow-hud__gradient-strip {
      display: flex;
      flex-direction: row;
      height: 0.5rem;
      border-radius: 100px;
      overflow: hidden;
      gap: 1px;
    }
  
    .flow-hud__gradient-cell {
      flex: 1;
      opacity: 0.18;
      transition: opacity 200ms ease, transform 200ms ease;
      border-radius: 2px;
    }
  
    .flow-hud__gradient-cell--active {
      opacity: 1;
      transform: scaleY(1.5);
      transform-origin: center;
    }
  
    /* Reuse pill-sm from app.css; just override color via inline style */
    .flow-hud__sentiment-pill {
      align-self: flex-start;
    }
  
    /* ── Emotion row ────────────────────────────────────────────────────────── */
    .flow-hud__emotion-row {
      display: flex;
      flex-direction: row;
      align-items: center;
      gap: 0.5rem;
    }
  
    .flow-hud__emotion-swatches {
      display: flex;
      flex-direction: row;
      gap: 0.25rem;
    }
  
    .flow-hud__emotion-label {
      color: var(--ink, #2a2a2a);
      font-weight: 500;
      line-height: 1.2;
    }
  </style>