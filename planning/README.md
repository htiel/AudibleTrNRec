# Release planning

## Current plan

**[Alpha 0.0.2](0.0.2/README.md)** — implemented build reviewed on 2026-09-17:
**owner-only APPROVE WITH CONDITIONS; named testers/public/commercial NO-GO**.
**4 themes / 8 epics / 30 features / 30 stories / 112 estimated points.**
The [final verdict](0.0.2/11-implementation-release-verdict.md) records code
acceptance separately from incomplete CP/source/evidence/release gates.
The [2026-09-19 accumulated implementation record](0.0.2/12-accumulated-implementation.md)
covers the uncommitted follow-ups, current test evidence, keyless loopback trust,
group feedback, browser preferences and theme provenance. Historical reports
do not automatically approve those later changes.

| Document | Authority |
| --- | --- |
| [Release charter](0.0.2/01-release-charter.md) | Mission, CTQs, scope approval and private-data boundaries |
| [Scope and hierarchy](0.0.2/02-scope.md) | Themes, epics, features, product traceability and exclusions |
| [Backlog and stories](0.0.2/03-backlog.md) | Canonical status, WSJF, owners, dependencies, points and acceptance criteria |
| [Sequencing](0.0.2/04-sequencing.md) | Dependency graph, capacity, implementation/review order |
| [Risks and release gates](0.0.2/05-risks-and-release-gates.md) | FMEA, evidence, permissions and release decision |
| [Implementation review index](0.0.2/implementation-reviews/README.md) | Amended officer verdicts, scope and evidence limitations |
| [Implementation/release verdict](0.0.2/11-implementation-release-verdict.md) | Owner-only usable build versus named/public NO-GO; package status and remaining blockers |
| [Accumulated implementation](0.0.2/12-accumulated-implementation.md) | Current working-tree behavior, executed evidence, Apple references and residual limits |
| [Archive index](archive/README.md) | Immutable historical releases and their outcomes |

## Archived baseline

**[Alpha 0.0.1 — HOLD/FAIL](archive/0.0.1/feedback-and-bugs/alpha-0.0.1-release-verdict.md)**.
The archived inventory is 3 themes / 5 epics / 13 features / 13 stories /
51 points. The earlier 38-point inventory is historical within that baseline.
G0 planning approval and the narrow G1 private-connector exception did not pass
G2–G6. Neither owner-only unqualified clearance nor named-tester clearance was
earned. The [51-finding register](archive/0.0.1/feedback-and-bugs/bug-register.md)
remains evidence, not a list of fixes completed by archiving.

## Conventions

- Permanent IDs: `ATR-Txx` theme, `ATR-Exx` epic, `ATR-Fxx` feature,
  `ATR-Sxxx` story. Never reuse or renumber archived IDs. 0.0.2 begins at
  T04, E06, F14 and S014. `ATR-A001`–`ATR-A051` are inherited finding IDs,
  not stories. `ATR-PRxx` are planning aliases into
  [APP_DESCRIPTION.md](../APP_DESCRIPTION.md), not IDs in the product brief.
- XS=1, S=2, M=3, L=5, XL=8 are relative estimates, not time promises.
  WSJF = (BV + TC + RR) / size; each CoD factor is 1–5. Dependencies and
  blocking security/accessibility gates take precedence over arithmetic.
- Status vocabulary: `PLANNED`, `BLOCKED`, `READY`, `IN_PROGRESS`,
  `IN_REVIEW`, `IMPLEMENTED`, `DONE`, `DEFERRED`, `STOPPED`.
  `IMPLEMENTED` is code present/reviewed for a stated bounded use, not full
  DoD, earned points or gate clearance; release evidence may remain pending.
  `OWNER-ACCEPTED DEVIATION` records S015's dedicated-computer exception, not
  completion of its original local-client authentication criterion.
  The current `03-backlog.md` owns
  status and acceptance criteria. Update scope, totals, sequence and gates
  together under explicit change control.
- Planning approval, implementation evidence, and gate approval are distinct.
  Source evidence is `documented-not-tested`, `proven`, `partial`,
  `unavailable`, or `unknown`; uncertainty never grants permission.
- No credentials, personal exports, private listening data, private comments,
  real-capture screenshots, account/title identifiers, or user file paths in
  planning, commits, review attachments, or logs. Reviewers witness controls,
  not library content. Consent records, raw evidence and personal state remain
  outside the repository/cloud-sync paths in the approved encrypted boundary.
- Worf must approve the applicable G2 boundary before new real-data activity.
  Use invented fixtures and isolated disposable roots before that gate.
  ATR-S013's existing harness remains the shared runner; 0.0.2 extends it.
- Owner plus at most ten named testers is a ceiling, not permission to convey
  a copy. Named legal review, Worf and Captain clearance must precede conveyance.
  Public/cloud/multi-user/commercial shipping remains **NO-GO**.
- This transition does not operate on the running app, stop/disconnect it,
  migrate its state, or change its implementation version.

Historical Home Assistant/LCARS Dashboard branches, devices, packaging and
release procedures are not this application's backlog.
