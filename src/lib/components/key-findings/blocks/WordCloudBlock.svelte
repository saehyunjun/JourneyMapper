<!--
	WordCloudBlock — a filtered word-frequency cloud.

	Blank until configured (click opens the right drawer to pick a preset and
	filters). Once configured it tokenises the filtered segments and renders the
	existing WordCloud component, sized to the card width.
-->
<script lang="ts">
	import WordCloud from '$lib/charts/glp/WordCloud.svelte';
	import { Cloud } from '@lucide/svelte';
	import { buildWordCloud } from '$lib/key-findings/widgets';
	import type { WordCloudBlock } from '$lib/key-findings/types';

	let {
		block,
		editable = true,
		onUpdate,
		onConfigure
	}: {
		block: WordCloudBlock;
		editable?: boolean;
		onUpdate: (patch: Partial<WordCloudBlock>) => void;
		onConfigure: () => void;
	} = $props();

	let wrapWidth = $state(420);
	const words = $derived(buildWordCloud(block.filters));
	const title = $derived(block.title || 'Word cloud');
</script>

{#if !block.configured}
	<button type="button" class="kf-placeholder" onclick={onConfigure} disabled={!editable} aria-label="Configure word cloud">
		<Cloud class="size-6 text-slate-300" />
		<span class="font-medium text-slate-500">Word cloud</span>
		<span class="text-xs text-slate-400">Click to choose a preset and filters</span>
	</button>
{:else}
	<figure class="flex flex-col gap-1" bind:clientWidth={wrapWidth}>
		<figcaption class="flex items-baseline justify-between gap-2">
			{#if editable}
				<input
					class="min-w-0 flex-1 bg-transparent text-sm font-semibold text-slate-800 outline-none placeholder:text-slate-300"
					style="font-family: var(--font-body);"
					value={block.title}
					placeholder="Word cloud title"
					oninput={(e) => onUpdate({ title: e.currentTarget.value })}
				/>
				<button class="shrink-0 text-xs text-slate-400 hover:text-slate-700" onclick={onConfigure}>Settings</button>
			{:else}
				<h4 class="truncate text-sm font-semibold text-slate-800" style="font-family: var(--font-body);">{title}</h4>
			{/if}
		</figcaption>
		{#if block.caption}<p class="text-xs text-slate-500">{block.caption}</p>{/if}
		{#key `${wrapWidth}:${words.length}:${block.filters.participantId}:${block.filters.theme}:${block.filters.sentiment}:${block.filters.questionId}`}
			<WordCloud {words} width={Math.max(260, wrapWidth - 8)} height={300} interactive={false} editable={false} />
		{/key}
	</figure>
{/if}

<style>
	.kf-placeholder {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.35rem;
		width: 100%;
		min-height: 150px;
		border: 2px dashed #e2e8f0;
		border-radius: 0.75rem;
		padding: 1.25rem;
		text-align: center;
		transition: border-color 0.15s ease, background 0.15s ease;
	}
	.kf-placeholder:hover:not(:disabled) {
		border-color: var(--teal, #7dbfa7);
		background: #f8fafc;
	}
	.kf-placeholder:focus-visible {
		outline: 2px solid var(--teal, #7dbfa7);
		outline-offset: 2px;
	}
</style>
