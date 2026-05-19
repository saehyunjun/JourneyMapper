<!--
	GroupStatsDrawer — the secondary, study-wide stats drawer for one keyword or
	theme group.

	Opened by clicking a highlighted keyword/theme in any quote (KeywordText.svelte
	→ the groupDrawer store). It is ~15% narrower than the standard detail drawer
	and stacks on top of it (z-60), so a primary drawer underneath peeks out on
	the left. Mounted once in the wctglpdemo layout; reads the groupDrawer store.
-->
<script lang="ts">
	import { fly, fade } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import StatBar from '$lib/components/StatBar.svelte';
	import { groupDrawer } from '$lib/stores/group-drawer.svelte.js';
	import { groupStats } from '$lib/content/wctglpdemo-data/lexicon-stats';

	const stats = $derived(
		groupDrawer.current ? groupStats(groupDrawer.current.kind, groupDrawer.current.id) : null
	);

	const max = (ns: number[]) => Math.max(1, ...ns);
	const sentimentTint = (v: number) =>
		v > 0 ? 'bg-emerald-400' : v < 0 ? 'bg-rose-400' : 'bg-slate-300';

	function onKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') groupDrawer.close();
	}
</script>

<svelte:window onkeydown={onKeydown} />

{#if stats}
	<!-- Backdrop — light, so a primary drawer underneath stays legible. -->
	<div
		class="fixed inset-0 z-55 bg-slate-900/20"
		transition:fade={{ duration: 180 }}
		onclick={() => groupDrawer.close()}
		aria-hidden="true"
	></div>

	<aside
		class="fixed inset-y-0 right-0 z-60 flex w-full max-w-102 flex-col bg-white shadow-2xl md:max-w-122 xl:max-w-142"
		transition:fly={{ x: 120, duration: 300, easing: cubicOut }}
		aria-label="Keyword and theme stats"
	>
		<!-- Header -->
		<div class="flex items-start justify-between gap-3 border-b border-slate-200 p-4">
			<div class="min-w-0">
				<p class="text-xs font-semibold uppercase tracking-wide text-slate-500">
					{stats.kind === 'keyword' ? 'Keyword' : 'Theme'} · study-wide
				</p>
				<h2 class="font-heading text-2xl font-light uppercase leading-tight text-primary">
					{stats.label}
				</h2>
				{#if stats.context}
					<p class="mt-0.5 text-xs text-slate-500">{stats.context}</p>
				{/if}
			</div>
			<button
				type="button"
				onclick={() => groupDrawer.close()}
				aria-label="Close"
				class="shrink-0 rounded p-1 text-lg leading-none text-slate-400 hover:bg-slate-100 hover:text-slate-700"
			>
				✕
			</button>
		</div>

		<!-- Body -->
		<div class="flex flex-1 flex-col gap-6 overflow-y-auto p-4">
			<!-- Headline counts -->
			<div class="grid grid-cols-3 gap-2">
				{#each [{ n: stats.invocations, u: stats.invocationUnit }, { n: stats.segmentCount, u: 'segments' }, { n: stats.participantCount, u: 'participants' }] as cell (cell.u)}
					<div class="rounded-lg border border-slate-200 p-3">
						<p class="text-2xl font-semibold tabular-nums text-slate-800">{cell.n}</p>
						<p class="text-xs text-slate-500">{cell.u}</p>
					</div>
				{/each}
			</div>

			{#if stats.segmentCount === 0}
				<p class="text-sm text-slate-500">
					No tagged segments reference this {stats.kind} yet.
				</p>
			{:else}
				<!-- Sentiment -->
				<section class="flex flex-col gap-1.5">
					<p class="text-xs font-medium text-slate-500">
						Sentiment expressed{stats.avgSentiment != null
							? ` · average ${stats.avgSentiment.toFixed(1)}`
							: ''}
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

				<!-- Emotions -->
				{#if stats.emotions.length}
					<section class="flex flex-col gap-1.5">
						<p class="text-xs font-medium text-slate-500">Emotions expressed</p>
						{#each stats.emotions as e (e.id)}
							<StatBar
								label={e.label}
								count={e.count}
								max={max(stats.emotions.map((x) => x.count))}
								tint="bg-slate-400"
								labelClass="w-32"
							/>
						{/each}
					</section>
				{/if}

				<!-- Common words -->
				{#if stats.commonWords.length}
					<section class="flex flex-col gap-1.5">
						<p class="text-xs font-medium text-slate-500">Common words used</p>
						{#each stats.commonWords as w (w.word)}
							<StatBar
								label={w.word}
								count={w.count}
								max={max(stats.commonWords.map((x) => x.count))}
								tint="bg-violet-400"
								labelClass="w-32"
							/>
						{/each}
					</section>
				{/if}

				<!-- Co-occurring themes -->
				{#if stats.relatedThemes.length}
					<section class="flex flex-col gap-1.5">
						<p class="text-xs font-medium text-slate-500">
							{stats.kind === 'keyword' ? 'Themes it appears in' : 'Co-tagged themes'}
						</p>
						{#each stats.relatedThemes.slice(0, 8) as t (t.id)}
							<StatBar
								label={t.label}
								count={t.count}
								max={max(stats.relatedThemes.map((x) => x.count))}
								tint="bg-accent-mint"
								labelClass="w-32"
							/>
						{/each}
					</section>
				{/if}

				<!-- Per participant -->
				<section class="flex flex-col gap-1.5">
					<p class="text-xs font-medium text-slate-500">By participant</p>
					{#each stats.perParticipant as p (p.interviewId)}
						<StatBar
							label={p.label}
							count={p.count}
							max={max(stats.perParticipant.map((x) => x.count))}
							tint="bg-accent-mint/70"
							labelClass="w-32"
						/>
					{/each}
				</section>
			{/if}
		</div>
	</aside>
{/if}
