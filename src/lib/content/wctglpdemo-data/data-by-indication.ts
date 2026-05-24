/**
 * Indication-routed demo data.
 *
 * Returns the right keyword-usage dataset based on the active indication.
 * Today: two indications mapped — `obesity` (the real WCT GLP-1 corpus) and
 * `lupus_nephritis` (hand-authored DUMMY counts, no segments/annotations
 * yet so anything that joins matches → segments will filter LN clusters
 * out; see lupus_nephritis_keyword_usage.json's `notes`).
 *
 * Anything not registered falls back to obesity, so charts can adopt this
 * helper without breaking on indications that don't have a demo dataset
 * authored yet.
 *
 * Both files are statically imported, so they're bundled together in the
 * client. This is fine for the current size; once N indications grows or
 * the per-indication files get bigger, fetch them server-side via
 * /api/lexicon style endpoints instead.
 */
import obesityKeywordUsage from './keyword_usage.json';
import lupusKeywordUsage from './lupus_nephritis_keyword_usage.json';

// Loose shape — different consumers (KeywordOrbit, ThemeHeatmap, others)
// read slightly different fields, so we hand back the raw JSON and let
// each consumer cast to the shape it needs.
type KeywordUsage = typeof obesityKeywordUsage;

const REGISTRY: Record<string, unknown> = {
	obesity: obesityKeywordUsage,
	lupus_nephritis: lupusKeywordUsage
};

/** Return the keyword-usage dataset for the named indication, or obesity
 *  if there's no demo dataset registered. Cast at the call site to the
 *  shape your consumer expects. */
export function getKeywordUsage(indication: string | undefined): KeywordUsage {
	return (REGISTRY[indication ?? 'obesity'] ?? obesityKeywordUsage) as KeywordUsage;
}

/** List of indications with a registered demo dataset (excluding the
 *  obesity default). Useful for "has data" badges. */
export const INDICATIONS_WITH_DEMO_DATA = new Set(['obesity', 'lupus_nephritis']);
