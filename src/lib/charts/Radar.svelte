<script lang="ts" generics="D extends Record<string, unknown>">
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
		colorBy?: (group: string) => string;
		legend?: LegendItem[];
		tooltip?: (d: D) => TooltipContent;
		levels?: number;
		fillOpacity?: number;
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
		levels = 4,
		fillOpacity = 0.18,
		height = 480,
		margin = { top: 32, right: 96, bottom: 32, left: 96 },
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
	const fallbackPalette = [
		'var(--darkgrayblue)',
		'var(--green)',
		'var(--orange)',
		'var(--midgrayblue)',
		'var(--midgreen)'
	];
	const colorFor = (g: string, i: number) =>
		colorBy ? colorBy(g) : fallbackPalette[i % fallbackPalette.length];

	type Pt = { x: number; y: number; record: D; group: string; cat: string; value: number };

	function axisAngle(i: number, n: number): number {
		// Start at top (12 o'clock) and rotate clockwise.
		return -Math.PI / 2 + (2 * Math.PI * i) / n;
	}

	function labelAnchor(angle: number): 'start' | 'middle' | 'end' {
		const cx = Math.cos(angle);
		if (Math.abs(cx) < 0.15) return 'middle';
		return cx > 0 ? 'start' : 'end';
	}
</script>

<ChartFrame {figure} {caption} {legend} {height} {margin} {source}>
	{#snippet body({ innerWidth, innerHeight, progress, setHover, clearHover }: ChartBodyContext)}
		{@const cx = innerWidth / 2}
		{@const cy = innerHeight / 2}
		{@const radius = Math.max(0, Math.min(innerWidth, innerHeight) / 2 - 8)}
		{@const n = categories.length}

		<!-- concentric reference rings -->
		{#each Array.from({ length: levels }, (_, i) => (i + 1) / levels) as frac (frac)}
			{@const pts = categories
				.map((_, i) => {
					const a = axisAngle(i, n);
					return `${cx + frac * radius * Math.cos(a)},${cy + frac * radius * Math.sin(a)}`;
				})
				.join(' ')}
			<polygon
				points={pts}
				fill="none"
				stroke="var(--ink)"
				stroke-opacity="0.08"
				stroke-width="1"
			/>
		{/each}

		<!-- axis spokes + tick labels on top axis -->
		{#each categories as cat, i (cat)}
			{@const a = axisAngle(i, n)}
			{@const ex = cx + radius * Math.cos(a)}
			{@const ey = cy + radius * Math.sin(a)}
			<line x1={cx} y1={cy} x2={ex} y2={ey} stroke="var(--ink)" stroke-opacity="0.15" />
			<text
				x={cx + (radius + 12) * Math.cos(a)}
				y={cy + (radius + 12) * Math.sin(a)}
				text-anchor={labelAnchor(a)}
				dominant-baseline="middle"
				class="col-label"
			>
				{cat}
			</text>
		{/each}

		<!-- tick labels along the top axis (0 to maxVal) -->
		{#each Array.from({ length: levels }, (_, i) => (i + 1) / levels) as frac (`tick-${frac}`)}
			<text
				x={cx + 4}
				y={cy - frac * radius}
				dominant-baseline="middle"
				class="tick-label"
			>
				{Math.round(frac * maxVal)}
			</text>
		{/each}

		<!-- one polygon per group -->
		{#each groups as g, gi (g)}
			{@const color = colorFor(g, gi)}
			{@const pts = categories.map((cat, i) => {
				const a = axisAngle(i, n);
				const rec = data.find(
					(d) => String(d[category]) === cat && String(d[group]) === g
				);
				const v = rec ? Number(rec[value]) : 0;
				const dist = maxVal === 0 ? 0 : (v / maxVal) * radius * progress;
				return {
					x: cx + dist * Math.cos(a),
					y: cy + dist * Math.sin(a),
					record: rec as D,
					group: g,
					cat,
					value: v
				} satisfies Pt;
			})}
			<polygon
				points={pts.map((p) => `${p.x},${p.y}`).join(' ')}
				fill={color}
				fill-opacity={fillOpacity}
				stroke={color}
				stroke-width="1.5"
				stroke-linejoin="round"
				style="pointer-events: none;"
			/>
			{#each pts as p, i (`${g}-${i}`)}
				{#if p.record}
					<circle
						cx={p.x}
						cy={p.y}
						r="4"
						fill={color}
						stroke="var(--paper)"
						stroke-width="1.5"
						style="cursor: crosshair;"
						onpointerenter={(e) => tooltip && setHover(tooltip(p.record), e)}
						onpointermove={(e) => tooltip && setHover(tooltip(p.record), e)}
						onpointerleave={clearHover}
						role="presentation"
					/>
				{/if}
			{/each}
		{/each}
	{/snippet}
</ChartFrame>
