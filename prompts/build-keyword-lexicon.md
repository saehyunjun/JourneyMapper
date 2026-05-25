# Build out `keyword_lexicon.json`

You are extending the lexicon — the cluster catalog that powers the segment-tag drawer, the keyword orbit, the word cloud, and every analysis chart in JourneyMapper. A cluster is a single concept (a symptom, a treatment, a barrier, a feeling) named by a stable id and matched at runtime via its `variants[]` regex. Your job is to author new clusters, extend existing ones, and back-fill the cross-cutting axes (burden tags, drug FKs).

This prompt complements [`build-drugs-registry.md`](./build-drugs-registry.md). When a scope requires both new drugs AND new clusters that link to them, do the drug registry first.

---

## How to use this prompt

The user will hand you a **scope** when they invoke you. Cluster work splits into several distinct modes — call out which mode(s) apply when you accept the scope.

| Mode | Example scope | Net effect |
|---|---|---|
| **New indication coverage** | "Build out the melanoma lexicon — symptoms, treatments, monitoring, decision factors, trial barriers." | 50–150 new clusters |
| **Subtheme expansion** | "Expand `clinical_trials/trial_positive_experiences` for both LN and obesity — we're light on positive trial language." | 5–20 new clusters |
| **Cross-cutting fill-in** | "Add cross-cutting clusters for caregiver dynamics — caregiver burnout, dependence, advocacy." | 5–15 new clusters with `indications: []` |
| **Variant additions** | "Audit existing LN symptom clusters and add patient-voice variants from recent Reddit threads." | No new clusters; variants[] grows |
| **Burden classification pass** | "Populate `burden_category_ids` on every existing cluster." | No new clusters; 181 tag passes |
| **Drug FK retrofit** | "Wire `drug_id` on the calcineurin_inhibitors and ace_arb class clusters where one specific drug dominates." | No new clusters; existing rows gain `drug_id` |

If the scope spans modes, say so explicitly before you start. If the scope is ambiguous, ask the user which mode(s).

---

## Repository layout

```
src/lib/content/wctglpdemo-data/
├── keyword_lexicon.json         ← you edit this
└── codebook.json                ← READ-ONLY (parent_theme + parent_subtheme FKs)

src/lib/content/registries/
├── indications.json             ← FK source (registered indications only)
├── drugs.json                   ← FK source for drug_id (extend via the drugs prompt)
├── burden_categories.json       ← FK source for burden_category_ids
└── types.ts                     ← TypeScript unions (no changes needed for cluster work)

scripts/
├── migrate-lexicon-drug-fk.mjs            ← validates drug FKs + general cluster shape
├── migrate-lexicon-burden-slot.mjs        ← validates burden FKs + tree
└── validate-disease-insights.mjs          ← orthogonal manifest check
```

Run `node scripts/migrate-lexicon-drug-fk.mjs` and `node scripts/migrate-lexicon-burden-slot.mjs` after every batch. Both are idempotent — they just re-validate when schema is current. Don't ship a lexicon that fails either.

---

## The Cluster schema (3.6)

```json
{
  "id": "renal_remission",
  "label": "Renal remission / response",
  "description": "Achieving complete or partial renal response — proteinuria falling and kidney function stabilizing on treatment.",
  "indications": ["lupus_nephritis"],
  "burden_category_ids": ["physical_symptoms", "emotional_uncertainty"],
  "parent_theme": "treatment",
  "parent_subtheme": "treatment_positive_experiences",
  "variants": [
    "remission",
    "complete renal response",
    "partial renal response",
    "in remission",
    "responded to treatment",
    "proteinuria improved",
    "kidney function stable",
    "labs improved"
  ]
}
```

### Field-by-field

