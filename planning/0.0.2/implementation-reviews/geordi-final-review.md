# Geordi La Forge — Final Alpha 0.0.2 UI/accessibility implementation review

> ## Amendment (post-fix re-review)
>
> **Status: M1 RESOLVED. Verdict upgraded to FULL APPROVE (UI/accessibility
> scope).** This amendment follows a second pass after the reported fix
> round. I re-read only the files below (not the whole diff again) and
> re-ran the Node suite myself; I did not re-run the Python suite (this
> environment has no `pytest` installed and installing test dependencies
> would exceed "do not mutate runtime/code"), so the Python and live-runtime
> figures below are taken as given, not independently reproduced by me, per
> my task constraints (no personal data access, no API capability request,
> no runtime mutation).
>
> **Test evidence re-verified by me:** `npm test` in `code/Alpha0.x` now
> reports **471 tests / 470 pass / 0 fail / 1 skip** (the same fixed,
> environment-only symlink skip as before). This matches the figure I was
> given.
> **Test evidence taken as given (not independently reproduced):** Python
> 98 total/96 pass/2 skip; policy pass; pack blocked; secret/diff scan
> clean; live metadata evidence (revision 3 exact schema, two migration
> records, opaque anchor, rollback discharged, unauth API 401, server
> healthy). These are Worf's/Data's custody, migration, and runtime-security
> domain, not mine; I did not request the shared-browser capability or
> touch any live system to check them myself, consistent with my operating
> constraints and with residual risk 5 in my original report below.
>
> **Files re-read for this amendment:** `ui/js/app.js`,
> `ui/js/views/bootstrap-failure-view.js`,
> `ui/js/library-session-state.js`, `ui/js/views/library-view.js`,
> `ui/js/views/data-view.js`, `src/version.js`,
> `test/final-review-fixes.test.js`, `test/final-ui-followups.test.js`,
> `test/local-data-suppression-ui.test.js`.
>
> ### M1 — RESOLVED
>
> `ui/js/app.js`'s `failClosed` branch no longer calls `focusMain()` after
> `renderBootstrapFailureView()`. Confirmed by direct re-read of the current
> file (the branch now ends at the `renderBootstrapFailureView(...)` call,
> with no trailing `focusMain()`), and by a new dedicated regression test in
> `test/final-ui-followups.test.js`:
> `'the fail-closed startup branch in app.js never calls the generic
> focusMain() helper'`, which slices the source between
> `if (bootstrap.failClosed) {` and the matching `} else {` and asserts
> `assert.doesNotMatch(failClosedBranch, /focusMain\(\)/)`. A second test in
> the same file, `'rendering the bootstrap-failure view moves focus onto the
> refusal heading, not a generic main region'`, exercises
> `renderBootstrapFailureView()` against a minimal fake-DOM harness (no new
> dependency; a hand-rolled `FakeElement` stub) and asserts
> `heading.focused === true`. This is exactly the dependency-free
> regression test I suggested in S-sugg1 — it was implemented, not just
> proposed.
>
> A companion fix I had not asked for but which closes a real gap: the
> refusal `<h2>` now explicitly carries `tabindex: '-1'`
> (`h('h2', { id: 'private-refusal-heading', tabindex: '-1', text: '...' })`
> in `bootstrap-failure-view.js`). Previously the heading had no `tabindex`,
> so `.focus()` on a non-interactive `<h2>` would have been a silent no-op
> in a real browser even after the `focusMain()` race was fixed — the
> `tabindex="-1"` addition is what actually makes the heading focusable at
> all. `test/final-ui-followups.test.js`'s first suppression test locks this
> in explicitly: `'the bootstrap-failure heading is focusable so the
> fail-closed refusal can actually receive focus'`.
>
> **This closes my sole gate-blocking finding.** See the fully updated
> Must-fix, residual-risks, and gate-recommendation sections below for the
> complete current disposition; the rest of this document (positive
> evidence, rendered-evidence limitations not related to M1, S1–S3,
> suggestions) is preserved from my original review as the audit trail and
> is annotated in place where its status has changed.
>
> ### Other fixes verified in this pass (relevant to my UI/accessibility scope)
>
> - **Reset collapsed groups.** `library-session-state.js` now exports
>   `resetLibraryFilters()`, which clears every filter/sort/group field
>   *and* `collapsedGroupKeys` in one call, while explicitly preserving an
>   in-progress feedback draft (`activeEditorBookId`, `draftDirty`,
>   `returnFocusBookId`, `scrollTop` all pass through unchanged). Previously
>   (at my original review) "Reset filters" only reset filter/sort/group
>   state, leaving stale collapsed-group keys behind — a real but minor
>   defect I had not caught in my first pass. `PrivateAppStore` exposes
>   `resetLibraryFilters()` and `library-view.js`'s private "Reset filters"
>   button calls it directly (verified: the button's `onclick` body matches
>   `store\.resetLibraryFilters\(\)` and does not duplicate
>   `collapsedGroupKeys` handling inline). Covered by four tests in
>   `test/final-ui-followups.test.js` including an end-to-end store-level
>   assertion that collapsed groups are actually empty after reset. I
>   consider this fully resolved and well-tested.
> - **Ratings profile.** `data-view.js` no longer hardcodes a "deferred"
>   ratings-status string outside the generic `profileEntries()` renderer;
>   the private runtime profile in `src/version.js` was corrected from a
>   stale `ratingsFeature: 'deferred'` to
>   `ratingsFeature: 'local encrypted ratings, comments and tags'`, matching
>   what the private alpha actually ships (inline per-book rating, comment,
>   and tag editing already confirmed working in my original review).
>   `test/final-ui-followups.test.js` locks in both that `data-view.js`
>   contains no hardcoded `/deferred/i` text and that `profileEntries()`
>   renders whatever value the profile object holds rather than a fixed
>   default, plus an explicit non-regression check that no dedicated
>   Ratings nav item or book-detail rating editor was introduced (rating
>   stays inline in the Library view, per the consensus's OF-004
>   requirement). Resolved.
> - **Final UI suppression copy.** `test/local-data-suppression-ui.test.js`
>   confirms the Data & lifecycle view and the Library empty state now
>   truthfully disclose `connectionInfo.local.localDataSuppressed` after a
>   local-only deletion, with copy that explicitly states data was deleted,
>   sync is paused, Sync now/reconnect resumes it, and — critically —
>   that the Audible account, device authorization, and provider
>   credentials were **not** affected (with explicit negative assertions
>   that the copy never claims credentials or the device were erased). The
>   "Sync now" button relabels to "Sync now (resume local library data)"
>   when suppressed and gains an explicit confirmation step
>   ("Resume local library data?") consistent with the other destructive/
>   consequential lifecycle actions on that screen, while a normal,
>   non-suppressed sync remains one click. This directly addresses the kind
>   of "believable lie" risk Requirement 10 warns against, applied to the
>   delete-then-resume lifecycle rather than only the initial bootstrap
>   refusal. Resolved, and reads as more careful than the minimum bar I set
>   in my original review.
>
> ### Still open (should-fix / suggestion — non-blocking)
>
> - **S1 (CSS rationale comments stripped)** — re-checked; `tokens.css` and
>   `layout.css` still contain zero `/* ... */` block comments. Not part of
>   the reported fix list, and not gate-blocking, but still an open
>   should-fix if anyone wants LCARS/WCAG rule citations preserved
>   in-source.
> - **S2 (weak genre-placeholder regex)** — re-checked;
>   `test/ui-assets.test.js` line 181 still reads
>   `/placeholder:s*'[^']*genre/i` (missing backslash before `s`). Not part
>   of the reported fix list. Still non-blocking: the adjacent
>   `label:\s*'Genre'` assertion and the detail-view assertion in the same
>   test still catch the primary regression class.
> - **S3 (document `<details>`/`<summary>` as an approved AC6
>   substitution)** — no evidence this was recorded in
>   `09-review-consensus.md`; still an open documentation suggestion, not a
>   functional gap.
> - **S-sugg2 (accessible name on `<main>`)** — not checked in this pass;
>   presumed unchanged. Low priority given M1's fix removes the main path
>   that would have exercised it.
>
> None of the above four items block this review's verdict.
>
> ### Updated verdict
>
> **FULL APPROVE for the UI/accessibility scope I own**, superseding the
> original "CONDITIONAL APPROVE — one must-fix required" verdict below. My
> sole gate-blocking finding (M1) is resolved and is now regression-tested
> in a way that will catch a reintroduction. S1–S3 and S-sugg2 remain open
> as non-blocking should-fix/suggestion items. This amendment does not
> speak for Worf's or Data's disposition of the custody-proof,
> purpose-bound-envelope, unlock-readiness, TEMP/TMP-scrub,
> ownership-anchor/rollback-lifecycle, connector-artifact-inventory, or
> migration-marker fixes reported alongside this UI work — those remain
> their sign-off, not mine. This amendment does not change Alpha 0.0.1's
> HOLD/FAIL disposition and does not authorize public/commercial
> distribution.
>
> ---
>
> # Original review (preserved as submitted, for audit trail)

