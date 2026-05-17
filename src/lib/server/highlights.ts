/**
 * Analyst-starred highlights — shared read/write helpers.
 *
 * Backed by wctglpdemo-data/highlights.json. Segments (review page) and quotes
 * (analysis page) are starred independently; their ids never collide, but they
 * are kept in separate lists so each page only loads what it needs.
 *
 * Note: this writes into the source tree, so it is a dev/demo-time operation —
 * see the matching note in the transcript-upload action.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const HIGHLIGHTS_PATH = 'src/lib/content/wctglpdemo-data/highlights.json';

export type HighlightKind = 'segment' | 'quote';

type HighlightsFile = {
	meta: { schema_version: string; study_id: string; description: string; updated_at: string };
	starred_segment_ids: string[];
	starred_quote_ids: string[];
};

export type HighlightState = {
	starredSegmentIds: string[];
	starredQuoteIds: string[];
};

function read(): HighlightsFile {
	return JSON.parse(readFileSync(resolve(HIGHLIGHTS_PATH), 'utf8'));
}

function project(file: HighlightsFile): HighlightState {
	return {
		starredSegmentIds: file.starred_segment_ids,
		starredQuoteIds: file.starred_quote_ids
	};
}

/** Current starred ids — safe to call from a page `load`. */
export function readHighlights(): HighlightState {
	return project(read());
}

/** Toggle one id on/off and persist; returns the updated state. */
export function toggleHighlight(kind: HighlightKind, id: string): HighlightState {
	const file = read();
	const key = kind === 'segment' ? 'starred_segment_ids' : 'starred_quote_ids';
	const set = new Set(file[key]);
	if (set.has(id)) set.delete(id);
	else set.add(id);
	file[key] = [...set].sort();
	file.meta.updated_at = new Date().toISOString();
	writeFileSync(resolve(HIGHLIGHTS_PATH), JSON.stringify(file, null, 2) + '\n', 'utf8');
	return project(file);
}
