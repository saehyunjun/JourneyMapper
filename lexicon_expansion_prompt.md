# Lexicon Expansion Prompt

A reusable instruction set for expanding `src/lib/content/wctglpdemo-data/keyword_lexicon.json` to cover a new clinical condition (indication). Use it when bringing a new study area into JourneyMapper so the keyword toggle, word cloud, and segment-tag drawer surface clusters appropriate to that condition.

The prompt is written for a human analyst working with an LLM (Claude), but the same rules apply if you edit the JSON by hand.

---

## What you're producing

The lexicon (schema 3.6+) carries a **condition axis**, a **burden axis**, and a **drug FK** alongside the existing theme/subtheme structure. The supporting registries live OUTSIDE the lexicon, under [src/lib/content/registries/](src/lib/content/registries/):

- `registries/therapeutic_areas.json` — MeSH-anchored clinical specialties (e.g. Endocrinology, Allergy and Immunology, Nephrology, Neurology).
- `registries/indications.json` — MeSH-anchored conditions, each linked to one or more `therapeutic_area_ids` (e.g. `lupus_nephritis` → Immunology + Nephrology; `multiple_sclerosis` → Neurology + Immunology).
- `registries/burden_categories.json` — tree-structured patient-burden taxonomy (financial, physical, emotional, regimen, information, social, logistical, quality_of_life — each with leaves).
- `registries/drugs.json` (+ `mechanisms_of_action.json`, `sponsors.json`) — drug entities. Brand and generic names live HERE, not on the cluster (since 3.6 the matcher inlines them from the registry at regex-build time).
- `keyword_lexicon.json` — flat `clusters[]`. Each cluster declares `indications: string[]` (FK into the indication registry), `burden_category_ids: string[]` (FK into the burden registry), `parent_theme` + `parent_subtheme` (FK into `codebook.json`), and an optional `drug_id` (FK into `drugs.json`).

The UI toggles by **indication**. Clusters with `indications: []` (empty array) are CROSS-CUTTING — shown under every toggle. They cover trial mechanics, cost / access, generic decision and adverse-event language, AND patient-experience modalities that are identical across indications (e.g. CAR-T modality clusters: apheresis, lymphodepletion, CRS, ICANS; LTFU retention clusters: visit burden over time, "feeling done," site-relationship continuity).

The things that DO change per condition — the **medications, symptoms, quality-of-life measures, and condition-specific comorbidities** — are what this expansion authors.

## Before you start

Gather:

1. **Indication name + MeSH descriptor.** Look up the MeSH term and unique ID (e.g. *Lupus Nephritis*, `D008181`; *Multiple Sclerosis*, `D009103`). Use the MeSH descriptor verbatim as `mesh_term`.
2. **Therapeutic area(s).** One or more MeSH-anchored specialties the indication belongs to. Reuse entries from `registries/therapeutic_areas.json`; only add a new therapeutic area (e.g. `neurology`, MeSH `D009464`) when no existing one fits.
3. **Standard-of-care drug list.** Generic + brand names + MOA + sponsor + stage + indication FKs for each drug patients commonly name. These rows go into `registries/drugs.json` (not into cluster variants). Then the cluster carries a `drug_id` FK back to the entity.
4. **Source material.** A clinical reference (treatment guideline, recent review article, or expert input) covering: standard-of-care medications, characteristic symptoms, validated quality-of-life instruments, common comorbidities, trial endpoints, and patient-facing language. Patient communities and forums are valuable for variant collection — they surface phrasings clinicians don't use.
5. **TypeScript union update.** Every new id added to `registries/*.json` must also be added to the matching string-literal union in `registries/types.ts` (TherapeuticAreaId, IndicationId, SponsorId, MoaId, DrugId, BurdenCategoryId). Do this in the same PR so downstream consumers stay typesafe.

## Schema cheat sheet

Cluster shape (every field required unless noted):

