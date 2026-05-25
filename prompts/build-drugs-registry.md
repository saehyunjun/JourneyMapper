# Build out `registries/drugs.json`

You are extending the drug entity registry in the JourneyMapper repo. Each drug row is a normalized record with FKs into the mechanism-of-action (MOA), sponsor, and indication registries. Your job is to research, draft, and validate new entries — and to extend the MOA / sponsor registries when a new drug needs an MOA or sponsor that doesn't exist yet.

---

## How to use this prompt

The user will hand you a **scope** when they invoke you. Examples:
- "Add all FDA-approved drugs for melanoma."
- "Add all phase-3 clinical-stage drugs for lupus nephritis."
- "Add the top 20 commercialized GLP-1 / weight-management drugs by US prescription volume."
- "Add every approved drug in oncology with `indication_ids: ['melanoma']`."

If the scope is ambiguous, stop and ask the user for clarification before researching. Be specific: which indications, which stages, which geographies, which sourcing cutoff date.

---

## Repository layout

```
src/lib/content/registries/
├── drugs.json                    ← you edit this
├── mechanisms_of_action.json     ← you may extend this
├── sponsors.json                 ← you may extend this
├── indications.json              ← read-only; request changes via the user
├── therapeutic_areas.json        ← read-only
└── types.ts                      ← TypeScript unions; keep IDs in sync

scripts/migrate-lexicon-drug-fk.mjs     ← runs full FK-chain validation
scripts/validate-disease-insights.mjs   ← orthogonal manifest check
```

Run `node scripts/migrate-lexicon-drug-fk.mjs` after every drugs.json edit. It validates that:
- every drug's `moa_id` resolves against `mechanisms_of_action.json`
- every drug's `sponsor_id` resolves against `sponsors.json` (or is null)
- every drug's `indication_ids[]` entry resolves against `indications.json`
- no duplicate drug ids
- `brand_names[]` is always an array

If validation fails, fix and re-run. Don't ship a registry that doesn't validate.

---

## The Drug schema

Every row in `drugs.json` looks like this:

```json
{
  "id": "semaglutide",
  "label": "Semaglutide (Wegovy / Ozempic / Rybelsus)",
  "generic_name": "semaglutide",
  "brand_names": ["Wegovy", "Ozempic", "Rybelsus"],
  "moa_id": "glp1_agonist",
  "sponsor_id": "novo_nordisk",
  "stage": "approved",
  "indication_ids": ["obesity"],
  "description": "GLP-1 receptor agonist; approved for type-2 diabetes (Ozempic, Rybelsus) and chronic weight management (Wegovy)."
}
```

### Field-by-field

| Field | Rules |
|---|---|
| `id` | Lowercase snake_case. Use the generic / international nonproprietary name (INN). For combination drugs, join with underscores (e.g. `aspirin_dipyridamole`). Must be unique across the file. |
| `label` | Display label. Convention: `"Generic name (Brand 1 / Brand 2)"`. If there are no brand names, just the generic name. |
| `generic_name` | The INN, lowercase. Same string as `id` in most cases. |
| `brand_names` | Array of actual brand names with original capitalization (e.g. `"Wegovy"`, not `"wegovy"`). Empty array `[]` is valid (e.g. for phase-stage drugs without commercial brands yet). The matcher inlines these into the regex automatically — don't worry about case. |
| `moa_id` | FK → `mechanisms_of_action.json`. If the MOA doesn't exist, add it to the MOA registry first (see below). May be `null` only if the mechanism is genuinely unknown or unclassifiable (rare; flag it for the user). |
| `sponsor_id` | FK → `sponsors.json`. Use `null` for fully generic / off-patent drugs without a single dominant commercial owner. For drugs marketed by multiple branded competitors, pick the originator / primary developer. |
| `stage` | One of: `approved`, `phase_3`, `phase_2`, `phase_1`, `preclinical`. Refers to clinical development phase for the lead indication. A drug that's approved for one indication and in phase 2 for another counts as `approved`. |
| `indication_ids` | Array of FKs → `indications.json`. Only includes indications that exist in the registry today. If a drug is approved for an indication that's NOT in the registry, EITHER leave it off (note this for the user) OR ask the user to add the indication first. |
| `description` | ≤200 chars. One sentence on mechanism + approval / development status + clinically relevant detail. Avoid marketing language. |

