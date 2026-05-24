<script lang="ts">
	import WctglpTopbar from '$lib/components/WctglpTopbar.svelte';
	import WctglpSidebar from '$lib/components/WctglpSidebar.svelte';
	import ToastViewport from '$lib/components/ToastViewport.svelte';
	import GroupStatsDrawer from '$lib/components/GroupStatsDrawer.svelte';
	import type { LayoutData } from './$types';

	let { data, children }: { data: LayoutData; children: import('svelte').Snippet } = $props();
</script>

<div class="flex min-h-svh flex-col bg-secondary">
	<div class="sticky top-0 z-40">
		<WctglpTopbar
			indications={data.slice.indications}
			therapeuticAreas={data.slice.therapeutic_areas}
			activeIndication={data.slice.active_indication}
		/>
	</div>
	<div class="flex flex-1">
		<WctglpSidebar activeIndication={data.slice.active_indication} />
		<main class="flex min-w-0 flex-1 flex-col">
			{@render children()}
		</main>
	</div>
</div>

<GroupStatsDrawer />
<ToastViewport />
