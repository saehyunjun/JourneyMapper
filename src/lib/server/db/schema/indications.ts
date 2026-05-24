/**
 * Indications + therapeutic areas — the disease axis.
 *
 * Mirrors registries/indications.json and registries/therapeutic_areas.json.
 * Many-to-many between indications and therapeutic areas (LN = immunology +
 * nephrology) so we use a join table rather than denormalizing.
 *
 * No application code reads from these tables yet — bundled JSON in
 * src/lib/content/registries/ is still the live source of truth. These
 * schemas exist so Phase 2 follow-up work (seeding from JSON, swapping
 * loaders to query the DB) has a place to land.
 */
import { sqliteTable, text, primaryKey } from 'drizzle-orm/sqlite-core';

export const therapeuticAreas = sqliteTable('therapeutic_areas', {
	id: text('id').primaryKey(),
	label: text('label').notNull(),
	mesh_id: text('mesh_id'),
	mesh_term: text('mesh_term')
});

export const indications = sqliteTable('indications', {
	id: text('id').primaryKey(),
	label: text('label').notNull(),
	abbreviation: text('abbreviation'),
	mesh_id: text('mesh_id'),
	mesh_term: text('mesh_term'),
	description: text('description')
});

/** Many-to-many between indications and therapeutic areas. */
export const indicationTherapeuticAreas = sqliteTable(
	'indication_therapeutic_areas',
	{
		indication_id: text('indication_id')
			.notNull()
			.references(() => indications.id, { onDelete: 'cascade' }),
		therapeutic_area_id: text('therapeutic_area_id')
			.notNull()
			.references(() => therapeuticAreas.id, { onDelete: 'cascade' })
	},
	(t) => [primaryKey({ columns: [t.indication_id, t.therapeutic_area_id] })]
);
