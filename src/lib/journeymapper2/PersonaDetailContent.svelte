<script>
  /** Full persona object — component reads persona.profile internally */
  let { persona = {} } = $props();

  let profile = $derived(persona?.profile ?? {});

  let flipped = $state(false);
  let imgError = $state(false);

  // Reset image error when persona changes
  $effect(() => { if (persona) imgError = false; });

  function flip() {
    flipped = !flipped;
  }
</script>

<button
  class="persona-card"
  onclick={flip}
  aria-label="Open {profile.name} persona profile"
>
  <div class="persona-card-inner" class:flipped={flipped}>

    <!-- FRONT -->
    <div class="persona-card-face persona-card-front">

      {#if !imgError}
        <img
          class="persona-card-img"
          src="/assets/profiles/{profile.imageFile}"
          alt={profile.name}
          onerror={() => (imgError = true)}
        />
      {:else}
        <div class="persona-card-fallback">
          {profile.initials}
        </div>
      {/if}

      <div class="persona-card-overlay">
        <span class="persona-card-title">{profile.name}</span>
      </div>

      <div class="persona-card-overlay-pill">
        <span class="pill-white">{profile.role}</span>
      </div>

    </div>

    <!-- BACK -->
    <div class="persona-card-face persona-card-back">
      <div class="persona-back-content">

        <div class="persona-back-header">
          <span class="persona-back-name">{profile.name}</span>
          <span class="pill-white">{profile.role}</span>
        </div>

        <div class="persona-back-section">
          <span class="label-sm">Medical Understanding</span>
          <span>{profile.medicalUnderstanding}/10</span>
        </div>

        <div class="persona-back-section">
          <span class="label-sm">Emotional State</span>
          <span>{profile.emotionalValence}/10</span>
        </div>

        <div class="persona-back-section">
          <span class="label-sm">Logistical Capacity</span>
          <span>{profile.logisticalCapacity}/10</span>
        </div>

        <div class="persona-back-section">
          <span class="label-sm">Trust in Providers</span>
          <span>{profile.trust}/10</span>
        </div>

      </div>
    </div>

  </div>
</button>
