# Research Ireland palette — migration mapping

Source palette (from the brand sheet):

| Name | Hex | Role |
|---|---|---|
| Pale Lavender | `#DCD0FF` | Primary light surface |
| Bush Green | `#112B19` | Primary dark / body text |
| Scampi | `#7169B2` | Secondary purple |
| Granny Smith | `#9CD696` | Secondary mint |
| Fuel Yellow | `#ECAF30` | Accent warm |
| Santa Fe | `#C47965` | Accent clay |
| Port Gore | `#2A2457` | Alt dark navy |
| Zuccini | `#307159` | Alt deep green |
| Christine | `#E2740E` | Alert orange |
| Brown Derby | `#472616` | Alt warm dark |

Approved accessible pairings (from the sheet, ordered by contrast ratio):

```
Pale Lavender × Bush Green   10.48:1   AA + AAA   ← primary
Pale Lavender × Port Gore     9.74:1   AA + AAA
Pale Lavender × Brown Derby   9.32:1   AA + AAA
Granny Smith × Bush Green     9.01:1   AA + AAA
Granny Smith × Port Gore      8.37:1   AA + AAA
Fuel Yellow × Bush Green      7.76:1   AA + AAA
Fuel Yellow × Brown Derby     6.89:1   AA + AAA (large only)
Santa Fe × Bush Green         4.53:1   AA + AAA (large only)
```

The palette has **no neutral gray**. Every replacement decision for a current gray token has to commit to either tinting Bush Green or introducing a non-brand neutral. Flagged inline.

---

## Audit summary

Two parallel color systems coexist in `src/app.css`:

1. **Brand tokens** (`:root` lines 28–55) — ~20 named hex tokens consumed by 200+ components. Heaviest hitters: `--ink` (37 files), `--paper` (26), `--gray` (21), `--orange` / `--darkgrayblue` / `--grayblue` (18 each).
2. **shadcn-svelte oklch tokens** (`:root` lines 108–141) — generic UI primitives (`--background`, `--primary`, `--card`, `--accent`, `--chart-1..5`, `--sidebar*`). Anchored to a generic slate/blue theme.

Plus call-site debt:

- **`#312f28` literal** (= `--ink`) appears **101 times** in component CSS. Top priority for tokenization regardless of palette swap.
- **`#CC6324` / `#cc6324`** (= `--orange`) ~20 times.
- **`#599077` / `#7DBFA7` / `#6a99c2` / `#446079`** all 10–20 occurrences each — same kind of duplication.
- **Tailwind slate scale** (`#64748b`, `#94a3b8`, `#cbd5e1`, `#e2e8f0`, `#6b7280`) ~110 combined occurrences — likely from utility classes (`text-slate-500`, etc.); ungroupable without inspecting each.
- **No `text-[#...]` arbitrary-value Tailwind utilities** — good.
- **Sentiment colors are scattered**: per-file constants `POSITIVE = '#34d399' / NEUTRAL = '#9ca3af' / NEGATIVE = '#fb7185'` (mint/gray/coral) and per-component pill colors (`#5B8A72`, `#C0392B`, `#28b798`). No central sentiment token.

---

## Proposed brand-token mapping

Direct 1:1 swaps in `src/app.css :root`. Touch nothing else in this round — every consumer of `var(--ink)`, etc., picks up the new color automatically.

