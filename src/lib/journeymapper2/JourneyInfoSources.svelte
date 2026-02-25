<script>
    import {
      STEP_WIDTH,
      LEFT_AXIS_WIDTH,
      totalWidth,
      buildStageColorMap,
    } from './journeyConfig.js';
    import { hoveredIndex, selectedIndex } from './journeyStore.js';
  
    export let data = [];
  
    $: stageColorMap = buildStageColorMap(data);
    $: width = totalWidth(data.length);
  
    // ── Information Sources ────────────────────────────────────────────────
    // status: 'up' | 'down' | 'steady' | 'absent'
    // Encoded per step_id (1–12 based on journeyPersonas.json journey)
    const INFO_SOURCES = [
      { key: 'physician',     label: 'Physician / Clinician' },
      { key: 'online_search', label: 'Online Search / WebMD' },
      { key: 'patient_orgs',  label: 'Patient Advocacy Orgs' },
      { key: 'family_peers',  label: 'Family & Peer Network' },
      { key: 'pharma_brand',  label: 'Pharma / Brand Materials' },
      { key: 'social_media',  label: 'Social Media / Forums' },
      { key: 'pharmacy',      label: 'Pharmacist' },
    ];
  
    // step_id → { sourceKey → 'up' | 'down' | 'steady' | 'absent' }
    // Journey steps: 1=Initial Symptom Onset, 2=Mild Symptom Improvement,
    // 3=Initial Care, 4=Continued Regression, 5=Referral to Neurologist,
    // 6=Misdiagnosis, 7=Second Opinion, 8=Confirmed Diagnosis,
    // 9=Treatment Decision, 10=Choosing Between Trials,
    // 11=Trial Enrollment, 12=On-Trial Monitoring
    const SOURCE_DATA = {
      '1': { physician: 'absent',  online_search: 'up',     patient_orgs: 'absent',  family_peers: 'steady',  pharma_brand: 'absent',  social_media: 'up',    pharmacy: 'absent'  },
      '2': { physician: 'absent',  online_search: 'steady', patient_orgs: 'absent',  family_peers: 'steady',  pharma_brand: 'absent',  social_media: 'steady',pharmacy: 'absent'  },
      '3': { physician: 'up',      online_search: 'steady', patient_orgs: 'absent',  family_peers: 'steady',  pharma_brand: 'absent',  social_media: 'steady',pharmacy: 'up'      },
      '4': { physician: 'steady',  online_search: 'up',     patient_orgs: 'up',      family_peers: 'up',      pharma_brand: 'absent',  social_media: 'up',    pharmacy: 'steady'  },
      '5': { physician: 'up',      online_search: 'steady', patient_orgs: 'steady',  family_peers: 'steady',  pharma_brand: 'absent',  social_media: 'steady',pharmacy: 'absent'  },
      '6': { physician: 'steady',  online_search: 'up',     patient_orgs: 'up',      family_peers: 'up',      pharma_brand: 'absent',  social_media: 'up',    pharmacy: 'absent'  },
      '7': { physician: 'up',      online_search: 'steady', patient_orgs: 'steady',  family_peers: 'steady',  pharma_brand: 'absent',  social_media: 'steady',pharmacy: 'absent'  },
      '8': { physician: 'steady',  online_search: 'down',   patient_orgs: 'up',      family_peers: 'steady',  pharma_brand: 'up',      social_media: 'steady',pharmacy: 'up'      },
      '9': { physician: 'steady',  online_search: 'steady', patient_orgs: 'steady',  family_peers: 'steady',  pharma_brand: 'up',      social_media: 'steady',pharmacy: 'steady'  },
      '10':{ physician: 'steady',  online_search: 'up',     patient_orgs: 'steady',  family_peers: 'steady',  pharma_brand: 'up',      social_media: 'up',    pharmacy: 'absent'  },
      '11':{ physician: 'steady',  online_search: 'down',   patient_orgs: 'steady',  family_peers: 'steady',  pharma_brand: 'steady',  social_media: 'down',  pharmacy: 'down'    },
      '12':{ physician: 'steady',  online_search: 'down',   patient_orgs: 'steady',  family_peers: 'steady',  pharma_brand: 'steady',  social_media: 'absent',pharmacy: 'absent'  },
    };
  
    // ── Layout ────────────────────────────────────────────────────────────
    const CELL_SIZE   = 10;   // icon bounding box
    const CELL_GAP    = 5;    // vertical gap between rows
    const ROW_STRIDE  = CELL_SIZE + CELL_GAP;
    const TOP_PAD     = 12;
    const BOTTOM_PAD  = 14;
    const LABEL_W     = LEFT_AXIS_WIDTH;
  
    $: svgHeight = TOP_PAD + INFO_SOURCES.length * ROW_STRIDE + BOTTOM_PAD;
  
    function cellX(stepIndex) {
      return LEFT_AXIS_WIDTH + stepIndex * STEP_WIDTH + STEP_WIDTH / 2;
    }
  
    function cellY(rowIndex) {
      return TOP_PAD + rowIndex * ROW_STRIDE + CELL_SIZE / 2;
    }
  
    // ── Icon renderers (return SVG fragment props) ────────────────────────
    // We'll render via {#if} in the template
  </script>
  
  <!-- ── Section label ──────────────────────────────────────────────────── -->
  <div class="section-label">Information Sources</div>
  
  <svg {width} height={svgHeight} class="info-sources-svg">
  
    <!-- ── Stage color bands ─────────────────────────────────────────────── -->
    {#each data as d, i}
      {#if stageColorMap[d.stage_id]}
        <rect
          x={LEFT_AXIS_WIDTH + i * STEP_WIDTH} y="0"
          width={STEP_WIDTH} height={svgHeight}
          fill={stageColorMap[d.stage_id]} opacity="0.18"
          pointer-events="none"
        />
      {/if}
    {/each}
  
    <!-- ── Column highlights ─────────────────────────────────────────────── -->
    {#each data as _d, i}
      {#if $selectedIndex === i}
        <rect x={LEFT_AXIS_WIDTH + i * STEP_WIDTH} y="0" width={STEP_WIDTH} height={svgHeight} fill="#C4956A" opacity="0.12" pointer-events="none" />
      {/if}
      {#if $hoveredIndex === i}
        <rect x={LEFT_AXIS_WIDTH + i * STEP_WIDTH} y="0" width={STEP_WIDTH} height={svgHeight} fill="#C4956A" opacity="0.06" pointer-events="none" />
      {/if}
    {/each}
  
    <!-- ── Row dividers ───────────────────────────────────────────────────── -->
    {#each INFO_SOURCES as _src, ri}
      <line
        x1={0} y1={TOP_PAD + ri * ROW_STRIDE - CELL_GAP / 2 - 1}
        x2={width} y2={TOP_PAD + ri * ROW_STRIDE - CELL_GAP / 2 - 1}
        stroke="#DFC3A8" stroke-width="0.5" opacity="0.5" pointer-events="none"
      />
    {/each}
    <!-- Bottom divider -->
    <line x1="0" y1={svgHeight - 1} x2={width} y2={svgHeight - 1} stroke="#DFC3A8" stroke-width="0.75" pointer-events="none" />
  
    <!-- ── Vertical column dividers ──────────────────────────────────────── -->
    {#each data as _d, i}
      {@const isActive = $hoveredIndex === i || $selectedIndex === i}
      <line
        x1={LEFT_AXIS_WIDTH + i * STEP_WIDTH} y1="0"
        x2={LEFT_AXIS_WIDTH + i * STEP_WIDTH} y2={svgHeight}
        stroke={isActive ? "#F9564E" : "#DFC3A8"}
        stroke-width={isActive ? 2 : 0.75}
        opacity={isActive ? 0.6 : 1}
        pointer-events="none"
      />
    {/each}
    <line x1={width} y1="0" x2={width} y2={svgHeight} stroke="#DFC3A8" stroke-width="0.75" pointer-events="none" />
  
    <!-- ── Source row labels ─────────────────────────────────────────────── -->
    <rect x="0" y="0" width={LEFT_AXIS_WIDTH} height={svgHeight} fill="#F4EFE5" pointer-events="none" />
    {#each INFO_SOURCES as src, ri}
      <text
        x={LEFT_AXIS_WIDTH - 6}
        y={cellY(ri) + 3.5}
        text-anchor="end"
        class="source-label"
        pointer-events="none"
      >{src.label}</text>
    {/each}
  
    <!-- ── Icons per cell ────────────────────────────────────────────────── -->
    {#each data as d, si}
      {@const stepSources = SOURCE_DATA[d.step_id] ?? {}}
      {#each INFO_SOURCES as src, ri}
        {@const status = stepSources[src.key] ?? 'absent'}
        {@const cx = cellX(si)}
        {@const cy = cellY(ri)}
        {@const hs = CELL_SIZE / 2}  <!-- half size -->
  
        {#if status === 'up'}
          <!-- Upward triangle — teal green, trending up -->
          <polygon
            points="{cx},{cy - hs + 1}  {cx - hs + 1},{cy + hs - 1}  {cx + hs - 1},{cy + hs - 1}"
            fill="#4a9e7f" opacity="0.9"
            pointer-events="none"
          />
        {:else if status === 'down'}
          <!-- Downward triangle — muted amber/orange, trending down -->
          <polygon
            points="{cx},{cy + hs - 1}  {cx - hs + 1},{cy - hs + 1}  {cx + hs - 1},{cy - hs + 1}"
            fill="#c8902a" opacity="0.9"
            pointer-events="none"
          />
        {:else if status === 'steady'}
          <!-- Small square — blue-grey, steady state -->
          <rect
            x={cx - hs + 2} y={cy - hs + 2}
            width={CELL_SIZE - 4} height={CELL_SIZE - 4}
            fill="#3a7fc1" opacity="0.85" rx="1"
            pointer-events="none"
          />
        {/if}
        <!-- 'absent' → render nothing -->
      {/each}
    {/each}
  
    <!-- ── Hit areas ─────────────────────────────────────────────────────── -->
    {#each data as _d, i}
      <rect
        x={LEFT_AXIS_WIDTH + i * STEP_WIDTH} y="0"
        width={STEP_WIDTH} height={svgHeight}
        fill="transparent"
        style="cursor: pointer;"
        on:mouseenter={() => hoveredIndex.set(i)}
        on:mouseleave={() => hoveredIndex.set(-1)}
        on:click={() => selectedIndex.set($selectedIndex === i ? -1 : i)}
      />
    {/each}
  
  </svg>
  
  <!-- ── Legend ─────────────────────────────────────────────────────────── -->
  <div class="legend-row">
    <span class="legend-item">
      <svg width="10" height="10" viewBox="0 0 10 10">
        <polygon points="5,0 0,10 10,10" fill="#4a9e7f" opacity="0.9" />
      </svg>
      Trending up
    </span>
    <span class="legend-item">
      <svg width="10" height="10" viewBox="0 0 10 10">
        <polygon points="5,10 0,0 10,0" fill="#c8902a" opacity="0.9" />
      </svg>
      Trending down
    </span>
    <span class="legend-item">
      <svg width="10" height="10" viewBox="0 0 10 10">
        <rect x="1" y="1" width="8" height="8" fill="#3a7fc1" opacity="0.85" rx="1" />
      </svg>
      Steady state
    </span>
    <span class="legend-item legend-absent">
      <span class="absent-dash">—</span>
      Not yet in use
    </span>
  </div>
  
  <style>
    .section-label {
      color: #8A6A4A;
      font-family: 'DM Sans', sans-serif;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      padding: 4px 12px;
      background: #F4EFE5;
      border-top: 1px solid #DFC3A8;
      border-bottom: 1px solid #DFC3A8;
    }
  
    .info-sources-svg {
      display: block;
      background: #F4EFE5;
    }
  
    .source-label {
      font-family: 'DM Sans', sans-serif;
      font-size: 8px;
      fill: #8A6A4A;
      letter-spacing: 0.01em;
    }
  
    .legend-row {
      display: flex;
      gap: 18px;
      align-items: center;
      padding: 6px 12px 6px calc(v-bind(LEFT_AXIS_WIDTH) * 1px);
      background: #F4EFE5;
      border-bottom: 1px solid #DFC3A8;
      flex-wrap: wrap;
    }
  
    .legend-item {
      display: flex;
      align-items: center;
      gap: 5px;
      font-family: 'DM Sans', sans-serif;
      font-size: 9px;
      color: #8A6A4A;
      letter-spacing: 0.03em;
    }
  
    .legend-absent { color: #BFA080; }
  
    .absent-dash {
      font-size: 13px;
      line-height: 1;
      color: #BFA080;
      display: inline-block;
      width: 10px;
      text-align: center;
    }
  </style>