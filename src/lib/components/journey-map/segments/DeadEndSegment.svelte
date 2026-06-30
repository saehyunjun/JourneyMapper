<!--
	DeadEndSegment — a short stub leaving `from` in `angle` direction, ending in
	a small terminus glyph (a cross-rule and an X) to communicate "route stops
	here." Used for dropoffs / declined trial / treatment failure with no
	downstream re-entry.
-->
<script lang="ts">
	import type { Point, StageStatus } from './types';

	type Props = {
		from: Point;
		length?: number;
		angle?: number;
		stroke: string;
		status?: StageStatus;
	};

	let {
		from,
		length = 90,
		angle = 0,
		stroke,
		status = 'dead_end'
	}: Props = $props();

	const terminus = $derived.by(() => {
		const rad = (angle * Math.PI) / 180;
		return { x: from.x + Math.cos(rad) * length, y: from.y + Math.sin(rad) * length };
	});

	// Cross-rule perpendicular to the stub direction.
	const crossRule = $derived.by(() => {
		const rad = ((angle + 90) * Math.PI) / 180;
		const r = 14;
		const a = { x: terminus.x + Math.cos(rad) * r, y: terminus.y + Math.sin(rad) * r };
		const b = { x: terminus.x - Math.cos(rad) * r, y: terminus.y - Math.sin(rad) * r };
		return `M ${a.x} ${a.y} L ${b.x} ${b.y}`;
	});

	const stubD = $derived(`M ${from.x} ${from.y} L ${terminus.x} ${terminus.y}`);
</script>

<g class="segment-dead-end" style="--stroke: {stroke}" data-status={status}>
	<path d={stubD} class="dead-end-stub" />
	<path d={crossRule} class="dead-end-cross" />
	<circle cx={terminus.x} cy={terminus.y} r="3" class="dead-end-cap" />
</g>

<style>
	.dead-end-stub,
	.dead-end-cross {
		fill: none;
		stroke: var(--stroke);
		stroke-width: 4;
		stroke-linecap: round;
		stroke-linejoin: round;
		opacity: 0.85;
	}

	.dead-end-cross {
		stroke-width: 3.5;
	}

	.dead-end-cap {
		fill: var(--stroke);
		opacity: 0.85;
	}
</style>
