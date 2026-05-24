/**
 * GET /api/analytics/search-trends?indication=<id>&limit=<n>
 *
 * Returns top search-query topics for an indication, ranked by estimated
 * search volume desc. Reads from the libSQL content_items table (populated
 * by scripts/ingest-search-queries.mjs).
 *
 * Unlike the read paths in /api/lexicon, this endpoint does NOT fall back
 * to bundled JSON when the DB is unreachable — analytics surfaces should
 * fail loudly so consumers know the data is missing rather than silently
 * showing nothing or stale baselines. Set DATABASE_URL + run db:push +
 * db:seed + db:ingest:search-queries to activate.
 *
 * Response shape:
 *   {
 *     indication_id: string,
 *     limit: number,
 *     count: number,
 *     total_volume: number | null,
 *     queries: SearchTrend[]
 *   }
 *
 * Cache-Control: short. The ingested data is point-in-time; freshness
 * matters more than cache hits. 60s edge cache with stale-while-revalidate
 * if you re-add it later.
 */
import { json, error } from '@sveltejs/kit';
import { searchTrendsFromDb } from '$lib/server/db/queries';
import { getIndication } from '$lib/server/registries';
import type { RequestHandler } from './$types';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 500;

export const GET: RequestHandler = async ({ url }) => {
	const indicationId = url.searchParams.get('indication');
	if (!indicationId) {
		throw error(400, '`indication` query param is required (e.g. ?indication=lupus_nephritis)');
	}
	if (!getIndication(indicationId)) {
		throw error(404, `unknown indication "${indicationId}"`);
	}

	const limitParam = url.searchParams.get('limit');
	let limit = DEFAULT_LIMIT;
	if (limitParam) {
		const n = Number.parseInt(limitParam, 10);
		if (!Number.isFinite(n) || n <= 0) throw error(400, '`limit` must be a positive integer');
		limit = Math.min(n, MAX_LIMIT);
	}

	try {
		const queries = await searchTrendsFromDb(indicationId, limit);
		const total_volume = queries.reduce((acc, q) => acc + (q.volume ?? 0), 0);
		return json(
			{
				indication_id: indicationId,
				limit,
				count: queries.length,
				total_volume: queries.length > 0 ? total_volume : null,
				queries
			},
			{
				headers: {
					'cache-control': 'private, max-age=0, must-revalidate'
				}
			}
		);
	} catch (e) {
		const message = e instanceof Error ? e.message : String(e);
		throw error(
			503,
			`search-trends DB query failed (${message}). Run db:push + db:seed + db:ingest:search-queries, or set DATABASE_URL.`
		);
	}
};
