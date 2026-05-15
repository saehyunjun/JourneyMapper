<script lang="ts" generics="D extends Record<string, unknown>">
	import { scaleBand, scaleLinear } from 'd3-scale';
	import ChartFrame, {
		type ChartBodyContext,
		type ChartMargin,
		type LegendItem,
		type TooltipContent
	} from './ChartFrame.svelte';

	type Props = {
		figure: string | number;
		caption: string;
		data: D[];
		label: keyof D;
		value: keyof D;
		colorBy?: (d: D) => string;
		legend?: LegendItem[];
		tooltip?: (d: D) => TooltipContent;
		height?: number;
		margin?: ChartMargin;
		sort?: 'desc' | 'asc' | 'none';
	};

	let {
		figure,
		caption,
		data,
		label,
		value,
		colorBy,
		legend = [],
		tooltip,
		height = 280,
		margin = { top: 16, right: 100, bottom: 40, left: 140 },
		sort = 'desc'
	}: Props = $props();

	const items = $derived.by(() => {
		const v = (d: D) => Number(d[value]);
		if (sort === 'none') return [...data];
		return [...data].sort((a, b) => (sort === 'desc' ? v(b) - v(a) : v(a) - v(b)));
	});
	const maxVal = $derived(Math.max(0, ...items.map((d) => Number(d[value]))));

	const defaultColor = 'var(--darkgrayblue)';
</script>

<ChartFrame {figure} {caption} {legend} {height} {margin}>
	{#snippet body({ innerWidth, innerHeight, progress, setHover, clearHover }: ChartBodyContext)}
		{@const yScale = scaleBand<string>()
			.domain(items.map((d) => String(d[label])))
			.range([0, innerHeight])
			.padding(0.3)}
		{@const xScale = scaleLinear().domain([0, maxVal]).nice().range([0, innerWidth])}
		{@const xTicks = xScale.ticks(4)}

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

		{#each items as d, i (i)}
			{@const labelText = String(d[label])}
			{@const v = Number(d[value])}
			{@const by = yScale(labelText) ?? 0}
			{@const bh = yScale.bandwidth()}
			{@const fullBw = xScale(v) - xScale(0)}
			{@const bw = fullBw * progress}
			{@const fill = colorBy ? colorBy(d) : defaultColor}
			<text
				x="-8"
				y={by + bh / 2}
				text-anchor="end"
				dominant-baseline="middle"
				class="row-label"
			>
				{labelText}
			</text>
			<rect
				x="0"
				y={by}
				width={bw}
				height={bh}
				{fill}
				style="transition: opacity 200ms ease;"
				onpointerenter={(e) => tooltip && setHover(tooltip(d), e)}
				onpointermove={(e) => tooltip && setHover(tooltip(d), e)}
				onpointerleave={clearHover}
				role="presentation"
			/>
			<text
				x={bw + 8}
				y={by + bh / 2}
				dominant-baseline="middle"
				class="value-label"
				opacity={progress}
			>
				{v}
			</text>
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
