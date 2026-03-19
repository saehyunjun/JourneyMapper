<script>
    /**
     * PersonaStory.svelte
     * 5 screens: Bio · Quote · Discussion Themes · Goals · Barriers
     * Click right half → advance, left half → rewind. Keyboard arrows work too.
     */
  
    import { createEventDispatcher } from 'svelte';
  
    import IconXRegular       from 'phosphor-icons-svelte/IconXRegular.svelte';
    import IconUserRegular    from 'phosphor-icons-svelte/IconUserRegular.svelte';
    import IconQuotesRegular  from 'phosphor-icons-svelte/IconQuotesRegular.svelte';
    import IconChatsRegular   from 'phosphor-icons-svelte/IconChatsRegular.svelte';
    import IconTargetRegular  from 'phosphor-icons-svelte/IconTargetRegular.svelte';
    import IconWarningRegular from 'phosphor-icons-svelte/IconWarningRegular.svelte';
  
    const dispatch = createEventDispatcher();
  
    export let personas    = [];
    export let activeIndex = 0;
    export let originEl    = null; // kept for API compat
    export let open        = false;
  
    const SCREENS = [
      { id: 'bio',      label: 'Bio'               },
      { id: 'quote',    label: 'Quote'             },
      { id: 'themes',   label: 'Discussion Themes' },
      { id: 'goals',    label: 'Goals'             },
      { id: 'barriers', label: 'Barriers'          },
    ];
  
    let screenIdx = 0;
    let imgError  = false;
  
    $: persona  = personas[activeIndex] ?? null;
    $: profile  = persona?.profile ?? {};
    $: goals    = [profile.goal1, profile.goal2, profile.goal3].filter(Boolean);
    $: barriers = [profile.barrier1, profile.barrier2, profile.barrier3].filter(Boolean);
    $: themes   = persona?.discussionThemes ?? [];
    $: states   = persona?.currentState ?? [];
    $: screen   = SCREENS[screenIdx]?.id ?? 'bio';
  
    $: if (open) { screenIdx = 0; imgError = false; }
    $: if (activeIndex !== undefined) imgError = false;
  
    function advance() {
      if (screenIdx < SCREENS.length - 1) screenIdx++;
      else close();
    }
  
    function rewind() {
      if (screenIdx > 0) screenIdx--;
    }
  
    function close() {
      open = false;
      dispatch('close');
    }
  
    function onKeydown(/** @type {KeyboardEvent} */ e) {
      if (!open) return;
      if (e.key === 'ArrowRight') advance();
      else if (e.key === 'ArrowLeft') rewind();
      else if (e.key === 'Escape') close();
    }
  
    function sparkPath(vals, w, h) {
      if (!vals?.length) return '';
      const min = Math.min(...vals), max = Math.max(...vals);
      const range = max - min || 1;
      return vals.map((v, i) => {
        const x = (i / (vals.length - 1 || 1)) * w;
        const y = h - ((v - min) / range) * h;
        return `${i === 0 ? 'M' : 'L'}${x},${y}`;
      }).join(' ');
    }
  
    function themeColor(sentiments) {
      if (!sentiments?.length) return '#73726c';
      const avg = sentiments.reduce((a, b) => a + b, 0) / sentiments.length;
      if (avg >= 0.65) return '#23abab';
      if (avg >= 0.45) return '#6db898';
      if (avg >= 0.30) return '#b5b86e';
      if (avg >= 0.15) return '#e0935c';
      return '#e05c5c';
    }
  </script>
  
  <svelte:window on:keydown={onKeydown} />
  
  {#if open && persona}
  
    <!-- svelte-ignore a11y-click-events-have-key-events -->
    <!-- svelte-ignore a11y-no-static-element-interactions -->
    <div class="story-backdrop" on:click={close} role="presentation" />
  
    <div
      class="story-panel jm-surface"
      role="dialog"
      aria-modal="true"
      aria-label="Persona story: {profile.name}"
    >
  
      <!-- Progress pips -->
      <div class="story-pips" aria-hidden="true">
        {#each SCREENS as _, i}
          <div class="pip" class:pip--active={i === screenIdx} class:pip--done={i < screenIdx} />
        {/each}
      </div>
  
      <!-- Header -->
      <div class="story-header">
        <div class="flex items-center gap-2">
          <div class="story-avatar" class:story-avatar--caregiver={persona.type === 'caregiver'}>
            {#if !imgError && profile.imageFile}
              <img class="story-avatar-img" src="/assets/profiles/{profile.imageFile}" alt={profile.name} on:error={() => imgError = true} />
            {:else}
              <span class="label-heading">{profile.initials ?? '?'}</span>
            {/if}
          </div>
          <div class="flex flex-col">
            <span class="label-uppercase-bold">{profile.name}</span>
            <span class="label-heading">{SCREENS[screenIdx].label}</span>
          </div>
        </div>
        <button class="btn-base" on:click|stopPropagation={close} aria-label="Close story">
          <IconXRegular size={16} />
        </button>
      </div>
  
      <!-- Invisible click zones — left rewinds, right advances -->
      <!-- svelte-ignore a11y-click-events-have-key-events -->
      <!-- svelte-ignore a11y-no-static-element-interactions -->
      <div class="click-zone click-zone--left"  on:click={rewind}  />
      <!-- svelte-ignore a11y-click-events-have-key-events -->
      <!-- svelte-ignore a11y-no-static-element-interactions -->
      <div class="click-zone click-zone--right" on:click={advance} />
  
      <!-- ── SCREEN 0: BIO ─────────────────────────────────────────────── -->
      {#if screen === 'bio'}
        <div class="story-screen">
          <div class="bio-hero">
            {#if !imgError && profile.imageFile}
              <img class="bio-photo" src="/assets/profiles/{profile.imageFile}" alt={profile.name} on:error={() => imgError = true} />
            {:else}
              <div class="bio-photo-fallback"><IconUserRegular size={72} /></div>
            {/if}
            <div class="bio-scrim" aria-hidden="true" />
            <div class="bio-overlay">
              <span class="pill-white">{(persona.type ?? 'persona').charAt(0).toUpperCase() + (persona.type ?? 'persona').slice(1)}</span>
              <h2 class="heading" style="color:#fff; font-size:1.4rem">{profile.name}</h2>
              <span class="label-heading" style="color:rgba(255,255,255,0.7)">{profile.role ?? ''}</span>
            </div>
          </div>
  
          <div class="content-wrap">
            {#if profile.bio}
              <p class="text-body-sm">{profile.bio}</p>
            {/if}
  
            <div class="flex flex-col">
              {#each [
                ['Age',        profile.age],
                ['Gender',     profile.gender],
                ['Occupation', profile.occupation],
                ['Diagnosed',  profile.diagnosed],
                ['Preference', profile.preference],
                ['Caregiver',  profile.caregiver],
              ].filter(([, v]) => v) as [key, val]}
                <div class="fact-row border-bottom">
                  <span class="label-heading">{key}</span>
                  <span class="text-body-sm">{val}</span>
                </div>
              {/each}
            </div>
  
            {#if states.length}
              <div class="jm-section-bar"><span class="label-lg">
                Current State</span></div>
              <div class="flex flex-col gap-3">
                {#each states as s}
                  <div class="flex flex-col gap-1">
                    <div class="flex justify-between">
                      <span class="label-heading">{s.label}</span>
                      <span class="label-heading">{Math.round(s.value * 100)}%</span>
                    </div>
                    <div class="state-track">
                      <div class="state-fill" style="width:{s.value * 100}%" />
                    </div>
                    <div class="flex justify-between">
                      <span class="label-heading" style="font-size:0.5rem;opacity:0.7">{s.minLabel}</span>
                      <span class="label-heading" style="font-size:0.5rem;opacity:0.7">{s.maxLabel}</span>
                    </div>
                  </div>
                {/each}
              </div>
            {/if}
          </div>
        </div>
  
      <!-- ── SCREEN 1: QUOTE ───────────────────────────────────────────── -->
      {:else if screen === 'quote'}
        <div class="story-screen">
          <div class="bio-hero">
            <div class="bio-scrim" aria-hidden="true" />
          </div>
  
          <div class="content-wrap" style="flex:1; justify-content:center;">
            <div style="color:rgba(49,47,40,0.2); line-height:1"><IconQuotesRegular class="h-8" /></div>
            {#if profile.quote}
              <blockquote class="body-text" style="margin:0">{profile.quote}</blockquote>
            {:else}
              <p class="text-body-sm" style="font-style:italic">No quote recorded for this persona.</p>
            {/if}
          </div>
        </div>
  
      <!-- ── SCREEN 2: DISCUSSION THEMES ──────────────────────────────── -->
      {:else if screen === 'themes'}
        <div class="story-screen">
          <div class="content-wrap">
            <div class="jm-kicker flex items-center gap-2">
              <IconChatsRegular size={13} /> Discussion Themes
            </div>
            <div class="jm-section-bar">
              <span class="label-lg">What {profile.name?.split(' ')[0]} talks about</span>
            </div>
  
            {#if themes.length}
              <div class="flex flex-col gap-4">
                {#each themes as theme, i}
                  {@const color = themeColor(theme.sentiments)}
                  <div class="flex flex-col gap-1">
                    <div class="flex items-center gap-2">
                      <span class="label-heading" style="width:14px;text-align:right;flex-shrink:0">{i + 1}</span>
                      <span class="text-body-sm" style="flex:1;font-weight:500">{theme.label}</span>
                      <span class="tag" style="background:{color}22;color:{color};border-color:{color}55;font-size:0.55rem;font-family:var(--font-mono);letter-spacing:0.06em;flex-shrink:0">
                        {theme.sentiments?.length
                          ? Math.round((theme.sentiments.reduce((a, b) => a + b, 0) / theme.sentiments.length) * 100) + '%'
                          : '—'}
                      </span>
                    </div>
                    {#if theme.sentiments?.length > 1}
                      <svg style="width:calc(100% - 22px);height:20px;display:block;margin-left:22px" viewBox="0 0 120 20" preserveAspectRatio="none" aria-hidden="true">
                        <path d="{sparkPath(theme.sentiments, 120, 20)} L120,20 L0,20 Z" fill="{color}18" />
                        <path d={sparkPath(theme.sentiments, 120, 20)} fill="none" stroke={color} stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
                      </svg>
                    {/if}
                  </div>
                {/each}
              </div>
            {:else}
              <p class="text-body-sm" style="font-style:italic">No discussion themes recorded.</p>
            {/if}
          </div>
        </div>
  
      <!-- ── SCREEN 3: GOALS ───────────────────────────────────────────── -->
      {:else if screen === 'goals'}
        <div class="story-screen">
          <div class="content-wrap">
            <div class="jm-kicker flex items-center gap-2">
              <IconTargetRegular size={13} /> Goals
            </div>
            <div class="jm-section-bar">
              <span class="label-lg">What {profile.name?.split(' ')[0]} is working toward</span>
            </div>
  
            {#if goals.length}
              <ol class="flex flex-col gap-4" style="list-style:none;padding:0;margin:0">
                {#each goals as goal, i}
                  <li class="flex gap-3 items-start">
                    <span class="item-num">{i + 1}</span>
                    <p class="text-body-sm" style="margin:0">{goal}</p>
                  </li>
                {/each}
              </ol>
            {:else}
              <p class="text-body-sm" style="font-style:italic">No goals recorded for this persona.</p>
            {/if}
          </div>
        </div>
  
      <!-- ── SCREEN 4: BARRIERS ────────────────────────────────────────── -->
      {:else if screen === 'barriers'}
        <div class="story-screen">
          <div class="content-wrap">
            <div class="jm-kicker flex items-center gap-2">
              <IconWarningRegular size={13} /> Barriers
            </div>
            <div class="jm-section-bar">
              <span class="label-lg">What's standing in the way</span>
            </div>
  
            {#if barriers.length}
              <ol class="flex flex-col gap-4" style="list-style:none;padding:0;margin:0">
                {#each barriers as barrier, i}
                  <li class="flex gap-3 items-start">
                    <span class="item-num item-num--barrier">{i + 1}</span>
                    <p class="text-body-sm" style="margin:0">{barrier}</p>
                  </li>
                {/each}
              </ol>
            {:else}
              <p class="text-body-sm" style="font-style:italic">No barriers recorded for this persona.</p>
            {/if}
          </div>
        </div>
      {/if}
  
      {#if screenIdx === 0}
        <div class="tap-hint">
          <span class="label-heading">Tap to advance</span>
        </div>
      {/if}
  
    </div>
  {/if}
  
  <style>
    .story-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(16, 14, 10, 0.75);
      backdrop-filter: blur(6px);
      -webkit-backdrop-filter: blur(6px);
      z-index: 700;
      cursor: pointer;
    }
  
    .story-panel {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      z-index: 710;
      width: min(400px, 92vw);
      height: min(680px, 88vh);
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
  
    /* Progress pips */
    .story-pips {
      display: flex;
      gap: 4px;
      padding: 10px 12px 0;
      flex-shrink: 0;
      position: relative;
      z-index: 2;
    }
    .pip {
      flex: 1;
      height: 2px;
      border-radius: 2px;
      background: rgba(49, 47, 40, 0.15);
      transition: background 200ms;
    }
    .pip--done   { background: rgba(49, 47, 40, 0.45); }
    .pip--active { background: var(--ink, #312F28); }
  
    /* Header */
    .story-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 10px 6px 12px;
      flex-shrink: 0;
      position: relative;
      z-index: 2;
    }
  
    /* Avatar */
    .story-avatar {
      width: 34px;
      height: 34px;
      border-radius: 50%;
      border: 2px solid var(--ink, #312F28);
      overflow: hidden;
      flex-shrink: 0;
      background: #e8e5de;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .story-avatar--caregiver { border-color: var(--teal, #23abab); }
    .story-avatar-img { width: 100%; height: 100%; object-fit: cover; }
  
    /* Click zones — sit above content, below close button */
    .click-zone {
      position: absolute;
      top: 80px;
      bottom: 0;
      z-index: 5;
      cursor: pointer;
    }
    .click-zone--left  { left: 0;  width: 38%; }
    .click-zone--right { right: 0; width: 62%; }
  
    /* Screen wrapper */
    .story-screen {
      flex: 1;
      overflow-y: auto;
      overflow-x: hidden;
      overscroll-behavior: contain;
      position: relative;
      z-index: 1;
      min-height: 0;
      display: flex;
      flex-direction: column;
    }
  
    /* Bio hero */
    .bio-hero {
      position: relative;
      height: 190px;
      flex-shrink: 0;
      overflow: hidden;
      background: #e8e5de;
    }
    .bio-photo {
      width: 100%;
      height: 100%;
      object-fit: cover;
      object-position: top center;
      display: block;
    }
    .bio-photo-fallback {
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #b0a898;
    }
    .bio-scrim {
      position: absolute;
      inset: 0;
      background: linear-gradient(to bottom, transparent 30%, rgba(20,18,14,0.82) 100%);
    }
    .bio-overlay {
      position: absolute;
      bottom: 0; left: 0; right: 0;
      padding: 12px 16px;
      display: flex;
      flex-direction: column;
      gap: 3px;
    }
  
    /* Fact rows */
    .fact-row {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      gap: 8px;
      padding: 6px 0;
    }
  
    /* State bars — only the track/fill need component-scoped styles */
    .state-track {
      height: 4px;
      border-radius: 2px;
      background: rgba(0,0,0,0.1);
      overflow: hidden;
    }
    .state-fill {
      height: 100%;
      border-radius: 2px;
      background: var(--ink);
      transition: width 0.4s cubic-bezier(0.4,0,0.2,1);
    }
  
    /* Numbered badges — goals/barriers */
    .item-num {
      font-family: var(--font-mono);
      font-size: 0.7rem;
      font-weight: 700;
      color: var(--ink);
      background: rgba(49,47,40,0.08);
      border-radius: 4px;
      width: 22px;
      height: 22px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .item-num--barrier {
      background: rgba(224,92,92,0.12);
      color: #b83232;
    }
  
    /* Tap hint */
    .tap-hint {
      position: absolute;
      bottom: 12px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 6;
      pointer-events: none;
      opacity: 0.45;
      white-space: nowrap;
    }
  </style>