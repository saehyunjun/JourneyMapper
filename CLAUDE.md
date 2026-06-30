# CLAUDE.md

Auto-loaded into every Claude Code session in this repo. Treat the rules below and the docs this points to as load-bearing — read them before making non-trivial changes.

## What this project is

JourneyMapper is a SvelteKit app for qualitative patient-insights work. The primary UI lives under `/patientlyiq` (the "PatientlyIQ lab book") and covers executive summaries, journey maps, persona workbenches, corpus annotation, and clinical-trial integration. Indications are pluggable — obesity, lupus nephritis, and multiple sclerosis are the current corpora.

---

## Hard rules

Non-negotiable unless Aaron explicitly says otherwise. Each rule lives in three places: in the auto-memory at `~/.claude/projects/-Users-aaronjun-JourneyMapper/memory/`, in this file (visible to humans and any Claude session), and where the rule bites in code. Update all three when a rule changes.

### 1. No italic type

Never use italics in UI, code, or generated copy unless Aaron explicitly says so. Applies to body copy, callouts, pull quotes, captions, narrative blocks — everywhere.

**Why:** Strong personal preference. Came up after italic-feeling treatments crept into the bento spike; Aaron called it a blanket rule, not a one-off correction.

**How to apply:**

- Never write `font-style: italic`, `<em>`, or `<i>` in any component CSS or markup
- Never use `*foo*` or `_foo_` in markdown copy that renders to UI — both produce italics
- For pull quotes, get visual distinction from other levers: serif family (Spectral is in the stack), oversized opening quote glyph, indent, tinted background, weight bump, generous line-height
- For emphasis in body copy, use font-weight or color, not italics
- For figure / caption text, use color or font-family shift, not italics
- Scripts that generate copy (the `propose-*.mjs` family) and any LLM-generated text should not emit italic markdown; strip or rewrite at the rendering boundary if needed
- Watch out for global utility classes in `app.css` — `.caption`, `.cite`, `.footer`, and others ship with `font-style: italic` baked in. Scoped Svelte class names can collide with these by accident. The `bento-board` defends with a hammer rule (`.bento-board :global(*) { font-style: normal }`); other subtrees should do the same when they hit the same collision

**Exception:** only when Aaron explicitly types "italic" or "italicize" in the request.

### 2. Reuse before creating

Before adding a new component, audit the codebase for an existing one that already fills the role. Reuse, adapt with new props, or ask — never silently fork.

**Why:** Parallel components create drift. Two competing "quote cards" means two style sources of truth, two places to update copy, double the future maintenance.

**How to apply:**

1. **Audit first.** Grep the repo for the role — `grep -rn QuoteCard`, `grep -rn WaffleChart`, `grep -rn StackedCards`, etc. Read what is there
2. **Reuse if it fits.** Import the existing component directly. Pass new props if needed
3. **Adapt if it does not quite fit.** Add variants, sizes, or props to the existing component. Keep it the standard
4. **Ask before forking.** If reuse and adaptation both feel wrong, surface the question — "the existing X uses pattern A but the new context needs B; should I adapt or fork?" — and let Aaron decide

**Why this rule exists in practice:** during the bento spike, a forked `QuoteCard.svelte` and `ChartCard.svelte` were created that duplicated `KeyQuoteCard` and `BarX` / `SentimentBar` patterns. They were deleted; the existing components were adapted instead.

### 3. No tautological drivers

A keyword cluster cannot be a "driver" of the theme it is. Filter cluster-as-driver lists app-wide to exclude tautological self-references at the analysis layer.

**Why:** Logically meaningless (the theme drives itself by definition) and visually confusing — readers see "Clinical trial" listed under "Drivers of negative trial sentiment" and assume it is a finding when it is just a self-reference.

**The principle:** a cluster is not a driver of its own parent theme. The relation is part-of, not drives.

**How to apply, three layers (defense in depth):**

1. **At the analysis layer (the broad win).** In [executive-summary.ts](src/lib/content/wctglpdemo-data/executive-summary.ts) and any equivalent in fragment-based analyses, after building cluster rows scoped by theme T, drop rows whose `cluster.label.toLowerCase()` matches T's display name. Pattern:

   ```ts
   const SELF_DRIVER_TAUTOLOGIES: Record<string, string[]> = {
     clinical_trials: ['clinical trial', 'clinical trials'],
     treatment: ['treatment'],
     condition_specific: ['condition specific', 'condition-specific']
   };
   function dropSelfDrivers(rows, scopeTheme) { … }
   ```

