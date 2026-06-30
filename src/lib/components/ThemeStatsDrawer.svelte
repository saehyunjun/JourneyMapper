<!--
	ThemeStatsDrawer — Phase 5 of the codebook migration. Renders aggregate
	stats for a theme query (exact `hrqol.bodily_pain` or wildcard
	`*.financial`) across the active indication's corpora.

	Sibling of GroupStatsDrawer (legacy cluster/theme) and EntityDetailDrawer
	(new entity layer). Reads pre-computed ThemeStats from the server-side
	loader in server/theme-tags.ts.

	Mounted at /patientlyiq layout level so any theme-link click anywhere in
	the app can open it. Phase 4's propose-theme-tags.mjs writes the rows
	this drawer aggregates over.

	Chrome (panel, backdrop) is owned by TertiaryDrawer.
-->
<script lang="ts">
	import TertiaryDrawer from '$lib/components/TertiaryDrawer.svelte';
	import StatBar from '$lib/components/StatBar.svelte';
	import type { ThemeStats } from '$lib/content/theme-tags';

	type ThemeRecord = {
		id: string;
		axis: string;
		label: string;
		captures?: string;
		excludes?: string;
		provenance?: { frame: string };
	};

	let {
		stats,
		themes,
		onclose,
		level = 'top',
		scopeLabel = ''
	}: {
		stats: ThemeStats | null;
		/** Theme registry slice — used to resolve theme_ids to display labels
		 *  and axis info for the breakdown table. */
		themes: ThemeRecord[];
		onclose: () => void;
		level?: 'secondary' | 'top';
		scopeLabel?: string;
	} = $props();

	const open = $derived(stats !== null);

	const themeById = $derived(new Map<string, ThemeRecord>(themes.map((t) => [t.id, t])));

	// Header
	const primaryTheme = $derived.by<ThemeRecord | null>(() => {
		if (!stats) return null;
		if (stats.isWildcard) return null;
		return themeById.get(stats.query) ?? null;
	});

	const eyebrow = $derived.by(() => {
		if (!stats) return undefined;
		if (stats.isWildcard) return 'CROSS-AXIS QUERY';
		const t = primaryTheme;
		return t ? `${t.axis.toUpperCase()} · THEME` : 'THEME';
	});

	const title = $derived.by(() => {
		if (!stats) return undefined;
		if (stats.isWildcard) return stats.query;
		return primaryTheme?.label ?? stats.query;
	});

	const subtitle = $derived.by(() => {
		if (!stats) return undefined;
		if (stats.isWildcard) return `Matches ${stats.matchedThemeIds.length} theme${stats.matchedThemeIds.length === 1 ? '' : 's'} across axes`;
		return primaryTheme?.captures;
	});

	const scopeSuffix = $derived(scopeLabel.trim() ? scopeLabel.trim() : 'study-wide');

	// Sentiment bar tints (mirror GroupStatsDrawer)
	const sentimentTint = (v: number | 'unknown') =>
		v === 'unknown'
			? 'bg-slate-200'
			: v > 0
				? 'bg-emerald-400'
				: v < 0
					? 'bg-rose-400'
					: 'bg-slate-300';
	const max = (ns: number[]) => Math.max(1, ...ns);

	// Per-kind axis chip backgrounds (mirror the entity drawer palette)
	const AXIS_BG: Record<string, string> = {
		hrqol: 'bg-rose-50 text-rose-900 border-rose-200',
		util: 'bg-amber-50 text-amber-900 border-amber-200',
		trial: 'bg-indigo-50 text-indigo-900 border-indigo-200',
		life: 'bg-emerald-50 text-emerald-900 border-emerald-200',
		dx: 'bg-violet-50 text-violet-900 border-violet-200'
	};
	const axisBg = (axisOrTheme: string) => {
		const axisRoot = axisOrTheme.split('.')[0];
		return AXIS_BG[axisRoot] ?? 'bg-slate-50 text-slate-900 border-slate-200';
	};

	function fmtSentiment(v: number | null): string {
		if (v === null) return '—';
		const sign = v > 0 ? '+' : '';
		return `${sign}${v.toFixed(2)}`;
	}
</script>

<TertiaryDrawer
	{open}
	{onclose}
	ariaLabel="Theme stats"
	{level}
	width="wide"
	{eyebrow}
	{title}
	{subtitle}
