<!--
	QuoteDetail — right-pane detail for one selected starred quote.

	A presentation-grade view: the verbatim text large and centered, the
	participant identity, the question the quote answered, its theme tags,
	and the quote-score factors that put it on the analyst's shortlist.
-->
<script lang="ts">
	import type { Quote } from '$lib/content/wctglpdemo-data/analysis';
	import type { ParticipantProfile } from '$lib/types/participant-profile';
	import {
		participantLabel,
		questionLabel,
		titleCase,
		SENTIMENT_LABELS
	} from '$lib/content/wctglpdemo-data/analysis';
	import { profileName } from '$lib/types/participant-profile';
	import { sentimentColor } from '$lib/key-findings/widgets';
	import ParticipantAvatar from '$lib/components/ParticipantAvatar.svelte';
	import { Star, ArrowRight } from '@lucide/svelte';

	type Props = {
		quote: Quote;
		profiles: Record<string, ParticipantProfile>;
		onparticipant: (interviewId: string) => void;
	};

	let { quote, profiles, onparticipant }: Props = $props();

	const profile = $derived(profiles[quote.interview_id]);
	const name = $derived(profileName(profile, participantLabel(quote.interview_id)));
	// Short identity line — kept inline so the pane doesn't depend on the
	// theme-aware participantBio helper (which needs corpus context to format).
	const identity = $derived.by(() => {
		if (!profile) return '';
		const bits: string[] = [];
		if (profile.age_range) bits.push(`${profile.age_range.replace(/-/g, '–')}`);
		if (profile.gender) bits.push(profile.gender);
		if (profile.country?.trim()) bits.push(profile.country.trim());
		if (profile.participant_type === 'composite') bits.push('composite persona');
		return bits.join(' · ');
	});
	const sentimentLabel = $derived(SENTIMENT_LABELS[quote.sentiment] ?? `Sentiment ${quote.sentiment}`);
	const sentimentSwatch = $derived(sentimentColor(quote.sentiment));

	const scoreFactors = $derived([
		{ label: 'Clarity', value: quote.quote_score.clarity },
		{ label: 'Emotional intensity', value: quote.quote_score.emotional_intensity },
		{ label: 'Strategic value', value: quote.quote_score.strategic_value },
		{ label: 'Specificity', value: quote.quote_score.specificity }
	]);
</script>

<div class="flex flex-col gap-8 p-8">
	<header class="flex flex-col gap-3">
		<div class="flex items-center gap-2">
			<Star class="size-4 fill-amber-400 text-amber-400" />
			<span class="figcaption text-amber-700">Starred quote</span>
		</div>
		<blockquote class="font-heading text-2xl font-light leading-snug text-primary md:text-3xl">
			“{quote.text}”
		</blockquote>
		<div class="flex items-center gap-2 text-sm text-muted-foreground">
			<span
				class="inline-flex size-2.5 rounded-full"
				style:background-color={sentimentSwatch}
				aria-hidden="true"
			></span>
			{sentimentLabel}
			<span class="text-(--ink)/30">·</span>
			<span>Asked: {questionLabel(quote.question_id)}</span>
		</div>
	</header>

	<!-- Participant card -->
	<section class="flex items-start gap-4 border-t border-(--ink)/10 pt-6">
		<ParticipantAvatar
			interviewId={quote.interview_id}
			size="lg"
			src={profile?.avatar_url}
		/>
		<div class="flex min-w-0 flex-1 flex-col gap-1">
			<h3 class="text-lg font-medium text-foreground">{name}</h3>
			{#if identity}
				<p class="text-sm leading-6 text-muted-foreground">{identity}</p>
			{/if}
			<button
				type="button"
				class="mt-2 inline-flex items-center gap-1 self-start text-sm font-medium text-accent-mint hover:underline"
				onclick={() => onparticipant(quote.interview_id)}
			>
				Open participant profile
				<ArrowRight class="size-4" />
			</button>
		</div>
	</section>

	<!-- Tag chips -->
	{#if quote.themes.length || quote.subthemes.length || quote.emotions.length}
		<section class="flex flex-col gap-3 border-t border-(--ink)/10 pt-6">
			<h3 class="figcaption text-muted-foreground">Tags</h3>
			<div class="flex flex-wrap gap-1.5">
				{#each quote.themes as t (t)}
					<span class="rounded-full border border-accent-mint/40 bg-accent-mint/10 px-2.5 py-0.5 text-xs text-accent-mint">
						{titleCase(t)}
					</span>
				{/each}
				{#each quote.subthemes as st (st)}
					<span class="rounded-full border border-(--ink)/15 bg-(--paper) px-2.5 py-0.5 text-xs text-muted-foreground">
						{titleCase(st)}
					</span>
				{/each}
				{#each quote.emotions as e (e)}
					<span class="rounded-full border border-amber-300/50 bg-amber-50 px-2.5 py-0.5 text-xs text-amber-800">
						{titleCase(e)}
					</span>
				{/each}
			</div>
		</section>
	{/if}

	<!-- Quote score breakdown -->
	<section class="flex flex-col gap-3 border-t border-(--ink)/10 pt-6">
		<div class="flex items-baseline justify-between">
			<h3 class="figcaption text-muted-foreground">Why it was starred</h3>
			<span class="text-xs text-muted-foreground tabular-nums">
				overall {quote.quote_score.overall.toFixed(1)}
			</span>
		</div>
		<ul class="flex flex-col gap-2">
			{#each scoreFactors as f (f.label)}
				<li class="flex items-center gap-3">
					<span class="w-40 text-sm text-muted-foreground">{f.label}</span>
					<div class="h-1.5 flex-1 overflow-hidden rounded-full bg-(--ink)/8">
						<div class="h-full bg-accent-mint" style="width: {Math.min(100, f.value * 10)}%"></div>
					</div>
					<span class="w-10 text-right text-xs tabular-nums text-muted-foreground">
						{f.value.toFixed(1)}
					</span>
				</li>
			{/each}
		</ul>
	</section>

	{#if quote.recommended_uses?.length}
		<section class="flex flex-col gap-2 border-t border-(--ink)/10 pt-6">
			<h3 class="figcaption text-muted-foreground">Recommended uses</h3>
			<ul class="flex flex-wrap gap-1.5">
				{#each quote.recommended_uses as u (u)}
					<li class="rounded-full border border-(--ink)/15 bg-(--paper) px-2.5 py-0.5 text-xs text-muted-foreground">
						{titleCase(u)}
					</li>
				{/each}
			</ul>
		</section>
	{/if}
</div>
