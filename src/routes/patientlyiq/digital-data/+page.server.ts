/**
 * Digital data explorer — server loader.
 *
 * Reads the active indication from the parent layout slice (set by the
 * `?indication=` query) and assembles, for that one indication, the
 * manifest plus the full payload of every dataset it declares. Two
 * special cases:
 *
 *   - `clinical_trials_raw` payloads are NOT bundled (the envelope can be
 *     ~100 MB per indication). Instead, the loader reads just the head bytes
 *     of `raw_studies.json` off disk to extract `deduped_count` + `fetched_at`,
 *     and pairs that with the sibling normalized file's filtered count so the
 *     card can show "X historical / Y active+recent".
 *   - Everything else is served from the bundled glob in
 *     `$lib/content/disease-insights/datasets.ts`.
 */
import { open } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
	getDiseaseInsightManifestById,
	type DiseaseDatasetRef,
	type DiseaseInsightManifest
} from '$lib/content/disease-insights';
import { getDatasetPayload } from '$lib/content/disease-insights/datasets';
import type { PageServerLoad } from './$types';

export type ResolvedDataset = {
	ref: DiseaseDatasetRef;
	/** Parsed JSON payload, or null if the file isn't bundled (e.g. raw CT.gov). */
	payload: unknown | null;
};

export type DigitalDataPayload = {
	manifest: DiseaseInsightManifest | null;
	datasets: ResolvedDataset[];
};

export type RawStudiesSummary = {
	deduped_count: number | null;
	fetched_at: string | null;
	/** Count after the normalize-step activity filter, if a sibling normalized file is present. */
	filtered_count: number | null;
	filter_rule: string | null;
	filter_cutoff: string | null;
};

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONTENT_ROOT = resolve(__dirname, '../../../lib/content/disease-insights');

const rawSummaryCache = new Map<string, RawStudiesSummary>();

/**
 * Read just the head of `raw_studies.json` (4 KB is plenty — the scalar envelope
 * fields are written before the `studies[]` array). Regex-extract the two scalars
 * we care about. Avoids parsing the full multi-megabyte body.
 */
async function readRawHeadSummary(
	absPath: string
): Promise<Pick<RawStudiesSummary, 'deduped_count' | 'fetched_at'>> {
	const handle = await open(absPath, 'r');
	try {
		const buf = Buffer.alloc(4096);
		const { bytesRead } = await handle.read(buf, 0, buf.length, 0);
		const head = buf.toString('utf8', 0, bytesRead);
		const fetched_at = head.match(/"fetched_at"\s*:\s*"([^"]+)"/)?.[1] ?? null;
		const dedupedMatch = head.match(/"deduped_count"\s*:\s*(\d+)/);
		return {
			deduped_count: dedupedMatch ? Number(dedupedMatch[1]) : null,
			fetched_at
		};
	} finally {
		await handle.close();
	}
}

/** Pull the filter metadata + filtered count out of the bundled normalized payload, if present. */
function extractFilteredCount(
	manifest: DiseaseInsightManifest
): Pick<RawStudiesSummary, 'filtered_count' | 'filter_rule' | 'filter_cutoff'> {
	const normalizedRef = manifest.datasets.find((d) => d.type === 'clinical_trials_normalized');
	if (!normalizedRef) return { filtered_count: null, filter_rule: null, filter_cutoff: null };
	const payload = getDatasetPayload(manifest.slug, normalizedRef.path) as
		| {
				count?: number;
				activity_filter?: { kept?: number; rule?: string; recent_cutoff?: string } | null;
		  }
		| undefined;
	if (!payload) return { filtered_count: null, filter_rule: null, filter_cutoff: null };
	const af = payload.activity_filter ?? null;
	return {
		filtered_count: typeof af?.kept === 'number' ? af.kept : (payload.count ?? null),
		filter_rule: af?.rule ?? null,
		filter_cutoff: af?.recent_cutoff ?? null
	};
}

async function loadRawSummary(
	manifest: DiseaseInsightManifest,
	ref: DiseaseDatasetRef
): Promise<RawStudiesSummary | null> {
	const absPath = resolve(CONTENT_ROOT, manifest.slug, ref.path);
	const cacheKey = absPath;
	if (!rawSummaryCache.has(cacheKey)) {
		try {
			const head = await readRawHeadSummary(absPath);
			rawSummaryCache.set(cacheKey, {
				...head,
				filtered_count: null,
				filter_rule: null,
				filter_cutoff: null
			});
		} catch {
			return null;
		}
	}
	const cached = rawSummaryCache.get(cacheKey)!;
	// Filtered count is cheap to recompute and reflects the (possibly re-run) normalized file.
	return { ...cached, ...extractFilteredCount(manifest) };
}

export const load: PageServerLoad = async ({ parent }) => {
	const { slice } = await parent();
	const manifest = getDiseaseInsightManifestById(slice.active_indication) ?? null;

	const datasets: ResolvedDataset[] = manifest
		? await Promise.all(
				manifest.datasets.map(async (ref) => {
					const bundled = getDatasetPayload(manifest.slug, ref.path);
					if (bundled !== undefined) return { ref, payload: bundled };
					if (ref.type === 'clinical_trials_raw') {
						return { ref, payload: await loadRawSummary(manifest, ref) };
					}
					return { ref, payload: null };
				})
			)
		: [];

	const payload: DigitalDataPayload = { manifest, datasets };
	return payload;
};
