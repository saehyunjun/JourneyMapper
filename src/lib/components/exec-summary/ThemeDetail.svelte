<!--
	ThemeDetail — right-pane detail for one selected coded theme.

	Pulls in the theme's full RadialNode (with subtheme children when
	available), shows its overall sentiment distribution, the subtheme
	breakdown, the participants who raised it, and a sampling of the
	highest-quote_score utterances tagged with it.
-->
<script lang="ts">
	import type { RadialNode, Quote } from '$lib/content/wctglpdemo-data/analysis';
	import type { ParticipantProfile } from '$lib/types/participant-profile';
	import { participantLabel } from '$lib/content/wctglpdemo-data/analysis';
	import { profileName } from '$lib/types/participant-profile';
	import SemiArcChart from '$lib/components/key-findings/blocks/SemiArcChart.svelte';
	import { sentimentColor } from '$lib/key-findings/widgets';
	import KeyQuoteCard from '$lib/components/KeyQuoteCard.svelte';
	import ParticipantAvatar from '$lib/components/ParticipantAvatar.svelte';

	type Props = {
		theme: RadialNode;
		topQuotes: Quote[];
		profiles: Record<string, ParticipantProfile>;
		onparticipant: (interviewId: string) => void;
	};

	let { theme, topQuotes, profiles, onparticipant }: Props = $props();

	// Sentiment distribution buckets (the same grades the SemiArcChart expects).
	const SENTIMENT_GRADES = [
		{ value: -2, label: 'Strongly negative' },
		{ value: -1, label: 'Negative' },
		{ value: 0, label: 'Neutral / mixed' },
		{ value: 1, label: 'Positive' },
		{ value: 2, label: 'Strongly positive' }
	] as const;

	const arcData = $derived(
		SENTIMENT_GRADES.map((s) => ({
			label: s.label,
			value: theme.blocks.filter((b) => b.sentiment === s.value).length,
			color: sentimentColor(s.value)
		}))
	);

	// Theme rolls to positive / neutral / negative counts for the mini bar.
	const counts = $derived.by(() => {
		let pos = 0, neu = 0, neg = 0;
		for (const b of theme.blocks) {
			if (b.sentiment > 0) pos++;
			else if (b.sentiment < 0) neg++;
			else neu++;
		}
		const total = theme.blocks.length || 1;
		return {
			pos,
			neu,
			neg,
			posPct: (pos / total) * 100,
			neuPct: (neu / total) * 100,
			negPct: (neg / total) * 100
		};
	});

	const subthemes = $derived(theme.children?.filter((c) => c.kind === 'subtheme') ?? []);

	const participants = $derived(
		Array.from(new Set(theme.blocks.map((b) => b.interview_id)))
	);

	let arcReplay = $state(0);
</script>

