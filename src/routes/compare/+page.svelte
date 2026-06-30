<!--
	/compare — Sentiment & volume over time (V1).

	Year-over-year forum-fragment comparison, pivoted on subtheme. Indication-
	scoped via ?indication=<id>; min-N gate via ?min_n=<n> (default 5). New
	route, designed with axis-as-toggle in mind so a later cross-indication
	comparison can slot in alongside the time axis.

	Tile click opens the right-drawer with the contributing fragments grouped
	by year, newest-first within each year.
-->
<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import IndicationSelector from '$lib/components/IndicationSelector.svelte';
	import RightDrawer from '$lib/components/RightDrawer.svelte';
	import SubthemeTrendTile from '$lib/components/compare/SubthemeTrendTile.svelte';
	import type { PageProps } from './$types';
	import type { CompareTile } from './+page.server';

	let { data }: PageProps = $props();

	let drawerOpen = $state(false);
	let activeTile: CompareTile | null = $state(null);

	function openTile(tile: CompareTile) {
		activeTile = tile;
		drawerOpen = true;
	}

	function setMinN(next: number) {
		const u = new URL(page.url);
		u.searchParams.set('min_n', String(next));
		goto(u, { keepFocus: true, noScroll: true });
	}

	const minNOptions = [3, 5, 10, 20];

	function fmtSentiment(s: number | null): string {
		if (s === null) return '—';
		const sign = s > 0 ? '+' : '';
		return `${sign}${s.toFixed(2)}`;
	}

	function fmtDate(iso: string): string {
		return iso.slice(0, 10);
	}

	function truncatedHandle(h: string | null): string {
		if (!h) return 'anon';
		return h.length > 14 ? h.slice(0, 14) + '…' : h;
	}
</script>

<svelte:head>
	<title>Compare · sentiment & volume over time</title>
</svelte:head>

<div class="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-8">
	<header class="flex flex-col gap-1">
		<h1 class="text-xl font-semibold text-zinc-900">Sentiment & volume over time</h1>
		<p class="text-sm text-zinc-600">
			Year-over-year comparison of forum discourse, pivoted on subtheme. Each tile shows annual
			volume + mean sentiment for the active indication.
		</p>
	</header>

	<section
		class="flex flex-wrap items-end gap-4 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm"
	>
		<div class="w-72">
			<IndicationSelector
				indications={data.indications}
				therapeuticAreas={data.therapeutic_areas}
				activeIndication={data.active_indication}
			/>
		</div>

		<div class="flex flex-col gap-1">
			<span class="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
				Min fragments / year
			</span>
			<div class="flex gap-1">
				{#each minNOptions as n (n)}
					<button
						type="button"
						onclick={() => setMinN(n)}
						class="rounded-md border px-2.5 py-1 text-xs transition-colors {n === data.min_n
							? 'border-zinc-900 bg-zinc-900 text-white'
							: 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50'}"
					>
						≥{n}
					</button>
				{/each}
			</div>
		</div>

		<div class="ml-auto text-xs text-zinc-500">
			{data.tiles.length} tiles
			{#if data.total_tile_candidates > data.tiles.length}
				· {data.total_tile_candidates - data.tiles.length} more hidden
			{/if}
			· {data.total_fragments_considered} fragments considered · years {data.years.join(', ') ||
				'—'}
		</div>
	</section>

	{#if data.tiles.length === 0}
		<div class="rounded-lg border border-zinc-200 bg-white p-8 text-center text-sm text-zinc-600">
			No subtheme has at least two years meeting the min-{data.min_n} gate. Try a lower threshold
			or a different indication.
		</div>
	{:else}
		<div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
			{#each data.tiles as tile (tile.subtheme_id)}
				<SubthemeTrendTile {tile} minN={data.min_n} onclick={() => openTile(tile)} />
			{/each}
		</div>
	{/if}
</div>

<RightDrawer bind:open={drawerOpen}>
	{#if activeTile}
		<div class="flex h-full flex-col">
			<header class="flex flex-col gap-1 border-b border-zinc-200 px-6 py-5">
				<div class="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
					Subtheme · year-over-year
				</div>
				<h2 class="text-lg font-semibold text-zinc-900">{activeTile.label}</h2>
				<div class="text-xs text-zinc-500">
					{activeTile.total_count} fragments across {activeTile.per_year.length} year{activeTile
						.per_year.length === 1
						? ''
						: 's'}
				</div>
			</header>

			<div class="flex-1 overflow-y-auto px-6 py-4">
				{#each activeTile.per_year as cell (cell.year)}
					<section class="mb-6 last:mb-0">
						<div class="mb-2 flex items-baseline justify-between border-b border-zinc-100 pb-1">
							<div class="flex items-baseline gap-2">
								<span class="text-base font-semibold text-zinc-900">{cell.year}</span>
								<span class="text-xs text-zinc-500">
									{cell.count} fragment{cell.count === 1 ? '' : 's'}
								</span>
							</div>
							<span class="text-xs text-zinc-500">
								mean sentiment {fmtSentiment(cell.sentiment_mean)}
							</span>
						</div>

						{#if cell.fragments.length === 0}
							<div class="py-2 text-xs italic text-zinc-400">No fragments this year.</div>
						{:else}
							<ul class="flex flex-col gap-2">
								{#each cell.fragments.slice(0, 20) as frag (frag.id)}
									<li class="rounded-md border border-zinc-200 bg-white p-3">
										<div class="mb-1 flex items-center gap-2 text-[10px] text-zinc-500">
											<span>{fmtDate(frag.date_observed)}</span>
											<span>·</span>
											<span>{frag.content_source.replace('_', ' ')}</span>
											<span>·</span>
											<span class="font-mono">{truncatedHandle(frag.author_handle_hash)}</span>
											<span class="ml-auto">
												sent {fmtSentiment(frag.sentiment_score)}
											</span>
										</div>
										<p class="whitespace-pre-wrap text-sm text-zinc-800">{frag.text}</p>
									</li>
								{/each}
							</ul>
							{#if cell.fragments.length > 20}
								<div class="mt-2 text-[11px] text-zinc-500">
									Showing 20 of {cell.fragments.length}; truncated for readability.
								</div>
							{/if}
						{/if}
					</section>
				{/each}
			</div>
		</div>
	{/if}
</RightDrawer>
