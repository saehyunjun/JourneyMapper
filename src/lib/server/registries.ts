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
import burdenCategoriesJson from '$lib/content/registries/burden_categories.json';
import type {
	Indication,
	TherapeuticArea,
	DatasetType,
	SourceType,
	BurdenCategory
} from '$lib/content/registries/types';

type RegistryFile<T> = { schema_version: string; description?: string; items: T[] };

export const therapeuticAreas: TherapeuticArea[] = (
	therapeuticAreasJson as RegistryFile<TherapeuticArea>
).items;

export const indications: Indication[] = (indicationsJson as RegistryFile<Indication>).items;

export const datasetTypes: DatasetType[] = (datasetTypesJson as RegistryFile<DatasetType>).items;

export const sourceTypes: SourceType[] = (sourcesJson as RegistryFile<SourceType>).items;

/** Tree-structured burden taxonomy. `parent_id` is null at the top level. Use
 *  `burdenCategoryChildren(id)` for downward traversal, `burdenCategoryAncestors(id)`
 *  for upward. The registry status is "draft" — refine freely; FKs are ids. */
export const burdenCategories: BurdenCategory[] = (
	burdenCategoriesJson as RegistryFile<BurdenCategory>
).items;

const indicationById = new Map(indications.map((i) => [i.id, i]));
const therapeuticAreaById = new Map(therapeuticAreas.map((a) => [a.id, a]));
const burdenCategoryById = new Map(burdenCategories.map((b) => [b.id, b]));

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

export function getBurdenCategory(id: string): BurdenCategory | undefined {
	return burdenCategoryById.get(id as BurdenCategory['id']);
}

/** True if every id in `ids` resolves against the burden registry. */
export function burdenCategoriesExist(ids: readonly string[]): boolean {
	for (const id of ids)
		if (!burdenCategoryById.has(id as BurdenCategory['id'])) return false;
	return true;
}

/** Walk from a leaf to the root, returning [self, parent, ...]. Empty array if
 *  the id is unknown. Useful for aggregations that need to roll a leaf-level
 *  tag up to its top-level parent. */
export function burdenCategoryAncestors(id: string): BurdenCategory[] {
	const out: BurdenCategory[] = [];
	let cur = burdenCategoryById.get(id as BurdenCategory['id']);
	const seen = new Set<string>();
	while (cur && !seen.has(cur.id)) {
		out.push(cur);
		seen.add(cur.id);
		cur = cur.parent_id ? burdenCategoryById.get(cur.parent_id) : undefined;
	}
	return out;
}

export type { Indication, TherapeuticArea, DatasetType, SourceType, BurdenCategory };
