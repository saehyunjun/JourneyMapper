/**
 * dashboard-blurbs.ts
 *
 * Read-side accessor for the analyst-voice copy produced by
 * scripts/propose-dashboard-blurbs.mjs. The dashboard prefers these when
 * present (per-indication, per-finding) and falls back to the runtime-
 * derived template strings in executive-summary.ts / the LN_* blocks in
 * routes/patientlyiq/+page.svelte when an indication hasn't been generated
 * for yet. Both lookups return null when nothing is available so callers can
 * use `??` to layer.
 */
import blurbs from './dashboard_blurbs.json';

export type ConsiderationKind = 'insight' | 'tension' | 'implication';
export type Consideration = { kind: ConsiderationKind; text: string };

export type FindingBlurb = {
	lede: string;
	analysis: string;
	considerations?: Consideration[];
};

type IndicationBlurbs = {
	generated_at?: string;
	model?: string;
	corpus_kind?: string;
	overview?: string;
	findings?: Record<string, FindingBlurb>;
};

type BlurbsFile = {
	schema_version: string;
	indications: Record<string, IndicationBlurbs>;
};

const data = blurbs as BlurbsFile;

export function getOverviewBlurb(indication: string): string | null {
	return data.indications?.[indication]?.overview ?? null;
}

export function getFindingBlurb(
	indication: string,
	findingId: string
): FindingBlurb | null {
	return data.indications?.[indication]?.findings?.[findingId] ?? null;
}
