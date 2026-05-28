
<!--
	InteractiveCorpusHero — full-width hero strip for the dashboard top.

	Replaces the old DashboardKpiBar's stats-plus-sentiment-ribbon layout
	with an interactive corpus visualization:

	  - A morphing dot grid (InteractiveCorpusGrid) sits at the top — every
	    tagged moment is one dot, colored by sentiment.
	  - The four headline stats sit below the grid and act as its controls.
	    Clicking a stat regroups the dots into K mini-clusters along that
	    axis; clicking the active stat returns to the default single grid.
	  - A small sentiment legend sits at the right of the controls row so
	    the colors stay interpretable (the old sentiment-lean bar's signal
	    survives here as the dot color distribution, but the percentages
	    are still useful to call out).

	Stats → mode mapping is hard-coded by label:
	  "interviews"     → group by interview_id
	  "tagged quotes"  → no group (default state)
	  "themes"         → group by theme_id
	  "pull quotes"    → group by starred flag (only enabled when at
	                     least one dot carries .starred)
-->
<script lang="ts">
	import InteractiveCorpusGrid, {
		type Dot,
		type GroupMode,
		type GroupSpec
	} from './InteractiveCorpusGrid.svelte';

	type Stat = { value: number; label: string };
	type SentimentLean = {
		posPct: number;
		neutralPct: number;
		negPct: number;
		total: number;
		lean: 'positive' | 'negative' | 'mixed';
	};

	let {
		stats,
		sentimentLean,
		dots,
		themeGroups,
		subthemeGroups = [],
		interviewGroups
	}: {
		stats: Stat[];
		sentimentLean: SentimentLean;
		dots: Dot[];
		themeGroups: GroupSpec[];
		subthemeGroups?: GroupSpec[];
		interviewGroups: GroupSpec[];
	} = $props();

	// Hard-coded label → mode map. Matches the labels the executive-summary
	// pipeline emits today ("interviews", "tagged quotes", "themes",
	// "subthemes", "pull quotes"); falls through to 'none' for any stat we
	// don't recognize. "subthemes" must be tested before "themes" so the
	// substring match doesn't capture it as a theme.
	function modeForLabel(label: string): GroupMode {
		const l = label.toLowerCase();
		if (l.includes('interview')) return 'interview';
		if (l.includes('subtheme')) return 'subtheme';
		if (l.includes('theme')) return 'theme';
		if (l.includes('pull')) return 'starred';
		return 'none'; // tagged quotes + anything unrecognized
	}

	const hasStarredFlag = $derived(dots.some((d) => d.starred === true));

	let mode = $state<GroupMode>('none');

	function selectStat(label: string) {
		const next = modeForLabel(label);
		// Toggle off when clicking the active stat (returns to default).
		mode = mode === next ? 'none' : next;
	}

	function isActive(label: string): boolean {
		const m = modeForLabel(label);
		return mode === m && m !== 'none';
	}

	function isAvailable(label: string): boolean {
		const m = modeForLabel(label);
		if (m === 'starred') return hasStarredFlag;
		if (m === 'interview') return interviewGroups.length > 0;
		if (m === 'theme') return themeGroups.length > 0;
		if (m === 'subtheme') return subthemeGroups.length > 0;
		return true; // 'none' (tagged quotes) is always available
	}

	// Mode-aware caption — tells the user what the current grouping means and
	// what clicking another stat will do. Reads like a footer hint rather than
	// a heading.
	const caption = $derived.by(() => {
		if (mode === 'none')
			return 'Each circle is one tagged moment, colored and sorted by sentiment. Click a stat to regroup.';
		if (mode === 'theme') return 'Grouped by theme, sorted by sentiment within each theme. Click the active stat to return to the corpus view.';
		if (mode === 'subtheme')
			return 'Grouped by subtheme, sorted by sentiment within each subtheme. Click the active stat to return to the corpus view.';
		if (mode === 'interview')
			return 'Grouped by interview, sorted by sentiment within each interview. Click the active stat to return to the corpus view.';
		if (mode === 'starred')
			return 'Grouped by analyst-starred quotes. Click the active stat to return to the corpus view.';
		return '';
	});
</script>

