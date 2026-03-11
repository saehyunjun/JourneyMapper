<script>
  /** @type {Record<string, any>} */
  export let personaProfile = {};

  let flipped = false;
  let imgError = false;

  function flip() {
    flipped = !flipped;
  }
</script>

<button
  class="persona-card"
  on:click={flip}
  aria-label="Open {personaProfile.name} persona profile"
>

  <div class="persona-card-inner" class:flipped={flipped}>

    <!-- FRONT -->
    <div class="persona-card-face persona-card-front">

      {#if !imgError}
        <img
          class="persona-card-img"
          src="/assets/profiles/{personaProfile.imageFile}"
          alt={personaProfile.name}
          on:error={() => (imgError = true)}
        />
      {:else}
        <div class="persona-card-fallback">
          {personaProfile.initials}
        </div>
      {/if}

      <div class="persona-card-overlay">
        <span class="persona-card-title">
          {personaProfile.name}
        </span>
      </div>

      <div class="persona-card-overlay-pill">
        <span class="pill-white">
          {personaProfile.role}
        </span>
      </div>

    </div>


    <!-- BACK -->
    <div class="persona-card-face persona-card-back">

      <div class="persona-back-content">

        <div class="persona-back-header">
          <span class="persona-back-name">
            {personaProfile.name}
          </span>
          <span class="pill-white">
            {personaProfile.role}
          </span>
        </div>

        <div class="persona-back-section">
          <span class="label-uppercase">Medical Understanding</span>
          <span>{personaProfile.medicalUnderstanding}/10</span>
        </div>

        <div class="persona-back-section">
          <span class="label-uppercase">Emotional State</span>
          <span>{personaProfile.emotionalValence}/10</span>
        </div>

        <div class="persona-back-section">
          <span class="label-uppercase">Logistical Capacity</span>
          <span>{personaProfile.logisticalCapacity}/10</span>
        </div>

        <div class="persona-back-section">
          <span class="label-uppercase">Trust in Providers</span>
          <span>{personaProfile.trust}/10</span>
        </div>

      </div>

    </div>

  </div>

</button>