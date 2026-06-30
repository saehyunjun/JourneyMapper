<!--
	ForkSegment — one source anchor branching into N destinations.

	Visual: a short "stem" leaves `from`, then splits into a small junction
	bulb, then individual curves arc out to each branch terminus. Each branch
	gets the same stroke so the fan reads as one decision.

	Used for decision points. The compositor decides which branch (if any) is
	the "chosen" one and may render unchosen branches with a faded stroke by
	passing different status values on followup segments.
-->
<script lang="ts">
	import type { Point, StageStatus } from './types';

	type Props = {
		from: Point;
		to: Point[];
		stroke: string;
		status?: StageStatus;
	};

	let { from, to, stroke, status = 'decision' }: Props = $props();

	// Junction sits a short way along the average direction to all branches.
	const junction = $derived.by(() => {
		if (to.length === 0) return from;
		const avg = to.reduce(
			(acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }),
			{ x: 0, y: 0 }
		);
		const cx = avg.x / to.length;
		const cy = avg.y / to.length;
		const dx = cx - from.x;
		const dy = cy - from.y;
		const len = Math.hypot(dx, dy) || 1;
		// Junction is ~22% of the way toward the centroid, capped at 90 units.
		const reach = Math.min(len * 0.22, 90);
		return { x: from.x + (dx / len) * reach, y: from.y + (dy / len) * reach };
	});

	function branchD(target: Point): string {
		// Cubic Bezier from junction to branch terminus, with control points
		// pulled along the from→junction direction so the fan looks intentional.
		const dx = target.x - junction.x;
		const dy = target.y - junction.y;
		const c1x = junction.x + dx * 0.45;
		const c1y = junction.y + dy * 0.05;
		const c2x = junction.x + dx * 0.55;
		const c2y = junction.y + dy * 0.95;
		return `M ${junction.x} ${junction.y} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${target.x} ${target.y}`;
	}

	const stemD = $derived(`M ${from.x} ${from.y} L ${junction.x} ${junction.y}`);
</script>

<g class="segment-fork" style="--stroke: {stroke}" data-status={status}>
	<path d={stemD} class="fork-stem" />
	{#each to as branch, i (i)}
		<path d={branchD(branch)} class="fork-branch" />
	{/each}
	<circle cx={junction.x} cy={junction.y} r="6" class="fork-junction" />
</g>

<style>
	.fork-stem,
	.fork-branch {
		fill: none;
		stroke: var(--stroke);
		stroke-width: 4;
		stroke-linecap: round;
		stroke-linejoin: round;
		opacity: 0.9;
	}

	.fork-branch {
		stroke-width: 3;
		opacity: 0.75;
	}

	.fork-junction {
		fill: #fafaf7;
		stroke: var(--stroke);
		stroke-width: 2.5;
	}
</style>