**Reviewer:** Geordi La Forge, LCARS design and accessibility authority
**Reviewed:** Complete uncommitted working-tree diff under `code/Alpha0.x/`
(`git status`/`git diff` at review time), read against
`APP_DESCRIPTION.md`, `planning/0.0.2/06-owner-feedback.md`,
`08-implementation-plan.md`, `09-review-consensus.md`,
`10-runtime-data-requirement.md`, and my own prior planning review
(`planning/0.0.2/reviews/geordi-review.md`).
**Method:** Static, read-only inspection of tracked and untracked source
(`view`/`grep`/`git diff`) plus the existing automated test suite executed
with `npm test`. No server was started against real data, no personal
Audible content was viewed, no data was mutated, and the shared-browser
owner-unlock capability was never requested or observed. This report is a
new staged file only; nothing else in the working tree was changed.
**Test result observed:** `368` tests, `367` pass, `0` fail, `1` skipped
(the skip is `a symlink escaping the served root is refused` — a fixed
environment limitation, "symlink creation is not permitted in this
environment," not a functional gap).

## Verdict (original submission): **CONDITIONAL APPROVE — one must-fix required before A2-G0 closes**

> **This verdict was superseded by the Amendment above: M1 is resolved and
> the current verdict is FULL APPROVE for my UI/accessibility scope.** The
> text below is preserved unchanged from my original submission as the
> audit trail.

This implementation substantively delivers on OF-001–OF-006, CP-05, and the
consensus record: Genre is removed from every live/private surface and kept
strictly diagnostic on the synthetic-only feasibility view; the library card
now carries task-based columns and hides Source/provenance behind a single
Data & lifecycle disclosure; groups are collapsible with session-only state;
per-book feedback is edited inline under the book's own card, never a group
heading; the sidebar now separates "Primary" from "Diagnostics and
lifecycle"; the CSS carries real iPhone-class mobile-first work (safe-area
insets, `100dvh`, a raised 44px touch-target floor); and the real-data-only
failure behavior required by `10-runtime-data-requirement.md` is implemented
end-to-end from `scripts/serve.js`'s startup gate through
`connection-api.js`'s typed refusals to an explicit, non-synthetic
`bootstrap-failure-view.js`. The automated regression suite (`ui-reflow.test.js`,
`ui-assets.test.js`, `bootstrap-state.test.js`) directly encodes several of
these guarantees rather than only asserting them in prose.

