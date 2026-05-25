# Lexicon Expansion Prompt

A reusable instruction set for expanding `src/lib/content/wctglpdemo-data/keyword_lexicon.json` to cover a new clinical condition (indication). Use it when bringing a new study area into JourneyMapper so the keyword toggle, word cloud, and segment-tag drawer surface clusters appropriate to that condition.

The prompt is written for a human analyst working with an LLM (Claude), but the same rules apply if you edit the JSON by hand.

---

## What you're producing

The lexicon (schema 3.1+) carries a **condition axis** alongside the existing theme/subtheme structure:

- `meta.therapeutic_areas[]` — MeSH-anchored clinical specialties (e.g. Endocrinology, Allergy and Immunology, Nephrology).
- `meta.indications[]` — MeSH-anchored conditions, each linked to one or more therapeutic areas (e.g. `lupus_nephritis` → Immunology + Nephrology).
- `clusters[]` — flat list of keyword clusters. Each cluster declares an `indication` FK plus a `parent_theme` + `parent_subtheme` FK pair into `codebook.json`.

The UI toggles by **indication**. Clusters with `indication: "general"` are shown under *every* toggle — they are the cross-cutting concerns (trial mechanics, cost / access, generic decision and adverse-event language) that don't change when the condition changes. The things that **do** change per condition — the **medications, symptoms, quality-of-life measures, and condition-specific comorbidities** — are what this expansion authors.

## Before you start

Gather:

1. **Indication name + MeSH descriptor.** Look up the MeSH term and unique ID (e.g. *Lupus Nephritis*, `D008181`). Use the MeSH descriptor verbatim as `mesh_term`.
2. **Therapeutic area(s).** One or more MeSH-anchored specialties the indication belongs to. Reuse entries from `meta.therapeutic_areas[]` where possible; only add a new therapeutic area when no existing one fits.
3. **Source material.** A clinical reference (treatment guideline, recent review article, or expert input) covering: standard-of-care medications (with brand and generic names), characteristic symptoms, validated quality-of-life instruments, common comorbidities, trial endpoints, and patient-facing language. Patient communities and forums are valuable for variant collection — they surface phrasings clinicians don't use.

## Schema cheat sheet

Cluster shape (every field required unless noted):

```json
{
  "id": "voclosporin",
  "label": "Voclosporin (Lupkynis)",
  "description": "Calcineurin inhibitor approved 2021 for active lupus nephritis…",
  "indication": "lupus_nephritis",
  "parent_theme": "treatment",
  "parent_subtheme": "treatment_health_history",
  "variants": ["voclosporin", "lupkynis"]
}
```

Indication registry entry:

```json
{
  "id": "lupus_nephritis",
  "label": "Lupus Nephritis",
  "mesh_id": "D008181",
  "mesh_term": "Lupus Nephritis",
  "therapeutic_areas": ["immunology", "nephrology"],
  "description": "Kidney manifestation of SLE…"
}
```

Variants are SUGGESTION FUEL — they rank cluster suggestions in the drawer (case-insensitive, hyphen/space runs flexible). They do **not** auto-tag every occurrence; per-instance tag rows live in `keyword_tags.json`.

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

Cross-cutting facets — cost / insurance / prior auth, trial mechanics (placebo, randomized, dosing schedule), visit logistics, generic decision and adverse-event language — do **not** get authored per indication. They already exist under `indication: "general"`. Don't duplicate them.

## Process

### 1. Add the indication to the registry

In `keyword_lexicon.json → meta.indications[]`, append the new indication, declaring `id`, `label`, `mesh_id`, `mesh_term`, `therapeutic_areas[]`, and a one-sentence `description`. If a therapeutic area is missing, add it to `meta.therapeutic_areas[]` first (with its own MeSH id).

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

- **id** — snake_case slug, globally unique across the whole lexicon. Prefix with the indication only when the surface form is ambiguous across conditions (e.g. `ln_hypertension` because `hypertension` could plausibly be a general comorbidity later).
- **label** — display name with the generic in front and brands in parens: `"Voclosporin (Lupkynis)"`.
- **description** — one sentence stating what the cluster covers and why it matters in this indication. Empty descriptions are technically allowed but make the drawer's hover-card unhelpful.
- **variants** — lowercase surface forms. Include: generic name, common brand names (one per molecule family), the abbreviation if patients use it (`MMF`, `HCQ`), and the lay phrasings ("blood in urine," "foamy urine," "feel like myself"). Skip morphological inflections that the matcher already handles via the word-boundary rule unless they're irregular. Aim for 5–15 variants per cluster; more for high-traffic concepts (medications, weight-style outcomes).

### 4. Validate

A new cluster is valid when:

- Its `id` does not collide with any existing cluster id (search the whole `clusters[]` array).
- Its `indication` is the id of an entry in `meta.indications[]`.
- Its `(parent_theme, parent_subtheme)` pair exists in `codebook.json`.
- Every variant is lowercase, trimmed, and ≤ 80 chars.

### 5. Wire it up

Two options:

