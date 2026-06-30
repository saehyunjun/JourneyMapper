# Bento exec-summary spike — handoff

A throwaway spike at `/patientlyiq/bento-spike` exploring a redesign of the executive summary page as a bento-card layout. The dot-grid corpus visual moves to story mode; findings become the page. This doc lets a new chat pick up without re-establishing context.

---

## Mission

Replace the current `/patientlyiq` dashboard (left rail of lens tiles, center dot grid, right detail pane) with a bento composition where:

- Findings are the spatial primary, not the grid
- Each card carries a strong headline visible at natural size, with explainer text revealed on expansion (currently archived)
- Card kinds vary in silhouette (text-led, chart-led, quote-led, list-led) so the rhythm reads editorial rather than mechanical
- A shared `size` / `width` vocabulary lets every page reuse the same components

Long-term goal stated by Aaron: build a system of cards and child visuals that compose across the whole app, not just one screen.

---

## Status: spike up and stable

Route: `/patientlyiq/bento-spike` (dev server: `npm run dev`, port whatever vite picks — most recently 5174). SSR clean, 10 cells, 0 italics inside the board, 0 runtime errors.

Layout in current state (12-col grid, each row sums to 12):

```
Row 1-3:   Hero stat 47% (8)              | Bridge "Throughline" (4)
Row 4-6:   Lead chart 23 neg (8)          | Quote teaser (4, h=2) ▸ Finding B (4, h=1)
Row 7-8:   Ranked list (8)                | gap (4)
Row 9-10:  Corpus pull quote (8)          | gap (4)
Row 11-14: Three-quote stack (8)          | Bubble `center` (4)
Row 15-18: Bottom-row bubbles (8)         | gap (4)
```

---

## The bento system

Lives in `src/lib/components/bento/`. Five files:

| File | Role |
|---|---|
| `types.ts` | `BentoSize`, `CellSpan`, `BentoContext`, `WidthPreset` |
| `BentoBoard.svelte` | Grid container. Owns expansion state (currently archived via `staticBoard={true}`). Italic firewall. View Transitions wrapping. |
| `BentoCell.svelte` | Wraps a child snippet. Reads context for size and static mode. `width` + `height` shorthand for grid placement. Uses `div role="button"` not `button` to avoid nested-button hydration bugs with `KeyQuoteCard`. |
| `StatCard.svelte` | Figure + label + optional caption + split bar + subStats. Size variants documented in the file's top comment. |
| `ChartCard.svelte` | Eyebrow + figure + caption + `SentimentBar` rows. At lg: + interpretation column + top-3 contributors as a `StackedCards` fan. |
| `NarrativeCard.svelte` | Editorial callout. `headline` always visible. At lg: corner-text layout (top-left + bottom-left) with `points: 3` rendered as a spread `StackedCards` deck filling the right. |
| `ListCard.svelte` | Ranked rows with per-row bars, vertical or horizontal orientation. |

### Two orthogonal axes

- `size: 'xs' | 'sm' | 'md' | 'lg' | 'xl'` — content density. Each component owns its own variant table (what shows at each step). Expansion is capped at lg per Aaron's call.
- `width: '1/3' | '2/3' | 'full'` — grid placement. Maps to 4 / 8 / 12 cols. `width="2/3"` is the cap for lg cards; `full` is reserved for hero bands and discouraged.

`height` is a row-span shorthand. Falls back to `span.row` if not set.

### Static mode

`<BentoBoard staticBoard={true}>` disables expansion. The expand/collapse code is preserved verbatim — flip the prop to restore. Cells render without `role="button"` and without cursor pointer when static.

---

## What was reused vs adapted vs created

This is the order of operations (hard rule, see `memory/reuse-before-creating.md`):

**Reused as-is:**
- `SentimentBar.svelte` — sentiment-waffle row primitive, used inside `ChartCard`
- `KeyQuoteCard.svelte` (default variant) — the standard quote card

