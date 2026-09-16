# Canonical alpha backlog index

- **Version:** 0.0.1 — locked planning baseline
- **As of:** 2026-09-16
- **Status:** G0 passed; ATR-S001 READY; remaining execution dependency-gated
- **Totals:** 3 themes / 5 epics / 13 features / 13 stories / 51 points
- **Completed implementation:** None

## Hierarchy roll-up

| Theme | Epic | Features | Stories | Points | Status |
| --- | --- | --- | --- | --- | --- |
| ATR-T01 | ATR-E01 | F01, F02, F04, F05 | S001, S002, S004, S005 | 16 | ACTIVE — F01 READY |
| ATR-T02 | ATR-E02 | F03, F06, F07 | S003, S006, S007 | 15 | BLOCKED — dependencies |
| ATR-T03 | ATR-E03 | F08, F09, F13 | S008, S009, S013 | 13 | BLOCKED — dependencies |
| ATR-T03 | ATR-E04 | F10 | S010 | 2 | BLOCKED — dependencies |
| ATR-T01 | ATR-E05 | F11, F12 | S011, S012 | 5 | BLOCKED — dependencies |

Theme roll-ups: T01=21, T02=15, T03=15 points. T01 is active through READY
story S001; all other work is blocked by named dependencies.
Feature status equals its sole story's status. Epics/themes become DONE only
when all their scoped child stories meet DoD; that still does not imply G6 approval.
All abbreviated IDs below retain the `ATR-` prefix.

## Story index (WSJF descending; dependencies govern execution)

