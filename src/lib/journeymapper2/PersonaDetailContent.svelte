<script lang="ts">
  export let persona: any = null;

  function tileColor(v:number) {
    const n = Math.max(0, Math.min(1, v));
    if (n < 0.20) return '#7A1A1A';
    if (n < 0.38) return '#C03030';
    if (n < 0.53) return '#C8A84A';
    if (n < 0.68) return '#7DB85A';
    return '#2E7D32';
  }

  function pct(v:number) {
    return `${Math.round(Math.max(0, Math.min(1, v)) * 100)}%`;
  }

  let imgError = false;
</script>


{#if persona}

<div class="flex flex-col gap-4 p-4">

  <!-- ── HERO ───────────────────────────── -->
  <div class="jm-hero">

    <div class="photo-lg">
      {#if !imgError}
        <img
          src="/assets/profiles/{persona.profile.imageFile}"
          alt={persona.profile.name}
          class="w-full h-full object-cover"
          on:error={() => imgError = true}
        />
      {:else}
        <div class="flex items-center justify-center w-full h-full label">
          {persona.profile.initials}
        </div>
      {/if}
    </div>

    <div class="flex flex-col gap-2">

      <div class="jm-content-col">
        <span class="label-sm">{persona.profile.role}</span>
        <span class="heading-sm">{persona.profile.name}</span>
      </div>

      <div class="flex flex-wrap gap-2">
        <span class="pill">{persona.profile.gender}</span>
        <span class="pill">{persona.profile.age} yrs</span>
        <span class="pill">{persona.profile.occupation}</span>
      </div>

    </div>

  </div>


  <!-- ── PROFILE DETAILS ─────────────────── -->
  <div class="jm-content-row">

    {#each [
      ['Caregiver', persona.profile.caregiver],
      ['Preference', persona.profile.preference],
      ['Diagnosed', persona.profile.diagnosed]
    ] as [k,v]}

      <div class="jm-content-col">
        <span class="label-sm">{k}</span>
        <span class="text-body-sm">{v}</span>
      </div>

    {/each}

  </div>


  <!-- ── CURRENT STATE ───────────────────── -->
  {#if persona.currentState?.length}

    <div class="divider"></div>

    <div class="jm-section-bar">
      <span class="heading-xs">Current State</span>
    </div>

    <div class="flex flex-col gap-3">

      {#each persona.currentState as item}

        <div class="jm-content-col gap-1">

          <span class="label-uppercase">{item.label}</span>

          <div class="w-full h-2 bg-[var(--card)] relative">

            <div
              class="absolute top-0 left-0 h-2 bg-[var(--ink)]"
              style="width:{pct(item.value)}"
            />

          </div>

          <div class="flex flex-row w-full justify-between label-sm text-gray-500">

            <span>{item.minLabel}</span>
            <span>{item.maxLabel}</span>

          </div>

        </div>

      {/each}

    </div>

  {/if}


  <!-- ── DISCUSSION THEMES ───────────────── -->
  {#if persona.discussionThemes?.length}

    <div class="divider"></div>

    <div class="jm-section-bar">
      <span class="heading-xs">Key Discussion Themes</span>
    </div>

    <div class="flex flex-col gap-3">

      {#each persona.discussionThemes as theme}

        <div class="jm-content-col gap-1">

          <span class="label-sm">{theme.label}</span>

          <div class="flex gap-1">

            {#each theme.sentiments as s}

              <span
                class="w-3 h-3"
                style="background:{tileColor(s)}"
                title="{Math.round((s*10)-5)}"
              />

            {/each}

          </div>

        </div>

      {/each}

      <div class="flex gap-3 text-body-sm">

        <span class="flex items-center gap-1">
          <span class="w-3 h-3" style="background:#7A1A1A"></span>
          Very Negative
        </span>

        <span class="flex items-center gap-1">
          <span class="w-3 h-3" style="background:#C8A84A"></span>
          Neutral
        </span>

        <span class="flex items-center gap-1">
          <span class="w-3 h-3" style="background:#2E7D32"></span>
          Very Positive
        </span>

      </div>

    </div>

  {/if}

</div>

{/if}