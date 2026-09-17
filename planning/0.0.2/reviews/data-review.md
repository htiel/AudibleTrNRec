# Data review — Alpha 0.0.2 planning baseline and implementation plan

**Reviewer:** Lieutenant Commander Data (architecture, data model, persistence,
synchronization, performance)

**Date:** 2026-09-17

**Scope reviewed:** [`APP_DESCRIPTION.md`](../../../APP_DESCRIPTION.md);
[`planning/0.0.2/README.md`](../README.md), [`01`](../01-release-charter.md),
[`02`](../02-scope.md), [`03`](../03-backlog.md), [`04`](../04-sequencing.md),
[`05`](../05-risks-and-release-gates.md), [`06`](../06-owner-feedback.md),
[`07`](../07-native-iphone-direction.md),
[`08`](../08-implementation-plan.md); archived
[bug register](../../archive/0.0.1/feedback-and-bugs/bug-register.md) and
[HOLD/FAIL verdict](../../archive/0.0.1/feedback-and-bugs/alpha-0.0.1-release-verdict.md);
read-only inspection of tracked `code/Alpha0.x` sources.

**Method and limits:** documentation reading plus static read-only source
inspection. No test was executed, no server, connector, database, migration or
personal state was touched, no plan file was modified, and no personal data was
accessed. All code line references are to tracked files as observed today. All
performance statements below are *predictions from code structure*, explicitly
labelled, not measurements; that is precisely the deficiency several findings
require the plan to remove.

---

## 1. Verdict

**CONDITIONAL APPROVE.**

The inventory, decomposition, gating discipline and traceability are sound and
arithmetically correct (section 8). The plan is not yet safe to carry into
A2-G0 because three persistence-lifecycle decisions are missing and would, if
discovered during W3, cause either rework or silent loss of the exact data this
release exists to protect. These are **planning corrections**, not code: each is
a decision, an invariant and a test, not a new capability.

Data will sign off on S014/A2-G0 when blockers **D-B1–D-B3** are resolved in
CP-01/CP-03/CP-04 text and the eight HIGH items have named owners, packages and
test families. No inventory change is required to do this. No gate, route,
runtime action or release is approved by this review.

---

## 2. Observed baseline (facts used in this review)

| Fact | Evidence |
| --- | --- |
| Connector spawns a **new Python process per RPC call** | `src/adapters/connector-process.js:64`; serialized queue at `:49` |
| Every custody write launches `whoami` + `icacls` subprocesses, three `secure_path` calls per write | `connector/atnr_connector/custody.py:127,143,157,206-216` |
| DPAPI entropy is a **fixed constant containing the string `0.0.1`** | `connector/atnr_connector/custody.py:19` |
| Private storage root is a **hardcoded `Alpha0.0.1` literal** in both runtimes | `custody.py:124`; `src/store/encrypted-snapshot-store.js:16` |
| Account key = HMAC(identity seed, user_id); seed persisted in `identity.bin` | `connector/atnr_connector/service.py:98`, `_identity_key` |
| Store rejects a snapshot whose `accountKey` differs from the stored one | `encrypted-snapshot-store.js:63-66` |
| `last_success_at` is written from the **connector's** `observedAt`, not from commit | `encrypted-snapshot-store.js:100-105` |
| Sync stores the connector's original sealed candidate; no reconciliation | `src/sync/private-alpha-service.js:60-80` |
| `library()` unseals the **entire** snapshot through a fresh Python process on every call | `private-alpha-service.js:87-96` |
| Cap set: 25 MB response, 20 pages × 1000, 32 MB seal, 40 MB stdout, 20 000 store items | `service.py:26-28`; `custody.py:17`; `connector-process.js:5`; `encrypted-snapshot-store.js:73` |
| `_progress` multiplies by 100 when value ≤ 1 (A003) | `connector/atnr_connector/normalize.py:137-141` |
| Person identity is role-qualified (A011) and falls back to `name:<name>` | `normalize.py:67-89` |
| `workId` is emitted from `origin_asin` but is unused downstream | `normalize.py` book projection |
| Node engine floor `>=20.6.0` cannot import `node:sqlite` (A010) | `package.json:8` |
| Grouping/faceting keys on display **names**, not canonical IDs | `src/core/library.js:144-171` |

