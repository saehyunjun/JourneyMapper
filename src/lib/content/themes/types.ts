/**
 * Theme registry types — the data model behind CODEBOOK_TAXONOMY.md.
 *
 * A Theme is a typed bucket that a span of patient/caregiver text can be
 * tagged with. Spans carry 0..N ThemeTag rows across multiple axes — the
 * matcher SUGGESTS candidates from surface_form_hints; per-span assignment
 * lives in ThemeTag rows, not in matcher output.
 *
 * Phase 1 of the codebook migration (parallel data model): this file
 * defines the schema; themes.json holds the data. Nothing reads either
 * yet — the dual-source matcher wiring lands in Phase 2.
 *
 * See CODEBOOK_TAXONOMY.md for the full taxonomy, multi-tag contract,
 * suffix matrix, and rules for adding themes.
 */
import type { IndicationId } from '$lib/content/registries/types';

/** The five top-level theme axes. Universal axes are append-only. */
export type ThemeAxisId =
	| 'hrqol'
	| 'util'
	| 'trial'
	| 'life'
	| `dx.${IndicationId}`;

/** Cross-axis suffix vocabulary. Reuse before inventing — same suffix
 *  should mean the same dimension across axes. Convention-only, not
 *  enforced. New suffixes earn their spot by appearing on >1 axis. */
export type ThemeSuffix =
	| 'financial'
	| 'logistics'
	| 'relationship'
	| 'access'
	| string;

/** Published framework a theme is derived from. `inspired` = draws from
 *  a frame without strictly adhering. `analyst` = no external frame,
 *  authored by the analyst team (requires writeup). */
export type ThemeFrame =
	| 'sf36v2'
	| 'promis29'
	| 'ahrq'
	| 'cahps'
	| 'consort'
	| 'zarit'
	| 'cra'
	| 'inspired'
	| 'analyst';

export type ThemeProvenance = {
	frame: ThemeFrame;
	citation?: string;
};

export type Theme = {
	/** Dotted id of the form `<axis>.<slug>`, e.g. `hrqol.bodily_pain`. */
	id: string;
	axis: ThemeAxisId;
	label: string;
	provenance: ThemeProvenance;
	/** One-line "what this catches". Used in tagger UI hover state and
	 *  in analyst-facing review tools. */
	captures: string;
	/** Optional one-line "what this does NOT catch" to head off common
	 *  mis-tagging. */
	excludes?: string;
	/** Suggestion fuel for the matcher — surface forms that often appear
	 *  in patient text when this theme is relevant. NOT authoritative;
	 *  the tagger UI uses these to rank suggestions, then the analyst
	 *  decides. */
	surface_form_hints: string[];
};

/** A per-span theme assignment. Many ThemeTag rows can exist for the same
 *  span (multi-tag contract). The matcher proposes; humans accept/edit. */
export type ThemeTag = {
	segment_id: string;
	span: { start: number; end: number; text: string };
	theme_id: string;
	tagger: 'human' | 'llm-proposed' | 'llm-accepted';
	confidence?: number;
	created_at: string;
};

/** Top-level shape of themes.json (matches the existing registry pattern
 *  of { schema_version, description, items: T[] }). */
export type ThemeRegistry = {
	schema_version: string;
	description: string;
	items: Theme[];
};
