# Data — Final implementation review, Alpha 0.0.2

**Reviewer:** Data (Lieutenant Commander, Chief Operations Officer)
**Date:** 2026-09-17
**Baseline:** working tree vs `69dee4f` ("Plan Alpha 0.0.2 implementation")
**Scope of this review:** data model, synchronization, persistence, migration,
private feedback, account isolation.
**Authority:** technical review only. This document grants no gate, route,
permission, release, or Captain decision, and changes no runtime state.

> **AMENDED 2026-09-17 (Amendment 1).** Sections 0–5 below are the original
> review, retained unaltered as the historical record. All four findings
> (F-1…F-4) are now **RESOLVED**. The current verdict, evidence and residuals
> are in **§7 Amendment 1**, which supersedes §1 and §4.

## 0. Method and constraints observed

- Read `APP_DESCRIPTION.md`, `planning/0.0.2/09-review-consensus.md`,
  `planning/0.0.2/10-runtime-data-requirement.md`,
  `planning/0.0.2/05-risks-and-release-gates.md`, and the Data planning review.
- Reviewed the complete uncommitted diff (48 modified files, +4,897/−1,212,
  plus new `src/store/*`, `src/security/*`, `src/sync/reconcile.js`,
  `src/core/feedback.js`, `contracts/`, `docs/`, and 12 new test files).
- **No personal runtime files, no local API call, no sync, disconnect, delete,
  or code edit was performed by this review.** No row, title, ASIN, identifier,
  item count or path from the owner's state appears anywhere below.
- Independently re-executed the Node suite: **368 tests, 367 pass, 0 fail,
  1 skipped** (`npm test`, duration 6.40 s). This matches the reported figure.
- Python connector suite **not re-executed**: no Python interpreter on PATH and
  no connector virtual environment present on this host. The reported
  87 tests / 85 pass / 2 skipped is **accepted as reported, not verified by me**.

## 1. Verdict

**APPROVE WITH CONDITIONS — for continued private, owner-only implementation
work only. HOLD for every release gate.**

The persistence, migration and account-isolation core is the strongest work in
this repository to date. The runtime-data requirement in
`planning/0.0.2/10-runtime-data-requirement.md` is met by construction on the
Data-owned surfaces: the private startup path contains no synthetic branch, the
migration is look-then-decide-then-write, and every refusal happens before a
byte is written.

Three gaps remain, all of them in the **retention and deletion lifecycle**
rather than in the migration itself. None of them invalidates the sanitized
evidence already produced (revision-2 migration, one migration record, rollback
envelope present); all three prevent the S028/S029 evidence that A2-G2 requires.

## 2. Positive controls verified (evidence, not assertion)

