<!--
	Topic Compare — single-topic-across-indications view.

	Pick a drug, sponsor, or lexicon cluster from the typeahead. For every
	indication that has corpora on disk, render a row with mention count,
	sentiment distribution, and a 5-year weekly search-interest sparkline.

	Spike route per CLAUDE.md's spike-then-commit rule. Reuses PageHeader and
	SentimentBar; combobox is built inline on Popover + Input (no shadcn
	command primitive in the project yet).
-->
<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import SearchIcon from '@lucide/svelte/icons/search';
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import XIcon from '@lucide/svelte/icons/x';

	import PageHeader from '$lib/components/PageHeader.svelte';
	import SentimentBar from '$lib/components/SentimentBar.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Popover from '$lib/components/ui/popover/index.js';
	import type { PageProps } from './$types';
	import type { Topic, TopicKey } from './+page.server';

	let { data }: PageProps = $props();

	const topicByKey = new Map(data.topics.map((t) => [t.key, t]));

	// URL-driven topic selection. Server seeds initialTopicKey, but the URL
	// is authoritative thereafter so deep links + back/forward work.
	const selectedKey = $derived<TopicKey | null>(
		(page.url.searchParams.get('topic') as TopicKey | null) ?? data.initialTopicKey
	);
	const selected = $derived<Topic | null>(selectedKey ? topicByKey.get(selectedKey) ?? null : null);

	async function pickTopic(key: TopicKey) {
		const params = new URLSearchParams(page.url.searchParams);
		params.set('topic', key);
		await goto(`?${params.toString()}`, { keepFocus: false, noScroll: true });
	}

	// Suggested chips — top 8 topics by aggregate mention count across all
	// indications. Computed once from the seed; no need to re-rank on every
	// pick. Skips topics with zero matches anywhere (would be a dead chip).
	function aggregateMentions(t: Topic): number {
		let total = 0;
		for (const ind of data.indications) {
			for (const cid of t.cluster_ids) {
				total += data.mentionsByIndication[ind.id]?.[cid]?.count ?? 0;
			}
		}
		return total;
	}
	const suggested = data.topics
		.map((t) => ({ t, n: aggregateMentions(t) }))
		.filter((x) => x.n > 0)
		.sort((a, b) => b.n - a.n)
		.slice(0, 8)
		.map((x) => x.t);

	// Typeahead state. Filters across the catalog by haystack; capped so the
	// list never has to virtualize. Drug → Sponsor → Cluster order matches
	// the catalog build order in +page.server.ts.
	let pickerOpen = $state(false);
	let query = $state('');
	const TYPEAHEAD_CAP = 40;
	const filtered = $derived.by(() => {
		const q = query.trim().toLowerCase();
		if (!q) {
			// Default open state: surface suggested + first slice so the list
			// isn't empty before the user types.
			return data.topics.slice(0, TYPEAHEAD_CAP);
		}
		const out: Topic[] = [];
		for (const t of data.topics) {
			if (t.haystack.includes(q)) out.push(t);
			if (out.length >= TYPEAHEAD_CAP) break;
		}
		return out;
	});

	// --- Per-row aggregates -------------------------------------------------
	// Roll a topic's cluster_ids up to a single (count, sentiments[], trend)
	// per indication. Done on the client because it's tiny and lets the URL
	// param drive without a round-trip.
	type Row = {
		indicationId: string;
		label: string;
		abbreviation: string | null;
		corpusFragmentCount: number;
		count: number;
		blocks: { sentiment: number }[];
		trend: { weeks: string[]; values: number[] } | null;
	};

	const rows = $derived.by<Row[]>(() => {
		if (!selected) return [];
		const out: Row[] = [];
		for (const ind of data.indications) {
			let count = 0;
			const blocks: { sentiment: number }[] = [];
			for (const cid of selected.cluster_ids) {
				const cell = data.mentionsByIndication[ind.id]?.[cid];
				if (!cell) continue;
				count += cell.count;
				for (const s of cell.sentiments) blocks.push({ sentiment: s });
			}
			// Trend: take the cluster with the strongest series; if a topic
			// rolls up to multiple clusters (sponsor → many drugs), sum
			// element-wise so the row reflects the topic, not just one drug.
			const trendIdx = data.trendsByIndication[ind.id];
			let trend: { weeks: string[]; values: number[] } | null = null;
			if (trendIdx) {
				const matched = selected.cluster_ids
					.map((cid) => trendIdx.byCluster[cid])
					.filter((s): s is { weeks: string[]; values: number[] } => !!s);
				if (matched.length === 1) {
					trend = matched[0];
				} else if (matched.length > 1) {
					const len = matched[0].values.length;
					const values = new Array(len).fill(0);
					for (const m of matched) for (let i = 0; i < len; i++) values[i] += m.values[i] ?? 0;
					trend = { weeks: matched[0].weeks, values };
				}
			}
			out.push({
				indicationId: ind.id,
				label: ind.label,
				abbreviation: ind.abbreviation,
				corpusFragmentCount: data.fragmentCountByIndication[ind.id] ?? 0,
				count,
				blocks,
				trend
			});
		}
		// Sort rows by descending mention count so the most-relevant indication
		// for the topic surfaces first.
		out.sort((a, b) => b.count - a.count);
		return out;
	});

	// Sparkline geometry. Compact inline SVG; no axes, no labels — only the
	// shape of the curve communicates. Width/height fixed so rows align.
	const SPARK_W = 220;
	const SPARK_H = 32;
	function sparkPath(values: number[]): string {
		if (!values.length) return '';
		const max = Math.max(1, ...values);
		const stepX = SPARK_W / Math.max(1, values.length - 1);
		let d = '';
		for (let i = 0; i < values.length; i++) {
			const x = i * stepX;
			const y = SPARK_H - (values[i] / max) * SPARK_H;
			d += i === 0 ? `M ${x.toFixed(1)} ${y.toFixed(1)}` : ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
		}
		return d;
	}
	function sparkPeak(values: number[]): number {
		return values.length ? Math.max(...values) : 0;
	}

	// Topic-kind chip color (no italics; full background tint — corner/rail
	// hard rule means we never use side borders on the rounded chips).
	const KIND_BG: Record<string, string> = {
		drug: 'bg-emerald-50 text-emerald-900',
		sponsor: 'bg-amber-50 text-amber-900',
		cluster: 'bg-sky-50 text-sky-900'
	};
	const KIND_LABEL: Record<string, string> = {
		drug: 'Drug',
		sponsor: 'Sponsor',
		cluster: 'Cluster'
	};
