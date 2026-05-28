/**
 * Content-suggestor rules layer.
 *
 * Top-level rank: given a journey + burden + subtheme snapshot of the
 * audience, score each content-strategy archetype by how well it covers
 * the caller's signals. This is the deterministic floor under the LLM
 * proposer — the proposer gets to re-rank and synthesize, but it works
 * from this set, not the raw registries.
 *
 * Coverage model (per dimension):
 *   coverage = |input ∩ strategy| / |input|
 *
 * Reads as "of the things the caller cares about, how many does this
 * strategy address". A focused 5-burden strategy that matches all 5
 * caller burdens scores 1.0, same as a 20-burden strategy that matches
 * the same 5 — strategy breadth doesn't penalize fit.
 *
 * Final score is a weighted mean of the per-dimension coverages. A
 * dimension is skipped (weight zeroed) when either side has no entries,
 * so empty-input or empty-strategy dimensions don't pollute the mean.
 *
 * Outputs always include all strategies sorted by descending score;
 * callers cut where they want.
 */

import contentStrategiesJson from '../registries/content_strategies.json';
import type {
	BurdenCategoryId,
	ContentStrategy,
	ContentStrategyId,
	IndicationId,
	LnJourneyStageId
} from '../registries/types';

type RegistryFile<T> = { schema_version: string; status?: string; description?: string; items: T[] };

export const contentStrategies: ContentStrategy[] = (
	contentStrategiesJson as RegistryFile<ContentStrategy>
).items;

/** Audience snapshot used to rank content strategies. All three signal
 *  arrays are coverage hints — "what the audience cares about right now".
 *  An empty array skips that dimension (no signal either way) rather than
 *  zeroing it. */
export type StrategyRankInput = {
	indication: IndicationId;
	/** Journey stage(s) the audience is currently in. One for a focused
	 *  query, several for a broader "maintenance + flare" window. */
	stages: LnJourneyStageId[];
	/** Burden categories observed in the underlying corpus / persona. */
	burdens: BurdenCategoryId[];
	/** Codebook subtheme ids observed. Typed as string because the subtheme
	 *  union lives in the codebook, not the registries. */
	subthemes: string[];
};

/** Per-dimension scoring breakdown. `weight` is the effective contribution
 *  in the final weighted mean — 0 when the dimension is skipped (either
 *  side empty). */
export type StrategyScoreComponent = {
	matched: string[];
	input_count: number;
	strategy_count: number;
	/** matched.length / max(input_count, 1). Range [0, 1]. */
	coverage: number;
	weight: number;
};

export type StrategyScore = {
	strategy_id: ContentStrategyId;
	strategy: ContentStrategy;
	/** Weighted mean of per-dimension coverages, range [0, 1]. */
	score: number;
	components: {
		stages: StrategyScoreComponent;
		burdens: StrategyScoreComponent;
		subthemes: StrategyScoreComponent;
	};
};

const DEFAULT_WEIGHTS = {
	stages: 1.0,
	burdens: 1.0,
	subthemes: 0.7
} as const;

export type StrategyRankWeights = typeof DEFAULT_WEIGHTS;

export type StrategyRankOptions = {
	/** Per-dimension weights for the weighted mean. Default is stages:1.0 /
	 *  burdens:1.0 / subthemes:0.7 — subthemes carry topical noise the other
	 *  two dimensions don't, so they're discounted slightly out of the box. */
	weights?: Partial<StrategyRankWeights>;
};

/** Rank every strategy in the registry against the input. Returns all
 *  strategies sorted by descending score; the caller decides the cut. */
export function rankStrategies(
	input: StrategyRankInput,
	options: StrategyRankOptions = {}
): StrategyScore[] {
	return rankStrategiesFrom(input, contentStrategies, options);
}

/** Pure variant accepting an explicit strategy list. Useful for tests or
 *  callers that pre-filter the registry (e.g. by indication scope). */
export function rankStrategiesFrom(
	input: StrategyRankInput,
	strategies: readonly ContentStrategy[],
	options: StrategyRankOptions = {}
): StrategyScore[] {
	const weights = { ...DEFAULT_WEIGHTS, ...(options.weights ?? {}) };
	const stageSet = new Set<string>(input.stages);
	const burdenSet = new Set<string>(input.burdens);
	const subthemeSet = new Set<string>(input.subthemes);

	return strategies
		.map((strategy): StrategyScore => {
			const stages = scoreDimension(stageSet, strategy.fits_journey_stages, weights.stages);
			const burdens = scoreDimension(
				burdenSet,
				strategy.addresses_burden_categories,
				weights.burdens
			);
			const subthemes = scoreDimension(
				subthemeSet,
				strategy.addresses_subthemes,
				weights.subthemes
			);
			return {
				strategy_id: strategy.id,
				strategy,
				score: weightedMean([stages, burdens, subthemes]),
				components: { stages, burdens, subthemes }
			};
		})
		.sort((a, b) => b.score - a.score);
}

function scoreDimension(
	inputSet: Set<string>,
	strategyArray: readonly string[],
	weight: number
): StrategyScoreComponent {
	const matched: string[] = [];
	for (const item of strategyArray) {
		if (inputSet.has(item)) matched.push(item);
	}
	const input_count = inputSet.size;
	const strategy_count = strategyArray.length;
	const coverage = input_count === 0 ? 0 : matched.length / input_count;
	const effectiveWeight = input_count === 0 || strategy_count === 0 ? 0 : weight;
	return { matched, input_count, strategy_count, coverage, weight: effectiveWeight };
}

function weightedMean(components: readonly StrategyScoreComponent[]): number {
	let num = 0;
	let den = 0;
	for (const c of components) {
		num += c.coverage * c.weight;
		den += c.weight;
	}
	return den === 0 ? 0 : num / den;
}
