
<!--
	HeroStatSlide — one dominant number + headline + optional support viz.

	The number is the slide's single focal point. Specific drivers (sub-themes
	/ keyword clusters) and the underlying tagged quotes live in the side
	drawer; the slide surfaces them via (a) an inline link-button on the
	numeric phrase inside the body when `bodyHighlight` matches a substring,
	and (b) an explicit "view drivers" CTA at the bottom of the narrative
	column. Both call the same `onOpenDetail` callback.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { ArrowRight } from '@lucide/svelte';
	import StorySlide from '../StorySlide.svelte';
	import MetricRing from '../viz/MetricRing.svelte';
	import WaffleStat from '../viz/WaffleStat.svelte';
	import RingSphere from '../viz/RingSphere.svelte';
	import InlineLinkButton from '../InlineLinkButton.svelte';
	import { animateProgress } from '$lib/charts/reveal';
	import type { HeroStatSlide as HeroStatSlideData, SlideDetail } from '$lib/story/types';

	let {
		slide,
		onOpenDetail
	}: {
		slide: HeroStatSlideData;
		onOpenDetail?: (detail: SlideDetail) => void;
	} = $props();

	const parsed = $derived(parseFloat(slide.stat.value));
	const isNumeric = $derived(Number.isFinite(parsed));
	const suffix = $derived(isNumeric ? slide.stat.value.replace(String(parsed), '') : '');

	let displayed = $state(0);

	onMount(() => {
		if (!isNumeric) return;
		const dur = Math.min(1400, Math.max(700, Math.abs(parsed) * 6));
		animateProgress(dur, (t) => {
			displayed = parsed * t;
		});
	});

	const toneColor = $derived(
		slide.tone === 'positive'
			? '#599077'
			: slide.tone === 'negative'
				? '#CC6324'
				: slide.tone === 'divisive'
					? '#b45309'
					: 'var(--ink, #312f28)'
	);

	function fmt(v: number): string {
		if (Number.isInteger(parsed)) return String(Math.round(v));
		return v.toFixed(1);
	}

	const supportOwnsFigure = $derived(slide.support.kind === 'sphere-ring');

	// Split the body around the highlightable phrase so the matching span can
	// be rendered as an InlineLinkButton. If the phrase doesn't appear, the
	// body renders as a single string.
	const bodyParts = $derived.by<[string, string] | null>(() => {
		if (!slide.bodyHighlight || !slide.detail || !onOpenDetail) return null;
		const idx = slide.body.indexOf(slide.bodyHighlight);
		if (idx < 0) return null;
		return [slide.body.slice(0, idx), slide.body.slice(idx + slide.bodyHighlight.length)];
	});

	const hasDrawer = $derived(Boolean(slide.detail && onOpenDetail));
	const ctaLabel = $derived(
		slide.detail?.fragments?.length
			? `View drivers + ${slide.detail.fragments.length} quotes`
			: 'View drivers'
	);

	function openDetail() {
		if (slide.detail && onOpenDetail) onOpenDetail(slide.detail);
	}
</script>

<StorySlide emphasis="balanced">
	{#snippet visual()}
		{#if slide.support.kind === 'sphere-ring'}
			<RingSphere value={slide.support.value} caption={slide.stat.caption} />
		{:else}
			<div class="hero-stack">
				{#if !supportOwnsFigure}
					<div class="hero-figure font-heading tabular-nums" style="color: {toneColor};">
						{#if isNumeric}{fmt(displayed)}{:else}{slide.stat.value}{/if}<span class="hero-suffix">{suffix}</span>
					</div>
					<div class="font-mono text-xs uppercase tracking-[0.12em] text-muted-foreground">
						{slide.stat.caption}
					</div>
				{/if}

				{#if slide.support.kind === 'ring'}
					<div class="mt-4">
						<MetricRing
							value={slide.support.value}
							total={slide.support.total}
							size={140}
							color={toneColor}
							strokeRatio={0.13}
							showLabel={false}
						/>
					</div>
				{:else if slide.support.kind === 'waffle'}
					<div class="mt-4">
						<WaffleStat
							value={slide.support.value}
							total={slide.support.total}
							color={toneColor}
							cellSize={26}
							cols={Math.min(slide.support.total, 5)}
						/>
					</div>
				{/if}
			</div>
		{/if}
	{/snippet}

	{#snippet narrative()}
		<span
			class="story-fade-in font-heading text-xs font-semibold uppercase tracking-[0.14em]"
			style="color: {toneColor}; --delay: 80ms;"
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
				{bodyParts[0]}<InlineLinkButton onclick={openDetail} ariaLabel="View supporting drivers">{slide.bodyHighlight}</InlineLinkButton>{bodyParts[1]}
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
				<span>{ctaLabel}</span>
				<ArrowRight class="size-3.5 transition-transform group-hover:translate-x-0.5" />
			</button>
		{/if}
	{/snippet}
</StorySlide>

<style>
	.hero-stack {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 0.75rem;
		width: 100%;
		max-width: 28rem;
	}
	.hero-figure {
		font-size: clamp(5rem, 13vw, 11rem);
		font-weight: 700;
		line-height: 1;
		letter-spacing: -0.04em;
	}
	.hero-suffix {
		font-size: 0.4em;
		margin-left: 0.06em;
		color: inherit;
	}

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
