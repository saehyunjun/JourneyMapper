<script lang="ts">
	import AppSidebar from "$lib/components/app-sidebar.svelte";
	import * as Breadcrumb from "$lib/components/ui/breadcrumb/index.js";
	import { Separator } from "$lib/components/ui/separator/index.js";
	import * as Sidebar from "$lib/components/ui/sidebar/index.js";
	import * as Tabs from "$lib/components/ui/tabs/index.js";
	import { findSection, getSectionTags } from "$lib/content";
	import { sidebarState } from "$lib/sidebar-state.svelte.js";
	import { page } from "$app/state";
	import { goto } from "$app/navigation";

	let { data } = $props();

	const ALL = "all";
	const section = $derived(findSection(data.folder));
	const allTags = $derived(getSectionTags(data.folder));
	const activeTag = $derived(page.url.searchParams.get("tag") ?? "");
	const tabValue = $derived(activeTag === "" ? ALL : activeTag);
	const visibleEntries = $derived(
		section
			? activeTag
				? section.entries.filter((e) => e.tags.includes(activeTag))
				: section.entries
			: []
	);

	function onTagChange(value: string) {
		if (value === tabValue) return;
		const url = new URL(page.url);
		if (value === ALL) url.searchParams.delete("tag");
		else url.searchParams.set("tag", value);
		goto(`${url.pathname}${url.search}`, { replaceState: true, noScroll: true, keepFocus: true });
	}
</script>

<Sidebar.Provider bind:open={() => sidebarState.open, (v) => (sidebarState.open = v)}>
	<AppSidebar />
	<Sidebar.Inset>
		<header class="flex h-16 shrink-0 items-center gap-2 border-b">
			<div class="flex items-center gap-2 px-3">
				<Sidebar.Trigger />
				<Separator orientation="vertical" class="me-2 h-4" />
				<Breadcrumb.Root>
					<Breadcrumb.List>
						<Breadcrumb.Item class="hidden md:block">
							<Breadcrumb.Link href="/pxreview">
								PX Review</Breadcrumb.Link>
						</Breadcrumb.Item>
						<Breadcrumb.Separator class="hidden md:block" />
						<Breadcrumb.Item>
							<Breadcrumb.Page>{data.sectionTitle}</Breadcrumb.Page>
						</Breadcrumb.Item>
					</Breadcrumb.List>
				</Breadcrumb.Root>
			</div>
		</header>
		<div class="flex flex-1 flex-col gap-6 p-6">
			{#if section}
				<div>
					<h1 class="text-2xl font-semibold">
						{section.title}</h1>
					{#if section.description}
						<p class="text-muted-foreground mt-1 max-w-2xl">{section.description}</p>
					{/if}
					<p class="text-muted-foreground mt-1 text-sm">
						{visibleEntries.length}
						{visibleEntries.length === 1 ? "entry" : "entries"}
						{#if activeTag}
							· filtered by <span class="font-medium">{activeTag}</span>
						{/if}
					</p>
				</div>

				{#if allTags.length}
					<Tabs.Root value={tabValue} onValueChange={onTagChange}>
						<Tabs.List class="flex-wrap">
							<Tabs.Trigger value={ALL}>All</Tabs.Trigger>
							{#each allTags as tag (tag)}
								<Tabs.Trigger value={tag}>{tag}</Tabs.Trigger>
							{/each}
						</Tabs.List>
					</Tabs.Root>
				{/if}

				<div class="grid auto-rows-min gap-4 md:grid-cols-2 lg:grid-cols-3">
					{#each visibleEntries as entry (entry.url)}
						<a
							href={entry.url}
							class="bg-muted/50 hover:bg-muted p-4 transition-colors"
						>
							<h2 class="font-medium">
								{entry.title}</h2>
							{#if entry.summary}
								<p class="text-muted-foreground mt-1 text-sm">{entry.summary}</p>
							{/if}
							{#if entry.tags.length}
								<ul class="mt-3 flex flex-wrap gap-1 list-none p-0">
									{#each entry.tags as tag (tag)}
										<li class="bg-background text-muted-foreground inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide">
											{tag}
										</li>
									{/each}
								</ul>
							{/if}
						</a>
					{/each}
				</div>
			{/if}
		</div>
	</Sidebar.Inset>
</Sidebar.Provider>
