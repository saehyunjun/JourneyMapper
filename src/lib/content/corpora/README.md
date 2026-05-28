# Corpora — unified evidence storage

This folder holds the **fragment pool**: the cross-source projection of all evidence the analysis pipeline reasons about. A fragment is a piece of text from any source (interview, social post, video caption, paper, survey) with normalized provenance, speaker attribution, and weighting metadata.

See [`types.ts`](./types.ts) for the full schema.

## Why this layer exists

Earlier-stage analysis was anchored on `segments.json` — interview-only, participant-centric. As the corpus broadens to social, video, and papers, the analytic unit needs to be source-agnostic. Personas become **queries** over the fragment pool (not rosters of participants), and journey-map artifacts aggregate `(persona, journey_stage)` slices uniformly across sources.

Source-specific structural files (`segments.json`, transcripts, paper-extract pipelines) remain canonical for their own pipelines. **Fragments are a derived layer**, populated by per-source ingesters.

## Layout

```
src/lib/content/corpora/
  <corpus_id>/
    manifest.json
    fragments/
      interview.json
      social_post.json
      forum_post.json
      youtube_transcript.json
      ...
    annotations/
      interview.json
      social_post.json
      ...   (mirrors fragments/; joined by fragment_id)
```

Partitioning by `content_source` keeps file sizes tractable and lets re-ingestion of one source not touch the others. Annotations live in a sibling tree so the codebook can re-derive them without rewriting source fragments — preserving the existing pipeline's separation between structural files and annotation files.

## Three-state speaker attributes

Persona predicates run over `speaker_attrs`, which uses a three-state evidence model:

- **missing key** → the attribute was never considered for this fragment
- **`value: null, evidence: 'unknown'`** → asked / tried, but couldn't determine
- **`value: X, evidence: 'inferred', confidence: 0..1`** → derived from context
- **`value: X, evidence: 'stated', source_quote: '…'`** → speaker said so explicitly

Without these distinctions, a persona filter like `distance_to_coe_band >= '100-300mi'` will silently drop every Reddit/paper fragment (since the attribute is rarely stated there), turning the persona into "interview-only by accident." Persona queries need explicit `requires-stated` vs `compatible-with` semantics per clause. See JSDoc on `AttrEvidence` for the full contract.

## Deidentification and licensing

**Privacy is handled before ingestion** — text in the fragments store is already deidentified. The `deid_rules_version` field pins which scrub rules ran, so we know which fragments need reprocessing when rules tighten.

The `license` field governs **copyright / TOS redistribution of the deidentified text**, not privacy. Papers and some forum posts remain quotation-restricted even after deid. `redistribute_verbatim` is derived from `license` and read by render code to gate verbatim vs. paraphrased display.

For social sources, `source_ref.author_handle_hash` uses a salt that is **destroyed after ingestion**. This gives within-corpus author-level grouping (was the same user posting repeatedly in this thread?) without enabling re-identification.

## Weighting

`weight_base` defaults per `content_source` (see `DEFAULT_WEIGHT_BASE`); `weight_signals` carries source-specific raw inputs (upvotes, citation count, sample size, recency). The final multiplier is computed at **query time** per the persona's chosen weighting strategy — this keeps weighting flexible without rewriting fragments when the strategy changes.

The honest tradeoff: a `sentiment_score = -1` from a peer-reviewed cohort study and a `sentiment_score = -1` from an angry Reddit comment do not mean the same thing. Naïvely averaging them is misleading. The weighting layer + source-aware persona queries are what keep this honest, but the analyst must make explicit choices ("this persona is interview-only; this one mixes interviews + social at 0.6/0.4; this one layers papers as context only").

## Ingester versioning is part of the fragment id

When an ingester changes how it handles its source (e.g. Reddit ingester improves quoted-reply stripping), re-ingestion produces **new fragments**, not mutated old ones. Old annotations follow old fragment ids. The analyst cuts over deliberately. Heavier but safer than in-place mutation.

## Registry dependencies

`content_source` is typed as `ContentSourceId` from [`../registries/types.ts`](../registries/types.ts). Current registry covers `interview`, `social_post`, `forum_post`, `blog_post`, `youtube_transcript`, `podcast_transcript`, `search_query`.

**Not yet registered but anticipated for future ingesters:**

- `paper_excerpt` — peer-reviewed and grey-literature paragraphs
- `clinical_note` — published clinical narratives
- `survey_response` — free-text survey answers

Add the registry entries (plus matching `SourceRef` variants in `types.ts`) before standing up those ingesters.

**Indication registry** ([`../registries/indications.json`](../registries/indications.json)) currently covers `lupus_nephritis`, `melanoma`, `obesity`, `multiple_sclerosis`. Adding `mcrpc` (or whatever oncology indication a future corpus targets) is a prerequisite for that corpus.

## Migration path from current state

1. **Phase 0 (this commit).** Schema authored. No corpora populated yet.
2. **Phase 1.** Stand up `wct_glp1_2025q4/` with `scripts/import-interviews-as-fragments.mjs` reading `segments.json`, `interviews_structured.json`, and `participant_profiles.json` to populate `fragments/interview.json`. The existing interview pipeline keeps running in parallel.
3. **Phase 2.** Annotation production migrates: `propose-*.mjs` scripts read fragments and write into `annotations/<content_source>.json`. `segment_tags.json` remains as a view for legacy consumers during transition.
4. **Phase 3.** Stage-tagging pipeline (`propose-fragment-stages.mjs`) — source-aware prompting, multi-label per fragment.
5. **Phase 4.** First non-interview ingester (likely social — most analytically interesting, least dependent on external partnerships).
6. **Phase 5.** Persona query language + analyst workbench view (beeswarm per stage, persona-as-filter).
7. **Phase 6.** Curated journey-map artifact (the polished output, like the mCRPC reference map).

## What lives elsewhere

- **Personas** (saved queries): `src/lib/content/personas/` — not in this folder; personas reference fragments by query, not by id.
- **Journey templates** (per-indication stages/steps): `src/lib/content/journeys/<indication>/`.
- **Codebook** (themes / subthemes / clusters): unchanged — `src/lib/content/wctglpdemo-data/codebook.json` and `keyword_lexicon.json` continue to be the source of truth for the taxonomy axis.
- **Raw pre-deid text**: NOT in this repo at all. Lives in a separate access-controlled archive. The fragments store holds only the deidentified text used for analysis.
