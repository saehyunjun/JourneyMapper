/**
 * Analyst-starred highlights — shared read/write helpers.
 *
 * Backed by wctglpdemo-data/highlights.json (dev) or the KV store (prod).
 * Segments (review page) and quotes (analysis page) are starred independently;
 * their ids never collide, but they are kept in separate lists so each page
 * only loads what it needs.
 */
import bundledHighlights from '$lib/content/wctglpdemo-data/highlights.json';
import { loadDoc, saveDoc } from './kv-store';

const HIGHLIGHTS_PATH = 'src/lib/content/wctglpdemo-data/highlights.json';
const KV_KEY = 'wctglpdemo:highlights';

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

const read = () => loadDoc<HighlightsFile>(KV_KEY, HIGHLIGHTS_PATH, bundledHighlights as HighlightsFile);

function project(file: HighlightsFile): HighlightState {
	return {
		starredSegmentIds: file.starred_segment_ids,
		starredQuoteIds: file.starred_quote_ids
	};
}

/** Current starred ids — safe to call from a page `load`. */
export async function readHighlights(): Promise<HighlightState> {
	return project(await read());
}

/** Toggle one id on/off and persist; returns the updated state. */
export async function toggleHighlight(kind: HighlightKind, id: string): Promise<HighlightState> {
	const file = await read();
	const key = kind === 'segment' ? 'starred_segment_ids' : 'starred_quote_ids';
	const set = new Set(file[key]);
	if (set.has(id)) set.delete(id);
	else set.add(id);
	file[key] = [...set].sort();
	file.meta.updated_at = new Date().toISOString();
	await saveDoc(KV_KEY, HIGHLIGHTS_PATH, file);
	return project(file);
}
