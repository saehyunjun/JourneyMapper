<script lang="ts" module>
	import { Button } from '$lib/components/ui/Button/index.ts';

	export type ColorMode = 'sentiment' | 'interviewee';
	export type ChartBlock = { sentiment: number; interview_id: string };
	/** One bar: a label, its total count, and one block per contributing segment. */
	export type ChartRow = { word: string; count: number; blocks: ChartBlock[] };
</script>

<script lang="ts">
	import { Chart, Svg, Axis } from 'layerchart';
	import { scaleBand } from 'd3-scale';
	import { fade } from 'svelte/transition';

	let {
		data,
		unitLabel = 'mentions',
		rowHeight = 32,
		itemNoun = 'terms',
		blockLabel = 'mention',
		onselect,
		selected = null
	}: {
		data: ChartRow[];
		unitLabel?: string;
		rowHeight?: number;
		itemNoun?: string;
		blockLabel?: string;
		/** When set, rows become clickable and call this with the clicked datum. */
		onselect?: (datum: ChartRow) => void;
		/** `word` of the currently-selected row, highlighted and never dimmed. */
		selected?: string | null;
	} = $props();

	let colorMode = $state<ColorMode>('sentiment');
	let hovered = $state<string | null>(null);

	const colorModes: { id: ColorMode; label: string }[] = [
		{ id: 'sentiment', label: 'By sentiment' },
		{ id: 'interviewee', label: 'By interviewee' }
	];

	// -2..2 diverging scale.
	const SENTIMENT_COLORS: Record<number, string> = {
		[-2]: '#e11d48',
		[-1]: '#fb7185',
		0: '#cbd5e1',
		1: '#34d399',
		2: '#059669'
	};
	const SENTIMENT_LABEL: Record<number, string> = {
		[-2]: 'Strongly Negative',
		[-1]: 'Negative',
		0: 'Neutral / Mixed',
		1: 'Positive',
		2: 'Strongly Positive'
	};
	const INTERVIEWEE_PALETTE = ['#2563eb', '#f59e0b', '#7c3aed', '#0d9488', '#db2777'];
	const fmtParticipant = (id: string) =>
		id.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

	const interviewees = $derived(
		[...new Set(data.flatMap((d) => d.blocks.map((b) => b.interview_id)))].sort()
	);
	const intervieweeColor = $derived(
		new Map(interviewees.map((id, i) => [id, INTERVIEWEE_PALETTE[i % INTERVIEWEE_PALETTE.length]]))
	);
	const sentimentsPresent = $derived(
		[...new Set(data.flatMap((d) => d.blocks.map((b) => b.sentiment)))].sort((a, b) => a - b)
	);

	function blockColor(b: ChartBlock): string {
		return colorMode === 'sentiment'
			? (SENTIMENT_COLORS[b.sentiment] ?? '#cbd5e1')
			: (intervieweeColor.get(b.interview_id) ?? '#94a3b8');
	}

	/** Blocks sorted within a row so same-colour segments stack together. */
	function orderedBlocks(row: ChartRow): ChartBlock[] {
		const arr = [...row.blocks];
		return colorMode === 'sentiment'
			? arr.sort((a, b) => a.sentiment - b.sentiment)
			: arr.sort((a, b) => a.interview_id.localeCompare(b.interview_id));
	}

	const legendItems = $derived(
		colorMode === 'sentiment'
			? sentimentsPresent.map((v) => ({ color: SENTIMENT_COLORS[v], label: SENTIMENT_LABEL[v] }))
			: interviewees.map((id) => ({
					color: intervieweeColor.get(id) ?? '#94a3b8',
					label: fmtParticipant(id)
				}))
	);

	const maxCount = $derived(Math.max(1, ...data.map((d) => d.count)));
	const chartHeight = $derived(data.length * rowHeight + 46);
</script>

