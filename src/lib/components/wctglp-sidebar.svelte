<script lang="ts">
	import * as Sidebar from "$lib/components/ui/sidebar/index.js";
	import type { ComponentProps, Component } from "svelte";
	import { page } from "$app/state";
	import {
		LayoutDashboard,
		ClipboardList,
		MessageSquareQuote,
		Network,
		Upload,
		Fingerprint
	} from "@lucide/svelte";

	let { ref = $bindable(null), ...restProps }: ComponentProps<typeof Sidebar.Root> = $props();

	const path = $derived(page.url.pathname);

	type NavItem = { title: string; url: string; description: string; icon: Component };

	const overview: NavItem = {
		title: "Overview",
		url: "/wctglpdemo",
		description: "GLP-1 Insights Magazine demo home",
		icon: LayoutDashboard
	};

	// The pipeline group mirrors the ordered review stages on the overview page.
	const pipeline: NavItem[] = [
		{
			title: "Upload & review",
			url: "/wctglpdemo/upload",
			description: "Upload a transcript, then review its AI-tagged segments and questions",
			icon: Upload
		},
		{
			title: "Review quote bank",
			url: "/wctglpdemo/analysis",
			description: "Approve or reject AI-proposed quotes; review themes and word counts",
			icon: ClipboardList
		}
	];

	// Read-only views over the reviewed data.
	const explore: NavItem[] = [
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
			title: "Participant fingerprint",
			url: "/wctglpdemo/fingerprint",
			description: "Each interviewee's distinctive theme profile",
			icon: Fingerprint
		}
	];

	function isActive(url: string): boolean {
		return url === "/wctglpdemo"
			? path === url
			: path === url || path.startsWith(url + "/");
	}
</script>

<Sidebar.Root {...restProps} bind:ref collapsible="icon">
	<Sidebar.Header>
		<div
			class="flex flex-row items-center justify-between gap-2 group-data-[collapsible=icon]:justify-center [collapsible=icon]:mx-auto"
		>
			<a
				href="/wctglpdemo"
				class="flex min-w-0 flex-col gap-0.5 leading-none justify-center group-data-[collapsible=icon]:hidden"
			>
				<span class="truncate text-base font-bold uppercase text-accent-foreground">
					GLP-1 Insights
				</span>
				<span class="truncate text-xs text-muted-foreground">
					Interview analysis · Patiently Studio
				</span>
			</a>
			<Sidebar.Trigger class="shrink-0" />
		</div>
	</Sidebar.Header>
	<Sidebar.Content>
		{#snippet navMenu(items: NavItem[])}
			<Sidebar.Menu>
				{#each items as item (item.url)}
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
		{/snippet}

		<Sidebar.Group>
			{@render navMenu([overview])}
		</Sidebar.Group>
		<Sidebar.Group>
			<Sidebar.GroupLabel>Pipeline</Sidebar.GroupLabel>
			{@render navMenu(pipeline)}
		</Sidebar.Group>
		<Sidebar.Group>
			<Sidebar.GroupLabel>Explore</Sidebar.GroupLabel>
			{@render navMenu(explore)}
		</Sidebar.Group>
	</Sidebar.Content>
	<Sidebar.Rail />
</Sidebar.Root>
