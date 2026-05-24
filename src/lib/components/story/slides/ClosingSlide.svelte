
<!--
	ClosingSlide — terminal "go deeper" slide.

	Headline + body, then three explore link cards. Echoes the in-page "Go
	deeper" section so the hand-off feels continuous when the user switches
	back to Dashboard view.
-->
<script lang="ts">
	import { MoveUpRight } from '@lucide/svelte';
	import type { ClosingSlide as ClosingSlideData } from '$lib/story/types';

	let { slide }: { slide: ClosingSlideData } = $props();
</script>

<div class="closing-slide">
	<div class="closing-head">
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
			class="story-fade-in max-w-2xl text-pretty text-base leading-relaxed text-secondary-foreground"
			style="--delay: 360ms;"
		>
			{slide.body}
		</p>
	</div>

	<div class="closing-grid">
		{#each slide.links as link, i (link.href)}
			<a
				href={link.href}
				class="closing-card story-fade-in"
				style="--delay: {520 + i * 120}ms;"
				data-story-allow-scroll
			>
				<div class="flex items-start justify-between gap-3">
					<h3 class="font-heading text-base font-medium uppercase tracking-tight text-accent-mint">
						{link.title}
					</h3>
					<MoveUpRight class="size-5 shrink-0 text-accent-mint" />
				</div>
				<p class="text-sm leading-relaxed text-secondary-foreground">{link.blurb}</p>
			</a>
		{/each}
	</div>
</div>

<style>
	.closing-slide {
		display: flex;
		flex-direction: column;
		gap: 2.5rem;
		padding: 4rem 4rem 3rem;
		width: 100%;
		max-width: 72rem;
		margin: 0 auto;
		height: 100%;
		justify-content: center;
	}

	.closing-head {
		display: flex;
		flex-direction: column;
		gap: 0.875rem;
		max-width: 44rem;
	}

	.closing-grid {
		display: grid;
		gap: 1rem;
		grid-template-columns: 1fr;
	}
	@media (min-width: 768px) {
		.closing-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
	}

	.closing-card {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding: 1.5rem;
		border: 1px solid rgba(48, 47, 40, 0.12);
		background: white;
		transition: transform 200ms ease, border-color 200ms ease, box-shadow 200ms ease;
	}
	.closing-card:hover {
		transform: translateY(-3px);
		border-color: rgba(48, 47, 40, 0.32);
		box-shadow: 0 12px 24px -16px rgba(48, 47, 40, 0.25);
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
