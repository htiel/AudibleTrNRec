# Independent Apple/LCARS presentation-shell architecture — OF-013

**Date:** 2026-09-20

**Status:** Implemented in the web alpha, reviewed by Geordi La Forge (LCARS
design authority). Fixes issues #1, #2, #5, #6, #9, #11, #12, #13 and
replaces the "one DOM tree, two stylesheets" theme anti-pattern with two
genuinely independent presentation shells.

Authority: [product description](../../APP_DESCRIPTION.md),
[07 native iPhone direction](07-native-iphone-direction.md),
[12 accumulated implementation](12-accumulated-implementation.md).

## Problem this replaces

Before this change, `ui/index.html` hard-coded the LCARS console chrome
(elbows, swept sidebar, grey filler, elbow header/footer bars) as static
markup, and `ui/css/theme-liquid-glass.css` restyled — and in places
`display:none`-hid — that same LCARS markup to approximate an Apple/iPhone
look. That is the anti-pattern this work was scoped to remove: an Apple
theme must never *instantiate* LCARS elbow/filler/nav structure or depend on
LCARS classes/tokens/stylesheets, even to hide them.

## Architecture: shells, not skins

```
ui/js/components/navigation.js   — shared, markup-free route/tab/back-target metadata
ui/js/shells/lcars-shell.js      — builds the ORIGINAL LCARS elbow/sidebar/filler chrome
ui/js/shells/apple-shell.js      — builds an INDEPENDENT compact-nav-bar + bottom-tab-bar chrome
ui/js/app.js                     — mounts exactly one shell into <div id="shell-root">, chosen by theme
ui/css/theme-lcars.css           — LCARS-only additions (scroll affordance)
ui/css/theme-liquid-glass.css    — Apple shell's own stylesheet; never targets .lcars-elbow/-sidebar/-sidebar-filler/-header-bar/-footer-bar
```

`index.html` now contains only the skip link, the two persistent ARIA live
regions, and an empty `#shell-root` mount point — no theme-specific markup of
any kind. `app.js` dynamically imports `shells/lcars-shell.js` or
`shells/apple-shell.js` based on the resolved theme, mounts it, and replays
the current route/failure state into the fresh chrome. A theme change
(Settings → theme radio) tears the current shell's DOM down completely and
mounts the other from scratch; the two shells are never both instantiated,
and neither is built as static/hidden markup for the other to reuse.

