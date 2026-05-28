<!--
	ComparisonBlock — two cohorts side-by-side (Chile / Germany pattern).

	Each side renders a Cohort: subject label, big animated number, unit suffix,
	an optional micro-viz (top-3 themes as scaled bubbles, or a 5-band sentiment
	microbar), and a caption. The two sides stagger their reveal so the reader's
	eye lands on left first, then right.

	Layout is responsive:
	  - 'split'   → side by side (best on landscape cards)
	  - 'stacked' → top + bottom (best on square cards / narrow widths)

	Animation is owned here (not pushed down into a chart component) because the
	dominant motion is the count-up on the big number — the micro-viz is small
	enough that a single staggered scale-in pass reads cleanly.
-->
<script lang="ts">
	import { SquareSplitHorizontal } from '@lucide/svelte';
	import { onMount } from 'svelte';
	import { buildCohort, type Cohort, type Series } from '$lib/key-findings/data-shapes';
	import { getVizMotionPreset } from '$lib/motion/viz';
	import type { ComparisonBlock } from '$lib/key-findings/types';

	let {
		block,
		editable = true,
		animate = false,
		replayKey = 0,
		onUpdate,
		onConfigure
	}: {
		block: ComparisonBlock;
		editable?: boolean;
		animate?: boolean;
		replayKey?: number;
		onUpdate: (patch: Partial<ComparisonBlock>) => void;
		onConfigure: () => void;
	} = $props();

	// Rebuild cohorts whenever the spec or filters change. `buildCohort` is pure
	// and fast (small array scans) so we don't memoise across keys.
	const left = $derived<Cohort>(buildCohort(block.left, undefined, block.micro));
	const right = $derived<Cohort>(buildCohort(block.right, undefined, block.micro));

	// Numeric headlines drive the count-up. Holding the *target* in a derived
	// keeps spec edits live; the $effect below tweens the displayed value up to
	// the target whenever animate is on, otherwise snaps to it instantly.
	let displayLeft = $state(0);
	let displayRight = $state(0);

	const preset = $derived(getVizMotionPreset(animate ? 'story' : 'none'));

	function easeOutCubic(t: number): number {
		return 1 - Math.pow(1 - t, 3);
	}

	// Replay token folds together `replayKey`, `animate`, and the current target
	// values — any change re-triggers the count-up, including spec edits.
	const replayToken = $derived(`${replayKey}|${animate}|${left.value}|${right.value}`);

	$effect(() => {
		// Read so Svelte re-runs when the token changes.
		replayToken;
		if (!animate) {
			displayLeft = left.value;
			displayRight = right.value;
			return;
		}
		let raf = 0;
		const leftStart = performance.now() + preset.leadIn;
		const rightStart = leftStart + 200;
		displayLeft = 0;
		displayRight = 0;
		function tick(now: number) {
			const lT = Math.max(0, Math.min(1, (now - leftStart) / preset.duration));
			const rT = Math.max(0, Math.min(1, (now - rightStart) / preset.duration));
			displayLeft = Math.round(left.value * easeOutCubic(lT));
			displayRight = Math.round(right.value * easeOutCubic(rT));
			if (lT < 1 || rT < 1) raf = requestAnimationFrame(tick);
		}
		raf = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(raf);
	});

	// On first mount, when animate is off, jump straight to the targets.
	onMount(() => {
		displayLeft = left.value;
		displayRight = right.value;
	});

	function microMax(series: Series | undefined): number {
		return Math.max(1, ...(series ?? []).map((d) => d.value));
	}
	const leftMax = $derived(microMax(left.micro));
	const rightMax = $derived(microMax(right.micro));
</script>