2. **At the lexicon layer (edge cases).** Add an opt-out flag on the Cluster type: `excluded_from_self_drivers?: boolean`. Generic anchor clusters set this true. The analysis-layer filter reads it as an additional reason to exclude. Useful when a cluster label is not a literal match for the theme but is still tautological

3. **At the LLM-prompt layer.** Add one line to the `propose-dashboard-blurbs.mjs` SYSTEM_PROMPT: "Never name a cluster as a driver if its label is the same as the theme it sits under — that is a self-reference, not a driver"

**Do not apply this when:** the cluster legitimately drills down into the theme (e.g. a `trial_barriers` subtheme as driver of a `clinical_trials`-themed finding — that is a real drill-down, not a self-reference). The filter is specifically about labels that ARE the theme, not about clusters that descend from it.

### 4. No side-border rounded rects

Never combine a rounded-rect card with a single-side accent border/rail (`border-left`, `border-right`, `border-top`, or `border-bottom` as a colored stripe on an otherwise unbordered card). The rounded corners imply a soft, unified container; the hard side stripe implies a bracketed/highlighted block. The corner where they meet always looks wrong — the stripe either butts into a curve or gets clipped.

**Why:** Strong aesthetic preference. Flagged on a `QuotePullBlock` light variant whose pink left rail collided with the card's rounded corners.

**How to apply:**

- Never write `border-left: Npx solid …`, `border-right: …`, `border-top: …`, or `border-bottom: …` on an element that also has a non-zero `border-radius`
- Applies across the bento components, the key-findings block library, `KeyQuoteCard` / `AppCard` variants, and anything new
- For sentiment/category/theme accent, get color another way: tinted full background, colored chip inside the card, colored full-perimeter border, or a colored glyph / rule that sits well inside the padding (not touching the card edge)
- **Exception:** square-cornered containers (`border-radius: 0`) can still take a single-side rail — the rule is specifically about the rounded + side-rail collision. Journey-map row strips and table cells with left rails are fine because they aren't rounded rects

