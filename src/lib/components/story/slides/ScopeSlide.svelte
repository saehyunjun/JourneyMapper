
<!--
	ScopeSlide — N circles in a tight grid, one per unit.

	The corpus-size scene-setter: each tagged moment (or interview, theme,
	whatever the scope stat counts) renders as one circle so the slide reads
	as a tangible quantity, not an abstract figure. Headline on the right
	names the number; the grid carries the visual weight.
-->
<script lang="ts">
	import StorySlide from '../StorySlide.svelte';
	import DotGrid from '../viz/DotGrid.svelte';
	import { vizSize } from '$lib/story/responsiveSize.svelte';
	import type { ScopeSlide as ScopeSlideData } from '$lib/story/types';

	let {
		slide,
		sharedGridActive = false
	}: {
		slide: ScopeSlideData;
		/**
		 * When the persistent corpus grid is rendering on this slide, skip
		 * the local DotGrid (the shell handles dots) and only render the
		 * caption pinned below the grid's footprint.
		 */
		sharedGridActive?: boolean;
	} = $props();

	const dotCellSize = $derived(vizSize({ base: 8, md: 10, lg: 12, xl: 15, '2xl': 18 }));
	const dotGap = $derived(vizSize({ base: 3, md: 3, lg: 4, xl: 5, '2xl': 6 }));
</script>

<StorySlide emphasis="balanced">
	{#snippet visual()}
		<div class="scope-figure-wrap" class:caption-only={sharedGridActive}>
			{#if !sharedGridActive}
				<DotGrid count={slide.value} cellSize={dotCellSize} gap={dotGap} />
			{/if}
			<span class="font-mono text-xs uppercase tracking-[0.12em] text-muted-foreground">
				{slide.value.toLocaleString()} · {slide.label}
			</span>
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
		{#if slide.body}
			<p
				class="story-fade-in max-w-lg text-pretty text-base leading-relaxed text-secondary-foreground"
				style="--delay: 360ms;"
			>
				{slide.body}
			</p>
		{/if}
	{/snippet}
</StorySlide>

<style>
	.scope-figure-wrap {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1.25rem;
	}
	/* When the shared grid handles dots, push the caption down so it sits
	   beneath the grid's footprint rather than floating at the column's
	   vertical centre. */
	.scope-figure-wrap.caption-only {
		justify-content: flex-end;
		height: 100%;
		padding-bottom: 1.5rem;
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
