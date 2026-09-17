# Geordi La Forge — Alpha 0.0.1 UI/UX/Accessibility Review

**Commit reviewed:** `6145f98` ("Add private alpha Audible connector")
**Reviewer:** Geordi La Forge, LCARS design authority / accessibility gate
**Review target:** `code/Alpha0.x/ui/**`, `code/Alpha0.x/scripts/serve.js`
browser-facing behavior, and the UI-facing test suite
(`ui-*.test.js`, `ui-store.test.js` under `code/Alpha0.x/test/`).

---

## 0. Scope

Per `APP_DESCRIPTION.md` and the locked `planning/0.0.1/01-release-charter.md`
baseline, alpha 0.0.1 ships **only**:

- ATR-S008: a read-only, accessible "evidence inspector" over a
  synthetic/private-alpha library snapshot — sort, filter, group, book
  detail, feasibility card, and a clearly-labeled synthetic-only structural
  trace. No editable rating/comment/tag/favorite surface, no recommendation
  or feedback engine, no rich library navigation (facet detail pages) — all
  explicitly deferred (D01/D02/D04) per the charter's non-scope section.
- ATR-S009: lifecycle controls (manual refresh, induced-error demonstration,
  export, disconnect, delete-all) gated behind an explicit consent
  acknowledgment.
- The private-alpha connector surface added at this commit: connect/sync/
  disconnect/delete-local-snapshot controls and a runtime-profile disclosure
  panel in `data-view.js`.

This review evaluates only that shipped surface, not the deferred product
vision (ratings, facet detail pages, recommendations), which is correctly out
of scope for 0.0.1 and is not treated as a defect here.

### Tooling limitation (disclosed up front)

My available toolset in this session does not include an interactive browser
or screenshot capability, so I could not literally click through the shared
live page ID. I substituted the following, all non-destructive:

- Full source review of every file listed above.
- Running the existing automated test suite (`node --test "test/*.test.js"`)
  in `code/Alpha0.x` — **155 passed, 0 failed, 1 skipped** (the skipped test
  requires filesystem symlink creation, unavailable in this sandbox; not a
  product defect).
- Read-only `GET` requests against the already-running local server at
  `http://127.0.0.1:4310` (`/`, `/?private-alpha=1`, `/api/v1/status`) to
  confirm real response headers, routing, and connection state. I did **not**
  call `/api/v1/library` or any mutating endpoint, so no personal title,
  author, or narrator data was ever fetched, logged, or reasoned about below.
  The only fact carried forward from that call is a generic item count and
  connection/sync-timestamp state, consistent with the "no personal data in
  this report" constraint.
- Programmatic WCAG contrast-ratio computation against the exact hex values
  declared in `tokens.css`, using the standard relative-luminance formula, to
  verify claims precisely rather than by eye.

Where a finding below depends on rendered/interactive behavior I could not
directly observe (e.g., exact screen-reader announcement cadence), I say so
explicitly and mark the verdict accordingly.

---

## 1. Live evidence gathered (process-only, no personal data)

- `GET /?private-alpha=1` → `200`, security headers present exactly as
  declared in `serve.js` (`content-security-policy` with `connect-src 'self'`
  for private-alpha mode, `x-content-type-options: nosniff`,
  `referrer-policy: no-referrer`, `cache-control: no-store`, etc.).
- `GET /api/v1/status` → `200`, `ok:true`, confirms the private-alpha session
  is presently `connected`, reports a generic local item count and
  last-attempt/last-success sync timestamps, and `lastErrorCode: null`. No
  title, author, or narrator string was present in this response and none is
  reproduced here.
- The library route (`#/library`) is reachable and returns the app shell
  (`index.html`) unmodified regardless of hash fragment, confirming the
  hash-router's client-side-only routing model documented in `router.js`.

This confirms the app is live, connected, and serving the private-alpha
surface at the shared URL; the structural findings below are evidenced from
source and validated against the running server's actual headers/responses,
not merely inferred from static reading.

---

