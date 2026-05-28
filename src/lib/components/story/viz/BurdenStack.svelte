
<!--
	BurdenStack — ranked horizontal bars for top-level burden categories.

	Each row: category label, animated bar sized to share-of-tagged-moments,
	count + percent. Bars use the same warm orange the corpus grid uses for
	"raw count" reads, so the burden slide visually rhymes with the scope
	slide instead of inventing a new palette.

	Bars animate in width-from-zero on mount with a stagger; replayKey
	re-triggers the animation when the slide is re-entered.
-->
<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { animateProgress } from '$lib/charts/reveal';
	import type { BurdenSlice } from '$lib/story/types';

	let {
		slices,
		totalTagged,
		barHeight = 22,
		labelWidth = 200,
		captionWidth = 110,
		gap = 12,
		color = '#CC6324',
		track = 'rgba(48, 47, 40, 0.06)',
		duration = 1100,
		stagger = 110,
		replayKey = 0
	}: {
		slices: BurdenSlice[];
		totalTagged: number;
		barHeight?: number;
		labelWidth?: number;
		captionWidth?: number;
		gap?: number;
		color?: string;
		track?: string;
		duration?: number;
		stagger?: number;
		replayKey?: number;
	} = $props();

	// Scale bar widths so the largest slice fills the track (relative read);
	// percent caption already carries the absolute share.
	const maxShare = $derived(
		slices.length ? Math.max(...slices.map((s) => s.share)) : 0
	);

	let progress = $state(0);

	function play() {
		progress = 0;
		animateProgress(duration, (t) => {
			progress = t;
		});
	}

	onMount(play);

	$effect(() => {
		void replayKey;
		untrack(play);
	});
</script>

<div class="burden-stack" style="--gap: {gap}px;">
	{#each slices as slice, i (slice.id)}
		{@const relShare = maxShare > 0 ? slice.share / maxShare : 0}
		{@const phase = Math.max(
			0,
			Math.min(1, (progress * duration - i * stagger) / duration)
		)}
		{@const pct = Math.round(slice.share * 100)}
		<div class="row" style="--label-w: {labelWidth}px; --caption-w: {captionWidth}px;">
			<div class="label font-heading">{slice.label}</div>
			<div class="bar-track" style="height: {barHeight}px; background: {track};">
				<div
					class="bar-fill"
					style="
						width: {relShare * phase * 100}%;
						background: {color};
					"
				></div>
			</div>
			<div class="caption font-mono">
				<span class="caption-pct">{pct}%</span>
				<span class="caption-count">{slice.count} of {totalTagged}</span>
			</div>
		</div>
	{/each}
</div>

<style>
	.burden-stack {
		display: flex;
		flex-direction: column;
		gap: var(--gap, 12px);
		width: 100%;
		max-width: 580px;
	}
	.row {
		display: grid;
		grid-template-columns: var(--label-w) 1fr var(--caption-w);
		align-items: center;
		gap: 0.875rem;
	}
	.label {
		font-size: 0.85rem;
		font-weight: 500;
		color: var(--ink, #312f28);
		line-height: 1.2;
		text-align: right;
	}
	.bar-track {
		width: 100%;
		overflow: hidden;
		border-radius: 4px;
		position: relative;
	}
	.bar-fill {
		height: 100%;
		border-radius: 4px;
		transition: width 200ms linear;
	}
	.caption {
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
		font-size: 0.7rem;
		color: var(--muted-foreground, #64748b);
		line-height: 1.2;
	}
	.caption-pct {
		font-size: 1rem;
		color: var(--ink, #312f28);
		font-variant-numeric: tabular-nums;
	}
	.caption-count {
		letter-spacing: 0.04em;
	}

	@media (max-width: 768px) {
		.row {
			grid-template-columns: 1fr;
			gap: 0.375rem;
		}
		.label { text-align: left; }
	}
</style>
