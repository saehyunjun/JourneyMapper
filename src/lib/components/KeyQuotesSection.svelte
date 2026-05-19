<!--
	KeyQuotesSection — the analyst-starred "key quotes" browser.

	Renders every highlight starred across the Lab Book (highlights.json) —
	quote-bank quotes starred on the analysis page and segments starred on the
	review page or the fingerprint theme drawer — ranked by score. Each card's
	participant is a clickable chip; the `onparticipant` callback opens the host
	page's participant drawer.
-->
<script lang="ts">
	import {
		keyQuotes,
		questionLabel,
		participantLabel,
		titleCase,
		SENTIMENT_LABELS
	} from '$lib/content/wctglpdemo-data/analysis';
	import KeywordText from '$lib/components/KeywordText.svelte';
	import * as Carousel from '$lib/components/ui/carousel/index.js';
	import ParticipantAvatar from '$lib/components/ParticipantAvatar.svelte';
	import { profileName, type ParticipantProfile } from '$lib/types/participant-profile';

	let {
		starredQuoteIds,
		starredSegmentIds = [],
		profiles,
		onparticipant,
		participantId = null
	}: {
		starredQuoteIds: string[];
		/** Segments starred on the review page / fingerprint theme drawer. */
		starredSegmentIds?: string[];
		profiles: Record<string, ParticipantProfile>;
		onparticipant: (interviewId: string) => void;
		/** When set, only this participant's starred quotes are shown. */
		participantId?: string | null;
	} = $props();

	// Every starred highlight — quote-bank quotes and starred segments — ranked
	// by score. When a participant is selected, scope the list to just theirs.
	const starred = $derived(
		keyQuotes(starredQuoteIds, starredSegmentIds).filter(
			(q) => !participantId || q.interview_id === participantId
		)
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

		<h2 class="font-heading text-4xl font-light uppercase text-primary">
			Key quotes</h2>
		<p class="max-w-2xl text-sm text-muted-foreground">
			{#if scopedTo}
			{scopedTo} has <span class="font-medium">{starred.length}
				{starred.length === 1 ? 'quote' : 'quotes'}</span> starred quotes. Highlight their key quotes here.
				{:else}
			{scopedTo}'s <span class="font-medium">{starred.length}
				{starred.length === 1 ? 'quote' : 'quotes'}</span> starred quotes. 
			{/if}
		</p>
	</div>

	{#if starred.length}
	<div class="px-12">
		<Carousel.Root opts={{ align: 'start' }}>
			<Carousel.Content class="py-3">
		{#each starred as q (q.id)}
		<Carousel.Item class="basis-full md:basis-1/2 lg:basis-1/3">
			<article class="flex h-full flex-col gap-3 border border-slate-200 bg-white p-4">
	<button
		type="button"
		onclick={() => onparticipant(q.interview_id)}
		class="flex w-fit items-center gap-1.5 rounded-full border border-secondary bg-(--paper) py-0.5 pr-2.5 pl-0.5 text-xs font-medium text-foreground shadow-sm transition-colors hover:cursor-pointer hover:border-accent-mint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-mint"
		title="View participant details"
	>
		<ParticipantAvatar
			interviewId={q.interview_id}
			size="sm"
			src={profiles[q.interview_id]?.avatar_url}
		/>
		{profileName(profiles[q.interview_id], participantLabel(q.interview_id))}
	</button>
					<blockquote class="border-l-2 border-accent-mint pl-3 text-base text-slate-800">
						“<KeywordText text={q.text} />”
					</blockquote>

					<div class="flex flex-wrap items-center gap-2">
						<span class="rounded-full px-2 py-0.5 text-xs {sentimentClass(q.sentiment)}">
							{SENTIMENT_LABELS[q.sentiment]}
						</span>
						{#if q.score !== null}
							<span class="ml-auto text-xs text-slate-400">
								score
								<span class="ml-0.5 text-base font-light text-accent-mint">
									{q.score}
								</span>
							</span>
						{/if}
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
			</Carousel.Item>
			{/each}
			</Carousel.Content>
			<Carousel.Previous />
			<Carousel.Next />
		</Carousel.Root>
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
