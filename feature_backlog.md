# Feature Backlog & User Needs

Running log of how PatientlyIQ is positioned, the features we're building toward, and what we've shipped. Two layers:

- **Positioning** — the high-level use cases the product serves. Frames why features exist and how they compose into workflows for sponsors, CROs, recruitment teams, and commercial teams.
- **Backlog / In progress / Shipped** — discrete features moving toward delivery. Each backlog entry answers **User need / Sketch / Open questions**.

Working positioning line:

> PatientlyIQ helps sponsors optimize protocols, rescue underperforming studies, and prepare for commercialization by converting patient voice into structured evidence about burden, motivation, trust, and decision friction.

Shorter:

> PatientlyIQ shows where patient experience will create risk — and where better design, messaging, or support can improve outcomes.

---

## Positioning

Three primary use cases the product is being shaped around. Each is a workflow that composes several backlog features.

### Study protocol optimization

Used **before protocol finalization** to pressure-test whether the study design will actually work for patients.

**What PatientlyIQ analyzes**
- Visit frequency and travel burden
- Procedure burden (biopsy, imaging, lab draws)
- Screening complexity, washout concerns
- Caregiver dependency, digital-tool comfort
- Patient language about disease burden
- Motivators for participation; likely dropout points
- Trust signals around sites and sponsors

**What the output looks like.** A protocol review dashboard mapping each protocol element to a patient-friction signal, with a risk score and an optimization opportunity:

| Protocol element | Patient friction signal | Risk | Optimization opportunity |
|---|---|---|---|
| Monthly site visits | Travel, work disruption, caregiver logistics | High | Add hybrid visits or local labs |
| Invasive biopsy | Fear, pain, uncertainty | High | Add clearer education and consent support |
| Washout period | Fear of deterioration | High | Explain clinical rationale earlier |
| Long follow-up | Fatigue, unclear value | Medium | Frame as contribution to future patients |
| ePRO app | Tech confidence varies by age / caregiver role | Medium | Add caregiver proxy support |

**Core value.** Move from "the protocol is scientifically sound" to "the protocol is scientifically sound *and* patient-executable."

**Audience.** Sponsors, CROs, patient-recruitment teams, protocol-design teams.

**Features that serve this:** Idea Graph Explorer · Interview follow-up question suggestions from social-listening gaps · HCP-to-patient information gaps.

---

### Study rescue scenarios

Used **when a study is underperforming** to diagnose why patients are not enrolling, staying, or complying.

**What PatientlyIQ ingests**
- Screen failure notes, exit interviews, dropout reasons
- Site / coordinator feedback
- Patient advisory board transcripts, recruitment call transcripts
- Social listening, patient forum discussions
- Referral source feedback

**What it identifies**
- Mismatch between recruitment messaging and patient priorities
- Hidden fears around placebo, washout, side effects, randomization, or trial burden
- Journey-stage drop-offs
- Site-level communication gaps
- Misunderstood eligibility criteria
- Emotional barriers not captured in operational metrics
- Divergence between stated dropout reasons and underlying causes

**Output: a Study Rescue Friction Map.**

| Funnel stage | Problem | Patient signal | Rescue action |
|---|---|---|---|
| Referral | Patients don't understand trial relevance | "I'm not sick enough for a trial" | Reframe eligibility messaging |
| Screening | High anxiety before procedures | "I don't know what they're going to do to me" | Add plain-language screening guide |
| Consent | Low trust in sponsor motives | "I don't want to be experimented on" | Add patient advocate explainer |
| Retention | Visit burden accumulates | "It's just too many appointments" | Add concierge scheduling / travel support |
| Follow-up | Long-term value unclear | "I don't see why I still need to go" | Add milestone-based retention messaging |

**Core value.** Avoid treating enrollment problems as purely media, site, or recruitment problems when the root issue is patient burden, trust, clarity, or motivation.

**Features that serve this:** Idea Graph Explorer (cross-corpus pattern detection) · Content suggestions from patient/caregiver-mentioned information gaps · HCP-to-patient information gaps.

---

### Commercialization prep

Used **before launch** to understand how patients and caregivers will interpret the product, the category, and the treatment decision.

**What it analyzes**
- Disease burden narratives, current treatment dissatisfaction
- Switching barriers, adherence challenges
- HCP trust dynamics, caregiver influence
- Patient language around benefit/risk
- Advocacy / community narratives
- Misconceptions or information gaps
- Emotional triggers at diagnosis and treatment decisions

**What it supports**
- **Positioning** — what patients actually value; which benefits feel meaningful vs abstract; which claims need more explanation; what emotional territory the brand can credibly occupy.
- **Message development** — patient-tested language; barrier-specific message maps; segment-specific proof points; plain-language benefit/risk explanations.
- **Journey strategy** — where patients need education; where HCPs need support materials; where caregivers influence decisions; where patient services can remove friction.
- **Launch planning** — patient segment profiles, advocacy partnerships, content strategy, support-program design, competitive experience gaps.

**Example output: a commercial journey-stage map.**

