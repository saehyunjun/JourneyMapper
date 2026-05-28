/**
 * burden-distribution.ts
 *
 * Rolls up the precomputed cluster occurrence counts in keyword_usage.json to
 * the top-level burden taxonomy in registries/burden_categories.json, via each
 * cluster's burden_category_ids[] in keyword_lexicon.json.
 *
 * One cluster may carry multiple burden ids (e.g. steroid_side_effects is both
 * physical_side_effects and physical_appearance) — when both leaves roll up to
 * the same top-level, the cluster contributes its count once. When they roll up
 * to different top-levels, the cluster contributes to each. Shares are
 * computed as count / total_mentions, so they may sum to more than 100% across
 * top-level categories (caveat surfaced on the slide).
 *
 * Returns top-level categories with non-zero counts, sorted by count desc.
 * Empty array when no classified clusters have any mentions for the requested
 * indication scope — the assembler uses this as the signal to skip the slide.
 */
import keywordUsage from './keyword_usage.json';
import keywordLexicon from './keyword_lexicon.json';
import burdenRegistry from '$lib/content/registries/burden_categories.json';
import type { BurdenSlice } from '$lib/story/types';

type UsageCluster = { id: string; count: number };
type UsageFile = { totals: { mentions: number }; clusters: UsageCluster[] };

type LexCluster = {
	id: string;
	indications?: string[];
	burden_category_ids?: string[];
};
type LexFile = { clusters: LexCluster[] };

type BurdenItem = { id: string; label: string; parent_id: string | null };
type BurdenFile = { items: BurdenItem[] };

const usage = keywordUsage as UsageFile;
const lexicon = keywordLexicon as LexFile;
const burdens = burdenRegistry as BurdenFile;

const burdenById = new Map<string, BurdenItem>(burdens.items.map((b) => [b.id, b]));
const lexById = new Map<string, LexCluster>(lexicon.clusters.map((c) => [c.id, c]));

/** Walk parent_id chain to find the top-level burden ancestor for any leaf id. */
function topLevelOf(burdenId: string): BurdenItem | null {
	let node = burdenById.get(burdenId);
	if (!node) return null;
	while (node.parent_id) {
		const next = burdenById.get(node.parent_id);
		if (!next) break;
		node = next;
	}
	return node;
}

/** True when the cluster is in scope for the requested indication. Empty
 *  cluster.indications[] = cross-cutting (always in scope). */
function clusterInScope(cluster: LexCluster, indicationId?: string): boolean {
	if (!indicationId) return true;
	const inds = cluster.indications ?? [];
	if (!inds.length) return true;
	return inds.includes(indicationId);
}

export type BurdenDistribution = {
	slices: BurdenSlice[];
	totalMentions: number;
};

export function computeBurdenDistribution(indicationId?: string): BurdenDistribution {
	// Tally per top-level burden id. Per cluster: collect the set of top-level
	// ancestors its burden_category_ids resolve to, then add the cluster's
	// count once per top-level (dedup within a cluster).
	const tally = new Map<string, number>();
	let totalMentions = 0;

	for (const u of usage.clusters) {
		if (!u.count) continue;
		const cluster = lexById.get(u.id);
		if (!cluster) continue;
		if (!clusterInScope(cluster, indicationId)) continue;
		const ids = cluster.burden_category_ids ?? [];
		if (!ids.length) {
			// Cluster contributes to corpus mentions but not to any burden bucket.
			totalMentions += u.count;
			continue;
		}
		const tops = new Set<string>();
		for (const id of ids) {
			const top = topLevelOf(id);
			if (top) tops.add(top.id);
		}
		totalMentions += u.count;
		for (const topId of tops) {
			tally.set(topId, (tally.get(topId) ?? 0) + u.count);
		}
	}

	const slices: BurdenSlice[] = [...tally.entries()]
		.map(([id, count]) => {
			const item = burdenById.get(id);
			return {
				id,
				label: item?.label ?? id,
				count,
				share: totalMentions > 0 ? count / totalMentions : 0
			};
		})
		.sort((a, b) => b.count - a.count);

	return { slices, totalMentions };
}
