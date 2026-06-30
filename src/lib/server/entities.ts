/**
 * Entity registry — server-side loaders for the parallel data model from
 * Phase 1 of the codebook migration. See ENTITY_REGISTRY.md for the spec
 * and CODEBOOK_MIGRATION_PLAN.md for the phase contract.
 *
 * Today's contract (Phase 2):
 *   - getEntitiesForIndication(indicationId) reads the per-kind JSON files
 *     under src/lib/content/entities/ and returns every entity whose
 *     indications[] either includes the active indication OR is empty
 *     (cross-cutting).
 *   - The slice loader (lexicon.ts) folds this into LexiconSlice as
 *     `entities` so the matcher's entitySpans() can recognize entity
 *     surface forms alongside the legacy cluster matcher.
 *
 * Loading strategy mirrors lexicon.ts: bundled JSON is the seed; KV-backed
 * editing isn't wired yet (Phase 4 territory when the propose-entities.mjs
 * script lands). For now we just import the JSON statically and filter
 * in-process — the registries are small (<60 entries total at Phase 1) so
 * the cost is negligible.
 */
import drugsRaw from '$lib/content/entities/drugs.json';
import biomarkersRaw from '$lib/content/entities/biomarkers.json';
import sponsorsRaw from '$lib/content/entities/sponsors.json';
import symptomsRaw from '$lib/content/entities/symptoms.json';
import conceptsRaw from '$lib/content/entities/concepts.json';
import trialsRaw from '$lib/content/entities/trials.json';
import conditionsRaw from '$lib/content/entities/conditions.json';
import type { Entity, EntityRegistry } from '$lib/content/entities/types';

/** All entity registries concatenated into one flat list. Order is stable
 *  (drugs → biomarkers → sponsors → symptoms → concepts → trials → conditions)
 *  so callers that iterate get deterministic precedence when surface forms
 *  collide. */
function allEntities(): Entity[] {
	const sources: EntityRegistry[] = [
		drugsRaw as unknown as EntityRegistry,
		biomarkersRaw as unknown as EntityRegistry,
		sponsorsRaw as unknown as EntityRegistry,
		symptomsRaw as unknown as EntityRegistry,
		conceptsRaw as unknown as EntityRegistry,
		trialsRaw as unknown as EntityRegistry,
		conditionsRaw as unknown as EntityRegistry
	];
	const out: Entity[] = [];
	for (const reg of sources) {
		for (const item of reg.items ?? []) out.push(item);
	}
	return out;
}

/** Return every entity scoped to the active indication. Match rule:
 *  empty `indications[]` (cross-cutting) ALWAYS surfaces; otherwise the
 *  active indication must appear in the array. Inactive (`status:
 *  deprecated`) entities are filtered out — they exist for historic
 *  EntityMention rows but should not participate in matching. */
export function getEntitiesForIndication(activeIndication: string): Entity[] {
	return allEntities().filter((e) => {
		if (e.status === 'deprecated') return false;
		if (!e.indications || e.indications.length === 0) return true;
		return e.indications.includes(activeIndication as Entity['indications'][number]);
	});
}

/** Internal export so the legacy default-matcher path (keywords.ts) can
 *  read the full cross-cutting set when nothing else is scoping. Not for
 *  general use — prefer getEntitiesForIndication. */
export function _allEntitiesForLegacyMatcher(): Entity[] {
	return allEntities().filter((e) => e.status !== 'deprecated');
}
