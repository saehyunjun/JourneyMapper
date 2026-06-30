<!--
	Digital data explorer.

	One catalog page per indication. Reads `data.manifest` + `data.datasets`
	from the server loader, groups datasets by type, and renders a light
	viz per card (horizontal bars for search volumes, paired bars for
	community engagement, top-N tables for sponsors and interventions,
	etc.). Indication is switched via the existing WctglpTopbar selector,
	which invalidates this loader on change.
-->
<script lang="ts">
	import PageHeader from '$lib/components/PageHeader.svelte';
	import type { DiseaseDatasetType, DiseaseDatasetRef } from '$lib/content/disease-insights';
	import type { ResolvedDataset } from './+page.server';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	type GroupKey = 'search' | 'community' | 'ad_spend' | 'clinical_trials' | 'lexicon' | 'other';
	const GROUP_LABEL: Record<GroupKey, string> = {
		search: 'Search interest',
		community: 'Patient communities',
		ad_spend: 'Digital ad spend',
		clinical_trials: 'Clinical trials',
		lexicon: 'Lexicon',
		other: 'Other'
	};
	const GROUP_ORDER: GroupKey[] = [
		'search',
		'community',
		'ad_spend',
		'clinical_trials',
		'lexicon',
		'other'
	];

	function groupOf(type: DiseaseDatasetType | string): GroupKey {
		if (type === 'search_volume_topics') return 'search';
		if (type === 'search_volume_timeseries') return 'search';
		if (type === 'community_engagement') return 'community';
		if (type === 'ad_spend_timeseries') return 'ad_spend';
		if (type === 'keyword_clusters') return 'lexicon';
		if (typeof type === 'string' && type.startsWith('clinical_trials_')) return 'clinical_trials';
		return 'other';
	}

	const groups = $derived.by(() => {
		const map = new Map<GroupKey, ResolvedDataset[]>();
		for (const d of data.datasets) {
			const k = groupOf(d.ref.type);
			if (!map.has(k)) map.set(k, []);
			map.get(k)!.push(d);
		}
		return GROUP_ORDER.filter((k) => map.has(k)).map((k) => ({
			key: k,
			label: GROUP_LABEL[k],
			items: map.get(k)!
		}));
	});

	function fmtNum(n: number): string {
		if (!Number.isFinite(n)) return '—';
		const abs = Math.abs(n);
		if (abs >= 1_000_000) return (n / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1) + 'M';
		if (abs >= 1_000) return (n / 1_000).toFixed(abs >= 10_000 ? 0 : 1) + 'k';
		return String(Math.round(n));
	}

	function fmtUSD(n: number): string {
		if (!Number.isFinite(n)) return '—';
		if (Math.abs(n) >= 1_000) return '$' + fmtNum(n);
		return '$' + Math.round(n).toLocaleString();
	}

	function titleOf(ref: DiseaseDatasetRef, payload: unknown): string {
		if (payload && typeof payload === 'object' && payload !== null && 'title' in payload) {
			const t = (payload as { title?: unknown }).title;
			if (typeof t === 'string' && t.length > 0) return t;
		}
		return ref.label;
	}

	function subtitleOf(payload: unknown): string | null {
		if (payload && typeof payload === 'object' && payload !== null && 'subtitle' in payload) {
			const s = (payload as { subtitle?: unknown }).subtitle;
			if (typeof s === 'string' && s.length > 0) return s;
		}
		return null;
	}

	// ---------- Per-shape extractors (light-weight, defensive) ----------

	type TopicRow = { topic: string; volume: number };
	function asSearchTopics(payload: unknown): TopicRow[] {
		const rows = (payload as { data?: unknown })?.data;
		if (!Array.isArray(rows)) return [];
		return rows
			.map((r) => {
				const topic = (r as { topic?: unknown }).topic;
				const volume = (r as { volume?: unknown }).volume;
				if (typeof topic !== 'string' || typeof volume !== 'number') return null;
				return { topic, volume };
			})
			.filter((r): r is TopicRow => r !== null)
			.sort((a, b) => b.volume - a.volume);
	}

	type TrendSeries = {
		query: string;
		display_label: string;
		cluster_id: string | null;
		searchLine: string;
		searchArea: string;
		mentionBars: { x: number; y: number; h: number }[];
		searchPeak: number;
		searchPeakWeek: string;
		mentionTotal: number;
		mentionMax: number;
	};
	type TrendChart = {
		weeks: string[];
		weekCount: number;
		yearTicks: { x: number; label: string }[];
		mentionWindow: { startIso: string | null; endIso: string | null } | null;
		series: TrendSeries[];
	};

	/**
	 * Build small-multiples geometry for a search_volume_timeseries payload.
	 * Coordinate system per row: viewBox `0 0 W 30`, where W = weekCount.
	 *   y= 0..22 → search index (top), 100 at y=0, 0 at y=22
	 *   y=22..24 → gap / baseline
	 *   y=24..30 → mention bars (grow upward from y=30)
	 * Mention bars are normalized per-row by the row's own max so sparse rows
	 * still register; the rendered row label carries the absolute total.
	 */
	function asSearchTrendseries(payload: unknown): TrendChart | null {
		const obj = payload as Record<string, unknown> | null;
		if (!obj || !Array.isArray(obj.weeks) || !Array.isArray(obj.series)) return null;
		const weeks = obj.weeks.filter((w): w is string => typeof w === 'string');
		if (weeks.length === 0) return null;

		const W = weeks.length;

		// Year-boundary ticks — first week index whose iso >= "YYYY-01-01".
		const yearTicks: { x: number; label: string }[] = [];
		const firstYear = parseInt(weeks[0].slice(0, 4), 10);
		const lastYear = parseInt(weeks[weeks.length - 1].slice(0, 4), 10);
		if (Number.isFinite(firstYear) && Number.isFinite(lastYear)) {
			for (let y = firstYear + 1; y <= lastYear; y++) {
				const boundary = `${y}-01-01`;
				const idx = weeks.findIndex((w) => w >= boundary);
				if (idx >= 0) yearTicks.push({ x: idx, label: String(y) });
			}
		}

		const series: TrendSeries[] = [];
		for (const raw of obj.series) {
			const s = raw as Record<string, unknown>;
			const query = typeof s.query === 'string' ? s.query : '';
			const display_label =
				typeof s.display_label === 'string' && s.display_label.length > 0
					? s.display_label
					: query;
			const cluster_id = typeof s.cluster_id === 'string' ? s.cluster_id : null;
			const searchArr = Array.isArray(s.search_index)
				? (s.search_index as unknown[]).map((v) => (typeof v === 'number' ? v : 0))
				: [];
			const mentionArr = Array.isArray(s.mention_count)
				? (s.mention_count as unknown[]).map((v) => (typeof v === 'number' ? v : 0))
				: [];
			if (searchArr.length !== W || mentionArr.length !== W) continue;

			// Search line + area
			const lineCmds: string[] = [];
			for (let i = 0; i < W; i++) {
				const x = i + 0.5;
				const y = 22 - (Math.max(0, Math.min(100, searchArr[i])) / 100) * 22;
				lineCmds.push(`${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`);
			}
			const searchLine = lineCmds.join(' ');
			const searchArea =
				`M0.5,22 ` + lineCmds.slice(1).join(' ').replace(/^M/, 'L') + ` L${(W - 0.5).toFixed(2)},22 Z`;

			// Mention bars (normalized per-row)
			let mentionMax = 0;
			let mentionTotal = 0;
			for (const n of mentionArr) {
				mentionTotal += n;
				if (n > mentionMax) mentionMax = n;
			}
			const mentionBars: { x: number; y: number; h: number }[] = [];
			if (mentionMax > 0) {
				for (let i = 0; i < W; i++) {
					if (mentionArr[i] <= 0) continue;
					const h = (mentionArr[i] / mentionMax) * 6;
					mentionBars.push({ x: i + 0.1, y: 30 - h, h });
				}
			}

			// Search peak
			let searchPeak = 0;
			let searchPeakIdx = 0;
			for (let i = 0; i < W; i++) {
				if (searchArr[i] > searchPeak) {
					searchPeak = searchArr[i];
					searchPeakIdx = i;
				}
			}

			series.push({
				query,
				display_label,
				cluster_id,
				searchLine,
				searchArea,
				mentionBars,
				searchPeak,
				searchPeakWeek: weeks[searchPeakIdx] ?? '',
				mentionTotal,
				mentionMax
			});
		}

		const mentionsSource = (obj.source as Record<string, unknown> | undefined)?.mentions as
			| Record<string, unknown>
			| undefined;
		const observed = mentionsSource?.corpus_observed_window as
			| Record<string, unknown>
			| undefined;
		const mentionWindow =
			observed && (typeof observed.start_iso === 'string' || typeof observed.end_iso === 'string')
				? {
						startIso: typeof observed.start_iso === 'string' ? observed.start_iso : null,
						endIso: typeof observed.end_iso === 'string' ? observed.end_iso : null
					}
				: null;

		return { weeks, weekCount: W, yearTicks, mentionWindow, series };
	}

	type CommunityRow = {
		key: string;
		membership: number;
		monthlyPosts: number;
	};
	function asCommunityRows(payload: unknown): CommunityRow[] {
		const rows = (payload as { data?: unknown })?.data;
		if (!Array.isArray(rows)) return [];
		return rows
			.map((r) => {
				const obj = r as Record<string, unknown>;
				const key =
					typeof obj.group_type === 'string'
						? obj.group_type
						: typeof obj.platform_type === 'string'
							? obj.platform_type
							: null;
				const membership = typeof obj.avg_membership === 'number' ? obj.avg_membership : null;
				const posts = typeof obj.avg_monthly_posts === 'number' ? obj.avg_monthly_posts : null;
				if (key === null || membership === null || posts === null) return null;
				return { key, membership, monthlyPosts: posts };
			})
			.filter((r): r is CommunityRow => r !== null);
	}

	type AdSpendDomain = {
		domain: string;
		months: { month: string; label: string; spend: number }[];
		total: number;
	};
	function asAdSpend(payload: unknown): AdSpendDomain[] {
		const rows = (payload as { data?: unknown })?.data;
		if (!Array.isArray(rows)) return [];
		return rows
			.map((r): AdSpendDomain | null => {
				const obj = r as Record<string, unknown>;
				if (typeof obj.domain !== 'string' || !Array.isArray(obj.values)) return null;
				const months = obj.values
					.map((v) => {
						const vo = v as Record<string, unknown>;
						if (
							typeof vo.month !== 'string' ||
							typeof vo.label !== 'string' ||
							typeof vo.estimated_spend !== 'number'
						)
							return null;
						return { month: vo.month, label: vo.label, spend: vo.estimated_spend };
					})
					.filter((m): m is { month: string; label: string; spend: number } => m !== null);
				const total = months.reduce((acc, m) => acc + m.spend, 0);
				return { domain: obj.domain, months, total };
			})
			.filter((d): d is AdSpendDomain => d !== null)
			.sort((a, b) => b.total - a.total);
	}

	type ClusterSummary = {
		count: number;
		themes: { theme: string; count: number }[];
	};
	function asClusterSummary(payload: unknown): ClusterSummary | null {
		const clusters = (payload as { clusters?: unknown })?.clusters;
		if (!Array.isArray(clusters)) return null;
		const byTheme = new Map<string, number>();
		for (const c of clusters) {
			const theme = (c as { parent_theme?: unknown }).parent_theme;
			if (typeof theme === 'string') byTheme.set(theme, (byTheme.get(theme) ?? 0) + 1);
		}
		return {
			count: clusters.length,
			themes: Array.from(byTheme.entries())
				.map(([theme, count]) => ({ theme, count }))
				.sort((a, b) => b.count - a.count)
		};
	}

	type StudiesSummary = {
		count: number;
		statuses: { status: string; count: number }[];
		recentCount: number;
	};
	function asStudiesSummary(payload: unknown): StudiesSummary | null {
		const studies = (payload as { studies?: unknown })?.studies;
		if (!Array.isArray(studies)) return null;
		const byStatus = new Map<string, number>();
		let recent = 0;
		const cutoffYear = new Date().getUTCFullYear() - 3;
		for (const s of studies) {
			const obj = s as Record<string, unknown>;
			const status = typeof obj.overall_status === 'string' ? obj.overall_status : 'UNKNOWN';
			byStatus.set(status, (byStatus.get(status) ?? 0) + 1);
			const start = (obj.dates as Record<string, unknown> | undefined)?.start as
				| Record<string, unknown>
				| undefined;
			const iso = start?.iso8601;
			if (typeof iso === 'string') {
				const year = parseInt(iso.slice(0, 4), 10);
				if (Number.isFinite(year) && year >= cutoffYear) recent++;
			}
		}
		return {
			count: studies.length,
			statuses: Array.from(byStatus.entries())
				.map(([status, count]) => ({ status, count }))
				.sort((a, b) => b.count - a.count),
			recentCount: recent
		};
	}

	type SponsorRow = {
		name: string;
		classes: string[];
		lead: number;
		collab: number;
		total: number;
	};
	function asSponsors(payload: unknown): { total: number; rows: SponsorRow[] } | null {
		const list = (payload as { sponsors?: unknown })?.sponsors;
		if (!Array.isArray(list)) return null;
		const rows = list
			.map((s): SponsorRow | null => {
				const o = s as Record<string, unknown>;
				if (typeof o.name !== 'string') return null;
				return {
					name: o.name,
					classes: Array.isArray(o.classes) ? (o.classes as string[]) : [],
					lead: typeof o.lead_count === 'number' ? o.lead_count : 0,
					collab: typeof o.collaborator_count === 'number' ? o.collaborator_count : 0,
					total: typeof o.total_count === 'number' ? o.total_count : 0
				};
			})
			.filter((r): r is SponsorRow => r !== null)
			.sort((a, b) => b.total - a.total);
		return { total: rows.length, rows };
	}

	type InterventionRow = {
		name: string;
		types: string[];
		count: number;
		nctCount: number;
	};
	function asInterventions(payload: unknown): { total: number; rows: InterventionRow[] } | null {
		const list = (payload as { interventions?: unknown })?.interventions;
		if (!Array.isArray(list)) return null;
		const rows = list
			.map((i): InterventionRow | null => {
				const o = i as Record<string, unknown>;
				const name =
					typeof o.name_key === 'string'
						? o.name_key
						: Array.isArray(o.name_variants) && typeof o.name_variants[0] === 'string'
							? (o.name_variants[0] as string)
							: null;
				if (name === null) return null;
				return {
					name,
					types: Array.isArray(o.types) ? (o.types as string[]) : [],
					count: typeof o.count === 'number' ? o.count : 0,
					nctCount: typeof o.nct_id_count === 'number' ? o.nct_id_count : 0
				};
			})
			.filter((r): r is InterventionRow => r !== null)
			.sort((a, b) => b.nctCount - a.nctCount);
		return { total: rows.length, rows };
	}

	type RawSummary = {
		count: number;
		fetchedAt: string | null;
		filteredCount: number | null;
		filterRule: string | null;
		filterCutoff: string | null;
	};
	function asRawSummary(payload: unknown): RawSummary | null {
		const o = payload as Record<string, unknown> | null;
		if (!o) return null;
		const count = typeof o.deduped_count === 'number' ? o.deduped_count : null;
		const fetchedAt = typeof o.fetched_at === 'string' ? o.fetched_at : null;
		const filteredCount = typeof o.filtered_count === 'number' ? o.filtered_count : null;
		const filterRule = typeof o.filter_rule === 'string' ? o.filter_rule : null;
		const filterCutoff = typeof o.filter_cutoff === 'string' ? o.filter_cutoff : null;
		if (count === null && fetchedAt === null && filteredCount === null) return null;
		return { count: count ?? 0, fetchedAt, filteredCount, filterRule, filterCutoff };
	}

	// Pretty labels for community / sponsor / status / intervention enums.
	function humanize(s: string): string {
		return s
			.replace(/_/g, ' ')
			.toLowerCase()
			.replace(/\b([a-z])/g, (_, c) => c.toUpperCase());
	}
