<!--
	BubbleCluster — circular "stage" filled with colored, value-sized bubbles.

	The stage is a flat circle (typically paper/white) sized by `size`. Bubbles
	are positioned by `bubbleLayout` so AREA scales with value and no two
	overlap. Each bubble fades + scales in from 0.85 → 1 on a staggered delay.
	The `replayKey` prop forces a remount of the bubble subtree so the entrance
	animation runs again on demand (export/looping use cases).

	Hover/focus on a bubble enlarges it slightly, reveals a label/value
	tooltip, and dims its siblings. Keyboard focus uses the same path.
-->
<script lang="ts">
	import type { BubbleSpec } from '$lib/story/types';
	import { layoutBubbles } from './bubbleLayout';

	let {
		bubbles,
		size = 240,
		variant = 'story',
		replayKey = 0,
		stageFill = 'transparent',
		entranceStartMs = 0,
		bubbleStaggerMs,
		bubbleDurationMs = 620,
		showLabels = true,
		showValueInside = true,
		labelOffset = 56,
		valueColor = 'var(--paper)',
		nameColor = 'var(--ink)',
		/** Length of the 45° leader segment leaving the bubble edge. */
		leaderDiag = 22,
		/** Length of the horizontal segment from the elbow to the label. */
		leaderRun = 26,
		leaderColor = 'rgba(48, 47, 40, 0.45)',
		/**
		 * When bubble values differ, fade lower-value bubbles toward white so
		 * count differences read at a glance. Lowest = `shadeFloor`% of the
		 * base color, highest = 100%. Set both to 100 to disable shading.
		 */
		shadeFloor = 55
	}: {
		bubbles: BubbleSpec[];
		size?: number;
		variant?: 'static' | 'story' | 'export';
		replayKey?: number;
		stageFill?: string;
		entranceStartMs?: number;
		bubbleStaggerMs?: number;
		bubbleDurationMs?: number;
		showLabels?: boolean;
		showValueInside?: boolean;
		labelOffset?: number;
		valueColor?: string;
		nameColor?: string;
		leaderDiag?: number;
		leaderRun?: number;
		leaderColor?: string;
		shadeFloor?: number;
	} = $props();

	const DEFAULT_STAGGER_MS = 90;
	const STATIC_STAGGER_MS = 60;
	/** Below this bubble radius (px), skip the inside value glyph — it would
	 * be too small to read and would crowd the bubble visually. */
	const VALUE_INSIDE_MIN_RADIUS = 22;

	const stagger = $derived(
		bubbleStaggerMs ?? (variant === 'static' ? STATIC_STAGGER_MS : DEFAULT_STAGGER_MS)
	);

	let hoveredId: string | null = $state(null);

	const stageRadius = $derived(size / 2);
	const laidOut = $derived(layoutBubbles(bubbles, { stageRadius }));

	// Shade fraction per bubble: 1 for the highest value, scaling down to
	// `shadeFloor / 100` for the lowest. If all bubbles share the same value,
	// every bubble stays at 100% (no shading variation).
	const shadeByIndex = $derived.by(() => {
		const vals = bubbles.map((b) => b.value);
		const min = Math.min(...vals);
		const max = Math.max(...vals);
		const range = max - min;
		const floor = Math.max(0, Math.min(100, shadeFloor)) / 100;
		return bubbles.map((b) => {
			if (range === 0) return 1;
			const t = (b.value - min) / range;
			return floor + (1 - floor) * t;
		});
	});

	/** Direction from the stage center to a bubble — used as the outward
	 * vector for the leader line. Fully-centered bubbles get a down-facing
	 * leader as a fallback. */
	function outwardAngle(x: number, y: number): number {
		const dx = x - stageRadius;
		const dy = y - stageRadius;
		const dist = Math.sqrt(dx * dx + dy * dy);
		if (dist < 1) return Math.PI / 2;
		return Math.atan2(dy, dx);
	}

	type Leader = {
		edge: { x: number; y: number };
		elbow: { x: number; y: number };
		end: { x: number; y: number };
		labelX: number;
		labelY: number;
		labelAlign: 'left' | 'right';
	};

	/** A two-segment leader: outward at the bubble's natural angle to the
	 * elbow, then a 45° bend into a horizontal run that points away from the
	 * stage center on whichever side has more room. */
	function leaderFor(x: number, y: number, r: number): Leader {
		const angle = outwardAngle(x, y);
		const edge = {
			x: x + r * Math.cos(angle),
			y: y + r * Math.sin(angle)
		};
		const elbow = {
			x: edge.x + leaderDiag * Math.cos(angle),
			y: edge.y + leaderDiag * Math.sin(angle)
		};
		const dirX = x >= stageRadius ? 1 : -1;
		const end = {
			x: elbow.x + dirX * leaderRun,
			y: elbow.y
		};
		const gap = 6;
		return {
			edge,
			elbow,
			end,
			labelX: end.x + dirX * gap,
			labelY: end.y,
			labelAlign: dirX === 1 ? 'left' : 'right'
		};
	}
