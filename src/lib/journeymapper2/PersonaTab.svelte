<script>
    import { createEventDispatcher } from 'svelte';
  
    export let persona;
    export let active = false;
  
    const dispatch = createEventDispatcher();
  
    function handleClick() {
      dispatch('select', { id: persona.id });
    }
  
    function handleImgError(e) {
      e.target.style.display = 'none';
    }
  </script>
  
  <button
    class={`flex items-center gap-2 px-4 py-2 rounded-full border transition
      ${active
        ? 'bg-black text-white border-black'
        : 'bg-white text-gray-700 border-gray-300 hover:border-black'}`}
    on:click={handleClick}
  >
    {#if persona.image}
      <img
        src={persona.image}
        alt={persona.name}
        class="w-6 h-6 rounded-full object-cover"
        on:error={handleImgError}
      />
    {/if}
    <span class="text-sm font-medium whitespace-nowrap">
      {persona.name}
    </span>
  </button>