# Build out `disease-insights/<id>/` data pack

You are populating a per-indication data folder under `src/lib/content/disease-insights/`. Each folder is a self-describing bundle: a manifest plus a tree of dataset files (search volume, community engagement, ad spend, etc.). The folder is auto-discovered by `src/lib/content/disease-insights/index.ts` via `import.meta.glob` — drop a clean folder in and it shows up in the app without code changes.

This prompt complements [`build-drugs-registry.md`](./build-drugs-registry.md) and [`build-keyword-lexicon.md`](./build-keyword-lexicon.md). When a scope says "stand up a new indication end-to-end," do the indication registration first (see [`build-indications.md`](./build-indications.md)), then drugs, then lexicon clusters, then this data pack.

---

## How to use this prompt

The user will hand you a **scope** of the form `<indication_id> + <dataset types>`:
- "Build the melanoma data pack — search volume topics, ad spend Jan–Jun 2024, community engagement."
- "Add an ad-spend timeseries for lupus nephritis Q1 2025."
- "Extend the obesity folder with TikTok and Reddit community engagement."

If the scope is ambiguous (which datasets, which time window, which geography), ask before sourcing.

---

## Repository layout

```
src/lib/content/disease-insights/
├── index.ts                        ← READ-ONLY (auto-discovery)
└── <slug>/
    ├── manifest.json               ← lists every dataset in this folder
    ├── lexicon/
    │   └── keyword_clusters.json   ← optional; see lexicon prompt
    ├── search/
    │   ├── treatment_searches_us.json
    │   ├── relative_search_volume.json
    │   └── ad_spend_<window>.json
    └── communities/
        └── <platform>_engagement.json
```

The folder slug is **kebab-case** of the indication id (`lupus_nephritis` → `lupus-nephritis`, `lupus-nephritis` → `lupus-nephritis`). `manifest.slug` must match the folder name; the index validates this and throws on mismatch.

---

## The manifest schema

```json
{
  "schema_version": "1.0",
  "id": "lupus_nephritis",
  "slug": "lupus-nephritis",
  "label": "Lupus Nephritis",
  "abbreviation": "LN",
  "therapeutic_area_ids": ["immunology", "nephrology"],
  "datasets": [
    {
      "id": "lupus_nephritis_treatment_searches_us",
      "type": "search_volume_topics",
      "label": "Lupus nephritis treatment searches (US, monthly)",
      "path": "search/treatment_searches_us.json",
      "geography": "US",
      "unit": "monthly_estimated_search_volume",
      "source_id": null
    }
  ]
}
```

| Field | Rules |
|---|---|
| `id` | Must match an entry in `registries/indications.json` (the disease must already be registered). |
| `slug` | Kebab-case of `id`; must match the folder name. |
| `label`, `abbreviation` | Pulled from `registries/indications.json` for consistency. |
| `therapeutic_area_ids[]` | Same as the indication's TAs in the registry. |
| `datasets[]` | One entry per file in the folder (excluding the manifest itself). |
| Each `datasets[].type` | Must match an id in `registries/dataset_types.json` (currently `keyword_clusters`, `search_volume_topics`, `community_engagement`, `ad_spend_timeseries`). |
| Each `datasets[].path` | Relative to the folder root. Must point to a real file. |

---

## Dataset envelope schema

Every dataset payload (regardless of type) carries a common envelope:

```json
{
  "id": "lupus_nephritis_treatment_searches_us",
  "type": "search_volume_topics",
  "indication_id": "lupus_nephritis",
  "therapeutic_area_ids": ["immunology", "nephrology"],
  "title": "Lupus nephritis treatment searches",
  "subtitle": "Monthly estimated volume, US",
  "unit": "monthly_estimated_search_volume",
  "geography": "US",
  "time_period": null,
  "source": {
    "type": "manual_extract",
    "source_image": "CleanShot 2026-05-23 at 10.45.06@2x.png",
    "notes": "Values manually extracted from chart image."
  },
  "dimensions": ["topic"],
  "measures": ["volume"],
  "data": [
    { "topic": "Lupkynis", "volume": 2660 },
    { "topic": "Belimumab", "volume": 200 }
  ]
}
```