### Naming conventions for new IDs

- **Drug ids**: lowercase snake_case INN. `pembrolizumab`, not `keytruda` or `Pembrolizumab`.
- **MOA ids**: lowercase snake_case describing the class. Prefer mechanism + target where unambiguous: `anti_pd1`, `braf_inhibitor`, `mek_inhibitor`, `il6_receptor_antagonist`. Avoid version suffixes (`anti_pd1` not `anti_pd1_v2`).
- **Sponsor ids**: lowercase snake_case of the company's common name. `merck`, `bristol_myers_squibb`, `pfizer`. For Roche / Genentech use `roche`. For mergers, use the current name.

---

## Current registry contents

As of writing, `drugs.json` covers **17 drugs** across two indications:

**Lupus nephritis (10):** mycophenolate, cyclophosphamide, voclosporin, belimumab, corticosteroids, hydroxychloroquine, azathioprine, rituximab, anifrolumab, obinutuzumab.

**Obesity (7):** semaglutide, tirzepatide, cagrilintide, retatrutide, orforglipron, metformin, phentermine.

**MOAs (15):** antimetabolite, alkylating_agent, calcineurin_inhibitor, anti_blys, corticosteroid, antimalarial, anti_cd20, type_i_interferon_antagonist, glp1_agonist, dual_glp1_gip_agonist, triple_agonist, amylin_analog, biguanide, sympathomimetic, ace_inhibitor_or_arb.

**Sponsors (6):** novo_nordisk, eli_lilly, astrazeneca, gsk, aurinia, roche.

**Indications in the registry:** lupus_nephritis, melanoma, obesity. (Melanoma has zero drugs at the moment — likely a near-term scope target.)

Read these files before adding anything so you reuse existing ids and don't create duplicates.

---

## Extending the MOA registry

If a new drug needs an MOA that doesn't exist in `mechanisms_of_action.json`, add it before adding the drug.

**Process:**
1. Pick a stable id following the naming convention above.
2. Append a new item to `mechanisms_of_action.json` `items[]`:
   ```json
   {
     "id": "anti_pd1",
     "label": "Anti-PD-1 monoclonal antibody",
     "description": "Blocks the programmed death-1 receptor on T cells, releasing T-cell-mediated antitumor activity. Includes pembrolizumab, nivolumab, cemiplimab."
   }
   ```
3. Add the id to the `MoaId` union in `src/lib/content/registries/types.ts`.
4. Verify by running `node scripts/migrate-lexicon-drug-fk.mjs`.

**MOA granularity:** prefer one level deeper than "monoclonal antibody". `anti_pd1` is better than `checkpoint_inhibitor` (too broad) but `anti_pd1_humanized_igg4_kappa` is too narrow. Aim for the level a clinician would name the class at.

**Combination MOAs:** if a drug genuinely has dual mechanisms (e.g. tirzepatide = GLP-1 + GIP), create a single combined MOA (`dual_glp1_gip_agonist`). Don't multi-tag.

---

## Extending the sponsor registry

If a new drug needs a sponsor that doesn't exist in `sponsors.json`, add it before adding the drug.

**Process:**
1. Pick a stable id (lowercase snake_case of common name).
2. Append a new item:
   ```json
   {
     "id": "merck",
     "label": "Merck (Merck Sharp & Dohme)",
     "headquarters_country": "US"
   }
   ```
3. Add the id to the `SponsorId` union in `types.ts`.
4. Verify.

**Sponsor identity:** use the current commercial owner of the drug. If the drug was developed by one company and acquired by another, use the current owner. If a drug is co-developed (e.g. Plaque + GSK + Pfizer), pick the primary commercial sponsor in the lead indication; note alternates in the drug's `description`. If the drug is fully off-patent and generic (e.g. metformin, hydroxychloroquine), use `null`.

