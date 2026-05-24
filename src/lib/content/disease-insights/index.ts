/**
 * Disease-insights registry.
 *
 * Auto-discovers every `manifest.json` under `src/lib/content/disease-insights/<slug>/`
 * via `import.meta.glob`. Drop a new folder with a manifest in and it shows up here
 * without any code change.
 *
 * Dataset payloads themselves are NOT eagerly imported — consumers should fetch them
 * lazily (e.g. via SvelteKit `load` functions) using the manifest's `path` field, so
 * the chart-extract JSONs don't bloat every client bundle.
 */

import type { IndicationId, TherapeuticAreaId } from '../registries/types';

export type DiseaseDatasetType =
	| 'keyword_clusters'
	| 'search_volume_topics'
	| 'community_engagement'
	| 'ad_spend_timeseries';

export type DiseaseDatasetRef = {
	id: string;
	type: DiseaseDatasetType;
	label: string;
	/** Path relative to the manifest's folder. */
	path: string;
	geography: string | null;
	unit: string | null;
	source_id: string | null;
};

export type DiseaseInsightManifest = {
	schema_version: string;
	id: IndicationId;
	slug: string;
	label: string;
	abbreviation: string | null;
	therapeutic_area_ids: TherapeuticAreaId[];
	datasets: DiseaseDatasetRef[];
};

/** Folder-name slug of every disease-insight directory. Narrowed at runtime by the glob. */
export type DiseaseInsightId = DiseaseInsightManifest['id'];

const manifestModules = import.meta.glob<DiseaseInsightManifest>(
	'./*/manifest.json',
	{ eager: true, import: 'default' }
);

function slugFromPath(path: string): string {
	// './lupus-nephritis/manifest.json' -> 'lupus-nephritis'
	const m = path.match(/^\.\/([^/]+)\/manifest\.json$/);
	if (!m) throw new Error(`disease-insights: unexpected manifest path "${path}"`);
	return m[1];
}

export const diseaseInsightManifests: DiseaseInsightManifest[] = Object.entries(manifestModules)
	.map(([path, manifest]) => {
		const folderSlug = slugFromPath(path);
		if (manifest.slug !== folderSlug) {
			throw new Error(
				`disease-insights: folder "${folderSlug}" does not match manifest.slug "${manifest.slug}"`
			);
		}
		return manifest;
	})
	.sort((a, b) => a.label.localeCompare(b.label));

const bySlug = new Map(diseaseInsightManifests.map((m) => [m.slug, m]));
const byId = new Map(diseaseInsightManifests.map((m) => [m.id, m]));

export function getDiseaseInsightManifestById(id: string): DiseaseInsightManifest | undefined {
	return byId.get(id as IndicationId);
}

export function getDiseaseInsightManifestBySlug(slug: string): DiseaseInsightManifest | undefined {
	return bySlug.get(slug);
}

export function getDatasetRef(
	manifestOrId: DiseaseInsightManifest | string,
	datasetId: string
): DiseaseDatasetRef | undefined {
	const manifest =
		typeof manifestOrId === 'string' ? getDiseaseInsightManifestById(manifestOrId) : manifestOrId;
	return manifest?.datasets.find((d) => d.id === datasetId);
}
