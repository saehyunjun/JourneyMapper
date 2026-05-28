# Journey Workbench & Map — Plan

> **Continuation doc.** Update the bottom of this file at the end of every session that touches the workbench / journey-map / synthesis pipeline. Future sessions resume with: *"Claude, continue with WORKBENCH_PLAN.md"*.
>
> This is sequential project planning; the issue/feature-shaped tracking lives in [feature_backlog.md](feature_backlog.md).

---

## A. General Work Plan

Build a **persona-driven journey-mapping system** for PatientlyIQ that turns heterogeneous patient/caregiver voice (interviews + forum posts + future social, video, papers) into:

1. An **analyst-facing Journey Workbench** for fast persona-driven exploration of the fragment corpus (filter chips, beeswarm sentiment-by-stage view, click-to-inspect drawer).
2. A **sponsor-facing Journey Map artifact** — automatically generated from corpus + world knowledge — that mirrors the polished mCRPC Pluvicto reference (numbered stages, observation pills, drivers/barriers panels at decision points).

Architectural backbone: a unified **fragment corpus** (cross-source, deidentified, indication-scoped) with a multi-dimensional **annotation tree** (journey stages, sentiment, emotions, themes, subthemes). **Personas are saved queries** over the fragment pool, not rosters of participants.

---

## B. Implementation Stages

| # | Stage | Status | Notes |
|---|---|---|---|
| 1 | Fragment corpus foundation | ✅ Complete | Schema + interview ingester + generalized forum/social ingester |
| 2 | Annotation pipeline | ✅ Complete | Stage / sentiment+emotion / theme+subtheme proposers, all corpus-parameterized |
| 3 | Persona language + Journey Workbench | ✅ Complete | 8 personas; workbench with multi-corpus, filter chips, primary drawer, indication scoping |
| 4 | Journey-Map artifact v1 | ✅ Complete | Synthesis script + render route; one LN artifact generated end-to-end |
| 5 | World-knowledge integration (blue pills) | 🔵 In progress | v1 (disease-insights) landed on LN artifact; PubMed / NCT-API still pending |
| 6 | Visual polish on artifact | 🔵 In progress | EmotionDyadChip component just landed; more component vocabulary needed |
| 7 | Workbench advanced features | ⏳ Partial | Keyword/sponsor inline chips landed; multi-persona overlay / pan-zoom / confidence-as-opacity still open |
| 8 | Persona builder UI | 📋 Backlog | Tracked in feature_backlog.md |
| 9 | Corpus-driven taxonomy automation | 📋 Backlog | Tracked in feature_backlog.md |
| 10 | Content suggestor (downstream) | 🔵 In progress | Phase A1 registries + A2 mapping rules layer shipped; A3 format/partner scoring + LLM proposer pending |
| 11 | Audience views (Personas / Community / Digital Data) | 🔵 In progress | Routes scaffolded; personas bento + community page + digital-data shells exist |

---

## C. Checklist

### Stage 1 — Fragment corpus foundation
- [x] Fragment + SourceRef + SpeakerAttrs schema with three-state evidence model ([src/lib/content/corpora/types.ts](src/lib/content/corpora/types.ts))
- [x] Per-corpus directory layout (`corpora/<corpus_id>/{manifest,fragments/,annotations/,artifacts/}`)
- [x] Interview ingester ([scripts/import-interviews-as-fragments.mjs](scripts/import-interviews-as-fragments.mjs))
- [x] Generalized forum/social ingester ([scripts/import-forum-as-fragments.mjs](scripts/import-forum-as-fragments.mjs))
- [x] Re-anonymization of `[deleted]` users + per-user Context resolution + conflated-id warnings
- [x] Multi-corpus server loader ([src/lib/server/corpora.ts](src/lib/server/corpora.ts))

### Stage 2 — Annotation pipeline
- [x] Journey taxonomies — [obesity](src/lib/content/journeys/obesity.json) (8 stages × 25 steps), [lupus_nephritis](src/lib/content/journeys/lupus_nephritis.json) (8 stages × 23 steps)
- [x] `propose-fragment-stages.mjs` — corpus/indication parameterized, batches by interview_id (interviews) or post_id (forum/social)
- [x] `propose-fragment-sentiment.mjs` — sentiment + emotions per fragment, universal codebook emotion enum
- [x] `propose-fragment-themes.mjs` — themes + subthemes per fragment, FK-validated against codebook
- [x] `migrate-segment-tags-to-fragments.mjs` — one-shot migration of GLP-1 interview annotations into the fragment tree
- [x] Multi-dimensional annotation file shape (each dimension is its own top-level key; each script owns one key)