<div class="flex flex-col gap-3">
	<div class="flex flex-wrap items-center justify-between gap-3">
		<div class="flex flex-wrap items-center gap-x-4 gap-y-1">
			<p class="caption text-muted-foreground">{data.length} {itemNoun}</p>
			<div class="flex flex-wrap items-center gap-x-4 gap-y-1">
				{#each legendItems as item (item.label)}
					<span class="flex items-center gap-2.5 text-xs font-mono text-foreground">
						<span class="size-3 rounded-sm" style:background-color={item.color}></span>
						{item.label}
					</span>
				{/each}
			</div>
		</div>

		<div class="flex flex-row overflow-hidden rounded-md border border-(--ink)/25" role="group">
			{#each colorModes as opt, i (opt.id)}
				<Button
					type="Button"
					class="px-3 py-1.5 text-xs font-medium transition-colors duration-150
						{i > 0 ? 'border-l border-(--ink)/25' : ''}
						{colorMode === opt.id
						? 'bg-(--darkgrayblue) text-(--paper)'
						: 'bg-(--paper) text-foreground hover:bg-(--ink)/5'}"
					aria-pressed={colorMode === opt.id}
					onclick={() => (colorMode = opt.id)}
				>
					{opt.label}
				</Button>
			{/each}
		</div>
	</div>

	<div style:height="{chartHeight}px" class="w-full">
		<Chart
			{data}
			x="count"
			xDomain={[0, maxCount]}
			y="word"
			yScale={scaleBand().padding(0.3)}
			yDomain={data.map((d) => d.word)}
			padding={{ top: 4, bottom: 30, left: 220, right: 56 }}
			let:xScale
			let:yScale
		>
			<Svg>
				<Axis
					placement="bottom"
					rule={{ class: 'stroke-(--ink) opacity-30' }}
					ticks={maxCount > 20 ? 6 : maxCount}
					format={(v: number) => (Number.isInteger(v) ? String(v) : '')}
					tickLabelProps={{ class: 'fill-(--ink) opacity-55 text-[10px]' }}
				/>

				{#each data as d (d.word)}
					{@const by = yScale(d.word) ?? 0}
					{@const bh = yScale.bandwidth?.() ?? 0}
					{@const cellW = (xScale(1) ?? 0) - (xScale(0) ?? 0)}
					{@const gap = Math.min(3, cellW * 0.34)}
					{@const unitW = Math.max(1.5, cellW - gap)}
					{@const dim = hovered !== null && hovered !== d.word}
					{@const ordered = orderedBlocks(d)}
					<g
						class="row hover:font-bold"
						class:selectable={!!onselect}
						class:row-selected={selected === d.word}
						style:transform="translateY({by}px)"
						style:opacity={dim && selected !== d.word ? 0.35 : 1}
						transition:fade={{ duration: 200 }}
						onpointerenter={() => (hovered = d.word)}
						onpointerleave={() => (hovered = null)}
						onclick={() => onselect?.(d)}
						onkeydown={(e) => {
							if (onselect && (e.key === 'Enter' || e.key === ' ')) {
								e.preventDefault();
								onselect(d);
							}
						}}
						role={onselect ? 'Button' : 'presentation'}
						tabindex={onselect ? 0 : undefined}
					>
						<rect
							x="-128"
							y="0"
							width={(xScale.range?.()?.[1] ?? 0) + 14}
							height={bh}
							fill="transparent"
						/>

						{#each ordered as block, i (i)}
							<rect
								x={(xScale(i) ?? 0) + gap / 2}
								y="0"
								width={unitW}
								height={bh}
								rx="1"
								style:fill={blockColor(block)}
							/>
						{/each}

						<text
							x="-12"
							y={bh / 2}
							text-anchor="end"
							dominant-baseline="middle"
							class="text-xs"
						>
							{d.word}
						</text>
						<text
							x={(xScale(d.count) ?? 0) + 9}
							y={bh / 2}
							dominant-baseline="middle"
							class="count-label"
						>
							{d.count}
						</text>
					</g>
				{/each}
			</Svg>
		</Chart>
	</div>

	<p class="caption text-xs text-muted-foreground">
		Each block is one {blockLabel}, coloured by {colorMode} · bar length = {unitLabel}. Hover a
		row to isolate it; use the toggle above to recolour.
	</p>
</div>

<style>
	.row {
		transition:
			transform 520ms cubic-bezier(0.22, 1, 0.36, 1),
			opacity 150ms ease;
		cursor: crosshair;
	}
	.row.selectable {
		cursor: pointer;
	}
	.row.selectable:focus-visible {
		outline: none;
	}
	.row.selectable:focus-visible .text-sm {
		text-decoration: underline;
	}
	.row-selected .text-sm,
	.row-selected .count-label {
		font-weight: 700;
	}
	.text-sm {
		font-family: var(--font-body);
		font-size: 1.125rem;
		fill: var(--ink);
	}
	.count-label {
		font-family: var(--font-mono);
		font-size: .825rem;
		font-weight: 400;
		fill: var(--ink);
	}
</style>
