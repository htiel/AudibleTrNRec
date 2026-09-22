# Alpha 0.0.2 implementation plan

**Date:** 2026-09-17

**Execution lead:** Commander William Riker

**Status:** Implementation reviewed; **owner-only APPROVE WITH CONDITIONS**.
Named testers/public/commercial remain NO-GO. Current package status and
evidence limits are in [11 — implementation verdict](11-implementation-release-verdict.md)
and [03](03-backlog.md); 22 packages are IMPLEMENTED, S015 is an
OWNER-ACCEPTED DEVIATION, four are IN_REVIEW and three BLOCKED.
No full-DoD DONE or blanket A2-G0–G6 pass is claimed.

Sections below preserve the reviewed **design/execution baseline**, not an
assertion that all proposed physical schemas, APIs or evidence artifacts
shipped unchanged. “Current/existing” code descriptions in that baseline refer
to its planning inspection. The later [runtime requirement](10-runtime-data-requirement.md)
and 11 control current state: real-data-only private startup, storage revision
3 with account anchor, two migration receipts and reviewed lifecycle wiring.
Differences/unfinished evidence (notably RC-08 events and purpose-header limits)
are explicit in 11; proposed requirements are not silently marked satisfied.

**2026-09-18 change control:** the owner removed the proposed per-start local
capability from this dedicated, non-distributed prototype. The CP-02 text below
is retained as the historical reviewed design baseline, not current behavior.
[11](11-implementation-release-verdict.md) records the accepted owner-only
same-user-process exposure and the controls that remain.

**2026-09-19 implementation addendum:** [12](12-accumulated-implementation.md)
is the current-code companion to this historical design baseline. It covers
browser-safe feedback imports/one-request hydration, collapsed-group author/
narrator/series feedback, normalized-name display grouping, sidebar/fixed-rail
layout, tab-scoped filters, progressive whole-star radios, focus/reflow fixes,
and Settings with durable LCARS/Liquid Glass selection. Half-star references
below describe the retained domain contract or superseded control design, not
new UI choices. Session filter storage and theme-only local storage supersede
blanket no-browser-storage design wording; drafts remain unpersisted there.
API capability/re-entry requirements and full-entropy unlock tests below are
historical obligations, not implemented controls after owner change control.
No new design sign-off, package/point estimate or source/native approval is
inferred from this documentation reconciliation.

