# Refine `codebook.json` — themes + subthemes

You are editing the codebook, JourneyMapper's editorial taxonomy of what kinds of things participants talk about. Every lexicon cluster carries `parent_theme` and `parent_subtheme` FKs into this file, so changes here ripple across hundreds of clusters and every analysis surface in the app. Treat the codebook as a high-blast-radius schema: prefer relabels over restructures, prefer additive changes over removals, and never rename an id without a migration plan.

This prompt complements [`build-keyword-lexicon.md`](./build-keyword-lexicon.md), which authors clusters under existing themes/subthemes. The lexicon prompt explicitly treats the codebook as read-only. Use this prompt when the codebook itself needs to grow or shift.

---

## How to use this prompt

The user will hand you a **scope** of one of these shapes:

| Scope | Example |
|---|---|
| **Add subthemes** | "Add 2–3 subthemes under `condition_specific` to cover provider/clinic experience." |
| **Add a top-level theme** | "Add a 'caregiver' theme — caregiver perspectives are a distinct lens we don't have." |
| **Relabel** | "Rename 'Treatment / Health History' to something less awkward — keep the id." |
| **Source-type split** | "Mark each subtheme as `research_artifact` (interview-only) or `patient_voice` (cross-source). This is foundational for ingesting social/YouTube content." |
| **Structural redesign** | "Audit the codebook for fit to multi-source content. Propose changes." |

Structural redesigns must surface tradeoffs before committing. Adding subthemes is safe; renaming ids is not.

---

## Repository layout

```
src/lib/content/wctglpdemo-data/
├── codebook.json                        ← you edit this
└── keyword_lexicon.json                 ← READ; clusters' parent_theme + parent_subtheme FK here

src/lib/server/
└── lexicon.ts                           ← uses Theme/Subtheme types; verify after edits

scripts/
└── migrate-lexicon-drug-fk.mjs          ← validates (theme, subtheme) FK on every cluster
```

The migration script validates that every cluster's `(parent_theme, parent_subtheme)` pair resolves against the codebook. Run it after every edit.

---

## The codebook shape

```json
{
  "meta": {
    "schema_version": "2.0",
    "...": "..."
  },
  "themes": [
    {
      "id": "treatment",
      "label": "Treatment",
      "description": "The participant's experience of their treatment regimen — what they take, how they live with it, what shapes their continued use.",
      "subthemes": [
        {
          "id": "treatment_health_history",
          "label": "Treatment / Health History",
          "description": "Prior treatments tried, how long they were on them, why they started or stopped...",
          "clusters": []
        }
      ]
    }
  ],
  "emotion_tags": [...]
}
```

| Field | Rules |
|---|---|
| `themes[].id` | Lowercase snake_case. **Stable** — clusters' `parent_theme` references this. Renaming breaks every cluster under the theme. |
| `themes[].label` | Display label. Title case. Relabeling is safe (no FK impact). |
| `themes[].description` | One-paragraph editorial framing. The "what counts as this" description. |
| `themes[].subthemes[].id` | Lowercase snake_case. Conventionally prefixed with the theme id (`treatment_*`, `clinical_trial_*`) but not strictly required. **Stable**. |
| `themes[].subthemes[].label` | Display label. |
| `themes[].subthemes[].description` | Editorial framing. |
| `themes[].subthemes[].clusters` | Legacy field; today the lexicon (not the codebook) holds clusters. Leave as empty array `[]`. |

### Field NOT yet in the schema (but proposed)

| Field | Status | Use |
|---|---|---|
| `themes[].subthemes[].kind` | **proposed** — `"research_artifact" \| "patient_voice"` | Lets the UI filter codebook coverage by source applicability. Research-artifact subthemes (Trial Decision Factors) only fit interview transcripts; patient-voice subthemes (Symptoms, Comorbidities) work for any source. |

If the scope is "source-type split," add this field to every subtheme. Update `Subtheme` type in `src/lib/server/lexicon.ts` accordingly. If the scope is anything else, don't unilaterally introduce new fields.

---

## Current codebook contents

