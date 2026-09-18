# Data contracts — Alpha 0.0.2 foundation

Scope: the data, synchronization and persistence layer only. Every statement
here is either implemented in the cited file or explicitly marked as a proposal
awaiting evidence. Nothing in this document claims a verified property of the
Audible source; the source contract is **proposed pending CP-01**.

---

## 1. Source contract artifact

`contracts/source-contract.json` (revision `atr-source-contract-r1`) is the one
place where source units, limits and completeness rules are declared.

| Consumer | File | How it reads the contract |
|---|---|---|
| Connector (Python) | `connector/atnr_connector/contract.py` | Loads the JSON, fails closed on missing/damaged/unsupported revision |
| Core (Node) | `src/core/source-contract.js` | Frozen in-code mirror (the platform-neutral core performs no file I/O) |
| Agreement test | `test/source-contract.test.js`, `connector/test/test_contract.py` | Asserts artifact ↔ mirror ↔ loader equality |

A limit is never inlined at a call site. If the artifact and a mirror disagree,
the tests fail rather than one runtime silently behaving differently.

## 2. Progress units (ATR-S021)

`percent_complete` is **declared** as `percent-0-100`.

* `0.5` means half of one percent. It is never rescaled to `50` because it
  "looks fractional". Magnitude never implies a unit.
* Absent → `percentComplete: null` and status `unknown`. Never `0`.
* Present but invalid (string, boolean, `NaN`, `Infinity`, out of range) → the
  record is malformed and the **whole capture stops**.
* Listening status is derived from declared source status fields, never from a
  unit conversion (`_status` in `normalize.py`).

If CP-01 evidence shows a different real scale, the artifact revision changes
and both mirrors and all tests move with it.

## 3. Pagination completeness (ATR-S022)

`collect_library_pages()` in `service.py`:

| Rule | Behaviour |
|---|---|
| Page cap | 20 pages × 1000 items. Exhausting the cap → `library-page-limit` stop, with **no** page-21 probe |
| Duplicate identifier (within or across pages) | `library-pagination-duplicate` stop. De-duplication alone proves nothing about completeness |
| Over-size page / item total / cumulative response | classified stop |
| Completeness basis | `short-final-page` or `empty-first-page` only. A completeness claim without a declared basis is impossible |

**Byte-accounting honesty.** The client returns a decoded object, so wire bytes
are not observable at this boundary. The accumulator re-serializes the decoded
page and reports `estimatedResponseBytes` with
`byteAccountingIsWireProof: false`. It is an estimate, and it says so.

## 4. Record policy and diagnostics (ATR-S023)

A malformed record stops the whole capture; there is no partial promotion and
no silent truncation. The only information that crosses the process boundary is
a **record position** and a **closed category**
(`missing-required-field`, `invalid-field-value`, `unsupported-record-shape`,
`duplicate-record`, `limit-exceeded`, `unclassified`). Source values, field
names and titles never do (`rpc.py::_safe_detail`).

Contributor limit: **50 per role list**, read from the contract. An over-limit
record is *refused*, never truncated — the user is told the library is
incomplete rather than shown a shortened one.

## 5. Identity (ATR-S026)

| Situation | Result |
|---|---|
| Same provider identifier, different roles | **One** person, roles merged, `identityBasis: provider-id` |
| Same provider identifier, different books | One person |
| Equal display names, no identifier | **Separate** people, `identityBasis: source-record-occurrence` |
| Name-only contributor appearing as author and narrator | Separate records until an explicit reviewed mapping exists |

Series and genre facets follow the same rule. Name equality is never identity.

## 6. Reconciliation and referential integrity (ATR-S024, ATR-S025)

`src/sync/reconcile.js` runs **only** on a complete capture.

* An entry the source stopped listing is retained with `missingFromSource: true`
  and `lastSeenAt` frozen at the last observation that actually listed it.
* Every catalog record that a retained entry depends on is retained with it, so
  nothing is ever left dangling.
* A verified reappearance clears the flag and advances `lastSeenAt`.
* Source data cannot create, edit or clear a private review: reviews live in a
  different table and are not reachable from this module.
* `semanticDigest()` is an FNV-1a change detector for replay comparison. It is
  **not** a security primitive, and declared freshness fields (`observedAt`,
  `lastSyncedAt`, `sourceObservedAt`) are excluded from it.