| Control | Where | Why it holds |
|---|---|---|
| Frozen persisted schema, revision-cited by every consumer | `src/store/schema.js:29-51`, `src/version.js:52-60` | `LEGACY_FINGERPRINT` / `CURRENT_FINGERPRINT` are exact column sets; storage revision is never derived from the release string (`version.js:9-31`) |
| Custody root pinned to the legacy release directory | `src/version.js:29`, `src/store/encrypted-snapshot-store.js:33-40` | A version bump cannot relocate or "lose" the owner's state |
| Look → decide → write ordering | `src/store/production-migration.js:151-192` (read-only probe), `:107-145` (pure plan), `:229-278` (open) | An unknown or newer container is refused before any handle is opened for write |
| Total, default-free shape→action mapping | `production-migration.js:83-104`, `:107-145` | No branch can "repair" an unrecognised database by recreating it; `empty` is deliberately excluded from `RECOGNIZED_EXISTING_SHAPES` (`:63-70`) |
| Transactional structural migration with verification | `src/store/migration.js:126-172` | `BEGIN IMMEDIATE`, one `schema_migration` receipt, `user_version` written after commit, post-migration fingerprint re-asserted, else `migration-verification-failed` |
| Rollback envelope inside the custody boundary | `encrypted-snapshot-store.js:53-66`, `production-migration.js:286-298`, `src/security/runtime-data-source.js:71-112` | Backup path must be contained, non-identical to the live file, absolute, non-link, outside staging roots |
| Restore on post-envelope failure only | `encrypted-snapshot-store.js:80-92` with `isRestorableFailure` (`production-migration.js:213-215`) | A pre-write refusal leaves the container exactly as found |
| Idempotent repeat migration and safe downgrade refusal | `migration.js:76-120` | `already-current` adopts the marker without rewriting a row; `schema-newer-refused` on a newer container |
| Content-free evidence | `production-migration.js:194-211`, `runtime-data-source.js:139-148`, `private-alpha-service.js:119-134` | Booleans, closed enums and a small integer revision only; no count, key, path or timestamp |
| Durable-success authority separated from source observation | `encrypted-snapshot-store.js:122-200` | `last_success_at` is the service commit time; `source_observed_at` and `last_candidate_observed_at` are distinct; a failure never advances success |
| Snapshot writes cannot reach private feedback | `encrypted-snapshot-store.js:8-14`, `feedback-store.js:1-16` | Two classes, two tables, no shared statement |
| Account isolation on read, write and delete | `private-alpha-service.js:44-58`, `:168-190`, `:330-345`, `:370-390` | Join resolved before any unseal; mismatch returns a content-free quarantined status; delete requires a *fresh* verdict, and the API only uses the verified async form (`scripts/serve.js:369-380`) |
| Feedback CAS is re-checked inside the transaction | `feedback-store.js:160-186` | Closes the check-then-write window; delete advances the generation, defeating ABA resurrection (`:196-215`) |
| Sealed inner binding, not column trust | `feedback-store.js:66-99` | Envelope binds version, purpose, account key, book id and generation; a swapped payload is refused |
| No plaintext fallback for local custody | `src/store/local-sealer.js:33-66`, `scripts/private-alpha-runtime.js:34-39` | A missing custodian stops startup rather than saving in the clear |
| Source removal is retention, not deletion | `src/sync/reconcile.js:145-172` | Entry retained and flagged, `lastSeenAt` frozen at the last listing, referenced catalog records retained, integrity re-asserted (`:184`) |
| A delta that cannot be sealed honestly stops | `private-alpha-service.js:318-330` | Never stores the connector's pre-reconciliation blob as if it were the reconciled state |
| Partial or count-mismatched captures never promoted | `private-alpha-service.js:250-266` | Previous snapshot stands; failure recorded with a closed code |
| No synthetic path in the private runtime | `ui/js/app.js:57-70`, `ui/js/private-store.js`, `scripts/serve.js:500-508` | Private mode imports `private-store.js` (which never imports fixtures) and the server returns 403 for `src/fixtures/**` |
| Export document excludes secrets by construction | `src/store/export.js:49-69` | Prohibited-key walk runs on build *and* on validate |

## 3. Findings (high confidence only)

### F-1 — MUST FIX before any S029/A2-G2 residue evidence: the rollback envelope is never discharged, and the deletion inventory is not wired

- `src/store/migration.js:158-160` states the managed backup "is retained until
  the caller discharges it through the deletion inventory".
- `src/store/migration.js:186` `discardBackup()` has **no production caller**.
  The only reference outside its own module is `test/migration.test.js:130`.
- `src/store/export.js:221` `deletionInventory()` — which already models
  `managed-backups` with `lifecycle: 'explicit-discharge'` — has **no caller**
  in `src/`, `scripts/` or `ui/`.
- `src/store/encrypted-snapshot-store.js:228` `deleteLocalSnapshot()` deletes
  the `encrypted_snapshot` and `sync_state` rows only.

**Consequence:** after the revision 1→2 migration, a byte-for-byte sealed copy
of the pre-migration library remains in the custody root indefinitely, and the
owner-facing "Delete local library snapshot" action
(`ui/js/views/data-view.js:105`) does not reach it. The deletion statement
presented to the owner is therefore incomplete, and the "residue proof"
A2-G2 demands cannot be produced truthfully today.

**Smallest correct fix:** discharge the envelope exactly once, after a
subsequent open verifies `outcome: 'already-current'` against
`CURRENT_FINGERPRINT` (proof the migrated container is good), and enumerate it
via `deletionInventory({ managedBackups })` at the delete path. Do not delete it
at the end of the migration itself — the current retention choice is correct;
only the discharge and the disclosure are missing.

### F-2 — SHOULD FIX: deleting the local snapshot orphans private feedback

- `scripts/private-alpha-runtime.js:56-61` derives the feedback account key
  **solely** from the stored snapshot (`status.local.accountKey`), and throws
  `feedback-account-unavailable` when it is absent.