**3 themes × 21 subthemes (total).** Cluster counts per subtheme (as of writing) are in the [lexicon prompt](./build-keyword-lexicon.md#the-codebook-is-fixed--21-theme-subtheme-pairs); the relevant signal:

| Theme | Subthemes | Cluster counts |
|---|---|---|
| `treatment` | 7 subthemes | 73 clusters total — `treatment_health_history` (27) and `treatment_barriers` (20) are the heavy ones; `treatment_knowledge_gaps` (2), `diagnostic_odyssey` (0) are nearly empty |
| `clinical_trials` | 8 subthemes | 33 clusters total — `trial_motivators` (20) and `trial_barriers` (9) carry most; the rest (`trial_decision_factors`, `trial_positive_experiences`, `trial_negative_experiences`, `clinical_trial_awareness`, `clinical_trial_interest`) are empty |
| `condition_specific` | 6 subthemes | 75 clusters total — `medical_self_efficacy` (26), `comorbidities` (20), `symptoms` (17) dominate; `social_stigma` (3), `advocacy_peer_groups` (2) are sparse |

**Sparse subthemes** are NOT codebook problems — they're cluster-authoring opportunities for the lexicon prompt. The codebook should grow only when concepts genuinely don't fit any existing (theme, subtheme) pair.

---

## Editing operations — ranked by blast radius

| Operation | Safe? | Notes |
|---|---|---|
| Relabel (`label`, `description`) | ✅ Safe | No FK impact. Bump `meta.schema_version`. |
| Add subtheme | ✅ Safe | Pure addition. Clusters can opt in. |
| Add theme | ⚠️ Moderate | Pure addition but a strong editorial signal. Surface tradeoffs first. |
| Add `kind` field (source-type split) | ⚠️ Moderate | New field is additive but requires `Subtheme` type update + downstream awareness. |
| Reorder subthemes | ✅ Safe | UIs sort by id or label; reordering is cosmetic. |
| Move a subtheme to a different theme | ❌ Risky | Changes the (theme, subtheme) pair; every cluster under it must update. Treat as rename. |
| Remove a subtheme | ❌ Risky | Clusters under it must move first. Fail-loud during migration. |
| Rename an id | ❌ Risky | Every cluster's FK must update. Migration required. |
| Remove a theme | ❌ Risky | Same as removing every subtheme under it. |

---

## Editing workflow

### Adding a subtheme

1. **Pick the parent theme.** Confirm the new subtheme fits under exactly one of `treatment`, `clinical_trials`, `condition_specific`. If it doesn't fit, that's a signal to add a new theme — surface to user.
2. **Author the subtheme:**
   ```json
   {
     "id": "treatment_provider_experience",
     "label": "Provider / Clinic Experience",
     "description": "How the participant experiences their care team — communication, continuity, trust, friction with administration.",
     "clusters": []
   }
   ```
3. **Append** to the parent theme's `subthemes[]`. Don't reorder existing siblings.
4. **Validate** by running the cluster FK migration.

### Adding a theme

1. **Justify.** A new theme is a strong editorial signal that the existing three (Treatment, Clinical Trials, Condition-Specific) don't cover something. Surface to the user before committing.
2. Walk the same author/append/validate flow.

### Relabeling

Update `label` and/or `description`. Don't touch `id`. Bump `meta.schema_version` (e.g. 2.0 → 2.1).

### Source-type split (research_artifact vs patient_voice)

This is a one-time refactor when scope calls for it. Workflow:

1. **Author the classification.** For each subtheme:
   - `patient_voice`: concept can be expressed by a patient in any source — symptoms, comorbidities, side effects, fears, hopes, treatments tried, costs experienced, family impact.
   - `research_artifact`: concept presumes a research probe — "Trial Decision Factors", "Treatment Knowledge Gaps" (in the "what they don't know" framing), "Diagnostic Odyssey" (rare in social posts).
2. **Add the field** to every subtheme:
   ```json
   { "id": "...", "label": "...", "kind": "patient_voice" | "research_artifact", ... }
   ```
3. **Update `Subtheme` type** in `src/lib/server/lexicon.ts`:
   ```ts
   export type Subtheme = {
     id: string;
     label?: string;
     description?: string;
     kind?: 'patient_voice' | 'research_artifact';
   };
   ```
4. **Bump schema_version** to 2.1 (or 3.0 if calling it a structural shift).
5. **Validate** and run typecheck.

Typical split (as a starting proposal — surface to user before committing):

| Subtheme | Kind |
|---|---|
| `treatment_health_history` | patient_voice |
| `diagnostic_odyssey` | patient_voice |
| `treatment_positive_experiences` | patient_voice |
| `treatment_negative_experiences` | patient_voice |
| `treatment_knowledge_gaps` | research_artifact |
| `treatment_barriers` | patient_voice |
| `treatment_decision_factors` | research_artifact |
| `clinical_trial_awareness` | patient_voice (social mentions, news, ads) |
| `clinical_trial_interest` | patient_voice |
| `clinical_trial_knowledge_gaps` | research_artifact |
| `trial_motivators` | patient_voice |
| `trial_barriers` | patient_voice |
| `trial_positive_experiences` | patient_voice |
| `trial_negative_experiences` | patient_voice |
| `trial_decision_factors` | research_artifact |
| `condition_knowledge_gaps` | research_artifact |
| `symptoms` | patient_voice |
| `comorbidities` | patient_voice |
| `social_stigma` | patient_voice |
| `advocacy_peer_groups` | patient_voice |
| `medical_self_efficacy` | patient_voice |

This is a starting draft — confirm with the user.

---

## Validation workflow

```bash
# 1. Cluster (theme, subtheme) FKs must resolve
node scripts/migrate-lexicon-drug-fk.mjs

# 2. Burden migration also validates cluster shape end-to-end
node scripts/migrate-lexicon-burden-slot.mjs

# 3. TypeScript types — particularly important if you added a field
npm run check 2>&1 | grep -E "codebook|lexicon\.ts|keywords\.ts|Theme|Subtheme" | head -10
```

If you added or modified the `Subtheme` type, also confirm the `KeywordOrbit`, `ThemeHeatmap`, and analysis-page components still type-check.

---

## Definition of done

- [ ] Every change is motivated (cluster pressure, source-type need, or literature/editorial signal).
- [ ] No id renames without a migration plan flagged to the user.
- [ ] No subtheme removals without first moving clusters elsewhere.
- [ ] `Subtheme` / `Theme` types in `lexicon.ts` match the JSON if you added fields.
- [ ] `meta.schema_version` bumped.
- [ ] Both validation scripts pass.
- [ ] `npm run check` shows no new errors.
- [ ] Summary report produced.

---

## Deliverable format

```
Scope: <what the user asked for>

Changes:
  Relabeled: N
    - <id>: "<old>" → "<new>"

  Added subthemes: M
    - <parent_id> / <new_id>: <one-line reason>

  Added themes: K
    - <new_id>: <one-line reason>

  New fields:
    - <field_name> on <where>: <values>

  Type updates:
    - <type> in <path>: <change>

Schema version: <old> → <new>

Pending downstream work:
  - Cluster authoring under new subthemes (delegate to lexicon prompt)
  - <other>

Validation: passed | failed
```

---

## Worked example — adding a `treatment_provider_experience` subtheme

**Goal:** patients talk a lot about their care team. None of the existing `treatment_*` subthemes capture provider experience cleanly. Add one.

**1. Check existing fit.** `treatment_positive_experiences` and `treatment_negative_experiences` capture outcomes but not the relationship with the provider. `treatment_decision_factors` overlaps but is decision-specific, not experience-broad. A dedicated subtheme is justified.

**2. Author:**

Append to `themes` → `treatment` → `subthemes`:
```json
{
  "id": "treatment_provider_experience",
  "label": "Provider / Clinic Experience",
  "description": "How the participant experiences their care team — communication, continuity, trust, friction with administration.",
  "clusters": []
}
```

**3. Bump schema_version:** `"2.0"` → `"2.1"`.

**4. Validate:**
```bash
node scripts/migrate-lexicon-drug-fk.mjs
# Expected: pass; cluster counts unchanged.
```

**5. Report:**

```
Scope: add 'treatment_provider_experience' subtheme

Added subthemes: 1
  - treatment / treatment_provider_experience: Patient transcripts surface provider trust, communication, and continuity as a distinct dimension not captured by the existing seven treatment subthemes.

Schema version: 2.0 → 2.1

Pending downstream work:
  - Lexicon clusters under treatment/treatment_provider_experience (delegate to lexicon prompt with mode: subtheme-expansion)

Validation: passed
```

---

## Open questions to surface

1. **A proposed change would rename an id** — surface the migration plan (which clusters need to move, how many) before doing it. The user decides whether the cleanup is worth the FK churn.
2. **A subtheme could belong to two different themes** (e.g. "Trial Cost" could fit under `treatment/treatment_barriers` or `clinical_trials/trial_barriers`). Surface both and let the user pick.
3. **Adding a top-level theme** — this is a significant editorial expansion. Frame the tradeoff: more discoverability (the analyst sees the new dimension) vs more dilution (clusters scatter across more buckets).
4. **A subtheme would only ever contain 1–2 clusters in scope** — propose merging into a sibling instead.
5. **The `kind` split disagrees with the user's intuition** — surface the proposed assignment and accept their override.

---

## Constraints — what NOT to do

- ❌ Don't rename ids without a migration plan. Cluster FKs break.
- ❌ Don't remove themes or subthemes that have clusters under them. Move the clusters first.
- ❌ Don't add subthemes whose definitions overlap heavily with existing siblings.
- ❌ Don't add a new field without updating the `Subtheme`/`Theme` types in `src/lib/server/lexicon.ts`.
- ❌ Don't classify subthemes as `research_artifact` unilaterally — the split changes which UIs surface which subtheme; confirm with user.
- ❌ Don't author clusters in this prompt. That's the lexicon prompt's job. Codebook = taxonomy; lexicon = content under the taxonomy.
- ❌ Don't commit on `main`. Work on `data/codebook-<scope>`.

---

## Final note

The codebook is the editorial spine. A clean codebook makes the lexicon coherent, the UI navigable, and cross-indication comparison possible. A bloated codebook (40+ subthemes, fine-grained splits) dilutes signal and makes cluster authoring confusing. When in doubt, leave the codebook as-is and use the lexicon's flexibility instead — multi-tag, descriptive labels, well-curated variants will do more than another subtheme almost every time.
