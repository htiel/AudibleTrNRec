# Geordi La Forge — LCARS UX and accessibility review of Alpha 0.0.2 planning

**Reviewer:** Geordi La Forge, LCARS design and accessibility authority
**Reviewed:** `APP_DESCRIPTION.md`; `planning/0.0.2/01` through `08`
(README, release charter, scope, backlog, sequencing, risks/gates, owner
feedback OF-001–OF-007, native iPhone direction, implementation plan);
`code/Alpha0.x/ui/index.html`, `ui/css/tokens.css`, `layout.css`, `base.css`,
`components.css`, `ui/js/views/library-view.js`.
**Method:** Read-only inspection of tracked planning and 0.0.1 baseline code.
No app was started, no personal/live data was touched, and no plan or
implementation file was altered. This report is staged as a new file only.

## Verdict: **CONDITIONAL APPROVE**

The 0.0.2 plan (particularly OF-001–OF-006, CP-05, S033/S034/S035/S037/S038,
and work packages WP033–WP038) correctly identifies and sequences the LCARS
and accessibility problems I would have raised independently: an always-Unknown
Genre facet, a provenance-cluttered library table, no collapsible groups, no
inline feedback, an undifferentiated navigation rail, and a desktop-first
layout that has never been measured against a real mobile viewport. The
acceptance-evidence language is unusually rigorous for a planning document and
already anticipates most of the LCARS compliance checklist and WCAG 2.2 floor
I am required to enforce. I can approve this plan **for design work to
proceed** subject to the corrections in "Required corrections" below, all of
which are resolvable at CP-05 without reopening the 112-point inventory. I
withhold approval of any **implementation** or **gate** until CP-05 is
closed with dated sign-off and the ambiguities below are resolved in writing,
per the plan's own "evidence before permission before implementation" rule
(`08-implementation-plan.md` §1, principle 1).

Nothing here overrides A2-G0/G2 BLOCKED status, HOLD/FAIL 0.0.1 disposition,
or the Captain's authority over new UX surfaces.

## Positive controls (what the plan gets right)

1. **Column reasoning is task-based, not field-based.** `06-owner-feedback.md`
   OF-003 and `08-implementation-plan.md` §7 "Mobile-first information
   architecture" table require every retained column to carry a listener task
   and explicit responsive behavior, and explicitly exile Source/provenance/
   internal-ID/raw-sync fields to a single Data/Connection surface. This is
   exactly the LCARS "empty space is beautiful, don't repeat implementation
   plumbing in the primary frame" discipline (Bracer Jack Manifesto rule 3),
   and it matches what the current `library-view.js` `buildTable()` violates
   today (`Genre` and `Source` columns are both present and, per OF-002's
   observation, Genre is "consistently displayed as Unknown").
2. **Genre has a real prove-or-remove gate**, not a cosmetic patch: OF-002 and
   `ATR-S037` AC4–AC5 forbid title/synopsis/behavior heuristics or LLM
   classification and require either a deterministic source mapping or
   complete removal from cards, detail, search hints, filters, sort, and
   grouping. This avoids the common LCARS-adjacent failure mode of leaving a
   dead facet "for later."
3. **Grouping/disclosure semantics are specified correctly**, not just
   described visually: `03-backlog.md` ATR-S037 AC6 and `08-implementation-plan.md`
   §7 "Feedback, grouping and state" require button/disclosure group headings
   with counts and `aria-expanded` state, Expand-all/Collapse-all when
   multiple groups exist, and collapsed content removed from the
   accessibility tree and tab sequence — this is the correct APG disclosure
   pattern, not a CSS-only visibility toggle.
4. **Feedback authority is pinned to the book, not the group heading**, in
   three independent places (`06-owner-feedback.md` OF-004, `03-backlog.md`
   ATR-S033 AC4, `08-implementation-plan.md` §7). This prevents a foreseeable
   defect class where a rating typed against "Author: Sanderson" silently
   attaches to the wrong or an ambiguous entity.
5. **The gray filler is specified as truly decorative**: `aria-hidden`,
   unfocusable, no status/action, collapses (not clips/reorders) at narrow
   widths (`03-backlog.md` ATR-S034 AC4–AC5; `08-implementation-plan.md` §7).
   This matches the existing `.lcars-sidebar-filler` precedent in
   `layout.css` (`display: none` under the 640px breakpoint) — the plan is
   asking for a pattern the codebase has already validated once.