| Current | Hex now | → New | New hex | Notes |
|---|---|---|---|---|
| `--ink` | `#312F28` | Bush Green | `#112B19` | Body text everywhere. AA on Pale Lavender (10.48:1). |
| `--gray` | `#707070` | **Bush Green @ 60%** | `color-mix(in srgb, var(--ink) 60%, var(--paper))` | **DECISION**: no neutral in palette. Tint Bush Green over Pale Lavender. Alt: introduce a single off-brand neutral. |
| `--paper` | `#F4F4FF` | Pale Lavender | `#DCD0FF` | Page surface. The current value already reads as pale-lavender-ish; this just brand-locks it. |
| `--panel` | `#F4F5F3` | Pale Lavender @ 92% | `color-mix(in srgb, var(--paper) 92%, white)` | Subordinate surface, slightly lighter than `--paper`. |
| `--panel-mid` | `#D9DACF` | Granny Smith @ 30% | `color-mix(in srgb, var(--teal) 30%, var(--paper))` | Mid-tier panel. **Alt**: tinted Pale Lavender if mint feels wrong here. |
| `--panel-dark` | `#E7E5E2` | Pale Lavender @ 80% | `color-mix(in srgb, var(--paper) 80%, var(--ink) 8%)` | Subtle border / deeper panel. |
| `--darkgrayblue` | `#294457` | Port Gore | `#2A2457` | **Near-trivial swap** — current value is already navy-shaped. |
| `--grayblue` | `#446079` | Scampi | `#7169B2` | Mid-blue → secondary purple. |
| `--midgrayblue` | `#6a99c2` | Scampi @ 70% | `color-mix(in srgb, #7169B2 70%, white)` | Lighter purple accent. |
| `--lightgrayblue` | `#f5f9ff` | Pale Lavender @ 50% | `color-mix(in srgb, var(--paper) 50%, white)` | Faintest cool tint. |
| `--teal` | `#7DBFA7` | Granny Smith | `#9CD696` | Mint accent — close hue/role match. |
| `--lightteal` | `#D0D9DC` | Granny Smith @ 30% | `color-mix(in srgb, #9CD696 30%, var(--paper))` | Pale mint. |
| `--orange` | `#CC6324` | Christine | `#E2740E` | Primary alert orange. |
| `--brightorange` | `#FF8341` | Christine @ 115% lightness | `color-mix(in srgb, #E2740E 80%, white)` | Hot variant. **Alt**: Fuel Yellow if energy not warmth. |
| `--lightorange` | `#FDDCCC` | Fuel Yellow @ 35% | `color-mix(in srgb, #ECAF30 35%, var(--paper))` | Pale warm wash. |
| `--purple` | `#3E1631` | Brown Derby | `#472616` | Wine → warm dark. Brown Derby is tonally closest. **Alt**: Port Gore if you want cooler. |
| `--gold` | `#90553A` | Santa Fe | `#C47965` | Warm earth tone. |
| `--green` | `#599077` | Zuccini | `#307159` | Deeper forest green. |
| `--red` | `#ff0000` | Christine | `#E2740E` | True red retires; destructive states pair with Christine. **Alt**: keep a fallback red token off-brand for true error states (browser convention). |

**Semantic aliases** (`--text-primary`, `--surface-page`, etc.) all auto-update since they reference the tokens above. No change needed.

---

## Proposed shadcn token mapping

shadcn tokens live in OKLCH for color-space-correct tints. Re-anchored to the Research Ireland palette below. Pair choices follow the approved pairings.

| Token | Current | → New (hex) | Pairing rationale |
|---|---|---|---|
| `--background` | `oklch(1 0 0)` (white) | Pale Lavender `#DCD0FF` | Primary surface |
| `--foreground` | dark slate | Bush Green `#112B19` | Body text |
| `--card` | white | Pale Lavender `#DCD0FF` | Cards sit on page |
| `--card-foreground` | dark slate | Bush Green `#112B19` | |
| `--popover` | white | Pale Lavender `#DCD0FF` | |
| `--popover-foreground` | dark slate | Bush Green `#112B19` | |
| `--primary` | dark slate | Bush Green `#112B19` | Primary CTA, fills, header chrome |
| `--primary-foreground` | near-white | Pale Lavender `#DCD0FF` | Text on `--primary` |
| `--secondary` | light slate | Granny Smith `#9CD696` | Secondary surface |
| `--secondary-foreground` | dark slate | Bush Green `#112B19` | |
| `--muted` | light slate | Pale Lavender @ 92% | Subordinate surface |
| `--muted-foreground` | mid slate | Bush Green @ 60% | Muted text — see `--gray` decision |
| `--accent` | light slate | Fuel Yellow `#ECAF30` | Accent fills, highlights |
| `--accent-foreground` | dark slate | Bush Green `#112B19` | Text on Fuel Yellow |
| `--accent-orange` | OKLCH orange | Christine `#E2740E` | Reconcile with `--orange` |
| `--destructive` | OKLCH red | Christine `#E2740E` | See `--red` decision |
| `--border` | light slate | Pale Lavender @ 80% | Default border |
| `--input` | light slate | Pale Lavender @ 80% | Input border |
| `--ring` | mid slate | Scampi `#7169B2` | Focus ring — distinctive non-text color |
| `--chart-1` | OKLCH orange | Bush Green `#112B19` | Primary chart series |
| `--chart-2` | OKLCH cyan | Scampi `#7169B2` | |
| `--chart-3` | OKLCH dark teal | Granny Smith `#9CD696` | |
| `--chart-4` | OKLCH yellow | Fuel Yellow `#ECAF30` | |
| `--chart-5` | OKLCH orange | Santa Fe `#C47965` | |
| `--sidebar` | near-white | Port Gore `#2A2457` | Dark sidebar — pairs with Pale Lavender text |
| `--sidebar-foreground` | dark slate | Pale Lavender `#DCD0FF` | |
| `--sidebar-primary` | dark slate | Granny Smith `#9CD696` | Active item highlight |
| `--sidebar-primary-foreground` | near-white | Bush Green `#112B19` | Text on Granny Smith |
| `--sidebar-accent` | light slate | Port Gore @ 80% | Hover state |
| `--sidebar-accent-foreground` | dark slate | Pale Lavender `#DCD0FF` | |
| `--sidebar-border` | light slate | Port Gore @ 70% | Internal divider |
| `--sidebar-ring` | mid slate | Scampi `#7169B2` | Focus |

