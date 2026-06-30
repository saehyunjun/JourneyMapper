# Patiently Layouts — Build Status
**Last updated:** May 2026  
**Stack:** SvelteKit + Svelte 5 (runes mode) + gray-matter  
**Build status:** ✅ Clean — 179 modules, no errors

---

## What's Been Built

### Infrastructure

| File | Status | Notes |
|---|---|---|
| `svelte.config.js` | ✅ | Svelte 5 runes mode enforced project-wide |
| `package.json` | ✅ | `mdsvex` + `gray-matter` installed |
| `src/routes/+page.server.ts` | ✅ | Reads first `.mdx` from `/decks/`, parses + passes to client |
| `src/routes/+page.svelte` | ✅ | Viewer UI: keyboard nav, page strip, export button |
| `src/routes/+layout.svelte` | ✅ | Minimal shell with favicon |

### Design Tokens

| File | Status | Notes |
|---|---|---|
| `src/lib/tokens/base.css` | ✅ | Full neutral token set: color, type scale (xs→4xl), spacing (1–10), tracking, leading |
| `src/lib/tokens/16x9.css` | ✅ | Type scale nudged up for 1920px canvas; slot inset/gap vars |
| `src/lib/tokens/letter.css` | ✅ | Type scale for 816px/print; tighter insets |

Dark theme is a `.theme-dark` class override in `base.css` — applied by canvas wrappers when `theme="dark"` is set in frontmatter.

### Canvas Wrappers

| Component | Canvas | Scaling | Status |
|---|---|---|---|
| `Canvas16x9.svelte` | 1920 × 1080 px | Scale-to-fit (ResizeObserver, `transform: scale()`) | ✅ |
| `CanvasLetter.svelte` | 816 × 1056 px | Scale-to-width, natural vertical scroll | ✅ |

Both wrappers apply canvas-scoped token classes (`canvas-16x9`, `canvas-letter`) and pass a `theme` prop down.

### Parser

**`src/lib/parser/parseDeck.ts`**

- Splits a single `.mdx` string on `---` page separators while correctly ignoring `---` inside YAML frontmatter blocks
- Parses per-page frontmatter via `gray-matter` (canvas, layout, theme, page, label)
- Extracts JSX-style component tags from the MDX body — both self-closing (`<StatBlock />`) and wrapped (`<BodyCopy>...</BodyCopy>`)
- Parses component props: quoted strings, `{value}` expressions, bare booleans, numbers
- Returns a typed `PageDescriptor[]` array with a `slots` map keyed by placement name

Exported types: `CanvasType`, `SlotDescriptor`, `PageDescriptor`.

### Layout Components

#### 16×9 Layouts (3 of 5 built)

| Layout | Placements | Status |
|---|---|---|
| `TitlePage.svelte` | `logo`, `eyebrow`, `headline`, `subtitle`, `meta`, `footer` | ✅ |
| `SplitLeft.svelte` | `eyebrow`, `upper-right`, `headline`, `body`, `visual`, `footer` | ✅ |
| `DataFull.svelte` | `label`, `source`, `chart-full`, `caption` | ✅ |
| `SplitRight.svelte` | Mirror of SplitLeft | ⬜ Stubbed → falls back to SplitLeft |
| `TwoUp.svelte` | `header`, `col-left`, `col-right`, `footer` | ⬜ Stubbed → falls back to SplitLeft |

#### Letter Layouts (2 of 5 built)

| Layout | Placements | Status |
|---|---|---|
| `Cover.svelte` | `logo`, `eyebrow`, `headline`, `subtitle`, `meta`, `footer` | ✅ |
| `ContentSpread.svelte` | `header`, `body-left`, `body-right`, `footer` | ✅ |
| `SectionIntro.svelte` | `eyebrow`, `title`, `summary`, `sidebar` | ⬜ Stubbed → falls back to ContentSpread |
| `DataPage.svelte` | `label`, `source`, `chart`, `caption`, `body` | ⬜ Stubbed → falls back to ContentSpread |
| `Appendix.svelte` | `title`, `table-full`, `footnote` | ⬜ Stubbed → falls back to ContentSpread |

### Display Components (6 of ~11 built)

