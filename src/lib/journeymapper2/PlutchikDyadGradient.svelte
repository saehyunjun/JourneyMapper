<script>
  /**
   * DyadGradient.svelte
   * ─────────────────────────────────────────────────────────────────────────
   * Renders a circular SVG with a two-stop mesh gradient blended from the two
   * primary emotions that compose a Plutchik dyad.
   *
   * Inspired by Nadieh Bremer's mesh gradient technique:
   *   https://gist.github.com/nbremer/eb0d1fd4118b731d069e2ff98dfadc47
   *
   * Two off-center radial gradients (one per emotion) overlap inside a
   * <clipPath> circle. `mix-blend-mode: screen` blends saturated wheel colors
   * cleanly without muddying mid-tones.
   *
   * Resolves input via journeyConfig:
   *   - dyad id   ('sentimentality', 'love', 'optimism', …) → DYAD_BY_ID
   *   - raw score ('grief', 'alarm', 'ecstasy', …)         → SCORE_ALIASES → emotionColor
   *   - primary id ('joy', 'trust', …)                     → emotionColor
   *
   * For non-dyad scores, the single-emotion color is rendered as a flat fill
   * (no gradient), so the same component can stand in for any plutchik_score.
   */

  import { DYAD_BY_ID, SCORE_ALIASES, emotionColor } from './journeyConfig.js';

  /** Raw plutchik_score string from journey data (dyad id, primary emotion id, or alias). */
  export let score = '';

  /** Optional explicit override — { emotion_1: 'trust', emotion_2: 'sadness' } */
  export let dyad = null;

  /** SVG viewBox size — gradient mesh scales with this. */
  export let size = 32;

  /** Hairline ring around the circle. Set to 'none' to omit. */
  export let stroke = 'var(--panel)';

  /** Stroke width in px (matches jm-swatch hairline). */
  export let strokeWidth = 2.5;

  /** Optional aria-label override. Defaults to the dyad / emotion label. */
  export let ariaLabel = '';

  // ── Resolve the two component colors ────────────────────────────────────
  $: resolved = (() => {
    // 1. Explicit dyad prop wins.
    if (dyad?.emotion_1 && dyad?.emotion_2) {
      return {
        c1: emotionColor(dyad.emotion_1),
        c2: emotionColor(dyad.emotion_2),
        label: dyad.label ?? `${dyad.emotion_1} + ${dyad.emotion_2}`,
        isDyad: true,
      };
    }

    // 2. Score string → dyad lookup.
    const raw = score?.toLowerCase().trim() ?? '';
    const d = DYAD_BY_ID[raw];
    if (d?.primary?.length === 2) {
      return {
        c1: emotionColor(d.primary[0]),
        c2: emotionColor(d.primary[1]),
        label: d.label ?? raw,
        isDyad: true,
      };
    }

    // 3. Single emotion fallback (raw or aliased primary).
    const id = SCORE_ALIASES[raw] ?? raw;
    const c = emotionColor(id);
    return { c1: c, c2: c, label: raw || id, isDyad: false };
  })();

  // ── Stable, unique IDs per instance for <defs> references ───────────────
  // Math.random is deterministic enough for SVG defs scoping; collisions are
  // harmless within a single render tree because each instance re-mounts.
  const uid = `dg-${Math.random().toString(36).slice(2, 9)}`;
  $: gradId1 = `${uid}-g1`;
  $: gradId2 = `${uid}-g2`;
  $: clipId = `${uid}-clip`;

  $: r = size / 2;
</script>

<svg
  width={size}
  height={size}
  viewBox="0 0 {size} {size}"
  role="img"
  aria-label={ariaLabel || resolved.label}
  class="dyad-gradient"
>
  <defs>
    <clipPath id={clipId}>
      <circle cx={r} cy={r} r={r} />
    </clipPath>

    {#if resolved.isDyad}
      <!-- First emotion: anchored upper-left, fades out toward edge -->
      <radialGradient id={gradId1} cx="30%" cy="30%" r="75%">
        <stop offset="0%"   stop-color={resolved.c1} stop-opacity="1" />
        <stop offset="20%"  stop-color={resolved.c1} stop-opacity="0.15" />
        <stop offset="90%" stop-color={resolved.c1} stop-opacity=".4" />
      </radialGradient>

      <!-- Second emotion: anchored lower-right, fades out toward edge -->
      <radialGradient id={gradId2} cx="70%" cy="70%" r="75%">
        <stop offset="0%"   stop-color={resolved.c2} stop-opacity="1" />
        <stop offset="60%"  stop-color={resolved.c2} stop-opacity="0.55" />
        <stop offset="100%" stop-color={resolved.c2} stop-opacity="0" />
      </radialGradient>
    {/if}
  </defs>

  <g clip-path="url(#{clipId})">
    {#if resolved.isDyad}
      <!-- Neutral base so transparent edges of both gradients land on something
           rather than the page background. Average of the two emotion colors
           via color-mix keeps the rim coherent with the mesh. -->
      <rect
        x="0" y="0" width={size} height={size}
        fill="color-mix(in srgb, {resolved.c1} 50%, {resolved.c2})"
      />
      <rect
        x="0" y="0" width={size} height={size}
        fill="url(#{gradId1})"
        style="mix-blend-mode: screen;"
      />
      <rect
        x="0" y="0" width={size} height={size}
        fill="url(#{gradId2})"
        style="mix-blend-mode: screen;"
      />
    {:else}
      <rect
        x="0" y="0" width={size} height={size}
        fill={resolved.c1}
      />
    {/if}
  </g>

  {#if stroke !== 'none'}
    <circle
      cx={r} cy={r} r={r - strokeWidth / 2}
      fill="none"
      {stroke}
      stroke-width={strokeWidth}
    />
  {/if}
</svg>

<style>
  .dyad-gradient {
    display: inline-block;
    flex: 0 0 auto;
    vertical-align: middle;
  }
</style>