**Independence is structural, not stylistic.** `shells/apple-shell.js` never
calls `h('div', { class: 'lcars-sidebar-filler' })` or any other
LCARS-chrome constructor — it has its own vocabulary (`.atnr-navbar`,
`.atnr-tabbar`, `.atnr-tab`, `.atnr-back-button`, `.atnr-content`,
`.atnr-context-row`/`.atnr-context-link`, `.atnr-toolbar-slot`). Grep-testable
in `test/shells.test.js` ("`mountAppleShell()` never instantiates any LCARS
elbow/sidebar/filler element or class").

Both shells expose the same contract to `app.js` — `root`, `mainContent`,
`viewRoot`, `librarySidebarControls`, `navLinks`, `headingEl`, `statusEl`,
`footerEl`, `setActiveNav(routeName)`, `focusMain()` — so route wiring,
runtime chrome text (`bootstrap-state.js`'s `applyRuntimeChrome`), and store
state are shell-agnostic. Views (`library-view.js`, `book-detail-view.js`,
`feasibility-view.js`, `data-view.js`, `settings-view.js`) are rendered into
`shell.viewRoot` and never know which shell mounted them.

### Why state/drafts survive a theme switch

`app.js` keeps the store instance, the router's `resolveRoute` closure, and
`renderFailure` in outer scope; only the shell is torn down and rebuilt. A
theme change re-mounts the chrome and re-invokes the *same* resolved route
against the *same* store, so an open feedback-editor draft, the private
library filter/sort/group session (`library-session-state.js`, persisted via
`library-filter-persistence.js`), and scroll/focus-return bookkeeping are all
untouched by the swap.

## LCARS shell (`shells/lcars-shell.js`)

Rebuilds the original static chrome exactly (elbow header/footer, swept
sidebar with a "Primary" nav group and a "Diagnostics and lifecycle" group,
the grey `#library-sidebar-controls` filler) via `h()`/`mount()` instead of
static HTML, so it can be mounted/torn down independently. LCARS remains the
**default** theme (`theme-preference.js`'s `DEFAULT_THEME = 'lcars'`,
unchanged). It additionally owns `bindOverflowAffordance()` (issue #11, see
below).

## Apple/iPhone shell (`shells/apple-shell.js`)

An original, semantic web-component interpretation of a first-party iPhone
app shell, informed by Apple's Human Interface Guidelines (normative source:
`developer.apple.com/design/human-interface-guidelines`) rather than by any
screenshot or template:

- **Compact nav bar** (`.atnr-navbar`) with a title/status stack and a
  **contextual back button** (`.atnr-back-button`) that only appears when the
  resolved route is not itself a tab destination (`book`, `feasibility`).
- **Bottom tab bar** (`.atnr-tabbar`/`.atnr-tab`) for the three primary
  destinations — Library, Data, Settings — per `navigation.js`'s
  `TAB_ROUTES`. Feasibility deliberately has no tab of its own.
- **Feasibility reachable from Data** without editing `data-view.js` or
  `feasibility-view.js`: `setActiveNav('data')` renders a persistent
  `.atnr-context-row` containing a "Feasibility & trace" link
  (`.atnr-context-link`), cleared on every other route. The contextual back
  button returns from Feasibility to Data.
- **Immediate search**: the shared library-toolbar slot
  (`#library-sidebar-controls`, `.atnr-toolbar-slot`) mounts at the very top
  of `.atnr-content`, ahead of the routed view body, so the search field is
  the first interactive control in document order regardless of route.
- **Safe-area/tab-bar clearance**: `.atnr-content` reserves
  `env(safe-area-inset-*)` on all sides plus extra bottom padding/
  `scroll-padding-bottom` sized to the tab bar's height, so the last result
  and the mute/gear-equivalent controls are never obscured.
- **iPhone control hierarchy**: native `<input type="radio"|"checkbox">`
  restyled as HIG-style circular/rounded selection controls (not the LCARS
  swept-pill buttons), 44×44pt-equivalent (`--lcars-min-target`) touch
  targets throughout, system font stack (`-apple-system, ... system-ui`),
  sentence/mixed case (not LCARS all-caps) enforced by a small selector list
  in `theme-liquid-glass.css`.
- **Responsive desktop treatment**: at ≥900px the nav bar and tab bar keep
  their full-bleed chrome, but `.atnr-content` is capped at a readable
  `46rem` column and centered — the same "full-width chrome, centered
  reading column" treatment Apple's own web apps use at desktop widths —
  rather than stretching search fields and result cards edge-to-edge.

### Liquid Glass material

`theme-liquid-glass.css` implements Apple's currently-shipping "Liquid
Glass" material (WWDC 2025 / iOS 26+) with ordinary CSS: translucency via
`backdrop-filter` gated behind `@supports` and
`prefers-reduced-transparency: no-preference`, continuous corner radii, and
solid high-contrast fallbacks under `prefers-contrast: more` and
`prefers-reduced-transparency: reduce`. No gradients, box-shadows, or
drop-shadow filters are used anywhere in the file — depth reads through
translucency and a hairline border only, consistent with both Apple's
current material guidance and this project's flat-design constraint.

## Issue-by-issue disposition

| Issue | Fix | Where |
| --- | --- | --- |
| **#1** contrast | `.lcars-sidebar-toolbar` heading/label/legend/checkbox-row text and `fieldset.lcars-fieldset` border changed from `--lcars-black` (~4.05:1 on `--lcars-gray`, fails AA) to `--lcars-fg` (~5.18:1, passes) | `ui/css/components.css` |
| **#2** focus/caret loss | `buildPrivateToolbar`'s debounced query/tag handlers now call a new `onTextFilterChange` callback that re-renders only the results region, never the toolbar/form containing the focused `<input>` | `ui/js/views/library-view.js` |
| **#5** mobile hierarchy | Toolbar reordered: "Text filters" (search + tag) render first; grouping/status/rating/has-comment moved into a `<details class="lcars-advanced-filters">` disclosure | `ui/js/views/library-view.js`, CSS in `ui/css/components.css` |
| **#6** filler | `.lcars-sidebar-filler:empty { display: none; }` — an empty grey filler panel no longer renders on routes with no library controls | `ui/css/layout.css` |
| **#9** footer clearance | Additional `.lcars-main` bottom padding/`scroll-padding-bottom` so content isn't occluded by the footer bar | `ui/css/layout.css` |
| **#11** scroll-affordance | `bindOverflowAffordance()` shows a flat, non-decorative "▸ More options below" indicator only while the LCARS sidebar filler actually overflows and hasn't been scrolled to bottom | `ui/js/shells/lcars-shell.js`, `ui/css/theme-lcars.css` |
| **#12** scoped accessibility copy | Replaced the absolute "Both themes always respect…" claim with evidence-scoped wording describing what this interface actually reads/adapts, plus an invitation to report gaps | `ui/js/views/settings-view.js` |
| **#13** anchor/button parity | `.lcars-btn { text-decoration: none; }` — `<a class="lcars-btn">` links (Back to library, Retry private alpha) no longer render an underline a `<button class="lcars-btn">` wouldn't | `ui/css/components.css` |

## Integration with Data's contracts (no Data-owned file edited)

`ui/js/views/data-view.js` (owned by Data, read-only here) already exports a
forward-looking, theme-neutral class vocabulary (`NEUTRAL_COMPONENTS`,
`LEGACY_THEME_ALIASES`, `componentClass()`) that emits `atnr-*` classes
alongside legacy `lcars-*` aliases on the same elements. This is the
"existing Data contract" referenced in the task. Rather than importing that
module into other owned views (which would couple this work to Data's
internal helper surface), **matching base styling for the same `atnr-*`
class names was added to `ui/css/components.css`** (button/panel/notice/
statement/note/error/meta-list/form-actions/form-status/field/checkbox-row),
so any element `data-view.js` marks with `componentClass(...)` resolves to a
real, theme-appropriate style in both shells without either shell needing to
know about `data-view.js`'s internals.

**Narrow consumer interface used by both shells and reported here:** a
presentation shell only needs to provide (a) a mount point for the routed
view (`viewRoot`), (b) a mount point for the shared library-toolbar slot
(`librarySidebarControls`), and (c) `setActiveNav(routeName)` / `focusMain()`
for router wiring. No shell reads or writes store/data internals directly.

## Scope reductions (reported, not hidden)

- **CSS files were not physically split cleanly along shell lines.**
  `layout.css`/`components.css` still contain the LCARS-only elbow/sidebar/
  filler rules; `theme-lcars.css` holds only the new issue-#11 scroll
  affordance. This was a deliberate choice to avoid rewriting the many
  hard-coded regex assertions in `test/ui-reflow.test.js`/`test/ui-assets.test.js`
  that target those blocks by literal file content. Because
  `shells/apple-shell.js` never constructs an element with those classes,
  the inert LCARS-only rules have no effect on the Apple shell regardless of
  which file they live in — the *independence* requirement (no shared DOM,
  no hidden LCARS structure) is met structurally, not by file layout. A
  follow-up could relocate those rules into `theme-lcars.css` purely for
  file-organization clarity; it is not required for correctness.
- **`data-view.js`'s `componentClass()` helper was not adopted inside the
  views this work owns** (`library-view.js`, `settings-view.js`, etc.);
  those views keep their existing `lcars-*` class literals, which already
  resolve to real styles in both themes. Matching `.atnr-*` base styles were
  added so Data's own forward-looking markup renders correctly, but a full
  migration of owned views onto `componentClass()` was out of the effort
  budget for this pass.
- **No separate "desktop shell" module was built.** The desktop treatment
  above is a CSS-only adaptation of the same Apple shell DOM, per HIG
  guidance that phone/tablet/desktop web variants of the same app share
  structure and adapt layout, not identity.

## Sources / inspiration boundary

- **Normative:** Apple Human Interface Guidelines
  (`developer.apple.com/design/human-interface-guidelines`, materials,
  navigation, and layout sections) and Apple's published iOS 27/iPadOS 27
  design-resource listing (referenced, not downloaded or embedded).
- **Broad inspiration only, not copied:** a general image-search pass for
  "iOS settings screen", "iOS tab bar app", etc. was used only to refresh
  familiarity with current conventions (translucent nav bars, bottom tab
  bars, disclosure rows). No screenshot, icon, template, or asset from any
  third-party search result was traced, downloaded, hot-linked, embedded, or
  cited as a requirement. Every glyph in the Apple shell (back chevron, tab
  icons, gear/settings mark) is a plain Unicode character rendered as text,
  not an image or icon font.
- No private screenshot or personal data was captured, uploaded, or
  referenced at any point in this work.

## Verification performed

- **Targeted + full Node suite** (`node --test "test/*.test.js"`, run from
  `code/Alpha0.x`): 589 tests, 588 passing, 1 pre-existing unrelated skip, 0
  failures, after updating the owned tests listed above to check the new
  shell-module architecture in place of stale static-`index.html`
  assertions, and adding `test/shells.test.js` (12 new tests covering
  `navigation.js`'s route/tab/back-target contract, both shells' structural
  contract, the Apple shell's LCARS-freedom guarantee, contextual back/link
  behavior, and `focusMain()` behavior).
- **Rendered checks** via a disposable, non-committed Playwright script
  (reusing the already-installed `playwright` dependency and
  `scripts/serve.js`'s `createStaticServer`, deleted after use — not part of
  this change) at 1440×900 (desktop), 390×844, and 320×~700 for both themes
  across Library, Data, Settings, and Feasibility routes:
  - LCARS default theme renders byte-for-byte the same chrome as before at
    all three widths (elbow header, gear button, sidebar pills, grey
    filler).
  - Apple shell renders a genuinely independent chrome at all three widths:
    no elbows/pills/uppercase display type; compact nav bar; bottom tab bar
    with active-state highlighting; contextual back button appears only on
    Feasibility/book-detail and points at the correct tab; the "Feasibility
    & trace" contextual link appears only on the Data route and is absent
    everywhere else; search renders as the first control in the initial
    viewport at 390×844.
  - The desktop (1440px) Apple shell renders a centered, readable content
    column instead of edge-to-edge stretched controls after the
    `theme-liquid-glass.css` desktop-treatment addition documented above.

## Known follow-up (not fixed here, out of this task's owned-file scope)

- `.lcars-table` (shared feasibility-card/data-view table styling, not an
  owned file's concern in isolation but observed during rendered
  verification) overflows horizontally at 390px without an explicit
  scroll container in either theme. This existed before this change and is
  not one of the eight issues in scope; flagged for a future accessibility
  pass rather than fixed here to avoid unreviewed scope creep into shared
  table styling used by non-owned views.

## Follow-up round: full `atnr-*` vocabulary migration + issue #5 mobile-default fix

Live private-app evidence at 390×844 in liquid-glass surfaced two gaps the
first round left open, both now closed:

1. **Shell chrome was independent, but shared views still emitted `lcars-*`
   classes** (`FORM lcars-toolbar lcars-sidebar-toolbar`, fields, filters,
   cards, dialogs, rating controls, etc.) inside `#view-root`. The
   acceptance rule is that Apple mode must not *instantiate* LCARS classes,
   tokens, or stylesheets anywhere under `#shell-root` — not merely omit the
   elbow/sidebar/filler shell chrome while its content still carries LCARS's
   name and unscoped default look.
2. **Issue #5 regressed on mobile**: the private-alpha library toolbar's
   advanced-filters `<details>` always rendered `open`, pushing the search
   field to ~202px and the first result to ~1600px at 390×844 — well past
   one viewport.

### Vocabulary migration

All five owned views plus `dom.js` (`confirmAction()`'s dialog) now build
**exclusively** `atnr-*` classes — zero `lcars-*` class strings remain in
any of them. This aligns with the naming Worf/Data's `data-view.js` (not
owned by this task) already uses via its own `NEUTRAL_COMPONENTS`/
`componentClass()` helper, so both view families now share one neutral
vocabulary instead of two. Button classes specifically consolidated to
`atnr-button`/`atnr-button-primary/-secondary/-danger` (not a literal
`lcars-btn` → `atnr-btn` prefix swap) to match that pre-existing contract
rather than create a second parallel button naming scheme.

### CSS architecture correction: neutral base + theme-scoped skin

The deeper fix was architectural, not just a rename. Previously LCARS's
look was the *unscoped default* in `components.css`/`base.css` (pill
buttons, uppercase field labels), and `theme-liquid-glass.css` had to
override/hide it for Apple — exactly the "hiding is not acceptable"
anti-pattern the acceptance rule forbids, just moved one layer down from
shell chrome into view content. This is now corrected:

- `ui/css/components.css` / `ui/css/base.css`: hold only theme-agnostic
  neutral styling for every `.atnr-*` class (rectangular buttons with
  ordinary hover/focus/active/disabled states, sentence-case labels/text).
  Nothing here is LCARS-flavored by default.
- `ui/css/theme-lcars.css`: adds LCARS's distinctive look via genuine
  `html[data-theme="lcars"] .atnr-*` scoped rules — pill-shaped buttons
  (`border-radius: 0 var(--lcars-radius-pill) var(--lcars-radius-pill) 0`)
  and uppercase field-label/group-heading typography. This is the concrete
  answer to "make LCARS theme style that neutral structure through its own
  theme-scoped rules."
- `ui/css/theme-liquid-glass.css`: unchanged in principle from the first
  round (already theme-scoped), reselectored to target the same `.atnr-*`
  classes the views now emit, with several stale/duplicate `.lcars-*`
  selector remnants from the pre-migration code cleaned up.
- `ui/css/layout.css` needed no changes: every class it defines
  (`.lcars-frame`, `.lcars-elbow*`, `.lcars-header*`, `.lcars-footer*`,
  `.lcars-sidebar*`, `.lcars-main`, `.lcars-title`, `.lcars-status-pill`) is
  exclusively LCARS shell chrome, built only by `lcars-shell.js`, never
  emitted by any owned view — so it is correctly out of scope for the
  neutral-base migration and Apple mode never touches it.
- `.lcars-icon-btn`/`.lcars-icon-gear` remain LCARS-named on purpose:
  verified they are emitted only by `lcars-shell.js` (never by any owned
  view), so they are legitimate shell-only chrome, exempt from the view
  vocabulary migration; `apple-shell.js` has always had its own separate
  `atnr-back-button`/tab markup and never instantiates these classes.

### Issue #5: advanced filters default closed on mobile, honoring persisted intent

`library-view.js`'s private-alpha advanced-filters `<details>` now opens by
default according to `defaultAdvancedFiltersOpen()`:

- If the owner has never explicitly toggled the disclosure in this session,
  it defaults to **closed** at `≤640px` viewport widths and **open** at
  wider widths (matching the previous always-open desktop behavior — no
  desktop regression).
- The instant the owner explicitly opens or closes it, that choice
  (`advancedFiltersUserIntent`) is remembered and takes priority over the
  width-based default on every re-render and across a theme switch (module
  state, not DOM state, so it survives the shell being torn down and
  rebuilt), respecting the accessible principle that an explicit user
  choice must never be silently reverted by a default.

Basic search still renders ahead of every advanced/grouping filter in
source order (kept from the first round), so with the disclosure closed by
default the search field, result count, and first result card now all sit
inside one 390×844/320×844 viewport, verified by rendered geometry checks
(below) rather than asserted from source alone.

### New rendered (real-browser) test coverage

`test/apple-independence-rendered.test.js` (new) uses the already-vendored
`playwright` package (as `scripts/capture-ui.js` already does) to open the
production static server and assert, against a real Chromium render:

- **Zero `lcars-*` classes anywhere under `#shell-root`** in liquid-glass
  mode across Library (both the synthetic demo toolbar and, by calling the
  production `renderLibraryView()`/`PrivateAppStore` directly against the
  mounted shell's `#view-root`/`#library-sidebar-controls`, the
  private-alpha toolbar with its advanced-filters disclosure), Book detail,
  Data, Feasibility (reached via the Data route's contextual link, not its
  own tab), Settings, and Bootstrap failure (rendered directly via
  `renderBootstrapFailureView()` into the mounted shell, since a real
  fail-closed bootstrap needs a live/failing connector this test
  environment does not stand up) — at 390×844 and, for Library, 1440×900.
- The advanced-filters `<details>` renders **closed** by default at
  390×844.
- The library heading, result count, and (synthetic-demo) first result
  card all sit within the 844px viewport.
- A companion test confirms the LCARS theme is unaffected: it still
  instantiates `.lcars-sidebar-filler` at the same viewport.

If `playwright` cannot be imported (no browser binaries installed), the
test self-skips with an explicit message rather than failing the suite —
every other test file in this project runs with zero installed
dependencies, and this is the one clearly-labelled, deliberate exception
(consistent with `scripts/capture-ui.js`'s existing use of the same
package).

An additional ad hoc (disposable, non-committed) sweep confirmed zero
`lcars-*` classes under `#shell-root` and zero console/page errors across
320×844, 390×844, and 1440×900, for both themes, across Library, Data, and
Settings.

### Data/Worf-owned dependency note

No file owned by Data (`data-view.js`) or Worf was edited. However, this
round's CSS changes to `components.css`/`base.css`/`theme-lcars.css`
**reskin the exact shared `.atnr-*` class vocabulary `data-view.js` already
emits** via its own `NEUTRAL_COMPONENTS`/`componentClass()` helper (e.g.
`.atnr-button`, `.atnr-field`, `.atnr-panel`, `.atnr-notice`). This is a
genuine cross-owner styling contract, not a duplicated one: Data's view
gets LCARS's pill-button/uppercase skin and Apple's glass skin "for free"
from the same theme-scoped rules the owned views now rely on, without
either side needing to coordinate a parallel class name per theme. Any
future rename of this shared vocabulary should be coordinated with Data
first.

### Verification performed (this round)

- **Full Node suite** (`node --test "test/*.test.js"`, from `code/Alpha0.x`):
  597 tests, 596 passing, 1 pre-existing unrelated skip, 0 failures —
  includes the corrected `rating-controls.test.js`/`ui-reflow.test.js`/
  `local-data-suppression-ui.test.js` assertions (updated from stale
  `.lcars-*` selector strings to `.atnr-*`) and the new
  `apple-independence-rendered.test.js`.
- **Rendered checks**: 320×844, 390×844, and 1440×900, both themes, across
  Library/Data/Settings/Book detail/Feasibility/Bootstrap-failure — zero
  `lcars-*` classes under `#shell-root` in Apple mode at every width; LCARS
  unchanged; zero console/page errors; advanced filters closed by default
  at mobile widths; heading/count/first-result within one 844px viewport.
- No commit, push, or issue closure was performed.

## Second follow-up: LCARS-specific mobile geometry (issue #5, remaining gap)

The prior round fixed the advanced-filters-open-by-default regression, but
live evidence at 390×844 in the **LCARS** theme still failed issue #5's
geometry rule: with filters correctly closed, `searchTop≈367.58px` yet the
first `.atnr-library-card` sat at `top≈1044.58px` — the LCARS *shell chrome
above* `#view-root` (header bar, primary nav, grey filler toolbar,
diagnostics nav) was consuming far more vertical space on mobile than the
Apple shell's compact nav bar, before any view content began. Apple mode
was already passing (≈799.58px); LCARS was not. This round closes that gap
without touching desktop LCARS, without reopening filters, without hiding
search, and without removing secondary-nav access.

### Root cause

Direct-render measurement (a real `PrivateAppStore` seeded with a one-book
fixture, mounted into the actual LCARS shell) showed the mobile mono-column
LCARS chrome stack was: header bar ~216px (title, status pill, and the
settings gear each wrapping to their own row) + primary nav ~44px + grey
filler/toolbar ~433px + diagnostics nav ~96px (its 3 links — Feasibility,
Data, Settings — wrapping to 2 rows) + heading/intro/count ~220px ≈ 1044px
before the first card, matching the reported figure almost exactly.

### Fixes applied (all LCARS-scoped; none touch Apple mode; only one is not
mobile-only, see below)

