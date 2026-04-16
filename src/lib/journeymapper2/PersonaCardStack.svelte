<script>
    import { createEventDispatcher } from 'svelte';
    import { crossfade } from 'svelte/transition';
    import { quintOut } from 'svelte/easing';
    
    import PersonaProfileCard from './PersonaProfileCard.svelte';
    import IconCaretLeftRegular from 'phosphor-icons-svelte/IconCaretLeftRegular.svelte';
    import IconCaretRightRegular from 'phosphor-icons-svelte/IconCaretRightRegular.svelte';
    
    const dispatch = createEventDispatcher();
    
    export let personas = [];
    export let activePersonaId = '';
    export let onOpenDetails = () => {};
    export let defaultOpen = true;
    
    let open = defaultOpen;
    let hoveredId = null;
    let thumbImgError = false;
    
    $: activeIndex = personas.findIndex(p => p.id === activePersonaId);
    $: activePersona = personas[activeIndex] ?? null;
    $: beforeActive = personas.slice(0, activeIndex);
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
    
    /* crossfade animation */
    const [send, receive] = crossfade({
      duration: d => Math.sqrt(d * 200),
      easing: quintOut
    });
    </script>
    
    <div class="sidebar" class:sidebar--open={open}>
    
    <!-- toggle -->
    <div class="flex justify-end p-2">
    <button class="btn-base" onclick={toggle}>
    {#if open}
    <IconCaretLeftRegular />
    {:else}
    <IconCaretRightRegular />
    {/if}
    </button>
    </div>
    
    <!-- collapsed thumb -->
    {#if !open && activePersona}
    
    <button class="thumb" onclick={toggle}>
    
    {#if !thumbImgError}
    <img
    class="thumb-photo"
    src="/assets/profiles/{activePersona.profile.imageFile}"
    alt={activePersona.profile.name}
    onerror={() => (thumbImgError = true)}
    />
    {:else}
    <span class="thumb-initials">
    {activePersona.profile.initials}
    </span>
    {/if}
    
    </button>
    
    {/if}
    
    <!-- stack -->
    <div class="stack" class:stack--open={open}>
    
    <div class="stack-heading">
    <span class="label-lg">{personas.length}</span>
    <span class="label-lg">Personas available</span>
    </div>
    
    <!-- personas before active -->
    {#each beforeActive as persona (persona.id)}
    
    <div
    class="mini-card"
    class:mini-card--hovered={hoveredId === persona.id}
    onclick={() => select(persona.id)}
    onmouseenter={() => hoveredId = persona.id}
    onmouseleave={() => hoveredId = null}
    in:receive={{ key: persona.id }}
    out:send={{ key: persona.id }}
    >
    
    <div class="mini-photo-wrap">
    <img
    class="mini-photo"
    src="/assets/profiles/{persona.profile.imageFile}"
    alt={persona.profile.name}
    />
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
    
    <!-- active card -->
    {#if activePersona}
    {#key activePersona.id}
    
    <div class="active-card-wrap">
      <PersonaProfileCard
      personaProfile={activePersona.profile}
      personaType={activePersona.type}
      onOpenDetails={onOpenDetails}
    />
    </div>
    
    {/key}
    {/if}
    
    {#if afterActive.length > 0}
    <div class="gap-rule"/>
    {/if}
    
    <!-- personas after active -->
    {#each afterActive as persona (persona.id)}
    
    <div
    class="mini-card"
    class:mini-card--hovered={hoveredId === persona.id}
    onclick={() => select(persona.id)}
    onmouseenter={() => hoveredId = persona.id}
    onmouseleave={() => hoveredId = null}
    in:receive={{ key: persona.id }}
    out:send={{ key: persona.id }}
    >
    
    <div class="mini-photo-wrap">
    <img
    class="mini-photo"
    src="/assets/profiles/{persona.profile.imageFile}"
    alt={persona.profile.name}
    />
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
    
    /* sidebar container */
    
    .sidebar{
    position:relative;
    display:flex;
    flex-direction:column;
    align-items:center;
    
    background:#F7F9FC;
    border-right:1px solid #E5EDF5;
    
    height:100%;
    width:7vw;
    max-width:180px;
    
    transition:width 380ms cubic-bezier(.22,1,.36,1);
    }
    
    .sidebar--open{
    width:30vw;
    max-width:350px;
    }
    
    /* persona stack */
    
    .stack{
    display:flex;
    flex-direction:column;
    gap:8px;
    
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
    
    .active-card-wrap{
    width:95%;
    }
    
    /* collapsed thumbnail */
    
    .thumb{
    width:6.5vw;
    height:6.5vw;
    
    border-radius:100px;
    overflow:hidden;
    
    cursor:pointer;
    
    box-shadow:
    0 0 0 1px rgba(0,0,0,.06),
    0 1px 2px rgba(0,0,0,.06),
    0 2px 4px rgba(0,0,0,.04);
    
    transition:transform .2s cubic-bezier(.34,1.4,.64,1);
    }
    
    .thumb:hover{
    transform:scale(1.02);
    }
    
    .thumb-photo{
    width:100%;
    height:100%;
    object-fit:cover;
    }
    
    /* mini persona cards */
    
    .mini-card{
    display:flex;
    align-items:center;
    gap:8px;
    
    width:90%;
    
    padding:4px 8px;
    
    border-radius:10px;
    background:#EAEFF8;
    border:1px solid #E5EDF5;
    
    cursor:pointer;
    
    transition:
    transform .18s cubic-bezier(.34,1.4,.64,1),
    background .18s;
    }
    
    .mini-card:hover{
    transform:translateX(3px);
    background-color:rgba(82,58,254,.18);
    }
    
    .mini-photo-wrap{
    width:36px;
    height:36px;
    
    border-radius:8px 0 0 8px;
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
    font-family:var(--font-heading);
    font-size:.8rem;
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