## 7. Sync transaction and success authority (ATR-S027)

`src/sync/private-alpha-service.js`, in order:

1. read prior status → **record the attempt** (before the connector starts);
2. capture → account isolation check → validate → completeness check;
3. unseal the prior snapshot for the same account → reconcile;
4. seal the **reconciled** result;
5. transactional save, then publish status.

`last_success_at` is the **durable commit time** produced by the service. The
source observation is stored separately (`source_observed_at`). Any failure —
capture, validation, reconciliation, sealing or commit — leaves the previous
snapshot, its generation and its success time untouched, including the `null`
success of a first-sync failure.

**Known gap (handoff to Worf).** Sealing the reconciled snapshot requires a
`sealSnapshot` capability on the connector adapter
(`src/adapters/connector-process.js`, not a Data-owned file). The Python side
already exposes `seal_snapshot`. Until the adapter exposes it, a sync whose
reconciliation retained anything stops with `reconciled-seal-unavailable` and
preserves the prior snapshot, rather than storing a snapshot that omits the
retained records.

## 8. Storage revisions and migration (ATR-S030)

Storage revisions are independent of the application version. A release bump
never creates a new storage root.

### Release identity vs. storage identity

The implemented release is **0.0.2**. `ALPHA_VERSION` (and the `atr-schema-`,
`atr-evidence-contract-` and `atr-trust-policy-` identifiers derived from it)
moved with it. The following constants did **not**, and are asserted immutable
by `test/version.test.js` and `connector/test/test_release_identity.py`:

| Constant | Value | Why it cannot follow the release |
|---|---|---|
| `LEGACY_ALPHA_VERSION` | `0.0.1` | names the release whose state exists on disk |
| `PRIVATE_DATA_DIRECTORY` | `Alpha0.0.1` | a new root would present an empty library indistinguishable from data loss |
| `atnr_connector.custody.ENTROPY` | pinned to the 0.0.1 string | re-keying DPAPI would make every sealed payload undecryptable |
| `LEGACY_STORAGE_SCHEMA_VERSION` / `LEGACY_FINGERPRINT` | 1 / exact table shape | the revision-1 probe must stay recognizable so migration still detects it |
| `STORAGE_SCHEMA_VERSION`, `STORAGE_SCHEMA_REVISION`, feedback/export/envelope revisions | advance on their own schedule (storage is now revision 3) | storage revisions are never inferred from a release string, in either direction |

Container classification reads `user_version` and the table fingerprint only.
No release string participates in the decision, so the 0.0.2 runtime still
classifies the owner's existing container as `legacy` with action `migrate`.

| Revision | Shape |
|---|---|
| 1 (legacy 0.0.1) | `encrypted_snapshot`, `sync_state`; no `user_version`; recognized only by exact fingerprint |
| 2 (interim, `INTERIM_FINGERPRINT`) | adds generation/observation/completeness columns, `private_review`, `schema_migration` |
| 3 (`atr-storage-r3`) | adds `local_account`, the durable ownership anchor |

`src/store/migration.js` rules: empty container → *initialize*; a recognized
legacy or interim fingerprint → the **whole pending step chain applied inside
one transaction**, after an encrypted file-level backup; unknown / partially
created / newer → **fail closed**, never rewritten or reseeded. An interrupted
migration rolls back with no half-applied revision visible, and
`restoreBackup()` returns the last valid state. A missing backup is a refusal,
never a silent fresh start.

The `PRAGMA user_version` marker is set **and verified inside that same
transaction**, before the commit. Committing structure first would open a
window in which the container is structurally revision 3 while still claiming
to be revision 1 or 2 — a shape the next open classifies as partially created
and refuses, with the owner's library inside it. `migrationOperationCount()`
exists so the interruption test can target that exact post-structure,
pre-marker window instead of a magic number; the rollback reverts marker,
structure and receipts together, and the container is recognized and migrated
cleanly on the next attempt. Initialization is transactional for the same
reason.

### The ownership anchor (revision 3)

Before revision 3 `encrypted_snapshot` held the only account key, so deleting
the imported library removed the anchor every private review depended on and
stranded the owner's own ratings and comments. Revision 3 stores the opaque
local account key once, in `local_account` — never an email, customer id or
device serial — and migration back-fills it transactionally from the snapshot
that is already present. A container with no snapshot gains no invented owner.