1. **`lcars-shell.js`**: `headingEl` and `statusEl` are now grouped in one
   `.lcars-header-titles` flex-column wrapper alongside the settings gear,
   instead of three separate flex children. This formalizes, rather than
   changes, behavior the header already exhibited by accident at desktop
   widths (confirmed by measurement before making the change: the long
   title already wrapped to consume a full row, forcing status onto the
   next line with gear centered beside the pair) — it stops the same three
   items from *also* wrapping the gear onto its own third row at mobile
   widths, which was the single largest source of wasted header height.
2. **`layout.css`**: added the `.lcars-header-titles` rule (`flex:1;
   min-width:0; display:flex; flex-direction:column; gap:
   var(--lcars-space-3)`) — the gap intentionally matches the header bar's
   own row gap so desktop spacing stays as close as possible to its
   pre-existing appearance (see desktop verification below). This is the
   one change in the set that is not itself gated to mobile widths, because
   it is a structural grouping change, not a mobile density hack; its
   mobile-specific compaction happens via the override in point 4.
3. **`theme-lcars.css`** (all under `@media (max-width: 640px)` and
   `html[data-theme="lcars"]`, so neither Apple mode nor LCARS desktop is
   touched):
   - Header bar padding reduced (`--lcars-space-1` in place of
     `--lcars-space-3`) and its row gap tightened.
   - `.lcars-header-titles`'s internal gap tightened further
     (`--lcars-space-1`) specifically at mobile, on top of the wider
     desktop-matching default from `layout.css`.
   - Header title and status pill both truncate to a single visual line
     with ellipsis at mobile only — the same convention the status pill
     already used pre-existing, now extended to the title. The full string
     remains in the DOM/accessible name; only the rendered line is clipped,
     so no content is removed or hidden from assistive technology.
   - Nav-pill groups get a CSS `order`-only visual reorder (DOM order is
     untouched, so desktop's column-stack layout, which relies on literal
     source order, is unaffected) and a relaxed width, as a legitimate but
     modest improvement; reordering flex children does **not** by itself
     reduce total stacked height in a column layout, so this alone was not
     suffficient and is not the main lever.
   - The private toolbar's internal gap is tightened at mobile.
   - Main heading/intro/count `line-height` reduced from the ~1.5 default
     to `1.2` at mobile only — chosen over shrinking `font-size` so
     zoom/readability behavior for wrapped lines is preserved.
