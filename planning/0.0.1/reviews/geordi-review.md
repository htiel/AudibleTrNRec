# Geordi La Forge — LCARS UI/UX and Accessibility Review

**Reviewing:** `APP_DESCRIPTION.md` (Accessibility and User Experience section,
plus all sections touching library, ratings, sync, recommendations, and
privacy controls) and the complete `planning/0.0.1` baseline
(01-release-charter.md, 02-requirements-and-hierarchy.md, 03-user-stories.md,
04-sequencing.md, 05-risks-and-release-gates.md, 06-backlog-index.md).

**Reviewer:** Geordi La Forge — LCARS design authority, review gate on
ATR-S008 (owner), ATR-S002, ATR-S003, ATR-S006, ATR-S009, ATR-S010, ATR-S011,
ATR-S012 (reviewer), and G5.

**Review type:** Officer sign-off requested at G0 per
`06-backlog-index.md` ("Next action: Data, Geordi, Worf, and Wesley review the
plan") and `05-risks-and-release-gates.md` officer handoff table (my line is
currently `PENDING`).

**Platform status acknowledged:** iPhone/web/other is TBD for this alpha.
Everything below is written platform-neutral and will re-apply once ATR-S011
selects a concrete client.

---

## 0. Scope framing (read this before the findings below)

The request asks me to review library sorting/facets, book/author/narrator/
genre/series ratings, sync states, explanations, errors, consent, and narrow-
screen/keyboard/screen-reader requirements. I want to be precise about what
0.0.1 actually contains before judging it, because conflating "the product
idea" with "this alpha's committed scope" would produce a review that blocks
the wrong thing.

Per `02-requirements-and-hierarchy.md` and the deferred inventory in
`06-backlog-index.md`:

- **Library sorting/filtering/facets** (ATR-PR15) is **D02, DEFERRED**. Alpha
  ships only a "minimal inspector" (ATR-S008) — a read-only snapshot view, not
  a navigable library.
- **Book/author/narrator/genre/series ratings and comments** (ATR-PR12) is
  **D01, DEFERRED**. Alpha keeps only a synthetic, non-user-facing local
  annotation *sentinel* used to prove sync doesn't clobber future user data
  (ATR-S003, ATR-S007). There is no rating UI in 0.0.1.
- **Recommendations and explanations** (ATR-PR13/14) are **D04, DEFERRED**.
  ATR-S010 is a trust *contract* with no engine and no UI.
- **Continuous/background synchronization** (ATR-PR04) is **D03, DEFERRED**.
  Alpha has manual, repeatable, fixture-tested import only (ATR-S004/S006/S007).

What **is** in scope for UX/accessibility review in 0.0.1: the **consent and
experiment-boundary disclosure** (ATR-S002), the **accessible evidence
inspector** (ATR-S008 — capture/inspect/export/delete, unknown-vs-known
states, import-only labeling, error/retry), and the **data lifecycle controls**
surface (ATR-S009 — export, disconnect, deletion confirmation).

My review below is organized by these two lenses: (A) findings on the actual
0.0.1 UX surface, and (B) forward-looking accessibility debt I require be
captured *now* in the deferred inventory so it is not silently dropped later
when D01/D02/D04 are promoted. Both are necessary — a plan that defers rich UX
correctly but forgets to carry forward its acceptance criteria creates rework
and accessibility regression risk exactly where Riker's sequencing notes warn
about ("Deployment choice creates rework").

---

## 1. Verdict

**CONDITIONALLY APPROVE the 0.0.1 baseline for G0**, with **blocking
requirements** that must be resolved before ATR-S008 implementation begins
(not before G0 itself, since G0 is a planning-review gate). My sign-off in the
officer handoff table moves from `PENDING` to `APPROVED WITH CONDITIONS` once
the Section 3 blocking items are incorporated into `03-user-stories.md` and
`06-backlog-index.md`.

I do **not** object to the aggressive deferral of library UX, ratings UX, and
recommendation UX — that is the correct sequencing discipline for a feasibility
alpha, and RPN R10 ("Inaccessible or misleading inspector") is already
correctly scored and gated to me at G5. My conditions are about making the one
UX surface that *does* ship (S008) fully testable, and about preventing
accessibility requirements from being silently lost across the D01–D04
deferral boundary.

