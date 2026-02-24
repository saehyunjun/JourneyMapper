<script>
    /** Persona object */
    export let persona = {
      initials:   'MW',
      name:       'Margaret W.',
      role:       'Early-Stage Patient',
      age:        67,
      gender:     'Female',
      occupation: 'Retired Teacher',
      caregiver:  'Adult daughter',
      preference: 'In-person consultations',
      diagnosed:  '18 months after symptom onset',
    };
  
    /** Journey data — used to derive stages list */
    export let data = [];
  
    /** Metric definitions */
    export let metrics = [];
  
    // Derive unique ordered stages from journey data
    $: stages = [...new Map(data.map(d => [d.stage_id, { id: d.stage_id, label: d.stage }])).values()];
  
    // Count steps per stage
    $: stageCounts = data.reduce((acc, d) => {
      acc[d.stage_id] = (acc[d.stage_id] ?? 0) + 1;
      return acc;
    }, {});
  </script>
  
  <!-- ── Persona card ─────────────────────────────────────────────────────── -->
  <div class="persona-card">
    <div class="avatar">{persona.initials}</div>
    <div class="persona-meta">
      <span class="persona-name">{persona.name}</span>
      <span class="persona-role">{persona.role}</span>
    </div>
  </div>
  
  <!-- ── Detail rows ─────────────────────────────────────────────────────── -->
  <div class="detail-block">
    <div class="detail-row">
      <span class="detail-key">Age</span>
      <span class="detail-val">{persona.age}</span>
    </div>
    <div class="detail-row">
      <span class="detail-key">Gender</span>
      <span class="detail-val">{persona.gender}</span>
    </div>
    <div class="detail-row">
      <span class="detail-key">Occupation</span>
      <span class="detail-val">{persona.occupation}</span>
    </div>
    <div class="detail-row">
      <span class="detail-key">Caregiver</span>
      <span class="detail-val">{persona.caregiver}</span>
    </div>
    <div class="detail-row">
      <span class="detail-key">Diagnosed</span>
      <span class="detail-val">{persona.diagnosed}</span>
    </div>
    <div class="detail-row">
      <span class="detail-key">Preference</span>
      <span class="detail-val">{persona.preference}</span>
    </div>
  </div>
  
  <!-- ── Divider ─────────────────────────────────────────────────────────── -->
  <div class="divider" />
  
  <!-- ── Stages list ─────────────────────────────────────────────────────── -->
  <div class="block-heading">Stages</div>
  <div class="stages-list">
    {#each stages as stage, i}
      <div class="stage-row">
        <span class="stage-index">{i + 1}</span>
        <span class="stage-label">{stage.label}</span>
        <span class="stage-count">{stageCounts[stage.id] ?? 0} step{stageCounts[stage.id] === 1 ? '' : 's'}</span>
      </div>
    {/each}
  </div>
  
  <!-- ── Divider ─────────────────────────────────────────────────────────── -->
  <div class="divider" />
  
  <!-- ── Metrics list ────────────────────────────────────────────────────── -->
  <div class="block-heading">Metrics</div>
  <div class="metrics-list">
    {#each metrics as m}
      <div class="metric-row">
        <span class="metric-dot" style="background: {m.color};" />
        <span class="metric-label">{m.label}</span>
      </div>
    {/each}
    <p class="metric-note">Scores range from −5 (very negative) to +5 (very positive).</p>
  </div>
  
  <style>
    /* ── Persona card ──────────────────────────────────────────────────────── */
    .persona-card {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 14px 14px 12px;
      border-bottom: 1px solid #DFC3A8;
      background: #EDE5D8;
    }
  
    .avatar {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: #C4956A;
      color: #F4EFE5;
      font-family: 'Space Mono', monospace;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.04em;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
  
    .persona-meta {
      display: flex;
      flex-direction: column;
      gap: 3px;
      min-width: 0;
    }
  
    .persona-name {
      font-family: 'Space Mono', monospace;
      font-size: 10px;
      font-weight: 700;
      color: #5A3E28;
      letter-spacing: 0.03em;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  
    .persona-role {
      font-family: 'DM Sans', sans-serif;
      font-size: 9px;
      color: #A08060;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  
    /* ── Detail rows ───────────────────────────────────────────────────────── */
    .detail-block {
      padding: 10px 14px 6px;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
  
    .detail-row {
      display: flex;
      align-items: baseline;
      gap: 6px;
    }
  
    .detail-key {
      font-family: 'DM Sans', sans-serif;
      font-size: 9px;
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 0.07em;
      color: #BFA080;
      flex-shrink: 0;
      width: 72px;
    }
  
    .detail-val {
      font-family: 'Space Mono', monospace;
      font-size: 9px;
      color: #5A3E28;
      line-height: 1.5;
    }
  
    /* ── Divider ───────────────────────────────────────────────────────────── */
    .divider {
      height: 1px;
      background: #DFC3A8;
      margin: 8px 0;
    }
  
    /* ── Section headings ──────────────────────────────────────────────────── */
    .block-heading {
      font-family: 'DM Sans', sans-serif;
      font-size: 9px;
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: #BFA080;
      padding: 0 14px 6px;
    }
  
    /* ── Stages list ───────────────────────────────────────────────────────── */
    .stages-list {
      padding: 0 14px 10px;
      display: flex;
      flex-direction: column;
      gap: 5px;
    }
  
    .stage-row {
      display: flex;
      align-items: center;
      gap: 8px;
    }
  
    .stage-index {
      font-family: 'Space Mono', monospace;
      font-size: 8px;
      color: #BFA080;
      width: 12px;
      flex-shrink: 0;
      text-align: right;
    }
  
    .stage-label {
      font-family: 'DM Sans', sans-serif;
      font-size: 10px;
      color: #7A5A3A;
      flex: 1;
      line-height: 1.4;
    }
  
    .stage-count {
      font-family: 'Space Mono', monospace;
      font-size: 8px;
      color: #BFA080;
      white-space: nowrap;
    }
  
    /* ── Metrics list ──────────────────────────────────────────────────────── */
    .metrics-list {
      padding: 0 14px 10px;
      display: flex;
      flex-direction: column;
      gap: 7px;
    }
  
    .metric-row {
      display: flex;
      align-items: center;
      gap: 8px;
    }
  
    .metric-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      flex-shrink: 0;
      opacity: 0.9;
    }
  
    .metric-label {
      font-family: 'DM Sans', sans-serif;
      font-size: 10px;
      color: #7A5A3A;
      line-height: 1.4;
    }
  
    .metric-note {
      font-family: 'DM Sans', sans-serif;
      font-size: 9px;
      color: #BFA080;
      line-height: 1.6;
      margin: 4px 0 0;
      font-style: italic;
    }
  </style>