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
        ['Role',       prof.role],
        ['Age',        prof.age],
        ['Occupation', prof.occupation],
        ['Diagnosed',  prof.diagnosed],
        ['Preference', prof.preference],
      ].filter(([, val]) => val != null && val !== '');
    }
  </script>
  
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div class="persona-topbar" aria-label="Persona selector" on:mousemove={handleMouseMove}>
    <div class="flex flex-row gap-4 py-2 align-middle justify-evenly">
      {#each personas as p (p.id)}
        {@const active = p.id === activePersonaId}
        <div class="flex flex-col items-center">
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
          <span class="label-lg">{hp.profile.name}</span>
          {#if hp.type}
            <span class="pill-white">{hp.type}</span>
          {/if}
        </div>
  
        <!-- Bio excerpt -->
        {#if hp.profile.bio}
          <p class="body-text text-sm">{hp.profile.bio}</p>
        {/if}
  
        <!-- Key fields -->
        <div class="tip-fields">
          {#each getTooltipFields(hp) as [key, val]}
            <div class="tip-field-row">
              <span class="tip-key">{key}</span>
              <span class="tip-val">{val}</span>
            </div>
          {/each}
        </div>
      </div>
    {/if}
  {/if}
  
  <style>
    .persona-topbar {
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #FFFFF0;
      border-bottom: 1px solid #F4EFE5;
      box-sizing: border-box;
    }

    .persona-avatar {
      position: relative;
      width: 44px;
      height: 44px;
      border-radius: 50%;
      overflow: visible;
      border: 2px solid transparent;
      background: #e8e5de;
      cursor: pointer;
      padding: 0;
      transition: border-color 180ms ease, transform 160ms cubic-bezier(.34,1.4,.64,1);
    }

    .persona-avatar:hover {
      transform: scale(1.06);
    }

    /* Active state: solid ring */
    .persona-avatar--active {
      border-color: var(--ink, #312F28);
    }

    /* Pulse ring on active avatar — signals it's clickable again */
    .persona-avatar--active::after {
      content: '';
      position: absolute;
      inset: -5px;
      border-radius: 50%;
      border: 1.5px solid var(--ink, #312F28);
      opacity: 0;
      animation: avatar-pulse 2.4s ease-out infinite;
      pointer-events: none;
    }

    @keyframes avatar-pulse {
      0%   { inset: -4px; opacity: 0.5; }
      100% { inset: -12px; opacity: 0; }
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
      min-width: 300px;
      z-index: 500;
      padding: 12px 14px 14px;
      transition: left 50ms linear, top 50ms linear;
    }
  
    .tip-fields {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
  
    .tip-field-row {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      gap: 6px;
    }
  
    .tip-key {
      font-family: 'DM Sans', sans-serif;
      font-size: 8px;
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #BFA080;
      flex-shrink: 0;
    }
  
    .tip-val {
      font-family: 'Space Mono', monospace;
      font-size: 9px;
      color: #5A3E28;
      text-align: right;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  </style>