- `src/store/encrypted-snapshot-store.js:228` removes that row on delete, while
  `private_review` rows (correctly) survive.
- `scripts/serve.js:284`, `:334`, `:343` therefore return `409` for every
  feedback read, save and delete after a local-snapshot deletion.

**Consequence:** the owner's ratings, comments and tags remain on disk but
become unreadable, un-exportable and un-purgeable until a *new* sync of the same
account restores the key. The confirmation text at
`ui/js/views/data-view.js:105` ("It does not delete saved private feedback") is
literally true and practically misleading. Note the recovery path exists —
re-sync restores access — so this is data *inaccessibility*, not data loss.

**Smallest correct fix:** persist the owning account key independently of the
snapshot row (revision-2 registry or a dedicated single-row table), so feedback
identity survives snapshot deletion. Alternative, if a schema change is not
acceptable in 0.0.2: state the consequence in the delete confirmation and offer
feedback purge in the same flow.

### F-3 — SHOULD FIX: S028 export and S029 aggregate purge exist but are unreachable from the runtime

- `src/store/export.js` (`buildExportDocument`, `validateExportDocument`,
  `restoreExportDocument`, `deletionInventory`) and
  `src/store/feedback-store.js:248` `purge()` are implemented and tested, but
  have no route in `scripts/serve.js` (routes end at `:369-380`) and no control
  in the private branch of `ui/js/views/data-view.js` (which exposes only
  Disconnect, `:102`, and Delete local snapshot, `:105`).
- The export button at `ui/js/views/data-view.js:156` exports **synthetic**
  session state and is not the S028 document.

**Consequence:** the A2-G2 "export/delete/migration/residue proof" and the
S028/S029 acceptance evidence cannot be produced from the runtime, regardless of
unit-test coverage. Library code plus green tests is not a delivered lifecycle.

### F-4 — SHOULD FIX (evidence hygiene): the declared runtime profile contradicts the shipped surface

`src/version.js:106` declares `ratingsFeature: 'deferred'` inside
`PRIVATE_ALPHA_RUNTIME_PROFILE` (`:91`), while this change set ships private
rating/comment/tag persistence (`src/store/feedback-store.js`), an API
(`scripts/serve.js:284-350`) and an editor (`ui/js/private-store.js`). A
self-declared profile is only useful as evidence while it is exact.

## 4. Gate status after this review

No gate is advanced by this review. Statuses are unchanged from
`planning/0.0.2/09-review-consensus.md`, with the Data-side reason recorded.

| Gate | Status | Data-side reason |
|---|---|---|
| A2-G0 | **BLOCKED** | Unchanged; Worf concurrence and CP decisions outstanding. Data's planning conditions (D-B1/B2/B3, D-H1–H8) remain the gating record. |
| A2-G1 | **PENDING** | No source route or conveyance is created or requested by this change set. |
| A2-G2 | **BLOCKED** | Migration, custody and encrypted-feedback controls are in place and tested; **export, deletion-inventory and residue discharge are not reachable** (F-1, F-3). |
| A2-G3 | **BLOCKED** | Four-domain source proof and route authority remain absent; reconciliation and completeness plumbing are ready to carry that evidence when it exists. |
| A2-G4 | **BLOCKED** | No measured architecture comparison or ADR is produced by this change set. Adapter/local-authority boundaries are intact and remain replaceable. |
| A2-G5 | **BLOCKED** | Lifecycle recovery evidence (migration/export/delete) incomplete per F-1–F-3; tests 1–15 not executed here. |
| A2-G6 | **BLOCKED** | Captain-only. Public/commercial/cloud/store/installer/binary distribution remains HARD NO-GO. |

Runtime-data requirement (`10-runtime-data-requirement.md`), Data obligations:

| Obligation | State |
|---|---|
| Remove the synthetic seed from the private startup path | **MET** — `ui/js/app.js:57-70`, `ui/js/private-store.js`, `ui/js/bootstrap-state.js:34-41` |
| Explicit accessible refusal state on `bootstrapError` | **MET** — `ui/js/views/bootstrap-failure-view.js`, `app.js:48-55` (Geordi owns the a11y verdict) |
| Non-destructive, fail-closed migration | **MET** — section 2 |
| Custody-bounded rollback | **MET for creation**, **INCOMPLETE for discharge** (F-1) |
| No content in evidence | **MET** — no counted or identifying field crosses any evidence surface I traced |

