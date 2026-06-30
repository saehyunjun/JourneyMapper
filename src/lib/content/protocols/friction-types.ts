/**
 * protocols/friction-types.ts
 *
 * Phase B rule-based friction model. Pure data — no scoring logic here.
 * Scoring lives in src/lib/protocols/score-friction.ts.
 *
 * A friction rule asserts: "for procedures matching X, if the persona has
 * attribute Y, charge weight W against any scheduled cell — and offer mods M."
 *
 * Whole model is transparent on purpose. No ML, no learned weights. The
 * full rule list is one file the analyst can review in seconds.
 */

import type { BurdenHint, Procedure } from './types';
import type { AttrValue } from '../personas/types';

export type { AttrValue, PersonaDemoProfile } from '../personas/types';

/** What a rule looks for in a procedure. All sub-clauses combine with AND. */
export type ProcedureMatch = {
	procedure_ids?: string[];
	procedure_groups?: string[];
	phase_ids?: string[];
	timepoint_ids?: string[];
	/** Match-any partial against the procedure's burden_hint. Each field is
	 *  optional; provided fields must equal the procedure's value. */
	burden_hint?: Partial<BurdenHint>;
};

/** What a rule looks for on the persona. */
export type PersonaPredicate =
	| { kind: 'attr_in'; attr: string; values: string[] }
	| { kind: 'attr_gte'; attr: string; value: number }
	| { kind: 'attr_lte'; attr: string; value: number }
	| { kind: 'attr_eq'; attr: string; value: string | boolean };

/** A suggested protocol modification attached to a rule. */
export type SuggestedMod = {
	id: string;
	label: string;
	rationale: string;
};

/** What kind of study risk a friction translates to. Lifted from how the
 *  sponsor/CRO protocol review structures its risk table (risk → consequence →
 *  mitigation). A 0..1 friction weight says HOW MUCH; the consequence says WHAT
 *  KIND. `startup_timeline` is site-side and not produced by patient-only rules
 *  yet — it's in the vocabulary for the deferred site-readiness axis. */
export type FrictionConsequence =
	| 'recruitment'
	| 'retention'
	| 'schedule_compliance'
	| 'data_integrity'
	| 'patient_safety'
	| 'pretreatment_ineligibility'
	| 'startup_timeline';

/** Display metadata for each consequence — single source of truth shared by the
 *  schedule view (corner tag + legend) and the cell drawer (per-rule chip).
 *  `tag` is the 2-char code shown in the cell corner; `order` is the stable
 *  tie-break / legend sort. Colors are existing app.css palette tokens. */
export const CONSEQUENCE_META: Record<
	FrictionConsequence,
	{ tag: string; label: string; color: string; order: number }
> = {
	recruitment: { tag: 'Rc', label: 'Recruitment', color: 'var(--grayblue)', order: 0 },
	retention: { tag: 'Rt', label: 'Retention', color: 'var(--green)', order: 1 },
	schedule_compliance: {
		tag: 'Sc',
		label: 'Schedule compliance',
		color: 'var(--orange)',
		order: 2
	},
	data_integrity: { tag: 'Di', label: 'Data integrity', color: 'var(--purple)', order: 3 },
	patient_safety: { tag: 'Sf', label: 'Patient safety', color: 'var(--gold)', order: 4 },
	pretreatment_ineligibility: {
		tag: 'In',
		label: 'Pre-treatment ineligibility',
		color: 'var(--darkgrayblue)',
		order: 5
	},
	startup_timeline: { tag: 'St', label: 'Site startup', color: 'var(--gray)', order: 6 }
};

export type FrictionRule = {
	id: string;
	label: string;
	/** One-sentence description shown in the drawer alongside the rule's weight. */
	description: string;
	applies_to: ProcedureMatch;
	persona_predicate: PersonaPredicate;
	/** Contribution to per-cell friction. 0..1; sum is clamped to 1. */
	weight: number;
	/** What kind of study risk this friction drives — colors the cell tag and
	 *  lets a friction map be read by consequence, not just magnitude. */
	consequence: FrictionConsequence;
	suggested_mods: SuggestedMod[];
	/** Pre-curated supporting fragment IDs from the project's corpora. Pulled
	 *  by the server loader into rule.evidence at render time. Empty array is
	 *  fine — the drawer just omits the receipts section for that rule. */
	evidence_fragment_ids: string[];
};

export type FrictionRulesFile = {
	protocol_id: string;
	rules: FrictionRule[];
};

/** Score for a single cell, after all matching rules have fired. */
export type CellFrictionScore = {
	score: number;            // 0..1 clamped — total magnitude
	fired_rule_ids: string[]; // rules that contributed
	/** Summed weight per consequence (pre-clamp). Drives the consequence mix. */
	by_consequence: Partial<Record<FrictionConsequence, number>>;
	/** Highest-weight consequence; ties broken by CONSEQUENCE_META.order. The
	 *  cell corner tag renders this. Null only when no rule fired. */
	dominant: FrictionConsequence | null;
};

/** Friction scores keyed by `${procedure_id}::${timepoint_id}`. */
export type FrictionMap = Record<string, CellFrictionScore>;

export function cellKey(procedureId: string, timepointId: string): string {
	return `${procedureId}::${timepointId}`;
}

/** Convenience: pretty-format an attribute value for the drawer. */
export function formatAttrValue(v: AttrValue): string {
	switch (v.kind) {
		case 'band':
			return v.band;
		case 'enum':
			return v.value;
		case 'num':
			return String(v.value);
		case 'bool':
			return v.value ? 'yes' : 'no';
	}
}

/** Procedure-side type guard — keeps consumers from importing both files. */
export type { Procedure };
