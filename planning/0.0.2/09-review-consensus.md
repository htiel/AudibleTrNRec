# Alpha 0.0.2 full planning review consensus

**Historical planning-stage verdict:** preserved below. For subsequent
implementation evidence and owner-only conditional GO, see
[11 — implementation/release verdict](11-implementation-release-verdict.md).
Named/public release remains blocked; implementation acceptance is not
retroactive CP or source-feasibility approval.

**Date:** 2026-09-17

**Reconciliation owner:** Commander William Riker

**Verdict:** **HOLD — corrections incorporated; design approval and execution
clearance remain blocked.** No officer sign-off is invented by this consensus.

## Authority and evidence

This is documentation reconciliation of [APP_DESCRIPTION](../../APP_DESCRIPTION.md),
documents [01](01-release-charter.md), [02](02-scope.md), [03](03-backlog.md),
[04](04-sequencing.md), [05](05-risks-and-release-gates.md),
[06](06-owner-feedback.md), [07](07-native-iphone-direction.md) and
[08](08-implementation-plan.md), with all four full staged reports:
[Data](reviews/data-review.md), [Geordi](reviews/geordi-review.md),
[Worf](reviews/worf-review.md), [Wesley](reviews/wesley-review.md).
The officers supplied bounded, read-only reconciliation of their full reports
and relevant archived evidence. Original reports are preserved, including
suggestions rejected below; their original line references describe the
pre-reconciliation baseline, not current line numbers.

Controlling inherited evidence: the [0.0.1 verdict](../archive/0.0.1/feedback-and-bugs/alpha-0.0.1-release-verdict.md),
[51-finding register](../archive/0.0.1/feedback-and-bugs/bug-register.md),
[security assessment](../archive/0.0.1/feedback-and-bugs/worf-security-review.md),
[security gates/tests 1–15](../archive/0.0.1/05-risks-and-release-gates.md),
and [connector change control](../archive/0.0.1/10-private-alpha-connector-change-control.md).
The archived HOLD/FAIL and rejected personal-export replacement route remain
in force. Existing owner use, a private connection and historical planning
approvals are not evidence that a release gate passed.

**Inventory preserved:** 4 themes, 8 epics, 30 features, 30 stories,
112 estimated points; 30 work-package aliases, unchanged direct dependencies,
WSJF scores and W0–W7 totals. T28–T33 add verification families, not stories.
Reserve 20% of measured capacity; no velocity/calendar commitment. If bootstrap
or migration design exceeds the existing slice, stop and explicitly split/
re-estimate before implementation rather than conceal work.

## Officer verdicts

| Officer | Submitted verdict | Reconciled disposition / remaining gate |
| --- | --- | --- |
| Data | CONDITIONAL APPROVE | DB identity/key/schema ownership blockers translated into CP-03/04 invariants; high/medium findings assigned. Dated CP concurrence, budgets and migration proof still required; not persistence/write clearance |
| Geordi | CONDITIONAL APPROVE | Announcement/target decisions specified; spacing, Genre, disclosure, sort audit and mobile evidence corrections incorporated. CP-05 designs, Captain column/new-surface approval and rendered/AT evidence still required |
| Worf | REQUIRE CHANGES | Eleven mandatory findings incorporated as requirements, not verified controls. A2-G0 concurrence withheld; interim A001/A002 risk acceptance, bootstrap/key/retention decisions and incident evidence remain open |
| Wesley | CONDITIONAL APPROVAL | Product/usability issues accepted with secure implementations; PIN/file shortcut and post-refactor budget-lock proposal rejected. Native/barcode/handoff remain future, not 0.0.2 work |
| Riker | HOLD | Planning reconciliation complete; proceed only with CP specification/decision work. No implementation READY, live experiment, tester conveyance or release authorization |

Worf's submitted series intentionally has C-1 then H-2/H-3/H-4, not a missing
H-1. Historical token-vending H-1 is already represented by A001/S015.
Review-local PASS/positive-control comments do not override REQUIRE CHANGES
or constitute runtime evidence.

## Reconciled findings and dispositions

