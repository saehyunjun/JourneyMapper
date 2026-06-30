# Codebook Taxonomy — Strawman v0.2

**Status:** draft for review · 2026-06-01
**Owner:** Aaron Jun
**Supersedes:** the implicit 3-theme codebook in [codebook.json](src/lib/content/wctglpdemo-data/codebook.json) once accepted.

A **theme** is a typed bucket that a span of patient/caregiver text can be tagged with. A span carries **0..N theme tags across multiple axes** — the same word can be tagged `hrqol.bodily_pain` AND `util.diagnostic_journey` when the speaker means both. The matcher SUGGESTS; the tagger DECIDES. This contract removes the matcher-priority problem: drug entities and theme clusters can match the same span and coexist as tags.

The codebook is organized into **axes**. Each axis has its own provenance (the published framework it's derived from). Themes within an axis are mutually distinguishable; themes across axes are independent. Where the same semantic dimension repeats across axes (e.g. financial friction at the system level, the trial level, and the household level), we use a **standardized suffix vocabulary** so cross-axis queries are structural rather than enumerative.

---

## Cross-cutting suffix matrix

Standardized suffixes let queries like "show me all financial friction" become wildcard-shaped (`*.financial`) instead of "list every theme that touches money." The matrix is extensible — new suffixes earn their spot by appearing on more than one axis.

| Suffix          | `hrqol.*` (internal)     | `util.*` (system)                       | `trial.*` (pipeline)        | `life.*` (household)     |
| --------------- | ------------------------ | --------------------------------------- | --------------------------- | ------------------------ |
| `.financial`    | —                        | `coverage` + `insurance` (split)        | `trial.financial`           | `life.financial`         |
| `.logistics`    | —                        | `access` + `coordination`               | `trial.logistics`           | (implicit — time, childcare) |
| `.relationship` | `social_functioning`     | `relationship`                          | `trial.relationship`        | `caregiver`              |

---

## The four universal axes + one overlay

### 1. HRQoL — `hrqol.*`

- **Provenance:** SF-36v2. Drafted in [codebook.sf36v2.json](src/lib/content/wctglpdemo-data/codebook.sf36v2.json). PROMIS-29 reserved for future extension.
- **Captures:** how the patient's body, mind, and daily function are doing.
- **Doesn't capture:** anything system-side — wait times, insurance, trial logistics, cost barriers.

All 8 SF-36v2 scales:

| ID                            | Captures                                                              |
| ----------------------------- | --------------------------------------------------------------------- |
| `hrqol.physical_functioning`  | Mobility, lifting, walking, self-care, basic physical activities      |
| `hrqol.role_physical`         | Physical health limiting work or daily role activities                |
| `hrqol.bodily_pain`           | Pain intensity, frequency, interference with normal work              |
| `hrqol.general_health`        | Self-rated health, perceived current state, expected trajectory       |
| `hrqol.vitality`              | Energy, fatigue, exhaustion, feeling worn out                         |
| `hrqol.social_functioning`    | Health interfering with social activities and relationships           |
| `hrqol.role_emotional`        | Emotional state limiting work or daily role activities                |
| `hrqol.mental_health`         | Anxiety, depression, calm, mood, behavioral-emotional control         |

### 2. Healthcare utilization & patient experience — `util.*`

- **Provenance:** AHRQ-inspired (National Healthcare Quality and Disparities framework). We do not adhere strictly — themes are organized for analyst usability in patient text, not for instrument fidelity.
- **Captures:** how the patient interacts with the care system — getting to care, navigating coverage, diagnostic journey, trust, coordination.
- **Doesn't capture:** symptom or functional impact (those are `hrqol.*`).

| ID                          | Captures                                                                              |
| --------------------------- | ------------------------------------------------------------------------------------- |
| `util.access`               | Getting to care — geographic distance, appointment availability, finding a specialist, in-network gating |
| `util.coverage`             | What the plan does/doesn't include — formulary, benefits design, covered vs. uncovered services |
| `util.insurance`            | Carrier behavior — denials, prior-auth battles, appeals, claim disputes               |
| `util.relationship`         | Patient-provider trust, communication, being heard vs. dismissed                      |
| `util.coordination`         | Handoffs between providers, records continuity, conflicting medical advice            |
| `util.diagnostic_journey`   | Time to diagnosis, misdiagnosis loops, specialist hunt, second opinions               |
| `util.decision_support`     | Patient information adequacy, weighing options, self-research, shared-decision capacity, decision regret |

**On `util.coverage` vs. `util.insurance`:** patients often conflate plan design ("not covered") with carrier behavior ("they denied it"). Multi-tag both when the line is fuzzy. The split matters analytically — "fix the formulary" and "fix the prior auth process" are different recommendations.

**On `util.decision_support` vs. `util.relationship`:** `util.relationship` is provider-side — how the conversation went, whether the patient felt heard. `util.decision_support` is patient-side — whether they had what they needed to choose (information adequacy, self-research, weighing). The patient-side and provider-side often co-occur in the same span; multi-tag both. A future cross-cutting `.decision` suffix could link `util.decision_support` to `trial.enrollment` if the matrix accrues that pattern.

### 3. Clinical trial journey — `trial.*`

- **Provenance:** CONSORT stages + sponsor funnel taxonomy. Most directly CRO-client-facing.
- **Captures:** anything trial-specific — awareness through post-trial transition.
- **Doesn't capture:** general healthcare utilization unless the speaker frames it in trial context.

| ID                    | Captures                                                                |
| --------------------- | ----------------------------------------------------------------------- |
| `trial.awareness`     | Knowing trials exist; how patients hear about them                      |
| `trial.eligibility`   | Criteria fit, exclusion frustration, age/biomarker gates                |
| `trial.enrollment`    | Consent, decision-to-join, weighing pros/cons                           |
| `trial.logistics`     | Washout, visit cadence, diary compliance, protocol burden               |
| `trial.relationship`  | Coordinator, PI, site staff interactions; trust gaps                    |
| `trial.retention`     | During-trial sentiment; what makes patients stay or drop                |
| `trial.post_trial`    | LTFU tail, access after the trial closes, transition to standard of care|
| `trial.financial`     | Stipends, hidden costs, post-trial drug access economics                |

### 4. Practical / caregiver life domain — `life.*`

- **Provenance:** composite — economic-burden literature + caregiver-burden scales (Zarit, CRA). SF-36 social_functioning is too narrow to carry these alone.
- **Captures:** the part of illness that's neither symptom nor system — money, work, family, identity.
- **Doesn't capture:** clinical symptoms (HRQoL) or interactions with the care system (utilization).

| ID                | Captures                                                                                    |
| ----------------- | ------------------------------------------------------------------------------------------- |
| `life.financial`  | Household-level economic fallout — out-of-pocket, lost wages, debt, medicine-vs-groceries   |
| `life.occupation` | Job accommodations, school absenteeism, forced early retirement, career disruption          |
| `life.caregiver`  | Spousal strain, family role reversals, caregiver burnout, child/partner impact              |
| `life.identity`   | Sense of self, future-self, hope, fear, faith, existential grief                            |

### 5. Disease-specific overlay — `dx.<indication>.*`

- **Provenance:** per-indication, analyst-authored.
- **Captures:** disease-specific behaviors that cannot be cleanly abstracted by the four universal axes — e.g. `dx.lupus_nephritis.cart_ltfu`, `dx.iga_nephropathy.flare_cycle`, `dx.obesity.glp1_rebound`.

**The Safety Gate (when to use `dx.*`):**

> If a text snippet says "I have terrible nausea from my chemo," it belongs in `hrqol.bodily_pain` (or your entity layer). It only graduates to a `dx.*` tag if **the unique mechanism of that specific disease state completely alters how the data must be interpreted by the sponsor.**

The overlay is the last resort, not the first. If it could plausibly fit a universal axis, it goes there.

---

## Final shape

| Axis      | Count | Themes                                                                                         |
| --------- | ----- | ---------------------------------------------------------------------------------------------- |
| `hrqol.*` | 8     | physical_functioning, role_physical, bodily_pain, general_health, vitality, social_functioning, role_emotional, mental_health |
| `util.*`  | 7     | access, coverage, insurance, relationship, coordination, diagnostic_journey, decision_support  |
| `trial.*` | 8     | awareness, eligibility, enrollment, logistics, relationship, retention, post_trial, financial  |
| `life.*`  | 4     | financial, occupation, caregiver, identity                                                     |
| `dx.<indication>.*` | (variable) | Per-indication; gated by the Safety Gate                                          |

**27 universal themes** + indication overlays. Small enough to memorize, tight per axis, full provenance maintained.

---

## Per-instance multi-tagging contract

A span gets `0..N` theme IDs from any combination of axes. Example, the sentence:

> "The pain of losing my job and the pain of this disease are both wearing me down."

| Span                         | Theme IDs                                          |
| ---------------------------- | -------------------------------------------------- |
| `pain of losing my job`      | `life.occupation`, `life.financial`, `hrqol.mental_health` |
| `pain of this disease`       | `hrqol.bodily_pain`                                |
| `wearing me down`            | `hrqol.vitality`                                   |

The two "pain" tokens get different theme assignments because the analyst reads context. The matcher's job is to surface candidates from surface-form overlap; the tagger UI must support multi-select per span.

---

## Schema sketch

```ts
type ThemeAxisId =
  | 'hrqol'
  | 'util'
  | 'trial'
  | 'life'
  | `dx.${IndicationId}`;

/** Cross-axis suffix vocabulary. Reuse before inventing — same suffix
 *  should mean roughly the same dimension across axes. */
type ThemeSuffix =
  | 'financial'
  | 'logistics'
  | 'relationship'
  | 'access'
  | string; // not enforced; convention only

type Theme = {
  id: string;                    // 'hrqol.bodily_pain' | 'util.coverage'
  axis: ThemeAxisId;
  label: string;                 // 'Bodily pain'
  provenance: {
    frame: 'sf36v2' | 'promis29' | 'ahrq' | 'cahps' | 'consort'
         | 'zarit' | 'cra' | 'inspired' | 'analyst';
    citation?: string;
  };
  captures: string;              // one-line "what this catches"
  excludes?: string;             // optional "what this does NOT catch"
  surface_form_hints: string[];  // suggestion fuel for matcher; NOT authoritative
};

type ThemeTag = {
  segment_id: string;
  span: { start: number; end: number; text: string };
  theme_id: string;              // FK to Theme.id
  tagger: 'human' | 'llm-proposed' | 'llm-accepted';
  confidence?: number;           // for LLM-proposed
  created_at: string;
};
```

`surface_form_hints` is suggestion fuel only — same role as today's keyword lexicon variants. Per-instance theme assignment lives in `ThemeTag` rows, not in matcher output.

---

## Rules for adding themes

1. **Themes have provenance.** Every new theme cites a frame, OR gets a writeup if `frame: 'analyst'` or `'inspired'`.
2. **Extend before adding.** If a new concept fits as a subtheme of an existing theme, prefer that. New top-level themes need explicit justification.
3. **Universal axes are append-only.** Once an axis is in production, themes are added carefully and slowly. Renames break analyses downstream.
4. **Disease overlays evolve freely** — they're indication-scoped and don't affect cross-indication comparison.
5. **Drugs, sponsors, biomarkers, named-symptoms are NOT themes.** They're entities (registry layer) that cross-link TO themes. Don't add `Dapagliflozin` as a theme; add it as a Drug entity that links to `hrqol.general_health` and `util.coverage`.
6. **Reuse cross-cutting suffixes.** If a new theme would carry a `.financial`, `.logistics`, or `.relationship` dimension, use that suffix — don't invent a synonym. New suffixes earn their spot by appearing on more than one axis.

---

## Open decisions

- **PROMIS-29 vs. SF-36v2.** Stay on SF-36v2 (already drafted) or graduate to PROMIS-29 later? Run both in parallel?
- **Caregiver burden frame.** Zarit (caregiver-rated), CRA, or sponsor-specific? Affects whether `life.caregiver` splits into sub-themes.
- **Provenance enforcement.** Runtime check that every Theme has a frame, or convention-only?
- **Compatibility shim.** Keep `cluster_id` as a derived alias during migration, or hard-cut on a release?
- **`trial.experience` as a separate theme.** Currently rolled into `trial.retention`. If during-trial sentiment becomes a frequent slice on its own, may need to split.

---

## What this doc does NOT decide

- **The entity layer schema** (Drug, Biomarker, Symptom, Concept) — see [ENTITY_REGISTRY.md](ENTITY_REGISTRY.md). Entities cross-link TO themes here; their own structure is settled there.
- **Migration sequencing, back-compat shim, phased rollout** — see [CODEBOOK_MIGRATION_PLAN.md](CODEBOOK_MIGRATION_PLAN.md).
- **The tagger UI changes** — multi-select per span is implied but its UI sketch is a separate artifact (deferred until after data-model docs settle).
- **Stats aggregation rules** — min-N gates, axis-level rollups, suffix-wildcard queries (`*.financial`). Architectural implications only; specifics deferred.
