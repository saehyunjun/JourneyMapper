/**
 * /compare server load.
 *
 * V1 of the temporal-comparison view (feature_backlog.md → "Sentiment & volume
 * over time"). Aggregates forum-fragment annotations by (subtheme, year) for
 * the active indication and returns a small-multiples-ready payload.
 *
 * Scope of V1:
 *   - Forum corpora only (content_source ∈ social_post | social_comment) —
 *     interviews and other sources don't have year-spread to compare against.
 *   - Year buckets derived from date_observed.slice(0,4). Calendar year only,
 *     no custom windows.
 *   - Pivot dimension = subtheme. Theme/cluster/emotion pivots come later.
 *   - Labels humanized from snake_case ids until per-corpus codebooks land.
 *   - Tile gate: a subtheme tile is shown iff ≥2 years carry count ≥ min_n
 *     (default 5) so every tile renders a real comparison.
 */

import { getLexiconSlice } from '$lib/server/lexicon';
import { listCorpora } from '$lib/server/corpora';
import type { PageServerLoad } from './$types';
import type { Fragment } from '$lib/content/corpora/types';

export type CompareFragment = {
	id: string;
	corpus_id: string;
	text: string;
	date_observed: string;
	sentiment_score: number | null;
	author_handle_hash: string | null;
	content_source: 'social_post' | 'social_comment';
};

export type YearCell = {
	year: number;
	count: number;
	sentiment_mean: number | null;
	fragments: CompareFragment[];
};

export type CompareTile = {
	subtheme_id: string;
	label: string;
	total_count: number;
	per_year: YearCell[];
};

const FORUM_SOURCES = new Set(['social_post', 'social_comment']);
const DEFAULT_MIN_N = 5;
const MAX_TILES = 24;

function humanizeSubthemeId(id: string): string {
	if (!id) return id;
	const spaced = id.replace(/_/g, ' ').trim();
	return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function yearOf(iso: string | undefined | null): number | null {
	if (!iso || iso.length < 4) return null;
	const n = Number(iso.slice(0, 4));
	return Number.isFinite(n) ? n : null;
}

export const load: PageServerLoad = async ({ url }) => {
	const requestedIndication = url.searchParams.get('indication') ?? undefined;
	const minN = Math.max(1, Number(url.searchParams.get('min_n') ?? DEFAULT_MIN_N) || DEFAULT_MIN_N);

	const slice = await getLexiconSlice(requestedIndication);
	const activeIndication = slice.active_indication;
	const bundles = listCorpora();

	// Bucket: subtheme_id → year → { fragments, sentiments }
	const buckets = new Map<
		string,
		Map<number, { fragments: CompareFragment[]; sentiments: number[] }>
	>();
	const yearsSeen = new Set<number>();

	let totalFragmentsConsidered = 0;

	for (const bundle of bundles) {
		// Skip corpora that don't include this indication at the manifest level.
		if (!bundle.manifest.indications.includes(activeIndication as never)) continue;

		for (const frag of bundle.fragments as Fragment[]) {
			if (!FORUM_SOURCES.has(frag.content_source)) continue;
			if (!frag.indications.includes(activeIndication as never)) continue;
			const year = yearOf(frag.date_observed);
			if (year == null) continue;

			const ann = bundle.annotations[frag.id];
			const tag = ann?.segment_tags;
			if (!tag || !tag.subthemes || tag.subthemes.length === 0) continue;

			totalFragmentsConsidered++;
			yearsSeen.add(year);

			const handle =
				(frag.source_ref as { author_handle_hash?: string }).author_handle_hash ?? null;
			const compact: CompareFragment = {
				id: frag.id,
				corpus_id: frag.corpus_id,
				text: frag.text,
				date_observed: frag.date_observed,
				sentiment_score: typeof tag.sentiment_score === 'number' ? tag.sentiment_score : null,
				author_handle_hash: handle,
				content_source: frag.content_source as 'social_post' | 'social_comment'
			};

			for (const sub of tag.subthemes) {
				let perYear = buckets.get(sub);
				if (!perYear) {
					perYear = new Map();
					buckets.set(sub, perYear);
				}
				let cell = perYear.get(year);
				if (!cell) {
					cell = { fragments: [], sentiments: [] };
					perYear.set(year, cell);
				}
				cell.fragments.push(compact);
				if (compact.sentiment_score !== null) cell.sentiments.push(compact.sentiment_score);
			}
		}
	}

	const years = [...yearsSeen].sort((a, b) => a - b);

	const tiles: CompareTile[] = [];
	for (const [subtheme_id, perYear] of buckets) {
		const per_year: YearCell[] = years.map((y) => {
			const cell = perYear.get(y);
			if (!cell) return { year: y, count: 0, sentiment_mean: null, fragments: [] };
			const mean = cell.sentiments.length
				? cell.sentiments.reduce((a, b) => a + b, 0) / cell.sentiments.length
				: null;
			// Sort fragments newest-first inside the year so the drawer surfaces
			// the most recent voice from each period.
			const sorted = [...cell.fragments].sort((a, b) =>
				b.date_observed.localeCompare(a.date_observed)
			);
			return { year: y, count: cell.fragments.length, sentiment_mean: mean, fragments: sorted };
		});

		const total = per_year.reduce((sum, c) => sum + c.count, 0);
		const yearsMeetingGate = per_year.filter((c) => c.count >= minN).length;
		if (yearsMeetingGate < 2) continue; // need at least two periods to compare

		tiles.push({
			subtheme_id,
			label: humanizeSubthemeId(subtheme_id),
			total_count: total,
			per_year
		});
	}

	tiles.sort((a, b) => b.total_count - a.total_count);
	const trimmed = tiles.slice(0, MAX_TILES);

	return {
		active_indication: activeIndication,
		indications: slice.indications,
		therapeutic_areas: slice.therapeutic_areas,
		years,
		tiles: trimmed,
		min_n: minN,
		total_fragments_considered: totalFragmentsConsidered,
		total_tile_candidates: tiles.length
	};
};
