<!--
	SentimentDonut — a small three-band donut for one finding's segment mix:
	positive / neutral / negative coded segments. Sized for a card corner; a
	self-contained SVG so it carries no chart-library dependency.

	Motion: supports the shared dashboard / story / none modes from
	$lib/motion/viz. Each band's arc sweeps from 0 → its true dash length on
	intro; final geometry always matches the data, so the donut is accurate
	the instant the animation ends. Story mode also fades a centred total
	count and counts it up. Bump `replayKey` to restart the choreography
	(used for GIF/MP4 capture and for hover-to-replay previews).
-->
<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import {
		countUp,
		getArcTweenConfig,
		getLabelRevealConfig,
		getIntroTotalDuration,
		resolveMotionMode,
		sentimentRevealIndex,
		type VizMotionMode
	} from '$lib/motion/viz';

	let {
		positive = 0,
		neutral = 0,
		negative = 0,
		size = 56,
		motionMode = 'dashboard',
		replayKey = 0,
		stagger = true,
		reducedMotion,
		animationDuration,
		showTotal = false,
		onintrocomplete
	}: {
		positive?: number;
		neutral?: number;
		negative?: number;
		size?: number;
		/** 'none' | 'dashboard' (default) | 'story'. */
		motionMode?: VizMotionMode;
		/** Bump to replay the intro. */
		replayKey?: number;
		/** Stagger band reveals (negative → neutral → positive in story mode). */
		stagger?: boolean;
		/** Force reduced motion regardless of system setting. */
		reducedMotion?: boolean;
		/** Override the preset duration (ms) — applied to each band's sweep. */
		animationDuration?: number;
		/** Story-mode only: fade & count up a centred total. */
		showTotal?: boolean;
		/** Fires once the last mark + label have settled. */
		onintrocomplete?: () => void;
	} = $props();

	const COLORS = { positive: '#34d399', neutral: '#e2e8f0', negative: '#fb7185' };

	const stroke = $derived(Math.max(4, Math.round(size / 7)));
	const radius = $derived((size - stroke) / 2);
	const circumference = $derived(2 * Math.PI * radius);
	const total = $derived(positive + neutral + negative);

	const effectiveMode = $derived(resolveMotionMode(motionMode, reducedMotion));

	type Band = {
		key: 'positive' | 'neutral' | 'negative';
		color: string;
		dash: number;
		offset: number;
		sentiment: number;
		/** Order in which this band reveals during story mode. */
		revealIndex: number;
	};

	const bands = $derived.by<Band[]>(() => {
		if (total === 0) return [];
		let offset = 0;
		const draw: Band[] = [];
		const order: Array<['positive' | 'neutral' | 'negative', number, number]> = [
			['positive', positive, 1],
			['neutral', neutral, 0],
			['negative', negative, -1]
		];
		order.forEach(([key, value, sentiment], originalIndex) => {
			if (value === 0) return;
			const dash = (value / total) * circumference;
			draw.push({
				key,
				color: COLORS[key],
				dash,
				offset,
				sentiment,
				revealIndex: sentimentRevealIndex(sentiment, originalIndex)
			});
			offset += dash;
		});

		// Translate the revealIndex sort key into a contiguous slot (0,1,2…) so
		// per-band stagger delays line up cleanly. Story mode reveals negative →
		// neutral → positive; the *paint* order (positive then neutral then
		// negative from 12 o'clock) is unchanged.
		const ordered = [...draw].sort((a, b) => a.revealIndex - b.revealIndex);
		const slot = new Map(ordered.map((b, i) => [b.key, i]));
		return draw.map((b) => ({ ...b, revealIndex: slot.get(b.key) ?? 0 }));
	});

	let mounted = $state(false);
	let revealTick = $state(0);

	// Linear elapsed-ms drives both the per-band local progress and the timer
	// that fires onintrocomplete. We hold it in a $state so the template
	// re-renders each frame.
	let elapsedMs = $state(0);
	let raf = 0;
	let introTimer: ReturnType<typeof setTimeout> | null = null;

	const bandDuration = $derived(animationDuration ?? getArcTweenConfig(effectiveMode, 0).duration);

	function bandDelay(b: Band): number {
		if (effectiveMode === 'none' || !stagger) return 0;
		return getArcTweenConfig(effectiveMode, b.revealIndex).delay;
	}

	function bandProgress(b: Band): number {
		if (effectiveMode === 'none') return 1;
		const local = (elapsedMs - bandDelay(b)) / Math.max(1, bandDuration);
		const clamped = Math.max(0, Math.min(1, local));
		const cfg = getArcTweenConfig(effectiveMode, 0);
		return cfg.ease(clamped);
	}

	function settleMs(): number {
		const last = bands.length ? bands[bands.length - 1] : null;
		if (!last) return 0;
		return bandDelay(last) + bandDuration;
	}

	function startIntro() {
		if (raf) cancelAnimationFrame(raf);
		if (introTimer) clearTimeout(introTimer);

		if (effectiveMode === 'none') {
			elapsedMs = settleMs();
			return;
		}

		const start = performance.now();
		const target = settleMs();
		elapsedMs = 0;

		const tick = (now: number) => {
			elapsedMs = Math.min(target, now - start);
			if (elapsedMs < target) raf = requestAnimationFrame(tick);
		};
		raf = requestAnimationFrame(tick);

		if (onintrocomplete) {
			const total = getIntroTotalDuration(effectiveMode, bands.length);
			introTimer = setTimeout(() => onintrocomplete?.(), total);
		}
	}

	onMount(() => {
		mounted = true;
		revealTick++;
		startIntro();
		return () => {
			if (raf) cancelAnimationFrame(raf);
			if (introTimer) clearTimeout(introTimer);
		};
	});

	// Replay when replayKey changes or when the mode flips after the initial
	// mount. Reading these inside untrack(startIntro) is wrong — we want to
	// react to them and *then* run startIntro outside of reactive tracking so
	// startIntro's reads of `bands`/`effectiveMode` aren't entangled.
	$effect(() => {
		void replayKey;
		void effectiveMode;
		if (!mounted) return;
		untrack(() => {
			revealTick++;
			startIntro();
		});
	});

	const labelCfg = $derived(getLabelRevealConfig(effectiveMode, bands.length));