| Component | Placement variants | Status |
|---|---|---|
| `Headline.svelte` | `headline`, `title`, `subtitle` | ✅ |
| `Eyebrow.svelte` | `eyebrow`, `upper-left`, `header`, `label` | ✅ |
| `BodyCopy.svelte` | `body`, `body-left`, `body-right`, `summary`, `caption`, `overlay` | ✅ |
| `StatBlock.svelte` | `upper-right`, `sidebar`, `col-left`, `col-right` | ✅ |
| `ImageFill.svelte` | `visual`, `chart-full`, `chart` | ✅ — renders placeholder when no `src` |
| `Footnote.svelte` | `footer`, `source`, `footnote` | ✅ |
| `Logo.svelte` | `logo` | ⬜ Aliased to ImageFill |
| `SectionLabel.svelte` | `header`, `label` | ⬜ Aliased to Eyebrow |
| `DataChart.svelte` | `chart-full`, `chart`, `col-left`, `col-right` | ⬜ Aliased to ImageFill |
| `Table.svelte` | `table-full`, `body`, `body-left` | ⬜ Aliased to BodyCopy |
| `Subtitle.svelte` | `subtitle` | ⬜ Aliased to Headline |

### Resolvers

| File | Status | Notes |
|---|---|---|
| `resolveLayout.ts` | ✅ | Maps `(canvas, layoutName)` → Svelte component; stubs log a warning and fall back |
| `resolveComponent.ts` | ✅ | Maps component name strings → Svelte components; aliases in place for unbuilt ones |

### PageRenderer

**`src/lib/PageRenderer.svelte`** ✅

