<script lang="ts">
  import WarningDiamondRegular  from "phosphor-icons-svelte/IconWarningDiamondDuotone.svelte";
  import HospitalRegular        from "phosphor-icons-svelte/IconHospitalDuotone.svelte";
  import TrendUpRegular         from "phosphor-icons-svelte/IconTrendUpRegular.svelte";
  import UsersThreeRegular      from "phosphor-icons-svelte/IconUsersThreeRegular.svelte";
  import MagnifyingGlassRegular from "phosphor-icons-svelte/IconMagnifyingGlassRegular.svelte";
  import LightbulbRegular       from "phosphor-icons-svelte/IconLightbulbRegular.svelte";

  // ── Types ─────────────────────────────────────────────────────────────────
  type EventType =
    | "roadblock"
    | "hospitalization"
    | "progress"
    | "community"
    | "info_source"
    | "intervention";

  /**
   * Four visual classifications:
   *   positive → green  (progress, community)
   *   negative → red    (roadblock, hospitalization)
   *   info     → blue   (info_source)
   *   sponsor  → amber  (intervention)
   */
  type Polarity = "positive" | "negative" | "info" | "sponsor";

  type EventDatum = {
    event_id?:    string;
    type:         EventType;
    label?:       string;
    short_label?: string;
    description?: string;
    tooltip?:     string;
    [key: string]: unknown;
  };

  type EventConfig = {
    icon:         typeof WarningDiamondRegular;
    polarity:     Polarity;
    defaultLabel: string;
  };

  // ── Props ─────────────────────────────────────────────────────────────────
  /** Pass the raw event object — all fields are auto-populated. */
  export let event: EventDatum | null = null;

  export let type: EventType        = (event?.type ?? "roadblock") as EventType;
  export let label: string          = event?.label        ?? "";
  export let shortLabel: string     = event?.short_label  ?? "";
  export let description: string    = event?.description  ?? "";
  export let tooltip: string        = event?.tooltip      ?? "";
  export let compact: boolean       = false;
  export let onClick: (() => void) | null = null;

  // ── Populate from event object ────────────────────────────────────────────
  $: if (event) {
    if (!type || type === "roadblock") type        = event.type        as EventType;
    if (!label)                        label        = event.label       ?? "";
    if (!shortLabel)                   shortLabel   = event.short_label ?? "";
    if (!description)                  description  = event.description ?? "";
    if (!tooltip)                      tooltip      = event.tooltip     ?? "";
  }

  // ── Config map ────────────────────────────────────────────────────────────
  const EVENT_CONFIG: Record<string, EventConfig> = {
    roadblock: {
      icon:         WarningDiamondRegular,
      polarity:     "negative",
      defaultLabel: "Roadblock",
    },
    hospitalization: {
      icon:         HospitalRegular,
      polarity:     "negative",
      defaultLabel: "Hospitalization",
    },
    progress: {
      icon:         TrendUpRegular,
      polarity:     "positive",
      defaultLabel: "Progress",
    },
    community: {
      icon:         UsersThreeRegular,
      polarity:     "positive",
      defaultLabel: "Community",
    },
    info_source: {
      icon:         MagnifyingGlassRegular,
      polarity:     "info",
      defaultLabel: "Information Source",
    },
    intervention: {
      icon:         LightbulbRegular,
      polarity:     "sponsor",
      defaultLabel: "Intervention Opportunity",
    },
  };

  $: config   = EVENT_CONFIG[type] ?? EVENT_CONFIG.roadblock;
  $: Icon     = config.icon;
  $: polarity = config.polarity as Polarity;

  $: isPos     = polarity === "positive";
  $: isNeg     = polarity === "negative";
  $: isInfo    = polarity === "info";
  $: isSponsor = polarity === "sponsor";

  $: displayLabel      = label      || config.defaultLabel;
  $: displayShortLabel = shortLabel || displayLabel;

  // ── Tooltip tracking ──────────────────────────────────────────────────────
  let hovered = false;
  let mouseX  = 0;
  let mouseY  = 0;

  const TIP_W    = 320;
  const TIP_H    = 80;
  const OFFSET_X = 12;
  const OFFSET_Y = 10;

  $: vpW = typeof window !== 'undefined' ? window.innerWidth  : 9999;
  $: vpH = typeof window !== 'undefined' ? window.innerHeight : 9999;

  $: flipLeft = mouseX + OFFSET_X + TIP_W > vpW - 12;
  $: flipUp   = mouseY + OFFSET_Y + TIP_H > vpH - 12;

  $: tipX = flipLeft ? mouseX - TIP_W - OFFSET_X : mouseX + OFFSET_X;
  $: tipY = flipUp   ? mouseY - TIP_H - OFFSET_Y : mouseY + OFFSET_Y;

  function onMouseMove(e: MouseEvent) {
    mouseX = e.clientX;
    mouseY = e.clientY;
  }
</script>

<svelte:window on:mousemove={hovered ? onMouseMove : null} />

<!-- ─────────────────────────────────────────────────────────────────────────
     COMPACT PILL — inline chart row
