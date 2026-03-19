<script>
  import { buildStageColorMap } from './journeyConfig.js';
  import { hoveredIndex, selectedIndex } from './journeyStore.js';
  import ArrowRightRegular from 'phosphor-icons-svelte/IconArrowRightRegular.svelte';

  /** @type {any[]} */
  export let data = [];

  // ── Derive stage groups ────────────────────────────────────────────────────
  /** @type {{ stage_id: string; stage: string; steps: { step: string; step_id: string; index: number }[] }[]} */
  $: stageGroups = (() => {
    /** @type {Map<string, { stage_id: string; stage: string; steps: { step: string; step_id: string; index: number }[] }>} */
    const map = new Map();
    data.forEach((d, i) => {
      if (!map.has(d.stage_id)) {
        map.set(d.stage_id, { stage_id: d.stage_id, stage: d.stage, steps: [] });
      }
      map.get(d.stage_id).steps.push({ step: d.step, step_id: d.step_id, index: i });
    });
    return [...map.values()];
  })();

  $: stageColorMap = buildStageColorMap(data);

  /** @param {number} globalIndex */
  function handleStepClick(globalIndex) {
    selectedIndex.update(i => i === globalIndex ? -1 : globalIndex);
  }
</script>

<!-- ── Outer scroll wrapper: matches .shared-scroll pattern ──────────────── -->
<div class="flow-diagram-scroll shared-scroll" role="region" aria-label="Journey flow diagram">
  <div class="flow-diagram-row">

    {#each stageGroups as group, gi}

      <!-- ── Stage group ─────────────────────────────────────────────── -->
      <div class="flow-stage">

        <!-- Stage header pill -->
        <div
          class="flow-stage-header"
          style="background-color: {stageColorMap[group.stage_id]};"
        >
          <span class="label-heading" style="color: #fff; letter-spacing: 0.08em;">
            {group.stage}
          </span>
          <span class="flow-stage-count label-heading" style="color: rgba(255,255,255,0.65);">
            {group.steps.length}
          </span>
        </div>

        <!-- Steps row inside the stage -->
        <div class="flow-steps-row">
          {#each group.steps as step, si}

            <!-- Step card -->
            <button
              class="flow-step-card"
              class:flow-step-card--hovered={$hoveredIndex === step.index}
              class:flow-step-card--selected={$selectedIndex === step.index}
              style="border-top-color: {stageColorMap[group.stage_id]};"
              on:mouseenter={() => hoveredIndex.set(step.index)}
              on:mouseleave={() => hoveredIndex.set(-1)}
              on:click={() => handleStepClick(step.index)}
              aria-pressed={$selectedIndex === step.index}
            >
              <!-- Step number badge -->
              <span class="flow-step-index nav-title" style="color: {stageColorMap[group.stage_id]};">
                {step.index + 1}
              </span>

              <!-- Step label -->
              <span class="flow-step-label label-bold">
                {step.step}
              </span>
            </button>

            <!-- Arrow connector between steps (not after last) -->
            {#if si < group.steps.length - 1}
              <span class="flow-connector" aria-hidden="true">
                <ArrowRightRegular size={12} />
              </span>
            {/if}

          {/each}
        </div>

      </div>

      <!-- Arrow connector between stage groups (not after last) -->
      {#if gi < stageGroups.length - 1}
        <span class="flow-stage-connector" aria-hidden="true">
          <ArrowRightRegular size={16} />
        </span>
      {/if}

    {/each}

  </div>
</div>

<style>
  /* ── Outer scroll container ─────────────────────────────────────────── */
  .flow-diagram-scroll {
    overflow-x: auto;
    overflow-y: visible;
    padding: 1rem 1.25rem 1.25rem;
  }

  /* ── Top-level horizontal row of stage groups ───────────────────────── */
  .flow-diagram-row {
    display: flex;
    flex-direction: row;
    align-items: flex-start;
    gap: 0.25rem;
    width: max-content;
  }

  /* ── Stage group container ──────────────────────────────────────────── */
  .flow-stage {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  /* ── Stage header band ──────────────────────────────────────────────── */
  .flow-stage-header {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    padding: 0.3rem 0.65rem;
    border-radius: 4px 4px 0 0;
  }

  .flow-stage-count {
    opacity: 0.8;
  }

  /* ── Row of step cards within a stage ──────────────────────────────── */
  .flow-steps-row {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 0;
  }

  /* ── Individual step card ───────────────────────────────────────────── */
  .flow-step-card {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.3rem;
    padding: 0.6rem 0.75rem;

    width: 140px;
    min-height: 72px;

    background-color: var(--card, #d8deed);
    border: 0.5px solid #c8cdd8;
    border-top-width: 3px;
    border-radius: 0 0 4px 4px;

    cursor: pointer;
    text-align: left;

    transition:
      background-color 120ms ease,
      box-shadow 120ms ease,
      transform 120ms ease;
  }

  .flow-step-card:hover,
  .flow-step-card--hovered {
    background-color: #eaeff8;
    box-shadow:
      0 2px 6px rgba(0, 0, 0, 0.1),
      0 0 0 1px rgba(63, 115, 255, 0.18);
    transform: translateY(-1px);
    z-index: 1;
  }

  .flow-step-card--selected {
    background-color: var(--paper, #fffff0);
    box-shadow:
      0 4px 12px rgba(0, 0, 0, 0.14),
      0 0 0 2px #3f73ff;
    transform: translateY(-2px);
    z-index: 2;
  }

  /* Step index badge */
  .flow-step-index {
    font-size: 0.55rem;
    letter-spacing: 0.1em;
  }

  /* Step label text */
  .flow-step-label {
    font-size: 0.75rem;
    line-height: 1.3;
    color: var(--ink, #312f28);
  }

  /* ── Connector arrows between steps ────────────────────────────────── */
  .flow-connector {
    display: flex;
    align-items: center;
    justify-content: center;
    color: #b0b8c8;
    padding: 0 0.1rem;
    flex-shrink: 0;
  }

  /* ── Connector arrows between stage groups ──────────────────────────── */
  .flow-stage-connector {
    display: flex;
    align-items: center;
    justify-content: center;
    color: #8090a8;
    padding: 0 0.35rem;
    /* Align to the vertical midpoint of the step cards */
    margin-top: calc(36px + 0.5rem + 0.5rem); /* header height approx + gaps */
    flex-shrink: 0;
  }
</style>