| Journey stage | Patient mindset | Barrier | Commercial opportunity |
|---|---|---|---|
| Diagnosis | Overwhelmed, searching | Low disease understanding | Foundational education |
| Treatment decision | Anxious, dependent on HCP | Risk/benefit confusion | Shared decision aid |
| Access | Frustrated, passive | Insurance complexity | Patient services navigator |
| Initiation | Hopeful but cautious | Side-effect fear | Onboarding content |
| Maintenance | Fatigued, uncertain | Adherence drop-off | Motivational support |

**Core value.** Help commercial teams prepare for launch based on how patients actually think, feel, search, decide, and persist.

**Features that serve this:** Content suggestions from patient/caregiver-mentioned information gaps · HCP-to-patient information gaps · Idea Graph Explorer.

---

## Backlog

### Plutchik emotion model — single source of truth across automated surfaces

**User need.** Emotion tagging is a load-bearing layer of the analysis — it shows up in segment tags, journey-map stage summaries, executive-summary findings, and any automated copy that talks about how patients feel. The codebook ([codebook.json](src/lib/content/wctglpdemo-data/codebook.json), `emotion_tags`) is the source of truth: 8 Plutchik primaries plus a defined set of dyads (`ambivalence` = trust + disgust, `bittersweetness` = joy + sadness, `anxiety` = anticipation + fear, etc.). The human-tagging drawer enforces this vocabulary correctly with a two-circle dyad chip showing both constituent emotions. But the generation side has drifted — [synthesize-journey-map.mjs](scripts/synthesize-journey-map.mjs) is producing free-form `emotion_dyad` strings like `"hope + sadness"` that aren't in the Plutchik primary set (`hope` isn't a primary; `joy` is) *and* don't match the codebook's definition of the named dyad (e.g. ambivalence got labeled "hope + sadness" in [journey-map-ln_sle_carT_curious_patients.json](src/lib/content/corpora/ln_reddit_2026q1/artifacts/journey-map-ln_sle_carT_curious_patients.json) — should be "trust + disgust"). Reviewers can't trust the emotion read if it differs depending on which surface they look at.

**Sketch.** Two parts: lock the data, then unify the display.

**(a) Lock generation to the codebook.**
1. Have every script that emits emotion labels (currently `synthesize-journey-map.mjs`; audit for others — `propose-segment-tags.mjs` already does this correctly via JSON-schema enums) take its allowed emotion vocabulary from `codebook.json` `emotion_tags` at script start.
2. Constrain emotion outputs through the same JSON-schema enum pattern used elsewhere in the pipeline (e.g. `subtheme_id: { type: 'string', enum: subthemeIds }`). For dyads, accept the dyad id (`ambivalence`) and derive the constituent primaries from the codebook entry at consume time — don't accept free-form `"hope + sadness"` strings.
3. Re-run affected artifacts. The known broken file is the LN/SLE CAR-T journey map; any other corpus with a journey artifact needs a sweep.

**(b) Unify the dyad chip.** The two-circle dyad chip in the segment-tag drawer (right-screenshot reference) — two adjacent colored dots with the dyad name — should be the canonical visual representation everywhere emotion appears in the UI. Currently the journey-map components in [src/lib/journeymapper2/](src/lib/journeymapper2/) render their own emotion labels (e.g. `FlowSentimentHUD.svelte`, `PlutchikContent.svelte`, `FlowStepCard.svelte`). Extract the dyad chip from its current home (likely inline in [SegmentTagDrawer.svelte](src/lib/components/SegmentTagDrawer.svelte)) into a shared `EmotionDyadChip` component, then thread it through every journey-map and executive-summary surface that displays emotion.

**Open questions.**
- Beyond the two found surfaces (`synthesize-journey-map.mjs` + journeymapper2 components), where else does emotion drift live? Worth a one-shot audit pass: grep for `hope`, `dread`, `optimism`, and other non-Plutchik-primary words in generated content.
- The dyad chip in the drawer uses two adjacent colored dots — what palette? It should be the same color tokens as the primary-emotion buttons in the drawer so a reader sees instant continuity between the picker and the display.
- For automated emotion tagging in the Haiku-driven copy (executive-summary blurbs, considerations, etc.), do we constrain the model to Plutchik vocabulary in the prompt, or do we accept that prose-level emotion talk is unconstrained? Probably constrain when a structured emotion field is emitted; leave prose unconstrained but discourage non-Plutchik primaries via the system prompt.
- Audit trail when a regen changes a dyad — analysts who already starred / referenced a stage carrying the wrong dyad should see a "this label changed" note rather than a silent swap.

**Concrete bug to fix when picked up.** [synthesize-journey-map.mjs](scripts/synthesize-journey-map.mjs) → re-generate `journey-map-ln_sle_carT_curious_patients.json` with the codebook-constrained emotion enum. The `flare_or_refractory_cycle` stage should resolve `ambivalence` to "trust + disgust", not "hope + sadness".

**Serves positioning:** quality / trust foundation for all three use cases — none of the positioning surfaces can be trusted if the emotion layer disagrees with itself across views.

---

### Indication similarity & borrowed baselines

**User need.** When a team enters a new therapeutic area — or designs a protocol for an indication where primary patient research hasn't yet been fielded — they're essentially guessing at the population-level parameters that will determine whether the protocol is patient-executable: travel tolerance, washout fear, caregiver dependency, digital-tool comfort, willingness to commit to a visit schedule. Often there's no PatientlyIQ corpus for the target indication yet, but there *are* corpora for adjacent indications that share the relevant disease and patient-experience characteristics. Today that adjacency is reasoned about by hand ("LN patients probably look like IgA nephropathy + lupus SLE patients combined"). It should be an explicit, defensible borrowed baseline.