6. **iPhone Air is treated as a design canvas, not a squeeze target.** OF-006
   correctly separates "measure the authoritative/real CSS viewport, DPR,
   safe-area insets, and browser chrome first" from "then freeze breakpoints,"
   and correctly keeps 320 CSS px and 200% zoom as an accessibility stress
   case rather than deleting it. This is the right order of operations.
7. **State preservation is explicit and privacy-conscious**: `ATR-S038` and
   `08-implementation-plan.md` §7 require filter/sort/group/scroll/focus state
   to survive save, back-navigation, and recoverable refresh failure, held in
   session memory only — never in URLs, logs, or persistent storage. This
   protects private query/comment content from leaking into browser history
   or local storage, which I would otherwise have flagged as a privacy gap.
8. **One-time, non-duplicative save announcements** are specified
   (`ATR-S033` AC2, `ATR-S034` AC3): draft/saving/saved/error are distinct
   states, and only a durable commit announces "Saved." This avoids the
   common false-positive-save defect the archived 0.0.1 register already
   flagged (A2-R06 in `05-risks-and-release-gates.md`).
9. **44×44 CSS px is stated as the primary-control touch-target floor**
   (OF-006; `ATR-S034` AC7; closure matrix), above the WCAG 2.2 §2.5.8 24×24
   px minimum — this is the correct, more conservative Apple HIG-aligned
   target for a mobile-first design, and the plan is explicit that "CSS px
   evidence is not an iOS point measurement" (`07-native-iphone-direction.md`)
   for any future native comparison.
10. **Synthetic-only mobile evidence boundary is enforced**
    (`08-implementation-plan.md` §7, "Synthetic-only device evidence needs a
    reviewed isolated static/stub arrangement... No LAN exposure, tunnel,
    public host, TestFlight upload"), which correctly keeps OF-006 mobile
    testing from becoming an unauthorized route into the live private service.

## Findings by severity (exact plan citations)

### Blocking (must resolve before CP-05 closes / before A2-G0)

**B1 — "One persistent announcement channel" is ambiguous against existing
two-region ARIA practice and against the current codebase.**
`03-backlog.md` ATR-S034 AC3: "One persistent announcement channel speaks
each event once while visible status remains." `08-implementation-plan.md`
§7: "One persistent announcement channel serves save/sync/errors; visible
status is not a second live region." The current baseline
`code/Alpha0.x/ui/index.html` already ships **two** live regions
(`#live-polite` with `role="status"`/`aria-live="polite"` and
`#live-assertive` with `role="alert"`/`aria-live="assertive"`), which is the
standard and correct WAI-ARIA pattern for distinguishing routine confirmation
from urgent error interruption. As written, "one persistent announcement
channel" could be read literally as "collapse polite and assertive into a
single `aria-live` region," which would be an accessibility regression (an
error message announced at `polite` priority can be silently dropped by a
screen reader mid-utterance, or a save confirmation announced at `assertive`
priority becomes needlessly disruptive). I need an explicit design decision at
CP-05: either (a) "one channel" means one **integrated announcement
pipeline** in `ui-store.js`/`app.js` that still emits to the correct
polite/assertive region depending on event severity, and the "not a second
live region" language means "do not add a *third*, ad hoc region," or (b) the
plan genuinely intends a single region and needs to specify how urgent
save-failure/conflict/error messages remain reliably announced without a
dedicated assertive channel. Ship (a) unless a reviewed alternative is
specified; do not implement literal collapse-to-one without this decision
recorded.

