<script lang="ts" module>
	export type TooltipContent = {
		title: string;
		meta?: string;
		value?: string | number;
		unit?: string;
		swatchColor?: string;
		extra?: string;
	};

	export type LegendItem = { label: string; color: string };

	export type ChartMargin = { top: number; right: number; bottom: number; left: number };

	export type ChartBodyContext = {
		width: number;
		innerWidth: number;
		innerHeight: number;
		progress: number;
		setHover: (content: TooltipContent, e: PointerEvent) => void;
		clearHover: () => void;
	};
</script>

<script lang="ts">
	import { onMount, type Snippet } from 'svelte';
	import { reveal, animateProgress } from './reveal.js';

	type Props = {
		figure: string | number;
		caption: string;
		legend?: LegendItem[];
		height?: number;
		margin?: ChartMargin;
		ariaLabel?: string;
		initialWidth?: number;
		source?: string;
		body: Snippet<[ChartBodyContext]>;
	};

	let {
		figure,
		caption,
		legend = [],
		height = 320,
		margin = { top: 24, right: 16, bottom: 40, left: 40 },
		ariaLabel,
		initialWidth = 640,
		source,
		body
	}: Props = $props();

	let wrapEl: HTMLElement;
	let width = $state(initialWidth);
	let progress = $state(0);
	let isRevealed = $state(false);
	let hover = $state<{ content: TooltipContent; x: number; y: number } | null>(null);

	const innerWidth = $derived(Math.max(0, width - margin.left - margin.right));
	const innerHeight = $derived(Math.max(0, height - margin.top - margin.bottom));

	function startReveal() {
		isRevealed = true;
		animateProgress(900, (t) => (progress = t));
	}

	function setHover(content: TooltipContent, e: PointerEvent) {
		const rect = wrapEl.getBoundingClientRect();
		hover = { content, x: e.clientX - rect.left, y: e.clientY - rect.top };
	}

	function clearHover() {
		hover = null;
	}

	onMount(() => {
		const measure = () => {
			if (wrapEl) width = wrapEl.clientWidth;
		};
		measure();
		const ro = new ResizeObserver(measure);
		ro.observe(wrapEl);
		return () => ro.disconnect();
	});
</script>

<figure
	class="chart"
	class:is-revealed={isRevealed}
	bind:this={wrapEl}
	use:reveal={{ onReveal: startReveal }}