**Sketch.** A two-part feature: an indication-similarity model, and a "borrowed baseline" surface that uses it.

**(a) Indication-similarity model.** Each indication in [registries/indications.json](src/lib/content/registries/indications.json) gains a profile across dimensions that predict patient-experience similarity:
- *Disease characteristics:* severity scale, progression speed, typical age of onset, mortality risk, chronic vs acute, organ system, comorbidity load.
- *Patient outcomes / HRQOL:* fatigue burden, mobility impact, mental-health load, work-disruption norms, caregiver-dependency expectation.
- *Treatment context:* regimen intensity (daily / weekly / quarterly), invasive monitoring requirements, infusion vs oral vs self-injected, washout patterns.
- *Access context:* insurance-coverage typology, geographic concentration of specialists, socioeconomic skew of affected populations, advocacy ecosystem maturity.

Some dimensions are sourced externally (MeSH, NIH burden-of-disease stats, prevalence registries); others are *derived* from existing PatientlyIQ corpora once an indication has enough segments tagged (e.g. observed travel-burden mention rate, observed washout-fear distribution). Similarity is cosine on this profile vector.

**(b) Borrowed baseline surface.** For a target indication (especially one with thin data, like the current LN placeholder), show a panel of protocol-relevant parameters with values borrowed from the top-K most-similar indications:

| Parameter | Borrowed estimate | Confidence | Source indications |
|---|---|---|---|
| Travel tolerance (% comfortable with >1hr to site) | ~52% | Medium (3 sources agree within ±8%) | IgA nephropathy, SLE, RA |
| Washout fear intensity (mean sentiment on med-pause scenarios) | –1.4 (high concern) | High (4 sources cluster tightly) | SLE, MS, RA, IgA |
| Caregiver dependency rate | ~38% | Low (only 1 source, variance unknown) | SLE |
| Weekly visit tolerance | ~61% | Medium | RA, SLE, psoriatic arthritis |

Each row links to the source indications' actual data so the planner can audit the borrow rather than treat it as a magic number.

**Open questions.**
- The indication-profile schema is the hard part. How many dimensions, sourced from where, with what update cadence? Probably a 10–15-dim vector is enough; over-parameterizing makes similarity unstable with few real indications in the system.
- External-data ingest path — MeSH / NIH burden-of-disease / prevalence numbers need a pull mechanism. Manual seed for the first 5–10 indications is fine; automation matters at scale.
- Confidence model is critical and easy to get wrong. A borrowed baseline with three concurring sources within ±8% deserves more weight than one source. The UI must make low-confidence borrows visibly weaker — risk of the surface implying false certainty.
- Composition with the existing LN placeholder: the LN dashboard currently shows hand-authored mock numbers (LN_FINDINGS in [+page.svelte](src/routes/patientlyiq/+page.svelte)). A borrowed-baseline view would be a strictly better placeholder — replace the mock numbers with sourced estimates from RA / SLE / IgA, labelled as borrowed.
- Audit trail — when a borrowed baseline gets used in a protocol decision, the source chain (which indication contributed which estimate) should be exportable for sponsor/CRO documentation.

**Serves positioning:** **Study protocol optimization** is the headline fit (this is exactly the "is the protocol patient-executable for this population?" question, answered before any primary research exists). Also useful for **study rescue** when the original protocol assumed a population profile that the actual enrollees don't match.

---

### Sentiment & volume over time — period-on-period comparison

**Status (2026-06-02).** Promoted to an active build in the new PatientlyIQ environment as the time axis of the comparison-view family. Build plan: `PatientlyIQ/COMPARISON_BUILD_PLAN.md` (Phase C1). Prerequisite verified ready: the date field is `date_observed` (not `observed_at` as guessed below), populated on every fragment.

**User need.** Patient and HCP discourse about a treatment, mechanism, or trial concept doesn't stand still. CAR-T in 2022 (early enthusiasm, novel toxicity discourse) reads very differently from CAR-T in 2026 (more therapies launched, long-term data accumulating, off-the-shelf variants emerging). The same is true for any GLP-1 cluster across the obesity-uptake curve, or for trial-design language before vs after a notable amendment. Teams want to answer "is this shifting?" and "how fast?" — currently they can only read the *current* dashboard and rely on memory for the prior baseline.

**Sketch.** A period-comparison view that takes the existing topic/theme/subtheme axis and adds a time dimension:

1. Two (or more) configurable time windows — calendar years by default (`2022` vs `2026`), with optional custom ranges (rolling 12-month, quarter, pre-/post-an-event marker).
2. Pivot dimension dropdown: theme / subtheme / cluster / mechanism / indication / therapeutic area. Mechanism (e.g. CAR-T, GLP-1 agonist, anti-TNF) and TA cuts let users compare across diseases, not just within one.
3. Output is a small-multiples grid — one tile per top-N topic, each tile a sparkline (volume) + sentiment-lean dot, with the period-on-period delta in the title (`+18% vol · –0.4 sentiment`).
4. Clicking a tile opens an evidence drawer (reuse `FindingEvidenceDrawer` pattern) showing the contributing quotes/segments from each period, side by side.
5. A "min N per period" gate (default 5) hides tiles that would surface noisy comparisons from sparse data.
6. URL-driven state so a "CAR-T sentiment 2022 vs 2026" view is shareable as a link.

