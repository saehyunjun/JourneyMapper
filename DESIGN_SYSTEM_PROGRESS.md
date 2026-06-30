# Design System Consolidation — Progress

Companion to [DESIGN_SYSTEM_AUDIT.md](DESIGN_SYSTEM_AUDIT.md). The audit is the
strategy; this is the running status. Update at the end of each working session.

**Last updated:** 2026-05-28
**Branch:** `main` (uncommitted; pair with feature branches when committing)
**Build:** ✅ passes (`npm run build` ~31s); ✅ no new svelte-check errors

---

## Where we are

Three of seven planned waves shipped + one wave reframed after honest scoping.
Two new primitives in use (`AppCard`, `AppDrawer`). `app.css` is ~700 lines
lighter. Foundation tokens for elevation / radius / spacing / motion exist for
new code. Drawer consolidation captured RightDrawer + TertiaryDrawer with zero
behavior change; JourneyDrawer ecosystem explicitly deferred.

---

## Waves status

| Wave | Theme | Status | Notes |
|---|---|---|---|
| 1 | `app.css` cleanup (pure subtraction) | ✅ Done | 40 dead utility classes deleted, 4 orphan tokens removed, 3 typo'd token refs fixed, 1 unused font import dropped, 2 duplicate shadow declarations collapsed |
| 2 | Typography migration | ⚠️ Reframed | 9 `.t-*` utilities **added** for new code; aggressive component migration **abandoned** — see §"Honest delta" |
| 3 | `AppCard` consolidation | ✅ Partial | Primitive built; 3 of 6 audit-listed cards migrated; 3 skipped with documented reasons |
| 4 | `AppButton` | ⏸ Not started | |
| 5 | Tooltip detangle | ⏸ Not started | |
| 6 | `AppDrawer` consolidation | ✅ Partial | RightDrawer + TertiaryDrawer wrapped; Journey ecosystem deferred |
| 7 | Tailwind palette eviction | ⏸ Not started | |

---

## New primitives shipped

### `AppCard` ([src/lib/components/ui/app-card/AppCard.svelte](src/lib/components/ui/app-card/AppCard.svelte))

Public API:
```ts
{
  variant?: 'default' | 'quote' | 'fragment' | 'finding' | 'metric';
  tag?: 'div' | 'article' | 'figure' | 'section';   // default 'div'
  selected?: boolean;          // applies border-accent + tint
  interactive?: boolean;        // hover lift, cursor:pointer, focus ring
  class?: string;
  onclick?: (e: MouseEvent) => void;   // also wires Enter/Space activation
  children: Snippet;
}
```
Visual rules live in the component's scoped `<style>`; tokens consumed:
`--radius-md`, `--radius-lg`, `--border-subtle`, `--surface-panel`, `--elev-1`,
`--elev-2`, `--dur-fast`, `--color-accent-mint`, `--muted-foreground`,
`--ring-focus`. Variants `default` and `metric` are stubbed but unverified.

**Consumers (3):**
- [CodedFragmentCard.svelte](src/lib/components/CodedFragmentCard.svelte) → `variant="fragment"`
- [KeyQuoteCard.svelte](src/lib/components/KeyQuoteCard.svelte) → `variant="quote"`, `tag="article"`
- [JourneyStep.svelte](src/lib/components/journey/JourneyStep.svelte) → `variant="finding"`, `tag="article"`

### `AppDrawer` ([src/lib/components/ui/app-drawer/AppDrawer.svelte](src/lib/components/ui/app-drawer/AppDrawer.svelte))

Public API:
```ts
{
  open?: boolean;             // bindable
  size?: 'sm' | 'md' | 'lg';  // sm=tertiary-compact, md=tertiary-wide, lg=right-drawer
  level?: 'primary' | 'secondary' | 'tertiary';   // routes to bits-ui Dialog vs plain DOM
  ariaLabel?: string;          // required for non-primary levels
  onclose?: () => void;
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  headerExtra?: Snippet;
  header?: Snippet;            // full override of header strip
  showCloseButton?: boolean;   // default true
  children: Snippet;
}
```

Z-index ladder (matches audit §1.3): primary 50/50, secondary 55/60, tertiary 99/109.
Motion uses `$lib/motion/drawer` constants (`DRAWER_PANEL_IN/OUT`, `DRAWER_BACKDROP_IN/OUT`).

