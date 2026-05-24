/**
 * Registry accessors — the canonical source of truth for indications,
 * therapeutic areas, source types, and dataset types.
 *
 * These ids are FKs from `keyword_lexicon.json` clusters, `disease-insights/`
 * manifests, and (in future) annotation rows and the database. The lexicon
 * file no longer carries its own `meta.indications` / `meta.therapeutic_areas`
 * — read them here.
 *
 * Bundled (eagerly imported) because the registries are small, static, and
 * needed at request time on every page. If they grow into the thousands of
 * rows, swap for a lazy loader.
 */
import indicationsJson from '$lib/content/registries/indications.json';
import therapeuticAreasJson from '$lib/content/registries/therapeutic_areas.json';
import datasetTypesJson from '$lib/content/registries/dataset_types.json';
import sourcesJson from '$lib/content/registries/sources.json';
import type {
	Indication,
	TherapeuticArea,
	DatasetType,
	SourceType
} from '$lib/content/registries/types';

type RegistryFile<T> = { schema_version: string; description?: string; items: T[] };

export const therapeuticAreas: TherapeuticArea[] = (
	therapeuticAreasJson as RegistryFile<TherapeuticArea>
).items;

export const indications: Indication[] = (indicationsJson as RegistryFile<Indication>).items;

export const datasetTypes: DatasetType[] = (datasetTypesJson as RegistryFile<DatasetType>).items;

export const sourceTypes: SourceType[] = (sourcesJson as RegistryFile<SourceType>).items;

const indicationById = new Map(indications.map((i) => [i.id, i]));
const therapeuticAreaById = new Map(therapeuticAreas.map((a) => [a.id, a]));

export function getIndication(id: string): Indication | undefined {
	return indicationById.get(id as Indication['id']);
}

export function getTherapeuticArea(id: string): TherapeuticArea | undefined {
	return therapeuticAreaById.get(id as TherapeuticArea['id']);
}

/** True if every id in `ids` resolves against the indication registry. */
export function indicationsExist(ids: readonly string[]): boolean {
	for (const id of ids) if (!indicationById.has(id as Indication['id'])) return false;
	return true;
}

export type { Indication, TherapeuticArea, DatasetType, SourceType };