### Stage 3 — Persona language + Workbench
- [x] Persona schema + evaluator ([src/lib/content/personas/types.ts](src/lib/content/personas/types.ts), [evaluate.ts](src/lib/content/personas/evaluate.ts))
- [x] 5 GLP-1 personas + 3 LN personas
- [x] Annotation predicates in the filter language (`has_stage`, `has_step`, `has_emotion`, `has_theme`, `has_subtheme`, `sentiment` range)
- [x] Journey-workbench page ([src/routes/patientlyiq/journey-workbench/+page.svelte](src/routes/patientlyiq/journey-workbench/+page.svelte))
- [x] Beeswarm with stage/step sub-column layout + dotted stage boundaries
- [x] Three color modes (participant / sentiment / persona)
- [x] Hover tooltip with avatar + name + quote
- [x] Filter chips above beeswarm (Stage / Sentiment / Role / Subtheme) composing AND with persona
- [x] Primary drawer on dot/row click — fragment detail + speaker attributes + all annotations + speaker's other fragments
- [x] Indication scoping to `data.slice.active_indication` (LN view hides obesity data and vice versa)
- [x] Nav rail integration (WctglpSidebar + wctglp-menubar)

### Stage 4 — Journey-Map artifact v1
- [x] `synthesize-journey-map.mjs` — per-stage Claude calls with enum-constrained citations, per-decision-point drivers/barriers/mixed panels
- [x] Artifact JSON shape (`corpora/<corpus>/artifacts/journey-map-<persona>.json`) — reserves `external_observations[]` slot per step
- [x] Render route `/patientlyiq/journey-map/[corpus_id]/[persona_id]` — resolves fragment_ids to quote text, expandable supporting quotes
- [x] First artifact generated: LN `ln_sle_carT_curious_patients` (53 fragments → 37 observations + 16 panel items)
- [x] "View journey map →" link in workbench

### Stage 5 — World-knowledge integration 🔵
- [x] `propose-external-observations.mjs` — single Claude call, enum-constrained stage/step ids, merges into existing artifact
- [x] v1: consume `src/lib/content/disease-insights/<indication>/` (search-volume × 7, community engagement, ClinicalTrials.gov normalized + sponsors + interventions aggregates) — no external API calls
- [x] Compact-context builders per dataset type (top-N topics, CT aggregates) so the whole disease-insights pack fits one prompt
- [x] Update artifact JSON to populate `external_observations[]` + `meta.external_observations_proposer` provenance block
- [x] Update render route to display blue pills (indigo) alongside green/pink observations, with "Research" divider per step
- [x] First artifact populated: `ln_sle_carT_curious_patients` — 10 external observations across 6 stages
- [ ] Handle stages with 0 corpus fragments — script currently drops external pills for skipped stages (3 dropped on first run); should auto-create stage entries instead
- [ ] v2: PubMed E-utilities + ClinicalTrials.gov per-trial retrieval (currently using normalized + sponsors + interventions aggregates only)
- [ ] Add `applicable_personas[]` filter on external observations (some research is persona-specific)
- [ ] Click-to-expand on blue pills: surface the raw dataset values (e.g. show the search-volume table when "12,400/MO PREDNISONE SIDE EFFECTS" is clicked)

### Stage 6 — Visual polish on artifact 🔵
- [x] EmotionDyadChip component (replaces inline emotion display)
- [x] Brand-tinted sentiment color palette (teal / orange / blue-gray / indigo) replacing bare Tailwind generics — v1 polish
- [x] Tighter typography hierarchy: project's `--font-heading` (Jost) and `--font-mono` (IBM Plex Mono) instead of system fonts — v1 polish
- [x] Print/export-ready CSS — `@media print` hides drawer, freezes sticky headers, prevents stage page-breaks
- [x] **Sidebar layout (v2)** — stage header lives in a left column, steps stack vertically on the right; header is `position: sticky` within its stage section so it stays anchored while the user scrolls through that stage's pills
- [x] **Drawer-based reveal (v2)** — pill body, supporting quotes, drill-down content, decision-panel item details, and stage summary all live in a right-side primary drawer that opens on click. Stack-based drawer navigation so clicking an inline keyword pushes a new content level with back-button
- [x] **Iconographic pill scan (v2)** — every pill carries a lucide icon picked from a keyword classifier over its title + body (Stethoscope for clinical encounters, Pill for medications, ClipboardList for trial logistics, AlertCircle for risks, Sparkles for hope-tones, BookOpen for research, etc.). Polarity-default fallback when no rule matches
- [x] **Inline keyword auto-linking (v2)** — drawer body text matches against (journey-taxonomy step labels ∪ stage labels ∪ supplemental clinical-vocab list); matched terms become clickable buttons that open a "fragments mentioning X" drawer level. Reuses the corpus's own fragmentsById for the keyword→quote lookup
- [x] **Sharp corners + no italics** (v2) — `border-radius: 0` everywhere; stripped all Spectral italic uses; quote text renders as plain body weight
- [ ] Drawn arrows / connectors between stages (chronology cue) — deferred; sticky sidebar header arguably replaces this affordance
- [ ] Component vocabulary: StageCard, PillButton, DecisionStage, JourneyDrawer — deferred; current inline structure is single-file and was easier to iterate on. Extract once we have 3+ artifact variants
- [ ] Stage nav rail (originally landed in polish v1) — removed in v2 in favor of sticky stage sidebars. Reconsider as a "table of contents" mini-map if multi-page navigation becomes a need

