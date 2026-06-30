<!--
	SearchVolumeLineChart — bento cell visualizing 5y of mock CAR-T search
	volume. Plausible shape: slow base 2021-22, inflection mid-2023 as the
	autoimmune-indication CAR-T programs broke into the press, steep ramp
	through 2024-25. Data is hand-authored (clearly marked illustrative);
	the chart logic is generic, so a real series can be dropped in by
	replacing CAR_T_SEARCH_SERIES.

	Animation: the line path is drawn with stroke-dasharray equal to its
	measured length, and stroke-dashoffset transitions from `length` → 0 on
	mount over 1.6s — a left-to-right reveal cued by the cell coming into
	the viewport.

	Renders inside the project bento card frame: title row + figure + line
	stage + caption. No SVG axes (Aaron's bento direction is restrained);
	just a faint baseline + endpoint markers.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import type { BentoSize } from './types';

	type Point = { month: string; value: number };

	type Props = {
		size?: BentoSize;
		eyebrow?: string;
		title?: string;
		caption?: string;
	};

	let {
		size = 'lg',
		eyebrow = 'Digital signal',
		title = 'CAR-T cell therapy — 5y search volume',
		caption = 'Mock series shaped to mirror the public-trend lift around the autoimmune-indication CAR-T programs (KYV-101, CABA-201, DSC-08). Monthly normalized search interest, US.'
	}: Props = $props();

	// 60 months, Jan 2021 → Dec 2025. Hand-authored shape:
	//   2021: baseline ~5k–8k, mild rise
	//   2022: stable plateau, occasional press spike
	//   2023: lupus-CAR-T announcements (mid-yr inflection)
	//   2024: rapid ramp on phase-1 readouts
	//   2025: continues climb, 8x baseline
	const CAR_T_SEARCH_SERIES: Point[] = [
		// 2021
		{ month: '2021-01', value: 5200 },
		{ month: '2021-02', value: 5400 },
		{ month: '2021-03', value: 5700 },
		{ month: '2021-04', value: 6100 },
		{ month: '2021-05', value: 6200 },
		{ month: '2021-06', value: 6400 },
		{ month: '2021-07', value: 6600 },
		{ month: '2021-08', value: 6700 },
		{ month: '2021-09', value: 7000 },
		{ month: '2021-10', value: 7300 },
		{ month: '2021-11', value: 7500 },
		{ month: '2021-12', value: 7400 },
		// 2022
		{ month: '2022-01', value: 7800 },
		{ month: '2022-02', value: 8100 },
		{ month: '2022-03', value: 8400 },
		{ month: '2022-04', value: 8200 },
		{ month: '2022-05', value: 8700 },
		{ month: '2022-06', value: 9100 },
		{ month: '2022-07', value: 9000 },
		{ month: '2022-08', value: 9400 },
		{ month: '2022-09', value: 9800 },
		{ month: '2022-10', value: 10200 },
		{ month: '2022-11', value: 10500 },
		{ month: '2022-12', value: 10300 },
		// 2023 — inflection mid-year (autoimmune-CAR-T NEJM coverage)
		{ month: '2023-01', value: 11000 },
		{ month: '2023-02', value: 11400 },
		{ month: '2023-03', value: 12200 },
		{ month: '2023-04', value: 13600 },
		{ month: '2023-05', value: 15400 },
		{ month: '2023-06', value: 18900 },
		{ month: '2023-07', value: 21200 },
		{ month: '2023-08', value: 23800 },
		{ month: '2023-09', value: 25600 },
		{ month: '2023-10', value: 27100 },
		{ month: '2023-11', value: 29500 },
		{ month: '2023-12', value: 28800 },
		// 2024 — rapid ramp on phase-1 readouts
		{ month: '2024-01', value: 32100 },
		{ month: '2024-02', value: 34500 },
		{ month: '2024-03', value: 37200 },
		{ month: '2024-04', value: 40300 },
		{ month: '2024-05', value: 43800 },
		{ month: '2024-06', value: 47100 },
		{ month: '2024-07', value: 49600 },
		{ month: '2024-08', value: 52400 },
		{ month: '2024-09', value: 55800 },
		{ month: '2024-10', value: 58300 },
		{ month: '2024-11', value: 60700 },
		{ month: '2024-12', value: 59900 },
		// 2025 — continues climb
		{ month: '2025-01', value: 63200 },
		{ month: '2025-02', value: 65800 },
		{ month: '2025-03', value: 68400 },
		{ month: '2025-04', value: 70100 },
		{ month: '2025-05', value: 72500 },
		{ month: '2025-06', value: 74800 },
		{ month: '2025-07', value: 75900 },
		{ month: '2025-08', value: 77200 },
		{ month: '2025-09', value: 78600 },
		{ month: '2025-10', value: 79900 },
		{ month: '2025-11', value: 80800 },
		{ month: '2025-12', value: 81400 }
	];

	const data = CAR_T_SEARCH_SERIES;
	const latest = data[data.length - 1];
	const earliest = data[0];
	const peakValue = Math.max(...data.map((d) => d.value));
	const liftMultiple = (latest.value / earliest.value).toFixed(1);

	// Chart geometry — fits a 2/3-bento card. Aspect-ratio preserved via the
	// preserveAspectRatio attribute on the SVG.
	const W = 720;
	const H = 220;
	const PAD = { l: 16, r: 24, t: 24, b: 28 };
	const innerW = W - PAD.l - PAD.r;
	const innerH = H - PAD.t - PAD.b;

	const x = (i: number) => PAD.l + (i / (data.length - 1)) * innerW;
	const y = (v: number) => PAD.t + (1 - v / peakValue) * innerH;

	// Smooth-ish path via cardinal-like cubic interpolation. Pulling in d3-shape
	// would be cleaner but the chart's a one-off bento element — keep deps lean.
	const linePath = (() => {
		if (data.length < 2) return '';
		const pts = data.map((d, i) => ({ x: x(i), y: y(d.value) }));
		const out: string[] = [`M ${pts[0].x.toFixed(2)} ${pts[0].y.toFixed(2)}`];
		for (let i = 0; i < pts.length - 1; i++) {
			const p0 = pts[Math.max(0, i - 1)];
			const p1 = pts[i];
			const p2 = pts[i + 1];
			const p3 = pts[Math.min(pts.length - 1, i + 2)];
			const cp1x = p1.x + (p2.x - p0.x) / 6;
			const cp1y = p1.y + (p2.y - p0.y) / 6;
			const cp2x = p2.x - (p3.x - p1.x) / 6;
			const cp2y = p2.y - (p3.y - p1.y) / 6;
			out.push(
				`C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`
			);
		}
		return out.join(' ');
	})();

	const areaPath = (() => {
		if (!linePath) return '';
		const last = data[data.length - 1];
		return `${linePath} L ${x(data.length - 1).toFixed(2)} ${(PAD.t + innerH).toFixed(2)} L ${PAD.l.toFixed(2)} ${(PAD.t + innerH).toFixed(2)} Z`;
	})();

	// Stroke-dashoffset animation. Measure the line length once the path
	// mounts; transition dashoffset from `length` (fully hidden) → 0 (fully
	// drawn). Re-runs only on first mount — the value is hand-authored so a
	// data swap is rare.
	let pathEl = $state<SVGPathElement | null>(null);
	let pathLength = $state(0);
	let revealed = $state(false);

	onMount(() => {
		if (!pathEl) return;
		pathLength = pathEl.getTotalLength();
		// One paint with offset=length so it's invisible, then flip the flag on
		// next frame so the CSS transition runs the reveal.
		requestAnimationFrame(() => {
			requestAnimationFrame(() => {
				revealed = true;
			});
		});
	});

	// Year-tick labels at every January (12 months apart).
	const yearTicks = data
		.map((d, i) => ({ i, year: d.month.slice(0, 4), month: d.month.slice(5, 7) }))
		.filter((t) => t.month === '01' || t.month === '12');

	const compact = $derived(size === 'sm');
</script>

<article class="card" data-size={size}>
	<header class="head">
		<span class="eyebrow">{eyebrow}</span>
		<h3 class="title">{title}</h3>
	</header>

	<div class="figure-row">
		<div class="figure-stat">
			<span class="figure">{liftMultiple}×</span>
			<span class="figure-label">5y lift in search interest</span>
		</div>
		<div class="figure-secondary">
			<span class="value">{(latest.value / 1000).toFixed(0)}k</span>
			<span class="value-label">monthly searches · {latest.month}</span>
		</div>
	</div>

	<div class="stage">
		<svg viewBox="0 0 {W} {H}" preserveAspectRatio="none" class="chart" aria-hidden="true">
			<!-- Baseline -->
			<line
				x1={PAD.l}
				x2={W - PAD.r}
				y1={PAD.t + innerH}
				y2={PAD.t + innerH}
				class="baseline"
			/>
			<!-- Year tick gutters -->
			{#each yearTicks as t (t.i + t.month)}
				<line
					x1={x(t.i)}
					x2={x(t.i)}
					y1={PAD.t + innerH}
					y2={PAD.t + innerH + 4}
					class="tick"
				/>
			{/each}

			<!-- Filled area (drawn first so the line sits above it) -->
			<path
				d={areaPath}
				class="area"
				class:area-revealed={revealed}
			/>

			<!-- The line itself — animated via stroke-dashoffset -->
			<path
				bind:this={pathEl}
				d={linePath}
				class="line"
				style:stroke-dasharray={pathLength || 'none'}
				style:stroke-dashoffset={revealed ? 0 : pathLength}
			/>

			<!-- Endpoint dot — appears once the line completes -->
			{#if data.length}
				<circle
					cx={x(data.length - 1)}
					cy={y(data[data.length - 1].value)}
					r="4"
					class="endpoint"
					class:endpoint-revealed={revealed}
				/>
			{/if}
		</svg>

		<!-- Year axis labels under the SVG so the gutter ticks have context. -->
		{#if !compact}
			<div class="year-axis" aria-hidden="true">
				{#each ['2021', '2022', '2023', '2024', '2025'] as yr (yr)}
					<span>{yr}</span>
				{/each}
			</div>
		{/if}
	</div>

	{#if caption && !compact}
		<p class="caption">{caption}</p>
	{/if}
</article>

<style>
	.card {
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
		height: 100%;
		min-width: 0;
		padding: 1.5rem 1.75rem;
		border: 1px solid rgba(48, 47, 40, 0.12);
		border-radius: 12px;
		background: rgba(255, 254, 250, 0.85);
	}
	.head {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}
	.eyebrow {
		font-family: var(--font-mono);
		font-size: 0.62rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--accent-mint, #047857);
	}
	.title {
		font-family: var(--font-heading, 'Jost', sans-serif);
		font-weight: 500;
		font-size: 1.15rem;
		line-height: 1.2;
		letter-spacing: -0.01em;
		color: var(--ink, #312f28);
		margin: 0;
		text-wrap: balance;
	}
	.figure-row {
		display: flex;
		align-items: baseline;
		gap: 1.5rem;
		flex-wrap: wrap;
	}
	.figure-stat {
		display: flex;
		align-items: baseline;
		gap: 0.55rem;
	}
	.figure {
		font-family: var(--font-heading, 'Jost', sans-serif);
		font-weight: 500;
		font-size: 2.5rem;
		line-height: 0.95;
		letter-spacing: -0.02em;
		font-variant-numeric: tabular-nums;
		color: var(--accent-mint, #047857);
	}
	.figure-label {
		font-family: var(--font-mono);
		font-size: 0.7rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--muted-foreground, #6b7280);
	}
	.figure-secondary {
		display: flex;
		align-items: baseline;
		gap: 0.4rem;
		margin-left: auto;
		color: var(--secondary-foreground, #312f28);
	}
	.figure-secondary .value {
		font-family: var(--font-heading, 'Jost', sans-serif);
		font-weight: 500;
		font-size: 1.05rem;
		font-variant-numeric: tabular-nums;
	}
	.figure-secondary .value-label {
		font-family: var(--font-mono);
		font-size: 0.62rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--muted-foreground, #6b7280);
	}
	.stage {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		flex: 1;
		min-height: 0;
	}
	.chart {
		width: 100%;
		flex: 1;
		min-height: 8rem;
	}
	.baseline {
		stroke: rgba(48, 47, 40, 0.22);
		stroke-width: 1;
	}
	.tick {
		stroke: rgba(48, 47, 40, 0.32);
		stroke-width: 1;
	}
	.line {
		fill: none;
		stroke: var(--accent-mint, #047857);
		stroke-width: 2.25;
		stroke-linecap: round;
		stroke-linejoin: round;
		transition: stroke-dashoffset 1.6s ease-out;
	}
	.area {
		fill: var(--accent-mint, #047857);
		opacity: 0;
		transition: opacity 1.6s ease-out 0.4s;
	}
	.area-revealed {
		opacity: 0.12;
	}
	.endpoint {
		fill: var(--accent-mint, #047857);
		opacity: 0;
		transition: opacity 0.35s ease-out 1.5s;
	}
	.endpoint-revealed {
		opacity: 1;
	}
	.year-axis {
		display: grid;
		grid-template-columns: repeat(5, 1fr);
		font-family: var(--font-mono);
		font-size: 0.62rem;
		color: var(--muted-foreground, #6b7280);
		letter-spacing: 0.04em;
		padding: 0 0.5rem;
	}
	.year-axis span:nth-child(1) {
		text-align: left;
	}
	.year-axis span:nth-child(5) {
		text-align: right;
	}
	.year-axis span:not(:first-child):not(:last-child) {
		text-align: center;
	}
	.caption {
		font-family: var(--font-body, 'IBM Plex Sans', system-ui);
		font-size: 0.78rem;
		line-height: 1.5;
		color: var(--secondary-foreground, #312f28);
		margin: 0;
		text-wrap: pretty;
	}
	.card[data-size='sm'] .figure {
		font-size: 1.8rem;
	}
	.card[data-size='sm'] .title {
		font-size: 0.95rem;
	}
</style>