**Final remediation checkpoint — 2026-09-21:** implementation streams for
GitHub #1–#14 and separate Apple/LCARS shell markup are integrated and reported
green. [12's issue matrix](12-accumulated-implementation.md#integrated-remediation-issues-114)
is the current completion/evidence record, alongside
[13's shell specification](13-independent-theme-ui-spec.md). This checkpoint
does not retroactively approve CP records or close GitHub issues/A2 gates.

Delivered: neutral shared views with independent shell constructors,
search-first mobile controls, stable text filtering, bounded synopsis text,
explicit series evidence, evidence-derived connection states, hard 50-row
paging, pre-request export consent and actual both-theme synthetic capture/purge.
Independent-review fixes wire reachable pagination with a dirty-draft guard,
stable person feedback IDs and revision-safe legacy migration, race-free
theme activation and failed-sync status refresh. Neutral shared tokens and
exclusive stylesheet activation complete the former shell-independence gap.
Apple HIG/API/design resources remain normative; Google image search is
inspiration only, with third-party imagery/UI asset copying and private-data
uploads prohibited.

Reconciled deviations from the remediation proposal: filter/page state is
persisted as version 2; series evidence adds a reserved standalone enum without
a source/storage revision change; no new reauthorization flow was added.
Playwright remains optional/undeclared/unpinned, with no new npm test/capture
aliases. The capture runner now selects and verifies both themes in the live
DOM rather than just labeling the manifest.

Definitive supplied results for `npm test`, `npm run connector:test`,
`npm run policy:check`, actual `--theme all` capture/purge and the live private
matrix are centralized in 12. They are reconciled, not rerun by this final
documentation task. Physical-device/VoiceOver and current provider revocation
remain evidence limits; no blanket visual/AT certification follows.
Original stop rules below describe their dated planning task.

**Delayed Data-audit reconciliation:** completion and partial position are no
longer presented as an undifferentiated fact; provenance labels are closed.
Private Feasibility is context-linked from Data, not primary navigation.
Data inventory is non-destructive; Status and actionable Book-detail feedback
guidance appear once. Filter persistence now uses a schema-only key with
validated, copy-only legacy migration.

Actual sync reconciliation persists as an account/snapshot-bound, non-sensitive
`last-import-counts.json` sidecar and restores through status after reload.
Snapshot parsing alone remains Unknown / not an import; unmeasured counts
remain null. No database/source revision changes or new provider probes follow.
The post-audit definitive suite/capture totals in 12 supersede earlier counts,
not historical release gates or platform limitations.

**Inventory unchanged: 4 themes / 8 epics / 30 features / 30 stories /
112 relative points.** Packages are execution aliases, not additional stories or
estimates. No calendar estimates, velocity assumption, native build commitment,
or reduced-domain release is introduced. Commercial/public shipping remains
**HARD NO-GO**; named-tester conveyance is not cleared.

## 1. Authority, evidence and implementation principles

Read this plan with the following controlling documents:

- [Product authority](../../APP_DESCRIPTION.md).
- [Release charter](01-release-charter.md), [scope](02-scope.md),
  [canonical backlog](03-backlog.md), [waves](04-sequencing.md) and
  [risk/gate definitions](05-risks-and-release-gates.md).
- [All owner feedback OF-001–OF-007](06-owner-feedback.md) and
  [native direction and future capabilities](07-native-iphone-direction.md).
- Archived [51-finding register](../archive/0.0.1/feedback-and-bugs/bug-register.md)
  and [HOLD/FAIL verdict](../archive/0.0.1/feedback-and-bugs/alpha-0.0.1-release-verdict.md).
- Archived [security tests 1–15](../archive/0.0.1/05-risks-and-release-gates.md#required-security-evidence--stable-test-numbers-from-worf-review)
  and [narrow connector change control](../archive/0.0.1/10-private-alpha-connector-change-control.md).

The architecture map below is based on read-only inspection of tracked
`code/Alpha0.x` source, not observation of the owner's database or running app.
The archived runtime baseline is 156 Node tests: 155 pass, one Windows symlink
skip; nine Python tests pass. These are historical results, not tests executed
for this plan. Incorrect progress expectations and missing rendered/lifecycle
evidence prevent those totals from being release proof.

### Principles

1. **Evidence before permission before implementation.** The approved direction
   is not an approved detailed design. Resolve the checkpoints in section 2,
   reconcile their decisions into versioned specifications, then admit only
   dependency-ready stories. All four officers review relevant designs;
   Captain approval precedes implementation of new UX surfaces.
2. **Repair the actual persisted path.** Reuse core invariants, not an assumption
   that the fixture path proves the Python → Node → SQLite → UI path correct.
   Keep source fields and local feedback under separate write authority.
3. **Small reviewed increments.** Extend the Node/Python S013 harness; no new
   application framework, parallel test runner, generalized backend rewrite or
   dependency added for convenience. Every package includes its negative tests.
4. **Single account, no identity guessing.** Bind every read, write, export,
   migration and confirmation to the verified local account/marketplace and
   canonical book. Equal names, aliases or a successful browser login are not
   account/person/book equivalence.
5. **Complete or stop; saved means durable.** Stage, validate, reconcile, seal
   and transactionally promote. Failures retain the last complete durable state;
   no partial import, failed seal or failed commit advances success.
6. **Private feedback is inert.** It never becomes a source request, instruction,
   model prompt, inferred affinity or public review. No analytics, remote covers,
   fonts, LLMs, advertising, paid placement or ideological profiling.
7. **Disposable prototype, durable user ownership.** Native Swift/iPhone is the
   intended destination, not a selected architecture. Specify portable semantic
   contracts and golden fixtures; do not promise reuse of Python, Node, DPAPI
   ciphertext or SQLite files on iOS.
8. **Honest measurement.** Baseline repeatability before optimization; approve
   p95 budgets before code. Report sample count, environment, paired effect and
   uncertainty for performance claims, never an invented sigma level.

### Stop rules

- This task changes documentation only. No app/test server, package install,
  connector invocation, credential read, database open, migration, refresh,
  disconnect, process termination or real-data test is part of it.
- Future implementation uses invented fixtures and explicitly supplied
  disposable roots. Tests must fail closed if a test root is absent or resolves
  to personal state. No real action before A2-G2 plus the exact Captain-approved
  route/action and consent; the existing connection is not fresh authorization.
- Unknown source units, duplicate/completeness policy, identity ambiguity or
  malformed required data blocks promotion. Do not add arbitrary quarantine
  percentages, a page-21 probe, higher caps or automatic/auth retries.
- Unauthenticated access, unsafe executable/custody, disclosure, incomplete
  lifecycle or crypto failure blocks the affected package and feedback writes.
  Preserve safe failure categories and follow the approved incident runbook.
  This is not an order to stop today's app.
- Unconfirmed deregistration retains encrypted credentials and a recoverable
  warning; do not silently strand a registered device. Normal shutdown/sync
  never deregisters.
- Failed migration/export/restore/delete blocks write enablement and release;
  preserve the last valid state and do not “repair” it by deleting or reseeding.
- Unsupported history/catalog or ambiguous rights yields STOPPED/no-go evidence.
  A2-G3/G4 stay blocked and release stays HOLD unless the Captain explicitly
  rebaselines all affected scope/gates with renewed officer/legal review.
- Any new provider route, cap/retry change, crypto/custody/retention change,
  runtime/dependency replacement or native experiment needs prior review.
  No phone-to-loopback/LAN/tunnel workaround for mobile evidence.
- Do not weaken `private: true`, `prepack`, source/diagnostic allowlists or
  packaging policy. No commit/push/tag/package/conveyance follows from this plan.

## 2. Assumptions, decisions and approval checkpoints

These are **proposed implementation decisions**, not officer sign-offs. A
checkpoint is complete only with a dated decision, exact contract revision,
testable criteria, officer dispositions and Captain decision where applicable.
An unresolved choice blocks only work relying on it; it cannot be bypassed by a
downstream mock or a point estimate.

| Checkpoint | Proposed decision / open question | Owner and approval | Blocks |
| --- | --- | --- | --- |
| CP-01 Source contract | Percentage-valued source fields use explicit 0–100 conversion; fractional adapters declare their scale. Select complete-or-stop handling, duplicate/conflict rules, shared contributor limit and exact-cap completeness evidence. Record dated unit authority, not a magnitude heuristic. Keep existing request/page/byte/time limits and no-retry policy. | Data + Worf; Wesley semantics | S021–S024; A2-G0 |
| CP-02 Local boundary | Approve per-start capability bootstrap and exact HTTP/stdio contract, trusted executable roots, supported Node/SQLite flags, owned-browser cleanup and amended provider-browser boundary. Proposed bootstrap is described in section 5; its trusted delivery mechanism must be proven before S015. | Worf + Data; Geordi unlock/cancel UX | S015–S020; A2-G0/G2 |
| CP-03 Identity and storage | Ratify RC seed/root/version/edition/fallback invariants and direct-DPAPI/Python crypto baseline with A045 limits; legacy unseal binding and recoverable re-seal; explicit durability/cache bounds. S031 owns frozen persisted schema before consumers. | Data + Worf; Captain retention/residual decisions | S026, S028–S032 |
| CP-04 Feedback and lifecycle | Ratify 4,000-code-point comment, 20 tags of 40 code points, 64 KiB request; explicit Save; export schema, backup retention duration, cleanup inventory and key-destruction claims. No invented retention period. | Data + Worf + Geordi + Wesley; Captain changed retention/new surfaces | S028–S033; A2-G0/G2 |
| CP-05 LCARS interaction | Approve mode-copy inventory, column/navigation matrix, grouping rules, inline editing/draft conflict flow and iPhone Air viewport evidence. Approve a synthetic-only mobile evidence environment without exposing the private service. Genre defaults hidden until its retain gate is met. | Geordi + Wesley; Data/Worf review; Captain new surfaces and column audit | S033–S038 |
| CP-06 Performance and test environment | Freeze invented size tiers, supported runtime matrix, fault harness, p95/peak-memory/response budgets and repeat protocol before optimization. Preserve security ceilings if a budget fails. | Data + Worf; Geordi interaction budgets | S034/S039 and performance claims |
| CP-07 Source rights and live permission | Research official supported routes first. Record genuine history/non-owned catalog rights and bounded experiment or STOPPED. Worf explicitly disposes original test 3 versus amended headed Edge behavior; no silent waiver of credential prohibitions. | Named legal authority, Captain, Worf; Data/Wesley | S040/S041 live evidence; A2-G1/G2/G3 |
| CP-08 Architecture and release | Compare native on-device versus separately approved adapter/service options using G3 evidence; record unknowns, measurements and reversal triggers. No native port/spike. Full team then Captain decide exact audience/build under A2-G5/G6. | Data architecture; Worf threat model; all officers; Captain final | S042/S043; future native plan |

**Assumptions to verify:** Windows-local private alpha, US marketplace, one
active account/container and one persistent registered device; credentials
remain Python-only; library-only `GET /1.0/library`; startup/manual/15-minute
scheduled refresh under the existing grant. Do not reinterpret scheduling as
retry/backoff. `node:sqlite` support must be demonstrated, not inferred from the
currently inaccurate Node engine floor.

Proposed specification artifacts, authored under S014 and refined by the owning
story before code, are `specs/alpha-0.0.2-boundaries.md`,
`specs/alpha-0.0.2-data-lifecycle.md` and
`specs/alpha-0.0.2-library-feedback-ux.md` (repository-relative, **not created
by this task**). Keep their decision IDs and contract revisions in the evidence
manifest; this plan does not substitute for CP approval.

## 3. Stable work packages and traceability

`A2-WP014`–`A2-WP043` map one-to-one to S014–S043/F14–F43. Never renumber a
package when its schedule changes. Internal tasks/tests below have no added
points. Canonical story acceptance criteria, status, owners and dependencies
remain in [03](03-backlog.md); this plan adds implementation detail without
weakening them. `D/W/G/Y/R` below mean Data/Worf/Geordi/Wesley/Riker.
“—” in owner feedback means inherited/product work, not an untraced addition.

### WSJF dispatch table

This reproduces canonical scoring, descending by exact WSJF, then CoD, then ID.
Hard dependencies and gates take precedence. `*` is a mandatory critical
override; `†` is the accessibility minimum HIGH. This is the original dispatch
order; current observed implementation status is in 03/11, not inferred READY.

| ID | Title | BV | TC | RR | CoD | Size | WSJF | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| A2-WP019 | Runtime preflight | 4 | 4 | 4 | 12 | 2 | 6.00 | CRITICAL |
| A2-WP027 | Durable sync status | 4 | 4 | 4 | 12 | 2 | 6.00 | CRITICAL |
| A2-WP036 | Safe diagnostics | 4 | 4 | 4 | 12 | 2 | 6.00 | CRITICAL |
| A2-WP043 | Release decision | 4 | 4 | 4 | 12 | 2 | 6.00 | CRITICAL |
| A2-WP014 | Boundary contracts | 5 | 5 | 5 | 15 | 3 | 5.00 | CRITICAL |
| A2-WP021 | Progress units | 5 | 5 | 5 | 15 | 3 | 5.00 | CRITICAL |
| A2-WP018 | Dependency provenance | 5 | 4 | 5 | 14 | 3 | 4.67 | CRITICAL |
| A2-WP023 | Malformed recovery | 5 | 4 | 5 | 14 | 3 | 4.67 | CRITICAL |
| A2-WP025 | Account isolation | 5 | 4 | 5 | 14 | 3 | 4.67 | CRITICAL |
| A2-WP017 | Origin and cleanup | 4 | 4 | 5 | 13 | 3 | 4.33 | CRITICAL |
| A2-WP020 | Python guards | 4 | 4 | 5 | 13 | 3 | 4.33 | CRITICAL |
| A2-WP035 | Evidence honesty | 5 | 4 | 4 | 13 | 3 | 4.33 | CRITICAL |
| A2-WP031 | Feedback contract | 5 | 3 | 4 | 12 | 3 | 4.00 | CRITICAL |
| A2-WP040 | History feasibility | 4 | 3 | 5 | 12 | 3 | 4.00 | CRITICAL |
| A2-WP041 | Catalog feasibility | 4 | 3 | 5 | 12 | 3 | 4.00 | CRITICAL |
| A2-WP037 | Facet navigation | 4 | 3 | 3 | 10 | 3 | 3.33 | HIGH |
| A2-WP038 | Context and columns | 4 | 3 | 3 | 10 | 3 | 3.33 | HIGH |
| A2-WP015 | API authentication | 5 | 5 | 5 | 15 | 5 | 3.00 | CRITICAL* |
| A2-WP016 | Executable custody | 5 | 5 | 5 | 15 | 5 | 3.00 | CRITICAL* |
| A2-WP022 | Complete pagination | 5 | 5 | 5 | 15 | 5 | 3.00 | CRITICAL* |
| A2-WP024 | Reconciliation | 5 | 5 | 5 | 15 | 5 | 3.00 | CRITICAL* |
| A2-WP026 | Canonical identity | 5 | 5 | 5 | 15 | 5 | 3.00 | CRITICAL* |
| A2-WP029 | Delete/key lifecycle | 5 | 5 | 5 | 15 | 5 | 3.00 | CRITICAL* |
| A2-WP039 | Integrated evidence | 5 | 5 | 5 | 15 | 5 | 3.00 | CRITICAL* |
| A2-WP042 | Gate closure | 5 | 5 | 5 | 15 | 5 | 3.00 | CRITICAL* |
| A2-WP028 | Complete export | 5 | 4 | 5 | 14 | 5 | 2.80 | CRITICAL* |
| A2-WP030 | Migration/recovery | 5 | 4 | 5 | 14 | 5 | 2.80 | CRITICAL* |
| A2-WP032 | Encrypted feedback | 5 | 4 | 5 | 14 | 5 | 2.80 | CRITICAL* |
| A2-WP034 | LCARS accessibility | 5 | 4 | 4 | 13 | 5 | 2.60 | HIGH |
| A2-WP033 | Feedback editing | 5 | 3 | 4 | 12 | 5 | 2.40 | HIGH† |

### Package execution cards

Each row's output plus canonical story criteria and relevant tests in section 8
is the acceptance boundary. Reviewers are mandatory, not suggested.

| Package / story / wave | Concrete deliverable and closure evidence | Finding / owner feedback | Owner → reviewers | Direct prerequisites |
| --- | --- | --- | --- | --- |
| A2-WP014 / S014 / W0 | Reconciled CP-01–06 contracts, wireframes, threat/custody inventory, tests 1–15 applicability and native portability constraints; dated A2-G0 decisions, not this document alone | A003–005, A016–017, A049; OF-007 | R → D,W,G,Y | Captain direction received; detailed decisions pending |
| A2-WP015 / S015 / W1 | Independent capability protects every API route; bootstrap, metadata guards, port validation and action-bound confirmation replay tests | A001,A047; — | W → D,G | S014,S019 |
| A2-WP016 / S016 / W1 | Absolute trusted interpreter/helper paths, unsafe-root rejection, verified ACL-before-open contract; substitution fixtures never execute | A002,A021; — | W → D | S014,S019 |
| A2-WP017 / S017 / W1 | Shared provider HTTPS predicate before navigation/cookie setup/callback; owned descendant cleanup and initiating-focus evidence | A019,A046; — | W → D,G | S016 |
| A2-WP018 / S018 / W1 | Hash-locked approved artifacts/index, tamper failure, dated license/vulnerability receipts and unchanged shipping guard | A018; — | W → D | S014 |
| A2-WP019 / S019 / W1 | Pre-import runtime guard and tested minimum Node/SQLite flags; fixed actionable unsupported-runtime error | A010; — | D → W | S014 |
| A2-WP020 / S020 / W1 | Python semantic scan/canaries, exact status/error allowlists and bounded RPC/stdout/stderr; synthetic egress evidence | A020,A048; — | W → D | S016,S018 |
| A2-WP021 / S021 / W2 | Explicit source units through Python, Node and rendered progress; replace wrong expectations | A003; — | D → Y | S014 |
| A2-WP022 / S022 / W2 | Bounded page accumulator with completeness proof or classified stop; overlap/reorder/cap/cancel fixtures preserve prior state | A004,A037; — | D → W,Y | S021,S023 |
| A2-WP023 / S023 / W2 | Atomic malformed-record refusal/recovery, positional categories, shared contributor limit and corrected-source retry journey | A005,A006; — | D → W | S014 |
| A2-WP024 / S024 / W2 | Reference/time validation; reconcile prior catalog AND entries, seal reconciled state and atomically promote; restart/replay digests | A007,A008,A034; — | D → W,Y | S022,S026 |
| A2-WP025 / S025 / W2 | Account join enforced on status/read/write/startup; quarantine mismatch and failed rollback; disconnected same-account local read works | A009; — | D → W,G | S015,S016 |
| A2-WP026 / S026 / W2 | Role-independent person IDs, canonical book aliases and collision-aware migration maps; no guessed repointing | A011,A012; OF-007 portability | D → W,Y | S014 |
| A2-WP027 / S027 / W2 | Attempt recorded before startup, durable-success authority, preserved primary error and fake-clock/reload evidence | A029,A030,A039,A051; — | D → W,G | S024,S025 |
| A2-WP028 / S028 / W3 | Closed portable export/restore validator including feedback and missing books; private copy disclosure and exact semantic round trip | A016; OF-007 portability | D → W,G | S015,S024,S025,S031 |
| A2-WP029 / S029 / W3 | Distinct feedback/local/disconnect lifecycle, approved retention/key inventory, interruption/restart/residue receipts | A017,A045; OF-007 custody | W → D,G | S016,S025,S031 |
| A2-WP030 / S030 / W3 | Versioned explicit legacy migration, encrypted backup/promotion/restore, downgrade refusal and interruption evidence | A012; OF-007 portability | D → W | S024,S026,S028,S029 |
| A2-WP031 / S031 / W3 | Revision-frozen domain AND persisted DDL/envelope/generation/tombstone/sidecar/export schema; independent half-stars, bounded text/tags, explicit Save/conflict semantics; consumers cite revision | New private-feedback scope; OF-004 | D → W,G,Y | S014,S026 |
| A2-WP032 / S032 / W3 | Account/book-keyed encrypted local CRUD; commit-before-ack; sync cannot write reviews; concurrency/crypto/lifecycle tests | New private-feedback scope; OF-004,OF-007 | D → W | S015,S024,S028,S029,S030,S031 |
| A2-WP033 / S033 / W4 | Reusable inline/detail editor, create/edit/clear/delete, draft/save/conflict states and keyboard/AT/touch journey | New feedback UX; OF-004,OF-006 | G → D,W,Y | S032,S034,S035 |
| A2-WP034 / S034 / W4 | Mobile-first LCARS shell, grouped primary/utility navigation, decorative filler, one dispatcher over polite/assertive regions, 44px targets, spacing/focus/contrast/reflow evidence | A022,A023,A041; OF-003,OF-005,OF-006 | G → W,Y,D | S014 |
| A2-WP035 / S035 / W4 | Mode copy inventory, isolated synthetic trace, exact missingness, stale-route/error/reload behavior; no fallback relabeling | A015,A024,A028; disclose A027; OF-001,OF-005 | Y → G,D,W | S027,S034 |
| A2-WP036 / S036 / W1 | Candidate validation outputs only position/category; hostile IDs/messages absent from final diagnostics | A033; — | D → W,Y | S014 |
| A2-WP037 / S037 / W4 | Deterministic facet membership, accessible matching books and collapsible groups; Genre prove-or-remove decision and tests | A025,A026,A043 navigation only; OF-002,OF-004 | G → D,Y | S026,S034,S032 |
| A2-WP038 / S038 / W4 | Captain-approved useful columns, memory-only filter/group/focus state, feedback-aware filters/sorts, mobile disclosure | A042,A044; OF-003,OF-004,OF-006 | G → D,W,Y | S033,S037 |
| A2-WP039 / S039 / W5 | Assemble package tests, real Windows containment execution, synthetic lifecycle E2E, three semantic digests and measured budgets | A049; OF-001–006 evidence | D → W,G,Y | S017,S018,S020,S030,S038,S036 |
| A2-WP040 / S040 / W6 | Dated supported-history research and exact fields/rights; separately permitted proof or STOPPED; unsupported dates remain labeled/disabled | A013; disclose A031 | D → W,Y,R | S014; bounded route decision; S039+A2-G2 before live |
| A2-WP041 / S041 / W6 | Supported non-owned catalog/rights research; permitted non-owned attestation or STOPPED, no catalog product API | A014; OF-007 future dependency only | Y → D,W,R | S014; route/rights decision; S039+A2-G2 before live |
| A2-WP042 / S042 / W7 | Every mandatory finding/test mapped to executed evidence; G3/G4 comparison/ADR, four-officer review, residual FMEA and G5 disposition | A049; OF-007 | R → D,W,G,Y | S039,S040,S041; legal and A2-G3/G4 evidence |
| A2-WP043 / S043 / W7 | Honest version/schema/docs decision packet, final changelog/restrictions and Captain PASS/HOLD/FAIL; no automatic distribution | A050; OF-007 release boundary | R → D,W,G,Y | S042; A2-G5; Captain A2-G6 decision |

All 51 inherited findings retain their [canonical dispositions](03-backlog.md#inherited-finding-disposition).
The mandatory set remains 30 IDs plus promoted A012 before feedback.
A031/A032 richer dates/multi-series, A035 queue optimization,
A038 broad temp-write redesign and A040 helper optimization are not silently
added. A032 first-series disclosure belongs to WP037. A036 broad optimization
remains deferred, but actual-byte accounting proof/correction belongs to WP022;
re-serialized JSON is not wire-byte proof. Measure A035/A036/A040 under S039;
reopen A038 only if new writes reveal
a blocking collision risk, without relaxing atomicity tests. A045 residual
disclosure and A048 strengthened vocabulary do not waive A001/A002.

## 4. Concrete file and module change map

Paths in this section are relative to `code/Alpha0.x/`. **Existing** means source
observed during planning, not a claim of correct behavior. **Proposed** means a
new module to create only after its contract/design checkpoint. Preserve zero
npm dependencies unless a reviewed necessity changes that decision.

| Existing surface / current responsibility | Planned change | Packages |
| --- | --- | --- |
| `scripts/serve.js`: `createStaticServer`, `handlePrivateAlphaApi`, Host/path/symlink guards, CSP; loopback listener | Auth before every API branch, closed request parsing, per-route caps, confirmation flow, safe errors, no-store responses and validated ephemeral port. Preserve static containment/CSP; never bind LAN. | WP015,WP028–029,WP032 |
| `scripts/private-alpha-runtime.js`, `package.json` | Move supported-runtime check before dynamic SQLite-dependent composition; align declared/tested runtime/flags. Require custody success before constructing store; future version update coordinated, not now. | WP016,WP019,WP043 |
| `scripts/setup-connector.js`, `connector/requirements-private-alpha.txt`, `connector/requirements-private-alpha.lock`, `THIRD-PARTY-NOTICE.txt` | Trusted absolute setup interpreter/helpers; hash-verified reproducible install with controlled index and no unreviewed build scripts; lock digest, provenance/license/audit record. | WP016,WP018 |
| `scripts/private-alpha-policy.js`, `connector/private-alpha-policy.json`, `connector/atnr_connector/policy.py` | Preserve private/US/tester/interval/no-shipping invariants; validate approved configuration fingerprint. No silent cap/retry or audience change. | WP018–020,WP039,WP043 |
| `src/adapters/connector-process.js`: serialized `ConnectorProcess`, method timeout/output caps | Trusted executable/cwd/environment, exact public errors, protocol validation, test-owned cancellation tree; add only reviewed local sealing RPC methods. | WP016–020,WP024,WP032 |
| `connector/atnr_connector/service.py`: `ConnectorService`, `_safe_external_browser_callback`, `_account_key`, `_public_status`, `sync_library` | Origin predicate before all navigation/cookie setup, owned-child cleanup, closed public status, bounded page-completeness logic, explicit capture versus durable state, account binding. Provider credential renewal persistence stays intact. | WP017,WP020–027 |
| `connector/atnr_connector/normalize.py`: `_progress`, `_contributor`, `_categories`, `normalize_library` | Explicit units, reviewed contributor limit, role-independent identities, positional errors and category evidence. No silent truncation, invented dates, title-based genre classification or new endpoints. | WP021–023,WP026,WP037 |
| `connector/atnr_connector/custody.py`: `WindowsDpapiProtector`, `secure_path`, `SecureJsonStore`, seal/unseal | Trusted Windows helper resolution, ACL readback, fail-closed root checks and local-only encrypted envelopes/key lifecycle; explicit residue/retention/backup cleanup. Fixed entropy is not a destroyable per-container key. | WP016,WP028–030,WP032 |
| `connector/atnr_connector/rpc.py`: `_read_request`, `_dispatch`, `main` | Versioned closed method/param/output schemas; one bounded JSON reply, fixed error vocabulary; dispatch local sealing separately from provider access. No arbitrary paths, commands or credential export. | WP020,WP024,WP032 |
| `src/sync/live-snapshot.js`: `validateLiveSnapshot` | Require valid zone-qualified observation time/references; validate current candidate then reconcile with same-account prior catalog/entries under complete-or-stop policy. | WP024–026 |
| `src/sync/private-alpha-service.js`: status/connect/sync/library/disconnect/delete/scheduler | Record attempt before connector launch, account consistency guard on every operation, reconcile/seal/commit before success, local lifecycle service composition and mismatch quarantine; no annotation mutation by sync. | WP024–029,WP032 |
| `src/store/encrypted-snapshot-store.js`: SQLite singleton snapshot and sync state | Pre-decrypt schema marker/fingerprint; singleton-table rebuild to account/generation state; explicit durability pragmas and reconciled promotion. `last_success_at` becomes service commit time, not connector `observedAt`; preserve observation separately. Custody before store open. | WP024–025,WP027–030 |
| `src/core/model.js`: normalization, `Catalog`, `mergeLibrarySnapshot`, declared local fields | Reuse authority/referential rules, retain missing catalog references and canonical identity maps. Existing local-field declarations are not a review store; keep source entry and feedback contracts distinct. | WP024,WP026,WP031 |
| `src/core/validate.js`, `errors.js`, `trust.js`, `contract.js` | Dedicated feedback validation without weakening imported-text/commercial protections; shared bounds/closed errors, safe candidate diagnostics, golden boundary fixtures. Preserve no-ranker/no-model policy. | WP020–023,WP031,WP036 |
| `src/core/library.js`: row projection/filter/sort/facet/group functions | Join feedback by verified book key, deterministic multi-member facets, null-last dimension sorting, comment/tag filters and explicit grouping keys. Never stringify contributor arrays as headings. | WP037–038 |
| `ui/js/connection-api.js`: session discovery and current local API client | In-memory capability/CSRF lifecycle, explicit authenticated unlock, typed errors, confirmations, review CRUD/export methods, no public session-token vending. | WP015,WP028–029,WP032–033 |
| `ui/js/store.js`: `AppStore`, private load, query/detail/trace/export | Separate active data from bundled-only trace, exact missingness, durable status, drafts/revisions and memory-only navigation state. Replace fixture sentinels with a synthetic adapter of the same feedback contract. | WP027–028,WP033,WP035,WP037–038 |
| `ui/js/app.js`, `router.js`, `dom.js`, `format.js` | Mode-aware document title/navigation/focus, safe text/value rendering, reusable confirmation and single announcement channel; rating values accessible in text. No comments/search in route hashes. | WP033–035,WP038 |
| `ui/js/views/library-view.js`, `book-detail-view.js`, `data-view.js`, `feasibility-view.js` | Library/detail inline editor, useful columns/groups, lifecycle export/delete, source/error copy inventory, isolated synthetic diagnostics. No facet-rating editor. | WP028–029,WP033–038 |
| `ui/css/base.css`, `tokens.css`, `layout.css`, `components.css` | Mobile-first safe-area/keyboard/reflow, approved gray filler, touch targets, visible actual-surface focus and dialog/editor layouts. Retain reduced motion and no remote assets. | WP033–034,WP037–038 |
| `src/version.js`, implementation `README.md`, `test/version.test.js` | Future coordinated code/schema/export version assertions and honest setup/release wording after migration evidence. Do not change current runtime or relocate its state in this planning task. | WP019,WP030,WP043 |

### Proposed modules (names become final at CP approval)

| Proposed path | Single responsibility / boundary | Owner / package |
| --- | --- | --- |
| `src/security/local-api-auth.js` | Per-start capability verifier, protected-route policy and action/session/account/resource-bound confirmation nonces | Worf / WP015 |
| `scripts/local-capability-bootstrap.js` | Approved launcher-owned transient capability delivery; no public HTTP, URL, logs or persistent browser storage. Delivery proof blocks implementation, not a presumed solved helper. | Worf / WP015 |
| `src/core/identity.js` | Versioned canonical key/alias-map validation; collision and ambiguity outcomes shared by migration/reconciliation | Data / WP026 |
| `src/core/review.js` | Pure private review normalization, bounds, local authority and semantic projection; no network/storage imports | Data / WP031 |
| `src/core/export.js` | Closed portable export validation and canonical semantic digest projection; no credentials/custody seed | Data / WP028 |
| `src/store/encrypted-review-store.js` | Account/book keyed sealed review records, compare-and-swap revisions and durable acknowledgements; no provider adapter dependency | Data / WP032 |
| `src/store/migrations.js` | Explicit version detection, ordered migration registry and transactional promotion; never automatic owner-root mutation at startup | Data / WP030 |
| `src/store/local-data-lifecycle.js` | Coordinated review/snapshot/identity/backup cleanup inventory and recovery receipts; credentials handled only via connector lifecycle | Worf + Data / WP029 |
| `connector/atnr_connector/local_envelope.py` | Typed local-only seal/unseal, reviewed key/envelope version and account/purpose binding; separate from provider request methods | Worf + Data / WP024,WP032 |
| `ui/js/components/review-editor.js` | Shared inline/detail explicit-Save editor and draft/conflict/clear/delete behavior | Geordi / WP033 |
| `ui/js/components/library-group.js` | Accessible group disclosure/count/all-actions and stable focus restoration | Geordi / WP037 |
| `ui/js/library-session-state.js` | Memory-only query/filter/sort/group/disclosure/focus state partitioned by account and data mode | Geordi + Data / WP038 |
| `test/fixtures/alpha-0.0.2/` and focused `test/*.test.js`, `connector/test/test_*.py` additions | Invented cross-runtime golden fixtures and fault controls; extend existing runners, not a parallel harness | Data / each WP, assembled WP039 |

New modules may be combined if review proves simpler ownership, but their
authority boundaries and test coverage may not be collapsed. No proposed
`recommendation_feedback` table, AI module, native Swift module or iOS importer
is part of this release.

## 5. API, RPC and authenticated loopback contract

### HTTP perimeter and bootstrap

Current routes are GET `/api/v1/session`, `/status`, `/library` and POST
`/connect`, `/sync`, `/disconnect`, `/delete-local` under `/api/v1`.
The current unauthenticated session response supplies its own mutation token;
Host/Origin/CSRF checks alone do not authenticate a local process.

Proposed CP-02 contract:

- Generate at least 256 random bits per server start. All `/api/v1/*` routes,
  **including session discovery, errors and confirmation issuance**, require
  an independently delivered capability in an authorization header and
  constant-time verification. Static resources contain no capability.
- Preferred design candidate: a launcher-owned transient local unlock display,
  protected by the approved OS-user boundary, supplies a capability the owner
  enters in a clearly labeled **local ATnR unlock**, never an Audible credential
  form. No clipboard read, command-line argument, environment dump, console/log,
  file, URL/fragment, referrer or browser persistent storage carries it.
  The exact trusted display/delivery implementation, spoofing/shoulder-surfing
  exposure, cancellation and accessible entry need Worf/Geordi approval.
  If that channel cannot be proven, **S015 stops for another reviewed design**;
  do not fall back to public token vending or automatic browser injection.
- CP-02 compares at least two delivery candidates: transient launcher-owned
  display/manual entry and owner-ACL one-use token file. Record the latter as
  **rejected under the current no-token-file rule**, not an authorized fallback.
  Any replacement channel needs a new reviewed decision. Six-digit PINs,
  salted short codes and QR/URL token transport are not equivalent authority.
  Preserve ≥256 random bits; grouping/formatting may aid entry without reducing
  entropy. Test actual keyboard/AT entry, correction, cancel and failure using
  synthetic capabilities; no clipboard API or password-manager access.
- Unlock explicitly says “Local ATnR unlock — not Amazon sign-in; ATnR never
  asks for your Amazon password, passkey or MFA code.” Use labeled transient
  input, autocomplete/spellcheck off and clear focus/error semantics; do not
  claim these attributes defeat extensions. Erase input on submit/cancel;
  never place capability in DOM attributes, global `window` objects,
  `postMessage`, URLs or persistent storage. Only the deliberate entry control
  may transiently contain typed text; it is not provider authentication and
  possession does not make its process trusted.
- Proposed local verification policy for CP-02 ratification: at most five
  failures per server capability generation, minimum 1 second delay doubled
  on consecutive failures (bounded at 30 seconds). At the ceiling invalidate
  capability/session/nonces, remain locked, and permit recovery only through
  the trusted launcher. Never vend a replacement or reset the failure counter
  through HTTP. Bound resource use before auth, including confirmation/write/
  export burst limits; exact per-route budgets must be recorded before READY.
  This is local abuse protection, not a provider retry-policy change.
- Explicit residual: extensions/content scripts with app-origin permission,
  debugger/DOM access or main-world injection may read entered secrets or
  private content. Closure-private variables/CSP are not a defense against a
  privileged extension. Require the dedicated extension-free profile; test
  ordinary foreign origins cannot obtain/use authority without claiming
  immunity to same-user malware or an authorized malicious extension.
- An authenticated session response can issue a separate in-memory session/CSRF
  binding; rotation, restart, account change and lock invalidate it and pending
  confirmations. Browser keeps capability/session only in memory; reload
  re-unlocks rather than reconstructing secrets from storage. Do not claim
  defense against same-user malware with access to runtime memory.
- Bind only `127.0.0.1`, validate requested/selected ports (including explicit
  ephemeral `0`), reject NaN/fractional/negative/out-of-range/unavailable inputs.
  Validate Host against the actual listener. No wildcard CORS.
- Retain Origin/Host/CSP/referrer protection; reject absent/invalid fetch
  metadata on protected data/mutation requests. Define allowed method/site/mode
  combinations in CP-02, test missing Origin on mutations and forged metadata.
  Metadata is defense-in-depth, never a replacement for the capability.
- Fixed 401 for absent/invalid auth, 403 for rejected browser metadata, 400/413
  for schema/size failure, 409 for revision/account/state conflict, classified
  storage/connector failure without private exception text. Unknown errors
  collapse to a known category. No error echoes request IDs supplied as text.
- Require JSON content type and closed fields. Stream-count bytes even for
  chunked requests; existing small control bodies stay bounded separately
  (currently 8 KiB). Review-write ceiling is 64 KiB, not a global cap increase
  for connector responses. `Cache-Control: no-store` on private successes/errors;
  no access logs containing bodies, authorization, query or book/account keys.

### Proposed endpoint inventory

Exact wire names are CP-02/04 design outputs; the following is the target
contract to implement and test. All routes inherit the perimeter above.
Account identity is resolved by the service, not accepted as a user-selected
tenant. No browser route reads provider tokens.

| Operation | Request / response / invariant |
| --- | --- |
| `GET /api/v1/session` | Authenticated bootstrap completion only; safe capability flags/contract versions and ephemeral session/CSRF binding; no account identifier or credential material |
| `GET /api/v1/status` | Closed connection/local/mismatch state, last attempt, last durable success, stale/incomplete flags and closed error category; connector capture success never substitutes for commit |
| `GET /api/v1/library` | Validated active/retained same-account catalog/entries with explicit missingness/source state; include or separately load bounded saved-feedback projection under the same account/snapshot generation |
| `POST /api/v1/connect`, `/sync` | Existing explicit lifecycle actions and grant; no route expansion/retry. Guard account before exposure/promotion; return truthful in-progress/stopped/durable outcome |
| `POST /api/v1/confirmation` (new) | Authenticated bounded request after deliberate action/re-entered capability; one nonce per action/resource, bound to session/account/resource/revision/generation. Fixed 120-second lifetime; reject at elapsed >=120 seconds using monotonic time. Reissuance replaces prior nonce; consume atomically, invalidate on lock/rotation/account change |
| `GET /api/v1/reviews/:bookId` (new) | Validate opaque canonical ID, resolve under active verified account including retained removed books; return local review or explicit absent state plus current opaque revision token |
| `PUT /api/v1/reviews/:bookId` (new) | Closed full review payload plus expected revision token; optional request nonce for retry recognition. Atomic validate/CAS/seal/commit; return saved values/revision only after durability. No accepted partial field writes |
| `DELETE /api/v1/reviews/:bookId` (new) | Expected revision and fresh confirmation; delete content, advance deletion generation and acknowledge only after commit; stale or replayed requests cannot recreate/delete a newer record |
| `POST /api/v1/export` (new) | Fresh action-bound single-use confirmation AND re-entered capability, same strength as disconnect/delete; explicit rate limit and plaintext/cloud/Known-Folder/backup disclosure. Consistent approved schema includes requested book metadata/reviews but excludes credentials/internal account keys/security events/raw diagnostics. No arbitrary server path; headers/filename/errors contain no titles/account IDs |
| `POST /api/v1/delete-local` | Fresh confirmation bound to inventory generation; delete local library/reviews/sync/derived state under approved lifecycle, report retained registration/key-recovery items accurately. Not implicit Disconnect |
| `POST /api/v1/disconnect` | Fresh confirmation; provider deregistration and credential destruction only after confirmed result; retain local library/reviews. Uncertain result stays recoverable and cannot claim disconnected |

A review write is for a known canonical book in the verified current or retained
library, never a group/facet ID or arbitrary newly supplied catalog object.
Rate/burst protection for local confirmation/write endpoints must be bounded
and reviewed; it does not change provider rate/retry policy.

Lost response after a committed save is not permission to blindly overwrite:
client reloads the current revision, compares canonical values, and either
recognizes its already committed save or presents conflict recovery. A request
nonce, if selected, is bounded, account-scoped and retains no extra comment copy.
Failed/expired confirmations require a new deliberate confirmation. Service
serializes destructive actions against sync/save/export/migration and checks
account/generation again at commit to prevent time-of-check/time-of-use races.

### Supply chain and privacy-safe local security events

WP018/T24 covers direct/transitive Python artifacts **and** the Node runtime,
bundled `node:sqlite`, Playwright driver and actual system Edge channel used.
Record approved origin, versions, hashes/signatures where available, audit/
license dispositions and controlled installer/index. Require
`--require-hashes --no-deps --only-binary :all:` with an explicit approved index;
test tamper, index override and unexpected source-build failure. No install is
performed by this plan. Edge auto-update is a named residual, not falsely pinned:
major channel change triggers Worf/Data re-review before further authorization.
S019 aligns engine floor, startup flags, README and `connector:test` interpreter
path with the tested profile; no unsafe bare-name resolution.

WP036 owns a closed local event schema: timestamp, enumerated action category,
enumerated outcome and bounded capability-failure counter only. Never retain
account/book IDs, user queries, library counts, filenames/paths, tokens,
comments, exception strings or request bodies. Store under approved encrypted
local custody, no telemetry; WP029 owns deletion/retention inventory and
WP028 excludes it from user-data export. Proposed bounds for CP-04 approval:
1,000 records / 256 KiB maximum, oldest-first eviction and seven-day maximum
retention; whichever bound is reached first applies. Retention is **pending
Captain/Worf approval**, not permission to start recording. Test clock reversal,
lockout flood, disk failure and canaries; inability to record must not bypass
authentication or reveal private error details.

### Python stdio boundary

Existing methods are `status`, `connect`, `sync_library`, `disconnect`,
`unseal_snapshot`. The legacy unseal method must be retired from normal dispatch
or rebound to the same purpose/account/version validation as the new methods.
Only an explicit migration adapter may read exact known legacy envelopes;
it cannot become an arbitrary DPAPI oracle. Keep serialized concurrency one and the existing method
timeouts/output bounds (currently 40 MB stdout, 64 KiB stderr; connector
snapshot sealing has its own 32 MB cap). Approve any protocol version change
before use and fail closed on unknown versions/methods/keys.

Add typed **local-only** `seal_local_envelope` / `unseal_local_envelope` operations
if approved at CP-03. They accept a bounded known-purpose payload (reconciled
snapshot or review), verified account binding and envelope version—not a path,
command, URL, credential object or provider request. Node may see normalized
library and user-entered feedback in runtime memory, never provider credentials.
Local seal/unseal must not construct an authenticated provider client or perform
network access. Reuse DPAPI custody behind a purpose/account-bound envelope;
do not solve reconciled persistence by storing plaintext or returning auth keys.

One bounded JSON result per invocation; safe fixed vocabulary on all failures,
including syntactically valid lowercase hostile codes. Reject extra stdout,
oversize/malformed replies, unexpected status keys, cancellation and timeouts.
Maintain credential refresh durability separately from library promotion:
discarding an unsuccessful candidate must not discard a legitimately refreshed
provider token. Explicit Worf disposition of the exact provider-hosted headed
Edge flow is required; neither source scanning nor its “iPhone” label proves
credential non-observation or mobile compatibility.

## 6. Data schema, authority and sync correctness

### Version and authority model

Current SQLite has STRICT singleton `encrypted_snapshot` and `sync_state`
tables, no migration registry/private-review table. The body is DPAPI sealed;
account key, marketplace, counts/timestamps/error metadata are currently clear
columns. Current JSON envelopes use schema version 1 and core schema identifies
0.0.1. Do not reinterpret those formats in place.

CP-03 must distinguish application version, core schema, SQLite schema,
export schema, identity-map version and crypto-envelope/key version. Proposed
SQLite revision 2/core `atr-schema-0.0.2` are design targets, not a runtime bump.
An unversioned known legacy database is recognized by exact schema fingerprint;
unknown/newer/partially created schema is refused before decryption or writes.
The current database has no pre-decrypt registry. S031 freezes a non-secret
`user_version`/schema metadata contract with envelope versions; S030 writes it
with the structural migration. Validate ciphertext's authenticated inner version
against outer metadata; an unauthenticated marker never proves payload validity.

| Entity / proposed logical schema | Keys, fields and authority |
| --- | --- |
| Account binding | One active local container: opaque `accountKey` plus `marketplace`, container generation and verified-binding state. Existing HMAC-derived key remains local; raw provider user ID/HMAC seed never goes to browser/export/logs. No multi-account selection feature. Reconnect verifies the same binding, not local alias |
| Book and catalog | Canonical opaque `bookId`; source provider/marketplace/external ID and identity basis, alias-map version, people/facet references, provenance and explicit unknowns. Source owns metadata. Do not key feedback by title, list index or current display name |
| Catalog person | One person per verified same source-person identity, roles as a set. Baseline `name:<name>` fallback does NOT guarantee separation. Replace with stable per-source-record/occurrence surrogates; provider-ID cross-role equivalence only, unresolved fallback stays separate until explicit mapping. Apply the same no-name-merge rule to series/genre and UI grouping |
| Library entry | Account/book key, source status/progress/dates, acquisition and observation provenance; `missingFromSource`, membership observation and last-seen semantics. Source removal retains entry AND referenced catalog, not fabricated current membership |
| Private review | One active record per account/book; `overallRating`, `storyRating`, `narrationRating`, `comment`, `tags`, `source: local-user`, immutable `createdAt`, `updatedAt`, revision/generation. Entire private payload sealed. No source rating overwrite, facet preferences, favorites/abandoned/listen-again editing |
| Revision/deletion state | Opaque compare-and-swap token incorporating a persistent generation; token issued also for absent state. Delete clears content and advances generation, so a stale pre-delete request cannot resurrect a review (ABA protection). Minimal encrypted tombstone has no retained comment/rating/tag content; purge with full local deletion |
| Sync state | Attempt ID/time, last durable success, candidate observation time, current snapshot generation, safe outcome/count/completeness metadata. Capture success is not durable success; attempt/failure cannot replace prior snapshot |
| Identity mapping | Explicit old→canonical mapping, provenance/basis and map version; collisions/one-to-many/many-to-one require resolution or quarantine. Validate all references and review keys in one migration transaction |
| Migration metadata | Version, ordered migration ID/checksum, encrypted recovery manifest, backup generation and safe completion state; no payload or personal filesystem paths in public receipts |

**Identity/storage invariants (CP-03 ratification required):**

- Retain `identity.bin`/HMAC seed whenever **any** retained snapshot, review,
  tombstone, mapping or managed backup depends on its account key, including
  after successful Disconnect. Never reseed to recover a mismatch. Destroy it
  only after all dependent local records/managed backups are discharged and
  registration recovery no longer needs it. A SQLite transaction cannot
  atomically delete external files: S030's generation manifest/journal must
  prove interrupted cross-file recovery and safe destruction ordering.
- Feedback anchors the canonical **edition/book**, not `workId`. Preserve
  optional source work identity/provenance and explicit unknown in schema,
  mapping and export; do not transfer ratings across editions by work/name.
  No-ID→ID mapping is explicit; duplicate names across people/series/genres
  remain separate without proven source equivalence. Quarantine ambiguity.
- Existing version-shaped storage root is a frozen **migration input**, not a
  value derived from release version. S019/S030 test version bumps do not create
  a fresh empty store; absent/unknown migration roots fail closed. First-time
  initialization is a distinct approved path, not migration recovery.
- S031 publishes revision-frozen persisted DDL, envelope layout, CAS/deletion
  generations, tombstones, backup/sidecar inventory and export schema.
  S028/S029/S030 cite that revision; S032 implements it, rather than designing
  the schema after its consumers. CP-03/04 still require dated approval.

Ratings each accept **null or a finite numeric 0.5–5.0 in 0.5 steps**. Reject
zero, coerced strings, NaN/infinity and inferred scores; do not infer a dimension
from another. Comments/tags without ratings are valid. CP-04 proposed bounds:
comment ≤4,000 Unicode code points; ≤20 tags, trimmed nonempty ≤40 code points;
total encoded request ≤64 KiB. Define normalization as Unicode NFC plus reviewed
deterministic case-insensitive deduplication, preserving a chosen display form;
lock cross-runtime fixtures for combining characters, surrogate pairs and
casefold collisions. Do not rely on JavaScript UTF-16 length as code-point count.
Count limits after normalization and enforce transport cap before decoding.
Unknown fields/excess reject atomically, with fixed field/category errors.

Use a dedicated review-text validator: harmless personal prose remains inert
text, not a catalog trust token or instruction. Reject unsupported controls
explicitly or render approved suspicious controls visibly; never execute links,
HTML, bidi layout escapes or formulas. Do not silently truncate or erase drafts.

The service generates timestamps as zone-qualified instants; `createdAt` stays
immutable for an active record, `updatedAt` changes only on committed edit.
Revision order is authoritative if the wall clock moves backwards. Define
recreation after deletion as a new record with a new createdAt/generation.
Exact retry/no-op semantics are fixture-tested; repeating the same acknowledged
revision/payload must not create duplicates or falsely advance a save.

### Encryption and physical storage proposal

- Preserve the Windows-user DPAPI custody boundary outside repo/cloud sync.
  Proposed encrypted review table indexes only opaque account/book keys and
  CAS generation as necessary; seal ratings, comments, tags and their timestamps.
  Consider moving sensitive counts/times/alias provenance into the encrypted
  envelope; any retained clear metadata needs a CP-03 minimization rationale.
- Add a schema registry and local-review storage without making source-sync
  upsert/delete code capable of writing annotations. Use a narrow store interface
  and transaction coordinator, not a generalized mutable object shared by sync.
- Reconciled design baseline for CP-03/04 is **direct user-scoped DPAPI through
  typed local-only Python RPC**, not a new Node-held container key. Provider
  credentials remain Python-only. Bind purpose/account/envelope version and
  reject tampering/cross-purpose unseal on every dispatch path. Record renewed
  A045 residual acceptance and demonstrate bounded deletion, not cryptographic
  erasure. This selection is planning scope control, not Worf/Captain sign-off.
  Random container-key/Node AEAD alternatives remain deferred: reconsider only
  with measured need, Worf threat review and explicit estimate/scope change.
- Freeze existing legacy entropy bytes exactly; never derive new entropy from
  app release version or edit a constant that decrypts old envelopes. Give
  formats explicit crypto versions. S030 owns any required credential/identity/
  snapshot re-seal using known legacy reader, staging and rollback. New review
  format cannot strand old credentials or prevent deregistration mid-upgrade.
- Keep credential custody distinct from local-data keys so local deletion need
  not destroy a live registration. Key/identity seed retention while registered,
  disconnect ordering, final destruction and backup retention must be enumerated.
  If direct DPAPI sealing is retained, disclose its erasure limitations and
  obtain a gate disposition; never label unlink/VACUUM as crypto-erasure.
- Atomic transaction stages metadata and sealed payload together, verifies
  expected account/generation/revision immediately before commit, and only then
  acknowledges. Failures leave the previous committed state. Inspect disposable
  DB journals/sidecars/temp files/backups for canaries; no plaintext spill.
- Record/verify SQLite `journal_mode=DELETE`, `synchronous=FULL` and
  `secure_delete=ON` for this baseline; include write amplification in measured
  costs. A pragma is not durability proof: kill between commit and acknowledgement,
  test power/interruption assumptions and refuse unsupported durability behavior.
- CP-04/06 must freeze aggregate review count, encrypted store size, maximum
  decoded export size and peak-memory bounds, including retained removed books,
  tombstones and backups. Per-record 4,000/20/40 limits alone are insufficient.
  Test exact/over aggregate limits atomically; never delete older feedback or
  silently truncate to fit. Missing numeric aggregate budgets blocks S032.
- CP-03/06 must choose a bounded generation-scoped decrypted projection/cache,
  not repeated unbounded whole-snapshot unseal on every GET. If a cache is used,
  invalidate on sync commit, account change, lock, deletion and restart; bound
  plaintext memory lifetime/size and disclose memory-erasure limits. Measure
  Python spawn count per sync/save, p95 save latency and maximum contiguous
  event-loop stall before approving budgets. Do not weaken custody for speed.
- DPAPI cannot defeat same-user malware, live memory, dumps, pagefiles, VSS,
  SSD remnants, backups or external exports. Do not promise forensic erasure.
  Future native transfer is a separately approved re-encryption/import operation,
  never copying DPAPI keys/credentials into an iOS bundle.

### Complete-or-stop sync transaction

1. Serialize source synchronization against destructive/migration operations;
   record an attempt before connector startup. If attempt persistence fails,
   stop safely and preserve primary versus secondary error categories.
2. Validate custody, source grant/config fingerprint, current credential/local
   account relationship and marketplace. Account B with retained A or failed B
   registration rollback is explicit mismatch: withhold the library, feedback,
   export and writes. Normal disconnected A may read its retained local data.
3. Fetch only approved library pages. Current bounds are 20 pages, 1,000 items
   per page, 25 MB cumulative response accounting and existing execution/RPC
   bounds; store item bound is 20,000, not proof a full 20,000-book import is
   possible. Do not use a count or Content-Length alone to bypass actual bytes.
   WP022 must prove actual cumulative response-byte enforcement within the
   existing client boundary or STOP for review; JSON re-serialization is not
   equivalent. CP-01/06 derives a supported size envelope from invented
   bytes/item, Unicode/escaping, serialization overhead, 25 MB response,
   32 MB seal, 40 MB RPC and 20,000 store bounds. Document which cap trips
   first and fixed stop codes; no promise that all 20,000 books fit.
4. Stage the full candidate in bounded memory/custody. Track identities/page
   evidence; default on any duplicate/overlap is classified STOP, retaining
   the prior complete snapshot. Deduplication needs a separately approved
   completeness proof before it can replace that default. Mutating pages, conflicting IDs or
   unsupported total/terminal evidence stop; deduplication alone proves nothing.
   At page 20, absent approved completeness evidence means stop, not page 21.
5. Normalize source-specific units, contributor identities and allowed metadata.
   Percentage fixtures 0, 0.5, 1, 25, 42.9, 99.9, 100 retain their values.
   Separate completion status from unit conversion; invalid/unknown never
   becomes zero/completed. Position/history dates remain unknown without proof.
6. Apply the shared reviewed contributor limit end-to-end; 50/51/60/100 fixtures
   cover each side. A malformed middle record in a three-record capture produces
   bounded index/category diagnostics. Default is no promotion; after correction
   a deliberate permitted refresh succeeds. Partial/quarantine display requires
   explicit policy approval and cannot masquerade as complete.
7. Validate source and zone-qualified `observedAt`, catalog/person/facet/book
   references and entry→book integrity. Never apply fixture-clock defaults to
   live data. Retain all metadata referenced by missing entries/reviews.
8. Reconcile against the last complete **same-account** state; mark absent
   entries `missingFromSource`, preserve their catalog and feedback, clear that
   flag on verified reappearance. Do not run missing detection on a partial or
   failed capture. Source cannot create/clear/edit local reviews.
   If the prior snapshot exists but cannot be unsealed/read, stop; do not
   pretend it is a first import. A genuinely empty approved container is a
   separate case. Test seal failure after reconciliation retains prior state.
9. Seal the **reconciled** result through the local-only custody contract, then
   transactionally save it with durable-success/snapshot generation. Do not
   merely validate a merge and store the connector's original sealed candidate.
10. Publish status/results after commit. Failed validation/seal/disk/commit leaves
    prior durable success unchanged, including null on first-sync failure.
    Preserve primary connector failure if failure recording also fails.
    Replays/restarts compare canonical semantics, excluding only declared
    observation/attempt freshness fields and ciphertext randomness—not private
    review values, revision or created/updated timestamps.
    `last_success_at` is service durable-commit time (zone-qualified), not
    connector `observedAt`; persist source observation separately. Backward
    wall-clock movement never reverses generation/revision ordering.

Scheduling remains approved startup/manual/15-minute attempts, no exponential
backoff/auth retries or cap increases. Fake-clock tests explicitly distinguish
a later scheduled attempt from a retry. Any terminal latch/schedule change is
a CP-01 policy decision, not an incidental bug fix.

## 7. UI implementation and owner-feedback acceptance

### Mobile-first information architecture

Geordi owns an approved navigation/column inventory with Wesley and Captain
review. Primary **Library** and book-level feedback workflows come first.
**Data/Connection** is discoverable user lifecycle control (sync, export,
disconnect, local deletion), not hidden as a developer feature. Feasibility and
structural evidence belong last in a diagnostic/utility group.

A flexible neutral gray LCARS segment separates primary and utility rail
groups. It is decorative, `aria-hidden`, unfocusable, contains no status/action,
and uses available space only. At narrow widths/zoom, collapse the filler rather
than reorder or clip navigation. DOM, visual and keyboard order agree; active
state and accessible name remain adjacent.
Maintain visually separated, labeled primary, user-lifecycle and diagnostic
groups in the narrow layout (grouped navigation list/landmarks with unique
accessible names); hiding filler must not flatten them into one list. Do not
invent a drawer without CP-05 focus/escape/return design and Captain approval.

| Column / compact field | Listener task and approved behavior |
| --- | --- |
| Title + primary action | Identify/open/edit the book; always available, wraps without hiding action |
| Listening state/progress | Decide what to continue; explicit Unknown/removed-source state, exact units and text alternative; never color-only |
| Private feedback indicator | See rated/unrated, values and has-note; comment text appears ONLY in the explicitly opened book editor (inline or detail). No hover, long-press, tooltip or expanded-row preview outside it |
| Author/narrator | Identify contributors; accessible facets with deterministic multiple membership; compact metadata/disclosure on mobile |
| Series/sequence when supported | Navigate available series; disclose first-series limitation, no invented prerequisite order; reflow or disclosure |
| Optional duration/acquired dates | Retain only after Captain task/semantics audit; unsupported history/completion dates labeled/disabled, not inert misleading sorts |
| Source/provenance/internal ID/raw sync fields | Remove from repeated book rows/cards. Show necessary connection/source transparency once in Data/Connection without account secrets |

This is a proposed task matrix, not approved final column ordering. Lower-priority
metadata can move behind accessible disclosure, but title, state, primary action,
feedback access and active-filter context may not disappear. Desktop can use
proper table semantics; mobile uses compact list/card semantics rather than
requiring horizontal table scrolling.
WP038's audit must enumerate the currently active `lastListenedAt`,
`completedAt`, `acquiredAt` and `durationMinutes` sort options, with evidence
for each retained field. History/completion cannot be inferred from acquisition
or progress: hide/disable unsupported sorts with truthful explanation and reject
stale state. Captain chooses task/order; absence of approval cannot mean retain
misleading baseline options.

### Feedback, grouping and state

- Reuse one editor in detail and inline grouped items. Native labeled radio
  groups expose five whole-star choices for independent
  overall/story/performance fields; Clear restores Unrated. The storage
  contract retains legacy half-star compatibility without silently rounding.
  Preserve private comment/tag limits and explicit **Save**.
  Draft, saving, saved, field error, storage failure and stale conflict are
  separate states; only durable acknowledgement announces “Saved.”
- Create/edit/clear/delete completes without leaving grouped results. Book IDs
  select book targets; canonical Author, Narrator, and Series IDs select
  distinct group targets from their headings. Use **one active editor in the DOM
  and one active feedback draft across the library/detail session**. When the same
  book appears in multiple groups, another edit action focuses/reveals the
  existing editor; it never instantiates a second form. Switching books/routes
  requires explicit Save/Discard/Cancel; failed save preserves the active draft.
  Expanding/collapsing or filtering cannot discard it or strand focus. Test
  two simultaneous group memberships, collapse-all and save-result removal.
  Immediately disable duplicate Save submissions and expose accessible
  “Saving”/busy state; no success until commit. Motion is optional and obeys
  reduced-motion; a pulsing effect is not required evidence.
- Proposed grouping: each distinct canonical contributor/facet membership gets
  the book once; explicit Unknown only for supported missing facets, never an
  empty heading. Unique library total and per-group membership counts are
  labeled separately so duplicate memberships do not inflate the library total.
  Document stable group ordering (normalized label + canonical ID tie-break)
  separately from selected within-group book sort/direction; book ID breaks ties.
  Label the control “Sort books within groups by …”; describe group order
  separately. WP037 discloses the current first-series limitation without
  reopening deferred A032 multi-series storage.
- Headings are button/disclosure controls with counts and expanded state.
  Expand all/Collapse all appear when multiple groups exist; collapsed content
  is absent from the accessibility tree and tab sequence. Collapsing a group
  with an active draft prompts or preserves it in memory with a visible unsaved
  indicator; never silently loses it.
- Current OF-008 behavior supersedes the original memory-only filter design:
  bounded, validated query/status/tag/rating filters, sort/direction, grouping
  and collapsed keys use versioned tab-scoped session storage. The preference
  key is not an account identity or encryption boundary. Drafts, editor
  identity, scroll and return focus are never serialized. No search/comment/tag
  value enters hashes, URLs, logs, localStorage or hosted services.
  Opaque book/facet navigation IDs are validated separately.
- Save and refresh update counts/matches deterministically without clearing
  controls. If a saved book no longer matches its active filter, announce the
  change once and place focus on a sensible retained control; do not strand
  focus in a removed DOM node. Revision conflict preserves the unsaved draft,
  shows the committed version and offers explicit reload/reapply/cancel.
- Navigation/account/mode change and app close get unsaved-change safeguards
  where the browser supports them. Drafts are in-memory only; filters follow
  tab/session storage and browser restoration behavior, not a guaranteed purge.
  No crash-proof draft promise without encrypted draft design.
  Reset explicitly restores documented defaults, independent of option order.
- Null rating sorts last in either direction; filters support rated/unrated,
  has-comment, local tags and each dimension. Explicit author/narrator/known-
  series group editors are now implemented; genre and inferred preferences remain
  deferred. Display grouping does not rewrite canonical source identities.

### Owner-feedback closure matrix

| Feedback | Implementation action | Required evidence / package |
| --- | --- | --- |
| OF-001 | Inventory title/nav/banners/headings/help/lifecycle/loading/error/export copy by data mode. Active private library is live/retained private source; synthetic trace is bundled fixtures only. No hidden live→synthetic fallback | Mode-by-mode DOM/rendered copy audit and private-snapshot canary excluded from trace; WP035 |
| OF-002 | Trace already requested categories/category ladders to deterministic useful genre values. Default Genre hidden until approved fixtures **and gated sanitized live-field attestation** prove automatic population. If unavailable, remove Genre from cards/detail/search hints/filters/sorts/groups; optional schema may remain | Fixture mapping plus post-G2 attestation, or exhaustive absence DOM/rendered assertions. No new endpoint, heuristics, LLM or manual genre editor; WP037 |
| OF-003 | Captain-approved useful-column audit above; relocate system metadata once to Data/Connection | Desktop/narrow/zoom and keyboard/AT matrix proving every retained field's task, semantics and responsive behavior; WP034,WP038 |
| OF-004 | Collapsible groups, all-actions, inline book feedback and preserved drafts/context | Group/inline create/edit/clear/delete success/failure/conflict journey, correct book-key persistence and retained collapse/focus state; WP033,WP037,WP038 |
| OF-005 | Primary navigation first, diagnostics last, decorative neutral gray flexible filler; lifecycle discoverable | Approved inventory, DOM/visual/tab order at desktop/320/zoom, active/focus states and filler exclusion from AT; WP034,WP035 |
| OF-006 | iPhone Air Safari portrait primary, landscape supported; compact disclosure, keyboard/safe-area handling, ≥44×44 CSS px primary controls | Authoritative/measured CSS viewport, DPR, chrome/insets record before breakpoint freeze; real device or approved equivalent synthetic journeys plus touch/AT evidence; WP033,WP034,WP038 |
| OF-007 | Preserve native intent in S014 and evaluate existing G4 comparison after G3; portable contracts/export evidence only | ADR with source/rights constraints, unknowns/reversal triggers and no connector-portability claim; WP014,WP042. Native/camera/handoff remain future |

Genre's fallback removal satisfies OF-002 without needing unauthorized live
research before W5. If later approved source proof supports retention, rerun
S037/S038/S039 affected evidence before G5; it does not add a wave or story.
Before removal Data records/discriminates candidate causes: requested response
group/field mismatch, category-ladder shape and UI projection. No unapproved
request expansion to investigate. If evidence is unavailable, hide by default.
Removal covers `row.genres` query matching, search examples, restored grouping/
sort/filter state and direct unsupported option injection: no silent dead path.
The optional schema field may remain inert.

Any post-G2 live-field attestation is schema-constrained **before collection**:
approved field names/paths, presence/absence, and a closed qualitative coverage
band (unavailable/insufficient/sufficient) only. No titles, ASINs, field values,
per-value counts, library-size/composition figures or personal paths. Synthetic
fixtures can demonstrate LitRPG/Business; raw live evidence stays in approved
encrypted custody, never a “redacted” sample in the repository.

For OF-006, record CSS pixels, not guessed physical-display breakpoints. Use
safe-area-aware padding, appropriate dynamic viewport units and keyboard-open
dialog/editor behavior. Keep 320 CSS px, 200% zoom, desktop, landscape, reduced
motion and no-hover coverage. WCAG 2.2 AA minimum targets are ≥24×24 CSS px
or valid spacing; primary touch controls use ≥44×44 CSS px.
Primary includes nav destinations; search/filter/select/checkbox/reset controls;
group and Expand/Collapse-all controls; book detail/edit/disclosure actions;
half-star choices, clear, tags actions, Save/Cancel/delete/conflict actions;
and connect/sync/export/disconnect/delete-local/confirmation dialog actions.
Measure each rendered hit area, not just icon glyphs. WP034 adds a distinct
`--lcars-min-target-primary` with minimum 44 CSS px (a 2.75rem equivalent only
if computed size stays >=44px); baseline `--lcars-min-target: 2.5rem` is 40px
at 16px root and cannot be counted as passing. Other non-primary targets
still meet WCAG 2.5.8; this does not mislabel WCAG AA as a universal 44px rule.

Use `viewport-fit=cover` with measured `safe-area-inset-top/right/bottom/left`
handling on applicable hardware. With keyboard open, keep focused fields and
Save/Cancel reachable in a single scroll axis: mobile action area stays within
the **visible** viewport, with scroll padding/margins derived from measured
action-bar/keyboard/safe-area obstruction, not a magic 80px constant.
Dynamic viewport units alone are not keyboard evidence; test actual browser
chrome/visual viewport behavior. Sticky actions must not obscure fields/errors.
Include WCAG 1.4.12 combined text-spacing overrides, forced-colors active/focus
visibility and `:focus-visible` parity with hover affordances.

Synthetic-only device evidence needs a reviewed isolated static/stub arrangement
with no private connector, account data or shipping artifact. No LAN exposure,
tunnel, public host, TestFlight upload or private-service phone connection is
authorized. If no approved real/equivalent iPhone Air evidence environment is
available, OF-006 remains HOLD; desktop emulation is supplemental, not a waiver.
The approved candidate route is an isolated device/simulator-local static
fixture setup, not a phone connection to the Windows service. Its exact
acquisition/loading method and equivalence require CP-05 approval; no route
is claimed available today. Use a separate disposable fixture root containing
bundled invented data only, never the private-alpha flag, capability, credential,
connector or personal root. Manifest records fixture hash, local bind address
(or explicit no-listener mode), access path, isolation checks and teardown.
No local setup artifact may be conveyed without its applicable legal/security
clearance. Unavailable route/evidence blocks OF-006, A2-G5 and A2-G6.

One dispatcher routes each event once to the existing persistent polite/status
or assertive/alert region, never both. Normal saving/saved/sync uses polite;
urgent blocking failure uses assertive; inline/visible state is not a duplicate
live region. Test missing-book routes, dialog trap/Escape/return,
skip links/landmarks, non-obscured focus and safe text. Measure text contrast
4.5:1 (large 3:1) and non-text/focus 3:1 against **actual adjacent surfaces**.
A022 is an evidence hold, not grounds for a blanket black focus-ring patch.

Disconnect Audible, Delete local data and Delete this book's feedback are
separate actions/confirmation flows, not adjacent ambiguous alternatives in
one destructive dialog. Use distinct labels, grouping/spacing, consequences,
retained-data inventory and focus return, not color alone. Disconnect retains
readable local library/reviews/seed; local deletion does not silently disconnect.
Export has the same deliberate re-unlock/nonce strength without falsely calling
it deletion. Geordi/Worf approve these new surfaces with Captain at CP-04/05.

## 8. Verification matrix and control plan

All future tests before A2-G2 use invented fixtures, stub provider endpoints and
test-owned roots/processes. Never induce failures with personal data. Commands
below are future evidence instructions, **not executed by this documentation
task**. No scan, regex, unit test or test total substitutes for rendered/AT,
packet-level, legal or consent evidence.

Stable `A2-Txx` identifies a test family, not a replacement for original Worf
tests 1–15. Each implementation adds exact cases/results to the manifest.
U = unit, I = integration, A = adversarial/fault, R = actual rendered,
M = witnessed/manual evidence.

| Test ID / type | Detailed cases and assertions | Existing harness / planned extension | Packages / reviewer / gate |
| --- | --- | --- | --- |
| A2-T01 U/I/A | Every GET/POST/new review/export/confirmation route: absent/forged/stale capability; session cannot vend authority; missing Origin/fetch metadata, hostile Host, cross-port origin, invalid ports, unknown methods/content types and chunked oversize. No secret in URL/log/cache/storage. Restart invalidates session | `test/private-alpha-api.test.js`, `ui-server.test.js`; new auth matrix | WP015 / W / G2 |
| A2-T02 I/A/R | Confirmation expiry/replay/wrong action/session/book/account generation/revision; concurrent sync/save/delete/export; double-submit and lost response. Cancel/Escape returns focus and never triggers mutation | API/service tests plus rendered dialogs | WP015,WP029,WP033 / W,G / G2/G5 |
| A2-T03 U/I/A | Unsupported Node fails before SQLite import; minimum approved version/flags succeeds. Earlier-PATH/cwd fake helpers, unsafe root, reparse/symlink, ACL readback denial and hardening failure prevent DB open; only test-owned children invoked | `encrypted-snapshot-store.test.js`, `ui-server.test.js`, Python `test_custody.py`; runtime/preflight cases | WP016,WP019 / D,W / G2 |
| A2-T04 U/I/A/M | Reject HTTP/look-alike/suffix/credential-in-URL/unapproved host before browser launch/cookie setup; allowed provider origin/callback. Cancellation, timeout and context-creation failure clean owned descendants, not existing browsers; no credential/passkey/MFA/cookie observation | Python `test_service.py`, connector-process fault stub; reviewed browser-boundary evidence | WP017,WP020 / W,G / G2 |
| A2-T05 U/I/A | Python/JS scans positive and negative controls; exact status fields; malicious lowercase error codes, unknown exception text, multiple JSON replies, stdout/stderr overflow and timeouts collapse safely. No model/cover/font/provider egress from rendering or local sealing | `scan.test.js`, `adversarial.test.js`, Python RPC tests; stub containment | WP020,WP036 / W / G2 |
| A2-T06 U/I/R | 0,0.5,1,25,42.9,99.9,100 percent round trip; explicit fraction adapter only; strings/out-of-range/NaN/infinity/negative/missing unknown or reject. 1% displays 1%, not 100/completed; status separate | Python `test_normalize.py`, `test_service.py`; `live-snapshot.test.js`, `ui-format.test.js` and rendered progress | WP021 / D,Y / G3/G5 |
| A2-T07 U/I/A | Empty/short/reordered/overlapping/mutating pages; duplicates default STOP; missing terminal evidence; exactly 20 full pages and overflow; actual cumulative bytes (not re-serialized proxy)/time/cancel/cap abort. No page 21, partial success or retry | Python service page fixtures, `private-alpha-service.test.js` | WP022 / D,W,Y / G2 synthetic; G3 actual bounds |
| A2-T08 U/I/A | Malformed middle of three, required-ID failures, unknown fields, corrected capture; distinct contributors 50/51/60/100 cross both runtimes. Positional bounded diagnostics, no silent truncation or raw title/ID; prior complete state intact | Python normalizer/service, `model.test.js`, `live-snapshot.test.js`, adversarial fixtures | WP023 / D,W / G2/G3 |
| A2-T09 U/I/A | A→B removal retains catalog+entry+review; B replay/restart, reappearance and source metadata change preserve annotations; orphan people/facets/books and missing/bad/zone-free observedAt rejected; fixture clock never fills live time | `model.test.js`, `live-snapshot.test.js`, store/service integration | WP024 / D,W,Y / G3/G5 |
| A2-T10 U/I/A | Same person ID across author/narrator, equal-name different people, no-ID→ID, spelling changes, canonical aliases, book rekey, collisions/ambiguous merges; every reference/review either mapped explicitly or quarantined, none guessed/lost | `model.test.js`, Python normalization; new identity/migration golden fixtures | WP026,WP030 / D,W,Y / G2/G3 |
| A2-T11 I/A | Retained A + credential B + failed B rollback at startup/status/library/review/export/save/sync; deny exposure/writes, fixed mismatch. Normal A disconnect/read/reconnect preserves A; race changing generation rejected at commit | `private-alpha-service.test.js`, API/store tests | WP025 / D,W,G / G2/G3 |
| A2-T12 U/I/A/R | Startup throw records attempt; validation/seal/commit/recordFailure double fault never advances durable success; first failure retains null success. Fake clock confirms startup/manual/15-minute semantics; reload displays last attempt/success/error once | service/store and `ui-store.test.js`, rendered Data view | WP027,WP035 / D,W,G / G3/G5 |
| A2-T13 U/I/A | Null or half-stars independently; reject strings/zero/NaN/infinity and unknown fields. 3,999/4,000/4,001 code points, emoji/combining/control text; 19/20/21 tags and 39/40/41 points, duplicate normalization, exact/over 64 KiB encoded bodies; all rejection atomic | `validate.test.js`; new review domain/API fixtures shared with synthetic UI adapter | WP031,WP032 / D,W,G / G2 |
| A2-T14 I/A | Create/edit/clear/delete/recreate, comments-only/tags-only; concurrent tabs/CAS stale conflicts, ABA deletion generation, no-op/retry/lost response, immutable createdAt, clock reversal; DB lock/disk-full/seal failure/crash before and after commit. Only durable save acknowledged | new review-store tests and existing store/service harness | WP032 / D,W / G2/G5 |
| A2-T15 I/A/M | Encrypt all review text and approved sensitive metadata; scan test DB/journal/sidecars/temp/backup/log/stdout/browser storage for canaries. Local sealing has zero provider/model I/O. Wrong account/purpose/version/key and tampered envelope fail closed | Python custody, encrypted store tests and private synthetic containment/residue receipts | WP029,WP032 / W,D / G2 |
| A2-T16 U/I/A | Closed export: all catalog/entries/provenance/limits/reviews/removed books; no credentials/HMAC seed/internal auth identifiers/raw diagnostics. Export→validate→test restore equal semantics; unknown schema/references/injection/oversize rejected. Formula-like text inert JSON, no CSV execution path | `integration.test.js`, `ui-store.test.js`; new export schema fixtures | WP028 / D,W,G / G2/G5 |
| A2-T17 I/A/M | Exact legacy schema→empty reviews, explicit identity maps, repeated migration idempotent, unknown/newer schema no writes; kill test-owned process at each promotion point, crypto/disk/backup corruption, stale temp collision. Restore last valid encrypted generation; downgrade refuses | new migration fixtures in Node/Python existing runners | WP030 / D,W / G2/G5 |
| A2-T18 I/A/R/M | Distinct delete-feedback/local/disconnect; cancel/replay, unconfirmed deregistration preserves credentials; retention expiry, key lifecycle, interrupted cleanup and restart canary rescan. App-managed vs retained registration/user-export copies explicitly inventoried; no false complete deletion | custody/store/API tests and rendered lifecycle; disposable roots only | WP029 / W,D,G / G2/G5 |
| A2-T19 U/I/A/R | Live-mode canary never enters bundled trace; title/nav/banner/help/empty/error/export copy matches actual mode; 1 unknown/1,000 and zero rows never claim complete; stale book hash accessible recovery | `ui-store.test.js`, `ui-assets.test.js`, contract/adversarial tests plus rendered mode audit | WP035,WP036 / Y,W,G / G5; OF-001 |
| A2-T20 U/I/R | Genre deterministic category mapping or exhaustive UI removal, no inference; multi-contributor membership/counts, explicit Unknown where applicable, stable group and item order, null-last both directions; no source/internal columns in rows | `library.test.js`, `ui-store.test.js`; rendered/DOM queries | WP037,WP038 / D,G,Y / G5; OF-002/003/004 |
| A2-T21 I/R/M | Group expand/collapse/all, inline edit/clear/delete, same book in multiple groups, validation/save failure/conflict, active-filter removal, detail/back, refresh failure and explicit Reset; retain draft/context/focus; collapse removes tab/AT descendants; one save announcement | UI store plus actual DOM, keyboard and screen reader journeys | WP033,WP037,WP038 / G,D,W,Y / G5; OF-004 |
| A2-T22 R/M | Desktop/320 CSS px/200% zoom, all source/error/lifecycle/editor states, keyboard/no-hover/reduced-motion; actual adjacent-surface focus/text contrast, skip link/landmarks/dialog return, no clipped required content/two-axis scrolling. Primary nav first, utilities last, decorative filler hidden/unfocusable | Extend rendered evidence around `ui-reflow.test.js`, not regex-only assertions | WP034–035,WP038 / G / G2 lifecycle + G5; OF-003/005 |
| A2-T23 R/M | Approved iPhone Air/equivalent portrait+landscape: measured CSS viewport/DPR/chrome/insets, touch/VoiceOver, keyboard open search/group/comment/errors/save/dialogs; ≥44 CSS px primary controls, safe areas and reachable focus | Synthetic-only approved device setup; automated viewports supplemental | WP033–034,WP038 / G,W / G5; OF-006 |
| A2-T24 I/A/M | Hash/approved-index/lock tamper negative controls, direct/transitive licenses/vulnerabilities with dated tool versions, no install scripts/re-resolution or surprise dependencies; private shipping guards still deny packaging | `private-alpha-policy.test.js`, scans, setup fixture harness; future isolated reviewed audit | WP018,WP039 / W,D / G2/G5 |
| A2-T25 I/A/R | Fixed invented small/representative/near-cap datasets; repeated warm/cold load/query/group/edit, serialized RPC bytes, peak memory, seal/commit latency and p95 interaction. At/over bounds stop intact; no weakened ACL/byte guard for speed | Existing runners + bounded instrumentation; declared environment/sample count, paired analysis when claiming gains | WP034,WP039 / D,G,W / G2/G4/G5 |
| A2-T26 I/A/R/M | End-to-end synthetic create/edit/clear → sync/remove/reappear → restart → migration/export/restore → delete; three equal semantic digests at equivalent checkpoints, no lost local timestamps/revisions; account and fault matrix included | `integration.test.js` plus shared fixtures/component tests, final rendered workflow | WP039 / all officers / G2/G5 |
| A2-T27 M | Only after G2 and route approval: dated library/history/progress/non-owned catalog dispositions; consent, source units/completeness/limits, non-owned attestation, actual allowed/observed destinations and raw-destruction receipts. Unsupported route STOPPED, not PASS | Approved private evidence custody, sanitized process-only manifest | WP040–042 / D,W,Y,R / G3/G4 |

### Review verification extensions

These are mandatory extensions of existing runners, not executed receipts.
Data's proposed T28–T33 numbering is canonical here. Wesley's proposed T28/
T29/T30 mobile/draft/bootstrap IDs collide and are mapped instead to existing
T23/T21/T01+T22; no finding or test case is dropped.

| Family | Additional acceptance cases / artifact | Owner / packages / gate |
| --- | --- | --- |
| T01,T02 | Accessible full-entropy unlock and anti-phishing; throttling/ceiling/launcher-only recovery; foreign-origin negatives and extension residual; nonce just below 120s valid, at/above invalid, reissue invalidates old, one outstanding/action/resource, rotation/lock/account invalidation; export re-entry and replay parity | Worf/Geordi WP015,WP028–029,WP033; G2/G5, CP-02 |
| T03–05,T24 | Node/SQLite/driver/Edge provenance/change trigger, hashed binary-only no-deps/index negatives, no DB open on custody failure, closed events/error vocabulary and canary scans | Worf/Data WP016,WP018–020,WP036; G2 |
| T09,T12,T14–18 | Prior unseal failure and reconciled-seal failure retain last state; commit time distinct from source observation; explicit pragma/commit-kill; legacy unseal cross-purpose/account/version negatives; export parity, event exclusion and safe filename/errors; pre-decrypt unknown/newer schema refusal and singleton rebuild | Data/Worf WP024,WP027–032; G2/G5 |
| T20–23 | Genre stale state/query/placeholder absence or safe proof; actual sort audit, first-series disclosure; exclusive editor across duplicate memberships; comment-only-in-editor; grouped nav, distinct lifecycle; 44px computed targets; combined spacing, forced colors, focus; isolated keyboard-open device manifest/teardown | Geordi/Data/Wesley/Worf WP033–038; G5 (safety lifecycle at G2) |
| T25,T26 | Synthetic-only size/duration/spawn/stall metrics, never payload samples; aggregate bounds and cache invalidation; three semantic checkpoints defined below | Data WP024,WP028,WP032,WP034,WP038–039; G2/G5 |
| A2-T28 I/A | Identity-seed retained across disconnect/partial cleanup with keyed data/backup; full deletion recovery ordering, no reseed or orphan after restart | Worf/Data WP025,WP029,WP032; G2 |
| A2-T29 I/A/M | Versioned credential/identity/snapshot envelope re-seal; legacy/current binding; interrupted file+DB generation promotion/rollback, deregistration remains possible at every cut | Data/Worf WP030,WP032; G2/G5 |
| A2-T30 U/I | Release bump preserves migration root; absent/unknown root fails closed instead of creating empty store; initialization distinct | Data/Worf WP019,WP030; G2 |
| A2-T31 I/A | Invented near-cap bytes/item, Unicode/encoding overhead and ordered response/seal/RPC/store/export caps; documented maximum supported envelope; exact/over bounds stop without loss | Data/Worf WP022,WP024,WP028,WP031–032; G2 |
| A2-T32 I/A/R | Python spawns per sync/save, p95 save latency, maximum event-loop block; immediate accessible busy state; no custody relaxation to meet budget | Data/Geordi/Worf WP032–034,WP039; G2/G5 |
| A2-T33 U/A | Equal-name people/series/genres remain distinct, cross-role proven identity, no-ID arrival/rekey, ambiguous maps quarantine; edition versus work anchoring/export semantics | Data/Wesley WP026,WP028,WP037; G2/G3 |

CP-06 defines equivalent semantic checkpoints for T26: **after durable commit,
after restart, after export→validate→restore into an isolated same-account test
container**. No intentional edit between checkpoints. Include review values,
timestamps, revisions, removed records and identities; exclude only declared
freshness/ciphertext/portable-surrogate differences. Never compare pre-edit to
post-edit and expect equality.

Measure existing synthetic surfaces and headless contracts during S014's
CP-06 preparation; freeze budgets **before optimization code**, not after W4
results are known. W4 records the changed-layout cohort using the same tasks/
fixtures/environment and reports structural differences; use within-cohort
paired samples for speed claims, not a false old-table/new-card equivalence.
Record sample count and repeatability; no invented measured numbers.
Fixture subdirectories are data, not auto-discovered tests: add explicit
`test/*.test.js` and Python test modules through existing entry points.

### Original security-test crosswalk (criteria are not replaced)

| Original tests | Required 0.0.2 evidence families / disposition |
| --- | --- |
| 1–2 egress / no AI | T05,T15,T24; synthetic containment at G2; actual destinations T27 only after permission |
| 3 credential boundary/dependencies | T03–05,T24; Worf's explicit amended-browser disposition, no blanket pass for Playwright or provider-page wording |
| 4 traversal/archive containment | T03,T08; execute Windows symlink test in capable isolated environment. Archive-specific N/A only by Worf with reason; no import-route revival |
| 5–6 ATR-ADV-1 renderer/normalizer | T05,T08,T13,T16,T19–23 through final components, not only unit validators |
| 7 category-only diagnostics | T01,T05,T08,T12,T19; output allowlists plus hostile canaries |
| 8 custody and staged-scan fail-closed | T03,T15,T24; invented secret/canary negative controls outside real git history |
| 9 key/retention/deletion/restart | T15,T17,T18, documented residual limits and actual approved key-lifecycle proof |
| 10 export/reload contract | T16,T26; no personal-source import approval |
| 11 cancel/denied/malformed/timeout/focus | T02,T04,T12,T18,T21–23; no alternate credential path |
| 12 supply chain | T24; pinned minimal hashes/licenses/audit and shipping controls |
| 13 caps/account isolation | T07,T11 plus authorized actual limits/binding T27 |
| 14 raw destruction receipt | T27, private evidence custody and process-only sanitized receipt |
| 15 observed destinations | T27 packet-level evidence after G2, not a scanner inference |

Future safe test entry points, after approved sandbox/root preflight:
`npm test`, `npm run connector:test`, `npm run policy:check` from
`code/Alpha0.x`. The Python test command requires an approved existing test
interpreter; it does not authorize setup/install. Inspect scripts before running
and ensure no fallback to personal roots. Do not use `private-alpha`, demo live
mode, connector setup or packaging commands to obtain documentation evidence.
Rendered/AT tests require recorded tool/device versions and approval for any
test dependency; no second runner or unreviewed install.

Install controls with each fix: cross-runtime golden schema fixtures, route
inventory assertions, schema/authority/revision tests, no-egress/diagnostic
canaries, migration/backup checks, private packaging-policy tests and approved
performance budgets. S039 assembles evidence; it does not defer earlier tests.
On any regression: block promotion/release, keep the last valid state, reproduce
with fixtures, record new finding ID if needed, repair and re-review.

## 9. Migration, rollback and recovery runbook

This is a **future explicitly authorized operation**, not startup behavior for
the owner's current instance. No new storage root or automatic migration is
created by planning.

1. **Readiness:** CP-03/04 approved; S028 export and S029 deletion/backup inventory
   proven; migration tested on invented legacy fixtures under S030. Record source
   and target schema, approved runtime, tool/config hashes and rollback policy.
   Personal execution additionally needs A2-G2, specific consent/action approval
   and user-controlled quiescence. Never stop the owner app on our initiative.
2. **Preflight:** reject wrong account/marketplace/root/ACL, unavailable keys,
   unknown/newer schema, outstanding unresolved identity ambiguity, insufficient
   disk/backup capability or active writer. Acquire an exclusive migration/
   lifecycle lock. No legacy binary concurrently opens the store.
3. **Recovery checkpoint:** create an approved encrypted, same-custody backup of
   the last consistent store and necessary local key/schema manifest; test its
   readability/semantic digest before proceeding. No raw plaintext copy, new
   cloud backup or unbounded duplicate retention. Registration credentials are
   not exported or casually duplicated with application data.
4. **Transform in staging:** validate known legacy schema; preserve account and
   catalog/entries, apply explicit alias maps, create empty review store and
   revision state. Existing fixture sentinels are not real reviews. If any
   mapping is ambiguous/colliding, abort or quarantine per approved policy;
   never choose a title/name match.
   Consume S031's frozen schema revision. Rebuild singleton tables as
   create-new/copy/verify/swap, adding account/generation and pre-decrypt schema
   metadata in the same DB transaction. Stage any required credential/identity/
   snapshot re-seal with a recoverable cross-file generation manifest; do not
   claim SQLite alone makes file promotion atomic. Keep legacy decrypt
   parameters immutable and last-readable registration credentials until
   rollback/deregistration is proven at every interruption point.
5. **Verify and promote:** validate target references/envelopes/export contract,
   compare declared semantic digests, seal target data, and commit schema/data/
   migration marker atomically. Crash recovery accepts only a fully verified
   committed generation; partial staging never becomes current.
6. **Restart check:** reopened target validates key/account/schema and unchanged
   source/local semantics; explicit status and available export/delete verified.
   Writes remain disabled until the target generation is accepted. Repeating an
   already applied migration is a no-op, not a second ID remap.
7. **Failure/rollback:** before promotion discard only app-owned failed staging
   under retention policy and reopen last good encrypted generation. After
   promotion, restore only an explicitly selected verified compatible backup.
   Never silently downgrade, truncate newer fields or revert acknowledged
   feedback. If post-upgrade reviews exist, preserve the newer encrypted store
   and require a reviewed lossless transfer/restore decision; old binary refuses.
8. **Cleanup:** expire/remove migration backups and temporary material under
   approved retention, including sidecars and key copies. Record sanitized
   receipt and restart/canary scan. Failed cleanup remains visible and recoverable;
   deletion success cannot precede full approved inventory disposition.

### Export/delete recovery distinctions

- Export uses a consistent snapshot/review generation with a closed versioned
  schema, portable surrogate account/book references and correct source/runtime
  label. It omits internal account HMAC/seed, credentials, local paths and raw
  diagnostics. Test restore binds exported surrogates to the explicitly chosen
  same-account test container; export cannot assert provider account authority.
- User-initiated plaintext JSON download is disclosed as private, user-held data.
  Require fresh re-entered capability/confirmation and rate limit first.
  Disclose cloud-sync/Known-Folder redirection and backup capture explicitly.
  App deletion cannot erase downloads, external backups or provider records;
  JSON is data-only, but external viewers are not guaranteed safe.
  Test export→restore is a recovery contract, not a new personal source-import
  feature or native migration grant.
- Delete feedback removes content but retains minimal anti-replay generation
  until full local deletion. Delete local data includes reviews, snapshots,
  sync/identity-map/derived state and managed backups according to the approved
  inventory; any minimal live registration identity/key retention is explicitly
  explained and separately cleared by confirmed disconnect/cleanup.
- Disconnect deregisters only on explicit confirmation and retains local data.
  Failed provider confirmation retains credential custody for recovery/manual
  Amazon removal guidance. Cleanup failures never trigger reconnect/register
  loops or erase credentials needed to close registration.
  Retain the identity seed while any retained account-keyed local data/backup
  requires it, even when registration is gone; “disconnect” must not orphan
  feedback. Full deletion observes the recoverable retention-unit invariant.
- Permanent lifecycle completion requires every retained category to be
  discharged or explicitly identified as external/unerasable residual. Do not
  show “all data deleted” while app-managed review backups or keys remain.

### Required incident and revocation artifact

S014 authors `evidence/incident-revocation-runbook.md` as a **discrete future
artifact** owned by Worf, linked from the security pack and checked by S042.
It is not created or executed by this planning task. CP-02/04 approval and
synthetic tabletop/fault evidence are mandatory at G2; recheck final revision
at G5. Cover:

1. Suspected local compromise, capability leak and connector/dependency
   compromise; local closed event categories as indicators, no sensitive logs.
2. Owner-authorized containment/lock/rotation and trusted-tool verification;
   distinguish service stop from provider Disconnect. No silent re-registration.
3. Provider-side device removal and separately approved reauthorization, with
   truthful “Audible for iPhone” label; no collection of provider credentials.
4. Credential/key/seed destruction ordering: retain material needed to close
   a registration, recover uncertainty and preserve keyed local data.
5. Evidence preservation only in approved encrypted custody; process-only
   public receipts, bounded retention and cleanup. No raw capture by default.
6. Named owner/escalation, consent/authority checks, verified recovery criteria
   and Worf reapproval before resuming the affected activity.

Test simulated leak/failed deregistration/interrupted cleanup with invented
data under T01/T03/T15/T18/T29. No instruction here alters today's app.

## 10. Execution waves, parallelism and integration checkpoints

Preserve the existing graph and wave totals. Within dependency-ready work,
dispatch by the WSJF table. W0 records OF-007 intent; W7 evaluates native
direction only after source proof. No native wave is added.

| Wave | Packages / story order constraints | Points | Integration checkpoint / exit |
| --- | --- | --- | --- |
| W0 | WP014 | 3 | IC-0: CP decisions/spec reconciliation, A2-G0 and Captain new-surface approval recorded; plan publication alone does not pass |
| W1 | WP019/WP036/WP018 when ready; WP015/WP016 after WP019; WP017 after WP016; WP020 after WP016+WP018 | 23 | IC-1: synthetic API/executable/custody/dependency/diagnostic boundary reviewed before new private mutations |
| W2 | WP021+WP023→WP022; WP026; WP024 after WP022+WP026; WP025 after WP015+WP016; WP027 after WP024+WP025 | 26 | IC-2: account-safe complete-or-stop reconciled durable path; golden identity/progress and restart digests |
| W3 | WP031 after WP026; WP028/WP029 after their canonical dependencies; WP030 after WP024+WP026+WP028+WP029; WP032 last | 23 | IC-3: one agreed schema/inventory across export/delete/migration; fault proof before encrypted feedback write enablement |
| W4 | WP034 first; WP035 after WP027+WP034; WP037 after WP026+WP034+WP032; WP033 after WP032+WP034+WP035; WP038 after WP033+WP037 | 19 | IC-4: complete synthetic user journey, owner-feedback dispositions, mobile/rendered/AT and measured budget evidence |
| W5 | WP039 after all canonical prerequisites | 5 | IC-5: assembled synthetic tests/receipts; Worf A2-G2 approval before real activity |
| W6 | WP040/WP041 documentation research can start after W0; live proof only after W5, A2-G2 and route-specific Captain approval | 6 | IC-6: four-domain G3 evidence or explicit STOPPED/HOLD; no inferred gate pass |
| W7 | WP042 then WP043 decision preparation; completion requires Captain decision | 7 | IC-7: G3→G4 ADR→full officer G5→Captain G6; exact audience/legal disposition, no automatic shipping |
| **Total** | **30 packages / 30 stories, counted once** | **112** | **Not a one-PI commitment** |

Safe parallel work:

- Worf's boundary implementations and Data's approved synthetic unit/page/identity
  work can proceed independently; serialize ownership of `service.py`,
  `private-alpha-service.js`, `serve.js` and shared validators.
- Geordi/Wesley may prepare and review invented wireframes during W1/W2.
  Mandatory S034 accessibility and dependency-ready S035 labeling can overlap
  W2/W3; elective polish cannot displace security/data blockers.
- S031 contract work follows S026 and can be designed alongside remaining
  integrity work, but S028/029/032 still wait for their full prerequisites.
  S028 export and S029 deletion can run in parallel with one shared approved
  inventory owner; Data coordinates store changes and Worf owns lifecycle policy.
- S040/S041 public-document research can proceed independently after W0;
  external research sends no repository code/private data. Authenticated calls,
  personal captures or new endpoints are never parallel shortcuts around G2.
- S039 test integration starts as each package lands; its final acceptance still
  waits for canonical dependencies and the complete evidence matrix.

Before each merge/integration checkpoint, the owner presents tests, surface
diff, schema/API compatibility and sanitized finding closure; relevant officers
re-review. No downstream story DONE until its dependencies meet DoD.
Limit WIP to one implementation story per component owner plus one bounded
review. Velocity is unknown: reserve **20% of measured PI capacity** and commit
only dependency-ready work within the remaining 80%; no point-to-time conversion.

## 11. Risks, owners and escalation

Use the existing [A2 FMEA](05-risks-and-release-gates.md#fmea-and-risk-register)
as the canonical risk register. Scores below are unchanged planning estimates;
none is an accepted residual or a measured probability.

| Risk / initial S×O×D = RPN | Main controls/packages | Owner / blocking review and escalation |
| --- | --- | --- |
| A2-R01 API exposure, 9×7×6=378 | WP015; CP-02 bootstrap and T01/T02 | Worf; stop reads/writes pending boundary proof |
| A2-R02 Executable/custody compromise, 9×5×6=270 | WP016–020; trusted roots, origin, hashes, RPC guards | Worf/Data; no credential-boundary use on failure |
| A2-R03 Incorrect/incomplete source, 8×7×5=280 | WP021–024; units/complete-or-stop/reference tests | Data; Worf/Wesley review, preserve prior snapshot |
| A2-R04 Identity/account annotation loss, 9×6×6=324 | WP024–026,WP030,WP032; CAS/account/alias mapping | Data; Worf review, quarantine ambiguity |
| A2-R05 Incomplete export/delete, 9×6×7=378 | WP028–030; key/backup inventory, residues and copy disclosure | Worf; Data/Geordi concurrence, block feedback collection |
| A2-R06 False save/migration success, 8×5×6=240 | WP030–033; commit-before-ack and recovery | Data; Worf/Geordi review, preserve draft/prior generation |
| A2-R07 Inaccessible LCARS, 7×6×5=210 | WP033–038; actual contrast/keyboard/mobile/AT | Geordi; missing approved iPhone evidence remains HOLD |
| A2-R08 Private trace/diagnostic egress, 9×5×6=270 | WP020,WP032,WP035–036; separated fixtures/canaries | Worf/Wesley; stop evidence sharing on failure |
| A2-R09 Rights/history/catalog missing, 9×8×4=288 | WP040–041; official-first research, legal route proof | Data/Wesley; Captain + legal + Worf; STOPPED does not clear G3 |
| A2-R10 Unsupported clearance/conveyance, 10×5×7=350 | WP042–043; exact approvals, packaging guard | Riker/Worf; no audience expansion without legal/Captain decision |
| A2-R11 Unmeasured unsafe optimization, 6×5×5=150 | WP034,WP039; repeated baseline/approved budgets | Data; Worf hardening and Geordi interaction review |

Bootstrap usability, key lifecycle choice, Genre evidence and iPhone evidence
environment are open design dependencies, not additional scoped features.
If resolving them exceeds a story's relative size, Riker proposes explicit
change control/splitting and reconciles the inventory before implementation;
do not hide effort in “polish.” No such rebaseline is made here.

A2-G2 requires applicable safety residuals below 100 after executed controls.
A2-G5 requires all applicable residuals below 100 and zero security/accessibility
blockers regardless of score. Legal/permission gaps cannot be accepted
numerically. Future native risks remain in document 07, outside the 112 points.

## 12. Release evidence, definition of done and deferrals

### Required artifact set

Future sanitized artifacts live under `planning/0.0.2/evidence/` with stable
manifest references (proposed directory, not created here). Record only
invented fixtures or process-only attestations; raw private evidence/consent/
captures remain in approved encrypted custody outside repo/cloud sync.

| Artifact | Required content / owner |
| --- | --- |
| Decision/spec register | CP IDs, specification revisions, approvals, exceptions and reasons; Riker |
| Finding/story/test manifest | A2-WP/S/A/OF/test IDs, criterion, fixture/code/tool/runtime revision, exact command, result/denominator, evidence type, reviewer/date, gate disposition; Riker |
| Source/identity contract pack | Unit authority, limits/completeness, canonical alias maps, unknowns/history/catalog dispositions and permitted route fingerprints; Data/Wesley |
| Schema/API/lifecycle pack | Closed schema contracts, encrypted inventory, auth/confirmation flow, export round trips, migrations/rollback/downgrade/residue receipts; Data/Worf |
| Security/supply-chain pack | Original tests 1–15 dispositions, adversarial controls, runtime/driver/Edge/hash/index/license/audit receipts, egress evidence, bounded event schema and discrete incident-revocation runbook with tabletop result; Worf |
| UI/owner-feedback pack | Mode-copy/column/nav/Genre decision matrices, invented rendered captures, exact iPhone evidence environment and keyboard/AT/focus/touch results; Geordi/Wesley |
| Performance/architecture pack | Fixed fixtures/environment/sample counts, baseline and approved budgets, paired results where claimed; source-led native comparison/ADR with limitations and reversal triggers; Data |
| Final release packet | Changelog, exact build/schema versions, all four final reviews, residual FMEA, current story/finding status, legal/audience restrictions and Captain PASS/HOLD/FAIL; Riker |

Do not invent future hashes, sign-offs, participant counts or gate dates.
Archive historical reports unchanged; closure receipts reference them.

### Definition of done

For a package: approved reconciled design; canonical acceptance criteria met;
bounded implementation and all corresponding negative tests; relevant officer
re-review; no unresolved package blocker; compatibility/lifecycle documentation
updated; sanitized evidence linked. Synthetic code DONE is not live permission.

For release readiness:

- All mandatory 30 A-IDs plus A012 closed by evidence; every other inherited
  finding has its unchanged or explicitly approved disposition. All selected
  stories accepted, or Captain rebaseline recorded across the canonical docs.
- Feedback survives account-safe sync, removal/reappearance, rekey, restart,
  export/restore and migration; no plaintext application storage/egress, lost
  acknowledged edit, false save or false full-sync success.
- Original tests 1–15 executed on applicable final surfaces or specifically
  reasoned Worf N/A; skips/missing device evidence are HOLD, not pass.
- OF-001–006 proved through automated AND required rendered/manual evidence;
  OF-007 direction preserved with the existing source-led architecture decision.
- A2-G0–G5 have dated approvals and applicable residual risks below 100.
  Missing history/non-owned proof leaves G3/G4 blocked even if feedback works.
- Full final Data/Worf/Geordi/Wesley review, accurate version/schema/setup/copy,
  migration recovery and documented remaining limitations; Captain alone makes
  A2-G6 PASS/HOLD/FAIL for an exact build/audience. No legacy patch auto-approval.
- Named legal/licensing approval is required before any conveyance, including
  private source. Owner plus at most ten named testers is only a ceiling.
  Public/commercial/cloud/store/package/installer/binary distribution stays
  **NO-GO**; this plan does not authorize a release command.

### Explicit deferred/future capabilities

No recommender, ranking, recommendation feedback, LLM/provider selection,
sentiment/embeddings/inferred affinities, facet rating editor, source mutation,
favorites/abandoned/listen-again editor, cross-device sync, new marketplace,
automatic retry/backoff, remote assets or personal-export replacement route.
Keep a useful non-LLM private library/feedback experience; do not label it the
broader recommendation MVP.

Native Swift client implementation, SwiftUI/UIKit choice, iOS minimum/device
support, Keychain/Data Protection details, native encrypted storage, opportunistic
background refresh, native VoiceOver/Dynamic Type/Switch Control and future
Windows→iOS migration need a separately reviewed native plan. Safari evidence is
not native accessibility proof, CSS px are not iOS points, and the provider
device label “Audible for iPhone” is not connector portability evidence.

[NAT-F01 camera/barcode ingestion and NAT-F02 Audible handoff](07-native-iphone-direction.md#future-backlog)
remain uncommitted future candidates with their separate **11 indicative
points**, excluded from 112. Camera requires native custody/lifecycle, explicit
permission, metadata rights, edition/identity confirmation and manual fallback.
Handoff additionally requires an approved recommendation/catalog phase,
documented validated marketplace links, explicit user action and no purchase
automation/tracking. No camera/network permission, iOS bundle, TestFlight,
App Store or native experiment is granted here.

## 13. Planning change record and handoff

This document adds implementation decomposition and maps existing source to the
unchanged scope. Reconciliation changes no S/F IDs, points, dependencies, wave
totals, owner-feedback intent or archived verdict. A2-G0 is now explicitly
BLOCKED rather than PENDING; no gate passed. Reconciled schema/API choices
remain subject to dated CP approval; no scope inventory change is made.

The initial implementation-plan publication changed this file and README only.
The subsequent full review reconciliation updates documents 01–08, the release
index and [09 consensus](09-review-consensus.md), and adds a
[review index](reviews/README.md). Staged officer reports remain unchanged.
Validation is documentation-only and recorded in consensus; all documentation
is staged without committing. Reviewers must begin with CP-01–06 and IC-0,
not feedback API implementation.

Initial publication validation on 2026-09-17 used a standalone Node filesystem check:
43 Markdown files, 253 local link targets and 42 anchors resolved; 16 external
links were not contacted. All 30 package/story mappings, canonical WSJF
order/scores/priorities, 112-point sum and W0–W7 point totals matched the backlog.
These checks validate planning integrity only, not application behavior or
officer approval.
