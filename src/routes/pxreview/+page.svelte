<script lang="ts">
	import AppSidebar from "$lib/components/app-sidebar.svelte";
	import * as Breadcrumb from "$lib/components/ui/breadcrumb/index.js";
	import { Separator } from "$lib/components/ui/separator/index.js";
	import * as Sidebar from "$lib/components/ui/sidebar/index.js";
	import { sections } from "$lib/content";
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
						<Breadcrumb.Item>
							<Breadcrumb.Page>PX Review</Breadcrumb.Page>
						</Breadcrumb.Item>
					</Breadcrumb.List>
				</Breadcrumb.Root>
			</div>
		</header>
		<div class="flex flex-1 flex-col gap-6 p-6">
			<div>
				<h1 class="text-2xl font-semibold">PX Review</h1>
				<p class="text-muted-foreground mt-1">
					Pick an entry from the sidebar to read it.
				</p>
			</div>
			<div class="grid auto-rows-min gap-4 md:grid-cols-3">
				{#each sections as section (section.folder)}
					<div class="bg-muted/50 rounded-xl p-4">
						<h2 class="font-medium">{section.title}</h2>
						<ul class="mt-2 space-y-1 text-sm">
							{#each section.entries as entry (entry.url)}
								<li>
									<a href={entry.url} class="hover:underline">{entry.title}</a>
								</li>
							{/each}
						</ul>
					</div>
				{/each}
			</div>
		</div>
	</Sidebar.Inset>
</Sidebar.Provider>
