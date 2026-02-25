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
    <div class="persona-profile-card__content">
      <!-- Photo / fallback initials -->
      <div class="persona-profile-card__photo">
        {#if !imgError}
          <img
            src="/assets/profiles/{personaProfile.imageFile}"
            alt={personaProfile.name}
            class="persona-profile-card__img"
            on:error={() => (imgError = true)}
          />
        {:else}
          <div class="persona-profile-card__initials">{personaProfile.initials}</div>
        {/if}
      </div>
  <div class = "CardContent">
      <!-- Name -->
      <span class="jm-title">{personaProfile.name}</span>
  
      <!-- Role -->
      <div class="jm-metric-row">
        <span class = "jm-label">{personaProfile.role}</span>
      </div>
  
      <!-- Quick-look fields -->
      {#each [['Age', personaProfile.age]] as [key, val]}
        <div class="jm-label">
          <span class="">{key}</span>
          <span class="">{val}</span>
        </div>
      {/each}
    </div>
    </div>
  </button>