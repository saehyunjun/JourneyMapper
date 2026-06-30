# PatientlyIQ load-time refactor

Tracking the work to fix slow `/patientlyiq` loads. Diagnosis came out of investigating bundle/data weight on 2026-05-31; the structural call was **refactor in place, don't rewrite** — the data model is sound, the symptoms are all "eager when it should be lazy."

## Bottlenecks (prioritized)

| # | Item | Status | Notes |
|---|------|--------|-------|
| 7 | Vite dev watcher ignores `disease-insights/` + `corpora/` | ✅ | Surgical: only fragment/annotation/keyword_tags/artifacts subtrees + the two huge `raw_studies.json` / `studies_normalized.json` files. Manifests + ingest configs still hot-reload |
| 1 | `corpus-store.ts` — 6 `import.meta.glob({ eager: true })` calls | ✅ | Replaced with lazy + memoized loaders. Layout loader's per-request `listCorpusIds` + `loadCorpusManifest` loop now only parses the manifests it actually needs; fragments/annotations stay unparsed until a page calls `loadCorpusFragments`. svelte-check: -16 errors vs baseline, none in corpus-store API |
| 2 | `wctglpdemo-data/analysis.ts` — 9 static JSON imports → 492 KB chunk | ◐ | **2a done:** `keyword_usage.json` (730 KB — ~44% of total) extracted to [analysis-keywords.ts](src/lib/content/wctglpdemo-data/analysis-keywords.ts). Only 4 importers needed updating (community, interview-words, _archive_v3, ThemeConstellation); the other ~36 importers of `analysis.ts` now get a chunk without keyword_usage. Types re-exported from analysis.ts for back-compat. **2b open:** consider splitting `segments.json` (275 KB), `segment_tags.json` (290 KB), `interviews_structured.json` (164 KB), `word_usage.json` (156 KB) similarly if measurement still shows a hot chunk |
| 3 | `disease-insights/*/clinical_trials/raw_studies.json` — 130 MB (MS) + 91 MB (obesity) + 15 MB (LN); normalized variant ~11 MB MS is what page actually loads | ☐ | Pre-project to bubble-chart-only shape at build time; comments in the file say target is ~300 KB |
| 4 | Monolithic pages: `upload/+page.svelte` (2,528 lines), `journey-workbench/+page.svelte` (2,185), `patientlyiq/+page.svelte` (1,747) — landing page statically imports `lnLtfuFriction`, `lnSuggestedResearch`, `msSuggestedResearch` for conditional cards | ☐ | Dynamic-import disease-conditional blocks |
| 5 | `lib/server/lexicon.ts` — 141 KB bundled lexicon JSON parsed on every cold start of layout loader | ✅ | Added `lazySeed()` helper + `SeedSource<T>` to [kv-store.ts](src/lib/server/kv-store.ts); converted seeds in [lexicon.ts](src/lib/server/lexicon.ts), [segment-tags.ts](src/lib/server/segment-tags.ts), [participant-profiles.ts](src/lib/server/participant-profiles.ts) — lazy keyword_lexicon (141 KB), segments (275 KB), segment_tags (290 KB), interviews_structured (164 KB), codebook (×2). In dev the local-file path is always hit, so these JSONs now never load. In prod they only load on the fallback when Redis is empty/missing |
| 6 | D3 + layerchart not lazy — no `import()` splits in patientlyiq routes | ☐ | Dynamic-import per chart component |

Legend: ☐ not started · ⏳ in progress · ✅ done

## Log

### 2026-05-31

- Diagnosed bottlenecks (see table above). Decision: refactor, not rewrite.
- Starting with #7 (quickest unblock for dev) and #1 (biggest prod win).
- **#7 shipped** ([vite.config.ts](vite.config.ts)). Bulk-data subtrees added to watcher ignores; the small per-corpus config files still hot-reload.
- **#1 shipped** ([src/lib/server/corpus-store.ts](src/lib/server/corpus-store.ts)). All six eager globs converted to `buildSeedLoaders` + `memoizeLoader`. New `loadSeed()` helper for the common `loaders.get(key)?.()` pattern. The two map-builders that need to project across all files (`getJourneyMapsByIndication`, `getParticipantProfilesSeed`) are lazy + memoized at the aggregate level. Typecheck clean for the changed surface.