## 2. Verdict

**CONDITIONAL PASS.** The shipped ATR-S008/S009 surface is well-engineered
for accessibility relative to the alpha's own explicit scope: correct
landmarks, skip link, heading structure, text-based (never color-only)
provenance/unknown labeling, native `<dialog>` focus management, a
dependency-free DOM builder that structurally prevents markup injection, and
an automated regression-test suite that already encodes several of the exact
checks I would otherwise have to hand-verify (reflow, CSP, no-gradients, focus
visibility presence).

There is **one Must-fix accessibility defect** (focus-indicator contrast) that
must be resolved before this build is shown to any of the ten named private
alpha testers, because it degrades the single most safety-relevant keyboard
interaction in the app — confirming a focused **destructive** action
(Disconnect / Delete) before pressing Enter/Space. The Should-fix and
Suggestion items are real but do not block use by a sighted, keyboard-capable
user; they should be scheduled before this surface is promoted or its
component set is reused elsewhere.

---

## 3. Findings (severity-ranked, with exact source evidence)

### 3.1 [MUST-FIX / HIGH] Focus indicator is invisible-to-marginal against every colored button and nav-link background

**Evidence**

`code/Alpha0.x/ui/css/base.css:72-79`:
```css
:focus {
  outline: 3px solid var(--lcars-border-focus);
  outline-offset: 3px;
}

:focus:not(:focus-visible) {
  outline: 3px solid var(--lcars-border-focus);
  outline-offset: 3px;
}
```

`code/Alpha0.x/ui/css/tokens.css:42-43`:
```css
--lcars-border-focus: var(--lcars-space-white);
--lcars-border-focus-on-light: var(--lcars-black);
```

`--lcars-border-focus-on-light` is defined but **never referenced anywhere
else in the codebase** (confirmed by exhaustive grep across
`ui/css/*.css`) — the token exists, but the rule that should select it for
light backgrounds was never written. `:focus` always resolves to the single
white token, unconditionally, for every focusable element in the app.

That single white outline is then placed directly against several light
LCARS accent backgrounds used as button/link fills:

- `code/Alpha0.x/ui/css/layout.css:117-124` — `.lcars-sidebar a` background is
  `var(--lcars-accent-secondary)` (sunflower `#ffcc99`). This is every
  primary-navigation link ("Library evidence", "Feasibility & trace",
  "Data & lifecycle").
- `code/Alpha0.x/ui/css/components.css:9-19` — `.lcars-btn` default
  background is also `var(--lcars-accent-secondary)` (sunflower).
- `code/Alpha0.x/ui/css/components.css:37` — `.lcars-btn-primary` background
  is `var(--lcars-accent-primary)` (butterscotch `#ff9966`) — used by
  "Manual refresh", "Sync now", "Connect Audible in Edge", "Export synthetic
  snapshot as JSON".
- `code/Alpha0.x/ui/css/components.css:39` — `.lcars-btn-danger` background
  is `var(--lcars-accent-danger)` (tomato `#ff5555`) — used by **Disconnect
  Audible**, **Delete local library snapshot**, **Disconnect (stop synthetic
  import)**, and **Delete all synthetic data**: the four most consequential,
  irreversible actions in the entire application.
- `code/Alpha0.x/ui/css/layout.css:` `.lcars-sidebar a[aria-current="page"]`
  and `.lcars-btn:active` both switch background to
  `var(--lcars-accent-active)` (gold `#ffaa00`).

**Measured contrast (WCAG relative-luminance formula, verified
programmatically against the exact hex values in `tokens.css`, not eyeballed):**

| Focus ring vs. background | Ratio | WCAG 1.4.11 non-text minimum (3:1) |
|---|---|---|
| white outline on sunflower (nav links, default button) | **1.36:1** | FAIL |
| white outline on gold (active/current-page state) | **1.77:1** | FAIL |
| white outline on butterscotch (primary buttons) | **1.94:1** | FAIL |
| white outline on ice (secondary buttons) | **1.56:1** | FAIL |
| white outline on tomato (danger/destructive buttons) | **2.91:1** | FAIL (just under) |

