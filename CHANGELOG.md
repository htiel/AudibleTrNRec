# Changelog

Notable changes to Audible Track and Recommend are recorded here.
This follows the [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) format.
Dates use ISO 8601. An implementation milestone is not a release approval.

## [Unreleased]

Integrated Alpha 0.0.2 working-tree changes, reconciled after the delayed Data
audit on 2026-09-21
against the Captain's definitive verification results and current code. The
application version remains `0.0.2`; these changes are not a published release.

### Added

- Separate encrypted Author, Narrator and Series group ratings, comments and
  tags, editable while the group's books remain collapsed.
- Validated, tab-scoped Library filter/sort/group/collapse persistence across
  refreshes, without saving drafts or placing private queries in URLs.
- Settings route, header gear and sidebar link; persistent, opt-in Liquid Glass
  web theme alongside the default LCARS theme.
- Separate Apple-style and LCARS shell constructors with neutral shared views;
  Apple navigation bar, Library/Data/Settings tabs, contextual back navigation
  and responsive desktop content column.
- Bounded Library paging: 50 ungrouped rows or five groups × ten children;
  validated tab-scoped page persistence, complete counts and no "Show all" (#10).
- Synthetic-default capture runner, neutral manifests/filenames, ignored
  artifacts, per-run real-data consent/retention and verified purge procedure
  (#14). Optional browser tooling remains undeclared/unpinned.
- Actual synthetic `--theme all` capture verifies both `lcars` and
  `liquid-glass` in the live DOM; final run wrote 12 neutral PNGs plus manifest
  and purge verified.
- Non-destructive Data inventory with explicit known/Unknown title, feedback
  and last-import evidence. Actual sync reconciliation persists in an
  account/snapshot-bound, non-sensitive `last-import-counts.json` sidecar,
  restores after reload, and is invalidated with its source snapshot.

### Changed

- Library controls are search-first with collapsed advanced filters on mobile;
  LCARS desktop main content and filter rail scroll independently (#5).
- Author/narrator display groups combine normalized equal names while retaining
  source identities; this is not a canonical catalog-person merge.
- Five progressive whole-star radio controls replace rating dropdowns. Legacy
  half-star ratings remain readable and are not silently rounded.
- Synopsis ingestion emits bounded plain text with paragraph breaks; unknown
  series evidence is labeled consistently (#3, #4).
- Connection health reports disconnected/unverified/verified/authorization-failed
  from provider-interaction evidence with a 24-hour freshness horizon. Legacy
  `connected` remains credential-custody metadata, not health (#8).
- Apple HIG/API/design resources remain normative; Google image search is
  non-normative inspiration only. No third-party imagery/UI asset copying,
  tracing, bundling or hotlinking, and no private uploads.
- Saved filter/page state is keyed only by schema (`atnr:private-library-filters:v2`);
  valid legacy release keys migrate by copy without overwriting canonical
  state or deleting browser data.

### Fixed

- Private-page module loading: browser code no longer imports Node-only feedback
  persistence. The router renders before one bulk feedback hydration request;
  bootstrap/hydration failure produces a visible, focusable refusal.
- Route-focus scroll jumps, grouped disclosure affordances, inline-edit focus,
  wrapping, target sizing and narrow-screen layout regression guards.
- Filter text/boundary styling, stable debounced search controls, empty
  non-Library filler, footer clearance, filter overflow cue, evidence-scoped
  accessibility wording and button-like anchor decoration (#1, #2, #6, #9,
  #11, #12, #13). Full rendered acceptance remains separate from implementation.
- Independent-review findings: reachable Previous/Next controls for row/group/
  child pages (with dirty-draft guard); stable person feedback IDs with
  canonical-first, revision-safe legacy-alias migration; generation-guarded
  theme activation; and failed-sync connection-evidence/status refresh.
- Apple styling no longer references LCARS tokens. Theme switching actually
  enables/disables scoped stylesheets: Apple disables both LCARS sheets, and
  LCARS disables the Apple sheet. This resolves the previous independence
  and stylesheet-toggle discrepancies.
- Delayed Data-audit fixes: completed/partial progress no longer appears as
  undifferentiated fact; closed owner-facing provenance labels; private
  Feasibility removed from primary navigation and context-linked from Data;
  one Status label; one actionable Book-detail feedback guidance link.
- Snapshot parsing is explicitly **Unknown / not an import**. Last-import
  counts come only from actual sync reconciliation or its validated persisted
  receipt; unmeasured counts remain Unknown, never manufactured zeros.

### Removed

- Prototype per-start local unlock key, launcher prompt and capability
  re-entry. Audible's external-browser device registration is **retained**.

### Security

- The owner explicitly accepts same-user local-process access on the dedicated
  prototype computer. Loopback binding, Host/origin/fetch-metadata checks,
  in-memory sessions, CSRF and action-bound confirmation nonces remain; they
  are not local-client authentication. Stop the server when idle.
- Owner-only conditional evaluation remains the limit. Named testers,
  distribution, hosting, packaging and public/commercial release remain NO-GO.
  Fresh connector installation remains blocked by two unapproved source artifacts.
- Visible informed consent now precedes private and synthetic JSON export;
  cancellation requests no export or nonce and creates no file. Accepted
  exports remain plaintext outside ATnR custody and cannot be recalled (#7).
- Definitive post-audit evidence: Node **685 total / 684 pass / 0 fail /
  1 environment symlink skip**, **87.7 seconds**; connector
  **128 total / 126 pass / 0 fail / 2 skips**; policy PASS. The earlier live
  private matrix confirms Apple starts with zero LCARS classes and 50 rows
  (`Showing 1–50 of 180 (page 1 of 4)`), Next reaches 51–100, and rapid
  Apple→LCARS ends with matching stylesheet states and no errors.
  This documentation reconciliation did not rerun those operations. See the
  [accumulated implementation record](planning/0.0.2/12-accumulated-implementation.md)
  for issue #1–#14 disposition, evidence, plan deviations and remaining gates.
  Playwright remains undeclared/unpinned; physical-device/VoiceOver and current
  provider-revocation evidence remain open. No UIKit/SwiftUI equivalence,
  issue closure or release approval follows.

## [0.0.2] - 2026-09-17

**Alpha implementation baseline, not a published or gate-cleared release.**
Repository history records `53fc550` (“Build Alpha 0.0.2 private library”);
the subsequent uncommitted work is tracked above.

### Added

- Real encrypted Windows-local private library runtime, fail-closed bootstrap,
  encrypted private book feedback, and revision-3 storage migration with
  account anchoring and recovery controls.
- Library facets and feedback editing, durable reconciliation, complete local
  export and distinct snapshot/feedback deletion controls.
- Conditional owner-only implementation verdict, preserving source-feasibility,
  security, accessibility, legal and audience gates.

### Security

- Retained the unofficial community Audible connector, provider-hosted Edge
  authorization, DPAPI custody and persistent virtual-device lifecycle.
- Alpha 0.0.1 remains an archived HOLD/FAIL evidence baseline, not a passed release.