**B2 — "Primary control" touch-target scope is undefined, creating an
audit gap between the 24px WCAG floor and the 44px LCARS/mobile target.**
OF-006 and `ATR-S034` AC7 require "at least 44 by 44 CSS px primary touch
targets," while `08-implementation-plan.md` §7 separately states the WCAG 2.2
AA minimum is "≥24×24 CSS px or valid spacing" and reserves 44px for "primary
touch controls." Neither document defines which controls in the grouped
library, inline feedback editor, or navigation rail count as "primary" versus
merely WCAG-floor-compliant. Concretely: is a group-heading disclosure toggle
"primary" (it gates all content underneath — I would say yes)? Is a
per-book "Edit feedback" action primary (yes)? Are individual half-star
controls inside an open editor primary, or is only the editor's Save button
primary? Is a facet checkbox in the filter fieldset primary? Without an
enumerated list, two implementers could reasonably ship different target
sizes and both claim compliance. **Required correction:** CP-05 must produce
an explicit "primary control" inventory (at minimum: navigation destinations,
group expand/collapse, book feedback entry point, half-star/clear/delete
controls inside the open editor, Save, and lifecycle actions on
Data/Connection) before WP033/WP034/WP038 rendered evidence is accepted.

**B3 — Current baseline touch-target token (`--lcars-min-target: 2.5rem` =
40px) is below the plan's own 44px primary-control requirement and is not
called out anywhere in the plan as a token that must change.**
`code/Alpha0.x/ui/css/tokens.css` defines `--lcars-min-target: 2.5rem`, used
throughout `components.css` (`.lcars-btn`, form controls, checkbox rows) and
`layout.css` (`.lcars-sidebar a`). At the default 16px root, 2.5rem is 40 CSS
px — it satisfies WCAG 2.2 §2.5.8 (≥24px) but not the plan's own OF-006/S034
44px primary-control target. WP033/WP034 must either introduce a distinct
`--lcars-min-target-primary: 2.75rem` (44px) token layered over the existing
2.5rem token for genuinely secondary controls, or raise the shared token and
explicitly re-justify keeping any control below 44px. This is a concrete,
one-line implementation gap the plan should name so CP-05 does not treat "we
already have a min-target token" as satisfying OF-006.

### Major (must resolve before A2-G5 rendered/AT evidence is accepted)

