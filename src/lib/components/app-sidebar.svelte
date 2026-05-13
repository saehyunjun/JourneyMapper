<script lang="ts">
	import * as Sidebar from "$lib/components/ui/sidebar/index.js";
	import GalleryVerticalEndIcon from "@lucide/svelte/icons/gallery-vertical-end";
	import type { ComponentProps } from "svelte";
	import { sections, type ContentSection, type ContentEntry } from "$lib/content";
	import { page } from "$app/state";

	let { ref = $bindable(null), ...restProps }: ComponentProps<typeof Sidebar.Root> = $props();

	const path = $derived(page.url.pathname);

	function isSectionActive(section: ContentSection): boolean {
		return path === section.url || path.startsWith(section.url + "/");
	}

	function isEntryActive(entry: ContentEntry): boolean {
		return path === entry.url;
	}
</script>

<Sidebar.Root {...restProps} bind:ref>
	<Sidebar.Header>
		<Sidebar.Menu>
			<Sidebar.MenuItem>
				<Sidebar.MenuButton size="lg">
					{#snippet child({ props })}
						<a href="/pxreview" {...props}>
							<div class="flex flex-col leading-none border-b border-primary w-full pb-2">
								<span class="font-semibold text-base uppercase">
									The PX Review</span>
									<span class="text-xs">
										By Patiently Studio
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
				{#each sections as section (section.folder)}
					<Sidebar.MenuItem>
						<Sidebar.MenuButton>
							{#snippet child({ props })}
								<a
									href={section.url}
									{...props}
									class:active-underline={isSectionActive(section)}
								>
									{section.title}
								</a>
							{/snippet}
						</Sidebar.MenuButton>
						{#if section.entries.length}
							<Sidebar.MenuSub>
								{#each section.entries as entry (entry.url)}
									<Sidebar.MenuSubItem>
										<Sidebar.MenuSubButton>
											{#snippet child({ props })}
												<a
													href={entry.url}
													{...props}
													class:active-entry={isEntryActive(entry)}
												>
													{entry.title}
												</a>
											{/snippet}
										</Sidebar.MenuSubButton>
									</Sidebar.MenuSubItem>
								{/each}
							</Sidebar.MenuSub>
						{/if}
					</Sidebar.MenuItem>
				{/each}
			</Sidebar.Menu>
		</Sidebar.Group>
	</Sidebar.Content>
	<Sidebar.Rail />
</Sidebar.Root>

