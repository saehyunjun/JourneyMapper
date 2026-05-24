/**
 * Drugs + mechanisms of action + sponsors — the pharma axis.
 *
 * Mirrors registries/drugs.json, registries/mechanisms_of_action.json,
 * registries/sponsors.json. Brand names are stored as a JSON-encoded text
 * array (libSQL has no native array type); drizzle-orm/sqlite supports
 * `text({ mode: 'json' })` which round-trips through JSON.parse / stringify.
 *
 * The drug indication coverage is many-to-many (a drug can be approved for
 * multiple diseases), so it's a join table rather than a denormalized list.
 *
 * `embedding` is a JSON array of floats — the Phase 3 lever. Today no code
 * writes the column; the schema only declares the contract.
 */
import { sqliteTable, text, integer, primaryKey } from 'drizzle-orm/sqlite-core';
import { indications } from './indications';

export const sponsors = sqliteTable('sponsors', {
	id: text('id').primaryKey(),
	label: text('label').notNull(),
	headquarters_country: text('headquarters_country')
});

export const mechanismsOfAction = sqliteTable('mechanisms_of_action', {
	id: text('id').primaryKey(),
	label: text('label').notNull(),
	description: text('description').notNull(),
	embedding: text('embedding', { mode: 'json' }).$type<number[] | null>()
});

export const drugs = sqliteTable('drugs', {
	id: text('id').primaryKey(),
	label: text('label').notNull(),
	generic_name: text('generic_name').notNull(),
	brand_names: text('brand_names', { mode: 'json' }).$type<string[]>().notNull(),
	moa_id: text('moa_id').references(() => mechanismsOfAction.id, { onDelete: 'set null' }),
	sponsor_id: text('sponsor_id').references(() => sponsors.id, { onDelete: 'set null' }),
	stage: text('stage', {
		enum: ['approved', 'phase_3', 'phase_2', 'phase_1', 'preclinical']
	}).notNull(),
	description: text('description'),
	approved_at: integer('approved_at'),
	embedding: text('embedding', { mode: 'json' }).$type<number[] | null>()
});

/** Many-to-many between drugs and indications. A drug can be approved for
 *  multiple diseases (e.g. semaglutide → obesity + type 2 diabetes once T2D
 *  is registered). */
export const drugIndications = sqliteTable(
	'drug_indications',
	{
		drug_id: text('drug_id')
			.notNull()
			.references(() => drugs.id, { onDelete: 'cascade' }),
		indication_id: text('indication_id')
			.notNull()
			.references(() => indications.id, { onDelete: 'cascade' })
	},
	(t) => [primaryKey({ columns: [t.drug_id, t.indication_id] })]
);
