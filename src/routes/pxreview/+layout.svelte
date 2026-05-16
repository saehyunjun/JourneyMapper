<script lang="ts">
	import AppSidebar from "$lib/components/app-sidebar.svelte";
	import * as Breadcrumb from "$lib/components/ui/breadcrumb/index.js";
	import { Separator } from "$lib/components/ui/separator/index.js";
	import * as Sidebar from "$lib/components/ui/sidebar/index.js";
	import { sidebarState } from "$lib/sidebar-state.svelte.js";
	import { page } from "$app/state";

	let { children } = $props();

	type Crumb = { label: string; href?: string };

	const crumbs = $derived.by<Crumb[]>(() => {
		const list: Crumb[] = [];
		const data = (page.data ?? {}) as { sectionTitle?: string; title?: string };
		const { folder, subfolder, slug } = page.params;
		const atIndex = page.url.pathname === "/pxreview";

		list.push(atIndex ? { label: "PX Review" } : { label: "PX Review", href: "/pxreview" });

		if (folder) {
			const isLeaf = !subfolder && !slug;
			const label = data.sectionTitle ?? folder;
			list.push(isLeaf ? { label } : { label, href: `/pxreview/${folder}` });
		}

		if (subfolder) {
			const isLeaf = !slug;
			const label = subfolder;
			list.push(
				isLeaf
					? { label }
					: { label, href: `/pxreview/${folder}/${subfolder}` }
			);
		}

		if (slug) {
			list.push({ label: data.title ?? slug });
		}

		return list;
	});
</script>

<Sidebar.Provider bind:open={() => sidebarState.open, (v) => (sidebarState.open = v)}>
	<AppSidebar />
	<Sidebar.Inset>
		<header class="flex h-fit py-1 shrink-0 items-center gap-2 border-b sticky top-0 z-99 bg-accent w-full">
			<div class="flex items-center gap-2 px-3">
				<Sidebar.Trigger />
				<Separator orientation="vertical" class="me-2 h-4" />
				<Breadcrumb.Root>
					<Breadcrumb.List>
						{#each crumbs as crumb, i (i)}
							<Breadcrumb.Item class={i < crumbs.length - 1 ? "hidden md:block" : ""}>
								{#if crumb.href}
									<Breadcrumb.Link href={crumb.href}>{crumb.label}</Breadcrumb.Link>
								{:else}
									<Breadcrumb.Page>{crumb.label}</Breadcrumb.Page>
								{/if}
							</Breadcrumb.Item>
							{#if i < crumbs.length - 1}
								<Breadcrumb.Separator class="hidden md:block" />
							{/if}
						{/each}
					</Breadcrumb.List>
				</Breadcrumb.Root>
			</div>
		</header>
		{@render children()}
	</Sidebar.Inset>
</Sidebar.Provider>

<div class="footer h-64 bg-accent-mint-background">

</div>