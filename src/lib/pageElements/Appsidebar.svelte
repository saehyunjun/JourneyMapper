<script lang="ts">
    import { onMount } from 'svelte';
    import IconListRegular                from 'phosphor-icons-svelte/IconListRegular.svelte';
    import IconFlaskRegular               from 'phosphor-icons-svelte/IconFlaskRegular.svelte';
    import IconDnaRegular                 from 'phosphor-icons-svelte/IconDnaRegular.svelte';
    import IconFileMagnifyingGlassDuotone from 'phosphor-icons-svelte/IconFileMagnifyingGlassDuotone.svelte';
    import IconCaretRightRegular          from 'phosphor-icons-svelte/IconCaretRightRegular.svelte';
    import IconSidebarSimpleRegular       from 'phosphor-icons-svelte/IconSidebarSimpleRegular.svelte';
  
    let {
      open = $bindable(true),
    }: { open: boolean } = $props();
  
    let isNarrow = $state(false);
    function updateWidth() { isNarrow = window.innerWidth < 1000; }
  
    type NavItem = { id: string; label: string; file: string; Icon: any; };
  
    const navItems: NavItem[] = [
        { id: 'overview',    label: 'Overview',     file: 'overview',    Icon: IconListRegular },
        { id: 'casestudies', label: 'Case Studies', file: 'casestudies', Icon: IconFileMagnifyingGlassDuotone },
      { id: 'methodology', label: 'Methodology',  file: 'methodology', Icon: IconFlaskRegular },
      { id: 'indications', label: 'Indications',  file: 'indications', Icon: IconDnaRegular },
    ];
  
    let activeId = $state('overview');
    let html = $state('');
    let loading = $state(false);
  
    function parseMarkdown(md: string): string {
      let s = md.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      s = s.replace(/```[\w]*\n?([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
      s = s.replace(/(\|.+\|\n\|[-| :]+\|\n(?:\|.+\|\n?)*)/g, (table) => {
        const rows = table.trim().split('\n');
        const thCells = rows[0].split('|').filter(c => c.trim()).map(c => `<th>${c.trim()}</th>`).join('');
        const bodyRows = rows.slice(2).map(row => {
          const cells = row.split('|').filter(c => c.trim()).map(c => `<td>${c.trim()}</td>`).join('');
          return `<tr>${cells}</tr>`;
        }).join('');
        return `<table><thead><tr>${thCells}</tr></thead><tbody>${bodyRows}</tbody></table>`;
      });
      s = s.replace(/^---$/gm, '<hr>');
      s = s.replace(/^#### (.+)$/gm, '<h4>$1</h4>');
      s = s.replace(/^### (.+)$/gm, '<h3>$1</h3>');
      s = s.replace(/^## (.+)$/gm, '<h2>$1</h2>');
      s = s.replace(/^# (.+)$/gm, '<h1>$1</h1>');
      s = s.replace(/((?:^- .+\n?)+)/gm, block => {
        const items = block.trim().split('\n').map(l => `<li>${l.replace(/^- /, '')}</li>`).join('');
        return `<ul>${items}</ul>`;
      });
      s = s.replace(/((?:^\d+\. .+\n?)+)/gm, block => {
        const items = block.trim().split('\n').map(l => `<li>${l.replace(/^\d+\. /, '')}</li>`).join('');
        return `<ol>${items}</ol>`;
      });
      s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
      s = s.replace(/\*(.+?)\*/g, '<em>$1</em>');
      s = s.replace(/`(.+?)`/g, '<code>$1</code>');
      s = s.replace(/((?:^(?!<[a-z]).+\n?)+)/gm, block => {
        const t = block.trim();
        return t ? `<p>${t.replace(/\n/g, ' ')}</p>` : '';
      });
      return s;
    }
  
    async function loadContent(file: string) {
      loading = true;
      try {
        const modules = import.meta.glob('/src/lib/content/sidebar/*.md', { as: 'raw' });
        const key = `/src/lib/content/sidebar/${file}.md`;
        if (modules[key]) {
          html = parseMarkdown(await modules[key]() as string);
        } else {
          html = '<p class="cite">Content not found.</p>';
        }
      } catch {
        html = '<p class="cite">Unable to load content.</p>';
      }
      loading = false;
    }
  
    function selectTab(id: string, file: string) {
      activeId = id;
      loadContent(file);
      // On mobile, open stays true; user navigates within sidebar
    }
  
    onMount(() => {
      updateWidth();
      window.addEventListener('resize', updateWidth);
      loadContent('overview');
      return () => window.removeEventListener('resize', updateWidth);
    });
  
    function handleKeydown(e: KeyboardEvent) {
      if (e.key === 'Escape' && open) open = false;
    }
  </script>
  
  <svelte:window onkeydown={handleKeydown} />
  
  {#if open && isNarrow}
    <!-- svelte-ignore a11y-no-static-element-interactions -->
    <div class="sidebar-backdrop" onclick={() => (open = false)} aria-hidden="true"></div>
  {/if}
  
  <aside class="app-sidebar" class:app-sidebar--open={open} aria-label="Application sidebar">
  
    <nav class="sidebar-nav" aria-label="Sidebar navigation">
  
      <!-- Toggle button -->
      <button
        class="sidebar-item sidebar-item--toggle"
        onclick={() => (open = !open)}
        aria-label={open ? 'Collapse sidebar' : 'Expand sidebar'}
        aria-expanded={open}
        title={open ? 'Collapse sidebar' : 'Expand sidebar'}
      >
        <span class="sidebar-icon"><IconSidebarSimpleRegular /></span>
        <span class="sidebar-label">Collapse</span>
      </button>
  
      <div class="sidebar-divider"></div>
  
      <!-- Content tabs -->
      {#each navItems as item (item.id)}
        {@const isActive = activeId === item.id}
        <button
          class="sidebar-item"
          class:sidebar-item--active={isActive}
          role="tab"
          aria-selected={isActive}
          onclick={() => selectTab(item.id, item.file)}
          title={item.label}
        >
          <span class="sidebar-icon"><svelte:component this={item.Icon} /></span>
          <span class="sidebar-label">{item.label}</span>
          {#if isActive}
            <span class="sidebar-caret"><IconCaretRightRegular /></span>
          {/if}
        </button>
      {/each}
  
    </nav>
  
    <!-- Content panel — hidden when collapsed -->
    <div class="sidebar-content" aria-live="polite" aria-busy={loading}>

    </div>
  
  </aside>
  
  <style>
    /* ── Tokens ────────────────────────────────────────────────── */
    :root {
      --sidebar-rail: 44px;
      --sidebar-full: 245px;
    }
  
    /* ── Shell: wide screens ≥1000px ───────────────────────────── */
    /* Collapsed = icon rail. Open = full panel. Width-animated.   */
    .app-sidebar {
      position: relative;
      z-index: 1;
      height: 100%;
      flex-shrink: 0;
      overflow: hidden;
  
      /* collapsed default */
      width: var(--sidebar-rail);
  
      display: flex;
      flex-direction: column;
      background-color: var(--panel);
      border-right: 1.5px solid var(--panel-dark);
  
      transition:
        width var(--dur-med) var(--ease-smooth),
        box-shadow var(--dur-med) var(--ease-smooth);
      will-change: width;
    }
  
    /* Children stay at full width so content clips, not reflows */
    .app-sidebar > * {
      min-width: var(--sidebar-full);
      max-width: var(--sidebar-full);
    }
  
    .app-sidebar--open {
      width: var(--sidebar-full);
    }
  
    /* ── Shell: narrow screens <1000px ─────────────────────────── */
    /* Full-width overlay; transform-animated. No rail state.      */
    @media (max-width: 999px) {
      .app-sidebar {
        position: fixed;
        top: 0; left: 0;
        z-index: 400;
        height: 100dvh;
        /* always full width so transform slides cleanly */
        width: var(--sidebar-full);
        overflow: visible;
        transform: translateX(-100%);
        transition:
          transform var(--dur-med) var(--ease-smooth),
          box-shadow var(--dur-med) var(--ease-smooth);
      }
  
      .app-sidebar--open {
        transform: translateX(0);
        box-shadow: 4px 0 24px rgba(0, 0, 0, 0.18);
      }
  
      .app-sidebar > * {
        min-width: unset;
        max-width: unset;
      }
    }
  
    /* ── Backdrop ──────────────────────────────────────────────── */
    .sidebar-backdrop {
      position: fixed;
      animation: fadeIn var(--dur-fast) var(--ease-standard);
    }
  
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
  

    /* ── Content area: fades out when collapsed ────────────────── */
    .sidebar-content {
      flex: 1;
      overflow-y: auto;
      overflow-x: hidden;
      scrollbar-width: thin;
      scrollbar-color: var(--panel-mid) trans
      parent;
      padding: 1rem 1rem 1.5rem;
      opacity: 1;
      transition: opacity var(--dur-fast) var(--ease-standard);
    }
  
    :global(.app-sidebar:not(.app-sidebar--open)) .sidebar-content {
      opacity: 0;
      pointer-events: none;
    }
  
    .sidebar-loading {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 2rem;
    }
  
    /* ── Prose ─────────────────────────────────────────────────── */
    .sidebar-prose :global(h1) {
      font-family: var(--font-heading);
      font-size: 1em;
      font-weight: 800;
      color: var(--darkgrayblue);
      letter-spacing: 0.04em;
      text-transform: uppercase;
      margin-bottom: 0.75rem;
      padding-bottom: 0.4rem;
      border-bottom: 1.5px solid var(--panel-dark);
    }
  
    .sidebar-prose :global(h2) {
      font-family: var(--font-heading);
      font-size: 0.825em;
      font-weight: 700;
      color: var(--grayblue);
      letter-spacing: 0.05em;
      text-transform: uppercase;
      margin-top: 1.25rem;
      margin-bottom: 0.4rem;
    }
  
    .sidebar-prose :global(h3) {
      font-family: var(--font-heading);
      font-size: 0.775em;
      font-weight: 600;
      color: var(--ink);
      margin-top: 1rem;
      margin-bottom: 0.3rem;
    }
  
    .sidebar-prose :global(h4) {
      font-family: var(--font-mono);
      font-size: 0.725em;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--gray);
      margin-top: 0.75rem;
      margin-bottom: 0.25rem;
    }
  
    .sidebar-prose :global(p) {
      font-size: 0.825em;
      line-height: 1.6;
      color: var(--ink);
      margin-bottom: 0.6rem;
    }
  
    .sidebar-prose :global(strong) { font-weight: 600; color: var(--darkgrayblue); }
    .sidebar-prose :global(em) { font-style: italic; color: var(--grayblue); }
  
    .sidebar-prose :global(code) {
      font-family: var(--font-mono);
      font-size: 0.8em;
      background: var(--panel-dark);
      padding: 0.1em 0.3em;
      border-radius: 3px;
      color: var(--orange);
    }
  
    .sidebar-prose :global(pre) {
      background: var(--darkgrayblue);
      color: var(--paper);
      font-family: var(--font-mono);
      font-size: 0.775em;
      padding: 0.75rem 1rem;
      border-radius: 0.35rem;
      overflow-x: auto;
      margin-bottom: 0.75rem;
    }
  
    .sidebar-prose :global(pre code) { background: none; padding: 0; color: inherit; }
  
    .sidebar-prose :global(ul) { list-style: none; padding-left: 0; margin-bottom: 0.75rem; }
    .sidebar-prose :global(ul li) {
      font-size: 0.825em; line-height: 1.55; color: var(--ink);
      padding-left: 1em; position: relative; margin-bottom: 0.2rem;
    }
    .sidebar-prose :global(ul li)::before {
      content: '·'; position: absolute; left: 0.25em;
      color: var(--orange); font-weight: 700;
    }
  
    .sidebar-prose :global(ol) { padding-left: 1.25em; margin-bottom: 0.75rem; }
    .sidebar-prose :global(ol li) {
      font-size: 0.825em; line-height: 1.55; color: var(--ink); margin-bottom: 0.2rem;
    }
  
    .sidebar-prose :global(hr) {
      border: none; border-top: 1px solid var(--panel-dark); margin: 1rem 0;
    }
  
    .sidebar-prose :global(table) {
      width: 100%; border-collapse: collapse; font-size: 0.775em; margin-bottom: 0.75rem;
    }
    .sidebar-prose :global(th) {
      font-family: var(--font-mono); font-weight: 600; text-transform: uppercase;
      letter-spacing: 0.06em; font-size: 0.9em; text-align: left;
      padding: 0.3rem 0.5rem; background: var(--panel-dark); color: var(--grayblue);
      border-bottom: 1.5px solid var(--panel-mid);
    }
    .sidebar-prose :global(td) {
      padding: 0.3rem 0.5rem; border-bottom: 0.5px solid var(--panel-dark);
      color: var(--ink); vertical-align: top;
    }
    .sidebar-prose :global(tr:last-child td) { border-bottom: none; }
  </style>