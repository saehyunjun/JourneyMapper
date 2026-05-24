<!--
	SemiArcChart — concentric radial-progress (semi-arc gauge) chart.

	N concentric semi-circular background tracks sit at fixed radii. On mount
	(or when replayKey changes), each colored fill arc sweeps from the left end
	to its proportional share of the total, staggered so inner arcs reveal first.
-->
<script lang="ts">
	import { untrack } from 'svelte';
	import { animateProgress } from '$lib/charts/reveal';

	type Datum = { label: string; value: number; color: string };

	let {
		data,
		size = 320,
		animate = false,
		replayKey = 0
	}: { data: Datum[]; size?: number; animate?: boolean; replayKey?: number } = $props();

	const SIDE_PAD = 8;
	const BOTTOM_PAD = 10;
	const MIN_INNER_R = 16;
	const MAX_STROKE = 16;
	const MIN_STROKE = 5;
	// Each arc starts animating this fraction into the total duration after the previous.
	const STAGGER = 0.25;

	const total = $derived(data.reduce((s, d) => s + d.value, 0) || 1);
	const n = $derived(data.length);
	const outerR = $derived((size - SIDE_PAD * 2) / 2);
	const spacing = $derived(n > 1 ? (outerR - MIN_INNER_R) / (n - 1) : 0);
	const stroke = $derived(Math.min(MAX_STROKE, Math.max(MIN_STROKE, spacing - 3)));

	const cx = $derived(size / 2);
	const cy = $derived(outerR + BOTTOM_PAD);
	const svgH = $derived(cy + BOTTOM_PAD);

	const arcs = $derived(
		data.map((d, i) => {
			const r = n === 1 ? outerR : MIN_INNER_R + i * spacing;
			const circ = Math.PI * r;
			const frac = d.value / total;
			return { ...d, r, circ, frac };
		})
	);

	// Counterclockwise from left to right → arc passes through the top (arch shape)
	function arcPath(r: number): string {
		return `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`;
	}

	// Arc i begins animating at progress = i * STAGGER and reaches its target at 1.
	function localProgress(t: number, i: number): number {
		const s = i * STAGGER;
		if (t <= s) return 0;
		return Math.min(1, (t - s) / (1 - s));
	}

	// Single shared progress value driven by animateProgress rAF loop.
	// Using untrack so the initial value doesn't count as a reactive read.
	let progress = $state(untrack(() => (animate ? 0 : 1)));

	$effect(() => {
		void replayKey;
		if (animate) {
			progress = 0;
			// Return the cancel fn so Svelte cleans up if the effect re-runs.
			return animateProgress(1000, (t) => (progress = t));
		} else {
			progress = 1;
		}
	});
</script>

<svg width={size} height={svgH} role="img" aria-label="Sentiment distribution arc chart">
	{#each arcs as arc, i (i)}
		{@const path = arcPath(arc.r)}
		{@const lp = localProgress(progress, i)}
		<!-- Full-semicircle background track -->
		<path
			d={path}
			fill="none"
			stroke="var(--color-muted-foreground, #94a3b8)"
			stroke-opacity="0.25"
			stroke-width={stroke}
			stroke-linecap="round"
		/>
		<!-- Colored fill sweeping to its proportional share -->
		<path
			d={path}
			fill="none"
			stroke={arc.color}
			stroke-width={stroke}
			stroke-linecap="round"
			stroke-dasharray={arc.circ}
			stroke-dashoffset={arc.circ * (1 - lp * arc.frac)}
		/>
	{/each}
</svg>
