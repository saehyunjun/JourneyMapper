# Protocol × Persona Demo — Plan

> Status: **Phase A in progress.** Demo target: place a persona into a study protocol's Schedule of Activities (SoA) and surface persona-specific friction points + suggested protocol modifications.
> Backlog alignment: item **#1** (place a persona into a protocol → simulate sentiment / stress) and a slice of item **#4** (persona attributes as levers → projected operational outcomes).
> Reference data: the C-CAR168 CAR-T-for-LN Schedule of Activities table (provided by Aaron — to be hand-transcribed for the demo).

## Decisions log

| Date | Decision | Source |
|------|----------|--------|
| 2026-05-28 | SoA transcribed from screenshots (not CSV/CT.gov) | Aaron |
| 2026-05-28 | Persona attrs use a `demo_profile` shim block; aggregation deferred | Aaron |
| 2026-05-28 | Route is `/patientlyiq/sim-protocol/[protocol_id]` (renamed from `protocol-fit`) | Aaron |
| 2026-05-28 | Footnote text will be pasted by Aaron; stub for now | Aaron |

## Phase B status — landed 2026-05-28

What's now live (in addition to Phase A):

- Types: [friction-types.ts](src/lib/content/protocols/friction-types.ts); persona `demo_profile` block on [personas/types.ts](src/lib/content/personas/types.ts).
- Data: [friction_rules.json](src/lib/content/protocols/ccar168_ln_phase1/friction_rules.json) (10 rules), `burden_hint` on every procedure in [schedule.json](src/lib/content/protocols/ccar168_ln_phase1/schedule.json), `demo_profile` shim on [ln_sle_carT_curious_patients.json](src/lib/content/personas/ln_sle_carT_curious_patients.json).
- Scoring: [score-friction.ts](src/lib/protocols/score-friction.ts) — pure, deterministic, runs reactively on the client when persona changes.
- UI: cell tints in [ProtocolScheduleView.svelte](src/lib/components/protocol-schedule/ProtocolScheduleView.svelte) (low / med / high orange heat); fired-rules + suggested-mods sections in [ProtocolCellDrawer.svelte](src/lib/components/protocol-schedule/ProtocolCellDrawer.svelte).

Story that works end-to-end: select persona → cells repaint → click a hot cell → drawer shows which rules fired (with weights), which persona attribute drove each, and 1–2 suggested modifications per rule.

What's still deferred:
- Supporting fragments per rule (`evidence_fragment_ids` is wired but empty — the receipts section would query the LN corpus and render verbatim quotes).
- Mod toggle / re-score (Phase C — toggle a mod off and watch downstream friction drop).
- Multi-persona compare (Phase D).

## Phase A status — landed 2026-05-28

What's live at `/patientlyiq/sim-protocol/ccar168_ln_phase1`:

- Data: [protocol.json](src/lib/content/protocols/ccar168_ln_phase1/protocol.json), [schedule.json](src/lib/content/protocols/ccar168_ln_phase1/schedule.json), [footnotes.json](src/lib/content/protocols/ccar168_ln_phase1/footnotes.json) (stubbed).
- Types: [src/lib/content/protocols/types.ts](src/lib/content/protocols/types.ts).
- Server loader: [src/lib/server/protocols.ts](src/lib/server/protocols.ts).
- Components: [ProtocolScheduleView.svelte](src/lib/components/protocol-schedule/ProtocolScheduleView.svelte), [ProtocolCellDrawer.svelte](src/lib/components/protocol-schedule/ProtocolCellDrawer.svelte).
- Route: [+page.svelte](src/routes/patientlyiq/sim-protocol/[protocol_id]/+page.svelte) + [+page.server.ts](src/routes/patientlyiq/sim-protocol/[protocol_id]/+page.server.ts).

What works: sticky two-row header (phase groups → timepoints), sticky procedure column, expand/collapse procedure groups, cell glyphs (●/○/◌/◆), click-cell opens drawer with phase/timepoint/window/status/footnotes, persona picker on the left rail (cosmetic only — no friction overlay yet).