**Adapted (added props/variants to existing components, did NOT fork):**
- `KeyQuoteCard.svelte` — added `variant: 'default' | 'compact'`. Compact is the testimonial-style card from Aaron's mockup: flat pale-blue tint, heavy `"` glyph top-left, bold sans body, name + role footer, avatar bottom-right
- `StackedCards.svelte` — added `behindRot`, `behindTx`, `behindTy` array props for custom fan spread (defaults preserved)
- `BubbleChart.svelte` — added `bottom-row` variant for baseline-aligned bubbles in the bottom half of a lg card. Hero radius capped at `innerH * 0.48` so the largest bubble fits the canvas
- `BubbleChart.svelte` — also uses existing `center` variant in the spike for the proportional-share aesthetic

**Created (bento-local, no exact prior equivalent found):**
- `BentoBoard`, `BentoCell`, `StatCard`, `ChartCard`, `NarrativeCard`, `ListCard`

Open question: `ChartCard`, `NarrativeCard`, `ListCard` are layout wrappers around existing primitives. Aaron may want to fold them into `AppCard` + inline content. Worth confirming.

---

## Working process / hard rules

These are saved as memories at `~/.claude/projects/-Users-aaronjun-JourneyMapper/memory/`. A new chat will see them automatically via the memory index.

| Memory | Rule |
|---|---|
| `no-italics.md` | Never use italic type in UI/code/copy unless Aaron explicitly says so. Distinguish quotes via serif family, weight, indent, or oversized glyphs — not italics. The `bento-board` has a hammer rule (`:global(*) { font-style: normal }`) because `app.css` ships a global `.caption` utility with `font-style: italic` that cascades into scoped components |
| `reuse-before-creating.md` | Before creating a new component, grep the repo for one that already serves the role. Reuse, adapt, or ask — never silently fork. `KeyQuoteCard`, `StackedCards`, `BubbleChart`, `SentimentBar` are the project standards for their roles |
| `no-tautological-drivers.md` | A cluster can't be a "driver" of the theme it is. Filter out tautological self-references at the analysis layer (`executive-summary.ts`) — was applied via `dropSelfDrivers()`; check current state of that file for whether it's still in place |

Other process patterns established:

- **Verify in a real browser via the `/verify` skill or a Playwright probe**, not just `svelte-check`. UI changes need pixel-level confirmation. The `verify` skill is the right tool when iterating on visual results
- **Iterate on a throwaway route first**, then propose folding into the canonical page — the bento spike pattern
- **Spike then ask** — when a layout convention or visual decision needs Aaron's input, build a working artifact and ask, don't decide silently
- **Brief, terse responses** — Aaron processes diffs and screenshots, not paragraphs

---

## Concrete decisions Aaron has made

In rough chronological order, with the directive paraphrased:

1. **Move the dot grid to story mode**, redesign the dashboard around findings
2. **Use a shared `size` scale across components** so consumers don't branch on size; each component owns its variant table
3. **Cap expansion at `lg`** — `xl` felt overwhelming
4. **"Throughline"-style editorial callouts** belong in a main card with a headline that reads at natural size; the explainer comes on expand
5. **Tautological cluster labels** (like "Clinical trial" listed as driver of clinical-trial sentiment) must be filtered at the analysis layer so every consumer benefits
6. **Top-3 elements use a fanned card stack** — found `StackedCards.svelte` already does this; reuse, don't fork
7. **Card stacks only at lg.** At lg with a stack: text in top-left + bottom-left corners, stack dominates the right
8. **Stacks should overflow the card edges** for visual energy. Removed `overflow: hidden` from `stack-area` / `narrative-card` / `test-card`; cap stack-frame size with `max-width` instead so the spill is intentional
9. **Compact `KeyQuoteCard` variant** for stack contexts — small font, dense, name + role + avatar
10. **`bottom-row` `BubbleChart` variant** — bubbles arrayed along the baseline of a lg card's bottom half
11. **Archive expansion for now** via `staticBoard={true}`; click does nothing
12. **`lg` cards take 2/3 width** (8 cols); new smaller class is 1/3 width (4 cols); `full` is reserved for hero bands

---

## What's likely next

In rough priority order:

