# Add a new indication (and its therapeutic area, if needed)

You are adding a new disease into the indication registry and walking it through every downstream registry, manifest, and lexicon touch-point that depends on it. Indications are the central organizing axis of JourneyMapper — adding one cascades into drugs, lexicon clusters, disease-insights data packs, and UI selectors. This prompt is the checklist that keeps that cascade clean.

This prompt is the **entry point** when a new disease enters scope. The downstream content prompts ([drugs](./build-drugs-registry.md), [lexicon](./build-keyword-lexicon.md), [disease-insights](./build-disease-insights.md)) all require the indication to exist in the registry first.

---

## How to use this prompt

The user will hand you an **indication name** plus optional context:
- "Add atopic dermatitis."
- "Add type 2 diabetes — same therapeutic area as obesity."
- "Add multiple sclerosis. Pull MeSH ID, link to neurology TA."

If the therapeutic area doesn't exist yet, add that first.

---

## Repository layout

```
src/lib/content/registries/
├── indications.json              ← you edit this
├── therapeutic_areas.json        ← you may edit this
└── types.ts                      ← IndicationId + TherapeuticAreaId unions

src/lib/content/wctglpdemo-data/
└── keyword_lexicon.json          ← no schema edit, but the new indication becomes a valid `indications[]` value on clusters

src/lib/content/disease-insights/
└── <slug>/                       ← create this folder + manifest.json
```

---

## The Indication schema

```json
{
  "id": "lupus_nephritis",
  "label": "Lupus Nephritis",
  "abbreviation": "LN",
  "mesh_id": "D008181",
  "mesh_term": "Lupus Nephritis",
  "therapeutic_area_ids": ["immunology", "nephrology"],
  "description": "Kidney manifestation of systemic lupus erythematosus (SLE). Spans induction/maintenance immunosuppression, renal labs, and progression to CKD/ESRD."
}
```

| Field | Rules |
|---|---|
| `id` | Lowercase snake_case. **Stable** — referenced from clusters, drugs, disease-insights manifests, segment annotations. Use a clinically natural short form (`lupus_nephritis`, `atopic_dermatitis`, `type_2_diabetes`). |
| `label` | Display label. Title case. Common-name form (`"Type 2 Diabetes"`, not `"Type 2 Diabetes Mellitus"`). |
| `abbreviation` | Standard medical abbreviation if widely used (`"LN"`, `"T2D"`); `null` otherwise. |
| `mesh_id` | MeSH descriptor id (e.g. `"D008181"`). Pull from https://www.ncbi.nlm.nih.gov/mesh/. `null` only if no MeSH term exists. |
| `mesh_term` | MeSH descriptor label (often differs slightly from `label`). |
| `therapeutic_area_ids[]` | FK → `therapeutic_areas.json`. One or more. Many diseases legitimately span two TAs (e.g. LN = immunology + nephrology). |
| `description` | Sentence (≤200 chars). What the disease is + the corpus framing if relevant ("GLP-1 weight-management corpus"). |

---

## The TherapeuticArea schema

```json
{
  "id": "nephrology",
  "label": "Nephrology",
  "mesh_id": "D009396",
  "mesh_term": "Nephrology"
}
```

| Field | Rules |
|---|---|
| `id` | Lowercase snake_case clinical-specialty name. `oncology`, `nephrology`, `endocrinology`, `cardiology`, `dermatology`. |
| `label` | Display label (often title case, matching MeSH or common-usage form). |
| `mesh_id` / `mesh_term` | From MeSH; the descriptor for the specialty (e.g. `D000486` for "Allergy and Immunology"). |

---

## Current registry contents

**Indications (3):** `lupus_nephritis`, `melanoma`, `obesity`.
**Therapeutic areas (4):** `immunology`, `nephrology`, `oncology`, `endocrinology`.

Read both files before adding so the new entry slots cleanly.

---

## End-to-end checklist

When adding a new indication, walk this checklist in order. Skipping a step breaks something downstream.

### Step 1 — Ensure the therapeutic area(s) exist

For each TA the new indication touches:
- Already in `therapeutic_areas.json` → continue.
- Not present → add it. Then add the id to the `TherapeuticAreaId` union in `types.ts`.

