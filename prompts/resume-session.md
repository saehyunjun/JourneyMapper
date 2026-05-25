# Resume — JourneyMapper scaling plan

A self-contained briefing for the next session. Paste this into a new conversation, or just hand the file path to a new Claude.

---

## Where we left off

**Branch:** `phase-4-analytics` (2 commits ahead of merged main)
- `59f7a75` — Phase 4: `/api/analytics/search-trends` endpoint (DB-backed, no JSON fallback)
- `b16c2e9` — Phase 3 prep: embedding corpus dump script (offline, no API calls)

**Open PR:** https://github.com/saehyunjun/JourneyMapper/pull/new/phase-4-analytics

**Already merged:**
- PR #1 (refactor/phase-1-lexicon): Lexicon 3.2 → 3.6 — multi-indication, registry consolidation, burden taxonomy, drug entity extraction, matcher rewire, variant strip
- PR #2 (phase-1-closure): Phase 1 closure (ContentSource + embedding slots), Phase 2 scaffold (Drizzle + libSQL), seed script, registry reads swapped to DB, content_items + segments schemas, first Phase 5 connector (search_query), Vercel lazy-init build fix

**Vercel status:** Last deploy `● Ready`. Production at `patiently-iq-mapper-yaks-*.vercel.app`. `vercel` CLI is installed locally and logged in as `saehyunjun`. The DB-backed code paths fall back to bundled JSON when `DATABASE_URL` is unset (which it currently is on Vercel).

---

## The original 5-phase plan

1. **Phase 1** — Schema reshape & new entities (multi-indication, burden taxonomy, drug entities, content source registry, embedding slots)
2. **Phase 2** — Database & query layer (Drizzle + libSQL, schemas, seed, registry reads → DB)
3. **Phase 3** — Embedding-first annotation (offline batch embed, retrieval, sparse LLM)
4. **Phase 4** — Server-side analytics (DB aggregates, indication-scoped surfaces)
5. **Phase 5** — Multi-source ingestion (interview, social_post, youtube_transcript, search_query, forum_post, blog_post, podcast_transcript)

Dependencies:
- Phase 3 needs Phase 1 embedding slots ✅ (done)
- Phase 4 needs Phase 2 DB ✅ (done)
- Phase 5 needs Phase 1 Source entity ✅ (done) + Phase 2 storage ✅ (done)

---

## Phase status — done

| Phase | State | Notes |
|---|---|---|
| 1 | ✅ Merged | Lexicon at schema 3.6. `registries/*.json` is single source of truth. Burden taxonomy is `status: draft`. |
| 2 | ✅ Mostly merged | Scaffold + seed + registries (indications, TAs, drugs) reads swapped to DB. Content + segment schemas exist. **Pending:** clusters table migration (the heaviest remaining read path). |
| 3 | 🟡 Scaffold only | `scripts/dump-embedding-corpus.mjs` emits 246-row JSONL ready for batch embedding. **Not done:** wiring to an embedding provider, loader back into entity rows, retrieval surface. |
| 4 | 🟢 First endpoint live | `/api/analytics/search-trends?indication=X` — DB-backed, no JSON fallback. **Not done:** more endpoints (burden distribution, drug mentions, time-series). |
| 5 | 🟢 First connector live | `search_query` via `scripts/ingest-search-queries.mjs`. **Not done:** connectors for the other 6 source types. |

---

## What activates each phase in prod

**Phase 2 / Phase 4 DB-backed paths in prod** (currently fall back to JSON since `DATABASE_URL` is unset):
1. Provision a Turso DB (or any libSQL-compatible store)
2. `vercel env add DATABASE_URL` + `vercel env add DATABASE_AUTH_TOKEN`
3. `npm run db:push` against the Turso URL
4. `npm run db:seed`
5. `npm run db:ingest:search-queries`

**Phase 3 embeddings** (no code in repo runs API calls):
1. `npm run embeddings:dump` → `data/embedding_corpus.jsonl` (246 rows)
2. Pipe through any embedding provider in batch mode
3. (Write a loader to put vectors into `Cluster.embedding`, `Drug.embedding`, `MechanismOfAction.embedding`, `BurdenCategory.embedding` — these slots exist in types but no code touches them yet)

---

## Constraints the user has set

- **No API calls without confirmation.** No real OpenAI / Voyage / Anthropic calls have been made on the user's behalf. Phase 3 activation is a separate conversation.
- **Keep the lexicon shape stable.** UI work is in flight (story mode, ViewModeToggle, BubbleChart). Don't change `keyword_lexicon.json`'s top-level shape or break the matcher.
- **Land work via PRs, not direct main pushes.** GitHub UI for merges (gh CLI is not installed).
- **Vercel CLI is available** for read-only queries freely; confirm before any `vercel deploy`, `vercel env add`, etc.

