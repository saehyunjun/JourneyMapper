<script>
    import { createEventDispatcher } from 'svelte';
    import { crossfade } from 'svelte/transition';
    import { quintOut } from 'svelte/easing';
    import PersonaProfileCard from './PersonaProfileCard.svelte';
    
    const dispatch = createEventDispatcher();
    
    export let personas = [];
    export let activePersonaId = '';
    export let onOpenDetails = () => {};
    export let defaultOpen = true;
    
    let open = defaultOpen;
    let hoveredId = null;
    let thumbImgError = false;
    
    $: activeIndex = personas.findIndex(p => p.id === activePersonaId);
    $: beforeActive = personas.slice(0, activeIndex);
    $: activePersona = personas[activeIndex] ?? null;
    $: afterActive = personas.slice(activeIndex + 1);
    
    $: if (activePersonaId) thumbImgError = false;
    
    function toggle() {
      open = !open;
    }
    
    function select(id) {
      if (id !== activePersonaId) {
        dispatch('select', { id });
      }
    }
    
    /* Crossfade animation for persona switching */
    const [send, receive] = crossfade({
      duration: d => Math.sqrt(d * 200),
      easing: quintOut
    });
    </script>
    
    <div class="sidebar" 
    class:sidebar--open={open} aria-label="Persona selector">
    
    <div class="flex flex-row justify-end">
    <button
      class="btn-base"
      class:toggle-btn--open={open}
      on:click={toggle}
    >
    <svg width="10" height="10" viewBox="0 0 256 256">
    {#if open}
    <path d="M165.66 202.34a8 8 0 0 1-11.32 11.32l-80-80a8 8 0 0 1 0-11.32l80-80a8 8 0 0 1 11.32 11.32L91.31 128Z"/>
    {:else}
    <path d="M181.66 133.66l-80 80a8 8 0 0 1-11.32-11.32L164.69 128 90.34 53.66a8 8 0 0 1 11.32-11.32l80 80A8 8 0 0 1 181.66 133.66Z"/>
    {/if}
    </svg>
    </button>
</div>
    
    {#if !open}
    <button class="thumb" on:click={toggle}>
    {#if activePersona}
    {#if !thumbImgError}
    <img
    class="thumb-photo"
    src="/assets/profiles/{activePersona.profile.imageFile}"
    alt={activePersona.profile.name}
    on:error={() => (thumbImgError = true)}
    />
    {:else}
    <span class="thumb-initials">
    {activePersona.profile.initials}
    </span>
    {/if}
    
    <div class="thumb-overlay">
    <span class="thumb-name">
    {activePersona.profile.initials}
    </span>
    </div>
    
    {/if}
    </button>
    {/if}
    
    <div class="stack" class:stack--open={open}>
    
    <div class="stack-heading">
    <span class="label-lg">Personas</span>
    <span class="label-bold">{personas.length}</span>
    </div>
    
    {#each beforeActive as persona (persona.id)}
    <div
    class="mini-card"
    class:mini-card--hovered={hoveredId === persona.id}
    on:click={() => select(persona.id)}
    on:mouseenter={() => (hoveredId = persona.id)}
    on:mouseleave={() => (hoveredId = null)}
    in:receive={{ key: persona.id }}
    out:send={{ key: persona.id }}
    >
    <div class="mini-photo-wrap">
    <img
    class="mini-photo"
    src="/assets/profiles/{persona.profile.imageFile}"
    alt={persona.profile.name}
    />
    <div class="mini-photo-overlay"/>
    </div>
    
    <div class="mini-info">
    <span class="mini-name">{persona.profile.name}</span>
    <span class="mini-role">{persona.profile.role}</span>
    </div>
    </div>
    {/each}
    
    {#if beforeActive.length > 0}
    <div class="gap-rule"/>
    {/if}
    
    {#if activePersona}
    {#key activePersona.id}
    <div class="active-card-wrap">
<PersonaProfileCard
    personaProfile={activePersona.profile}
    onOpenDetails={onOpenDetails}
    />
    </div>
    {/key}
    {/if}
    
    {#if afterActive.length > 0}
    <div class="gap-rule"/>
    {/if}
    
    {#each afterActive as persona (persona.id)}
    <div
    class="mini-card"
    class:mini-card--hovered={hoveredId === persona.id}
    on:click={() => select(persona.id)}
    on:mouseenter={() => (hoveredId = persona.id)}
    on:mouseleave={() => (hoveredId = null)}
    in:receive={{ key: persona.id }}
    out:send={{ key: persona.id }}
    >
    <div class="mini-photo-wrap">
    <img
    class="mini-photo"
    src="/assets/profiles/{persona.profile.imageFile}"
    alt={persona.profile.name}
    />
    <div class="mini-photo-overlay"/>
    </div>
    
    <div class="mini-info">
    <span class="mini-name">{persona.profile.name}</span>
    <span class="mini-role">{persona.profile.role}</span>
    </div>
    </div>
    {/each}
    
    </div>
    </div>
    
    <style>
    
.sidebar{
    position:relative;
    display:flex;
    flex-direction:column;
    background:#F7F9FC;
    border-right: 1px solid #E5EDF5;
    height: 100%; 
    width: 7.25vw;
    max-width: 200px;
    transition:width 380ms cubic-bezier(.22,1,.36,1);
    }
    
.sidebar--open{
    width:32.5vw;
    max-width: 350px;
    }

.active-card-wrap {
    width: 95%;
}

.thumb{ 
    width:6.75vw;
    height:6.75vw;
    margin:auto;
    border-radius:100px;
    overflow:hidden;
    cursor:pointer;
    transition:transform .2s cubic-bezier(.34,1.4,.64,1);
    box-shadow:
0px 0px 0px 1px rgba(0, 0, 0, 0.06),
0px 1px 2px -1px rgba(0, 0, 0, 0.06),
0px 2px 4px 0px rgba(0, 0, 0, 0.04);
    }
    
.thumb:hover{
    transform:scale(1.02);
    border: 1px solid #E5EDF5 
    }
    
.thumb-photo{
    width:100%;
    height:100%;
    object-fit:cover;
    }
    
.thumb-name{
    font-size:.7rem;
    color:white;
    font-weight:600;
    }
    
.stack{
    display:flex;
    flex-direction:column;
    gap:6px;
    opacity:0;
    transform:translateX(-8px);
    transition:
    opacity 220ms ease,
    transform 260ms cubic-bezier(.22,1,.36,1);
    }
    
.stack--open{
    opacity:1;
    transform:translateX(0);
    transition-delay:70ms;
    }
    
    
.mini-card{
    display:flex;
    align-items:center;
    gap:8px;
    width: 90%;
    border-radius:10px;
    font-weight: 500;
    cursor:pointer;
    background:#EAEFF8;
    border: 1px solid #E5EDF5;
    transition:
    transform .18s cubic-bezier(.34,1.4,.64,1),
    background .18s;
    }
    
    .mini-card:hover{
    transform:translateX(3px);
    background-color: rgba(82, 58, 254, .25);
    font-weight: 700;
    }
    
    .mini-photo-wrap{
    width:36px;
    height:36px;
    border-radius:8px 0 0px 8px;
    overflow:hidden;
    flex-shrink:0;
    }
    
    .mini-photo{
    width:100%;
    height:100%;
    object-fit:cover;
    }
    
    .mini-info{
        display:flex;
        flex-direction:column;
    }
    
    .mini-name{
    font-size:.8rem;
    font-family: var(--font-heading);
    }
    
    .mini-role{
    font-size:.55rem;
    text-transform:uppercase;
    color:#523AFE;
    }
    
    .gap-rule{
    height:12px;
    }
    
    </style>