This feature is the time-axis sibling of the Idea Graph Explorer's adjacency-axis cuts — both lean on the same per-segment metadata, just rotated.

**Open questions.**
- Source date populated on every datum? Interview date is reliable; social-listening post date should be reliable; HCP corpus depends on the ingest path. Need a single `observed_at` field convention so the slicer can run uniformly across corpora.
- Mechanism axis — does the codebook / lexicon already carry a `mechanism_of_action` FK on relevant clusters? The registries file exists (`src/lib/content/registries/mechanisms_of_action.json`), but it's not clear how densely cluster-level MoA tags have been backfilled.
- Default time-bucketing — calendar year is intuitive but coarse for fast-moving treatments. Rolling 12-month might be the better default for trend reads. Calendar year may be better for "where were we then?" snapshots. Probably need both.
- Comparison cardinality — two periods is the headline use case, but 3–4 periods (sparkline trend) is often more useful for spotting inflection points. Design for ≥2 windows, with 2 as the default.
- Significance — small N + small delta = noise. Should the UI annotate tiles with a confidence indicator (e.g. faded styling when N is below 15 per period), or just rely on the min-N gate?
- Does this compose with the indication slicer in the app shell, or override it? Probably compose: time slicer + indication slicer + pivot dimension are three orthogonal axes the user can stack.

**Serves positioning:** all three — study protocol optimization (has patient burden talk shifted since last protocol version?), study rescue (did recruitment messaging change correlate with sentiment shift?), commercialization prep (track category sentiment over time pre-launch).

---

### Sentiment & volume across indications — cross-indication comparison

**Status (2026-06-02).** Promoted to an active build in the new PatientlyIQ environment as the lead axis of the comparison-view family. Build plan: `PatientlyIQ/COMPARISON_BUILD_PLAN.md` (Phase C0). Prerequisites verified: topic-axis normalization is mostly wired — the FK convention is `moa_id` (not `mechanism_id`); `drugs.json` already maps every drug → `moa_id`, and CAR-T is scoped to both LN and MS, so the headline example works against real data. Remaining: add a `Cluster.moa_id` field + backfill drug-class clusters. Multi-select stays a local `/compare` control rather than a shell change.

**User need.** Treatment mechanisms increasingly cross therapeutic-area boundaries. CAR-T is mature in oncology, novel and emotionally charged in lupus nephritis, and freshly arriving in MS. A team taking a mechanism into a new indication needs to understand how patients in the *new* community are relating to a treatment whose discourse has been shaped by a different community. The same problem shows up for GLP-1s (obesity vs T2D), anti-CD20s (MS vs lupus vs RA), and biologics generally — the question "what does this audience think of this mechanism?" is constantly being answered the slow way, by reading two corpora side by side.

**Sketch.** A cross-indication comparison view, rotated on the indication axis the same way the time-comparison view is rotated on time:

1. Pivot dimension: a mechanism, theme, subtheme, or cluster (e.g. CAR-T, washout flare risk, steroid dependency).
2. Indication slicer accepts 2+ active indications (e.g. `lupus_nephritis` vs `multiple_sclerosis`); the slicer in the app shell is currently single-select and would need to extend to multi-select for this view.
3. Output is side-by-side small multiples — one column per indication, each showing volume / sentiment lean / top participant phrases for the selected topic.
4. Volume is shown both absolute and normalized (per-100-mentions or similar) so an indication with a smaller corpus isn't dismissed.
5. Sentiment delta + a one-line analyst read per pair (Haiku-generated): "LN patients frame CAR-T through dialysis-avoidance; MS patients frame it through ability-to-function."
6. Clicking either column opens the per-indication evidence drawer for the topic.

This is the third member of a comparison-view family — alongside [Sentiment & volume over time] and [HCP-to-patient information gaps]. All three share a mechanic: pick a topic, slice by some axis, show side-by-side deltas with quote evidence. Worth designing the underlying primitives (small-multiples grid, evidence drawer, analyst-read generation) once and reusing across the three.

**Open questions.**
- Topic-axis normalization across indications. The lexicon 3.1 schema gives clusters an `indication` FK ([Interview Analysis Pipeline](memory/interview-analysis-pipeline.md) note 2026-05-22), so a "CAR-T (LN)" cluster and a "CAR-T (MS)" cluster would be parallel rows. For cross-indication comparison they need a shared join — probably a `mechanism_id` FK from cluster → `mechanisms_of_action.json` registry. Verify whether that FK exists yet and how densely it's populated.
- For non-mechanism topics (e.g. "washout flare risk"), the join axis is the subtheme — but subtheme labels can vary across indications even when conceptually identical. May need a subtheme synonym map or a cross-indication "concept" layer above the per-indication subthemes.
- Multi-select indication slicer in the app shell — currently single-select via dropdown. Comparison views need a different control (two side-by-side selects, or a "primary + comparison" pattern).
- Sample-size asymmetry will be the rule, not the exception (LN: 24 interviews vs hypothetical MS: 60+). UI needs to surface both absolute and normalized volume without confusing the reader on which they're looking at.
- Where this lives — its own route, or a `?axis=indication` toggle on a shared `/compare` route alongside the time and audience comparisons? Latter is cleaner: one comparison surface, axis-as-toggle.

