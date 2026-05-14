<script lang="ts">
	import AppSidebar from "$lib/components/app-sidebar.svelte";
	import * as Breadcrumb from "$lib/components/ui/breadcrumb/index.js";
	import { Separator } from "$lib/components/ui/separator/index.js";
	import * as Sidebar from "$lib/components/ui/sidebar/index.js";
	import { findEntry } from "$lib/content";
	import { sidebarState } from "$lib/sidebar-state.svelte.js";

	let { data } = $props();

	const entry = $derived(findEntry(data.folder, data.slug));
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
								{data.sectionTitle}</Breadcrumb.Link>
						</Breadcrumb.Item>
						<Breadcrumb.Separator class="hidden md:block" />
						<Breadcrumb.Item>
							<Breadcrumb.Page>{data.title}</Breadcrumb.Page>
						</Breadcrumb.Item>
					</Breadcrumb.List>
				</Breadcrumb.Root>
			</div>
		</header>
	<div class="flex flex-1 flex-col gap-4 px-2 align-middle justify-center mx-a">

	{#if entry}
		{@const Content = entry.Component}
		{@const hero = entry.metadata.hero as string | undefined}
		{@const summary = entry.metadata.summary as string | undefined}

		<!-- FULL WIDTH HERO -->
		<div class="min-w-full px-8 h-64 items-center justify-center mx-auto my-auto">
			<div class="mx-auto w-full h-64 bg-accent-mint">
				{#if hero}
					<img
						src={hero}
						alt=""
						class="w-full h-[420px] object-cover"
					/>
				{:else}
					<div class="flex flex-col md:flex-row align-content-center justify-center">
						<h1 class="text-center text-accent-mint-foreground">{entry.title}</h1>
					</div>
				{/if}
			</div>
		</div>

		<!-- ARTICLE WIDTH -->
		<article class="markdown-body mx-auto w-full max-w-3xl px-8">
			<div class="markdown-body">
				<Content />
			</div>
		</article>
	{/if}
</div>
	</Sidebar.Inset>
</Sidebar.Provider>

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
