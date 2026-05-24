/**
 * DB query helpers — typed reads against the Drizzle/libSQL schema.
 *
 * Each helper returns rows in the same shape consumers already expect (the
 * type from src/lib/content/registries/types.ts), so a caller can drop one
 * in as a swap for the JSON-backed equivalent. Errors propagate — callers
 * decide whether to fall back to JSON or surface to the user.
 *
 * The DB is the parallel path; the bundled JSON registries are still the
 * authoritative read source for everything else.
 */
import { getDb } from './client';
import { drugs, drugIndications, sponsors, mechanismsOfAction } from './schema/drugs';
import {
	indications,
	therapeuticAreas,
	indicationTherapeuticAreas
} from './schema/indications';
import { burdenCategories } from './schema/burdens';
import { contentSources } from './schema/content_sources';
import { contentItems, contentItemIndications } from './schema/content_items';
import { eq, inArray, and, desc, sql } from 'drizzle-orm';
import type {
	Drug,
	DrugId,
	Indication,
	IndicationId,
	TherapeuticArea,
	TherapeuticAreaId,
	BurdenCategory,
	BurdenCategoryId,
	Sponsor,
	SponsorId,
	MechanismOfAction,
	MoaId,
	ContentSource,
	ContentSourceId
} from '$lib/content/registries/types';

/** Return every drug whose indication_ids[] includes the given indication.
 *  Performs two queries: (1) the drugs joined to drug_indications filtered
 *  by indication_id, (2) all drug_indications rows for the returned drug
 *  ids so we can populate the full indication_ids[] field on each Drug.
 *
 *  Throws if the DB is unavailable or the schema isn't migrated. */
export async function drugsForIndicationFromDb(indicationId: string): Promise<Drug[]> {
	const matchedDrugs = await getDb()
		.select({
			id: drugs.id,
			label: drugs.label,
			generic_name: drugs.generic_name,
			brand_names: drugs.brand_names,
			moa_id: drugs.moa_id,
			sponsor_id: drugs.sponsor_id,
			stage: drugs.stage,
			description: drugs.description,
			embedding: drugs.embedding
		})
		.from(drugs)
		.innerJoin(drugIndications, eq(drugIndications.drug_id, drugs.id))
		.where(eq(drugIndications.indication_id, indicationId));

	if (matchedDrugs.length === 0) return [];

	const drugIds = matchedDrugs.map((d) => d.id);
	const allLinks = await getDb()
		.select({
			drug_id: drugIndications.drug_id,
			indication_id: drugIndications.indication_id
		})
		.from(drugIndications)
		.where(inArray(drugIndications.drug_id, drugIds));

	const indsByDrugId = new Map<string, string[]>();
	for (const link of allLinks) {
		const arr = indsByDrugId.get(link.drug_id) ?? [];
		arr.push(link.indication_id);
		indsByDrugId.set(link.drug_id, arr);
	}

	return matchedDrugs.map((d) => ({
		id: d.id as DrugId,
		label: d.label,
		generic_name: d.generic_name,
		brand_names: d.brand_names,
		moa_id: d.moa_id as Drug['moa_id'],
		sponsor_id: d.sponsor_id as Drug['sponsor_id'],
		stage: d.stage,
		indication_ids: (indsByDrugId.get(d.id) ?? []) as IndicationId[],
		description: d.description ?? undefined,
		embedding: d.embedding ?? undefined
	}));
}

/** Every indication row, each with its therapeutic_area_ids[] populated from
 *  the join table. Same shape as registries/indications.json items. */
