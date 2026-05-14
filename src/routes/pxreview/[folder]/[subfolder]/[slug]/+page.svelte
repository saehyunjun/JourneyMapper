<script lang="ts">
	import { Button } from "$lib/components/ui/button/index.js";
	import { findEntry } from "$lib/content";
	import TableOfContents from "$lib/components/TableOfContents.svelte";

	let { data } = $props();

	const entry = $derived(findEntry(data.folder, data.subfolder, data.slug));

	let articleEl: HTMLElement | null = $state(null);
</script>

<div class="flex flex-1 flex-col gap-4 px-2 align-middle justify-center bg-accent-mint-foreground/40">
	{#if entry}
		{@const Content = entry.Component}
		{@const hero = entry.metadata.hero as string | undefined}

		<!-- FULL WIDTH HERO -->
		<div class="flex flex-col min-w-full items-center justify-center mx-auto my-auto">
			<div
				class="mx-auto w-full bg-accent-mint bg-[url('/content-assets/bgtexture.png')] bg-cover bg-center bg-blend-multiply"
			>
				{#if hero}
					<img
						src={hero}
						alt=""
						class="max-h-2xl justify-center mx-auto py-8 px-2 object-cover mix-blend-luminosity brightness-75"
					/>
				{:else}
				{/if}
			</div>
		</div>
		<div class="flex flex-col gap-2 justify-center mx-auto">
		<h1 class="text-center text-accent-mint w-full leading-14 border-y-2 border-accent-mint py-4 mb-4">
			{entry.title}
		</h1>
			<!--Tag groups-->
			{#if entry.tags.length}
			<div class="flex flex-row gap-2 align-middle w-full justify-center">
				<span class="font-mono text-xs">Tags</span>
				{#each entry.tags as tag (tag)}
					<Button
						variant="outline"
						size="xs"
						href="/pxreview/{entry.folder}?tag={tag}"
					>
						{tag}
					</Button>
				{/each}
			</div>
		{/if}
	</div>
		<div class="flex flex-col md:flex-row md:w-7xl align-content-center justify-center ">
		<aside class="md:w-md md:pl-4">
			<TableOfContents article={articleEl} key={data.slug} />
		</aside>
		<!-- ARTICLE WIDTH -->
		<article
			bind:this={articleEl}
			class="markdown-body mx-auto w-full max-w-3xl px-8 overflow-scroll"
		>
			<div class="markdown-body">
				<Content />
			</div>
		</article>
	</div>
	{/if}
</div>

<style>
	.markdown-body :global(h1) {
		font-size: 2.125rem;
		font-weight: 400;
		margin-bottom: 1rem;
	}
	.markdown-body :global(h2) {
		border-top: 1px solid var(--color-gray-300);
		font-size: 1.425rem;
		font-weight: 500;
		text-transform: uppercase;
		padding-top: 1rem;
		margin-top: 1.5rem;
		margin-bottom: 0.5rem;
	}

	.markdown-body :global(h3) {
		font-size: .925rem;
		font-weight: 700;
		text-transform: uppercase;
		margin-top: 1.5rem;
		margin-bottom: 0.5rem;
	}


	.markdown-body :global(p) {
		margin-bottom: 0.825rem;
		line-height: 1.6;
		font-size: 1.25rem;
		text-wrap: balance;
	}
	.markdown-body :global(ul) {
		list-style: disc;
		padding-left: 1.5rem;
		margin-bottom: 0.75rem;
	}
	.markdown-body :global(li) {
		margin-bottom: 0.25rem;
	}
	.markdown-body :global(hr) {
		margin: 1.5rem 0;
		border-color: var(--border);
	}
	.markdown-body :global(a) {
		color: var(--primary);
		text-decoration: underline;
	}
</style>