I found exactly one concrete, newly introduced defect that must be fixed
before this gate closes: `ui/js/app.js`'s fail-closed branch silently
overrides the refusal heading's own focus management, so the single most
safety-critical screen in this release — the "your real library could not be
verified" refusal — does not reliably deliver programmatic focus to its own
heading for a keyboard/screen-reader user. Everything else below is
should-fix or suggestion. This review does not reopen Genre/columns/
grouping/inline-feedback design decisions that are otherwise well-executed,
does not change Alpha 0.0.1's HOLD/FAIL disposition, and does not authorize
public/commercial distribution.

---

## Must-fix (blocks A2-G0 gate closure) — as originally submitted

> **Status: RESOLVED.** See the Amendment at the top of this document for
> the fix evidence (`ui/js/app.js`'s redundant `focusMain()` call removed,
> `tabindex="-1"` added to the refusal heading, and two dedicated regression
> tests added in `test/final-ui-followups.test.js`). The description below
> is preserved unchanged from my original submission.

### M1 — Fail-closed refusal screen loses its own heading focus to `<main>` (RESOLVED)

**Files:** `ui/js/app.js` lines 49–56; `ui/js/views/bootstrap-failure-view.js` line 27.

`renderBootstrapFailureView()` ends with:

```js
mount(root, section);
section.querySelector('h2')?.focus?.();
```

