/**
 * Burden taxonomy — tree-structured.
 *
 * Mirrors registries/burden_categories.json. The tree shape is captured by a
 * self-referential `parent_id` FK; NULL at the top level. Same constraints as
 * the JSON version: no cycles, no orphan parent_ids, ids stable for life
 * (they're referenced from cluster.burden_category_ids[]).
 */
import { sqliteTable, text, type AnySQLiteColumn } from 'drizzle-orm/sqlite-core';

export const burdenCategories = sqliteTable('burden_categories', {
	id: text('id').primaryKey(),
	label: text('label').notNull(),
	parent_id: text('parent_id').references((): AnySQLiteColumn => burdenCategories.id, {
		onDelete: 'restrict'
	}),
	description: text('description').notNull()
});
