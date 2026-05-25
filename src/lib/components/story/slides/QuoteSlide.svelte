
<!--
	QuoteSlide — patient-voice slide.

	Wraps the shared KeyQuoteCard (size="lg") so the story deck speaks the
	same visual language as the Lab Book's key-findings / fingerprint pages.
	Eyebrow + card animate in with a short stagger; reduced-motion users get
	the static frame.
-->
<script lang="ts">
	import KeyQuoteCard from '$lib/components/KeyQuoteCard.svelte';
	import type { QuoteSlide as QuoteSlideData } from '$lib/story/types';
	import type { ParticipantProfile } from '$lib/types/participant-profile';

	let {
		slide,
		profiles,
		onparticipant
	}: {
		slide: QuoteSlideData;
		profiles: Record<string, ParticipantProfile>;
		onparticipant: (interviewId: string) => void;
	} = $props();
</script>

<div class="quote-slide">
	<span
		class="story-fade-in font-heading text-xs font-semibold uppercase tracking-[0.14em] text-accent-mint"
		style="--delay: 80ms;"
	>
		{slide.eyebrow}
	</span>

	<div class="story-fade-in card-wrap" style="--delay: 220ms;">
		<KeyQuoteCard
			text={slide.quote.text}
			sentiment={slide.quote.sentiment}
			interviewId={slide.quote.interview_id}
			questionId={slide.quote.question_id}
			themes={slide.quote.themes}
			{profiles}
			{onparticipant}
			size="lg"
		/>
	</div>
</div>

<style>
	.quote-slide {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 1.75rem;
		padding: 4rem 2rem;
		max-width: 60rem;
		margin: 0 auto;
		width: 100%;
		height: 100%;
	}

	.card-wrap {
		width: 100%;
		max-width: 48rem;
	}

	.story-fade-in {
		opacity: 0;
		animation: story-rise 700ms cubic-bezier(0.19, 1, 0.22, 1) var(--delay, 0ms) forwards;
	}
	@keyframes story-rise {
		from { opacity: 0; transform: translateY(10px); }
		to   { opacity: 1; transform: translateY(0); }
	}
	@media (prefers-reduced-motion: reduce) {
		.story-fade-in { animation: none; opacity: 1; }
	}
</style>