The invariant "a private review may only exist for the anchored account" is
checked explicitly by `accountAnchorViolation()` after every open and after
every migration, and fails closed. It is not a SQLite foreign key: expressing
it as one would require rebuilding a table that already holds the owner's
encrypted reviews, which is a larger risk than the invariant it would enforce.

Consequences: the same owner keeps read, export and delete access to their
feedback after deleting the imported library, while a *different* connected
account is still quarantined, because the account join now compares against the
anchor rather than a snapshot row that may be gone. `deleteLocalSnapshot()`
drops the anchor only with the last dependent review row.

### Rollback envelope lifecycle

The migration backup is a complete copy of the pre-migration encrypted
container, so it is never discarded at the end of the migration itself. It is
discharged at exactly one safe checkpoint — `completeStartupCheckpoint()` —
after the schema has been verified at open, the account join has resolved to
`matched`, and a status read has been served without error. A quarantined,
unverified or merely disconnected session withholds the discharge and reports
the envelope as retained; `not-connected` confirms nothing about ownership.

Until it is discharged the envelope is disclosed in the deletion inventory as
`rollback-envelope` residue, and a confirmed complete local deletion removes it.

## 9. Private feedback (ATR-S031, ATR-S032)

Domain: `src/core/feedback.js`. Persistence: `src/store/feedback-store.js`.

* Overall rating plus optional independent story and narration ratings, each
  `null` or 0.5–5.0 in exact half-star steps. A missing dimension stays missing.
* Comment ≤ 4000 code points (NFC, astral-safe); tags ≤ 20 × 40 code points,
  case-insensitively de-duplicated with the first display form preserved.
* Unsupported controls and bidi overrides are **refused**, not stripped: silent
  removal would edit the user's words. Markup is stored verbatim as data.
* One active record per `(account, canonical book)`, immutable `createdAt`,
  `updatedAt` advancing only on a committed change, and a revision token that
  makes a stale write a `revision-conflict` instead of an overwrite.
* Only the opaque account key, book id, generation, revision and a deletion flag
  are in the clear. Ratings, comments, tags and their timestamps exist on disk
  only inside the sealed payload, which carries an authenticated inner binding
  (envelope version, purpose, account key, book id, generation).
* Delete leaves a **content-free** tombstone and advances the generation, so a
  stale pre-delete write cannot resurrect a review (ABA).
* Custody is the connector (`seal_local` / `unseal_local`, DPAPI current-user).
  If the custodian is unavailable the save **fails**; there is no plaintext
  fallback.
* Synchronization never writes here, so an import can never overwrite feedback.

## 10. Export and deletion (ATR-S028, ATR-S029)

`src/store/export.js` builds a closed, versioned document (`atr-export-r2`)
containing the catalog, entries (including source-removed entries with their
retention evidence), references, provenance, the capture limits the data was
collected under, and the user's ratings, comments, tags and timestamps.

`libraryRetained` states plainly whether the imported library is still held. A
deleted library is an expected case, not an error: the document reports
`libraryRetained: false`, carries an empty library, and still carries the
owner's feedback, which is theirs regardless of the import.

Credentials, authorization material, the identity seed, the account key, sealed
payloads and internal diagnostics/paths are excluded **by construction**: a
prohibited key anywhere in the document is a build-time refusal.
`restoreExportDocument()` provides a semantic round trip for verification; it is
not a personal-source import route and grants no provider access.

`PrivateAlphaService.exportAll()` joins the two halves: it resolves the account
join first, unseals the retained library, adds the account-bound feedback, and
reports `feedbackIncluded` honestly rather than silently omitting it when no
feedback store is composed.

`deletionInventory()` enumerates every retained class (snapshot, reviews,
tombstones, sync state, ownership anchor, rollback envelope, the suppression
record, identity seed and provider credentials) with its lifecycle and its
owner, plus `localDataRemoved` and `residualItemIds` computed from the
post-deletion state rather than asserted.
`PrivateAlphaService.purgeAllLocalData()` performs the confirmed complete local
deletion — snapshot, sync state, every review and tombstone, the anchor and the
rollback envelope — and recomputes the inventory from the container afterwards.

### What "complete" means

Completion is defined precisely, because the loose version would be a false
reassurance:

* `contentPurgeComplete` — every piece of content this application owns is
  gone, **and** automatic repopulation is suppressed. Recomputed by re-reading
  the container, never asserted from the operation that just ran.