>
	{#if stats}
		<div class="flex flex-1 flex-col gap-6 p-4">
			<!-- Headline counts -->
			<div class="grid grid-cols-3 gap-2">
				<div class="border-b border-accent pb-2">
					<p class="text-2xl font-semibold tabular-nums text-slate-800">{stats.totalTagRows}</p>
					<p class="text-xs text-slate-500">tag rows</p>
				</div>
				<div class="border-b border-accent pb-2">
					<p class="text-2xl font-semibold tabular-nums text-slate-800">{stats.uniqueFragmentCount}</p>
					<p class="text-xs text-slate-500">fragments</p>
				</div>
				<div class="border-b border-accent pb-2">
					<p class="text-2xl font-semibold tabular-nums text-slate-800">{fmtSentiment(stats.avgSentiment)}</p>
					<p class="text-xs text-slate-500">avg sentiment</p>
				</div>
			</div>

			{#if stats.totalTagRows === 0}
				<p
					class="mb-2 border-b border-muted-foreground font-heading text-xs font-bold uppercase text-muted-foreground"
				>
					No ThemeTag rows yet for {stats.query} in {scopeSuffix}. Run scripts/propose-theme-tags.mjs to populate.
				</p>
			{:else}
				<!-- Per-axis / per-theme breakdown when wildcard -->
				{#if stats.isWildcard && stats.perThemeBreakdown.length > 0}
					<section class="flex flex-col gap-2">
						<p
							class="mb-2 border-b border-muted-foreground font-heading text-xs font-bold uppercase text-muted-foreground"
						>
							Breakdown across themes ({stats.matchedThemeIds.length})
						</p>
						<ul class="flex flex-col gap-1.5">
							{#each stats.perThemeBreakdown as row (row.theme_id)}
								{@const tr = themeById.get(row.theme_id)}
								<li class="flex items-center gap-2">
									<span
										class="inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide {axisBg(row.theme_id)}"
										>{tr?.axis ?? row.theme_id.split('.')[0]}</span
									>
									<span class="min-w-0 flex-1 truncate text-sm text-slate-800">
										{tr?.label ?? row.theme_id}
									</span>
									<span class="font-mono text-xs tabular-nums text-slate-500">{row.count}</span>
								</li>
							{/each}
						</ul>
					</section>
				{/if}

				<!-- Sentiment distribution -->
				<section class="flex flex-col gap-1.5">
					<p
						class="mb-2 border-b border-muted-foreground font-heading text-xs font-bold uppercase text-muted-foreground"
					>
						Sentiment expressed
					</p>
					{#each stats.sentiment as s (s.value)}
						<StatBar
							label={s.label}
							count={s.count}
							max={max(stats.sentiment.map((x) => x.count))}
							tint={sentimentTint(s.value)}
							labelClass="w-32"
						/>
					{/each}
				</section>

				<!-- Example tag rows -->
				{#if stats.examples.length > 0}
					<section class="flex flex-col gap-2">
						<p
							class="mb-2 border-b border-muted-foreground font-heading text-xs font-bold uppercase text-muted-foreground"
						>
							Example spans ({stats.examples.length}/{stats.totalTagRows})
						</p>
						<ul class="flex flex-col gap-2">
							{#each stats.examples as ex, i (i)}
								{@const tr = themeById.get(ex.theme_id)}
								<li class="rounded-md border border-zinc-200 bg-white p-3">
									<div class="mb-1 flex items-center gap-2 text-[10px] uppercase tracking-wide text-slate-500">
										<span
											class="inline-flex items-center rounded-full border px-1.5 py-0.5 font-mono {axisBg(ex.theme_id)}"
											>{tr?.axis ?? ex.theme_id.split('.')[0]}</span
										>
										<span class="font-mono text-[10px] text-slate-600">{ex.theme_id}</span>
										<span class="ml-auto tabular-nums">conf {ex.confidence.toFixed(2)}</span>
										{#if ex.sentiment_score !== null}
											<span class="tabular-nums">sent {fmtSentiment(ex.sentiment_score)}</span>
										{/if}
									</div>
									<blockquote class="text-sm text-slate-800">"{ex.span_text}"</blockquote>
									{#if ex.rationale}
										<p class="mt-1 text-xs text-slate-500">{ex.rationale}</p>
									{/if}
								</li>
							{/each}
						</ul>
					</section>
				{/if}
			{/if}

			<!-- Provenance footer -->
			<div class="mt-auto border-t border-zinc-100 pt-3">
				<p class="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
					Query: {stats.query}
					{#if stats.isWildcard} · {stats.matchedThemeIds.length} themes{/if}
					· scope: {scopeSuffix}
				</p>
			</div>
		</div>
	{/if}
</TertiaryDrawer>
