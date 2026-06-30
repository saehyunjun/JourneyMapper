# Entity Registry — Strawman v0.1

**Status:** draft for review · 2026-06-01
**Owner:** Aaron Jun
**Companion to:** [CODEBOOK_TAXONOMY.md](CODEBOOK_TAXONOMY.md)
**Supersedes:** the scattered registry files ([drugs.json](src/lib/content/registries/drugs.json), [sponsors.json](src/lib/content/registries/sponsors.json)) once accepted.

An **entity** is a named thing that appears in patient/caregiver text — a drug, a biomarker, a sponsor, a symptom, a concept. Entities are the unit of text MATCHING (the matcher recognizes surface forms and resolves them to entity IDs). Themes are the unit of CATEGORIZATION (analysts and the model assign 0..N theme IDs per span).

Entities and themes are orthogonal axes of the same span:

- A span can be tagged with both an entity (`entity.drug.dapagliflozin`) AND one or more themes (`hrqol.general_health`, `util.coverage`).
- An entity carries DEFAULT theme links — "Dapagliflozin is typically discussed in the context of these themes." Those are suggestions, not overrides.
- The matcher resolves entities deterministically (surface-form match → entity_id); themes are tagger-assigned per span (with LLM proposal + analyst confirm).

This is the layer that closes the iGAN coverage hole. Dapagliflozin, Sibeprenlimab, eGFR — all entities, linked to themes from the taxonomy, indication-membership multi-valued.

---

## Entity kinds

| Kind         | Examples                                  | Default theme links                                 | Notes                                                |
| ------------ | ----------------------------------------- | --------------------------------------------------- | ---------------------------------------------------- |
| `drug`       | Dapagliflozin, Sibeprenlimab, Mycophenolate | `util.coverage`, `util.insurance`, `hrqol.general_health` | Includes biologics, small molecules, regimens     |
| `biomarker`  | eGFR, UPCR, hemoglobin, BNP                | `hrqol.general_health`                              | Clinical measurements                                |
| `sponsor`    | Aurinia, Vera Therapeutics, Roche          | `trial.relationship`, `trial.awareness`             | Pharma / biotech / academic sponsors                 |
| `concept`    | flare, remission, biopsy, second opinion   | mixed (no default)                                  | Clinical concepts that aren't drugs or biomarkers    |
| `symptom`    | fatigue, brain fog, joint pain             | `hrqol.*` (kind-specific)                           | Patient-experienced symptoms                         |
| `trial`      | KYV-101, CABA-201, NCT06104449             | `trial.*`                                           | Specific trials; NCT_id when available               |
| `condition`  | comorbid diabetes, depression              | mixed                                               | Comorbidities; primary indication has its own table  |

The kind list is closed and small. Adding a new kind requires a writeup, the same way axes do in the taxonomy.

---

## Schema

```ts
type EntityKind = 'drug' | 'biomarker' | 'sponsor' | 'concept' | 'symptom' | 'trial' | 'condition';

type EntityId = `entity.${EntityKind}.${string}`;
//                       e.g. 'entity.drug.dapagliflozin' | 'entity.biomarker.egfr'

type Entity = {
  id: EntityId;
  kind: EntityKind;
  label: string;                  // 'Dapagliflozin'
  surface_forms: string[];        // ['Dapagliflozin', 'Farxiga', 'dapa']
  indications: IndicationId[];    // multi-membership; [] means cross-cutting
  therapeutic_areas: TAId[];      // derived from indications + entity expertise; stored for query speed
  theme_links: string[];          // FK to Theme.id; default themes for this entity
  metadata: Record<string, unknown>; // kind-specific; see below
  provenance: 'registry' | 'extracted' | 'analyst';
  description?: string;           // optional one-line gloss for tooltips
  status: 'active' | 'deprecated';
};

type EntityMention = {
  segment_id: string;
  span: { start: number; end: number; text: string };
  entity_id: EntityId;
  matched_surface_form: string;   // which form actually matched
  // Theme tags on this span live in separate ThemeTag rows (see CODEBOOK_TAXONOMY.md).
  // The entity's theme_links are SUGGESTIONS for the tagger UI, never authoritative.
};
```

### Kind-specific metadata

| Kind        | metadata fields                                                                |
| ----------- | ------------------------------------------------------------------------------ |
| `drug`      | `class`, `mechanism`, `approval_status`, `brand_names[]`, `routes[]`           |
| `biomarker` | `measurement_type` (numeric/categorical), `normal_range`, `clinical_use`       |
| `sponsor`   | `sponsor_type` (pharma/biotech/academic/cro), `parent_org`                     |
| `concept`   | (open — kind-specific schema deferred until concepts accrue)                   |
| `symptom`   | `severity_scale` (none/clinician/patient), `icd10_codes[]`                     |
| `trial`     | `nct_id`, `phase`, `status`, `sponsor_id` (FK to sponsor entity)               |
| `condition` | `icd10_codes[]`, `is_primary_indication` (false for comorbidities)             |

