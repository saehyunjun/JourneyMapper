<script lang="ts" generics="D extends Record<string, unknown>">
	import { scaleBand, scaleLinear } from 'd3-scale';
	import ChartFrame, {
		type ChartBodyContext,
		type ChartMargin,
		type LegendItem,
		type TooltipContent
	} from './ChartFrame.svelte';

	export type StackSegment<D> = {
		key: keyof D;
		label: string;
		color: string;
	};

	type Props = {
		figure: string | number;
		caption: string;
		data: D[];
		label: keyof D;
		segments: StackSegment<D>[];
		tooltip?: (d: D, segment: StackSegment<D>) => TooltipContent;
		annotate?: (d: D) => string | null;
		axisCaption?: string;
		height?: number;
		margin?: ChartMargin;
		source?: string;
		sort?: 'desc' | 'asc' | 'none';
	};

	let {
		figure,
		caption,
		data,
		label,
		segments,
		tooltip,
		annotate,
		axisCaption,
		height = 320,
		margin = { top: 24, right: 120, bottom: 64, left: 140 },
		source,
		sort = 'none'
	}: Props = $props();

	function total(d: D): number {
		return segments.reduce((acc, s) => acc + Number(d[s.key] ?? 0), 0);
	}

	const items = $derived.by(() => {
		if (sort === 'none') return [...data];
		return [...data].sort((a, b) => (sort === 'desc' ? total(b) - total(a) : total(a) - total(b)));
	});
	const maxVal = $derived(Math.max(0, ...items.map(total)));

	const legend = $derived<LegendItem[]>(
		segments.map((s) => ({ label: s.label, color: s.color }))
	);
</script>

<ChartFrame {figure} {caption} {legend} {height} {margin} {source}>
	{#snippet body({ innerWidth, innerHeight, progress, setHover, clearHover }: ChartBodyContext)}
		{@const yScale = scaleBand<string>()
			.domain(items.map((d, i) => `${i}`))
			.range([0, innerHeight])
			.padding(0.3)}
		{@const xScale = scaleLinear().domain([0, maxVal]).nice().range([0, innerWidth])}
		{@const xTicks = xScale.ticks(5)}

		{#each xTicks as t (t)}
			<line
				x1={xScale(t)}
				x2={xScale(t)}
				y1="0"
				y2={innerHeight}
				stroke="var(--ink)"
				stroke-opacity="0.08"
			/>
			<text x={xScale(t)} y={innerHeight + 16} text-anchor="middle" class="tick-label">{t}</text>
		{/each}

		{#if axisCaption}
			<text
				x={innerWidth / 2}
				y={innerHeight + 36}
				text-anchor="middle"
				class="axis-caption"
			>
				{axisCaption}
			</text>
		{/if}

		{#each items as d, i (i)}
			{@const by = yScale(`${i}`) ?? 0}
			{@const bh = yScale.bandwidth()}
			{@const totalW = (xScale(total(d)) - xScale(0)) * progress}
			<text
				x="-8"
				y={by + bh / 2}
				text-anchor="end"
				dominant-baseline="middle"
				class="row-label"
			>
				{String(d[label])}
			</text>

			{#each segments as seg, si (seg.key)}
				{@const segV = Number(d[seg.key] ?? 0)}
				{@const fullW = xScale(segV) - xScale(0)}
				{@const w = fullW * progress}
				{@const prevW = segments
					.slice(0, si)
					.reduce((acc, s) => acc + (xScale(Number(d[s.key] ?? 0)) - xScale(0)), 0) * progress}
				<rect
					x={prevW}
					y={by}
					width={w}
					height={bh}
					fill={seg.color}
					style="transition: opacity 200ms ease;"
					onpointerenter={(e) => tooltip && setHover(tooltip(d, seg), e)}
					onpointermove={(e) => tooltip && setHover(tooltip(d, seg), e)}
					onpointerleave={clearHover}
					role="presentation"
				/>
			{/each}

			{#if annotate}
				{@const text = annotate(d)}
				{#if text}
					<text
						x={totalW + 8}
						y={by + bh / 2}
						dominant-baseline="middle"
						class="annotation"
						opacity={progress}
					>
						{text}
					</text>
				{/if}
			{/if}
		{/each}

		<line
			x1="0"
			x2={innerWidth}
			y1={innerHeight}
			y2={innerHeight}
			stroke="var(--ink)"
			stroke-opacity="0.4"
		/>
	{/snippet}
</ChartFrame>