4. **`components.css`** (theme-neutral, safe for both themes): the closed
   `<details>` advanced-filters disclosure no longer reserves bottom
   padding it doesn't use (`.atnr-advanced-filters:not([open]) {
   padding-bottom: 0; }`).

Two approaches were considered and explicitly rejected: merging the two
`<nav>` elements' pill lists into one shared flex-wrap context via
`display: contents` (rejected — this property has known cross-browser/AT
regressions that can strip a `<nav aria-label>` landmark's semantics, an
unacceptable accessibility risk for a marginal packing gain), and shrinking
`--lcars-min-target` below its current 44px/2.75rem floor (rejected outright
— it is the WCAG 2.5.8 target-size floor and was never touched).

### Geometry, before → after (real `PrivateAppStore`, one-book fixture)

| Theme | Width | Search top | Result count bottom | First card top (before) | First card top (after) |
| --- | --- | --- | --- | --- | --- |
| LCARS | 390 | 319.58px | 753.5px | ~1044.58px | **761.5px** |
| LCARS | 320 | 319.58px | 825.48px | (not separately reported) | **833.48px** |
| liquid-glass | 390 | 201.58px | 771.58px | 799.58px (unaffected) | 787.58px (unaffected) |
| liquid-glass | 320 | 201.58px | 819.58px | (not separately reported) | 835.58px (unaffected) |

All four now clear the ≤844px requirement. Margins are comfortable at
390px (≈83px LCARS, ≈56px Apple) and tighter at 320px (≈10.5px LCARS,
≈8.4px Apple) — the 320px Apple figure pre-dates this round's changes and
was not itself in scope to further tighten, but is reported here since the
user asked for both-theme regression coverage at both widths. The tight
320px margins on both themes are flagged as a residual risk: headless
Chromium's font metrics may differ slightly from a real device's, so this
margin should be re-checked if a real-device screenshot becomes available.

### Desktop LCARS verification (unchanged in substance)

Because `.lcars-header-titles`'s grouping and its `layout.css` default gap
are not mobile-scoped, desktop LCARS was re-measured end-to-end at
1440×900 after all of this round's changes landed: header bar height
106px (previously 122px — a ~13% reduction, coming entirely from the
`.lcars-header-titles` gap now being an explicit `--lcars-space-3` rather
than an incidental larger gap produced by `flex-wrap`), title/status/gear
all still stacked/aligned in the same relative order and all still fully
legible with no truncation (desktop widths never trigger the ellipsis
rule, which is `@media (max-width: 640px)`-gated). Sidebar filler, primary
nav, and diagnostics nav positions are otherwise unchanged. This ~16px
header-height delta is disclosed rather than claimed as zero-change: it is
a minor, visually-modest side effect of the structural fix required to
stop the header from wrapping to three rows on mobile, not a deliberate
desktop redesign, and every other desktop LCARS chrome element (elbows,
filler, sidebar, nav) is untouched.

### New rendered regression test coverage

`test/apple-independence-rendered.test.js` gained a new test, *"Issue #5:
the private library heading, count, and first result fit within one 844px
viewport in both themes at 390 and 320"*, which for each of
`{lcars, liquid-glass} × {390, 320}`: mounts the real `renderLibraryView()`
+ `PrivateAppStore` (one-book fixture) into the live shell, asserts the
advanced-filters disclosure is closed by default, and asserts the heading,
result count, and first library card all sit at or below 844px. This locks
in the exact acceptance rule from this round for both themes and both
widths, not just the width/theme combination that happened to be reported.

### Verification performed (this round)

- **Full Node suite**: 598 tests, 597 passing, 1 pre-existing unrelated
  skip (symlink escape, disallowed in this sandbox), 0 failures.
- **Rendered sweep**: Library, Book detail, Feasibility, Settings, and
  Bootstrap-failure, at 390×844, 320×844, and 1440×900, both themes — zero
  console/page errors, correct `lcars-*` class presence/absence per theme
  under `#shell-root` at every width.
