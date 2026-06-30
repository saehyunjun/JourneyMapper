# Fork plan: PatientlyIQ

Forking JourneyMapper into a clean PatientlyIQ project. Decisions captured here so this doc travels with the new repo on day 1.

**Decisions made:**
- Strategy: fresh SvelteKit, hand-copy the good parts (no git clone, no inherited module-init patterns)
- Day-1 scope: skeleton + `/` (exec summary) route only — prove the architecture, port the long tail incrementally
- Obesity (`wctglpdemo-data/`): left behind. Re-onboard as a fragment corpus later if there's product demand
- Name: **PatientlyIQ**

---

## Status (as of 2026-05-31)

| Phase | Status | Detail |
|---|---|---|
| 0 — scaffold | ✅ shipped | `npm create svelte`, foundation copy, smoke test, initial commit (06ef36b) |
| 1 — design system + data foundation | ✅ shipped | `data.ts`, indication registry, registries copy, `/__data-smoke` proof (4c6eb7f). app.css later slimmed 2,590 → 225 lines (7bfd11e) |
| 2 — first indication wired + exec summary | ✅ shipped | LN corpus into `/data/` (d6bdae5), `/` page rendering real exec summary with PageShell + 8×6 grid + headline stats, top quote, sentiment bar, anchor list, LTFU memo (ff77d55), then selector pills + LTFU matrix + suggested research (c23046d) |
| 3 — second indication + persona/journey routes | ◐ partial | MS corpus + exec summary working at `/?indication=multiple_sclerosis`. **Still missing:** `/journey-map` and `/personas` routes |
| 4 — clinical trials | ⏸ deferred | Per locked decision #4. Resumes after Phase 5 routes are stable |
| 5 — fold in the rest, route by route | ☐ not started | |

