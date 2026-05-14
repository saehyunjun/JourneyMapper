<script lang="ts">
	import * as Tabs from "$lib/components/ui/tabs/index.js";
	import { findSection, getSectionTags } from "$lib/content";
	import IconArrowRightRegular from "phosphor-icons-svelte/IconArrowRightRegular.svelte";
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

		goto(`${url.pathname}${url.search}`, {
			replaceState: true,
			noScroll: true,
			keepFocus: true
		});
	}
</script>

<div class="flex flex-1 flex-col gap-6">
	{#if section}
		<div class="flex h-96 w-full flex-col justify-center bg-accent-orange bg-[url('/content-assets/bgtexture.png')] bg-center bg-blend-lighten">
			<div class="mx-auto flex w-full max-w-7xl flex-col gap-4 px-8">
				<div class="flex flex-row flex-wrap gap-2">
					<p class="w-fit rounded-xl bg-accent px-2 text-center text-sm text-muted-foreground">
						{visibleEntries.length}
						{visibleEntries.length === 1 ? "entry" : "entries"}
					</p>

					{#if activeTag}
						<p class="text-mono w-fit rounded-xl px-2 text-center text-sm font-normal text-primary-foreground/80">
							Filtered by
							<span class="uppercase">{activeTag}</span>
						</p>
					{/if}
				</div>

				<h1 class="font-heading text-6xl font-light uppercase text-primary-foreground md:text-7xl">
					{section.title}
				</h1>

				{#if section.description}
					<p class="max-w-3xl text-xl leading-8 text-primary-foreground/85">
						{section.description}
					</p>
				{/if}
			</div>
		</div>

		<div class="mx-auto flex w-full max-w-7xl flex-col px-8">
			{#if allTags.length}
				<div class="border-b pb-6">
					<Tabs.Root value={tabValue} onValueChange={onTagChange}>
						<Tabs.List variant="default" class="flex-wrap">
							<Tabs.Trigger value={ALL}>All</Tabs.Trigger>
							{#each allTags as tag (tag)}
								<Tabs.Trigger value={tag}>{tag}</Tabs.Trigger>
							{/each}
						</Tabs.List>
					</Tabs.Root>
				</div>
			{/if}

			<div class="flex min-w-full flex-col justify-between pt-4 pb-12 md:flex-row">
				<div class="flex h-full flex-col justify-between pr-8 md:w-md md:border-r">
					<div class="flex flex-col gap-4 border-y pb-4 pr-8 md:border-y-0">
						<h2 class="font-heading text-6xl font-light uppercase text-primary">
							{section.title}
						</h2>

						{#if section.description}
							<p class="text-xl">
								{section.description}
							</p>
						{/if}
					</div>
				</div>

				<ul class="flex h-full flex-col justify-evenly gap-6 space-y-2 py-8 md:py-0">
					{#each visibleEntries as entry (entry.url)}
						<a
							class="flex w-full flex-col justify-between transition-all duration-300 ease-out hover:-translate-y-1 hover:cursor-pointer hover:text-muted-foreground md:w-xl md:pl-8"
							href={entry.url}
						>
							<div class="flex w-full flex-row justify-between gap-6">
								<h3 class="mb-2 text-lg font-medium leading-tight tracking-tight text-accent-mint uppercase">
									{entry.title}
								</h3>

								<IconArrowRightRegular class="shrink-0 text-xl text-accent-mint" />
							</div>

							{#if entry.summary}
								<p class="text-sm font-primary md:max-w-sm">
									{entry.summary}
								</p>
							{/if}
						</a>
					{/each}
				</ul>
			</div>
		</div>
	{/if}
</div>