<!--
	ChartCard — bento card whose chart is the project's standard
	SentimentBar (one row per cluster, one cell per contributing segment,
	cells colored on the -2..2 sentiment scale).

	Was previously a BarX wrapper. Aaron's standing direction: prefer
	sentiment-aware waffle treatments over count-bar charts, and reuse
	the project's existing SentimentBar primitive rather than re-rendering
	bars from scratch. This component is now a thin layout around N
	SentimentBars, with the eyebrow / figure / caption header on top.

	Variant table:

	  xs       → figure + label only (no waffle)
	  sm       → figure + label + 1 SentimentBar (top cluster only)
	  md       → figure + label + caption + top 3 SentimentBars
	  lg       → + top 5 SentimentBars
	  xl       → 2-col: SentimentBars on left, interpretation paragraph
	             + top-contributors list on the right
-->
<script lang="ts">
	import SentimentBar from '$lib/components/SentimentBar.svelte';
	import StackedCards from '$lib/components/StackedCards.svelte';
	import type { BentoSize } from './types';

	type Block = { sentiment: number };
	type ClusterRow = {
		id?: string;
		label: string;
		blocks: Block[];
		count?: number;
	};

	type Props = {
		size: BentoSize;
		eyebrow?: string;
		figure: string | number;
		label: string;
		caption?: string;
		clusters: ClusterRow[];
		interpretation?: string;
		tone?: 'positive' | 'negative' | 'neutral';
	};

	let {
		size,
		eyebrow,
		figure,
		label,
		caption,
		clusters,
		interpretation,
		tone = 'neutral'
	}: Props = $props();

	const showCaption = $derived(size === 'md' || size === 'lg' || size === 'xl');
	// Expansion caps at `lg` (Aaron's call), so the interpretation column
	// + top-contributors are promoted to fire at `lg` too.
	const showInterpretation = $derived(size === 'lg' || size === 'xl');

	const barLimit = $derived(
		size === 'xs' ? 0 : size === 'sm' ? 1 : size === 'md' ? 3 : size === 'lg' ? 5 : 6
	);
	const visibleClusters = $derived(clusters.slice(0, barLimit));

	const sizeClass = $derived(`size-${size}`);
	const toneClass = $derived(`tone-${tone}`);

	// SentimentBar's label column width — narrower at small sizes so the
	// waffle gets the visual weight.
	const labelClass = $derived(
		size === 'sm' || size === 'md'
			? 'w-24'
			: size === 'lg'
				? 'w-32'
				: 'w-40'
	);

	// Card-stack shades for the top-3 contributors. Matches the Travel /
	// Expense mockup palette — darkest on top, lighter behind. NarrativeCard
	// uses the same family so the visual language is shared.
	function stackBg(i: number): string {
		const shades = {
			negative: ['#CA0005', '#E62D32', '#DC5B5E'],
			positive: ['#0F5132', '#1B7E48', '#2EA664'],
			neutral: ['#2F2D27', '#5B5953', '#8A8780']
		};
		return shades[tone][i] ?? shades[tone][shades[tone].length - 1];
	}
</script>

