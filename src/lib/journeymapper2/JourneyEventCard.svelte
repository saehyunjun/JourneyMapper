<script lang="ts">
    // ── Event type definitions ────────────────────────────────────────────────
    // Each event type maps to:
    //   • a Phosphor icon
    //   • a semantic color treatment (positive = green, negative = red)
    //   • a default label (used if none supplied)
  
    import WarningDiamondRegular from "phosphor-icons-svelte/IconWarningDiamondRegular.svelte";
    import HospitalRegular       from "phosphor-icons-svelte/IconHospitalRegular.svelte";
    import TrendUpRegular        from "phosphor-icons-svelte/IconTrendUpRegular.svelte";
    import UsersThreeRegular     from "phosphor-icons-svelte/IconUsersThreeRegular.svelte";
  
    // ── Props ─────────────────────────────────────────────────────────────────
    /** One of the four event taxonomy values */
    export let type: "roadblock" | "hospitalization" | "progress" | "community";
  
    /** Primary label text shown on the card */
    export let label: string = "";
  
    /** Optional short label — used when `compact` is true */
    export let shortLabel: string = "";
  
    /** Narrative description — shown in full card only */
    export let description: string = "";
  
    /** Tooltip text — shown on hover for both compact and full modes */
    export let tooltip: string = "";
  
    /** Compact / mini mode: renders a condensed pill-style card for the chart row */
    export let compact: boolean = false;
  
    /** Optional click handler wired up by the parent chart */
    export let onClick: (() => void) | null = null;
  
    // ── Type config map ───────────────────────────────────────────────────────
    type EventConfig = {
      icon: typeof WarningDiamondRegular;
      polarity: "positive" | "negative";
      defaultLabel: string;
    };
  
    const EVENT_CONFIG: Record<string, EventConfig> = {
      roadblock: {
        icon: WarningDiamondRegular,
        polarity: "negative",
        defaultLabel: "Roadblock",
      },
      hospitalization: {
        icon: HospitalRegular,
        polarity: "negative",
        defaultLabel: "Hospitalization",
      },
      progress: {
        icon: TrendUpRegular,
        polarity: "positive",
        defaultLabel: "Progress",
      },
      community: {
        icon: UsersThreeRegular,
        polarity: "positive",
        defaultLabel: "Community",
      },
    };
  
    $: config   = EVENT_CONFIG[type] ?? EVENT_CONFIG.roadblock;
    $: Icon     = config.icon;
    $: polarity = config.polarity;
    $: isPos    = polarity === "positive";
  
    $: displayLabel      = label      || config.defaultLabel;
    $: displayShortLabel = shortLabel || displayLabel;
  
    // ── Tooltip state ─────────────────────────────────────────────────────────
    let hovered  = false;
    let mouseX   = 0;
    let mouseY   = 0;
  
    const TIP_W    = 320;
    const TIP_H    = 80;   // conservative estimate; real height varies
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
       COMPACT / MINI — used inline on the chart timeline row
  ───────────────────────────────────────────────────────────────────────────── -->
  {#if compact}
    <button
      class="event-pill"
      class:event-pill--pos={isPos}
      class:event-pill--neg={!isPos}
      on:click={onClick}
      on:mouseenter={() => (hovered = true)}
      on:mouseleave={() => (hovered = false)}
      aria-label="{type}: {displayLabel}"
      type="button"
    >
      <span class="event-pill__icon" 
          class:event-icon--pos={isPos}
          class:event-icon--neg={!isPos}
          aria-hidden="true">
        <svelte:component this={Icon} class="text-2xl p-1"  />
      </span>
      <span class="label-sm">{displayShortLabel}</span>
    </button>
  
  <!-- ─────────────────────────────────────────────────────────────────────────
       FULL CARD — used in drawers, sidebars, legend panels
  ───────────────────────────────────────────────────────────────────────────── -->
  {:else}
    <button
      class="event-card jm-surface"
      class:event-card--pos={isPos}
      class:event-card--neg={!isPos}
      on:click={onClick}
      on:mouseenter={() => (hovered = true)}
      on:mouseleave={() => (hovered = false)}
      aria-label="{type}: {displayLabel}"
      type="button"
    >
  
      <!-- Header row: icon badge + type kicker -->
      <div class="event-card__header">
        <div
          class="event-card__icon-badge"
          class:event-card__icon-badge--pos={isPos}
          class:event-card__icon-badge--neg={!isPos}
          aria-hidden="true"
        >
          <svelte:component this={Icon} class="text-2xl p-1"/>
        </div>
  
        <span
          class="event-card__type-kicker jm-kicker"
          class:event-card__type-kicker--pos={isPos}
          class:event-card__type-kicker--neg={!isPos}
        >
          {type}
        </span>
      </div>
  
      <!-- Rule -->
      <div
        class="event-card__rule"
        class:event-card__rule--pos={isPos}
        class:event-card__rule--neg={!isPos}>
        </div>
  
      <!-- Label -->
      <p class="event-card__label label-lg">{displayLabel}</p>
  
      <!-- Description (optional) -->
      {#if description}
        <p class="text-body-sm">{description}</p>
      {/if}
  
    </button>
  {/if}
  
  <!-- ─────────────────────────────────────────────────────────────────────────
       TOOLTIP — shared by both modes, portal to fixed position
  ───────────────────────────────────────────────────────────────────────────── -->
  {#if hovered && tooltip}
    <div
      class="tooltip"
      class:event-tooltip--pos={isPos}
      class:event-tooltip--neg={!isPos}
      style="left:{tipX}px; top:{tipY}px; 
      width:{TIP_W}px;"
      role="tooltip"
      aria-live="polite"
    >
        <div
        class="event-pill__icon w-fit h-fit absolute top-2 right-2"
        class:event-icon--pos ={isPos}
        class:event-icon--neg={!isPos}
        aria-hidden="true"
        >
        <svelte:component this={Icon} class="text-2xl p-1" />
        </div>
      <!-- Header: icon + type kicker + label -->
      <div class="flex flex-row max-h-8 justify-between align-bottom h-fit pb-2 mb-2">
        <span
          class="label-xs"
          class:event-card__type-kicker--pos={isPos}
          class:event-card__type-kicker--neg={!isPos}
        >{type}</span>

      </div>
  
      <h3 class="label mb-2">{displayLabel}</h3>
  
      <div
        class="event-tooltip__rule"
        class:event-tooltip__rule--pos={isPos}
        class:event-tooltip__rule--neg={!isPos}>
    </div>
  
      <p class="text-body-sm">
        {tooltip}</p>
    </div>
  {/if}
  
  
  <style>
    /* ── FULL CARD ─────────────────────────────────────────────────────────── */
    .event-card {
      display: flex;
      flex-direction: column;
      gap: 1em;
  
      width: 100%;
      padding: 14px 16px;
      border-radius: 12px;
  
      text-align: left;
      cursor: pointer;
  
      /* Override jm-surface border with polarity border — applied via modifier */
      border-width: 1.5px;
      border-style: solid;
  
      transition:
        box-shadow 180ms ease,
        transform   180ms ease,
        background  180ms ease;
    }
  
    .event-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 20px rgba(0, 0, 0, 0.12);
    }
  
    .event-card:active {
      transform: scale(0.98);
    }
  
    /* Positive — green accent */
    .event-card--pos {
      border-color: #1a7a4a;
      background: #f0faf4;
    }
  
    .event-card--pos:hover {
      background: #e3f7ec;
    }
  
    /* Negative — red accent */
    .event-card--neg {
      border-color: #fff5f4;
      background: #c0392b;
    }
  
    .event-card--neg:hover {
      background: #ffe8e5;
    }
    .event-icon {
      height: 2em;
      width: 2em;
    
      align-items: center;
      justify-content: center;
    }

        /* Positive — green accent */
    .event-icon--pos {
      background: #1a7a4a;
      color: #e3f7ec;
      border-radius: 100em;
    }
  
  
    /* Negative — red accent */
    .event-icon--neg {
      border-color: #fff5f4;
      border-radius: 100em;
      background: #c0392b;
      color: #f5b4ae;
    }
  

  
    /* ── Header ────────────────────────────────────────────────────────────── */
    .event-card__header {
      display: flex;
      align-items: center;
      gap: 2em;
    }
  
    /* Icon badge */
    .event-card__icon-badge {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      border-radius: 8px;
      flex-shrink: 0;
    }
  
    .event-card__icon-badge--pos {
      background: #c6f0d8;
      color: #0f5c32;
    }
  
    .event-card__icon-badge--neg {
      background: #ffd8d4;
      color: #8b1a10;
    }
  
    /* Kicker overrides */
    .event-card__type-kicker--pos { color: #0f5c32; }
    .event-card__type-kicker--neg { color: #8b1a10; }
  
    /* ── Rule ──────────────────────────────────────────────────────────────── */
    .event-card__rule {
      height: 1px;
      width: 100%;
    }
  

  
    /* ── Text ──────────────────────────────────────────────────────────────── */
    .event-card__label {
      margin: 0;
      color: var(--ink);
      line-height: 1.3;
    }
  
    /* ── COMPACT PILL ──────────────────────────────────────────────────────── */
    .event-pill {
      display: inline-flex;
      align-items: center;
      gap: .725em;
  
      padding: 3px 7px 3px 5px;
      border-radius: 100px;
      border: 1px solid transparent;
  
      cursor: pointer;
      white-space: nowrap;
  
      transition:
        box-shadow 150ms ease,
        transform  150ms ease;
    }
  
    .event-pill:hover {
      transform: translateY(-1px);
      box-shadow: 0 3px 8px rgba(0, 0, 0, 0.14);
    }
  
    .event-pill:active {
      transform: scale(0.96);
    }
  
    /* Positive pill */
    .event-pill--pos {
      background: #d4f5e3;
      border-color: #2d9e62;
    }
  
    /* Negative pill */
    .event-pill--neg {
      background: #fde4e1;
      border-color: #d9382a;
    }
  
    .event-pill__icon {
      display: flex;
      align-items: center;
      flex-shrink: 0;
    }
  
 
  
    .event-tooltip--pos {
      border-color: #1a7a4a;
      background: #f4fcf7;
    }
  
    .event-tooltip--neg {
      border-color: #c0392b;
      background: #fff8f7;
    }
  

  </style>