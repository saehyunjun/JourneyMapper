/**
 * segments — the unit of analysis within a content_item.
 *
 * A segment is a sentence or claim from a content_item, with character
 * offsets into the parent's raw_text so the original span is always
 * recoverable. Sentiment, embedding, and (later) cluster/burden/theme/drug
 * tags hang off this row.
 *
 * Phase 5 ingestion creates segments alongside content_items. Phase 3
 * (embedding-first annotation) populates the embedding column. Tag tables
 * (segment_cluster_tags, segment_burdens, segment_drug_mentions, etc.) are
 * separate and not in this schema yet — add them when the annotation flow
 * is wired.
 */
import { sqliteTable, text, integer, real, index } from 'drizzle-orm/sqlite-core';
import { contentItems } from './content_items';

export const segments = sqliteTable(
	'segments',
	{
		id: text('id').primaryKey(),
		content_item_id: text('content_item_id')
			.notNull()
			.references(() => contentItems.id, { onDelete: 'cascade' }),
		text: text('text').notNull(),
		/** Character offsets into the parent content_item.raw_text. Inclusive
		 *  start, exclusive end. char_end - char_start == text.length when the
		 *  segment was derived directly from a substring of raw_text. */
		char_start: integer('char_start').notNull(),
		char_end: integer('char_end').notNull(),
		/** Ordinal position within the parent content_item (0-indexed). Stable
		 *  for the lifetime of the row. */
		segment_index: integer('segment_index').notNull(),
		/** Sentiment on the existing -2..+2 scale (continuous; ML-predicted or
		 *  human-reviewed). Nullable until annotation runs. */
		sentiment: real('sentiment'),
		/** Confidence 0..1 of the predicted sentiment / tags. Nullable. */
		confidence: real('confidence'),
		review_status: text('review_status', {
			enum: ['pending', 'confirmed', 'flagged']
		})
			.notNull()
			.default('pending'),
		embedding: text('embedding', { mode: 'json' }).$type<number[] | null>(),
		created_at: integer('created_at', { mode: 'timestamp' }).notNull()
	},
	(t) => [
		index('idx_segments_content_item').on(t.content_item_id),
		index('idx_segments_review_status').on(t.review_status)
	]
);
