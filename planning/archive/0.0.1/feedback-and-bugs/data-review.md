# Data — Alpha 0.0.1 Architecture, Data, and Code Review

- **Reviewer:** Lieutenant Commander Data, Chief Operations Officer
- **Date:** 2026-09-17
- **Repository:** `htiel/AudibleTrNRec`
- **Commit reviewed:** `6145f9833281f8e9fb81a190377285b73892feff` ("Add private alpha Audible connector")
- **Baseline authority:** `APP_DESCRIPTION.md` (full read), `planning/0.0.1/*`
- **Measured baseline:** `npm test` → 156 tests, 155 pass, 0 fail, 1 skipped
  (`test/ui-server.test.js:154`, symlink creation not permitted), duration 4.93 s,
  Node v24.18.0, zero npm dependencies.
- **Runtime state:** no personal runtime state under `%LOCALAPPDATA%` was accessed,
  printed, modified, or summarized. No server was stopped and no Audible
  connection was disconnected. No implementation file was modified by this review.

---

## 1. Scope and files reviewed

Every line of the following was read at the reviewed commit.

**Python connector (`code/Alpha0.x/connector/atnr_connector/`)**

| File | Lines | Reviewed |
|---|---|---|
| `normalize.py` | 252 | full |
| `service.py` | 295 | full |
| `rpc.py` | 66 | full |
| `custody.py` | 260 | full |
| `policy.py` | 58 | full |

**Node core (`code/Alpha0.x/src/`)**

| File | Lines | Reviewed |
|---|---|---|
| `adapters/connector-process.js` | 126 | full |
| `sync/private-alpha-service.js` | 138 | full |
| `sync/live-snapshot.js` | 36 | full |
| `store/encrypted-snapshot-store.js` | 148 | full |
| `core/model.js` | 281 | full |
| `core/contract.js` | 322 | full |
| `core/validate.js` | 190 | full |
| `core/library.js` | 172 | full |
| `core/errors.js` | 63 | full |
| `core/trust.js` | 203 | full |
| `version.js` | 60 | full |

**Scripts / packaging:** `scripts/serve.js` (private-alpha API surface),
`scripts/private-alpha-runtime.js`, `package.json`.

**Fixtures and tests:** `connector/test/test_normalize.py`,
`connector/test/test_service.py`, `connector/test/test_custody.py`,
`connector/test/test_policy.py`, and the 18 `test/*.test.js` suites plus
`test/fixtures/adversarial.js` (coverage-gap audit).

---

## 2. Positive controls (verified working, keep these)

These are genuine engineering strengths and must not be regressed by the fixes below.

1. **Structural authority separation.** Source-owned and locally-owned fields are
   separated by *type*, not convention — `src/core/model.js:27-37`. A repeat import
   cannot reach local annotations because they are not reachable from the merge
   function. This directly satisfies the `APP_DESCRIPTION.md` §3 and §6 requirement
   that sync never overwrite user feedback.
2. **Idempotent merge with failure isolation and no silent deletion.**
   `src/core/model.js:231-270` isolates a bad record (`rejected` with a positional
   index and a closed diagnostic category), never duplicates a `bookId`, and flags
   `missingFromSource` rather than deleting. The design is correct — see finding
   C3 for the fact that the live path never uses it.
3. **Closed diagnostic vocabulary.** `src/core/errors.js:9-36` prevents hostile
   source text from reaching the UI or an export.
4. **No-prototype-pollution validation primitives.** `src/core/validate.js:24,157-175`
   (null-prototype copies, forbidden key rejection, bounded depth/array/string limits).
5. **Commercial exclusion by construction.** `src/core/trust.js:21-37,79-90,175-186` —
   allowlisted scoring projection, route-level rejection, token scan including
   `rank`/`bestseller`/`trending`. The trust principle is enforced structurally, as
   `APP_DESCRIPTION.md` demands ("impossible by design, not merely prohibited").
6. **No source identifiers leak into stored ids.** `connector/atnr_connector/normalize.py:49-51`
   hashes ASINs; asserted at `connector/test/test_normalize.py:34`.
7. **Credential/Node boundary.** The Node process never receives credentials; only
   a DPAPI-sealed blob and a normalized snapshot cross stdio
   (`connector/atnr_connector/service.py:226-230`, `src/store/encrypted-snapshot-store.js:63-110`).
8. **Sealed-payload validation at the store boundary.** Base64 canonicality *and*
   magic-header check — `src/store/encrypted-snapshot-store.js:75-84`. A non-sealed
   payload cannot be written.
9. **Single-writer storage invariants.** `singleton INTEGER PRIMARY KEY CHECK (singleton = 1)`,
   `STRICT` tables, `secure_delete = ON` — `src/store/encrypted-snapshot-store.js:25-40`.
10. **Sync coalescing.** Concurrent refreshes share one connector call
    (`src/sync/private-alpha-service.js:50-58`), asserted at
    `test/private-alpha-service.test.js:59-87`.