## 5. Residual risks (accepted, to be recorded — not defects)

1. **`sourceObservedAt` advances for unlisted entries.** `reconcile.js:154`
   sets `sourceObservedAt` to the new observation for a book the source did not
   list. `lastSeenAt` is correctly frozen (`:158`), so no proof-of-listing is
   lost, but the two fields now mean subtly different things. Document the
   distinction in `docs/data-contracts.md` before any consumer reads it.
2. **File-copy backup of an open database.** `migration.js:131` copies the file
   while a handle is open. With `journal_mode = DELETE` and no open transaction
   this is consistent in practice, but it is not a checkpointed backup API.
   Acceptable for single-process local alpha; revisit if WAL is ever adopted.
3. **Digest is non-cryptographic.** `reconcile.js:53-68` FNV-1a is documented as
   a change detector. Correct as written; must never be cited as integrity.
4. **DPAPI entropy is release-pinned, not account-bound**
   (`connector/atnr_connector/custody.py:20`). Cross-account safety rests on the
   sealed inner envelope (`feedback-store.js:87-99`) and the account join, which
   is sound; it does depend on those two checks remaining in place.
5. **Tombstones retain opaque keys.** `private_review` rows keep `account_key`
   and `book_id` in the clear after deletion (`schema.js:83-91`). Deliberate and
   disclosed (`export.js:238`); `purge()` clears them but is unreachable (F-3).
6. **Python connector evidence not independently re-executed** on this host.

## 6. Recommendation

**APPROVE the data, sync, persistence, migration, feedback and
account-isolation implementation for continued private owner-only development.
HOLD all release gates.**

Conditions, in priority order:

1. Close **F-1** (discharge + inventory wiring) before any S029 or A2-G2
   evidence run. This is the only finding that makes an owner-facing deletion
   statement incomplete.
2. Close **F-2** or state its consequence in the delete confirmation.
3. Route **F-3** (export, aggregate purge, deletion inventory) through Riker for
   sequencing; it is delivery, not redesign.
4. Correct **F-4** in the same change as any of the above.

Hand F-1/F-2 to Riker as enabler stories with Worf concurrence on the discharge
rule and the account-key persistence location, and Geordi concurrence on the
revised deletion disclosure. No further architectural change is required.

I find the discipline in this change set… satisfactory. The container is opened
read-only before it is trusted, refused before it is written, and preserved
before it is changed. That ordering is why the owner still has their library.
The remaining work is not about protecting the data — it is about being able to
prove, and to keep the promise of, its deletion.

---

# 7. Amendment 1 — post-fix verification (2026-09-17)

**Supersedes §1 (verdict) and §4 (gate status). §2, §3 and §5 are retained as
the historical record.**

## 7.1 Method for this amendment

- Re-read only the changed relevant files: `src/version.js`,
  `src/store/schema.js`, `src/store/migration.js`,
  `src/store/production-migration.js`, `src/store/encrypted-snapshot-store.js`,
  `src/store/export.js`, `src/sync/private-alpha-service.js`,
  `scripts/private-alpha-runtime.js`, `scripts/serve.js`,
  `ui/js/views/data-view.js`.
- **No personal data, no local API capability, no runtime mutation, no code
  edit.** No count, title, identifier, key or path from the owner's state
  appears here.
- Node suite independently re-executed: **471 tests / 470 pass / 0 fail /
  1 skip** (6.88 s). Matches the reported figure.
- Python connector suite again **not re-executed** (no interpreter on PATH, no
  connector virtual environment on this host). Reported **98 / 96 pass /
  2 skip** is accepted as reported.
- Reported and accepted without re-execution: policy pass, pack blocked,
  secret/diff scan clean, and the sanitized live-metadata evidence (revision 3
  exact schema, two migration records, opaque anchor, rollback discharged,
  unauthenticated API 401, server healthy).

## 7.2 Finding resolution

