<!--
	SentimentBar — one labelled row of discrete sentiment blocks.

	Mirrors the SortableBarChart "rect" treatment: one block per contributing
	segment, sized to a shared cell width so bars stay comparable across rows,
	and coloured on the -2..2 sentiment scale. Same-sentiment blocks are grouped
	so each bar reads negative → positive left to right. Shared by the
	participant drawer's "Themes & emotions" breakdown.
-->
<script lang="ts" module>
	// -2..2 diverging scale, matching SortableBarChart.
	const SENTIMENT_COLORS: Record<number, string> = {
		[-2]: '#e11d48',
		[-1]: '#fb7185',
		0: '#cbd5e1',
		1: '#34d399',
		2: '#059669'
	};
</script>

<script lang="ts">
	type Block = { sentiment: number };

	let {
		label,
		blocks,
		labelClass = 'w-32',
		shape = 'bar',
		max: _max
	}: {
		label: string;
		/** Contributing segment annotations — one block is drawn per entry. */
		blocks: Block[];
		/** Width utility for the label column. */
		labelClass?: string;
		/** 'bar' draws fixed squares; 'dots' draws one fixed circle per block. */
		shape?: 'bar' | 'dots';
		/** Accepted for backwards-compat; no longer used now that blocks are fixed squares. */
		max?: number;
	} = $props();

	// Group same-sentiment blocks so the row reads negative → positive.
	const ordered = $derived([...blocks].sort((a, b) => a.sentiment - b.sentiment));
	const blockColor = (b: Block) => SENTIMENT_COLORS[b.sentiment] ?? '#cbd5e1';
</script>

<div class="flex items-center gap-3 align-top">
	<span 
	class="{labelClass} shrink-0 wrap text-xs text-primary" title={label}>
		{label}
	</span>
	
	{#if shape === 'dots'}
		<!-- One fixed circle per contributing segment, sentiment-coloured. -->
		<div class="flex min-w-8 flex-1 flex-wrap items-center gap-1">
			{#each ordered as block, i (i)}
				<div class="h-2 w-2 rounded-full" 
				style="background-color: {blockColor(block)}"></div>
			{/each}
		</div>
	{:else}
		<div class="ml-5 flex flex-1 flex-wrap items-center gap-1">
			{#each ordered as block, i (i)}
				<div
					class="h-4 w-4 shrink-0"
					style="background-color: {blockColor(block)}"
				></div>
			{/each}
		</div>
	{/if}
	<span class="w-8 shrink-0 text-right tabular-nums text-slate-500">{ordered.length}</span>
</div>
