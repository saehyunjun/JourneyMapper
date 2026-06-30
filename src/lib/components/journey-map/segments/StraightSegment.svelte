<!--
	StraightSegment — a straight or gently-curved path between two anchor points.

	`curvature` bends the line perpendicular to its direction. 0 = straight
	(quadratic-Bezier collapsed to line), positive = bulges to the right of the
	from→to vector, negative = bulges left. ±1 ≈ a 30% chord offset.

	Rendered as a <path> with a single d-string; stateless.
-->
<script lang="ts">
	import type { Point, StageStatus } from './types';

	type Props = {
		from: Point;
		to: Point;
		curvature?: number;
		stroke: string;
		status?: StageStatus;
	};

	let { from, to, curvature = 0, stroke, status = 'completed' }: Props = $props();

	const d = $derived.by(() => {
		const dx = to.x - from.x;
		const dy = to.y - from.y;
		if (Math.abs(curvature) < 0.001) {
			return `M ${from.x} ${from.y} L ${to.x} ${to.y}`;
		}
		// Midpoint, offset perpendicular to the direction vector.
		const mx = (from.x + to.x) / 2;
		const my = (from.y + to.y) / 2;
		const len = Math.hypot(dx, dy) || 1;
		const nx = -dy / len;
		const ny = dx / len;
		const off = curvature * len * 0.3;
		const cx = mx + nx * off;
		const cy = my + ny * off;
		return `M ${from.x} ${from.y} Q ${cx} ${cy} ${to.x} ${to.y}`;
	});

	const isDelayed = $derived(status === 'delayed');
</script>

<path
	{d}
	class="segment segment-straight"
	class:segment-delayed={isDelayed}
	style="--stroke: {stroke}"
/>

<style>
	.segment {
		fill: none;
		stroke: var(--stroke);
		stroke-width: 4;
		stroke-linecap: round;
		stroke-linejoin: round;
		opacity: 0.9;
	}

	.segment-delayed {
		stroke-dasharray: 8 8;
		opacity: 0.65;
	}
</style>
