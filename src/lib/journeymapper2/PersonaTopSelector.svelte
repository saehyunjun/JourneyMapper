<script>
    import { createEventDispatcher } from 'svelte';
  
    const dispatch = createEventDispatcher();
  
    /** Array of persona objects from journeyPersonas.json */
    export let personas = [];
  
    /** ID of the currently active persona */
    export let activePersonaId = '';
  
    /** @type {Record<string, boolean>} */
    let imgErrors = {};
  
    /** @param {string} id */
    function selectPersona(id) {
      dispatch('select', { id });
    }
  
    /** @param {string} id */
    function hoverPersona(id) {
      dispatch('hover', { id });
    }
  
    /** @param {string} id */
    function leavePersona(id) {
      dispatch('leave', { id });
    }
  </script>
  
  <div class="persona-topbar" aria-label="Persona selector">
    <div class="grid grid-cols-5 align-middle justify-between">
      {#each personas as p (p.id)}
        {@const active = p.id === activePersonaId}
  
        <button
          class="persona-avatar"
          class:persona-avatar--active={active}
          on:click={() => selectPersona(p.id)}
          on:mouseenter={() => hoverPersona(p.id)}
          on:mouseleave={() => leavePersona(p.id)}
          aria-pressed={active}
          aria-label="Select {p.profile.name}"
          title={p.profile.name}
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
      {/each}
    </div>
  </div>
  
  <style>
    .persona-topbar {
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 12px 16px;
      background: #F4EFE5;
      border-bottom: 1px solid #DFC3A8;
      box-sizing: border-box;
    }
  
    .persona-row {
      display: flex;
      align-items: center;
      justify-content: center;
      flex-wrap: wrap;
      gap: 10px;
      width: 100%;
    }
  
  
    .persona-photo {
      width: 100%;
      height: 100%;
      object-fit: cover;
      border-radius: 50%;
      display: block;
    }
  
    .persona-initials {
      font-family: 'Space Mono', monospace;
      font-size: 11px;
      font-weight: 700;
      color: #F4EFE5;
      letter-spacing: 0.04em;
      line-height: 1;
    }
  </style>