```json
{
  "id": "ocrelizumab",
  "label": "Ocrelizumab (Ocrevus)",
  "description": "Anti-CD20 B-cell-depleting antibody approved for relapsing and primary progressive MS; 600 mg IV every 6 months.",
  "indications": ["multiple_sclerosis"],
  "burden_category_ids": [],
  "parent_theme": "treatment",
  "parent_subtheme": "treatment_health_history",
  "variants": ["anti-cd20 mab", "b-cell depleting", "every 6 months", "twice a year infusion"],
  "drug_id": "ocrelizumab"
}
```

Cross-cutting cluster shape (CAR-T modality, LTFU, cost, etc.):

```json
{
  "id": "lymphodepletion",
  "label": "Lymphodepletion conditioning",
  "description": "Fludarabine + cyclophosphamide given before CAR-T reinfusion…",
  "indications": [],
  "burden_category_ids": ["physical_side_effects", "emotional_fear"],
  "parent_theme": "treatment",
  "parent_subtheme": "treatment_negative_experiences",
  "variants": ["lymphodepletion", "conditioning chemo", "fludarabine", "flu/cy", "before infusion chemo"]
}
```

Indication registry entry (`registries/indications.json`):

```json
{
  "id": "multiple_sclerosis",
  "label": "Multiple Sclerosis",
  "abbreviation": "MS",
  "mesh_id": "D009103",
  "mesh_term": "Multiple Sclerosis",
  "therapeutic_area_ids": ["neurology", "immunology"],
  "description": "Autoimmune demyelinating disease of the CNS…"
}
```

Drug entity (`registries/drugs.json`):

```json
{
  "id": "ocrelizumab",
  "label": "Ocrelizumab (Ocrevus)",
  "generic_name": "ocrelizumab",
  "brand_names": ["Ocrevus"],
  "moa_id": "anti_cd20",
  "sponsor_id": "roche",
  "stage": "approved",
  "indication_ids": ["multiple_sclerosis"],
  "description": "Anti-CD20 B-cell-depleting antibody…"
}
```

**Important variant rule (since 3.6):** if a cluster carries `drug_id`, do NOT put the generic or brand names in `variants[]` — the matcher inlines them from `drugs.json` at regex-build time. `variants[]` on a drug-cluster is for non-name surface forms (route-of-administration patterns, class shorthands, distinctive patient phrasings like "twice a year infusion"). Variants are SUGGESTION FUEL only — they rank cluster suggestions in the drawer (case-insensitive, hyphen/space runs flexible). They do NOT auto-tag every occurrence; per-instance tag rows live in `keyword_tags.json`.

## Filter category → subtheme mapping

The toggle's "filter categories" (what the analyst sees on the left rail) are surfaced via `parent_subtheme`. When authoring a new indication, use this mapping:

| Filter category               | parent_theme        | parent_subtheme                  |
| ----------------------------- | ------------------- | -------------------------------- |
| **Medications & delivery**    | `treatment`         | `treatment_health_history`       |
| **Symptoms**                  | `condition_specific`| `symptoms`                       |
| **Quality of life**           | `treatment`         | `treatment_positive_experiences` |
| **Comorbidities**             | `condition_specific`| `comorbidities`                  |
| **Labs & disease mechanics**  | `condition_specific`| `condition_knowledge_gaps`       |
| **Self-management**           | `condition_specific`| `medical_self_efficacy`          |
| **Treatment side effects**    | `treatment`         | `treatment_negative_experiences` |
| **Treatment barriers**        | `treatment`         | `treatment_barriers`             |
| **Treatment decision factors**| `treatment`         | `treatment_decision_factors`     |
| **Stigma / social life**      | `condition_specific`| `social_stigma`                  |
| **Peer / advocacy**           | `condition_specific`| `advocacy_peer_groups`           |
| **Condition-specific trial endpoints** | `clinical_trials` | `clinical_trial_knowledge_gaps` |

