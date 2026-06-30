<!--
	RoundaboutSegment — a circular loop centered on a stage anchor, representing
	backtracks / repeated traversal / treatment cycles.

	Two SVG circles: an outer "loop" path the route traces, and a smaller inner
	hub at the stage. An optional exit stub points to `exitTo` if the route
	leaves the loop.

	Stroke style mirrors StraightSegment so the loop reads as part of the same
	route language.
-->
<script lang="ts">
	import type { Point, StageStatus } from './types';

	type Props = {
		at: Point;
		radius: number;
		exitTo?: Point;
		stroke: string;
		status?: StageStatus;
	};

	let { at, radius, exitTo, stroke, status = 'completed' }: Props = $props();

	// Build a near-complete circular path with a small notch where the route
	// enters/exits, so it reads as a roundabout rather than a planet.
	const loopD = $derived.by(() => {
		const start = { x: at.x + radius, y: at.y };
		const end = { x: at.x + radius * Math.cos(-0.3), y: at.y + radius * Math.sin(-0.3) };
		// Arc that sweeps from start, around the long way, to end (large-arc-flag = 1).
		return `M ${start.x} ${start.y} A ${radius} ${radius} 0 1 1 ${end.x} ${end.y}`;
	});

	const exitD = $derived.by(() => {
		if (!exitTo) return null;
		// Stub from the circle perimeter (closest point to exitTo) toward exitTo.
		const dx = exitTo.x - at.x;
		const dy = exitTo.y - at.y;
		const len = Math.hypot(dx, dy) || 1;
		const onPerim = {
			x: at.x + (dx / len) * radius,
			y: at.y + (dy / len) * radius
		};
		return `M ${onPerim.x} ${onPerim.y} L ${exitTo.x} ${exitTo.y}`;
	});

	const isDelayed = $derived(status === 'delayed');
</script>

<g class="segment-roundabout" style="--stroke: {stroke}" data-status={status}>
	<path d={loopD} class="roundabout-loop" class:roundabout-delayed={isDelayed} />
	{#if exitD}
		<path d={exitD} class="roundabout-exit" />
	{/if}
</g>

<style>
	.roundabout-loop,
	.roundabout-exit {
		fill: none;
		stroke: var(--stroke);
		stroke-width: 4;
		stroke-linecap: round;
		stroke-linejoin: round;
		opacity: 0.9;
	}

	.roundabout-delayed {
		stroke-dasharray: 8 8;
		opacity: 0.65;
	}
</style>