</script>

<div
	class="stage"
	class:loop={variant === 'export'}
	style:width="{size}px"
	style:height="{size}px"
	style:background={stageFill}
	style:--bubble-duration="{bubbleDurationMs}ms"
>
	{#key replayKey}
		<!-- Leader-line layer sits beneath the bubbles so they appear to grow
		     out of the lines, not on top of them. -->
		{#if showLabels}
			<svg class="leaders" viewBox="0 0 {size} {size}" aria-hidden="true">
				{#each laidOut as bubble, i (bubble.id)}
					{@const lead = leaderFor(bubble.x, bubble.y, bubble.r)}
					{@const delay = entranceStartMs + i * stagger + 80}
					<polyline
						points="{lead.edge.x},{lead.edge.y} {lead.elbow.x},{lead.elbow.y} {lead.end.x},{lead.end.y}"
						fill="none"
						stroke={leaderColor}
						stroke-width="1"
						stroke-linecap="round"
						stroke-linejoin="round"
						class="leader"
						style:--bubble-delay="{delay}ms"
					/>
				{/each}
			</svg>
		{/if}

		{#each laidOut as bubble, i (bubble.id)}
			{@const valueFont = Math.max(11, Math.min(28, bubble.r * 0.62))}
			{@const delay = entranceStartMs + i * stagger}
			{@const shade = shadeByIndex[i] ?? 1}
			{@const lead = leaderFor(bubble.x, bubble.y, bubble.r)}
			<button
				class="bubble"
				class:dimmed={hoveredId !== null && hoveredId !== bubble.id}
				class:primary={bubble.primary}
				style:left="{bubble.x}px"
				style:top="{bubble.y}px"
				style:width="{bubble.r * 2}px"
				style:height="{bubble.r * 2}px"
				style:--bubble-base={bubble.color ?? 'var(--ink)'}
				style:--bubble-shade="{Math.round(shade * 100)}%"
				style:--bubble-final-opacity={bubble.opacity ?? 1}
				style:--bubble-delay="{delay}ms"
				onpointerenter={() => (hoveredId = bubble.id)}
				onpointerleave={() => (hoveredId = null)}
				onfocus={() => (hoveredId = bubble.id)}
				onblur={() => (hoveredId = null)}
				aria-label="{bubble.label}: {bubble.value}"
			>
				{#if showValueInside && bubble.r >= VALUE_INSIDE_MIN_RADIUS}
					<span
						class="bubble-value font-heading tabular-nums"
						style:color={valueColor}
						style:font-size="{valueFont}px"
					>
						{bubble.value}
					</span>
				{/if}
			</button>
			{#if showLabels}
				<span
					class="bubble-name font-mono"
					class:align-right={lead.labelAlign === 'right'}
					style:left="{lead.labelX}px"
					style:top="{lead.labelY}px"
					style:color={nameColor}
					style:--bubble-delay="{delay + 200}ms"
					aria-hidden="true"
				>
					{bubble.label}
				</span>
			{/if}
		{/each}
	{/key}
</div>

<style>
	.stage {
		position: relative;
		flex-shrink: 0;
		overflow: visible;
		/* No border / outline / background — the cluster sits free over its
		   host, and the parent BubbleConstellation handles the ring chrome. */
		background: transparent;
		border: 0;
		outline: 0;
	}

	.leaders {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		overflow: visible;
		pointer-events: none;
	}
	.leader {
		opacity: 0;
		stroke-dasharray: 1;
		animation: leader-fade var(--bubble-duration, 620ms) var(--ease-smooth) both;
		animation-delay: var(--bubble-delay, 0ms);
	}
	@keyframes leader-fade {
		from { opacity: 0; }
		to   { opacity: 1; stroke-dasharray: 0; }
	}

	.bubble {
		position: absolute;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 50%;
		border: 0;
		padding: 0;
		margin: 0;
		cursor: pointer;
		opacity: var(--bubble-final-opacity, 1);
		transform: translate(-50%, -50%);
		transform-origin: center center;
		/* Shade lower-value bubbles toward white so count differences read at
		   a glance. var(--bubble-shade) is set by BubbleCluster per bubble. */
		background: color-mix(
			in oklab,
			var(--bubble-base, var(--ink)) var(--bubble-shade, 100%),
			white
		);
		transition:
			transform var(--dur-fast) var(--ease-standard),
			opacity var(--dur-fast) var(--ease-standard),
			filter var(--dur-fast) var(--ease-standard);
		animation: bubble-enter var(--bubble-duration) var(--ease-smooth) both;
		animation-delay: var(--bubble-delay, 0ms);
	}

	.bubble-value {
		font-weight: 600;
		line-height: 1;
		letter-spacing: -0.02em;
		pointer-events: none;
		user-select: none;
	}

	.bubble-name {
		position: absolute;
		/* Anchor the label to the end of its leader line: vertically centered
		   on the line, horizontally adjacent to it (left-edge for right-side
		   labels, right-edge for left-side labels). */
		transform: translateY(-50%);
		font-size: 0.6875rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		text-align: left;
		line-height: 1.15;
		max-width: 8.5rem;
		pointer-events: none;
		user-select: none;
		opacity: 0;
		animation: name-fade var(--bubble-duration) var(--ease-smooth) both;
		animation-delay: var(--bubble-delay, 0ms);
		text-wrap: balance;
	}
	.bubble-name.align-right {
		transform: translate(-100%, -50%);
		text-align: right;
	}

	@keyframes name-fade {
		from { opacity: 0; }
		to   { opacity: 1; }
	}

	.stage.loop .bubble {
		animation-name: bubble-loop;
		animation-duration: 4200ms;
		animation-iteration-count: infinite;
		animation-timing-function: var(--ease-smooth);
	}

	.bubble:hover,
	.bubble:focus-visible {
		transform: translate(-50%, -50%) scale(1.08);
		outline: none;
		z-index: 3;
		filter: drop-shadow(0 4px 12px rgba(0, 0, 0, 0.18));
	}

	.bubble.dimmed {
		opacity: 0.32 !important;
		filter: saturate(0.6);
	}

	.bubble.primary {
		z-index: 2;
	}

	@keyframes bubble-enter {
		from {
			transform: translate(-50%, -50%) scale(0.85);
			opacity: 0;
		}
		to {
			transform: translate(-50%, -50%) scale(1);
			opacity: var(--bubble-final-opacity, 1);
		}
	}

	@keyframes bubble-loop {
		0% {
			transform: translate(-50%, -50%) scale(0.85);
			opacity: 0;
		}
		18% {
			transform: translate(-50%, -50%) scale(1);
			opacity: var(--bubble-final-opacity, 1);
		}
		82% {
			transform: translate(-50%, -50%) scale(1);
			opacity: var(--bubble-final-opacity, 1);
		}
		100% {
			transform: translate(-50%, -50%) scale(0.85);
			opacity: 0;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.bubble,
		.bubble-name {
			animation: none;
			opacity: var(--bubble-final-opacity, 1);
			transform: translate(-50%, -50%);
		}
		.stage.loop .bubble {
			animation: none;
		}
	}
</style>
