# Refine `registries/burden_categories.json`

You are refining the patient-burden taxonomy — the cross-cutting axis applied to clusters (and, eventually, segments) regardless of indication or source. The current registry was shipped as a v1 draft anchored to the treatment-burden literature (Eton 2012, May 2014, Tran 2015). Your job is to improve labels, granularity, balance, and coverage based on a deeper literature review and judgment.

This prompt is about the **taxonomy itself**. Tagging existing clusters with burden ids is the lexicon prompt's job ([build-keyword-lexicon.md](./build-keyword-lexicon.md), "burden classification pass" mode).

---

## How to use this prompt

The user will hand you a **scope** of one of these shapes:

| Scope | Example |
|---|---|
| **Full review** | "Review the full burden taxonomy. Propose label, granularity, and coverage changes. Reach `status: stable`." |
| **Targeted expansion** | "The emotional dimension is underspecified — add subcategories for shame, helplessness, hope." |
| **Targeted contraction** | "The financial axis has too many leaves. Collapse to 2–3 subcategories that match how patients actually talk." |
| **Literature anchoring** | "Cross-reference against the Treatment Burden Questionnaire (TBQ) and the Multimorbidity Treatment Burden Questionnaire (MTBQ); propose alignment." |
| **Cross-source generalization** | "Audit the taxonomy for fit to social-media + search-activity sources (not just interviews). Flag interview-only assumptions." |

If the scope is "full review" or otherwise broad, plan to surface tradeoffs to the user before committing — don't merge sweeping changes unilaterally.

---

## Repository layout

```
src/lib/content/registries/
├── burden_categories.json     ← you edit this
└── types.ts                   ← BurdenCategoryId union must stay in sync

scripts/
└── migrate-lexicon-burden-slot.mjs   ← validates the burden tree on every run
```

The lexicon migration script (`migrate-lexicon-burden-slot.mjs`) checks that the burden tree has no orphan `parent_id`s, no cycles, and no duplicate ids. Run it after any edit.

---

## Current registry shape

```json
{
  "schema_version": "1.0",
  "status": "draft",
  "description": "Patient burden taxonomy ...",
  "references": ["Eton DT et al. (2012)...", "May CR et al. (2014)...", "Tran VT et al. (2015)..."],
  "items": [
    {
      "id": "financial",
      "label": "Financial burden",
      "parent_id": null,
      "description": "Direct and indirect monetary cost of disease and treatment — out-of-pocket spend, insurance navigation, lost income."
    },
    {
      "id": "financial_out_of_pocket",
      "label": "Out-of-pocket cost",
      "parent_id": "financial",
      "description": "Co-pays, deductibles, uncovered medications and procedures."
    }
  ]
}
```

| Field | Rules |
|---|---|
| `id` | Lowercase snake_case. **Stable** — once shipped, an id is referenced from clusters' `burden_category_ids[]`. Renaming requires a migration; prefer relabeling (changing `label`/`description`) over rename. |
| `label` | Display text (≤80 chars). Sentence case typically. |
| `parent_id` | `null` for top-level categories; otherwise the parent's `id`. Tree must be acyclic and every non-null parent must exist. |
| `description` | One sentence (≤200 chars). Plain language. Avoid clinical jargon unless it's the patient's word. |

### Current 8 × 3-4 structure (33 nodes)

```
financial/
  financial_out_of_pocket
  financial_insurance
  financial_lost_income

physical/
  physical_symptoms
  physical_side_effects
  physical_appearance

emotional/
  emotional_fear
  emotional_grief
  emotional_isolation
  emotional_uncertainty

regimen/
  regimen_adherence
  regimen_monitoring
  regimen_appointments

information/
  information_knowledge_gaps
  information_decision_complexity
  information_navigation

social/
  social_stigma
  social_relationships
  social_disclosure

logistical/
  logistical_travel
  logistical_scheduling
  logistical_caregiver

quality_of_life/
  qol_functional
  qol_independence
  qol_normalcy
```

---

## Naming + structure conventions

