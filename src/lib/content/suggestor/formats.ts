/**
 * Format scoring — Phase A3a of the content suggestor.
 *
 * Given a chosen content strategy plus the audience's current journey
 * stages, rank the content-format archetypes in `content_formats.json` by
 * how well they fit. Two-step model:
 *
 *   1. Filter to formats that name this strategy in `best_for_strategies`.
 *   2. Sort by overlap between `best_for_stages` and the input stages.
 *      Ties broken by lower production complexity first (cheaper to ship).
 *
 * A format with zero stage overlap still surfaces — it's a fit for the
 * strategy on principle, just not for this specific journey moment.
 */

import contentFormatsJson from '../registries/content_formats.json';
import type {
	ContentFormat,
	ContentStrategyId,
	LnJourneyStageId
} from '../registries/types';

type RegistryFile<T> = { items: T[] };

export const contentFormats: ContentFormat[] = (
	contentFormatsJson as RegistryFile<ContentFormat>
).items;

export type FormatRankInput = {
	strategyId: ContentStrategyId;
	stages: LnJourneyStageId[];
};

export type FormatScore = {
	format: ContentFormat;
	/** Number of input stages that appear in `best_for_stages`. */
	stage_matches: number;
	/** Input stages that matched (echoed for the UI). */
	matched_stages: LnJourneyStageId[];
	/** `stage_matches / stages.length`. Zero when no stages supplied. */
	stage_coverage: number;
};

const COMPLEXITY_RANK = { low: 0, medium: 1, high: 2 } as const;

export function rankFormatsForStrategy(input: FormatRankInput): FormatScore[] {
	return rankFormatsForStrategyFrom(input, contentFormats);
}

export function rankFormatsForStrategyFrom(
	input: FormatRankInput,
	formats: readonly ContentFormat[]
): FormatScore[] {
	const stageSet = new Set<string>(input.stages);
	const denom = stageSet.size;

	const fits = formats.filter((f) => f.best_for_strategies.includes(input.strategyId));

	return fits
		.map((format): FormatScore => {
			const matched_stages = format.best_for_stages.filter((s) => stageSet.has(s));
			return {
				format,
				stage_matches: matched_stages.length,
				matched_stages,
				stage_coverage: denom === 0 ? 0 : matched_stages.length / denom
			};
		})
		.sort((a, b) => {
			if (b.stage_matches !== a.stage_matches) return b.stage_matches - a.stage_matches;
			const ca = COMPLEXITY_RANK[a.format.production_complexity];
			const cb = COMPLEXITY_RANK[b.format.production_complexity];
			return ca - cb;
		});
}
