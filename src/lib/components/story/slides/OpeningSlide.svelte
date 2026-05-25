
<!--
	OpeningSlide — the magazine cover.

	Eyebrow + title + lead paragraph. No stats grid: each scene-setting number
	earns its own slide downstream. Stays clean so the deck opens on a single
	idea.
-->
<script lang="ts">
	import type { OpeningSlide as OpeningSlideData } from '$lib/story/types';
	import IndicationPoster from '$lib/components/indication/IndicationPoster.svelte';

	let { slide }: { slide: OpeningSlideData } = $props();
</script>

<div class="relative flex h-full w-full flex-col items-center justify-center overflow-hidden px-8 py-12 md:px-20">
	{#if slide.poster}
		<div class="poster-bg pointer-events-none absolute inset-0">
			<IndicationPoster
				{...slide.poster}
				width={1920}
				height={1080}
				showFrame={false}
				fit="slice"
				animate
				animateDuration={6000}
			/>
		</div>
	{/if}
	<div class="relative flex max-w-3xl flex-col gap-8 text-center">
		<span
			class="story-fade-in font-heading text-xs font-semibold uppercase tracking-[0.18em] text-accent-mint"
			style="--delay: 0ms;"
		>
			{slide.eyebrow}
		</span>
		<h2
			class="story-fade-in font-heading text-4xl font-light leading-[1.1] text-primary md:text-6xl"
			style="--delay: 120ms;"
		>
			{@html slide.title.replace(
				/^(\S+)/,
				'<span class="font-bold border-b-2 border-accent-orange">$1</span>'
			)}
		</h2>
		<p
			class="story-fade-in text-pretty text-base leading-relaxed text-secondary-foreground md:text-lg"
			style="--delay: 260ms;"
		>
			{slide.body}
		</p>
		<p
			class="story-fade-in font-mono text-xs uppercase tracking-[0.12em] text-muted-foreground"
			style="--delay: 420ms;"
		>
			Scroll, swipe, or use → to advance
		</p>
	</div>
</div>

<style>
	.poster-bg {
		/* Full-bleed, slightly dimmed so the text stays readable. */
		opacity: 0.85;
	}
	.poster-bg :global(svg) {
		width: 100%;
		height: 100%;
		object-fit: cover;
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