These confirm that the plan's change map in
[08 §4](../08-implementation-plan.md) describes the real code. I found no
change-map row that misstates current behaviour.

---

## 3. Strengths

1. **Authority separation is correct and explicit.** Source-owned fields versus
   locally owned feedback, "source-sync code has no write authority over
   annotations" ([02](../02-scope.md); [08:445](../08-implementation-plan.md)),
   and a separate `encrypted-review-store.js` with no provider-adapter
   dependency ([08:267](../08-implementation-plan.md)) is the right boundary and
   is testable by construction.
2. **Complete-or-stop sync with commit-before-ack** ([08:471-513]) is the
   correct transaction model for this domain and directly repairs the observed
   "validate then store the connector's own candidate" defect.
3. **Revision/deletion generation with ABA protection** ([08:410]) is a genuinely
   good design choice: it prevents a stale pre-delete write from resurrecting a
   deleted review, which a naive `updatedAt` comparison would not.
4. **Identity ambiguity fails closed** — quarantine rather than name matching
   ([08:407, 414]; S026 AC3) — which is the only defensible rule for annotations.
5. **Unicode discipline** ([08:419-424]) — NFC, code points not UTF-16 length,
   count after normalization, enforce transport cap before decode — is unusually
   precise and cross-runtime safe.
6. **Honest measurement policy** ([08 principle 8]; CP-06) forbids "faster"
   claims without paired evidence and sample counts. I endorse it without change.
7. **Traceability is real, not decorative.** All 51 inherited findings are
   dispositioned exactly once; all arithmetic reconciles (section 8).
8. **Portability without over-promising**: semantic contracts and golden
   fixtures for a future native client, with an explicit refusal to promise
   DPAPI/SQLite/Python reuse on iOS ([08 principle 7]; [12 deferrals]).

---

## 4. Findings

Ranked by consequence to durable user data. Plan references are
`08:<line>` unless another file is named.

### BLOCKER

