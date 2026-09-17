# Alpha 0.0.2 — safe private feedback and usable library

**Status: full review reconciled on 2026-09-17; HOLD, A2-G0 BLOCKED.**
Captain-approved direction is unchanged. Data/Geordi/Wesley are conditional;
Worf requires changes. Mandatory corrections are incorporated, not proven.
Checkpoint concurrence, Captain decisions and execution evidence remain
pending. Implementation remains alpha 0.0.1; no runtime changes accompany this plan.

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

## What belongs beyond UI and ratings?

1. Close inherited security and data-integrity blockers **before named-tester
   clearance** and before exposing private-feedback write APIs.
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
