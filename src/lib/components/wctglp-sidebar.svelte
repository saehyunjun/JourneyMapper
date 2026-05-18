<script lang="ts">
	import * as Sidebar from "$lib/components/ui/sidebar/index.js";
	import type { ComponentProps, Component } from "svelte";
	import { page } from "$app/state";
	import {
		LayoutDashboard,
		ClipboardList,
		MessageSquareQuote,
		Network,
		Upload
	} from "@lucide/svelte";

	let { ref = $bindable(null), ...restProps }: ComponentProps<typeof Sidebar.Root> = $props();

	const path = $derived(page.url.pathname);

	type NavItem = { title: string; url: string; description: string; icon: Component };

	const nav: NavItem[] = [
		{
			title: "Overview",
			url: "/wctglpdemo",
			description: "GLP-1 Insights Magazine demo home",
			icon: LayoutDashboard
		},
		{
			title: "Interview analysis",
			url: "/wctglpdemo/analysis",
			description: "Review the quote bank, themes, and word counts",
			icon: ClipboardList
		},
		{
			title: "What patients said",
			url: "/wctglpdemo/interview-words",
			description: "Sortable word-usage charts",
			icon: MessageSquareQuote
		},
		{
			title: "Theme radial",
			url: "/wctglpdemo/topic-tree",
			description: "Zoomable radial tree: theme → subtheme → word",
			icon: Network
		},
		{
			title: "Upload transcript",
			url: "/wctglpdemo/upload",
			description: "Add a new interview transcript to the dataset",
			icon: Upload
		}
	];

	function isActive(url: string): boolean {
		return url === "/wctglpdemo"
			? path === url
			: path === url || path.startsWith(url + "/");
	}
</script>

<Sidebar.Root {...restProps} bind:ref>
	<Sidebar.Header>
		<Sidebar.Menu>
			<Sidebar.MenuItem>
				<Sidebar.MenuButton size="lg">
					{#snippet child({ props })}
						<a href="/wctglpdemo" {...props}>
							<div class="flex flex-col gap-0.5 leading-none pb-2 mr-4 border-b border-primary w-full">
								<span class="font-bold text-base uppercase text-accent-foreground">
									GLP-1 Insights
								</span>
								<span class="text-xs text-muted-foreground">
									Interview analysis · Patiently Studio
								</span>
							</div>
						</a>
					{/snippet}
				</Sidebar.MenuButton>
			</Sidebar.MenuItem>
		</Sidebar.Menu>
	</Sidebar.Header>
	<Sidebar.Content>
		<Sidebar.Group>
			<Sidebar.Menu>
				{#each nav as item (item.url)}
					{@const Icon = item.icon}
					<Sidebar.MenuItem>
						<Sidebar.MenuButton tooltipContent={item.description} isActive={isActive(item.url)}>
							{#snippet child({ props })}
								<a href={item.url} {...props}>
									<Icon class="size-4" />
									<span>{item.title}</span>
								</a>
							{/snippet}
						</Sidebar.MenuButton>
					</Sidebar.MenuItem>
				{/each}
			</Sidebar.Menu>
		</Sidebar.Group>
	</Sidebar.Content>
	<Sidebar.Rail />
</Sidebar.Root>