**D-B1 — The account-identity seed has no lifecycle invariant; deleting it
orphans every locally retained review and snapshot.**
`accountKey` is `HMAC(identity_seed, user_id)` (`service.py:98`) with the seed
persisted in `identity.bin` (`service.py::_identity_key`). The snapshot store
refuses any save whose `accountKey` differs from the stored one
(`encrypted-snapshot-store.js:63-66`), and the plan extends that join to every
read, write, export and startup (S025; WP025 card). S029's deletion inventory
explicitly enumerates the "identity envelope/HMAC seed" among items to destroy
(03 S029 AC1). Therefore: *delete local data → seed destroyed → reconnect →
new `accountKey` for the same Amazon account → all retained reviews and
snapshots are permanently unreachable and, worse, are classified as a
cross-account mismatch.* The plan's only adjacent sentence ([08:454]) is about
credential custody versus local-data keys and does not state this invariant.
**Required:** CP-03 must state the seed-retention invariant ("the account
identity seed survives any operation that retains any account-keyed local
record; it is destroyed only when *all* account-keyed local data is destroyed
in the same approved transaction"), S029's inventory must be reordered around
it, and a lifecycle matrix test must exist (see A2-T28).

**D-B2 — Changing the key scheme invalidates every existing envelope, and no
package owns the re-seal.**
All sealing today uses one fixed DPAPI entropy constant that literally embeds
the release string: `ENTROPY = b"Audible Track and Recommend private alpha
0.0.1"` (`custody.py:19`). It protects `credentials.bin`, `identity.bin` and the
sealed snapshot. CP-03 proposes replacing this with "a random local container
data key sealed under DPAPI" ([08:448-451]) and adds a crypto-envelope/key
version ([08:398]). Any edit to that constant, or adoption of the new scheme,
makes **all** existing envelopes undecryptable — including the credentials that
are required to deregister the device. The change map's `custody.py` row
mentions "key lifecycle" generically, but no package deliverable names
*re-sealing existing envelopes*, and WP030's card ([08:205]) speaks only of the
SQLite/legacy schema.
**Required:** (a) freeze `ENTROPY` as an explicitly versioned, never-edited
constant with a stated rule that release-version strings are not part of crypto
parameters; (b) add "credential, identity and snapshot envelope re-seal with
rollback" to WP030's deliverable and to the migration runbook step 4; (c) make
"deregistration must remain possible at every point of the re-seal" an explicit
abort condition. See A2-T29.

**D-B3 — The persisted review schema is owned by S032 but is a hard input to
S028, S029 and S030, which all precede it.**
Dependencies: S028 export ← S031; S029 deletion ← S031; S030 migration ←
S028+S029; S032 ← S028+S029+S030+S031 (03 dependency table; [08 §10 W3]).
S031's deliverable is the *domain* contract ("validator and schema: half-stars,
bounds, revisions, Save/conflict semantics", [08:207]), while the persisted
artefacts that export, deletion and migration must enumerate — review table
DDL, sealed-envelope layout, CAS/generation column, tombstone shape, backup
sidecars — are assigned to S032 ([08:267, 410, 440-444]) and to the migration
that "creates empty review store" (runbook step 4; S030 AC1). Export and
deletion inventories built against an unfrozen persisted schema will either be
rewritten in W3 or will silently under-cover the store that ships — the exact
mechanism behind inherited A016/A017.
**Required:** CP-04 must assign the *persisted* review schema (table shape,
envelope layout, generation/tombstone, backup artefacts) to **S031** as a frozen
output of IC-3's "one agreed schema/inventory", leaving S032 as implementation
and fault proof only. State explicitly that S028/S029/S030 consume that frozen
artefact by revision ID.

### HIGH

**D-H1 — Storage-root literal is version-shaped and unowned.**
`'ATnR/Alpha0.0.1/private-alpha'` is hardcoded in both runtimes
(`custody.py:124`, `encrypted-snapshot-store.js:16`). [02:89] says the root
stays 0.0.1 and [08:701] forbids new roots, but WP019/WP030/WP043 all touch
version surfaces. If anyone "tidies" the literal during the 0.0.2 version
work, the app opens an empty database and the user sees total data loss with no
error. **Required:** CP-03 records "storage root is a migration input, not a
derived value"; add a regression test asserting the root is independent of
`ALPHA_VERSION` (A2-T30), and name the root explicitly in the migration runbook
preflight.

**D-H2 — The cap set is not a consistent sizing envelope, and no story derives
one.** Observed caps: 25 MB provider response accounting, 20×1000 items,
32 MB seal plaintext, ~42.7 MB base64 of that seal, 40 MB stdout, 20 000 store
items, 64 KiB review request. [08:479] correctly warns that 20 000 "is not proof
a full 20 000-book import is possible", but no package is required to *derive*
the real limit. Structural estimate (prediction, not measurement): a normalized
book record carrying a ≤2 000-character synopsis plus contributor/facet arrays
is plausibly 1–3 KB of JSON, so 20 000 books ≈ 20–60 MB plaintext — which can
exceed the 32 MB seal cap and, base64-inflated by 4/3, the 40 MB stdout cap,
while the 25 MB provider cap may abort earlier still. The failure mode is a
user whose library simply cannot sync, reported as a generic cap error.
**Required:** CP-01/CP-06 must require a measured bytes-per-item figure on
invented near-cap fixtures, a published maximum supported library size, and an
explicit cap ordering (which cap is intended to trip first, and with which
classified stop). Add to A2-T25/A2-T31.

**D-H3 — Reconciliation and the review store add process spawns and synchronous
work to the request path; no budget exists.** Step 9 ([08:502]) requires sealing
the *reconciled* result, and step 8 requires the prior snapshot, so each sync
becomes unseal → reconcile → seal — two extra RPCs, each a fresh `python.exe`
(`connector-process.js:64`), each custody write launching `whoami`+`icacls`
up to three times (`custody.py:143,157,206-216`), on a serialized queue
(`connector-process.js:49`). `node:sqlite`'s `DatabaseSync` is synchronous and
runs on the same thread as the loopback HTTP server. The plan defers A035/A036/
A040 to "measure under S039" ([08:220-223]) while simultaneously designing work
that increases exactly those costs. **Required:** CP-06 must name explicit
budgets for (i) process spawns per sync and per review save, (ii) p95 review
save latency, (iii) maximum event-loop block per store operation, and A2-T25
must count spawns and measure stall, not only wall time.

**D-H4 — The review-write crypto boundary is undecided and the default choice is
the expensive one.** [08:369-377] proposes `seal_local_envelope` /
`unseal_local_envelope` as Python RPC operations, which makes every single
review save pay a Python interpreter start plus custody subprocesses. Inline
grouped editing (OF-004, S033) issues many small writes; this is the wrong shape
for it. The plan's own boundary statement — "Node may see normalized library and
user-entered feedback in runtime memory, never provider credentials"
([08:373-374]) — already permits the cheaper alternative: a container data key
sealed once under DPAPI and unsealed into Node memory per session, with
`node:crypto` AEAD for review envelopes, keeping credentials Python-only.
**Required:** CP-03 must decide between the two with a measured comparison and
Worf threat review, rather than inheriting the RPC route by default. Record the
decision ID; both options must satisfy D-B2's versioned-envelope requirement.

**D-H5 — Whole-snapshot unseal per `GET /api/v1/library` is unaddressed.**
`private-alpha-service.js:87-96` unseals the entire library on every request;
the endpoint table ([08:341]) adds a feedback projection to the same route
without addressing per-request decryption cost, caching or invalidation, while
S037/S038 introduce facet, group and filter interactions that will call it
repeatedly. **Required:** define in CP-02/CP-03 either a session-scoped
decrypted cache with explicit invalidation (sync commit, account change, lock,
restart) and a stated memory bound, or a bounded projection contract; assign to
WP024/WP032/WP038 and add cases to A2-T25.

**D-H6 — The fallback contributor identity merges distinct same-name people,
contradicting the plan's own statement.** `normalize.py:67-89` computes
`source_id = asin or f"name:{name}"`, so two different unidentified contributors
sharing a name collapse into one person, and a spelling correction splits one
person into two. [08:407] asserts fallback identities "stay separate until
explicit reviewed mapping", which the current derivation cannot deliver and
which a name-keyed hash can never deliver. This directly determines what a
future A012 identity migration can repair. **Required:** CP-03 must choose
explicitly — per-source-record surrogate identity (separate, unmergeable
without review) versus name-keyed grouping (merging, and therefore unsafe for
any future per-person feature) — and S026 must carry the collision fixtures
(A2-T33). Note `src/core/library.js:144-171` currently facets and groups by
display *name*, so the same collision exists in the UI layer.

**D-H7 — Edition/work identity is absent from the plan although the code emits
it.** `normalize.py` emits `workId` from `origin_asin` alongside the ASIN-keyed
`bookId`, and the [product brief](../../../APP_DESCRIPTION.md) treats editions
as first-class. The plan's
identity table ([08:405-408]) names only account, book/catalog and person. If a
user re-acquires a different edition, feedback keyed on `bookId` does not follow
and no migration rule exists. **Required:** CP-03 must state the feedback
anchor (book/edition versus work) and, if book, must state that cross-edition
carry-over is an explicit future capability, not an implicit one — so that the
export schema and identity map reserve the field now rather than later.

**D-H8 — OF-006 is release-mandatory but has no defined evidence route.**
[08 §12 DoD] requires "OF-001–006 proved through automated AND required
rendered/manual evidence", while [08:610-612] says OF-006 "remains HOLD" absent
an approved real or equivalent iPhone Air environment, and the stop rules forbid
any phone-to-loopback, LAN or tunnel route. The intersection is a release
condition with no achievable path. **Required:** CP-05 must record one of
(a) approved device/simulator acquisition, (b) an explicitly bounded synthetic
equivalence definition sufficient for closure, or (c) an explicit Captain
decision that OF-006 closes at HOLD without blocking A2-G6. Do not leave this
to discovery at G5.

### MEDIUM

- **D-M1 — A032 obligation is unassigned.** [08:539] requires disclosing the
  first-series limitation in the UI, but the disposition table lists A032 as
  deferred with no story. Assign *disclosure-only* evidence to WP037 without
  reopening the multi-series contract.
- **D-M2 — Rate/burst protection has no package or test.** [08:357-359] requires
  bounded, reviewed rate protection on local confirmation/write endpoints; no
  package card or A2-T family covers it. Add to WP015 and A2-T01.
- **D-M3 — "Durable" is asserted but the pragma contract is not.** The store sets
  only `journal_mode=DELETE` and `secure_delete=ON`
  (`encrypted-snapshot-store.js:28-30`). Commit-before-ack claims require an
  explicit `synchronous` setting and a crash test that kills the process between
  commit and acknowledgement. Add the pragma contract to CP-03 and cases to
  A2-T14/A2-T17.
- **D-M4 — Clock authority change is implicit.** `save()` writes
  `last_success_at` from the connector's `observedAt`
  (`encrypted-snapshot-store.js:100-105`). WP027 owns the semantics, but the
  store row of the change map ([08:247]) does not name this specific field
  change. Name it, so the fix is not lost in "transactional updates".
- **D-M5 — A036 deferral conflicts with the actual-bytes requirement.**
  [08:480] forbids relying on counts or `Content-Length` "to bypass actual
  bytes", while `service.py` accounts bytes by *re-serializing* each response and
  A036 is deferred ([08:221]). Re-serialized size is not wire size. Reconcile:
  either accept re-serialized accounting explicitly as the approved measure with
  its bias documented, or schedule A036 under WP022.
- **D-M6 — Genre prove-or-remove lacks a root-cause hypothesis list.**
  `normalize.py::_categories` already builds genre facets from
  `category_ladders` leaf names, and `RESPONSE_GROUPS` requests `categories`
  (`service.py:29-41`). OF-002's "always Unknown" therefore has at least three
  candidate causes (response-group/field mismatch, ladder shape, UI projection).
  WP037 should record the candidate list and the discriminating observation
  before a removal decision, or a working feature may be deleted.
- **D-M7 — "Three equal semantic digests" is undefined.** The CTQ
  ([01](../01-release-charter.md)) and A2-T26 ([08:661]) require three equal
  digests without naming the three checkpoints. Define them (proposed:
  post-commit, post-restart, post-export→restore) in CP-06.
- **D-M8 — Duplicate policy default is unstated and materially changes
  outcomes.** Today `normalize_library` raises `library-record-duplicate` and
  fails the whole sync; [08:481-485] permits dedupe only under an approved
  completeness contract. Because an active library can legitimately mutate
  between pages, the chosen default decides whether large libraries sync at all.
  CP-01 must state the default explicitly and its classified stop code.
- **D-M9 — Existing singleton rows need a named migration.** `sync_state` and
  `encrypted_snapshot` are singleton STRICT tables with no account or generation
  column; the proposed Sync-state entity ([08:412]) adds both. Name this row
  transformation in WP030's deliverable.

### LOW

- **D-L1** `secure_delete=ON` with a rollback journal implies write
  amplification; include it in the A2-T25 baseline rather than discovering it as
  a regression.
- **D-L2** Two independent safe-error-code allowlists exist
  (`connector-process.js:110-115`, `encrypted-snapshot-store.js::recordFailure`);
  WP020/WP027 should name one source of truth to avoid vocabulary drift.
- **D-L3** S019 must also correct `package.json:8` `engines`, the README setup
  text and the `connector:test` script's `..\.venv\Scripts\python.exe`
  assumption, not only the preflight guard.
- **D-L4** The test glob is `test/*.test.js` (`package.json:12`); new
  `test/fixtures/alpha-0.0.2/` content is therefore not auto-discovered as tests
  — intended, but state it so no one "fixes" the glob and starts executing
  fixtures.

---

## 5. Contradictions and gaps

| # | Contradiction / gap | Where |
| --- | --- | --- |
| C1 | Fallback identities "stay separate" versus name-keyed hashing that merges them | [08:407] vs `normalize.py:67-89` |
| C2 | "Actual bytes" required while A036 re-serialization is deferred | [08:480] vs [08:221] |
| C3 | OF-006 release-mandatory versus OF-006 HOLD with no permitted evidence route | [08 §12 DoD] vs [08:610-612] |
| C4 | Persisted review schema consumed by S028/S029/S030 but owned by S032 | 03 dependency table vs [08:207, 267] |
| C5 | A2-T25 budgets "approved before implementation" (CP-06) versus S034 AC3 measuring the baseline inside S034 | [08:115] vs 03 S034 AC3 |
| G1 | No invariant binding identity-seed retention to account-keyed data retention | absent |
| G2 | No owner for re-sealing existing envelopes under a new key/envelope version | absent |
| G3 | No sizing derivation linking item count to seal/stdout/response caps | absent |
| G4 | No event-loop/spawn budget for the synchronous store plus per-call Python spawn | absent |
| G5 | No edition/work anchoring rule for feedback | absent |
| G6 | Rate/burst protection named but unassigned and untested | [08:357] |
| G7 | A032 disclosure obligation unassigned | [08:539] vs 03 disposition table |

---

## 6. Required corrections

### Required before A2-G0 (0.0.2 planning corrections — no inventory change)

1. **CP-03:** add the identity-seed retention invariant and the deletion
   ordering it implies (D-B1); re-order S029's inventory accordingly.
2. **CP-03 + WP030:** freeze `ENTROPY` as a versioned constant, forbid
   release-version strings in crypto parameters, and add envelope re-seal with
   rollback and "deregistration remains possible" as abort conditions (D-B2).
3. **CP-04 + IC-3:** move the *persisted* review schema (DDL, envelope layout,
   generation/tombstone, backups) to S031 as a revision-identified frozen
   artefact consumed by S028/S029/S030 (D-B3).
4. **CP-03:** declare the storage root a migration input independent of
   `ALPHA_VERSION` (D-H1).
5. **CP-01 + CP-06:** require a measured bytes-per-item derivation, a published
   maximum supported library size and an explicit cap ordering (D-H2).
6. **CP-06:** add spawn-count, p95 review-save and event-loop-block budgets;
   extend A2-T25 to count spawns and measure stalls (D-H3).
7. **CP-03:** decide the review crypto boundary (Python RPC envelope versus
   Node-side container data key) by measured comparison plus Worf review (D-H4).
8. **CP-02/CP-03:** define the decrypted-library cache or projection contract
   with invalidation and memory bound (D-H5).
9. **CP-03:** choose the fallback contributor identity rule and the feedback
   anchor (book/edition versus work), with collision fixtures (D-H6, D-H7).
10. **CP-05:** record the OF-006 evidence route or an explicit HOLD decision
    (D-H8).
11. Close MEDIUM items D-M1–D-M9 by naming a package, a test family or an
    explicit accepted-with-rationale disposition.

### Explicitly **not** required for 0.0.2 (future native / separate plans)

- Native Swift implementation, iOS custody/Keychain, Data Protection classes,
  background refresh, native accessibility — [07](../07-native-iphone-direction.md).
- NAT-F01 camera ingestion, NAT-F02 Audible handoff and their 11 indicative
  points; correctly excluded from the 112.
- Recommendation generation, ranking, LLM/provider selection, embeddings,
  sentiment, facet-rating editors, cross-device sync, new marketplaces.
- Windows→iOS data transfer: correctly framed as a future re-encryption/import
  operation, never a file copy. The D-B2 versioned-envelope correction is the
  prerequisite that makes such a transfer describable later; it does not
  authorize it.

---

## 7. Proposed acceptance tests

New families, to be added under S014's reconciliation and assembled by S039.
Existing A2-T numbering is preserved; these continue it.

| ID | Type | Cases | Package / gate |
| --- | --- | --- | --- |
| A2-T28 | I/A | Identity-seed lifecycle matrix: delete-feedback, delete-local, confirmed disconnect, failed disconnect, reconnect-same-account, reconnect-after-local-delete. Assert seed survives every operation that retains any account-keyed record; assert account key is stable across reconnect; assert no retained record becomes unreadable or mismatch-quarantined | WP029/WP032 / G2 |
| A2-T29 | I/A/M | Envelope/key-version migration: legacy fixed-entropy envelopes → new versioned key; re-seal of credential, identity and snapshot envelopes; kill at each re-seal point; wrong version/purpose/account fails closed; deregistration remains possible at every intermediate state; rollback restores readable prior generation | WP030 / G2/G5 |
| A2-T30 | U/I | Storage root stability: bump `ALPHA_VERSION` in fixtures and assert the resolved private root is unchanged in both runtimes; assert an unknown/absent root fails closed rather than creating a new empty store | WP019/WP030 / G2 |
| A2-T31 | I/A | Size-envelope derivation: invented small/representative/near-cap datasets with worst-case synopsis/contributor density; record measured bytes per item; assert the intended cap trips first with its classified stop; publish derived maximum library size | WP022/WP024 / G2 |
| A2-T32 | I/A/R | Cost budget: count Python spawns per sync and per review save; measure p95 review-save latency and maximum contiguous event-loop block per store operation; assert budgets from CP-06; assert no cap or ACL check is weakened to meet them | WP032/WP039 / G2/G5 |
| A2-T33 | U/A | Fallback identity collisions: two same-name contributors without IDs; one contributor whose name changes; one whose ID arrives later; assert the CP-03 rule holds end to end, that facets/groups key on canonical IDs, and that no review is repointed without an explicit map | WP026/WP037 / G2/G3 |

Extensions to existing families: **T09** add reconciliation under
prior-snapshot-unavailable and seal-failure-after-reconcile; **T14** add the
pragma/commit-kill case from D-M3; **T16** add the edition/work anchor field and
its absence semantics; **T17** add the singleton-row transformation of D-M9;
**T25** absorb D-L1 and the D-H5 cache cases.

---

## 8. Traceability verification (independently recomputed)

| Check | Result |
| --- | --- |
| Themes / epics / features / stories | 4 / 8 / 30 / 30 — consistent across [02](../02-scope.md), [03](../03-backlog.md), [08](../08-implementation-plan.md) |
| Epic point sums from story sizes | 24+26+15+13+10+6+6+12 = **112** ✓ |
| Theme totals | 50+28+16+18 = **112** ✓ |
| Wave totals | 3+23+26+23+19+5+6+7 = **112** ✓ |
| WSJF arithmetic | All 30 rows recomputed as CoD/Size; all correct; ordering descending with documented tie-breaks ✓ |
| WSJF table in `08` vs canonical `03` | Identical row-for-row ✓ |
| Package ↔ story mapping | A2-WP014–WP043 ↔ S014–S043 one-to-one ✓ |
| Dependency graph | Acyclic on inspection; `08 §10` wave constraints match `03` dependency table ✓ |
| Inherited findings | All A001–A051 dispositioned exactly once (39 rows, 51 IDs) ✓ |
| Mandatory set | A001–A011, A013–A024, A028–A030, A033–A034, A046, A049 = **30**, plus promoted A012 ✓ |
| Finding → package coverage | Complete except **A032** (obligation exists at [08:539] with no package — D-M1) |
| Owner feedback → package | OF-001→WP035; OF-002→WP037; OF-003→WP034/038; OF-004→WP031/032/033/037/038; OF-005→WP034/035; OF-006→WP033/034/038; OF-007→WP014/028/029/030/032/042 — all mapped ✓ |
| Owner feedback implementability | OF-001, OF-003, OF-004, OF-005, OF-007 implementable as specified. **OF-002** implementable only via the prove-or-remove fallback (acceptable) but needs D-M6's root-cause list. **OF-006** not closable as written — see D-H8 |

---

## 9. Scope and estimate risk

1. **W1 (23 pts) conceals an unsolved design.** S015 is sized 5 while containing
   an unproven trusted capability-delivery channel that the plan itself says may
   fail and force "another reviewed design" ([08:299-305]). Sizing an unsolved
   secure-channel problem as a single L story is optimistic; recommend an
   explicit spike-or-split trigger at IC-1 rather than absorbing it as "polish".
2. **W3 (23 pts) conceals a crypto redesign plus a data migration.** If CP-03
   selects the new container-data-key scheme, D-B2's re-seal of existing
   credential, identity and snapshot envelopes is real, risky work not currently
   represented in any estimate. Recommend a permanent new enabler ID under
   Riker's change control rather than silently inflating S030 or S032.
3. **S032 at 5 points** spans encrypted CRUD, CAS, ABA generations, tombstones,
   crash/disk-full/crypto-failure matrices and concurrency. If D-B3 moves the
   persisted schema to S031, S032 becomes tractable; if not, S032 is the single
   most likely overrun in the release.
4. **S034 at 5 points** now carries a mobile-first rework, the OF-005 navigation
   restructure, contrast/focus evidence and the iPhone Air target. Geordi owns
   the judgement, but from the data side the performance baseline obligation in
   S034 AC3 collides with CP-06's "approve budgets before implementation" (C5);
   resolve by measuring the baseline in W0/W1 on existing surfaces.
5. **Capacity discipline is sound.** The 20% reserve, unknown velocity, WIP
   limit and "no point-to-time conversion" rules are correct and should not be
   relaxed to absorb items 1–3; use change control instead.
6. **No inventory change is requested by this review.** Every required
   correction above is a decision, an invariant or a test, except item 2, which
   should become a new ID only if CP-03 selects the new key scheme.

---

## 10. Conditions for Data sign-off

1. D-B1, D-B2, D-B3 resolved in CP-01/CP-03/CP-04 text with decision IDs.
2. D-H1–D-H8 each assigned an owner, a package and a test family (or an
   explicit, reasoned deferral recorded in the decision register).
3. A2-T28–A2-T33 accepted into the verification matrix, and A2-T25 extended per
   D-H3/D-H5.
4. C1–C5 reconciled in the plan text so no downstream reviewer must choose
   between two contradictory sentences.
5. Worf concurrence on D-H4 (crypto boundary) and D-B2 (envelope versioning);
   Geordi concurrence on D-H8 (OF-006 evidence route); Riker disposition of the
   section 9 estimate risks.

Until these conditions are met, Data records **CONDITIONAL APPROVE** — the plan
may proceed to CP resolution and A2-G0 preparation, and may not proceed to
implementation of any persistence, lifecycle or feedback-write package.

**This review modifies no plan document, no implementation and no runtime
state. It grants no gate, route, permission or release.**