1. **Decide the right-column gaps.** Rows 7-8, 9-10, 15-18 have empty 1/3 zones. Either fill them with small stat / quote / narrative cards, OR confirm the gaps are breathing-room and that's the intent
2. **Fold the spike into the real route.** Replace the dot-grid view at `/patientlyiq` with this bento. The dot grid moves to `?view=story` (Story mode), where the corpus is the protagonist
3. **Illustration slots on cards.** Aaron flagged that themes / subthemes will eventually get small SVG illustrations. Add a `Snippet` slot prop on `StatCard` / `NarrativeCard` / `ChartCard` that renders to the right of the figure column. Empty by default
4. **Consolidate or accept the bento-local components.** Confirm with Aaron: is `ChartCard` a useful layout primitive, or should it be inlined? Same question for `NarrativeCard` and `ListCard`
5. **Re-evaluate the size scale.** xs/sm/md/lg/xl is five steps; xs is rarely distinct from sm. May collapse to four steps (`compact | default | comfortable | hero`)
6. **Extend the convention to other pages.** The persona workbench, journey-map, key findings page — all could adopt the same bento language. The `BentoBoard` and `width` preset are designed to support this
7. **Restore (or kill) expansion code.** Currently archived behind `staticBoard={true}`. If Aaron wants drill-in interactivity back, flip the flag. If not, prune the expand/collapse code paths from `BentoBoard` / `BentoCell`
8. **Verify the MS indication still flows.** Earlier in the conversation Aaron had MS data tested through the `propose-dashboard-blurbs.mjs` pipeline and the original `/patientlyiq` route. The bento spike currently shows whatever indication is active; confirm the MS branch still renders correctly after any executive-summary.ts changes

---

## How to verify

```bash
# In project root:
npm run dev
# Note the port (vite picks 5173, falls back to 5174 etc).

# Open the spike:
open "http://localhost:5174/patientlyiq/bento-spike"

# To programmatically probe the layout (Playwright):
node - <<'EOF'
import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await (await b.newContext()).newPage();
await p.goto('http://localhost:5174/patientlyiq/bento-spike', { waitUntil: 'networkidle' });
const cells = await p.locator('.bento-cell').count();
console.log({ cells });
await b.close();
EOF
```

For visual confirmation, the `verify` skill (`/verify ...`) drives Chromium and takes screenshots.

---

## File map

```
src/
  lib/
    components/
      bento/                          # NEW — the bento system
        types.ts
        BentoBoard.svelte
        BentoCell.svelte
        StatCard.svelte
        ChartCard.svelte
        NarrativeCard.svelte
        ListCard.svelte
      KeyQuoteCard.svelte             # ADAPTED — variant: default | compact
      StackedCards.svelte             # ADAPTED — behindRot/Tx/Ty props
      BubbleChart.svelte              # ADAPTED — added 'bottom-row' variant
      SentimentBar.svelte             # used as-is
      ui/app-card/AppCard.svelte      # variants: default | quote | fragment | finding | metric
    content/wctglpdemo-data/
      executive-summary.ts            # may have dropSelfDrivers() filter — check current state
  routes/
    patientlyiq/
      bento-spike/+page.svelte        # NEW — the spike route
      +page.svelte                    # the current/canonical exec summary; bento eventually replaces this
      +layout.svelte                  # WctglpTopbar + sidebar
      +layout.server.ts               # indication slice loader
```

Memories:

```
~/.claude/projects/-Users-aaronjun-JourneyMapper/memory/
  MEMORY.md                            # index
  no-italics.md
  reuse-before-creating.md
  no-tautological-drivers.md
  # plus existing project memories
```

---

## One-paragraph briefing for a new chat

"We're redesigning the executive summary at `/patientlyiq` as a bento layout, prototyped at `/patientlyiq/bento-spike`. The bento system lives at `src/lib/components/bento/`, follows two orthogonal axes (`size` for content density, `width` for grid placement, with 1/3 / 2/3 / full presets), and reuses project standards (`KeyQuoteCard`, `StackedCards`, `BubbleChart`, `SentimentBar`) — adapt them, don't fork. Expansion is archived via `staticBoard={true}`; click does nothing. No italics, ever. Card stacks only at lg, text in corners, overflow visible for visual energy. The spike is up and rendering 10 cells across an 8+4 / 4+4 / 8 grid; intentional gaps remain on the right at rows 7-10 and 15-18 that need filling or confirming. Next likely steps: fold the spike into the real route, add illustration slots, decide on the bento-local components, and migrate the dot grid to story mode."