---

## 2. Strengths

1. **Accessibility is a named release blocker, not an aspiration.** DoD-A item
   3 states "Worf security blockers and Geordi accessibility blockers must be
   resolved; no officer approval is presumed," and `04-sequencing.md` states
   "Accessibility defects remain at least HIGH and block release." This is the
   correct posture and matches WCAG's non-negotiable-floor framing in my
   operating instructions.
2. **ATR-S008 acceptance criterion 4 is unusually well-specified** for a
   backlog item at this altitude: it names keyboard-only checks, assistive-
   technology checks across "the entire exposed workflow," text alternatives
   accompanying state/color, visible focus, long-title overflow handling, and
   WCAG 2.2 AA — and explicitly requires "another harness needs equivalent
   platform accessibility checks with evidence" if the client isn't web. That
   sentence alone is why this alpha is platform-neutral-safe; keep it.
3. **"LCARS styling must never override readability or accessibility"** is
   stated verbatim in ATR-S008's Specific DoD. This anticipates exactly the
   failure mode I'm chartered to prevent (uppercase display type crushing
   long titles/explanations, low-contrast accent colors used for status).
4. **Honest-unknown-state discipline.** ATR-S003/S006/S008 collectively
   require that "unknown" be a first-class, displayed state distinct from
   "not started," "zero," or silently omitted — this is the right accessible
   pattern (WCAG 3.3.1/4.1.2: status must be programmatically determinable,
   not inferred from absence).
5. **Consent and lifecycle UX is scoped as a reviewable artifact**, not just a
   backend feature: ATR-S002 requires "understandable consent including
   fields, purpose, location, retention, stop/disconnect, export/deletion,"
   and ATR-S009 requires warnings ("export copies are private") and disclosure
   of what cannot be erased (provider-held/export copies) — this satisfies
   plain-language, non-dark-pattern consent norms and WCAG 3.3.2.
6. **Errors are required to be actionable, not just displayed.** ATR-S008 AC3
   ("Errors offer retry/reimport or safe stop") and ATR-S007 AC5 ("errors give
   a recovery action without exposing private values") match the
   APP_DESCRIPTION accessibility bullet "Explain errors in user terms and
   provide a retry or recovery action" and WCAG 4.1.3 (status messages).
7. **Untrusted-content rendering is explicitly an accessibility+security joint
   concern** (ATR-S008 AC5, risk R07 owned by "Worf + Geordi"). Rendering
   catalog/user text as inert is correctly treated as both an XSS control and
   a screen-reader-safety control (malformed markup read literally, not
   executed or misannounced).
8. **Deferred inventory correctly traces every deferred UX requirement back to
   its product section** (D01/D02/D04 cite ATR-PR02/PR12/PR13/PR14/PR15), so
   nothing is silently dropped from the requirements matrix — it is dropped
   from *this release's* commitments only. This is the right way to defer.

---

## 3. Blocking requirements

These must be resolved — by editing `03-user-stories.md` and/or
`06-backlog-index.md` — before implementation of ATR-S008 (or ATR-S002/ATR-S009
UX-facing pieces) begins. None of these require reopening scope or adding new
stories; they are acceptance-criteria and test additions to existing stories.

### B1 — ATR-S008 needs a target-size and reduced-motion acceptance criterion
AC4 covers keyboard, AT, color-independence, and focus visibility, but omits
two WCAG 2.2 items this project explicitly commits to elsewhere in its own
LCARS training material: **2.5.8 Target Size (≥24×24 CSS px or adequate
spacing)** for every actionable control (import, inspect, export, delete
buttons/links) and **`prefers-reduced-motion`** handling for any transition or
loading indicator used during import/inspect. Add to AC4:
> "Every actionable control meets a 24×24 CSS px minimum target size or has
> equivalent spacing; any transition, spinner, or status animation respects
> `prefers-reduced-motion` and has a non-animated equivalent."

### B2 — ATR-S008 needs an explicit focus-not-obscured criterion
If the inspector uses any sticky header/footer/status bar (common in an
LCARS-style frame with header/footer elbows), WCAG 2.2 **2.4.11 Focus Not
Obscured (Minimum)** must be named, not left to "focus is visible" alone —
visible and *unobscured* are different failure modes. Add: "No sticky region
(header, footer, status strip) fully or predominantly hides a focused
control; verify by tabbing through every exposed action with any sticky
chrome present."

### B3 — ATR-S008 lacks a destructive-action confirmation/undo acceptance
criterion tied to accessibility
ATR-S009 AC4 requires "explicit deletion confirmation" at the data-lifecycle
layer, but ATR-S008 (the UI that exposes delete) has no matching UX
acceptance criterion for how that confirmation is presented accessibly:
focus management on confirm/cancel dialog, an accessible name distinguishing
it from other dialogs, and no reliance on a modal that traps focus
incorrectly (WebAIM dialog focus-trap guidance, ARIA APG dialog pattern). Add
to ATR-S008: "Delete/disconnect confirmation is a properly labeled, focus-
trapped dialog with keyboard-operable confirm/cancel and focus return to the
triggering control on close or cancel."

### B4 — Missing acceptance test for narrow-screen / reflow
Nothing in ATR-S008's AC or Specific DoD requires a reflow/zoom check (WCAG
**1.4.10 Reflow** at 320 CSS px equivalent width, and 1.4.4/1.4.12 text
resizing/spacing) even though the request scope explicitly names narrow
screens and the platform is undecided between iPhone and responsive web. Add
a criterion: "The inspector is usable without horizontal scrolling or content
loss at a 320 CSS px equivalent viewport width, and at 200% text zoom /
user-overridden text spacing (WCAG 1.4.12)."

