
<!--
	HeroStatSlide — visualization-first stat slide.

	The support viz (ring / waffle / sphere-ring) is the focal element; the
	numeric value sits underneath as a compact mono label paired with its
	caption. Specific drivers (sub-themes / keyword clusters) and the
	underlying tagged quotes live in the side drawer; the slide surfaces them
	via (a) an inline link-button on the numeric phrase inside the body when
	`bodyHighlight` matches a substring, and (b) an explicit "view drivers"
	CTA at the bottom of the narrative column. Both call the same
	`onOpenDetail` callback.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { ArrowRight } from '@lucide/svelte';
	import StorySlide from '../StorySlide.svelte';
	import MetricRing from '../viz/MetricRing.svelte';
	import WaffleStat from '../viz/WaffleStat.svelte';
	import RingSphere from '../viz/RingSphere.svelte';
	import BubbleConstellation from '../viz/BubbleConstellation.svelte';
	import InlineLinkButton from '../InlineLinkButton.svelte';
	import { animateProgress } from '$lib/charts/reveal';
	import { vizSize } from '$lib/story/responsiveSize.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
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

	// Responsive viz sizing — grow on md/lg/xl so the visual fills more of the
	// editorial column on larger displays. Base size keeps the viz readable on
	// mobile where the visual stacks above the narrative.
	const ringSize = $derived(vizSize({ base: 240, md: 320, lg: 420, xl: 480, '2xl': 560 }));
	const constellationSize = $derived(
		vizSize({ base: 300, md: 380, lg: 460, xl: 540, '2xl': 620 })
	);
	const waffleCellSize = $derived(vizSize({ base: 52, md: 64, lg: 80, xl: 92, '2xl': 104 }));
	const waffleGap = $derived(vizSize({ base: 8, md: 10, lg: 12, xl: 14, '2xl': 16 }));

	// Waffle-grid columns: square-ish layout, clamped so small totals (e.g. 4/9)
	// don't get squashed into a single tall column. Caps at 5 for legibility.
	function waffleCols(total: number): number {
		const sqrt = Math.round(Math.sqrt(total));
		return Math.max(1, Math.min(5, sqrt));
	}

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
			<RingSphere value={slide.support.value} caption={slide.stat.caption} color={toneColor} />
		{:else}
			<div class="hero-stack">
				{#if slide.support.kind === 'ring'}
					<MetricRing
						value={slide.support.value}
						total={slide.support.total}
						size={ringSize}
						color={toneColor}
						strokeRatio={0.11}
						showLabel={false}
					/>
				{:else if slide.support.kind === 'waffle'}
					<WaffleStat
						value={slide.support.value}
						total={slide.support.total}
						color={toneColor}
						cellSize={waffleCellSize}
						gap={waffleGap}
						cols={waffleCols(slide.support.total)}
					/>
				{:else if slide.support.kind === 'bubble-cluster'}
					<BubbleConstellation
						bubbles={slide.support.bubbles}
						tone={slide.support.tone}
						size={constellationSize}
					/>
				{/if}

				{#if !supportOwnsFigure}
					<div class="hero-label">
						<span class="hero-label-figure font-heading tabular-nums" style="color: {toneColor};">
							{#if isNumeric}{fmt(displayed)}{:else}{slide.stat.value}{/if}<span class="hero-label-suffix">{suffix}</span>
						</span>
						<span class="hero-label-caption font-mono">{slide.stat.caption}</span>
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
			class="story-fade-in font-heading text-2xl font-light leading-tight text-primary md:text-4xl"
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
			<Button
				variant="outline"
				size="sm"
				class="story-fade-in font-heading self-start"
				style="--delay: 520ms;"
				onclick={openDetail}
			>
				<span>{ctaLabel}</span>
				<ArrowRight class="size-3.5 transition-transform group-hover:translate-x-0.5" />
			</Button>
		{/if}
	{/snippet}
</StorySlide>

<style>
	.hero-stack {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 1.75rem;
		width: 100%;
		max-width: 36rem;
		text-align: center;
	}
	.hero-label {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.375rem;
		max-width: 22rem;
	}
	.hero-label-figure {
		font-size: clamp(1.75rem, 3vw, 2.5rem);
		font-weight: 600;
		line-height: 1;
		letter-spacing: -0.02em;
	}
	.hero-label-suffix {
		font-size: 0.55em;
		margin-left: 0.08em;
		color: inherit;
	}
	.hero-label-caption {
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.14em;
		color: var(--muted-foreground, #64748b);
		line-height: 1.4;
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
