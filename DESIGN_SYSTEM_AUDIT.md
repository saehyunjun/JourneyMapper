# JourneyMapper — Design System Consolidation Audit

> Status: **Phase 1 + 2 + 3 complete. Wave 1 of refactor merged (see §3.1).**
> Scope: 366 `.svelte/.css` files under `src/` (excluding `src/lib/archive/`).
> Foundation: [src/app.css](src/app.css) (2,801 lines) + [src/lib/components/ui/](src/lib/components/ui/) (shadcn-svelte primitives) + [tailwind.config.js](tailwind.config.js) (empty theme — all tokens live in `app.css`).

---

## Executive summary

The app has two healthy primitive systems (shadcn-svelte + a global token layer in `app.css`) sitting on top of a thick layer of organically grown duplicates. Roughly 70 utility classes are defined in `app.css`; **at least 40 of them have zero or one consumer** — they are dead inventory adding to design entropy. Where consumers exist, they often inline-redefine the same visual on top — for example, 87% of `font-size` declarations across components are arbitrary one-offs rather than utility-class usage.

The five highest-leverage consolidations, in priority order:

| # | Theme | Files touched (est.) | Effort | Why first |
|---|---|---|---|---|
| 1 | **Delete dead utilities** in `app.css` (~40 classes with 0 consumers) | 1 (app.css only) | XS | Reduces cognitive surface immediately; no risk |
| 2 | **`AppDrawer`** consolidating RightDrawer / TertiaryDrawer / JourneyDrawer / JourneySubDrawer (4 incompatible drawer systems) | ~12 | M | Most visible inconsistency; nested-drawer z-index is currently broken across systems |
| 3 | **Typography utilities** — define 8 canonical classes, replace 360+ one-off font-sizes | ~30 hot files | M-L | Largest raw count of debt; quick visual cohesion win |
| 4 | **`AppCard`** with 5 variants — replaces `.card / .card-sm / .card-lg / .card-quote / .card-body / .persona-card / KeyQuoteCard / KeyFindingCard / BentoCard / JourneyStep / CapabilityTile` | ~15 | M | Cards appear on every screen at different elevations — current chaos is highly visible |
| 5 | **`AppButton`** — collapse 6 global button classes + 17 scoped variants onto shadcn `Button` with project variants | ~25 | L | Highest file-count touch but lowest visual risk per file |

These five alone are estimated to absorb **~75% of the visual inconsistency in the app**.

---

# Phase 1 — Inventory

## 1.1 Foundation tokens (already defined in `app.css`)

### Palette ([src/app.css:28-60](src/app.css#L28-L60))
```
--ink #312F28           --gray #707070
--darkgrayblue #294457  --grayblue #446079   --midgrayblue #6a99c2   --lightgrayblue #f5f9ff
--lightteal  #D0D9DC    --teal      #7DBFA7
--lightorange #FDDCCC   --orange    #CC6324  --brightorange #FF8341
--paper #F4F4FF         --panel #F4F5F3      --panel-mid #D9DACF     --panel-dark #E7E5E2
--card oklch(1 0 0)
--purple #3E1631
--red #ff0000           --lightred #FB8809
--gold #90553A
--green #599077         --midgreen #7DBFA7   --lightgreen #55FFDA
```
Plus the shadcn oklch token set (`--background`, `--foreground`, `--primary`, `--secondary`, `--muted`, `--accent`, `--border`, `--ring`, `--chart-1..5`, `--sidebar*`, `--accent-orange`, `--accent-mint`).

