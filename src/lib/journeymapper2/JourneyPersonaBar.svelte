<script>
    /** Persona profile object — same shape as activePersona.profile */
    export let profile = {
      initials:   '',
      name:       '',
      role:       '',
      age:        '',
      occupation: '',
      preference: '',
      diagnosed:  '',
    };
  </script>
  
  <div class="persona-strip">
    <div class="strip-avatar">{profile.initials}</div>
  
    <div class="strip-name-block">
      <span class="strip-name">{profile.name}</span>
      <span class="strip-role">{profile.role}</span>
    </div>
  
    <div class="strip-divider" aria-hidden="true" />
  
    {#each [
      ['Age',        profile.age],
      ['Occupation', profile.occupation],
      ['Preference', profile.preference],
      ['Diagnosed',  profile.diagnosed],
    ] as [key, val]}
      <div class="strip-field">
        <span class="strip-key">{key}</span>
        <span class="strip-val">{val}</span>
      </div>
    {/each}
  </div>
  
  <style>
    .persona-strip {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 8px 20px;
      background: #F4EFE5;
      border-bottom: 1px solid #DFC3A8;
      flex-wrap: wrap;
    }
  
    .strip-avatar {
      width: 30px;
      height: 30px;
      border-radius: 50%;
      background: #C4956A;
      color: #F4EFE5;
      font-size: 11px;
      font-weight: 500;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
  
    .strip-name-block {
      display: flex;
      flex-direction: column;
      gap: 1px;
      flex-shrink: 0;
    }
  
    .strip-name {
      font-family: 'IBM Plex Sans';
      font-size: 1em;
      font-weight: 600;
      color: #343434;
      letter-spacing: 0.02em;
    }
  
    .strip-role {
      font-family: 'DM Sans', sans-serif;
      font-size: 8px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #A08060;
    }
  
    .strip-divider {
      width: 1px;
      height: 24px;
      background: #DFC3A8;
      flex-shrink: 0;
    }
  
    .strip-field {
      display: flex;
      flex-direction: column;
      gap: 1px;
      flex-shrink: 0;
    }
  
    .strip-key {
      font-family: 'DM Sans', sans-serif;
      font-size: 8px;
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #BFA080;
    }
  
    .strip-val {
      font-family: 'Space Mono', monospace;
      font-size: 9px;
      color: #5A3E28;
    }
  </style>