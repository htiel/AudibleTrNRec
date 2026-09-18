# 10 — Runtime data requirement (Alpha 0.0.2)

**Status:** binding runtime requirement for Alpha 0.0.2.
**Raised by:** owner, 2026-09-17. **Security owner:** Worf. **Data owner:** Data.

## Requirement

The user-facing Alpha 0.0.2 runtime **must** operate on the existing real,
encrypted Alpha 0.0.1 local library state.

1. **No synthetic or demo data in the user-facing runtime.** Synthetic fixtures
   remain permitted **only** in automated and adversarial tests, so that no
   personal data is ever committed to the repository.
2. **No silent synthetic fallback.** If the local API is absent, refused,
   unauthenticated, or cannot be verified, the runtime stops and says so. It
   must never seed a populated demo library and present it as the owner's
   listening history. A believable lie about someone's library is worse than a
   blunt refusal.
3. **Non-destructive, fail-closed migration.** The 0.0.1 encrypted source and
   the last complete snapshot are preserved. An unknown, partial or newer
   schema is refused, never rewritten, repaired or reseeded.
4. **Custody-bounded rollback.** Any rollback/backup envelope is created only
   inside the same protected local custody boundary as the state it protects —
   never a temporary directory, a synchronized folder, or a path reached by
   traversal or a link.
5. **No content in evidence.** No title, ASIN, identifier, item count, progress
   value or library content is printed, logged, exported to telemetry, or
   placed in a security event. Verification evidence is process-only or
   redacted.
6. **No mutation during implementation.** No live sync, disconnect, delete or
   account mutation is performed while the change is being built. Final local
   verification may use the existing encrypted state only after the automated
   tests pass.

## Division of ownership

| Area | Owner | Obligation |
|------|-------|-----------|
| Production migration path, real-data-compatible startup contract, store/view-model wiring | Data | Bring the 0.0.1 encrypted state forward non-destructively; ensure the private startup path never seeds synthetic fixtures. |
| Authentication, custody, and runtime-source enforcement | Worf | Prove the runtime is backed by verified real state before it serves; refuse synthetic material to a private session; keep evidence content-free. |

## Security controls implemented (Worf)

- `src/security/runtime-data-source.js` — closed `RUNTIME_DATA_SOURCES`
  vocabulary; `assertRealDataRuntime()` refuses any source other than
  `local-encrypted`, validates the custody root (absolute, real directory, not
  a link, not a staging/synchronized root), and requires the store and rollback
  paths to be contained in that root. The returned descriptor carries booleans
  and a fixed source name only — no path, count, identifier or timestamp.
- `scripts/serve.js` — the private runtime gate runs at startup, before the
  server listens. A failure prints a fixed reason code and exits non-zero; it
  never degrades to a synthetic runtime. The private server also refuses to
  serve `src/fixtures/**` (HTTP 403) so demo modules cannot be loaded into a
  session that presents itself as the owner's library.
- `/api/v1/session` — the authenticated bootstrap declares
  `{ dataSource, contractVersion, synthetic: false }`. An unverified runtime is
  declared `unverified`, never `local-encrypted`.
- `ui/js/connection-api.js` — `discover()` throws
  `private-alpha-runtime-unavailable` instead of returning "nothing", and
  throws `private-alpha-runtime-source-refused` if the server does not declare
  the real-data contract.
- `connector/atnr_connector/custody.py` — `custody_artifact_path()` resolves a
  migration/rollback artifact only as a plain file directly inside the hardened
  private root, after the root's ACL has been verified; traversal, sub-paths,
  absolute escapes and links are refused.
- `src/security/security-events.js` — `data-source` and `migration` event
  categories. Events record that a decision happened, never what the library
  contains.

## Data-side contract — landed and reviewed

The earlier “not yet landed” warning described an intermediate build and is
superseded by the amended implementation reviews and
[11 — final verdict](11-implementation-release-verdict.md).
The private entry now uses
[PrivateAppStore](../../code/Alpha0.x/ui/js/private-store.js), not the old
synthetic-seeded AppStore. Bootstrap verifies the real local source and
renders an explicit, focusable refusal on unavailable/unverified/unauthenticated
state. A private failure cannot fall back to fixtures.

The legacy fixture store is test/demo infrastructure only, not the owner's
user-facing runtime or an acceptable fallback. No new demo/runtime entry is
authorized by this documentation update.

Production migration is implemented and Data-approved for owner-only use:
revision 3, exact five-table schema, two transactionally recorded migrations
and a retained opaque account anchor when feedback survives snapshot removal.
The Captain supplied successful real migration and rollback-discharge evidence;
this task did not open the store or repeat it. No personal content appears in
the evidence. Scope is process/schema metadata only.

**Outstanding evidence:** RC-08 is not closed merely because event categories
exist: current events are memory-only and startup/custody/migration decisions
precede log construction. No durable startup/migration event receipt is claimed.
CP-02 full live proof, supply-chain acceptance and rendered iPhone evidence
also remain subject to 11's owner-versus-tester boundary.

## Verification expectations

- Automated tests must pass before any local run against the real encrypted
  state (`test/runtime-data-source.test.js`,
  `connector/test/test_custody_acl.py`).
- Local verification evidence is process-only or redacted: process started,
  gate passed/refused, reason code, ACL verified, rollback contained. No count,
  title, identifier or path.