- **Script (preferred for batches).** Mirror `scripts/migrate-lexicon-conditions.mjs`: build the new clusters as a JS array, attach `indication` in bulk via `.map`, validate against the codebook, and write through. Keep a `keyword_lexicon.v<N>-backup.json` copy on first run.
- **Hand-edit.** For 1–3 ad hoc additions, paste the cluster objects into `clusters[]` directly. Sort the file by (indication, parent_theme, parent_subtheme, id) afterward for diff hygiene.

### 6. Regenerate derivatives

After editing the lexicon:

- `node scripts/build-keyword-usage.mjs` to refresh `keyword_usage.json` (the deterministic surface-form census).
- Re-run `scripts/propose-segment-tags.mjs` only if the codebook itself changed; expanding the lexicon alone does not invalidate existing segment tags.

## Authoring rules of thumb

- **One concept, one cluster.** Brand names and generics group under one cluster. Different molecular targets get different clusters even when used interchangeably (e.g. ACE inhibitors vs. ARBs share a cluster because patients describe them as one category, but cyclophosphamide and mycophenolate get separate clusters because the treatment experience differs).
- **Patient language wins.** "Foamy urine" is more useful than "proteinuria" as a variant — but include both. The matcher is case-insensitive and treats hyphen/space runs flexibly, so don't bother enumerating `"long-term"` and `"long term"` separately.
- **Same surface concept, different parent subtheme = parallel clusters.** If "infection" shows up both as a comorbidity (immune dysfunction from the disease) and as a treatment side effect (immunosuppressed by therapy), make two parallel clusters with different subthemes and different ids. This is by design — see existing `side_effects` vs `side_effects_2`.
- **No condition duplication of "general" clusters.** Cost, insurance, prior authorization, trial mechanics, generic adverse-event language already exist under `indication: "general"` and will surface under your toggle automatically.
- **MeSH everywhere indication metadata lives.** The registry is the integration point with external systems (ClinicalTrials.gov, EHR coding). Indication and therapeutic_area entries without MeSH ids are accepted but should be backfilled.

## Worked example

For **lupus nephritis**, the expansion produced:

- Therapeutic areas: `immunology` (MeSH D000486, *Allergy and Immunology*) + `nephrology` (MeSH D009396).
- Indication entry: `{ id: "lupus_nephritis", mesh_id: "D008181", therapeutic_areas: ["immunology", "nephrology"], … }`.
- ~63 clusters spanning the 12 subthemes above, with cross-cutting clusters (cost, placebo, dosing_schedule, etc.) left under `indication: "general"`.

The full migration that introduced this lives at [scripts/migrate-lexicon-conditions.mjs](scripts/migrate-lexicon-conditions.mjs) and can be used as a template for the next indication: copy it, swap the LN_CLUSTERS array and the new indication entry, and re-run.

## Output deliverables (what "done" looks like)

1. Updated `keyword_lexicon.json` at the next schema version with the new indication present in `meta.indications[]` and its clusters appended.
2. A backup of the prior lexicon at `keyword_lexicon.v<N>-backup.json`.
3. Regenerated `keyword_usage.json`.
4. A line in the lexicon's `meta.changelog` summarizing what was added (new indication id, cluster count by subtheme).
5. Verification: the segment-tag drawer renders the new indication when toggled, with clusters grouped by parent_subtheme; the word cloud at `/wctglpdemo/interview-words` shows the new clusters' variants when transcripts from the new study are loaded.

---

### Prompt template (for an LLM run)

Paste this into a fresh Claude session, fill in the brackets, and attach `keyword_lexicon.json` + `codebook.json` + your clinical reference:

> You are expanding JourneyMapper's keyword lexicon (schema 3.1) to cover **[indication name]** (MeSH **[mesh_term, mesh_id]**), which belongs to therapeutic areas **[area 1, area 2]**.
>
> Read `keyword_lexicon.json` and `codebook.json` (attached). Follow the conventions in `lexicon_expansion_prompt.md` (attached): condition axis, filter-category-to-subtheme mapping, "general" stays "general," variants are suggestion fuel only, every cluster needs an `indication` FK and a valid `(parent_theme, parent_subtheme)` pair.
>
> Produce a migration script `scripts/migrate-lexicon-[indication-slug].mjs` that:
>
> 1. Appends the new indication to `meta.indications[]` (with MeSH metadata and therapeutic_area FKs).
> 2. Appends a full parallel cluster set for the new indication covering: medications, symptoms, quality-of-life, comorbidities, labs & disease mechanics, self-management, side effects, barriers, decision factors, stigma, peer support, and condition-specific trial endpoints. Skip any facet where you have no condition-specific content — do **not** duplicate cross-cutting "general" clusters.
> 3. Validates every cluster (id uniqueness, indication FK, (theme, subtheme) FK) and exits non-zero on any failure.
> 4. Writes a `keyword_lexicon.v<N>-backup.json` once if missing.
> 5. Prints a summary by indication and subtheme.
>
> Use [scripts/migrate-lexicon-conditions.mjs](scripts/migrate-lexicon-conditions.mjs) as the structural template.
>
> Author 50–80 clusters total. Each cluster: 5–15 lowercase variants including brand/generic, patient phrasings, and abbreviations. One-sentence `description`. snake_case `id`, unique across the whole lexicon.
