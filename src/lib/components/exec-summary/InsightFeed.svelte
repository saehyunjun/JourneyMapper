<!--
	InsightFeed — left rail of the Executive Summary dashboard.

	A tabbed, scrollable list of selectable insights. The three tabs surface
	different cuts of the same corpus:
	  - Findings: the cluster-driven cards built in executive-summary.ts
	  - Themes:   each coded theme as a row with a mini sentiment bar
	  - Quotes:   analyst-starred highlights

	Selection is owned by the parent (`+page.svelte`). The feed only renders
	and emits `onselect` — the detail pane reacts to the new selection.
-->
<script lang="ts">
	import type { Finding } from '$lib/content/wctglpdemo-data/executive-summary';
	import type { Quote } from '$lib/content/wctglpdemo-data/analysis';
	import { participantLabel } from '$lib/content/wctglpdemo-data/analysis';
	import ParticipantAvatar from '$lib/components/ParticipantAvatar.svelte';
	import { Star } from '@lucide/svelte';
	import type { Selection, ThemeRow } from './types';

	type Props = {
		findings: Finding[];
		themes: ThemeRow[];
		starredQuotes: Quote[];
		selected: Selection;
		onselect: (sel: Selection) => void;
	};

	let { findings, themes, starredQuotes, selected, onselect }: Props = $props();

	type Tab = 'findings' | 'themes' | 'quotes';
	let tab = $state<Tab>('findings');

	const toneAccent: Record<Finding['tone'], string> = {
		positive: 'bg-emerald-500',
		negative: 'bg-rose-500',
		divisive: 'bg-amber-500',
		neutral: 'bg-accent-mint'
	};

	function themeCounts(blocks: { sentiment: number }[]) {
		let pos = 0, neu = 0, neg = 0;
		for (const b of blocks) {
			if (b.sentiment > 0) pos++;
			else if (b.sentiment < 0) neg++;
			else neu++;
		}
		const total = blocks.length || 1;
		return {
			pos,
			neu,
			neg,
			total: blocks.length,
			posPct: (pos / total) * 100,
			neuPct: (neu / total) * 100,
			negPct: (neg / total) * 100
		};
	}

	function isSelected(kind: Selection['kind'], id?: string): boolean {
		if (selected.kind !== kind) return false;
		if (kind === 'overview') return true;
		return 'id' in selected && selected.id === id;
	}

	function truncate(s: string, n: number): string {
		return s.length > n ? s.slice(0, n).trimEnd() + '…' : s;
	}

	function tabCount(t: Tab): number {
		if (t === 'findings') return findings.length;
		if (t === 'themes') return themes.length;
		return starredQuotes.length;
	}

	const tabs: { id: Tab; label: string }[] = [
		{ id: 'findings', label: 'Findings' },
		{ id: 'themes', label: 'Themes' },
		{ id: 'quotes', label: 'Quotes' }
	];
</script>

