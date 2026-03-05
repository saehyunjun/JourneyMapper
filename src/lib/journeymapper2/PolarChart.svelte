<script>
    import { onMount } from 'svelte';
    import * as d3 from 'd3';
  
    const groupings = {
      'Patient Daily Life': [
        { category: 'Daily Symptom Management\n& Physical Function', amount: 39 },
        { category: 'Caregiver Experiences\n& Day-to-Day Concerns', amount: 24 },
      ],
      'Emotional & Mental Health': [
        { category: 'Emotional Distress\n(Fear, Anxiety, Grief)', amount: 21 },
      ],
      'Medical Navigation': [
        { category: 'Care Teams /\nProviders Navigation', amount: 21 },
        { category: 'Healthcare System\nNavigation', amount: 19 },
        { category: 'Diagnostic Uncertainty /\nMisdiagnosis Concerns', amount: 16 },
      ],
      'Treatment & Trials': [
        { category: 'Medication Experiences\n(trade-offs, side effects)', amount: 21 },
        { category: 'Clinical Trial\nConsideration / Questions', amount: 17 },
      ],
    };
  
    const GROUP_BASE_COLORS = {
      'Patient Daily Life':        '#2563a8',
      'Emotional & Mental Health': '#d93f41',
      'Medical Navigation':        '#2e8b47',
      'Treatment & Trials':        '#d97b1a',
    };
  
    // Generate N shades light→dark from a base hex
    function generateShades(hex, n) {
      const base = d3.hsl(hex);
      return Array.from({ length: n }, (_, i) => {
        const t = n === 1 ? 0.5 : i / (n - 1);
        return d3.hsl(base.h, base.s * (0.75 + t * 0.25), 0.68 - t * 0.32).formatHex();
      });
    }
  
    // Pre-compute per-category colors (sorted brightest for largest bar)
    const categoryColor = {};
    const groupOrder = Object.keys(groupings);
    groupOrder.forEach((grp) => {
      const items = [...groupings[grp]].sort((a, b) => b.amount - a.amount);
      const shades = generateShades(GROUP_BASE_COLORS[grp], items.length);
      items.forEach((d, i) => {
        categoryColor[d.category] = shades[i];
      });
    });
  
    let activeGroups = Object.fromEntries(groupOrder.map((g) => [g, true]));
    let svgEl;
    let groupEls = {};
    let exporting = null; // 'svg' | 'png' | null
  
    // Inline Google Fonts as base64 so exported files are self-contained
    const FONT_CSS_URL =
      'https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600;700&family=IBM+Plex+Sans:wght@300;400;500;600;700&display=swap';
  
    async function fetchFontDataUri() {
      try {
        // Fetch the CSS to get the @font-face declarations
        const cssRes = await fetch(FONT_CSS_URL);
        let css = await cssRes.text();
  
        // Find all woff2 URLs, fetch them, and replace with data URIs
        const urlMatches = [...css.matchAll(/url\((https:\/\/[^)]+\.woff2[^)]*)\)/g)];
        await Promise.all(
          urlMatches.map(async ([full, url]) => {
            try {
              const res = await fetch(url);
              const buf = await res.arrayBuffer();
              const b64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
               css = css.replace(full, `url(data:font/woff2;base64,${b64})`);
            } catch (_) {}
          })
        );
        return css;
      } catch (_) {
        return '';
      }
    }
  
    function getSvgString(fontCss = '') {
      const clone = svgEl.cloneNode(true);
  
      // Set explicit dimensions from viewBox
      const vb = svgEl.getAttribute('viewBox').split(' ').map(Number);
      clone.setAttribute('width', vb[2]);
      clone.setAttribute('height', vb[3]);
      clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
  
      // Embed background rect
      const bgRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      bgRect.setAttribute('width', vb[2]);
      bgRect.setAttribute('height', vb[3]);
      bgRect.setAttribute('fill', '#f5f3f0');
      clone.insertBefore(bgRect, clone.firstChild);
  
      // Embed font CSS
      if (fontCss) {
        const defs =
          clone.querySelector('defs') ||
          clone.insertBefore(document.createElementNS('http://www.w3.org/2000/svg', 'defs'), clone.firstChild);
        const style = document.createElementNS('http://www.w3.org/2000/svg', 'style');
        style.textContent = fontCss;
        defs.prepend(style);
      }
  
      return new XMLSerializer().serializeToString(clone);
    }
  
    async function exportSVG() {
      exporting = 'svg';
      const fontCss = await fetchFontDataUri();
      const svgStr = getSvgString(fontCss);
      const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'polar-chart.svg';
      a.click();
      URL.revokeObjectURL(url);
      exporting = null;
    }
  
    async function exportPNG() {
      exporting = 'png';
      const fontCss = await fetchFontDataUri();
      const svgStr = getSvgString(fontCss);
      const vb = svgEl.getAttribute('viewBox').split(' ').map(Number);
      const scale = 2; // retina
      const w = vb[2] * scale;
      const h = vb[3] * scale;
  
      const img = new Image();
      const svgBlob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
      const svgUrl = URL.createObjectURL(svgBlob);
  
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.scale(scale, scale);
        ctx.drawImage(img, 0, 0);
        URL.revokeObjectURL(svgUrl);
  
        canvas.toBlob((blob) => {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'polar-chart.png';
          a.click();
          URL.revokeObjectURL(url);
          exporting = null;
        }, 'image/png');
      };
  
      img.onerror = () => {
        URL.revokeObjectURL(svgUrl);
        exporting = null;
      };
  
      img.src = svgUrl;
    }
  
    function toggleGroup(groupLabel) {
      activeGroups[groupLabel] = !activeGroups[groupLabel];
      activeGroups = { ...activeGroups };
      const els = groupEls[groupLabel];
      if (!els) return;
      const v = activeGroups[groupLabel];
      els.arcPath.attr('opacity', v ? 0.6 : 0);
      els.arcTextEl.attr('opacity', v ? 0.9 : 0);
      els.rails.forEach((r) => r.attr('opacity', v ? 0.35 : 0));
      els.dots.forEach((d) => d.attr('opacity', v ? 0.7 : 0));
      els.anchorDot.attr('opacity', v ? 0.85 : 0);
    }
  
    onMount(() => {
      const width = 2080;
      const height = 1800;
      const bg = '#f5f3f0';
      const monoFont = '"IBM Plex Mono", monospace';
      const sansFont = '"IBM Plex Sans", sans-serif';
  
      const outerRadius = 550;
      const innerRadius = 20;
      const labelOffset = 22;
      const arcRadius = outerRadius + 225;
      const startAngle = -(Math.PI / 10);
      const chartOffset = { x: 0, y: 50 };
  
      const polar = (a, r) => [
        Math.cos(a - Math.PI / 2) * r,
        Math.sin(a - Math.PI / 2) * r,
      ];
  
      const curvedRailPath = (a0, a1, r0, r1, rArc) => {
        const p0 = polar(a0, r0);
        const p1 = polar(a0, rArc);
        const p2 = polar(a1, rArc);
        const p3 = polar(a1, r1);
        const largeArc = Math.abs(a1 - a0) > Math.PI ? 1 : 0;
        const sweep = a1 > a0 ? 1 : 0;
        return `M ${p0[0]} ${p0[1]} L ${p1[0]} ${p1[1]} A ${rArc} ${rArc} 0 ${largeArc} ${sweep} ${p2[0]} ${p2[1]} L ${p3[0]} ${p3[1]}`;
      };
  
      const cleanDataSorted = groupOrder.flatMap((key) =>
        [...groupings[key]].sort((a, b) => b.amount - a.amount)
      );
  
      const svg = d3
        .select(svgEl)
        .attr('viewBox', `0 0 ${width} ${height}`)
        .attr('width', '100%')
        .attr('height', '100%')
        .style('font-family', sansFont);
  
      const chart = svg
        .append('g')
        .attr('transform', `translate(${width / 2 + chartOffset.x}, ${height / 2 + chartOffset.y})`);
  
      const angle = d3
        .scaleBand()
        .domain(cleanDataSorted.map((d) => d.category))
        .range([startAngle, startAngle + Math.PI * 2])
        .padding(0.325);
  
      const maxVal = d3.max(cleanDataSorted, (d) => d.amount);
  
      const radiusScale = d3
        .scaleRadial()
        .domain([0, maxVal])
        .range([innerRadius, outerRadius]);
  
      const arc = d3
        .arc()
        .innerRadius(innerRadius)
        .outerRadius((d) => radiusScale(d.amount))
        .startAngle((d) => angle(d.category))
        .endAngle((d) => angle(d.category) + angle.bandwidth());
  
      // Guide circles
      [10, 20, 30, 40].forEach((pct) => {
        if (pct > maxVal) return;
        chart
          .append('circle')
          .attr('r', radiusScale(pct))
          .attr('fill', 'none')
          .attr('stroke', '#c2bdb6')
          .attr('stroke-dasharray', '4,9')
          .attr('stroke-width', 1.5)
          .attr('opacity', 0.45);
  
        chart
          .append('text')
          .attr('x', 4)
          .attr('y', -radiusScale(pct) + 18)
          .attr('font-size', 18)
          .attr('font-family', monoFont)
          .attr('fill', '#aaa49c')
          .attr('text-anchor', 'start')
          .text(`${pct}%`);
      });
  
      // Inner circle
      chart.append('circle').attr('r', innerRadius).attr('fill', bg);
  
      // Bars
      chart
        .append('g')
        .selectAll('path')
        .data(cleanDataSorted)
        .join('path')
        .attr('d', arc)
        .attr('fill', (d) => categoryColor[d.category] || '#888')
        .attr('fill-opacity', 0.9)
  
      // Category labels
      chart
        .append('g')
        .selectAll('text')
        .data(cleanDataSorted)
        .join('text')
        .each(function (d) {
          const midAngle = angle(d.category) + angle.bandwidth() / 2;
          const t = midAngle - Math.PI / 2;
          const r = (t * 180) / Math.PI;
          const flip = t < -Math.PI / 2 || t > Math.PI / 2;
          const anchor = flip ? 'end' : 'start';
          const rLabel = radiusScale(d.amount) + labelOffset;
  
          const el = d3.select(this);
          el.attr('transform', `rotate(${r}) translate(${rLabel},0) rotate(${flip ? 180 : 0})`)
            .attr('text-anchor', anchor)
            .attr('dominant-baseline', 'start')
            .attr('fill', '#3a3632')
            .attr('font-size', 22)
            .attr('font-family', sansFont)
            .attr('font-weight', 400);
  
          const lines = d.category.split('\n');
          lines.forEach((line, i) => {
            const dy =
              lines.length === 1 ? '0em' : i === 0 ? `-${(lines.length - 1) * 0.55}em` : '1.1em';
            el.append('tspan').attr('x', 0).attr('dy', dy).text(line);
          });
  
          el.append('tspan')
            .attr('x', 0)
            .attr('dy', '2.2em')
            .attr('font-weight', '700')
            .attr('font-size', 34)
            .attr('font-family', monoFont)
            .attr('letter-spacing', '-0.5px')
            .attr('fill', categoryColor[d.category] || '#555')
            .text(`${d.amount}%`);
        });
  
      // Group arcs + rails
      const annotationGroup = chart.append('g');
      const railGroup = chart.append('g');
  
      groupOrder.forEach((groupLabel, i) => {
        const groupData = groupings[groupLabel];
        const color = GROUP_BASE_COLORS[groupLabel];
  
        const cats = groupData
          .map((d) => d.category)
          .sort((a, b) => angle(a) - angle(b));
  
        const start = angle(cats[0]) + angle.bandwidth() * 0.05;
        const end = angle(cats[cats.length - 1]) + angle.bandwidth() * 0.95;
        const mid = (start + end) / 2;
        const flip = mid > Math.PI / 2 && mid < (3 * Math.PI) / 2;
  
        const pathId = `group-arc-${i}`;
  
        const arcPath = annotationGroup
          .append('path')
          .attr('id', pathId)
          .attr(
            'd',
            d3
              .arc()
              .innerRadius(arcRadius)
              .outerRadius(arcRadius)
              .startAngle(flip ? end : start)
              .endAngle(flip ? start : end)
          )
          .attr('fill', 'none')
          .attr('stroke', color)
          .attr('stroke-width', 5)
          .attr('opacity', 0.6);
  
        const arcTextEl = annotationGroup
          .append('text')
          .attr('font-size', 26)
          .attr('font-weight', 600)
          .attr('font-family', sansFont)
          .attr('fill', color)
          .attr('opacity', 0.9)
          .attr('dy', '-0.5em');
  
        arcTextEl
          .append('textPath')
          .attr('href', `#${pathId}`)
          .attr('startOffset', '25%')
          .attr('text-anchor', 'middle')
          .text(groupLabel);
  
        const rails = [];
        const dots = [];
  
        groupData.forEach((d) => {
          const a = angle(d.category) + angle.bandwidth() / 2;
          const r0 = radiusScale(d.amount) + labelOffset + 110;
  
          const rail = railGroup
            .append('path')
            .attr('d', curvedRailPath(a, mid, r0, arcRadius - 28, arcRadius - 40 - i * 14))
            .attr('fill', 'none')
            .attr('stroke', color)
            .attr('stroke-width', 2)
            .attr('opacity', 0.35);
          rails.push(rail);
  
          const [cx, cy] = polar(a, r0);
          const dot = railGroup
            .append('circle')
            .attr('cx', cx)
            .attr('cy', cy)
            .attr('r', 6)
            .attr('fill', bg)
            .attr('stroke', color)
            .attr('stroke-width', 2.5)
            .attr('opacity', 0.7);
          dots.push(dot);
        });
  
        const [gx, gy] = polar(mid, arcRadius - 28);
        const anchorDot = railGroup
          .append('circle')
          .attr('cx', gx)
          .attr('cy', gy)
          .attr('r', 8)
          .attr('fill', color)
          .attr('opacity', 0.85);
  
        groupEls[groupLabel] = { arcPath, arcTextEl, rails, dots, anchorDot };
      });
    });
  </script>
  
  <svelte:head>
    <link
      href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600;700&family=IBM+Plex+Sans:wght@300;400;500;600;700&display=swap"
      rel="stylesheet"
    />
  </svelte:head>
  
  <div class="wrapper">
    <div class="controls">
      <span class="controls-label">Groups</span>
      {#each groupOrder as group}
        <button
          class="toggle-btn"
          class:active={activeGroups[group]}
          style="--color: {GROUP_BASE_COLORS[group]}"
          on:click={() => toggleGroup(group)}
        >
          <span class="dot" />
          {group}
        </button>
      {/each}
  
      <div class="controls-divider"></div>
  
      <button class="export-btn" on:click={exportSVG} disabled={!!exporting}>
        {#if exporting === 'svg'}
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
          Exporting…
        {:else}
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          SVG
        {/if}
      </button>
  
      <button class="export-btn" on:click={exportPNG} disabled={!!exporting}>
        {#if exporting === 'png'}
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
          Exporting…
        {:else}
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          PNG
        {/if}
      </button>
    </div>
  
    <svg bind:this={svgEl} class="chart" />
  </div>
  
  <style>
    .wrapper {
      background: #fff;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 24px;
      font-family: 'IBM Plex Sans', sans-serif;
    }
  
    .controls {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 8px;
      padding: 10px 16px;
      background: #fff;
      border-radius: 10px;
      box-shadow: 0 1px 12px rgba(0, 0, 0, 0.07);
      max-width: 780px;
      width: 100%;
    }
  
    .controls-label {
      font-family: 'IBM Plex Mono', monospace;
      font-size: 10px;
      font-weight: 600;
      color: #b0a99e;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      margin-right: 2px;
      flex-shrink: 0;
    }
  
    .toggle-btn {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      padding: 5px 13px 5px 9px;
      border-radius: 6px;
      border: 1.5px solid transparent;
      background: transparent;
      color: #9a9186;
      font-family: 'IBM Plex Sans', sans-serif;
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      transition: color 0.15s, background 0.15s, border-color 0.15s, opacity 0.15s;
    }
  
    .toggle-btn.active {
      background: color-mix(in srgb, var(--color) 9%, white);
      border-color: color-mix(in srgb, var(--color) 55%, transparent);
      color: #2f2d2b;
    }
  
    .toggle-btn:not(.active):hover {
      color: #3a3632;
      border-color: color-mix(in srgb, var(--color) 30%, transparent);
    }
  
    .dot {
      width: 9px;
      height: 9px;
      border-radius: 50%;
      background: var(--color);
      flex-shrink: 0;
      transition: opacity 0.15s;
    }
  
    .toggle-btn:not(.active) .dot {
      opacity: 0.25;
    }
  
    .controls-divider {
      width: 1px;
      height: 20px;
      background: #e0dbd4;
      margin: 0 4px;
      flex-shrink: 0;
    }
  
    .export-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 5px 12px;
      border-radius: 6px;
      border: 1.5px solid #d4cec7;
      background: #fff;
      color: #5a5550;
      font-family: 'IBM Plex Mono', monospace;
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.03em;
      cursor: pointer;
      transition: border-color 0.15s, background 0.15s, color 0.15s;
    }
  
    .export-btn:hover:not(:disabled) {
      border-color: #9a9186;
      background: #f5f3f0;
      color: #2f2d2b;
    }
  
    .export-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  
    .chart {
      width: 100%;
      max-width: 780px;
      border-radius: 16px;
      box-shadow: 0 4px 28px rgba(0, 0, 0, 0.07);
      background: #fff;
    }
  </style>