| Field | Rules |
|---|---|
| `id` | Lowercase snake_case, ≤40 chars. Stable forever once shipped — every annotation row references it. Use the concept's most natural short name (`renal_remission`, not `treatment_response_in_lupus_nephritis_kidney`). For drug clusters, use the generic name (matches `drug_id`). For symptom / comorbidity clusters, the medical term (`hematuria`, `nephrotic_syndrome`). Must be unique across the file. |
| `label` | Display label (≤80 chars). Title case typically. For drug clusters, convention is `"Generic (Brand 1 / Brand 2)"`. For concepts, a clean human-readable name with the most specific synonym in parens if useful (e.g. `"Malar / butterfly rash"`). |
| `description` | One sentence (≤200 chars). Plain language plus enough clinical detail that a future analyst knows what counts. Avoid marketing copy. |
| `indications` | `string[]` FK → `registries/indications.json`. **Empty array `[]` = cross-cutting** (visible under every indication toggle). Use this for cost/insurance, generic trial mechanics, generic decision factors. Multi-element arrays are allowed and preferred over duplicating a near-identical cluster per indication. |
| `burden_category_ids` | `string[]` FK → `registries/burden_categories.json`. Empty `[]` is valid (unclassified). Use leaf categories where you can (`financial_out_of_pocket`, not `financial`). Multi-element arrays let one cluster carry multiple burden facets — `steroid_side_effects` is `["physical_side_effects", "physical_appearance", "emotional_uncertainty"]`. |
| `drug_id` | **Optional**. FK → `registries/drugs.json`. Set ONLY on clusters that map 1:1 to a specific drug entity (`semaglutide`, `mycophenolate`). Drug-class clusters (`glp_1`, `ace_arb`, `calcineurin_inhibitors`) and non-drug treatment concepts (`iv_infusion`, `multitarget_therapy`) carry no `drug_id`. |
| `parent_theme` | FK → `codebook.json` `themes[].id`. One of: `treatment`, `clinical_trials`, `condition_specific`. (The codebook is fixed — see the next section.) |
| `parent_subtheme` | FK → `codebook.json` `themes[].subthemes[].id`. The (theme, subtheme) pair must be valid. |
| `variants` | `string[]` of phrases the matcher should detect. THIS IS THE REGEX SOURCE — be careful (see "Authoring variants" below). |

### What's NOT in the cluster

- **Brand names of drugs** — they live in `drugs.brand_names[]`. The matcher inlines them at regex-build time when the cluster has a `drug_id`. Putting them in `variants[]` for a drug cluster is dead duplication (Schema 3.6 stripped these).
- **Sentiment, frequency, score** — those are computed downstream from segment annotations, not stored on the cluster.
- **Indication-specific phrasing buckets** — if a concept truly differs across indications, make separate clusters. If it's the same concept, leave `indications: []` and trust the matcher.

---

## The codebook is fixed — 21 (theme, subtheme) pairs

`codebook.json` is **read-only** for this prompt. Pick from the existing pairs. Adding a new theme or subtheme is a schema-level change, not cluster authoring.

```
treatment/
  treatment_health_history       (27 clusters today — drugs, regimens, medical history)
  diagnostic_odyssey             (0 — the path to diagnosis, time-to-diagnosis)
  treatment_positive_experiences (6 — improvement, "feel like myself", efficacy felt)
  treatment_negative_experiences (8 — side effects experienced, treatment regret)
  treatment_knowledge_gaps       (2 — "don't understand", confusion about meds)
  treatment_barriers             (20 — cost, access, fear of starting)
  treatment_decision_factors     (10 — what drives the choice — risk, family, doctor advice)

clinical_trials/
  clinical_trial_awareness       (0 — never heard of trials, heard of from X)
  clinical_trial_interest        (0 — would consider, wouldn't consider)
  clinical_trial_knowledge_gaps  (4 — what is a placebo, what is randomization)
  trial_motivators               (20 — altruism, last-resort, financial, hope)
  trial_barriers                 (9 — travel, time, mistrust, risk)
  trial_positive_experiences     (0 — felt heard, got better)
  trial_negative_experiences     (0 — felt like a number, side effects)
  trial_decision_factors         (0 — what tipped them in or out)

condition_specific/
  condition_knowledge_gaps       (7 — labs, mechanisms, terminology confusion)
  symptoms                       (17 — pain, fatigue, swelling, flares)
  comorbidities                  (20 — kidney failure, diabetes, sleep apnea)
  social_stigma                  (3 — invisible illness, appearance shame)
  advocacy_peer_groups           (2 — lupus warrior, online support)
  medical_self_efficacy          (26 — diet adherence, lab tracking, self-monitoring)
```