Known thin spots to fix before sharing externally:
- Footnote text is all stubbed. Drawer "Footnotes" section is visibly empty until Aaron pastes.
- A few uncertain transcribed cells flagged via `"conditional"` notes (vaccination, inpatient hospitalization, AEs/concomitant meds) — re-verify against source.
- No persona-driven friction yet — that's Phase B.

---

## 1. What the demo proves

A reviewer should walk away with three concrete realizations:

1. **A protocol is a UI surface, not a PDF.** The same SoA we render as a static table can be made queryable — "where in this schedule does *this kind of patient* get stuck?"
2. **Personas are the lens, fragments are the receipts.** When a cell lights up red, the drawer shows the persona attributes driving the score *and* the corpus fragments that justify those attributes — no hand-wave.
3. **Suggestions are local, cited, and reversible.** Each friction cell carries 1–3 protocol modifications grounded in fragments ("widen D14 window to ±7d — see N comments from out-of-area patients citing travel cost"). The reviewer can toggle a mod on and watch downstream cells recompute.

Out of scope for the demo:
- Modeling real recruitment / retention KPIs (backlog #4 in full).
- Multi-protocol comparison.
- Editing the protocol structure itself — only annotating it.

---

## 2. Why C-CAR168 is the right starting SoA

- Indication = lupus nephritis. We already have a persona — [ln_sle_carT_curious_patients.json](src/lib/content/personas/ln_sle_carT_curious_patients.json) — explicitly built around the CAR-T-for-lupus community thread, spanning the curiosity → eligibility → experience arc. Fragments to back friction claims already exist in the LN corpus.
- The SoA has all the structural pain points worth demoing: a 28-day screening window, leukapheresis, 3-day LD chemo, inpatient hospitalization, ~14 follow-up visits across 24 months, with mixed required/optional/as-needed cells. Friction is not uniform — it clusters.
- Persona ↔ corpus ↔ protocol all line up on `indication = lupus_nephritis`. No cross-indication acrobatics needed.

We will **hand-transcribe one SoA** for the demo. A general ingester is a Phase 3 concern, not demo-blocking.

---

## 3. Data model

New content folder: `src/lib/content/protocols/<protocol_id>/`. For the demo, `<protocol_id> = ccar168_ln_phase1`.

```
src/lib/content/protocols/
  ccar168_ln_phase1/
    protocol.json          # metadata: id, label, indication, phase, sponsor, nct_id?
    schedule.json          # the SoA — procedures × timepoints × cell values
    footnotes.json         # superscript footnotes from the SoA (¹, ², …)
    friction_rules.json    # rule-based scoring inputs (see §5)
  types.ts                 # schemas below
  README.md                # how to add another protocol
```

### `schedule.json` shape

```ts
type Schedule = {
  protocol_id: string;
  phases: Phase[];          // ordered: Screening | Leukapheresis | Baseline | LD | Infusion | Follow-up | ET
  procedure_groups: ProcedureGroup[];
  cells: Record<string, Record<string, Cell>>;  // cells[procedure_id][timepoint_id]
};

type Phase = {
  id: string;                // "screening", "ld", "follow_up", ...
  label: string;
  timepoints: Timepoint[];   // ordered
};

type Timepoint = {
  id: string;                // "d_minus_7", "d0", "m6_to_24_q3m", ...
  label: string;             // "D-7", "D0", "M6-24 (Every 3M)"
  window_days: string | null; // "±1", "±14", "/" → null
};

type ProcedureGroup = {
  id: string;                // "routine_labs", "pk_pd_exploratory", "safety", ...
  label: string;
  procedures: Procedure[];
};

type Procedure = {
  id: string;                // "hematology", "echocardiogram", "ice_testing", ...
  label: string;
  footnote_refs: number[];   // [1, 5] etc.
  burden_hint?: BurdenHint;  // see below — drives default friction weight
};

type BurdenHint = {
  setting: "outpatient" | "inpatient" | "lab_draw" | "imaging" | "biopsy" | "self_report";
  duration_minutes?: number;
  fasting_required?: boolean;
  caregiver_required?: boolean;
};

type Cell =
  | { status: "required" }
  | { status: "optional" }
  | { status: "as_needed" }
  | { status: "conditional"; note: string }   // e.g. "M6, M12, M24"
  | null;                                      // empty cell
```

`burden_hint` is **the bridge from protocol → persona-attribute friction**. Without it the friction model has nothing to score against. For the demo we hand-author burden_hints for the ~25 procedures in the SoA; a normalizer for arbitrary protocols comes later.

### Why CSV is fine as the *source* but not the *runtime* shape

Aaron's question was "if we pulled this into CSV or JSON" — CSV works as a transcription medium (one sheet per phase, rows = procedures, cells = `X` / `opt` / `as_needed` / blank), but the runtime needs the typed structure above. Provide a small loader:

- `scripts/import-protocol-soa.mjs <csv_dir> --out src/lib/content/protocols/<id>/`
- Wide CSV → tall normalized JSON; footnotes from a sidecar `footnotes.csv`.

---

## 4. Component architecture

### What we reuse

- **`RightDrawer`** for the per-cell detail panel — identical pattern to [JourneyMapTableView.svelte](src/lib/components/journey-map/JourneyMapTableView.svelte:23).
- **Fragment rendering** — whatever component renders a fragment in [persona-workbench](src/routes/patientlyiq/persona-workbench/+page.svelte) drops in here unchanged.
- **Persona picker** — the existing [PersonaTopSelector.svelte](src/lib/journeymapper2/PersonaTopSelector.svelte), filtered by `applicable_indications` matching the protocol's indication.
- **Color/sentiment idioms** — `personaColor`, polarity tints, ChevronRight expand affordance — all carry over from `JourneyMapTableView`.

### What's new

```
src/lib/components/protocol-schedule/
  ProtocolScheduleView.svelte     # the table itself
  ProtocolCellDrawer.svelte       # what opens on cell-click — friction breakdown
  PersonaAttributePanel.svelte    # right-rail sliders (Phase B)
  FrictionLegend.svelte           # color scale + what counts as friction
  types.ts                        # local view-model types
```

### `ProtocolScheduleView.svelte` — props

```ts
type Props = {
  schedule: Schedule;
  protocol: ProtocolMeta;
  persona: Persona | null;          // null → show structure only, no friction overlay
  fragmentsById: Record<string, Fragment>;
  frictionByCellId: Record<string, FrictionScore>;  // computed upstream
  showHeader?: boolean;
};
```

### Layout — rows × columns

- **Columns** = phases (grouped header) → timepoints (sub-header). Column-group dividers between phases. Sticky left column for procedure labels; sticky top two header rows on scroll. The grouped-column shape is identical to the source SoA — no novel reading task for the viewer.
- **Rows** = procedure groups (expandable) → procedures. Default-expanded for the demo so the first paint is information-dense (mirrors the open-by-default behavior in [JourneyMapTableView.svelte:101-108](src/lib/components/journey-map/JourneyMapTableView.svelte#L101-L108)).
- **Cells** carry two visual channels:
  1. **Glyph** — `X` (required), `o` (optional), `~` (as_needed), `—` (n/a). Don't repaint the structural meaning, ever.
  2. **Tint** — friction heat (none → red), computed only when a persona is selected. Tint sits in the cell background; glyph stays legible.
- **Click cell** → opens `ProtocolCellDrawer`.

### `ProtocolCellDrawer` — sections

1. **What's happening here.** Procedure label, timepoint, window, footnote text.
2. **Why this is hard for {persona.label}.** Top 3 contributing rules with weights; each rule names the persona attribute it depends on.
3. **Receipts.** 3–8 supporting fragments from the corpus filtered to fragments matching both the persona filter AND a relevant theme/keyword (travel, caregiving, work, cost).
4. **What you could change.** 1–3 suggested protocol modifications (widen window, add telehealth option, add home-health draw, defer optional procedure to next on-site visit). Each mod has a one-line rationale and the rule it would relax.

---

## 5. Friction scoring

This is the part that earns or loses credibility. Keep it **small, transparent, and rule-shaped** — no opaque model.

### Model: weighted rule sum

```ts
type FrictionRule = {
  id: string;
  label: string;                            // shown in the drawer
  applies_to: {
    procedure_ids?: string[];
    procedure_groups?: string[];
    burden_hint?: Partial<BurdenHint>;      // match-any
    phase_ids?: string[];
  };
  persona_predicate: {
    // attribute-on-persona OR aggregate-over-fragments-matching-persona
    attribute?: { key: string; op: "in" | "gte" | "lte" | "eq"; value: unknown };
    fragment_signal?: { theme?: string; keyword?: string; min_count: number };
  };
  weight: number;                           // 0..1, contribution to cell friction
  suggested_mods: ProtocolMod[];            // tied to this rule
  evidence_query?: FragmentQuery;           // what to surface in the drawer
};
```

### How a cell score is computed

```
friction(cell, persona) =
  clamp01(
    Σ rule.weight  for each rule where
      rule.applies_to matches cell.procedure AND
      rule.persona_predicate evaluates true for `persona`
  )
```

That's it. No ML, no learned weights. The whole rule list lives in `friction_rules.json` and is reviewable in seconds.

### Starter rule library (~10 rules for the demo)

| Rule | Triggers on | Persona predicate | Example mod |
|------|------------|-------------------|-------------|
| `distant_inperson_visit` | `setting=outpatient` AND non-window phases (D0, M2, M3) | fragments matching `distance_to_coe` keywords ≥ N | Add home-health draw option |
| `tight_window_consecutive_visits` | adjacent timepoints with window ≤ ±2d | persona has caregiving/work attrs from fragments | Widen window to ±5d |
| `inpatient_stay_needed` | `setting=inpatient` (D14 hospitalization) | fragments mentioning work-flex / caregiving constraints | Document standard inpatient-discharge criteria |
| `imaging_requiring_specialist` | `setting=imaging` (Echo) | rural / distance signal | Permit local imaging with central read |
| `frequent_blood_draws_cluster` | ≥3 lab draws within 7 days | any patient persona | Combine draws into single visit |
| `optional_burden_late_phase` | `status=optional` AND phase=Follow-up | low engagement signal | Default to "skip unless clinical reason" |
| `fasting_required_morning_visit` | `fasting_required=true` AND not D0 | caregiving / work-flex signal | Permit afternoon slot |
| `caregiver_required_visit` | `caregiver_required=true` | fragments citing "no one to bring me" | Pre-arrange transport stipend |
| `pregnancy_test_cadence` | procedure=pregnancy_test, frequency≥monthly | persona attr `sex=female AND childbearing` | Move to home test where regulator permits |
| `psych_burden_ice_cadence` | procedure=ice_testing repeated | fragments citing cognitive fatigue / depression | Spread across two visits |

For the demo, **author 8–10 rules, each backed by ≥3 fragments from the LN corpus**. That gives every red cell at least one paragraph of receipts in the drawer.

### Where the persona attributes come from

This is the honest gap to flag now: today's [ln_sle_carT_curious_patients.json](src/lib/content/personas/ln_sle_carT_curious_patients.json) is **a filter, not a profile** — it doesn't expose attributes like `distance_to_coe_band` or `caregiver_availability`. Two options for the demo:

- **(A) Aggregate over the filtered fragment pool.** Persona "has attribute X" iff ≥N fragments in its filtered pool stated/inferred X. Honest, but slower to author rules against.
- **(B) Add a `demo_profile` block to the persona JSON** with hand-set attribute values. Faster, lets us script the demo precisely, but is admittedly a fake-it-till-you-make-it shim.

Recommend **(B) for the demo with a comment in the persona JSON marking the block as demo-only**, and **(A) as the production path** to be implemented when persona-attribute aggregation lands. The drawer should show *both*: "we asserted `distance_to_coe_band ≥ 200mi` for this persona" + "(grounded in 14 fragments — see receipts)".

---

## 6. Routing & where it lives in the app

New route: `src/routes/patientlyiq/sim-protocol/[protocol_id]/+page.svelte`.

- Page server loads the protocol + the persona list filtered by indication.
- Picks initial persona from URL `?persona=...` or first in list.
- Page calls `scoreSchedule(schedule, persona, rules)` to produce `frictionByCellId`.
- Renders `ProtocolScheduleView` + a right rail with attribute display + suggested-mods summary.

A link from [trial-designer](src/routes/patientlyiq/trial-designer/) into `sim-protocol` is the natural entry point — "designer" picks the levers, "sim-protocol" sees the consequences against a real SoA.

---

## 7. Phased build

**Phase A — Static SoA renders. (½ day)**
- Hand-transcribe C-CAR168 SoA into `schedule.json` (no friction yet).
- Build `ProtocolScheduleView` with sticky headers, expand/collapse groups, glyphs only. Cell click opens an empty drawer scaffold.
- Acceptance: the demo SoA renders pixel-faithful to the source table; cells are clickable.

**Phase B — Persona overlay + drawer with receipts. (1 day)**
- Add `friction_rules.json` (8–10 rules). Implement `scoreSchedule()`.
- Add `demo_profile` to `ln_sle_carT_curious_patients.json` (shimmed).
- `ProtocolCellDrawer` shows rules + fragments + suggested mods.
- Acceptance: picking the persona repaints the SoA; clicking a hot cell shows 3 rules, ≥3 fragments, ≥1 mod.

**Phase C — Mods are toggleable + roll up. (½ day)**
- Toggle a suggested mod → recompute friction → adjacent cells visibly change.
- Right rail summarizes "mods applied (3)" and aggregate friction delta.
- Acceptance: a viewer can take a red cell to yellow by toggling a mod and see the change propagate to ≥1 other cell.

**Phase D — Polish (defer if time-short).**
- A second persona for compare (backlog #2 lite — two-up render).
- Attribute slider micro-interaction (`PersonaAttributePanel`).
- Print/export the modified protocol summary.

**Cut line for a first internal demo: Phase A + B.** That alone tells the story.

---

## 8. Open questions

1. **Footnotes display.** The SoA has 20+ superscript footnotes carrying real clinical detail. Render inline on hover, in the drawer's "What's happening here," or both?
2. **Multiple personas at once.** Demo with a single persona is cleanest. A two-up compare is in the backlog (#2) — defer to Phase D unless Aaron wants it earlier.
3. **Where does the SoA *come from*?** For the demo: hand-transcribed. Long-term: are we expecting structured SoAs from the ClinicalTrials.gov pipeline (they don't generally publish the full SoA), from sponsor documents, or from manual upload? Affects how seriously to build the importer.
4. **Friction visual.** Red→yellow heat overlay vs. small badges in the cell corner. Heat is more glanceable but can clash with the glyph; badge is precise but quieter. I'd start with heat + glyph and tune.
5. **Suggestion provenance.** The "suggested mods" list — are these (a) author-curated per rule (demo path), (b) LLM-generated per cell from persona + fragments (richer but unpredictable), or (c) pulled from a future catalog of common modifications? Author-curated for the demo; flag (c) as the production direction.
6. **Persona attribute schema.** Phase B uses a `demo_profile` shim on the persona JSON. Before this becomes real, the `Persona` type in [src/lib/content/personas/types.ts](src/lib/content/personas/types.ts) needs a first-class attribute model — likely the same three-state `stated | inferred | unknown` shape used for fragment speaker_attrs.

---

## 9. Memory hooks

When this work lands, two existing memories will want updates:

- [[persona-protocol-backlog]] — flag backlog item #1 as "partially demoed" with a link to the route.
- [[fragment-corpus-architecture]] — note that protocols are a *new content type* that consumes the fragment pool but doesn't extend it (no new `content_source`).

A new memory might be worth writing once the friction-rule library exists, so future sessions don't reinvent the rule shape.