**Known violations to fix when in the area:** [QuotePullBlock.svelte:197-199](src/lib/components/key-findings/blocks/QuotePullBlock.svelte#L197-L199), [RichTextBlock.svelte:232](src/lib/components/key-findings/blocks/RichTextBlock.svelte#L232), preview swatches in [BlockConfigDrawer.svelte](src/lib/components/key-findings/BlockConfigDrawer.svelte) (~lines 541, 546, 620). Check [ChartCard.svelte:234](src/lib/components/bento/ChartCard.svelte#L234) and [ListCard.svelte:239](src/lib/components/bento/ListCard.svelte#L239) — fine if the border-left is on a square inner divider, not fine if it's on a rounded outer card.

---

## Preflight before building visuals

The operational protocol for Hard rule #2. Before writing any markup or CSS for a new visual surface (drawer, card, chart, layout), send a short **preflight message** and wait for sign-off. Do not start coding speculatively.

**Preflight format:**

- **Role** — one line: "I need a way to show X"
- **Reuse** — existing components (with paths) that could fill the role; pick one
- **Utilities** — `app.css` classes to use (`.t-h1`–`.t-h4`, `.t-body`, `.t-body-sm`, `.t-mono-label`, etc.; see [DESIGN_SYSTEM_AUDIT.md](DESIGN_SYSTEM_AUDIT.md) §2.1). Flag any that violate a hard rule — e.g. `.t-caption` ships with `font-style: italic` and must not be used
- **New** — what (if anything) still needs to be built; if nothing, say so explicitly
- **Sketch** — 3–4 lines of pseudo-markup for the layout
- **Open questions** — anything Aaron needs to decide before code

**Preflight is required (not optional) if any of these is true:**

- A new component file would be created
- More than ~10 lines of CSS not composed from `app.css` utilities would be added
- Two existing components could plausibly fill the role
- The ask is "make a chart that…" or "make a drawer that…" without a reference
- A hard rule would need to be deviated from for any reason

**Charts specifically — always ask for a reference first.** Before any chart-shaped work, ask: do you have a screenshot, sketch, or existing chart to model on? Which lineage — `BubbleChart` / `Radar` / `SentimentBar` / `BarX` / `WaffleChart`? What's the encoding (length, area, color, position)? Data shape? If no reference is given, propose 2–3 ASCII / Plan-mode options before building.

**Reference material from Aaron — rough priority:** screenshot + one-line intent → pointer to an existing component to model on → CSS / SVG / Svelte snippet → data shape (5-line JSON sample).

---

## Active work

The current focus is a **bento redesign of the executive summary**, prototyped at `/patientlyiq/bento-spike`. See [docs/BENTO_HANDOFF.md](docs/BENTO_HANDOFF.md) for layout conventions (1/3 and 2/3 width presets, size scale, expansion-archive mode, overflow-for-visual-energy rules), decisions Aaron has made, and the priority list for what comes next.

---

## Project standards — reach for these first

| Need | Reach for |
|---|---|
| Quote display | [KeyQuoteCard.svelte](src/lib/components/KeyQuoteCard.svelte) (variants: `default` \| `compact`) |
| Card chrome | [AppCard.svelte](src/lib/components/ui/app-card/AppCard.svelte) (variants: `default` \| `quote` \| `fragment` \| `finding` \| `metric`) — new card kinds should add a variant here, not build standalone |
| Stacked / fanned cards | [StackedCards.svelte](src/lib/components/StackedCards.svelte) (accepts `behindRot` / `behindTx` / `behindTy` for spread control) |
| Proportional bubbles | [BubbleChart.svelte](src/lib/components/BubbleChart.svelte) (variants: `horizontal` \| `vertical` \| `cluster` \| `center` \| `bottom-row`) |
| Sentiment waffle row | [SentimentBar.svelte](src/lib/components/SentimentBar.svelte) |
| Bento layout primitives | [src/lib/components/bento/](src/lib/components/bento/) — `BentoBoard`, `BentoCell`, `StatCard`, `ChartCard`, `NarrativeCard`, `ListCard` |
| Interview-analysis data | [src/lib/content/wctglpdemo-data/](src/lib/content/wctglpdemo-data/) — `executive-summary.ts`, `analysis.ts`, `dashboard-blurbs.ts` |
| Fragment-corpus data | [src/lib/content/corpora/](src/lib/content/corpora/) — partitioned by content_source per corpus_id |

---

## Reference docs

- [docs/BENTO_HANDOFF.md](docs/BENTO_HANDOFF.md) — current state of the exec-summary redesign
- [DESIGN_SYSTEM_AUDIT.md](DESIGN_SYSTEM_AUDIT.md) and [DESIGN_SYSTEM_PROGRESS.md](DESIGN_SYSTEM_PROGRESS.md) — design system migration progress (separate effort from the bento spike)
- [WORKBENCH_PLAN.md](WORKBENCH_PLAN.md) — persona workbench plan
- [feature_backlog.md](feature_backlog.md) — open features
- [interview_analysis_system_plan.md](interview_analysis_system_plan.md) — interview analysis pipeline design

---

## Working process

- **For UI changes, verify in a real browser** via the `/verify` skill or a Playwright probe before reporting the task done. Type-checks and SSR-200 responses are necessary but not sufficient — pixels and interaction matter
- **For new conventions Aaron flags**, mirror into both the auto-memory at `~/.claude/projects/-Users-aaronjun-JourneyMapper/memory/` AND this file (`CLAUDE.md`). Memory loads for me; CLAUDE.md loads for humans, reviewers, and other Claude sessions
- **Aaron processes diffs and screenshots**, not paragraphs. Keep responses brief. Lead with the diff, end with one or two flagged concerns or open decisions
- **Spike then commit.** For non-trivial UI work, build on a throwaway route first (the bento spike pattern), then propose folding into the canonical page

---

## Scripts environment gotcha

The `scripts/propose-*.mjs` family uses `process.loadEnvFile('.env')` to pick up `ANTHROPIC_API_KEY`. Node's `loadEnvFile` does NOT overwrite vars already set in the process environment. If a shell-exported `ANTHROPIC_API_KEY` shadows the project `.env`, the script gets a 401 even when `.env` is correct. Fix: run with `env -u ANTHROPIC_API_KEY node scripts/...`.
