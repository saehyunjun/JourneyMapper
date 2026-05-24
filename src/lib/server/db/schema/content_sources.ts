/**
 * Content sources — the WHERE-from axis for patient voice.
 *
 * Mirrors registries/content_sources.json. The closed vocabulary lives in a
 * single table; per-content rows (Phase 5 ingestion target) reference this
 * via content_source_id.
 *
 * typical_metadata is the JSON-encoded hint about what envelope fields the
 * Phase 5 ingestion code should expect for this source type — not enforced
 * here, just informational.
 */
import { sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const contentSources = sqliteTable('content_sources', {
	id: text('id').primaryKey(),
	label: text('label').notNull(),
	description: text('description').notNull(),
	typical_metadata: text('typical_metadata', { mode: 'json' }).$type<string[]>().notNull()
});