This runs synchronously and puts focus on the `#private-refusal-heading`
`<h2>` ("Private alpha unavailable") the instant the refusal is rendered.
But `app.js`'s `failClosed` branch calls `focusMain()` immediately
afterward, on the very next line:

```js
if (bootstrap.failClosed) {
  setActiveNav('data');
  renderBootstrapFailureView(viewRoot, {
    errorCode: bootstrap.errorCode,
    message: bootstrap.message,
    currentHref: window.location.href,
  });
  focusMain();               // <-- overwrites the heading focus set above
}
```

`focusMain()` moves focus to `<main id="main-content" tabindex="-1">`, an
unnamed landmark wrapper. The net effect: on the exact screen where
Requirement 10 demands the runtime "stops and says so," a keyboard or
screen-reader user's focus lands on a generic, unlabeled `<main>` region
instead of the "Private alpha unavailable" heading and its `role="alert"`
message. This is not how the parallel `book:` route in the same file is
handled — that route deliberately omits the `focusMain()` call because
`renderBookDetailView()` manages its own heading focus (confirmed at
`ui/js/views/book-detail-view.js`, final lines: `mount(root, section);
section.querySelector('h2')?.focus?.();` with no subsequent override in
`app.js`). The fail-closed branch is the one place this consistency was not
carried through, and it is new code in this diff (confirmed via
`git diff -- ui/js/app.js`; the prior version had no `failClosed` branch at
all).

This is untested: `test/bootstrap-state.test.js` only exercises the pure
`resolveBootstrapState()`/`applyRuntimeChrome()` functions, never `app.js`'s
DOM wiring, and the repository intentionally carries zero npm dependencies
(`test/version.test.js`: "Node package declares zero npm dependencies"), so
there is no headless-DOM harness that would have caught this focus race.

**Fix:** remove the redundant `focusMain()` call in the `failClosed` branch
(the heading's own `.focus()` call in `bootstrap-failure-view.js` is
authoritative and correct), or make the ordering/ownership explicit with a
single call site. Either way, verify post-fix that
`document.activeElement.id === 'private-refusal-heading'` after a
failed-closed bootstrap, ideally with a minimal DOM-stub regression test
(see Suggestions, S1) or at minimum a one-time manual screen-reader spot
check before this gate closes.

---

## Should-fix (non-blocking, recommended before wider circulation)

### S1 — CSS design-rationale comments were stripped, not just reformatted

`git diff` on `tokens.css`, `layout.css`, `base.css`, and `components.css`
shows every file-header and section-divider comment removed (e.g. the
Bracer Jack elbow-geometry rationale in `tokens.css`, the "frame goes
thick-to-thin" rule citation in `layout.css`, the WCAG 2.4.7/2.4.11 focus
note and reduced-motion rationale in `base.css`, the "no gradients/shadows"
rule statement in `components.css`). No selector or value changed as a
result — this is a pure comment deletion — but these comments were the
project's only in-repo record tying specific CSS rules to specific LCARS/
WCAG citations, which is exactly the kind of documentation a future
reviewer (including a future me) relies on to avoid re-litigating settled
design decisions. Recommend restoring equivalent comments, or at minimum
confirming their removal was intentional and captured in Riker's consensus
record rather than an incidental side effect of another edit.

### S2 — Genre-removal test regex is weaker than its comment implies

`test/ui-assets.test.js` line ~181:

```js
assert.doesNotMatch(libraryView, /placeholder:s*'[^']*genre/i);
```

The intended pattern is almost certainly `/placeholder:\s*'[^']*genre/i` —
the backslash before `s` is missing, so the regex currently only refuses a
literal run of the letter `s` between `placeholder:` and the opening quote,
not "placeholder:" followed by any whitespace. This does not eliminate
coverage of the Genre-removal regression class (the accompanying
`label:\s*'Genre'` and detail-view assertions on the same test still catch
the primary regression), but it should be corrected so the placeholder
check does what its own name promises.

