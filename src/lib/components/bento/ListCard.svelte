<!--
	ListCard — bento card showing a ranked list of items.

	Silhouette: paper background, but with internal row dividers (not full
	card borders between items). Reads as a compact table when wide and
	thin, as a labelled stack when tall and narrow.

	Variant table:

	  xs       → top 3 rows (count + label), no mini-bar
	  sm       → top 4 rows (count + label)
	  md       → top 6 rows
	  lg       → top 8 rows + mini-bar per row
	  xl       → 2-col: full list left, detail panel of the top row right
-->
<script lang="ts">
	import type { BentoSize } from './types';

	type Row = {
		id?: string;
		label: string;
		count: number;
		caption?: string;
		tone?: 'positive' | 'negative' | 'neutral';
	};

	type Props = {
		size: BentoSize;
		eyebrow?: string;
		title?: string;
		rows: Row[];
		direction?: 'horizontal' | 'vertical';
	};

	let {
		size,
		eyebrow,
		title,
		rows,
		direction = 'vertical'
	}: Props = $props();

	const limit = $derived(
		size === 'xs' ? 3 : size === 'sm' ? 4 : size === 'md' ? 6 : size === 'lg' ? 8 : 8
	);
	const visible = $derived(rows.slice(0, limit));
	const showBars = $derived(size === 'lg' || size === 'xl');
	const showDetail = $derived(size === 'xl' && rows.length > 0);

	const maxCount = $derived(Math.max(1, ...rows.map((r) => r.count)));

	const sizeClass = $derived(`size-${size}`);
	const directionClass = $derived(`dir-${direction}`);

	function toneColor(tone: Row['tone']): string {
		if (tone === 'negative') return 'var(--negative-fg, #b91c1c)';
		if (tone === 'positive') return 'var(--positive-fg, #047857)';
		return 'var(--ink, #312f28)';
	}
</script>

