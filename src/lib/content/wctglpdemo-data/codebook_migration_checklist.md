# Codebook 1.8 → 2.0 Promotion Checklist

Promotes [codebook.next.json](codebook.next.json), [keyword_lexicon.next.json](keyword_lexicon.next.json), and [segment_tags.next.json](segment_tags.next.json) over the live files. Drafted 2026-05-20.

Recommend doing this on a branch (`codebook-migration`) so `main` keeps working until everything below verifies.

---

## Phase 0 — Lock the drafts

Before touching any code. Cheap to iterate on now, expensive after rename.

- [ ] Eyeball [segment_tags.next.json](segment_tags.next.json). Audit the **9 zero-use new subthemes**: `condition_knowledge_gaps`, `symptoms`, `comorbidities`, `social_stigma`, `advocacy_peer_groups`, `diagnostic_odyssey`, `clinical_trial_interest`, `clinical_trial_knowledge_gaps`, `trial_positive_experiences`, `trial_negative_experiences`. If any should have inherited content from an existing theme, edit [codebook_migration_map.json](codebook_migration_map.json) and re-run `node scripts/migrate-segment-tags.mjs`.
- [ ] Eyeball the **18 `confidence: review` rows** in the map. Each defaulted to one destination; if the default is wrong for your corpus, edit the row and re-run.
- [ ] Sample 5-10 random annotations from `segment_tags.next.json` and compare to their old shape. Confirm the rule-fired rewrites (54 decision-factor flips, 31 injection positives, 8 visit-logistics motivators, 7 compounded barriers) look right.
- [ ] **Inline `emotion_tags` into `codebook.next.json`.** Currently it carries a placeholder note pointing at codebook.json @ 1.8. Copy the array verbatim into the new file before rename. (sentiment_scale is already inlined.)
- [ ] **Decide what to do with the 102 existing clusters in [keyword_lexicon.json](keyword_lexicon.json) @ 2.0**:
  - **A — Defer.** Start with empty `clusters: []` and re-seed from new tagging sessions. Loses ~hours of editorial work but the new structure is clean.
  - **B — Bulk re-assign.** Each existing cluster gets `parent_theme` + `parent_subtheme` per analyst judgment. Preserves curated variants.
  - **C — Re-assign + split.** Same as B, but cross-context clusters (e.g. `cost`) split into parallel pairs (`treatment_cost_concerns`, `trial_cost_concerns`).
- [ ] **Decide what to do with [segment_tags.proposed.json](segment_tags.proposed.json)** (AI-proposed tags). It references old theme ids and will be stale after rename. Options:
  - **A — Re-propose.** `node scripts/propose-segment-tags.mjs --force` for each interview after rename. Cleanest, costs Anthropic API calls.
  - **B — Machine-migrate.** Run the same migration logic on the proposed file (small additional flag on `migrate-segment-tags.mjs`).

---

## Phase 1 — Code audit (no edits yet, just enumerate)

These greps tell you what will break at rename time. Do them first.