* `connectorArtifactsDisclosed` — the connector-owned credential and identity
  artifacts are **disclosed, not erased**. Only a confirmed Disconnect removes
  those.
* `complete` is the conjunction of those two. It never means "every byte
  related to you is gone".

Connector artifacts are obtained through a closed capability
(`local_artifact_inventory`, existence booleans and a closed protector name
only — no path, account identifier or credential material). When the capability
is absent or the call fails, they are reported as `'unknown'`. Reporting
`false` for an artifact this process cannot observe would be a claim, not a
fact. *(Adapter note: exposing this capability to the JS runtime requires
adding `local_artifact_inventory` to `CONNECTOR_METHODS` in
`src/adapters/connector-process.js`, which is security-owned. Until then the
runtime reports `unknown`, which is correct.)*

### Deletion suppresses automatic repopulation

A deletion that the next scheduler tick undoes is not a deletion. Both
`deleteLocalSnapshot()` and `purgeAllLocalData()` write a content-free
suppression record — a timestamp and a closed reason, inside the same protected
custody root — after the content is gone. While it exists:

* `sync({ trigger: 'automatic' })` refuses with `local-data-suppressed` before
  recording an attempt or contacting the connector, and the scheduler does not
  even poll connector status;
* a restart reaches the same conclusion, because the decision is on disk rather
  than in session memory;
* only an explicit owner action clears it — a manual sync or a reconnect. A
  quarantined session cannot clear another account's suppression, because the
  account join is resolved first.

The record is disclosed in the inventory as `local-data-suppression` with
`content: false`: it is why the deletion holds, not something the deletion
failed to remove.

The limits are stated plainly: DPAPI protects at rest for this user account
only; deleting a row or a file is **not** cryptographic erasure, and no VACUUM
is performed or cited as proof of removal; externally exported copies are
outside the application's reach; and deleting local data does not deregister the
provider device or remove the connector-owned artifacts — only a confirmed
Disconnect does that.

## 11. Runtime data requirement (Alpha 0.0.2)

**The user-facing runtime runs on the owner's existing, real, encrypted local
library state. Synthetic fixtures are test material only. There is no silent
fallback.**

This is a *requirement*, not a default. A runtime that cannot reach the real
encrypted state must stop and say so. It must never seed a populated demo
library and present it as someone's listening history: a believable lie about
what a person has read is worse than a blunt refusal, because the owner has no
way to tell it apart from the truth.

### How it is enforced

| Layer | Enforcement |
|---|---|
| Composition (`scripts/private-alpha-runtime.js`) | opens the real state through `openRealLibraryState({ requireExistingState: true })`; a missing 0.0.1 container stops startup instead of being initialized, and the account join is resolved before any read |
| Production path (`src/store/production-migration.js`) | read-only probe → pure plan → write only for a recognized shape; the strict refusal happens before any directory or file is created |
| Service (`src/sync/private-alpha-service.js`) | `dataSource` is a constructor gate: anything other than `local-encrypted` cannot be constructed. `status()`, `library()` and feedback access resolve the account join first |
| Snapshot validation (`src/sync/live-snapshot.js`) | only the approved live source is accepted, so a fixture-shaped snapshot is refused, not rendered |
| Store (`src/store/encrypted-snapshot-store.js`) | the rollback envelope must resolve inside the same custody root and must not be the live file |
| Security boundary (`src/security/runtime-data-source.js`, Worf) | custody root/containment assertions, refusal to serve fixture modules in a private session, client-side runtime check |

### Migration is non-destructive and fail-closed

1. **Probe read-only.** `probeStorageContainer()` opens the container with
   `readOnly: true` and reads only `user_version` and the schema fingerprint.
   No row is read, so the probe cannot observe library content, and it cannot
   mutate the owner's state even by accident.
2. **Plan purely.** `planMigration()` maps a shape to exactly one action
   (`initialize`, `migrate`, `adopt-marker`, `none`, `refuse`). It is total, so
   there is no default branch that could "repair" an unrecognised database by
   recreating it.
3. **Refuse before writing.** `unknown`, `newer` and `unreadable` containers are
   refused in the probe/plan stage — before the store is opened for write — and
   are left byte-identical. In production strict mode
   (`requireExistingState: true`) only `legacy`, `interim`, `current` and
   `current-unmarked` are admitted: an **absent or empty** container is refused
   too, because initializing one would present an empty shelf that the owner
   cannot distinguish from a library whose contents were lost.
