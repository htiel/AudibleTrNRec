# Alpha 0.0.2 sequencing and capacity

**Review-reconciled plan, not an implementation order issued to the running app.**
The [backlog](03-backlog.md) owns dependencies, status and WSJF;
[gates](05-risks-and-release-gates.md) own permission. All estimates are relative.

**Implementation update:** [11](11-implementation-release-verdict.md) records
22 IMPLEMENTED packages, one OWNER-ACCEPTED DEVIATION (S015), four IN_REVIEW
and three BLOCKED. The graph/waves
below remain the original required execution dependencies, not a retrospective
assertion that every checkpoint was passed. Owner-only conditional usability
does not admit W6 live source work or close W7 release clearance.
The [accumulated implementation record](12-accumulated-implementation.md) maps
later owner-use UI/feedback/Settings follow-ups without changing wave estimates.
The CP-02 unlock baseline below is historical: it was removed, not proven.
Tester expansion still requires a reviewed replacement local-client boundary.

## Final remediation integration checkpoint — 2026-09-21

The three follow-up streams are now integrated: Geordi's independent shell/
neutral-view navigation work, Data's normalization/state/bounded-paging
contracts, and Worf's consent/capture controls. The current [issue/evidence
matrix](12-accumulated-implementation.md#integrated-remediation-issues-114)
replaces the proposed remediation order as the implementation record; it does
not claim the original gate sequence was fully discharged.

Dependencies now consumed: Library/Detail use shared series/paging contracts;
Data uses evidence-derived connection presentation and neutral components;
export consent precedes API confirmation; rendered tests use production
shells/views with synthetic state. Shared-file ownership remains single-writer
for further corrections: Geordi owns shell/components/Library/Detail/Settings,
Data owns data/state/paging, Worf owns Data view/API consent/capture tooling,
Riker owns current release documentation.

The final independent-review fixes are integrated: reachable pagination and a
dirty-draft guard, stable person feedback IDs with revision-safe legacy-alias
migration, generation-guarded activation, actual scoped-stylesheet toggling and
failed-sync status refresh. Apple uses neutral tokens; LCARS-only sheets are
disabled in Apple mode. Supplied both-theme capture/purge and live private
row/Next/rapid-switch evidence resolve the former style/capture discrepancies.

Delayed Data-audit integration follows the same ownership boundaries: Data's
progress/provenance/inventory, schema-key migration and actual-sync receipt
contracts feed Geordi's presentation/navigation and Worf's non-destructive
Data surface. Actual reconciliation is recorded after durable sync and adopted
from validated account/generation-bound status on reload; snapshot parsing is
not an import. Single Status/Book-detail guidance avoids duplicate UI.
The updated suite/capture evidence is in 12; the earlier private matrix is not
silently relabeled as a post-audit rerun.

Remaining order: (1) review reproducible browser-tool provenance,
(2) complete physical-device/VoiceOver and current provider-revocation/recovery
evidence under approved boundaries, (3) officer evidence review and issue-specific decisions,
(4) unchanged source/architecture/legal gates, then Captain audience decision.
Green stream reports do not close issues, admit W6 activity or clear W7.
No real-data capture, phone-to-loopback route or native build follows from this
checkpoint. Preserve the existing 20% reserve; no measured velocity is claimed.

## Critical path and readiness

```text
Captain scope direction (received)
  -> S014: designs / authority / recovery decisions -> A2-G0
  -> boundary wave: S019, S018, S015, S016, S017, S020, S036
  -> synthetic integrity: S021, S023 -> S022
                         S026 ---------> S024 -> S027
                         S015/S016 -> S025 ----^
  -> S031 feedback contract -> S028 export + S029 deletion
  -> S030 migration -> S032 encrypted feedback persistence
  -> S034 LCARS + S035 honest states -> S033 feedback editor
       S026/S032/S034 -> S037 facets -> S038 filter/feedback views
  -> S039 integrated synthetic evidence
  -> A2-G2 safety authorization
  -> route-specific authorization + S040/S041 live proof, if permitted
  -> A2-G3 source evidence -> A2-G4 architecture evidence
  -> S042 final officer evidence -> A2-G5
  -> S043 decision packet -> Captain A2-G6
```

This is a gate-expanded dependency sketch; the canonical table also names
cross-links such as S024/S025 → S028. The critical constraint is **permission
and trustworthy source evidence**, not the longest UI implementation.
If history/catalog cannot be authorized/proven, source gates remain blocked
even after all synthetic UI/feedback tests pass. Do not claim four-domain
success or approve a native architecture from an attractive prototype.

OF-007's [native iPhone direction](07-native-iphone-direction.md) is recorded
in W0/S014 and considered by the existing W7/S042/A2-G4 decision, after G3
source evidence. This is a clarification of existing decision work, not a new
spike or execution wave: the 30-node graph, wave totals and 112 points remain
unchanged. No native build, phone connection, camera or handoff work enters W4.
Future native work requires a separately reviewed plan; camera ingestion follows
approved native identity/lifecycle and metadata rights, while handoff also waits
for an approved recommendation/catalog phase. Future WSJF cannot bypass these
dependencies or displace current blockers.

S014 is the initial design enabler; its acceptance establishes A2-G0.
Before any implementation story moves READY:

1. Direct and transitive dependencies pass their DoD.
2. Wesley/Geordi design and Worf/Data review concerns are reconciled.
3. A2-G0 approves the story's design; Captain approves new UX surfaces.
4. The work uses invented fixtures and isolated test roots only. Any real
   authorization, personal export, source/catalog call or real-data operation
   separately requires Worf A2-G2 and bounded Captain route authorization.

A downstream design may use a published proposed contract to prepare questions;
it cannot introduce a write API or claim an upstream story DONE.

Review corrections in [09](09-review-consensus.md) are prerequisite acceptance
work, not extra waves. CP-06 records existing-surface/headless synthetic
baselines and budgets under S014 design work before optimization; W4 verifies
the changed layout in a separate cohort, never sets a passing budget afterward.
CP-03 fixes seed/root/version/crypto invariants; S031 freezes persisted schema
revision before S028/S029/S030 consume it. S032 implements that schema last.
CP-05 must approve an isolated device/equivalent evidence route; if unavailable,
OF-006 and A2-G5/G6 remain HOLD/BLOCKED, not a desktop-only release.

At CP-02 and IC-1, an unproven usable secure bootstrap stops S015 for redesign;
do not absorb a new pairing architecture as polish. At CP-03/IC-3, a proposed
container-key replacement or cross-envelope re-seal that exceeds S030/S032
requires explicit split/re-estimation **before** implementation. The present
direct-DPAPI design baseline avoids silently commissioning that redesign.
The 20% reserve is not spare scope to spend on unresolved architectural work.

## Execution waves

Hard safety dependencies govern wave readiness; within a ready wave use the
descending WSJF table, CoD tie-break, then ID. No P2 refinement displaces a
mandatory blocker. The wave inventory counts every story exactly once.

| Wave | Stories | Points | Exit / dependency |
| --- | --- | --- | --- |
| W0 — Design and policy | S014 | 3 | A2-G0; specific decisions/CTQs approved, not merely this plan |
| W1 — Shared security and runtime | S015–S020, S036 | 23 | Reviewed synthetic auth/custody/provenance/diagnostic controls before adding private mutations |
| W2 — Source/identity correctness | S021–S027 | 26 | Deterministic complete-or-stop sync, canonical IDs, isolated durable state |
| W3 — Lifecycle then feedback store | S028–S032 | 23 | Contract first (S031), export/delete, migration, then S032; no feedback writes before lifecycle |
| W4 — Accessible private experience | S033–S035, S037–S038 | 19 | S034 first; then eligible S035/S037; S033 then S038; full synthetic user journey |
| W5 — Integrated evidence | S039 | 5 | Synthetic tests and control receipts ready for A2-G2 |
| W6 — Bounded source feasibility | S040–S041 | 6 | Public documentation research may occur after W0; live proof waits for W5, A2-G2 and route-specific approval |
| W7 — Review and decision | S042–S043 | 7 | A2-G3/G4/G5 evidence, all officers, Captain A2-G6; no automatic distribution |
| **Total** | **30 stories** | **112** | **Not a PI commitment** |

W4's **mandatory** accessibility/label/error fixes may run alongside W2/W3
after their named dependencies and design reviews; elective facet/feedback
polish remains subordinate. No extra story points are counted for this
parallelism. Each story's tests ship with that story, not postponed to W5.

## Shared foundations and safe parallelism

- Reuse S013's harness, canonical validation/digest logic, safe rendering and
  account-key boundary. No second test runner, new framework or generalized
  platform rewrite.
- Data can prepare synthetic unit/page fixtures while Worf closes boundary
  controls; these fixtures cannot access provider/runtime state.
- Geordi/Wesley can review new feedback/facet wireframes while Data establishes
  canonical identity. Reviewed static mockups contain invented data only.
- S028 and S029 can proceed in parallel after S031 and their dependencies;
  they must agree on the same inventory before S030/S032.
- Official public-document feasibility research is useful early. New API
  calls, account captures and catalog endpoints are not parallelizable around
  the security gate.
- Assign one owner to shared files and serialize conflicting changes.

## Capacity and PI policy

Velocity is **unknown**. Do not promise the whole 112-point inventory in one
PI, or convert points into hours/days. At PI planning, measure completed
accepted points, reserve **20% capacity** for unplanned work, then select only
dependency-ready stories up to 80% of that measured capacity.

Proposed objectives, not date commitments:

1. Secure synthetic runtime and complete-or-stop library behavior.
2. Lossless lifecycle/migration and durable private feedback.
3. Accessible user-controlled library plus verified evidence and authorized
   feasibility decision.

Limit WIP to one implementation story per component owner plus one bounded
review; finish blockers rather than opening more work. Re-score at each PI,
new finding, unblocked dependency and Captain direction change. If a slice is
too large, split it under new permanent IDs before implementation and reconcile
all counts. Never silently remove a gate to fit capacity.

## Stop and change-control rules

- Failed security/privacy control: stop the affected experiment, preserve
  sanitized diagnostics, follow incident runbook, obtain Worf reapproval.
  This is a future execution rule, **not an instruction to stop today's app**.
- Unsupported route, ambiguous rights or unavailable history/catalog: document
  STOPPED/no-go. Continue safe synthetic work only; escalate a reduced-scope
  proposal to Captain with renewed officer/legal review rather than silently
  granting tester clearance.
- Export/deletion/migration failure: preserve last valid state, block feedback
  writes/promotion and repair with disposable fixtures.
- New credential route, storage/crypto change, runtime/dependency change,
  retention extension or egress/cap increase: re-review **before use**.
- Release request: full team review and Captain gate, not a legacy version/
  HACS/patch auto-approval workflow. This task performs no commit or release.