Cross-cutting facets — cost / insurance / prior auth, trial mechanics (placebo, randomized, dosing schedule), visit logistics, generic decision and adverse-event language, AND patient-experience modalities that don't change with indication (CAR-T modality clusters: apheresis, lymphodepletion, CRS, ICANS, B-cell aplasia, "one-and-done" framing; LTFU retention clusters: visit burden over time, "feeling done," site-relationship continuity, decentralized visits, AE-reporting fatigue) — do **not** get authored per indication. They already exist with `indications: []`. Don't duplicate them.

## Process

### 1. Add the indication to the registry

In `registries/indications.json → items[]`, append the new indication, declaring `id`, `label`, `abbreviation` (nullable), `mesh_id`, `mesh_term`, `therapeutic_area_ids[]`, and a one-sentence `description`. If a therapeutic area is missing, add it to `registries/therapeutic_areas.json` first (with its own MeSH id). Update the matching unions in `registries/types.ts` (`IndicationId`, `TherapeuticAreaId`).

### 1a. (If indication has named drugs) Add the drugs to the drug registry

For each standard-of-care drug patients commonly name, append a row to `registries/drugs.json` with `id`, `label`, `generic_name`, `brand_names[]`, `moa_id`, `sponsor_id` (nullable for generics), `stage`, `indication_ids[]`, and `description`. If the MOA is new, add it to `registries/mechanisms_of_action.json` first. If the sponsor is new, add it to `registries/sponsors.json` first. Update `registries/types.ts` unions (`DrugId`, `MoaId`, `SponsorId`).

### 2. Author the cluster set

Work through the filter categories above. For each:

- **Medications.** One cluster per molecule (or molecule family). Group brand/generic in one cluster (e.g. mycophenolate covers CellCept, Myfortic, MMF). New investigational drugs in active development get their own cluster — patients name them by trial code.
- **Symptoms.** Distinct clusters for distinct signs. Lean toward what patients *say*, not what the EHR says — "foamy urine" outranks "albuminuria" in interviews.
- **Quality of life.** A single condition-specific QoL cluster covering felt impact ("get my life back," "back to normal," "feel like myself"). If validated QoL instruments come up by name (LupusQoL, FACIT-Fatigue), give them their own cluster under labs & disease mechanics.
- **Comorbidities.** Conditions that interact with the primary indication clinically (CKD ↔ lupus nephritis) or experientially (steroid-induced osteoporosis).
- **Labs & disease mechanics.** What clinicians track (eGFR, creatinine, anti-dsDNA, biopsy class). Include patient-portal phrasings ("MyChart," "lab results").
- **Self-management.** Concrete actions patients take (home BP monitoring, sun protection, low-sodium diet, pill organizer).
- **Side effects / barriers / decision factors.** Condition-specific only. Don't recreate generic "cost," "side effects," or "scary" — those are general.

### 3. Author the cluster fields

- **id** — snake_case slug, globally unique across the whole lexicon. Prefix with the indication only when the surface form is ambiguous across conditions (e.g. `ln_hypertension` because `hypertension` could plausibly be a general comorbidity later, or `ms_pain` because pain language differs by condition).
- **label** — display name with the generic in front and brands in parens: `"Ocrelizumab (Ocrevus)"`.
- **description** — one sentence stating what the cluster covers and why it matters in this indication. Empty descriptions are technically allowed but make the drawer's hover-card unhelpful.
- **indications** — `string[]` FK into `registries/indications.json`. Single-element for an indication-scoped cluster (`["multiple_sclerosis"]`), empty array `[]` for cross-cutting. Multi-element arrays let one cluster belong to several indications without duplication (use for genuinely shared concepts only — most "same concept, different context" cases want parallel clusters with different ids).
- **burden_category_ids** — `string[]` FK into `registries/burden_categories.json`. Empty array is valid (unclassified). Populate when the cluster's nature obviously maps (e.g. `lymphodepletion` → `physical_side_effects`, `emotional_fear`; `car_t_caregiver_required` → `logistical_caregiver`, `social_relationships`).
- **parent_theme + parent_subtheme** — FK pair into `codebook.json`. Must resolve.
- **drug_id** (optional) — FK into `registries/drugs.json`. Set only when the cluster maps 1:1 to a specific drug entity (not classes, not non-drug concepts).
- **variants** — lowercase surface forms. Skip generic + brand names if `drug_id` is set (the matcher inlines them from the registry). Otherwise include lay phrasings ("blood in urine," "foamy urine," "feel like myself"), abbreviations patients actually use (`MMF`, `HCQ`, `EDSS`), and class shorthands. Skip morphological inflections that the matcher already handles via the word-boundary rule unless they're irregular. Aim for 5–15 variants per cluster; more for high-traffic concepts.

