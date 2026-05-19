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
	import {
		participantLabel,
		questionLabel,
		titleCase,
		SENTIMENT_LABELS,
		type ThemeFragment
	} from '$lib/content/wctglpdemo-data/analysis';
	import { profileName, type ParticipantProfile } from '$lib/types/participant-profile';

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
			<button
				type="button"
				onclick={() => onToggleStar?.(fragment.segment_id)}
				disabled={togglingStar}
				aria-pressed={starred}
				title={starred ? 'Starred — click to unstar' : 'Star this segment'}
				class="shrink-0 rounded p-1 transition-colors hover:bg-amber-50 disabled:opacity-40
					{starred ? 'text-amber-400' : 'text-slate-300 hover:text-amber-400'}"
			>
				<StarIcon size={18} fill={starred ? 'currentColor' : 'none'} />
			</button>
		{/if}
	</div>

	<p class="mt-2 text-sm leading-relaxed text-slate-700">
		<KeywordText text={fragment.text} />
	</p>

	<div class="mt-1 text-xs text-slate-500">{questionLabel(fragment.question_id)}</div>

	<!-- Sentiment, emotions, and pull-quote provenance -->
	<div class="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-400">
		<span class="rounded-full px-1.5 py-0.5 {sentimentClass(fragment.sentiment)}">
			{SENTIMENT_LABELS[fragment.sentiment]}
		</span>
		{#each fragment.emotions as e (e)}
			<span class="rounded-full bg-slate-100 px-1.5 py-0.5 text-slate-600">{titleCase(e)}</span>
		{/each}
		{#if fragment.in_pull_quote}
			<span class="font-mono text-accent-mint">↑ in {fragment.quote_id}</span>
		{/if}
	</div>
</div>
