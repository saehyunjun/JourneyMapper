<!--
	MiniDonut — a small, self-sizing donut for label/value/color series.

	Used by the distribution block for sentiment or theme splits. When `animate`
	is set it sweeps clockwise into place on reveal (and on export replay).
-->
<script lang="ts">
	import { untrack } from 'svelte';
	import { pie, arc, type PieArcDatum } from 'd3-shape';
	import { reveal, animateProgress } from '$lib/charts/reveal';

	type Datum = { label: string; value: number; color: string };

	let {
		data,
		size = 200,
		thickness = 34,
		animate = false,
		replayKey = 0
	}: { data: Datum[]; size?: number; thickness?: number; animate?: boolean; replayKey?: number } = $props();

	const total = $derived(data.reduce((s, d) => s + d.value, 0));
	const radius = $derived(size / 2);

	const slices = $derived(
		pie<Datum>()
			.sort(null)
			.value((d) => d.value)(data)
	);

	let progress = $state(untrack(() => (animate ? 0 : 1)));
	function start() {
		if (animate) animateProgress(850, (t) => (progress = t));
		else progress = 1;
	}
	// Restart the sweep when the parent bumps replayKey (GIF export).
	$effect(() => {
		void replayKey;
		if (animate) {
			progress = 0;
			animateProgress(850, (t) => (progress = t));
		}
	});

	function path(s: PieArcDatum<Datum>): string {
		const sweep = 2 * Math.PI * progress;
		const end = Math.min(s.endAngle, sweep);
		if (end <= s.startAngle) return '';
		const g = arc()
			.innerRadius(radius - thickness)
			.outerRadius(radius)
			.startAngle(s.startAngle)
			.endAngle(end);
		return g(null as never) ?? '';
	}
</script>

<div class="flex flex-col items-center gap-3" use:reveal={{ onReveal: start, once: true }}>
	<svg width={size} height={size} viewBox="0 0 {size} {size}" role="img" aria-label="Distribution donut">
		<g transform="translate({radius},{radius})">
			{#each slices as s, i (i)}
				<path d={path(s)} fill={s.data.color} />
			{/each}
			<text text-anchor="middle" dominant-baseline="middle" dy="-2" class="fill-slate-800" style="font-size: 1.4rem; font-weight: 600; font-family: var(--font-body);">{total}</text>
			<text text-anchor="middle" dominant-baseline="middle" dy="18" class="fill-slate-400" style="font-size: 0.7rem;">total</text>
		</g>
	</svg>
	<ul class="flex flex-wrap justify-center gap-x-3 gap-y-1 text-xs text-slate-600">
		{#each data as d (d.label)}
			<li class="flex items-center gap-1.5">
				<span class="inline-block size-2.5 rounded-full" style="background: {d.color};"></span>
				{d.label} <span class="text-slate-400">({d.value})</span>
			</li>
		{/each}
	</ul>
</div>