───────────────────────────────────────────────────────────────────────────── -->
{#if compact}
  <button
    class="event-pill"
    class:event-pill--pos={isPos}
    class:event-pill--neg={isNeg}
    class:event-pill--info={isInfo}
    class:event-pill--sponsor={isSponsor}
    onclick={onClick}
    onmouseenter={() => (hovered = true)}
    onmouseleave={() => (hovered = false)}
    aria-label="{type}: {displayLabel}"
    type="button"
  >
    <span
      class="event-pill__icon"
      class:event-icon--pos={isPos}
      class:event-icon--neg={isNeg}
      class:event-icon--info={isInfo}
      class:event-icon--sponsor={isSponsor}
      aria-hidden="true"
    >
      <svelte:component this={Icon} class="text-2xl p-1" />
    </span>
    <span class="label-sm">{displayShortLabel}</span>
  </button>

<!-- ─────────────────────────────────────────────────────────────────────────
     FULL CARD — drawers, sidebars, detail panels
───────────────────────────────────────────────────────────────────────────── -->
{:else}
  <button
    class="event-card jm-surface"
    class:event-card--pos={isPos}
    class:event-card--neg={isNeg}
    class:event-card--info={isInfo}
    class:event-card--sponsor={isSponsor}
    onclick={onClick}
    onmouseenter={() => (hovered = true)}
    onmouseleave={() => (hovered = false)}
    aria-label="{type}: {displayLabel}"
    type="button"
  >
    <!-- Header: icon badge + type kicker -->
    <div class="event-card__header">
      <div
        class="event-card__icon-badge"
        class:event-card__icon-badge--pos={isPos}
        class:event-card__icon-badge--neg={isNeg}
        class:event-card__icon-badge--info={isInfo}
        class:event-card__icon-badge--sponsor={isSponsor}
        aria-hidden="true"
      >
        <svelte:component this={Icon} class="text-2xl p-1" />
      </div>

      <span
        class="event-card__type-kicker jm-kicker"
        class:event-card__type-kicker--pos={isPos}
        class:event-card__type-kicker--neg={isNeg}
        class:event-card__type-kicker--info={isInfo}
        class:event-card__type-kicker--sponsor={isSponsor}
      >
        {type.replace("_", " ")}
      </span>
    </div>

    <!-- Rule -->
    <div
      class="event-card__rule"
      class:event-card__rule--pos={isPos}
      class:event-card__rule--neg={isNeg}
      class:event-card__rule--info={isInfo}
      class:event-card__rule--sponsor={isSponsor}
    ></div>

    <!-- Label -->
    <p class="event-card__label label-lg">{displayLabel}</p>

    <!-- Description -->
    {#if description}
      <p class="text-body-sm">{description}</p>
    {/if}

  </button>
{/if}

<!-- ─────────────────────────────────────────────────────────────────────────
     TOOLTIP — fixed-position, shared by both modes
───────────────────────────────────────────────────────────────────────────── -->
{#if hovered && tooltip}
  <div
    class="tooltip"
    class:event-tooltip--pos={isPos}
    class:event-tooltip--neg={isNeg}
    class:event-tooltip--info={isInfo}
    class:event-tooltip--sponsor={isSponsor}
    style="left:{tipX}px; top:{tipY}px; width:{TIP_W}px;"
    role="tooltip"
    aria-live="polite"
  >
    <div
      class="event-pill__icon w-fit h-fit absolute top-2 right-2"
      class:event-icon--pos={isPos}
      class:event-icon--neg={isNeg}
      class:event-icon--info={isInfo}
      class:event-icon--sponsor={isSponsor}
      aria-hidden="true"
    >
      <svelte:component this={Icon} class="text-2xl p-1" />
    </div>

    <div class="flex flex-row max-h-8 justify-between align-bottom h-fit pb-2 mb-2">
      <span
        class="label-xs"
        class:event-card__type-kicker--pos={isPos}
        class:event-card__type-kicker--neg={isNeg}
        class:event-card__type-kicker--info={isInfo}
        class:event-card__type-kicker--sponsor={isSponsor}
      >{type.replace("_", " ")}</span>
    </div>

    <h3 class="label-sm mb-2">{displayLabel}</h3>

    <div
      class="event-tooltip__rule"
      class:event-tooltip__rule--pos={isPos}
      class:event-tooltip__rule--neg={isNeg}
      class:event-tooltip__rule--info={isInfo}
      class:event-tooltip__rule--sponsor={isSponsor}
    ></div>

    <p class="text-body-sm">{tooltip}</p>
  </div>
{/if}


<style>
  /* ════════════════════════════════════════════════════════════════════════
     FULL CARD BASE
  ════════════════════════════════════════════════════════════════════════ */
  .event-card {
    display: flex;
    flex-direction: column;
    gap: 1em;
    width: 100%;
    padding: 14px 16px;
    border-radius: 12px;
    text-align: left;
    cursor: pointer;
    border-width: 1.5px;
    border-style: solid;
    transition:
      box-shadow 180ms ease,
      transform   180ms ease,
      background  180ms ease;
  }

  .event-card:hover  { transform: translateY(-2px); box-shadow: 0 8px 20px rgba(0,0,0,0.12); }
  .event-card:active { transform: scale(0.98); }

  /* ── Positive — green */
  .event-card--pos       { border-color: #1a7a4a; background: #f0faf4; }
  .event-card--pos:hover { background: #e3f7ec; }

  /* ── Negative — red */
  .event-card--neg       { border-color: #c0392b; background: #fff5f4; }
  .event-card--neg:hover { background: #ffe8e5; }

  /* ── Info source — slate blue */
  .event-card--info       { border-color: #3b6ea8; background: #f0f5fc; }
  .event-card--info:hover { background: #e4eef9; }

  /* ── Intervention — amber */
  .event-card--sponsor       { border-color: #a06b10; background: #fdf8ee; }
  .event-card--sponsor:hover { background: #faf0d7; }


  /* ════════════════════════════════════════════════════════════════════════
     HEADER
  ════════════════════════════════════════════════════════════════════════ */
  .event-card__header {
    display: flex;
    align-items: center;
    gap: 2em;
  }

  .event-card__icon-badge {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border-radius: 8px;
    flex-shrink: 0;
  }

  .event-card__icon-badge--pos     { background: #c6f0d8; color: #0f5c32; }
  .event-card__icon-badge--neg     { background: #ffd8d4; color: #8b1a10; }
  .event-card__icon-badge--info    { background: #d0e4f7; color: #1e4a80; }
  .event-card__icon-badge--sponsor { background: #fde9bf; color: #7a4d08; }

  .event-card__type-kicker--pos     { color: #0f5c32; }
  .event-card__type-kicker--neg     { color: #8b1a10; }
  .event-card__type-kicker--info    { color: #1e4a80; }
  .event-card__type-kicker--sponsor { color: #7a4d08; }


  /* ════════════════════════════════════════════════════════════════════════
     RULE
  ════════════════════════════════════════════════════════════════════════ */
  .event-card__rule { height: 1px; width: 100%; }

  .event-card__rule--pos     { background: #b6e8cc; }
  .event-card__rule--neg     { background: #f5c0bc; }
  .event-card__rule--info    { background: #b8d4f0; }
  .event-card__rule--sponsor { background: #f5dda0; }


  /* ════════════════════════════════════════════════════════════════════════
     LABEL
  ════════════════════════════════════════════════════════════════════════ */
  .event-card__label {
    margin: 0;
    color: var(--ink);
    line-height: 1.3;
  }


  /* ════════════════════════════════════════════════════════════════════════
     ICON CIRCLE TINTS — pill icon + tooltip corner icon
  ════════════════════════════════════════════════════════════════════════ */
  .event-icon--pos     { background: #1a7a4a; color: #e3f7ec; border-radius: 100em; }
  .event-icon--neg     { background: #c0392b; color: #f5b4ae; border-radius: 100em; }
  .event-icon--info    { background: #2a5fa0; color: #ddeeff; border-radius: 100em; }
  .event-icon--sponsor { background: #a06b10; color: #fef0d0; border-radius: 100em; }


  /* ════════════════════════════════════════════════════════════════════════
     COMPACT PILL
  ════════════════════════════════════════════════════════════════════════ */
  .event-pill {
    display: inline-flex;
    align-items: center;
    gap: 0.725em;
    padding: 3px 7px 3px 5px;
    border-radius: 100px;
    border: 1px solid transparent;
    cursor: pointer;
    white-space: nowrap;
    transition:
      box-shadow 150ms ease,
      transform  150ms ease;
  }

  .event-pill:hover  { transform: translateY(-1px); box-shadow: 0 3px 8px rgba(0,0,0,0.14); }
  .event-pill:active { transform: scale(0.96); }

  .event-pill--pos     { background: #d4f5e3; border-color: #2d9e62; }
  .event-pill--neg     { background: #fde4e1; border-color: #d9382a; }
  .event-pill--info    { background: #daeaf9; border-color: #3b6ea8; }
  .event-pill--sponsor { background: #fdefc8; border-color: #c48a1a; }

  .event-pill__icon { display: flex; align-items: center; flex-shrink: 0; }


  /* ════════════════════════════════════════════════════════════════════════
     TOOLTIP
  ════════════════════════════════════════════════════════════════════════ */
  .event-tooltip--pos     { border-color: #1a7a4a; background: #f4fcf7; }
  .event-tooltip--neg     { border-color: #c0392b; background: #fff8f7; }
  .event-tooltip--info    { border-color: #3b6ea8; background: #f4f8fd; }
  .event-tooltip--sponsor { border-color: #a06b10; background: #fdf9f0; }

  .event-tooltip__rule--pos     { height: 1px; background: #b6e8cc; margin-bottom: 0.5rem; }
  .event-tooltip__rule--neg     { height: 1px; background: #f5c0bc; margin-bottom: 0.5rem; }
  .event-tooltip__rule--info    { height: 1px; background: #b8d4f0; margin-bottom: 0.5rem; }
  .event-tooltip__rule--sponsor { height: 1px; background: #f5dda0; margin-bottom: 0.5rem; }
</style>