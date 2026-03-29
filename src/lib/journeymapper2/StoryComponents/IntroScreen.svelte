<script>
  export let profile = {};
  export let persona = {};
</script>

<div class="story-screen">
  <div class="content-wrap items-center text-center">
    <div class="photo-full">
      {#if profile.imageFile}
        <img src="/assets/profiles/{profile.imageFile}" alt={profile.name} />
      {:else}
        <span class="label-sm">{profile.initials ?? '?'}</span>
      {/if}
    </div>

    <p class="pull-quote text-center px-8">
      {profile.name} is a <span class="underline">{persona.type}</span>
      living with <span class="underline lowercase">{profile.indication}</span>
    </p>
  </div>
</div>