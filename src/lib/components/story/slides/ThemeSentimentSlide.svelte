
<!--
	ThemeSentimentSlide — small-multiples follow-on to the recolor slide.

	Where the recolor slide colors the whole corpus by sentiment, this slide
	splits that same signal by theme so the spread becomes visible. The
	headline calls out the theme with the strongest negative pull; the body
	carries the corpus baseline so the reader has a comparison point.
-->
<script lang="ts">
	import { ArrowRight } from '@lucide/svelte';
	import StorySlide from '../StorySlide.svelte';
	import ThemeSentimentBars from '../viz/ThemeSentimentBars.svelte';
	import InlineLinkButton from '../InlineLinkButton.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import type { ThemeSentimentSlide as ThemeSentimentSlideData, SlideDetail } from '$lib/story/types';

	let {
		slide,
		onOpenDetail
	}: {
		slide: ThemeSentimentSlideData;
		onOpenDetail?: (detail: SlideDetail) => void;
	} = $props();

	const bodyParts = $derived.by<[string, string] | null>(() => {
		if (!slide.bodyHighlight || !slide.detail || !onOpenDetail) return null;
		const idx = slide.body.indexOf(slide.bodyHighlight);
		if (idx < 0) return null;
		return [slide.body.slice(0, idx), slide.body.slice(idx + slide.bodyHighlight.length)];
	});

	const hasDrawer = $derived(Boolean(slide.detail && onOpenDetail));

	function openDetail() {
		if (slide.detail && onOpenDetail) onOpenDetail(slide.detail);
	}
</script>

<StorySlide emphasis="visual">
	{#snippet visual()}
		<div class="bars-wrap">
			<ThemeSentimentBars rows={slide.rows} />
		</div>
	{/snippet}

	{#snippet narrative()}
		<span
			class="story-fade-in font-heading text-xs font-semibold uppercase tracking-[0.14em] text-accent-mint"
			style="--delay: 80ms;"
		>
			{slide.eyebrow}
		</span>
		<h2
			class="story-fade-in font-heading text-3xl font-light leading-tight text-primary md:text-4xl"
			style="--delay: 200ms;"
		>
			{slide.headline}
		</h2>
		<p
			class="story-fade-in max-w-lg text-pretty text-base leading-relaxed text-secondary-foreground"
			style="--delay: 360ms;"
		>
			{#if bodyParts}
				{bodyParts[0]}<InlineLinkButton onclick={openDetail} ariaLabel="View driver clusters">{slide.bodyHighlight}</InlineLinkButton>{bodyParts[1]}
			{:else}
				{slide.body}
			{/if}
		</p>

		{#if hasDrawer}
			<Button
				variant="outline"
				size="sm"
				class="story-fade-in font-heading self-start"
				style="--delay: 520ms;"
				onclick={openDetail}
			>
				<span>View driver clusters</span>
				<ArrowRight class="size-3.5" />
			</Button>
		{/if}
	{/snippet}
</StorySlide>

<style>
	.bars-wrap {
		display: flex;
		flex-direction: column;
		justify-content: center;
		width: 100%;
		max-width: 540px;
	}

	.story-fade-in {
		opacity: 0;
		animation: story-rise 600ms cubic-bezier(0.19, 1, 0.22, 1) var(--delay, 0ms) forwards;
	}
	@keyframes story-rise {
		from { opacity: 0; transform: translateY(8px); }
		to   { opacity: 1; transform: translateY(0); }
	}
	@media (prefers-reduced-motion: reduce) {
		.story-fade-in { animation: none; opacity: 1; }
	}
</style>