<div class="flex flex-col gap-8 p-8">
	<header class="flex flex-col gap-4">
		<div class="flex items-start justify-between gap-6">
			<div class="flex min-w-0 flex-1 flex-col gap-2">
				<span class="figcaption text-accent-mint">Theme</span>
				<h2 class="font-heading text-2xl font-light text-primary md:text-3xl">
					{theme.label}
				</h2>
				{#if theme.description}
					<p class="max-w-3xl text-sm leading-6 text-muted-foreground">
						{theme.description}
					</p>
				{/if}
			</div>
			<div class="flex shrink-0 flex-col items-end gap-1">
				<span class="font-heading text-3xl font-medium text-primary tabular-nums">
					{theme.blocks.length}
				</span>
				<span class="text-[11px] uppercase tracking-wide text-muted-foreground">
					tagged quotes
				</span>
			</div>
		</div>

		<div class="flex flex-col gap-1.5">
			<div class="flex h-2 w-full overflow-hidden rounded-full">
				<div class="bg-emerald-400" style="width: {counts.posPct}%"></div>
				<div class="bg-slate-200" style="width: {counts.neuPct}%"></div>
				<div class="bg-rose-400" style="width: {counts.negPct}%"></div>
			</div>
			<div class="flex flex-wrap gap-x-4 text-[11px] text-muted-foreground">
				<span><span class="font-medium text-emerald-700">{counts.pos}</span> positive</span>
				<span><span class="font-medium text-slate-500">{counts.neu}</span> neutral</span>
				<span><span class="font-medium text-rose-700">{counts.neg}</span> negative</span>
			</div>
		</div>
	</header>

	<!-- Sentiment composition arc -->
	<section class="flex flex-col gap-3 border-t border-(--ink)/10 pt-6">
		<div class="flex items-baseline justify-between">
			<h3 class="figcaption text-muted-foreground">Sentiment composition</h3>
			<button
				type="button"
				class="font-mono text-xs text-muted-foreground underline-offset-2 hover:underline"
				onclick={() => arcReplay++}
			>
				Replay
			</button>
		</div>
		<div class="flex items-center justify-center">
			<SemiArcChart data={arcData} animate replayKey={arcReplay} size={280} />
		</div>
	</section>

	<!-- Subthemes -->
	{#if subthemes.length}
		<section class="flex flex-col gap-3 border-t border-(--ink)/10 pt-6">
			<div class="flex items-baseline justify-between">
				<h3 class="figcaption text-muted-foreground">Subthemes</h3>
				<span class="text-xs text-muted-foreground tabular-nums">{subthemes.length}</span>
			</div>
			<ul class="flex flex-col gap-2">
				{#each subthemes as st (st.id)}
					{@const subTotal = st.blocks.length || 1}
					{@const subPos = st.blocks.filter((b) => b.sentiment > 0).length}
					{@const subNeg = st.blocks.filter((b) => b.sentiment < 0).length}
					{@const subNeu = st.blocks.length - subPos - subNeg}
					<li class="flex flex-col gap-1.5 border border-(--ink)/10 bg-(--paper) p-3">
						<div class="flex items-baseline justify-between gap-3">
							<span class="text-sm font-medium text-foreground">{st.label}</span>
							<span class="text-xs tabular-nums text-muted-foreground">{st.blocks.length}</span>
						</div>
						<div class="flex h-1.5 w-full overflow-hidden rounded-full">
							<div class="bg-emerald-400" style="width: {(subPos / subTotal) * 100}%"></div>
							<div class="bg-slate-200" style="width: {(subNeu / subTotal) * 100}%"></div>
							<div class="bg-rose-400" style="width: {(subNeg / subTotal) * 100}%"></div>
						</div>
					</li>
				{/each}
			</ul>
		</section>
	{/if}

	<!-- Top quotes -->
	{#if topQuotes.length}
		<section class="flex flex-col gap-3 border-t border-(--ink)/10 pt-6">
			<div class="flex items-baseline justify-between">
				<h3 class="figcaption text-muted-foreground">Representative quotes</h3>
				<span class="text-xs text-muted-foreground tabular-nums">
					{topQuotes.length} of {theme.blocks.length}
				</span>
			</div>
			<div class="flex flex-col gap-3">
				{#each topQuotes as q (q.quote_id)}
					<KeyQuoteCard
						text={q.text}
						sentiment={q.sentiment}
						interviewId={q.interview_id}
						questionId={q.question_id}
						{profiles}
						onparticipant={onparticipant}
						size="sm"
					/>
				{/each}
			</div>
		</section>
	{/if}

	<!-- Participants -->
	{#if participants.length}
		<section class="flex flex-col gap-3 border-t border-(--ink)/10 pt-6">
			<h3 class="figcaption text-muted-foreground">
				Participants ({participants.length})
			</h3>
			<div class="flex flex-wrap gap-2">
				{#each participants as id (id)}
					<button
						type="button"
						class="flex items-center gap-2 rounded-full border border-(--ink)/15 bg-(--paper) py-1 pr-3 pl-1 text-xs text-foreground transition-colors hover:bg-(--ink)/5"
						onclick={() => onparticipant(id)}
					>
						<ParticipantAvatar interviewId={id} size="sm" src={profiles[id]?.avatar_url} />
						{profileName(profiles[id], participantLabel(id))}
					</button>
				{/each}
			</div>
		</section>
	{/if}
</div>
