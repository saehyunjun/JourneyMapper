
<!--
	WaffleStat — N-of-M filled cells.

	A grid of squares; cells fill in sequence to represent the value as a
	fraction of the total. Used for "8 out of 10" style hero metrics where a
	discrete count communicates faster than a percentage. Cells stagger in.
-->
<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { animateProgress } from '$lib/charts/reveal';

	let {
		value,
		total,
		cols = 5,
		cellSize = 36,
		gap = 6,
		color = 'var(--accent-mint, #599077)',
		track = 'rgba(48, 47, 40, 0.1)',
		duration = 1100,
		delay = 200,
		replayKey = 0
	}: {
		value: number;
		total: number;
		cols?: number;
		cellSize?: number;
		gap?: number;
		color?: string;
		track?: string;
		duration?: number;
		delay?: number;
		replayKey?: number;
	} = $props();

	const safeTotal = $derived(Math.max(1, Math.round(total)));
	const safeValue = $derived(Math.max(0, Math.min(safeTotal, Math.round(value))));
	const rows = $derived(Math.ceil(safeTotal / cols));

	let drawn = $state(0);

	function play() {
		drawn = 0;
		setTimeout(() => {
			animateProgress(duration, (t) => {
				drawn = safeValue * t;
			});
		}, delay);
	}

	onMount(play);

	$effect(() => {
		void replayKey;
		void safeValue;
		void safeTotal;
		untrack(play);
	});
</script>

<div
	class="waffle-stat"
	style="grid-template-columns: repeat({cols}, {cellSize}px); gap: {gap}px;"
	role="img"
	aria-label="{safeValue} of {safeTotal}"
>
	{#each { length: safeTotal } as _, i (i)}
		{@const filled = drawn > i}
		<div
			class="waffle-cell"
			style="
				width: {cellSize}px;
				height: {cellSize}px;
				background: {filled ? color : track};
				opacity: {filled ? 1 : 1};
				transform: scale({filled ? 1 : 0.88});
			"
		></div>
	{/each}
</div>

<style>
	.waffle-stat {
		display: grid;
	}
	.waffle-cell {
		border-radius: 4px;
		transition: background-color 200ms ease, transform 280ms cubic-bezier(0.19, 1, 0.22, 1);
	}
</style>
