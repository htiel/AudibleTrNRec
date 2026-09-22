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

**Implemented:** the connector adapter exposes `sealSnapshot` through the
closed `seal_snapshot` RPC. If a supplied adapter lacks that capability, the
service still fails closed with `reconciled-seal-unavailable` and preserves the
prior snapshot rather than discarding retained records. The earlier adapter
handoff gap is no longer the normal runtime path.

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
  This is the storage/domain contract: the current UI offers only five whole-star
  radio choices plus Clear. Legacy fractional ratings remain readable and are
  not rounded on load or unrelated edits.
* Comment ≤ 4000 code points (NFC, astral-safe); tags ≤ 20 × 40 code points,
  case-insensitively de-duplicated with the first display form preserved.
* Unsupported controls and bidi overrides are **refused**, not stripped: silent
  removal would edit the user's words. Markup is stored verbatim as data.
* One active record per `(account, feedback target)`, immutable `createdAt`,
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

The existing `book_id`/`bookId` field also holds namespaced author, narrator and
series targets (`person:author:*`, `person:narrator:*`, `series:*`); no schema
revision is added. Group UI feedback uses overall rating, comment and tags,
separate from member books. Unknown/invalid group targets are not writable.
Author/narrator display groups normalize equal labels while preserving source
IDs; multi-source groups use a display-hash target. This does not merge catalog
identities or migrate prior feedback when a group's identity membership changes.