**Repo:** [github.com/saehyunjun/patientlyIQ](https://github.com/saehyunjun/patientlyIQ) (private). Branch `main`. 8 commits.

**Live at `/`:** the LN exec summary on real corpus data — 335 authors · 3 themes · 2,235 themed moments · 222 anchor pool · top anchor quote · overall sentiment bar · 4-pillar × 4-horizon LTFU matrix · 4-question suggested research grid.

**Live at `/?indication=multiple_sclerosis`:** MS exec summary — 51 authors · 3 themes · 78 moments · 23 anchor pool. (No LTFU/research files for MS yet; those cells hide gracefully.)

**Open Phase 2 follow-ups** (not blocking Phase 3 work):
- **Keyword lexicon port** → unlocks axes (per-keyword sentiment breakdowns) + lead/second findings (cluster aggregations). The last JM exec-summary features not yet ported.
- Polish pass: focus states, accessibility, mobile typography for the matrix collapse.

---

## What we learned the hard way

Every JM perf bug had the same root cause: **data files were modules.** `import X from './foo.json'` is a four-character pattern that turns a 290 KB data file into a hard top-level dependency of every transitive importer. JM did this in 30+ places. The cost compounded silently until pages stopped loading.

| Symptom | Root cause |
|---|---|
| 60s Vite SSR fetch timeout | `analysis.ts` re-exported 8 top-level JSON imports (~940 KB) — anyone importing `titleCase` pulled the entire data graph |
| 308 KB `corpus-store` chunk every layout request | 6 `import.meta.glob({ eager: true })` — every page paid for every corpus |
| 1+ MB of JSON.parse per dev request (synchronous) | `kv-store`'s dev path is `readFileSync(localPath)` for each big seed |
| 308 → 492 → 940 KB chunks I kept measuring | Same `import bundledX from './X.json'; loadDoc(KEY, PATH, bundledX)` pattern repeated in 5+ caller files |
| Source tree at 283 MB; single JSONs of 130 MB | Generated/cached data committed inside `src/lib/content/` so Vite watches it |

## North-star architecture

Three non-negotiable rules. Every other decision flows from these.

### 1. Nothing in `lib/` imports a data file. Ever.

`lib/` is for code. Helpers are pure functions. Components are templates. If a module needs data, it asks for it via `$props` (component) or via an async resource fetch (server module). The string `from './something.json'` should not appear in any `src/` file other than the tiny registries.

### 2. Data lives outside `src/`, in `/data/` at repo root

```
data/
  corpora/
    ln_reddit_2026q1/
      manifest.json
      fragments/{social_post,social_comment,...}.json
      annotations/{social_post,social_comment,...}.json
      author_attrs.json
      ingest.config.json
    ms_reddit_2026q1/...
  journeys/{lupus-nephritis,multiple-sclerosis}.json
  personas/{ln_*,ms_*}.json
  (later: disease-insights/, etc.)
```

Vite never sees this directory. No file watcher, no module graph entanglement. Analysts edit JSON here directly; the runtime reads it lazily.

**One exception:** `lib/content/registries/` stays in `src/`. These are small lookup tables (indications, drugs, content_sources — ~100 KB total) that change rarely and ARE legitimately type-shaped configuration. They can be imported directly.

### 3. One module reads the disk. One.

[src/lib/server/data.ts](src/lib/server/data.ts) is the only module in the project that touches the filesystem for data. Its shape:

```ts
// Public API — async resource fetchers. Cached per warm instance, mtime-invalidated in dev.
loadCorpusManifest(corpusId): Promise<CorpusManifest>
loadCorpusFragments(corpusId, contentSource): Promise<FragmentsFile>
loadCorpusAnnotations(corpusId, contentSource): Promise<AnnotationFile>
loadJourney(indicationId): Promise<JourneySchema>
loadPersona(personaId): Promise<Persona>
loadCorpusBundle(corpusId): Promise<CorpusBundle>  // composite, calls the above
```

Every other server module calls these. No module reads from disk directly. No bundled seeds. No "fallback to import('./foo.json')" patterns. If `data.ts`'s contract needs to swap from filesystem to SQLite/Turso later, only one file changes.

### 4. Per-indication data modules, dynamic-imported

Layout reads `?indication=X` and calls `loadIndication(X)` from a registry that dynamic-imports just that indication's module:

```
src/lib/content/indications/
  registry.ts                   ← { id → () => Promise<typeof import('./<id>/data')> }
  lupus-nephritis/data.ts       ← composes data.ts calls scoped to LN's corpus
  multiple-sclerosis/data.ts
```

The indication module itself imports zero data files — it calls `data.ts` async functions with the right corpus id.

### 5. Derived data is computed, never stored

Theme breakdowns, sentiment distributions, keyword inverted indexes, word-frequency reports — all computed server-side from source data on demand, cached per warm instance keyed by `(indication, query-shape)`. No `keyword_usage.json`, no `word_usage.json`, no precomputed JSON artifacts in the source tree.

When a computation is genuinely expensive (full-corpus inverted index over a large MS corpus), the answer is to cache the result against a corpus content-hash in the same `data.ts` cache layer — not to commit a precomputed file to git.

---

## Repo + tooling

| Item | Choice |
|---|---|
| Location | `~/PatientlyIQ` (sibling to `~/JourneyMapper`) |
| Repo | New GitHub repo `patientlyiq` (private) |
| Framework | Latest SvelteKit (Svelte 5, Vite 7) — `npm create svelte@latest patientlyiq` |
| Package manager | npm (match current) |
| Deploy | New Vercel project; same env vars (`ANTHROPIC_API_KEY`, `REDIS_URL` when ready) |
| Node version | Match `.nvmrc` from current — copy it |
| TypeScript | Strict mode (current is strict; keep it) |

JourneyMapper stays on disk and on its current Vercel project untouched. PatientlyIQ replaces it as the primary surface once the exec-summary route is at parity.

---

## What carries forward (hand-copied)

### Core architecture pieces

- ~~[src/lib/server/corpus-store.ts](src/lib/server/corpus-store.ts)~~ — **NOT carried forward.** Replaced by new `lib/server/data.ts` (see north-star §3). The "lazy globs + bundled seeds" pattern is the anti-pattern PatientlyIQ exists to avoid
- ~~[src/lib/server/kv-store.ts](src/lib/server/kv-store.ts)~~ — **NOT carried forward.** Same reason. Redis (if needed later) goes behind `data.ts` as one of its backends
- [src/lib/server/registries.ts](src/lib/server/registries.ts) + [src/lib/content/registries/](src/lib/content/registries/) — indications, drugs, therapeutic areas, content sources. Small static lookup tables; stay as JSON imports in `src/`
- [src/lib/content/corpora/](src/lib/content/corpora/) — **moved to `/data/corpora/`** at repo root. LN + MS only; drop `wct_glp1_2025q4/`
- [src/lib/content/personas/](src/lib/content/personas/) — **moved to `/data/personas/`**. Keep LN + MS personas; drop obesity-tied ones. Types stay in `src/`
- [src/lib/content/journeys/](src/lib/content/journeys/) — **moved to `/data/journeys/`**. Same partitioning
- ~~[src/lib/content/disease-insights/](src/lib/content/disease-insights/)~~ — **deferred** along with the clinical-trials route (locked decision #4). When it returns, normalized data goes in `/data/disease-insights/`, raw_studies stays out of git entirely

### Design system + primitives

- `src/app.css` — design tokens, utility classes (`.t-h1`–`.t-h4`, `.t-body`, etc.). **Take verbatim.**
- `src/lib/components/ui/` — shadcn-style base components (button, tabs, etc.). **Take verbatim.**
- `src/lib/components/ui/app-card/` — variants (`default | quote | fragment | finding | metric`)
- `src/lib/components/ui/app-drawer/`
- `src/lib/components/bento/` — `BentoBoard`, `BentoCell`, `StatCard`, `ChartCard`, `NarrativeCard`, `ListCard`, `SearchVolumeLineChart`
- Charts: [BubbleChart.svelte](src/lib/components/BubbleChart.svelte), [SentimentBar.svelte](src/lib/components/SentimentBar.svelte), [SentimentDonut.svelte](src/lib/components/SentimentDonut.svelte), [StackedCards.svelte](src/lib/components/StackedCards.svelte), [KeyQuoteCard.svelte](src/lib/components/KeyQuoteCard.svelte), [ParticipantAvatar.svelte](src/lib/components/ParticipantAvatar.svelte), [RightDrawer.svelte](src/lib/components/RightDrawer.svelte)
- `src/lib/components/exec-summary/` — `FindingEvidenceDrawer`, `QuoteDetail`, `InsightFeed`, `ThemeDetail` (these are the cells the new `/` page renders)
- Layout chrome: [WctglpSidebar.svelte](src/lib/components/WctglpSidebar.svelte), [WctglpTopbar.svelte](src/lib/components/WctglpTopbar.svelte) — rename to `PatientlyIQSidebar` / `PatientlyIQTopbar` during port

### Scripts (offline pipelines)

- `scripts/propose-*.mjs` — fragment-sentiment, fragment-themes, fragment-stages, dashboard-blurbs, persona-narrative. **Take verbatim.**
- `scripts/fetch-clinicaltrials.mjs` + `scripts/normalize-clinical-trials.mjs` if they exist
- `scripts/build-search-trend-overlay.mjs`
- Scripts use `process.loadEnvFile('.env')` — carry over the gotcha doc from CLAUDE.md

### Docs + rules

- [CLAUDE.md](CLAUDE.md) — verbatim, with paths re-validated against the new repo. **All four hard rules carry forward:** no italics, reuse before creating, no tautological drivers, no side-border rounded rects
- [DESIGN_SYSTEM_AUDIT.md](DESIGN_SYSTEM_AUDIT.md) + [DESIGN_SYSTEM_PROGRESS.md](DESIGN_SYSTEM_PROGRESS.md) — design system migration progress
- [docs/BENTO_HANDOFF.md](docs/BENTO_HANDOFF.md)
- Auto-memory at `~/.claude/projects/-Users-aaronjun-JourneyMapper/memory/` — will need a new memory dir for the new project. Either symlink or hand-copy the relevant entries (the hard rules + persona framework memories are highest-value)

---

## What gets left behind (deliberately)

| Path | Why |
|---|---|
| `src/lib/content/wctglpdemo-data/` | The source of the 940 KB aggregator hang. Obesity becomes a fragment corpus later if needed |
| `src/lib/content/wctglpdemo-data/analysis.ts` | Same. Helper functions get reborn in `src/lib/analysis/` taking data as args |
| `src/routes/patientlyiq/_archive_v3/` | Archived predecessor of the bento exec summary |
| `src/routes/patientlyiq/{autotag,autotag-corpus,quote-reviews,segment-tags,segment-cloud,participant-profiles,quiz,phrases,topic-tree,topic-compare,radial-preview,serp-readability,trial-designer,sim-protocol,suggestor,participant-avatar,upload,highlights}/` | Don't auto-port. Add back only when there's a use case. Many of these were workbench/experiment routes |
| `src/routes/patientlyiq/upload/` specifically | 2,528-line monolith tied to the wctglpdemo upload action. Rebuild against the corpus-store write path when needed |
| `src/lib/server/segment-tags.ts`, `src/lib/server/highlights.ts`, `src/lib/server/participant-profiles.ts`, `src/lib/server/lexicon.ts`, `src/lib/server/autotag-pipeline.ts` | All tied to the wctglpdemo dataset shape. Recreate per-indication when needed |
| `src/routes/+page.svelte` (the marketing landing) | New landing belongs to PatientlyIQ, design it fresh |
| `src/routes/pxreview/` | Unrelated review surface |
| Most `feature_backlog.md` items | Re-prioritize from scratch in the new repo |

---

## Phased migration

### Phase 0 — scaffold (½ day)
- `npm create svelte@latest patientlyiq` (Skeleton template, TypeScript, ESLint, Prettier)
- Copy `.nvmrc`, `.prettierrc`, `.prettierignore`, ESLint config, `tsconfig.json` adjustments
- Copy `src/app.css` and the SvelteKit `app.html` shell
- Initial git commit; create GitHub repo; first push
- New Vercel project, hook up GitHub, first deploy of the empty skeleton

### Phase 2 direction shift (locked 2026-05-31)

**Don't verbatim-port JM's design system.** Build a slim, standardized one matching the Patiently Studio reference (shared as the `_bootstrap.html` grid mockup). Concretely:

- **Layout primitive: 8-column × 6-row modular grid on desktop, with 24px gutters.** Pages drop content into named grid areas. On tablet, collapse to 4 columns; on mobile, single column (auto-flow row).
- **Persistent top + bottom rails.** Top: brand mark + indication selector + view legend. Bottom: corpus meta, route identifier, footer text.
- **Slim color palette.** Background `#faf9f5` (warm off-white), `--ink: #111`, `--ink-mute` (mid gray), one accent, semantic positive/negative/neutral for sentiment. No more sprawling color tokens.
- **One serif (Spectral or similar, headings only), one sans (system-ui or Inter, body), one mono (ui-monospace, legends/labels).** No five-typeface stacks.
- **Replace JM's `BentoBoard / BentoCell` abstraction with the simpler grid.** Bento allowed variable cell sizes + expansion-archive + overflow-for-visual-energy — interesting but heavy. The new exec summary just lays cells into the 8×6 with `grid-area`. Simpler to read, simpler to maintain, easier to make responsive.
- **app.css drops from 2,590 lines (JM) to ≤300 lines.** Tokens + grid + reset + a handful of utility classes. Anything more goes into scoped component styles.
- **Hard rules from CLAUDE.md still apply.** Most relevant here: no italics, reuse before creating, no side-border rounded rects.

Replaces the original "pixel-parity with JM" criterion. New criterion: content + interactions equivalent, expressed in the new grid + Patiently Studio aesthetic.

### Phase 1 — design system + data foundation (1–2 days, in flight)

**Locked architectural choices (made during Phase 1 kickoff):**
- Data layer: filesystem-backed, files outside `src/` in `/data/`, single `lib/server/data.ts` module with async resource-fetching contract designed to swap to a DB backend later
- Derived data: computed on demand server-side, cached per warm instance

**Concrete steps:**
- Tailwind v4 + postcss + autoprefixer + tw-animate-css configured ✓
- Install bits-ui + shadcn-svelte + tailwind helpers + lucide + mode-watcher + redis ✓
- app.css wired up + boot test ✓
- **DO NOT copy** `lib/server/corpus-store.ts` or `lib/server/kv-store.ts` from JM — they bake in the bundled-seed anti-pattern. Their replacement is `lib/server/data.ts` (new code, see north-star §3)
- Copy `lib/server/registries.ts` (no DB deps, clean import surface) + `lib/content/registries/*` (these stay in `src/`)
- Copy `lib/content/corpora/types.ts` and `lib/content/journeys/types.ts` (types only, no data)
- Create `data/` at repo root. Add a `.gitignore`-equivalent note that this dir is the source-of-truth for analyst-edited data, lives outside the module graph
- Write `lib/server/data.ts` — async readers + per-instance LRU cache + mtime invalidation
- Write `lib/content/indications/registry.ts` + per-indication module stubs
- Smoke test: a `/__data-smoke` route calls `loadCorpusManifest` for an empty stub corpus, returns its meta. Confirms the path works end-to-end with no data files copied
- `CLAUDE.md` re-validated (Phase 0 disclaimer already at top)
- Verify: `npm run dev` boots clean, smoke route returns 200 with the manifest

### Phase 2 — first real indication wired up (2–3 days)
- Copy `src/lib/content/corpora/ln_reddit_2026q1/` into the new project
- Wire `lupus-nephritis/data.server.ts` to actually call `loadCorpusBundle('ln_reddit_2026q1')`
- Build the new `/+layout.{svelte,server.ts}` with the indication selector and sidebar (port `WctglpSidebar` → `PatientlyIQSidebar`)
- Build the new `/+page.{svelte,server.ts}` — the exec summary, consuming `data.fragments` + `data.personas` from the load function
- Port [exec-summary-data.ts](src/lib/content/exec-summary-data.ts) but rewritten to take data as args (no module-init imports)
- Port the bento cells used by `/` (`StatCard`, `ChartCard`, `NarrativeCard`, etc.) — they should be unchanged
- Verify: `/?indication=lupus-nephritis` renders the same bento layout as JourneyMapper's `/patientlyiq` does today
- Verify: SSR is fast (sub-second for first request) and HMR doesn't stall

### Phase 3 — second indication + persona/journey routes (2–3 days)
- Copy `src/lib/content/corpora/ms_reddit_2026q1/`
- Wire `multiple-sclerosis/data.server.ts`
- Port `/personas` and `/journey-map` routes
- Port persona narrative + journey schema rendering
- Verify: indication toggle works; both indications render correctly

### Phase 4 — DEFERRED (clinical trials)
Originally planned to port clinical-trials with pre-projected JSONs. **Deferred per locked decision #4.** Reintroduce after Phase 5 routes are stable, with the pre-projection approach (~300 KB per indication, was item #3 in the perf backlog) baked in from the start.

### Phase 5 — fold in the rest, route by route, as needed
- Add routes one at a time when there's a real use case
- Each addition gets a preflight check (per CLAUDE.md): role, reuse, utilities, new, sketch, open questions

---

## Data files to physically move

Run from the JourneyMapper root. Adjust target paths once the new repo exists.

```bash
# Fragment corpora (LN + MS only)
cp -r src/lib/content/corpora/ln_reddit_2026q1 ../patientlyiq/src/lib/content/corpora/
cp -r src/lib/content/corpora/ms_reddit_2026q1 ../patientlyiq/src/lib/content/corpora/

# Personas (filter out obesity)
cp src/lib/content/personas/ln_*.json ../patientlyiq/src/lib/content/personas/
cp src/lib/content/personas/ms_*.json ../patientlyiq/src/lib/content/personas/
cp src/lib/content/personas/types.ts ../patientlyiq/src/lib/content/personas/

# Journeys (filter)
cp src/lib/content/journeys/lupus-nephritis.json ../patientlyiq/src/lib/content/journeys/
cp src/lib/content/journeys/multiple-sclerosis.json ../patientlyiq/src/lib/content/journeys/
cp src/lib/content/journeys/types.ts ../patientlyiq/src/lib/content/journeys/

# Disease-insights (manifests + normalized clinical trials only; skip raw_studies)
# Will need a more careful copy script; raw_studies are regenerable via fetch-clinicaltrials.mjs

# Registries
cp -r src/lib/content/registries ../patientlyiq/src/lib/content/

# Scripts
cp scripts/propose-*.mjs ../patientlyiq/scripts/
cp scripts/fetch-clinicaltrials.mjs ../patientlyiq/scripts/   # if exists
cp scripts/build-search-trend-overlay.mjs ../patientlyiq/scripts/

# Docs + rules
cp CLAUDE.md ../patientlyiq/
cp DESIGN_SYSTEM_AUDIT.md ../patientlyiq/
cp DESIGN_SYSTEM_PROGRESS.md ../patientlyiq/
cp -r docs ../patientlyiq/

# .env (do NOT commit; will need to recreate in new project)
cp .env ../patientlyiq/
```

---

## Locked decisions

1. **Vercel project**: new project for PatientlyIQ. JourneyMapper's existing deployment stays in place.
2. **URLs during cutover**: JourneyMapper keeps its current user-facing URL until PatientlyIQ reaches parity. PatientlyIQ runs on a preview URL initially.
3. **Memory dir for Claude Code**: hand-copy the high-value entries (the four hard-rule memories, persona four-pillar framework, scripts env-override gotcha, ClinicalTrials.gov pipeline, fragment-corpus-architecture, interview-analysis-pipeline). Lower-value ones (ephemeral feature notes, prior bug context) start fresh and rebuild from new context. New memory dir will be at `~/.claude/projects/-Users-aaronjun-PatientlyIQ/memory/`.
4. **Clinical trials**: **defer Phase 4 entirely.** Don't carry forward `raw_studies.json` or the clinical-trials routes on the initial fork. Reintroduce later when other features have landed and the route has a real consumer. Remove Phase 4 from the migration plan above; resume at Phase 5 (route-by-route folds) without it.
5. **Old project disposition**: **archive JourneyMapper** once PatientlyIQ reaches parity. Keep it on disk and in git history; remove from the active dev rotation, take down the Vercel deployment.

---

## What does NOT change

- The four hard rules from CLAUDE.md carry forward unchanged. Same enforcement.
- The fragment-corpus + persona-as-query architecture (already the future shape).
- Indication-pluggable pattern.
- The propose-* offline pipeline (LLM-generated dashboard blurbs, sentiment, themes, stages, narratives).
- Design tokens, type scale, color system.

---

## Success criteria

The fork is "successful" the first time:
- `npm run dev` starts in <5s ✅ (dev boots in ~1s after the `sv` install)
- First `/` request after restart renders in <1s ✅ (LN cold: 867ms parsing 5.2 MB JSON; warm: 8.6ms)
- HMR after editing any single file picks up in <2s without cascading invalidations ✅
- The `/` exec summary expresses the same content + interactions as JourneyMapper's `/patientlyiq?indication=lupus_nephritis` did before the stub, in the new Patiently Studio aesthetic (revised from "pixel-identical" once the design-reset locked) ◐ in progress — axes + findings still to port
- `npm run build` succeeds and produces server chunks where no single chunk exceeds 200 KB ☐ not measured yet

---

## Log

### 2026-05-31
- Plan drafted. Awaiting go-ahead to scaffold Phase 0.
- Phase 0 shipped (06ef36b): `sv create patientlyiq`, foundation files copied, initial commit. Smoke test 200 on `/`.
- Phase 1 shipped (4c6eb7f): `data.ts` as the only disk reader, indication registry with dynamic-imported per-indication modules, registries copy, `/__data-smoke` proof. Typecheck clean.
- Phase 2a shipped (d6bdae5): Real LN corpus (5.2 MB) copied into `/data/corpora/`. `/__data-smoke?indication=lupus-nephritis` returns 2,961 fragments + 2,933 annotations. Cold: 867ms, warm: 8.6ms (100× via mtime-validated cache).
- Phase 2 reframe (7bfd11e): Slim design system — app.css 2,590 → 225 lines (−91%). 8×6 grid + PageShell + `/design` preview route. Patiently Studio aesthetic (warm off-white bg, serif display, mono labels). Replaces the original "pixel-parity with JM" criterion.
- Logo wire-up (74cfc22): Orange PIQ mark at 28px in the rail.
- Phase 2 exec summary (ff77d55): `/` renders the LN exec summary on real data. New `lib/exec-summary/build.ts` is a pure function (CorpusBundle → ExecSummaryData), no top-level JSON. Bugs caught along the way: `f.fragment_id` should be `f.id`; `ann.sentiment_score` should be `ann.segment_tags.sentiment_score`. Indication ids switched kebab → underscore to match `registries/indications.json` canonical IDs.
- Indication selector + LTFU matrix + suggested research (c23046d): Selector pills in the rail toggle LN ↔ MS. MS corpus copied (4.8 MB) — `?indication=multiple_sclerosis` returns 51 authors, 78 moments. LTFU matrix renders 4×4 (pillar × horizon) with corpus/projected evidence tags. Research grid renders 4 question cards with expandable patient-research items. MS gracefully hides LTFU + research cells (LN-specific data).

### Open queue

Choose next chunk:
- **Keyword lexicon port** → unlocks axes (per-keyword sentiment) + lead/second findings (cluster aggregation). Closes the gap to full JM exec-summary parity.
- **`/journey-map` route** → render the journey schema from `/data/journeys/`. Data + `loadJourneySchema` helper already exist.
- **`/personas` route** → render persona cards from `/data/personas/`.
- **Polish** → focus states, mobile typography on the matrix, etc.