### Stage 7 — Workbench advanced features ⏳
- [x] Inline keyword chips in answer text open the global lexicon-stats drawer (not a new search) ([+page.svelte](src/routes/patientlyiq/journey-workbench/+page.svelte))
- [x] Sponsor-name detection in answer text → teal-underlined buttons opening a `SponsorDrawer` with NCT deep-links ([SponsorDrawer.svelte](src/lib/components/SponsorDrawer.svelte), [/api/sponsors-observed/+server.ts](src/routes/api/sponsors-observed/+server.ts))
- [x] Parser refactor: `splitByMatches` runs both matchers, sorts by start/length, prefers sponsor over keyword on equal spans; excludes `INDIV`-class sponsors and surfaces < 4 chars
- [ ] Multi-persona overlay on beeswarm (pick 2-3 personas, color dots by match)
- [ ] Pan + zoom on the beeswarm SVG (d3-zoom or custom transform) for crowded clusters
- [ ] Confidence-as-opacity on dots (low-confidence dots fade)
- [ ] Annotation review loop (flag-this-wrong button writing to a review sidecar)
- [ ] Save active filter combo as a persona draft
- [ ] Tertiary drawer for multi-fragment comparison (shift-click → comparison view)

### Stage 8 — Persona builder UI 📋
- [ ] In-app drawer/modal for composing a new persona
- [ ] Promote a chip filter combo to a saved persona
- [ ] Edit / fork existing personas
- [ ] Disk vs. local-draft persistence decision
- [ ] Validation (impossible clauses, missing tagging dimensions)

### Stage 9 — Corpus-driven taxonomy automation 📋
- [ ] `propose-journey-taxonomy.mjs` — drafts a per-indication taxonomy from corpus + world-knowledge + adjacent datasets
- [ ] Per-indication context packs (clinical guidelines, FDA labels, patient-org materials)
- [ ] Stage / step ranking by evidence support
- [ ] Versioning + migration when promoting a draft over the live taxonomy

### Stage 10 — Content suggestor 🔵
- [x] Phase A1 registries on disk — [content_strategies.json](src/lib/content/registries/content_strategies.json), [content_formats.json](src/lib/content/registries/content_formats.json), [advocacy_partners.json](src/lib/content/registries/advocacy_partners.json), plus `ContentStrategyId` / `ContentFormatId` / `AdvocacyPartnerId` unions in [types.ts](src/lib/content/registries/types.ts)
- [x] Phase A2 mapping rules layer — [src/lib/content/suggestor/mapping.ts](src/lib/content/suggestor/mapping.ts). `rankStrategies({ indication, stages, burdens, subthemes })` returns all 10 strategies sorted by coverage score with per-dimension breakdown. Weighted mean, default weights `stages:1.0 / burdens:1.0 / subthemes:0.7`; empty-input dimensions zeroed. Pure variant `rankStrategiesFrom` exposed for tests
- [ ] Phase A3a — strategy → format scoring (`best_for_strategies` ∩ `best_for_stages`)
- [ ] Phase A3b — strategy → partner scoring (indication scope + `partnership_modes` / `focus_areas` overlap)
- [ ] Build-time validator: every `addresses_subthemes` id in [content_strategies.json](src/lib/content/registries/content_strategies.json) must resolve in `codebook.json`
- [ ] LLM proposer that re-ranks + synthesizes on top of the deterministic floor