All five fail the 3:1 minimum non-text-contrast criterion that a focus
indicator needs against its immediately adjacent color to remain reliably
*visible* (WCAG 2.4.7 Focus Visible is only meaningfully satisfied if the
indicator is perceivable; 1.4.11 Non-text Contrast is the numeric floor most
reviewers apply to it). The comment directly above the rule
(`base.css:70-71`, "Visible focus indicator everywhere... Never removed
without an equally visible replacement") states the intended guarantee that
this implementation does not actually meet on these backgrounds.

**Reproduction**

1. Load `http://127.0.0.1:4310/?private-alpha=1#/library`.
2. Press `Tab` repeatedly from page load. Observe the sidebar nav links
   ("Library evidence", etc.) and, once reaching the Data & lifecycle page,
   the "Disconnect Audible" / "Delete local library snapshot" buttons.
3. On a sunflower/butterscotch/gold background, the 3px white ring reads as a
   faint lightening of the button edge rather than a crisp ring; on the
   tomato danger buttons it is only marginally more visible. A low-vision
   user relying on the focus ring to confirm which irreversible action is
   about to fire cannot do so reliably.

**Fix**

The dead token already names the correct fix. Add a light-background focus
variant and apply it to every element whose background resolves to
sunflower/butterscotch/gold/ice/tomato (i.e., anywhere `color: var(--lcars-black)`
is already used as the button/link text color — that is the same signal to key
off of):

```css
.lcars-btn:focus,
.lcars-btn:focus-visible,
.lcars-sidebar a:focus,
.lcars-sidebar a:focus-visible {
  outline-color: var(--lcars-border-focus-on-light);
}
```

Re-run the contrast check after the fix: black outline on sunflower/
butterscotch/gold/ice all measure ≥10:1, and black on tomato measures 6.68:1
— all comfortably clear the 3:1 floor. (Values reproduced from the same
programmatic check used above.)

**Acceptance test**

Add a CSS regression test alongside the existing
`code/Alpha0.x/test/ui-reflow.test.js` pattern (regex/string assertions over
the stylesheet source, no headless browser required, matching this
repository's existing test style):

```js
test('focus outline uses the on-light token for every light-background focusable', async () => {
  const components = await css('components.css');
  const layout = await css('layout.css');
  assert.match(components, /\.lcars-btn:focus(-visible)?\s*{[^}]*outline-color:\s*var\(--lcars-border-focus-on-light\)/s);
  assert.match(layout, /\.lcars-sidebar a:focus(-visible)?\s*{[^}]*outline-color:\s*var\(--lcars-border-focus-on-light\)/s);
});
```

Manually confirm with a contrast tool (or the same relative-luminance
computation used above) that every focus-ring/background pair the app can
render measures ≥3:1.

**Pass/fail verdict:** **FAIL** at this commit. Must be fixed before any
named tester relies on keyboard-only confirmation of destructive controls.

---

### 3.2 [SHOULD-FIX / MEDIUM] Redundant duplicate status announcements on refresh and private-alpha operations

**Evidence**

`code/Alpha0.x/ui/js/views/data-view.js:75-78` (private-alpha `run()` helper):
```js
operationStatus.setAttribute('role', 'status');
operationStatus.textContent = label;
announce(label);
```

`code/Alpha0.x/ui/js/views/data-view.js:307-313` and `:322-328` (synthetic
manual-refresh / induced-error handlers):
```js
refreshStatus.textContent = result.ok
  ? `Manual refresh completed: ${result.report.added.length} added, ...`
  : result.reason;
refreshStatus.setAttribute('role', result.ok ? 'status' : 'alert');
announce(refreshStatus.textContent, { assertive: !result.ok });
```

`role="status"` and `role="alert"` are themselves implicit live regions
(`aria-live="polite"`/`"assertive"` respectively, per the ARIA spec), so
mutating `operationStatus`/`refreshStatus`'s `textContent` already causes
assistive-technology announcement on its own. `announce()`
(`code/Alpha0.x/ui/js/dom.js`, the persistent `#live-polite`/`#live-assertive`
regions declared in `index.html`) then writes the **same string** into a
second, independent live region a moment later. Both mutations are real DOM
changes assistive technology should pick up, so the practical effect is the
same message spoken twice in immediate succession.

**Reproduction**

1. Enable a screen reader (NVDA/VoiceOver/JAWS).
2. On the Data & lifecycle page, click "Manual refresh (re-import clean
   synthetic snapshot)".
3. Listen for the completion message — it is announced twice back-to-back.

**Fix**

Pick one channel per message. The simplest fix that preserves the existing
visible status text (useful for sighted users) while removing the duplicate
speech is to stop calling the separate `announce()` helper wherever the
status paragraph already carries a live-region role, i.e. delete the
`announce(...)` calls at `data-view.js:78`, `:313`, and `:328`, and rely on
the `role="status"`/`role="alert"` mutation alone (this is already how
`disconnect`/`delete` in the synthetic view work — they only call
`announce()` because they re-render the whole view via `renderDataView(...)`
and lose the standing status paragraph, which is a legitimate use of the
shared region).

**Acceptance test**

A `node:test` DOM-free unit is not practical here since `announce()` touches
`document`; add a manual screen-reader smoke-test line item to the alpha
0.0.1 test/verification checklist ("manual refresh and sync status is spoken
exactly once, not twice"), and/or a lightweight jsdom-based test asserting
that `announce()` is not called when a `role="status"`/`role="alert"` element
in the same interaction already received the identical text mutation.

**Pass/fail verdict:** **FAIL** (confirmed by source inspection of both
mutation paths; not blocking for a sighted keyboard user, but a real
screen-reader UX defect).

---

### 3.3 [SHOULD-FIX / MEDIUM] No focus or announcement on the "title not found" error path

**Evidence**

`code/Alpha0.x/ui/js/views/book-detail-view.js:63-70`:
```js
if (!detail) {
  mount(root, h('section', {}, [
    h('h2', { text: 'Title not found' }),
    h('p', { text: 'This title does not exist in the synthetic catalog. It may have been removed by a delete-all action.' }),
    h('a', { href: '#/library', class: 'lcars-btn lcars-btn-secondary', text: 'Back to library evidence' }),
  ]));
  return;
}
```

Compare with the success path a few lines later
(`book-detail-view.js:73-92`), which explicitly gives the heading
`tabindex="-1"` and moves focus to it after mount:
```js
const heading = h('h2', { id: 'book-heading', text: book.title, tabindex: '-1' });
...
mount(root, section);
section.querySelector('h2')?.focus?.();
```

The error branch does neither: no `tabindex`, no `.focus()` call, and no
`aria-live`/`role="status"` on the "Title not found" message. A keyboard or
screen-reader user who follows a stale `#/book/:id` link (e.g., after using
"Delete all synthetic data" and then pressing Back, or from a bookmarked
hash) gets a DOM update with no signal that navigation happened or that an
error state is now showing; focus silently stays wherever it was (often
back on the sidebar link or, after a delete, nowhere meaningful).

**Reproduction**

1. Navigate to any book detail page, note its URL.
2. Go to Data & lifecycle, acknowledge the consent statement, and click
   "Delete all synthetic data" (non-destructive to real data — this is the
   synthetic in-memory session only, and is fully explained/confirmed by the
   existing dialog).
3. Navigate back to the book detail URL from step 1 via the address bar hash
   or the back button.
4. Observe: the "Title not found" content renders, but keyboard focus does
   not move to it and no live region announces it.

**Fix**

Mirror the success path:
```js
if (!detail) {
  const heading = h('h2', { text: 'Title not found', tabindex: '-1' });
  mount(root, h('section', {}, [
    heading,
    h('p', { role: 'status', text: 'This title does not exist in the synthetic catalog. It may have been removed by a delete-all action.' }),
    h('a', { href: '#/library', class: 'lcars-btn lcars-btn-secondary', text: 'Back to library evidence' }),
  ]));
  heading.focus();
  return;
}
```

**Acceptance test**

Extend `code/Alpha0.x/test/ui-store.test.js` (or a new DOM-level test using
the existing `h()`/`jsdom`-free pattern where available) to assert the
not-found branch produces a heading with `tabindex="-1"` and that a
`role="status"` element carrying the not-found explanation is present,
matching the pattern already asserted for the successful detail path.

**Pass/fail verdict:** **FAIL** for this specific error path; the successful
path (the overwhelming majority of navigations) already passes.

---

### 3.4 [SUGGESTION / LOW] Route-change focus inconsistency between "focus main" and "focus heading"

**Evidence**

`code/Alpha0.x/ui/js/app.js`:
```js
function focusMain() {
  if (mainContent) mainContent.focus();
}

initRouter({
  library: () => { renderLibraryView(viewRoot, store); focusMain(); },
  book: (params) => { renderBookDetailView(viewRoot, store, params[0]); },
  feasibility: () => { renderFeasibilityView(viewRoot, store); focusMain(); },
  data: () => { renderDataView(viewRoot, store); focusMain(); },
}, { onChange: setActiveNav });
```

Three of the four routes move focus to the generic `<main id="main-content"
tabindex="-1">` landmark, which carries no accessible name beyond the
implicit "main" role — a screen reader announces "main" but not which view
just loaded. Only the `book` route moves focus to its own `<h2>` (see 3.3),
giving a stronger, self-describing announcement ("Title, heading level 2").
This is a legitimate, defensible SPA routing pattern on its own (focus main,
let the heading be next in reading order), but the inconsistency between
routes means the one route that does it "the strong way" makes the other
three look like an oversight rather than a deliberate choice.

**Fix (either is acceptable, pick one and apply everywhere)**

- Simplest: add `aria-label="Application content"` (or similarly generic) to
  `#main-content` so the landmark itself has a name every time focus lands
  there, regardless of which view rendered; or
- Stronger, consistent with `book-detail-view.js`: have `library`,
  `feasibility`, and `data` also focus their own `<h2>` instead of `<main>`.

**Acceptance test:** a shared, reusable test asserting every route handler in
`app.js` uses the same focus-target strategy (e.g., grep-style assertion that
all four route callbacks call the same helper function).

**Pass/fail verdict:** Not blocking. Track as a consistency cleanup.

---

### 3.5 [SUGGESTION / LOW] "Reset filters" sort-field default relies on incidental array ordering

**Evidence**

`code/Alpha0.x/ui/js/views/library-view.js`:
```js
const sort = labeledSelect('lib-sort', 'Sort by',
  SORT_FIELDS.filter((f) => CATALOG_SORT_FIELDS.includes(f)).map((f) => ({ value: f, label: SORT_LABELS[f] ?? f })), { onChange });
sort.select.value = 'title';
```

`sort.select.value = 'title'` sets the *current* value programmatically but
does not set the `selected` HTML attribute on the corresponding `<option>`,
so it does not change what native `<form>.reset()` (invoked by the "Reset
filters" button) restores. Today this coincidentally works because
`SORT_FIELDS[0]` in `code/Alpha0.x/src/core/library.js:15-18` is `'title'`,
matching the first rendered `<option>`. If that upstream array's order ever
changes for an unrelated reason (e.g., a future core refactor), "Reset
filters" would silently start resetting "Sort by" to a different field than
"Title" with no compiler or test failure to catch it — the current test
suite (`ui-store.test.js`) checks that sorting works for every field, not
which one `<option>` carries the `selected` attribute.

**Fix:** either set the `selected` attribute explicitly when building the
`<option>` for `'title'`, or add a one-line regression test asserting
`document.querySelector('#lib-sort option[selected]').value === 'title'`.

**Pass/fail verdict:** Not currently a user-visible defect (verified: the
two orderings agree today). Track as latent-coupling debt.

---

## 4. Positives

1. **Correct LCARS-compliant flat design with no gradients/shadows** — the
   test suite already codifies this (`ui-assets.test.js`: "css files contain
   no gradients, box-shadows, text-shadows, or glow filters" — passing).
2. **Full landmark structure**: `role="banner"`, `nav[aria-label="Primary"]`,
   `<main tabindex="-1">`, `role="contentinfo"`, plus a working skip link
   (`.lcars-skip-link`) that becomes visible on focus.
3. **Text-based, never color-only, status/provenance labeling** — confirmed
   in `format.js` (`formatProvenance`, `formatStatus`) and enforced by the
   view layer; "unknown" is always rendered as an honest string, never a
   dash or zero, matching both the LCARS design brief and WCAG 1.4.1.
4. **`prefers-reduced-motion` correctly honored** (`base.css:98-104`), and
   the existing test suite verifies its presence
   (`ui-assets.test.js`: "css defines a prefers-reduced-motion override").
5. **Reflow to a 320px viewport with pinned `px` (not `rem`) breakpoints** —
   deliberately protects against the exact 1.4.10/1.4.4 interaction (text
   zoom + narrow viewport) that trips up many responsive implementations;
   backed by seven passing regression tests in `ui-reflow.test.js`.
6. **Injection-safe DOM construction.** `h()` in `dom.js` never uses
   `innerHTML`, blocks dangerous tags (`script`, `iframe`, `object`,
   `style`, etc.), refuses raw `style`/`innerHTML` attributes outright, and
   passes every URL-bearing attribute through `safeHref()`'s scheme
   allowlist — meaning arbitrary catalog text (including a hostile title)
   can never become markup or a `javascript:`/`data:` URL. `formatText()`
   additionally makes invisible/bidi-override Unicode characters visible
   rather than silently rendering them.
7. **Confirmation dialogs use the native `<dialog>` element correctly**:
   focus starts on the least-destructive action (Cancel), Escape defaults to
   "not confirmed" rather than inferring an outcome from which button fired,
   and focus is explicitly returned to the element that had it before the
   dialog opened (`dom.js`'s `confirmAction`).
8. **Consent-gated lifecycle controls** (disconnect/delete) are disabled
   until an explicit checkbox is checked, with an accessible label
   describing the irreversible consequence in plain language before the
   action is even reachable.
9. **Every table has a `<caption>` and `scope="col"` headers**
   (`library-view.js`'s `buildTable`), and grouped views repeat this
   structure per group rather than collapsing to an unlabeled table.
10. **Automated test coverage already encodes many of the checks I would
    otherwise have to verify by hand**: 155 passing tests spanning CSS
    reflow, CSP/no-remote-origin, no-editable-surface scope guarantees,
    format-layer honesty (unknown-never-zero), and server path-traversal/
    Host-header hardening. This materially reduces regression risk for the
    next iteration.

---

## 5. Summary

The 0.0.1 evidence-inspector surface is a disciplined, narrowly-scoped
accessibility implementation that gets the structural fundamentals right —
landmarks, skip link, text-based state disclosure, reduced motion, reflow,
and safe DOM construction are all present and, largely, already
test-guarded. The one **Must-fix** item (3.1, focus-ring contrast) is a
real, precisely measurable WCAG gap that happens to land on the app's most
consequential controls (Disconnect/Delete), so it must be closed before
wider private-alpha use. The two **Should-fix** items (3.2 duplicate
announcements, 3.3 missing error-path focus) are genuine screen-reader UX
defects, not merely stylistic nits, and should be scheduled promptly. The two
**Suggestions** (3.4, 3.5) are consistency/robustness debt, not currently
user-visible failures.

**Overall verdict for alpha 0.0.1 at commit `6145f98`: CONDITIONAL PASS —
blocked on 3.1 before wider tester exposure; 3.2 and 3.3 should land in the
same iteration.**