| Story | Feature | Epic / theme | Title | Points | Priority | Direct prerequisites | Status | Detail |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ATR-S010 | F10 | E04 / T03 | Trust contract | 2 | CRITICAL | S003, S013, G1 | BLOCKED — S003, S013, G1 | [Story](03-user-stories.md#atr-s010--lock-executable-recommendation-trust-contracts) |
| ATR-S001 | F01 | E01 / T01 | Source feasibility dossier | 3 | CRITICAL | G0 | READY | [Story](03-user-stories.md#atr-s001--establish-the-source-feasibility-dossier) |
| ATR-S011 | F11 | E05 / T01 | Architecture decision | 2 | CRITICAL | G3, S010 | BLOCKED — G3, S010 | [Story](03-user-stories.md#atr-s011--decide-architecture-from-measured-access-evidence) |
| ATR-S005 | F05 | E01 / T01 | Catalog metadata proof | 3 | CRITICAL | G1, G2 | BLOCKED — G1, G2 | [Story](03-user-stories.md#atr-s005--prove-candidate-catalog-metadata-access) |
| ATR-S012 | F12 | E05 / T01 | Alpha decision pack | 3 | CRITICAL | S007, S008, S009, S010, S011, S013, G4 | BLOCKED — dependencies | [Story](03-user-stories.md#atr-s012--assemble-a-reproducible-alpha-decision-pack) |
| ATR-S008 | F08 | E03 / T03 | Accessible inspector | 3 | HIGH | S006, S009, S013 | BLOCKED — S006, S009, S013 | [Story](03-user-stories.md#atr-s008--inspect-evidence-through-an-accessible-prototype) |
| ATR-S002 | F02 | E01 / T01 | Safe experiment boundary | 5 | CRITICAL | S001 | BLOCKED — S001 | [Story](03-user-stories.md#atr-s002--define-consent-and-a-safe-experiment-boundary) |
| ATR-S004 | F04 | E01 / T01 | Approved source proof | 5 | CRITICAL | S009, G2 | BLOCKED — S009, G2 | [Story](03-user-stories.md#atr-s004--prove-one-approved-audible-captureimport-route) |
| ATR-S009 | F09 | E03 / T03 | Data lifecycle controls | 5 | CRITICAL | S002, S003, S013, G1 | BLOCKED — dependencies | [Story](03-user-stories.md#atr-s009--enforce-prototype-data-lifecycle-controls) |
| ATR-S013 | F13 | E03 / T03 | Fixture-only secure harness | 5 | CRITICAL | S002, S003, G1 | BLOCKED — S002, S003, G1 | [Story](03-user-stories.md#atr-s013--build-the-fixture-only-secure-harness) |
| ATR-S003 | F03 | E02 / T02 | Evidence schema | 5 | CRITICAL | S001 | BLOCKED — S001 | [Story](03-user-stories.md#atr-s003--define-source-evidence-and-synthetic-fixtures) |
| ATR-S006 | F06 | E02 / T02 | Normalized snapshot | 5 | CRITICAL | S003, S004, S013 | BLOCKED — S003, S004, S013 | [Story](03-user-stories.md#atr-s006--normalize-an-inspectable-source-snapshot) |
| ATR-S007 | F07 | E02 / T02 | Repeat import safety | 5 | CRITICAL | S006, S009 | BLOCKED — S006, S009 | [Story](03-user-stories.md#atr-s007--repeat-imports-without-corrupting-retained-state) |

Owners, reviewers, acceptance criteria, DoD, and product requirements are in
each linked story. The [requirements matrix](02-requirements-and-hierarchy.md)
maps product → story; the feature and roll-up tables map story → feature → epic →
theme. The [WSJF table](04-sequencing.md) is the authoritative scoring record.
No feature lacks a story or has implicit implementation work outside this index.

## Deferred product inventory (not 0.0.1 stories)

These entries preserve product requirements without promising future versions.
They require story decomposition, estimates, and WSJF scoring before entering a
delivery backlog. Their order below is dependency-oriented inventory, not a scored
ready queue. They do not count toward the 51-point alpha scope.

| Inventory | Eventual capability | Product requirement | Dependency before promotion | Status |
| --- | --- | --- | --- | --- |
| D01 | Full library/progress and persistent book ratings, private comments, tags/favorites | ATR-PR02, PR12 | Proven access + accepted architecture; Geordi-approved keyboard half-star radio-group/slider, numeric “4.5 out of 5” equivalent; explicit-vs-inferred visibly and programmatically distinct; saved/unsaved status | DEFERRED |
| D02 | Author/narrator/genre/series preference views and rich sorting/filtering | ATR-PR12, PR15 | Identity/merge policy + feedback persistence; Geordi-approved half-star controls as D01; keyboard sort/filter, result announcement/focus pattern, table/grid/list semantics, landmarks/headings decided before code | DEFERRED |
| D03 | Production full/incremental/background sync, reconnect, checkpoints and recovery | ATR-PR04, PR05 | Approved refresh + preservation tests; persistent non-modal text/icon status region (`role="status"` or equivalent), failures announced without focus move, reuse honest unknown/source-time semantics | DEFERRED |
| D04 | Deterministic candidate ranking, grounded explanations, save/dismiss/feedback | ATR-PR08, PR09, PR13, PR14 | Catalog + feedback + safe sync; trust/ranking/diversity/quality/grounding/proxy-leakage tests; reopen R08/R09; Geordi explanation disclosure real button/`aria-expanded` or equivalent, concise natural-case text and adjacent uncertainty, no icon-only caveats | DEFERRED |
| D05 | Provider-neutral optional LLM analysis and explanations | ATR-PR10, PR13 | Useful deterministic mode + noncoercive consent; Worf prompt instruction/data separation, output schema and allowed candidate/ID containment, invented metadata/history rejection, no model tool/network/credential/database authority, cross-user/embedding isolation and hosted-consent security | DEFERRED |
| D06 | Production privacy, backup/retention, migrations, recovery and release operations | ATR-PR05, PR11 | Selected production environment and end-to-end product workflows; alpha privacy is not deferred | DEFERRED |
| D07 | Native/mobile/web polish, notifications, cross-device and additional marketplaces | ATR-PR07, PR15, PR16 | Evidence-backed platform + validated single-user workflows + Geordi/Worf review; any optional audio off by default, supplemental/user-controlled, never competing with audiobook playback; future config keyboard/labeled | DEFERRED |
| D08 | Public name/branding and distribution readiness | ATR-PR16 | Naming/legal review + production release gates | DEFERRED |

Advertising, sponsored/paid placement, commercial ranking influence, password
capture, and ideological profiling are **prohibited**, not deferred.

## Status and change log

| Date | Change | Authority / evidence |
| --- | --- | --- |
| 2026-09-16 | Created initial locked 0.0.1 planning baseline; all work blocked by G0 | Captain requested initial plan; current APP_DESCRIPTION.md and repository inspection |
| 2026-09-16 | Reconciled 33 named blockers and recommendations; S002/S003/S007/S009 3→5, new F13/S013=5; 38→51 points; S005 independent of S004 but gated G2; S007 added to G3 | Captain requested bounded reconciliation; [finding dispositions](07-review-consensus.md) |
| 2026-09-16 | Data, Geordi, Worf, and Wesley approved; Riker accepted reconciliation; Captain locked baseline; G0 passed and S001 became READY | [Final consensus and sign-offs](07-review-consensus.md) |

Next action: execute ATR-S001 using public documentation research only. Original
review files are preserved beside final sign-offs. Real-data activity remains
prohibited until G2, and private release remains prohibited until G6.