| Field | Rules |
|---|---|
| `id`, `type`, `indication_id`, `therapeutic_area_ids[]` | Must mirror the manifest entry exactly. |
| `title`, `subtitle` | Display strings. Title is required; subtitle optional. |
| `unit` | String describing what `measures` count (`USD`, `monthly_estimated_search_volume`, `count`, etc.). |
| `geography` | ISO country code or descriptive string (`US`, `EU`, `Global`, etc.); `null` if not geographic. |
| `time_period` | Free-form (`Jan–Jun 2023`); `null` if not temporal. |
| `source.type` | FK → `registries/sources.json` (currently `manual_extract`, `primary_research`, `third_party_provider`). |
| `source.source_image` / `source.url` / `source.provider` | One of these depending on `source.type`. Always include `source.notes` describing provenance. |
| `dimensions[]` | The categorical axes each row carries (e.g. `["topic"]`, `["group_type"]`, `["domain", "month"]`). |
| `measures[]` | The numeric fields each row carries. |
| `data[]` | Rows. Each row has every `dimension` and every `measure` as keys. Don't include extra fields. |

---

## Dataset-type recipes

### `search_volume_topics`

```json
"dimensions": ["topic"],
"measures": ["volume"],
"data": [{ "topic": "...", "volume": 1234 }]
```

Use for "topic X by search volume" tables. `topic` is free-form (a drug name, a symptom, a query phrase). `volume` is in whatever unit `unit` declares.

### `community_engagement`

```json
"dimensions": ["group_type"],
"measures": ["avg_membership", "avg_monthly_posts"],
"data": [
  { "group_type": "public", "avg_membership": 1200, "avg_monthly_posts": 45 },
  { "group_type": "private", "avg_membership": 450, "avg_monthly_posts": 175 }
]
```

Use for "patient community type vs. engagement" comparisons. Group type is typically `public` vs `private`, but other splits are fine (`advocacy_sponsored` vs `independent`, etc.). Include a `platform` field at the envelope level.

### `ad_spend_timeseries`

```json
"dimensions": ["domain", "month"],
"measures": ["estimated_spend"],
"data": [
  { "domain": "novonordisk.com", "month": "2023-01", "estimated_spend": 1500000 }
]
```

Use for monthly ad spend per branded domain. Month is `YYYY-MM`. Spend in `USD`. Domain is the marketing domain, lowercased.

### `keyword_clusters`

Same shape as `keyword_lexicon.json` clusters but scoped to the indication (status: future — these are the per-indication cluster files that will eventually replace the monolithic lexicon). See the [lexicon prompt](./build-keyword-lexicon.md) for cluster authoring.

---

## Validation workflow

```bash
# 1. Manifest + dataset envelope + path resolution
npm run validate:disease-insights

# 2. TypeScript types (the auto-discovery glob validates folder/slug match)
npm run check 2>&1 | grep -E "disease-insights|registries" | head -10
```

`validate-disease-insights.mjs` checks:
- Every folder has a `manifest.json`.
- Every manifest's `slug` matches the folder name.
- Every dataset `path` resolves to a real file.
- Every dataset payload's `id` matches the manifest entry.
- Every dataset payload's `type` matches the manifest entry.

If validation fails, the message names the folder and file — fix and re-run.

---

## Sourcing guidance

| Dataset type | Preferred sources |
|---|---|
| `search_volume_topics` | Google Keyword Planner, SEMrush, Ahrefs, SimilarWeb. For "manual extract" cases, capture the source image and keep the filename in `source.source_image`. |
| `community_engagement` | Public Facebook group counts, Reddit subscriber + post counts, Inspire community stats, HealthUnlocked / PatientsLikeMe activity. Use platform-native counts only. |
| `ad_spend_timeseries` | Pathmatics, MediaRadar, AdBeat, SEMrush ads view. Note the licensing — these are usually third-party-provider data; set `source.type: "third_party_provider"` and `source.provider`. |
| `keyword_clusters` | Use the lexicon prompt's research workflow. |

**Manual extracts from chart images:** if the user gives you a screenshot of a chart, read the values by hand and set `source.type: "manual_extract"`, `source.source_image: "<filename>"`, and `source.notes` describing what was extracted and any assumptions (axis interpolation, label ambiguity).

**Cross-source aggregation:** never average across providers without flagging it in `source.notes`. Different providers' definitions of "search volume" or "ad spend" don't align cleanly.

---

## Definition of done

For a given scope, you are done when:

