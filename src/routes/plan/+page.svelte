<!--
	Internal planning hub. Two docs surfaced via tabs:
	  - WORKBENCH_PLAN.md  — sequential project planning for the journey-
	    workbench / map / synthesis pipeline
	  - feature_backlog.md — issue/feature-shaped tracking + product positioning

	Both are read from the project root at request time so the page always
	reflects what's on disk; no rebuild needed.
-->
<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';

	let { data } = $props();

	const docIds = $derived(Object.keys(data.docs));

	function activeId(): string {
		const param = page.url.searchParams.get('tab');
		if (param && data.docs[param]) return param;
		return docIds[0] ?? 'workbench';
	}

	const active = $derived(activeId());
	const activeDoc = $derived(data.docs[active]);

	function selectTab(id: string) {
		const url = new URL(page.url);
		url.searchParams.set('tab', id);
		goto(url, { replaceState: true, noScroll: true, keepFocus: true });
	}
</script>

<svelte:head>
	<title>Plan · PatientlyIQ</title>
</svelte:head>

<div class="page">
	<header class="page-header">
		<span class="eyebrow">Internal · Planning</span>
		<h1>Plan</h1>
		<p class="subtitle">
			Two planning docs, both source-of-truth from the project root.
			<strong>Workbench plan</strong> tracks the sequential build of the
			journey-workbench, journey-map artifact, and fragment-corpus pipeline.
			<strong>Feature backlog</strong> tracks discrete product capabilities and
			the positioning use cases they serve.
		</p>

		<nav class="tab-row" aria-label="Plan documents">
			{#each docIds as id (id)}
				<button
					type="button"
					class="tab"
					data-active={active === id}
					aria-pressed={active === id}
					onclick={() => selectTab(id)}
				>
					{data.docs[id].label}
				</button>
			{/each}
		</nav>
	</header>

	<article class="prose">
		{@html activeDoc.html}
	</article>
</div>

<style>
	.page {
		min-height: 100svh;
		background: var(--panel);
		color: var(--ink);
		font-family: var(--font-body);
	}

	.page-header {
		max-width: 56rem;
		margin: 0 auto;
		padding: 3rem 2rem 1.5rem;
		border-bottom: 1px solid color-mix(in oklab, var(--ink) 12%, transparent);
	}

	.eyebrow {
		font-family: var(--font-mono);
		font-size: 0.7rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: color-mix(in oklab, var(--ink) 60%, transparent);
	}

	.page-header h1 {
		margin: 0.4rem 0 0;
		font-family: var(--font-heading);
		font-weight: 300;
		text-transform: uppercase;
		font-size: clamp(1.75rem, 3vw, 2.5rem);
		letter-spacing: 0.02em;
	}

	.subtitle {
		margin: 0.75rem 0 0;
		max-width: 48rem;
		font-size: 0.95rem;
		line-height: 1.55;
		color: color-mix(in oklab, var(--ink) 75%, transparent);
	}

	.subtitle code {
		font-family: var(--font-mono);
		font-size: 0.85em;
		background: color-mix(in oklab, var(--ink) 8%, transparent);
		padding: 0.05em 0.35em;
	}

	.subtitle strong {
		font-weight: 600;
		color: var(--ink);
	}

	.tab-row {
		display: flex;
		gap: 0.25rem;
		margin: 1.5rem 0 -1px;
		flex-wrap: wrap;
	}

	.tab {
		font-family: var(--font-mono);
		font-size: 0.72rem;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		font-weight: 500;
		color: color-mix(in oklab, var(--ink) 55%, transparent);
		background: transparent;
		border: 1px solid transparent;
		border-bottom: none;
		padding: 0.55rem 0.95rem;
		cursor: pointer;
		transition: color 0.14s ease, background-color 0.14s ease, border-color 0.14s ease;
	}

	.tab:hover {
		color: var(--ink);
	}

	.tab[data-active='true'] {
		color: var(--ink);
		background: var(--paper);
		border-color: color-mix(in oklab, var(--ink) 18%, transparent);
		position: relative;
	}

	.tab[data-active='true']::after {
		content: '';
		position: absolute;
		left: 0;
		right: 0;
		bottom: -1px;
		height: 1px;
		background: var(--paper);
	}

	.prose {
		max-width: 56rem;
		margin: 0 auto;
		padding: 2rem 2rem 6rem;
		font-size: 0.95rem;
		line-height: 1.65;
	}

	.prose :global(h1) {
		display: none;
	}

	.prose :global(h2) {
		font-family: var(--font-heading);
		font-weight: 400;
		text-transform: uppercase;
		letter-spacing: 0.02em;
		font-size: 1.5rem;
		margin: 3rem 0 1rem;
		padding-bottom: 0.5rem;
		border-bottom: 1px solid color-mix(in oklab, var(--ink) 12%, transparent);
	}

	.prose :global(h3) {
		font-family: var(--font-heading);
		font-weight: 500;
		font-size: 1.15rem;
		margin: 2rem 0 0.5rem;
	}

	.prose :global(h4) {
		font-family: var(--font-heading);
		font-weight: 500;
		font-size: 1rem;
		margin: 1.5rem 0 0.5rem;
		color: color-mix(in oklab, var(--ink) 80%, transparent);
	}

	.prose :global(p) {
		margin: 0.75rem 0;
	}

	.prose :global(ul),
	.prose :global(ol) {
		margin: 0.5rem 0 1rem;
		padding-left: 1.5rem;
	}

	.prose :global(li) {
		margin: 0.25rem 0;
	}

	.prose :global(li > p) {
		margin: 0.25rem 0;
	}

	.prose :global(a) {
		color: var(--ink);
		text-decoration: underline;
		text-decoration-color: color-mix(in oklab, var(--ink) 35%, transparent);
		text-underline-offset: 0.15em;
	}

	.prose :global(a:hover) {
		text-decoration-color: var(--ink);
	}

	.prose :global(strong) {
		font-weight: 600;
	}

	.prose :global(code) {
		font-family: var(--font-mono);
		font-size: 0.85em;
		background: color-mix(in oklab, var(--ink) 8%, transparent);
		padding: 0.1em 0.35em;
		word-break: break-word;
	}

	.prose :global(pre) {
		font-family: var(--font-mono);
		font-size: 0.85em;
		background: var(--paper);
		border: 1px solid color-mix(in oklab, var(--ink) 12%, transparent);
		padding: 0.9rem 1rem;
		overflow-x: auto;
		margin: 1rem 0;
	}

	.prose :global(pre code) {
		background: transparent;
		padding: 0;
	}

	.prose :global(blockquote) {
		margin: 1rem 0;
		padding: 0.5rem 1rem;
		border-left: 3px solid color-mix(in oklab, var(--ink) 25%, transparent);
		background: color-mix(in oklab, var(--ink) 4%, transparent);
		color: color-mix(in oklab, var(--ink) 80%, transparent);
		font-size: 0.92em;
	}

	.prose :global(blockquote > p) {
		margin: 0.25rem 0;
	}

	.prose :global(hr) {
		border: none;
		border-top: 1px solid color-mix(in oklab, var(--ink) 15%, transparent);
		margin: 2.5rem 0;
	}

	.prose :global(table) {
		width: 100%;
		border-collapse: collapse;
		margin: 1rem 0;
		font-size: 0.88rem;
	}

	.prose :global(th),
	.prose :global(td) {
		text-align: left;
		padding: 0.5rem 0.7rem;
		border-bottom: 1px solid color-mix(in oklab, var(--ink) 12%, transparent);
		vertical-align: top;
	}

	.prose :global(th) {
		font-family: var(--font-mono);
		font-size: 0.72rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: color-mix(in oklab, var(--ink) 65%, transparent);
		font-weight: 500;
		border-bottom: 1px solid color-mix(in oklab, var(--ink) 25%, transparent);
	}

	.prose :global(input[type='checkbox']) {
		margin-right: 0.4rem;
		accent-color: var(--ink);
	}

	.prose :global(li:has(> input[type='checkbox'])) {
		list-style: none;
		margin-left: -1.25rem;
	}
</style>