</script>

<svelte:head>
	<title>Digital data · {data.manifest?.label ?? 'PatientlyIQ'}</title>
</svelte:head>

<PageHeader
	eyebrow="Digital data explorer"
	title={data.manifest ? data.manifest.label : 'Digital data'}
	subtitle="Every digital dataset registered for this indication — search interest, patient-community engagement, ad spend, clinical-trial registry, and lexicon. Switch indication via the selector in the top bar."
/>

<div class="mx-auto w-full max-w-7xl px-8 pt-8 pb-16">
	{#if !data.manifest}
		<p class="text-sm text-(--gray)">No manifest registered for the active indication.</p>
	{:else if data.datasets.length === 0}
		<p class="text-sm text-(--gray)">This indication has no datasets registered yet.</p>
	{:else}
		<div class="mb-6 flex flex-wrap items-center gap-2 text-xs text-(--gray)">
			<span class="rounded-full border border-(--panel-mid) bg-(--paper) px-2.5 py-1 font-medium">
				{data.datasets.length} datasets
			</span>
			{#each data.manifest.therapeutic_area_ids as taId (taId)}
				<span class="rounded-full border border-(--panel-mid) bg-(--paper) px-2.5 py-1">
					{humanize(taId)}
				</span>
			{/each}
			{#if data.manifest.abbreviation}
				<span class="rounded-full border border-(--panel-mid) bg-(--paper) px-2.5 py-1">
					{data.manifest.abbreviation}
				</span>
			{/if}
		</div>

		{#each groups as group (group.key)}
			<section class="mb-10">
				<h2 class="font-heading mb-3 text-xs font-semibold tracking-widest uppercase text-(--darkgrayblue)">
					{group.label}
					<span class="ml-1 text-(--gray)">({group.items.length})</span>
				</h2>

				<div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
					{#each group.items as item (item.ref.id)}
						{@const payload = item.payload}
						<article class="rounded-lg border border-(--panel-mid) bg-(--paper) p-4">
							<header class="mb-3 flex items-start justify-between gap-3">
								<div class="min-w-0">
									<h3 class="font-heading text-sm font-semibold text-(--ink)">
										{titleOf(item.ref, payload)}
									</h3>
									{#if subtitleOf(payload)}
										<p class="mt-0.5 text-xs text-(--gray)">{subtitleOf(payload)}</p>
									{/if}
								</div>
								<div class="flex shrink-0 flex-col items-end gap-1 text-[10px] text-(--gray)">
									<span class="rounded bg-(--panel) px-1.5 py-0.5 font-mono">{item.ref.type}</span>
									{#if item.ref.geography}<span>{item.ref.geography}</span>{/if}
									{#if item.ref.unit}<span class="font-mono">{item.ref.unit}</span>{/if}
								</div>
							</header>

							{#if payload === null}
								<p class="text-xs text-(--gray)">
									Payload not bundled
									<span class="font-mono">({item.ref.path})</span>
								</p>
							{:else if item.ref.type === 'search_volume_topics'}
								{@const topics = asSearchTopics(payload)}
								{#if topics.length === 0}
									<p class="text-xs text-(--gray)">No rows.</p>
								{:else}
									{@const max = topics[0].volume || 1}
									<ul class="flex flex-col gap-1.5">
										{#each topics as row (row.topic)}
											<li class="grid grid-cols-[10rem_1fr_3rem] items-center gap-2 text-xs">
												<span class="truncate text-(--ink)" title={row.topic}>{row.topic}</span>
												<span class="h-2 rounded-full bg-(--panel)">
													<span
														class="block h-2 rounded-full bg-(--orange)/70"
														style:width="{(row.volume / max) * 100}%"
													></span>
												</span>
												<span class="text-right font-mono text-(--darkgrayblue)">{fmtNum(row.volume)}</span>
											</li>
										{/each}
									</ul>
								{/if}
							{:else if item.ref.type === 'search_volume_timeseries'}
								{@const trend = asSearchTrendseries(payload)}
								{#if !trend}
									<p class="text-xs text-(--gray)">Could not parse time series.</p>
								{:else}
									<div class="flex flex-col gap-2">
										{#each trend.series as s (s.query)}
											<div class="grid grid-cols-[8.5rem_1fr] items-center gap-3">
												<div class="text-[11px] leading-tight">
													<div class="truncate text-(--ink)" title={s.display_label}>
														{s.display_label}
													</div>
													<div class="mt-0.5 font-mono text-[10px] text-(--gray)">
														peak {s.searchPeak} · {s.mentionTotal} mention{s.mentionTotal === 1 ? '' : 's'}
													</div>
												</div>
												<svg
													viewBox="0 0 {trend.weekCount} 30"
													preserveAspectRatio="none"
													class="block h-16 w-full"
													role="img"
													aria-label="Weekly Google Trends index and forum mention overlay for {s.display_label}"
												>
													{#each trend.yearTicks as t, ti (ti)}
														<line
															x1={t.x}
															x2={t.x}
															y1="0"
															y2="30"
															stroke="var(--panel-mid)"
															stroke-width="0.15"
															vector-effect="non-scaling-stroke"
														/>
													{/each}
													<line
														x1="0"
														x2={trend.weekCount}
														y1="22"
														y2="22"
														stroke="var(--panel-mid)"
														stroke-width="0.15"
														vector-effect="non-scaling-stroke"
													/>
													<path d={s.searchArea} fill="var(--orange)" fill-opacity="0.16" />
													<path
														d={s.searchLine}
														stroke="var(--orange)"
														stroke-width="1"
														fill="none"
														vector-effect="non-scaling-stroke"
													/>
													{#each s.mentionBars as b, bi (bi)}
														<rect
															x={b.x}
															y={b.y}
															width="0.8"
															height={b.h}
															fill="var(--teal)"
															fill-opacity="0.9"
														/>
													{/each}
												</svg>
											</div>
										{/each}
									</div>
									<div
										class="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-(--panel-mid) pt-2 text-[10px] text-(--gray)"
									>
										<span class="grid grid-cols-[8.5rem_1fr] gap-3 w-full font-mono">
											<span></span>
											<span class="flex justify-between">
												{#each trend.yearTicks as t, ti (ti)}
													<span>{t.label}</span>
												{/each}
											</span>
										</span>
										<span class="inline-flex items-center gap-1.5">
											<span class="block h-1.5 w-4 rounded-full bg-(--orange)/70"></span>
											Google Trends index (0–100)
										</span>
										<span class="inline-flex items-center gap-1.5">
											<span class="block h-2.5 w-1 bg-(--teal)"></span>
											Forum mentions / week
										</span>
										{#if trend.mentionWindow && (trend.mentionWindow.startIso || trend.mentionWindow.endIso)}
											<span>
												mentions window:
												<span class="font-mono">
													{trend.mentionWindow.startIso ?? '?'} → {trend.mentionWindow.endIso ?? '?'}
												</span>
											</span>
										{/if}
									</div>
								{/if}
							{:else if item.ref.type === 'community_engagement'}
								{@const rows = asCommunityRows(payload)}
								{#if rows.length === 0}
									<p class="text-xs text-(--gray)">No rows.</p>
								{:else}
									{@const maxMembers = Math.max(...rows.map((r) => r.membership), 1)}
									{@const maxPosts = Math.max(...rows.map((r) => r.monthlyPosts), 1)}
									<table class="w-full text-xs">
										<thead class="text-[10px] uppercase tracking-wider text-(--gray)">
											<tr>
												<th class="py-1 text-left font-medium">Community</th>
												<th class="py-1 text-right font-medium">Avg members</th>
												<th class="py-1 text-right font-medium">Posts / mo</th>
											</tr>
										</thead>
										<tbody>
											{#each rows as row (row.key)}
												<tr class="border-t border-(--panel-mid)">
													<td class="py-1.5 pr-2">{humanize(row.key)}</td>
													<td class="py-1.5 pr-2 text-right">
														<div class="flex items-center justify-end gap-2">
															<span class="font-mono text-(--darkgrayblue)">{fmtNum(row.membership)}</span>
															<span class="block h-1.5 w-16 rounded-full bg-(--panel)">
																<span
																	class="block h-1.5 rounded-full bg-(--teal)/70"
																	style:width="{(row.membership / maxMembers) * 100}%"
																></span>
															</span>
														</div>
													</td>
													<td class="py-1.5 text-right">
														<div class="flex items-center justify-end gap-2">
															<span class="font-mono text-(--darkgrayblue)">{fmtNum(row.monthlyPosts)}</span>
															<span class="block h-1.5 w-16 rounded-full bg-(--panel)">
																<span
																	class="block h-1.5 rounded-full bg-(--gold)/70"
																	style:width="{(row.monthlyPosts / maxPosts) * 100}%"
																></span>
															</span>
														</div>
													</td>
												</tr>
											{/each}
										</tbody>
									</table>
								{/if}
							{:else if item.ref.type === 'ad_spend_timeseries'}
								{@const domains = asAdSpend(payload)}
								{#if domains.length === 0}
									<p class="text-xs text-(--gray)">No rows.</p>
								{:else}
									{@const max = domains[0].total || 1}
									<ul class="flex flex-col gap-1.5">
										{#each domains as d (d.domain)}
											<li class="grid grid-cols-[12rem_1fr_4rem] items-center gap-2 text-xs">
												<span class="truncate text-(--ink)" title={d.domain}>{d.domain}</span>
												<span class="h-2 rounded-full bg-(--panel)">
													<span
														class="block h-2 rounded-full bg-(--orange)/70"
														style:width="{(d.total / max) * 100}%"
													></span>
												</span>
												<span class="text-right font-mono text-(--darkgrayblue)">{fmtUSD(d.total)}</span>
											</li>
										{/each}
									</ul>
									<p class="mt-2 text-[10px] text-(--gray)">
										Totals across {domains[0]?.months.length ?? 0} months.
									</p>
								{/if}
							{:else if item.ref.type === 'keyword_clusters'}
								{@const summary = asClusterSummary(payload)}
								{#if !summary}
									<p class="text-xs text-(--gray)">Could not summarize.</p>
								{:else}
									<div class="mb-2 flex items-baseline gap-2">
										<span class="font-heading text-2xl font-light text-(--darkgrayblue)">
											{summary.count}
										</span>
										<span class="text-xs text-(--gray)">clusters</span>
									</div>
									<ul class="flex flex-wrap gap-1.5">
										{#each summary.themes as t (t.theme)}
											<li
												class="rounded-full border border-(--panel-mid) bg-(--panel) px-2 py-0.5 text-[11px] text-(--darkgrayblue)"
											>
												{humanize(t.theme)} · {t.count}
											</li>
										{/each}
									</ul>
								{/if}
							{:else if item.ref.type === 'clinical_trials_normalized'}
								{@const summary = asStudiesSummary(payload)}
								{#if !summary}
									<p class="text-xs text-(--gray)">Could not summarize.</p>
								{:else}
									<div class="mb-3 grid grid-cols-2 gap-3">
										<div>
											<div class="font-heading text-2xl font-light text-(--darkgrayblue)">
												{summary.count}
											</div>
											<div class="text-[10px] uppercase tracking-wider text-(--gray)">studies</div>
										</div>
										<div>
											<div class="font-heading text-2xl font-light text-(--darkgrayblue)">
												{summary.recentCount}
											</div>
											<div class="text-[10px] uppercase tracking-wider text-(--gray)">
												started in last 3 yr
											</div>
										</div>
									</div>
									{@const maxStatus = summary.statuses[0]?.count || 1}
									<ul class="flex flex-col gap-1">
										{#each summary.statuses.slice(0, 6) as s (s.status)}
											<li class="grid grid-cols-[8rem_1fr_2.5rem] items-center gap-2 text-[11px]">
												<span class="truncate text-(--ink)">{humanize(s.status)}</span>
												<span class="h-1.5 rounded-full bg-(--panel)">
													<span
														class="block h-1.5 rounded-full bg-(--midgrayblue)/70"
														style:width="{(s.count / maxStatus) * 100}%"
													></span>
												</span>
												<span class="text-right font-mono text-(--darkgrayblue)">{s.count}</span>
											</li>
										{/each}
									</ul>
								{/if}
							{:else if item.ref.type === 'clinical_trials_sponsors_observed'}
								{@const summary = asSponsors(payload)}
								{#if !summary}
									<p class="text-xs text-(--gray)">Could not summarize.</p>
								{:else}
									<div class="mb-2 text-xs text-(--gray)">
										<span class="font-heading text-lg font-light text-(--darkgrayblue)">
											{summary.total}
										</span>
										distinct sponsors · top 10 shown
									</div>
									{@const maxTotal = summary.rows[0]?.total || 1}
									<ul class="flex flex-col gap-1">
										{#each summary.rows.slice(0, 10) as s (s.name)}
											<li class="grid grid-cols-[1fr_1fr_2.5rem] items-center gap-2 text-[11px]">
												<span class="truncate text-(--ink)" title={s.name}>
													{s.name}
													{#if s.classes.length}
														<span class="ml-1 text-(--gray)">· {s.classes[0].toLowerCase()}</span>
													{/if}
												</span>
												<span class="h-1.5 rounded-full bg-(--panel)">
													<span
														class="block h-1.5 rounded-full bg-(--teal)/70"
														style:width="{(s.total / maxTotal) * 100}%"
													></span>
												</span>
												<span class="text-right font-mono text-(--darkgrayblue)">{s.total}</span>
											</li>
										{/each}
									</ul>
								{/if}
							{:else if item.ref.type === 'clinical_trials_interventions_observed'}
								{@const summary = asInterventions(payload)}
								{#if !summary}
									<p class="text-xs text-(--gray)">Could not summarize.</p>
								{:else}
									<div class="mb-2 text-xs text-(--gray)">
										<span class="font-heading text-lg font-light text-(--darkgrayblue)">
											{summary.total}
										</span>
										distinct interventions · top 10 by trial count
									</div>
									{@const maxNct = summary.rows[0]?.nctCount || 1}
									<ul class="flex flex-col gap-1">
										{#each summary.rows.slice(0, 10) as i (i.name)}
											<li class="grid grid-cols-[1fr_1fr_2.5rem] items-center gap-2 text-[11px]">
												<span class="truncate text-(--ink)" title={i.name}>
													{i.name}
													{#if i.types.length}
														<span class="ml-1 text-(--gray)">· {i.types[0].toLowerCase()}</span>
													{/if}
												</span>
												<span class="h-1.5 rounded-full bg-(--panel)">
													<span
														class="block h-1.5 rounded-full bg-(--orange)/70"
														style:width="{(i.nctCount / maxNct) * 100}%"
													></span>
												</span>
												<span class="text-right font-mono text-(--darkgrayblue)">{i.nctCount}</span>
											</li>
										{/each}
									</ul>
								{/if}
							{:else if item.ref.type === 'clinical_trials_raw'}
								{@const summary = asRawSummary(payload)}
								{#if !summary}
									<p class="text-xs text-(--gray)">Raw envelope not bundled (intentionally — too large).</p>
								{:else}
									<div class="grid grid-cols-2 gap-3">
										<div>
											<div class="font-heading text-2xl font-light text-(--darkgrayblue)">
												{summary.filteredCount ?? summary.count}
											</div>
											<div class="text-[10px] uppercase tracking-wider text-(--gray)">
												{summary.filteredCount !== null ? 'active + recently updated' : 'deduped studies'}
											</div>
											{#if summary.filteredCount !== null}
												<div class="mt-0.5 text-[10px] text-(--gray)">
													of <span class="font-mono">{summary.count}</span> all-time
												</div>
											{/if}
										</div>
										{#if summary.fetchedAt}
											<div>
												<div class="font-mono text-xs text-(--darkgrayblue)">
													{summary.fetchedAt.slice(0, 10)}
												</div>
												<div class="text-[10px] uppercase tracking-wider text-(--gray)">last fetch</div>
											</div>
										{/if}
									</div>
									{#if summary.filterCutoff}
										<p class="mt-2 text-[10px] text-(--gray)">
											Filter: status ∈ active OR last_update_post ≥ <span class="font-mono">{summary.filterCutoff}</span>
										</p>
									{/if}
								{/if}
							{:else}
								<p class="text-xs text-(--gray)">
									No renderer for type <span class="font-mono">{item.ref.type}</span>.
								</p>
							{/if}

							<footer class="mt-3 border-t border-(--panel-mid) pt-2 text-[10px] text-(--gray)">
								<span class="font-mono">{item.ref.path}</span>
							</footer>
						</article>
					{/each}
				</div>
			</section>
		{/each}
	{/if}
</div>
