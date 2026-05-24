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
import { db } from './client';
import { drugs, drugIndications } from './schema/drugs';
import { eq, inArray } from 'drizzle-orm';
import type { Drug, DrugId, IndicationId } from '$lib/content/registries/types';

/** Return every drug whose indication_ids[] includes the given indication.
 *  Performs two queries: (1) the drugs joined to drug_indications filtered
 *  by indication_id, (2) all drug_indications rows for the returned drug
 *  ids so we can populate the full indication_ids[] field on each Drug.
 *
 *  Throws if the DB is unavailable or the schema isn't migrated. */
export async function drugsForIndicationFromDb(indicationId: string): Promise<Drug[]> {
	const matchedDrugs = await db
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
	const allLinks = await db
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
