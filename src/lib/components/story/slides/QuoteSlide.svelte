
<!--
	QuoteSlide — patient-voice slide.

	A large blockquote with sentiment-tinted quote marks. Single-column
	centered layout; attribution chip below. House typography (Jost) — no
	editorial serifs.
-->
<script lang="ts">
	import {
		questionLabel,
		titleCase
	} from '$lib/content/wctglpdemo-data/analysis';
	import type { QuoteSlide as QuoteSlideData } from '$lib/story/types';

	let { slide }: { slide: QuoteSlideData } = $props();

	const sentimentColor = $derived(
		slide.quote.sentiment > 0
			? 'var(--green, #599077)'
			: slide.quote.sentiment < 0
				? 'var(--orange, #CC6324)'
				: '#94a3b8'
	);
</script>

<div class="quote-slide">
	<span
		class="story-fade-in font-heading text-xs font-semibold uppercase tracking-[0.14em] text-accent-mint"
		style="--delay: 80ms;"
	>
		{slide.eyebrow}
	</span>

	<blockquote class="story-quote font-heading story-fade-in" style="--delay: 220ms;">
		<span class="quote-mark left" style="color:{sentimentColor}">&ldquo;</span>
		<p>{slide.quote.text}</p>
		<span class="quote-mark right" style="color:{sentimentColor}">&rdquo;</span>
	</blockquote>

	<div
		class="story-fade-in flex items-center gap-2.5 font-mono text-xs uppercase tracking-[0.06em] text-slate-500"
		style="--delay: 420ms;"
	>
		<span class="font-medium text-primary">{titleCase(slide.quote.interview_id)}</span>
		<span class="text-slate-300">·</span>
		<span>{questionLabel(slide.quote.question_id)}</span>
	</div>
</div>

<style>
	.quote-slide {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 1.5rem;
		padding: 4rem 2rem;
		max-width: 60rem;
		margin: 0 auto;
		width: 100%;
		height: 100%;
	}

	.story-quote {
		position: relative;
		font-size: clamp(1.4rem, 3.2vw, 2.25rem);
		font-weight: 300;
		line-height: 1.35;
		color: var(--ink, #312f28);
		text-align: center;
		max-width: 48rem;
	}
	.story-quote p { display: inline; }

	.quote-mark {
		font-size: 1.4em;
		line-height: 0;
		vertical-align: -0.2em;
		font-weight: 400;
	}
	.quote-mark.left { margin-right: 0.15em; }
	.quote-mark.right { margin-left: 0.1em; }

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