**Dark mode** (`.dark` block, app.css ~line 2262) needs a parallel mapping — open question below.

---

## Sentiment + emotion palette

Currently fragmented (POSITIVE/NEUTRAL/NEGATIVE constants in separate files, plus per-component pills). Proposal: introduce three new tokens in `:root` and refactor the constants/pills to use them.

```css
--sentiment-positive: #9CD696;   /* Granny Smith */
--sentiment-neutral:  color-mix(in srgb, var(--ink) 30%, var(--paper));  /* Bush Green tint */
--sentiment-negative: #E2740E;   /* Christine */
```

**Open question** — `--sentiment-negative` is Christine (an alert orange, not red). Reasonable in a brand that has no red, but it conflicts with conventional charting. **Alt**: introduce one off-brand red (e.g. `#B91C1C`) reserved for sentiment-negative + true error states.

---

## What I'm NOT touching in this round

1. **The 101 raw `#312f28` literals** and ~80 other hex duplicates. These should be replaced with `var(--ink)` etc. — but as a separate cleanup commit after the token swap, so the visual diff and the syntax diff don't tangle. Otherwise hard to review.
2. **Tailwind utility slate scale** (`text-slate-500`, `bg-slate-100`, etc., ~110 uses). These bypass the token system entirely. Migration here means deciding per-use whether to swap to a brand class or live with off-brand slate. Discuss separately.
3. **`.dark` overrides** at app.css:2262. Dark mode needs its own pairing strategy — likely Bush Green or Port Gore as page surface, Pale Lavender as text. Tabled until you decide whether dark mode is in scope.
4. **Per-route component palettes** (e.g. journey-map step colors, bento sentiment ribbons) likely have local arrays of hex codes. Need a separate pass once the global tokens land.

---

## Open decisions before I execute

1. **Muted text strategy** — tint Bush Green over Pale Lavender (clean but feels green/dim), or introduce one non-brand gray for body-muted text (off-brand but legible)?
2. **`--purple` mapping** — Brown Derby (#472616, warmer) or Port Gore (#2A2457, cooler)? Currently wine `#3E1631`; both candidates are tonally close in different directions.
3. **`--brightorange` mapping** — Christine lighter shade (warmer) or Fuel Yellow (more energetic)?
4. **`--red` / `--destructive`** — collapse onto Christine, or carve out one off-brand red for destructive UI?
5. **Sentiment-negative** — same question. Christine or off-brand red?
6. **Slate scale handling** — global replace, scoped replace, or leave?
7. **Dark mode** — in scope this round, or defer?
8. **Migration mechanic** — one-shot swap (touch only `:root`, instant visual flip across the app), or coexist mode (keep old tokens, add new `--ri-*` tokens, migrate per surface so you can review screen-by-screen)? One-shot is faster but harder to roll back; coexist is safer but doubles the token surface area mid-migration.

---

## Slide-deck assets

Out of scope for this code mapping. If the decks live in Figma, the same palette belongs as Figma styles — let me know the file and I can prep that separately (or hand off a CSS/SVG swatch sheet you can import).