---

## Open decisions to surface to the user when resuming

1. **PR-merge `phase-4-analytics` first?** It has 2 small commits and is review-sized.
2. **Which next slice?**
   - **Cluster table migration** (deeper Phase 2) — add a `clusters` table with FKs to themes/subthemes/drugs + M2M to indications + M2M to burden_categories; seed from `keyword_lexicon.json`; swap `getLexiconSlice` clusters[] to DB. ~3 commits.
   - **More Phase 5 connectors** — `community_engagement` and `ad_spend_timeseries` already have sample data in `disease-insights/`. ~1 commit each.
   - **Activate Phase 3 embeddings** — write the provider integration (OpenAI Batch API recommended for cost) + loader. Requires API budget confirmation from the user.
   - **More Phase 4 analytics** — burden distribution per indication, drug-mention frequency, search-volume time series. Needs the burden classification pass first (or an embedding-based proposal pass).
   - **Codebook tree restructure / patient-voice vs research-artifact split** — agent prompt exists at `prompts/build-codebook.md`. Bigger blast radius.
3. **Provision Turso?** — would activate the DB-backed paths on Vercel. Not in scope unless the user confirms.

---

## Key files for orientation

```
src/lib/server/
  db/
    client.ts        ← lazy libSQL singleton (getDb())
    queries.ts       ← every DB read helper (with JSON fallback for most)
    schema/          ← Drizzle table definitions
      indications.ts, drugs.ts, burdens.ts, content_sources.ts,
      content_items.ts, segments.ts, index.ts
  registries.ts      ← bundled JSON loader (drugs, indications, etc.)
  lexicon.ts         ← getLexiconSlice (the main DB consumer today)

src/lib/content/registries/
  indications.json, therapeutic_areas.json, burden_categories.json,
  drugs.json, sponsors.json, mechanisms_of_action.json,
  content_sources.json, sources.json (provenance — DIFFERENT from content_sources)
  types.ts            ← every ID union + entity type

src/lib/content/wctglpdemo-data/
  keyword_lexicon.json (schema 3.6 — 181 clusters)
  codebook.json        ← READ-ONLY for cluster authoring
  segments.json, interviews_structured.json, segment_tags.json  (legacy bundled data)

drizzle/                ← migration SQL files + meta snapshots

scripts/
  seed-db.mjs                       ← idempotent JSON → DB
  ingest-search-queries.mjs         ← Phase 5 connector for search_query
  dump-embedding-corpus.mjs         ← Phase 3 offline corpus dump
  migrate-lexicon-*.mjs             ← the 6 lexicon schema migrations (3.2 → 3.6)
  validate-disease-insights.mjs     ← orthogonal validation

src/routes/api/
  lexicon/+server.ts                ← reads drugs/indications/TAs from DB w/ JSON fallback
  analytics/search-trends/+server.ts ← DB-backed, NO JSON fallback

prompts/
  build-drugs-registry.md           ← agent brief for expanding drugs.json
  build-keyword-lexicon.md          ← agent brief for cluster authoring
  build-disease-insights.md         ← agent brief for per-indication data packs
  build-burden-taxonomy.md          ← agent brief for refining the burden tree
  build-indications.md              ← agent brief for adding a new disease end-to-end
  build-codebook.md                 ← agent brief for codebook restructure
  resume-session.md                 ← this file
```

---

## Quick verification when resuming

```bash
# Confirm branch state
git log main..HEAD --oneline
git status --short

# Confirm DB pipeline still works locally
npm run db:seed
npm run db:ingest:search-queries

# Confirm typecheck baseline
npm run check 2>&1 | grep -E "ERROR" | grep -vE "pxreview|archive|journeymapper2|StepDetailContent|NavigationMenu|navbar|Plutchikstore|journeyConfig" | head -20
# (The errors above are pre-existing in unrelated files; new errors should be empty)

# Confirm Vercel is still authed
vercel whoami
vercel ls | head -3
```

---

## Starter prompt for a new session

> I'm resuming work on JourneyMapper's scaling plan. Read `prompts/resume-session.md` for full context. We're on the `phase-4-analytics` branch with 2 commits ahead of main. The next decision is whether to PR-merge this first, then which slice to tackle (cluster table migration / more Phase 5 connectors / Phase 3 activation / more Phase 4 analytics / codebook restructure). Surface options and ask me which to start.

---

## What NOT to do without confirmation

- ❌ Make any embedding / LLM API call (would burn budget)
- ❌ Run `vercel deploy` or modify `vercel env` (writes to prod)
- ❌ Restructure or rename schema IDs in any registry (cascades through FKs)
- ❌ Push to main directly or force-push any shared branch
- ❌ Change the lexicon shape (UI work is in flight against the current shape)
- ❌ Provision external services (Turso, etc.)
