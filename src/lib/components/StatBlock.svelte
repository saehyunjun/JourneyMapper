<!--
	StatBlock — an animated stat cell for summary grids.

	The number counts up from zero when the block scrolls into view (using the
	shared reveal action + animateProgress). A thin fill bar sweeps across the
	bottom of the card: at full width for plain counts, or proportional to
	`fraction` (0–1) for relative values like sentiment percentages.
-->
<script lang="ts">
	import { reveal, animateProgress } from '$lib/charts/reveal';

	let {
		value,
		label,
		fraction,
		valueClass = 'text-accent-mint',
		labelClass = 'text-muted-foreground',
		barClass = 'bg-accent-mint',
		class: klass = 'bg-(--paper)'
	}: {
		value: number;
		label: string;
		/** 0–1 proportion for the fill bar. Omit to sweep the full width. */
		fraction?: number;
		valueClass?: string;
		labelClass?: string;
		barClass?: string;
		class?: string;
	} = $props();

	const WAFFLE_COLS = 5;
	const WAFFLE_ROWS = 4;
	const WAFFLE_TOTAL = WAFFLE_COLS * WAFFLE_ROWS;

	let displayed = $state(0);
	let barWidth = $state(0);

	const filledCells = $derived(Math.round((barWidth / 100) * WAFFLE_TOTAL));

	function start() {
		const countDur = Math.min(1400, Math.max(500, value * 3));
		animateProgress(countDur, (t) => {
			displayed = Math.round(t * value);
		});
		const barTarget = fraction ?? 1;
		animateProgress(900, (t) => {
			barWidth = t * barTarget * 100;
		});
	}
</script>

<div
	class="relative flex flex-col gap-1 overflow-hidden p-5 {klass}"
	use:reveal={{ onReveal: start, once: true }}
>
	<span class="font-heading text-3xl font-bold {valueClass}">{displayed}</span>
	<span class="text-xs  text-accent-foreground uppercase tracking-wide {labelClass}">{label}</span>
	{#if fraction !== undefined}
		<div class="mt-2 grid gap-[2px]" style="grid-template-columns: repeat({WAFFLE_COLS}, 1fr);">
			{#each { length: WAFFLE_TOTAL } as _, i}
				<div
					class="aspect-square}"
				></div>
			{/each}
		</div>
	{:else}
		<div
			class="absolute bottom-0 left-0 h-[2px] {barClass} opacity-30"
			style="width: {barWidth}%;"
		></div>
	{/if}
</div>