### Step 2 — Add the indication row

Append to `indications.json` `items[]` with the schema above. Pull MeSH metadata from the National Library of Medicine.

### Step 3 — Update `IndicationId` union in `types.ts`

Add the new id to the union. Without this, TypeScript will reject `clusters[].indications: ["<new_id>"]`.

### Step 4 — Create the disease-insights folder

Create `src/lib/content/disease-insights/<kebab-case-slug>/manifest.json` with the indication's manifest envelope. Start with an empty `datasets[]` array if you're not adding data yet. The folder MUST exist with a manifest — the auto-discovery glob throws if a folder is missing one.

```json
{
  "schema_version": "1.0",
  "id": "<new_id>",
  "slug": "<kebab-case-slug>",
  "label": "<Label>",
  "abbreviation": null,
  "therapeutic_area_ids": [...],
  "datasets": []
}
```

### Step 5 — Decide if the lexicon needs immediate clusters

Adding an indication doesn't require lexicon clusters. But if the scope is "stand up the disease end-to-end," delegate cluster authoring to the [lexicon prompt](./build-keyword-lexicon.md) with `mode: new indication coverage`.

### Step 6 — Decide if drugs need immediate population

Same — adding the indication doesn't require drug entries. If the scope says "stand up end-to-end," delegate to the [drugs prompt](./build-drugs-registry.md) with the new `indication_id`.

### Step 7 — Validate

```bash
# Disease-insights manifest must exist + slug must match folder
npm run validate:disease-insights

# Cluster FK validation (no clusters reference the new indication yet, but the FK chain must be sound)
node scripts/migrate-lexicon-drug-fk.mjs

# TypeScript types
npm run check 2>&1 | grep -E "indications|therapeutic_areas|registries|types\.ts" | head -10
```

### Step 8 — Surface what's NOT done

The indication now exists, but coverage may be skeletal. In the deliverable, list:
- Drugs not yet added.
- Lexicon clusters not yet authored.
- Disease-insights datasets not yet sourced.
- Codebook themes/subthemes that may not fit the new indication (rare, but possible).

---

## Definition of done

For "add indication X" with no scope-specified content:

- [ ] `therapeutic_areas.json` covers every TA the indication touches.
- [ ] `indications.json` has a row with all fields populated (MeSH where it exists).
- [ ] `TherapeuticAreaId` and `IndicationId` unions in `types.ts` updated.
- [ ] `src/lib/content/disease-insights/<slug>/manifest.json` exists (with empty `datasets[]` if no data yet).
- [ ] Validation scripts pass.
- [ ] Deliverable summarizes what's NOT done (drugs, clusters, datasets) so the user knows the cascade.

For "stand up indication X end-to-end":

- [ ] All of the above.
- [ ] Drugs added via [drugs prompt](./build-drugs-registry.md).
- [ ] Lexicon clusters added via [lexicon prompt](./build-keyword-lexicon.md) with `mode: new indication coverage`.
- [ ] Disease-insights datasets added via [disease-insights prompt](./build-disease-insights.md).

---

## Deliverable format

```
Scope: <indication name> | <"end-to-end" or partial>

Added:
  Therapeutic areas (new): <ids>
  Indication: <id> (MeSH: <mesh_id> "<mesh_term>")
  Disease-insights folder: <slug>/ (empty manifest | with N datasets)

Cascading work (delegated or pending):
  Drugs: <N added | 0 — pending [drugs prompt]>
  Lexicon clusters: <N added | 0 — pending [lexicon prompt]>
  Disease-insights datasets: <N added | 0 — pending [disease-insights prompt]>

Flagged for user review:
  - <description>

Validation: passed | failed
```

---

## Worked example — adding atopic dermatitis (skeletal)

**Goal:** add `atopic_dermatitis` to the registry. Don't populate drugs / lexicon / data yet.

**1. Therapeutic area check.** Dermatology is not in `therapeutic_areas.json`. Add it:

```json
{
  "id": "dermatology",
  "label": "Dermatology",
  "mesh_id": "D003879",
  "mesh_term": "Dermatology"
}
```

