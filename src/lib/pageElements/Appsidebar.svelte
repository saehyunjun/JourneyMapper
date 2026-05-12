<script lang="ts">
  import { onMount } from 'svelte';
  import IconXRegular           from 'phosphor-icons-svelte/IconXRegular.svelte';
  import IconListRegular        from 'phosphor-icons-svelte/IconListRegular.svelte';
  import IconFlaskRegular       from 'phosphor-icons-svelte/IconFlaskRegular.svelte';
  import IconDnaRegular         from 'phosphor-icons-svelte/IconDnaRegular.svelte';
  import IconClockCountdownRegular from 'phosphor-icons-svelte/IconClockCountdownRegular.svelte';
  import IconCaretRightRegular  from 'phosphor-icons-svelte/IconCaretRightRegular.svelte';

  // ── Props ──────────────────────────────────────────────────────────────
  let {
    open = $bindable(true),
  }: { open: boolean } = $props();

  // Track viewport width to decide overlay vs inline mode
  let isNarrow = $state(false);
  function updateWidth() { isNarrow = window.innerWidth < 1000; }

  // ── Nav items ──────────────────────────────────────────────────────────
  type NavItem = {
    id: string;
    label: string;
    file: string;
    Icon: any;
  };

  const navItems: NavItem[] = [
    { id: 'overview',     label: 'Overview',     file: 'overview',     Icon: IconListRegular },
    { id: 'methodology',  label: 'Methodology',  file: 'methodology',  Icon: IconFlaskRegular },
    { id: 'indications',  label: 'Indications',  file: 'indications',  Icon: IconDnaRegular },
    { id: 'changelog',    label: 'Changelog',    file: 'changelog',    Icon: IconClockCountdownRegular },
  ];

  let activeId = $state('overview');
  let html = $state('');
  let loading = $state(false);

  // ── Markdown loader + renderer ─────────────────────────────────────────
  // Lightweight in-app markdown → HTML. Handles: headings, bold, italic,
  // inline code, tables, horizontal rules, unordered lists, ordered lists, paragraphs.
  function parseMarkdown(md: string): string {
    let s = md
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Fenced code blocks (``` ... ```)
    s = s.replace(/```[\w]*\n?([\s\S]*?)```/g, '<pre><code>$1</code></pre>');

    // Tables — detect | header | row |
    s = s.replace(
      /(\|.+\|\n\|[-| :]+\|\n(?:\|.+\|\n?)*)/g,
      (table) => {
        const rows = table.trim().split('\n');
        const header = rows[0];
        const body = rows.slice(2);
        const thCells = header.split('|').filter((c) => c.trim()).map((c) => `<th>${c.trim()}</th>`).join('');
        const bodyRows = body.map((row) => {
          const cells = row.split('|').filter((c) => c.trim()).map((c) => `<td>${c.trim()}</td>`).join('');
          return `<tr>${cells}</tr>`;
        }).join('');
        return `<table><thead><tr>${thCells}</tr></thead><tbody>${bodyRows}</tbody></table>`;
      }
    );

    // HR
    s = s.replace(/^---$/gm, '<hr>');

    // Headings
    s = s.replace(/^#### (.+)$/gm, '<h4>$1</h4>');
    s = s.replace(/^### (.+)$/gm, '<h3>$1</h3>');
    s = s.replace(/^## (.+)$/gm, '<h2>$1</h2>');
    s = s.replace(/^# (.+)$/gm, '<h1>$1</h1>');

    // Unordered lists — group consecutive bullet lines
    s = s.replace(/((?:^- .+\n?)+)/gm, (block) => {
      const items = block.trim().split('\n').map((l) => `<li>${l.replace(/^- /, '')}</li>`).join('');
      return `<ul>${items}</ul>`;
    });

    // Ordered lists
    s = s.replace(/((?:^\d+\. .+\n?)+)/gm, (block) => {
      const items = block.trim().split('\n').map((l) => `<li>${l.replace(/^\d+\. /, '')}</li>`).join('');
      return `<ol>${items}</ol>`;
    });

    // Inline: bold, italic, inline code
    s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/\*(.+?)\*/g, '<em>$1</em>');
    s = s.replace(/`(.+?)`/g, '<code>$1</code>');

    // Paragraphs — wrap consecutive non-tag lines
    s = s.replace(/((?:^(?!<[a-z]).+\n?)+)/gm, (block) => {
      const t = block.trim();
      if (!t) return '';
      return `<p>${t.replace(/\n/g, ' ')}</p>`;
    });

    return s;
  }

  async function loadContent(file: string) {
    loading = true;
    try {
      // SvelteKit: import.meta.glob for static MD files
      const modules = import.meta.glob('/src/lib/content/sidebar/*.md', { as: 'raw' });
      const key = `/src/lib/content/sidebar/${file}.md`;
      if (modules[key]) {
        const raw = await modules[key]() as string;
        html = parseMarkdown(raw);
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
    // On mobile, don't close — user is browsing the sidebar
  }

  onMount(() => {
    updateWidth();
    window.addEventListener('resize', updateWidth);
    loadContent('overview');
    return () => window.removeEventListener('resize', updateWidth);
  });

  // Close sidebar when Escape pressed
  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape' && open) open = false;
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- ── Mobile backdrop (overlay mode only) ──────────────────────────────── -->
{#if open && isNarrow}
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div
    class="sidebar-backdrop"
    onclick={() => (open = false)}
    aria-hidden="true"
  ></div>
{/if}

<!-- ── Sidebar shell ─────────────────────────────────────────────────────── -->
<aside
  class="app-sidebar"
  class:app-sidebar--open={open}
  aria-label="Application sidebar"
>
  <!-- Header -->
  
  <!-- Nav tabs (vertical) -->
  <nav class="sidebar-nav" aria-label="Sidebar navigation">
    {#each navItems as item (item.id)}
      {@const isActive = activeId === item.id}
      <button
        class="sidebar-item"
        class:sidebar-item--active={isActive}
        role="tab"
        aria-selected={isActive}
        onclick={() => selectTab(item.id, item.file)}
      >
        <span class="text-lg pr-4">
          <svelte:component this={item.Icon} />
        </span>
        <span class="label flex-1 text-left">
            {item.label}</span>
        {#if isActive}
          <IconCaretRightRegular 
          class="text-sm" />
        {/if}
      </button>
    {/each}
  </nav>

  <!-- Content area -->
      <!-- eslint-disable-next-line svelte/no-at-html-tags -->
      <div class="sidebar-prose">{@html html}</div>

</aside>

<style>
  /* ── Sidebar shell ─────────────────────────────────────────── */

  /*
   * Wide screens (≥1000px): sidebar is in-flow inside the .app-body flex row.
   * Width animates between 0 and 300px so the main content grows/shrinks.
   * overflow:hidden clips the content while collapsed.
   */
  .app-sidebar {
    position: relative;
    z-index: 1;
    height: 100%;
    flex-shrink: 0;

    /* collapsed */
    width: 0;
    overflow: hidden;

    display: flex;
    flex-direction: column;
    background-color: var(--panel);
    border-right: 1.5px solid var(--panel-dark);

    transition:
      width var(--dur-med) var(--ease-smooth),
      box-shadow var(--dur-med) var(--ease-smooth);
    will-change: width;
  }

  /* Inner container keeps a fixed 300px so content doesn't reflow while animating */
  .app-sidebar > * {
    min-width: 300px;
    max-width: 300px;
  }

  .app-sidebar--open {
    width: 300px;
    box-shadow: 4px 0 24px rgba(0, 0, 0, 0.08);
  }

  /*
   * Narrow screens (<1000px): revert to fixed overlay behaviour.
   * The backdrop is only rendered on narrow screens via JS (see template above).
   */
  @media (max-width: 999px) {
    .app-sidebar {
      position: fixed;
      top: 0;
      left: 0;
      z-index: 400;
      height: 100dvh;
      width: 300px;       /* always 300px wide; transform controls visibility */
      overflow: visible;  /* reset the clip used for width animation */

      transform: translateX(-100%);
      transition: transform var(--dur-med) var(--ease-smooth),
                  box-shadow var(--dur-med) var(--ease-smooth);
      will-change: transform;
    }

    .app-sidebar--open {
      width: 300px;       /* no change — keep override clean */
      transform: translateX(0);
      box-shadow: 4px 0 24px rgba(0, 0, 0, 0.18);
    }

    /* inner content: reset min-width constraint on mobile */
    .app-sidebar > * {
      min-width: unset;
      max-width: unset;
    }
  }

  /* Mobile backdrop — only meaningful on narrow screens */
  .sidebar-backdrop {
    position: fixed;
    inset: 0;
    z-index: 399;
    background: rgba(49, 47, 40, 0.45);
    backdrop-filter: blur(2px);
    animation: fadeIn var(--dur-fast) var(--ease-standard);
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to   { opacity: 1; }
  }


  .sidebar-content {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    scrollbar-width: thin;
    scrollbar-color: var(--panel-mid) transparent;
    padding: 1rem 1rem 1.5rem;
  }

  .sidebar-loading {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2rem;
  }

  /* ── Prose rendering ───────────────────────────────────────── */
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

  .sidebar-prose :global(strong) {
    font-weight: 600;
    color: var(--darkgrayblue);
  }

  .sidebar-prose :global(em) {
    font-style: italic;
    color: var(--grayblue);
  }

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

  .sidebar-prose :global(pre code) {
    background: none;
    padding: 0;
    color: inherit;
  }

  .sidebar-prose :global(ul) {
    list-style: none;
    padding-left: 0;
    margin-bottom: 0.75rem;
  }

  .sidebar-prose :global(ul li) {
    font-size: 0.825em;
    line-height: 1.55;
    color: var(--ink);
    padding-left: 1em;
    position: relative;
    margin-bottom: 0.2rem;
  }

  .sidebar-prose :global(ul li)::before {
    content: '·';
    position: absolute;
    left: 0.25em;
    color: var(--orange);
    font-weight: 700;
  }

  .sidebar-prose :global(ol) {
    padding-left: 1.25em;
    margin-bottom: 0.75rem;
  }

  .sidebar-prose :global(ol li) {
    font-size: 0.825em;
    line-height: 1.55;
    color: var(--ink);
    margin-bottom: 0.2rem;
  }

  .sidebar-prose :global(hr) {
    border: none;
    border-top: 1px solid var(--panel-dark);
    margin: 1rem 0;
  }

  .sidebar-prose :global(table) {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.775em;
    margin-bottom: 0.75rem;
  }

  .sidebar-prose :global(th) {
    font-family: var(--font-mono);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    font-size: 0.9em;
    text-align: left;
    padding: 0.3rem 0.5rem;
    background: var(--panel-dark);
    color: var(--grayblue);
    border-bottom: 1.5px solid var(--panel-mid);
  }

  .sidebar-prose :global(td) {
    padding: 0.3rem 0.5rem;
    border-bottom: 0.5px solid var(--panel-dark);
    color: var(--ink);
    vertical-align: top;
  }

  .sidebar-prose :global(tr:last-child td) {
    border-bottom: none;
  }

  /* ── Footer ────────────────────────────────────────────────── */
  .sidebar-footer {
    flex-shrink: 0;
    border-top: 1px solid var(--panel-dark);
    border-bottom: none;
  }
</style>