### Typography ([src/app.css:22-26](src/app.css#L22-L26))
```
--font-heading        Jost
--font-heading-serif  Spectral
--font-heading-alt    Space Grotesk     ← consumed only by 11 marketing/capability files
--font-body           IBM Plex Sans
--font-mono           IBM Plex Mono
```
Five font families is one too many. `Inter` is also imported via `@fontsource-variable/inter` ([src/app.css:11](src/app.css#L11)) but never consumed — sixth font family that loads on every page.

### Motion ([src/app.css:67-74](src/app.css#L67-L74))
```
--ease-standard  cubic-bezier(.25,.46,.45,.94)
--ease-smooth    cubic-bezier(.19,1,.22,1)
--ease-snappy    cubic-bezier(.645,.045,.355,1)
--dur-fast .2s   --dur-med .4s   --dur-slow 1.05s   --dur-shimmer 3.05s
```

### Stroke / shadow ([src/app.css:63-65](src/app.css#L63-L65))
```
--stroke    1px solid var(--midgrayblue)
--hairline  0.5px solid var(--ink)
--shadow    0 10px 28px rgba(0,0,0,0.18)
```

## 1.2 Buttons

### Global button classes in `app.css` and their consumers
| Class | app.css line | Consumers (count) | Visual |
|---|---|---|---|
| `.btn-base` | [735](src/app.css#L735) | 4 | Green pill, 4.25em × 2em, Jost 2.25em |
| `.btn-nav` | [773](src/app.css#L773) | 4 | Panel-dark pill, soft elevation, 2.25rem tall |
| `.btn-base-sm` | (referenced in `:hover` rule only — [810](src/app.css#L810)) | **0** | Never defined as a base rule — only hover state |
| `.layout-btn` | [735](src/app.css#L735) (alias of `.btn-base`) | 2 | Same body as `.btn-base`; `--active` variant goes purple |
| `.open-btn` | [980](src/app.css#L980) | 1 | Indigo border `#523AFE` (hardcoded), Jost 0.625rem |
| `.btn-empty` | [1001](src/app.css#L1001) | **0** | `#FF4A4A` border ghost |
| `.btn-sm` | [1021](src/app.css#L1021) | 6 | Green pill, 7.5em × 2.725em, IBM Plex 800 |
| `.btn-sm-alt` | [1038](src/app.css#L1038) | 1 | Orange square, 2.5em × 2.5em |
| `.btn-fill` | (only `:hover` rule — [1013](src/app.css#L1013)) | **0** | Never defined as a base rule |

**Three classes (`.btn-empty`, `.btn-base-sm`, `.btn-fill`) are dead.** Two (`.open-btn`, `.btn-sm-alt`) have one consumer.

### Hover-rule-only orphans
[src/app.css:810-816](src/app.css#L810-L816), [1013-1019](src/app.css#L1013-L1019) — the codebase has `:hover` selectors for `.btn-base-sm`, `.btn-fill`, `.btn-empty` but the base classes for the first two were never declared. These are CSS rules whose left-hand sides don't exist.

### shadcn `Button` ([src/lib/components/ui/button/button.svelte](src/lib/components/ui/button/button.svelte))
Used directly in 8+ files (drawers, dialog triggers). Has `variant` (`default | ghost | outline | secondary | destructive | link`) and `size` (`default | sm | lg | icon | icon-sm`). **This is the only button primitive worth keeping as the foundation.**

### Component-scoped button patterns
17 distinct scoped button classes were found, only some are listed here (full list in agent transcript):

| File:line | Selector | Intent | Inconsistency |
|---|---|---|---|
| [PersonaStory.svelte:585](src/lib/components/personas/PersonaStory.svelte#L585) | `.story-close` | Round 32px close, dark theme | Hardcoded rgba, no token |
| [PersonaStory.svelte:651](src/lib/components/personas/PersonaStory.svelte#L651) | `.story-nav-btn` | Pill nav | Hardcoded rgba, mono uppercase — no .mono-label utility |
| [ViewModeToggle.svelte:62](src/lib/components/ViewModeToggle.svelte#L62) | `.view-btn` | Pill toggle | Uses tokens correctly — model example |
| [JourneyDrawer.svelte:45](src/lib/journeymapper2/JourneyDrawer.svelte#L45) | inline `bg-[#CC6324]` | Close button | **Hardcodes `--orange` as `#CC6324`** |
| [JourneyMapView.svelte:913](src/lib/components/journey-map/JourneyMapView.svelte#L913) | `.stage-details-btn` | Panel CTA | Border `#D9DACF` hardcoded (it's `--panel-mid`) |
| [InterventionDropZone.svelte:193](src/lib/journeymapper2/JourneyInterventions/InterventionDropZone.svelte#L193) | `.drop-zone-chip__close` | 14px circular close | Reasonable, token-based |
| [StackedCards.svelte:362](src/lib/components/StackedCards.svelte#L362) | `.sc-btn` | Inline action | Uses Tailwind `slate-` palette, not project tokens |
| [InteractiveCorpusHero:181](src/lib/components/InteractiveCorpusHero.svelte#L181) | `.stat-btn` | Stat-tile clicker | Token-based |
| [QuotePullBlock.svelte:209](src/lib/components/key-findings/blocks/QuotePullBlock.svelte#L209) | `.qp-settings` | Settings button | References undefined `--subtle`, `--fg`, `--accent` |
| [InlineLinkButton.svelte:35](src/lib/components/InlineLinkButton.svelte#L35) | `.story-link-btn` | Inline dashed-underline | Token-based |
| [KeyFindingCard.svelte:151-227](src/lib/components/key-findings/KeyFindingCard.svelte#L151-L227) | inline Tailwind | 7 toolbar buttons | Slate palette, not project tokens |
| [ToastViewport.svelte:84](src/lib/components/ToastViewport.svelte#L84) | inline Tailwind | Toast dismiss | Slate palette |

### Button duplication matrix
- **Primary CTA**: `.btn-base`, `.btn-sm`, `.layout-btn`, `Button` default — all serve same role
- **Secondary/ghost**: `.btn-nav`, `.btn-base-sm` (dead), `Button` ghost — same role
- **Icon-only round**: `.story-close`, `.drop-zone-chip__close`, `.icon-toolbar*` family (7 variants), `Button size="icon-sm"` — same role
- **Close affordance**: 7 distinct implementations across drawers
- **Pill toggle**: `.view-btn`, `.story-nav-btn`, `.pill` — same role
- **Text/link button**: `.story-link-btn`, `.qp-settings`, `Button variant="link"` — same role

**Conclusion**: 6 global classes + 17 scoped + 5+ inline-Tailwind patterns to collapse into a single `AppButton` (built on `Button`) with ~5 variants and 3 sizes.

## 1.3 Drawers / panels / sidebars

Four distinct drawer systems coexist:

| System | Files | Underlying primitive | Width strategy | Z-index | Backdrop | Motion |
|---|---|---|---|---|---|---|
| **RightDrawer** (modern) | RightDrawer, FragmentTagDrawer, SegmentTagDrawer, ParticipantDrawer, ThemeDrawer, FindingEvidenceDrawer | bits-ui Dialog | Responsive (`max-w-2xl/3xl/4xl`) | 50 | `bg-slate-900/30` | DRAWER_PANEL_IN/OUT (expoOut 380ms / cubicIn 240ms) |
| **TertiaryDrawer** (modern) | TertiaryDrawer, ParticipantFragmentsDrawer, KeywordTagDrawer, PhraseLinkDrawer, GroupStatsDrawer, SponsorDrawer, WordUsageDrawer | bits-ui Dialog | `max-w-md/lg` compact or `max-w-102/142` wide | 55–60 / 99–109 | `bg-slate-900/30` | Shares RightDrawer constants |
| **JourneyDrawer** (legacy) | JourneyDrawer, JourneyInfoSidebarTop | `.drawer` class in `app.css` | 65vw, min 650px | 999 | `rgba(56,56,56,0.725)` | `fly({x:120, 320ms, cubicOut})` |
| **JourneySubDrawer** (legacy) | JourneySubDrawer | `.sub-drawer` (component-local) | 40vw, prop default 550px | 9999 (hardcoded) | `rgba(30,20,10,0.825)` | `fly({x:width, 300ms, cubicOut})` |

### Conflicts
1. **Z-index scales are non-overlapping and arbitrary**: `50/55/60/99/109/999/9999`. A `RightDrawer` cannot stack on top of a `JourneyDrawer` (no shared model).
2. **Backdrop colors differ** — three distinct rgba values; no `--scrim` token exists.
3. **Width strategies differ** — viewport-% (`65vw`) vs prop-driven px (`550px`) vs Tailwind responsive utilities (`max-w-2xl`).
4. **Close UX differs** — top-right X via shadcn Button (`RightDrawer`), structured header with eyebrow+title+subtitle (`TertiaryDrawer`), toolbar+X (`JourneyDrawer`), child-owned header (`RightDrawer` consumers).
5. **Header ownership differs** — `TertiaryDrawer` ships a header; `RightDrawer` delegates to children; `JourneyDrawer` uses a toolbar slot.

### Sidebars
- `.sticky-panel` ([app.css:2253](src/app.css#L2253)) — used 2x
- `.sticky-panel-left` ([app.css:2275](src/app.css#L2275)) — **0 consumers**
- `.sticky-panel-top` ([app.css:2291](src/app.css#L2291)) — 1 consumer
- [WctglpSidebar.svelte](src/lib/components/WctglpSidebar.svelte) — sticky 14px-rail, hover-expands to 56px
- [app-sidebar.svelte](src/lib/components/app-sidebar.svelte) — shadcn-svelte sidebar primitive (full 23-file ui/sidebar package)
- [TableOfContents.svelte](src/lib/components/TableOfContents.svelte) — bespoke sticky ToC

Bottom-anchored panel: [JourneyInfoSidebarTop.svelte](src/lib/journeymapper2/JourneyInfoSidebarTop.svelte) — handle-to-full-body animated expansion. Distinct enough to need its own primitive (`AppBottomSheet`).

## 1.4 Cards

### Global card classes
| Class | line | Width | Radius | Border | Shadow | Consumers |
|---|---|---|---|---|---|---|
| `.card` | [1117](src/app.css#L1117) | 15vw | 20px | `1px #9898c8` (hardcoded) | none | 71 |
| `.card-body` | [1075](src/app.css#L1075) | 100% | 10px | `2.5px panel-dark` | 2-layer | (flip-card use only) |
| `.card-quote` | [1129](src/app.css#L1129) | 250px | .525em | `0.25px panel-dark` | 3-layer | 2 |
| `.card-sm` | [2177](src/app.css#L2177) | 250px | .525em | `0.25px panel-dark` | 3-layer (overridden 3x!) | 1 |
| `.card-lg` | [2216](src/app.css#L2216) | 22vw | .5em | `2px panel-mid` | 2-layer | 1 |
| `.persona-card` | [2325](src/app.css#L2325) | 240px | 0 | none | hover-only | (persona pages) |

**Bug**: `.card-sm` ([app.css:2194-2196](src/app.css#L2194-L2196)) and `.card-lg` ([app.css:2231-2232](src/app.css#L2231-L2232)) declare `box-shadow` 2-3 times consecutively. Only the **last** declaration applies; the earlier ones are dead. Same pattern in both.

### Component-scoped cards (each rolls its own visual)
| File | Type | Radius | Border | Shadow | Hover transform |
|---|---|---|---|---|---|
| [CodedFragmentCard](src/lib/components/CodedFragmentCard.svelte) | Fragment | inherited | `2px accent-mint` or `muted-foreground/40` | none | none |
| [KeyQuoteCard](src/lib/components/KeyQuoteCard.svelte) | Quote | `rounded-2xl` (1rem) | `border-slate-200` | none | none |
| [KeyFindingCard](src/lib/components/key-findings/KeyFindingCard.svelte) | Finding summary | `rounded-2xl` | conditional | `shadow-md` → `shadow-lg` | none |
| [BentoCard](src/lib/components/personas/BentoCard.svelte) | Bento tile | `rounded-xl` | `border-(--ink)/10` | `0 12px 32px -16px` | `-3px` |
| [JourneyStep](src/lib/components/journey/JourneyStep.svelte) | Step detail | `rounded-xl` | `border-slate-200` | `shadow-sm` | none |
| [CapabilityTile](src/lib/components/marketing/CapabilityTile.svelte) | Marketing tile | `8px` | `1px rgba(232,233,235,0.08)` | none | `-1px` |
| [.card-sm hover](src/app.css#L2200) | — | — | — | + `0 0 0 10px rgba(63,115,255,0.18)` | `-.525em` |
| [.persona-card hover](src/app.css#L2389) | — | — | — | `0 20px 60px rgba(0,0,0,0.18)` | `-2px` |
| [StackedCards grid](src/lib/components/StackedCards.svelte#L362) | — | `1rem` | none | none | `-3px` |

### Card debt summary
- **9 distinct border-radius values** for cards alone: `0 / 8px / .525em / .5em / 10px / 0.75rem / 1rem / rounded-2xl / 20px`
- **5 distinct hover-translate values**: `0 / -1px / -2px / -3px / -.525em (≈-8px)`
- **10+ distinct multi-layer box-shadow strings**
- **5 distinct selected-state mechanisms**: ring + bg, ring only, border swap, border swap + bg tint, bg tint only

## 1.5 Typography

`app.css` defines ~40 typography classes. Consumer counts:

**Heavy use (>10 consumers)**: `.caption` (47), `.tooltip` selectors (39, but as overlay not typography), `.label-sm` (30), `.text-body` (15), `.text-body-sm` (11), `.label-xs` (11), `.pull-quote` (5).

**Zero or one consumer** (deletion candidates): `.heading-xs`, `.heading-md`, `.heading-serif-lg`, `.label-rotated`, `.label-uppercase`, `.story-text`, `.text-body-lg`, `.label-heading`. Plus the 9 single-purpose `.tab-*` + `.strip-*` + `.plutchik-btn` classes that only fire inside JourneyMapper2.

### One-off `font-size` saturation
Across `src/lib/components/` and `src/lib/journeymapper2/` and `src/routes/`, **~360 of ~410 `font-size` declarations are arbitrary scoped values** (87%). The codebase has effectively no enforced typographic scale.

Distinct `font-size` values found: **73+** unique values. Includes:
- 39 unique rem/em values (e.g. `.5625rem`, `.62rem`, `.64rem`, `.65rem`, `.66rem`, `.68rem`, `.74rem`, `.78rem`, `.84rem`, `.92rem`, `.98rem`, `1.02rem` …)
- 9 unique px values (`10px`, `11px`, `12px`, `13px`, `14px`, `15px`, `20px`, `27px`, `36px`) — px is anti-pattern for a system designed in em
- 11 unique `clamp()` expressions (responsive heroes — no shared utility)

### Hot-spot files
- [src/routes/+page.svelte](src/routes/+page.svelte) — 37+ font-size declarations
- [src/routes/capabilities/+page.svelte](src/routes/capabilities/+page.svelte) — 20+
- [TopicAlignment.svelte](src/lib/components/TopicAlignment.svelte) — 25+
- [SearchInterviewAlignment.svelte](src/lib/components/SearchInterviewAlignment.svelte) — 22+
- [BubbleChart.svelte](src/lib/components/BubbleChart.svelte) — 14 (with hardcoded `font-family: "IBM Plex Sans"` 6×)
- [JourneyMapView.svelte](src/lib/components/journey-map/JourneyMapView.svelte) — 35+ font-family lines

### Base rule clash
`h1, h2, h3, h4, h5, h6 { font-size: 3.25em }` ([app.css:141-150](src/app.css#L141-L150)) means **every heading element renders at 3.25em unless explicitly overridden** — and the codebase contains many `<h2 style="font-size: 2.5em">` workarounds. The base rule is fighting consumers, not supporting them.

## 1.6 Color usage

### Palette token consumer counts (var(--…) references)
| Token | refs | Token | refs |
|---|---|---|---|
| `--ink` | 154 | `--panel` | 19 |
| `--gray` | 37 | `--panel-mid` | 15 |
| `--grayblue` | 35 | `--purple` | 10 |
| `--paper` | 35 | `--green` | 8 |
| `--darkgrayblue` | 34 | `--lightorange` | 8 |
| `--orange` | 22 | `--red` | 8 |
| `--panel-dark` | 19 | `--gold` | 5 |
| `--teal` | 13 | `--lightteal` | 4 |
| `--midgrayblue` | 12 | `--brightorange` | 2 |
| `--lightgrayblue` | 11 | `--midgreen` | 1 |
| `--card` (palette, not shadcn) | 1 | `--lightred` | **0** |
| `--bluegray` | 0 (typo'd token; referenced anyway in 2 places) | `--lightgreen` | **0** |

### Token debt
- `--teal` (#7DBFA7) and `--midgreen` (#7DBFA7) are **identical hex** with 13 + 1 consumers. **Merge.**
- `--bluegray` is referenced in [app.css:336](src/app.css#L336) and [app.css:686](src/app.css#L686) — **but never defined**. These references render as `unset`. Likely meant `--grayblue`. ([PersonaTopSelector.svelte:172](src/lib/journeymapper2/PersonaTopSelector.svelte#L172) also references undefined `--darkbluegray`.)
- `--lightred`, `--lightgreen` have **zero consumers**. Delete.
- `--font-heading-alt` (Space Grotesk) consumed only by 11 marketing files — defensible silo. Keep but document.
- `@fontsource-variable/inter` is imported but never used — **delete the import** to drop a font load.

### Hardcoded hex (top duplicates that bypass tokens)
| Hex | Count | Equivalent token | Status |
|---|---|---|---|
| `#312f28` | 49 | `--ink` | Should be `var(--ink)` |
| `#7dbfa7` | 30 | `--teal`/`--midgreen` | Should be token |
| `#64748b` | 30 | (slate-500) | Tailwind palette leak |
| `#94a3b8` | 21 | (slate-400) | Tailwind palette leak |
| `#cc6324` | 19 | `--orange` | Should be token |
| `#599077` | 17 | `--green` | Should be token |
| `#ff8341` | 15 | `--brightorange` | Should be token |
| `#e7e5e2` | 12 | `--panel-dark` | Should be token |
| `#294457` | 10 | `--darkgrayblue` | Should be token |
| `#6a99c2` | 9 | `--midgrayblue` | Should be token |
| `#446079` | 6 | `--grayblue` | Should be token |
| `#23abab` | 7 | (none) | "Ghost" color — appears 7× as hover state |
| `#9898c8` | 4 | (none — `.card` default border) | Ghost |
| `#73726c` | 4 | (none — swatch borders) | Ghost |
| `#fb7185`, `#34d399`, `#e11d48`, `#cbd5e1`, `#e2e8f0`, `#0f172a`, `#0b0e14` | 5–17 each | (Tailwind rose/emerald/slate) | Slate-palette leak in marketing files |

### Inline `style="color/bg/border..."` — top offenders
| File | inline-style count |
|---|---|
| [StepDetailContent.svelte](src/lib/journeymapper2/StepDetailContent.svelte) | 20 |
| [JourneyReportView.svelte](src/lib/journeymapper2/JourneyReportView.svelte) | 19 |
| [JourneyInfoSidebarTop.svelte](src/lib/journeymapper2/JourneyInfoSidebarTop.svelte) | 13 |
| [InflectionDetailContent.svelte](src/lib/journeymapper2/InflectionDetailContent.svelte) | 11 |
| [PersonaBioBar.svelte](src/lib/journeymapper2/PersonaBioBar.svelte) | 9 |
| [BlockConfigDrawer.svelte](src/lib/components/key-findings/BlockConfigDrawer.svelte) | 8 |
| [JourneyMapView.svelte](src/lib/components/journey-map/JourneyMapView.svelte) | 8 |
| [+page.svelte routes/patientlyiq/personas](src/routes/patientlyiq/personas/+page.svelte) | 7 |
| [FlowStageCard.svelte](src/lib/journeymapper2/FlowStageCard.svelte) | 7 |

Note that `journeymapper2/` accounts for 5 of the top 7. **The V2 surface is the hottest color-debt zone.**

### Tailwind palette leak (slate-/rose-/emerald-)
17 files include slate or rose Tailwind classes that bypass the project palette. Heaviest in marketing + KeyFindingCard + ToastViewport. These need to be replaced with tokenized equivalents (or accepted as out-of-scope for the marketing silo).

## 1.7 Spacing

### Distinct `gap` values across components (top 12)
| value | count |
|---|---|
| `1rem` | 38 |
| `0.5rem` / `8px` | 24 + 8 + 11 = ~43 |
| `0.4rem` | 24 |
| `0.375rem` | 10+6 = 16 |
| `0.35rem` | 15 |
| `0.7rem` | 12 |
| `1.5rem` | 10 |
| `0.6rem` | 9 |
| `0.25rem` / `4px` | 7+6 = 13 |
| `0.125rem` / `2px` | 7+6 = 13 |
| `0.8rem`, `0.9rem`, `0.3rem` | 7+7+7 |

### Distinct `padding` values (top, condensed)
`1rem` (17×), `0` (15×), `1.5rem` (7×), `1.25rem` (7×), `0.75rem 1rem` (7×), `0.5rem` (7×), plus a long tail of 30+ unique values.

### Observed working scale
The codebase organically converges on:
**4 / 8 / 12 / 16 / 24 / 32 / 48 / 64 px** (i.e. `0.25 / 0.5 / 0.75 / 1 / 1.5 / 2 / 3 / 4 rem`)
…but consistently leaks `0.4 / 0.35 / 0.375 / 0.6 / 0.7 / 0.8 / 0.9 rem` and `0.125 / 0.325 / 0.525 / 0.725 / 0.825 em` artifacts from translated Figma values.

## 1.8 Border radius

### Distinct values across components + app.css
| Bucket | Values found | Recommendation |
|---|---|---|
| **None** | `0` | `--radius-none: 0` |
| **Sharp** | `2px`, `3px`, `4px`, `5px` | Collapse → `--radius-sm: 4px` |
| **Standard** | `6px`, `8px`, `0.5em`, `0.525em`, `0.5rem`, `10px`, `0.75rem` | Collapse → `--radius-md: 8px` |
| **Card** | `12px`, `1rem`, `2em`, `20px` | Collapse → `--radius-lg: 16px` |
| **Pill** | `40px`, `100px`, `100em`, `999px`, `9999px`, `50%`, `100%` | Collapse → `--radius-full: 999px` |
| **Asymmetric** | `2px 2px 0 0`, `0 8px 8px 0`, `0 0 9px 9px`, `10em 0 0 10em`, `0 0 5em 0` | Keep as-is in scoped components |

shadcn already provides `--radius-sm/md/lg/xl/2xl/3xl/4xl` derived from `--radius: 0.625rem`. **The project should pick one system (shadcn) and migrate.**

## 1.9 Shadows

### Distinct multi-layer shadow strings (across components + app.css) — 30+ unique declarations
A representative sample:
```
0 30px 60px -12px rgba(50,50,93,0.25), 0 18px 36px -18px rgba(0,0,0,0.3)    ← used 2×
0 12px 28px rgba(0,0,0,0.14)                                                 ← used 2×
0 12px 32px -16px rgb(0 0 0 / 0.22)                                          ← BentoCard hover
0 20px 60px rgba(0,0,0,0.18)                                                 ← persona-card hover
0 10px 28px rgba(0,0,0,0.18)                                                 ← --shadow token
0 10px 20px -22px rgba(50,50,10,0.125), 0 1em 1em -1em rgba(0,0,0,0.125)    ← .card-body
0 2px 12px -10px rgba(0,0,0,0.15), 0 20px 20px 10px rgba(0,0,0,0.25)        ← .card-lg pre-override
0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)            ← shadow-md (Tailwind)
0 0 0 10px rgba(63,115,255,0.18)                                             ← card hover ring (indigo!)
0 0 0 6px rgba(125,191,167,0.22)                                             ← teal ring
inset 0 0 0 1px rgba(244,245,243,0.3)                                        ← inset stroke
0 2px 6px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.1)                       ← .view-tab--active
```

Most pages mix at least 3 different shadow families. Proposed elevation scale below.

## 1.10 Motion

### Duration usage
| value | count |
|---|---|
| `200ms` | 19 |
| `180ms` | 17 |
| `0ms` | 17 (stagger/initial) |
| `150ms` / `0.15s` | 16+16 = 32 |
| `600ms` | 13 |
| `0.12s` | 11 |
| `220ms` | 10 |
| `0.14s` | 9 |
| `280ms` | 8 |
| `240ms` | 8 |
| `360ms`, `60ms`, `420ms`, `380ms`, `500ms`, `400ms`, `320ms`, `720ms` | 3–7 each |

Existing `--dur-fast .2s / --dur-med .4s / --dur-slow 1.05s` tokens are used in <10 places. **Tokens exist but nobody calls them.**

### Easing usage
| Easing | count | Existing token equivalent |
|---|---|---|
| `cubic-bezier(0.22, 1, 0.36, 1)` | 25 | (close to `expoOut`) |
| `cubic-bezier(0.19, 1, 0.22, 1)` | 23 | `--ease-smooth` (matches exactly) |
| `cubic-bezier(0.4, 0, 0.2, 1)` | 12 | (Material-ish) |
| `cubic-bezier(0.65, 0, 0.35, 1)` | 7 | (close to viz `cubicInOut`) |
| `cubic-bezier(0.34, 1.56, 0.64, 1)` | 5 | (overshoot pop) |
| `cubic-bezier(0.45, 0.05, 0.55, 0.95)` | 2 | — |
| `cubic-bezier(0.25, 0.46, 0.45, 0.94)` | 2 | `--ease-standard` (matches exactly) |
| 6 other one-off cubic-beziers | 1–2 each | — |
| `ease` | 117 | (named) |
| `linear` | 8 | — |

**13 distinct cubic-beziers**; the two most popular cover 48 of 79 cubic-bezier occurrences. The system can be tightened to **3 cubic-bezier tokens + 1 named ease** without losing visual feel.

Anti-pattern check: zero usages of `transition: all` (good).

## 1.11 Overlays — tooltips / modals / popovers

### shadcn primitives
- [dialog/](src/lib/components/ui/dialog/) — 10 files
- [alert-dialog/](src/lib/components/ui/alert-dialog/) — 11 files
- [sheet/](src/lib/components/ui/sheet/) — 10 files
- [popover/](src/lib/components/ui/popover/) — 2 files
- [tooltip/](src/lib/components/ui/tooltip/) — 5 files

Direct consumers of shadcn dialog/sheet/popover/tooltip: `AskPatientlyAI`, `FragmentTagDrawer`, `IndicationSelector`, `ParticipantAvatar`, `RightDrawer`, `SegmentTagDrawer`, `WctglpSidebar` — fewer than 10 files. The primitives are under-leveraged.

### Bespoke tooltip systems
- `.tooltip` ([app.css:1380](src/app.css#L1380)) — used by 7 journeymapper2 files + 4 ui/sidebar/tooltip files. **Note: `.tooltip` class is overloaded — both a layout (positioned overlay) and a typography style (Jost 1.25em 400)**, which causes leakage.
- `.tooltip-sm` ([app.css:1408](src/app.css#L1408)) — **0 consumers**
- [JourneyTooltip.svelte](src/lib/journeymapper2/JourneyTooltip.svelte) — bespoke
- [JourneyEventCard.svelte:tooltip](src/lib/journeymapper2/JourneyEventCard.svelte) — local `.tooltip` selector

### Modal-like surfaces
The bits-ui Dialog used by `RightDrawer` / `TertiaryDrawer` is the modal infrastructure. No standalone `AppModal` exists; "modals" in the codebase are all right-side drawers in disguise. This is a deliberate UX choice — confirm with stakeholders before adding a centered AppModal.

---

# Phase 2 — Proposed Design System

## 2.1 Foundations

### Colors
Keep the existing palette. Apply these surgeries:
1. Delete `--lightred`, `--lightgreen`, `--card` (palette variant — the shadcn `--card` oklch is what's actually consumed).
2. Merge `--midgreen` into `--teal` (identical hex; one consumer).
3. Fix typo references to `--bluegray` and `--darkbluegray` ([app.css:336](src/app.css#L336), [app.css:686](src/app.css#L686), [PersonaTopSelector.svelte:172](src/lib/journeymapper2/PersonaTopSelector.svelte#L172)) → `--grayblue`/`--darkgrayblue`.
4. Delete unused font import: `@fontsource-variable/inter` ([app.css:11](src/app.css#L11)).
5. Decide on `--font-heading-alt` (Space Grotesk): keep only if marketing pages stay distinct; otherwise migrate to `--font-heading`.
6. Add semantic aliases on top (don't rename core tokens):
   - `--text-primary: var(--ink)`
   - `--text-muted: var(--gray)`
   - `--surface-page: var(--paper)`
   - `--surface-panel: var(--panel)`
   - `--surface-card: var(--card)` (shadcn variant)
   - `--border-subtle: var(--panel-dark)`
   - `--border-strong: var(--midgrayblue)`
   - `--accent-action: var(--orange)`
   - `--accent-affirm: var(--green)` (`/--teal`)
   - `--scrim: rgba(56,56,56,0.5)`

### Typography (8 canonical classes)
| Slot | Class | Font | Size | Weight | Replaces |
|---|---|---|---|---|---|
| Display | `.t-display` | Spectral | clamp(2rem, 5vw, 3.25em) | 400 | `h1-h6` base, `.heading-serif-lg` |
| H1 | `.t-h1` | Jost | 2.25em | 500 | `.heading-serif` (italic variant via modifier) |
| H2 | `.t-h2` | Jost | 1.5em | 600 | `.heading-serif-md`, ad-hoc h2 styles |
| H3 | `.t-h3` | Jost | 1.25em uppercase | 600 | `.heading-md` |
| H4 | `.t-h4` | Jost | 0.825em uppercase | 700 | `.heading-sm`, `.nav-title`, `.label-sm` (consolidate) |
| Body | `.t-body` | IBM Plex | 1em / 1.35 | 400 | `.text-body`, default html |
| Body-sm | `.t-body-sm` | IBM Plex | 0.825em / 1.25 | 400 | `.text-body-sm` |
| Caption | `.t-caption` | IBM Plex Mono | 0.725em italic | 400 | `.caption`, `.cite`, `.footer`, `.persona-footer-note` |
| Mono-label | `.t-mono-label` | IBM Plex Mono | 0.725em uppercase ls:0.06em | 700 | All `.tab-*`, `.strip-*` mono-uppercase classes |

Modifiers: `.t-italic`, `.t-emphasized` (weight bump for `.story-text` use cases).

**Remove the global `h1-h6` 3.25em rule** ([app.css:141-150](src/app.css#L141-L150)) — replace with `@layer base { h1,h2,...{ font-family: var(--font-heading); color: var(--ink); }}` and let `.t-*` classes set the sizes.

### Spacing
Adopt **4 / 8 / 12 / 16 / 24 / 32 / 48 / 64 px** as the canonical scale (matches Tailwind's `1 / 2 / 3 / 4 / 6 / 8 / 12 / 16`). Expose as:
```
--space-1: 4px;  --space-2: 8px;  --space-3: 12px;  --space-4: 16px;
--space-5: 24px; --space-6: 32px; --space-7: 48px;  --space-8: 64px;
```
Decay all `em`-based artifacts in scoped styles to nearest scale step.

### Radius
```
--radius-sm: 4px   ← collapses 2/3/4/5px
--radius-md: 8px   ← collapses 6/8/10px and .5em/.525em
--radius-lg: 16px  ← collapses 12/20px and 1rem/2em
--radius-full: 999px
```
Drop shadcn's auto-generated `--radius-sm/md/lg/xl/2xl/3xl/4xl` cascade in favor of explicit values.

### Elevation
```
--elev-0: none                                                ← flat surfaces
--elev-1: 0 1px 3px rgba(49,47,40,0.08)                       ← raised cards
--elev-2: 0 4px 12px rgba(49,47,40,0.10)                      ← floating cards
--elev-3: 0 12px 28px rgba(49,47,40,0.14)                     ← overlays
--elev-4: 0 30px 60px -12px rgba(50,50,93,0.25),
          0 18px 36px -18px rgba(0,0,0,0.30)                  ← modals/drawers
--ring-focus: 0 0 0 3px color-mix(in srgb, var(--accent-orange) 35%, transparent)
```
Reuse `--shadow` token name for back-compat → alias to `--elev-3`.

### Motion
```
--dur-instant: 60ms
--dur-fast:    180ms        ← was .2s
--dur-med:     280ms        ← was .4s (overshooting on most uses)
--dur-slow:    600ms
--ease-standard: cubic-bezier(0.22, 1, 0.36, 1)   ← matches most-common observed
--ease-smooth:   cubic-bezier(0.19, 1, 0.22, 1)   ← keep
--ease-snappy:   cubic-bezier(0.4, 0, 0.2, 1)     ← swap to most-common Material-ish
```
Delete `--dur-shimmer` (3.05s — single-use); inline if needed.

## 2.2 Components

### `AppButton` (wraps shadcn `Button`)
- Variants: `primary` (orange/green CTA), `secondary` (panel-dark), `ghost`, `outline`, `link`, `destructive`
- Sizes: `xs` (icon-toolbar replacement), `sm`, `md` (default), `lg`
- States: hover, active, focus-visible (ring), disabled
- Accessibility: must have `aria-label` for icon-only; focus ring uses `--ring-focus`; Enter/Space activation via native `<button>`

### `AppDrawer`
- Props: `open`, `side="right"`, `width="sm|md|lg|xl|auto"`, `level="primary|secondary|tertiary"` (controls z-index), `closeOnBackdrop`, `closeOnEsc`
- Slots: `header`, `default`, `footer`
- Built on `bits-ui Dialog`
- Standard motion: in `--ease-standard 280ms`, out `--ease-snappy 180ms`
- Built-in close button (configurable position)

### `AppPanel`
- Static (non-modal) right- or left-anchored panel
- Used inside layouts where drawer animations aren't appropriate
- Replaces `.sticky-panel` family

### `AppSidebar`
- Collapsible-rail sidebar (icon-only ↔ expanded)
- Wraps shadcn `Sidebar` package
- Replaces `WctglpSidebar` + `app-sidebar` divergence

### `AppCard`
- Variants: `default`, `quote`, `persona`, `fragment`, `metric`, `finding`
- Sizes: `sm` (250px-ish), `md`, `lg` (22vw-ish), `full`
- States: `default`, `hover`, `selected`, `dropTarget`
- Elevation: `--elev-1` default, `--elev-2` on hover, `--elev-3` selected
- Radius: `--radius-md` standard; `--radius-lg` for `finding/quote` variants
- Hover transform: standardize on `translateY(-2px)`

### `AppTooltip`
- Wrap shadcn `Tooltip`
- Two visual variants: `default` (compact), `rich` (the 375px-wide kicker/title/swatches layout currently in `.tooltip`)
- **Untangle the typography styles from the layout class** — move font-family/size into `.t-mono-label` etc.

### `AppModal`
- Optional. Only if a centered (non-drawer) modal pattern is needed. Current evidence: not needed; right-drawers cover the use cases.

### `AppBadge` / `Pill`
- Variants: `default`, `outline`, `solid`, `ghost`, `frosted` (glass)
- Sizes: `xs`, `sm`, `md`
- Replaces `.pill`, `.pill-sm`, `.pill-white`, `.pill-round`, `.pill-label`

### `AppTabs`
- Wrap shadcn `Tabs`
- Use existing `.view-tab--active` visual as the active state

---

# Phase 3 — Refactor Roadmap

## 3.1 High-impact wins (do first)

### Wave 1 — `app.css` cleanup — ✅ MERGED 2026-05-28
1. ✅ **Deleted 42 zero-consumer classes**: `.btn-empty`, `.btn-fill` (base rule), `.btn-base-sm`, `.biobar-light`, `.detail-bar`, `.heading-md`, `.heading-xs`, `.heading-serif-lg`, `.index-fill/-track/-zero`, `.jm-content-grid-2/3`, `.jm-content-row-padding-2`, `.jm-content-start`, `.jm-dot`, `.jm-mini-swatch`, `.jm-rule`, `.jm-swatches`, `.jm-swatch-circle`, `.jm-swatch-lg`, `.jm-val`, `.jm-value`, `.label-rotated`, `.label-uppercase`, `.label-heading`, `.nav-bar`, `.nav-bar-col`, `.nav-left`, `.photo-sm/-md/-lg/-full`, `.pill-label`, `.spacer-sm`, `.speech-bubble`, `.sticky-panel-left`, `.story-text`, `.text-body-lg`, `.toolbar-sm-white`, `.toolbar-sm-white-left`, `.tooltip-sm`, `.mini-swatch`, `.mini-swatch-circle`.
2. ✅ **Fixed typos**: `var(--bluegray)` → `var(--grayblue)` (2 places in app.css); `var(--darkbluegray)` → `var(--darkgrayblue)` in [PersonaTopSelector.svelte:172](src/lib/journeymapper2/PersonaTopSelector.svelte#L172).
3. ✅ **Removed hover orphans** for `.btn-fill`, `.btn-empty`, `.btn-base-sm` (chained selectors trimmed).
4. ✅ **Dropped `@fontsource-variable/inter` import**. (Note: package.json devDependency entry still present — pruning that requires `npm install`; deferred to a follow-up to keep this PR low-risk.)
5. ✅ **Collapsed duplicate box-shadows** in `.card-sm` (3 → 1) and `.card-lg` (2 → 1) — preserved the visually-effective final declaration in each case.
6. ✅ **Removed duplicate `--card`** palette declaration (kept the shadcn version at line 75).
7. ✅ **Merged `--midgreen` → `--teal`** (identical hex). Migrated 1 svelte consumer ([Radar.svelte:65](src/lib/charts/Radar.svelte#L65)) and 3 in-app.css references; deleted the token.
8. ✅ **Deleted `--lightred`, `--lightgreen`** (zero consumers).

**Result**: `src/app.css` 2,801 → 2,390 lines (-411 lines, ~15%). Two svelte files modified (2 lines each). `npm run build` passes clean.
**Notes**:
- `.text-body-lg` and `.label-heading` had consumers in `src/lib/archive/` only (out of audit scope per charter). Resurrecting an archive file will require either re-adding the class or migrating its consumers.
- Outstanding follow-up: remove `@fontsource-variable/inter` from `package.json` + `package-lock.json` after broader package audit.

### Wave 2 — Typography migration
9. **Define the 8 canonical `.t-*` classes** alongside existing ones (additive).
10. **Strip the base `h1-h6 { font-size: 3.25em }` rule** from [app.css:141-150](src/app.css#L141-L150). Keep font-family/color/transforms; remove `font-size`.
11. **Migrate top-10 hot-spot files** to `.t-*` classes:
    - [src/routes/+page.svelte](src/routes/+page.svelte)
    - [src/routes/capabilities/+page.svelte](src/routes/capabilities/+page.svelte)
    - [TopicAlignment.svelte](src/lib/components/TopicAlignment.svelte)
    - [SearchInterviewAlignment.svelte](src/lib/components/SearchInterviewAlignment.svelte)
    - [BubbleChart.svelte](src/lib/components/BubbleChart.svelte)
    - [JourneyMapView.svelte](src/lib/components/journey-map/JourneyMapView.svelte)
    - [WctglpTopbar.svelte](src/lib/components/WctglpTopbar.svelte)
    - [WctglpSidebar.svelte](src/lib/components/WctglpSidebar.svelte)
    - [InflectionDetailContent.svelte](src/lib/journeymapper2/InflectionDetailContent.svelte)
    - [JourneyLegend.svelte](src/lib/journeymapper2/JourneyLegend.svelte)
12. After top-10 are migrated, deprecate `.heading-md/.heading-xs/.label-uppercase/etc` and re-grep.

**Risk**: Medium. Visual regression possible — pair with screenshot tests on the 10 hot files.
**Expected impact**: ~60% of font-size debt eliminated.

## 3.2 Low-risk refactors

### Wave 3 — `AppCard`
13. Build `AppCard.svelte` with the 6 variants + sized/selected/hover states.
14. Migrate fragment cards first ([CodedFragmentCard.svelte](src/lib/components/CodedFragmentCard.svelte) — single-purpose, isolated).
15. Migrate quote cards next ([KeyQuoteCard.svelte](src/lib/components/KeyQuoteCard.svelte), [QuotePullBlock.svelte](src/lib/components/key-findings/blocks/QuotePullBlock.svelte)).
16. Migrate finding cards ([KeyFindingCard.svelte](src/lib/components/key-findings/KeyFindingCard.svelte) — already shadcn-friendly).
17. Migrate Bento + JourneyStep + CapabilityTile (each independent).
18. Finally, deprecate `.card / .card-sm / .card-lg / .card-quote / .card-body / .persona-card` once all migrations confirmed.

**Risk**: Low. Each card migration is local. Persona-card flip animation is the only specialized behavior to preserve.

### Wave 4 — `AppButton`
19. Build `AppButton.svelte` as a thin wrapper over shadcn `Button` with project variants.
20. Sweep `KeyFindingCard.svelte` toolbar buttons + `ToastViewport.svelte` → `AppButton`.
21. Replace `.btn-sm`, `.btn-sm-alt`, `.btn-nav`, `.btn-base`, `.layout-btn`, `.open-btn` consumers with `<AppButton variant=...>` (~25 files).
22. Replace scoped buttons (`.story-close`, `.story-nav-btn`, `.view-btn`, `.stat-btn`, `.stage-details-btn`, `.qp-settings`, `.sc-btn`) with `AppButton` variants.
23. Remove the now-orphan `.btn-*` classes from `app.css`.

**Risk**: Low per file but touches many files. Recommended approach: one PR per consumer cluster (drawers / story / personas / journey).

### Wave 5 — Tooltip detangle
24. Define `.t-tooltip-body` as the typography part of current `.tooltip` selector; keep `.tooltip` as layout only.
25. Replace bespoke JourneyTooltip with shadcn `Tooltip` + `AppTooltip` variant `rich`.

**Risk**: Low. Tooltips are visually isolated.

## 3.3 High-risk areas (do last, behind feature flag if possible)

### Wave 6 — `AppDrawer` consolidation
26. Design `AppDrawer` props that cover RightDrawer + TertiaryDrawer + JourneyDrawer + JourneySubDrawer use cases.
27. Re-implement RightDrawer + TertiaryDrawer as thin wrappers (no behavior change).
28. Migrate `JourneyDrawer` from `.drawer` class + `fly` to `AppDrawer` — **breaks the 65vw layout assumption; needs UX validation**.
29. Migrate `JourneySubDrawer` from hardcoded z-9999 to `AppDrawer level="tertiary"` — **breaks the nested-drawer interaction model; needs interaction testing**.
30. Migrate `JourneyInfoSidebarTop` to a separate `AppBottomSheet` primitive (it's not a drawer).

**Risk**: High. The journey ecosystem has a parallel z-index, motion, and backdrop system that's load-bearing for the current UX. Recommend:
- Migrate RightDrawer/TertiaryDrawer first (safe — already on bits-ui).
- Behind a feature flag, ship the JourneyDrawer migration to one journey route at a time.
- Visual + interaction QA before each merge.

### Wave 7 — Tailwind palette eviction
31. Replace `slate-*`, `rose-*`, `emerald-*` classes in marketing files + `KeyFindingCard` + `ToastViewport` with tokenized equivalents.

**Risk**: Medium. The marketing pages may have intentionally divergent visuals — confirm with stakeholders before changing.

---

## Deliverables map (what was produced here)

| Deliverable requested | Where |
|---|---|
| 1. Component Inventory | §1.1 – §1.11 |
| 2. Design Debt Report | Executive summary + each section's "debt summary"/"conflicts" subsection |
| 3. Proposed Design System | §2.1 (Foundations) + §2.2 (Components) |
| 4. Migration Plan | §3.1 – §3.3, ordered by risk |

---

## Open questions for the team

1. **Marketing typography** — keep `--font-heading-alt` (Space Grotesk) as a marketing-only family, or unify under `--font-heading` (Jost)?
2. **JourneyDrawer** — can we accept temporary visual divergence during migration, or does it ship behind a flag?
3. **Tailwind palette leak** — is `KeyFindingCard`'s slate palette intentional (it ships in storytelling canvas where TipTap defaults rule), or should it move to project tokens?
4. **Centered modals** — confirmed not needed? Current evidence says no.
5. **Inter font import** — confirm safe to delete (zero consumers found, but `app.html` and any third-party widget should be sanity-checked).

---

*Audit produced 2026-05-28. No code modifications were made.*