| ID | Status | Verifying evidence |
|---|---|---|
| **F-1** rollback envelope never discharged; inventory unwired | **RESOLVED** | Discharge is an explicit, verified checkpoint: `private-alpha-service.js:177-213` `completeStartupCheckpoint()` discharges only when the join verdict is `matched`, the migration outcome is known-good and state exists; otherwise it returns `checkpoint: 'withheld'` with a closed reason. Called once at startup (`private-alpha-runtime.js:112`). `encrypted-snapshot-store.js:381-395` reports retention honestly rather than claiming a discharge that did not happen. The envelope is also removed by both deletion paths (`:421`, `:461`) and disclosed as `managed-backups` through the wired inventory (`private-alpha-service.js:519-537`, route `scripts/serve.js:440-449`). |
| **F-2** deleting the snapshot orphaned private feedback | **RESOLVED** | Storage revision **3** adds the durable ownership anchor `local_account` (`schema.js:62-77`, `:129-144`), backfilled inside the same transaction as its DDL (`schema.js:166-183`). `status()` now falls back to the anchor (`encrypted-snapshot-store.js:125-133`), so feedback stays reachable after a snapshot deletion; `deleteLocalSnapshot()` retains the anchor while any review row depends on it and drops it with the last dependent (`:410-433`). Re-anchoring to a different account is refused (`:291-304`), and the invariant "a review may exist only for the anchored account" is asserted after every open (`schema.js:229-254`, enforced at `encrypted-snapshot-store.js:98-99`). |
| **F-3** export and aggregate purge unreachable | **RESOLVED** | `POST /api/v1/export` (`serve.js:549`), `GET /api/v1/inventory` (`:440`) and `POST /api/v1/delete-all` (`:583`) are routed; service methods `exportAll()` (`private-alpha-service.js:467`), `deletionInventory()` (`:519`) and `purgeAllLocalData()` (`:553`) are wired; the private UI exposes "Export my data as JSON" and "Delete library and feedback data", the latter gated on a successfully loaded inventory (`ui/js/views/data-view.js:133-145`). |
| **F-4** profile contradicted the shipped surface | **RESOLVED** | `version.js:111` now declares `ratingsFeature: 'local encrypted ratings, comments and tags'`, with a dedicated assertion in the suite ("the private runtime profile describes the feature it actually ships"). |

## 7.3 Additional Data-relevant fixes verified

- **Custody proof precedes any write.** `private-alpha-runtime.js:41-63` takes
  the connector's ACL proof through `CustodyProofGate` *before*
  `openRealLibraryState` may probe, migrate or write an envelope, and wraps the
  migration's own boundary check with `custodyGate.guard(...)`, so a future
  reordering fails closed instead of silently regressing.
- **Migration marker is atomic with the structure it describes.**
  `migration.js:192-232` applies every pending revision, both receipts, the
  `user_version` marker, the fingerprint verification *and* the anchor
  invariant inside one `BEGIN IMMEDIATE`. `initialize()` is likewise
  transactional (`:57-67`). The revision-2 window (structure migrated, marker
  stale) is closed. `migrationOperationCount()` (`:78-82`) lets the interruption
  test target the exact post-structure/pre-marker window instead of a magic
  number.
- **The chain is explicit, not inferred.** `MIGRATION_CHAIN`
  (`schema.js:186`) plus `INTERIM_FINGERPRINT` (`:45-60`) means an
  unversioned-but-revision-2 container is *upgraded*, never adopted
  (`migration.js:120-127`), and a marker/shape disagreement is
  `schema-partially-created-refused` at every revision.
- **Deletion suppresses automatic repopulation.** The content-free suppression
  marker (`encrypted-snapshot-store.js:324-370`: timestamp and one closed
  reason, no key, count or identifier) survives the deletion of every row,
  fails closed to "suppressed" when unreadable, blocks scheduled sync
  (`private-alpha-service.js:321-322`, `:646`), and is cleared **only** by an
  explicit manual sync or reconnect (`:336-337`).
- **Purge tells the truth about what it did not delete.** `#connectorArtifacts()`
  (`private-alpha-service.js:498-517`) reports `'unknown'` when the capability
  is absent or fails, rather than reporting `false`; `complete` requires both
  `contentPurgeComplete` and `connectorArtifactsDisclosed`, and
  `connectorArtifactsErased: false` is stated explicitly (`:571-584`). No VACUUM
  is performed or cited as erasure proof.
- **Export survives a deleted library.** `exportAll()` records
  `libraryRetained: false` and still carries the owner's feedback
  (`private-alpha-service.js:461-487`), so export is not silently conditional on
  the import.
- **Lifecycle nonce/binding invalidation** after connect, disconnect,
  delete-local and delete-all (`serve.js:519-520`, `:533-534`, `:563-564`,
  `:578-579`, `:594-595`).

