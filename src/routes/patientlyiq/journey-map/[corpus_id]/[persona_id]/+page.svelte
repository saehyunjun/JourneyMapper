<!--
	Journey-map artifact render.

	Three interchangeable surfaces over the same artifact:
	- "Sidebar" — the vertical pills-per-step layout
	- "Table"   — an expandable initiatives-style table
	- "Explore" — quadrant-based map with persona route + segment primitives

	View is controlled by `?view=table` / `?view=explore` so it's linkable.
-->
<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { Columns3, Map, Rows3 } from '@lucide/svelte';
	import JourneyMapView from '$lib/components/journey-map/JourneyMapView.svelte';
	import JourneyMapTableView from '$lib/components/journey-map/JourneyMapTableView.svelte';
	import JourneyExploreView from '$lib/components/journey-map/JourneyExploreView.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	type View = 'sidebar' | 'table' | 'explore';

	const view: View = $derived.by(() => {
		const v = page.url.searchParams.get('view');
		if (v === 'table') return 'table';
		if (v === 'explore') return 'explore';
		return 'sidebar';
	});

	function setView(next: View) {
		const url = new URL(page.url);
		if (next === 'sidebar') url.searchParams.delete('view');
		else url.searchParams.set('view', next);
		goto(url.pathname + url.search, { replaceState: true, noScroll: true, keepFocus: true });
	}
</script>

<svelte:head>
	<title>{data.artifact.meta.persona_label} — journey map</title>
</svelte:head>

<div class="view-toggle-bar">
	<div class="view-toggle">
		<button
			type="button"
			class="view-btn"
			class:view-btn-active={view === 'sidebar'}
			onclick={() => setView('sidebar')}
			aria-pressed={view === 'sidebar'}
		>
			<Columns3 size={14} strokeWidth={1.8} />
			<span>Sidebar</span>
		</button>
		<button
			type="button"
			class="view-btn"
			class:view-btn-active={view === 'table'}
			onclick={() => setView('table')}
			aria-pressed={view === 'table'}
		>
			<Rows3 size={14} strokeWidth={1.8} />
			<span>Table</span>
		</button>
		<button
			type="button"
			class="view-btn"
			class:view-btn-active={view === 'explore'}
			onclick={() => setView('explore')}
			aria-pressed={view === 'explore'}
		>
			<Map size={14} strokeWidth={1.8} />
			<span>Explore</span>
		</button>
	</div>
</div>

{#if view === 'table'}
	<JourneyMapTableView
		artifact={data.artifact}
		fragmentsById={data.fragmentsById}
		journey={data.journey}
		profiles={data.profiles}
	/>
{:else if view === 'explore'}
	<JourneyExploreView
		artifact={data.artifact}
		fragmentsById={data.fragmentsById}
		journey={data.journey}
		profiles={data.profiles}
	/>
{:else}
	<JourneyMapView
		artifact={data.artifact}
		fragmentsById={data.fragmentsById}
		journey={data.journey}
		profiles={data.profiles}
	/>
{/if}

<style>
	.view-toggle-bar {
		max-width: 1480px;
		margin: 1.25rem auto 0;
		padding: 0 1.75rem;
		display: flex;
		justify-content: flex-end;
	}
	.view-toggle {
		display: inline-flex;
		border: 1px solid #d9dacf;
		background: #fff;
	}
	.view-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		background: transparent;
		border: none;
		padding: 0.45rem 0.8rem;
		font-family: var(--font-body);
		font-size: 0.82rem;
		font-weight: 500;
		color: var(--gray);
		cursor: pointer;
		transition: background-color 0.16s ease, color 0.16s ease;
	}
	.view-btn + .view-btn {
		border-left: 1px solid #d9dacf;
	}
	.view-btn:hover {
		background: var(--panel);
		color: var(--darkgrayblue);
	}
	.view-btn-active {
		background: var(--darkgrayblue);
		color: #fff;
	}
	.view-btn-active:hover {
		background: var(--darkgrayblue);
		color: #fff;
	}
</style>
