/**
 * entity-drawer store — drives the EntityDetailDrawer for the new
 * Entity layer (drugs, biomarkers, sponsors, symptoms, concepts, trials,
 * conditions). Sibling to group-drawer.svelte.ts, which still owns the
 * legacy cluster/theme stats drawer.
 *
 * Phase 3 of the codebook migration. Clicking a highlighted entity-only
 * span in KeywordText calls `entityDrawer.open(entityId)`;
 * EntityDetailDrawer.svelte, mounted once in the patientlyiq layout,
 * renders whatever is current. Global so any page can open it without
 * per-page wiring.
 *
 * See ENTITY_REGISTRY.md and CODEBOOK_MIGRATION_PLAN.md.
 */
import type { EntityId } from '$lib/content/entities/types';

export type EntitySelection = { entityId: EntityId };

let current = $state<EntitySelection | null>(null);

export const entityDrawer = {
	/** The entity currently shown, or null when the drawer is closed. */
	get current(): EntitySelection | null {
		return current;
	},
	open(entityId: EntityId): void {
		current = { entityId };
	},
	close(): void {
		current = null;
	}
};
