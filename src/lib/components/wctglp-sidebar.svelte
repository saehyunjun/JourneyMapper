<script lang="ts">
	import * as Sidebar from "$lib/components/ui/sidebar/index.js";
	import type { ComponentProps } from "svelte";
	import { page } from "$app/state";

	let { ref = $bindable(null), ...restProps }: ComponentProps<typeof Sidebar.Root> = $props();

	const path = $derived(page.url.pathname);

	type NavItem = { title: string; url: string; description: string };

	const nav: NavItem[] = [
		{
			title: "Overview",
			url: "/wctglpdemo",
			description: "GLP-1 Insights Magazine demo home"
		},
		{
			title: "Interview analysis",
			url: "/wctglpdemo/analysis",
			description: "Review the quote bank, themes, and word counts"
		},
		{
			title: "What patients said",
			url: "/wctglpdemo/interview-words",
			description: "Sortable word-usage charts"
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
							<div class="flex flex-col gap-0.5 leading-none pb-2 border-b border-primary w-full">
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
			<Sidebar.GroupLabel>WCT GLP-1 demo</Sidebar.GroupLabel>
			<Sidebar.Menu>
				{#each nav as item (item.url)}
					<Sidebar.MenuItem>
						<Sidebar.MenuButton>
							{#snippet child({ props })}
								<a
									href={item.url}
									title={item.description}
									{...props}
									class:active-entry={isActive(item.url)}
								>
									{item.title}
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

<style>
	:global(.active-entry) {
		background-color: var(--lightteal);
	}
	:global(.active-entry:hover) {
		background-color: var(--lightteal);
	}
</style>