## 7.4 Gate status after Amendment 1

No gate is advanced by a technical review. The Data-side *obstacles* to A2-G2
evidence are cleared; the gate decisions are not mine to make.

| Gate | Status | Data-side reason (updated) |
|---|---|---|
| A2-G0 | **BLOCKED** | Unchanged: Worf concurrence and CP/Captain decisions outstanding. |
| A2-G1 | **PENDING** | Unchanged: no new source route or conveyance. |
| A2-G2 | **BLOCKED — Data obstacles cleared** | Export, deletion inventory, delete-all and residue discharge are now implemented, routed and exercised. The remaining blockers are Worf's executed security tests 1–12, incident/runbook and S039 evidence, plus `pack blocked` remaining blocked. |
| A2-G3 | **BLOCKED** | Four-domain source proof and route authority still absent. |
| A2-G4 | **BLOCKED** | No measured architecture comparison/ADR. Adapter, store, sync, feedback and AI-free boundaries remain independently replaceable. |
| A2-G5 | **BLOCKED** | Lifecycle *code* is now complete; tests 1–15, rendered AT journey and residual FMEA closure are not executed here. |
| A2-G6 | **BLOCKED** | Captain only. Public/commercial/cloud/store/installer/binary distribution remains HARD NO-GO. |

Runtime-data requirement (`10-runtime-data-requirement.md`): all Data
obligations **MET**, including the previously incomplete rollback-envelope
discharge.

## 7.5 Remaining blockers (not Data-owned)

1. Worf's executed security tests, incident runbook and S039 evidence (A2-G2).
2. Source-route authority and the four-domain proof (A2-G1/G3).
3. Captain decisions: current-exposure risk acceptance, audience/release.
4. Python connector evidence has not been independently re-executed by me on
   this host; Riker's evidence packet should carry the command, host and
   denominator.

## 7.6 Residual risks (accepted, to be recorded)

1. **A disconnected session never discharges the envelope.**
   `completeStartupCheckpoint()` requires a `matched` verdict; `not-connected`
   withholds. Correct trade — the envelope is the only copy of the
   pre-migration container — and the retained file is disclosed by the
   inventory and removed by either deletion path. Expect a long-lived envelope
   on an installation that is never reconnected.
2. **The suppression marker is unencrypted metadata.** It holds a timestamp and
   one closed reason only, and it deliberately survives purge (that is what
   makes "deleted" stick across restarts). It does disclose *that* a deletion
   occurred and when.
3. **The ownership anchor retains the opaque account key after snapshot
   deletion** while reviews exist. This is precisely the fix for F-2; it is
   disclosed in the deletion inventory and removed with the last dependent row.
4. **No cryptographic erasure is claimed or performed.** No VACUUM, no
   overwrite; DPAPI-at-rest limits, shadow copies, pagefile and external copies
   remain disclosed limitations.
5. **`sourceObservedAt` advances for unlisted entries** (`reconcile.js:154`)
   while `lastSeenAt` stays frozen — document the distinction in
   `docs/data-contracts.md` (carried forward from §5).
6. **File-copy backup of an open database** and the **non-cryptographic FNV-1a
   digest** remain as previously recorded; both are correct for this
   single-process local alpha and must not be cited as integrity proofs.

## 7.7 Final verdict

**APPROVE — Data domains (data model, synchronization, persistence, migration,
private feedback, account isolation) are accepted as implemented for Alpha
0.0.2 private, owner-only operation. No release gate is granted; A2-G1 through
A2-G6 remain with their existing authorities.**

All four findings from my final review are closed with verifiable code, and the
closures were structural rather than cosmetic: an ownership anchor instead of a
warning label, a transactional marker instead of a comment, a verified
checkpoint instead of an automatic delete, and a `'unknown'` instead of a
convenient `false`. Revision 3 migrated the owner's real container
transactionally, produced exactly the expected schema and two migration
records, and discharged its envelope only after the state was proven usable.

Zero must-fix and zero should-fix findings remain in my domains. The six
residuals above are trade-offs I endorse; they should be recorded, not fixed.

I note that the deletion story is now the strongest part of this
implementation, which is an unusual property for a prototype. A system that
reports `'unknown'` where it cannot observe, and `false` only where it has
looked, is one whose other claims I am willing to believe.