<article class="list-card {sizeClass} {directionClass}">
	{#if showDetail}
		<div class="xl-grid">
			<div class="list-col">
				{#if eyebrow}<span class="eyebrow">{eyebrow}</span>{/if}
				{#if title}<h3 class="title">{title}</h3>{/if}
				<ul class="rows" data-bars="true">
					{#each visible as row, idx (row.id ?? row.label)}
						<li class="row" class:row-focus={idx === 0}>
							<span class="rank">{idx + 1}</span>
							<span class="count" style="color: {toneColor(row.tone)}">{row.count}</span>
							<span class="label">{row.label}</span>
							<span class="bar-track" aria-hidden="true">
								<span
									class="bar-fill"
									style="width: {(row.count / maxCount) * 100}%; background: {toneColor(row.tone)};"
								></span>
							</span>
						</li>
					{/each}
				</ul>
			</div>
			<aside class="detail-col">
				<span class="eyebrow">Top item</span>
				<span class="detail-figure">{rows[0].count}</span>
				<span class="detail-label">{rows[0].label}</span>
				{#if rows[0].caption}
					<p class="detail-caption">{rows[0].caption}</p>
				{/if}
			</aside>
		</div>
	{:else}
		{#if eyebrow}<span class="eyebrow">{eyebrow}</span>{/if}
		{#if title}<h3 class="title">{title}</h3>{/if}
		<ul class="rows" data-bars={showBars}>
			{#each visible as row, idx (row.id ?? row.label)}
				<li class="row">
					<span class="rank">{idx + 1}</span>
					<span class="count" style="color: {toneColor(row.tone)}">{row.count}</span>
					<span class="label">{row.label}</span>
					{#if showBars}
						<span class="bar-track" aria-hidden="true">
							<span
								class="bar-fill"
								style="width: {(row.count / maxCount) * 100}%; background: {toneColor(row.tone)};"
							></span>
						</span>
					{/if}
				</li>
			{/each}
		</ul>
	{/if}
</article>

<style>
	.list-card {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding: 1rem 1.25rem;
		height: 100%;
		border: 1px solid rgba(48, 47, 40, 0.12);
		border-radius: 12px;
		background: rgba(255, 254, 250, 0.85);
	}

	.eyebrow {
		font-family: var(--font-mono);
		font-size: 0.62rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--muted-foreground, #6b7280);
	}
	.title {
		font-family: var(--font-heading, "Jost", sans-serif);
		font-size: 1.1rem;
		font-weight: 500;
		line-height: 1.1;
		color: var(--ink, #312f28);
		margin: 0;
	}

	.rows {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
	}

	.row {
		display: grid;
		grid-template-columns: 1.5rem 2.5rem minmax(0, 1fr);
		align-items: baseline;
		gap: 0.625rem;
		padding: 0.45rem 0;
		border-top: 1px solid rgba(48, 47, 40, 0.08);
	}
	.rows[data-bars="true"] .row {
		grid-template-columns: 1.5rem 2.5rem minmax(0, 1.2fr) minmax(0, 1.4fr);
	}
	.rows > .row:first-child {
		border-top: none;
	}

	.rank {
		font-family: var(--font-mono);
		font-size: 0.7rem;
		color: var(--muted-foreground, #6b7280);
		font-variant-numeric: tabular-nums;
	}
	.count {
		font-family: var(--font-heading, "Jost", sans-serif);
		font-size: 1rem;
		font-variant-numeric: tabular-nums;
		text-align: right;
		line-height: 1;
	}
	.label {
		font-family: var(--font-body, "IBM Plex Sans", system-ui);
		font-size: 0.85rem;
		color: var(--secondary-foreground, #312f28);
		line-height: 1.3;
	}
	.bar-track {
		display: block;
		height: 0.45rem;
		background: rgba(48, 47, 40, 0.08);
		border-radius: 999px;
		overflow: hidden;
		align-self: center;
	}
	.bar-fill {
		display: block;
		height: 100%;
		border-radius: 999px;
	}

	/* Horizontal variant: stack rows into a row-flex strip (thin-wide).
	   Used for the "non-barriers" wide-thin slot in the redesign. */
	.dir-horizontal .rows {
		flex-direction: row;
		flex-wrap: wrap;
		gap: 0.75rem 1.5rem;
	}
	.dir-horizontal .row {
		grid-template-columns: 2.5rem minmax(0, 1fr);
		gap: 0.4rem;
		padding: 0.25rem 0;
		border-top: none;
		min-width: 8rem;
	}
	.dir-horizontal .rank { display: none; }

	/* Size scale. */
	.size-xs, .size-sm { padding: 0.75rem 1rem; gap: 0.35rem; }
	.size-md { padding: 1rem 1.25rem; }
	.size-lg { padding: 1.25rem 1.5rem; gap: 0.6rem; }
	.size-xl { padding: 1.75rem 2rem; gap: 0.875rem; }

	.size-xs .count, .size-sm .count { font-size: 0.9rem; }
	.size-md .count { font-size: 1rem; }
	.size-lg .count, .size-xl .count { font-size: 1.15rem; }

	/* xl: 2-col layout. */
	.xl-grid {
		display: grid;
		grid-template-columns: minmax(0, 1.5fr) minmax(0, 1fr);
		gap: 2rem;
		height: 100%;
	}
	.list-col, .detail-col {
		display: flex;
		flex-direction: column;
		gap: 0.625rem;
	}
	.detail-col {
		border-left: 1px solid rgba(48, 47, 40, 0.15);
		padding-left: 1.5rem;
	}
	.detail-figure {
		font-family: var(--font-heading, "Jost", sans-serif);
		font-size: 3.5rem;
		line-height: 0.95;
		color: var(--ink, #312f28);
		font-variant-numeric: tabular-nums;
		letter-spacing: -0.02em;
	}
	.detail-label {
		font-family: var(--font-body, "IBM Plex Sans", system-ui);
		font-size: 1rem;
		color: var(--secondary-foreground, #312f28);
	}
	.detail-caption {
		font-family: var(--font-body, "IBM Plex Sans", system-ui);
		font-size: 0.88rem;
		line-height: 1.5;
		color: var(--secondary-foreground, #312f28);
		margin: 0.5rem 0 0 0;
	}

	.row-focus .label {
		font-weight: 500;
	}
</style>