- **#2a shipped** ([analysis.ts](src/lib/content/wctglpdemo-data/analysis.ts) + [analysis-keywords.ts](src/lib/content/wctglpdemo-data/analysis-keywords.ts)). Picked the surgical split rather than the 40-file sync→async migration: kept all existing sync exports on `analysis.ts`, moved `keyword_usage.json` (730 KB, the biggest of the 9 imports) + `keywordBySegment` / `segmentsForKeyword` / `keywordBreakdown` / `buildRadialTree` to a new file. Type-only re-exports (`export type { RadialNode, KeywordMatchContext, ... }`) keep existing type importers working without runtime cost. Four importers updated. Exported the three shared lookup maps (`segmentById`, `annotationBySegment`, `quoteBySegment`) so analysis-keywords joins against the same source of truth. svelte-check: 567 errors — same as baseline after #1, no regressions in touched files.
- **#5 shipped** ([kv-store.ts](src/lib/server/kv-store.ts) + 3 caller files). Triggered by `[kv-store] REDIS_URL not set` log spam — every page was warming the fallback path and the eager static JSON imports were paying for it. Added `SeedSource<T> = T | (() => T | Promise<T>)` to `loadDoc` and a `lazySeed()` helper that memoizes a dynamic-`import()` thunk. Converted lexicon (keyword_lexicon + codebook), segment-tags (segments + segment_tags + codebook), and participant-profiles (interviews_structured + participant_profiles). Total: ~880 KB of JSON moved from eager top-of-module imports into lazy chunks that only load on the fallback path (Redis empty in prod, local file missing in dev). The lexicon win is the biggest in practice because it sits on the patientlyiq layout's per-request critical path. Side effect: removed unused `knownInterviewIds` sync export, added `getKnownInterviewIds()` async getter (no external callers were using either). svelte-check: still 567 errors, zero in touched files.

### 2026-05-31 (continued) — emergency stub + architecture pivot

- **Dev hung on /patientlyiq.** SSR-fetch transport timeouts (60s) traced to a different root cause than what the original diagnosis caught: `analysis.ts` still had 8 top-level JSON imports totaling ~940 KB. Anything importing `quotes` / `annotations` / `titleCase` (the whole patientlyiq surface) pulled the full chain into one SSR module graph. HMR after my last batch of server-file edits cascaded re-parses across that chain.
- **Honest correction:** the kv-store lazy-seed work fixed prod cold-start but NOT dev. In dev, `loadDoc`'s file-system path is always taken — `readFileSync(localPath)` + `JSON.parse` happens on every request for `segments.json` (275 KB), `segment_tags.json` (290 KB), `keyword_lexicon.json` (141 KB), etc. The lazy seeds only help on the fallback path, which dev never hits.
- **Stubbed analysis.ts** ([src/lib/content/wctglpdemo-data/analysis.ts](src/lib/content/wctglpdemo-data/analysis.ts)). All 8 JSON imports commented out; data exports replaced with empty arrays/maps/records of the same types. Helper functions still work — they operate on the empty data and naturally return empty results. Pages will render with empty cells; they will LOAD. Restart the dev server (HMR can't recover from this kind of module-shape change).

### Next architecture target: per-indication data modules

The structural problem the stub bought us time to fix properly:

**Today (broken):** every page that touches anything from `wctglpdemo-data/analysis.ts` pulls in `interviews_structured` + `segments` + `segment_tags` + `quote_bank` + `word_usage` + `codebook` + `questions` + `persona_goals_barriers` (plus, until #2a, `keyword_usage`). It doesn't matter what indication the user is viewing. The obesity-specific WCT GLP-1 dataset is always loaded, even when viewing LN or MS.

**Target shape:**
```
src/lib/content/indications/
  obesity/
    +data.server.ts          ← reads via kv-store (segments, tags, etc.)
    types.ts                 ← shared shapes
  lupus-nephritis/
    +data.server.ts          ← reads via fragment corpora (already exists)
    types.ts
  multiple-sclerosis/
    +data.server.ts          ← same
    types.ts
  registry.ts                ← { id → () => Promise<dynamic import('./obesity/+data.server')> }
```

Plus:
- Pages call `loadIndicationData(activeIndication)` inside their `+page.server.ts`, which dynamic-imports only that indication's module. Other indications stay out of the module graph entirely.
- `analysis.ts` is retired. Its helper functions (`themeFrequency`, `themeBreakdown`, `keyQuotes`, etc.) move into a shared `lib/analysis/` namespace and take the data as arguments instead of reading globals.
- Components receive data via `$props` from page server-load results. No component or shared module should import a raw JSON or call a server reader at module top level.

**Phasing — proposed:**

1. **Stub stays in place. Don't un-stub until the new shape is ready** — otherwise the hang comes back the moment one page slips in an eager import.
2. Stand up `obesity/+data.server.ts` first (the obesity dataset is the one currently shaped like the global) and migrate `/patientlyiq` (exec summary) onto it.
3. Migrate `/patientlyiq/analysis`, `/patientlyiq/community`, `/patientlyiq/interview-words` next — they're the heaviest consumers.
4. Migrate journey-map / persona-workbench routes (already use fragment corpora for LN + MS; just need to stop falling through to analysis.ts).
5. Once no page imports from `wctglpdemo-data/analysis.ts` at module top level, delete the stub.

### Carried-over items still open

- **#3** — pre-project `raw_studies.json` at build time. Look at [src/lib/content/disease-insights/datasets.ts](src/lib/content/disease-insights/datasets.ts) for the current normalize path; goal is ~300 KB output per indication.
- **#4** — split monolithic pages (upload 2,528 lines; journey-workbench 2,185; patientlyiq 1,747).
- **#6** — dynamic-import chart libs (d3 / layerchart).