**Reading the register:** “Accepted” means mandatory planning correction
incorporated, **not** defect closed. CP ratification/execution remains required.
WPnnn means A2-WPnnn / ATR-Snnn; Tnn means A2-Tnn. Canonical
[story addendum](03-backlog.md#review-correction-acceptance-addendum) and
[test extensions](08-implementation-plan.md#review-verification-extensions)
are binding acceptance requirements. Source prefixes D-/B/M/S/WES refer to
the named officer report, not interchangeable severity or finding IDs.

| Resolution | Exact source finding(s) / evidence | Decision and rationale | Owner / work / verification artifact |
| --- | --- | --- | --- |
| RC-01 | Worf C-1; archived A001/A002; `serve.js` unauthenticated session and custody/setup executable resolution | Accepted: dated interim owner-only operating agreement in charter/R01. Active-use-only, owner shutdown when idle, dedicated extension-free profile, no untrusted local tools. Explicit Captain acceptance of A001 AND A002 is not recorded; controls do not cure exploits. No instruction to stop today's app | Riker/Worf WP014–016; T01/T03; CP decision + incident pack |
| RC-02 | Worf H-2; WES-002-CRIT-01; 08 bootstrap forbids file/URL/log transfer and says STOP if delivery unproven | Accept usability/anti-phishing/abuse requirements; retain >=256 random bits. Compare transient display with file candidate and reject file under existing rule. Chunked accessible entry is a candidate, not proof. Reject six-digit/salted PIN as authority; no automatic injection/token vending fallback | Worf/Data/Geordi WP015; T01/T22; CP-02 delivery/threat/usability record, Captain new-surface decision |
| RC-03 | Worf H-3; archived browser-extension threat; in-memory capability alone | Accepted: extension/content-script threat and residual explicitly named. No global/attribute/postMessage/storage token; typed input is transient and cleared. Foreign-origin tests are not evidence against privileged extensions. Dedicated profile mitigates, does not eliminate same-user compromise | Worf WP015; T01; CP-02 threat/residual record |
| RC-04 | Worf H-4, L-5; 08 export required consent while disconnect/delete required fresh nonce | Accepted: export requires re-entered capability + fresh single-use action-bound nonce, rate limit, cloud/Known-Folder/backup disclosure. Inert versioned JSON; no external-viewer safety promise. Payload necessarily contains requested titles; only errors/headers/filename exclude titles and all exported internal auth/account secrets remain prohibited | Data/Worf/Geordi WP028 (+WP015); T02/T16; CP-04 export pack |
| RC-05 | Worf M-5; original “Exact expiry is approved at CP-02” unbounded | Accepted: fixed 120-second monotonic lifetime, invalid at >=120; one outstanding/action/resource; reissue/rotation/lock/account-generation invalidation and atomic consumption. Applies to export and destructive confirmation alike | Worf WP015,WP028–029,WP033; T02 boundary matrix |
| RC-06 | Worf M-1 / A045; Data D-H4; legacy `unseal_snapshot` not bound like new local methods | Accepted: direct user-DPAPI/Python RPC is reconciled design baseline, with purpose/account/version checks and restricted exact-legacy migration reader. Retire/rebind legacy normal dispatch. No crypto-erasure claim. New container key/Node-held AEAD is deferred pending measured need, security review and scope control; renewed A045 ratification remains required | Data/Worf WP029–032; T15/T29/T32; CP-03/04 crypto and deletion decision |
| RC-07 | Worf M-3; Data D-L3; setup hashing scoped to pip, system Edge `channel="msedge"` auto-updates | Accepted: Node/SQLite, Python dependencies, Playwright driver and actual Edge provenance; approved hashes/signatures/index/binary-only/no-deps install. Major Edge channel change triggers re-review, not a false pin. Align engine/flags/docs/connector-test interpreter | Worf/Data WP018–020; T03/T24; provenance/channel-residual pack |
| RC-08 | Worf M-2/M-6; Data D-L2; incident references lacked discrete artifact and diagnostics use separate vocabularies | Accepted: closed encrypted local security events, no IDs/text/paths, bounded proposed retention/cap pending approval, deletion inventory and export exclusion; harmonized closed error-code contract. Required Worf-owned incident/revocation runbook covers local/connector compromise, provider removal, no silent registration, key ordering, evidence custody and reapproval | Worf/Data/Riker WP014,WP029,WP036,WP042; T01/T03/T05/T15/T18/T29; discrete incident artifact + event schema |
| RC-09 | Worf M-7; Data D-H8; Geordi mobile positive-control comment; OF-006 requires device/equivalent evidence | Accept positive isolation specification, not just a ban: device/simulator-local bundled synthetic setup, disposable root, no private flag/capability/credentials/connector/personal root, bind/access/teardown manifest. Exact route/equivalence approval still open. Reject nonblocking mobile HOLD or LAN/tunnel workaround | Geordi/Worf/Data WP033–034,WP038; T23; CP-05 environment and OF-006 evidence |
| RC-10 | Geordi B1; existing polite/status + assertive/alert regions versus “single live region” in WP034 | Accepted: one dispatcher, two persistent urgency regions, one delivery per event. Routine save/sync polite; urgent blocking errors assertive. Visible status is not another live region. No duplicate announcements; preserve urgency semantics | Geordi WP034; T21/T22; CP-05 announcement matrix |
| RC-11 | Geordi B2/B3; `tokens.css --lcars-min-target: 2.5rem` is 40px at 16px root; OF-006 requests 44px primary | Accepted: enumerate nav, filters, group/book/editor/half-star/tag/save/cancel/lifecycle/dialog primary controls; add separate >=44 CSS px computed token and actual hit-area tests. WCAG 24px/spacing floor still applies elsewhere; do not claim 44px universally required by AA | Geordi WP033–034,WP038; T22/T23; target/token inventory |
| RC-12 | Geordi M1, S1–S3; missing WCAG 1.4.12, forced-colors/focus parity and explicit safe-area setup | Accepted: combined line/paragraph/letter/word spacing overrides; forced-colors active/focus, focus-visible hover parity; viewport-fit and four safe-area inset properties verified where applicable, not assumed from tokens | Geordi WP034; T22/T23; rendered spacing/focus/safe-area pack |
| RC-13 | Geordi M2; Data D-M6; Worf M-4; WES-002-MED-01; OF-002 and `row.genres`/genre placeholder/state paths | Accepted as one closure package with four distinct obligations: discriminate field/response-group/ladder/projection causes; prove permitted mapping or hide/remove; scrub search/hints/options/direct and restored stale state; define process-only attestation schema before live collection. No title/LLM inference or new route. Raw evidence stays encrypted | Data/Geordi/Wesley/Worf WP037 (+WP038/042); T20/T27/T33; Genre decision/cause/absence or mapping pack |
| RC-14 | Geordi M3; original “no full comment previews by default” ambiguous | Accepted: comment content ONLY inside deliberately opened inline/detail book editor. Rows show values/rated/unrated/has-note, no hover/long-press/tooltip preview. Touch/keyboard get same disclosure | Geordi WP033,WP038; T21–23; CP-05 disclosure design |
| RC-15 | WES-002-HIGH-02; same book can appear in several contributor groups; shared state does not preclude dual forms | Accepted: one active editor DOM instance and one active book draft across the library/detail session. Same-book edit focuses existing form; switching requires Save/Discard/Cancel; collapse/filter/remove/save failure preserves draft and valid focus. No second synchronized-form architecture | Geordi/Data WP033,WP037–038; T21; duplicate-membership/race evidence |
| RC-16 | WES-002-HIGH-01, LOW-02; OF-006 keyboard-open requirement | Accepted outcome: focused inputs/errors and Save/Cancel remain reachable in actual visible viewport, measured obstruction padding and action area. Reject treating fixed 80px margin/100dvh as universal proof. Immediate disabled duplicate Save + accessible busy text; reduced-motion honored, pulse optional | Geordi/Data WP032–034,WP038; T21/T23/T32; measured keyboard/busy-state pack |
| RC-17 | WES-002-HIGH-03; OF-005 primary-before-diagnostic rail semantics collapse on narrow layout | Accepted: maintain labeled/visually separated primary, lifecycle and diagnostic groups in DOM/visual/tab order at reflow; decorative filler can collapse, semantic groups cannot disappear | Geordi/Wesley WP034–035; T22/T23; nav inventory/reflow pack |
| RC-18 | WES-002-MED-03; compact disconnect/delete proximity | Accepted: separate actions and confirmation flows with clear consequences, spacing/grouping and focus return. Color is supplemental only. Disconnect retains local records/seed; local deletion is not implicit disconnect; feedback delete is distinct | Worf/Geordi/Data WP029,WP034; T02/T18/T22/T23; CP-04/05 lifecycle design |
| RC-19 | Data D-B1; `identity.bin` seed generates account keys while disconnect retains records | Accepted invariant: retain seed whenever dependent snapshot/review/tombstone/map/managed backup remains; never reseed to fix mismatch. Destroy only after dependent records and registration-recovery needs are discharged. External files require recoverable generation ordering, not fictitious SQLite atomicity | Data/Worf WP025,WP029,WP032; T28; CP-03 lifecycle inventory |
| RC-20 | Data D-B2; `custody.py` legacy entropy includes release string and envelopes span files/SQLite | Accepted: immutable legacy decrypt parameters, explicit envelope versions, WP030 owns required credential/identity/snapshot re-seal, generation manifest/rollback and deregistration at every cut. No automatic re-seal on release bump; broadened key redesign requires re-estimate | Data/Worf WP030,WP032; T17/T29; migration runbook |
| RC-21 | Data D-B3/D-M9; persisted review schema previously owned by S032 after export/delete/migration consumers; singleton STRICT tables | Accepted: S031 freezes persisted DDL/envelope/CAS/tombstone/sidecar/export revision first, consumers cite it, S032 implements. WP030 rebuilds singleton tables transactionally. Data reconciliation adds D-H9: current store has no pre-decrypt version marker; define marker/fingerprint refusal and authenticated inner-version cross-check. No new story/dependency edge | Data/Worf WP028–032; T13–17/T29; CP-03/04 frozen schema artifact |
| RC-22 | Data D-H1; root literal in Python custody and Node store is version-shaped `Alpha0.0.1` | Accepted: root is frozen migration input, not derived from version; explicit legacy-root preflight, absent/unknown migration root fails closed, separate first-time initialization | Data/Worf WP019,WP030; T30; migration/root contract |
| RC-23 | Data D-H2; Worf L-1; 20,000 items versus 25MB response/32MB seal/40MB RPC and only per-review bounds | Accepted: derive supported envelope with invented bytes/item/encoding overhead, ordering/stop codes; aggregate record/store/export/memory budgets including retained data/backups before writes. Missing budgets block CP-04/06; never silently truncate/evict feedback | Data/Worf WP022,WP024,WP028,WP031–032; T13/T16/T25/T31; sizing pack |
| RC-24 | Data D-H3/D-H4/D-H5/D-L1; Worf L-4; process spawn, synchronous store and whole-snapshot unseal costs | Accepted: bound projection/cache and invalidate on commit/account/lock/delete/restart; measure spawn/save p95/event-loop stalls and secure-delete/journal cost. Keep Python crypto baseline; no ACL/security relaxation. Instrument only invented sizes/durations, never personal payloads | Data/Worf WP024,WP032,WP034,WP038–039; T25/T32; CP-03/06 performance pack |
| RC-25 | Data D-H6/D-H7; name-keyed person/series/genre fallbacks and UI grouping; source emits `workId` | Accepted: stable source-record/occurrence fallback surrogates, not same-name equivalence; explicit source-ID cross-role merge/mapping or quarantine. Edition/book anchors feedback; optional work identity/provenance retained/exported without transferring ratings | Data/Wesley WP026,WP028,WP037; T10/T16/T20/T33; identity map/export contract |
| RC-26 | Data D-M3/D-M4; `synchronous` unset; stored success derives from connector observation | Accepted: verify DELETE/FULL/secure_delete pragma contract with kill tests, not pragma-only durability claim. Service commit time owns durable success, source observation separate, revision/generation owns order under clock reversal | Data/Worf WP027,WP030,WP032; T12/T14/T17; durability/clock contract |
| RC-27 | Data D-M5/D-M8; A036 deferred versus “actual bytes”; unspecified duplicate default | Accepted safety prerequisite within WP022: prove actual cumulative byte accounting or STOP, not re-serialized proxy. Default any duplicate/overlap STOP until completeness proof approved. No page-21/cap/retry increase; broad performance optimization still deferred | Data/Worf/Wesley WP022; T07/T31; CP-01 source policy |
| RC-28 | Data D-M7; charter “three equal digests” had no equivalent checkpoints | Accepted: after durable commit, restart, export→validate→isolated test restore, no intervening semantic edit. Declare surrogate/freshness/ciphertext exclusions; retain feedback values/timestamps/revisions | Data WP028,WP039; T26; semantic projection/checkpoint artifact |
| RC-29 | Data D-M1; Geordi M4; WES-002-LOW-01; A032 and actual `lastListenedAt/completedAt/acquiredAt/durationMinutes` sorts | Accepted: WP037 discloses first-series limitation without widening model; WP038 Captain audit enumerates actual sort fields and supported semantics; unsupported history remains hidden/disabled, stale state rejected. Label within-group sort separately from group order | Data/Geordi/Wesley WP037–038; T20/T21; column/sort/disclosure matrix |
| RC-30 | Data D-M2; local rate/burst clause lacked package/test | Accepted: WP015 owns bounded verification/confirmation/write/export abuse protection. Local budgets cannot change provider rate/retry policy; no unbounded queue or public reset | Worf WP015; T01/T02; CP-02 rate/lockout policy |
| RC-31 | WES-002-MED-02; Data baseline conflict and D-L4 test discovery | Accept distinct old/new layout cohorts; reject postponing budget approval until after refactor. Measure existing synthetic/headless baseline under S014/CP-06 before optimization; W4 verifies approved budgets with comparable tasks. Explicit test entry modules discover fixture cases; fixture directory alone is not a runner | Data/Geordi WP014,WP034,WP039; T25/T26/T32; baseline/budget/command manifest |
| RC-32 | Worf L-2/L-3; Wesley optional View Transitions/anchor popovers/on-device taste graph/web barcode spike | Clarify future-only OCR/photo-library review, decoded untrusted text and no background installed-app inventory; photo-library default was already prohibited, not a newly found omission. Defer transitions/popovers/model/camera experiments; no implementation in 112 points | Future NAT-F01/F02 in 07; WP014/WP042 direction record only; separate future plan and tests required |

Data D-H9 is a **reconciliation addendum**, not falsely attributed to the
submitted report's H1–H8 list. Its evidence is the current store's singleton
DDL with no `user_version`/schema column versus T17's pre-write refusal
requirement; in-payload core schema is unavailable until after decryption.
This is covered by S030/S031, not new runtime research or a point increase.

### Conflicts rejected or constrained

- **No weak pairing credential:** a six-digit PIN has about 20 bits of search
  space; salting does not create 256 bits of secret entropy. Throttling does
  not authorize replacing the capability with it. File drop is rejected even
  when described as owner-ACL/one-use; changing the no-file rule requires new
  review. Worf's request for a candidate comparison is met by recording why
  a candidate is inadmissible, not implementing it.
- **No mobile evidence waiver:** Data's suggested nonblocking OF-006 HOLD
  contradicts the owner journey and release DoD. Isolated synthetic device/
  approved equivalent evidence or HOLD/BLOCKED is the controlling choice.
- **No response-body ban on exported book metadata:** Worf's broad wording
  about title-free export “response” would defeat complete export. Apply
  title-free to transport/error metadata; approved JSON intentionally carries
  library/review data, but never internal account keys/credentials/events.
- **No budget fitted to results:** Wesley's post-refactor budget-lock timing
  conflicts with pre-optimization CP-06. Separate measurement cohorts address
  comparability without relaxing the gate.
- **No crypto redesign by preference:** direct DPAPI retains known limitations
  and must earn renewed Worf/Captain acceptance. If independently destroyable
  keys are demanded, stop, redesign and re-estimate; do not promise them from
  constant entropy or silently place keys in Node.
- **No magic layout numbers or color-only lifecycle safety:** measured visible
  viewport/obstruction evidence governs, not assumed `100dvh`, fixed 80px
  padding or distinct colors alone. Safe-area values are measured, not assumed
  nonzero on every device.
- Review-suggested **test ID collisions** are resolved once: Data T28–T33 keep
  those IDs; Wesley mobile/draft/bootstrap become T23/T21/T01+T22 extensions.
  Canonical points come only from 03, not illustrative officer summaries.

## Remaining decisions and blockers

| Decision / blocker | Required authority and next artifact | State |
| --- | --- | --- |
| Owner-only current A001/A002 risk acceptance with interim operating controls | Captain names both risks; Worf/Riker record dated decision in CP register | NOT RECORDED; no runtime action by this task |
| Secure and usable capability delivery, rate budgets and unlock UX | Worf/Data threat comparison + Geordi actual synthetic usability; Captain new surface | UNPROVEN; S015 stops if delivery cannot be proven |
| Direct-DPAPI/A045 limitations, legacy binding/re-seal, root/seed/schema/cache/durability decisions | Dated Data/Worf CP-03, Captain residual/changed-retention decisions | Baseline specified, ratification/evidence pending |
| Aggregate bounds, event/backup retention and export/lifecycle disclosures | Data sizing; Worf privacy; Geordi UX; Captain changed retention/new surfaces | CP-04/06 OPEN; proposed event bounds are not approval |
| Column/sort audit, primary target list, editor/nav/lifecycle wireframes | Geordi/Wesley/Data/Worf CP-05; Captain task/new-surface approval | OPEN; no design PASS claimed |
| Isolated iPhone Air/equivalent evidence acquisition/loading and equivalence | Geordi/Worf approve method; applicable Captain/legal authority before conveyance | NO approved route/evidence yet; OF-006 HOLD |
| Source units/completeness/accounting proof; actual history and non-owned catalog permission/evidence | CP-01 technical decisions; CP-07 official-first research, named legal + Captain + Worf for live route | OPEN/BLOCKED; no import, cap or endpoint escape hatch |
| Incident/runbook, tests 1–15 and full synthetic/runtime gate evidence | Worf/Data/Geordi and S039/S042 final evidence | NOT EXECUTED; no replacement by source scans or test totals |
| Native architecture and release/audience decision | G3 source proof → Data/Worf G4 ADR → all officers G5 → Captain G6, named legal before any conveyance | BLOCKED; native implementation and public/commercial shipping not authorized |

### Revised gate status

| Gate | Status after reconciliation |
| --- | --- |
| A2-G0 | **BLOCKED**, revised from PENDING to reflect Worf withheld concurrence and unresolved CP/Captain decisions |
| A2-G1 | **PENDING**, no new source route or conveyance permission |
| A2-G2 | **BLOCKED**, safety/lifecycle/provenance/incident evidence not executed |
| A2-G3 | **BLOCKED**, four-domain proof and route authority missing |
| A2-G4 | **BLOCKED**, source-led architecture evidence absent |
| A2-G5 | **BLOCKED**, final tests/officer closure/mobile evidence and residual FMEA missing |
| A2-G6 | **BLOCKED**, no Captain release/audience approval |

No mandatory finding has been waived. A documented source STOPPED outcome
is useful evidence, not a release PASS. Any reduced-domain proposal requires
explicit Captain rebaseline plus renewed four-officer and applicable legal
review across all current plans. Owner + at most ten named testers is a
ceiling, **not clearance**. Public/commercial/cloud/store/installer/package/
binary/TestFlight distribution remains **HARD NO-GO**.

## Validation evidence

Documentation validation results are recorded below after checks. Historical
test totals in 01/08 remain historical; no application tests, installation,
provider calls, personal-store reads, migration, stop or disconnect were run.
Original staged officer reports and archived evidence remain unchanged by this
reconciliation. Existing staged documentation is preserved; no commit.

- Standalone Node filesystem validation: **49 Markdown files, 322 local link
  targets and 49 heading anchors resolved; zero errors**. Sixteen external
  destinations were recognized but not contacted. Scope: all planning Markdown,
  APP_DESCRIPTION, root README and implementation README.
- Structural assertions passed: **4/8/30/30/112**, canonical WSJF arithmetic/
  ordering and dispatch parity, 30-node acyclic dependencies and package-card
  parity, wave sums **3+23+26+23+19+5+6+7=112**, all 51 inherited IDs represented
  exactly once, 32 resolution rows and 33 unique test families.
- Working-tree and staged `git diff --check` passed. Before staging, unchanged
  report/archive paths were checked against the incoming index; no edits to
  those reports or archived evidence were introduced.
- Initial Python validator invocation was unavailable on this host; the
  equivalent standalone Node checks above completed successfully. No runtime
  was installed, dependency changed or app test suite invoked.
- Documentation is staged without committing. These checks establish planning
  integrity only; CP concurrence and security/accessibility/runtime gates remain
  open.

## Final Riker recommendation

**Accept the reconciled documentation as the next planning baseline, not as
implementation approval.** Resolve CP-02 bootstrap and CP-03/04 identity/
storage/lifecycle decisions before admitting dependent work. Obtain the
Captain's explicit current-exposure decision first; do not mistake silence
or a running app for risk acceptance. Keep mobile and four-domain evidence
blocking. Then return for dated officer concurrence and execute in dependency
order with the unchanged inventory.

Native iPhone, barcode capture and Audible handoff remain useful future
direction, not work smuggled into this alpha. A useful non-LLM private library
remains the bounded goal; commercial/public release remains NO-GO.