Wires a `PageDescriptor` into the correct canvas + layout + slot components. Uses Svelte 5 snippet props to pass rendered components into named layout zones. All known placements are enumerated explicitly (Svelte 5 doesn't yet support fully dynamic snippet spreading).

**Known caveat:** The snippet-prop pattern for hyphenated placement names (`upper-right`, `body-left`, `chart-full`) is non-standard in Svelte 5 — needs live testing to confirm correct prop passing. May require a wrapper object approach.

### Sample Deck

**`decks/hofh-sample.mdx`** ✅  
5 pages covering both canvases and multiple layouts:
- 16x9 `title-page` — cover
- 16x9 `split-left` — key finding with stat + image
- 16x9 `data-full` (dark theme) — chart placeholder
- letter `cover` — report cover
- letter `content-spread` — two-column findings

### Viewer UI

- Keyboard navigation (← → arrow keys)
- Click navigation (prev/next buttons)
- Page strip with canvas type + label labels
- Export PDF button (`window.print()`)
- Dark chrome shell with canvas area centered

---

## What's Left

### Priority 1 — Verify & Fix Core Runtime

These are likely to surface issues on first `npm run dev`:

- [ ] **Test hyphenated snippet props** in `PageRenderer.svelte` — `upper-right`, `body-left`, `body-right`, `chart-full` may need to be passed as a prop object rather than direct named props, since Svelte 5 doesn't support hyphenated prop names natively
- [ ] **Test parser round-trip** — load `hofh-sample.mdx`, confirm all 5 pages parse correctly with the right slot maps
- [ ] **Verify canvas scaling** — confirm ResizeObserver triggers correctly and pages render at correct pixel dimensions in the viewer
- [ ] **Fix `src/lib_old/` remnant** — the scaffold left a stale `src/lib_old/index.ts`; delete it

### Priority 2 — Remaining Layouts (5 stubs to build)

| Layout | Canvas | Key challenge |
|---|---|---|
| `SplitRight.svelte` | 16x9 | Mirror of SplitLeft — trivial |
| `TwoUp.svelte` | 16x9 | Equal columns, good for comparisons |
| `SectionIntro.svelte` | letter | Sidebar stat/pull-quote pattern |
| `DataPage.svelte` | letter | Chart + supporting copy below |
| `Appendix.svelte` | letter | Full-width table area |

### Priority 3 — Remaining Components (5 stubs to replace)

| Component | Notes |
|---|---|
| `Logo.svelte` | Accept `src` for image logo + text fallback; sized for `logo` zone |
| `DataChart.svelte` | Wrapper that accepts `src` (JSON) + `type` prop; initially a styled placeholder |
| `Table.svelte` | Structured data table with condensed print-ready styling |
| `SectionLabel.svelte` | Running header with page number support |
| `Subtitle.svelte` | Could stay as `<Headline placement="subtitle">` — decide if separate component is worth it |

### Priority 4 — PDF Export (Playwright)

Replace `window.print()` with a real server-side export:

- [ ] Install `playwright` + `@playwright/test`
- [ ] Create `src/routes/api/export/+server.ts`
- [ ] Render each page at its native canvas dimensions (1920×1080 or 816×1056)
- [ ] Merge into a single PDF with correct page sizes (mixed 16:9 and letter in one file is non-trivial — may need separate exports or a PDF merge step)
- [ ] Stream the file back as a download
- [ ] Add a loading state to the export button

### Priority 5 — Deck Navigation & File Loading

Currently hardcoded to the first `.mdx` file in `/decks/`. To improve:

- [ ] `/decks` index route — list all `.mdx` files with title + page count
- [ ] URL-based page state — `?page=3` so you can link to a specific slide
- [ ] Hot reload when `.mdx` file changes during development
- [ ] Drag `.mdx` file onto viewer to load it (nice-to-have)

### Priority 6 — Authoring Quality of Life

- [ ] **Dev-time placement validation** — warn in the browser console when a component is placed in a slot the active layout doesn't define
- [ ] **Mdsvex integration** — currently parsing component tags manually with regex; wiring up actual `mdsvex` would let markdown syntax (`**bold**`, `- lists`) render inside `<BodyCopy>` children naturally
- [ ] **Theme system** — first real client deck will drive what tokens need overriding; extract a `theme-[name].css` pattern at that point
- [ ] **`decks/` watcher** in dev mode — auto-reload on `.mdx` save

### Priority 7 — Print CSS Polish

- [ ] Per-canvas `@page` rules (`size: 1920px 1080px` for 16:9; `size: letter` for letter)
- [ ] Hide viewer chrome (toolbar, page strip) in print media
- [ ] Test browser print output in Chrome and Safari
- [ ] Bleed/margin handling for decks that go to professional print

---

## Known Issues & Caveats

**Hyphenated snippet props** — Svelte 5 prop names must be valid JS identifiers. Placements like `upper-right`, `body-left`, and `chart-full` are passed as props with hyphenated names, which is technically invalid. This is the most likely thing to break on first run. Fix options: (a) use camelCase internally (`upperRight`) and map from the hyphenated MDX prop, or (b) pass a `slots` object prop to the layout component and destructure inside.

**`PageRenderer` snippet enumeration** — All placement names are listed explicitly in `PageRenderer.svelte`. Adding a new placement to a layout requires adding it to `PageRenderer` too. This is a known limitation of Svelte 5's static snippet model — document it clearly as a contributor note.

**Mixed canvas PDF** — A single deck can mix 16x9 and letter pages (as the sample does). Playwright can handle this but requires setting `pdf.width`/`pdf.height` per page rather than globally. This makes the export endpoint more complex than a simple loop.

**gray-matter + mdsvex** — Currently using `gray-matter` for frontmatter parsing only. `mdsvex` is installed but not yet wired into the Svelte config. Full mdsvex integration (so that markdown in component children renders as HTML) is deferred to Priority 6.

---

## File Tree (current)

```
patiently-layouts/
├── decks/
│   └── hofh-sample.mdx              ✅ sample deck (5 pages)
├── src/
│   ├── app.html
│   ├── lib/
│   │   ├── PageRenderer.svelte       ✅
│   │   ├── assets/
│   │   │   └── favicon.svg           ✅
│   │   ├── canvas/
│   │   │   ├── Canvas16x9.svelte     ✅
│   │   │   └── CanvasLetter.svelte   ✅
│   │   ├── components/
│   │   │   ├── BodyCopy.svelte       ✅
│   │   │   ├── Eyebrow.svelte        ✅
│   │   │   ├── Footnote.svelte       ✅
│   │   │   ├── Headline.svelte       ✅
│   │   │   ├── ImageFill.svelte      ✅
│   │   │   ├── StatBlock.svelte      ✅
│   │   │   └── resolveComponent.ts   ✅ (with stubs/aliases)
│   │   ├── layouts/
│   │   │   ├── resolveLayout.ts      ✅ (with stubs/fallbacks)
│   │   │   ├── 16x9/
│   │   │   │   ├── TitlePage.svelte  ✅
│   │   │   │   ├── SplitLeft.svelte  ✅
│   │   │   │   ├── DataFull.svelte   ✅
│   │   │   │   ├── SplitRight.svelte ⬜ not built
│   │   │   │   └── TwoUp.svelte      ⬜ not built
│   │   │   └── letter/
│   │   │       ├── Cover.svelte      ✅
│   │   │       ├── ContentSpread.svelte ✅
│   │   │       ├── SectionIntro.svelte  ⬜ not built
│   │   │       ├── DataPage.svelte      ⬜ not built
│   │   │       └── Appendix.svelte      ⬜ not built
│   │   ├── parser/
│   │   │   └── parseDeck.ts          ✅
│   │   └── tokens/
│   │       ├── base.css              ✅
│   │       ├── 16x9.css              ✅
│   │       └── letter.css            ✅
│   └── routes/
│       ├── +layout.svelte            ✅
│       ├── +page.server.ts           ✅
│       └── +page.svelte              ✅ (viewer)
├── svelte.config.js                  ✅
├── package.json                      ✅
└── vite.config.ts                    ✅
```

**Completion: ~55%** of the full spec. The skeleton, token system, parser, and viewer are solid. What remains is mostly additive — layouts, components, export, and polish.