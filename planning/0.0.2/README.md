# Alpha 0.0.2 — safe private feedback and usable library

**Status: implementation verdict issued 2026-09-17 — owner-only APPROVE WITH
CONDITIONS. Named testers NO-GO; public/commercial HARD NO-GO.**
Data APPROVE, Geordi FULL APPROVE (UI scope), Wesley PASS (private evaluation)
and Worf APPROVE WITH CONDITIONS support the existing owner's usable build.
This is not a passed full release-gate packet. See
[11 — final verdict](11-implementation-release-verdict.md) for exact limits.

Definitive post-delayed-audit evidence supplied by the Captain on 2026-09-21:
Node **685 total / 684 pass / 0 fail / 1 environment symlink skip**, **87.7 seconds**;
connector **128 total / 126 pass / 0 fail / 2 skips**; policy PASS.
Actual synthetic `--theme all` capture verified both themes in the live DOM,
wrote **12 neutral PNGs plus manifest**, and purge verified. Earlier live private
evidence confirms Apple starts with zero LCARS classes/50 rows, Next reaches
51–100 of 180, and rapid Apple→LCARS ends with matching stylesheet states
without errors. This final documentation task reconciles, rather than reruns,
those results; no physical-device/VoiceOver or current provider-revocation
validation is claimed.
Packaging BLOCKED and earlier secret-scan results are historical, not rerun.
Reported authenticated server and process-only real-store migration evidence
show revision 3, exact five-table schema, two receipts, opaque anchor and
rollback discharge. No personal content was queried for this verdict.
The migration/runtime results are supplied historical evidence, not rerun by
this documentation audit. The tests above used synthetic/disposable state.

The [accumulated implementation record](12-accumulated-implementation.md)
covers retained external-browser registration/real data, removed local unlock,
blank-page/bulk-feedback fixes, Author/Narrator/Series feedback, narrator display
grouping, session filter/page state, whole-star controls, integrated issue
#1–#14 remediation and independently constructed Apple/LCARS shells.
It records synopsis/series/connection/pagination contracts, informed export
consent, synthetic capture policy, normative Apple references and the
non-normative Google-image inspiration/no-copied-assets boundary.
Apple markup and tokens are independent of LCARS and LCARS-only sheets are
disabled in Apple mode. Independent-review fixes cover reachable pagination,
stable person feedback IDs/legacy migration, race-free activation and
failed-sync status refresh. Browser-tool provenance and remaining device/
provider evidence limits are explicitly recorded.

The delayed Data audit additionally delivered differentiated completion/partial
progress, closed provenance labels, private Feasibility navigation demotion,
non-destructive inventory, schema-only filter persistence with legacy migration,
single Status/feedback guidance, and persisted actual-sync reconciliation
counts. The account-bound non-sensitive sidecar survives reload; parsing a
snapshot alone stays Unknown / not an import. See 12 for contracts and lifecycle.

**Inventory: 4 themes / 8 epics / 30 features / 30 stories / 112 estimated
points.** This is release-scope inventory, not a single-PI commitment.
OF-007 changes product direction, not this inventory: native implementation,
camera ingestion and Audible handoff are outside the 112 points.