Add `'dermatology'` to `TherapeuticAreaId` union.

**2. Add the indication.** Append to `indications.json`:

```json
{
  "id": "atopic_dermatitis",
  "label": "Atopic Dermatitis",
  "abbreviation": "AD",
  "mesh_id": "D003876",
  "mesh_term": "Dermatitis, Atopic",
  "therapeutic_area_ids": ["dermatology", "immunology"],
  "description": "Chronic inflammatory skin disease driven by Type 2 immune dysregulation. Spans topical therapy, systemic immunomodulators, and biologic anti-IL-4/13 / JAK inhibitor pathways."
}
```

Add `'atopic_dermatitis'` to `IndicationId` union.

**3. Create the disease-insights folder** at `src/lib/content/disease-insights/atopic-dermatitis/manifest.json`:

```json
{
  "schema_version": "1.0",
  "id": "atopic_dermatitis",
  "slug": "atopic-dermatitis",
  "label": "Atopic Dermatitis",
  "abbreviation": "AD",
  "therapeutic_area_ids": ["dermatology", "immunology"],
  "datasets": []
}
```

**4. Validate.**

```bash
npm run validate:disease-insights
# OK — 3 disease folder(s), 5 dataset(s), 1 cluster file(s)

node scripts/migrate-lexicon-drug-fk.mjs
# Should report drugs/MOAs/sponsors validated; no new clusters or drugs reference atopic_dermatitis yet.
```

**5. Report:**

```
Scope: atopic_dermatitis (skeletal — registry-only)

Added:
  Therapeutic areas (new): dermatology
  Indication: atopic_dermatitis (MeSH: D003876 "Dermatitis, Atopic")
  Disease-insights folder: atopic-dermatitis/ (empty manifest)

Cascading work (pending):
  Drugs: 0 — pending [drugs prompt]; expect dupilumab, tralokinumab, lebrikizumab, abrocitinib, upadacitinib, ruxolitinib (topical), pimecrolimus, tacrolimus (topical), and various corticosteroids.
  Lexicon clusters: 0 — pending [lexicon prompt]; expect ~40–80 clusters across symptoms (itch, flares, sleep loss), comorbidities (asthma, allergic rhinitis), treatments, decision factors.
  Disease-insights datasets: 0 — pending [disease-insights prompt].

Validation: passed
```

---

## Open questions to surface

1. **MeSH doesn't have a clean descriptor for the disease** (rare for common conditions; happens for narrow indications or syndromes). Pick the closest descriptor and note in `description`.
2. **The disease spans 3+ therapeutic areas** (e.g. systemic sclerosis = rheumatology + pulmonology + cardiology + nephrology). Confirm which to list. Default: include all where the disease has a clinically meaningful subspecialty footprint, but cap at ~3.
3. **Two diseases share a near-identical patient experience** (e.g. lupus nephritis and IgA nephropathy share many renal symptoms). Confirm whether to use one cluster + multi-indication tagging in the lexicon, or two indications with parallel clusters. Default to lexicon-side multi-indication, not duplicate indication rows.
4. **The user wants to add the indication but isn't sure about scope yet** — ship skeletal (registry + empty manifest), so the disease exists in the UI selector while content is still being scoped.

---

## Constraints — what NOT to do

- ❌ Don't add an indication without a MeSH ID unless you've genuinely searched and confirmed it doesn't exist.
- ❌ Don't skip the disease-insights folder. The auto-discovery glob throws if a registered indication has no manifest.
- ❌ Don't modify the `IndicationId` union and forget the JSON, or vice versa. They must match.
- ❌ Don't populate drugs / clusters / data inline. Delegate to the respective prompts so the work is scoped and reviewable.
- ❌ Don't rename an existing indication id. Cluster references, drug references, annotations, and KV-store keys all break.
- ❌ Don't commit on `main`. Work on `data/indication-<id>`.

---

## Final note

Adding an indication is a small action with a large blast radius. Done well, it slots into the existing schema cleanly and unlocks downstream work. Done sloppily — wrong MeSH, mismatched slug, missing manifest — it propagates broken FKs across drugs, lexicon, and disease-insights manifests. Walk the checklist; don't skip steps.