### B5 — "Distinguish imported data from personal data" has no accessible-
name/role requirement
APP_DESCRIPTION's accessibility bullet "Clearly distinguish imported data from
personal data" is referenced by ATR-PR06 but ATR-S008 AC2 only says
"Distinguish unknown from not started" — it doesn't say *how* imported vs.
personal (synthetic annotation sentinel) data must be distinguished for
assistive technology, not just visually. Since color-only distinction is
already forbidden project-wide, this needs an explicit non-visual cue
requirement. Add: "Source of record (imported vs. local/synthetic) is
conveyed by a text label or accessible-name/description, not layout or color
position alone, for every field and record where both may exist."

### B6 — Contrast/typography obligations are stated but not testable
"LCARS styling must never override readability or accessibility" is the right
principle, but it is not currently a pass/fail acceptance criterion with a
number. Per DoD-A item 1 ("recorded pass/fail evidence"), this needs a
measurable criterion. Add to ATR-S008 AC4: "Body/data text meets ≥4.5:1
contrast, large/status text and non-text UI components meet ≥3:1, verified
with a contrast-checking tool and recorded per color pair used."

### B7 — Deferred UX inventory (D01, D02, D04) does not yet carry forward
accessibility acceptance criteria that will be needed at promotion
This is the most consequential blocking item. `06-backlog-index.md`'s
deferred table lists a "Dependency before promotion" column for D01/D02/D04
but none of those dependencies mention accessibility. Given rating controls
(half-star input), facet browsing, and recommendation explanations are
precisely the kind of UI most prone to inaccessible custom widgets (custom
star pickers, drag reordering, dense data tables), silence here risks these
being designed without an accessibility gate the first time they're built.
Add an explicit accessibility dependency line to each of D01, D02, and D04 in
the "Dependency before promotion" column, referencing the specific criteria
in Section 5 below (star-rating keyboard operability, facet-table screen-
reader semantics, explanation expand/collapse disclosure pattern). This is a
documentation-only change and does not expand 0.0.1 scope.

---

## 4. Non-blocking recommendations

These improve future promotion readiness and reduce rework risk but do not
block G0 or S008 implementation.

1. **ATR-S011 (architecture decision)** should record accessibility API
   maturity as an explicit comparison axis when weighing iPhone-native vs.
   web vs. hybrid — e.g., UIKit/SwiftUI accessibility APIs vs. ARIA/HTML
   semantics — since "accessibility" already appears as a comparison axis in
   AC1 but is otherwise unweighted against the others (authorization, storage,
   cost). A one-line addition referencing VoiceOver/TalkBack parity vs. a
   screen-reader-tested web build would strengthen the eventual ADR.
