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
      <div class="photo-ring">
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
        <p class="hero-name">{persona.profile.name}</p>
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
      <div class="band-head">Current State</div>
      <div class="state-block">
        {#each persona.currentState as item}
          <div class="state-row">
            <span class="state-lbl">{item.label}</span>
            <div class="bar-col">
              <div class="bar-track">
                <div class="bar-fill" style="width:{pct(item.value)};" />
              </div>
              <div class="bar-axis">
                <span>{item.minLabel}</span>
                <span>{item.maxLabel}</span>
              </div>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  
    <!-- ── Discussion Themes ─────────────────────────────────────────────── -->
    {#if persona.discussionThemes?.length}
      <div class="divider" />
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
    .wrap { display: flex; flex-direction: column; }
  
    /* Hero */
    .hero {
      display: flex; align-items: center; gap: 16px;
      padding: 22px 22px 14px;
    }
  
    .photo-ring {
      width: 72px; height: 72px; border-radius: 50%;
      border: 2px solid #DFC3A8; overflow: hidden; flex-shrink: 0;
      background: #EDE5D8;
    }
  
    .photo { width: 100%; height: 100%; object-fit: cover; display: block; }
  
    .photo-fallback {
      width: 100%; height: 100%;
      background: #C4956A; color: #F4EFE5;
      font-family: 'Space Mono', monospace; font-size: 18px; font-weight: 700;
      display: flex; align-items: center; justify-content: center;
    }
  
    .hero-meta { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
  
    .hero-name {
      font-family: 'IBM Plex Serif', serif; font-size: 2em; font-weight: 400;
      color: #232323; letter-spacing: 0.02em; margin: 0;
    }
  
    .hero-role {
      font-family: 'DM Sans', sans-serif; font-size: 10px;
      text-transform: uppercase; letter-spacing: 0.08em; color: #A08060; margin: 0;
    }
  
    .hero-pills { display: flex; gap: 5px; flex-wrap: wrap; margin-top: 5px; }
  
    .pill {
      font-family: 'Space Mono', monospace; font-size: .825em; color: #232323;
      background: #EDE5D8; border: .5px solid #DFC3A8; border-radius: 20px;
      padding: 4px 8px;
    }
  
    /* Details */
    .detail-grid {
      display: grid; grid-template-columns: 78px 1fr;
      gap: 5px 10px; padding: 4px 22px 18px; align-items: baseline;
    }

    .dv {
      font-family: 'Space Mono', monospace; font-size: 9px;
      color: #5A3E28; line-height: 1.5;
    }
  
    /* Shared */
    .divider { height: 1px; background: #DFC3A8; }
  
    /* Dark band heading — matches the screenshot */
    .band-head {
      background: #3A3A3A; color: #E8E0D4;
      font-family: 'DM Sans', sans-serif; font-size: 9px; font-weight: 600;
      text-transform: uppercase; letter-spacing: 0.12em;
      padding: 5px 22px; line-height: 1;
    }
  
    /* Current State bars */
    .state-block {
      padding: 14px 22px 20px;
      display: flex; flex-direction: column; gap: 16px;
      background: #FAF7F2;
    }
  
    .state-row { display: flex; align-items: flex-start; gap: 14px; }
  
    .state-lbl {
      font-family: 'DM Sans', sans-serif; font-size: 11px; color: #3A3A3A;
      width: 150px; flex-shrink: 0; padding-top: 2px; line-height: 1.4;
    }
  
    .bar-col { flex: 1; display: flex; flex-direction: column; gap: 4px; }
  
    .bar-track {
      height: 14px; background: #E8E0D0;
      border: 1px solid #D0C0A8; border-radius: 1px; overflow: hidden;
    }
  
    .bar-fill {
      height: 100%; background: #9898C8;
      transition: width 0.5s cubic-bezier(0.4,0,0.2,1);
    }
  
    .bar-axis {
      display: flex; justify-content: space-between;
      font-family: 'Space Mono', monospace; font-size: 8px;
      color: #A08060; font-style: italic;
    }
  
  
    .theme-row {
      display: flex; align-items: center; gap: 12px;
      padding: 8px 0; border-bottom: 1px solid #EDE5D8;
    }
  
    .theme-row:last-of-type { border-bottom: none; }
  
    .theme-lbl {
      font-family: 'DM Sans', sans-serif; font-size: 11px; color: #3A3A3A;
      width: 150px; flex-shrink: 0; line-height: 1.4;
    }
  
    .tiles { display: flex; gap: 2px; flex-wrap: wrap; }
  
    .tile {
      width: 14px; height: 14px; border-radius: 2px; flex-shrink: 0;
      cursor: default; transition: transform 0.1s;
    }
  
    .tile:hover { transform: scale(1.4); position: relative; z-index: 1; }
  
    /* Legend */
    .legend {
      display: flex; align-items: center; gap: 5px;
      padding: 12px 0 2px; border-top: 1px dashed #DFC3A8; margin-top: 8px;
    }
  
    .ls { width: 10px; height: 10px; border-radius: 2px; flex-shrink: 0; }
  
    .ll {
      font-family: 'DM Sans', sans-serif; font-size: 8.5px; color: #BFA080;
    }
  </style>