
<!--
	ThemeSentimentBars — small-multiples for per-theme sentiment.

	One row per theme: label on the left, a 5-segment stacked bar in the
	middle (very negative → very positive), and a count + lean caption on
	the right. Segments use the same SENTIMENT_PALETTE as CorpusGrid so the
	read carries straight over from the recolor slide.

	Bars animate in from zero width on mount and re-play when replayKey
	changes (slide re-enter).
-->
<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { animateProgress } from '$lib/charts/reveal';
	import type { SentimentBucket, ThemeSentimentRow } from '$lib/story/types';

	let {
		rows,
		barHeight = 16,
		labelWidth = 160,
		captionWidth = 120,
		gap = 14,
		duration = 900,
		stagger = 90,
		replayKey = 0
	}: {
		rows: ThemeSentimentRow[];
		barHeight?: number;
		labelWidth?: number;
		captionWidth?: number;
		gap?: number;
		duration?: number;
		stagger?: number;
		replayKey?: number;
	} = $props();

	const SENTIMENT_PALETTE: Record<SentimentBucket, string> = {
		'-2': '#e11d48',
		'-1': '#fb7185',
		'0': '#cbd5e1',
		'1': '#34d399',
		'2': '#059669'
	};
	const BUCKETS: SentimentBucket[] = ['-2', '-1', '0', '1', '2'];

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

<div class="theme-bars" style="--gap: {gap}px;">
	{#each rows as row, i (row.themeId)}
		{@const delay = i * stagger}
		{@const phase = Math.max(0, Math.min(1, (progress * duration - delay) / duration))}
		<div class="row" style="--label-w: {labelWidth}px; --caption-w: {captionWidth}px;">
			<div class="label font-heading">{row.themeLabel}</div>
			<div class="bar-track" style="height: {barHeight}px;">
				{#each BUCKETS as b}
					{@const segShare = row.total > 0 ? row.counts[b] / row.total : 0}
					<div
						class="seg"
						style="
							flex: {segShare * phase} 1 0;
							background: {SENTIMENT_PALETTE[b]};
							opacity: {row.counts[b] > 0 ? 1 : 0};
						"
						title="{row.counts[b]} at sentiment {b}"
					></div>
				{/each}
			</div>
			<div class="caption font-mono">
				<span class="caption-total">{row.total}</span>
				<span class="caption-lean">
					<span class="lean-neg">{row.negPct}%−</span>
					<span class="lean-sep">/</span>
					<span class="lean-pos">{row.posPct}%+</span>
				</span>
			</div>
		</div>
	{/each}
</div>

<style>
	.theme-bars {
		display: flex;
		flex-direction: column;
		gap: var(--gap, 14px);
		width: 100%;
		max-width: 540px;
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
		display: flex;
		width: 100%;
		overflow: hidden;
		border-radius: 999px;
		background: rgba(48, 47, 40, 0.06);
	}
	.seg {
		height: 100%;
		transition: opacity 240ms ease;
	}
	.caption {
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
		font-size: 0.7rem;
		color: var(--muted-foreground, #64748b);
		line-height: 1.2;
	}
	.caption-total {
		font-size: 0.95rem;
		color: var(--ink, #312f28);
		font-variant-numeric: tabular-nums;
	}
	.caption-lean {
		display: inline-flex;
		gap: 0.25rem;
		letter-spacing: 0.04em;
	}
	.lean-neg { color: #be123c; }
	.lean-pos { color: #047857; }
	.lean-sep { color: rgba(48, 47, 40, 0.3); }

	@media (max-width: 768px) {
		.row {
			grid-template-columns: 1fr;
			gap: 0.375rem;
		}
		.label { text-align: left; }
	}
</style>