### Stage 11 — Audience views (Personas / Community / Digital Data) 🔵
- [x] [/patientlyiq/personas](src/routes/patientlyiq/personas/+page.svelte) — bento grid of interviewee profiles with click-to-expand cards (BentoCard + CompactThemeBars + bento-anim store)
- [x] [/patientlyiq/community](src/routes/patientlyiq/community/+page.svelte) — community-engagement view (Reddit-vs-FB asymmetry framing from disease-insights)
- [x] [/patientlyiq/digital-data](src/routes/patientlyiq/digital-data/+page.svelte) — search-volume + ClinicalTrials.gov + community datasets browser, indication-scoped
- [x] [/patientlyiq/persona-workbench](src/routes/patientlyiq/persona-workbench/+page.svelte) — split-pane persona inspector (filter chips on the left, evaluated fragments + summary on the right)
- [x] [/patientlyiq/serp-readability](src/routes/patientlyiq/serp-readability/+page.svelte) — SERP-readability table view (SerpReadabilityTable component)
- [x] [/plan](src/routes/plan/+page.svelte) — basic renderer for this WORKBENCH_PLAN.md doc (reads from disk via marked at request time)
- [ ] Wire content-suggestor output into the personas / community views once Phase A3 lands

### Cross-cutting
- [ ] Investigate prompt-cache miss between stage calls in `synthesize-journey-map.mjs` (cache_write firing but cache_read=0)
- [ ] Tune drill-down salience prompt (currently every stage gets a drill-down; should be sparse)
- [ ] Resolve Participant 003 conflated-id in LN corpus (amlbreader + Missing-the-sun mapped to one pseudonym)
- [ ] Decide on participant_13 future home (currently excluded from GLP-1; FA narrative)
- [ ] Add `mcrpc` to indication registry when an mCRPC corpus arrives

---

## D. Progress

**Overall: ~70% complete** (rough estimate weighted by remaining effort, not by stage count; widened with Stages 10–11 now in scope).

| Stage | Weight | Done | Contribution |
|---|---|---|---|
| 1. Foundation | 10% | 100% | 10% |
| 2. Annotation pipeline | 12% | 100% | 12% |
| 3. Workbench | 15% | 100% | 15% |
| 4. Artifact v1 | 8% | 100% | 8% |
| 5. World-knowledge | 10% | 55% | 5.5% |
| 6. Visual polish | 8% | 80% | 6.4% |
| 7. Workbench advanced | 8% | 25% | 2% |
| 8. Persona builder | 6% | 0% | 0% |
| 9. Corpus-driven taxonomy | 4% | 0% | 0% |
| 10. Content suggestor | 9% | 30% | 2.7% |
| 11. Audience views | 10% | 60% | 6% |
| **Sum** | **100%** | | **67.6%** |

Plus ~3% for cross-cutting items partially handled (bug surfacing, exclusions documented, persona artifact roster shipped, dev-facing /plan page). Stage 5 reflects v1 (disease-insights) done; PubMed / NCT-API integration is the remaining ~45%. Stage 6 reflects v2 (sidebar + drawer + icons + keyword linking) shipped; component extraction + drawn connectors remain. Stages 10–11 are new this week — Stage 10 has the registries + deterministic mapping done; Stage 11 has the audience-view route scaffolds in but is not yet wired to the suggestor.

---

## E. Next Actions

Recommended priority order. Each action notes scope + API spend.

1. **Fix dropped-stage bug in propose-external-observations** (Stage 5) — *recommended next*
   Scope: 30-60 min. No API spend.
   Why: ln_caregivers_as_researchers dropped 7 of 10 proposed pills (only had 1 fragment in 1 stage); glp1_cost_pressure_moments dropped 4; glp1_older_us_women dropped 1. External pills should backfill stages with zero corpus fragments — that's exactly where world-knowledge fills corpus silence. The fix is to auto-create the missing stage entries with `observations: []` rather than silently dropping the proposal.

   **Update 2026-05-27:** still open after the obesity seed re-run (5 more pills dropped). Now bitten ≥4 personas across both indications. Priority remains #1.

1.5 **Commit the dirty tree** — *do this first*
   Scope: 30-45 min. No API spend.
   Why: 154 changed files, ~28k insertions, none committed. The hand-off doc proposes 5 focused commits (Phase 5 + obesity seed / visual polish v2 / persona-artifact roster / journey-workbench keyword+sponsor / content-suggestor registries + A2). Anything we push after this gets harder to attribute without that split.