**Country codes:** ISO 3166-1 alpha-2 (`US`, `GB`, `DK`, `CH`, `CA`, etc.). Use `null` if genuinely unclear.

---

## Indication registry — read-only

You do NOT add new indications. If the scope includes a drug for an indication that isn't in `indications.json`, stop and ask the user to add it first. Reasons:
- New indications cascade into the codebook, cluster taxonomy, disease-insights manifests, and UI selectors. That's outside the scope of a drug-registry pass.
- The user controls the editorial scope of which conditions JourneyMapper covers.

When asking, include: the indication id you'd propose (lowercase snake_case), the MeSH ID + term if you can find them, the therapeutic_area_ids it should belong to, and the drugs that would land under it.

---

## Research workflow

For each drug you add, source from authoritative pharmacology / regulatory sources, not marketing copy.

**Approved drugs (US-focused):**
- FDA Drugs@FDA: https://www.accessdata.fda.gov/scripts/cder/daf/
- FDA Orange Book (for generic / approved status): https://www.accessdata.fda.gov/scripts/cder/ob/
- DailyMed (for label / brand names / sponsor of record): https://dailymed.nlm.nih.gov/

**Clinical-stage drugs:**
- ClinicalTrials.gov (for current phase + sponsor)
- The sponsor's pipeline page (for stage + indication coverage)

**Generic / off-patent drugs:**
- Note `sponsor_id: null` and reference DailyMed for canonical generic name + brand names.

**International approvals:** if a drug is approved in EU or JP but not US, note this in the `description` and pick the relevant approval-jurisdiction status for `stage`. Default to `approved` if approved in any major jurisdiction.

**Brand-name accuracy:** brand names matter — they get inlined into the keyword matcher's regex. Confirm capitalization and spelling against FDA/DailyMed. Don't paraphrase ("Tylenol" not "Tylenol™"; "Zepbound" not "Zep Bound").

**When sources conflict:** prefer FDA / EMA / regulatory sources over Wikipedia or PharmaCompass. If genuinely uncertain, flag the row for the user.

---

## Validation workflow

Run these in sequence after each batch of changes:

```bash
# 1. Schema + FK validation
node scripts/migrate-lexicon-drug-fk.mjs

# 2. Disease-insights orthogonal check
npm run validate:disease-insights

# 3. TypeScript types
npm run check 2>&1 | grep -E "registries|drugs|types\.ts" | head -10
```

The migration script reports counts per indication and per MOA. Sanity-check those against your scope expectations before declaring done.

---

## Definition of done

For a given scope, you are done when:

- [ ] Every drug in scope has a row in `drugs.json` with all required fields filled.
- [ ] `node scripts/migrate-lexicon-drug-fk.mjs` reports OK with the expected new counts.
- [ ] Any new MOA ids are present in both `mechanisms_of_action.json` and the `MoaId` union in `types.ts`.
- [ ] Any new sponsor ids are present in both `sponsors.json` and the `SponsorId` union in `types.ts`.
- [ ] Any new drug ids are present in both `drugs.json` and the `DrugId` union in `types.ts`.
- [ ] `npm run check` shows no new type errors in `registries/` or `types.ts`.
- [ ] You produce a summary report (see below).

---

## Deliverable format

After the work is done, post a summary that includes:

```
Scope: <what the user asked for>

Added: N drugs, M MOAs (new), K sponsors (new)

By indication:
  lupus_nephritis: +X
  melanoma: +Y
  obesity: +Z

New drug ids:
  <id1>, <id2>, ...

New MOA ids:
  <id1> (used by: <drug ids>)
  <id2> (used by: <drug ids>)

New sponsor ids:
  <id1>, <id2>

Flagged for user review:
  - <drug> — <reason> (e.g. ambiguous sponsor, unverified phase status)
  - ...

Validation: passed | failed (with details)
```

---

## Worked example — adding pembrolizumab