2. **Reserve the audio-grammar hook now, implement never in 0.0.1.** Given
   this project's LCARS heritage includes an optional, muteable audio
   grammar, I recommend a single non-blocking note in ATR-S011 or the
   deferred inventory that any future audio feedback in Audible Track and
   Recommend must be OFF by default, user-toggleable, and never compete with
   in-progress audiobook playback (a concern unique to this product that
   generic LCARS dashboard audio guidance doesn't cover).
3. **Rating scale accessibility should be locked as a design constraint before
   D01 is promoted**, not discovered during implementation: half-star ratings
   need either a segmented radio-group pattern or a slider pattern per ARIA
   APG, with keyboard step behavior and a numeric text equivalent (e.g.,
   "4.5 out of 5") — stars-as-glyphs alone fail 1.1.1/4.1.2 without a text
   alternative, and this project's own accessibility bullet already commits
   to "readable rating controls with text alternatives."
4. **Facet detail views (author/narrator/genre/series) will need a landmark
   and heading strategy** once D02 is promoted — recommend the ADR or D02
   promotion criteria name `<main>`/landmark regions and a consistent heading
   level scheme up front, since APG landmark guidance is explicitly part of my
   sourced expertise and retrofitting heading structure after a card-based
   grid exists is expensive.
5. **Recommendation explanation UI (D04)** should carry forward the
   "concise, specific, and optional to expand" requirement as a disclosure
   widget pattern (ARIA `aria-expanded` on a real button, not a clickable
   `<div>`), and the "why this was recommended" text must remain mixed-case
   body copy per my constraints (not forced into uppercase LCARS display
   type), consistent with "Keep book covers and long recommendation
   explanations readable rather than forcing all content into uppercase
   display typography."
6. **Sync-status display (D03) should reuse the S008 unknown/known-state
   pattern.** When continuous sync is promoted, "last-sync status without
   interrupting normal use" should be a persistent, non-modal, text+icon
   status region (not a toast that disappears before AT users can perceive
   it) — recommend this be written into D03's future acceptance criteria now.
7. Consider explicitly stating in ATR-S008 that the wireframe/interaction
   spec required by AC1 must be reviewed by Geordi *before* any code is
   written, not merely "precede code" in sequence — the current phrasing is
   ambiguous about whether review is required or just chronological
   ordering. Tighten to "reviewed and approved by Geordi before
   implementation begins."

---

## 5. Missing UX/accessibility acceptance criteria and tests (consolidated)

By area, mapped to what ships now vs. what must be pre-loaded into deferred
inventory:

### Consent (ATR-S002 — in scope now)
- Missing: a readability/plain-language check on the consent text itself
  (e.g., reading level, avoidance of legal jargon) and a requirement that
  consent controls are keyboard-reachable and screen-reader-announced before
  any access begins.
- Missing: explicit statement that refusal/decline must be at least as
  easy to select as consent (no pre-checked consent, no visually
  de-emphasized decline control) — this is a WCAG 3.3.2/dark-pattern concern
  not currently named.
- Test to add: keyboard-only run-through of the consent flow with a screen
  reader, confirming the refusal path is announced and reachable in the same
  number of steps as acceptance.

### Evidence inspector (ATR-S008 — in scope now)
- Missing criteria: target size (B1), focus-not-obscured (B2), destructive-
  action dialog accessibility (B3), reflow/zoom (B4), non-visual source
  distinction (B5), numeric contrast pass/fail (B6). See Section 3.
- Missing test: screen-reader script (NVDA/VoiceOver, whichever is available
  in the chosen harness) reading through capture status, unknown fields, and
  an induced error state, confirming nothing is conveyed by icon/color alone.
- Missing test: a long-title/long-author-list fixture (per DoD-A's own
  testing philosophy of edge cases) run through the inspector to confirm no
  horizontal scroll or truncation without an accessible full-text alternative
  (e.g., `title` attribute alone is insufficient for touch/AT — needs a
  visible expand or wrap).

### Data lifecycle controls (ATR-S009 — in scope now)
- Missing: accessible confirmation dialog requirement (see B3) — currently
  only the backend behavior ("explicit deletion confirmation") is specified,
  not its UI accessibility.
- Missing: a requirement that the "cannot erase provider-held/export copies"
  disclosure is text, not solely an icon/tooltip, and is announced before the
  irreversible action is taken, not only afterward.

### Library sorting/facets (D02 — deferred; pre-load for later)
- Missing (for future promotion): keyboard operability of sort/filter
  controls equivalent to WebAIM's slider/select patterns; facet selection
  results announced via a live region or focus-moved-to-results pattern so
  screen-reader users aren't stranded on the control after applying a filter.
- Missing: a stated column/row semantics requirement if facet results render
  as a data table or grid (APG grid pattern vs. plain list — must be decided
  before implementation, not discovered afterward).

### Ratings — book, author, narrator, genre, series (D01/D02 — deferred; pre-load)
- Missing: keyboard-operable half-star input pattern and numeric text
  equivalent (see non-blocking #3, but I am flagging the *absence of any
  acceptance criterion at all* as a gap worth recording now, even though the
  work itself is correctly deferred).
- Missing: explicit-vs-inferred preference must be visually **and**
  programmatically distinguishable (e.g., `aria-description` "explicitly
  rated" vs. "inferred from listening"), consistent with the product
  requirement that "Inferred preferences must remain visibly distinguishable
  from ratings the user entered directly."

### Sync states (D03 — deferred; pre-load)
- Missing: persistent non-modal status-region requirement (see non-blocking
  #6) and a requirement that sync failure states use `role="status"` or
  equivalent so assistive technology is notified without requiring focus to
  move to the status region.

### Explanations (D04 — deferred; pre-load)
- Missing: disclosure-widget accessibility (see non-blocking #5) and a
  requirement that "uncertainty or missing data" (already a required content
  element per APP_DESCRIPTION) be presented as text adjacent to the
  explanation, not a separate icon-only indicator.

### Errors (ATR-S007/S008 — partially in scope now)
- Present: "errors give a recovery action without exposing private values"
  (ATR-S007 AC5) and "Errors offer retry/reimport or safe stop" (ATR-S008
  AC3) are good.
- Missing: a requirement that error text is programmatically associated with
  the action that failed (e.g., `aria-describedby` on the retry control) so
  screen-reader users don't have to search the page for context — add this to
  ATR-S008 AC3.

---

## 6. Platform-neutral LCARS design gates

These apply regardless of what ATR-S011 eventually selects (iPhone native,
responsive web, or hybrid), and should be treated as standing gates for any
future LCARS-styled surface in this product, not just ATR-S008:

1. **Semantic tokens, not raw hex.** Any LCARS palette used must be expressed
   as reusable named tokens (e.g., a `--lcars-*`-style set or the platform's
   equivalent design-token mechanism), never inline hex values, so contrast
   and theming can be audited in one place.
2. **Flat, vector LCARS grammar only.** No gradients, drop shadows, glows, or
   3D button effects on any pill/elbow/frame element — LCARS is inherently
   flat per Bracer Jack's guideline, and this applies equally to a native
   iOS view or a web component.
3. **Three type sizes, one family, mixed case for body copy.** UI chrome
   labels may be uppercase display type; book titles, author/narrator names,
   personal comments, and recommendation explanations must remain in their
   natural case and must not be forced into the display face at the expense
   of legibility — this is a hard constraint already stated in my authority
   and must be enforced the first time a title/comment renders in this
   product, i.e., inside ATR-S008.
4. **Elbow/frame asymmetry, not decoration removal for accessibility's
   sake.** Meeting WCAG must not be used as a reason to strip the LCARS
   identity down to a generic gray form — the two obligations are compatible
   (flat color, high-contrast solid fills, and restrained typography all
   satisfy both LCARS discipline and WCAG contrast simultaneously).
5. **Status must never be color-only**, already required by
   APP_DESCRIPTION's own accessibility bullet — extend this explicitly to any
   LCARS accent-color status convention (e.g., an "alert" orange) so a colored
   pill/elbow always carries a text or icon+text label as well.
6. **Audio grammar, if ever added, is supplemental and user-controlled**,
   never the sole means of conveying status, and never automatically enabled
   — consistent with WCAG's prohibition on non-text-only status
   communication and this project's own non-goal of interfering with
   audiobook playback.
7. **Any future admin/config chrome (if this product ever grows multi-surface
   admin controls) must remain keyboard-operable and correctly labeled** —
   noted here only as a standing principle inherited from prior LCARS
   review discipline; no such chrome exists or is proposed in 0.0.1.

---

## 7. Exact proposed changes by story/feature ID

| ID | File | Exact change |
| --- | --- | --- |
| ATR-S008 (AC4) | `03-user-stories.md` | Append: target size ≥24×24 CSS px or spacing (2.5.8); `prefers-reduced-motion` support for any animation; focus-not-obscured check against sticky chrome (2.4.11); reflow at 320 CSS px equivalent width and 200% text zoom/spacing (1.4.10/1.4.12/1.4.4); numeric contrast pass/fail record (≥4.5:1 body, ≥3:1 large/non-text) per B1, B2, B4, B6. |
| ATR-S008 (new AC) | `03-user-stories.md` | Add: delete/disconnect confirmation is an accessible, focus-trapped dialog with keyboard confirm/cancel and focus return on close (per B3, referencing ATR-S009 AC4). |
| ATR-S008 (AC2) | `03-user-stories.md` | Add: "Source of record (imported vs. local/synthetic) is conveyed by a text label or accessible name/description, not color or position alone" (per B5). |
| ATR-S008 (AC3) | `03-user-stories.md` | Add: error text is programmatically associated with its recovery control (e.g., `aria-describedby`) so assistive technology users don't lose context. |
| ATR-S008 (Specific DoD) | `03-user-stories.md` | Change "wireframe or interaction specification precedes code" to "...is reviewed and approved by Geordi before implementation begins" (tightening, non-blocking but recommended alongside the blocking edits since it's the same paragraph). |
| ATR-S002 (AC2) | `03-user-stories.md` | Add: refusal/decline control must be at least as reachable and visually equivalent as consent/accept; no pre-checked consent. |
| D01 | `06-backlog-index.md` deferred table | Add to "Dependency before promotion" column: "Keyboard-operable half-star rating pattern with numeric text equivalent; explicit-vs-inferred distinction exposed to assistive technology, not only visually." |
| D02 | `06-backlog-index.md` deferred table | Add to "Dependency before promotion" column: "Keyboard-operable sort/filter controls; filter-result focus/announcement pattern; table vs. list semantics decided before implementation." |
| D03 | `06-backlog-index.md` deferred table | Add to "Dependency before promotion" column: "Persistent non-modal `role=\"status\"` sync-state region; failure states announced without requiring focus move." |
| D04 | `06-backlog-index.md` deferred table | Add to "Dependency before promotion" column: "Explanation disclosure uses a real button with `aria-expanded`; explanations and uncertainty notes remain mixed-case body text, never forced into uppercase display type." |
| Officer handoff table | `05-risks-and-release-gates.md` | Update Geordi row from `PENDING` to `APPROVED WITH CONDITIONS — see planning/0.0.1/reviews/geordi-review.md` once Riker reconciles the above edits. |

---

## 8. Approval conditions

I will change my sign-off from `PENDING` to `APPROVED` at G0 when:

1. Section 3 items B1–B7 are incorporated into `03-user-stories.md` (ATR-S002,
   ATR-S008) and `06-backlog-index.md` (D01, D02, D03, D04) as literal
   acceptance-criteria or dependency-column text — not merely acknowledged in
   a review response.
2. Riker's reconciliation pass (per the G0 "findings reconciled into
   specs/contracts and plan" requirement) references this document by path.
3. No change to the 0.0.1 point total, story count, or feature inventory is
   introduced by these edits — they are acceptance-criteria refinements to
   existing stories and deferred-inventory text, not new scope, consistent
   with `06-backlog-index.md`'s "No feature lacks a story or has implicit
   implementation work outside this index."

I remain the required review gate on ATR-S006 (state semantics), ATR-S008
(owner), ATR-S009 (controls/consent), ATR-S010 (honest explanations),
ATR-S011 (accessibility comparison axis), ATR-S012 (all-officer review), and
G5 (full accessible-workflow regression). None of those gates are reached by
this document; this is the G0 planning-level sign-off only.

**Stop here per the plan's own instruction: no implementation, commit, push,
or release action follows this review.**
