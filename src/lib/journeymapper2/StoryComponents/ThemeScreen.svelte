<script>
  export let themes = [];
  export let profile = {};
</script>

<div class="story-screen">
  <div class="content-wrap gap-4">

    <h2 class="heading-serif-md">
      What defines {profile?.name}
    </h2>

    <div class="jm-content-grid-2">
      {#each themes as theme}
        <div class="jm-content-row gap-2 items-center">
          
          <!-- Color / sentiment swatch -->
          <div class="jm-swatch-round-sm"
            style="background:{theme.color ?? 'var(--grayblue)'}">
          </div>

          <!-- Theme label -->
          <span class="text-body-sm">
            {theme.label ?? theme}
          </span>

          {#if theme.sentiment}
            <span class="pill-sm ml-auto">
              {theme.sentiment}
            </span>
          {/if}

        </div>
      {/each}
    </div>

  </div>
</div>