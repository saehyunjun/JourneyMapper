<!--
	FlowSlide — full-bleed slide for the radial impact-flow chart.

	Unlike most slides (which use StorySlide's 2-column visual/narrative split),
	this one hands the entire slide area to the chart. The chart owns its own
	intro motion, hover/select, and tooltip — the slide only renders a small
	editorial header on top.
-->
<script lang="ts">
	import RadialImpactFlow from '$lib/charts/glp/RadialImpactFlow.svelte';
	import type { FlowSlide as FlowSlideData } from '$lib/story/types';

	let { slide }: { slide: FlowSlideData } = $props();
</script>

<div class="flow-root">
	<div class="flow-header">
		<span
			class="story-fade-in font-heading text-xs font-semibold uppercase tracking-[0.14em] text-accent-mint"
			style="--delay: 80ms;"
		>
			{slide.eyebrow}
		</span>
		<h2
			class="story-fade-in font-heading text-2xl font-light leading-tight text-primary md:text-3xl"
			style="--delay: 200ms;"
		>
			{slide.headline}
		</h2>
	</div>
	<div class="flow-canvas">
		<RadialImpactFlow themes={slide.themes} motionMode="story" />
	</div>
</div>

<style>
	.flow-root {
		display: flex;
		flex-direction: column;
		height: 100%;
		width: 100%;
		padding: 1.5rem 1.5rem 1rem;
		gap: 0.5rem;
	}
	@media (min-width: 768px) {
		.flow-root {
			padding: 2rem 2.5rem 1.25rem;
			gap: 1rem;
		}
	}

	.flow-header {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		flex-shrink: 0;
	}

	.flow-canvas {
		flex: 1;
		min-height: 0;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.flow-canvas :global(.rif-root) {
		height: 100%;
		display: flex;
		flex-direction: column;
	}

	.flow-canvas :global(.rif-scroll-wrap) {
		flex: 1;
		min-height: 0;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.flow-canvas :global(.rif-svg) {
		height: 100%;
		width: 100%;
		max-height: 100%;
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
