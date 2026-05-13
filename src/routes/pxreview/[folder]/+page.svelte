<script lang="ts">
	import AppSidebar from "$lib/components/app-sidebar.svelte";
	import * as Breadcrumb from "$lib/components/ui/breadcrumb/index.js";
	import { Separator } from "$lib/components/ui/separator/index.js";
	import * as Sidebar from "$lib/components/ui/sidebar/index.js";
	import { findSection } from "$lib/content";

	let { data } = $props();

	const section = $derived(findSection(data.folder));
</script>

<Sidebar.Provider>
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
						{section.entries.length}
						{section.entries.length === 1 ? "entry" : "entries"}
					</p>
				</div>
				<div class="grid auto-rows-min gap-4 md:grid-cols-2 lg:grid-cols-3">
					{#each section.entries as entry (entry.url)}
						{@const summary = entry.metadata.summary as string | undefined}
						<a
							href={entry.url}
							class="bg-muted/50 hover:bg-muted block rounded-xl p-4 transition-colors"
						>
							<h2 class="font-medium">{entry.title}</h2>
							{#if summary}
								<p class="text-muted-foreground mt-1 text-sm">{summary}</p>
							{/if}
						</a>
					{/each}
				</div>
			{/if}
		</div>
	</Sidebar.Inset>
</Sidebar.Provider>