<aside class="flex h-full flex-col bg-(--paper)">
	<!-- Overview row — always present, acts as the "back to start" affordance -->
	<button
		type="button"
		class="flex w-full items-center justify-between border-b border-(--ink)/15 px-5 py-3 text-left text-sm transition-colors hover:bg-(--ink)/5
			{isSelected('overview') ? 'bg-(--ink)/4 text-foreground' : 'text-muted-foreground'}"
		aria-pressed={isSelected('overview')}
		onclick={() => onselect({ kind: 'overview' })}
	>
		<span class="figcaption {isSelected('overview') ? 'text-accent-mint' : 'text-muted-foreground'}">
			Overview
		</span>
		{#if isSelected('overview')}
			<span class="text-xs text-accent-mint">●</span>
		{/if}
	</button>

	<!-- Tabs -->
	<nav class="flex shrink-0 border-b border-(--ink)/15">
		{#each tabs as t (t.id)}
			<button
				type="button"
				class="flex flex-1 items-center justify-center gap-1.5 border-b-2 px-3 py-2.5 text-xs font-medium uppercase tracking-wide transition-colors
					{tab === t.id
						? 'border-accent-mint text-foreground'
						: 'border-transparent text-muted-foreground hover:text-foreground'}"
				aria-pressed={tab === t.id}
				onclick={() => (tab = t.id)}
			>
				{t.label}
				<span class="rounded-full bg-(--ink)/10 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-muted-foreground">
					{tabCount(t.id)}
				</span>
			</button>
		{/each}
	</nav>

	<!-- Scrollable list -->
	<div class="min-h-0 flex-1 overflow-y-auto">
		{#if tab === 'findings'}
			<ul class="flex flex-col">
				{#each findings as f (f.id)}
					{@const active = isSelected('finding', f.id)}
					<li class="border-b border-(--ink)/10 last:border-b-0">
						<button
							type="button"
							class="flex w-full flex-col gap-2 px-5 py-4 text-left transition-colors hover:bg-(--ink)/3
								{active ? 'bg-(--ink)/5' : ''}"
							aria-pressed={active}
							onclick={() => onselect({ kind: 'finding', id: f.id })}
						>
							<div class="flex items-start gap-2">
								<span class="mt-1.5 size-2 shrink-0 rounded-full {toneAccent[f.tone]}"></span>
								<div class="flex min-w-0 flex-1 flex-col gap-1">
									<span class="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
										{f.eyebrow}
									</span>
									<p class="text-sm leading-snug text-foreground">
										{truncate(f.headline, 110)}
									</p>
								</div>
							</div>
							<div class="flex items-center gap-3 pl-4 text-[11px] text-muted-foreground">
								<span class="flex items-center gap-1">
									<span class="size-1.5 rounded-full bg-emerald-400"></span>
									{f.distribution.positive}
								</span>
								<span class="flex items-center gap-1">
									<span class="size-1.5 rounded-full bg-slate-300"></span>
									{f.distribution.neutral}
								</span>
								<span class="flex items-center gap-1">
									<span class="size-1.5 rounded-full bg-rose-400"></span>
									{f.distribution.negative}
								</span>
								<span class="ml-auto tabular-nums">
									{f.fragments.length || '—'} quotes
								</span>
							</div>
						</button>
					</li>
				{/each}
			</ul>
		{:else if tab === 'themes'}
			<ul class="flex flex-col">
				{#each themes as t (t.id)}
					{@const counts = themeCounts(t.blocks)}
					{@const active = isSelected('theme', t.id)}
					<li class="border-b border-(--ink)/10 last:border-b-0">
						<button
							type="button"
							class="flex w-full flex-col gap-2 px-5 py-3.5 text-left transition-colors hover:bg-(--ink)/3
								{active ? 'bg-(--ink)/5' : ''}"
							aria-pressed={active}
							onclick={() => onselect({ kind: 'theme', id: t.id })}
						>
							<div class="flex items-baseline justify-between gap-3">
								<span class="text-sm font-medium text-foreground">{t.label}</span>
								<span class="shrink-0 text-[11px] tabular-nums text-muted-foreground">
									{counts.total}
								</span>
							</div>
							<div class="flex h-1.5 w-full overflow-hidden rounded-full">
								<div class="bg-emerald-400" style="width: {counts.posPct}%"></div>
								<div class="bg-slate-200" style="width: {counts.neuPct}%"></div>
								<div class="bg-rose-400" style="width: {counts.negPct}%"></div>
							</div>
						</button>
					</li>
				{/each}
			</ul>
		{:else}
			<ul class="flex flex-col">
				{#each starredQuotes as q (q.quote_id)}
					{@const active = isSelected('quote', q.quote_id)}
					<li class="border-b border-(--ink)/10 last:border-b-0">
						<button
							type="button"
							class="flex w-full items-start gap-3 px-5 py-3.5 text-left transition-colors hover:bg-(--ink)/3
								{active ? 'bg-(--ink)/5' : ''}"
							aria-pressed={active}
							onclick={() => onselect({ kind: 'quote', id: q.quote_id })}
						>
							<ParticipantAvatar interviewId={q.interview_id} size="sm" />
							<div class="flex min-w-0 flex-1 flex-col gap-1">
								<p class="text-sm leading-snug text-foreground">
									“{truncate(q.text, 120)}”
								</p>
								<span class="flex items-center gap-1.5 text-[11px] text-muted-foreground">
									<Star class="size-3 fill-amber-400 text-amber-400" />
									{participantLabel(q.interview_id)}
								</span>
							</div>
						</button>
					</li>
				{:else}
					<li class="px-5 py-8 text-center text-sm text-muted-foreground">
						No starred quotes yet. Highlight quotes in the analysis view to surface them here.
					</li>
				{/each}
			</ul>
		{/if}
	</div>
</aside>
