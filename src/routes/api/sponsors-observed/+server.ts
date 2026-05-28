/**
 * GET /api/sponsors-observed?indication=<id>
 *
 * Returns the slim sponsor-observation list for the indication — derived from
 * disease-insights/<slug>/clinical_trials/sponsors_observed.json. Used by the
 * workbench answer-text parser to detect sponsor mentions (e.g. "Fate
 * Therapeutics") and surface a sponsor drawer on click.
 *
 * The full sponsors_observed payload is heavy (NCT id arrays for every org);
 * this endpoint strips it down to what the matcher + drawer need: name,
 * classes, lead/collab/total counts, and the NCT id list. We keep NCT ids so
 * the drawer can deep-link to clinicaltrials.gov for each trial.
 *
 * Cache-Control: long-ish — sponsors_observed is regenerated only when the
 * clinicaltrials.gov pipeline runs. 5 min edge cache with SWR.
 */
import { json, error } from '@sveltejs/kit';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getDiseaseInsightManifestById } from '$lib/content/disease-insights';
import type { ObservedSponsor } from '$lib/types/observed-sponsor';
import type { RequestHandler } from './$types';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '../../../../..');

export type SponsorsObservedSlice = {
	indication: string;
	count: number;
	sponsors: ObservedSponsor[];
};

export const GET: RequestHandler = async ({ url }) => {
	const requested = url.searchParams.get('indication') ?? undefined;
	if (!requested) throw error(400, 'indication query param required');

	const manifest = getDiseaseInsightManifestById(requested);
	if (!manifest) throw error(404, `unknown indication: ${requested}`);

	const datasetRef = manifest.datasets.find((d) => d.type === 'clinical_trials_sponsors_observed');
	if (!datasetRef) {
		return json(
			{ indication: requested, count: 0, sponsors: [] } satisfies SponsorsObservedSlice,
			{ headers: { 'cache-control': 'public, max-age=300, stale-while-revalidate=900' } }
		);
	}

	const absPath = join(
		REPO_ROOT,
		'src/lib/content/disease-insights',
		manifest.slug,
		datasetRef.path
	);
	let raw: string;
	try {
		raw = readFileSync(absPath, 'utf8');
	} catch (e) {
		throw error(500, `failed to read sponsors_observed: ${(e as Error).message}`);
	}

	const parsed = JSON.parse(raw) as { sponsors?: unknown };
	const list = Array.isArray(parsed.sponsors) ? parsed.sponsors : [];
	const sponsors: ObservedSponsor[] = list
		.map((s): ObservedSponsor | null => {
			const o = s as Record<string, unknown>;
			if (typeof o.name !== 'string') return null;
			return {
				name: o.name,
				classes: Array.isArray(o.classes) ? (o.classes as string[]) : [],
				lead_count: typeof o.lead_count === 'number' ? o.lead_count : 0,
				collaborator_count: typeof o.collaborator_count === 'number' ? o.collaborator_count : 0,
				total_count: typeof o.total_count === 'number' ? o.total_count : 0,
				nct_ids: Array.isArray(o.nct_ids) ? (o.nct_ids as string[]) : []
			};
		})
		.filter((s): s is ObservedSponsor => s !== null)
		.sort((a, b) => b.total_count - a.total_count);

	const payload: SponsorsObservedSlice = {
		indication: requested,
		count: sponsors.length,
		sponsors
	};

	return json(payload, {
		headers: { 'cache-control': 'public, max-age=300, stale-while-revalidate=900' }
	});
};