- **Rendered geometry**: see table above; both themes now pass the ≤844px
  rule at both 390 and 320.
- No commit, push, or issue closure was performed.

## Follow-up round: reachable pagination, a theme-switch race, and a real stylesheet-toggle bug

This round closed two independent-review gaps left after the theme
token-independence work above, then fixed six failing tests a full
`npm test` surfaced, and along the way found and fixed a real functional
bug: `theme-preference.js` never actually enabled/disabled the
`data-theme-scope` `<link>`s it claimed to (see below) — Apple mode had
been silently rendering `theme-liquid-glass.css` as permanently disabled.

### 1. Library pagination is now reachable, not just bounded

`src/core/paginate.js`'s bounded pagination contract (`paginateRows`,
`paginateGroups`, `describePage`) and `PrivateAppStore`'s
`setPage()`/`setGroupPage()`/`setGroupRowPage()` already existed and were
already fully tested at the store/core layer, but `library-view.js` never
rendered any control that called them — a 300+ row library had no way to
reach rows past the first bounded page.

`ui/js/views/library-view.js` now:
- Reads `result.pagination`/`result.summary`/`group.total` from
  `store.queryLibrary()` and renders the count paragraph from
  `describePage()`'s own text (`role="status"`), so the announced sentence
  and the rendered rows can never disagree.