- **Top-level ids**: bare category name (`financial`, `physical`, `regimen`, `quality_of_life`).
- **Leaf ids**: prefix with the top-level id followed by a refining suffix (`financial_out_of_pocket`, `regimen_monitoring`). `qol_*` is the established short prefix for `quality_of_life`.
- **Depth**: today the tree is 2 deep. Going deeper (3+) is allowed but should be motivated by either (a) clusters that genuinely need finer granularity, or (b) literature anchoring. Don't deepen for symmetry.
- **Sibling balance**: 3–5 siblings per parent is the sweet spot. Two siblings hint at over-splitting; six+ hint at under-clustering.
- **Patient-oriented labels**: prefer how patients name the experience ("Out-of-pocket cost") over how researchers do ("Direct cost of healthcare"). Description can hold the technical definition.

---

## Literature anchors to consider

When refining, cross-check against these established frameworks:

| Framework | Domains |
|---|---|
| **Eton 2012** (Burden of Treatment) | medical information, medications, monitoring, lifestyle changes, financial impact, social impact, navigating health system |
| **May 2014** (Burden of Treatment Theory) | work of being a patient (sense-making, enacting, mobilizing, monitoring) |
| **Tran 2015** (TBQ — Treatment Burden Questionnaire) | taste/quantity of meds, drug administration, follow-ups, lab tests, financial, paperwork, lifestyle |
| **MTBQ** (Multimorbidity Treatment Burden Questionnaire) | medications, appointments, communication with providers, finances, lifestyle |
| **PROMIS** (Patient-Reported Outcomes Measurement Information System) | physical, mental, social health |
| **PRO-CTCAE** (Cancer side-effect reporting) | symptom severity + interference with daily life |

The current taxonomy borrows from Eton/May/Tran but isn't a one-to-one mapping with any single instrument. Refinement decisions should be explicit about which framework's framing wins where.

---

## Cross-source generalization

The taxonomy must work for content that ISN'T structured interview data — social posts, YouTube transcripts, search queries. That means:

- **Avoid interview-only framing.** A category like "decision_complexity" works in interview transcripts but rarely surfaces in Reddit posts. The label should still resonate when applied to a one-line tweet.
- **Beware of underspecified emotional burdens.** Social media is heavy on emotional content (anger, hope, despair, sarcasm, gratitude). The current `emotional_*` cluster has 4 leaves; a deeper-source review may justify expansion.
- **Mind decisional vs informational.** Search activity surfaces a lot of `information_knowledge_gaps` ("what is..."), but rarely `information_decision_complexity` (which needs internal narrative). The taxonomy should handle both even if the source coverage is asymmetric.

Flag any category that consistently fails to fit a non-interview source.

---

## Refinement workflow

1. **Read the current taxonomy** end-to-end. List which leaves you'd defend as-is, which feel weak, and which are missing.
2. **Pull source material:** the references already cited; one or two literature reviews if the scope is "full review"; a sample of patient-voice content (transcripts, Reddit threads) for cross-source check.
3. **Draft proposed changes** in this order:
   - **Relabels** (changing label/description, keeping id) — lowest blast radius
   - **New leaves** — additive, doesn't break references
   - **New top-level categories** — additive but big editorial signal
   - **Removed leaves** — only if clusters don't reference them yet
   - **Renamed ids** — requires migration; flag for user
4. **Surface tradeoffs** for any structural change before merging. Don't unilaterally restructure the top level.
5. **Update `BurdenCategoryId` union in `types.ts`** for any new ids; remove ids that are no longer in the JSON.
6. **Bump `schema_version`** (1.0 → 1.1 etc.) and consider moving `status` from `"draft"` to `"stable"` if you genuinely think the taxonomy is settled. Otherwise leave as draft.
7. **Validate** by running `node scripts/migrate-lexicon-burden-slot.mjs`.

---

## Validation workflow

```bash
# 1. Tree integrity (no orphans, no cycles, no dupes) + cluster FKs
node scripts/migrate-lexicon-burden-slot.mjs

# 2. TypeScript types (BurdenCategoryId union must match items[].id)
npm run check 2>&1 | grep -E "burden|registries|types\.ts" | head -10
```

---

## Definition of done

