/**
 * One sponsor / organization observed in an indication's clinical-trial
 * registry. Derived from clinicaltrials.gov by the fetch + summarize pipeline
 * and stored as `disease-insights/<slug>/clinical_trials/sponsors_observed.json`.
 *
 * Served by /api/sponsors-observed and consumed by SponsorDrawer.svelte +
 * the journey-workbench answer-parser, which detects sponsor mentions in
 * model-generated answer text and routes clicks to the drawer.
 */
export type ObservedSponsor = {
	name: string;
	/** ClinicalTrials.gov agency class(es) — INDUSTRY, NIH, FED, OTHER_GOV,
	 *  NETWORK, AMBIG, INDIV, OTHER. */
	classes: string[];
	lead_count: number;
	collaborator_count: number;
	total_count: number;
	nct_ids: string[];
};
