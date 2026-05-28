<!--
	DashboardKpiBar — the top strip of the Executive Summary dashboard.

	Collapses the four headline stats (interviews, tagged quotes, themes,
	pull quotes) and the overall sentiment lean ribbon into a single
	full-width bar that sits above the feed + detail split.
-->
<script lang="ts">
	type Stat = { value: number; label: string };
	type SentimentLean = {
		lean: 'positive' | 'negative' | 'mixed';
		positive: number;
		neutral: number;
		negative: number;
		total: number;
		posPct: number;
		neutralPct: number;
		negPct: number;
	};

	type Props = {
		stats: Stat[];
		sentimentLean: SentimentLean;
	};

	let { stats, sentimentLean }: Props = $props();
</script>

<div class="border-b border-(--ink)/15 bg-(--paper)">
	<div class="mx-auto flex w-full max-w-7xl flex-col gap-3 px-8 py-4 md:flex-row md:items-center md:gap-8">
		<dl class="flex shrink-0 flex-wrap items-baseline gap-x-6 gap-y-1">
			{#each stats as stat (stat.label)}
				<div class="flex items-baseline gap-1.5">
					<dt class="font-heading text-xl font-medium text-primary tabular-nums">{stat.value}</dt>
					<dd class="text-xs uppercase tracking-wide text-muted-foreground">{stat.label}</dd>
				</div>
			{/each}
		</dl>

		<div class="flex min-w-0 flex-1 flex-col gap-1.5 md:items-end">
			<div class="flex w-full items-baseline justify-between gap-3 md:max-w-md">
				<span class="text-xs uppercase tracking-wide text-muted-foreground">Sentiment lean</span>
				<span class="text-xs text-muted-foreground">
					<span class="font-medium text-foreground">{sentimentLean.lean}</span>
					· {sentimentLean.total} quotes
				</span>
			</div>
			<div class="flex h-2 w-full overflow-hidden rounded-full md:max-w-md">
				<div class="bg-emerald-400" style="width: {sentimentLean.posPct}%"></div>
				<div class="bg-slate-200" style="width: {sentimentLean.neutralPct}%"></div>
				<div class="bg-rose-400" style="width: {sentimentLean.negPct}%"></div>
			</div>
			<div class="flex flex-wrap gap-x-4 gap-y-0.5 text-[11px] text-muted-foreground md:max-w-md md:justify-end">
				<span><span class="font-medium text-emerald-700">{sentimentLean.posPct}%</span> pos</span>
				<span><span class="font-medium text-slate-500">{sentimentLean.neutralPct}%</span> neutral</span>
				<span><span class="font-medium text-rose-700">{sentimentLean.negPct}%</span> neg</span>
			</div>
		</div>
	</div>
</div>