- [ ] Every change is motivated (literature, cross-source need, or evidence from cluster review).
- [ ] No id renames without a migration plan flagged to the user.
- [ ] Every `parent_id` resolves; every parent has at least 2 children (or argue why a singleton makes sense).
- [ ] `BurdenCategoryId` union in `types.ts` matches the JSON exactly.
- [ ] `schema_version` bumped; `status` updated honestly (`draft` if more iteration expected; `stable` if you'd defend it).
- [ ] `references[]` updated if new sources informed the work.
- [ ] Validation passes.
- [ ] Summary report produced.

---

## Deliverable format

```
Scope: <what the user asked for>

Changes:
  Relabeled: N nodes
    - <id>: "<old>" → "<new>" (reason)

  Added leaves: M
    - <id> under <parent_id>: <reason>

  Added top-level categories: K
    - <id>: <reason>

  Removed: J (only safe if no clusters reference them)
    - <id>: <reason>

  Renamed ids (REQUIRES MIGRATION — surface to user before merging): L
    - <old_id> → <new_id>: <reason>

References added/updated:
  - <citation>

Schema version: 1.X → 1.Y
Status: draft | stable

Open structural questions for user:
  - <description>

Validation: passed | failed
```

---

## Worked example — adding `emotional_shame` as a new leaf

**Goal:** the `emotional` category has 4 leaves but doesn't capture shame (a strong signal in lupus appearance-stigma transcripts and obesity content). Add a leaf.

**1. Justify.** Cross-reference: `appearance_stigma` cluster currently tags `["physical_appearance", "social_stigma", "emotional_isolation"]`. None of those name shame directly. Patient transcripts use "embarrassed," "ashamed," "hide my face."

**2. Author the leaf:**

Append to `burden_categories.json` `items[]`:
```json
{
  "id": "emotional_shame",
  "label": "Shame",
  "parent_id": "emotional",
  "description": "Internalized judgment about the condition or its visible effects — embarrassment, hiding, self-criticism."
}
```

**3. Update `types.ts`:** add `'emotional_shame'` to the `BurdenCategoryId` union.

**4. Bump schema:**
```json
"schema_version": "1.1"
```

Add a changelog note (optional, in description).

**5. Validate:**
```bash
node scripts/migrate-lexicon-burden-slot.mjs
# Expected: burden_categories.json: OK — 34 nodes, tree validated
```

**6. Surface** in the deliverable: "Added `emotional_shame` under `emotional` — distinct from `emotional_isolation` (felt alone) and `social_stigma` (others' judgment). Recommend retagging `appearance_stigma` cluster to include `emotional_shame`."

---

## Open questions to surface

1. **A proposed change would rename an id** (not relabel) — describe the migration path before doing it.
2. **A top-level category should be split or merged** — surface the tradeoff with examples from real clusters / transcripts.
3. **The literature offers two competing structures** (e.g. Eton's "lifestyle changes" vs. TBQ's split into diet/exercise/social) — present both, recommend one.
4. **Cross-source review surfaces a domain the current taxonomy misses entirely** (e.g. "spiritual burden," "existential burden") — propose, don't add unilaterally.
5. **Status transition** (`draft` → `stable`) — confirm with the user; it's a public signal.

---

## Constraints — what NOT to do

- ❌ Don't rename ids without a migration plan. Cluster references will break.
- ❌ Don't add a top-level category without literature or cross-source justification.
- ❌ Don't deepen the tree beyond 2 levels without a strong reason.
- ❌ Don't add singleton subcategories (one child under a parent).
- ❌ Don't classify clusters with burden ids in this prompt — that's the lexicon prompt's "burden classification pass" mode.
- ❌ Don't modify `types.ts` `BurdenCategoryId` and forget the JSON, or vice versa. They must match.
- ❌ Don't commit on `main`. Work on `data/burden-taxonomy-<scope>`.

---

## Final note

The burden taxonomy is the single most important cross-cutting axis in JourneyMapper's data model — it's what makes social posts, search queries, and interview transcripts comparable. A weak or trendy taxonomy will rot quickly and force expensive retagging later. Default to fewer, more durable categories with clear definitions over more, finer-grained categories that look thorough on paper.

When in doubt, leave it at `status: draft` and surface the open question. The cost of a wrong commit here cascades into hundreds of cluster tags downstream.
