<!--
	DistributionBlock — a sentiment or theme distribution as a bar or donut.

	Blank until configured: an empty placeholder invites a click, which opens the
	right drawer. Once configured it renders the chosen chart from filtered
	analysis data. Bar charts reuse BarX/BarY; the donut is MiniDonut.
-->
<script lang="ts">
	import BarX from '$lib/charts/BarX.svelte';
	import BarY from '$lib/charts/BarY.svelte';
	import MiniDonut from './MiniDonut.svelte';
	import { BarChart3 } from '@lucide/svelte';
	import { buildDistribution } from '$lib/key-findings/widgets';
	import type { DistributionBlock } from '$lib/key-findings/types';

	let {
		block,
		editable = true,
		animate = false,
		replayKey = 0,
		onUpdate,
		onConfigure
	}: {
		block: DistributionBlock;
		editable?: boolean;
		animate?: boolean;
		replayKey?: number;
		onUpdate: (patch: Partial<DistributionBlock>) => void;
		onConfigure: () => void;
	} = $props();

	const data = $derived(buildDistribution(block.metric, block.filters));
	const title = $derived(block.title || (block.metric === 'sentiment' ? 'Sentiment distribution' : 'Theme distribution'));
</script>

{#if !block.configured}
	<button
		type="button"
		class="kf-placeholder"
		onclick={onConfigure}
		disabled={!editable}
		aria-label="Configure distribution chart"
	>
		<BarChart3 class="size-6 text-slate-300" />
		<span class="font-medium text-slate-500">Sentiment / Theme distribution</span>
		<span class="text-xs text-slate-400">Click to choose chart and filters</span>
	</button>
{:else}
	<figure class="flex flex-col gap-1">
		<figcaption class="flex items-baseline justify-between gap-2">
			{#if editable}
				<input
					class="min-w-0 flex-1 bg-transparent text-sm font-semibold text-slate-800 outline-none placeholder:text-slate-300"
					style="font-family: var(--font-body);"
					value={block.title}
					placeholder="Chart title"
					oninput={(e) => onUpdate({ title: e.currentTarget.value })}
				/>
				<button class="shrink-0 text-xs text-slate-400 hover:text-slate-700" onclick={onConfigure}>Settings</button>
			{:else}
				<h4 class="truncate text-sm font-semibold text-slate-800" style="font-family: var(--font-body);">{title}</h4>
			{/if}
		</figcaption>
		{#if block.caption}<p class="text-xs text-slate-500">{block.caption}</p>{/if}

		<div class="mt-1">
			{#if block.chartType === 'donut'}
				<div class="flex justify-center py-2">
					<MiniDonut {data} {animate} {replayKey} />
				</div>
			{:else if block.metric === 'sentiment'}
				<BarY figure="" caption="" {data} label="label" value="value" colorBy={(d) => d.color as string} height={280} />
			{:else}
				<BarX figure="" caption="" {data} label="label" value="value" colorBy={(d) => d.color as string} height={Math.max(200, data.length * 34)} />
			{/if}
		</div>
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
	/* Trim ChartFrame's outer margin inside a card. */
	figure :global(.chart) {
		margin: 0.25rem 0 0;
	}
</style>
