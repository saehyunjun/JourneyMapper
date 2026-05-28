<!--
	HeroStatBlock — single-cohort hero-metric poster.

	The library's bread-and-butter LinkedIn format: one subject, one dominant
	number, an optional micro-viz that supports without competing. Reuses the
	`Cohort` shape and the same count-up + bubble-rise motion pattern as
	ComparisonBlock so the library reads as one visual family.

	Two layouts:
	  - 'centered' — number centred; label above, caption + micro below
	  - 'corner'   — label top-left, number bottom-right; micro along the bottom
	    edge. Posterier, more editorial.
-->
<script lang="ts">
	import { Sigma } from '@lucide/svelte';
	import { onMount } from 'svelte';
	import { buildCohort, type Cohort, type Series } from '$lib/key-findings/data-shapes';
	import { getVizMotionPreset } from '$lib/motion/viz';
	import type { HeroStatBlock } from '$lib/key-findings/types';

	let {
		block,
		editable = true,
		animate = false,
		replayKey = 0,
		onUpdate,
		onConfigure
	}: {
		block: HeroStatBlock;
		editable?: boolean;
		animate?: boolean;
		replayKey?: number;
		onUpdate: (patch: Partial<HeroStatBlock>) => void;
		onConfigure: () => void;
	} = $props();

	const cohort = $derived<Cohort>(buildCohort(block.cohort, undefined, block.micro));
	let display = $state(0);

	const preset = $derived(getVizMotionPreset(animate ? 'story' : 'none'));
	const replayToken = $derived(`${replayKey}|${animate}|${cohort.value}`);

	function easeOutCubic(t: number): number {
		return 1 - Math.pow(1 - t, 3);
	}

	$effect(() => {
		replayToken;
		if (!animate) {
			display = cohort.value;
			return;
		}
		let raf = 0;
		const start = performance.now() + preset.leadIn;
		display = 0;
		function tick(now: number) {
			const t = Math.max(0, Math.min(1, (now - start) / preset.duration));
			display = Math.round(cohort.value * easeOutCubic(t));
			if (t < 1) raf = requestAnimationFrame(tick);
		}
		raf = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(raf);
	});

	onMount(() => {
		display = cohort.value;
	});

	function microMax(series: Series | undefined): number {
		return Math.max(1, ...(series ?? []).map((d) => d.value));
	}
	const max = $derived(microMax(cohort.micro));
	const accent = $derived(cohort.color ?? '#294457');
</script>

