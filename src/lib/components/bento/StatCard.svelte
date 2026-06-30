<!--
	StatCard — the first size-aware bento child component.

	Variant table (what's visible at each step of the BentoSize scale):

	  xs / sm  → figure + label only. Single line, compact.
	  md       → + caption sentence below figure.
	  lg       → + small horizontal sentiment bar as a backdrop.
	  xl       → + narrative paragraph rendered alongside (2-col layout),
	             larger figure, full chart background, optional sub-stats.

	The figure's CSS font-size steps with the size prop. Each variant decides
	what's visible — components do their own density adaptation rather than
	being uniformly scaled, which is the whole point of the ordinal scale.
-->
<script lang="ts">
	import type { BentoSize } from './types';

	type SubStat = { value: string | number; label: string };
	type SentimentSplit = { positive: number; neutral: number; negative: number };

	type Props = {
		size: BentoSize;
		eyebrow?: string;
		figure: string | number;
		label: string;
		caption?: string;
		narrative?: string;
		split?: SentimentSplit;
		subStats?: SubStat[];
		tone?: 'positive' | 'negative' | 'neutral';
	};

	let {
		size,
		eyebrow,
		figure,
		label,
		caption,
		narrative,
		split,
		subStats = [],
		tone = 'neutral'
	}: Props = $props();

	// Visibility table — read this top-down to see what shows at each step.
	// Expansion caps at `lg` (Aaron's call — `xl` was too large), so the
	// previously-xl content (narrative paragraph, sub-stats) is promoted to
	// fire at `lg` too. xl branches stay defined for future use.
	const showCaption = $derived(size === 'md' || size === 'lg' || size === 'xl');
	const showSplit = $derived(size === 'lg' || size === 'xl');
	const showNarrative = $derived(size === 'lg' || size === 'xl');
	const showSubStats = $derived(
		(size === 'lg' || size === 'xl') && subStats.length > 0
	);

	// Figure font-size steps with size. Container query inside the .figure
	// rule would be cleaner long-term — for the spike, a derived class is
	// enough to feel the steps.
	const sizeClass = $derived(`size-${size}`);
	const toneClass = $derived(`tone-${tone}`);

	const splitTotal = $derived(
		split ? split.positive + split.neutral + split.negative : 0
	);
	const pct = (n: number) => (splitTotal ? (n / splitTotal) * 100 : 0);
</script>

<article class="stat-card {sizeClass} {toneClass}">
	{#if showNarrative}
		<!-- xl layout: 2-col split — figure column + narrative column -->
		<div class="xl-grid">
			<div class="xl-figure-col">
				{#if eyebrow}<span class="eyebrow">{eyebrow}</span>{/if}
				<span class="figure">{figure}</span>
				<span class="label">{label}</span>
				{#if caption}<p class="caption">{caption}</p>{/if}
				{#if split}
					<div class="split-bar split-bar-large" aria-label="Sentiment split">
						<span class="split-pos" style="width: {pct(split.positive)}%"></span>
						<span class="split-neu" style="width: {pct(split.neutral)}%"></span>
						<span class="split-neg" style="width: {pct(split.negative)}%"></span>
					</div>
				{/if}
			</div>
			<div class="xl-narrative-col">
				{#if narrative}<p class="narrative">{narrative}</p>{/if}
				{#if showSubStats}
					<ul class="sub-stats">
						{#each subStats as s (s.label)}
							<li>
								<span class="sub-figure">{s.value}</span>
								<span class="sub-label">{s.label}</span>
							</li>
						{/each}
					</ul>
				{/if}
			</div>
		</div>
	{:else}
		<!-- xs / sm / md / lg : stacked single column -->
		{#if eyebrow}<span class="eyebrow">{eyebrow}</span>{/if}
		<span class="figure">{figure}</span>
		<span class="label">{label}</span>
		{#if showCaption && caption}<p class="caption">{caption}</p>{/if}
		{#if showSplit && split}
			<div class="split-bar" aria-label="Sentiment split">
				<span class="split-pos" style="width: {pct(split.positive)}%"></span>
				<span class="split-neu" style="width: {pct(split.neutral)}%"></span>
				<span class="split-neg" style="width: {pct(split.negative)}%"></span>
			</div>
		{/if}
	{/if}
</article>

<style>
	.stat-card {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
		padding: 0.875rem 1rem;
		height: 100%;
		border: 1px solid rgba(48, 47, 40, 0.15);
		border-radius: 12px;
		background: rgba(255, 254, 250, 0.85);
		transition: border-color 160ms ease;
	}
	.stat-card:hover {
		border-color: rgba(48, 47, 40, 0.4);
	}
	.eyebrow {
		font-family: var(--font-mono);
		font-size: 0.62rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--muted-foreground, #6b7280);
	}
	.figure {
		font-family: var(--font-heading);
		font-weight: 500;
		line-height: 0.95;
		letter-spacing: -0.02em;
		color: var(--ink, #312f28);
		font-variant-numeric: tabular-nums;
	}
	.label {
		font-family: var(--font-mono);
		font-size: 0.66rem;
		text-transform: uppercase;
		letter-spacing: 0.07em;
		color: var(--muted-foreground, #6b7280);
	}
	.caption {
		font-size: 0.82rem;
		line-height: 1.4;
		color: var(--secondary-foreground, #312f28);
		margin: 0;
	}
	.narrative {
		font-size: 0.92rem;
		line-height: 1.55;
		color: var(--secondary-foreground, #312f28);
		margin: 0;
	}

	/* Size scale steps. Each step is a real change in figure scale + padding
	   density — not a uniform zoom. */
	.size-xs .figure { font-size: 1.5rem; }
	.size-sm .figure { font-size: 2rem; }
	.size-md .figure { font-size: 2.75rem; }
	.size-lg .figure { font-size: 3.75rem; }
	.size-xl .figure { font-size: 6rem; line-height: 0.9; }

	.size-xs, .size-sm { padding: 0.625rem 0.875rem; gap: 0.25rem; }
	.size-md { padding: 0.875rem 1rem; gap: 0.375rem; }
	.size-lg { padding: 1.125rem 1.25rem; gap: 0.5rem; }
	.size-xl { padding: 1.75rem 2rem; gap: 0.625rem; }

	/* xl layout: split figure / narrative columns side by side */
	.xl-grid {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1.3fr);
		gap: 2rem;
		height: 100%;
		align-items: start;
	}
	.xl-figure-col, .xl-narrative-col {
		display: flex;
		flex-direction: column;
		gap: 0.625rem;
	}

	/* Split-bar: a small horizontal sentiment visualization. Acts as a
	   sparkline at lg, becomes a hero band at xl. */
	.split-bar {
		display: flex;
		height: 0.4rem;
		width: 100%;
		border-radius: 2px;
		overflow: hidden;
		margin-top: 0.25rem;
	}
	.split-bar-large {
		height: 0.9rem;
		margin-top: 0.75rem;
	}
	.split-pos { background: var(--positive-fg, #047857); }
	.split-neu { background: rgba(48, 47, 40, 0.18); }
	.split-neg { background: var(--negative-fg, #b91c1c); }

	/* Sub-stats list under the narrative at xl. */
	.sub-stats {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(8rem, 1fr));
		gap: 1rem;
		margin: 1rem 0 0 0;
		padding: 1rem 0 0 0;
		list-style: none;
		border-top: 1px solid rgba(48, 47, 40, 0.12);
	}
	.sub-stats li {
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
	}
	.sub-figure {
		font-family: var(--font-heading);
		font-size: 1.5rem;
		line-height: 1;
		color: var(--ink, #312f28);
		font-variant-numeric: tabular-nums;
	}
	.sub-label {
		font-family: var(--font-mono);
		font-size: 0.62rem;
		text-transform: uppercase;
		letter-spacing: 0.07em;
		color: var(--muted-foreground, #6b7280);
	}

	/* Tone colouring on the figure. xl renders a calmer figure even on neg
	   tone — at hero scale red feels alarmist; the split-bar carries the
	   tone signal. */
	.tone-negative .figure { color: var(--negative-fg, #b91c1c); }
	.tone-positive .figure { color: var(--positive-fg, #047857); }
	.size-xl.tone-negative .figure,
	.size-xl.tone-positive .figure { color: var(--ink, #312f28); }
</style>
