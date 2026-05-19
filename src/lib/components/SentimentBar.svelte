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
		max,
		labelClass = 'w-32',
		shape = 'bar'
	}: {
		label: string;
		/** Contributing segment annotations — one block is drawn per entry. */
		blocks: Block[];
		/** Largest count among sibling rows — sets the shared cell width. */
		max: number;
		/** Width utility for the label column. */
		labelClass?: string;
		/** 'bar' draws proportional cells; 'dots' draws one fixed circle per block. */
		shape?: 'bar' | 'dots';
	} = $props();

	// Group same-sentiment blocks so the row reads negative → positive.
	const ordered = $derived([...blocks].sort((a, b) => a.sentiment - b.sentiment));
	// One of `max` cells per block, with a fixed gap between them.
	const cellWidth = $derived(`calc((100% - ${Math.max(0, max - 1)} * 10px) / ${Math.max(1, max)})`);
	const blockColor = (b: Block) => SENTIMENT_COLORS[b.sentiment] ?? '#cbd5e1';
</script>

<div class="flex items-center gap-3">
	<span 
	class="{labelClass} shrink-0 truncate text-sm text-primary" title={label}>
		{label}
	</span>
	
	{#if shape === 'dots'}
		<!-- One fixed circle per contributing segment, sentiment-coloured. -->
		<div class="flex min-w-8 flex-1 flex-wrap items-center gap-1">
			{#each ordered as block, i (i)}
				<div class="h-4 w-4 rounded-full" 
				style="background-color: {blockColor(block)}"></div>
			{/each}
		</div>
	{:else}
		<div class="flex h-4 w-8 ml-5 gap-1 flex-1">
			{#each ordered as block, i (i)}
				<div
					class="h-full w-8"
					style="width: {cellWidth}; background-color: {blockColor(block)}"
				></div>
			{/each}
		</div>
	{/if}
	<span class="w-8 shrink-0 text-right tabular-nums text-slate-500">{ordered.length}</span>
</div>
