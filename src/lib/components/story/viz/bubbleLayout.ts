/**
 * Deterministic bubble pack inside a circular stage.
 *
 * Given a set of bubbles with raw values, sizes them so AREA scales with
 * value (sqrt of value → radius) and resolves overlap with a fixed-iteration
 * d3-force run. Initial positions follow a golden-angle spiral so the output
 * is stable for identical input — same data, same layout, no random jitter
 * between renders.
 */
import { forceSimulation, forceCollide, forceCenter } from 'd3-force';
import type { BubbleSpec } from '$lib/story/types';

export type LaidOutBubble = BubbleSpec & {
	x: number;
	y: number;
	r: number;
};

export type BubbleLayoutConfig = {
	/** Radius of the circular stage the bubbles live inside. */
	stageRadius: number;
	/** Min gap between adjacent bubbles and between bubbles and stage edge. */
	padding: number;
	/** Smallest bubble radius as a fraction of stage radius. */
	minRadiusRatio: number;
	/** Largest bubble radius as a fraction of stage radius. */
	maxRadiusRatio: number;
	/** Force-simulation iterations. Higher = more settled, deterministic still. */
	iterations: number;
};

export const DEFAULT_BUBBLE_LAYOUT: BubbleLayoutConfig = {
	stageRadius: 100,
	padding: 4,
	minRadiusRatio: 0.18,
	maxRadiusRatio: 0.46,
	iterations: 220
};

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

export function layoutBubbles(
	bubbles: BubbleSpec[],
	overrides: Partial<BubbleLayoutConfig> = {}
): LaidOutBubble[] {
	if (bubbles.length === 0) return [];
	const cfg = { ...DEFAULT_BUBBLE_LAYOUT, ...overrides };

	const maxValue = Math.max(...bubbles.map((b) => Math.max(0, b.value)));
	const maxR = cfg.stageRadius * cfg.maxRadiusRatio;
	const minR = cfg.stageRadius * cfg.minRadiusRatio;

	const sized: LaidOutBubble[] = bubbles.map((b, i) => {
		const ratio = maxValue > 0 ? Math.max(0, b.value) / maxValue : 0;
		const r = Math.max(minR, maxR * Math.sqrt(ratio));
		// Golden-angle spiral seed — primary (largest) at center, others orbit
		// outward in a stable order so layout is repeatable for the same input.
		const seedDist = i === 0 ? 0 : cfg.stageRadius * 0.35;
		const angle = i * GOLDEN_ANGLE;
		return {
			...b,
			r,
			x: cfg.stageRadius + Math.cos(angle) * seedDist,
			y: cfg.stageRadius + Math.sin(angle) * seedDist
		};
	});

	// Pin nodes back inside the stage circle after each tick.
	const boundary = () => {
		for (const node of sized) {
			const dx = node.x - cfg.stageRadius;
			const dy = node.y - cfg.stageRadius;
			const dist = Math.sqrt(dx * dx + dy * dy);
			const maxDist = Math.max(0, cfg.stageRadius - node.r - cfg.padding);
			if (dist > maxDist && dist > 0) {
				node.x = cfg.stageRadius + (dx / dist) * maxDist;
				node.y = cfg.stageRadius + (dy / dist) * maxDist;
			}
		}
	};

	const sim = forceSimulation<LaidOutBubble>(sized)
		.force('collide', forceCollide<LaidOutBubble>((d) => d.r + cfg.padding).iterations(2))
		.force('center', forceCenter(cfg.stageRadius, cfg.stageRadius).strength(0.04))
		.force('boundary', boundary)
		.stop();

	for (let i = 0; i < cfg.iterations; i++) sim.tick();

	return sized;
}
