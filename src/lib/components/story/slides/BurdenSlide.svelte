
<!--
	BurdenSlide — ranked horizontal bars over the top-level patient burden
	taxonomy (Financial / Physical / Emotional / Regimen / etc.).

	Surfaces the cross-cutting axis the theme tree doesn't carry. Counts
	come from rolling up every keyword tag to its cluster's
	burden_category_ids[], then up the burden hierarchy to the top-level
	parent. A single tag may touch multiple top-level burdens (one cluster,
	multiple burden facets), so shares can sum to more than 100%.
-->
<script lang="ts">
	import StorySlide from '../StorySlide.svelte';
	import BurdenStack from '../viz/BurdenStack.svelte';
	import InlineLinkButton from '../InlineLinkButton.svelte';
	import type { BurdenSlide as BurdenSlideData } from '$lib/story/types';

	let { slide }: { slide: BurdenSlideData } = $props();

	// No drawer wiring yet — burden→cluster→quotes drill-down is a later
	// addition once we decide what the burden detail view should show.
	const bodyParts = $derived.by<[string, string] | null>(() => {
		if (!slide.bodyHighlight) return null;
		const idx = slide.body.indexOf(slide.bodyHighlight);
		if (idx < 0) return null;
		return [slide.body.slice(0, idx), slide.body.slice(idx + slide.bodyHighlight.length)];
	});
</script>

<StorySlide emphasis="visual">
	{#snippet visual()}
		<div class="stack-wrap">
			<BurdenStack slices={slide.slices} totalTagged={slide.totalTagged} />
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
				{bodyParts[0]}<InlineLinkButton onclick={() => {}} ariaLabel="Burden detail">{slide.bodyHighlight}</InlineLinkButton>{bodyParts[1]}
			{:else}
				{slide.body}
			{/if}
		</p>
		<p
			class="story-fade-in max-w-lg text-xs font-mono uppercase tracking-[0.08em] text-muted-foreground"
			style="--delay: 520ms;"
		>
			Rolled up to top-level categories. One tag may touch multiple burdens.
		</p>
	{/snippet}
</StorySlide>

<style>
	.stack-wrap {
		display: flex;
		flex-direction: column;
		justify-content: center;
		width: 100%;
		max-width: 580px;
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