| Document | Purpose |
| --- | --- |
| [01 — Release charter](01-release-charter.md) | Objective, CTQs, authority and privacy |
| [02 — Scope](02-scope.md) | Hierarchy, architecture constraints and exclusions |
| [03 — Backlog](03-backlog.md) | Canonical status, WSJF, stories and acceptance criteria |
| [04 — Sequencing](04-sequencing.md) | Dependencies, capacity and execution order |
| [05 — Risks and release gates](05-risks-and-release-gates.md) | FMEA, evidence and release clearance |
| [06 — Owner feedback](06-owner-feedback.md) | Captain observations and their backlog disposition |
| [07 — Native iPhone direction](07-native-iphone-direction.md) | Intended destination, existing architecture-gate mapping and two uncommitted future capabilities |
| [08 — Implementation plan](08-implementation-plan.md) | Gated work packages, current-code change map, schema/API/lifecycle design targets, owner-feedback implementation, tests and release evidence; no code or gate approval |
| [09 — Review consensus](09-review-consensus.md) | Full finding reconciliation, accepted/rejected/deferred proposals, mandatory work/test mappings, open decisions, gates and Riker HOLD recommendation |
| [Reviews — index](reviews/README.md) | All four preserved staged officer reports and their submitted verdicts |
| [10 — Runtime data requirement](10-runtime-data-requirement.md) | Binding real-encrypted-data-only private runtime, fail-closed bootstrap and custody-bounded migration; landed wiring update |
| [11 — Implementation/release verdict](11-implementation-release-verdict.md) | Owner-only conditional GO versus named/public NO-GO; implemented package matrix, evidence, residuals and formal gates |
| [Implementation reviews — index](implementation-reviews/README.md) | Current amended Data, Geordi, Wesley and Worf verdicts; distinct from earlier planning reviews |
| [12 — Accumulated implementation](12-accumulated-implementation.md) | Final #1–#14 disposition, definitive supplied tests/capture/live matrix, independent-review fixes, contracts and remaining restrictions |
| [13 — Independent theme UI specification](13-independent-theme-ui-spec.md) | Geordi's implementation/follow-up record; historical claims read with 12's current evidence limits |

**Remaining release blockers:** unapproved source-only pbkdf2/pyaes artifacts,
downloaded-byte hash verification and pip-audit/SBOM, a reviewed replacement for
the owner-accepted same-user-process trust boundary before expansion,
durable/startup security-event evidence, reproducible browser-tool provenance,
complete rendered/AT acceptance and physical iPhone/equivalent evidence.
History/non-owned catalog, source-led architecture, legal and final
audience gates also remain open. The backlog records 22 IMPLEMENTED,
1 OWNER-ACCEPTED DEVIATION, 4 IN_REVIEW, 3 BLOCKED and no full-DoD DONE; no unavailable feasibility is
marked successful.

Issue remediation is integrated, not declared fully accepted or closed.
No GitHub issue state, full-DoD story status or A2 gate is changed by this
documentation verification. The 112-point hierarchy is the original baseline,
not a retroactive estimate of the remediation streams.

## What belongs beyond UI and ratings?

1. Close inherited security and data-integrity blockers **before named-tester
   clearance**. Owner-only feedback writes exist under the recorded S015
   exception; that does not satisfy the original release authentication gate.
2. Make synchronization complete, recoverable, account-safe and durable;
   preserve removed books and their local data without pretending they are
   still in the current source.
3. Establish stable contributor/book identity, explicit migrations, encrypted
   storage, safe export and genuine deletion before collecting private notes.
4. Preserve user-controlled facets, filters, sort/group choices and focus;
   add feedback-aware views without inferring preferences or recommending.
5. Prove failure/recovery paths, accessibility and migration behavior with
   automated tests and witnessed synthetic evidence.
6. Investigate listening history and non-owned catalog access only through
   separately approved feasibility gates. Owned metadata is not catalog proof;
   current progress is not history. No supported route is assumed.

The [archived 0.0.1 verdict](../archive/0.0.1/feedback-and-bugs/alpha-0.0.1-release-verdict.md)
remains **HOLD/FAIL**. Its
[finding register](../archive/0.0.1/feedback-and-bugs/bug-register.md) is the
unchanged evidence baseline. No inherited finding closes merely because it is
assigned a story here. Recommendations, LLMs, Audible mutation, public reviews
and public/cloud/multi-user/commercial distribution are excluded.

## Transition record