Metadata is intentionally loose. Each kind needs just enough structure to power the drawer; over-specifying makes the schema fragile to clinical edge cases.

---

## Worked example: Dapagliflozin

```json
{
  "id": "entity.drug.dapagliflozin",
  "kind": "drug",
  "label": "Dapagliflozin",
  "surface_forms": ["Dapagliflozin", "Farxiga", "Forxiga", "dapa"],
  "indications": ["iga_nephropathy", "heart_failure", "type_2_diabetes", "ckd"],
  "therapeutic_areas": ["nephrology", "cardiology", "endocrinology"],
  "theme_links": ["hrqol.general_health", "util.coverage", "util.insurance"],
  "metadata": {
    "class": "SGLT2_inhibitor",
    "mechanism": "Sodium-glucose cotransporter 2 inhibition",
    "approval_status": "FDA approved (multiple indications)",
    "brand_names": ["Farxiga", "Forxiga"],
    "routes": ["oral"]
  },
  "provenance": "registry",
  "description": "SGLT2 inhibitor used for cardiorenal protection across iGAN, HFrEF, T2D, CKD",
  "status": "active"
}
```

When the tagger encounters "Dapagliflozin" in iGAN text, the UI:

1. Auto-matches `entity_id = entity.drug.dapagliflozin`
2. Auto-suggests theme tags: `hrqol.general_health`, `util.coverage`, `util.insurance`
3. The analyst confirms or overrides. Final ThemeTag rows are what persist.

The entity's `theme_links` never override the analyst — they seed the suggestion UI.

---

## Worked example: eGFR

```json
{
  "id": "entity.biomarker.egfr",
  "kind": "biomarker",
  "label": "eGFR",
  "surface_forms": ["eGFR", "GFR", "kidney function", "estimated GFR", "glomerular filtration rate"],
  "indications": ["iga_nephropathy", "lupus_nephritis", "ckd"],
  "therapeutic_areas": ["nephrology"],
  "theme_links": ["hrqol.general_health"],
  "metadata": {
    "measurement_type": "numeric",
    "normal_range": "≥90 mL/min/1.73m²",
    "clinical_use": "kidney function staging (CKD stages 1-5)"
  },
  "provenance": "registry",
  "description": "Estimated glomerular filtration rate — primary kidney function biomarker",
  "status": "active"
}
```

This is the one entity that resolves three of the four iGAN-corpus misses immediately (Dapagliflozin, Sibeprenlimab, eGFR). "Medicine" stays unmatched on purpose — it's a generic noun, not a named entity. Use [util.coverage](CODEBOOK_TAXONOMY.md) or other relevant themes if the sentence requires categorization.

---

## Cross-linking entities to themes

`theme_links` is a list of theme IDs that the entity is TYPICALLY discussed in the context of. They are SUGGESTIONS the tagger UI surfaces when this entity is matched.

Rules of thumb:

- 1–3 theme links per entity is normal. Five is a smell — either the entity is too broad, or the theme links are over-padded.
- Theme links can span multiple axes — a drug is reasonably `hrqol.general_health` AND `util.coverage` simultaneously.
- Theme links are NOT indication-conditional. An entity that means different things in different indications gets the union; the analyst per-span picks.
- For symptoms, theme links usually mirror the symptom's primary HRQoL scale (`fatigue` → `hrqol.vitality`, `pain` → `hrqol.bodily_pain`).

---

## Sources of entities

Entities flow in from three places:

| Provenance   | Source                                                                | Review                                |
| ------------ | --------------------------------------------------------------------- | ------------------------------------- |
| `registry`   | Hand-curated, including imported from drugs.json/sponsors.json and ClinicalTrials.gov sync | analyst review on import        |
| `extracted`  | Proposer scripts (sibling of [propose-fragment-themes.mjs](scripts/propose-fragment-themes.mjs)) extract candidate entities from a corpus | mandatory analyst review before `status: active` |
| `analyst`    | One-off manual entries                                                 | no separate review                    |

Provenance stays on the entity row so the drawer can show source attribution and so analysts know which entities have been vetted.

---

## Storage layout

Entities live in indication-aware JSON files under [src/lib/content/entities/](src/lib/content/entities/) (to be created):