**M1 — 1.4.12 Text Spacing (AA) is not named among the WCAG 2.2 criteria the
plan enumerates for rendered evidence.** `ATR-S034` AC1–AC2 and
`08-implementation-plan.md` §7/§8 test 320 CSS px, 200% zoom (1.4.4/1.4.10),
skip links/landmarks/dialog trap/focus/contrast (2.4.7/2.4.11/1.4.11), and
reduced motion, but never cite 1.4.12 (user-overridden line-height,
paragraph/word/letter spacing must not clip or truncate content). Given the
plan's own `.lcars-title`/`.lcars-status-pill` use `overflow-wrap: anywhere`
and fixed-px elbow geometry deliberately excluded from reflow (documented in
`tokens.css`'s own comment), a text-spacing override is a plausible place for
a title or status pill to visually collide with the elbow. Add a 1.4.12
check to the S034/A2-T20-class rendered evidence list.

**M2 — The Genre closure matrix does not state what happens to the existing
`GROUP_FIELDS`/`CATALOG_SORT_FIELDS`/search-hint copy in the running 0.0.1
code if Genre is removed vs. retained**, beyond "optional schema may remain."
`code/Alpha0.x/ui/js/views/library-view.js` currently wires `genre` into
sort fields, `genres` into group fields, and search-hint placeholder text
("e.g. dungeon, Ashgrove, fantasy") does not currently reference genre, but a
`Reset filters` button and status-fieldset pattern exist that a Genre removal
must not orphan (e.g., a stale `#lib-group` option value of `genres` after
removal must not silently no-op the group selector). `ATR-S037` AC5 requires
"no always-Unknown genre, empty group heading... remains" — I recommend WP037
explicitly add a case for "selecting a since-removed Genre grouping/sort
option is impossible, not silently ignored," since the plan's acceptance
evidence is phrased as an absence check and could be satisfied by simply
hiding the `<option>` while leaving dead code paths reachable via direct
`readState()` manipulation or a stale bookmark scenario. Low likelihood, but
worth a named negative test given how easy this bug class is to introduce
when trimming a select's option list.

**M3 — "Do not expose full comment previews by default in dense rows" (§7
column table) has no defined disclosure trigger.** The private-feedback
indicator row in `08-implementation-plan.md` §7 states the compact row shows
"rated/unrated and has-note" and that "explicit edit opens local book
editor," but does not say whether a *read-only* preview of the comment is
ever available short of entering edit mode (e.g., on hover/long-press, in an
expanded group row, or only inside the editor). For a private, comment-only
mobile flow this matters for OF-006's "no required hover" rule — if any
comment preview exists it must be reachable by focus/tap, not only `:hover`.
Recommend CP-05 explicitly state: comment content is visible only inside the
opened editor (simplest, safest), or define the keyboard/touch-equivalent
disclosure if a preview is wanted later.

**M4 — Sort fields still list history/completion-derived columns
(`lastListenedAt`, `completedAt`, `acquiredAt`, `durationMinutes`) as active
`CATALOG_SORT_FIELDS` in the current code, while `08-implementation-plan.md`
§7 places these under "Retain only after Captain task/semantics audit;
unsupported history/completion dates labeled/disabled, not inert misleading
sorts."** This is a real baseline/plan mismatch, not merely a future
implementation task: the 0.0.1 code today lets a user sort by
`lastListenedAt`/`completedAt` even though `03-backlog.md`/S014 treat listening
history as unapproved, unproven source data (A2-G3 four-domain gate still
BLOCKED). WP038's column audit must explicitly enumerate this exact
`SORT_FIELDS` list and either disable/relabel these options or justify their
retention against the audit criteria in AC4, rather than treating the column
matrix table in §7 as sufficient without touching the sort/group control
population logic that feeds the same table.

### Minor / suggestions (non-blocking, quality improvements)

**S1 — `forced-colors`/Windows High Contrast Mode is not mentioned.** Not a
WCAG 2.2 AA requirement and not blocking, but LCARS's flat, non-gradient
palette is unusually forced-colors-friendly; a one-line acceptance note in
`ATR-S034` to verify the `.lcars-sidebar a[aria-current="page"]`,
`.lcars-btn:active`, and focus-ring styles remain distinguishable under
`forced-colors: active` would be cheap insurance for the Captain's own use on
Windows.

**S2 — The plan's "no hover required" rule (OF-006) should be paired with an
explicit `:focus-visible` parity check for any `:hover`-styled control** (the
current `.lcars-sidebar a:hover`/`.lcars-btn:hover:not(:disabled)` use
`filter: brightness(1.15)`, which is a good pattern already — recommend
WP033/034 rendered evidence explicitly confirm the same brightness affordance
is reachable via focus, not just documented as "no hover required" in prose.

**S3 — Consider naming the exact iPhone Air Safari safe-area properties to
measure** (`safe-area-inset-top/right/bottom/left`, `viewport-fit=cover` meta
requirement) in `ATR-S034` AC6 rather than only "safe-area insets" generically,
since the current `index.html` viewport meta tag
(`width=device-width, initial-scale=1`) does not yet include
`viewport-fit=cover`, which is a prerequisite for `env(safe-area-inset-*)` to
resolve to non-zero values at all on iOS Safari. This is implementation
detail, but naming it in CP-05 removes an easy way to "pass" safe-area
evidence with insets that are silently always zero.

## Required corrections (summary, action-oriented)

1. Resolve **B1**: record whether "one persistent announcement channel" means
   one integrated pipeline over the existing polite/assertive regions, or a
   literal single region with a stated urgent-message strategy. Update
   `ATR-S034` AC3 wording once decided.
2. Resolve **B2**: publish an enumerated "primary control" list for the 44px
   target before WP033/034/038 evidence is accepted.
3. Resolve **B3**: introduce or size a distinct 44px primary-control token
   (or raise the shared token with justification) in `tokens.css` under
   WP034; do not let the existing 40px `--lcars-min-target` silently satisfy
   OF-006.
4. Add 1.4.12 Text Spacing to the S034 rendered-evidence checklist (**M1**).
5. Add an explicit negative test for stale/removed Genre grouping and sort
   selections in WP037 (**M2**).
6. State the comment-preview disclosure rule explicitly in CP-05 (**M3**).
7. Extend WP038's column audit to cover the live `SORT_FIELDS`/`GROUP_FIELDS`
   population logic in `library-view.js`, not only the rendered column table
   (**M4**).
8. Optional: add forced-colors, focus-parity-for-hover, and named
   safe-area-inset properties to acceptance evidence (**S1–S3**).

## Acceptance evidence I require before I sign off CP-05 / A2-G0 (Geordi scope)

- A dated navigation/column inventory naming every retained field's listener
  task and responsive behavior (OF-003 already requires this; I require it in
  writing, not only implied by the §7 table, before implementation starts).
- A dated, measured iPhone Air Safari CSS viewport/DPR/safe-area-inset record,
  captured from either Apple's published specification or a real device/
  approved-equivalent simulator — not inferred from physical display pixels.
- Rendered (not merely automated) evidence at: desktop, iPhone Air portrait,
  iPhone Air landscape, 320 CSS px, and 200% zoom, covering navigation,
  search/filter/group, expand/collapse, inline feedback create/edit/clear/
  delete, validation failure, save failure/conflict, and lifecycle dialogs.
- Keyboard-only and screen-reader-only journeys for the same flows, including
  dialog focus trap/Escape/return-focus and the resolved single-vs-dual
  announcement-channel behavior from **B1**.
- Text contrast ≥4.5:1 body / ≥3:1 large text and non-text/focus ≥3:1 measured
  against actual adjacent rendered surfaces (not token values in isolation),
  consistent with the plan's own instruction that "A022 is a measurement
  hold, not permission for a blanket black-outline change."
- Confirmation that the gray filler is absent from the accessibility tree and
  tab order at every tested breakpoint, and that collapsing it never
  separates a navigation item from its accessible name or active/focus state.
- A resolved Genre retain/remove decision with either a deterministic mapping
  fixture or an exhaustive-absence DOM assertion set, per OF-002.

## Story / work-package mapping (for Riker cross-officer coordination)

| Finding | Backlog story | Work package(s) | Owner-feedback tie |
| --- | --- | --- | --- |
| B1 announcement channel ambiguity | ATR-S034 | A2-WP034 | OF-005 |
| B2 primary-control inventory gap | ATR-S034, ATR-S033 | A2-WP033, A2-WP034 | OF-006 |
| B3 40px baseline token vs. 44px target | ATR-S034 | A2-WP034 | OF-006 |
| M1 missing 1.4.12 evidence | ATR-S034 | A2-WP034 | OF-006 |
| M2 stale Genre control paths | ATR-S037 | A2-WP037 | OF-002 |
| M3 comment-preview disclosure rule | ATR-S033, ATR-S038 | A2-WP033, A2-WP038 | OF-004, OF-006 |
| M4 history-derived sort fields still live | ATR-S038 | A2-WP038 | OF-003 |
| S1 forced-colors | ATR-S034 | A2-WP034 | — |
| S2 focus/hover parity evidence | ATR-S034 | A2-WP033, A2-WP034 | OF-006 |
| S3 named safe-area properties | ATR-S034 | A2-WP034 | OF-006 |

## Ambiguities requiring an explicit Captain decision

1. **Announcement-channel model (B1).** This affects `ATR-S034` AC3 wording
   and cannot be resolved by Geordi/Wesley design alone if the Captain's
   intent behind "one persistent announcement channel" was literal
   single-region consolidation for simplicity; I recommend the
   dual-region/single-pipeline reading but flag it for explicit confirmation
   since it changes acceptance-test wording in a mandatory gate document.
2. **Primary-control enumeration (B2).** Naming exactly which controls
   receive the 44px floor versus the 24px WCAG floor is a design-authority
   decision I can propose (see enumerated list in B2) but the Captain or
   Riker should confirm it does not silently expand scope beyond the
   112-point inventory before it is written into CP-05.
3. **History-derived sort/group fields (M4).** Whether `lastListenedAt`,
   `completedAt`, `acquiredAt`, and `durationMinutes` remain selectable sort
   fields at all in 0.0.2 depends on the Captain's task/semantics audit
   referenced in §7's column table ("Retain only after Captain task/semantics
   audit"); this is explicitly reserved to the Captain, not to me, and I am
   only flagging that the current code has not yet had that audit applied.

## What I did not do

I did not run, build, or modify any code; did not open, seed, or query any
database; did not start a local server or connector; did not access personal
or live Audible data; and did not edit any file outside this new review
report. No plan document, backlog item, or gate state was changed.
