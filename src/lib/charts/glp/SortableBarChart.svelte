<script lang="ts" module>
	export type SortMode = 'freq-desc' | 'freq-asc' | 'alpha';
</script>

<script lang="ts">
	import { Chart, Svg, Axis } from 'layerchart';
	import { scaleBand } from 'd3-scale';
	import { fade } from 'svelte/transition';
	import type { WordCount } from '$lib/content/wctglpdemo-data/index.js';

	let {
		data,
		color = 'var(--darkgrayblue)',
		unitLabel = 'mentions',
		rowHeight = 32,
		itemNoun = 'terms',
		blockLabel = 'mention',
		onselect,
		selected = null
	}: {
		data: WordCount[];
		color?: string;
		unitLabel?: string;
		rowHeight?: number;
		itemNoun?: string;
		blockLabel?: string;
		/** When set, rows become clickable and call this with the clicked datum. */
		onselect?: (datum: WordCount) => void;
		/** `word` of the currently-selected row, highlighted and never dimmed. */
		selected?: string | null;
	} = $props();

	let sortMode = $state<SortMode>('freq-desc');
	let hovered = $state<string | null>(null);

	const sortOptions: { id: SortMode; label: string }[] = [
		{ id: 'freq-desc', label: 'Most mentioned' },
		{ id: 'freq-asc', label: 'Least mentioned' },
		{ id: 'alpha', label: 'A → Z' }
	];

	const sorted = $derived.by(() => {
		const arr = [...data];
		if (sortMode === 'alpha') return arr.sort((a, b) => a.word.localeCompare(b.word));
		return arr.sort((a, b) => (sortMode === 'freq-desc' ? b.count - a.count : a.count - b.count));
	});

	const maxCount = $derived(Math.max(1, ...data.map((d) => d.count)));
	const chartHeight = $derived(sorted.length * rowHeight + 46);
</script>

<div class="flex flex-col gap-3">
	<div class="flex flex-wrap items-center justify-between gap-3">
		<p class="caption text-muted-foreground">
			{data.length} {itemNoun} · sorted by
			<span class="font-medium lowercase text-foreground">
				{sortOptions.find((o) => o.id === sortMode)?.label}
			</span>
		</p>

		<div class="flex flex-row overflow-hidden rounded-md border border-(--ink)/25" role="group">
			{#each sortOptions as opt, i (opt.id)}
				<button
					type="button"
					class="px-3 py-1.5 text-xs font-medium transition-colors duration-150
						{i > 0 ? 'border-l border-(--ink)/25' : ''}
						{sortMode === opt.id
						? 'bg-(--darkgrayblue) text-(--paper)'
						: 'bg-(--paper) text-foreground hover:bg-(--ink)/5'}"
					aria-pressed={sortMode === opt.id}
					onclick={() => (sortMode = opt.id)}
				>
					{opt.label}
				</button>
			{/each}
		</div>
	</div>

	<div style:height="{chartHeight}px" class="w-full">
		<Chart
			data={sorted}
			x="count"
			xDomain={[0, maxCount]}
			y="word"
			yScale={scaleBand().padding(0.3)}
			yDomain={sorted.map((d) => d.word)}
			padding={{ top: 4, bottom: 30, left: 128, right: 56 }}
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

				{#each sorted as d (d.word)}
					{@const by = yScale(d.word) ?? 0}
					{@const bh = yScale.bandwidth?.() ?? 0}
					{@const cellW = (xScale(1) ?? 0) - (xScale(0) ?? 0)}
					{@const gap = Math.min(3, cellW * 0.34)}
					{@const unitW = Math.max(1.5, cellW - gap)}
					{@const dim = hovered !== null && hovered !== d.word}
					<g
						class="row"
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
						role={onselect ? 'button' : 'presentation'}
						tabindex={onselect ? 0 : undefined}
					>
						<rect
							x="-128"
							y="0"
							width={(xScale.range?.()?.[1] ?? 0) + 184}
							height={bh}
							fill="transparent"
						/>

						{#each Array.from({ length: d.count }) as _, i (i)}
							<rect
								x={(xScale(i) ?? 0) + gap / 2}
								y="0"
								width={unitW}
								height={bh}
								rx="1"
								style:fill={color}
							/>
						{/each}

						<text
							x="-12"
							y={bh / 2}
							text-anchor="end"
							dominant-baseline="middle"
							class="word-label"
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

	<p class="caption text-muted-foreground">
		Each block is one {blockLabel} · bar length = {unitLabel}. Hover a row to isolate it; use the
		controls above to re-sort.
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
	.row.selectable:focus-visible .word-label {
		text-decoration: underline;
	}
	.row-selected .word-label,
	.row-selected .count-label {
		font-weight: 700;
	}
	.word-label {
		font-family: var(--font-body);
		font-size: 12px;
		fill: var(--ink);
	}
	.count-label {
		font-family: var(--font-mono);
		font-size: 11px;
		font-weight: 600;
		fill: var(--ink);
	}
</style>