**Serves positioning:** study protocol optimization (cross-indication learnings for a new program), commercialization prep (how does this audience frame the mechanism category compared to the audience the molecule's discourse was shaped in?).

---

### Idea Graph Explorer

**User need.** The dashboard today organizes patient voice as findings → themes → clusters → quotes — a hierarchical tree. That's good for "show me a finding's evidence" but bad for "show me which barriers cluster together across diseases", or "which patient-stated information gap connects to a downstream emotion across two studies". The team's natural questions are graph-shaped (what's adjacent to X?), not tree-shaped (what's underneath X?). The Phase-3 embedding corpus dump (commit `b16c2e9`, already in flight) is the substrate that lets us answer graph questions.

**Sketch.** A new route — `/patientlyiq/graph` — rendering the idea network as a force-directed cloud, with a side drawer for evidence:

1. Node = a theme, subtheme, or cluster (granularity is a top-level toggle). Node size = mention count; color = sentiment lean; node label uses the cluster's existing inflection.
2. Edge weight = a blend of (a) semantic similarity from the embedding dump (cosine), (b) co-occurrence in the same segment / interview, (c) shared participants. Lighter edges decay below a threshold so the canvas stays readable.
3. Lens controls familiar from the dashboard: filter by indication, journey stage, audience (patient / caregiver / HCP), or corpus (interviews / social listening / advisory boards).
4. Clicking a node opens a side drawer (reuse the `FindingEvidenceDrawer` pattern): supporting quotes, participants, sentiment distribution, journey-stage map, frequency trend.
5. Selecting two nodes shows the "bridge" — segments that connect both ideas, ranked by joint strength.
6. URL-driven state so reads are shareable: `?node=…&corpus=…&lens=…`.

Visual reference: Institute of Black Imagination's *AI Podcast Remixer* — node-cloud at top, cluster-with-glow + transcript-side-by-side at bottom. The atmospheric (rather than diagrammatic) treatment is the register we'd want.

**Open questions.**
- The embedding dump (`b16c2e9`) — what model, what granularity (per-segment? per-cluster?), where vectors live. Per-segment is the truthful unit but heavier; per-cluster is faster but loses nuance.
- Granularity default: theme-level (~11 nodes) is too sparse to be interesting; cluster-level (~100+) is too dense. Subtheme (~33) is probably right for a first cut, with zoom-to-cluster on click.
- Relationship to the existing dashboard's lens-toggle grid — alternative entry points to the same model, or does the graph supersede the grid? Probably alternative: the grid is good for "show me the corpus", the graph for "show me the topology".
- Scale: with 5+ indications mixed, force-directed layout gets noisy. Need a "primary indication + comparison overlay" model, not a "show everything" default.
- Cross-corpus design depends on whether HCP / social-listening / advisory-board corpora ever land in the pipeline. Start patient-interview-only; add corpora as edge colors / node tints as they arrive.

---

### Interview follow-up question suggestions from social-listening gaps

**User need.** Sponsor protocols and CRO interview guides are written before the social-listening read lands. By the time analysts are running interviews, there are usually topics patients and caregivers are mentioning loudly online that aren't in the question guide — and follow-up rounds are the chance to close that gap. Today an analyst has to spot the discrepancy by eye.

**Sketch.** A "follow-up question suggestions" surface that cross-references the active study's social-listening corpus (topic frequency, sentiment, surface-form examples) against the codebook of canonical interview questions. Surfaces:
1. Topics with N+ social mentions that don't map to any canonical question_id (or map only weakly via shared subtheme).
2. Topics where social sentiment diverges sharply from the interview-derived sentiment on the same theme — a signal the question framing may be missing something.
3. For each surfaced gap, draft 1–3 candidate follow-up questions (Haiku-generated), grounded in actual surface phrases from the social corpus so analysts can paraphrase rather than invent.

**Open questions.**
- Where does the social-listening corpus live in this project — is it the existing `keyword_usage.json` axis (currently from interviews), or do we need a separate ingest path for external SL data (Reddit threads, Inspire posts, etc.)?
- Per-study or cross-study scope? An LN follow-up-question rec probably shouldn't draw from an obesity SL corpus.
- Does this live in the analyst's pre-fielding flow (a "before you finalize the guide" review) or in-fielding (a sidebar while reviewing fresh transcripts)?

---

### Content suggestions from patient/caregiver-mentioned information gaps

**User need.** During interviews, patients and caregivers regularly volunteer "I couldn't find anything on X" or "my doctor never told me Y" — these are the raw inputs for an educational-content backlog. Today those moments get individually starred but aren't aggregated into anything actionable for the team writing content.

**Sketch.** A "stated information gaps" surface, derived from segment tags. Mechanism:
1. Pipeline step (new propose-* script): for each tagged segment, ask Haiku whether the participant is expressing an unmet information need, and if so what topic. Output keyed by `(indication, topic_id, segment_id)`.
2. Aggregate by topic; rank by frequency × emotional weight (sentiment intensity is a decent proxy for "this gap hurt to live through").
3. For each top-ranked gap, draft a one-line content brief: target audience, the question the content answers, two or three quoted patient phrases that should shape the voice.

**Open questions.**
- Is "information gap" a new annotation type on the segment, or a downstream derivative that runs on top of existing tags? (Latter is cleaner — keeps the codebook small.)
- Should content briefs be exportable to whatever the content team uses (Notion, doc, Linear), or is in-app review enough as a first pass?
- Confidence threshold — under what evidence base do we surface a gap? Risk of confidently surfacing one-off frustrations as systemic.

---

### Persona builder UI

**User need.** Today every persona is hand-authored as JSON under [src/lib/content/personas/](src/lib/content/personas/). The shape is stable enough (`PersonaFilter` with `content_source`, `indications`, `speaker_attrs`, `annotations` clauses) that authoring is just form-fill — but the bottleneck is the round-trip: an analyst with an idea for a persona has to write JSON, validate it, place it in the right directory, restart the dev server, and only then can they evaluate it against the corpus. This makes personas a *developer-mediated* concept rather than an *analyst-iterable* one, which is the wrong gradient for a tool whose whole point is rapid corpus exploration.

**Sketch.** An in-app "Build a persona" surface, anchored to the journey-workbench, that lets an analyst:

1. **Compose a persona inline.** A drawer or modal with form sections matching the schema: content_source (multi-select chips), indications (defaulted to the app's active indication), speaker_attrs (each attr as a multi-select with `allow_unknown` / `allow_inferred` toggles), annotations (has_stage / has_subtheme / has_emotion / sentiment range as multi-selects + slider). Live preview of the matched fragment count as the analyst tweaks clauses.

2. **Promote a filter combo to a persona.** When chips are active in the workbench, a "Save as persona" affordance captures the current filter state + persona base into a draft persona. Analyst names it, adds a description + signature color, then it's persisted to disk (or a draft store) and appears in the persona dropdown.

3. **Edit / fork an existing persona.** Click a persona in the dropdown → "Edit" opens the builder pre-filled. "Fork" duplicates it under a new name for variation testing.

4. **Persistence.** Drafts could be local-only (IndexedDB) for fast iteration, with an explicit "publish" step that writes to `src/lib/content/personas/<id>.json` for sharing. Or: write directly to disk via a server endpoint and rely on git for versioning. Local-first is friendlier; disk-first is simpler.

5. **Validation.** Visual feedback on impossible clauses ("0 fragments match this filter"), clause conflicts ("indication = obesity but content_source includes a corpus with no obesity fragments"), and missing required fields.

**Open questions.**
- Where does the builder live structurally — a route (`/patientlyiq/personas-builder`), a modal over the workbench, or the existing personas page (which today is per-participant)? Modal over the workbench is closest to the iterative loop.
- Disk persistence vs. local drafts. Disk-first means versioning and shareability for free (git history shows persona evolution) but couples authoring to a deploy. Local-first decouples but loses sharing.
- Naming + uniqueness. Persona ids today are convention-derived from filenames. A builder needs a slug-generator and a uniqueness check.
- Annotation predicates require the relevant dimensions to be tagged. If an analyst tries `has_subtheme: ['x']` on a corpus without theme tagging, what happens? Builder should flag "subtheme tagging not yet run for this corpus — clause will match 0 fragments."
- Multi-indication personas. The current schema allows `applicable_indications` to be multi-valued; the builder should surface this for cross-indication personas (e.g. "trial-barrier moments" applicable to both LN and mCRPC).

**Status.** Tracked but not started. Comes after the workbench polish work currently in progress (filter chips, primary drawer, indication scoping — all live as of this entry).

---

### Corpus-driven journey-stage taxonomy (per indication)

**User need.** Journey stages and steps per indication are currently authored by hand (see [src/lib/content/journeys/obesity.json](src/lib/content/journeys/obesity.json) — 8 stages × ~3 steps each, written from clinical intuition). For every new indication this is a multi-hour cold-start: read the clinical guidelines, sketch the stages, pick step names that match how patients actually talk. The Journey Workbench's beeswarm and the persona-driven journey-map artifact both rely on this taxonomy as the X-axis substrate, so any sloppiness in stage definition propagates everywhere downstream. The taxonomy should instead be **derived** from the evidence we already have for the indication.

**Sketch.** A draft-stages-from-evidence pipeline that proposes a journey taxonomy for a given indication by triangulating three input streams:

1. **The actual corpus.** Interview transcripts + tagged segments + social-listening / forum / video / paper fragments that have been ingested for the indication. Cluster on themes + temporal markers ("when I was first diagnosed", "before I started X", "after my second cycle") to surface candidate stage boundaries.
2. **World knowledge.** Disease-specific clinical guidelines, line-of-therapy conventions, FDA labels, patient-advocacy organization materials. Provides the canonical clinical arc that the corpus should map into.
3. **Adjacent datasets.** Search-volume signals from [ingest-search-queries.mjs](scripts/ingest-search-queries.mjs), HCP-side resources, registry data. Search-query phrasing is a strong tell for stage — "how is X diagnosed" sits at pre-diagnosis; "is X covered by insurance" sits at access/decision.

Output: a `journeys/<indication>.draft.json` with proposed stages + steps + descriptions, plus a confidence/coverage table mapping each stage to the corpus fragments that support it. Analyst reviews, edits, promotes to `journeys/<indication>.json`.

Mechanism (rough):
- `scripts/propose-journey-taxonomy.mjs <indication>` — gathers the three input streams, asks an LLM to draft the taxonomy with citations to the underlying evidence. Anthropic + structured output.
- Stage names should reflect **how patients describe the moment**, not how clinicians label the chapter. ("Treatment fatigue" beats "Adherence challenge phase.")
- Step names should be elicitive — they're the prompts for the journey-map artifact's per-step content pills.
- For each draft stage, surface the top-3 supporting fragments + the gap (stages with thin evidence get flagged for "need more corpus before this stage is real").

**Open questions.**
- **Where do the world-knowledge inputs live?** Probably need a per-indication "context pack" in `src/lib/content/journeys/<indication>.context.md` that an analyst maintains by hand from FDA labels, NCCN guidelines, patient-org materials. Or: pull these at script time via a knowledge-base lookup (more work, less curation burden).
- **How much should drafts reuse cross-indication patterns?** The "pre-diagnosis → diagnostic-odyssey → first-line → second-line → trial-consideration" backbone is similar across many oncology indications. A shared archetype that drafts inherit and customize would be faster than re-deriving the spine for each disease. But forces a structure that may not fit non-oncology cases (chronic immunology, behavioral health).
- **Versioning.** When a draft is promoted, what happens to fragment annotations under the prior taxonomy? Stages renamed → re-tag; stages added → re-tag the affected slice; stages removed → orphan annotations are flagged for review. Probably a `journey_schema_version` bump triggers `propose-fragment-stages.mjs --force` for the affected corpora.
- **Granularity caveat.** Steps that emerge from a thin corpus (one or two fragments) shouldn't be invented out of thin air; the script should suggest stage-level granularity by default and propose steps only when supporting evidence is plural.
- **mCRPC reference map (Patiently Studio version).** The journey example shared in conversation (Pluvicto-initiated → clinical-trial-decision-point) is a hand-authored artifact, not a registry. The taxonomy needed for that artifact should be derivable from this pipeline once an mCRPC corpus exists.

---

### HCP-to-patient information gaps

**Status (2026-06-02).** Third axis of the comparison-view family; deferred (Phase C3 in `PatientlyIQ/COMPARISON_BUILD_PLAN.md`) behind the HCP ingest path, which does not exist yet. Build the indication and time axes first; this lands when the first HCP corpus arrives via an `audience: hcp` flag on the transcript pipeline.

**User need.** A persistent strategic question across therapeutic-area work: where do HCPs and patients describe the same disease, treatment, or trial in mismatched terms? Mismatches show up as patient information gaps, HCP misperceptions about what patients understand, and treatment-decision points where the two parties are optimizing for different outcomes. Surfacing these is currently a manual side-by-side reading exercise across two separate corpora.

**Sketch.** A two-corpus comparison surface that joins HCP-side and patient-side data on a shared topic axis:
1. Requires HCP-side inputs: HCP social-listening corpus + HCP interview transcripts run through the same pipeline (parse → segment → tag) as patient data.
2. Map both corpora to the shared codebook themes/subthemes (codebook already supports multi-audience tagging in principle; this would be the first audience axis to exercise it).
3. For each theme, compute:
   - Patient-side coverage (frequency, sentiment lean, top phrases) — what patients are saying.
   - HCP-side coverage on the same theme — what HCPs are saying.
   - Divergence metrics: theme appears prominently in one corpus but not the other; sentiment direction conflicts; or both sides talk about it but using non-overlapping vocabulary.
4. Surface top-N divergent themes with side-by-side quote pulls and a one-paragraph analyst read (Haiku-generated) on what the gap looks like in practice.

**Open questions.**
- HCP ingest path doesn't exist yet — this depends on either (a) the existing transcript pipeline accepting HCP transcripts with an `audience: hcp` flag, or (b) a parallel pipeline. (a) seems strictly better.
- Codebook implication: do we need separate HCP/patient lexicons, or one with audience-scoped clusters? (Decision likely deferred until we have the first HCP corpus to look at.)
- Cross-audience sentiment isn't straightforward — an HCP saying "low concern" about a side effect isn't the inverse of a patient saying "high concern". Need a richer joining model than just sign-of-sentiment.

---

### Content planner — wireframe preview pane

**User need.** The content-suggestions surface (above) produces one-line briefs: target audience, the question the piece answers, two or three quoted patient phrases that should shape the voice. The brief tells you what to write but doesn't make the artifact feel real — analysts and content leads have to imagine what the page actually looks like before they can sanity-check tone, length, IA, and CTA placement. A wireframe preview alongside each brief closes that gap and turns the planner from a list view into a layout-aware review surface.

**Sketch.** Two-pane layout on the content-planner route. Left pane keeps the brief list. Right pane renders a wireframe mockup of the suggested piece inside a browser-chrome frame — header / hero / one or two body sections / sidebar or CTA region. The mockup is data-driven from the brief: the H1 pulls from the brief's question, the hero pulls from the strongest patient phrase, body section headers come from the supporting subthemes, the CTA reflects the brief's recommended action (registry signup vs trial screener vs "talk to your rheumatologist"). Switching selected brief on the left re-renders the right.

Page archetype is part of the brief, not the renderer — symptom-cluster landing, trial-eligibility explainer, registry signup, "what to expect" walkthrough, mechanism-of-action explainer all have distinct skeletons. Renderer picks the matching template.

**Open questions.**
- Fidelity. Lo-fi (rectangles + lorem) vs. styled HTML close to what would actually ship. Lo-fi probably better — keeps focus on structure and copy hierarchy, not visual design, and avoids implying the wireframe is a delivered asset.
- Where this lives — extends the "Content suggestions from patient/caregiver-mentioned information gaps" surface above, or a sibling route. Probably extends the same surface; brief and preview are the same artifact at two fidelities.
- Does the wireframe accept author edits in place (drag a quote in, swap a CTA), or is it read-only? Read-only for v1 — the brief is the authoring surface, the wireframe is the preview.
- SEM/SEO landing pages specifically have a different skeleton than informational content (above-the-fold conversion CTA, no nav, focused scan path). Worth a dedicated archetype if the planner ends up serving recruitment-trial work, not just commercialization.

**Serves positioning:** commercialization prep (the most direct fit — content planning before launch). Also study rescue when the rescue action is "produce X piece of content"; seeing the wireframe accelerates brief-to-shipped.

---

### Search-journey layer on persona journeymaps

**User need.** Persona journeymaps today show clinical/emotional stages (flare → diagnosis → first-line → trial consideration). Missing from the stack: what the patient is actually typing into search at each stage. A recent Otsuka SEM proposal for the PKU / Sjögren's / IgAN programs lays out the structure concretely — a PKU patient at "diet fatigue" stage searches differently from a PKU patient evaluating PheORD at trial-eval stage, and the SEM/SEO architecture is driven by that stage-by-stage query register. Today that lives in standalone proposal MDs (see attached working doc); it should live on the journey-map itself, where the stage context already is.

**Sketch.** Add a "search behavior" block to the per-stage content of every journey-map artifact. Per stage, three sub-blocks mirroring the attached SEM proposal MD structure:

1. **Representative queries** — 5–8 queries patients in this stage are likely to type, grouped by intent (symptom-search vs treatment-seeking vs trial-evaluation vs caregiver). Sourced from the existing search-query ingest pipeline ([scripts/ingest-search-queries.mjs](scripts/ingest-search-queries.mjs)) where data exists; proposed by Haiku from the stage's tagged fragments where it doesn't (labelled "proposed" so the reader knows it's not observed traffic).
2. **Information need** — the gap the query is trying to fill (validation, mechanism explanation, logistics, reassurance).
3. **Conversion / channel implication** — SEO content vs aggressive SEM vs registry capture vs trial-screener landing. Maps stage intent to the SEM/SEO category architecture so a SEM team or agency can read straight from the journey-map.

Visually, lives as a collapsible "Search behavior" block within each existing stage card. Caregiver track (where applicable) gets a parallel sub-block, not its own stage row — matching how the SEM proposal MD handles it.

A flat "search journey" export view (the attached MD format) makes the same data legible to sponsors and SEM agencies who want a recruitment-oriented read without the full journey-map artifact.

**Open questions.**
- Data source per indication. Search-query ingest exists for some; for those without it, Haiku-proposed queries grounded in stage fragments are the fallback. Confidence treatment matters — observed queries should look different from proposed ones in the UI.
- Caregiver parallel — the SEM proposal handles caregivers as a parallel track within each indication's stage breakdown. Our journey-maps are persona-scoped, so a caregiver search-journey is its own persona artifact, with cross-links to the patient persona at each stage.
- Competitive context (the SEM proposal's "share of voice" sections — BioMarin / PTC for PKU, Novartis for Sjögren's, the five-drug IgAN landscape) is out of scope for the journey-map itself, but the same source data could feed an adjacent "competitive landscape" view per indication. Note as adjacent; don't bundle.
- Stage granularity match. The SEM proposal MD uses 3–4 funnel stages per indication (e.g. PKU: "living with → treatment seeking → trial evaluation"); our journey-map taxonomies are usually finer-grained. Either the search-behavior block rolls up across multiple finer stages, or fine stages share a search-behavior block. Probably the latter — annotate which stages share a SEM register.
- Compliance / regulatory review boundary on representative queries — generated queries that mention specific drug names or competitor brands need review before they ship in any sponsor-facing export.

**Serves positioning:** commercialization prep (the most direct fit — SEM/SEO architecture for launch); study protocol optimization (recruitment site IA derives from trial-seeking query patterns); study rescue (mismatched recruitment messaging is often visible as a query-vs-content gap that this surface makes obvious).

---

## In progress

_(empty)_

---

## Shipped

### Generative dashboard copy (Haiku 4.5)

Per-indication analyst-voice copy on the executive-summary dashboard. Overview blurb plus per-finding lede / analysis / considerations, layered over the runtime template strings (UI falls back when an indication hasn't been generated for). Inline `[term](ref:KIND:ID)` syntax links domain phrases to clickable navigation. See [scripts/propose-dashboard-blurbs.mjs](scripts/propose-dashboard-blurbs.mjs) and [src/lib/components/exec-summary/BlurbText.svelte](src/lib/components/exec-summary/BlurbText.svelte).