### S3 — `<details>`/`<summary>` disclosure is a deviation from the literal AC wording, worth recording as an approved substitution

`ATR-S037` AC6 / `08-implementation-plan.md` §7 specify "button/disclosure
group headings ... with `aria-expanded` state." `renderPrivateResults()` in
`ui/js/views/library-view.js` instead uses native `<details>`/`<summary>`
per group, with the open/closed state mirrored into
`librarySession.collapsedGroupKeys` via `toggleGroup()`. This is a
stronger-than-required implementation of the same requirement: native
`<details>` gets keyboard operability, implicit expanded/collapsed
semantics, and removal of collapsed content from the accessibility tree and
tab sequence for free, without hand-rolled `aria-expanded` bookkeeping that
could drift out of sync with the DOM. I have no objection to this
substitution, but because the consensus document's AC text is the
authoritative acceptance criterion, I recommend a one-line addendum in
`09-review-consensus.md` (or the CP-05 record) noting that native
`<details>`/`<summary>` satisfies AC6's disclosure requirement, so a future
auditor does not flag the literal absence of `aria-expanded` as
non-conformant.

---

## Suggestions (optional)

### S-sugg1 — Add a lightweight, dependency-free regression test for M1 (IMPLEMENTED)

> **Status: done.** `test/final-ui-followups.test.js` added exactly this: a
> source-slice assertion that the `failClosed` branch never calls
> `focusMain()`, plus a hand-rolled `FakeElement`/`document` stub (no new
> dependency) that renders `bootstrap-failure-view.js` and asserts
> `heading.focused === true`. This is a slightly different shape than my
> original suggestion (source-level + fake-DOM assertions rather than
> extracting a pure focus-selection function), but it achieves the same
> goal and would catch a reintroduction of the race. No further action
> needed.

Given the "zero npm dependencies" test-suite constraint, a full headless
browser is out of scope, but `app.js`'s `failClosed` branch could be
refactored so the focus-selection logic (which element should receive
focus, and in what order) lives in a small, pure, exported function
(similar to `resolveBootstrapState()`) that is unit-testable with
`node:test` and a minimal object stub, without requiring a real DOM. That
would have caught M1 directly and would guard against a regression if the
ordering is "fixed" by reintroducing a different race later.

### S-sugg2 — Give `<main id="main-content">` an accessible name

