<script lang="ts" generics="D extends Record<string, unknown>">
	import { scaleBand, scaleLinear } from 'd3-scale';
	import ChartFrame, {
		type ChartBodyContext,
		type ChartMargin,
		type LegendItem,
		type TooltipContent
	} from './ChartFrame.svelte';

	type Series = 'bar' | 'line';

	type Props = {
		figure: string | number;
		caption: string;
		data: D[];
		/** X-axis category key. */
		label: keyof D;
		/** Key whose value is drawn as bars (left Y axis). */
		bar: keyof D;
		/** Key whose value is drawn as a line (right Y axis). Nulls create gaps. */
		line: keyof D;
		labelFormat?: (d: D) => string;
		barValueFormat?: (v: number) => string;
		lineValueFormat?: (v: number) => string;
		barColor?: string | ((d: D) => string);
		lineColor?: string;
		barAxisLabel?: string;
		lineAxisLabel?: string;
		showBarValues?: boolean;
		showLineValues?: boolean;
		legend?: LegendItem[];
		tooltip?: (d: D, series: Series) => TooltipContent;
		height?: number;
		margin?: ChartMargin;
		source?: string;
	};

	let {
		figure,
		caption,
		data,
		label,
		bar,
		line,
		labelFormat,
		barValueFormat = (v) => String(v),
		lineValueFormat = (v) => String(v),
		barColor = 'var(--darkgrayblue)',
		lineColor = 'var(--orange)',
		barAxisLabel,
		lineAxisLabel,
		showBarValues = true,
		showLineValues = true,
		legend = [],
		tooltip,
		height = 340,
		margin = { top: 32, right: 56, bottom: 48, left: 56 },
		source
	}: Props = $props();

	const items = $derived(data);
	const maxBar = $derived(Math.max(0, ...items.map((d) => Number(d[bar]) || 0)));

	const lineValues = $derived(
		items.map((d) => d[line]).filter((v): v is D[keyof D] => v != null).map((v) => Number(v))
	);
	const maxLine = $derived(lineValues.length ? Math.max(...lineValues) : 0);
	const minLine = $derived(lineValues.length ? Math.min(0, ...lineValues) : 0);

	const resolveBarColor = (d: D) =>
		typeof barColor === 'function' ? barColor(d) : barColor;

	/** Build a line path, breaking the stroke wherever a point is null. */
	function buildLinePath(pts: ({ x: number; y: number } | null)[]): string {
		let path = '';
		let penDown = false;
		for (const p of pts) {
			if (!p) {
				penDown = false;
				continue;
			}
			path += `${penDown ? ' L' : ' M'}${p.x},${p.y}`;
			penDown = true;
		}
		return path.trim();
	}
</script>