<article class="chart-card {sizeClass} {toneClass}">
	{#if showInterpretation}
		<div class="xl-grid">
			<div class="chart-col">
				{#if eyebrow}<span class="eyebrow">{eyebrow}</span>{/if}
				<div class="figure-row">
					<span class="figure">{figure}</span>
					<span class="label">{label}</span>
				</div>
				{#if caption}<p class="caption">{caption}</p>{/if}
				<div class="bars">
					{#each visibleClusters as c (c.id ?? c.label)}
						<SentimentBar label={c.label} blocks={c.blocks} {labelClass} />
					{/each}
				</div>
			</div>
			<aside class="interp-col">
				<span class="meta-label">Interpretation</span>
				<p class="interp-text">{interpretation}</p>
				{#if clusters.length >= 3}
					<span class="meta-label">Top contributors</span>
					<div class="contributor-stack">
						<StackedCards
							items={clusters.slice(0, 3)}
							aspect="3 / 4"
							showControls={false}
							expandable={false}
						>
							{#snippet item(c: ClusterRow, i: number)}
								<div class="contrib-card" style="background: {stackBg(i)};">
									<span class="contrib-label">{c.label}</span>
									<span class="contrib-value">{c.count ?? c.blocks.length}</span>
								</div>
							{/snippet}
						</StackedCards>
					</div>
				{/if}
			</aside>
		</div>
	{:else}
		{#if eyebrow}<span class="eyebrow">{eyebrow}</span>{/if}
		<div class="figure-row">
			<span class="figure">{figure}</span>
			<span class="label">{label}</span>
		</div>
		{#if showCaption && caption}<p class="caption">{caption}</p>{/if}

		{#if visibleClusters.length}
			<div class="bars">
				{#each visibleClusters as c (c.id ?? c.label)}
					<SentimentBar label={c.label} blocks={c.blocks} {labelClass} />
				{/each}
			</div>
		{/if}
	{/if}
</article>

<style>
	.chart-card {
		display: flex;
		flex-direction: column;
		gap: 0.625rem;
		padding: 1rem 1.25rem;
		height: 100%;
		border: 1px solid rgba(48, 47, 40, 0.15);
		border-radius: 12px;
		background: rgba(255, 254, 250, 0.85);
		transition: border-color 160ms ease;
		overflow: hidden;
	}
	.chart-card:hover {
		border-color: rgba(48, 47, 40, 0.4);
	}

	.eyebrow {
		font-family: var(--font-mono);
		font-size: 0.62rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--muted-foreground, #6b7280);
	}
	.figure-row {
		display: flex;
		align-items: baseline;
		gap: 0.5rem;
	}
	.figure {
		font-family: var(--font-heading, "Jost", sans-serif);
		font-weight: 500;
		line-height: 0.95;
		letter-spacing: -0.02em;
		font-variant-numeric: tabular-nums;
		color: var(--ink, #312f28);
	}
	.label {
		font-family: var(--font-mono);
		font-size: 0.66rem;
		text-transform: uppercase;
		letter-spacing: 0.07em;
		color: var(--muted-foreground, #6b7280);
	}
	.caption {
		font-family: var(--font-body, "IBM Plex Sans", system-ui);
		font-size: 0.82rem;
		line-height: 1.45;
		color: var(--secondary-foreground, #312f28);
		margin: 0;
	}

	.bars {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		margin-top: 0.5rem;
	}

	/* Size scale. */
	.size-xs .figure { font-size: 1.5rem; }
	.size-sm .figure { font-size: 2rem; }
	.size-md .figure { font-size: 2.5rem; }
	.size-lg .figure { font-size: 3.25rem; }
	.size-xl .figure { font-size: 4.5rem; line-height: 0.9; }

	.size-xs, .size-sm { padding: 0.75rem 1rem; gap: 0.35rem; }
	.size-md { padding: 1rem 1.25rem; }
	.size-lg { padding: 1.25rem 1.5rem; gap: 0.6rem; }
	.size-xl { padding: 1.75rem 2rem; gap: 0.75rem; }

	/* xl: 2-col layout. */
	.xl-grid {
		display: grid;
		grid-template-columns: minmax(0, 1.6fr) minmax(0, 1fr);
		gap: 2rem;
		height: 100%;
	}
	.chart-col, .interp-col {
		display: flex;
		flex-direction: column;
		gap: 0.625rem;
		min-width: 0;
	}
	.interp-col {
		border-left: 1px solid rgba(48, 47, 40, 0.12);
		padding-left: 1.5rem;
	}
	.meta-label {
		font-family: var(--font-mono);
		font-size: 0.62rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--muted-foreground, #6b7280);
	}
	.interp-text {
		font-family: var(--font-body, "IBM Plex Sans", system-ui);
		font-size: 0.92rem;
		line-height: 1.55;
		color: var(--secondary-foreground, #312f28);
		margin: 0 0 0.75rem 0;
	}
	/* Top-3 contributors rendered as a fanned StackedCards deck. The shared
	   shade palette (Travel/Expense mockup) ties this visually to the
	   NarrativeCard point stack. */
	.contributor-stack {
		width: min(14rem, 100%);
		aspect-ratio: 3 / 4;
		align-self: flex-start;
	}
	.contrib-card {
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		padding: 1rem 1.1rem;
		height: 100%;
		width: 100%;
		border-radius: 18px;
		color: #ffffff;
		box-shadow: 0 6px 22px -10px rgba(48, 47, 40, 0.4);
	}
	.contrib-label {
		font-family: var(--font-heading, "Jost", sans-serif);
		font-weight: 700;
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		line-height: 1.15;
	}
	.contrib-value {
		font-family: var(--font-heading, "Jost", sans-serif);
		font-weight: 700;
		font-size: 3rem;
		line-height: 0.95;
		letter-spacing: -0.02em;
		font-variant-numeric: tabular-nums;
		align-self: flex-start;
	}

	/* Tone tints the figure (matches StatCard convention). */
	.tone-negative .figure { color: var(--negative-fg, #b91c1c); }
	.tone-positive .figure { color: var(--positive-fg, #047857); }
	.size-xl.tone-negative .figure,
	.size-xl.tone-positive .figure { color: var(--ink, #312f28); }
</style>
