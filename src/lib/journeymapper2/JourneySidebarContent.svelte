<script>
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

  export let data = [];
  export let metrics = [];

  $: stages = [...new Map(data.map(d => [d.stage_id, { id: d.stage_id, label: d.stage }])).values()];

  $: stageCounts = data.reduce((acc, d) => {
    acc[d.stage_id] = (acc[d.stage_id] ?? 0) + 1;
    return acc;
  }, {});
</script>

<!-- ── Persona Header ───────────────────────────────────────── -->
<div class="sidebar-header border-bottom jm-content-row">
  <div class="avatar-ring">
    <span class="tab-initials">{persona.initials}</span>
  </div>

  <div class="even-col sidebar-header-text">
    <span class="tab-name">{persona.name}</span>
    <span class="tab-type">{persona.role}</span>
  </div>
</div>

<!-- ── Details ─────────────────────────────────────────────── -->
<div class="sidebar-block even-col">
  {#each [
    ['Age', persona.age],
    ['Gender', persona.gender],
    ['Occupation', persona.occupation],
    ['Caregiver', persona.caregiver],
    ['Diagnosed', persona.diagnosed],
    ['Preference', persona.preference],
  ] as [key, val]}
    <div class="sidebar-row">
      <span class="strip-key">{key}</span>
      <span class="strip-val">{val}</span>
    </div>
  {/each}
</div>

<!-- ── Stages ──────────────────────────────────────────────── -->
<div class="sidebar-block">
  <span class="jm-kicker">Stages</span>

  <div class="even-col sidebar-list">
    {#each stages as stage, i}
      <div class="sidebar-row">
        <span class="strip-key sidebar-index">{i + 1}</span>
        <span class="strip-val sidebar-grow">{stage.label}</span>
        <span class="strip-key">
          {stageCounts[stage.id] ?? 0} step{stageCounts[stage.id] === 1 ? '' : 's'}
        </span>
      </div>
    {/each}
  </div>
</div>

<div class="jm-rule" />

<!-- ── Metrics ─────────────────────────────────────────────── -->
<div class="sidebar-block">
  <span class="jm-kicker">Metrics</span>

  <div class="even-col sidebar-list">
    {#each metrics as m}
      <div class="sidebar-row">
        <span class="metric-dot" style="background:{m.color}" />
        <span class="strip-val">{m.label}</span>
      </div>
    {/each}

    <p class="cite">
      Scores range from −5 (very negative) to +5 (very positive).
    </p>
  </div>
</div>

<style>
  /* ── Header ─────────────────────────────────────────────── */
  .sidebar-header {
    padding: 0.75em 0.875em;
    gap: 0.75em;
    align-items: center;
  }

  .sidebar-header-text {
    gap: 2px;
    min-width: 0;
  }

  /* ── Blocks ─────────────────────────────────────────────── */
  .sidebar-block {
    padding: 0.5em 0.875em 0.75em;
  }

  .sidebar-list {
    gap: 0.35em;
  }

  /* ── Rows ──────────────────────────────────────────────── */
  .sidebar-row {
    display: flex;
    align-items: baseline;
    gap: 0.5em;
  }

  /* Align with existing strip system from app.css */
  .sidebar-row :global(.strip-key) {
    width: 72px;
    flex-shrink: 0;
  }

  .sidebar-index {
    width: 14px !important;
    text-align: right;
  }

  .sidebar-grow {
    flex: 1;
  }

  /* ── Avatar ────────────────────────────────────────────── */
  .avatar-ring {
    width: 36px;
    height: 36px;
    border-radius: 999px;
    background: #C4956A;
    color: #F4EFE5;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  /* ── Metric dot ────────────────────────────────────────── */
  .metric-dot {
    width: 0.5em;
    height: 0.5em;
    border-radius: 999px;
    flex-shrink: 0;
    opacity: 0.9;
  }
</style>