**Sparse subthemes (high-leverage to fill):**
- `diagnostic_odyssey`, `clinical_trial_awareness`, `clinical_trial_interest`, `trial_positive_experiences`, `trial_negative_experiences`, `trial_decision_factors`

If a concept genuinely doesn't fit any existing subtheme, flag it for the user rather than picking the closest pair — that signal helps the user decide whether the codebook itself needs to grow.

---

## Current lexicon contents

**181 clusters** as of writing, distributed:

```
Indication        | Clusters
------------------|---------
cross-cutting     |    64
lupus_nephritis   |    63
obesity           |    54
melanoma          |     0   ← likely a near-term scope target
```

**17 clusters** carry a `drug_id`. **0 clusters** carry any `burden_category_ids` yet (the slot exists schema-wide but classification hasn't happened).

Read the existing file before adding anything — every new id must be unique, and concept duplicates create matcher conflicts. If a concept already exists with a slightly different id, prefer adding variants to the existing cluster over creating a near-duplicate.

---

## Authoring variants — the most important section

Variants are the **regex source** the matcher compiles. They behave like this:

- Case-insensitive.
- Space and hyphen runs are flexible (`out of pocket` matches `out-of-pocket` and `out  of  pocket`).
- Non-alphanumeric boundaries on both sides (so `pain` won't match inside `painting` or `championship`).
- Longest variant wins on overlap.

### Authoring rules

1. **Patient-voice first.** Variants should reflect how patients actually say things, not how medicine says them. `"feel like myself"`, `"feel human again"`, `"get my life back"` — that's the goal. Augment with the medical term (`"renal remission"`) but lead with the lived phrasing.
2. **No brand names of drugs with `drug_id`.** The matcher inlines `drugs.generic_name + drugs.brand_names[]` automatically when `drug_id` is set. Putting `"wegovy"` in a semaglutide cluster's variants[] is redundant.
3. **Don't include common English words alone.** `"better"` matches everywhere. If you really want `"feel better"` as a variant, pin it with surrounding tokens.
4. **Be specific enough to disambiguate.** `"shot"` is too generic — use `"insulin shot"`, `"my shot"`. `"control"` is too generic — use `"blood sugar control"`.
5. **Plural / tense forms** are NOT auto-derived. List them if both forms occur: `["pain", "pains"]`, `["flare", "flares", "flare-up", "flaring"]`.
6. **Common typos / informal spellings** are OK if you've seen them in transcripts (`"diabetic"`, `"diabeetus"`).
7. **Avoid possessives in variants** — the boundary regex strips `'s`, so `"my doctor"` matches `"my doctor's"` already; don't list both.
8. **Lowercase variants always**, except where capitalization is semantically meaningful (rare — almost never).
9. **Order doesn't matter** in storage, but the matcher sorts by length descending. Don't worry about ordering.
10. **No regex syntax in variants.** No `|`, no `?`, no `*`, no character classes. The matcher handles boundaries and flexibility; variants are plain phrases.

### How many variants per cluster?

- **Drug clusters:** 0–10. The drug entity provides the generic + brand names; variants[] should hold only alternative spellings (`"mmf"`, `"euro-lupus"`, `"hcq"`) and patient-voice phrasing (`"my plaquenil"`, `"the steroid pills"`).
- **Symptom clusters:** 5–15. Medical term + 2–4 lived-experience phrasings + plural / tense variants.
- **Concept clusters** (barriers, motivators, decision factors): 4–12. Aim for variety of phrasings.
- **Heavily-shaded clusters** (`fatigue`, `cost`): can grow to 15–20. Audit periodically for noise.

### When in doubt, run the matcher

After authoring, sanity-check against actual transcripts (or the smoke-test pattern in [scripts/migrate-lexicon-variant-strip.mjs](../scripts/migrate-lexicon-variant-strip.mjs)). False positives are costlier than false negatives — they bold the wrong word and break analyst trust.

---

## Picking `indications`

| Cluster type | `indications` |
|---|---|
| Cost, insurance, prior authorization, generic trial mechanics | `[]` (cross-cutting) |
| Generic decision factors ("risk", "long-term use", "scary") | `[]` |
| Disease symptom, comorbidity, indication-specific lab | `["lupus_nephritis"]` (or whatever applies) |
| Drug specific to one indication | `["lupus_nephritis"]` matches the drug's `indication_ids` |
| Concept that genuinely applies to multiple specific indications but isn't truly universal | `["lupus_nephritis", "obesity"]` (multi-element) |

**Don't duplicate.** A cluster for "appointment burden" with `indications: ["lupus_nephritis"]` AND a near-identical cluster with `indications: ["obesity"]` should be ONE cluster with `indications: []`.

---

## Picking `burden_category_ids`

The burden taxonomy is tree-structured (see [registries/burden_categories.json](../src/lib/content/registries/burden_categories.json)). Eight top-level categories with 3–4 leaf subcategories each.

| Cluster example | Burden tags |
|---|---|
| `cost`, `out_of_pocket`, `expensive` | `["financial_out_of_pocket"]` |
| `insurance`, `prior_authorization`, `coverage` | `["financial_insurance"]` |
| `fatigue`, `joint_pain`, `proteinuria` | `["physical_symptoms"]` |
| `steroid_side_effects` | `["physical_side_effects", "physical_appearance"]` |
| `appearance_stigma` | `["physical_appearance", "social_stigma", "emotional_isolation"]` |
| `pill_burden`, `medication_adherence` | `["regimen_adherence"]` |
| `lab_tracking`, `bp_monitoring` | `["regimen_monitoring"]` |
| `travel_burden`, `visit_frequency` | `["logistical_travel", "regimen_appointments"]` |
| `avoid_dialysis`, `kidney_failure` | `["emotional_fear", "qol_independence"]` |
| `lupus_support`, `peer_groups` | `["social_relationships"]` |
| `clinical_trial`, `placebo` (mechanics only) | `[]` (neutral mechanics carry no burden) |

**Heuristic:** ask "what does the patient lose / spend / feel when this is in play?" — that maps to the burden. Mechanics ("randomized", "phase 3") that don't directly impose burden on the patient stay empty.

Prefer leaves over parents (`financial_out_of_pocket` not `financial`). Use parents when the concept genuinely spans subcategories without favoring one.

---

## Picking `drug_id`

Set ONLY when the cluster IS a specific drug entity. Rules:

- Cluster id matches a drug entity id → set `drug_id` to that id. (Convention: cluster id = drug id for drug clusters.)
- Cluster represents a drug CLASS (`glp_1`, `calcineurin_inhibitors`, `ace_arb`, `corticosteroids` as a family) → **no drug_id**. The class concept is at the MOA level, not the drug level.
- Cluster represents a delivery method or regimen pattern (`iv_infusion`, `multitarget_therapy`, `compounded_medication`) → **no drug_id**.

If a class-cluster like `calcineurin_inhibitors` is overwhelmingly used to mean one specific agent (e.g. voclosporin) in your scope, that's a content judgment — flag it for the user rather than silently linking.

---

## Research workflow

Different cluster types want different sources.

**Symptoms, comorbidities, labs (medical concepts):**
- UpToDate, clinical guidelines (KDIGO, ACR, AACE, NCCN by domain)
- DailyMed / FDA labels for drug-specific symptoms / side effects
- Disease-society patient education materials (Lupus Foundation, Obesity Action Coalition, AAD for melanoma)

**Patient voice (variants[] phrasings):**
- Reddit communities scoped to the indication (`/r/lupus`, `/r/loseit`, `/r/melanoma`)
- Inspire, Facebook patient groups, HealthUnlocked
- Patient blogs and YouTube vlog transcripts
- Existing interview transcripts in `src/lib/content/wctglpdemo-data/interviews_structured.json` if applicable
- ACTUAL phrases beat assumed phrases. If you can't find a patient-voice variant for a concept, leave variants[] small rather than fabricate.

**Trial vocabulary (mechanics, decision factors):**
- ClinicalTrials.gov layperson summaries
- Patient-facing trial recruitment materials
- Existing `clinical_trials/*` clusters as templates

**Cross-reference:** if you draft a cluster whose concept might already exist under a different name, search `keyword_lexicon.json` for related variants before committing. Near-duplicates are the most common reviewer flag.

---

## Validation workflow

```bash
# 1. Drug FK chain + cluster shape
node scripts/migrate-lexicon-drug-fk.mjs

# 2. Burden FK chain + tree validation
node scripts/migrate-lexicon-burden-slot.mjs

# 3. Disease-insights orthogonal check
npm run validate:disease-insights

# 4. TypeScript types
npm run check 2>&1 | grep -E "lexicon|registries|keywords\.ts|types\.ts" | head -20
```

The migration scripts both report counts and pass-through OK on a clean lexicon. If either fails, the message names the cluster and the field — fix and re-run.

**Smoke test the matcher** for any new cluster you add. The pattern in [scripts/migrate-lexicon-variant-strip.mjs](../scripts/migrate-lexicon-variant-strip.mjs) shows how to evaluate cluster regexes against sample text inline.

---

## Definition of done

For a given scope, you are done when:

- [ ] Every new cluster has all required fields filled.
- [ ] Every (parent_theme, parent_subtheme) pair is valid against the codebook.
- [ ] Every `indications[]` entry resolves against `registries/indications.json`.
- [ ] Every `burden_category_ids[]` entry resolves against `registries/burden_categories.json`.
- [ ] Every `drug_id` (where set) resolves against `registries/drugs.json` AND the cluster represents a specific drug (not a class).
- [ ] No duplicate cluster ids.
- [ ] No drug brand names in variants[] for clusters with `drug_id` (the matcher provides them).
- [ ] Patient-voice variants represent ACTUAL phrasings, not assumed ones (or you've flagged where research was thin).
- [ ] Both validation scripts pass.
- [ ] `npm run check` shows no new errors in lexicon or registry-related files.
- [ ] You produce a summary report (see below).

---

## Deliverable format

After the work is done, post a summary that includes:

```
Scope: <what the user asked for>
Mode(s): <new-indication | subtheme-expansion | cross-cutting | variants | burden | drug-fk>

Net change:
  +N clusters  (was 181, now <total>)
  +M variants on K existing clusters
  +B burden tags on Y clusters
  +D drug_id retrofits on Z clusters

By indication:
  <id>: +X clusters

By (theme, subtheme):
  treatment/treatment_positive_experiences: +X
  ...

New cluster ids:
  <id1>, <id2>, ...

Variants worth reviewing (potential false-positives):
  - cluster_x: "<variant>" — <reason>

Flagged for user review:
  - <cluster> — <reason>
  - codebook gap: <description of concept that didn't fit any subtheme>

Validation: passed | failed (with details)
```

---

## Worked example — adding a single symptom cluster

**Goal:** add a `dry_mouth` cluster to lupus_nephritis (Sjögren's overlap is common in lupus patients on hydroxychloroquine).

**1. Check for duplicates.** Search `keyword_lexicon.json` for `dry_mouth`, `xerostomia`, `Sjogren`. Not present.

**2. Pick the (theme, subtheme).** Symptom of the disease (and a side effect of treatment) — primary fit is `condition_specific/symptoms`. If it's predominantly a treatment side effect, `treatment/treatment_negative_experiences` would also fit. Default to the dominant patient experience — for LN, dry mouth is usually a Sjögren's-overlap symptom, so `condition_specific/symptoms`.

**3. Author the cluster:**

```json
{
  "id": "dry_mouth",
  "label": "Dry mouth / xerostomia",
  "description": "Chronic dry mouth — often from Sjögren's overlap in lupus or as an anticholinergic medication side effect.",
  "indications": ["lupus_nephritis"],
  "burden_category_ids": ["physical_symptoms", "qol_functional"],
  "parent_theme": "condition_specific",
  "parent_subtheme": "symptoms",
  "variants": [
    "dry mouth",
    "xerostomia",
    "cotton mouth",
    "no saliva",
    "always thirsty",
    "mouth feels like sand",
    "can't swallow dry food",
    "sjogren"
  ]
}
```

Patient-voice variants ("cotton mouth", "mouth feels like sand", "always thirsty") sit alongside the medical term ("xerostomia") and the related condition ("sjogren"). Burden tags reflect that dry mouth is both a physical symptom AND a functional QoL hit (eating, swallowing, speech).

**4. Validate:**

```bash
node scripts/migrate-lexicon-drug-fk.mjs
node scripts/migrate-lexicon-burden-slot.mjs
# Both expected: pass with cluster count 182
```

**5. Optional smoke test:** make sure `"my mouth feels like cotton at night"` matches `dry_mouth` and not, e.g., `physical_symptoms` as a generic.

---

## Worked example — populating burden tags across an indication

**Goal:** classify all 63 lupus_nephritis clusters with burden tags.

**1. Skim the cluster list** for that indication. Group mentally by subtheme:
- `condition_specific/symptoms` clusters → mostly `physical_symptoms` (single-tag).
- `condition_specific/comorbidities` clusters → `physical_symptoms` + potentially `emotional_fear` (kidney failure) or `qol_independence` (dialysis).
- `treatment/treatment_health_history` (drugs) → mostly `[]` (the drug itself isn't a burden — its side effects are).
- `treatment/treatment_negative_experiences` → `physical_side_effects` + variants like `physical_appearance` for steroid issues.
- `treatment/treatment_barriers` → `financial_*`, `regimen_*`, depending on cluster.
- `condition_specific/medical_self_efficacy` → `regimen_monitoring`, `regimen_adherence`, sometimes `information_*`.
- `condition_specific/social_stigma` → `social_stigma` + `emotional_isolation`.

**2. Author the tags** in batches by subtheme. Don't tag drug clusters with burden — drugs are interventions, not burdens (their side effects are separate clusters).

**3. Validate** after every batch of 10–15.

**4. Report** which clusters genuinely have NO burden (mechanics-only — `clinical_trial`, `placebo`, `randomized`) and which you weren't sure about — those go in "Flagged for user review".

---

## Open questions to surface to the user

Stop and ask, don't guess:

1. **A concept doesn't fit any existing (theme, subtheme) pair** — propose the cluster's intent and let the user decide whether to widen the cluster, pick the closest pair anyway, or grow the codebook.
2. **A drug-class cluster (e.g. `corticosteroids`) overlaps heavily with a specific drug** — confirm whether to add `drug_id` or leave it as a class.
3. **Patient-voice research is thin for a concept** — list the medical term variants you have and ask if it's worth shipping without the lived-language additions, or if research should continue.
4. **A new indication touches an existing cross-cutting cluster** — confirm whether to leave `indications: []` (extend by inclusion) or whether the cluster should be split.
5. **The codebook has a sparse subtheme that arguably overlaps with another** — flag the structural concern; don't restructure unilaterally.

---

## Constraints — what NOT to do

- ❌ Don't modify `codebook.json`. It's read-only for this prompt.
- ❌ Don't add new themes or subthemes. Same reason — schema change, not cluster authoring.
- ❌ Don't add new indications, therapeutic areas, drugs, sponsors, MOAs, or burden categories. Each has its own prompt.
- ❌ Don't put drug brand names in `variants[]` for clusters with `drug_id`. The matcher provides them.
- ❌ Don't fabricate patient-voice variants. Source from real transcripts / forums or leave the slot small.
- ❌ Don't create near-duplicate clusters. If a concept exists with a slightly different id, extend the existing cluster's variants instead.
- ❌ Don't include regex syntax in variants. The matcher escapes everything.
- ❌ Don't include possessives (`'s`) — the boundary regex handles them.
- ❌ Don't ship a lexicon that fails either validation script.
- ❌ Don't commit on `main`. Work on a branch named `data/lexicon-<scope>` (e.g. `data/lexicon-melanoma-symptoms`).
- ❌ Don't bulk-replace existing variants without flagging — analysts may have authored those by hand.

---

## Final note

The lexicon is editorial. Every cluster represents a decision about what counts as a distinct patient concept; every variant represents a decision about how that concept gets named in the wild. Wrong decisions either (a) miss real signal in transcripts (false negatives — fixable, low cost), or (b) bold the wrong word and break analyst trust (false positives — expensive). When in doubt, ship fewer clusters with tighter variants, not more clusters with looser ones.

This prompt produces a clean, validated lexicon expansion. The downstream consumer (the segment-tag drawer, the keyword orbit, the analysis charts) starts surfacing new clusters as soon as the file is updated and the dev server reloads — no separate publish step.