</script>

<div class="relative inline-block" style="width: {size}px; height: {size}px;">
	<svg
		width={size}
		height={size}
		viewBox="0 0 {size} {size}"
		role="img"
		aria-label="{positive} positive, {neutral} neutral, {negative} negative segments"
	>
		<g transform="rotate(-90 {size / 2} {size / 2})">
			{#if total === 0}
				<circle
					cx={size / 2}
					cy={size / 2}
					r={radius}
					fill="none"
					stroke={COLORS.neutral}
					stroke-width={stroke}
				/>
			{:else}
				{#each bands as band (band.key)}
					{@const p = bandProgress(band)}
					{@const liveDash = band.dash * p}
					<circle
						cx={size / 2}
						cy={size / 2}
						r={radius}
						fill="none"
						stroke={band.color}
						stroke-width={stroke}
						stroke-dasharray="{liveDash} {circumference - liveDash}"
						stroke-dashoffset={-band.offset}
						stroke-linecap="butt"
					/>
				{/each}
			{/if}
		</g>
	</svg>

	{#if showTotal && effectiveMode !== 'none' && total > 0}
		<span
			class="pointer-events-none absolute inset-0 flex items-center justify-center font-mono tabular-nums text-[0.7rem] font-medium text-slate-700"
			style="opacity: 0; animation: viz-label-fade-in {labelCfg.duration}ms var(--viz-ease-story) {labelCfg.delay}ms forwards;"
			use:countUp={{
				value: total,
				mode: effectiveMode,
				duration: labelCfg.duration,
				delay: labelCfg.delay,
				replayKey: revealTick
			}}
		></span>
	{/if}
</div>

<style>
	@keyframes viz-label-fade-in {
		from { opacity: 0; transform: translateY(2px); }
		to { opacity: 1; transform: translateY(0); }
	}

	@media (prefers-reduced-motion: reduce) {
		span {
			animation: none !important;
			opacity: 1 !important;
		}
	}
</style>