11. **Explicit-disconnect-only deregistration.** `service.py:239-246` plus the
    regression assertion at `test/private-alpha-service.test.js:56-58`.
12. **Bounded RPC and process I/O.** `rpc.py:12-29` (40 MB request cap, closed method
    and parameter set), `src/adapters/connector-process.js:5-6,84-101` (stdout/stderr
    caps, per-method timeouts, error-code allowlist `/^[a-z0-9-]{1,64}$/`).
13. **Policy gate is fail-closed.** `policy.py:24-47` rejects any non-private-alpha,
    non-`us`, >10-tester, or unblocked-shipping configuration.

---

## 3. Findings

Severity definitions: **Blocker** = alpha 0.0.1 cannot ship; **Critical** = data loss,
corruption, or persistent sync failure; **High** = incorrect user-visible data or a
structural defect that will be expensive later; **Medium** = requirement gap or
material performance/maintainability cost; **Low** = small correctness or efficiency item.

### BLOCKER

#### B1 — `percent_complete` unit inference corrupts listening progress

- **Evidence:** `code/Alpha0.x/connector/atnr_connector/normalize.py:137-141`

  ```python
  def _progress(value: Any) -> float | None:
      number = _number(value, minimum=0, maximum=100)
      if number is None:
          return None
      return round(number * 100 if number <= 1 else number, 3)
  ```

  Consumed at `normalize.py:189` and fed to status mapping at `normalize.py:144-154`.
  The same assumption is baked into both test suites:
  `connector/test/test_normalize.py:22,36` (`0.25` → `25`) and
  `connector/test/test_service.py:88,136` (`0.5` → `50`).
