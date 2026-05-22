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
		participantLabel,
		titleCase
	} from '$lib/content/wctglpdemo-data/analysis';
	import * as Carousel from '$lib/components/ui/carousel/index.js';
	import KeyQuoteCard from '$lib/components/KeyQuoteCard.svelte';
	import { profileName, type ParticipantProfile } from '$lib/types/participant-profile';

	let {
		starredQuoteIds,
		starredSegmentIds = [],
		profiles,
		onparticipant,
		participantId = null,
		cardSize = 'sm'
	}: {
		starredQuoteIds: string[];
		/** Segments starred on the review page / fingerprint theme drawer. */
		starredSegmentIds?: string[];
		profiles: Record<string, ParticipantProfile>;
		onparticipant: (interviewId: string) => void;
		/** When set, only this participant's starred quotes are shown. */
		participantId?: string | null;
		/** Size variant passed through to each KeyQuoteCard. */
		cardSize?: 'sm' | 'lg';
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

	// --- Theme filter -------------------------------------------------------
	let selectedTheme = $state<string | null>(null);

	// Themes present across the starred quotes, by frequency — the filter buttons.
	const themeFilters = $derived.by(() => {
		const counts = new Map<string, number>();
		for (const q of starred) for (const t of q.themes) counts.set(t, (counts.get(t) ?? 0) + 1);
		return [...counts.entries()]
			.sort((a, b) => b[1] - a[1])
			.map(([id, count]) => ({ id, count }));
	});

	// Drop the filter if its theme is no longer present (e.g. a participant change).
	$effect(() => {
		if (selectedTheme && !themeFilters.some((t) => t.id === selectedTheme)) {
			selectedTheme = null;
		}
	});

	const visible = $derived.by(() => {
		const t = selectedTheme;
		return t ? starred.filter((q) => q.themes.includes(t)) : starred;
	});
</script>

<section class="flex flex-col gap-5">
	<div class="flex flex-col gap-2 border-b border-(--primary)/15 pb-4">

		<h2 class="font-heading text-4xl font-light uppercase text-primary">
			Key quotes</h2>
		{#if scopedTo}
			<p class="max-w-2xl text-sm text-muted-foreground">
				{scopedTo} has <span class="font-medium">{starred.length}
					{starred.length === 1 ? 'quote' : 'quotes'}</span> starred. Their key quotes are
				highlighted here.
			</p>
		{/if}
	</div>

	{#if themeFilters.length}
		<!-- Theme filter — narrow the key quotes to one theme -->
		<div class="flex flex-wrap gap-2">
			<button
				type="button"
				class="rounded-full px-3 py-1 text-xs font-medium transition-colors {selectedTheme === null
					? 'bg-accent-mint text-white'
					: 'bg-slate-100 text-slate-600 hover:bg-slate-200'}"
				aria-pressed={selectedTheme === null}
				onclick={() => (selectedTheme = null)}
			>
				All <span class="opacity-70">{starred.length}</span>
			</button>
			{#each themeFilters as t (t.id)}
				<button
					type="button"
					class="rounded-full px-3 py-1 text-xs font-medium transition-colors {selectedTheme === t.id
						? 'bg-accent-mint text-white'
						: 'bg-slate-100 text-slate-600 hover:bg-slate-200'}"
					aria-pressed={selectedTheme === t.id}
					onclick={() => (selectedTheme = t.id)}
				>
					{titleCase(t.id)} <span class="opacity-70">{t.count}</span>
				</button>
			{/each}
		</div>
	{/if}

	{#if starred.length}
	<div class="px-12">
		{#key selectedTheme}
		<Carousel.Root opts={{ align: 'start' }}>
			<!-- Generous vertical padding so the corner quote marks, which overhang
			     each card's edge, are not clipped by the carousel's overflow-hidden. -->
			<Carousel.Content class="py-6">
		{#each visible as q (q.id)}
		<Carousel.Item class="basis-full md:basis-1/2 lg:basis-1/3">
			<KeyQuoteCard
				text={q.text}
				sentiment={q.sentiment}
				interviewId={q.interview_id}
				questionId={q.question_id}
				themes={q.themes}
				score={q.score}
				{profiles}
				{onparticipant}
				size={cardSize}
			/>
		</Carousel.Item>
			{/each}
			</Carousel.Content>
			<Carousel.Previous />
			<Carousel.Next />
		</Carousel.Root>
		{/key}
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
