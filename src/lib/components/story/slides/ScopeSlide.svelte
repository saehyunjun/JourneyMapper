
<!--
	ScopeSlide — one big count, one label, no support viz.

	Used for "the corpus" framing: 187 tagged moments, 24 interviews etc. The
	number counts up on mount; nothing else competes for attention.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { animateProgress } from '$lib/charts/reveal';
	import StorySlide from '../StorySlide.svelte';
	import type { ScopeSlide as ScopeSlideData } from '$lib/story/types';

	let { slide }: { slide: ScopeSlideData } = $props();

	let displayed = $state(0);

	onMount(() => {
		const dur = Math.min(1400, Math.max(700, slide.value * 8));
		animateProgress(dur, (t) => {
			displayed = Math.round(slide.value * t);
		});
	});
</script>

<StorySlide emphasis="balanced">
	{#snippet visual()}
		<div class="scope-figure-wrap">
			<span class="scope-figure font-heading tabular-nums">{displayed.toLocaleString()}</span>
			<span class="font-mono text-xs uppercase tracking-[0.12em] text-muted-foreground">
				{slide.label}
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
		gap: 1rem;
	}
	.scope-figure {
		font-size: clamp(6rem, 16vw, 12rem);
		font-weight: 700;
		line-height: 1;
		letter-spacing: -0.04em;
		color: var(--ink, #312f28);
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