{#snippet microView()}
	{#if block.micro !== 'none' && cohort.micro && cohort.micro.length}
		{#if block.micro === 'sentiment'}
			<div class="hs-microbar" aria-label="Sentiment distribution">
				{#each cohort.micro as bucket, i (bucket.label + i)}
					<span
						class="hs-microbar-cell"
						style="flex: {bucket.value || 0.001}; background: {bucket.color};"
						title="{bucket.label}: {bucket.value}"
					></span>
				{/each}
			</div>
		{:else}
			<div class="hs-bubbles" aria-label="Top themes">
				{#each cohort.micro as item, i (item.label + i)}
					{@const size = 22 + Math.round((item.value / max) * 48)}
					<span class="hs-bubble-wrap">
						<span
							class="hs-bubble"
							style="
								width: {size}px;
								height: {size}px;
								background: {item.color};
								animation-delay: {animate ? 320 + i * 90 : 0}ms;
								animation-play-state: {animate ? 'running' : 'paused'};
							"
							title="{item.label}: {item.value}"
						></span>
						<span class="hs-bubble-label">{item.label}</span>
					</span>
				{/each}
			</div>
		{/if}
	{/if}
{/snippet}

{#if !block.configured}
	<button
		type="button"
		class="kf-placeholder"
		onclick={onConfigure}
		disabled={!editable}
		aria-label="Configure hero stat"
	>
		<Sigma class="size-6 text-slate-300" />
		<span class="font-medium text-slate-500">Hero stat</span>
		<span class="text-xs text-slate-400">Click to set the subject and big number</span>
	</button>
{:else}
	<figure class="flex h-full flex-col gap-1" style="--accent: {accent};">
		{#if block.title || editable}
			<figcaption class="flex items-baseline justify-between gap-2">
				{#if editable}
					<input
						class="min-w-0 flex-1 bg-transparent text-sm font-semibold text-slate-800 outline-none placeholder:text-slate-300"
						style="font-family: var(--font-body);"
						value={block.title}
						placeholder="Hero stat title"
						oninput={(e) => onUpdate({ title: e.currentTarget.value })}
					/>
					<button class="shrink-0 text-xs text-slate-400 hover:text-slate-700" onclick={onConfigure}>Settings</button>
				{:else if block.title}
					<h4 class="truncate text-sm font-semibold text-slate-800" style="font-family: var(--font-body);">{block.title}</h4>
				{/if}
			</figcaption>
		{/if}
		{#if block.caption}<p class="text-xs text-slate-500">{block.caption}</p>{/if}

		<div class="hs-stage" data-layout={block.layout}>
			{#if block.layout === 'centered'}
				<div class="hs-label-block">
					<p class="hs-label">{cohort.label}</p>
					{#if cohort.sublabel}<p class="hs-sublabel">{cohort.sublabel}</p>{/if}
				</div>
				<div class="hs-hero hs-hero-centered">
					<span class="hs-value tabular-nums">{display}{#if cohort.unit}<span class="hs-unit">{cohort.unit}</span>{/if}</span>
					{#if cohort.caption}<span class="hs-caption">{cohort.caption}</span>{/if}
				</div>
				<div class="hs-micro-slot">
					{@render microView()}
				</div>
			{:else}
				<!-- corner layout: label top, big number bottom-right, micro along bottom-left -->
				<div class="hs-corner-top">
					<p class="hs-label hs-label-corner">{cohort.label}</p>
					{#if cohort.sublabel}<p class="hs-sublabel">{cohort.sublabel}</p>{/if}
				</div>
				<div class="hs-corner-bottom">
					<div class="hs-micro-slot hs-micro-slot-corner">
						{@render microView()}
					</div>
					<div class="hs-hero hs-hero-corner">
						<span class="hs-value hs-value-corner tabular-nums">{display}{#if cohort.unit}<span class="hs-unit">{cohort.unit}</span>{/if}</span>
						{#if cohort.caption}<span class="hs-caption hs-caption-corner">{cohort.caption}</span>{/if}
					</div>
				</div>
			{/if}
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

	.hs-stage {
		flex: 1;
		display: flex;
		flex-direction: column;
		min-height: 0;
		container-type: inline-size;
		padding: 0.5rem 0.25rem;
	}
	.hs-stage[data-layout='centered'] {
		justify-content: space-between;
		text-align: center;
		align-items: center;
	}
	.hs-stage[data-layout='corner'] {
		justify-content: space-between;
	}

	.hs-label {
		font-family: var(--font-body, system-ui);
		font-weight: 700;
		font-size: 0.9rem;
		letter-spacing: 0.02em;
		color: var(--accent);
		margin: 0;
		text-decoration: underline;
		text-decoration-color: color-mix(in srgb, var(--accent) 50%, transparent);
		text-underline-offset: 3px;
	}
	.hs-label-corner {
		font-size: 1.05rem;
	}
	.hs-sublabel {
		font-size: 0.75rem;
		color: #64748b;
		margin: 0;
	}

	.hs-hero {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		line-height: 0.9;
	}
	.hs-hero-centered {
		align-items: center;
	}
	.hs-hero-corner {
		align-items: flex-end;
		text-align: right;
	}
	.hs-value {
		font-family: var(--font-heading, var(--font-body, system-ui));
		font-weight: 800;
		font-size: clamp(2.5rem, 14cqi, 6.5rem);
		color: #0f172a;
		letter-spacing: -0.03em;
	}
	.hs-value-corner {
		font-size: clamp(2.75rem, 16cqi, 7.5rem);
	}
	.hs-unit {
		font-size: 0.5em;
		font-weight: 700;
		color: color-mix(in srgb, var(--accent) 75%, #0f172a 25%);
		margin-left: 0.08em;
	}
	.hs-caption {
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		font-weight: 700;
		color: var(--accent);
	}
	.hs-caption-corner {
		font-size: 0.85rem;
	}

	.hs-micro-slot {
		min-height: 0;
		width: 100%;
	}
	.hs-stage[data-layout='centered'] .hs-micro-slot {
		display: flex;
		justify-content: center;
	}

	.hs-corner-top {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
	}
	.hs-corner-bottom {
		display: flex;
		align-items: flex-end;
		justify-content: space-between;
		gap: 1rem;
	}

	.hs-microbar {
		display: flex;
		height: 10px;
		width: 100%;
		max-width: 220px;
		overflow: hidden;
		border-radius: 5px;
		background: #f1f5f9;
	}
	.hs-microbar-cell {
		display: block;
		height: 100%;
		min-width: 1px;
	}

	.hs-bubbles {
		display: flex;
		align-items: flex-end;
		gap: 12px;
		flex-wrap: wrap;
	}
	.hs-bubble-wrap {
		display: inline-flex;
		flex-direction: column;
		align-items: center;
		gap: 4px;
	}
	.hs-bubble {
		display: block;
		border-radius: 50%;
		opacity: 0;
		transform: scale(0.4);
		animation: hs-bubble-rise 540ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
	}
	.hs-bubble-label {
		font-size: 0.65rem;
		color: #475569;
		max-width: 12ch;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	@keyframes hs-bubble-rise {
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
		.hs-bubble {
			animation: none;
			opacity: 1;
			transform: scale(1);
		}
	}
</style>