<div class="hero-wrap border-b border-(--ink)/15 bg-(--paper)">
	<div class="mx-auto flex w-full max-w-7xl flex-col gap-5 px-8 py-6">
		<!-- Grid region — the morphing visual. Sits at the top so the dots
		     are the first thing the eye lands on, before the controls. -->
		<div class="grid-region">
			<InteractiveCorpusGrid
				{dots}
				{mode}
				{themeGroups}
				{subthemeGroups}
				{interviewGroups}
			/>
		</div>

		<!-- Controls + legend row. Stats act as the regroup-by buttons; the
		     legend lives at the right so the sentiment colors stay legible. -->
		<div class="flex flex-col gap-3 md:flex-row md:items-end md:justify-between md:gap-8">
			<div class="flex flex-wrap items-baseline gap-2">
				{#each stats as stat (stat.label)}
					{@const active = isActive(stat.label)}
					{@const available = isAvailable(stat.label)}
					<button
						type="button"
						class="stat-btn"
						class:is-active={active}
						class:is-disabled={!available}
						disabled={!available}
						onclick={() => available && selectStat(stat.label)}
						aria-pressed={active}
						title={available
							? `Regroup by ${stat.label}`
							: `No ${stat.label} data on this corpus`}
					>
						<span class="stat-value font-heading tabular-nums">{stat.value}</span>
						<span class="stat-label">{stat.label}</span>
					</button>
				{/each}
			</div>

			<div class="legend">
				<div class="legend-bars">
					<span class="legend-bar" style="background: #e11d48; width: 8px;"></span>
					<span class="legend-bar" style="background: #fb7185; width: 8px;"></span>
					<span class="legend-bar" style="background: #cbd5e1; width: 8px;"></span>
					<span class="legend-bar" style="background: #34d399; width: 8px;"></span>
					<span class="legend-bar" style="background: #059669; width: 8px;"></span>
				</div>
				<div class="legend-text font-mono">
					<span><span class="legend-pct text-rose-700">{sentimentLean.negPct}%</span> neg</span>
					<span class="legend-sep">·</span>
					<span><span class="legend-pct text-slate-500">{sentimentLean.neutralPct}%</span> neutral</span>
					<span class="legend-sep">·</span>
					<span><span class="legend-pct text-emerald-700">{sentimentLean.posPct}%</span> pos</span>
					<span class="legend-sep">·</span>
					<span class="legend-total">{sentimentLean.total} moments</span>
				</div>
			</div>
		</div>

		<p class="caption font-mono text-xs uppercase tracking-[0.06em] text-muted-foreground">
			{caption}
		</p>
	</div>
</div>

<style>
	.grid-region {
		width: 100%;
	}
	.stat-btn {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 0.125rem;
		padding: 0.5rem 0.875rem 0.5rem 0.75rem;
		border-radius: 8px;
		border: 1px solid rgba(48, 47, 40, 0.12);
		background: transparent;
		color: var(--ink, #312f28);
		cursor: pointer;
		transition:
			border-color 160ms ease,
			background 160ms ease,
			transform 160ms ease;
	}
	.stat-btn:hover:not(.is-disabled) {
		border-color: rgba(48, 47, 40, 0.4);
		background: rgba(48, 47, 40, 0.04);
	}
	.stat-btn.is-active {
		border-color: var(--ink, #312f28);
		background: var(--ink, #312f28);
		color: var(--paper, #f5f1ea);
	}
	.stat-btn.is-disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}
	.stat-value {
		font-size: 1.25rem;
		font-weight: 500;
		line-height: 1.1;
	}
	.stat-label {
		font-size: 0.7rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: inherit;
		opacity: 0.7;
	}
	.stat-btn.is-active .stat-label {
		opacity: 0.85;
	}
	.legend {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 0.375rem;
	}
	.legend-bars {
		display: inline-flex;
		gap: 2px;
		height: 6px;
		align-items: center;
	}
	.legend-bar {
		display: inline-block;
		height: 6px;
		border-radius: 999px;
	}
	.legend-text {
		display: inline-flex;
		flex-wrap: wrap;
		gap: 0.25rem;
		font-size: 0.7rem;
		color: var(--muted-foreground, #64748b);
		align-items: baseline;
	}
	.legend-pct {
		font-weight: 600;
	}
	.legend-sep {
		opacity: 0.5;
	}
	.legend-total {
		font-weight: 500;
	}
	.caption {
		opacity: 0.8;
	}
	@media (min-width: 768px) {
		.legend {
			align-items: flex-end;
		}
		.legend-text {
			justify-content: flex-end;
		}
	}
</style>