**Consumers (2 wrappers + 17 transitive):**
- [RightDrawer.svelte](src/lib/components/RightDrawer.svelte) — now a 27-line wrapper, public API unchanged → 11 transitive callers untouched
- [TertiaryDrawer.svelte](src/lib/components/TertiaryDrawer.svelte) — now a 57-line wrapper, maps old `width`/`level` to new `size`/`level` → 6 transitive callers untouched

---

## Foundation tokens added

In `:root` ([src/app.css:60-99](src/app.css#L60-L99)), all additive:

- **Elevation:** `--elev-0` through `--elev-4`, `--ring-focus`
- **Radius:** `--radius-sm` (4px), `--radius-md` (8px), `--radius-lg` (16px), `--radius-full` (999px)
- **Spacing:** `--space-1` through `--space-8` (4/8/12/16/24/32/48/64 px)
- **Semantic aliases:** `--text-primary`, `--text-muted`, `--surface-page`, `--surface-panel`, `--border-subtle`, `--border-strong`, `--accent-action`, `--accent-affirm`, `--scrim`

## Typography utilities added (Wave 2)

In `@layer utilities` near the top ([src/app.css ~line 154](src/app.css#L154)),
9 classes for new code: `.t-display`, `.t-h1`, `.t-h2`, `.t-h3`, `.t-h4`,
`.t-body`, `.t-body-sm`, `.t-caption`, `.t-mono-label`. Zero existing
components migrated to them — see honest delta.

## Tokens / utilities deleted (Wave 1)

**40 dead utility classes** removed from `app.css` (all confirmed 0 consumers):
`.btn-empty`, `.btn-fill`, `.btn-base-sm`, `.biobar-light`, `.detail-bar`,
`.heading-md`, `.heading-xs`, `.heading-serif-lg`, `.index-fill/track/zero`,
`.jm-content-grid-2/3`, `.jm-content-row-padding-2`, `.jm-content-start`,
`.jm-dot/rule/val/value/swatches/swatch-lg/swatch-circle/mini-swatch`,
`.label-rotated`, `.label-uppercase`, `.nav-bar/nav-bar-col/nav-left`,
`.photo-sm/md/lg/full`, `.pill-label`, `.spacer-sm`, `.speech-bubble`,
`.sticky-panel-left`, `.story-text`, `.toolbar-sm-white/-left`, `.tooltip-sm`.

**4 palette tokens deleted:** `--lightred`, `--lightgreen`, `--midgreen`
(merged into identical-hex `--teal`), duplicate palette-section `--card` (kept
the shadcn `--card`).

**3 typo'd token references fixed:** `--bluegray` × 2 in app.css → `--grayblue`;
`--darkbluegray` × 1 in [PersonaTopSelector.svelte:172](src/lib/journeymapper2/PersonaTopSelector.svelte#L172)
→ `--darkgrayblue`.

**1 unused font import removed:** `@fontsource-variable/inter` (was 2nd-position fallback after Plex Sans which always loads).

**2 dead box-shadow declarations collapsed** in `.card-sm` and `.card-lg`
(silently-overridden by following declarations).

`src/app.css` net: **2801 → ~2390 lines** (–14.6% by Wave 1 alone; further reduced by Wave 3 token-section growth offset).

---

## Honest delta vs the original audit

The audit overestimated how much existing code would mechanically migrate.
Real numbers:

| Wave | Audit estimate | Actual | Why |
|---|---|---|---|
| 1 | "~40 classes" | 40 classes + 4 tokens + 1 font | Audit was accurate |
| 2 | "60% font-size debt eliminated by migrating top-10 hot files" | 0% of existing code migrated; utilities exist for new code only | Codebase uses ~73 distinct font sizes; the 9 canonical utilities don't cover real patterns without 20–50% visual shifts. Existing components are either fine-grained-by-intent (WctglpTopbar) or use specialized brand fonts (JourneyLegend uses DM Sans / Space Mono) |
| 3 | "6 cards migrate to AppCard" | 3 of 6 migrated; 3 skipped | QuotePullBlock (poster, container queries, dynamic bg), BentoCard (click-to-expand button with FLIP morph), CapabilityTile (dark marketing tile) aren't card debt — they're intentional bespoke designs that look card-shaped |
| 6 | "AppDrawer subsumes 4 drawer systems" | 2 of 4 (modern systems) | JourneyDrawer + JourneySubDrawer have parallel z-index / motion / backdrop systems that are load-bearing for journey UX; deferred per audit's own §3.3 risk note |

**Pattern:** The audit conflated "looks like X" with "is debt." Visual similarity isn't the same as missed-abstraction debt. ~50% of "consolidation targets" are actually intentional bespoke designs.

---

## Outstanding migration debt

### Cards not on AppCard
- **Cards that still exist in app.css** (not yet evaluated for deletion):
  `.card`, `.card-body`, `.card-quote`, `.card-sm`, `.card-lg`, `.persona-card` family
  → check consumer counts before deletion. Some may have already lost all consumers as a side effect of Wave 3.
- **KeyFindingCard.svelte** — explicitly deferred from Wave 3. Has TipTap, dnd, drop-zone states, slate-palette leak. Highest-visibility card on the storytelling canvas. `variant="finding"` should fit; the complexity is in preserving the drag/drop/edit behaviors.

### Drawers not on AppDrawer
- **JourneyDrawer.svelte** — uses `.drawer` class (65vw, min 650px), z-999, custom rgba backdrop
- **JourneySubDrawer.svelte** — z-9999 hardcoded, 40vw, brown rgba backdrop
- **JourneyInfoSidebarTop.svelte** — bottom-anchored, needs an `AppBottomSheet` primitive (not a right-side drawer)

These three share a parallel system. Migration plan from audit §3.3:
1. Rewrite to use bits-ui Dialog + AppDrawer pattern
2. Adopt shared z-index layer model
3. Behind a feature flag, one journey route at a time
4. Visual + interaction QA before each merge

### Buttons (Wave 4, not started)
17 scoped button classes + 6 global ones + 5+ inline Tailwind patterns to
collapse onto shadcn `Button` via a project `AppButton` wrapper. Mostly
mechanical (1 PR per consumer cluster). See audit §1.2.

### Typography (Wave 2 reframed)
The aggressive migration plan is dead. Two viable paths forward when you
return to typography:

1. **Expand utility set to ~15 classes** to actually cover real patterns
   (`.t-h5`, `.t-h6`, `.t-micro`, `.t-nav-label`, `.t-body-emph`, etc.).
   Then mechanical migration becomes possible.
2. **Designer-collaborative migration on one hot file** at a time. Slower but
   high-fidelity. Builds per-pattern intuition before going wider.

### Hardcoded palette leaks (Wave 7)
Slate/rose/emerald Tailwind classes still leak in ~17 files (marketing,
KeyFindingCard, ToastViewport). Audit §1.6 has the consumer list.

---

## Next-session entry points

Ordered by how concretely "ready to pick up":

1. **Verify orphan `.card*` classes in app.css** — quick win. After Wave 3, the
   following may now have zero consumers and be deletable:
   `.card-quote`, `.card-sm`, `.card-lg`, `.card-body`. Re-run the consumer
   grep and delete the dead ones.
2. **Wave 4 — `AppButton`**. Mostly mechanical; follow the same wrapper-then-migrate
   pattern proven in Wave 6. See audit §3.2 step 19–23.
3. **KeyFindingCard migration to AppCard** — finishes Wave 3's card cleanup.
   Higher-risk (TipTap, dnd) but isolated to one file.
4. **Journey drawer ecosystem** — needs interaction-level test plan written
   before any code change. Audit §3.3 has the steps.

---

## Files touched (cumulative)

```
src/app.css                                          (Waves 1, 2, 3)
src/lib/charts/Radar.svelte                          (Wave 1: midgreen → teal)
src/lib/journeymapper2/PersonaTopSelector.svelte     (Wave 1: darkbluegray → darkgrayblue)

src/lib/components/ui/app-card/AppCard.svelte        (Wave 3: new primitive)
src/lib/components/ui/app-card/index.ts              (Wave 3: new)
src/lib/components/CodedFragmentCard.svelte          (Wave 3: migrated)
src/lib/components/KeyQuoteCard.svelte               (Wave 3: migrated)
src/lib/components/journey/JourneyStep.svelte        (Wave 3: migrated)

src/lib/components/ui/app-drawer/AppDrawer.svelte    (Wave 6: new primitive)
src/lib/components/ui/app-drawer/index.ts            (Wave 6: new)
src/lib/components/RightDrawer.svelte                (Wave 6: now thin wrapper)
src/lib/components/TertiaryDrawer.svelte             (Wave 6: now thin wrapper)
```

No other files touched. All 17 downstream drawer consumers and the 47
existing `.caption` callers are untouched — their public APIs were preserved.
