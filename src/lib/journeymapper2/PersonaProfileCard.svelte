<script>
    /** @type {Record<string, any>} */
    export let personaProfile = {};
  
    /** @type {boolean} */
    export let isOpen = false;
  
    /** @type {() => void} */
    export let onClick = () => {};
  
    let imgError = false;
  </script>
  
  <button
    class="flex flex-row justify-stretch  saturate-80 hover:saturate-100 hover:text-shadow-blue-800 duration-300 cursor-pointer rounded-sm"
    on:click={onClick}
    aria-label="Open {personaProfile.name} persona profile"
  >
      <!-- Photo / fallback initials -->
      <div class="photo-sm rounded-l-sm">
        {#if !imgError}
          <img
            src="/assets/profiles/{personaProfile.imageFile}"
            alt={personaProfile.name}
            on:error={() => (imgError = true)}
          />
        {:else}
          <div class="label-uppercase">{personaProfile.initials}</div>
        {/if}
      </div>
      <div class="jm-content-col pl-4">
        <span class="heading">{personaProfile.name}</span>
      <span class="pill-sm">
        {personaProfile.role}
      </span>
    </div>
  </button>