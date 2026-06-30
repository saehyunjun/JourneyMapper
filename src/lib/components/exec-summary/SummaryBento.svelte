<!--
	SummaryBento — the "Brief" view for the executive-summary right pane.

	Bento-style narrative + list summary: a lead paragraph, an oversized
	headline stat with a chart-as-background card (BarX zoomed on the top
	findings' negative-mention counts), a 2-col grid of finding callout
	cards with oversized numbers, and a list of top-cited keyword clusters.

	Sibling to InsightOverview — selected from the left-rail "Brief" tile
	(selection.kind === 'summary'). Renders within the same ~30-34rem right
	pane, so card density and number sizing are tuned for that width.
-->
<script lang="ts">
	import BarX from '$lib/charts/BarX.svelte';
	import BlurbText, { type RefKind } from './BlurbText.svelte';
	import type { Finding } from '$lib/content/wctglpdemo-data/executive-summary';

	type SentimentLean = {
		lean: 'positive' | 'negative' | 'mixed';
		positive: number;
		negative: number;
		neutral: number;
		total: number;
		posPct: number;
		negPct: number;
		neutralPct: number;
	};

	type Stat = { value: string | number; label: string };

	type Props = {
		summaryText: string;
		overviewBlurb?: string | null;
		stats: Stat[];
		sentimentLean: SentimentLean;
		findings: Finding[];
		onref?: (kind: RefKind, id: string) => void;
		knownRefs?: Partial<Record<RefKind, Set<string>>>;
		onselectFinding?: (id: string) => void;
	};

	let {
		summaryText,
		overviewBlurb = null,
		stats,
		sentimentLean,
		findings,
		onref,
		knownRefs,
		onselectFinding
	}: Props = $props();

	const bodyText = $derived(overviewBlurb && overviewBlurb.trim() ? overviewBlurb : summaryText);

	// Top driver of the brief: the finding with the highest negative count.
	// Falls back to the first finding if none lean negative.
	const headlineFinding = $derived.by(() => {
		if (!findings.length) return null;
		const ranked = [...findings].sort(
			(a, b) => b.distribution.negative - a.distribution.negative
		);
		return ranked[0];
	});

	// Card-grid findings: prefer the four findings the dashboard generates
	// (negative-trial / negative-treatment / positive-treatment / non-barriers)
	// but render whatever the active indication has. Cap at 4 for the 2x2.
	const cardFindings = $derived(findings.slice(0, 4));

	// Stat tiles (excluding the one already shown elsewhere in the rail) —
	// these read as a single horizontal stat strip at the top of the bento.
	const headerStats = $derived(stats.filter((s) => s.label.toLowerCase() !== 'interviews'));

	// Chart data for the "loudest negatives" card: one bar per finding showing
	// its negative-mention count. BarX renders horizontally — perfect for a
	// background visualization the headline sits on top of.
	const negativeBars = $derived(
		findings
			.map((f) => ({ label: f.eyebrow.replace(/^Drivers of |^Non-issues for /, ''), neg: f.distribution.negative }))
			.filter((d) => d.neg > 0)
	);

	const totalSegments = $derived(sentimentLean.total);

	// Top clusters list: pick the highest-count cluster from each finding for
	// the list-form footer. Dedupes by cluster label.
	const topClusters = $derived.by(() => {
		const seen = new Set<string>();
		const rows: { label: string; count: number; tone: Finding['tone']; findingId: string }[] = [];
		for (const f of findings) {
			const top = [...f.clusters].sort((a, b) => b.count - a.count)[0];
			if (!top) continue;
			if (seen.has(top.label)) continue;
			seen.add(top.label);
			rows.push({ label: top.label, count: top.count, tone: f.tone, findingId: f.id });
		}
		return rows.slice(0, 6);
	});

	function toneClass(tone: Finding['tone']): string {
		if (tone === 'negative') return 'tone-negative';
		if (tone === 'positive') return 'tone-positive';
		if (tone === 'divisive') return 'tone-divisive';
		return 'tone-neutral';
	}
</script>

<div class="flex flex-col gap-5 p-6">
	<!-- Lead: eyebrow + analyst-voice narrative + stat strip -->
	<section class="flex flex-col gap-3">
		<span class="figcaption text-accent-mint">Executive brief</span>
		<p class="text-pretty text-base leading-relaxed text-secondary-foreground">
			<BlurbText text={bodyText} {onref} known={knownRefs} />
		</p>
		<div class="mt-2 flex flex-wrap items-baseline gap-x-5 gap-y-1 border-t border-(--ink)/15 pt-3">
			{#each headerStats as s (s.label)}
				<div class="flex items-baseline gap-1.5">
					<span class="font-heading text-xl tabular-nums">{s.value}</span>
					<span class="text-[10px] uppercase tracking-[0.08em] text-muted-foreground">{s.label}</span>
				</div>
			{/each}
		</div>
	</section>

	<!-- Hero card: headline finding with chart-as-background -->
	{#if headlineFinding}
		<button
			type="button"
			class="hero-card group"
			onclick={() => onselectFinding?.(headlineFinding.id)}
			aria-label="Open {headlineFinding.eyebrow}"
		>
			<div class="hero-chart-bg" aria-hidden="true">
				<BarX
					figure=""
					caption=""
					data={negativeBars}
					label="label"
					value="neg"
					colorBy={() => 'var(--negative-fg, #e11d48)'}
					height={220}
					margin={{ top: 12, right: 28, bottom: 16, left: 28 }}
				/>
			</div>
			<div class="hero-overlay">
				<span class="hero-eyebrow font-mono">{headlineFinding.eyebrow}</span>
				<div class="hero-figure-row">
					<span class="hero-figure font-heading tabular-nums">{headlineFinding.distribution.negative}</span>
					<span class="hero-figure-caption">
						negative<br />mentions of<br />{totalSegments} total
					</span>
				</div>
				<p class="hero-lede">
					{#if headlineFinding.lede}
						<BlurbText text={headlineFinding.lede} {onref} known={knownRefs} />
					{:else}
						{headlineFinding.headline}
					{/if}
				</p>
			</div>
		</button>
	{/if}

	<!-- Bento grid: 2x2 finding callouts -->
	<div class="bento-grid">
		{#each cardFindings as f (f.id)}
			{@const figure =
				f.tone === 'positive'
					? f.distribution.positive
					: f.tone === 'negative'
						? f.distribution.negative
						: f.distribution.positive + f.distribution.neutral}
			{@const figCaption =
				f.tone === 'positive'
					? 'positive mentions'
					: f.tone === 'negative'
						? 'negative mentions'
						: 'non-negative mentions'}
			<button
				type="button"
				class="bento-card {toneClass(f.tone)}"
				onclick={() => onselectFinding?.(f.id)}
				aria-label="Open {f.eyebrow}"
			>
				<span class="bento-eyebrow font-mono">{f.eyebrow}</span>
				<div class="bento-figure-row">
					<span class="bento-figure font-heading tabular-nums">{figure}</span>
					<span class="bento-figure-caption">{figCaption}</span>
				</div>
				<p class="bento-lede">
					{#if f.lede}
						{f.lede}
					{:else}
						{f.headline}
					{/if}
				</p>
			</button>
		{/each}
	</div>

	<!-- List-form footer: top cluster mentions across findings -->
	{#if topClusters.length}
		<section class="list-card">
			<span class="figcaption text-accent-mint">Loudest signal</span>
			<ul class="list-rows">
				{#each topClusters as row (row.label + row.findingId)}
					<li>
						<button
							type="button"
							class="list-row {toneClass(row.tone)}"
							onclick={() => onselectFinding?.(row.findingId)}
						>
							<span class="list-row-count font-heading tabular-nums">{row.count}</span>
							<span class="list-row-label">{row.label}</span>
						</button>
					</li>
				{/each}
			</ul>
		</section>
	{/if}
</div>

<style>
	.figcaption {
		font-family: var(--font-mono);
		font-size: 0.7rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}

	/* --- Hero card ----------------------------------------------------- */
	.hero-card {
		position: relative;
		display: block;
		text-align: left;
		width: 100%;
		border: 1px solid rgba(48, 47, 40, 0.15);
		border-radius: 14px;
		background: rgba(48, 47, 40, 0.03);
		padding: 0;
		overflow: hidden;
		cursor: pointer;
		transition: border-color 160ms ease, transform 160ms ease;
		min-height: 220px;
	}
	.hero-card:hover {
		border-color: rgba(48, 47, 40, 0.4);
		transform: translateY(-1px);
	}
	.hero-chart-bg {
		position: absolute;
		inset: 0;
		opacity: 0.15;
		pointer-events: none;
		display: flex;
		align-items: center;
	}
	.hero-chart-bg :global(svg) {
		width: 100%;
		height: 100%;
	}
	/* Hide the BarX figure/caption header so only the bars remain — the
	   ChartFrame still allocates space for them, so we clip with overflow. */
	.hero-chart-bg :global(.chart-frame__header),
	.hero-chart-bg :global(.chart-frame__legend),
	.hero-chart-bg :global(text) {
		display: none;
	}
	.hero-overlay {
		position: relative;
		padding: 1.25rem 1.25rem 1.25rem 1.25rem;
		display: flex;
		flex-direction: column;
		gap: 0.625rem;
	}
	.hero-eyebrow {
		font-size: 0.7rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--accent-mint, #047857);
	}
	.hero-figure-row {
		display: flex;
		align-items: flex-start;
		gap: 0.75rem;
	}
	.hero-figure {
		font-size: 4.5rem;
		line-height: 0.9;
		font-weight: 500;
		color: var(--ink, #312f28);
		letter-spacing: -0.02em;
	}
	.hero-figure-caption {
		font-size: 0.7rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--muted-foreground, #6b7280);
		padding-top: 0.5rem;
		line-height: 1.15;
	}
	.hero-lede {
		font-size: 0.9rem;
		line-height: 1.45;
		color: var(--secondary-foreground, #312f28);
		max-width: 32ch;
	}

	/* --- Bento grid ---------------------------------------------------- */
	.bento-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.625rem;
	}
	.bento-card {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
		padding: 0.875rem;
		border: 1px solid rgba(48, 47, 40, 0.15);
		border-radius: 12px;
		background: rgba(48, 47, 40, 0.02);
		text-align: left;
		cursor: pointer;
		min-height: 130px;
		transition: border-color 160ms ease, transform 160ms ease;
	}
	.bento-card:hover {
		border-color: rgba(48, 47, 40, 0.4);
		transform: translateY(-1px);
	}
	.bento-eyebrow {
		font-size: 0.62rem;
		text-transform: uppercase;
		letter-spacing: 0.07em;
		color: var(--muted-foreground, #6b7280);
		line-height: 1.2;
	}
	.bento-figure-row {
		display: flex;
		align-items: baseline;
		gap: 0.4rem;
	}
	.bento-figure {
		font-size: 2.5rem;
		line-height: 0.95;
		font-weight: 500;
		letter-spacing: -0.01em;
	}
	.bento-figure-caption {
		font-size: 0.62rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--muted-foreground, #6b7280);
	}
	.bento-lede {
		font-size: 0.78rem;
		line-height: 1.4;
		color: var(--secondary-foreground, #312f28);
	}

	.tone-negative .bento-figure,
	.hero-figure {
		color: var(--negative-fg, #b91c1c);
	}
	.tone-positive .bento-figure {
		color: var(--positive-fg, #047857);
	}
	.tone-divisive .bento-figure {
		color: var(--divisive-fg, #b45309);
	}
	.tone-neutral .bento-figure {
		color: var(--ink, #312f28);
	}

	/* --- List card ----------------------------------------------------- */
	.list-card {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding: 0.875rem;
		border: 1px solid rgba(48, 47, 40, 0.15);
		border-radius: 12px;
		background: rgba(48, 47, 40, 0.02);
	}
	.list-rows {
		display: flex;
		flex-direction: column;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.list-row {
		display: flex;
		align-items: baseline;
		gap: 0.75rem;
		width: 100%;
		padding: 0.5rem 0;
		border-top: 1px solid rgba(48, 47, 40, 0.08);
		background: transparent;
		text-align: left;
		cursor: pointer;
	}
	.list-rows > li:first-child .list-row {
		border-top: none;
	}
	.list-row:hover {
		background: rgba(48, 47, 40, 0.03);
	}
	.list-row-count {
		font-size: 1.15rem;
		line-height: 1;
		min-width: 2.4rem;
		text-align: right;
	}
	.tone-negative .list-row-count {
		color: var(--negative-fg, #b91c1c);
	}
	.tone-positive .list-row-count {
		color: var(--positive-fg, #047857);
	}
	.tone-neutral .list-row-count,
	.tone-divisive .list-row-count {
		color: var(--ink, #312f28);
	}
	.list-row-label {
		font-size: 0.85rem;
		color: var(--secondary-foreground, #312f28);
	}
</style>
