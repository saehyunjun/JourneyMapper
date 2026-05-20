<!--
	GroupStatsDrawer — the study-wide stats drawer for one keyword or theme.

	Opened by clicking a highlighted keyword/theme in any quote
	(KeywordText.svelte → the groupDrawer store). Stacks at the top level
	(z-99/109) so it can layer above both a primary drawer and a secondary
	drawer underneath. Mounted once in the wctglpdemo layout; reads the
	groupDrawer store. Chrome is owned by TertiaryDrawer.
-->
<script lang="ts">
	import StatBar from '$lib/components/StatBar.svelte';
	import TertiaryDrawer from '$lib/components/TertiaryDrawer.svelte';
	import { groupDrawer } from '$lib/stores/group-drawer.svelte.js';
	import { groupStats } from '$lib/content/wctglpdemo-data/lexicon-stats';

	const stats = $derived(
		groupDrawer.current ? groupStats(groupDrawer.current.kind, groupDrawer.current.id) : null
	);
	const open = $derived(stats !== null);

	const max = (ns: number[]) => Math.max(1, ...ns);
	const sentimentTint = (v: number) =>
		v > 0 ? 'bg-emerald-400' : v < 0 ? 'bg-rose-400' : 'bg-slate-300';
</script>

<TertiaryDrawer
	{open}
	onclose={() => groupDrawer.close()}
	ariaLabel="Keyword and theme stats"
	level="top"
	width="wide"
	eyebrow={stats ? `${stats.kind === 'keyword' ? 'Keyword' : 'Theme'} · study-wide` : undefined}
	title={stats?.label}
	subtitle={stats?.context}
>
	{#if stats}
		<div class="flex flex-1 flex-col gap-6 p-4">
			<!-- Headline counts -->
			<div class="grid grid-cols-3 gap-2">
				{#each [{ n: stats.invocations, u: stats.invocationUnit }, { n: stats.segmentCount, u: 'segments' }, { n: stats.participantCount, u: 'participants' }] as cell (cell.u)}
					<div class="border-b border-accent pb-2">
						<p class="text-2xl font-semibold tabular-nums text-slate-800">{cell.n}</p>
						<p class="text-xs text-slate-500">{cell.u}</p>
					</div>
				{/each}
			</div>

			{#if stats.segmentCount === 0}
				<p
					class="mb-2 border-b border-muted-foreground font-heading text-xs font-bold uppercase text-muted-foreground"
				>
					No tagged segments reference this {stats.kind} yet.
				</p>
			{:else}
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

				{#if stats.emotions.length}
					<section class="flex flex-col gap-1.5">
						<p
							class="mb-2 border-b border-muted-foreground font-heading text-xs font-bold uppercase text-muted-foreground"
						>
							Emotions expressed
						</p>
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

				{#if stats.commonWords.length}
					<section class="flex flex-col gap-1.5">
						<p
							class="mb-2 border-b border-muted-foreground font-heading text-xs font-bold uppercase text-muted-foreground"
						>
							Common words used
						</p>
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

				{#if stats.relatedThemes.length}
					<section class="flex flex-col gap-1.5">
						<p
							class="mb-2 border-b border-muted-foreground font-heading text-xs font-bold uppercase text-muted-foreground"
						>
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

				<section class="flex flex-col gap-1.5">
					<p
						class="mb-2 border-b border-muted-foreground font-heading text-xs font-bold uppercase text-muted-foreground"
					>
						By participant
					</p>
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
	{/if}
</TertiaryDrawer>
