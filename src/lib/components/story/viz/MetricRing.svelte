
<!--
	MetricRing — single-value ring chart.

	One large arc sweeping from the top of a circle to its proportional share
	of `total`. Unlike SentimentDonut (three bands) this draws ONE band on a
	muted track — for "X out of Y" style hero metrics where the slide carries
	a single data point. Story-mode motion only.
-->
<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { animateProgress } from '$lib/charts/reveal';

	let {
		value,
		total,
		size = 220,
		color = 'var(--accent-mint, #599077)',
		track = 'rgba(48, 47, 40, 0.08)',
		strokeRatio = 0.11,
		duration = 1200,
		delay = 200,
		replayKey = 0,
		showLabel = true,
		labelSuffix = '%'
	}: {
		value: number;
		total: number;
		size?: number;
		color?: string;
		track?: string;
		strokeRatio?: number;
		duration?: number;
		delay?: number;
		replayKey?: number;
		showLabel?: boolean;
		labelSuffix?: string;
	} = $props();

	const stroke = $derived(Math.max(6, Math.round(size * strokeRatio)));
	const radius = $derived((size - stroke) / 2);
	const circumference = $derived(2 * Math.PI * radius);
	const fraction = $derived(total > 0 ? Math.max(0, Math.min(1, value / total)) : 0);
	const pct = $derived(Math.round(fraction * 100));

	let drawn = $state(0);
	let labelValue = $state(0);

	function play() {
		drawn = 0;
		labelValue = 0;
		setTimeout(() => {
			animateProgress(duration, (t) => {
				drawn = fraction * t;
				labelValue = pct * t;
			});
		}, delay);
	}

	onMount(play);

	$effect(() => {
		void replayKey;
		void fraction;
		untrack(play);
	});

	const dash = $derived(drawn * circumference);
</script>

<div class="metric-ring" style="width: {size}px; height: {size}px;">
	<svg width={size} height={size} viewBox="0 0 {size} {size}" role="img" aria-label="{pct}%">
		<g transform="rotate(-90 {size / 2} {size / 2})">
			<circle
				cx={size / 2}
				cy={size / 2}
				r={radius}
				fill="none"
				stroke={track}
				stroke-width={stroke}
			/>
			<circle
				cx={size / 2}
				cy={size / 2}
				r={radius}
				fill="none"
				stroke={color}
				stroke-width={stroke}
				stroke-dasharray="{dash} {circumference - dash}"
				stroke-linecap="round"
			/>
		</g>
	</svg>
	{#if showLabel}
		<span class="metric-label font-heading tabular-nums" style="color: {color};">
			{Math.round(labelValue)}<span class="metric-suffix">{labelSuffix}</span>
		</span>
	{/if}
</div>

<style>
	.metric-ring {
		position: relative;
		display: inline-flex;
		align-items: center;
		justify-content: center;
	}
	.metric-label {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		font-weight: 700;
		font-size: clamp(2rem, 5vw, 3rem);
		line-height: 1;
		letter-spacing: -0.02em;
	}
	.metric-suffix {
		font-size: 0.55em;
		margin-left: 0.1em;
		font-weight: 500;
	}
</style>