### 4. Validate

A new cluster is valid when:

- Its `id` does not collide with any existing cluster id (search the whole `clusters[]` array).
- Every entry in `indications[]` is the id of an entry in `registries/indications.json` (or the array is empty).
- Every entry in `burden_category_ids[]` is the id of an entry in `registries/burden_categories.json`.
- Its `(parent_theme, parent_subtheme)` pair exists in `codebook.json`.
- If `drug_id` is set, it resolves against `registries/drugs.json`.
- Every variant is lowercase, trimmed, and ≤ 80 chars.

### 5. Wire it up

Two options:

- **Script (preferred for batches).** Mirror [scripts/migrate-lexicon-ms-cart-ltfu.mjs](scripts/migrate-lexicon-ms-cart-ltfu.mjs) (the current canonical template): assert required registry rows exist, build new clusters as JS arrays, attach `indications` in bulk via `.map`, validate against the codebook + registries, sort, and write through. Keep a `keyword_lexicon.v<N>-backup.json` copy on first run. Bump `meta.schema_version` only when the cluster *shape* changes — pure content additions stay on the current schema.
- **Hand-edit.** For 1–3 ad hoc additions, paste the cluster objects into `clusters[]` directly. Sort the file by (indication-bucket → theme → subtheme → id) afterward for diff hygiene; cross-cutting (`indications: []`) sorts first.

### 6. Regenerate derivatives

After editing the lexicon:

- `node scripts/build-keyword-usage.mjs` to refresh `keyword_usage.json` (the deterministic surface-form census). NOTE: this script's "no variants" validator is currently stale relative to schema 3.6 — drug clusters with empty `variants[]` (brand/generic moved to `drugs.json`) trigger spurious failures. Either patch the validator to skip clusters with `drug_id`, or run the script after temporarily seeding placeholder variants.
- Re-run `scripts/propose-segment-tags.mjs` only if the codebook itself changed; expanding the lexicon alone does not invalidate existing segment tags.

### 7. Reseed the local database — required for any registry change

**Without this, the new indication will not appear in the app's indication dropdown** (and `drugs.json` / `sponsors.json` / `therapeutic_areas.json` additions will not surface either).

```
npm run db:seed
```

Why it's required: the patientlyiq layout's lexicon slice (`src/lib/server/lexicon.ts → getLexiconSlice`) prefers DB-backed indications and therapeutic areas over the JSON registry whenever the DB has any rows. The seed script (`scripts/seed-db.mjs`) is idempotent for local file-based DBs — it deletes `./data/dev.db`, re-applies migrations, and re-INSERTs every registry. Safe to run locally; remote (`libsql://…`) URLs are NOT auto-rebuilt.

Side effect: search-trends data ingested via `npm run db:ingest:search-queries` lives in tables outside the registry seed and **will be lost on reseed**. Re-run that ingest after seeding if you depend on it.

Applies to any change to:

- `registries/indications.json` or `registries/therapeutic_areas.json` (drives the dropdown)
- `registries/drugs.json`, `registries/sponsors.json`, `registries/mechanisms_of_action.json`, `registries/burden_categories.json`, `registries/content_sources.json` (drives FK validation + surfaces downstream)

## Authoring rules of thumb