- **Reasoning:** The Audible `percent_complete` response group returns a percentage
  on a 0–100 scale, not a 0–1 fraction. Under this heuristic every genuine value in
  `(0, 1]` is multiplied by 100. A title at **1 % complete is stored as 100 %**; a
  title at 0.5 % is stored as 50 %. The heuristic is also *undecidable by
  construction*: no value in `(0, 1]` can be disambiguated, so the defect cannot be
  detected at runtime, only mis-rendered. `_status` (`normalize.py:150`) then reports
  `in-progress` at 100 % for a book barely started, and the library view
  (`src/core/library.js:57`) and any future recommender ("avoid titles already
  completed", `APP_DESCRIPTION.md` §4) consume the corrupted value.
- **Why Blocker:** The product's first stated purpose is an accurate record of
  listening progress. A silent, undetectable ×100 error on the primary progress field
  fails the core claim of the release.
- **Proposed fix:** Remove the heuristic. Treat `percent_complete` as a 0–100
  percentage exactly as the provider documents it; validate the range and record
  the scale in provenance:

  ```python
  def _progress(value: Any) -> float | None:
      number = _number(value, minimum=0, maximum=100)
      return None if number is None else round(number, 3)
  ```

  If a fraction-scaled source is ever added, carry an explicit per-source
  `progressScale` in the adapter, never an inferred one.
- **Acceptance test:** `connector/test/test_normalize.py` table test asserting
  `percent_complete` ∈ {0, 0.5, 1, 25, 42.9, 99.9, 100} normalizes to
  {0, 0.5, 1, 25, 42.9, 99.9, 100} and that `0.5` yields `status == "in-progress"`,
  not `50 %`. Add a JS assertion in `test/live-snapshot.test.js` that a 1 %
  entry is not rendered as completed.

### CRITICAL

#### C2 — A single duplicate ASIN aborts the entire library sync

- **Evidence:** `normalize.py:172-175` raises `NormalizeError("library-record-duplicate")`
  for a repeated `bookId`; pagination is page-index based with no stable cursor at
  `service.py:194-213` (`page=page`, `num_results=1000`); the whole call is converted
  to `library-normalization-failed` at `service.py:234-235`.
- **Reproduction / reasoning:** Page-offset pagination over a mutable collection is
  not stable. If the library changes (a purchase, a return, a re-sort) between the
  fetch of page *n* and page *n+1*, items shift: one item is returned twice and one
  is skipped. The duplicate then aborts the **entire** import, and the skipped item
  is lost silently. Any tester with an active account can hit this; a long library
  (multiple pages) makes it more likely, and there is no retry or reconciliation.
  The duplicate rule cannot distinguish "pagination artifact" from "genuine
  duplicate edition".
- **Proposed fix:** (a) Deduplicate by `bookId` at ingestion — keep the first
  occurrence and report a bounded count, never abort; (b) request a deterministic
  sort key from the provider and record a checkpoint per page; (c) verify the total
  against the provider's reported count and re-run one bounded retry if the deduped
  count differs. Reuse the existing isolation contract from
  `src/core/model.js:231-245` rather than inventing a second policy.
- **Acceptance test:** Python test with a two-page `FakeClient` whose pages overlap
  by one ASIN and omit another: assert the sync succeeds, `itemCount` equals the
  distinct count, the duplicate is reported once as `duplicate-record`, and the
  snapshot contains exactly the distinct set.

#### C3 — One malformed record aborts the whole import (no failure isolation in the connector)

- **Evidence:** `normalize.py:170-171` (`asin`/`title` required), `normalize.py:75`
  (contributor `name` required), `normalize.py:102` (series `title` required). Each
  raises `NormalizeError`, which `service.py:234-235` converts into a total sync
  failure.
- **Reasoning:** The Node core deliberately isolates bad records
  (`src/core/model.js:231-240`, "one bad record must not abort the import"). The
  connector adopts the opposite policy for the same data. A single title with a
  blank narrator name, a series entry missing a title, or a catalog record with a
  1000-character title therefore blocks **all** synchronization for that account,
  indefinitely, with the opaque code `library-normalization-failed`. The user has no
  remediation path.
- **Proposed fix:** Normalize per record inside a `try/except NormalizeError`;
  append `{"recordIndex": i, "category": <closed vocabulary>}` to a
  `snapshot.rejected` array (bounded, e.g. 200 entries plus a count); fail the whole
  sync only if the rejected ratio exceeds a declared threshold (e.g. > 10 % or
  100 % of records). Surface the count in status, per `APP_DESCRIPTION.md` §6
  ("Show sync progress and actionable failures").
- **Acceptance test:** Normalize a batch of three records where the middle one has
  a contributor with no name: assert two books/entries are produced, one rejection
  is reported with a closed category, and no raw source value appears in the report.

#### C4 — Source-deletion reconciliation is never executed on the live path

- **Evidence:** `src/sync/live-snapshot.js:28-31` merges against an empty previous
  set: `mergeLibrarySnapshot([], raw.entries, …)`. The store keeps a single
  overwriting row: `src/store/encrypted-snapshot-store.js:63-110`
  (`ON CONFLICT(singleton) DO UPDATE SET … sealed_payload = excluded.sealed_payload`).
- **Reasoning:** `APP_DESCRIPTION.md` §6 requires "Reconcile source deletions or
  missing titles without silently deleting local user data", and `model.js:258-264`
  implements exactly that (`missingFromSource`). Because the live path never passes
  the previous entries, `report.added` is always the whole library,
  `report.updated`/`unchanged`/`missingFromSource` are always empty, and a title
  that disappears from Audible is silently removed from the local snapshot on the
  next sync. The one genuinely valuable diff in the system is dead code in
  production, and there is no evidence trail proving the import was idempotent.
- **Why Critical:** It is data loss today for source-removed titles, and it removes
  the anchor that locally-owned ratings will need in the next release.
- **Proposed fix:** Unseal the previous snapshot (or persist the previous entries
  alongside the sealed payload), pass it as `previousEntries`, persist the resulting
  merged entries plus a bounded `report`, and store the report summary counts in
  `sync_state`. Keep the singleton row, but make its content the merged result, not
  the raw import.
- **Acceptance test:** Sync snapshot A (2 books) then snapshot B (1 book, the other
  removed): assert the stored snapshot still contains both `bookId`s, the removed
  one carries `missingFromSource: true`, and a third identical sync produces a
  byte-identical stored payload (idempotency).

### HIGH

#### H1 — Snapshot validation does not check entry → catalog referential integrity

- **Evidence:** `src/sync/live-snapshot.js:26-34` builds the `Catalog` and merges
  entries independently; there is no assertion that every `entry.bookId` resolves to
  a catalog book, nor that counts agree. The consumer then drops orphans silently:
  `src/core/library.js:38` — `if (!book) continue;`.
- **Reasoning:** `Catalog` enforces book → person/facet integrity
  (`src/core/model.js:196-206`) but nothing enforces entry → book. A connector bug
  (e.g. C3 partially applied, or the dedupe in C2) can yield entries without books;
  the UI then shows fewer titles than `itemCount` with no diagnostic. The
  `validated.entries.length !== result.itemCount` guard at
  `src/sync/private-alpha-service.js:65-67` does not catch it, because the entry
  count is still correct.
- **Proposed fix:** In `validateLiveSnapshot`, after the merge, assert
  `entries.every((e) => catalog.book(e.bookId))` and throw a
  `ValidationError('snapshot.entries: unresolved bookId', …, 'invalid-identifier')`.
  Optionally assert `catalog.books.size === entries.length` for this source.
- **Acceptance test:** `test/live-snapshot.test.js` case with an entry whose
  `bookId` is absent from `catalog.books`: assert it throws, and assert
  `buildLibraryView` row count equals entry count for a valid snapshot.

#### H2 — Account isolation can diverge: connected account B, displayed library A

- **Evidence:** `src/sync/private-alpha-service.js:37-43`

  ```js
  const local = this.snapshotStore.status();
  if (local.accountKey && local.accountKey !== connection.accountKey) {
    await this.connector.disconnect();
    throw new PrivateAlphaServiceError('different-account-local-data-exists');
  }
  ```

  `library()` at lines 85-96 and `status()` at lines 29-32 perform **no** account-key
  comparison.
- **Reasoning:** If the guard's `connector.disconnect()` itself fails
  (`service.py:243-244` → `deregistration-unconfirmed`), account B's credentials
  remain sealed on disk while account A's snapshot remains in SQLite. From then on
  `status()` reports connected-as-B (alias, `registeredAt`, `accountKey` from the
  connector) merged with `local` metadata from A, and `/api/v1/library`
  (`scripts/serve.js:137-141`) serves A's titles. The storage layer stays safe
  (`encrypted-snapshot-store.js:65-70` blocks the cross-account write), but the
  *presentation* is a cross-account mix — the one thing a personal listening app
  must never do.
- **Proposed fix:** Make the account key the join condition, not an incidental
  field. In `status()` return an explicit `accountMatch: connection.accountKey === local.accountKey`
  flag, and in `library()` return `null` (plus a `local-snapshot-account-mismatch`
  code) whenever the connected account key differs from the stored one. Keep the
  connect-time guard, but treat the failed rollback as a distinct, surfaced state.
- **Acceptance test:** Service test with a connector whose `disconnect()` rejects
  and whose `status()` returns account B while the store holds account A: assert
  `library()` resolves to `null`/mismatch error and `status().accountMatch === false`.

#### H3 — Declared Node engine cannot run the storage layer

- **Evidence:** `code/Alpha0.x/package.json:9` — `"node": ">=20.6.0"`;
  `src/store/encrypted-snapshot-store.js:3` — `import { DatabaseSync } from 'node:sqlite';`
- **Reasoning:** `node:sqlite` / `DatabaseSync` does not exist before Node 22.5 and
  is still flagged experimental in the 22.x line. On a declared-supported Node 20.6
  runtime, `createPrivateAlphaRuntime` (`scripts/private-alpha-runtime.js:9`) throws
  `ERR_UNKNOWN_BUILTIN_MODULE` at import time — the private-alpha mode is
  unstartable, and the failure is an unclassified crash, not a policy error.
  Verified locally on Node v24.18.0 (works); the contradiction is in the contract.
- **Proposed fix:** Raise `engines.node` to the version actually required
  (`>=22.5.0`, preferably `>=22.11.0` LTS), and add a startup guard in
  `private-alpha-runtime.js` that converts an unsupported runtime into a named,
  user-readable code (`node-runtime-unsupported`).
- **Acceptance test:** Extend `test/version.test.js` to assert
  `engines.node` satisfies the minimum required by every `node:` builtin imported
  under `src/` (at minimum: assert `>=22.5.0` while `node:sqlite` is imported).

#### H4 — Identifier instability breaks future feedback reconciliation

- **Evidence:** `normalize.py:76` (`_text(raw.get("asin")…) or f"name:{name}"`),
  `normalize.py:103` (series), `normalize.py:129` (genre), and
  `normalize.py:196` (`workId` derived from `origin_asin or asin`).
- **Reasoning:** Identity falls back to the display name whenever the provider omits
  an ASIN on that record. Two consequences: (1) the same person/series gets a
  *different* stable id on a later sync as soon as the provider does include the
  ASIN, and (2) two distinct people who share a name collapse into one id.
  `APP_DESCRIPTION.md` §3 requires that "If a catalog merge changes an author,
  narrator, series, or genre identifier, existing feedback must be safely reconciled
  rather than discarded." With name-derived ids there is no reconciliation key at
  all — the alpha is minting ids that the next release cannot follow.
- **Proposed fix:** Record the id *basis* alongside the id
  (`idBasis: "source-asin" | "display-name"`), and persist an alias table mapping
  name-derived ids to source-derived ids the first time an ASIN is observed, so a
  later sync can migrate feedback instead of orphaning it. Same treatment for
  `workId` when `origin_asin` first appears.
- **Acceptance test:** Normalize the same author twice — first without `asin`, then
  with — and assert the alias mapping links the two `personId`s and that no
  duplicate person record is produced.

#### H5 — Contributor identity is fragmented by role, and the role-merge branch is unreachable

- **Evidence:** `normalize.py:78` — `person_id = _identifier("person", f"{role}:{source_id}")`,
  with the merge branch at `normalize.py:79-82`:

  ```python
  existing = people.get(person_id)
  if existing:
      if role not in existing["roles"]:
          existing["roles"].append(role)
  ```

- **Reasoning:** Because `role` is part of the hashed key, any record found under a
  given `person_id` was created with that same role. `role not in existing["roles"]`
  can never be true: lines 80-82 are dead code. The functional consequence is that an
  author who also narrates their own book becomes **two** catalog people with two
  ids, so `APP_DESCRIPTION.md` §3 facet feedback ("Five stars for narrator Wil
  Wheaton") will attach to only half of the person's works.
- **Proposed fix:** Key the person on `source_id` only and let `roles` accumulate;
  keep `role` out of the digest. Then lines 79-82 become live and correct.
- **Acceptance test:** Normalize one record where the same ASIN appears in both
  `authors` and `narrators`: assert exactly one person record with
  `roles == ["author", "narrator"]`, and that the book references the same
  `personId` in both `authorIds` and `narratorIds`.

#### H6 — No bounded backoff; attempt time is not recorded before the attempt

- **Evidence:** `src/sync/private-alpha-service.js:113-126` — fixed
  `setInterval(run, intervalMinutes * 60_000)` with no failure counter and no
  transient-error retry; `src/store/encrypted-snapshot-store.js:100-105` writes
  `last_attempt_at = observedAt` (a connector-supplied success timestamp), and
  `recordFailure` (lines 121-133) is the only writer of a real attempt time.
- **Reasoning:** `APP_DESCRIPTION.md` §6 requires "Retry transient failures with
  bounded backoff" and "Record the last attempted and last successful
  synchronization times." Today a persistent failure (rate limit, expired device)
  is retried at a constant 15-minute cadence forever with no escalation, and a
  process crash mid-sync leaves `last_attempt_at` stale because no attempt row is
  written before the connector call.
- **Proposed fix:** Write `last_attempt_at = new Date().toISOString()` *before*
  invoking the connector; add exponential backoff with a cap and jitter keyed off a
  persisted `consecutive_failures` column; distinguish transient
  (`connector-timeout`, `library-sync-failed`) from terminal
  (`stored-authorization-invalid`) codes and stop retrying terminal ones.
- **Acceptance test:** Store test asserting `lastAttemptAt` advances even when the
  connector throws before returning; service test with a fake clock asserting the
  retry intervals grow and are capped after N consecutive failures.

#### H7 — Two sync-state authorities can disagree; success is recorded before it is durable

- **Evidence:** `connector/atnr_connector/service.py:223-225`

  ```python
  envelope["auth"] = auth.to_dict()
  envelope["lastSuccessfulSyncAt"] = observed_at
  self.store.write(envelope)
  ```

  This runs *before* the Node side validates (`private-alpha-service.js:64-67`) and
  persists (line 68). The connector's value is surfaced to the UI at
  `service.py:287` and merged with the SQLite value at
  `private-alpha-service.js:29-32`.
- **Reasoning:** If validation or the store write fails, the connector permanently
  claims a successful sync at time T while no snapshot exists locally. The user sees
  "last successful sync: just now" beside an empty library. There is no single
  source of truth for sync state.
- **Proposed fix:** The connector should record `lastAttemptAt` only; durable
  success belongs solely to the Node store, which owns the persisted snapshot.
  Alternatively, have Node acknowledge success back to the connector in a second RPC.
  Choose one authority and delete the other field.
- **Acceptance test:** Service test where `snapshotStore.save` throws: assert the
  reported status does not contain a `lastSuccessfulSyncAt` newer than the last
  durable snapshot.

### MEDIUM

#### M1 — Required library fields are hard-coded to null despite being requested

- **Evidence:** `normalize.py:232-235` (`positionSeconds`, `lastListenedAt`,
  `completedAt` always `None`), `normalize.py:212` (`coverRef: None`) while the
  `media` and `listening_status` response groups are requested at
  `service.py:29-41`.
- **Reasoning:** `APP_DESCRIPTION.md` §2 lists current listening position, last
  listened date, completion date, and cover image reference as tracked fields, and
  `library.js:17` exposes `lastListenedAt`/`completedAt` as sort fields that can
  never be non-null. The system requests bytes it discards — pure waste — and the UI
  sort controls are inert.
- **Proposed fix:** Map the available fields (`last_listened_date` / listening-status
  payload, `is_finished` + completion timestamp, `product_images` URL reference) or
  remove the unused response groups and the dead sort fields. Do not ship inert UI
  affordances.
- **Acceptance test:** Normalization test asserting a record with a listening
  position and a finished date produces non-null `positionSeconds`,
  `lastListenedAt`, `completedAt`; UI test asserting sort fields exist only for
  populated columns.

#### M2 — Date-only and naive timestamps are silently discarded

- **Evidence:** `normalize.py:54-64`, specifically lines 62-63:
  `if parsed.tzinfo is None: return None`.
- **Reasoning:** Audible commonly returns `release_date` as a date-only string
  (`"2019-03-12"`). `datetime.fromisoformat` parses it with `tzinfo is None`, so
  `releaseDate` becomes unknown for most of the catalog — silently, with no
  provenance note. The library view then sorts these last permanently
  (`library.js:88-92`).
- **Proposed fix:** Treat a date-only value as midnight UTC on that date and record
  `dateGranularity: "day"` in provenance; keep the rejection only for ambiguous
  datetime values with no zone.
- **Acceptance test:** `_date("2019-03-12")` → `"2019-03-12T00:00:00.000Z"` with a
  day-granularity marker; `_date("2019-03-12T10:00:00")` remains unknown.

#### M3 — Only the first series is retained, from an unordered list

- **Evidence:** `normalize.py:96-108` — `raw = raw_series[0]`.
- **Reasoning:** Titles belong to multiple series (main series plus collection/box
  set). Element `[0]` is not documented as the primary series, so series membership
  and `seriesPosition` are arbitrary for multi-series titles. `APP_DESCRIPTION.md`
  §4 requires "Later series entries when earlier required entries have not been
  completed" to be excluded — that rule cannot be computed from an arbitrary series.
- **Proposed fix:** Keep the full list as `seriesMemberships: [{facetId, position}]`
  with a deterministic primary-selection rule (lowest position, tie-broken by
  facetId), and retain `seriesId`/`seriesPosition` as the derived primary.
- **Acceptance test:** A record with two series produces two facets, a deterministic
  primary, and identical output across repeated runs.

#### M4 — Candidate rejection reports leak raw messages and unvalidated ids

- **Evidence:** `src/core/contract.js:293-299`

  ```js
  rejected.push({
    candidateId: typeof raw?.candidateId === 'string' ? raw.candidateId : 'unknown',
    code: error.code ?? error.details?.rule ?? error.name,
    message: error.message,
  });
  ```

  Messages embed source values, e.g. `contract.js:255` and `trust.js:196-199`.
- **Reasoning:** This contradicts the project's own closed-vocabulary rule
  (`src/core/errors.js:5-18`, "never a raw source value and never `error.message`"),
  which `model.js:231-237` honours. `candidateId` is echoed without `safeId`, so it
  is unbounded and unsanitized. Today the input is synthetic fixtures; the same
  function is the template for the live recommender path.
- **Proposed fix:** Emit `{ candidateIndex, code }` using the closed code set, run
  `candidateId` through `safeId` (falling back to `'unknown'`), and drop `message`
  from the returned structure (keep it in the thrown error for developer logs only).
- **Acceptance test:** Extend `test/adversarial.test.js` with a candidate whose
  `candidateId` contains a canary string and assert the canary never appears in
  `validateCandidateSet(...)` output.

#### M5 — Snapshot `observedAt` is never validated but becomes local sync truth

- **Evidence:** `src/sync/live-snapshot.js:8-34` validates every top-level key
  except the *format* of `observedAt`; it is then persisted as both
  `observed_at` and `last_success_at` at `src/store/encrypted-snapshot-store.js:96-105`.
- **Reasoning:** A connector-supplied string of any shape becomes the authoritative
  local "last successful sync" timestamp. Model-level fallback
  (`model.js:47`, `observedAt ?? SYNTHETIC_NOW`) means a missing value silently
  substitutes the fixed synthetic clock `2026-09-16T12:00:00.000Z`
  (`src/version.js:60`) into *live* provenance.
- **Proposed fix:** Require `safeIsoDate(raw.observedAt, 'snapshot.observedAt', { required: true })`
  in `validateLiveSnapshot`, and forbid the `SYNTHETIC_NOW` fallback when
  `source === AUDIBLE_PRIVATE_SOURCE`.
- **Acceptance test:** `validateLiveSnapshot({...snapshot, observedAt: 'yesterday'})`
  throws; a snapshot with no `observedAt` throws rather than inheriting the
  synthetic clock.

#### M6 — Connector RPC serialization and double snapshot transport

- **Evidence:** `src/adapters/connector-process.js:49-53` (single promise queue for
  all methods) with a 10-minute sync timeout at line 38; `service.py:226-230` returns
  **both** `snapshot` (plaintext JSON) and `sealedSnapshot` (base64 of the same data);
  `private-alpha-service.js:86-88` spawns a fresh Python process per `library()` call.
- **Measurement (projected):** a 20 000-item library at ~1.5 KB/record normalized is
  ≈ 30 MB; the dual return transports ≈ 30 MB plaintext + ≈ 40 MB base64 ≈ 70 MB
  through a single stdout pipe per sync, against a 40 MB cap
  (`connector-process.js:5`) — i.e. large libraries will fail on the transport limit
  before they fail on the 25 MB response cap (`service.py:28`). Meanwhile every UI
  library read spawns a process, unseals up to 32 MB, and re-validates the entire
  snapshot; and it queues behind an in-flight sync for up to 10 minutes.
- **Proposed fix:** Return only `sealedSnapshot` from `sync_library` and have Node
  unseal once if it needs the plaintext; cache the validated snapshot in memory,
  keyed by `observedAt`, so `library()` does not spawn a process per request; give
  read methods a separate queue (or a short-lived resident connector process) so a
  long sync does not block reads.
- **Acceptance test:** Measure and assert: one `sync()` followed by three
  `library()` calls spawns at most two connector processes; assert the sync response
  size for an N-item fixture is within 1.4× of the sealed payload size.

#### M7 — Response-size accounting re-serializes every page

- **Evidence:** `service.py:206-210` — `json.dumps(response, …)` per page purely to
  measure bytes.
- **Reasoning:** This duplicates the entire library in memory and CPU once more per
  sync (≈ 30 MB of transient allocation and a full serialization pass for a large
  library) to compute a number the HTTP layer already knows.
- **Proposed fix:** Accumulate `len(page_items)` against an item cap and, if a byte
  cap is genuinely needed, read `Content-Length` from the underlying response rather
  than re-encoding.
- **Acceptance test:** Benchmark test asserting normalization of an N-item fixture
  performs a single serialization pass (or simply that `json.dumps` is not called in
  the pagination loop).

### LOW

#### L1 — An exactly-20 000-item library fails instead of succeeding

- **Evidence:** `service.py:194` (`for page in range(1, MAX_PAGES + 1)`),
  lines 212-215 (`if len(page_items) < PAGE_SIZE: break … else: raise ConnectorError("library-page-limit")`).
- **Reasoning:** When page 20 returns a full 1 000 items, the loop completes normally
  and the `else` clause raises — even though the library was fully retrieved and is
  exactly at the store's own 20 000 cap (`encrypted-snapshot-store.js:73`).
- **Proposed fix:** After the loop, probe page `MAX_PAGES + 1`; raise only if it
  returns items. Or use the provider's total count when available.
- **Acceptance test:** A fake client returning 20 full pages then an empty page
  syncs successfully with `itemCount == 20000`.

#### L2 — A stale temp file can permanently block credential writes

- **Evidence:** `custody.py:208-218` — `temporary = root / f".{self.path.name}.{os.getpid()}.tmp"`
  opened with mode `"xb"` (exclusive create).
- **Reasoning:** If the process is killed between create and the `finally` unlink, a
  stale file remains. A later process with a recycled PID then fails
  `FileExistsError`, which is not a `CustodyError` and surfaces at `rpc.py:58-59` as
  the opaque `connector-internal-error` with no self-healing path.
- **Proposed fix:** Include a random suffix (`secrets.token_hex(8)`) in the temp
  name and sweep stale `.tmp` files older than a few minutes on `ensure_private_root`.
- **Acceptance test:** Pre-create a stale temp file with the same name and assert
  `write()` still succeeds.

#### L3 — Over-long optional text is dropped with no signal

- **Evidence:** `normalize.py:31-34` — returns `None` when the cleaned value exceeds
  the maximum; asserted as intended at `connector/test/test_normalize.py:50-56`.
- **Reasoning:** Not truncating is correct (no fabricated data). But downstream,
  "absent" and "too long to store" are indistinguishable: `unknownFields`
  (`model.js:55-58`) will report `synopsis` as unknown, and the UI will honestly
  display "unknown" for data the provider actually supplied.
- **Proposed fix:** Return a sentinel alongside the value (e.g. add
  `"omittedFields": ["synopsis"]` to the book record) so provenance can distinguish
  *missing at source* from *omitted by policy*.
- **Acceptance test:** A 2001-character summary produces `synopsis: null` **and**
  `omittedFields` containing `synopsis`.

#### L4 — A failure inside `recordFailure` masks the original error

- **Evidence:** `src/sync/private-alpha-service.js:80-84` — `recordFailure` is
  called inside the catch and is not itself guarded.
- **Proposed fix:** Wrap in `try { … } catch { /* keep the original code */ }` and
  always rethrow the original `PrivateAlphaServiceError`.
- **Acceptance test:** Service test with a `recordFailure` that throws: assert the
  caller still receives the original sync error code.

#### L5 — Four subprocess spawns per secure write

- **Evidence:** `custody.py:127-150` — `whoami` and `icacls` are invoked via
  `subprocess.run` in `_current_user_sid`/`secure_path`, and `write()` calls
  `secure_path` twice (lines 214, 216) plus `ensure_private_root` (line 201) once,
  each of which re-runs `whoami`.
- **Reasoning:** ≈ 4–6 process launches (~50–150 ms on Windows) per credential
  write, repeated on every sync (`service.py:225`). The SID is invariant for the
  process lifetime.
- **Proposed fix:** Cache the SID in a module-level variable (or read it via
  `ctypes`/`win32security` with no subprocess) and apply the ACL once per file
  creation, not on every replace.
- **Acceptance test:** Assert `_current_user_sid` is evaluated at most once per
  process across repeated `write()` calls.

---

## 4. Test-gap assessment

Measured baseline: 156 JS tests (155 pass / 1 skipped) plus 4 Python test modules.
Breadth is good; depth on the *data* path is not.

| Area | Status | Gap |
|---|---|---|
| Progress normalization | **Wrong assumption codified** | `test_normalize.py:36-39` and `test_service.py:136` assert the B1 heuristic as correct. Needs a value table, not a single pair. |
| Status mapping | Partial | Only `in_progress` is covered (`test_normalize.py:20-21`). No coverage of `is_finished`, `not_started`, unknown fallback, or the `percent > 0` branch (`normalize.py:150`). |
| Pagination | **None** | `FakeClient.get` (`test_service.py:75-93`) returns one page and checks only `num_results == 1000`. No multi-page, page-limit, duplicate-across-pages, or byte-cap test. |
| Whole-sync abort on one bad record | **None** | `test_normalize.py:41-48` covers duplicates at function level only. |
| Account isolation | Partial | Store-level mismatch covered (`test/encrypted-snapshot-store.test.js:28-34`). No test for the connect-guard rollback failure (H2) or for `library()`/`status()` mismatch. |
| Store atomicity / rollback | **None** | No injected mid-save failure. `test/private-alpha-service.test.js:45-51` uses a no-op `save`. |
| `recordFailure` | **None** | No-op stub at `test/private-alpha-service.test.js:47,78-81`; failure persistence is unasserted. |
| Scheduler / backoff | **None** | No timing, coalescing-under-scheduler, or backoff test. |
| Seal/unseal failure paths | **None** | Only success round-trips (`test_custody.py:42-47`). `ReversibleProtector` (`test_custody.py:16-23`) is a toy transform and cannot catch key-handling errors. |
| Connector process limits | **None** | Timeout, stdout/stderr caps, launch failure, and malformed-JSON paths (`connector-process.js:73-113`) are untested. |
| RPC dispatch | **None (Python side)** | `rpc.py:31-47` closed-method/param logic has no direct test. |
| Entry↔catalog integrity | **None** | `test/live-snapshot.test.js` asserts shape and marketplace only. |

**Recommended minimum additions before the gate:** the eight acceptance tests named
in findings B1, C2, C3, C4, H1, H2, H3, H6.

---

## 5. Requirement traceability (APP_DESCRIPTION.md)

| Requirement | Status |
|---|---|
| §2 track progress / position / last listened / completion / cover | **Not met** — B1, M1 |
| §2 listening states (incl. abandoned, want-to-listen) | Partial — `normalize.py:144-154` emits 4 of 6 |
| §3 local feedback never overwritten by sync | Met structurally (`model.js:27-37`) — no local store yet |
| §3 identifier change must reconcile feedback | **Not met** — H4, H5 |
| §6 initial full import + manual refresh | Met (`private-alpha-service.js:50-84`) |
| §6 record last attempted and last successful sync | Partial — H6, H7 |
| §6 retry transient failures with bounded backoff | **Not met** — H6 |
| §6 avoid duplicate books / history records | Met in model, **broken in connector** — C2 |
| §6 reconcile source deletions without silent deletion | **Not met** — C4 |
| §6 idempotent import | Unproven on the live path — C4 |
| Trust: no advertising / paid placement | Met, structurally enforced (`trust.js`) |
| Trust: no identity/ideology profiling | Met (`trust.js:72-78`, `contract.js:86-92`) |
| Alpha exception: credentials never reach Node/browser | Met (`service.py`, `custody.py`) |
| Alpha exception: device persists until explicit disconnect | Met and regression-tested |

---

## 6. Verdict

**FAIL — alpha 0.0.1 data gate not passed at commit `6145f98`.**

The security custody model, trust enforcement, closed contracts, and validation
primitives are of high quality and should be preserved unchanged. The failure is
confined to the data path introduced by this commit:

- **1 Blocker (B1)** silently corrupts the release's primary field, listening progress.
- **3 Criticals (C2, C3, C4)** make synchronization abort-prone, unrecoverable from a
  single bad record, and unable to reconcile source deletions — the three properties
  `APP_DESCRIPTION.md` §6 explicitly requires.
- **7 Highs** include a declared runtime that cannot execute the storage layer (H3)
  and a representable cross-account display state (H2).

**Conditions to convert this to a pass:**

1. Fix **B1** and prove it with a value-table test. Non-negotiable.
2. Fix **C2**, **C3**, **C4** and land their acceptance tests.
3. Fix **H1**, **H2**, **H3** (H3 is a one-line manifest correction plus a guard).
4. Land **H4**/**H5** or record a written, Riker-sequenced deferral with an
   identifier-migration story in the next release — feedback reconciliation depends
   on it.
5. **H6**, **H7**, and the Medium findings may be sequenced as enabler stories
   provided the sync-state authority (H7) is decided before any second data
   consumer is added.

Re-review required after items 1–3 land. Hand the sequencing of items 4–5 to
Commander Riker; coordinate M4 disclosure wording with Worf and M1 inert-sort-field
removal with Geordi.

*"An inference about units is not a measurement. I recommend we stop guessing."*
— Lt. Cmdr. Data
