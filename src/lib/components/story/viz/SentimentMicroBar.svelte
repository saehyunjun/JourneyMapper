
<!--
	SentimentMicroBar — tiny horizontal stacked bar (positive / neutral /
	negative) for surfacing per-driver sentiment under a hero metric. Used
	in the "drivers" zone on hero-stat slides so each evidence row carries
	its own sentiment shape, not just a count.
-->
<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { animateProgress } from '$lib/charts/reveal';

	let {
		positive = 0,
		neutral = 0,
		negative = 0,
		width = 120,
		height = 6,
		duration = 700,
		delay = 0,
		replayKey = 0
	}: {
		positive?: number;
		neutral?: number;
		negative?: number;
		width?: number;
		height?: number;
		duration?: number;
		delay?: number;
		replayKey?: number;
	} = $props();

	const total = $derived(positive + neutral + negative);

	let progress = $state(0);

	function play() {
		progress = 0;
		setTimeout(() => {
			animateProgress(duration, (t) => {
				progress = t;
			});
		}, delay);
	}

	onMount(play);

	$effect(() => {
		void replayKey;
		untrack(play);
	});

	const widths = $derived(
		total > 0
			? {
				pos: (positive / total) * width * progress,
				neu: (neutral / total) * width * progress,
				neg: (negative / total) * width * progress
			}
			: { pos: 0, neu: 0, neg: 0 }
	);
</script>

<div
	class="micro-bar"
	style="width: {width}px; height: {height}px;"
	role="img"
	aria-label="{positive} positive, {neutral} neutral, {negative} negative"
>
	<div class="seg" style="width: {widths.pos}px; background: #34d399;"></div>
	<div class="seg" style="width: {widths.neu}px; background: #e2e8f0;"></div>
	<div class="seg" style="width: {widths.neg}px; background: #fb7185;"></div>
</div>

<style>
	.micro-bar {
		display: flex;
		align-items: stretch;
		overflow: hidden;
		border-radius: 999px;
		background: rgba(48, 47, 40, 0.06);
	}
	.seg {
		height: 100%;
		transition: width 200ms linear;
	}
</style>