2. **Fix emotion-codebook regression** (backlog #1) and re-synthesize all artifacts on Opus
   Scope: 1-2 hours code change + ~$30-40 in API spend if re-synthesizing all 8 artifacts on Opus 4.7.
   Why: 7 of the 8 artifacts were generated with Haiku 4.5 during testing. Quality is solid but emotion labels still include unconstrained free-text — locking the codebook enum is overdue regardless of model. After the fix, re-run on Opus (the differential is the cost of going from "validation set" to "ship-ready"). Or skip Opus rerun and accept Haiku quality across the demo set.

4. **Multi-persona overlay on workbench** (Stage 7)
   Scope: 2-4 hours. No API spend.
   Why: small change, big analytical lift. The natural follow-on to indication scoping + filter chips that just landed.

5. **Component extraction** (Stage 6 remainder)
   Scope: 1 day. No API spend.
   Why: with 8 artifacts now showing the same visual register, the patterns are validated. Extract `StagePanel` (sidebar+sticky), `PillButton` (icon+swatch+title), `JourneyDrawer` (stack-based content drawer), `KeywordText` (auto-link wrapper) — each is in service of the next route that wants to consume journey content (exec summary, persona view, community view weaves).

6. **World-knowledge v2 — PubMed + per-trial NCT retrieval** (Stage 5)
   Scope: 1-2 days. API spend: light (PubMed E-utilities free; per-trial NCT detail fetches free; ~$2-3 per persona on Opus, ~$0.30 on Haiku).
   Why: aggregates already work; per-trial details (e.g. specific NCT IDs the persona could enroll in, recent papers naming the same intervention) would deepen the artifact substantially.

7. **Confidence-as-opacity on workbench dots** (Stage 7)
   Scope: 1-2 hours. No API spend.
   Why: small visual change, big trust-gradient lift.

---

## Reference

### Key files & locations

**Data**
- Fragments: `src/lib/content/corpora/<corpus_id>/fragments/<content_source>.json`
- Annotations: `src/lib/content/corpora/<corpus_id>/annotations/<content_source>.json` (multi-dim: stages + segment_tags)
- Artifacts: `src/lib/content/corpora/<corpus_id>/artifacts/journey-map-<persona>.json`
- Journey taxonomies: `src/lib/content/journeys/<indication>.json`
- Personas: `src/lib/content/personas/<persona_id>.json`
- Codebook (study-agnostic): `src/lib/content/wctglpdemo-data/codebook.json`

**Scripts (run from project root)**
- `node scripts/import-interviews-as-fragments.mjs` — re-runs the GLP-1 interview ingest
- `node scripts/import-forum-as-fragments.mjs <corpus_id>` — runs any forum/social ingest given a config
- `node scripts/propose-fragment-stages.mjs <corpus_id> [--source <name>] [--batch <id>] [--force]`
- `node scripts/propose-fragment-sentiment.mjs <corpus_id> [--source ...] [--batch ...] [--force]`
- `node scripts/propose-fragment-themes.mjs <corpus_id> [--source ...] [--batch ...] [--force]`
- `node scripts/synthesize-journey-map.mjs <corpus_id> <persona_id> [--model <id>] [--force]` — `--model` defaults to `claude-opus-4-7`; Haiku-compat (strips `thinking` / `effort`) when model contains "haiku"
- `node scripts/propose-external-observations.mjs <corpus_id> <persona_id> [--model <id>] [--force]` — merges research pills into existing artifact; same `--model` handling

**Routes**
- `/patientlyiq/journey-workbench` — analyst workbench (indication-scoped via `?indication=`)
- `/patientlyiq/journey-map/<corpus_id>/<persona_id>` — generated artifact view

### Current corpora

| Corpus | Indication | Source | Fragments | Annotations | Artifacts |
|---|---|---|---|---|---|
| `wct_glp1_2025q4` | obesity | 7 interviews | 616 | stages ✅, segment_tags ✅ | 5 personas (Haiku 4.5 + external pills on all 5) |
| `ln_reddit_2026q1` | lupus_nephritis | Reddit r/lupus CAR-T threads | 79 | stages ✅, sentiment ✅, themes ✅ | 3 personas (carT_curious on Opus 4.7 + external; trial_barrier and caregivers on Haiku 4.5 + external) |
| _(MS disease-insights only)_ | multiple_sclerosis | manifest + search + community | _no corpus yet_ | — | `ms_all_voices.json` persona placeholder; corpus + annotations + artifacts pending |

### Current personas

| Persona | Indication | Filter type | Color |
|---|---|---|---|
| `glp1_obesity_all_voices` | obesity | broad | #64748b |
| `glp1_older_us_women` | obesity | demographic | #f43f5e |
| `glp1_younger_us_patients` | obesity | demographic | #0ea5e9 |
| `glp1_cost_pressure_moments` | obesity | annotation-driven (has_step) | #f59e0b |
| `glp1_negative_at_trial_consideration` | obesity | annotation-driven (stage + sentiment) | #8b5cf6 |
| `ln_sle_carT_curious_patients` | lupus_nephritis | demographic | #ec4899 |
| `ln_caregivers_as_researchers` | lupus_nephritis | demographic | #14b8a6 |
| `ln_trial_barrier_moments` | lupus_nephritis | annotation-driven (has_subtheme) | #dc2626 |
| `ms_all_voices` | multiple_sclerosis | broad | _placeholder, no corpus yet_ |

### Known issues / debt

- **Participant 003 conflated** in LN corpus (`amlbreader` + `Missing-the-sun` mapped to one pseudonym). Surfaced by the ingester; not auto-fixed. Re-anonymize upstream if it matters.
- **participant_13 misclassified** into the GLP-1 obesity corpus — actually a Friedreich's-ataxia narrative. Excluded via `EXCLUDED_INTERVIEWS` in `import-interviews-as-fragments.mjs`. Could seed a future FA corpus.
- **Drill-downs too eager** in synthesis — all 6 stages got one for the first LN artifact. Should be sparse (top 2-3 stages by salience). Prompt tune.
- **Prompt-cache miss** between stage calls in `synthesize-journey-map.mjs` — `cache_write` fires every call, `cache_read` stays 0. Worth a 30-min investigation; might be schema-induced.
- **Codebook lives in `wctglpdemo-data/`** — labeled "study-agnostic" but the location implies otherwise. Move to `src/lib/content/codebook.json` someday.
- **No app-level indication selector visible to end users yet** beyond the URL param. Add an indication switcher chip to the topbar.

### API spend log (cumulative, approximate)

| Run | Cost |
|---|---|
| propose-fragment-stages on wct_glp1 (8 interviews) | ~$4 |
| propose-fragment-stages on ln_reddit (2 batches × 2 sources) | ~$0.40 |
| propose-fragment-sentiment on ln_reddit | ~$0.50 |
| propose-fragment-themes on ln_reddit | ~$0.50 |
| synthesize-journey-map on ln_sle_carT_curious_patients (Opus 4.7) | ~$5 |
| propose-external-observations on ln_sle_carT_curious_patients (Opus 4.7) | ~$0.50 |
| synthesize-journey-map × 7 personas (Haiku 4.5) | ~$0.80 |
| propose-external-observations × 3 LN personas (Haiku 4.5) | ~$0.30 |
| propose-external-observations × 5 GLP-1 personas after obesity seed (Haiku 4.5) | ~$0.50 |
| Small test runs (participant_12, participant_13 dry, etc.) | ~$1 |
| **Total this project to date** | **~$13.50** |

---

## Session Log

### 2026-05-26 — Foundation through Artifact v1

- Built fragment corpus schema, two ingesters (interview + forum), all three annotation proposers (stages / sentiment / themes), persona language + 8 personas, journey workbench with filter chips + primary drawer + indication scoping, synthesis pipeline + render route.
- Ran annotation pipelines on both corpora end-to-end. Generated first journey-map artifact for `ln_sle_carT_curious_patients` — synthesis is high quality (multi-fragment generalizations, sharp drill-downs, decision-panel intel that captures real corpus friction).
- Added EmotionDyadChip component as the start of visual polish on the artifact page.
- Backlog entries added: Persona builder UI, Corpus-driven journey-stage taxonomy.

### 2026-05-26 — Visual polish v2 + persona artifact roster

- **Visual polish v2** ([+page.svelte](src/routes/patientlyiq/journey-map/[corpus_id]/[persona_id]/+page.svelte)): the journey-map artifact got a structural redesign on top of v1's palette work. Per stage: 280px sidebar with `position: sticky` stage header on the left, vertical step blocks on the right. Pill bodies and supporting quotes moved OUT of inline render and INTO a stack-based right-side primary drawer; clicking a pill opens it, drawer keeps history so inline-keyword clicks push a new view. Pills now carry a lucide icon picked by a keyword classifier (Stethoscope / Pill / ClipboardList / AlertCircle / Sparkles / BookOpen / etc.) plus a polarity color swatch — title-only on the surface. Sharp corners (`border-radius: 0`) throughout; all italic and italicized-serif uses removed; body type bumped to 1rem with 1.55 line-height. Inline keywords inside drawer text auto-link against the journey-taxonomy step labels + supplemental clinical-vocab list and open a "fragments mentioning X" drawer view.
- **Scripts parameterized for model choice** ([synthesize-journey-map.mjs](scripts/synthesize-journey-map.mjs), [propose-external-observations.mjs](scripts/propose-external-observations.mjs)): added `--model <id>` CLI flag, defaulting to `claude-opus-4-7`. When the model contains "haiku", the script strips the `thinking: { type: 'adaptive' }` and `output_config.effort: 'high'` parameters that Haiku 4.5 rejects.
- **Persona artifact roster** brought to 8/8. The 6 remaining personas (5 GLP-1 + ln_caregivers_as_researchers) were generated on Haiku 4.5 at ~$0.13/persona vs ~$5.50/persona on Opus — a 42× cost reduction. Quality holds up: drill-downs surface real analytical tensions ("severity threshold creates a Catch-22"), observations are multi-fragment generalizations not single-quote restates, drivers/barriers are concrete. ~$1 batch total.
- **Known gap surfaced**: 5 of 8 artifacts have no research pills because `src/lib/content/disease-insights/obesity/` doesn't exist yet. Pattern is identical to the lupus-nephritis folder; recommended Next Action #1.

### 2026-05-26 — Stage 5 v1: world-knowledge integration

- Wrote [scripts/propose-external-observations.mjs](scripts/propose-external-observations.mjs). Single Claude call, JSON-schema-constrained with stage_id + step_id enums + dataset_id enum so the model can only cite real ids. Compact-context builders per dataset type (search-volume top-12 topics + total; CT normalized aggregates; CT sponsors top-10 + interventions top-15; community-engagement verbatim). Skips `clinical_trials_raw` (too large) and `keyword_clusters` (not useful here).
- Ran on `ln_sle_carT_curious_patients`. 10 external observations merged across 6 stages (3 proposed for stages with zero corpus fragments were dropped — known limitation, captured as Next Action #2). Observations are tight: each pill leads with a specific figure (e.g. "112 LN TRIALS RECRUITING OR PRE-RECRUITING", "PRIVATE LN FB GROUPS POST ~4× PUBLIC ONES", "2,660/MO SEARCH 'LUPKYNIS'") and the body ties it to a persona-specific tension.
- Extended `ExternalObservation` type in [+page.server.ts](src/routes/patientlyiq/journey-map/[corpus_id]/[persona_id]/+page.server.ts) with `citation`, `source_dataset_ids`, `confidence`. Added `external_observations_proposer` provenance block to artifact meta.
- Updated [+page.svelte](src/routes/patientlyiq/journey-map/[corpus_id]/[persona_id]/+page.svelte) to render indigo pills with a "Research" divider per step container. Non-clickable v1 with citation always visible; click-to-expand-dataset-values is queued for the next visual-polish pass.
- Verified via `curl` against the dev server: 200 OK, 10 indigo pills + 10 "Research" dividers in the rendered HTML, auto-added stage-level "(general)" container renders correctly for the one stage-level pill.

**Next session opens with**: Stage 6 (visual polish) per the refreshed Section E — pair the polish with finding the right home for the new blue pills.

---

**At end-of-session 2026-05-26 — Stage 6 v2 + persona roster shipped. Next session opens with**: seeding `disease-insights/obesity/` so the GLP-1 artifacts can carry research pills (Section E #1), then deciding whether to re-synthesize the Haiku 4.5 artifacts on Opus 4.7 once the emotion-codebook fix lands.

### 2026-05-26 — Obesity disease-insights seed + full external-pill coverage

- Added `obesity` to `QUERY_SETS` in [fetch-clinicaltrials.mjs](scripts/fetch-clinicaltrials.mjs) (two narrowed queries: GLP-1 drug names + weight-management interventional) and to `DEFAULT_PATHS` in [normalize-clinicaltrials.mjs](scripts/normalize-clinicaltrials.mjs).
- Ran fetch → 2,740 deduped studies; normalize → 2,740 studies + 1,808 sponsors + 3,687 interventions in [src/lib/content/disease-insights/obesity/clinical_trials/](src/lib/content/disease-insights/obesity/clinical_trials/).
- Hand-authored 5 search-volume datasets covering treatments, side-effects, cost/access, clinical trials, and lifestyle/durability — calibrated to the GLP-1 corpus's dominant themes (cost pressure, side-effect anxiety, regain anxiety, pipeline curiosity). All marked `manual_estimate` for transparency.
- Hand-authored a community-engagement dataset capturing the Reddit-public vs Facebook-public vs Facebook-private engagement asymmetry that mirrors how the wct_glp1 corpus was sampled.
- Built [manifest.json](src/lib/content/disease-insights/obesity/manifest.json) with 10 datasets.
- Re-ran `propose-external-observations` on all 5 GLP-1 personas (Haiku 4.5, --force). 57 research pills merged across the 5 artifacts; 5 dropped due to the existing "stage skipped during synthesis" bug. Highest-quality pills are persona-specific, e.g. `glp1_cost_pressure_moments` got "254.7K total monthly cost/access searches dwarf trial awareness at 10.6K" and "475 recruiting or pre-enrollment obesity trials," exactly the cost-vs-pipeline framing the persona deserves.
- All 8 persona artifacts now carry research pills. API spend this micro-session: ~$0.50.

**Next session opens with**: Section E #1 — the dropped-stage bug in `propose-external-observations.mjs`, which has now bitten 3 different personas across both indications.

### 2026-05-27 — Plan doc renderer + scope widening (Stages 10–11)

Reconciliation pass against the working tree (still uncommitted) plus today's plan-page work:

- **Journey-workbench keyword + sponsor chips (Stage 7)** — captured retroactively. Answer-text chips now open the global lexicon-stats drawer instead of firing a new search ([+page.svelte:1213–1219](src/routes/patientlyiq/journey-workbench/+page.svelte#L1213-L1219)). Sponsor names detected in answer text render as teal-underlined buttons that open a new [SponsorDrawer.svelte](src/lib/components/SponsorDrawer.svelte) showing trial counts, lead-vs-collaborator split, and NCT deep-links. Parser refactored to `splitByMatches` running both matchers, sorting by start/length, preferring sponsor on equal spans. `INDIV`-class sponsors and < 4-char surfaces excluded. New supporting files: [observed-sponsor.ts](src/lib/types/observed-sponsor.ts), [/api/sponsors-observed/+server.ts](src/routes/api/sponsors-observed/+server.ts). Not yet dev-server verified.
- **Content suggestor Phase A1 + A2 — new Stage 10**. Phase A1 registries on disk ([content_strategies.json](src/lib/content/registries/content_strategies.json), [content_formats.json](src/lib/content/registries/content_formats.json), [advocacy_partners.json](src/lib/content/registries/advocacy_partners.json)) with id unions in [types.ts](src/lib/content/registries/types.ts). Phase A2 deterministic mapping in [src/lib/content/suggestor/mapping.ts](src/lib/content/suggestor/mapping.ts) — `rankStrategies({ indication, stages, burdens, subthemes })` returns all 10 strategies sorted by coverage score with per-dimension breakdown; weighted mean with `stages:1.0 / burdens:1.0 / subthemes:0.7`; empty-input dimensions zeroed; pure `rankStrategiesFrom` variant for tests. Floor under the eventual LLM proposer.
- **Audience-view routes — new Stage 11**. Scaffolded but not wired to the suggestor yet: [/patientlyiq/personas](src/routes/patientlyiq/personas/+page.svelte) (bento grid with click-to-expand cards, supported by [BentoCard.svelte](src/lib/components/personas/BentoCard.svelte) / [CompactThemeBars.svelte](src/lib/components/personas/CompactThemeBars.svelte) / [bento-anim.svelte.ts](src/lib/components/personas/bento-anim.svelte.ts)), [/patientlyiq/community](src/routes/patientlyiq/community/+page.svelte) (Reddit-vs-FB engagement-asymmetry framing), [/patientlyiq/digital-data](src/routes/patientlyiq/digital-data/+page.svelte) (disease-insights browser, indication-scoped), [/patientlyiq/persona-workbench](src/routes/patientlyiq/persona-workbench/+page.svelte) (filter-chips left + evaluated fragments right), [/patientlyiq/serp-readability](src/routes/patientlyiq/serp-readability/+page.svelte) (SerpReadabilityTable).
- **Multiple-sclerosis disease-insights seeded** at [src/lib/content/disease-insights/multiple-sclerosis/](src/lib/content/disease-insights/multiple-sclerosis/) — manifest, 5 search-volume datasets, community engagement, clinical_trials normalized aggregates. `ms_all_voices` persona placeholder added at [src/lib/content/personas/ms_all_voices.json](src/lib/content/personas/ms_all_voices.json). No corpus, annotations, or artifacts yet — Stage 11 plumbing only.
- **Lupus-nephritis disease-insights expanded** — 5 new search-volume slices (clinical_trials, comorbidities, diagnostics_monitoring, quality_of_life, side_effects, symptoms) at [src/lib/content/disease-insights/lupus-nephritis/search/](src/lib/content/disease-insights/lupus-nephritis/search/). Treatment_searches_us.json also touched.
- **Plan doc renderer shipped today**: [/plan](src/routes/plan/+page.svelte) renders this file via [+page.server.ts](src/routes/plan/+page.server.ts) (fs.readFile + marked). One new runtime dep: `marked`. No chrome — sits at top level with custom prose styling that mirrors the brand color tokens + typography (Jost headings, IBM Plex body/mono, sharp corners).

**Cross-cutting / housekeeping picked up:**
- Refreshed Section B to add Stages 10 and 11; renumbered "8/9 backlog" to keep the original sequence intact.
- Added 25%-done check on Stage 7 (Workbench advanced) to reflect the keyword+sponsor chips landing.
- Section D progress widened to 11 stages; overall estimate moved from ~74% to ~67.6% as Stages 10–11 dilute the denominator.
- New Section E pre-step ("1.5 Commit the dirty tree") — none of this is committed yet. Per the hand-off doc, suggested split is into 5 focused commits.

**Next session opens with**: 1.5 (commit the dirty tree into the 5-commit split from the hand-off doc), then Section E #1 (dropped-stage bug in `propose-external-observations.mjs` — now bitten ≥4 personas).
