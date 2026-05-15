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
		labelFormat?: (d: D) => string;
		valueFormat?: (v: number) => string;
		colorBy?: (d: D) => string;
		legend?: LegendItem[];
		tooltip?: (d: D) => TooltipContent;
		height?: number;
		margin?: ChartMargin;
		source?: string;
	};

	let {
		figure,
		caption,
		data,
		label,
		value,
		labelFormat,
		valueFormat = (v) => String(v),
		colorBy,
		legend = [],
		tooltip,
		height = 320,
		margin = { top: 32, right: 24, bottom: 48, left: 60 },
		source
	}: Props = $props();

	const items = $derived(data);
	const maxVal = $derived(Math.max(0, ...items.map((d) => Number(d[value]))));
	const defaultColor = 'var(--darkgrayblue)';
</script>

<ChartFrame {figure} {caption} {legend} {height} {margin} {source}>
	{#snippet body({ innerWidth, innerHeight, progress, setHover, clearHover }: ChartBodyContext)}
		{@const xScale = scaleBand<string>()
			.domain(items.map((d, i) => `${i}`))
			.range([0, innerWidth])
			.padding(0.35)}
		{@const yScale = scaleLinear().domain([0, maxVal]).nice().range([innerHeight, 0])}
		{@const yTicks = yScale.ticks(4)}

		{#each yTicks as t (t)}
			<line
				x1="0"
				x2={innerWidth}
				y1={yScale(t)}
				y2={yScale(t)}
				stroke="var(--ink)"
				stroke-opacity="0.08"
			/>
			<text x="-8" y={yScale(t)} text-anchor="end" dominant-baseline="middle" class="tick-label">
				{valueFormat(t)}
			</text>
		{/each}

		{#each items as d, i (i)}
			{@const v = Number(d[value])}
			{@const bx = xScale(`${i}`) ?? 0}
			{@const bw = xScale.bandwidth()}
			{@const fullBh = innerHeight - yScale(v)}
			{@const bh = fullBh * progress}
			{@const by = innerHeight - bh}
			{@const fill = colorBy ? colorBy(d) : defaultColor}
			<rect
				x={bx}
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
				x={bx + bw / 2}
				y={by - 8}
				text-anchor="middle"
				class="value-label"
				opacity={progress}
			>
				{valueFormat(v)}
			</text>
			<text x={bx + bw / 2} y={innerHeight + 18} text-anchor="middle" class="col-label">
				{labelFormat ? labelFormat(d) : String(d[label])}
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
