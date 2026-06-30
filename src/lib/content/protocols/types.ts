/**
 * protocols/types.ts
 *
 * A Protocol describes a study's Schedule of Activities (SoA): the
 * procedures performed at each scheduled timepoint. Personas don't enter
 * this layer — they're applied on top (see PROTOCOL_PERSONA_DEMO_PLAN.md
 * §5) to score per-cell friction.
 *
 * Storage layout: src/lib/content/protocols/<protocol_id>/
 *   protocol.json         metadata
 *   schedule.json         the SoA (phases × procedure_groups × cells)
 *   footnotes.json        superscript footnotes from the source table
 *   friction_rules.json   (Phase B) — see types/protocol-friction.ts
 *
 * Cells carry STRUCTURAL semantics only ("required", "optional", "as_needed",
 * "conditional"). Friction is a separate overlay computed at query time.
 */

import type { IndicationId } from '../registries/types';

export type ProtocolId = string;

/** Top-level protocol metadata. Sponsor / NCT are optional so we can land a
 *  demo protocol without claiming a real registration. */
export type ProtocolMeta = {
	id: ProtocolId;
	label: string;
	short_label?: string;
	indication: IndicationId;
	phase?: 'phase_1' | 'phase_1_2' | 'phase_2' | 'phase_2_3' | 'phase_3';
	intervention?: string;
	sponsor?: string | null;
	nct_id?: string | null;
	/** Free-form note rendered under the title. Use for the demo-mode banner. */
	demo_note?: string;
};

/** A phase is a column-group in the SoA header — Screening, LD, Follow-up, etc.
 *  Timepoints are the actual columns. */
export type Phase = {
	id: string;
	label: string;
	timepoints: Timepoint[];
};

export type Timepoint = {
	id: string;
	/** As shown in the source table header. "D-7", "M6-24 (Every 3M)", etc. */
	label: string;
	/** As shown in the "Window (days)" row. "±1", "±14", "/" → null. */
	window_days: string | null;
	/** Optional secondary label (sub-row of header), e.g. "Optional" when the
	 *  whole timepoint column is marked optional. Not currently used. */
	note?: string;
};

/** Hints about what a procedure logistically involves. Drives default friction
 *  weights — without this, persona-attribute rules have nothing to match on.
 *  Hand-authored for the demo; a procedure_burden_lexicon.json is the future
 *  path. */
export type BurdenHint = {
	setting: 'outpatient' | 'inpatient' | 'lab_draw' | 'imaging' | 'biopsy' | 'self_report' | 'admin';
	duration_minutes?: number;
	fasting_required?: boolean;
	caregiver_required?: boolean;
	specialist_required?: boolean;
};

export type Procedure = {
	id: string;
	label: string;
	/** Superscript footnote labels from the source table (e.g. "a", "12"). Letter
	 *  or number is fine — keys are matched as strings into FootnoteMap. */
	footnote_refs: string[];
	burden_hint?: BurdenHint;
	/** Optional one-line plain-English description, shown in the cell drawer's
	 *  "What's happening here" section when no friction rule has more to say. */
	plain_description?: string;
};

export type ProcedureGroup = {
	id: string;
	label: string;
	procedures: Procedure[];
};

/** A cell sits at the intersection of a procedure and a timepoint. */
export type Cell =
	| { status: 'required' }
	| { status: 'optional' }
	| { status: 'as_needed' }
	/** "conditional" carries a note explaining the condition (e.g. "M6, M12,
	 *  M24") — used when the source table writes text into a cell instead of an
	 *  X. The cell still renders as a filled glyph. */
	| { status: 'conditional'; note: string };

/** `cells[procedure_id][timepoint_id]` is the lookup. Sparse — empty cells
 *  are simply absent from the map. */
export type CellMap = Record<string, Record<string, Cell>>;

export type Schedule = {
	protocol_id: ProtocolId;
	phases: Phase[];
	procedure_groups: ProcedureGroup[];
	cells: CellMap;
};

/** Footnote table parsed out of the SoA. Index = superscript number. */
export type FootnoteMap = Record<string, string>;

/** Aggregate shape returned by the server loader. `rules` is empty when the
 *  protocol has no friction_rules.json — the view falls back to a structural
 *  display in that case. */
export type LoadedProtocol = {
	meta: ProtocolMeta;
	schedule: Schedule;
	footnotes: FootnoteMap;
	rules: import('./friction-types').FrictionRule[];
};
