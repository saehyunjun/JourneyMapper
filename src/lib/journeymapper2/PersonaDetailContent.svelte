<script lang=ts>
    /** Full persona object from journeyPersonas.json */
    export let persona: any = null;
  
    function tileColor(v) {
      const n = Math.max(0, Math.min(1, v));
      if (n < 0.20) return '#7A1A1A';
      if (n < 0.38) return '#C03030';
      if (n < 0.53) return '#C8A84A';
      if (n < 0.68) return '#7DB85A';
      return '#2E7D32';
    }
  
    function pct(v) {
      return `${Math.round(Math.max(0, Math.min(1, v)) * 100)}%`;
    }
  
    let imgError = false;
  </script>
  
  {#if persona}
  <div class="wrap">
  
    <!-- ── Hero ──────────────────────────────────────────────────────────── -->
    <div class="hero">
      <div class="photo-lg">
        {#if !imgError}
          <img
            src="/assets/profiles/{persona.profile.imageFile}"
            alt={persona.profile.name}
            class="photo"
            on:error={() => imgError = true}
          />
        {:else}
          <div class="photo-fallback">{persona.profile.initials}</div>
        {/if}
      </div>
      <div class="hero-meta">
        <p class="">{persona.profile.name}</p>
        <p class="hero-role">{persona.profile.role}</p>
        <div class="hero-pills">
          <span class="pill">{persona.profile.age} yrs</span>
          <span class="pill">{persona.profile.gender}</span>
          <span class="pill">{persona.profile.occupation}</span>
        </div>
      </div>
    </div>
  
    <!-- ── Profile details ───────────────────────────────────────────────── -->
    <div class="detail-grid">
      {#each [
        ['Caregiver',  persona.profile.caregiver],
        ['Preference', persona.profile.preference],
        ['Diagnosed',  persona.profile.diagnosed],
      ] as [k, v]}
        <span class="dk">{k}</span>
        <span class="dv">{v}</span>
      {/each}
    </div>
  
    <!-- ── Current State ─────────────────────────────────────────────────── -->
    {#if persona.currentState?.length}
      <div class="divider" />
      <div class="jm-section-bar">Current State</div>
      <div class="title-block">
        {#each persona.currentState as item}
          <div class="row">
            <span class="label">{item.label}</span>
            <div class="col">
              <div class="bar-track">
                <div class="fill" style="width:{pct(item.value)};" />
              </div>
              <div class="axis">
                <span class="min-label">{item.minLabel}</span>
                <span class="max-label" >{item.maxLabel}</span>
              </div>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  
    <!-- ── Discussion Themes ─────────────────────────────────────────────── -->
    {#if persona.discussionThemes?.length}
      <div class="divider"/>
      <div class="band-head">Key Discussion Themes</div>
      <div class="themes-block">
        {#each persona.discussionThemes as theme}
          <div class="theme-row">
            <span class="theme-lbl">{theme.label}</span>
            <div class="tiles">
              {#each theme.sentiments as s}
                <div class="tile" style="background:{tileColor(s)};" title="{Math.round((s*10)-5)}" />
              {/each}
            </div>
          </div>
        {/each}
        <div class="legend">
          <span class="ls" style="background:#7A1A1A;" /><span class="ll">Very Negative</span>
          <span class="ls" style="background:#C8A84A; margin-left:10px;" /><span class="ll">Neutral</span>
          <span class="ls" style="background:#2E7D32; margin-left:10px;" /><span class="ll">Very Positive</span>
        </div>
      </div>
    {/if}
  
  </div>
  {/if}
  
  <style>
   
  </style>