- **One concept, one cluster.** Drugs from the same molecule family (mycophenolate covers MMF / CellCept / Myfortic) group under one cluster with one `drug_id`. Different molecular targets get different clusters even when used interchangeably (e.g. ACE inhibitors vs. ARBs share a cluster because patients describe them as one category, but cyclophosphamide and mycophenolate get separate clusters because the treatment experience differs).
- **Patient language wins.** "Foamy urine" is more useful than "proteinuria" as a variant — but include both. The matcher is case-insensitive and treats hyphen/space runs flexibly, so don't bother enumerating `"long-term"` and `"long term"` separately.
- **Same surface concept, different parent subtheme = parallel clusters.** If "infection" shows up both as a comorbidity (immune dysfunction from the disease) and as a treatment side effect (immunosuppressed by therapy), make two parallel clusters with different subthemes and different ids. This is by design — see existing `side_effects` vs `side_effects_2`.
- **Modality and trial-phase concepts belong cross-cutting (`indications: []`), not under each indication.** CAR-T patient experience (apheresis, lymphodepletion, CRS, ICANS, B-cell aplasia, "one-and-done") is the same in LN, MS, and onc. LTFU retention friction ("feeling done," site relationship, decentralized visits, AE-reporting fatigue) is the same regardless of indication. Author them ONCE in the cross-cutting bucket.
- **No condition duplication of cross-cutting clusters.** Cost, insurance, prior authorization, trial mechanics, generic adverse-event language already exist with `indications: []` and surface under every toggle automatically.
- **MeSH everywhere indication metadata lives.** The registry is the integration point with external systems (ClinicalTrials.gov, EHR coding). Indication and therapeutic_area entries without MeSH ids are accepted but should be backfilled.

## Worked examples

### Lupus nephritis (the original)

- Therapeutic areas: `immunology` (MeSH D000486) + `nephrology` (MeSH D009396).
- Indication entry: `{ id: "lupus_nephritis", mesh_id: "D008181", therapeutic_area_ids: ["immunology", "nephrology"], … }`.
- ~63 clusters spanning the 12 subthemes above, with cross-cutting clusters (cost, placebo, dosing_schedule, etc.) left as `indications: []`.
- Migration: [scripts/migrate-lexicon-conditions.mjs](scripts/migrate-lexicon-conditions.mjs) (note: predates schema 3.2 array form — written under the old singular `indication` field).

### Multiple sclerosis + CAR-T modality + LTFU (canonical 3.6/3.7 template)

The current canonical template for this expansion pattern is [scripts/migrate-lexicon-ms-cart-ltfu.mjs](scripts/migrate-lexicon-ms-cart-ltfu.mjs). Three coordinated cluster groups landed together:

- **MS as a new indication** (~41 clusters, `indications: ["multiple_sclerosis"]`) — DMTs (anti-CD20, S1P, alpha-4 integrin, fumarates), symptoms (relapse, fatigue, walking, spasticity, optic neuritis, cog fog, bladder/bowel, heat sensitivity, MS hug), labs (MRI lesions, EDSS, ARR, JCV antibody), comorbidities (depression/anxiety, PML), self-management (PT/OT, cooling, symptom journal), barriers (PML/JCV concerns, refractory framing), decision factors (high-efficacy-first vs escalation, DMT discontinuation risk), stigma (invisible disability), advocacy (MS Society), and trial endpoints (CDP, NEDA).
- **CAR-T modality clusters** (~14, `indications: []`) — apheresis, bridging therapy, infusion day, lymphodepletion, CRS, ICANS, B-cell aplasia, inpatient monitoring, required caregiver, specialty-pharmacy navigation, one-and-done appeal, secondary-malignancy concern, long-term unknowns. Authored ONCE because the patient experience is identical across LN, MS, and onc CAR-T.
- **LTFU retention clusters** (~12, `indications: []`) — long follow-up horizon, visit burden over time, "feeling done," caregiver evolution, insurance/life transitions, AE-reporting fatigue, altruism motivator, site/coordinator relationship, remote/decentralized visits, data return to patient, data-sharing preferences, post-trial identity. The retention design surface for 5–15 year LTFU on cell- and gene-therapy programs.