- [ ] The folder exists at `src/lib/content/disease-insights/<slug>/`.
- [ ] `manifest.json` lists every dataset file in the folder.
- [ ] Every dataset file matches the envelope schema.
- [ ] Every dataset's `dimensions` and `measures` are accurate (every row has all of them, no extras).
- [ ] `source` metadata is complete on every file (type + provider/image/url + notes).
- [ ] `npm run validate:disease-insights` passes.
- [ ] `npm run check` shows no new errors.
- [ ] Summary report produced.

---

## Deliverable format

```
Scope: <indication> + <dataset types>

Added:
  Folder: src/lib/content/disease-insights/<slug>/ (new | existing)
  Datasets: N

By type:
  search_volume_topics: +X
  community_engagement: +Y
  ad_spend_timeseries: +Z

New dataset ids:
  <id1>, <id2>, ...

Source provenance:
  <id1> — <source.type> via <provider/image>
  ...

Flagged for user review:
  - <reason>

Validation: passed | failed (with details)
```

---

## Worked example — adding an ad-spend dataset to melanoma

**Goal:** add Jan–Jun 2024 digital ad spend for melanoma (top branded domains).

**1. Confirm the folder exists.** `src/lib/content/disease-insights/melanoma/manifest.json` already exists. Good.

**2. Create the dataset file** at `melanoma/search/ad_spend_jan_jun_2024.json`:

```json
{
  "id": "melanoma_ad_spend_jan_jun_2024",
  "type": "ad_spend_timeseries",
  "indication_id": "melanoma",
  "therapeutic_area_ids": ["oncology"],
  "title": "Estimated monthly digital search ad spend — top-spending melanoma players",
  "subtitle": "Jan–Jun 2024",
  "unit": "USD",
  "geography": "US",
  "time_period": "2024-01 to 2024-06",
  "source": {
    "type": "third_party_provider",
    "provider": "Pathmatics",
    "notes": "Licensed Pathmatics export, branded-domain digital ad spend, exact-match domain rule."
  },
  "dimensions": ["domain", "month"],
  "measures": ["estimated_spend"],
  "data": [
    { "domain": "keytruda.com", "month": "2024-01", "estimated_spend": 850000 }
    // ... etc
  ]
}
```

**3. Append the dataset to `manifest.json` `datasets[]`:**

```json
{
  "id": "melanoma_ad_spend_jan_jun_2024",
  "type": "ad_spend_timeseries",
  "label": "Estimated monthly digital search ad spend — top melanoma players (Jan–Jun 2024)",
  "path": "search/ad_spend_jan_jun_2024.json",
  "geography": "US",
  "unit": "USD",
  "source_id": null
}
```

**4. Validate:**

```bash
npm run validate:disease-insights
# OK — 2 disease folder(s), 6 dataset(s), 1 cluster file(s)
```

---

## Open questions to surface

1. **Indication isn't in `registries/indications.json` yet** — stop, ask the user to add it via the indications prompt.
2. **A new dataset type isn't in `registries/dataset_types.json`** — propose the new type (id, label, description, dimensions, measures) and let the user add it. Don't unilaterally introduce a new type.
3. **Source data quality is questionable** — flag it in `source.notes` and surface to the user.
4. **The same dataset already exists for a different time window** — confirm whether to replace or add side-by-side.
5. **Cross-indication aggregation** (e.g. "all autoimmune ad spend") — confirm whether to keep it scoped to one indication folder or whether a separate cross-indication folder is needed (today, no).

---

## Constraints — what NOT to do

- ❌ Don't add a folder for an indication that isn't in `registries/indications.json` yet.
- ❌ Don't add a `type` that isn't in `registries/dataset_types.json`.
- ❌ Don't put data outside the envelope schema. Every row needs every `dimension` and every `measure` — no extras, no missing.
- ❌ Don't paraphrase source data. Numbers come from one source; aggregation needs explicit notes.
- ❌ Don't omit `source.notes`. Even for third-party-provider data, describe the licensing / export / interpretation choices.
- ❌ Don't modify `manifest.slug` once a folder is published — annotations elsewhere may reference it.
- ❌ Don't commit on `main`. Work on `data/disease-insights-<indication>-<scope>`.
- ❌ Don't ship a dataset that fails `validate:disease-insights`.

---

## Final note

Disease-insights datasets are evidence — they show up as charts in the app and as supporting context in analyst narratives. Provenance matters: a beautifully shaped dataset with vague sourcing is worse than a smaller dataset with rigorous notes. When sourcing is thin, ship less and flag what's missing rather than padding with low-confidence numbers.