4. **Migrate behind a rollback envelope.** A structural migration copies the
   sealed file first. The envelope is written *inside the same protected custody
   root*, so the encrypted state never leaves the boundary that the local ACL,
   the DPAPI user scope and the deletion inventory apply to.
5. **Restore on failure.** An interrupted or unverifiable migration closes the
   handle, restores the envelope, and rethrows with `restoredFromRollback`.
   The last complete state survives; a refusal that happened before any write
   never touches the file.
6. **Discharge at one safe checkpoint, never silently.** The envelope survives
   the migration itself. It is discharged only by `completeStartupCheckpoint()`
   after a fully verified, account-matched startup, or by a confirmed complete
   local deletion. Until then it is disclosed as `rollback-envelope` residue.

### Evidence is redacted by construction

`migrationEvidence()` and `PrivateAlphaService.startupContract()` return closed
enums, small integer revisions and booleans only. No title, ASIN, item count,
account key, timestamp or path is carried, so both values are safe to print at
startup, keep as verification evidence, and hand to a reviewer. Tests assert
this directly rather than trusting the convention.

### The account join

Stored library state belongs to exactly one account. `accountJoin()` compares
the connected account key with the stored one and returns a verdict only —
`no-local-data`, `not-connected`, `matched` or `mismatch` — so raw keys never
reach status, evidence or the UI.

* **Mismatch quarantines.** `status()` returns a content-free local record
  (`quarantined: true`, no count, marketplace, timestamp or key), `library()`
  refuses with `account-mismatch-local-data-quarantined` **before the sealed
  body is opened**, `sync()` refuses **before an attempt is recorded or the
  connector is asked for a library**, and deletion refuses outright.
  `assertFeedbackAccess()` refuses reads and writes of the other account's
  reviews. Nothing is written: the other account's data is not this session's
  to modify.
* **Deletion is owner-controlled, not session-controlled.**
  `deleteLocalSnapshotVerified()` resolves the join and then deletes. The
  synchronous `deleteLocalSnapshot()` the local API calls cannot re-ask the
  connector, so it requires a verdict resolved within
  `ACCOUNT_JOIN_FRESHNESS_MS` (120 s, matching the destructive-confirmation
  lifetime) and refuses `account-join-stale` otherwise. A refusal is
  recoverable; a wrong deletion is not.
* **Feedback is keyed by the account that owns the stored library**, never by
  whichever account happens to be connected.
* **Disconnected is not mismatched.** After an explicit disconnect the local
  snapshot still belongs to this Windows user; hiding or locking it would look
  like data loss rather than protection, so reads and owner-initiated deletion
  remain available.
* **Unverifiable is not matched.** If the connector cannot be asked, the verdict
  is `unverified`, reads still refuse, and nothing is mutated.
* `startupJoinCheck()` resolves the join at startup so a mismatched session is
  quarantined before the first read is served. It does not throw: the runtime
  must still start to explain itself.

### Where synthetic data may still appear
Only inside `test/` and `connector/test/`, using temporary directories and
fabricated identifiers, so that no personal data is ever committed. The private
runtime additionally refuses to *serve* `src/fixtures/` modules, so demo
material cannot be loaded into a real session even by accident.

---


| Area | Node | Python |
|---|---|---|
| Source contract | `test/source-contract.test.js` | `connector/test/test_contract.py` |
| Progress / identity / record policy | — | `connector/test/test_normalize.py` |
| Pagination completeness | — | `connector/test/test_pagination.py` |
| RPC boundary | — | `connector/test/test_rpc.py`, `test_service.py` |
| Reconciliation | `test/reconcile.test.js` | — |
| Sync transaction | `test/private-alpha-service.test.js` | — |
| Storage authority | `test/encrypted-snapshot-store.test.js` | — |
| Migration / rollback | `test/migration.test.js` | — |
| Runtime data requirement | `test/production-migration.test.js`, `test/private-alpha-service.test.js` | — |
| Feedback contract / store | `test/feedback.test.js`, `test/feedback-store.test.js` | — |
| Export / deletion | `test/export.test.js` | — |
| Release vs. legacy identity | `test/version.test.js`, `test/production-migration.test.js` | `connector/test/test_release_identity.py` |