- [ ] `grep -rln 'theme_tags\|tag_groups\|tag_group' src/` — every reference needs to be revisited
- [ ] `grep -rln 'codebook.theme_tags\|codebook.tag_groups' src/` — most-critical subset
- [ ] `grep -rln '\.categories\b' src/lib` (within lexicon-importing files) — old lexicon's top-level field
- [ ] `grep -rln 'keyword_lexicon\|categories\[\]\.keywords' src/ scripts/` — full lexicon-consumer list
- [ ] Confirm [src/lib/server/keyword-tags.ts:39](src/lib/server/keyword-tags.ts#L39) (`findCluster`) is on your list — it walks the old `categories[].keywords[]` shape and needs updating.

---

## Phase 2 — Rewrite consumers (still pre-rename)

This is the heavy lift. Order matters — server helpers first, then components.

- [ ] **[src/lib/server/lexicon.ts](src/lib/server/lexicon.ts)** — rewrite `createKeyword` to take `parent_theme` + `parent_subtheme` instead of `categoryId`. Cluster goes into a flat `clusters[]` array. `addKeywordVariant` stays roughly the same (just operates on flat clusters).
- [ ] **[src/routes/wctglpdemo/lexicon/+server.ts](src/routes/wctglpdemo/lexicon/+server.ts)** — update `create_keyword` action's payload to require `parent_theme` + `parent_subtheme`.
- [ ] **[src/lib/server/keyword-tags.ts](src/lib/server/keyword-tags.ts)** — `findCluster()` walks flat `clusters[]`. Type definitions update.
- [ ] **[src/lib/components/SegmentTagDrawer.svelte](src/lib/components/SegmentTagDrawer.svelte)** — the right-side panel's tag-groups disclosure UI goes away. Replaces with a flat list of 3 themes, each expanding into its subthemes. Drop `tagGroups` and `grouped` derived state. **NOTE:** this file just gained star/dirty/undo machinery — coordinate carefully.
- [ ] **[src/lib/components/KeywordTagDrawer.svelte](src/lib/components/KeywordTagDrawer.svelte)** — now nests clusters by `parent_subtheme` (read from `codebook.json` for the tree). "+ New cluster here" needs both `parent_theme` and `parent_subtheme` from the section the analyst is in.
- [ ] **[scripts/build-keyword-usage.mjs](scripts/build-keyword-usage.mjs)** — update to read flat `clusters[]` shape. Output stays as census.
- [ ] **[scripts/propose-segment-tags.mjs](scripts/propose-segment-tags.mjs)** — update enum constraint to use new theme/subtheme ids. Prompt likely needs the new theme/subtheme descriptions — they're more abstract than the old GLP-1-specific themes.
- [ ] **[scripts/build-segment-tags.mjs](scripts/build-segment-tags.mjs)** — validator: enforce `subtheme ∈ subthemes-of(theme)` per the new shape.
- [ ] `npm run check` clean for every touched file.

---

## Phase 3 — Rename + regenerate

- [ ] `git mv codebook.json codebook.v18-backup.json` (or stash; either way preserve a rollback path)
- [ ] `git mv codebook.next.json codebook.json` — bump `schema_version` from `"2.0-draft"` to `"2.0"` while you're in there
- [ ] `git mv keyword_lexicon.json keyword_lexicon.v2-backup.json`
- [ ] `git mv keyword_lexicon.next.json keyword_lexicon.json` — bump `schema_version` to `"3.0"`
- [ ] `git mv segment_tags.json segment_tags.v18-backup.json`
- [ ] `git mv segment_tags.next.json segment_tags.json` — confirm `meta.codebook_schema_version` is `"2.0"`
- [ ] `node scripts/build-keyword-usage.mjs` — regenerate the census against the new lexicon
- [ ] For `segment_tags.proposed.json`: either re-propose (`node scripts/propose-segment-tags.mjs --force <id>` per interview) or run the migration script with a proposed-file flag

---

## Phase 4 — Verify in the running app

- [ ] `npm run dev`, navigate to wherever live tagging happens (`/wctglpdemo/upload` review view or `/wctglpdemo` segments view).
- [ ] Open a segment in the SegmentTagDrawer. Confirm the new 3-theme structure renders cleanly and existing tags display.
- [ ] Add and remove a theme + subtheme tag, save. Re-open and confirm persistence.
- [ ] Right-click a phrase, open the KeywordTagDrawer. Confirm clusters group by parent_subtheme correctly.
- [ ] Click a cluster — tag should land in `keyword_tags.json` with the right `keyword_id`.
- [ ] `+ New cluster here` — creates with the in-context `parent_theme` + `parent_subtheme`, then auto-tags.
- [ ] Sample 3 annotations: compare `segment_tags.json` vs. UI for the same segment id. They should match.

---

## Phase 5 — Cleanup

- [ ] Drop the `-draft` / `.next` suffixes everywhere; update `meta.status` strings.
- [ ] Mark [codebook_migration_map.json](codebook_migration_map.json) as historical in its meta: it's no longer needed for normal operation, only useful for re-running the migration if you ever need to roll back.
- [ ] Keep [scripts/migrate-segment-tags.mjs](scripts/migrate-segment-tags.mjs) as historical reference. Don't delete — it documents the structural transition.
- [ ] Delete this checklist file once the promotion is complete and verified.
- [ ] Update `interview-analysis-pipeline.md` memory with the final schemas.
- [ ] Commit `codebook-migration` → `main`. Squash if you want a single "migrate to codebook 2.0" commit, or keep phase commits for narrative.

---

## Rollback strategy

Each file kept as `.v18-backup.json` (or `v2-backup`) in Phase 3. To roll back:

1. `git mv codebook.v18-backup.json codebook.json` (and equivalents for lexicon + tags)
2. `git revert` the code commits from Phase 2

If on the migration branch, `git checkout main -- .` is faster.

The migration script can be re-run any time on the v18 backup to regenerate `segment_tags.next.json` — it's idempotent.

---

## Open question worth surfacing before Phase 0

**The 102 existing keyword clusters** in [keyword_lexicon.json](keyword_lexicon.json) carry editorial work. Defer (Option A) is the fastest path to a clean new system. Re-assign (B/C) preserves the variant lists. My instinct: **Defer**. The old clusters were lexical/dictionary-style (matching surface forms); the new clusters are per-instance and shape themselves by tagging. Seeding old clusters into the new structure risks importing the old mental model. Worth deciding before Phase 2 since it affects how much UI work the KeywordTagDrawer needs.
