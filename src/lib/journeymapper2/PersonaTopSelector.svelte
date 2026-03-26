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
      ['Current Treatment', prof.current_treatments],
      ['Current Goal', prof.preference],
    ].filter(([, val]) => val != null && val !== '');
  }
</script>

<!-- svelte-ignore a11y-no-static-element-interactions -->
<div class="sticky-panel-left" aria-label="Persona selector" on:mousemove={handleMouseMove}>
  <div class="flex flex-col gap-4 py-2 align-middle justify-center">
    {#each personas as p (p.id)}
      {@const active = p.id === activePersonaId}
      <div class="flex flex-col items-center align-middle justify-center">
        <div class="avatar-wrapper">
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
          {#if p.type}
            {@const isCaregiver = p.type.toLowerCase().includes('caregiver')}
            <span
              class="type-badge"
              class:type-badge--caregiver={isCaregiver}
              aria-label={p.type}
            >{isCaregiver ? 'C' : 'P'}</span>
          {/if}
        </div>
        <span class="label-sm">{p.profile.name}</span>
      </div>
    {/each}
  </div>
</div>  
<!-- ── Persona bio tooltip ──────────────────────────────────────────────── -->
{#if hoveredId}
  {@const hp = personas.find((p) => p.id === hoveredId)}
  {#if hp}
    {@const isHpCaregiver = hp.type?.toLowerCase().includes('caregiver')}
    <div
      class="persona-top-tooltip jm-surface"
      style="left: {tipX}px; top: {tipY}px; width: {TIP_W}px; border-color: {isHpCaregiver ? 'var(--color-amber-500, #f59e0b)' : 'var(--teal, #23abab)'};"
      role="tooltip"
      aria-live="polite"
    >
      <!-- Header row -->
      <div class="biobar"      
      style="background-color: {isHpCaregiver ? 'var(--color-amber-500, #f59e0b)' : 'var(--teal, #23abab)'};">
        <h3 class="heading-md text-slate-50">{hp.profile.name}</h3>
        {#if hp.type}
          <span class="pill-white">{hp.type}</span>
        {/if}
      </div>

      <!-- Bio excerpt -->
      <div class="content-col">
      {#if hp.profile.bio_1}
        <p class="body-text text-sm">{hp.profile.bio_1}</p>
      {/if}

      <!-- Key fields -->
      <div class="flex flex-col gap-4 mt-8">
        {#each getTooltipFields(hp) as [key, val]}
          <div class="tip-field-row">
            <span class="label-heading">{key}</span>
            <span class="label capitalize">{val}</span>
          </div>
        {/each}
      </div>
    </div>
  </div>
  {/if}
{/if}


<style>

  /* ── Avatar wrapper (positions the badge) ──────────────────────────── */
.avatar-wrapper {
  position: relative;
  display: inline-flex;
}

/* ── P / C type badge ───────────────────────────────────────────────── */
.type-badge {
  position: absolute;
  bottom: 1px;
  right: 1px;
  width: 2.25em;
  height: 2.25em;
  border-radius: 50%;
  padding: .25em .25em .15em .25em;

  background: var(--teal, #23abab);
  color: var(--paper);
  
  font-weight: 800;
  font-size: .625em;
  
  text-align: center;
  align-content: center;
  justify-content: center;

  letter-spacing: 0;
  border: 1.5px solid var(--color-surface, #fff);
  pointer-events: none;
  user-select: none;
}

.type-badge--caregiver {
  background: var(--orange);
}

/* Active state: solid ring */
  .persona-avatar--active {
    outline: 4px solid var(--teal, #23abab);
    filter: saturate(1);
    margin-bottom: .25em;
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
      border: 2px solid transparent;
      transition: left 50ms linear, top 50ms linear, border-color 150ms ease;
    }
  
</style>