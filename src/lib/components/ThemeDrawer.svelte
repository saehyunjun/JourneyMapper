<!--
	ThemeDrawer — a self-contained right drawer for one analytical theme.

	Given a theme id it pulls every segment coded to that theme straight from the
	pipeline outputs and lists them as CodedFragmentCards. Used by the booth-style
	views (ambient constellation, keyword orbit, quiz) where clicking a theme
	should surface the lines behind it without any page-level wiring.
-->
<script lang="ts">
	import RightDrawer from '$lib/components/RightDrawer.svelte';
	import CodedFragmentCard from '$lib/components/CodedFragmentCard.svelte';
	import { segmentsForTheme, themeTags, titleCase } from '$lib/content/wctglpdemo-data/analysis';

	let {
		open = $bindable(false),
		themeId = null
	}: {
		open?: boolean;
		/** Theme id to show; the drawer is empty until one is set. */
		themeId?: string | null;
	} = $props();

	const themeById = new Map(themeTags.map((t) => [t.id, t]));
	const theme = $derived(themeId ? themeById.get(themeId) : undefined);
	const fragments = $derived(themeId ? segmentsForTheme(themeId) : []);
	const participantCount = $derived(new Set(fragments.map((f) => f.interview_id)).size);
</script>

<RightDrawer bind:open>
	<div class="flex h-full flex-col">
		<div class="flex flex-col gap-1 border-b border-slate-200 p-6">
			<span class="figcaption text-accent-mint">Theme</span>
			<h2 class="font-heading text-3xl font-light uppercase text-primary">
				{themeId ? titleCase(themeId) : ''}
			</h2>
			{#if theme?.description}
				<p class="text-sm text-muted-foreground">{theme.description}</p>
			{/if}
			<p class="text-sm text-muted-foreground">
				{fragments.length} coded {fragments.length === 1 ? 'segment' : 'segments'} · spoken by
				{participantCount} {participantCount === 1 ? 'participant' : 'participants'}
			</p>
		</div>

		<div class="flex flex-1 flex-col gap-3 overflow-y-auto p-6">
			{#each fragments as f (f.segment_id)}
				<CodedFragmentCard fragment={f} />
			{:else}
				<p
					class="rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500"
				>
					No tagged quotes for this theme.
				</p>
			{/each}
		</div>
	</div>
</RightDrawer>
