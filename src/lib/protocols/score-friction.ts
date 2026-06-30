/**
 * score-friction.ts
 *
 * Pure scoring layer for the Phase B friction overlay. Takes a schedule,
 * a persona's demo_profile, and a rule list; returns per-cell scores.
 *
 * No I/O, no Svelte runes — exported as a plain function so it can run on
 * the server during page load, on the client when a slider toggles, or in
 * tests. Determinism is the contract: same inputs → same map.
 */

import type {
	Schedule,
	Procedure,
	Cell,
	BurdenHint,
	Phase,
	Timepoint
} from '$lib/content/protocols/types';
import type {
	FrictionRule,
	ProcedureMatch,
	PersonaPredicate,
	FrictionMap,
	CellFrictionScore,
	FrictionConsequence
} from '$lib/content/protocols/friction-types';
import type { PersonaDemoProfile, AttrValue } from '$lib/content/personas/types';
import { cellKey, CONSEQUENCE_META } from '$lib/content/protocols/friction-types';

/** Lookup helper for the procedure_group id of a given procedure id. Built
 *  once per schedule. */
function buildProcedureGroupIndex(schedule: Schedule): Map<string, string> {
	const m = new Map<string, string>();
	for (const g of schedule.procedure_groups) {
		for (const p of g.procedures) m.set(p.id, g.id);
	}
	return m;
}

/** Lookup helper for the phase id of a given timepoint id. */
function buildTimepointPhaseIndex(schedule: Schedule): Map<string, string> {
	const m = new Map<string, string>();
	for (const ph of schedule.phases) {
		for (const tp of ph.timepoints) m.set(tp.id, ph.id);
	}
	return m;
}

/** Does the partial burden_hint match the actual hint? An undefined field on
 *  the match clause means "don't care." */
function matchesBurdenHint(actual: BurdenHint | undefined, want: Partial<BurdenHint>): boolean {
	if (!actual) return false;
	for (const [k, v] of Object.entries(want)) {
		if (v === undefined) continue;
		const a = (actual as unknown as Record<string, unknown>)[k];
		if (a !== v) return false;
	}
	return true;
}

function matchesProcedure(
	procedure: Procedure,
	timepointId: string,
	phaseIdOfTimepoint: string,
	groupIdOfProcedure: string,
	match: ProcedureMatch
): boolean {
	if (match.procedure_ids && !match.procedure_ids.includes(procedure.id)) return false;
	if (match.procedure_groups && !match.procedure_groups.includes(groupIdOfProcedure)) return false;
	if (match.phase_ids && !match.phase_ids.includes(phaseIdOfTimepoint)) return false;
	if (match.timepoint_ids && !match.timepoint_ids.includes(timepointId)) return false;
	if (match.burden_hint && !matchesBurdenHint(procedure.burden_hint, match.burden_hint))
		return false;
	return true;
}

function readAttrAsString(v: AttrValue | undefined): string | undefined {
	if (!v) return undefined;
	if (v.kind === 'band') return v.band;
	if (v.kind === 'enum') return v.value;
	if (v.kind === 'bool') return v.value ? 'true' : 'false';
	if (v.kind === 'num') return String(v.value);
	return undefined;
}

function readAttrAsNumber(v: AttrValue | undefined): number | undefined {
	if (!v) return undefined;
	if (v.kind === 'num') return v.value;
	return undefined;
}

function readAttrAsBool(v: AttrValue | undefined): boolean | undefined {
	if (!v) return undefined;
	if (v.kind === 'bool') return v.value;
	return undefined;
}

function matchesPersona(profile: PersonaDemoProfile, p: PersonaPredicate): boolean {
	const v = profile.attrs[p.attr];
	if (!v) return false;
	switch (p.kind) {
		case 'attr_in': {
			const s = readAttrAsString(v);
			return s !== undefined && p.values.includes(s);
		}
		case 'attr_gte': {
			const n = readAttrAsNumber(v);
			return n !== undefined && n >= p.value;
		}
		case 'attr_lte': {
			const n = readAttrAsNumber(v);
			return n !== undefined && n <= p.value;
		}
		case 'attr_eq': {
			if (typeof p.value === 'boolean') {
				const b = readAttrAsBool(v);
				return b !== undefined && b === p.value;
			}
			const s = readAttrAsString(v);
			return s !== undefined && s === p.value;
		}
	}
}

