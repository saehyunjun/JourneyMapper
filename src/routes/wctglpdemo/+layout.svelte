<script lang="ts">
	import WctglpMenubar from "$lib/components/wctglp-menubar.svelte";
	import ToastViewport from "$lib/components/ToastViewport.svelte";
	import GroupStatsDrawer from "$lib/components/GroupStatsDrawer.svelte";
	import * as Breadcrumb from "$lib/components/ui/breadcrumb/index.js";
	import { page } from "$app/state";

	let { children } = $props();

	type Crumb = { label: string; href?: string };

	const crumbs = $derived.by<Crumb[]>(() => {
		const list: Crumb[] = [];
		const data = (page.data ?? {}) as { sectionTitle?: string; title?: string };
		const { folder, subfolder, slug } = page.params;
		const atIndex = page.url.pathname === "/wctglpdemo";

		list.push(atIndex ? { label: "GLP-1 Insights" } : { label: "GLP-1 Insights", href: "/wctglpdemo" });

		if (folder) {
			const isLeaf = !subfolder && !slug;
			const label = data.sectionTitle ?? folder;
			list.push(isLeaf ? { label } : { label, href: `/wctglpdemo/${folder}` });
		}

		if (subfolder) {
			const isLeaf = !slug;
			const label = subfolder;
			list.push(
				isLeaf
					? { label }
					: { label, href: `/wctglpdemo/${folder}/${subfolder}` }
			);
		}

		if (slug) {
			list.push({ label: data.title ?? slug });
		}

		return list;
	});
</script>

<div class="flex min-h-svh flex-col mb-2">

	<div class="flex flex-1 flex-col">
		{@render children()}
	</div>
</div>

<WctglpMenubar />
<GroupStatsDrawer />
<ToastViewport />