{#snippet cohortSide(cohort: Cohort, display: number, max: number, side: 'left' | 'right')}
	{@const accent = cohort.color ?? '#294457'}
	<div class="cmp-side" data-side={side} style="--accent: {accent};">
		<div class="cmp-meta">
			<p class="cmp-label">{cohort.label || (side === 'left' ? 'Group A' : 'Group B')}</p>
			{#if cohort.sublabel}
				<p class="cmp-sublabel">{cohort.sublabel}</p>
			{/if}
		</div>

		<div class="cmp-hero">
			<span class="cmp-value tabular-nums">{display}{#if cohort.unit}<span class="cmp-unit">{cohort.unit}</span>{/if}</span>
			{#if cohort.caption}
				<span class="cmp-caption">{cohort.caption}</span>
			{/if}
		</div>

		{#if block.micro !== 'none' && cohort.micro && cohort.micro.length}
			{#if block.micro === 'sentiment'}
				<!-- 5-band horizontal microbar; widths proportional to bucket count. -->
				<div class="cmp-microbar" aria-label="Sentiment distribution">
					{#each cohort.micro as bucket, i (bucket.label + i)}
						<span
							class="cmp-microbar-cell"
							style="flex: {bucket.value || 0.001}; background: {bucket.color};"
							title="{bucket.label}: {bucket.value}"
						></span>
					{/each}
				</div>
			{:else}
				<!-- Top-K bubbles, sized by share within the cohort. -->
				<div class="cmp-bubbles" aria-label="Top themes">
					{#each cohort.micro as item, i (item.label + i)}
						{@const size = 18 + Math.round((item.value / max) * 38)}
						<span
							class="cmp-bubble"
							style="
								width: {size}px;
								height: {size}px;
								background: {item.color};
								animation-delay: {animate ? 320 + i * 90 : 0}ms;
								animation-play-state: {animate ? 'running' : 'paused'};
							"
							title="{item.label}: {item.value}"
						></span>
					{/each}
				</div>
				<div class="cmp-bubble-legend">
					{#each cohort.micro as item, i (item.label + i)}
						<span class="cmp-bubble-chip">
							<span class="cmp-bubble-dot" style="background: {item.color};"></span>
							<span class="cmp-bubble-text">{item.label}</span>
						</span>
					{/each}
				</div>
			{/if}
		{/if}
	</div>
{/snippet}

{#if !block.configured}
	<button
		type="button"
		class="kf-placeholder"
		onclick={onConfigure}
		disabled={!editable}
		aria-label="Configure comparison"
	>
		<SquareSplitHorizontal class="size-6 text-slate-300" />
		<span class="font-medium text-slate-500">Two cohorts, side by side</span>
		<span class="text-xs text-slate-400">Click to set the left and right subjects</span>
	</button>
{:else}
	<figure class="flex h-full flex-col gap-1">
		{#if block.title || editable}
			<figcaption class="flex items-baseline justify-between gap-2">
				{#if editable}
					<input
						class="min-w-0 flex-1 bg-transparent text-sm font-semibold text-slate-800 outline-none placeholder:text-slate-300"
						style="font-family: var(--font-body);"
						value={block.title}
						placeholder="Comparison title"
						oninput={(e) => onUpdate({ title: e.currentTarget.value })}
					/>
					<button class="shrink-0 text-xs text-slate-400 hover:text-slate-700" onclick={onConfigure}>Settings</button>
				{:else if block.title}
					<h4 class="truncate text-sm font-semibold text-slate-800" style="font-family: var(--font-body);">{block.title}</h4>
				{/if}
			</figcaption>
		{/if}
		{#if block.caption}<p class="text-xs text-slate-500">{block.caption}</p>{/if}

		<div class="cmp-grid" data-layout={block.layout}>
			{@render cohortSide(left, displayLeft, leftMax, 'left')}
			<div class="cmp-divider" aria-hidden="true"></div>
			{@render cohortSide(right, displayRight, rightMax, 'right')}
		</div>
	</figure>
{/if}

<style>
	.kf-placeholder {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.35rem;
		width: 100%;
		min-height: 150px;
		border: 2px dashed #e2e8f0;
		border-radius: 0.75rem;
		padding: 1.25rem;
		text-align: center;
		transition:
			border-color 0.15s ease,
			background 0.15s ease;
	}
	.kf-placeholder:hover:not(:disabled) {
		border-color: var(--teal, #7dbfa7);
		background: #f8fafc;
	}
	.kf-placeholder:focus-visible {
		outline: 2px solid var(--teal, #7dbfa7);
		outline-offset: 2px;
	}

	.cmp-grid {
		flex: 1;
		display: grid;
		gap: 0.75rem;
		min-height: 0;
	}
	.cmp-grid[data-layout='split'] {
		grid-template-columns: 1fr auto 1fr;
		align-items: stretch;
	}
	.cmp-grid[data-layout='stacked'] {
		grid-template-rows: 1fr auto 1fr;
		align-items: stretch;
	}

	.cmp-divider {
		background: #e2e8f0;
	}
	.cmp-grid[data-layout='split'] .cmp-divider {
		width: 1px;
	}
	.cmp-grid[data-layout='stacked'] .cmp-divider {
		height: 1px;
	}

	.cmp-side {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		min-width: 0;
		padding: 0.25rem 0.25rem;
	}

	.cmp-meta {
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
	}
	.cmp-label {
		font-family: var(--font-body, system-ui);
		font-weight: 700;
		font-size: 0.875rem;
		letter-spacing: 0.02em;
		color: var(--accent);
		margin: 0;
		text-decoration: underline;
		text-decoration-color: color-mix(in srgb, var(--accent) 50%, transparent);
		text-underline-offset: 3px;
	}
	.cmp-sublabel {
		font-size: 0.7rem;
		color: #64748b;
		margin: 0;
	}

	.cmp-hero {
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
		line-height: 0.95;
	}
	.cmp-value {
		font-family: var(--font-heading, var(--font-body, system-ui));
		font-weight: 800;
		font-size: clamp(2rem, 6.5cqi, 4.25rem);
		color: #0f172a;
		letter-spacing: -0.02em;
	}
	.cmp-unit {
		font-size: 0.55em;
		font-weight: 700;
		color: color-mix(in srgb, var(--accent) 75%, #0f172a 25%);
		margin-left: 0.1em;
	}
	.cmp-caption {
		font-size: 0.7rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		font-weight: 600;
		color: #475569;
	}

	.cmp-microbar {
		margin-top: auto;
		display: flex;
		height: 8px;
		width: 100%;
		overflow: hidden;
		border-radius: 4px;
		background: #f1f5f9;
	}
	.cmp-microbar-cell {
		display: block;
		height: 100%;
		min-width: 1px;
	}

	.cmp-bubbles {
		margin-top: auto;
		display: flex;
		align-items: flex-end;
		gap: 6px;
		min-height: 56px;
	}
	.cmp-bubble {
		display: block;
		border-radius: 50%;
		opacity: 0;
		transform: scale(0.4);
		animation: cmp-bubble-rise 540ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
	}
	.cmp-bubble-legend {
		display: flex;
		flex-wrap: wrap;
		gap: 6px 10px;
		font-size: 0.65rem;
		color: #475569;
	}
	.cmp-bubble-chip {
		display: inline-flex;
		align-items: center;
		gap: 4px;
	}
	.cmp-bubble-dot {
		display: inline-block;
		width: 6px;
		height: 6px;
		border-radius: 50%;
	}
	.cmp-bubble-text {
		max-width: 14ch;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.cmp-side {
		container-type: inline-size;
	}

	@keyframes cmp-bubble-rise {
		from {
			opacity: 0;
			transform: scale(0.4);
		}
		to {
			opacity: 1;
			transform: scale(1);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.cmp-bubble {
			animation: none;
			opacity: 1;
			transform: scale(1);
		}
	}
</style>