</script>

<svelte:head>
	<title>Topic compare · PatientlyIQ</title>
</svelte:head>

<PageHeader
	eyebrow="Topic compare"
	title="One topic, every indication"
	subtitle="Compare mention volume, sentiment, and US search interest for a single drug, sponsor, or lexicon cluster across every indication with corpora on disk."
/>

<div class="mx-auto w-full max-w-6xl px-8 py-8">
	<!-- Picker -->
	<section class="mb-8">
		<div class="mb-3 flex items-center gap-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
			Topic
		</div>

		<div class="flex flex-wrap items-center gap-2">
			{#if selected}
				<span
					class="inline-flex items-center gap-2 rounded-full bg-foreground px-3 py-1.5 text-sm font-medium text-background"
				>
					<span class="rounded-full bg-background/20 px-1.5 py-0.5 text-[10px] tracking-wide uppercase">
						{KIND_LABEL[selected.kind]}
					</span>
					{selected.label}
					{#if selected.sublabel}
						<span class="text-background/70">· {selected.sublabel}</span>
					{/if}
				</span>
			{/if}

			<Popover.Root bind:open={pickerOpen}>
				<Popover.Trigger
					class="inline-flex items-center gap-2 rounded-full border border-input bg-background px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted"
				>
					<SearchIcon class="size-3.5" />
					{selected ? 'Change topic' : 'Pick a topic'}
					<ChevronDownIcon class="size-3.5 opacity-60" />
				</Popover.Trigger>
				<Popover.Content class="w-[380px] p-0" align="start">
					<div class="border-b border-border p-2">
						<div class="flex items-center gap-2 rounded-md bg-muted px-2 py-1.5">
							<SearchIcon class="size-3.5 text-muted-foreground" />
							<input
								type="text"
								placeholder="Search drugs, sponsors, clusters…"
								class="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
								bind:value={query}
							/>
							{#if query}
								<button
									type="button"
									class="text-muted-foreground hover:text-foreground"
									onclick={() => (query = '')}
									aria-label="Clear search"
								>
									<XIcon class="size-3.5" />
								</button>
							{/if}
						</div>
					</div>
					<div class="max-h-[360px] overflow-y-auto py-1">
						{#if filtered.length === 0}
							<div class="px-3 py-6 text-center text-sm text-muted-foreground">
								No topics match
							</div>
						{:else}
							{#each filtered as t (t.key)}
								<button
									type="button"
									class="flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-sm hover:bg-muted {selectedKey ===
									t.key
										? 'bg-muted/60'
										: ''}"
									onclick={() => {
										pickerOpen = false;
										query = '';
										pickTopic(t.key);
									}}
								>
									<span class="flex min-w-0 items-center gap-2">
										<span
											class="shrink-0 rounded px-1.5 py-0.5 text-[10px] tracking-wide uppercase {KIND_BG[
												t.kind
											]}"
										>
											{KIND_LABEL[t.kind]}
										</span>
										<span class="truncate">{t.label}</span>
									</span>
									{#if t.sublabel}
										<span class="shrink-0 text-xs text-muted-foreground">{t.sublabel}</span>
									{/if}
								</button>
							{/each}
						{/if}
					</div>
				</Popover.Content>
			</Popover.Root>
		</div>

		{#if suggested.length > 0}
			<div class="mt-4">
				<div class="mb-2 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
					Top topics by mentions
				</div>
				<div class="flex flex-wrap gap-1.5">
					{#each suggested as t (t.key)}
						<button
							type="button"
							onclick={() => pickTopic(t.key)}
							class="inline-flex items-center gap-1.5 rounded-full border border-input bg-background px-2.5 py-1 text-xs font-medium text-foreground hover:bg-muted {selectedKey ===
							t.key
								? 'border-foreground'
								: ''}"
						>
							<span class="rounded px-1 py-0.5 text-[9px] tracking-wide uppercase {KIND_BG[t.kind]}">
								{KIND_LABEL[t.kind]}
							</span>
							{t.label}
						</button>
					{/each}
				</div>
			</div>
		{/if}
	</section>

	<!-- Comparison table -->
	{#if selected && rows.length > 0}
		<section class="rounded-xl border border-border bg-background">
			<header
				class="grid grid-cols-[200px_minmax(0,1fr)_240px] items-center gap-6 border-b border-border px-6 py-3 text-[11px] font-medium tracking-wide text-muted-foreground uppercase"
			>
				<div>Indication</div>
				<div>Mentions · sentiment</div>
				<div>US search interest, 5y weekly</div>
			</header>

			{#each rows as row (row.indicationId)}
				<div
					class="grid grid-cols-[200px_minmax(0,1fr)_240px] items-center gap-6 border-b border-border px-6 py-5 last:border-b-0"
				>
					<!-- Indication name + corpus size -->
					<div class="flex flex-col">
						<span class="text-sm font-semibold text-foreground">{row.label}</span>
						<span class="text-xs text-muted-foreground">
							{row.corpusFragmentCount.toLocaleString()} fragments
						</span>
					</div>

					<!-- Count + sentiment bar -->
					<div class="flex items-center gap-4">
						<div class="w-16 shrink-0 text-right">
							<div class="text-xl font-semibold tabular-nums text-foreground">
								{row.count.toLocaleString()}
							</div>
							<div class="text-[10px] tracking-wide text-muted-foreground uppercase">
								mentions
							</div>
						</div>
						{#if row.count > 0}
							<div class="min-w-0 flex-1">
								<SentimentBar label="" blocks={row.blocks} labelClass="w-0" />
							</div>
						{:else}
							<span class="text-sm text-muted-foreground/70">— no mentions in corpora</span>
						{/if}
					</div>

					<!-- Sparkline -->
					<div class="flex flex-col items-end">
						{#if row.trend && sparkPeak(row.trend.values) > 0}
							<svg
								width={SPARK_W}
								height={SPARK_H}
								viewBox="0 0 {SPARK_W} {SPARK_H}"
								class="block"
								role="img"
								aria-label="Weekly US search interest for {selected?.label} in {row.label}"
							>
								<path
									d={sparkPath(row.trend.values)}
									fill="none"
									stroke="currentColor"
									stroke-width="1.5"
									class="text-foreground"
								/>
							</svg>
							<div class="mt-1 text-[10px] tracking-wide text-muted-foreground uppercase">
								peak idx {sparkPeak(row.trend.values).toFixed(0)}
							</div>
						{:else if row.trend}
							<span class="text-sm text-muted-foreground/70">— no search signal</span>
						{:else}
							<span class="text-sm text-muted-foreground/70">— no trend data</span>
						{/if}
					</div>
				</div>
			{/each}
		</section>
	{:else if !selected}
		<div class="rounded-xl border border-dashed border-border px-6 py-12 text-center text-sm text-muted-foreground">
			Pick a topic above to compare.
		</div>
	{/if}
</div>
