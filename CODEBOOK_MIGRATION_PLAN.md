# Codebook Migration Plan — v0.3

**Status:** Phases 1–5a shipped · 2026-06-02
**Owner:** Aaron Jun
**Companion to:** [CODEBOOK_TAXONOMY.md](CODEBOOK_TAXONOMY.md), [ENTITY_REGISTRY.md](ENTITY_REGISTRY.md)

## Current state at a glance

| Phase | Status | Visible impact |
|---|---|---|
| 1 — data model parallel | ✅ shipped | none (JSON files exist) |
| 2 — matcher dual-source | ✅ shipped | entity-aware matcher in the bundle |
| 3 — Entity drawer + click dispatch | ✅ shipped | clickable entity spans wherever KeywordText runs with corpus matcher |
| 4 — proposer scripts | ✅ shipped + run on all 5 corpora | 983 candidate entities + 276 ThemeTag rows generated; sitting in `proposed_entities.json` files |
| 5a — ThemeStatsDrawer | ✅ shipped + verified end-to-end | theme-link chips in EntityDetailDrawer open the stats drawer |
| 5b — cluster-theme-map runtime shim | ⏸ deferred | retrofit per consumer surface when next touched |

## What's GENERATED but not yet LIVE

The 983 candidate entities and 276 ThemeTag rows exist on disk but **the matcher doesn't see them yet** because:

