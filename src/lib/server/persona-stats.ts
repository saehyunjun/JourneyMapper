/**
 * server/persona-stats.ts
 *
 * Compute the bento-shaped statistics for a (corpus, PersonaFilter) pair.
 * Mirrors the shape `SuggestionView` carries on the personas page so the
 * same UI can render both suggested clusters and saved personas without
 * branching.
 *
 * Uses the same `matchesFilter` the deriver / match-filter endpoint use, so
 * "what's in this persona?" is exact, not an approximation. Shares are
 * fragment-level prevalence (share = N_fragments_with_tag / N_matched), so
 * they sum to ≤ 1.0 across distinct tags. Suggester shares are mean per-
 * author share and CAN exceed 1.0 — that's the only behavioural difference
 * between this and the suggester.
 */

import { matchesFilter } from '$lib/content/personas/derive.mjs';
import type { PersonaFilter } from '$lib/content/personas/types';
import type { CorpusBundle, FragmentAnnotation } from '$lib/server/corpora';

const EVIDENCE_LIMIT = 6;
const EVIDENCE_TEXT_CHARS = 480;

export type ShareEntry = { id: string; share: number };

export type EvidenceFragment = {
	id: string;
	author_handle_hash: string | null;
	text: string;
};

export type PersonaStats = {
	matched_fragments: number;
	matched_authors: number;
	annotated_matches: number;
	top_themes: ShareEntry[];
	top_subthemes: ShareEntry[];
	top_stages: ShareEntry[];
	top_steps: ShareEntry[];
	top_emotions: ShareEntry[];
	sentiment: { mean: number; std: number | null } | null;
	evidence: EvidenceFragment[];
};

function topShares(counts: Map<string, number>, total: number, limit = 10): ShareEntry[] {
	if (total === 0) return [];
	return [...counts.entries()]
		.map(([id, n]) => ({ id, share: n / total }))
		.sort((a, b) => b.share - a.share)
		.slice(0, limit);
}

/** Score a fragment for evidence-card use: dense annotation, longer text,
 *  and one-per-author cap. Returns an ordered list of fragment ids, capped
 *  at EVIDENCE_LIMIT. */
function pickEvidence(
	matchedIds: string[],
	corpus: CorpusBundle
): EvidenceFragment[] {
	const fragmentById = new Map(corpus.fragments.map((f) => [f.id, f] as const));
	type Scored = { id: string; author: string | null; text: string; score: number };
	const scored: Scored[] = matchedIds
		.map((id): Scored | null => {
			const f = fragmentById.get(id);
			if (!f) return null;
			const ann = corpus.annotations[id];
			const tagDensity =
				(ann?.segment_tags?.subthemes?.length ?? 0) +
				(ann?.segment_tags?.emotions?.length ?? 0) +
				(ann?.stages?.values?.length ?? 0);
			const len = f.text?.length ?? 0;
			// Favor annotated + meaty fragments; very short fragments get penalized.
			const score = Math.log(1 + tagDensity) * Math.min(1, len / 160);
			return {
				id,
				author: (f.source_ref as { author_handle_hash?: string }).author_handle_hash ?? null,
				text: f.text ?? '',
				score
			};
		})
		.filter((x): x is Scored => x !== null && x.text.length > 0);

	scored.sort((a, b) => b.score - a.score);
	const seenAuthors = new Set<string>();
	const out: EvidenceFragment[] = [];
	for (const s of scored) {
		if (s.author && seenAuthors.has(s.author)) continue;
		if (s.author) seenAuthors.add(s.author);
		out.push({
			id: s.id,
			author_handle_hash: s.author,
			text:
				s.text.length > EVIDENCE_TEXT_CHARS ? s.text.slice(0, EVIDENCE_TEXT_CHARS) + '…' : s.text
		});
		if (out.length >= EVIDENCE_LIMIT) break;
	}
	return out;
}

export function computePersonaStats(corpus: CorpusBundle, filter: PersonaFilter): PersonaStats {
	const themeCounts = new Map<string, number>();
	const subthemeCounts = new Map<string, number>();
	const stageCounts = new Map<string, number>();
	const stepCounts = new Map<string, number>();
	const emotionCounts = new Map<string, number>();
	const matchedAuthors = new Set<string>();
	const matchedIds: string[] = [];
	let annotatedMatches = 0;
	let sentSum = 0;
	let sentCount = 0;
	let sentSumSq = 0;

	for (const f of corpus.fragments) {
		if (!matchesFilter(f, filter, corpus.annotations)) continue;
		matchedIds.push(f.id);
		const h = (f.source_ref as { author_handle_hash?: string }).author_handle_hash;
		if (h) matchedAuthors.add(h);

		const ann: FragmentAnnotation | undefined = corpus.annotations[f.id];
		if (!ann) continue;
		annotatedMatches += 1;

		const seenThemes = new Set<string>();
		for (const t of ann.segment_tags?.themes ?? []) seenThemes.add(t);
		for (const t of seenThemes) themeCounts.set(t, (themeCounts.get(t) ?? 0) + 1);

		const seenSub = new Set<string>();
		for (const s of ann.segment_tags?.subthemes ?? []) seenSub.add(s);
		for (const s of seenSub) subthemeCounts.set(s, (subthemeCounts.get(s) ?? 0) + 1);

		const seenEm = new Set<string>();
		for (const e of ann.segment_tags?.emotions ?? []) seenEm.add(e);
		for (const e of seenEm) emotionCounts.set(e, (emotionCounts.get(e) ?? 0) + 1);

		const seenStages = new Set<string>();
		const seenSteps = new Set<string>();
		for (const sv of ann.stages?.values ?? []) {
			if (sv.stage_id) seenStages.add(sv.stage_id);
			if (sv.step_id) seenSteps.add(sv.step_id);
		}
		for (const s of seenStages) stageCounts.set(s, (stageCounts.get(s) ?? 0) + 1);
		for (const s of seenSteps) stepCounts.set(s, (stepCounts.get(s) ?? 0) + 1);

		const score = ann.segment_tags?.sentiment_score;
		if (typeof score === 'number') {
			sentSum += score;
			sentSumSq += score * score;
			sentCount += 1;
		}
	}

	const sentiment =
		sentCount > 0
			? {
					mean: Number((sentSum / sentCount).toFixed(3)),
					std:
						sentCount > 1
							? Number(
									Math.sqrt(Math.max(0, sentSumSq / sentCount - (sentSum / sentCount) ** 2)).toFixed(3)
								)
							: null
				}
			: null;

	return {
		matched_fragments: matchedIds.length,
		matched_authors: matchedAuthors.size,
		annotated_matches: annotatedMatches,
		// Denominator is annotated matches: a tag's share is "among fragments
		// we COULD have tagged, how many actually carried this tag." Unannotated
		// matches wouldn't contribute to any tag count anyway.
		top_themes: topShares(themeCounts, annotatedMatches),
		top_subthemes: topShares(subthemeCounts, annotatedMatches),
		top_stages: topShares(stageCounts, annotatedMatches),
		top_steps: topShares(stepCounts, annotatedMatches),
		top_emotions: topShares(emotionCounts, annotatedMatches),
		sentiment,
		evidence: pickEvidence(matchedIds, corpus)
	};
}