```
src/lib/content/entities/
  drugs.json            # all drug entities (cross-cutting)
  biomarkers.json       # all biomarker entities
  sponsors.json         # all sponsor entities
  trials.json           # all trial entities
  concepts.json         # cross-cutting + per-indication concepts
  symptoms.json         # cross-cutting + per-indication symptoms
  conditions.json       # all conditions (including primary indications, with is_primary_indication: true)
  types.ts              # Entity, EntityKind, EntityMention types
```

Indication scoping happens at the entity-row level (the `indications[]` array), not the file level. Most clinical entities are cross-indication (eGFR for any nephrology, fatigue for any chronic disease), so file-level scoping would force duplication.

Today's [drugs.json](src/lib/content/registries/drugs.json) becomes a seed import — every existing row becomes an Entity with `kind: 'drug'`, the existing `surface_forms`, and a default `theme_links: ['util.coverage']` pending analyst review.

---

## Drawer behavior

Clicking an entity in rendered text opens an **Entity Detail Drawer** (separate from GroupStatsDrawer):

- **Header:** entity label, kind chip, indication chips, TA chips
- **Description:** one-line gloss (if present)
- **Theme links:** clickable chips that filter the body to "this entity in the context of this theme"
- **Surface forms:** literal list, with the form that actually matched highlighted
- **Mentions:** corpus mentions count + sentiment, per indication
- **Cross-indication contrast:** a row per indication where the entity also appears
- **Metadata:** kind-specific (drug class for drugs, NCT_id + phase for trials, normal range for biomarkers)

[GroupStatsDrawer](src/lib/components/GroupStatsDrawer.svelte) is for theme aggregations (and the cross-cutting suffix queries from the taxonomy doc). EntityDetailDrawer is for entities. Different kinds, different drawers, different aggregations — keeping them separate avoids the "swiss-army drawer" trap.

---

## Rules for adding entities

1. **Entities are nouns.** If you can't point to a string of characters someone would TYPE that maps to it, it's a theme, not an entity.
2. **Surface forms are exhaustive.** When you add an entity, list every form an analyst can reasonably expect in patient text — brand names, abbreviations, slang. The matcher fails silently on missing forms.
3. **Multi-indication is the default.** An entity belongs to every indication where it's clinically discussable. Don't iGAN-scope something out of laziness if it's also relevant to lupus_nephritis.
4. **Theme links are seed suggestions, not authoritative.** Pack 1–3, not 5+. The most common contexts are enough; the analyst handles the rest per-span.
5. **Provenance is mandatory.** Every entity declares where it came from. Extracted entities need analyst review before `status: active`.
6. **Deprecate, don't delete.** Set `status: deprecated` when an entity stops being relevant. Deletion breaks historic ThemeTag rows that may still reference it.

---

## Open decisions

- **Brand-name handling.** Is "Farxiga" a surface form of "Dapagliflozin" (one entity, many forms) or its own entity cross-linked to the generic? Doc currently says one. May need to split if brand-vs-generic analysis matters to a sponsor brief.
- **Symptom-as-entity vs. HRQoL theme.** "Fatigue" is both an entity (symptom-named) AND tightly linked to `hrqol.vitality`. Tag both? Auto-imply the theme from the symptom entity? Tentative: tag both. Revisit if it produces noise.
- **Trial entities vs. trials registry.** The project already has a [clinical-trials pipeline](src/routes/patientlyiq/clinical-trials/). Are trial entities pointers into that registry, or do trial entities replace it? Tentative: pointers — entity surfaces NCT_id, rich data stays in the trials registry.
- **Concept scope creep.** "flare," "remission," "biopsy" are clearly concepts. But "specialist," "second opinion," "trial" all have stable surface forms too — are they concept entities or sub-themes? Rule of thumb: if it has a stable surface form analysts can recognize in text, it's an entity; if it's an interpretive category an analyst applies, it's a theme.
- **Comorbid conditions.** Should "comorbid diabetes" become a condition entity even when iGAN is the primary indication? Probably yes — patients reference it, and cross-indication analytics will want to.

---

## What this doc does NOT decide

- **The entity-extraction proposer script** — sibling to [propose-fragment-themes.mjs](scripts/propose-fragment-themes.mjs) that reads a corpus and suggests new entities. Separate doc when Phase 4 of [CODEBOOK_MIGRATION_PLAN.md](CODEBOOK_MIGRATION_PLAN.md) lands.
- **Full Entity Detail Drawer UI** — sketch only here; full layout in a UI artifact.
- **Stats query patterns** — how per-entity, per-indication, cross-indication aggregations are computed. Downstream.
- **Migration sequencing** — covered in [CODEBOOK_MIGRATION_PLAN.md](CODEBOOK_MIGRATION_PLAN.md).