This migration was also the first to coordinate registry adds with cluster adds in a single transactional script: 1 therapeutic area (neurology), 1 indication, 6 sponsors, 3 MOAs, and 8 drugs (5 MS DMTs + 3 investigational CAR-T programs) were added before the lexicon was touched, with the migration asserting those rows exist before doing any cluster work.

## Output deliverables (what "done" looks like)

1. Registry adds in `registries/*.json` (indications, therapeutic_areas, sponsors, mechanisms_of_action, drugs as needed), with matching union updates in `registries/types.ts`.
2. Updated `keyword_lexicon.json` with the new clusters appended; schema bumped only if cluster shape changed.
3. A backup of the prior lexicon at `keyword_lexicon.v<N>-backup.json`.
4. A line in the lexicon's `meta.changelog` summarizing what was added (new indication id, cluster count by subtheme, registry rows asserted).
5. Verification: the segment-tag drawer renders the new indication when toggled, with clusters grouped by parent_subtheme; cross-cutting clusters surface under every toggle; the word cloud at `/wctglpdemo/interview-words` shows the new clusters' variants when transcripts from the new study are loaded.

---

### Prompt template (for an LLM run)

Paste this into a fresh Claude session, fill in the brackets, and attach `keyword_lexicon.json`, `codebook.json`, the relevant `registries/*.json` files, and your clinical reference:

> You are expanding JourneyMapper's keyword lexicon (schema 3.6+) to cover **[indication name]** (MeSH **[mesh_term, mesh_id]**), which belongs to therapeutic areas **[area 1, area 2]**.
>
> Read `keyword_lexicon.json`, `codebook.json`, and the files under `src/lib/content/registries/` (attached). Follow the conventions in `lexicon_expansion_prompt.md` (attached): condition axis (`clusters[].indications: string[]`), burden axis (`clusters[].burden_category_ids: string[]`), drug FK (`clusters[].drug_id` resolves to `registries/drugs.json`), cross-cutting clusters use `indications: []`, generic + brand names on drug clusters live in `drugs.json` not `variants[]`, every cluster needs a valid `(parent_theme, parent_subtheme)` pair.
>
> Produce ONE migration script `scripts/migrate-lexicon-[indication-slug].mjs` modeled on [scripts/migrate-lexicon-ms-cart-ltfu.mjs](scripts/migrate-lexicon-ms-cart-ltfu.mjs) that:
>
> 1. Asserts every required registry row already exists (indication, therapeutic areas, sponsors, MOAs, drugs). Lists them at the top as `REQUIRED_*` arrays.
> 2. Appends a full parallel cluster set for the new indication covering: medications, symptoms, quality-of-life, comorbidities, labs & disease mechanics, self-management, side effects, barriers, decision factors, stigma, peer support, and condition-specific trial endpoints. Skip any facet where you have no condition-specific content — do NOT duplicate cross-cutting clusters.
> 3. Strips any prior clusters whose ids match the new id namespace (idempotency).
> 4. Validates every cluster (id uniqueness, indications[] FKs, burden_category_ids[] FKs, (theme, subtheme) FK, drug_id FK) and exits non-zero on any failure.
> 5. Sorts the final array (cross-cutting first → theme → subtheme → id) and writes canonical field order.
> 6. Writes a `keyword_lexicon.v<N>-backup.json` once if missing.
> 7. Prints a summary by indication and subtheme.
>
> Author 30–80 clusters total. Each cluster: 5–15 lowercase variants (skipping generic/brand if `drug_id` set), one-sentence `description`, snake_case `id` (globally unique), populated `burden_category_ids` only where the mapping is obvious.
>
> Hand-edit the registry adds in `registries/*.json` BEFORE running the migration — also extend the matching string-literal unions in `registries/types.ts`.