Independent of M1, `<main>` currently has no `aria-label`. If focus ever
does land there in a future release, screen readers announce only "main."
A small `aria-label` set per-route (or a shared generic one, e.g. "Audible
Track and Recommend content") would make an incidental focus landing on the
landmark less disorienting.

---

## Positive evidence (what I confirmed works, with citations)

1. **Real-data-only failure behavior is implemented end-to-end, not just
   documented.** `scripts/serve.js` (`assertRealDataRuntime`,
   `isSyntheticModulePath` gating a 403 on `src/fixtures/**` in private
   mode), `ui/js/connection-api.js` `ConnectionApi.discover()` (throws
   `private-alpha-runtime-unavailable` on a 404 probe and
   `private-alpha-runtime-source-refused` when `session.runtime.dataSource
   !== 'local-encrypted'` or `synthetic !== false`), `ui/js/bootstrap-state.js`
   `resolveBootstrapState()` (a private request with no connection API or a
   bootstrap error resolves to `mode: 'private-refused', failClosed: true`,
   never a synthetic fallback), and `ui/js/views/bootstrap-failure-view.js`
   (an explicit "This page fails closed and does not substitute any
   synthetic library" statement) form a single, consistent chain. Verified
   by `test/bootstrap-state.test.js` (4 of its 5 tests directly assert this
   chain's copy and state) and the passing `runtime-data-source.test.js`/
   `connector-custody.test.js` suites.
2. **Copy is specific, calm, and never a believable lie.** `ui/js/private-alpha-messages.js`'s `PRIVATE_ERROR_LABELS` gives every one of ~30 error
   codes a distinct, plain-language, non-alarmist sentence (e.g.
   `'private-alpha-runtime-unavailable'`: "The local ATnR runtime is
   unavailable on this computer right now."), and `bootstrap-state.js`'s
   `privateChrome({ unavailable: true })` never uses the word "connected" or
   "synthetic" for a refused session — confirmed by
   `assert.doesNotMatch(state.chrome.status, /synthetic/i)` in
   `bootstrap-state.test.js`.
3. **Genre is removed from every live/private surface and kept honestly
   diagnostic-only elsewhere.** `grep -in genre` across `ui/js/private-store.js`
   and `ui/js/library-session-state.js` returns zero hits.
   `PRIVATE_SORT_LABELS`/`PRIVATE_GROUP_FIELDS`/`LIBRARY_SORT_FIELDS`/
   `LIBRARY_GROUP_FIELDS` in `library-view.js`/`library-session-state.js`
   never list Genre. `book-detail-view.js`'s `buildMetadata()` metadata list
   has no Genre row. `feasibility-view.js` explicitly states, in private
   mode: "Genre remains diagnostic-only here because no approved private
   source proof exists." This is directly enforced by
   `test/ui-assets.test.js`: `'private-library views remove Genre from live
   surfaces and reserve it for synthetic diagnostics only'`.
4. **Useful, task-based columns; Source/provenance exiled to one place.**
   `buildPrivateRow()` in `library-view.js` shows title/subtitle, authors,
   narrators, series, status+progress, duration, and a feedback indicator —
   no Source/provenance column repeated per row. `data-view.js`'s
   `renderPrivateAlphaDataView()` carries the single, one-time note:
   "Connection transparency appears here once. The main Library view avoids
   repeating source or provenance columns on every book row."
5. **Collapsible groups, done natively and privacy-consciously.**
   `renderPrivateResults()` renders each group as `<details>`/`<summary>`
   with count in the summary text; Expand all/Collapse all buttons appear
   only when `result.groups.length > 1`; expand/collapse state lives in
   `librarySession.collapsedGroupKeys` (`library-session-state.js`), which is
   in-memory only (never a URL param, never `localStorage`); each toggle
   fires a one-time `announce()` ("Expanded …"/"Collapsed …").
6. **Inline, per-book feedback with a hard single-open-draft guard.**
   `buildPrivateFeedbackEditor()` is rendered directly beneath a book's own
   card (`buildPrivateRow`), never under a group heading.
   `requestEditor()`/`closeEditor()` in `library-session-state.js` return
   `{ status: 'blocked-dirty' }` if a different book's draft is dirty, and
   `library-view.js`'s "Rate & review" handler surfaces that with an
   assertive announcement and focuses the already-open editor rather than
   silently discarding or misattributing a draft. Draft/saving/saved/error
   are visibly distinct states via `feedbackStatusText()`, matching the
   consensus's "no false-positive save" requirement.
7. **Navigation hierarchy is now legible.** `ui/index.html`'s
   `<nav aria-label="Application destinations">` splits into
   `<div class="lcars-sidebar-group" aria-label="Primary">` (Library) and
   `aria-label="Diagnostics and lifecycle"` (Feasibility & trace, Data &
   lifecycle), separated by the still-decorative, `aria-hidden`
   `.lcars-sidebar-filler` (grey, collapses to `display:none` at ≤640px —
   confirmed in `ui-reflow.test.js`'s safe-area test).
8. **iPhone-class mobile-first CSS is real, not cosmetic.** `viewport-fit=cover`
   was added to the meta viewport; `env(safe-area-inset-{top,right,bottom,left})`
   is applied to the header bar, footer bar, body, main content, and mobile
   sidebar in `layout.css`; `min-height: 100dvh` supplements `100vh` on both
   `.lcars-frame` and `body`; `--lcars-min-target` was raised from `2.5rem`
   (40px) to `2.75rem` (44px, matching Apple HIG over the WCAG 2.5.8 24px
   floor, as OF-006 required). All of this is now regression-tested, not
   just asserted in prose: `test/ui-reflow.test.js` has 10 passing tests,
   including two new ones — `'minimum tap targets are raised to 44px and the
   frame uses dynamic viewport height'` and `'safe-area padding protects
   header, body, footer, and mobile sidebar from iPhone cutouts'`.
9. **Touch targets and focus-visible parity.** Checkboxes/radios are `1.5rem`
   (24px, meeting the WCAG 2.5.8 floor) but always wrapped in a
   `.lcars-checkbox-row` with `min-height: var(--lcars-min-target)` (44px)
   and a clickable `<label>`, giving the effective hit target the larger
   size. `.lcars-btn:focus-visible` and `.lcars-sidebar a:focus-visible` now
   receive the same `filter: brightness(1.15)` feedback as `:hover` (this
   was hover-only before this diff), and the global `:focus` outline rule
   (3px solid, 3px offset) is untouched and still applies everywhere.
10. **Live-region ambiguity from my CP-05 planning review (B1) is
    resolved correctly.** `index.html` still ships exactly two ARIA live
    regions (`#live-polite`/`role="status"` and `#live-assertive`/`role="alert"`)
    — not collapsed into one. `ui/js/dom.js`'s `announce(message, { assertive
    })` is the single, integrated JS entry point every view calls, and it
    routes to the correct region by severity. This matches interpretation
    (a) from my prior review exactly: "one persistent announcement channel"
    means one code path, not one ARIA region.
11. **Lifecycle controls are present and distinctly gated for both modes.**
    Private mode: Connect (checkbox-gated), Sync now, Disconnect Audible
    (two-leg confirmation via `connectionApi.disconnect()` →
    `#confirmed()`), Delete local snapshot — all in
    `renderPrivateAlphaDataView()`. Synthetic mode: Manual refresh,
    induced-error demo, Export, Disconnect, Delete all — all in the
    existing synthetic branch of `renderDataView()`, each behind
    `confirmAction()` for destructive operations and a `consent-ack`
    checkbox gate (`updateLifecycleButtons()`). The runtime profile table
    (`PROFILE_LABELS`/`profileEntries()`) is rendered from a single shared
    label map for both modes so no field can silently show a raw camelCase
    key. **(Amendment)** As of the post-fix pass, the private lifecycle
    surface also truthfully discloses a local-data-suppressed state after a
    delete-only action, with copy that never overclaims what was erased —
    see the Amendment's "Final UI suppression copy" note above.

---

## Rendered-evidence limitations

- **No browser was launched and no screenshot or rendered DOM was
  captured for this review.** Every claim above is a static-source
  inspection (file reads, `git diff`, `grep`) plus the results of the
  existing, dependency-free `node:test` suite. I did not open the private
  or synthetic server, did not measure an actual iPhone Air viewport, and
  did not observe any real assistive-technology behavior (VoiceOver,
  NVDA, etc.).
- **Touch-target, reflow, and safe-area claims rely on
  `test/ui-reflow.test.js`'s regex-based CSS assertions**, which the file's
  own header comment states plainly: "This does not replace manual/
  automated rendered-viewport testing; it guards the specific regression
  against reintroduction." The genuine device-evidence gap OF-006 itself
  named (measuring the true CSS viewport, DPR, and safe-area insets on
  real or synthetic-stub iPhone Air hardware) remains open; nothing in this
  diff closes it, and nothing in this review can close it either without
  violating the shared-browser/no-personal-data constraint I was given.
- **I did not request or observe the shared-browser owner-unlock
  capability**, per my operating constraints, so I could not and did not
  verify `requestLocalCapability()`'s actual runtime prompt/UX, only its
  call sites and error contract in `connection-api.js`.
- **The focus-management finding (M1) is inferred from synchronous
  JavaScript control flow, not observed in a live DOM.** I am confident in
  the read (both functions are ordinary synchronous calls with no
  `await`/microtask boundary between them), but I did not run the code in a
  browser to see `document.activeElement` resolve.
- **Server/connector internals were read only far enough to confirm the
  front-end contract and user-facing copy** (`assertRealDataRuntime`
  invocation shape, the fixed reason-code exit path, the fixture-path 403).
  Full review of `src/security/*`, `connector/atnr_connector/custody.py`,
  and the Python connector's ACL/pagination/RPC changes is Worf's and
  Data's ownership per `10-runtime-data-requirement.md`'s division of
  ownership table, not mine.

---

## Residual risks (original submission, with current status noted)

1. ~~**M1 (focus race) is a residual risk...**~~ — **RESOLVED**, see Amendment.
   No longer a residual risk.
2. **No device-specific rendered evidence for iPhone Air exists yet.**
   Static CSS regression is strong, but OF-006's own acceptance criteria ask
   for measured real/synthetic-stub viewport evidence, which remains a
   documented open item, not something this diff or this review closes.
   **Status: still open.** Not part of the reported fix round; unchanged by
   this amendment.
3. **Genre exclusion from live surfaces is enforced by UI-level tests
   (`ui-assets.test.js`) and by the simple fact that `private-store.js`
   never imports a genre field, not by a structural/data-layer guard.** A
   future edit to `private-store.js` or `library-session-state.js` could
   silently reintroduce a Genre sort/group/filter option without breaking
   any test that isn't specifically about Genre. Consider a targeted guard
   test on those two files mirroring the existing `ui-assets.test.js`
   pattern (grep-style assertion that neither file contains the string
   `genre`), so this doesn't depend solely on the view-layer tests holding
   the line. **Status: still open** — re-checked in this pass, `grep -in
   genre` against `private-store.js` and `library-session-state.js` still
   returns zero hits (good), but no dedicated guard test was added; the
   protection is still incidental rather than structural. Non-blocking.
4. **S2's weak regex** slightly narrows (but does not eliminate) one of
   several redundant assertions protecting the Genre-removal regression
   class. **Status: still open**, re-confirmed unchanged in this pass
   (`test/ui-assets.test.js` line 181 still reads `/placeholder:s*'[^']*genre/i`).
   Non-blocking.
5. **Server/connector-side enforcement of Requirement 10 is outside my
   direct competency and was not independently re-verified beyond
   confirming the front-end contract** — Worf's and Data's sign-off on
   `src/security/runtime-data-source.js`, custody-root validation, and the
   Python connector changes remains the authoritative security/data
   disposition for those files. **Status: unchanged.** The reported
   custody-proof-before-migration, purpose-bound-envelope,
   unlock-readiness, TEMP/TMP-scrub, ownership-anchor/rollback-lifecycle,
   connector-artifact-inventory, lifecycle-nonce-invalidation, and
   migration-marker-atomicity fixes are outside my UI/accessibility
   competency; I confirmed only that `test/final-review-fixes.test.js`
   exists and exercises several of these (custody-proof gating, unlock
   readiness, TEMP/TMP omission) at the source level I can read, but their
   security/data disposition remains Worf's and Data's to sign off, not
   mine.

### New residual risks identified in this amendment pass

6. **None.** I found no new UI/accessibility defect while re-reading the
   fix set. The fixes I reviewed (bootstrap-failure focus, reset collapsed
   groups, ratings profile copy, local-data-suppression copy) are each
   backed by a passing, specific regression test, not just a prose claim.

---

## Gate recommendation

**Original recommendation (superseded):** "CONDITIONAL APPROVE, contingent
on M1." — preserved above for the audit trail.

**Current recommendation: FULL APPROVE for UI/accessibility scope.** M1 is
resolved and regression-tested. I have no further LCARS-compliance or
WCAG-floor objection blocking A2-G0 on UI/accessibility grounds for the
surfaces reviewed here across both review passes (Genre removal, column
design, collapsible groups including filter/group reset, inline feedback,
navigation hierarchy, iPhone Air mobile-first CSS, touch targets, live
regions, lifecycle controls including local-data-suppression disclosure,
and the fail-closed real-data refusal screen's focus behavior). S1, S2, S3,
and S-sugg2 remain open, non-blocking should-fix/suggestion items that do
not need to hold up this gate.

This review covers UI/accessibility only. It does not substitute for or
override Worf's security disposition, Data's architecture/migration
disposition, or Riker's cross-officer sequencing authority for Alpha 0.0.2.
It does not change Alpha 0.0.1's HOLD/FAIL status, and it does not authorize
tester conveyance or public/commercial distribution. Final A2-G0 gate
closure requires all officers' current dispositions, not this report alone.
