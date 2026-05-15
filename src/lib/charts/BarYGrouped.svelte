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
		category: keyof D;
		group: keyof D;
		value: keyof D;
		colorBy?: (d: D) => string;
		legend?: LegendItem[];
		tooltip?: (d: D) => TooltipContent;
		labelRotate?: number;
		height?: number;
		margin?: ChartMargin;
		source?: string;
	};

	let {
		figure,
		caption,
		data,
		category,
		group,
		value,
		colorBy,
		legend = [],
		tooltip,
		labelRotate = 0,
		height = 380,
		margin = { top: 24, right: 16, bottom: 80, left: 40 },
		source
	}: Props = $props();

	function uniqueInOrder(values: string[]): string[] {
		const out: string[] = [];
		const seen = new Set<string>();
		for (const v of values) {
			if (!seen.has(v)) {
				seen.add(v);
				out.push(v);
			}
		}
		return out;
	}

	const categories = $derived(uniqueInOrder(data.map((d) => String(d[category]))));
	const groups = $derived(uniqueInOrder(data.map((d) => String(d[group]))));
	const maxVal = $derived(Math.max(0, ...data.map((d) => Number(d[value]))));

	const defaultColor = 'var(--darkgrayblue)';
</script>

<ChartFrame {figure} {caption} {legend} {height} {margin} {source}>
	{#snippet body({ innerWidth, innerHeight, progress, setHover, clearHover }: ChartBodyContext)}
		{@const xScale = scaleBand<string>().domain(categories).range([0, innerWidth]).padding(0.25)}
		{@const xSubScale = scaleBand<string>()
			.domain(groups)
			.range([0, xScale.bandwidth()])
			.padding(0.12)}
		{@const yScale = scaleLinear().domain([0, maxVal]).nice().range([innerHeight, 0])}
		{@const yTicks = yScale.ticks(5)}

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
				{t}
			</text>
		{/each}

		{#each data as d, i (i)}
			{@const cat = String(d[category])}
			{@const grp = String(d[group])}
			{@const v = Number(d[value])}
			{@const gx = xScale(cat) ?? 0}
			{@const bx = xSubScale(grp) ?? 0}
			{@const bw = xSubScale.bandwidth()}
			{@const fullBh = innerHeight - yScale(v)}
			{@const bh = fullBh * progress}
			{@const by = innerHeight - bh}
			{@const fill = colorBy ? colorBy(d) : defaultColor}
			<rect
				x={gx + bx}
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
		{/each}

		<line
			x1="0"
			x2={innerWidth}
			y1={innerHeight}
			y2={innerHeight}
			stroke="var(--ink)"
			stroke-opacity="0.4"
		/>

		{#each categories as cat (cat)}
			{@const cx = (xScale(cat) ?? 0) + xScale.bandwidth() / 2}
			<g transform="translate({cx},{innerHeight + 8})">
				{#if labelRotate}
					<text class="col-label" text-anchor="end" transform="rotate({labelRotate})">
						{cat}
					</text>
				{:else}
					<text class="col-label" text-anchor="middle" dominant-baseline="hanging">
						{cat}
					</text>
				{/if}
			</g>
		{/each}
	{/snippet}
</ChartFrame>