<ChartFrame {figure} {caption} {legend} {height} {margin} {source}>
	{#snippet body({ innerWidth, innerHeight, progress, setHover, clearHover }: ChartBodyContext)}
		{@const xScale = scaleBand<string>()
			.domain(items.map((_, i) => `${i}`))
			.range([0, innerWidth])
			.padding(0.35)}
		{@const barScale = scaleLinear().domain([0, maxBar]).nice().range([innerHeight, 0])}
		{@const lineScale = scaleLinear()
			.domain([minLine, maxLine])
			.nice()
			.range([innerHeight, 0])}
		{@const barTicks = barScale.ticks(4)}
		{@const lineTicks = lineScale.ticks(4)}
		{@const linePts = items.map((d, i) => {
			const raw = d[line];
			if (raw == null) return null;
			return {
				x: (xScale(`${i}`) ?? 0) + xScale.bandwidth() / 2,
				y: lineScale(Number(raw))
			};
		})}
		{@const linePath = buildLinePath(linePts)}

		<!-- horizontal grid + left (bar) axis ticks -->
		{#each barTicks as t (t)}
			<line
				x1="0"
				x2={innerWidth}
				y1={barScale(t)}
				y2={barScale(t)}
				stroke="var(--ink)"
				stroke-opacity="0.08"
			/>
			<text
				x="-8"
				y={barScale(t)}
				text-anchor="end"
				dominant-baseline="middle"
				class="tick-label"
			>
				{barValueFormat(t)}
			</text>
		{/each}

		<!-- right (line) axis ticks -->
		{#each lineTicks as t (`line-${t}`)}
			<text
				x={innerWidth + 8}
				y={lineScale(t)}
				text-anchor="start"
				dominant-baseline="middle"
				class="tick-label"
				style="fill: {lineColor}; fill-opacity: 0.75;"
			>
				{lineValueFormat(t)}
			</text>
		{/each}

		{#if barAxisLabel}
			<text
				transform="translate({-margin.left + 14},{innerHeight / 2}) rotate(-90)"
				text-anchor="middle"
				class="axis-caption"
			>
				{barAxisLabel}
			</text>
		{/if}
		{#if lineAxisLabel}
			<text
				transform="translate({innerWidth + margin.right - 14},{innerHeight / 2}) rotate(90)"
				text-anchor="middle"
				class="axis-caption"
				style="fill: {lineColor};"
			>
				{lineAxisLabel}
			</text>
		{/if}

		<!-- bars -->
		{#each items as d, i (i)}
			{@const v = Number(d[bar]) || 0}
			{@const bx = xScale(`${i}`) ?? 0}
			{@const bw = xScale.bandwidth()}
			{@const fullBh = innerHeight - barScale(v)}
			{@const bh = fullBh * progress}
			{@const by = innerHeight - bh}
			<rect
				x={bx}
				y={by}
				width={bw}
				height={bh}
				fill={resolveBarColor(d)}
				style="transition: opacity 200ms ease;"
				onpointerenter={(e) => tooltip && setHover(tooltip(d, 'bar'), e)}
				onpointermove={(e) => tooltip && setHover(tooltip(d, 'bar'), e)}
				onpointerleave={clearHover}
				role="presentation"
			/>
			{#if showBarValues}
				<text
					x={bx + bw / 2}
					y={by - 8}
					text-anchor="middle"
					class="value-label"
					opacity={progress}
				>
					{barValueFormat(v)}
				</text>
			{/if}
			<text x={bx + bw / 2} y={innerHeight + 18} text-anchor="middle" class="col-label">
				{labelFormat ? labelFormat(d) : String(d[label])}
			</text>
		{/each}

		<!-- baseline -->
		<line
			x1="0"
			x2={innerWidth}
			y1={innerHeight}
			y2={innerHeight}
			stroke="var(--ink)"
			stroke-opacity="0.4"
		/>

		<!-- line (drawn on via normalised pathLength) -->
		{#if linePath}
			<path
				d={linePath}
				fill="none"
				stroke={lineColor}
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
				pathLength="1"
				stroke-dasharray="1"
				stroke-dashoffset={1 - progress}
				style="pointer-events: none;"
			/>
		{/if}

		<!-- line points -->
		{#each items as d, i (`pt-${i}`)}
			{@const p = linePts[i]}
			{#if p}
				{@const lv = Number(d[line])}
				<circle
					cx={p.x}
					cy={p.y}
					r="4"
					fill={lineColor}
					stroke="var(--paper)"
					stroke-width="1.5"
					opacity={progress}
					style="cursor: crosshair;"
					onpointerenter={(e) => tooltip && setHover(tooltip(d, 'line'), e)}
					onpointermove={(e) => tooltip && setHover(tooltip(d, 'line'), e)}
					onpointerleave={clearHover}
					role="presentation"
				/>
				{#if showLineValues}
					<text
						x={p.x}
						y={p.y - 12}
						text-anchor="middle"
						class="value-label"
						style="fill: {lineColor};"
						opacity={progress}
					>
						{lineValueFormat(lv)}
					</text>
				{/if}
			{/if}
		{/each}
	{/snippet}
</ChartFrame>
