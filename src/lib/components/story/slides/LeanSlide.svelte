
<!--
	LeanSlide — sentiment lean as a single MetricRing.

	The MetricRing carries the focal number (one data point). Specific
	driver clusters that pull the corpus positive and negative live in the
	side drawer; the slide exposes them via an inline link-button on the
	"N tagged moments" phrase plus an explicit "view drivers" CTA at the
	bottom of the narrative column.
-->
<script lang="ts">
	import { ArrowRight } from '@lucide/svelte';
	import StorySlide from '../StorySlide.svelte';
	import MetricRing from '../viz/MetricRing.svelte';
	import InlineLinkButton from '../InlineLinkButton.svelte';
	import type { LeanSlide as LeanSlideData, SlideDetail } from '$lib/story/types';

	let {
		slide,
		onOpenDetail
	}: {
		slide: LeanSlideData;
		onOpenDetail?: (detail: SlideDetail) => void;
	} = $props();

	const color = $derived(
		slide.tone === 'positive'
			? '#599077'
			: slide.tone === 'negative'
				? '#CC6324'
				: '#6a99c2'
	);

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

<StorySlide emphasis="balanced">
	{#snippet visual()}
		<MetricRing value={slide.value} total={100} size={280} color={color} labelSuffix="%" />
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
			<button
				type="button"
				class="story-fade-in story-cta font-heading"
				style="--delay: 520ms;"
				onclick={openDetail}
			>
				<span>View driver clusters</span>
				<ArrowRight class="size-3.5" />
			</button>
		{/if}
	{/snippet}
</StorySlide>

<style>
	.story-cta {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		align-self: flex-start;
		margin-top: 0.25rem;
		padding: 0.5rem 0.875rem;
		border-radius: 999px;
		font-size: 0.8125rem;
		font-weight: 500;
		color: var(--ink, #312f28);
		border: 1px solid rgba(48, 47, 40, 0.18);
		background: white;
		transition: border-color 150ms ease, background 150ms ease, transform 150ms ease;
	}
	.story-cta:hover {
		border-color: var(--midgreen, #7DBFA7);
		color: var(--green, #599077);
		transform: translateY(-1px);
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
