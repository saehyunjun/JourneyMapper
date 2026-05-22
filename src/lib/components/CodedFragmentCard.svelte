<!--
	CodedFragmentCard — the shared card for one theme-coded segment fragment.

	Used by every drawer that lists coded fragments (the fingerprint theme
	drawer, the interview-words theme drawer, the theme heatmap cell drawer) so
	they stay consistent. It shows the participant (avatar + name, falling back
	to the interview id when no name is set), the segment text, its question,
	its sentiment, and its emotions.

	Pass `onToggleStar` to enable the star control — drawers that don't support
	starring simply omit it.
-->
<script lang="ts">
	import KeywordText from '$lib/components/KeywordText.svelte';
	import ParticipantAvatar from '$lib/components/ParticipantAvatar.svelte';
	import StarIcon from '@lucide/svelte/icons/star';
	import { Button } from '$lib/components/ui/button/index';
	import {
		participantLabel,
		questionLabel,
		titleCase,
		SENTIMENT_LABELS,
		type ThemeFragment
	} from '$lib/content/wctglpdemo-data/analysis';
	import { profileName, type ParticipantProfile } from '$lib/types/participant-profile';
	import { emotionDots } from '$lib/utils/emotion-colors';

	let {
		fragment,
		profiles = {},
		starred = false,
		togglingStar = false,
		onToggleStar
	}: {
		fragment: ThemeFragment;
		/** Participant profiles, for the uploaded avatar and display name. */
		profiles?: Record<string, ParticipantProfile>;
		starred?: boolean;
		togglingStar?: boolean;
		/** Supplying this enables the star control. */
		onToggleStar?: (segmentId: string) => void;
	} = $props();

	const profile = $derived(profiles[fragment.interview_id]);
	// The participant's name, or their interview id when no name is set.
	const name = $derived(
		profile
			? profileName(profile, participantLabel(fragment.interview_id))
			: participantLabel(fragment.interview_id)
	);

	function sentimentClass(s: number) {
		if (s > 0) return 'bg-emerald-100 text-emerald-800';
		if (s < 0) return 'bg-rose-100 text-rose-800';
		return 'bg-slate-100 text-slate-700';
	}
</script>

<div
	class="border-2 p-3
		{fragment.in_pull_quote ? 'border-accent-mint bg-accent-mint/5' : 'border-muted-foreground/40'}"
>
	<!-- Participant — avatar + name (or interview id), with the star control -->
	<div class="flex items-start justify-between gap-3">
		<div class="flex min-w-0 items-center gap-2">
			<ParticipantAvatar
				interviewId={fragment.interview_id}
				size="sm"
				src={profile?.avatar_url}
			/>
			<span class="truncate text-sm font-medium text-slate-700">{name}</span>
		</div>
		{#if onToggleStar}
			<Button
				variant="ghost"
				onclick={() => onToggleStar?.(fragment.segment_id)}
				disabled={togglingStar}
				aria-pressed={starred}
				title={starred ? 'Starred — click to unstar' : 'Star this segment'}
				class="shrink-0 rounded p-1 transition-colors hover:bg-amber-50 disabled:opacity-40
					{starred ? 'text-amber-400' : 'text-slate-400 hover:text-amber-200'}"
			>
				<StarIcon size={18} fill={starred ? 'currentColor' : 'none'} />
			</Button>
		{/if}
	</div>
	
		<div class="flex flex-col gap-4 my-4 text-xs text-muted-foreground">
			<p class="text-xs text-pretty font-bold text-muted-primary">
				{questionLabel(fragment.question_id)}
			</p>
			
			<p class="text-lg leading-tight text-pretty text-primary">
				<KeywordText text={fragment.text} />
			</p>
		</div>

	<!-- Sentiment, emotions, and pull-quote provenance -->
	<div class="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-400">
		<span class="rounded-full px-1.5 py-0.5 {sentimentClass(fragment.sentiment)}">
			{SENTIMENT_LABELS[fragment.sentiment]}
		</span>
		{#each fragment.emotions as e (e)}
			{@const c = emotionDots(e)}
			<span class="inline-flex items-center gap-1 rounded-full bg-slate-100 px-1.5 py-0.5 text-slate-600">
				{#if c.c2}
					<span class="relative inline-block h-2 w-3.5" aria-hidden="true">
						<span
							class="absolute left-0 top-0 size-2 rounded-full border border-black/10"
							style="background: {c.c1}"
						></span>
						<span
							class="absolute left-1.5 top-0 size-2 rounded-full border border-black/10"
							style="background: {c.c2}"
						></span>
					</span>
				{:else}
					<span
						class="inline-block size-2 rounded-full border border-black/10"
						style="background: {c.c1}"
						aria-hidden="true"
					></span>
				{/if}
				{titleCase(e)}
			</span>
		{/each}
		{#if fragment.in_pull_quote}
			<span class="font-mono text-accent-mint">↑ in {fragment.quote_id}</span>
		{/if}
	</div>
</div>
