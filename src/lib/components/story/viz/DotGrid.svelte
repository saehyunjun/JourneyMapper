
<!--
	DotGrid — tight grid of N circles, one per unit of `count`. Used for
	scene-setter slides where the focal value is "N of something" and each
	circle represents one piece of evidence (one tagged moment, one
	interview). Reads as a tangible count rather than an abstract figure.

	Layout: auto-picks columns as ceil(sqrt(count)) for a roughly-square
	grid; the caller can override with `cols` for an exact rectangle.

	Motion: each dot pops in via a single CSS keyframe with a per-cell
	`animation-delay`. No per-frame state updates — the browser drives the
	reveal so 200+ dots animate smoothly. Honours prefers-reduced-motion.
-->
<script lang="ts">
	let {
		count,
		color = 'var(--orange, #CC6324)',
		cellSize = 12,
		gap = 4,
		cols,
		totalDuration = 1400,
		delay = 200,
		replayKey = 0
	}: {
		count: number;
		color?: string;
		cellSize?: number;
		gap?: number;
		cols?: number;
		totalDuration?: number;
		delay?: number;
		replayKey?: number;
	} = $props();

	const c = $derived(Math.max(0, Math.floor(count)));
	const actualCols = $derived(cols ?? Math.max(1, Math.ceil(Math.sqrt(c))));
	const perDotStagger = $derived(c > 0 ? totalDuration / c : 0);
</script>

{#key replayKey}
	<div
		class="dot-grid"
		style="grid-template-columns: repeat({actualCols}, {cellSize}px); gap: {gap}px;"
		role="img"
		aria-label="{c} units"
	>
		{#each { length: c } as _, i (i)}
			<span
				class="dot"
				style="
					width: {cellSize}px;
					height: {cellSize}px;
					background: {color};
					--delay: {delay + i * perDotStagger}ms;
				"
			></span>
		{/each}
	</div>
{/key}

<style>
	.dot-grid {
		display: grid;
		justify-content: center;
	}
	.dot {
		border-radius: 50%;
		opacity: 0;
		transform: scale(0.4);
		animation: dot-pop 360ms cubic-bezier(0.19, 1, 0.22, 1) var(--delay, 0ms) forwards;
	}
	@keyframes dot-pop {
		to {
			opacity: 1;
			transform: scale(1);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.dot {
			animation: none;
			opacity: 1;
			transform: scale(1);
		}
	}
</style>
