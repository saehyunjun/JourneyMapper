<script lang="ts">
	import { page } from '$app/state';
	import WctglpTopbar from '$lib/components/WctglpTopbar.svelte';
	import WctglpSidebar from '$lib/components/WctglpSidebar.svelte';
	import ToastViewport from '$lib/components/ToastViewport.svelte';
	import GroupStatsDrawer from '$lib/components/GroupStatsDrawer.svelte';
	import { groupDrawer } from '$lib/stores/group-drawer.svelte.js';
	import { groupStats } from '$lib/content/wctglpdemo-data/lexicon-stats';
	import type { LayoutData } from './$types';

	let { data, children }: { data: LayoutData; children: import('svelte').Snippet } = $props();

	// Story mode owns its own chrome (StoryFrame) and exit affordance, so the
	// app shell steps out of the way when ?view=story is active.
	const isStory = $derived(page.url.searchParams.get('view') === 'story');

	// Global lexicon stats drawer — fed by the groupDrawer store, which any
	// KeywordText click anywhere in the app fires into. Workbench-specific
	// subtheme stats are computed locally on that page; this layout drawer
	// only handles the wctglpdemo lexicon kinds ('keyword' | 'theme').
	const layoutStats = $derived.by(() => {
		const cur = groupDrawer.current;
		if (!cur || cur.kind === 'subtheme') return null;
		return groupStats(cur.kind, cur.id);
	});
</script>

<div class="flex min-h-svh flex-col bg-(--panel)">
	{#if !isStory}
		<div class="sticky top-0 z-40">
			<WctglpTopbar
				indications={data.slice.indications}
				therapeuticAreas={data.slice.therapeutic_areas}
				activeIndication={data.slice.active_indication}
			/>
		</div>
	{/if}
	<div class="flex flex-1">
		{#if !isStory}
			<WctglpSidebar activeIndication={data.slice.active_indication} />
		{/if}
		<main class="flex min-w-0 flex-1 flex-col bg-(--panel)">
			{@render children()}
		</main>
	</div>
</div>

<GroupStatsDrawer stats={layoutStats} onclose={() => groupDrawer.close()} />
<ToastViewport />
