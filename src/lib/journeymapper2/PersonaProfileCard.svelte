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
    class="card"
    class:persona-profile-card--open={isOpen}
    on:click={onClick}
    aria-label="Open {personaProfile.name} persona profile"
  >
    <div class="flex flex-col w-full h-full">
      <!-- Photo / fallback initials -->
      <div class="persona-profile-card__photo">
        {#if !imgError}
          <img
            src="/assets/profiles/{personaProfile.imageFile}"
            alt={personaProfile.name}
            class="w-22 "
            on:error={() => (imgError = true)}
          />
        {:else}
          <div class="persona-profile-card__initials">{personaProfile.initials}</div>
        {/if}
      </div>
  <div class = "CardContent">
      <!-- Name -->
      <span class="h-small">{personaProfile.name}</span>
  
      <!-- Role -->
      <div class="jm-metric-row">
        <span class = "jm-label">{personaProfile.role}</span>
      </div>
  
    </div>
    </div>
  </button>