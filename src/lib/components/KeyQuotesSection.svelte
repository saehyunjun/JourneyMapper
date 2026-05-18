<!--
	KeyQuotesSection — the analyst-starred "key quotes" browser.

	Renders every quote starred on the review/analysis page (highlights.json),
	ranked by overall score. Each card's participant is a clickable chip; the
	`onparticipant` callback opens the host page's participant drawer.
-->
<script lang="ts">
	import {
		quotes,
		questionLabel,
		participantLabel,
		titleCase,
		SENTIMENT_LABELS
	} from '$lib/content/wctglpdemo-data/analysis';
	import KeywordText from '$lib/components/KeywordText.svelte';
	import ParticipantAvatar from '$lib/components/ParticipantAvatar.svelte';
	import { profileName, type ParticipantProfile } from '$lib/types/participant-profile';

	let {
		starredQuoteIds,
		profiles,
		onparticipant,
		participantId = null
	}: {
		starredQuoteIds: string[];
		profiles: Record<string, ParticipantProfile>;
		onparticipant: (interviewId: string) => void;
		/** When set, only this participant's starred quotes are shown. */
		participantId?: string | null;
	} = $props();

	// Starred quotes joined to the quote bank, best-scoring first. When a
	// participant is selected, scope the list down to just their quotes.
	const starred = $derived(
		quotes
			.filter(
				(q) =>
					starredQuoteIds.includes(q.quote_id) &&
					(!participantId || q.interview_id === participantId)
			)
			.sort((a, b) => b.quote_score.overall - a.quote_score.overall)
	);

	const scopedTo = $derived(
		participantId
			? profileName(profiles[participantId], participantLabel(participantId))
			: null
	);

	function sentimentClass(s: number) {
		if (s > 0) return 'bg-emerald-100 text-emerald-800';
		if (s < 0) return 'bg-rose-100 text-rose-800';
		return 'bg-slate-100 text-slate-700';
	}
</script>

<section class="flex flex-col gap-5">
	<div class="flex flex-col gap-2 border-b border-(--primary)/15 pb-4">
		<span class="figcaption text-accent-mint">★ Starred in review</span>
		<h2 class="font-heading text-4xl font-light uppercase text-primary">Key quotes</h2>
		<p class="max-w-2xl text-base text-muted-foreground">
			{#if scopedTo}
				The {starred.length}
				{starred.length === 1 ? 'quote' : 'quotes'} flagged as important for {scopedTo} during
				review. Click a participant to open their details.
			{:else}
				The {starred.length}
				{starred.length === 1 ? 'quote' : 'quotes'} flagged as important during review. Click a
				participant to open their details.
			{/if}
		</p>
	</div>

	{#if starred.length}
		<div class="grid gap-4 md:grid-cols-2">
			{#each starred as q (q.quote_id)}
				<article class="flex flex-col gap-3 border border-slate-200 bg-white p-5">
					<blockquote class="border-l-2 border-accent-mint pl-3 text-base text-slate-800">
						“<KeywordText text={q.text} />”
					</blockquote>

					<div class="flex flex-wrap items-center gap-2">
						<button
							type="button"
							onclick={() => onparticipant(q.interview_id)}
							class="flex items-center gap-1.5 rounded-full border border-(--accent-orange-foreground) bg-(--paper) py-0.5 pr-2.5 pl-0.5 text-xs font-medium text-foreground transition-colors hover:bg-(--ink)/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-mint"
							title="View participant details"
						>
							<ParticipantAvatar
								interviewId={q.interview_id}
								size="sm"
								src={profiles[q.interview_id]?.avatar_url}
							/>
							{profileName(profiles[q.interview_id], participantLabel(q.interview_id))}
						</button>
						<span class="rounded-full px-2 py-0.5 text-xs {sentimentClass(q.sentiment)}">
							{SENTIMENT_LABELS[q.sentiment]}
						</span>
						<span class="ml-auto text-xs text-slate-400">
							score
							<span class="ml-0.5 text-base font-light text-accent-mint">
								{q.quote_score.overall}
							</span>
						</span>
					</div>

					<p class="text-xs text-slate-500">{questionLabel(q.question_id)}</p>

					{#if q.themes.length}
						<div class="flex flex-wrap gap-1">
							{#each q.themes as t (t)}
								<span class="rounded-full bg-accent-mint/15 px-2 py-0.5 text-xs text-accent-mint">
									{titleCase(t)}
								</span>
							{/each}
						</div>
					{/if}
				</article>
			{/each}
		</div>
	{:else}
		<p class="border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
			{#if scopedTo}
				No quotes have been starred for {scopedTo}. Star important quotes on the analysis page to
				see them here.
			{:else}
				No quotes have been starred yet. Star important quotes on the analysis page to see them
				here.
			{/if}
		</p>
	{/if}
</section>
