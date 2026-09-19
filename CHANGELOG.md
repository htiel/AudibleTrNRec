# Changelog

Notable changes to Audible Track and Recommend are recorded here.
This follows the [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) format.
Dates use ISO 8601. An implementation milestone is not a release approval.

## [Unreleased]

Accumulated Alpha 0.0.2 working-tree changes, documented 2026-09-19. The
application version remains `0.0.2`; these changes are not a published release.

### Added

- Separate encrypted Author, Narrator and Series group ratings, comments and
  tags, editable while the group's books remain collapsed.
- Validated, tab-scoped Library filter/sort/group/collapse persistence across
  refreshes, without saving drafts or placing private queries in URLs.
- Settings route, header gear and sidebar link; persistent, opt-in Liquid Glass
  web theme alongside the default LCARS theme.

### Changed

- Library controls moved into the sidebar; desktop main content and filter
  rail scroll independently, with document-flow layout on narrow screens.
- Author/narrator display groups combine normalized equal names while retaining
  source identities; this is not a canonical catalog-person merge.
- Five progressive whole-star radio controls replace rating dropdowns. Legacy
  half-star ratings remain readable and are not silently rounded.

### Fixed

- Private-page module loading: browser code no longer imports Node-only feedback
  persistence. The router renders before one bulk feedback hydration request;
  bootstrap/hydration failure produces a visible, focusable refusal.
- Route-focus scroll jumps, grouped disclosure affordances, inline-edit focus,
  wrapping, target sizing and narrow-screen layout regression guards.

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
- Latest executed automated evidence: Node 487 total / 486 pass / 1 skip;
  Python 98 total / 96 pass / 2 skip; policy PASS. No new live-account or
  rendered-device verification is claimed. See the
  [accumulated implementation record](planning/0.0.2/12-accumulated-implementation.md)
  for evidence, Apple design-resource provenance and remaining gates.

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