1. Proposed entities live in `<corpus>/proposed_entities.json` — not in `entities/<kind>.json` which is what [server/entities.ts](src/lib/server/entities.ts) loads.
2. The iGAN routing bug means `?indication=iga_nephropathy` falls back to `lupus_nephritis` (DB indications table lacks iGAN + Sjögren's).
3. ThemeTag rows in `<corpus>/theme_tags/<source>.json` ARE consumed by [content/theme-tags.ts](src/lib/content/theme-tags.ts) — those work.

**Result:** the codebook migration is architecturally complete but the iGAN-demo coverage hole that motivated it is still visible in the running app. Closing that requires merging the high-confidence proposed entities into the live registries.

## Immediate next steps (v0.3 closeout)

1. **Fix iGAN routing in [lexicon.ts:192](src/lib/server/lexicon.ts#L192)** — union DB + JSON indications when JSON has entries the DB lacks. One-line precondition that everything else depends on.
2. **Merge high-confidence iGAN entities** (conf ≥ 0.85) from [igan_forum_2026q2/proposed_entities.json](src/lib/content/corpora/igan_forum_2026q2/proposed_entities.json) → [entities/drugs.json](src/lib/content/entities/drugs.json) + [entities/biomarkers.json](src/lib/content/entities/biomarkers.json) with `provenance: extracted, status: active`. Marquee targets: Dapagliflozin, Sibeprenlimab, Atacicept, Atrasentan, Sparsentan, Iptacopan, Tarpeyo/Budesonide, Povetacicept, Gd-IgA1, hematuria, UPCR.
3. **Browser smoke-test** the full click-through: navigate to /patientlyiq?indication=iga_nephropathy on the upload page (or any KeywordText-using surface) → click eGFR → EntityDetailDrawer → click theme-link chip → ThemeStatsDrawer with real iGAN data.

## Deferred work

- **Phase 5b cluster-theme-map shim wiring** — retrofit [exec-summary-config.json](src/lib/content/exec-summary-config.json), dashboard blurbs, journey-map widgets per-page when each is next touched. Avoids a big-bang refactor.
- **Persona-pillars prompt tightening + full-corpus runs** — [propose-persona-pillars.mjs](scripts/propose-persona-pillars.mjs) drafted and proven on iGAN sample 40 ($0.01). Model over-tags `medical_self_efficacy:high` (54% prevalence on a topic-vs-signal confusion). Prompt revision is a 10-minute fix; full runs are ~$1.
- **Full theme-tag runs on all 5 corpora** — today they're --sample 40 (~50 rows per corpus). Full runs (~$1 on Haiku) would give ThemeStatsDrawer real volume and make wildcard queries (`*.financial`, `hrqol.*`) statistically meaningful.
- **Analyst review pass on the other 4 corpora's proposed entities** — same merge workflow as the iGAN one, ~30 min per corpus.

---

The current codebase has `cluster_id` baked into ~12 surface areas — [exec-summary-config.json](src/lib/content/exec-summary-config.json), [dashboard_blurbs.json](src/lib/content/wctglpdemo-data/dashboard_blurbs.json), autotag outputs, journey-map widgets, [GroupStatsDrawer](src/lib/components/GroupStatsDrawer.svelte), [KeywordTagDrawer](src/lib/components/KeywordTagDrawer.svelte), the keyword matcher, the [lexicon API endpoint](src/routes/api/lexicon/+server.ts), and per-corpus annotation files. Replacing this naively would break every downstream artifact at once.

This doc plans a **5-phase, backward-compatible migration** that lands the new taxonomy + entity layer alongside the existing system, lets them coexist for a release, then deprecates clusters. Each phase is independently shippable and reversible.

---

## Current state

```
                        ┌──────────────────────────────┐
   keyword_lexicon.json ┤   80 ad-hoc clusters         │
                        │   (lupus + cross-cutting)    │
                        │   indication=iGAN → 0 rows   │
                        └──────────────────────────────┘
                                    │ buildKeywordMatcher
                                    ▼
                    ┌──────────────────────────────────┐
                    │   render-time regex match        │
                    │   span → cluster_id[]            │
                    └──────────────────────────────────┘
                                    │
                ┌───────────────────┼────────────────────┐
                ▼                   ▼                    ▼
         GroupStatsDrawer    exec-summary         dashboard-blurbs
         (cluster + theme    (anchor sub-         (cluster axes)
          stats)               theme cluster)

   drugs.json, sponsors.json — exist, but do NOT feed into matcher.
   iGAN coverage: zero indication-scoped clusters.
```

## Target state

```
                      ┌────────────────────┐    ┌────────────────────────┐
   themes.json        │  26 universal      │    │  entity registries     │
   (new)              │  themes (hrqol/    │    │  (drugs, biomarkers,   │
                      │  util/trial/life)  │    │   symptoms, sponsors,  │
                      │  + dx overlays     │    │   trials, concepts)    │
                      └────────────────────┘    └────────────────────────┘
                                  │                       │
                                  └───────────┬───────────┘
                                              ▼
                              ┌────────────────────────────┐
                              │  buildMatcher(themes,      │
                              │    entities) — surface     │
                              │    forms from both,        │
                              │    multi-tag per span      │
                              └────────────────────────────┘
                                              │
                       ┌──────────────────────┼──────────────────────┐
                       ▼                      ▼                      ▼
                ThemeStatsDrawer      EntityDetailDrawer       autotag pipeline
                (per axis,            (per entity, with        (proposes Theme-
                 with suffix          cross-indication         Tag rows + new
                 wildcards)           comparison)              entity rows)
```

---

## Phases

### Phase 1 — Data model parallel (no behavior change)

**Goal:** themes.json and entity registries exist; nothing yet reads them.

- Create [src/lib/content/themes/themes.json](src/lib/content/themes/themes.json) with all 27 themes per [CODEBOOK_TAXONOMY.md](CODEBOOK_TAXONOMY.md)
- Create [src/lib/content/entities/](src/lib/content/entities/) with:
  - `drugs.json` (migrated from registries/drugs.json with provenance: registry)
  - `biomarkers.json` (seeded with eGFR, UPCR, hemoglobin, BNP, BUN, serum creatinine, proteinuria)
  - `sponsors.json` (migrated from registries/sponsors.json)
  - Empty `symptoms.json`, `concepts.json`, `trials.json`, `conditions.json`
- Type definitions in [src/lib/content/themes/types.ts](src/lib/content/themes/types.ts) and [src/lib/content/entities/types.ts](src/lib/content/entities/types.ts) per the schemas in the spec docs
- Lexicon API endpoint unchanged; clusters still the source of truth

**Ships:** new JSON files + types. Zero runtime impact.
**Reversible:** delete the new files.
**Demo target:** none — internal data model only.

### Phase 2 — Matcher dual-source

**Goal:** the matcher recognizes entity surface forms alongside cluster surface forms. Render layer doesn't change yet.

- `buildKeywordMatcher` learns to also fold in entity surface forms from the new entity registries
- Matcher emits both `cluster_id` (legacy) AND `entity_id` (new) on matched spans
- Render layer ([CodedFragmentCard](src/lib/components/CodedFragmentCard.svelte), [KeyQuoteCard](src/lib/components/KeyQuoteCard.svelte), KeywordText) still routes `cluster_id` clicks to [GroupStatsDrawer](src/lib/components/GroupStatsDrawer.svelte); silently ignores `entity_id` for now
- Smoke test: open iGAN corpus, confirm "Dapagliflozin", "Sibeprenlimab", and "eGFR" now appear as MATCHED spans (yellow highlight via the matcher), even though click behavior is unchanged

**Ships:** matcher rewrites.
**Visible change:** iGAN-mentioned drugs/biomarkers now light up in the page. Click behavior unchanged.
**Reversible:** matcher returns only `cluster_id[]`.

### Phase 3 — Entity drawer + theme rollups land

**Goal:** entity clicks open the EntityDetailDrawer; theme aggregations show up on a per-axis basis with suffix-wildcard query support.

- Build EntityDetailDrawer per [ENTITY_REGISTRY.md](ENTITY_REGISTRY.md)
- Build ThemeStatsDrawer (or extend [GroupStatsDrawer](src/lib/components/GroupStatsDrawer.svelte) with axis-aware mode)
- Render layer wires `entity_id` clicks to EntityDetailDrawer; `cluster_id` clicks still go to legacy GroupStatsDrawer
- Support suffix-wildcard queries (`*.financial`) at the API + drawer level (mostly drawer + aggregation helper)

**Ships:** new drawers + click handlers. Two drawers coexist.
**Visible change:** Dapagliflozin/eGFR clicks now open the EntityDetailDrawer with cross-indication contrast. Theme aggregations work axis-by-axis.
**Reversible:** disable the entity click handler; entity matches just don't link.

### Phase 4 — Autotag rewrites to emit ThemeTag rows

**Goal:** new proposer scripts populate the entity registry from real corpora and emit ThemeTag rows (span, theme_id) keyed off the new 27-theme taxonomy. Closes the iGAN coverage hole at the entity layer; sets up Phase 5 to consolidate the legacy and new tagging paths.

**Scripts shipped:**

| Script | What it does |
|---|---|
| [scripts/propose-entities.mjs](scripts/propose-entities.mjs) | Reads a corpus, scans fragments with the LLM, dedupes against existing entities, outputs `<corpus>/proposed_entities.json` with confidence + evidence excerpts per candidate. |
| [scripts/propose-theme-tags.mjs](scripts/propose-theme-tags.mjs) | Reads a corpus, emits per-span ThemeTag rows (span: {start, end, text}, theme_id, tagger, confidence) under `<corpus>/theme_tags/<source>.json`. Sibling to the existing [propose-fragment-themes.mjs](scripts/propose-fragment-themes.mjs) which keeps writing legacy whole-fragment theme tags. |

Both use `claude-opus-4-7`, structured-output JSON, adaptive thinking, and the `--sample N` flag for cheap test runs. Per-batch checkpoint writes so interrupted runs leave consistent output.

**Smoke-test result (iGAN, --sample 60):** 14 candidates surfaced including Budesonide/Tarpeyo/Nefecon, Povetacicept, RAINIER trial, IgG biomarker, brain fog symptom, dialysis + kidney transplant concepts, comorbid CKD. Dapagliflozin/Sibeprenlimab require a full 459-fragment run to surface (not in the first 60 sample).

**Analyst review workflow (proposed_entities.json):**

1. Open `src/lib/content/corpora/<corpus>/proposed_entities.json`.
2. For each candidate:
   - Verify `kind`, `label`, `surface_forms[]` are correct.
   - Confirm `indications` (the script proposes only what it observed; analyst can broaden).
   - Adjust `theme_links_suggested` if the defaults don't fit.
   - Parse + correct `metadata` per kind.
3. Merge accepted rows into `src/lib/content/entities/<kind>.json` with `provenance: "extracted"` and `status: "active"`.
4. Run [propose-theme-tags.mjs](scripts/propose-theme-tags.mjs) on the same corpus once entities are merged (so multi-tag spans can co-occur with entity matches at render time).
5. Hand-tag a small validation slice and diff against LLM output to estimate per-corpus precision/recall.

**Annotation file shape (theme_tags):**

```json
{
  "meta": { "schema_version": "theme-tags-0.1", "corpus_id": "...", ... },
  "theme_tags": {
    "<fragment_id>": [
      {
        "span": { "start": 14, "end": 42, "text": "the pain of losing my job" },
        "theme_id": "life.occupation",
        "tagger": "llm-proposed",
        "confidence": 0.88,
        "rationale": "...",
        "created_at": "..."
      },
      {
        "span": { "start": 14, "end": 42, "text": "the pain of losing my job" },
        "theme_id": "hrqol.mental_health",
        "tagger": "llm-proposed",
        "confidence": 0.71,
        "rationale": "..."
      }
    ]
  }
}
```

Same span carries multiple theme_id rows — the multi-tag contract from CODEBOOK_TAXONOMY.md.

**Ships:** two proposer scripts, both tested for parse/syntax; propose-entities verified end-to-end on iGAN.
**Visible change (so far):** new analyst-reviewable JSON file per corpus run. No UI consumption yet — Phase 3's EntityDetailDrawer + Phase 5's ThemeStatsDrawer are the consumers.
**Reversible:** revert the propose scripts; output files are stand-alone artifacts under `<corpus>/`, no side effects on existing data.

**Known gaps after Phase 4:**

- Legacy `keyword_tags` rows still exist in `<corpus>/annotations/<source>.json`; the back-compat shim [cluster-theme-map.json](src/lib/content/cluster-theme-map.json) is the bridge. Wiring that shim into runtime read paths is Phase 5 work.
- [propose-fragment-themes.mjs](scripts/propose-fragment-themes.mjs) (the legacy 3-theme version) still runs alongside; it's the source of truth for existing dashboards until the new tag pipeline has analyst-approved validation rates.
- No `ThemeStatsDrawer` UI yet (Phase 3 deferred this when there were no ThemeTag rows to aggregate; now there are, but the drawer is Phase 5).

### Phase 5 — ThemeStatsDrawer + (deferred) cluster deprecation

**Phase 5a (ThemeStatsDrawer + data flow) — SHIPPED.** The visible win: the new ThemeTag rows from Phase 4 now flow through to a working drawer with axis-level rollups and suffix-wildcard query support.

**Files shipped:**

| File | Purpose |
|---|---|
| [src/lib/content/theme-tags.ts](src/lib/content/theme-tags.ts) | Bundled-glob loader over `corpora/*/theme_tags/*.json`. Exports `getThemeStats(activeIndication, query)` supporting exact (`hrqol.bodily_pain`) and wildcard (`*.financial`, `hrqol.*`) queries. Sentiment cross-references the legacy `annotations/<source>.json` per-fragment `sentiment_score`. |
| [src/lib/stores/theme-drawer.svelte.ts](src/lib/stores/theme-drawer.svelte.ts) | Sibling store to entityDrawer + groupDrawer. `themeDrawer.open(query)` opens the drawer. |
| [src/lib/components/ThemeStatsDrawer.svelte](src/lib/components/ThemeStatsDrawer.svelte) | Axis-chip palette, breakdown table for wildcard queries, sentiment distribution, example-span evidence cards with rationale + confidence. |
| [EntityDetailDrawer.svelte](src/lib/components/EntityDetailDrawer.svelte) (edit) | Theme-link chips are now clickable buttons → `themeDrawer.open(theme_id)`. Pivot from entity to theme without closing the drawer stack. |
| [patientlyiq/+layout.svelte](src/routes/patientlyiq/+layout.svelte) (edit) | Mounts ThemeStatsDrawer alongside GroupStatsDrawer + EntityDetailDrawer; resolves the active theme stats via `getThemeStats(activeIndication, themeDrawer.current.query)`. |

**End-to-end verified** with the lupus corpus's 72 ThemeTag rows from `propose-theme-tags.mjs --sample 40 ln_reddit_2026q1`:

- Exact query `hrqol.bodily_pain`: 13 tag rows, avg sentiment −0.85, 8 example spans surfaced (top: "lifting my finger, I would be in excruciating pain" — conf 0.95, sent −2)
- Wildcard `hrqol.*`: 7 themes matched, 39 total tag rows, full per-theme breakdown
- Wildcard `*.financial`: matches `life.financial` (suffix matrix from CODEBOOK_TAXONOMY.md is now a real query)
- Empty case `nonexistent.theme`: 0 tag rows, drawer renders empty state

**Phase 5b (cluster deprecation runtime shim) — DEFERRED.** The architectural goal of Phase 5 (proving ThemeTag rows render through to a working drawer with the suffix matrix as a first-class query type) is satisfied by 5a. Wiring legacy `cluster_id` consumers ([exec-summary-config.json](src/lib/content/exec-summary-config.json), dashboard blurbs, journey-map widgets) to read theme_ids through the [cluster-theme-map.json](src/lib/content/cluster-theme-map.json) shim is best done as each consumer surface is next touched — a per-page retrofit rather than a big-bang refactor. GroupStatsDrawer continues to coexist with ThemeStatsDrawer; both are mounted at the layout.

**Visible change after 5a:** click any theme_link chip in EntityDetailDrawer → ThemeStatsDrawer opens with real corpus stats. Suffix-wildcard queries like `*.financial` are addressable in code (an HTML UI affordance for them is the natural next step).
**Reversible:** disable the theme-link click handlers in EntityDetailDrawer; nothing else depends on the new path.

**What's deferred from the original Phase 5 spec:**

- Retiring `cluster_id` from the matcher output → no — matcher still emits both
- All consumer surfaces reading ThemeTag rows → no — exec-summary still reads cluster-keyed configs
- GroupStatsDrawer retirement → no — kept for the legacy click paths
- The compilation of [keyword_lexicon.json](src/lib/content/wctglpdemo-data/keyword_lexicon.json) into themes.json + entities → no — manual review pass via [cluster-theme-map.json](src/lib/content/cluster-theme-map.json) is the bridge for now

---

## Per-phase risk + mitigation

| Phase | Risk                                          | Mitigation                                                                          |
| ----- | --------------------------------------------- | ----------------------------------------------------------------------------------- |
| 1     | Schema drift — types defined but never used   | Land Phase 2 within the same release window                                         |
| 2     | Matcher slows down with more surface forms    | Benchmark before merge; cap regex pass at N forms; consider trie-backed matcher     |
| 3     | Two drawers confuse analysts                  | Visual differentiator (entity-kind chip, distinct header); 30s screencast for analysts |
| 4     | Autotag quality regression                    | Run on a known-good corpus and diff outputs before any production corpora           |
| 5     | A downstream consumer was missed              | Pre-deprecation grep audit; soft-deprecate `cluster_id` for one release before removal |

---

## Migration sequence by corpus

iGAN goes first — it has zero current coverage, so there's no legacy to preserve.

| Order | Corpus                  | Why this order                                                          |
| ----- | ----------------------- | ----------------------------------------------------------------------- |
| 1     | iga_nephropathy (`igan_forum_2026q2`) | Net new. Zero cluster history. Best demo of "redesign closes a hole."  |
| 2     | Sjögren's               | Also net new (untracked corpus folder). Same situation as iGAN.        |
| 3     | multiple_sclerosis      | Light keyword tagging. Migration is mostly additive.                    |
| 4     | lupus_nephritis         | Densest hand-tagged data. Migration MUST preserve every cluster_id → theme_id mapping. |
| 5     | obesity (`wct_glp1_2025q4`) | Most mature — exec-summary configs, dashboard blurbs, anchor sub-themes all point here. Last, with full validation. |

---

## Back-compat shim

For the duration of Phases 2–4, every legacy `cluster_id` has a derived primary `theme_id`. The mapping lives in `src/lib/content/cluster-theme-map.json` (to be authored at start of Phase 2):

```json
{
  "trial_barriers": "trial.eligibility",
  "trial_logistics": "trial.logistics",
  "insurance_friction": "util.insurance",
  "cost_burden": "life.financial",
  "provider_trust": "util.relationship",
  "fatigue_cluster": "hrqol.vitality"
}
```

Pure 1:1 mapping. Cluster IDs that don't map cleanly (tautological self-references caught by [Hard rule #3](CLAUDE.md), or stale clusters that no longer matter) get marked `null` and disappear from the new system.

- During Phase 2: the matcher emits both `cluster_id` and (via the shim) `theme_id`.
- During Phase 3: GroupStatsDrawer reads `cluster_id` directly; ThemeStatsDrawer reads `theme_id`.
- During Phase 4: autotag outputs `theme_id` natively; cluster_id derived only on legacy reads.
- During Phase 5: shim removed.

The shim is the load-bearing artifact of the whole migration. Worth a dedicated review pass with Aaron when Phase 2 starts.

---

## Open decisions

- **Release cadence.** Each phase its own release? Or batch phases 1+2 and 3+4? Tentative: 1+2 batched (internal-only), 3 standalone (UI change), 4 standalone (pipeline change), 5 standalone (cleanup).
- **Cluster-theme-map authorship.** Who authors the 80-cluster → theme mapping? Suggest: Aaron + LLM proposal + analyst review. Needs a sit-down at Phase 2 kickoff.
- **iGAN-first vs. hardest-first.** I propose iGAN first (least risk, biggest visible win). Alternative: do lupus_nephritis first because it surfaces the hardest back-compat questions immediately and de-risks the migration. Either is defensible.
- **Cluster_id removal timeline.** When does cluster_id actually disappear? Suggest: 2 releases after Phase 5 lands, giving any external consumers a deprecation window.
- **Phase 1 + 2 atomic?** Land them together so the entity files are immediately used by the matcher (avoiding the "JSON files that nothing reads" smell)? Trade-off: bigger PR, less reversibility.

---

## What this doc does NOT decide

- **Phase ETA / staffing** — depends on team bandwidth, not data model.
- **Specific UI mockups for EntityDetailDrawer** — sketched in [ENTITY_REGISTRY.md](ENTITY_REGISTRY.md), full layout in a separate UI artifact.
- **The propose-entities.mjs prompt design** — when Phase 4 lands.
- **How indication overlays (`dx.*`) get authored** — per-indication workflow, separate doc when the first overlay is needed.
