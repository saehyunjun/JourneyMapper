<script>
  import StateBarList from './StateBarList.svelte';
  import UserRegular from 'phosphor-icons-svelte/IconPlusCircleRegular.svelte';

  let {
    personas = [],
    activePersonaId = '',
    currentState = [],
    onselect = undefined,
    onstory = undefined,
    onhover = undefined,
    onleave = undefined,
  } = $props();

  /** @type {Record<string, boolean>} */
  let imgErrors = $state({});

  /** @type {string | null} */
  let hoveredId = $state(null);

  let tipX = $state(0);
  let tipY = $state(0);

  const TIP_W = 200;

  function personaColor(p) {
    return p.type?.toLowerCase().includes('caregiver')
      ? 'var(--gold)'
      : 'var(--purple, #23abab)';
  }

  function selectPersona(id, e) {
    if (id === activePersonaId) {
      onstory?.({ id, originEl: e.currentTarget });
    } else {
      onselect?.(id);
    }
  }

  function handleMouseEnter(id, e) {
    hoveredId = id;
    positionTip(e);
    onhover?.({ id });
  }

  function handleMouseMove(e) {
    if (hoveredId) positionTip(e);
  }

  function handleMouseLeave(id) {
    hoveredId = null;
    onleave?.({ id });
  }

  function positionTip(e) {
    const vw = window.innerWidth;
    const rawX = e.clientX + 14;
    tipX = rawX + TIP_W > vw ? e.clientX - TIP_W - 10 : rawX;
    tipY = e.clientY - 12;
  }

  function getTooltipFields(p) {
    const prof = p.profile ?? {};
    return [
      ['Age',               prof.age],
      ['Current Treatment', prof.current_treatments],
      ['Current Goal',      prof.preference],
    ].filter(([, val]) => val != null && val !== '');
  }
</script>

<!-- svelte-ignore a11y-no-static-element-interactions -->
<div class="sticky-panel-top pl-2" 
aria-label="Persona selector" role="navigation" onmousemove={handleMouseMove}>

  <div class="flex flex-row gap-6 py-2 align-middle justify-center">
    {#each personas as p (p.id)}  
      {@const active = p.id === activePersonaId}
      {@const accentColor = personaColor(p)}
    {@const isCaregiver = p.type?.toLowerCase().includes('caregiver')}
      <div class="flex flex-col items-center align-middle justify-center">
        <div class="avatar-wrapper">
          <button
            class="persona-avatar"
            class:persona-avatar--active={active}
            style={active ? `--persona-accent: ${accentColor};` : ''}
            onclick={(e) => selectPersona(p.id, e)}
            onmouseenter={(e) => handleMouseEnter(p.id, e)}
            onmouseleave={() => handleMouseLeave(p.id)}
            aria-pressed={active}
            aria-label="Select {p.profile.name}"
          >
            {#if !imgErrors[p.id]}
              <img
                src="/assets/profiles/{p.profile.imageFile}"
                alt={p.profile.name}
                class="persona-photo"
                onerror={() => {
                  imgErrors[p.id] = true;
                  imgErrors = { ...imgErrors };
                }}
              />
            {:else}
              <span class="persona-initials" aria-hidden="true">{p.profile.initials}</span>
            {/if}
            {#if p.type}
              <span
                class="pill-white absolute bottom-0 right-0"
                style="background: {accentColor}; color: var(--paper); border-color: var(--paper);"
                aria-label={p.type}
              >{isCaregiver ? 'C' : 'P'}</span>
            {/if}
          </button>
        </div>
        <span
          class="persona-name"
          class:persona-name--active={active}>
          {p.profile.name}
        </span>
      </div>
    {/each}
  </div>
</div>

<!-- Persona bio tooltip -->
{#if hoveredId}
  {@const hp = personas.find((p) => p.id === hoveredId)}
  {#if hp}
    {@const isHpCaregiver = hp.type?.toLowerCase().includes('caregiver')}
    {@const hpAccent = isHpCaregiver ? 'var(--gold)' : 'var(--purple)'}
    <div
      class="tooltip"
      style="left: {tipX}px; top: {tipY}px; border: 2.25px solid {hpAccent}; outline: 2px solid {hpAccent};"
      role="tooltip"
      aria-live="polite"
    >
      <div class="flex flex-col items-center gap-1 pt-2 mb-2">
        {#if hp.type}
          <span class="label-sm">{hp.type}</span>
        {/if}
        <h3 class="heading-serif-md text-center" style="color: {hpAccent};">
          {hp.profile.name}
        </h3>
      </div>

      <div class="jm-content-col">
        {#if hp.profile.bio_1}
          <p class="text-body-sm text-center">{hp.profile.bio_1}</p>
 
        {/if}
      </div>
    </div>
  {/if}
{/if}

<style>
  .avatar-wrapper {
    display: flex;
    flex-direction: column;
    gap: 1em;
  }

  .avatar-wrapper:hover {
    cursor: pointer;
  }

  .persona-name {
    font-family: var(--font-heading);
    font-size: .6725em;
    text-transform: uppercase;
    color: var(--darkbluegray);
    opacity: 50%;
    font-weight: 400;
    margin-top: .725em;
  }

  .persona-name--active {
    opacity: 100%;
    font-weight: 800;
    color: var(--darkgray);
  }

  .persona-photo {
    width: 100%;
    height: 100%;
    object-fit: cover;
    border-radius: 50%;
    display: block;
  }

  .persona-avatar--active {
    outline: 3.5px solid var(--persona-accent, var(--purple, #23abab));
    outline-offset: 2px;
  }
</style>