function clamp01(n: number): number {
	return Math.max(0, Math.min(1, n));
}

/** Highest-weight consequence in the mix; ties broken by CONSEQUENCE_META.order
 *  (lower order wins) so the result is deterministic. */
function dominantConsequence(
	by: Partial<Record<FrictionConsequence, number>>
): FrictionConsequence | null {
	let best: FrictionConsequence | null = null;
	let bestWeight = -1;
	for (const [k, w] of Object.entries(by) as [FrictionConsequence, number][]) {
		if (w > bestWeight || (w === bestWeight && best !== null && CONSEQUENCE_META[k].order < CONSEQUENCE_META[best].order)) {
			best = k;
			bestWeight = w;
		}
	}
	return best;
}

/** Compute per-cell friction scores for the schedule under a persona's profile.
 *  If `profile` is null, returns an empty map (no friction overlay). */
export function scoreSchedule(
	schedule: Schedule,
	profile: PersonaDemoProfile | null,
	rules: FrictionRule[]
): FrictionMap {
	if (!profile) return {};

	const groupIdx = buildProcedureGroupIndex(schedule);
	const phaseIdx = buildTimepointPhaseIndex(schedule);

	// Pre-filter rules that pass the persona predicate — those are the only ones
	// that can ever fire. Saves an attr lookup per cell.
	const personaApplicable = rules.filter((r) => matchesPersona(profile, r.persona_predicate));

	const out: FrictionMap = {};

	for (const group of schedule.procedure_groups) {
		for (const proc of group.procedures) {
			const procCells = schedule.cells[proc.id];
			if (!procCells) continue;
			const groupId = groupIdx.get(proc.id) ?? '';

			for (const [tpId, cell] of Object.entries(procCells) as [string, Cell][]) {
				if (!cell) continue;
				const phaseId = phaseIdx.get(tpId) ?? '';

				let score = 0;
				const firedIds: string[] = [];
				const byConsequence: Partial<Record<FrictionConsequence, number>> = {};
				for (const r of personaApplicable) {
					if (matchesProcedure(proc, tpId, phaseId, groupId, r.applies_to)) {
						score += r.weight;
						firedIds.push(r.id);
						byConsequence[r.consequence] = (byConsequence[r.consequence] ?? 0) + r.weight;
					}
				}
				if (firedIds.length > 0) {
					const entry: CellFrictionScore = {
						score: clamp01(score),
						fired_rule_ids: firedIds,
						by_consequence: byConsequence,
						dominant: dominantConsequence(byConsequence)
					};
					out[cellKey(proc.id, tpId)] = entry;
				}
			}
		}
	}

	return out;
}

/** Aggregate friction for a procedure-row, used for row-summary visualizations. */
export function rowFriction(
	procedureId: string,
	schedule: Schedule,
	friction: FrictionMap
): { score: number; cell_count: number } {
	const cells = schedule.cells[procedureId];
	if (!cells) return { score: 0, cell_count: 0 };
	let sum = 0;
	let n = 0;
	for (const tpId of Object.keys(cells)) {
		const fs = friction[cellKey(procedureId, tpId)];
		if (!fs) continue;
		sum += fs.score;
		n += 1;
	}
	return { score: n === 0 ? 0 : sum / n, cell_count: n };
}

/** Convenience: bucket a 0..1 friction score into discrete tint levels. */
export function frictionBucket(score: number): 'none' | 'low' | 'med' | 'high' {
	if (score <= 0) return 'none';
	if (score < 0.2) return 'low';
	if (score < 0.45) return 'med';
	return 'high';
}