`GET /api/v1/feedback` lists the active account's non-deleted feedback once at
bootstrap, including group records, rather than fetching each book separately.
Browser consumers import `ABSENT_REVISION` from `src/core/feedback.js`, never
the Node-only persistence module. The store re-exports it for Node consumers.
Session/CSRF/confirmation protection does not authenticate local processes in
the keyless owner-only prototype; see the
[current boundary](../../../planning/0.0.2/12-accumulated-implementation.md#connection-and-current-trust-boundary).

Library filter preferences are separately stored in bounded tab-scoped
`sessionStorage`, including potentially private search/tag text; no encrypted
custody or secure-erasure claim applies. Drafts/focus/scroll are not serialized.
Only the closed LCARS/Liquid Glass theme identifier persists in `localStorage`
(`atnr:ui-theme:v1`). Neither preference mechanism changes feedback authority.

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
fact. The adapter now includes `local_artifact_inventory` in its closed
`CONNECTOR_METHODS` and exposes `localArtifactInventory()` with a narrowed
reply. `unknown` is the missing-capability/failure fallback, not the normal
result of an unfinished adapter handoff.

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

## 12. Provider synopsis text (issue #3)

Audible supplies book descriptions as **provider markup**. That markup is
untrusted input from a third party, and the application never renders, parses
as a document, or executes any of it.

`connector/atnr_connector/normalize.py::plain_text_from_markup` converts it to
bounded plain text at the ingestion boundary, so no downstream surface ever
holds markup at all:

| Rule | Behaviour |
|---|---|
| Vocabulary | A **closed** tag list. `<script>`, `<style>`, `<iframe>` and similar are dropped *with their contents*, including when unclosed. |
| Unknown tags | An angle bracket that does not open a known tag stays literal, so prose such as `5 < 6` survives unharmed. |
| Structure | `</p>`, `<br>`, `<li>` and block ends become paragraph separators; paragraphs are joined with a blank line. Inline tags become nothing. |
| Entities | Decoded **after** tags are removed, so `&lt;p&gt;` stays the literal text `<p>` and can never be promoted into structure. |
| Invisible characters | Zero-width, bidirectional-override, BOM and replacement characters are stripped, defeating bidi display spoofing. |
| Input bound | Markup over 64 KiB is refused outright. |
| Output bound | Results over 2,000 characters are **omitted, not truncated** — an optional field is either complete or absent, never a misleading fragment. |

The emitted `synopsis` is therefore plain text. A view may display it directly
as text content; it must never be inserted as HTML.

## 13. Series evidence (issue #4)

Missing metadata is not evidence. A title with no series information is
**unknown**, and only an authoritative statement may call it a standalone.

Closed vocabulary, identical in Python (`normalize.py::SERIES_EVIDENCE`) and
JavaScript (`src/core/model.js::SERIES_EVIDENCE`):

| Value | Meaning | Produced by |
|---|---|---|
| `provider-supplied` | The provider named a series for this title. | Ingestion, when a series is present. |
| `unknown` | Nothing is known about series membership. | Ingestion default. |
| `confirmed-standalone` | An authoritative source states this title belongs to no series. | **No current path.** Reserved. |

Rules:

- A provider may not assert `confirmed-standalone` by *omission*, and a
  provider-supplied `seriesEvidence` on an input record is ignored.
- A series record that exists but carries no name is a classified stop
  (`required-text-missing`), not a silent unknown.
- `src/core/library.js::seriesPresentation()` is the **only** place a label is
  chosen. Every surface reads `row.seriesLabel` / `detail.seriesLabel`, so the
  card, the group heading and the detail pane cannot disagree:
  `Series unknown` for `unknown`, `Not part of a series` for
  `confirmed-standalone`, the series name for `provider-supplied`.

## 14. Connection state (issue #8)

**Credential presence is custody, not proof.** Holding an authorization
envelope establishes only that a file exists on this computer; it says nothing
about whether Audible still honours it.

Closed vocabulary, mirrored in `connector/atnr_connector/service.py`,
`src/sync/private-alpha-service.js` and `ui/js/bootstrap-state.js`:

| State | Meaning |
|---|---|
| `disconnected` | No authorization is held. |
| `unverified` | An authorization is held, but no recent provider interaction has confirmed it works. |
| `verified` | A recorded, in-date provider interaction confirmed it. |
| `authorization-failed` | The provider refused the held authorization (HTTP 401/403 or an equivalent refusal). |

Rules:

- `verified` is produced **only** from an interaction the owner already asked
  for — device registration at connect time, or a successful library sync.
  There is **no probe**: `status()` performs no provider I/O.
- Verification expires after `VERIFICATION_FRESHNESS_SECONDS` (24 hours).
  A timestamp in the future never counts. A refusal at or after the last
  success wins.
- A transient failure (timeout, network error) is **never** reported as
  revocation; only an authorization refusal sets `authorization-failed`.
- Anything unrecognized resolves to `unverified`, which prompts a check rather
  than asserting health. The UI never derives a state of its own.
- The connector status field `connected` is **retained** with its original
  meaning — *an authorization envelope is held* — because lifecycle controls
  key off it. It is custody, not health. Health is `connectionState`.
- An authorization failure is recorded as evidence and reported through the
  existing allow-listed `library-sync-failed` code; no new error code is
  introduced at the process boundary.
- Because that code cannot distinguish "Audible refused us" from "the network
  was down", the **evidence recorded during the same requested sync** is what
  resolves it. After a failed sync the runtime re-reads the connector status
  (an evidence read, no provider access) so a revoked session cannot keep
  reporting `verified` until the next bootstrap:
  - `PrivateAlphaService.sync()` refreshes automatically; the thrown
    `PrivateAlphaServiceError` carries `connectionState`, and
    `connectionEvidence()` returns the cached verdict.
  - `PrivateAppStore.noteSyncFailure(codeOrError)` is the UI-side path;
    `refreshConnectionState()` and `applyConnectionInfo(info)` are the narrower
    primitives. None of them touch the library, feedback, drafts or session.
  - A refusal timestamp at or after the last success outranks any `verified`
    claim, on both sides of the boundary.
  - If the connector cannot be asked, the last known state stands: an
    unreachable runtime proves nothing and never upgrades a state.
- A refusal the connector observed but could **not persist** is still reported
  for the life of that process, so an unwritable evidence store cannot leave a
  refused session reading `verified`.
- Credential custody and the authorization policy are unchanged by this
  contract: it only decides what may honestly be *said* about them.

### Group feedback identity (issue #4 follow-up)

Feedback attached to an author, narrator or series group belongs to *the
person or series the owner reviewed*, not to however many provider identities
are merged into that group today.

| Target | Identity |
|---|---|
| Series group | `series:<seriesId>` — provider-stable, member-count free. |
| Person group | `person:<author\|narrator>:display-<16-hex hash of normalized label>` — **always**, regardless of member count. |

An earlier scheme keyed a person group on its single source identifier when it
had exactly one member and on the display hash otherwise, so a later sync that
merged or split a duplicate name silently moved the target and orphaned saved
feedback. Rules now:

- The canonical identity never changes with `sourceIdentityCount`.
- `aliasTargetIds` lists the legacy `person:<kind>:<personId>` identifiers for
  the group's current members. It is **person-only**; a series target omits the
  field rather than carrying a permanently empty list.
- Read order: the canonical record always wins. Aliases are consulted only when
  the canonical identifier holds nothing, so a migration can never shadow a
  record written under the current scheme.
- Migration order: the canonical record is written **first**, then the alias is
  retired using **its own revision** — so optimistic concurrency and account
  binding are unchanged, and a failure leaves two copies (canonical wins on
  read) rather than none. The outcome is reported as `aliasMigration`, never
  swallowed.
- If two or more aliases hold records the situation is ambiguous: the first is
  shown so nothing disappears, `aliasConflict` is set, and **no automatic
  migration or deletion runs**. The store does not guess which review the owner
  meant.

## 15. Bounded library presentation (issue #10)

The Library renders a **bounded page**, never the whole library. At 180 titles
the unbounded list produced a single page over 57,000 px tall on mobile; the
same shape at 1,000 or 20,000 titles is a navigation, assistive-technology and
memory problem, not merely a slow one.

`src/core/paginate.js` is the single contract every client inherits:

| Constant | Value | Meaning |
|---|---|---|
| `LIBRARY_PAGE_SIZE` | 50 | Maximum book rows on one ungrouped page. |
| `LIBRARY_GROUP_PAGE_SIZE` | 5 | Maximum groups on one grouped page. |
| `LIBRARY_GROUP_ROW_PAGE_SIZE` | 10 | Maximum rows inside one visible group. |
| `LIBRARY_GROUPED_ROW_CEILING` | 50 | Maximum rows on a grouped page. |
| `LIBRARY_ROW_CEILING` | 50 | Maximum rows on **any** Library page. |

Rules:

- **No "Show all".** There is no parameter, sentinel page or escape hatch that
  renders an unbounded list. Removing the bound requires a reviewed code
  change, not a click.
- **Counts stay true.** `matched` and `total` always describe the whole
  filtered library, and every group carries its real `total`. A bounded page
  never makes the library look smaller than it is.
- **Collapsed groups render zero rows** and still report their true size.
- **Deterministic.** Order is decided by sorting upstream and never
  re-derived. The same page of the same library is identical.
- **Complete.** Paging reaches every row exactly once; nothing is hidden.
- **Nothing is lost to navigation.** Filters, sort, grouping, collapse state,
  feedback targets and an unsaved draft all survive paging. Paging resets only
  when a *listing-changing* field changes (`PAGE_RESETTING_FIELDS`); scroll,
  focus and editor state do not reset it.
- `describePage()` produces the announced sentence, so the text and the rows
  cannot disagree.
- Paging position is persisted with the filters it belongs to
  (`library-filter-persistence.js`, state version 2), and every stored page
  value is validated, never trusted.
- Gated at 180 / 1,000 / 20,000 titles by `test/library-pagination.test.js`
  using `src/fixtures/large-library.js`. Those fixtures are synthetic and
  test-only; the private runtime still refuses to serve `src/fixtures/`.


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
| Synopsis plain text | — | `connector/test/test_normalize.py` |
| Series evidence | `test/model.test.js`, `test/library.test.js`, `test/private-library-state.test.js` | `connector/test/test_normalize.py` |
| Connection state | `test/bootstrap-state.test.js`, `test/private-alpha-service.test.js` | `connector/test/test_service.py` |
| Bounded library presentation | `test/library-pagination.test.js`, `test/library-filter-persistence.test.js`, `test/ui-store.test.js` | — |

## 16. Status and playback position are two facts (issue B2)

Audible reports a listening **status** and a recorded **playback position**
independently, and they legitimately disagree: a title can be marked finished
while the position reads 36%, because the owner skipped the credits, listened
on another device, or the provider closed the title out.

Neither value is ever rewritten to agree with the other, and neither is
inferred from the other. `LibraryRow.status` and `LibraryRow.percentComplete`
remain exactly what the source said.

`progressPresentation({ status, percentComplete, source })` in
`src/core/library.js` is the single authority for what may be *said* about
them. It is attached to every row as `row.progress`:

| Field | Meaning |
|---|---|
| `status`, `percentComplete` | the source values, unchanged |
| `statusKnown` | false only for the `unknown` status |
| `statusLabel` | `Marked finished by Audible`, attributed to the source |
| `statusSource`, `statusSourceLabel` | the provenance behind the status claim |
| `progressKnown` | false when no position was reported |
| `progressLabel` | `playback position 36%`, or `playback position unknown` |
| `statusProgressConflict` | true when a completed title has a position below 100% |
| `parts` | ordered `{kind, text}` pairs, deliberately **not** pre-joined |

Rules:

- The two labels are returned separately. A view may render them adjacently
  (for example `Marked finished by Audible · playback position 36%`), but the
  contract never hands back one merged sentence, because the two statements
  have different sources and different reliability.
- `0%` is a real position and prints as one. An absent position prints as
  unknown and is never shown as `0%`.
- `statusProgressConflict` is a flag for emphasis, not an error. Both values
  are still shown when it is set.
- An unrecognized status resolves to `Listening status unknown`; a prototype
  key such as `constructor` is not a status.

## 17. Provenance presentation (issue B3)

A provenance token is an internal identifier, not a sentence. Passing an
unrecognized one to the screen shows the owner a string they cannot evaluate
and implies we know where a fact came from when we do not.

`PROVENANCE_PRESENTATION` and `provenancePresentation(source)` in
`src/core/model.js` are the closed vocabulary:

| Source | `label` | `agent` | `live` |
|---|---|---|---|
| `audible-community-private-api` | Imported from Audible | Audible | true |
| `synthetic-fixture` | Imported (synthetic fixture) | a synthetic fixture | false |
| `local-user` | Local/synthetic annotation | you | false |
| `derived` | Derived | this app | false |
| `unknown` | Unknown provenance | an unknown source | false |

- Every token outside this table - including `null`, a non-string, and a
  prototype key - resolves to the `unknown` entry. Nothing passes through.
- `agent` exists so a sentence can name the claimant ("Marked finished by
  Audible") without any surface inventing its own wording.
- `ui/js/format.js` is owned by another stream. Its `formatProvenance()` still
  passes unknown tokens through; the labels above are byte-identical to the
  ones it already uses for the keys it knows, so it can delegate to
  `provenancePresentation()` with no change in existing output. That
  delegation is a coordination item, not a change made here.

## 18. Data-screen inventory (issue B7)

`PrivateAppStore.inventory()` (and the matching `AppStore.inventory()`) report
what is held on this device. Both are **strictly non-destructive**: a pure read
of state already in memory, starting nothing and deleting nothing.

```
{
  titles:     { known, count, libraryEntryCount, observedAt, basis, reason },
  feedback:   { known, count, basis, reason },
  lastImport: { known, basis, authority, observedAt,
                counts: {added, updated, reappeared, missingFromSource,
                                       unchanged, rejected}, source, reason }
}
```

The governing rule is that **`known` is reported separately from the value, and
a count appears only where evidence for it exists**:

- `titles.known` is true when a snapshot was actually read, or when local
  evidence states there is no snapshot. Otherwise the count is `null` with
  reason `no-snapshot-read` - not `0`.
- `feedback.known` is true only after the feedback list has been read.
  Before that the count is `null` with reason `feedback-not-loaded`. "We have
  not looked" and "there is nothing" are different facts.
- `AppStore` (synthetic runtime) has no feedback store at all and reports
  `not-applicable`, which is a fact about the runtime, not a count of zero.
- `loadInventory()` reads the feedback list first so the count can be
  reported. If that read fails, the inventory is still returned with feedback
  honestly marked unknown; one unreadable section never suppresses the others.

### `lastImport` is a provider import, not a snapshot parse

Loading the retained snapshot at startup validates it against an **empty**
base, so `lastImportReport.added` necessarily contains every retained title.
Publishing that as the latest import tells an owner with 12 retained titles
that Audible just delivered 12 new ones. It is a parse, not an import.

`basis` and `authority` are therefore explicit, so no consumer has to infer
whether the numbers are real by inspecting the numbers - a heuristic that
cannot work, because "12 titles arrived" and "12 titles were parsed" both
produce `added: 12`.

| `basis` | `authority` | `known` | Meaning |
|---|---|---|---|
| `sync-reconciliation` | `requested-sync` | true | A completed, requested sync reconciled against the previous stored snapshot. |
| `snapshot-load` | `local-snapshot-parse` | false | The retained snapshot was parsed. Reason `snapshot-parse-only`. |
| `synthetic-import-in-session` | `in-session-fixture-load` | true | `AppStore` only: a real in-session synthetic fixture import. |
| `none` | `null` | false | Nothing has been loaded. Reason `no-import-in-session`. |

- **Only `PrivateAppStore.noteSyncReconciliation(syncResult)` may set
  `known: true`.** It takes the result of `connectionApi.sync()` unchanged and
  reads its `reconciliation` block, which `reconcileSnapshot` produced against
  the previous stored snapshot. A result with no `reconciliation` block is
  refused with `sync-reconciliation-missing`; the inventory stays unknown
  rather than inventing a basis. Non-integer and negative counts are recorded
  as `null`, not coerced.
- `counts` is a fixed shape: `{added, updated, reappeared, missingFromSource,
  unchanged, rejected}`. Reconciliation does not measure `unchanged` or
  `rejected`, so they are `null` - never `0`, which would be a number we did
  not measure.
- `source` states where the held counts came from: `in-session-sync` (measured
  by this page) or `persisted-status` (restored from the record described
  below). It is `null` whenever `known` is false.
- Counts are **never reconstructed from the retained snapshot**. They are
  either measured in this session or restored from the persisted record of the
  sync that measured them.

### Persisted latest-import record

`performSync` records a reconciliation and then reloads, so an in-memory-only
measurement reverts to unknown within a second of being taken. The connector
therefore persists the counts of each completed sync, and the store restores
them.

The record is written by `PrivateAlphaService` to `last-import-counts.json` in
the same protected custody root as the deletion marker - a small versioned
JSON file, following the existing sidecar convention rather than changing the
frozen encrypted container schema. It holds **integers, timestamps and a
one-way binding only**: no title, identifier, account key, marketplace or
private text.

On disk:

```
{ version: 1, basis: 'sync-reconciliation', authority: 'requested-sync',
  observedAt, recordedAt, snapshotGeneration, accountBinding,
  counts: { added, updated, reappeared, missingFromSource } }
```

`accountBinding` is `sha256('atnr-last-import-binding:' + accountKey)`. The
account key itself never leaves the encrypted container; a digest is enough to
prove a record belongs to the account currently in custody.

Surfaced on `status().local.lastImport`, with `accountBinding` withheld and
`counts` widened to the full fixed shape (`unchanged` and `rejected` `null`):

```
{ version, basis, authority, observedAt, recordedAt, snapshotGeneration,
  counts: { added, updated, reappeared, missingFromSource,
            unchanged: null, rejected: null } }
```

`status()` performs no provider access, so reading this adds **no probe**.

Adoption is fail-closed at both ends. The record is `null` - and the inventory
stays unknown - unless every one of these holds:

| Check | Refusal |
|---|---|
| `version === 1`, `basis === 'sync-reconciliation'`, `authority === 'requested-sync'` | an older or foreign schema proves nothing |
| `accountBinding` matches the account currently in custody | no cross-account carryover |
| `snapshotGeneration` equals the stored snapshot's generation | superseded evidence is unknown, not stale truth |
| `observedAt` and `recordedAt` parse as instants | a record without a time is not evidence |
| all four counts are integers in `0..20000` | negative, fractional or missing counts are refused whole |
| the file parses | an unreadable record is unknown |
| the account join is not quarantined | a quarantined status carries `lastImport: null` |

Store-side, `PrivateAppStore` re-validates version, basis, authority, counts
and `observedAt` before adopting, in `loadPrivateSnapshot`, in
`applyConnectionInfo`, and in the public `noteStatusImport(status)`. **An
in-session measurement always wins**: adoption returns
`{ok: false, code: 'in-session-measurement-retained'}` rather than replacing
counts this page measured itself.

Lifecycle:

- Writing the record can never fail a sync that already succeeded; a failed
  write costs one reload's worth of knowledge, reported as unknown.
- `deleteLocalSnapshot`, `deleteLocalSnapshotVerified` and `purgeAllLocalData`
  remove the record: derived evidence must not outlive the data it describes.
  The generation binding refuses it even if the file removal fails.
- `disconnect` retains it. The local snapshot it describes is retained too,
  and a subsequent connection by another account fails the binding check.
- A snapshot store with no custody root (a test double) persists nothing and
  reports unknown, which is the honest answer.
- `titles.observedAt` and `lastImport.observedAt` (for `snapshot-load`) are
  the snapshot's observation instant: real evidence of when the provider was
  *observed*, not of an import we ran.
- Naming constraint: no code in this vocabulary may end with the word
  `import`. The module-graph scan in `test/ui-server.test.js` reads `import'`
  as the start of an import statement, exactly as a naive parser would, so
  `snapshot-parse-only` and `synthetic-import-in-session` are worded to avoid
  that ending rather than the scan being loosened.

This is separate from `connectionApi.deletionInventory()`, which is the
connector's pre-deletion manifest and remains unchanged.

## 19. Saved Library controls are keyed by schema (issue B10)

The session key for saved Library controls is
`atnr:private-library-filters:v<LIBRARY_FILTER_STATE_VERSION>`. It no longer
contains `ALPHA_VERSION`.

Keying it on the release meant every patch bump silently orphaned a valid
saved state: filters, sort, grouping, collapsed groups and page position
vanished on upgrade with no explanation, although the stored shape was still
supported. The state schema version is the only thing that determines whether
a stored value can be read, so it is the only thing in the key.

- `LEGACY_LIBRARY_FILTER_STORAGE_KEYS` lists the release-scoped keys earlier
  builds wrote. They are read once and **copied** to the canonical key.
- The schema-scoped key always wins, so a migration can never overwrite state
  the current build already saved.
- Nothing is ever erased. This module is forbidden to call
  `removeItem`/`clear` (enforced by `test/scan.test.js`) so a
  filter-persistence bug can never destroy unrelated browser state. A
  superseded legacy value is simply never read again while the canonical key
  exists, and it is per-tab, so it disappears with the tab. If the canonical
  write fails, the state is still restored for the current session.
- A legacy value that cannot be read is reported on each load until any valid
  state is saved under the canonical key. It is reported rather than silently
  dropped, and it is never deleted to suppress the message.
- Tab scope, all bounds (32 KB, 500-character query, 1000 collapsed groups,
  200 group row pages, page 1..1,000,000) and full validation are unchanged and
  applied to migrated values exactly as to new ones. Transient state (open
  editor, dirty draft, return focus, scroll) is still never persisted.
- `loadLibraryFilterState()` returns `{ ok, code, state, reset, migrated }`.
  `reset: true` with code `library-filter-state-outdated` is surfaced **only**
  for a well-formed envelope carrying an incompatible schema version. Corrupt,
  oversized or widened values remain `library-filter-state-invalid` and are
  never described to the owner as a routine reset.
- `PrivateAppStore.libraryStateNotice` turns that code into
  `{ code, kind: 'reset'|'error', text }` so no surface prints a machine token
  or invents wording.
