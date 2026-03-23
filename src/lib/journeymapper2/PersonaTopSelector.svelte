<script>
    import { createEventDispatcher } from 'svelte';
    import UserRegular from 'phosphor-icons-svelte/IconPlusCircleRegular.svelte';
  
    const dispatch = createEventDispatcher();
  
    /** Array of persona objects from journeyPersonas.json */
    export let personas = [];
  
    /** ID of the currently active persona */
    export let activePersonaId = '';
  
    /** @type {Record<string, boolean>} */
    let imgErrors = {};
  
    /** @type {string | null} Persona ID whose tooltip is currently showing */
    let hoveredId = null;
  
    /** Tooltip anchor position */
    let tipX = 0;
    let tipY = 0;
  
    const TIP_W = 200;
  
    /**
     * @param {string} id
     * @param {MouseEvent} e
     */
    function selectPersona(id, e) {
      if (id === activePersonaId) {
        // Already active — open the story overlay, anchored to this button
        dispatch('story', { id, originEl: e.currentTarget });
      } else {
        dispatch('select', { id });
      }
    }
  
    /**
     * @param {string} id
     * @param {MouseEvent} e
     */
    function handleMouseEnter(id, e) {
      hoveredId = id;
      positionTip(e);
      dispatch('hover', { id });
    }
  
    /** @param {MouseEvent} e */
    function handleMouseMove(e) {
      if (hoveredId) positionTip(e);
    }
  
    /** @param {string} id */
    function handleMouseLeave(id) {
      hoveredId = null;
      dispatch('leave', { id });
    }
  
    /** @param {MouseEvent} e */
    function positionTip(e) {
      const vw = window.innerWidth;
      const rawX = e.clientX + 14;
      tipX = rawX + TIP_W > vw ? e.clientX - TIP_W - 10 : rawX;
      tipY = e.clientY - 12;
    }
  
    /** @param {object} p — full persona object */
    function getTooltipFields(p) {
      const prof = p.profile ?? {};
      return [
        ['Age',        prof.age],
        ['Occupation', prof.occupation],
        ['Diagnosed',  prof.diagnosed],
        ['Current Status', prof.preference],
      ].filter(([, val]) => val != null && val !== '');
    }
  </script>
  
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div class="sticky-panel-left" aria-label="Persona selector" on:mousemove={handleMouseMove}>
    <div class="flex flex-col gap-4 py-2 align-middle justify-center">
      {#each personas as p (p.id)}
        {@const active = p.id === activePersonaId}
        <div class="flex flex-col items-center align-middle justify-center">
          <button
            class="persona-avatar"
            class:persona-avatar--active={active}
            on:click={(e) => selectPersona(p.id, e)}
            on:mouseenter={(e) => handleMouseEnter(p.id, e)}
            on:mouseleave={() => handleMouseLeave(p.id)}
            aria-pressed={active}
            aria-label="Select {p.profile.name}"
          >
            {#if !imgErrors[p.id]}
              <img
                src="/assets/profiles/{p.profile.imageFile}"
                alt={p.profile.name}
                class="persona-photo"
                on:error={() => {
                  imgErrors[p.id] = true;
                  imgErrors = { ...imgErrors };
                }}
              />
            {:else}
              <span class="persona-initials">{p.profile.initials}</span>
            {/if}
          </button>
          <span class="label-sm">{p.profile.name}</span>
        </div>
      {/each}
    </div>
  </div>
  
  <!-- ── Persona bio tooltip ──────────────────────────────────────────────── -->
  {#if hoveredId}
    {@const hp = personas.find((p) => p.id === hoveredId)}
    {#if hp}
      <div
        class="persona-top-tooltip jm-surface"
        style="left: {tipX}px; top: {tipY}px; width: {TIP_W}px;"
        role="tooltip"
        aria-live="polite"
      >
        <!-- Header row -->
        <div class="jm-section-bar" style="margin-bottom: 8px;">
          <span class="text-body-lg">{hp.profile.name}</span>
          {#if hp.type}
            <span class="pill-sm">{hp.type}</span>
          {/if}
        </div>
  
        <!-- Bio excerpt -->
        {#if hp.profile.bio_1}
          <p class="body-text text-sm">{hp.profile.bio_1}</p>
        {/if}
  
        <!-- Key fields -->
        <div class="flex flex-col gap-4 mt-8">
          {#each getTooltipFields(hp) as [key, val]}
            <div class="tip-field-row">
              <span class="label-sm">{key}</span>
              <span class="label font-bold">{val}</span>
            </div>
          {/each}
        </div>
      </div>
    {/if}
  {/if}
  
  <style>
 
    /* Active state: solid ring */
    .persona-avatar--active {
      border: 4px solid var(--teal, #23abab);
      filter: saturate(1);
    }

    .persona-photo {
      width: 100%;
      height: 100%;
      object-fit: cover;
      border-radius: 50%;
      display: block;
    }
    /* ── Tooltip ────────────────────────────────────────────────────────── */
    .persona-top-tooltip {
      position: fixed;
      pointer-events: none;
      min-width: 425px;
      z-index: 500;
      padding: 12px 14px 14px;
      transition: left 50ms linear, top 50ms linear;
    }
  
    .tip-field-row {
      display: flex;
      justify-content: space-between;
      border-bottom: 1px solid var(--color-stone-200);
      align-items: baseline;
      gap: 6px;
    }
  </style>