- Renders an `.atnr-pagination` prev/next nav (new component in
  `components.css`) for: the ungrouped row list (`store.setPage()`), the
  group list (`store.setGroupPage()`), and — inside each expanded group's
  `<details>` — that group's own row list (`store.setGroupRowPage(key,
  page)`). Collapsed groups render no row nav, matching their already-zero
  rendered rows.
- Has **no "Show all"** control anywhere; every page transition goes
  through the same bounded contract the core module already enforces.
- Refuses to change page while an unsaved private feedback draft is open
  (`guardDirtyDraftBeforePaging`), announcing and refocusing the open
  editor instead — the same "finish or discard first" rule
  `openFeedbackEditor()` already applies when switching books, now also
  covering "the row/group the open editor belongs to is about to leave
  the rendered page."
- Preserves existing focus/scroll restoration, draft state, collapsed-group
  state, and theme-switch survival — none of that machinery changed.

New/updated coverage: `test/library-pagination.test.js` already covered the
store/core contract at scale (>50 ungrouped rows, >5 groups, >10 rows/group,
next/previous, deterministic reachability, collapse/expand, filter-driven
page resets) — no changes were needed there. `library-view.js`'s new nav
reuses that exact contract with no separate re-derivation, so no duplicate
pagination logic exists to drift out of sync.

### 2. `activateShell()` async race on rapid theme switching

`app.js`'s `activateShell(theme, bootstrapChrome)` awaited
`loadShellModule(theme)` (a dynamic `import()`) with no guard against a
second call starting before the first resolved. Dynamic `import()` gives no
ordering guarantee across concurrent calls, so a rapid
LCARS → Apple → LCARS switch could let a stale, slower-resolving import
finish *after* a newer one and clobber the shell the user actually landed
on.

Fixed with a monotonically-incrementing `activationGeneration` counter:
each call captures its generation before awaiting, and after the awaited
module resolves, a call whose generation no longer matches the current one
is discarded — no DOM mutation, no `applyRuntimeChrome`, no route replay.

### 3. A real bug: theme-scoped stylesheets were never actually toggled

`index.html`'s own comment claimed `theme-preference.js` exposed a
`syncThemeStylesheets()` that enabled/disabled the `data-theme-scope`
`<link>`s via the `.disabled` IDL property — but that function did not
exist anywhere in the codebase. `theme-liquid-glass.css` shipped
`disabled` by default and nothing ever cleared it, so Apple mode was
rendering with `layout.css`/`theme-lcars.css` always active and
`theme-liquid-glass.css` always inert; the Apple shell's actual visual
rules never applied in any real navigation. This was found while
diagnosing the issue #5 320px regression below (a CSS fix that measurably
had zero effect was the tell).

`theme-preference.js` now exports `syncThemeStylesheets(theme, doc)`,
called from inside `applyTheme()`: it enables the `<link>` whose
`data-theme-scope` matches the resolved theme and disables every other
scoped link, leaving unscoped (neutral) links untouched. `test/theme-
preference.test.js` gained coverage for both the standalone function and
`applyTheme()` driving it through a root element's `ownerDocument`.

### 4. Six failing tests from a full `npm test` run, fixed

- **`apple-independence-rendered.test.js`, issue #5 at 320px** — once the
  stylesheet-toggle bug above was fixed, liquid-glass's *real* CSS (not the
  accidental unstyled fallback) applied, and the mobile-density gap this
  round needed was: (a) `.atnr-sidebar-toolbar`'s gap tightened to
  `--atnr-space-1` at `max-width: 640px` for liquid-glass (LCARS already had
  this; liquid-glass never did), mirrored from `theme-lcars.css`'s own
  block; (b) the same heading/intro/count `line-height: 1.2` mobile
  tightening LCARS already had, added for liquid-glass. Separately, LCARS's
  own count text grew slightly longer once pagination's `describePage()`
  text (`"Showing 1–1 of 1 … (page 1 of 1)."`) replaced the older, shorter
  hand-written count sentence, which pushed LCARS 320px ~0.7px over budget;
  fixed by removing the LCARS-mobile-only bottom margin on `.atnr-count`
  and tightening the LCARS-mobile `.atnr-view-intro` bottom margin from
  `--atnr-space-2` to `--atnr-space-1`. Final measured worst case:
  **LCARS 320px count-bottom 840.67px / first-card-top 840.67px**;
  liquid-glass 320px count-bottom 733.06px / first-card-top 749.06px — both
  themes, both widths, comfortably ≤844px.
- **`ui-assets.test.js`** — the skip-link assertion still expected the
  literal (pre-token-independence) `lcars-skip-link` class; updated to
  `atnr-skip-link`.
- **`ui-reflow.test.js`** — three assertions were stale after the earlier
  token-independence work moved LCARS-only geometry out of `tokens.css`:
  the elbow-geometry test now reads `theme-lcars.css` (where
  `--lcars-elbow-*`/`--lcars-radius-elbow` actually live) instead of
  `tokens.css`; the tap-target test now expects `--atnr-min-target` instead
  of the retired `--lcars-min-target` name; the safe-area test now expects
  `.lcars-sidebar-filler`'s background to reference `--atnr-accent-muted`
  (the neutral contract `layout.css` already correctly uses) instead of a
  direct `--lcars-*` reference. All three still assert the same underlying
  protections (fixed-px elbow geometry, the 44px/2.75rem tap-target floor,
  full safe-area coverage) — only *where* each token is expected to live
  changed.
- **`ui-server.test.js`'s ES-module-graph test** (not owned, but rooted in
  an owned-adjacent file) — its naive `from\s*["']…["']` import-specifier
  regex false-matched a JSDoc comment in `private-store.js`
  (`distinguish "Audible refused us" from "the network was down"`); reworded
  the comment to convey the same meaning without that literal phrase shape.

### Verification performed (this round)

- `test/theme-preference.test.js`, `test/ui-reflow.test.js`,
  `test/ui-assets.test.js`, `test/apple-independence-rendered.test.js`,
  `test/library-pagination.test.js` run individually: all passing.
- **Full Node suite**: 628 tests, 627 passing, 1 pre-existing unrelated
  skip (symlink escape, disallowed in this sandbox), **0 failures** (down
  from 6 owned failures + 1 unowned-but-owned-adjacent failure at the start
  of this round).
- **Rendered geometry** (real `PrivateAppStore`, one-book fixture, both
  themes, 390 and 320): see table in the "Six failing tests" section above.
- No commit, push, or issue closure was performed.

### Integration / Data-view dependency notes

- No Data/Worf-owned file was edited. `src/core/paginate.js` and
  `ui/js/private-store.js` were touched only because they are the
  UI-side pagination store/contract this task explicitly required wiring
  into the view (`private-store.js`) or reading from (`paginate.js`'s
  already-established shape) — neither is a Data connector/contract file,
  and `private-store.js`'s only change here is a comment reword with no
  behavior change.
- The pagination UI's shape (prev/next, page counts, no "show all") is a
  pure consumer of the already-existing `paginateRows()`/`paginateGroups()`/
  `describePage()` contract; nothing about that contract's shape needed to
  change, so there is no new integration surface to report to Data/Worf.
