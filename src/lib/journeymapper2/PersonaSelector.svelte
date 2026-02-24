<script>
  import { createEventDispatcher } from 'svelte';
  import PersonaTab from './PersonaTab.svelte';

  export let personas = [];
  export let activePersonaId;

  const dispatch = createEventDispatcher();

  function handleSelect(event) {
    dispatch('switch', { id: event.detail.id });
  }

  function openDrawer() {
    dispatch('openPersonaDrawer');
  }
</script>

<div class="flex flex-col gap-4">

  <!-- Persona Tabs -->
  <div class="flex flex-wrap gap-2">
    {#each personas as persona}
      <PersonaTab
        {persona}
        active={persona.id === activePersonaId}
        on:select={handleSelect}
      />
    {/each}
  </div>

  <!-- Optional persona strip / CTA -->
  <div class="flex items-center justify-between">
    <div class="text-sm text-gray-500">
      {#if activePersonaId}
        Viewing persona: {personas.find(p => p.id === activePersonaId)?.name}
      {/if}
    </div>

    <button
      class="text-sm underline text-gray-700 hover:text-black"
      on:click={openDrawer}
    >
      Edit Personas
    </button>
  </div>

</div>