A walkthrough of one full addition, end-to-end.

**Goal:** add pembrolizumab as an approved melanoma drug.

**1. Look up the facts (FDA / DailyMed):**
- INN: pembrolizumab
- Brand: Keytruda
- Sponsor of record: Merck (Merck Sharp & Dohme)
- MOA: anti-PD-1 monoclonal antibody
- Approval: FDA approved 2014 for melanoma (now many indications)
- Stage: approved

**2. Check the existing registries.** `anti_pd1` MOA → not in `mechanisms_of_action.json`. `merck` sponsor → not in `sponsors.json`. Need to add both first.

**3. Extend MOA registry:**

Append to `mechanisms_of_action.json` `items[]`:
```json
{
  "id": "anti_pd1",
  "label": "Anti-PD-1 monoclonal antibody",
  "description": "Blocks the PD-1 receptor on T cells to release T-cell-mediated antitumor activity. Includes pembrolizumab, nivolumab, cemiplimab, dostarlimab."
}
```

Add `'anti_pd1'` to the `MoaId` union in `types.ts`.

**4. Extend sponsor registry:**

Append to `sponsors.json` `items[]`:
```json
{
  "id": "merck",
  "label": "Merck (Merck Sharp & Dohme)",
  "headquarters_country": "US"
}
```

Add `'merck'` to the `SponsorId` union in `types.ts`.

**5. Add the drug:**

Append to `drugs.json` `items[]`:
```json
{
  "id": "pembrolizumab",
  "label": "Pembrolizumab (Keytruda)",
  "generic_name": "pembrolizumab",
  "brand_names": ["Keytruda"],
  "moa_id": "anti_pd1",
  "sponsor_id": "merck",
  "stage": "approved",
  "indication_ids": ["melanoma"],
  "description": "Anti-PD-1 humanized monoclonal antibody. FDA-approved in 2014 for advanced melanoma; now approved across many solid and hematologic malignancies."
}
```

Add `'pembrolizumab'` to the `DrugId` union in `types.ts`.

**6. Validate:**

```bash
node scripts/migrate-lexicon-drug-fk.mjs
# Expected: drugs.json: OK — 18 drugs, 16 MOAs, 7 sponsors validated
```

---

## Open questions to surface to the user (if you encounter these)

Stop and ask the user, don't guess:

1. **A drug is approved in a non-US jurisdiction only** — use `stage: "approved"` or treat as not-yet-approved for US scope?
2. **A combination product** (e.g. lenvatinib + pembrolizumab combo therapy) — one row or two?
3. **A drug under multiple sponsors via licensing** — pick the originator, the marketing partner, or split?
4. **An indication isn't in the registry** — request the user add it before proceeding.
5. **A drug straddles indications you don't have full clarity on** — confirm which `indication_ids[]` to include.

---

## Constraints — what NOT to do

- ❌ Don't add drug-class clusters (e.g. "GLP-1 agonists" as a row) — those belong in `mechanisms_of_action.json`, not `drugs.json`.
- ❌ Don't add non-drug treatment concepts (combination regimens, delivery routes, monitoring tools). They're handled at the lexicon-cluster level, not in the drug registry.
- ❌ Don't modify `indications.json` or `therapeutic_areas.json` — ask the user.
- ❌ Don't change the schema of an existing field. If a field needs a new shape, that's a schema migration, not a content task.
- ❌ Don't import drug data from a single questionable source (e.g. Wikipedia) without cross-checking against FDA / DailyMed.
- ❌ Don't ship a registry that fails validation.
- ❌ Don't commit on `main`. Work on a branch named `data/drugs-<scope>` (e.g. `data/drugs-melanoma-approved`).

---

## Final note

The drug registry is metadata, not match logic. Even after you add a drug, the lexicon won't surface its brand names in the segment-tag drawer until either (a) a lexicon cluster references the drug via `drug_id`, or (b) someone runs a follow-up migration to create clusters for the new drugs. That cluster-creation pass is out of scope for this prompt — your job ends at producing a clean, validated drug registry.
