# Release planning

## Current baseline

**[Alpha 0.0.1](0.0.1/01-release-charter.md)** — **locked and unanimously
approved planning baseline**. G0 passed on 2026-09-16 through Data, Geordi,
Worf, Wesley, Riker, and Captain acceptance. This authorizes planning execution
beginning with ATR-S001; it does not authorize real-data activity or declare an
alpha release.
The revised inventory is **3 themes / 5 epics / 13 features / 13 stories /
51 points**. The prior 38-point baseline remains historical, not current.

| Document | Purpose |
| --- | --- |
| [Release charter](0.0.1/01-release-charter.md) | Objective, scope lock, non-scope, measurable outcomes |
| [Requirements and hierarchy](0.0.1/02-requirements-and-hierarchy.md) | Product traceability, themes, epics, feature coverage |
| [Detailed stories](0.0.1/03-user-stories.md) | Acceptance criteria, dependencies, ownership, definition of done |
| [Sequence and critical path](0.0.1/04-sequencing.md) | WSJF, dependency graph, conditional execution, capacity |
| [Risks and gates](0.0.1/05-risks-and-release-gates.md) | FMEA, evidence gates, open decisions, officer review |
| [Backlog index](0.0.1/06-backlog-index.md) | Canonical hierarchy, release membership, current status |
| [Review consensus](0.0.1/07-review-consensus.md) | Finding-by-finding reconciliation, decisions, validation, and unanimous sign-off |
| [Data review](0.0.1/reviews/data-review.md) | Original architecture findings; preserved unchanged |
| [Geordi review](0.0.1/reviews/geordi-review.md) | Original accessibility findings; preserved unchanged |
| [Worf review](0.0.1/reviews/worf-review.md) | Original security findings; preserved unchanged |
| [Wesley review](0.0.1/reviews/wesley-review.md) | Original innovation findings; preserved unchanged |
| [Data sign-off](0.0.1/reviews/data-signoff.md) | Final architecture and data approval |
| [Geordi sign-off](0.0.1/reviews/geordi-signoff.md) | Final LCARS UX and accessibility approval |
| [Worf sign-off](0.0.1/reviews/worf-signoff.md) | Final security and privacy approval |
| [Wesley sign-off](0.0.1/reviews/wesley-signoff.md) | Final innovation and product-learning approval |

## Conventions

- `ATR-Txx`: theme; `ATR-Exx`: epic; `ATR-Fxx`: feature; `ATR-Sxxx`: story.
  IDs are permanent, never reused or renumbered when scope changes.
- `ATR-PRxx`: planning traceability reference to
  [APP_DESCRIPTION.md](../APP_DESCRIPTION.md), not an ID already present in it.
- Story points use XS=1, S=2, M=3, L=5, XL=8. They are relative scope estimates,
  not elapsed-time promises.
- The backlog index is authoritative for status; story documents are authoritative
  for acceptance criteria. Change both together when a reviewed scope change is approved.
- Status vocabulary: `PLANNED` (defined, not started), `BLOCKED` (named prerequisite
  unmet), `READY` (all prerequisites and review gates passed), `IN_PROGRESS`,
  `IN_REVIEW`, `DONE`, `DEFERRED`, `STOPPED`.
- G0 is passed. ATR-S001 is `READY`; all other stories remain `BLOCKED` by
  their named dependencies and later gates.
- S013 is the sole harness/test-runner and shared security-preflight owner.
  S009 must demonstrate lifecycle controls before Worf can approve G2.
  S004/S005 and every real-account, authorization, personal-export, source/catalog
  request or real-data activity remain prohibited before G2. Only public
  documentation research and controlled synthetic tests may precede it.
- No credentials, personal exports, private listening data, or private comments
  belong in planning artifacts, source control, or review attachments.
- No screenshots of real captures. Reviewers witness controls, not library content.
  Signed consent, personal evidence, keys, exports, and stores stay outside the
  repository in the approved encrypted boundary. Sanitized reports exclude
  personal fields by construction, including identifiers and user file paths.
- Locked means the planning baseline is approved. It does not mean requirements
  are implemented, tests have passed, or later evidence gates are approved.

Only `0.0.1` is scoped here. Deferred items are inventory, not future release
commitments. This plan does not change the eventual MVP definition in the product
brief. Historical Home Assistant/LCARS Dashboard branches, components, and release
procedures are not this application's backlog.