| Date | Change | Authority / status |
| --- | --- | --- |
| 2026-09-17 | Archive 0.0.1 including uncommitted feedback reports; open 0.0.2 for remediation, UI and private feedback | Captain request; executed as documentation only |
| 2026-09-17 | Propose detailed 112-point hierarchy and gates | Riker synthesis of archived Data/Geordi/Worf/Wesley evidence; new design concurrence pending |
| 2026-09-17 | Record owner request to scrub obsolete synthetic-data wording now that the private mode uses live data | Captured as OF-001; mapped to S035 |
| 2026-09-17 | Require Genre to be populated automatically from approved source metadata or removed from the visible UI | Captured as OF-002; mapped to S037 |
| 2026-09-17 | Optimize library columns around listener value and remove repeated system metadata such as Source | Captured as OF-003; mapped to S034 and S038 |
| 2026-09-17 | Add collapsible grouped results with book-level inline rating and comment entry | Captured as OF-004; mapped to S033, S037 and S038 |
| 2026-09-17 | Move primary user navigation to the top and diagnostics to the bottom with a gray LCARS filler between | Captured as OF-005; mapped to S034 and S035 |
| 2026-09-17 | Make iPhone Air Safari the primary mobile design target while retaining smaller-screen accessibility coverage | Captured as OF-006; mapped to S033, S034 and S038 |
| 2026-09-17 | Set native iPhone as the intended product destination; defer camera/barcode ingestion and Audible title handoff | OF-007; direction mapped to existing S014 and S042/A2-G4; no inventory increase |
| 2026-09-17 | Reconcile full four-officer planning review; preserve inventory and add mandatory correction/test traceability | Riker consensus; A2-G0 BLOCKED pending CP/Captain concurrence; no runtime or release authorization |
| 2026-09-17 | Issue final owner-only implementation verdict after amended reports/current diff; acknowledge real-data runtime and revision-3 migration evidence | 11; owner evaluation conditional GO only, named/public NO-GO, no full release-gate pass |
| 2026-09-19 | Reconcile complete accumulated working tree, current tests, browser preferences and Apple theme references | 12; documentation audit, not renewed officer approval or release clearance |
| 2026-09-19 | Verify integrated #1–#14 remediation and independent shell markup; reconcile exact tests, data/privacy contracts and plan gaps | Captain reports three streams green; Riker reruns suites; no issue closure, native equivalence, physical-device validation or release approval |
| 2026-09-21 | Reconcile post-delayed-audit 685/684 Node (87.7s) and 128/126 connector results, both-theme capture/purge, delayed Data fixes and persisted last-import evidence; retain earlier private matrix with its scope | Captain-supplied evidence checked against implementation; docs-only, no release or issue decision |

See [planning conventions](../README.md) and
[product authority](../../APP_DESCRIPTION.md). Native iPhone is the intended
client destination, not an approved architecture. This plan grants no new
endpoint and selects no backend or LLM provider. OF-006 remains a web-alpha
design target, not a native migration or phone-to-loopback connection grant.

## Initial transition validation — 2026-09-17 (before OF-007)

- Documentation-only checks covered 37 Markdown files under planning:
  198 local link targets passed, including 18 Markdown anchor checks.
  Sixteen external URL destinations passed syntax checks only; remote sites
  were not contacted.
- All 30 feature/story mappings, 112-point sum, WSJF arithmetic/order,
  30-node acyclic dependency graph and all 51 inherited finding dispositions
  passed structural checks.
- All 22 tracked historical files were preserved: 17 unchanged in content,
  five with relocation-only link repairs. All seven formerly uncommitted
  feedback reports are present; only their index's product link was repaired.
- At that initial transition, product authority outside “Current Planned
  Release” was unchanged; OF-007 subsequently updates platform-direction wording.
  Staged and unstaged `git diff --check` passed; the seven newly authored
  planning files also passed no-index whitespace checks.
- These are planning-integrity checks, not application tests or gate approval.
  No commit, implementation change, personal-state access, app stop,
  disconnect, migration, packaging or distribution was performed.

## OF-007 documentation validation — 2026-09-17

- Checked 40 Markdown files in total (39 under planning plus the product
  description): 231 local targets and 38 Markdown anchors resolved.
  No remote sites were contacted.
- The 30-story/112-point inventory, WSJF arithmetic/order, acyclic dependency
  graph and execution-wave totals remain unchanged. Native capability estimates
  are future-only, not a release rebaseline.
- Staged and working-tree whitespace checks passed. Existing staged work was
  preserved; only documentation was added/updated and staged, without a commit.
- No application tests, implementation edits, runtime/state access, connection
  changes or gate approvals accompany this update.