>
	<figcaption class="chart-title">
		<span class="kicker">Figure {figure}</span>
		{caption}
	</figcaption>

	<svg viewBox="0 0 {width} {height}" role="img" aria-label={ariaLabel ?? caption}>
		<g transform="translate({margin.left},{margin.top})">
			{@render body({ width, innerWidth, innerHeight, progress, setHover, clearHover })}
		</g>
	</svg>

	{#if hover}
		<div class="tooltip" style="left: {hover.x}px; top: {hover.y}px;" role="tooltip">
			<div class="tt-title">{hover.content.title}</div>
			{#if hover.content.meta}
				<div class="tt-meta">{hover.content.meta}</div>
			{/if}
			{#if hover.content.value !== undefined}
				<div class="tt-row">
					{#if hover.content.swatchColor}
						<span class="tt-swatch" style="background: {hover.content.swatchColor};"></span>
					{/if}
					<span class="tt-value">{hover.content.value}</span>
					{#if hover.content.unit}
						<span class="tt-unit">{hover.content.unit}</span>
					{/if}
				</div>
			{/if}
			{#if hover.content.extra}
				<div class="tt-extra">{hover.content.extra}</div>
			{/if}
		</div>
	{/if}

	{#if legend.length}
		<div class="legend">
			{#each legend as item (item.label)}
				<span class="legend-swatch" style="background: {item.color};"></span>
				<span class="legend-key">{item.label}</span>
			{/each}
		</div>
	{/if}

	{#if source}
		<p class="source">Source: {source}</p>
	{/if}
</figure>

<style>
	.chart {
		margin: 2rem 0;
		position: relative;
		opacity: 0;
		transform: translateY(12px);
		transition: opacity 600ms ease-out, transform 600ms ease-out;
	}
	.chart.is-revealed {
		opacity: 1;
		transform: translateY(0);
	}
	.chart-title {
		font-size: 0.875rem;
		color: var(--muted-foreground);
		margin-bottom: 0.75rem;
		display: flex;
		gap: 0.75rem;
		align-items: baseline;
	}
	.kicker {
		font-family: var(--font-mono);
		font-size: 0.7rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--ink);
		opacity: 0.6;
	}
	svg {
		width: 100%;
		height: auto;
		display: block;
		overflow: visible;
	}
	/* Label classes used by chart body snippets — exposed globally so chart
	   variants don't have to redeclare them. */
	.chart :global(.tick-label) {
		font-family: var(--font-mono);
		font-size: 0.7rem;
		fill: var(--ink);
		fill-opacity: 0.6;
	}
	.chart :global(.value-label) {
		font-family: var(--font-mono);
		font-size: 0.85rem;
		font-weight: 600;
		fill: var(--ink);
		pointer-events: none;
		transition: opacity 200ms ease;
	}
	.chart :global(.row-label) {
		font-family: var(--font-body);
		font-size: 0.8rem;
		font-weight: 500;
		fill: var(--ink);
	}
	.chart :global(.col-label) {
		font-family: var(--font-body);
		font-size: 0.7rem;
		fill: var(--ink);
		fill-opacity: 0.8;
	}
	.chart :global(.axis-caption) {
		font-family: var(--font-mono);
		font-size: 0.7rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		fill: var(--ink);
		fill-opacity: 0.6;
	}
	.chart :global(.annotation) {
		font-family: var(--font-mono);
		font-size: 0.7rem;
		fill: var(--ink);
		fill-opacity: 0.7;
		pointer-events: none;
		transition: opacity 200ms ease;
	}
	.chart :global(rect) {
		cursor: crosshair;
	}
	.legend {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem 1rem;
		margin-top: 0.5rem;
		font-size: 0.75rem;
		font-family: var(--font-mono);
		align-items: center;
	}
	.legend-swatch {
		display: inline-block;
		width: 14px;
		height: 8px;
		border-radius: 1px;
	}
	.legend-key {
		opacity: 0.8;
		margin-right: 0.5rem;
	}
	.source {
		font-family: var(--font-mono);
		font-size: 0.7rem;
		color: var(--muted-foreground);
		margin-top: 0.5rem;
	}
	.tooltip {
		position: absolute;
		pointer-events: none;
		background: var(--ink);
		color: var(--paper);
		padding: 0.5rem 0.625rem;
		border-radius: 4px;
		font-family: var(--font-mono);
		font-size: 0.7rem;
		line-height: 1.4;
		transform: translate(12px, -100%);
		box-shadow: 0 4px 14px rgba(0, 0, 0, 0.18);
		z-index: 10;
		min-width: 10rem;
		animation: fade-in 120ms ease-out;
	}
	.tt-title {
		font-family: var(--font-body);
		font-weight: 600;
		font-size: 0.8rem;
	}
	.tt-meta {
		opacity: 0.65;
		margin-bottom: 0.25rem;
	}
	.tt-row {
		display: flex;
		align-items: baseline;
		gap: 0.4rem;
		margin-top: 0.2rem;
	}
	.tt-swatch {
		display: inline-block;
		width: 10px;
		height: 6px;
		border-radius: 1px;
		align-self: center;
	}
	.tt-value {
		font-size: 0.95rem;
		font-weight: 600;
	}
	.tt-unit {
		opacity: 0.7;
	}
	.tt-extra {
		opacity: 0.6;
		font-size: 0.7rem;
		margin-top: 0.25rem;
	}
	@keyframes fade-in {
		from {
			opacity: 0;
			transform: translate(12px, calc(-100% + 4px));
		}
		to {
			opacity: 1;
			transform: translate(12px, -100%);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.chart {
			opacity: 1;
			transform: none;
			transition: none;
		}
	}
</style>