export async function indicationsFromDb(): Promise<Indication[]> {
	const rows = await getDb().select().from(indications);
	if (rows.length === 0) return [];

	const links = await getDb().select().from(indicationTherapeuticAreas);
	const tasByInd = new Map<string, string[]>();
	for (const l of links) {
		const arr = tasByInd.get(l.indication_id) ?? [];
		arr.push(l.therapeutic_area_id);
		tasByInd.set(l.indication_id, arr);
	}

	return rows.map((r) => ({
		id: r.id as IndicationId,
		label: r.label,
		abbreviation: r.abbreviation,
		mesh_id: r.mesh_id,
		mesh_term: r.mesh_term,
		therapeutic_area_ids: (tasByInd.get(r.id) ?? []) as TherapeuticAreaId[],
		description: r.description ?? undefined
	}));
}

export async function therapeuticAreasFromDb(): Promise<TherapeuticArea[]> {
	const rows = await getDb().select().from(therapeuticAreas);
	return rows.map((r) => ({
		id: r.id as TherapeuticAreaId,
		label: r.label,
		mesh_id: r.mesh_id,
		mesh_term: r.mesh_term
	}));
}

export async function burdenCategoriesFromDb(): Promise<BurdenCategory[]> {
	const rows = await getDb().select().from(burdenCategories);
	return rows.map((r) => ({
		id: r.id as BurdenCategoryId,
		label: r.label,
		parent_id: (r.parent_id ?? null) as BurdenCategoryId | null,
		description: r.description
	}));
}

export async function sponsorsFromDb(): Promise<Sponsor[]> {
	const rows = await getDb().select().from(sponsors);
	return rows.map((r) => ({
		id: r.id as SponsorId,
		label: r.label,
		headquarters_country: r.headquarters_country
	}));
}

export async function mechanismsOfActionFromDb(): Promise<MechanismOfAction[]> {
	const rows = await getDb().select().from(mechanismsOfAction);
	return rows.map((r) => ({
		id: r.id as MoaId,
		label: r.label,
		description: r.description,
		embedding: r.embedding ?? undefined
	}));
}

// --- Analytics ---------------------------------------------------------------

/** A single search-trend row: a search-query content_item plus its volume +
 *  source-dataset metadata extracted from source_metadata. */
export type SearchTrend = {
	id: string;
	topic: string;
	volume: number | null;
	unit: string | null;
	geography: string | null;
	dataset_id: string | null;
};

/** Top search-query topics for an indication, ordered by estimated volume
 *  desc. Reads only from content_items + content_item_indications (no JSON
 *  fallback — analytics surfaces should fail loudly if the DB isn't seeded
 *  + ingested, not silently return stale data). */
export async function searchTrendsFromDb(
	indicationId: string,
	limit = 50
): Promise<SearchTrend[]> {
	const volumeExpr = sql<number>`CAST(json_extract(${contentItems.source_metadata}, '$.volume') AS INTEGER)`;
	const rows = await getDb()
		.select({
			id: contentItems.id,
			topic: contentItems.raw_text,
			volume: volumeExpr,
			unit: sql<string | null>`json_extract(${contentItems.source_metadata}, '$.unit')`,
			geography: sql<string | null>`json_extract(${contentItems.source_metadata}, '$.geography')`,
			dataset_id: sql<string | null>`json_extract(${contentItems.source_metadata}, '$.dataset_id')`
		})
		.from(contentItems)
		.innerJoin(
			contentItemIndications,
			eq(contentItemIndications.content_item_id, contentItems.id)
		)
		.where(
			and(
				eq(contentItems.content_source_id, 'search_query'),
				eq(contentItemIndications.indication_id, indicationId)
			)
		)
		.orderBy(desc(volumeExpr))
		.limit(limit);

	return rows.map((r) => ({
		id: r.id,
		topic: r.topic,
		volume: r.volume ?? null,
		unit: r.unit,
		geography: r.geography,
		dataset_id: r.dataset_id
	}));
}

// --- Registries --------------------------------------------------------------

export async function contentSourcesFromDb(): Promise<ContentSource[]> {
	const rows = await getDb().select().from(contentSources);
	return rows.map((r) => ({
		id: r.id as ContentSourceId,
		label: r.label,
		description: r.description,
		typical_metadata: r.typical_metadata
	}));
}
