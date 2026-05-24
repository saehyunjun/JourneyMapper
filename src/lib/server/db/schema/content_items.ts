/**
 * content_items — one row per ingested piece of patient voice (an interview
 * transcript, a social post, a YouTube video, a search query, a forum
 * thread, etc.). The unit of provenance.
 *
 * A content_item carries the original text, the source attribution, and a
 * many-to-many link to indications (a single Reddit post can discuss both
 * obesity and T2D; a YouTube melanoma testimonial might only be tagged
 * melanoma). Phase 5 ingestion writes here; segments.ts decomposes each
 * content_item into the per-claim analysis units.
 *
 * No application code reads from this table yet. Schema-only addition;
 * Phase 5 ingestion connectors land in a follow-up.
 */
import { sqliteTable, text, integer, primaryKey, index } from 'drizzle-orm/sqlite-core';
import { contentSources } from './content_sources';
import { indications } from './indications';

export const contentItems = sqliteTable(
	'content_items',
	{
		id: text('id').primaryKey(),
		content_source_id: text('content_source_id')
			.notNull()
			.references(() => contentSources.id, { onDelete: 'restrict' }),
		raw_text: text('raw_text').notNull(),
		title: text('title'),
		url: text('url'),
		/** Pseudonym for social posts, channel name for YouTube, real name for
		 *  named blogs / podcasts, etc. Pair with author_attribution_type. */
		author_handle: text('author_handle'),
		author_attribution_type: text('author_attribution_type', {
			enum: ['named', 'pseudonymous', 'aggregated', 'anonymous']
		}),
		/** Source-specific platform name (`reddit`, `twitter`, `youtube`,
		 *  `inspire`, `medium`, etc.) — useful when content_source_id is a
		 *  broad bucket like `social_post`. */
		platform: text('platform'),
		captured_at: integer('captured_at', { mode: 'timestamp' }).notNull(),
		/** When the original content was published. Distinct from captured_at,
		 *  which is when we ingested it. */
		published_at: integer('published_at', { mode: 'timestamp' }),
		/** Source-specific envelope fields — engagement counts, video_id,
		 *  thread_id, query metadata, etc. Schema mirrors the typical_metadata
		 *  hint on the parent content_source row. */
		source_metadata: text('source_metadata', { mode: 'json' }).$type<Record<string, unknown>>(),
		embedding: text('embedding', { mode: 'json' }).$type<number[] | null>(),
		created_at: integer('created_at', { mode: 'timestamp' }).notNull()
	},
	(t) => [
		index('idx_content_items_source').on(t.content_source_id),
		index('idx_content_items_captured').on(t.captured_at),
		index('idx_content_items_platform').on(t.platform)
	]
);

/** A content_item may discuss multiple indications. M2M, same pattern as
 *  indication_therapeutic_areas. */
export const contentItemIndications = sqliteTable(
	'content_item_indications',
	{
		content_item_id: text('content_item_id')
			.notNull()
			.references(() => contentItems.id, { onDelete: 'cascade' }),
		indication_id: text('indication_id')
			.notNull()
			.references(() => indications.id, { onDelete: 'cascade' })
	},
	(t) => [primaryKey({ columns: [t.content_item_id, t.indication_id] })]
);
