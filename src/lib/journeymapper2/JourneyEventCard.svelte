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
      <svelte:component this={Icon} class="text-lg p-1" />
    </span>
    <span class="label-sm">
      {displayShortLabel}</span>
  </button>

<!-- ─────────────────────────────────────────────────────────────────────────
     FULL CARD — drawers, sidebars, detail panels
───────────────────────────────────────────────────────────────────────────── -->
{:else}
  <button
    class="step-event"
    class:step-event--pos={isPos}
    class:step-event--neg={isNeg}
    class:step-event--info={isInfo}
    class:step-event--sponsor={isSponsor}
    onclick={onClick}
    onmouseenter={() => (hovered = true)}
    onmouseleave={() => (hovered = false)}
    aria-label="{type}: {displayLabel}"
    type="button"
  >
    <!-- Header: icon badge + type kicker -->
    <div class="step-event__header">
      <div
        class="step-event__icon-badge"
        class:step-event__icon-badge--pos={isPos}
        class:step-event__icon-badge--neg={isNeg}
        class:step-event__icon-badge--info={isInfo}
        class:step-event__icon-badge--sponsor={isSponsor}
        aria-hidden="true"
      >
        <svelte:component this={Icon} class="text-lg" />
      </div>

      <span
        class="step-event__type-kicker jm-kicker"
        class:step-event__type-kicker--pos={isPos}
        class:step-event__type-kicker--neg={isNeg}
        class:step-event__type-kicker--info={isInfo}
        class:step-event__type-kicker--sponsor={isSponsor}
      >
        {type.replace("_", " ")}
      </span>
    </div>

    <!-- Rule -->
    <div
      class="step-event__rule"
      class:step-event__rule--pos={isPos}
      class:step-event__rule--neg={isNeg}
      class:step-event__rule--info={isInfo}
      class:step-event__rule--sponsor={isSponsor}
    ></div>

    <!-- Label -->
    <p class="step-event__label label uppercase">
      {displayLabel}
    </p>

    <!-- Description -->
    {#if description}
      <p class="text-body">{description}</p>
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
      <svelte:component this={Icon} class="text-lg" />
    </div>

    <div class="flex flex-row max-h-8 justify-between align-bottom h-fit pb-2 mb-2">
      <span
        class="label-xs"
        class:step-event__type-kicker--pos={isPos}
        class:step-event__type-kicker--neg={isNeg}
        class:step-event__type-kicker--info={isInfo}
        class:step-event__type-kicker--sponsor={isSponsor}
      >{type.replace("_", " ")}</span>
    </div>

    <h3 class="label-sm">
      {displayLabel}
    </h3>

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
  .step-event {
    display: flex;
    flex-direction: column;
    gap: 1em;
    padding: 1em;
    text-align: left;
    cursor: pointer;
    border-width: 2.25px;
    border-style: solid;
    transition:
      box-shadow 180ms ease,
      transform   180ms ease,
      background  180ms ease;
  }

  .step-event:hover  { transform: translateY(-2px); box-shadow: 0 8px 20px rgba(0,0,0,0.12); }
  .step-event:active { transform: scale(0.98); }

  /* ── Positive — green */
  .step-event--pos       { border-color: #1a7a4a; background: #f5f9ff; }
  .step-event--pos:hover { background: #e3f7ec; }

  /* ── Negative — red */
  .step-event--neg       { border-color: #c0392b; background: #fff5f4; }
  .step-event--neg:hover { background: #ffe8e5; }

  /* ── Info source — slate blue */
  .step-event--info       { border-color: #3b6ea8; background: #f0f5fc; }
  .step-event--info:hover { background: #e4eef9; }

  /* ── Intervention — amber */
  .step-event--sponsor       { border-color: #3E1631; background: #F4F4FF; }

  .step-event--sponsor:hover { background: #e7e9ee; }


  /* ════════════════════════════════════════════════════════════════════════
     HEADER
  ════════════════════════════════════════════════════════════════════════ */
  .step-event__header {
    display: flex;
    flex-direction: row;
    align-items: baseline;
    justify-content: left;
    gap: .5em;
  }

  .step-event__icon-badge--pos     { color: #0f5c32; }
  .step-event__icon-badge--neg     { color: #8b1a10; }
  .step-event__icon-badge--info    { color: #1e4a80; }
  .step-event__icon-badge--sponsor { color: #294457; }

  .step-event__type-kicker--pos     { color: #0f5c32; }
  .step-event__type-kicker--neg     { color: #8b1a10; }
  .step-event__type-kicker--info    { color: #1e4a80; }
  .step-event__type-kicker--sponsor { color: #294457; }


  /* ════════════════════════════════════════════════════════════════════════
     RULE
  ════════════════════════════════════════════════════════════════════════ */
  .step-event__rule { height: 1px; width: 100%; }

  .step-event__rule--pos     { background: #b6e8cc; }
  .step-event__rule--neg     { background: #FB8809; }
  .step-event__rule--info    { background: #599077; }
  .step-event__rule--sponsor { background: #6a99c2; }


  /* ════════════════════════════════════════════════════════════════════════
     LABEL
  ════════════════════════════════════════════════════════════════════════ */
  .step-event__label {
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
    border: 1.725px solid transparent;
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