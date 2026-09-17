# Worf — Alpha 0.0.1 security and privacy code review

- **Reviewer:** Worf, Son of Mogh, Chief Security Officer
- **Date:** 2026-09-17
- **Commit reviewed:** `6145f98` ("Add private alpha Audible connector")
- **Scope:** `code/Alpha0.x/` connector Python, Node child-process boundary,
  encrypted SQLite snapshot store, loopback server/API, browser client,
  lifecycle controls, policy/packaging gates, tests, dependency locks, docs,
  and `.gitignore`. `APP_DESCRIPTION.md` was read in full before any decision.
- **Constraints honored:** no personal runtime file under
  `%LOCALAPPDATA%\ATnR` was read or printed, no live sync was invoked, no
  Audible disconnect or deregistration was performed, no data was deleted, no
  running server was stopped. All dynamic probing used synthetic stubs.

---

## 1. Verdict

**REQUIRE CHANGES.**

| Decision | Result |
|---|---|
| Continued single-user private-alpha use on the owner's own trusted machine | **CONDITIONAL PASS** — acceptable only while H-1 and H-2 remain accepted risks by the owner |
| Distribution to any of the ten named testers | **FAIL** until H-1 and H-2 are fixed and re-verified |
| Commercial, public, hosted, store, installer, or package shipping | **FAIL / NO-GO** (unchanged; mechanically blocked, correctly) |

No Critical finding was identified. Two High findings block a tester build:
the loopback private-alpha API performs **no authentication** and hands its
CSRF token to any unauthenticated local client (H-1, exploit confirmed), and
Windows helper binaries are invoked by bare name from an attacker-influenceable
working directory (H-2).

The prime directives are otherwise held. No Audible password is collected, no
passkey or WebAuthn ceremony is implemented or relayed, credentials never cross
into Node or the browser, the device is deregistered only on explicit user
confirmation, and every failure path observed fails closed. This is disciplined
work. It is not yet finished work.

---

## 2. Assets and trust boundaries

### Assets (ranked)

1. Audible/Amazon device registration material — `adp_token`, device private
   key, refresh/access tokens, website cookies (inside `auth` envelope,
   `service.py:141-152`).
2. The pseudonymous account key (HMAC-SHA256 of Amazon `user_id`,
   `service.py:98-107`) and its 32-byte identity key (`service.py:258-267`).
3. The full normalized library snapshot — titles, authors, narrators, series,
   genres, synopses, progress, acquisition dates (`normalize.py:157-260`).
4. Local sync state and diagnostic codes (`encrypted-snapshot-store.js:36-43`).
5. Release-integrity controls: the private-alpha policy, the packaging gate,
   and the pinned dependency lock.

### Trust boundaries

| # | Boundary | Direction | Control |
|---|---|---|---|
| B1 | Amazon-controlled Edge page ↔ connector | Human auth, provider-owned | Headed Edge, provider-hosted ceremony, callback validated (`service.py:76-85`) |
| B2 | Audible private API ↔ connector | Untrusted inbound | Bounded pages/bytes, closed normalization, no retry (`service.py:185-238`) |
| B3 | Connector process ↔ Node (stdio) | Credential barrier | Fixed argv, fixed method set, JSON-only, no credential fields (`connector-process.js:64-68`, `rpc.py:31-47`) |
| B4 | Node ↔ SQLite at `%LOCALAPPDATA%` | Data at rest | DPAPI-sealed blob only, STRICT tables, singleton rows (`encrypted-snapshot-store.js:24-46`) |
| B5 | Node loopback HTTP ↔ browser UI | Same-origin app surface | Host allowlist, CSP, `Sec-Fetch-Site`/Origin check, CSRF header (`serve.js:29-98`, `124-152`) — **weakest boundary; see H-1** |
| B6 | Browser DOM ↔ untrusted catalog text | Rendering | `h()` builder, no `innerHTML`, `safeHref()`, `formatText()` bidi marking |
| B7 | Repository ↔ personal runtime state | Leakage | `.gitignore` patterns, no plaintext writes, category-only diagnostics |
| B8 | PyPI/npm ↔ build | Supply chain | Zero npm deps, exact Python pins — but no hashes; see M-3 |

Untrusted inputs: Audible library JSON, HTTP requests to the loopback server,
the sealed snapshot blob on disk, the provider callback URL, and every
environment variable used for path construction. No LLM is wired in this
release, so LLM/prompt-injection surface is **not applicable** at `6145f98`;
the untrusted text is nonetheless already stored inert, which will matter later.

---

## 3. Positive controls (earned, and specifically)

1. **No password, no passkey, no cookie relay.** Authentication happens only on
   an Amazon-controlled page (`service.py:56-86`); the application never renders
   a credential field and never becomes a relying party. `test/scan.test.js:76-104`
   makes WebAuthn, clipboard, and password-manager APIs a test failure, and
   proves each detector is live against its own positive control
   (`scan.test.js:196-204`).
2. **Credential barrier holds by construction.** `_public_status()`
   (`service.py:270-289`) is an allowlist; the `auth` envelope has no path to
   Node, the API, or the browser. Node's adapter spawns a fixed module with a
   fixed argv and no shell (`connector-process.js:64-68`), and
   `scan.test.js:181-183` asserts `shell: true` can never appear.
3. **Persistence discipline.** Only a DPAPI-sealed blob is stored; the store
   re-validates base64 round-trip and the `ATNR-DPAPI-1\0` magic before writing
   (`encrypted-snapshot-store.js:83-92`) and enforces account and marketplace
   isolation before any write (`encrypted-snapshot-store.js:69-76`).
4. **Deregistration is user-owned.** Only `disconnect` deregisters
   (`service.py:239-247`); failure retains credentials and tells the user to use
   Amazon device management (`data-view.js:39`), and
   `private-alpha-service.test.js:31-60` asserts a normal sync never deregisters.
5. **Failure is closed and mute.** Every connector exception collapses to a
   closed lowercase code (`rpc.py:52-59`); logging is globally disabled and
   proxy environment variables are stripped before any request
   (`service.py:291-296`); Node relays only `/^[a-z0-9-]{1,64}$/` codes
   (`connector-process.js:110-117`); the server never echoes a request or an
   error detail (`serve.js:79-82`, `253-256`).
6. **SSRF surface removed rather than filtered.** `coverRef` is hard-coded to
   `None` (`normalize.py:224`); nothing in the codebase fetches a catalog-supplied
   URL, and the browser CSP forbids remote images entirely.
7. **XSS defense by construction, not by escaping.** `dom.js:20-70` forbids
   executable tags, forbids `html`/`srcdoc`/`style` props, refuses string event
   handlers, and routes every URL attribute through `safeHref()`
   (`format.js:135-148`). Invisible and bidi characters are surfaced as
   `[U+XXXX]` rather than dropped (`format.js:117-127`).
8. **Diagnostics carry no attacker-controlled content.** Rejected records are
   `{ recordIndex, category }` only (`model.js:252-258`), classification is by
   error code and never by message text, and stripped commercial fields report a
   count, not key names (`model.js:130-133`).
9. **Release gates are mechanical.** `private: true`, prohibited
   `publishConfig`, a failing `prepack`, and a policy schema validated
   independently in both runtimes (`private-alpha-policy.js:8-21`,
   `policy.py:24-56`).
10. **Zero npm dependencies** (`package.json:22-23`, asserted by test), exact
    transitive Python pins, and an honest AGPL third-party notice.
11. **Honest documentation.** `README.md` "Remaining private-alpha gaps" and
    `planning/0.0.1/10-...md` disclose what is *not* proven — including the
    environment-dependent symlink test skip. Honesty about a gap is worth more
    than a green check mark.

---

## 4. Findings

Severity is the risk to the user's account and private history in the approved
single-user Windows private-alpha context. Each finding carries a pass/fail
gate decision for a **named-tester build**.

### CRITICAL

None.

---

### HIGH

#### H-1 — The private-alpha loopback API has no authentication, and vends its CSRF token to any unauthenticated local client

- **Confidence:** High (exploit reproduced against a synthetic stub service).
- **Evidence:**
  - `code/Alpha0.x/scripts/serve.js:92-97` — `sameOrigin()` returns true when
    `Sec-Fetch-Site` is absent **and** `Origin` is absent.
  - `code/Alpha0.x/scripts/serve.js:131-134` — `GET /api/v1/session` returns the
    process CSRF token with no credential of any kind.
  - `code/Alpha0.x/scripts/serve.js:139-142` — `GET /api/v1/library` returns the
    entire decrypted library snapshot, no token required.
  - `code/Alpha0.x/scripts/serve.js:148-151` — POST routes require only the
    token obtained one request earlier.
  - `code/Alpha0.x/scripts/serve.js:221-223`, `312`, `321` — fixed default port
    `4310`, one process-lifetime token, no binding of the token to any session.
- **Exploit/failure scenario:** Any process running on the machine — a second
  local user account with loopback access, a malicious build tool, an npm/VS Code
  extension, a curl one-liner in a copied README, or a browser extension holding
  `http://127.0.0.1/*` permission (extension GETs carry `Sec-Fetch-Site: none`
  and no `Origin`) — can:
  1. `GET /api/v1/session` → receive the CSRF token,
  2. `GET /api/v1/library` → exfiltrate the complete Audible library, progress,
     acquisition dates, and synopses,
  3. `POST /api/v1/disconnect` → force Amazon device deregistration and deletion
     of the DPAPI credential envelope (destructive, user-visible, and requires a
     new provider authorization ceremony),
  4. `POST /api/v1/delete-local` → destroy the local snapshot,
  5. `POST /api/v1/sync` → drive repeated authenticated calls to the unofficial
     Audible endpoint under the user's registration, inviting rate-limiting or
     account attention.
  The browser-origin defenses are sound; the defect is that the API treats
  "no browser headers at all" as trusted. Loopback is a network boundary, not
  an identity.
- **Verified:** reproduced at review time with a stub service and no personal
  data — `GET /api/v1/session` → `200` + token; `GET /api/v1/library` → stub
  payload returned; `POST /api/v1/disconnect` with that token → `200` and the
  stub's `disconnect` was invoked. No `Origin` or `Sec-Fetch-Site` header was
  sent.
- **Fix (required before any tester build):**
  1. Mint a 256-bit capability token per server start; print it **only** in the
     launch URL on the console (`http://127.0.0.1:<port>/?private-alpha=1&k=…`)
     and have `app.js` capture it into memory and strip it from the address bar.
  2. Require that token (constant-time compared) on **every** `/api/v1/*` route,
     including `/session`, and delete the unauthenticated token-vending route.
  3. Reject requests lacking `Sec-Fetch-Site` for data and state-changing routes,
     or require an explicit `Sec-Fetch-Site: same-origin`; keep the existing
     Origin allowlist.
  4. Bind to an ephemeral port by default instead of a predictable `4310`.
  5. Require a fresh, short-lived confirmation token for `disconnect` and
     `delete-local` (reauthentication-equivalent for destructive actions).
- **Verification test:** extend `test/private-alpha-api.test.js` with cases that
  assert `401` for every route when no capability token is presented, `403` when
  `Sec-Fetch-Site` is absent on `/api/v1/library`, `200` only with a valid token,
  and that the token never appears in a response body, a log line, or a header.
- **Gate:** **FAIL** for a tester build. Owner-only use on a single-user trusted
  machine may continue as an explicitly accepted risk.

#### H-2 — Windows helper executables are invoked by bare name, from an attacker-influenceable working directory

- **Confidence:** Medium-High (mechanism certain on Windows `CreateProcess`
  search order; exploitation requires write access to the connector directory or
  an earlier `PATH` entry).
- **Evidence:**
  - `code/Alpha0.x/connector/atnr_connector/custody.py:128-134` — `subprocess.run(["whoami", …])`.
  - `code/Alpha0.x/connector/atnr_connector/custody.py:145-150` — `subprocess.run(["icacls", …])`.
  - `code/Alpha0.x/src/adapters/connector-process.js:64-68` — the connector is
    spawned with `cwd: <packageRoot>/connector`, so that directory is inside the
    child's executable search path.
  - `code/Alpha0.x/scripts/setup-connector.js:20-31` — interpreter discovery
    falls back to the bare name `'python'` resolved from `PATH`.
- **Exploit/failure scenario:** A `whoami.exe`, `icacls.exe`, or `python.exe`
  dropped into the connector/package directory (or any earlier `PATH` entry —
  a scenario that a shared build machine, an unzipped archive, or a poisoned
  user-writable `PATH` folder makes realistic) executes in the security context
  of the user who owns the DPAPI keys, during the exact operation that is
  supposed to *harden* the credential directory. Worse, `secure_path()` failing
  silently to a hijacked binary that returns `0` would leave the credential
  directory with inherited ACLs while the code believes it is locked down.
- **Fix:** resolve all three via absolute paths —
  `os.path.join(os.environ["SystemRoot"], "System32", "whoami.exe")` and
  `…\icacls.exe` (validating `SystemRoot`), and require an absolute, existing
  interpreter path for the connector (reject bare `'python'`; keep `ATNR_PYTHON`
  but require `path.isAbsolute` and `existsSync`). Additionally, verify the ACL
  result by reading it back rather than trusting exit code `0`, and prefer
  spawning the connector with a `cwd` that is not repository-writable, or set
  `PYTHONPATH` explicitly instead of relying on `cwd`.
- **Verification test:** a Python unit test asserting the exact absolute command
  paths used by `_current_user_sid()` and `secure_path()`; a Node test asserting
  `setup-connector.js` rejects a relative interpreter; a static rule in
  `scan.test.js` forbidding bare-name process launches.
- **Gate:** **FAIL** for a tester build.

---

### MEDIUM

#### M-1 — One over-limit or malformed source record permanently blocks the entire library sync

- **Confidence:** High (the same class of failure is already recorded as observed
  in `planning/0.0.1/10-private-alpha-connector-change-control.md`, "Validation
  evidence").
- **Evidence:**
  - `connector/atnr_connector/normalize.py:22-38` — `_text(..., required=True)`
    raises `text-too-long` / `required-text-invalid` for a single field.
  - `connector/atnr_connector/normalize.py:172-176` — a required `asin`/`title`
    failure aborts the whole `normalize_library` pass.
  - `connector/atnr_connector/service.py:232-238` — the result is the single
    code `library-normalization-failed` for the entire sync.
  - `src/sync/live-snapshot.js:29-31` — `new Catalog(...)` throws on the first
    invalid book, failing the whole snapshot on the Node side too.
- **Exploit/failure scenario:** One Audible title with a 201-character title, an
  unparsable contributor record, or a duplicate `asin` (`normalize.py:175-176`)
  makes every subsequent sync fail. The user's library silently freezes at the
  last good snapshot with only a category code shown. A hostile or merely sloppy
  upstream record becomes a persistent denial of the product's core function.
  Fail-closed is correct; **fail-forever for the whole library is not**.
- **Fix:** apply the per-record isolation pattern already proven in
  `model.js:246-258` to the connector: skip and count rejected items with a
  closed category, cap the rejected ratio (fail closed only above a threshold,
  e.g. >2% or >50 records), and surface `rejectedCount` in status. Treat required
  over-limit prose the way the adapter already treats optional prose — explicit
  unknown, never truncation.
- **Verification test:** a Python test proving a 300-record fixture with three
  malformed records yields 297 normalized entries plus three category-only
  diagnostics, and that exceeding the rejection threshold fails closed and
  preserves the previous snapshot.
- **Gate:** **FAIL** for a tester build (availability and trust, not confidentiality).

#### M-2 — Contributor cap mismatch guarantees whole-snapshot rejection for many-contributor titles

- **Confidence:** High.
- **Evidence:** `connector/atnr_connector/normalize.py:179` and `:184` accept up
  to 100 authors/narrators; `src/core/validate.js:19` (`arrayItems: 50`) and
  `:131-141` reject any id list longer than 50, which `Catalog` turns into a
  whole-snapshot `ValidationError`.
- **Exploit/failure scenario:** An anthology or multi-cast production with 51+
  credited contributors produces a snapshot the Node core must reject, giving a
  `snapshot-…` failure for the entire library — a deterministic instance of M-1.
- **Fix:** align the connector cap to the core limit (cap at 50 with an explicit
  `contributorsTruncated` unknown marker, or raise the core limit deliberately in
  one place). The two limits must be derived from one constant, not two.
- **Verification test:** a cross-runtime test asserting the connector's caps are
  less than or equal to `LIMITS.arrayItems`, plus a 60-narrator fixture that
  normalizes and validates end to end.
- **Gate:** **FAIL** for a tester build (bundle with M-1).

#### M-3 — Dependency installation is pinned but not hash-verified or index-pinned

- **Confidence:** High.
- **Evidence:** `connector/requirements-private-alpha.lock:1-21` contains exact
  versions and no hashes; `scripts/setup-connector.js:41` runs
  `pip install --disable-pip-version-check -r <lock>` with no
  `--require-hashes`, no `--index-url`/`--no-index` pin, no `--only-binary`, and
  no `--no-deps`.
- **Exploit/failure scenario:** A compromised or typosquatted artifact, a
  registry-side file replacement, or a `pip.ini`/`PIP_INDEX_URL` pointing at a
  hostile index yields arbitrary code executing inside the one process that holds
  Audible credentials and DPAPI access. Version pins alone do not bind content.
  `APP_DESCRIPTION.md` requires build provenance before production use; a tester
  build is a conveyance.
- **Fix:** regenerate the lock with `pip-compile --generate-hashes` (or
  `pip hash`), install with `--require-hashes --no-deps --only-binary :all:`, pin
  the index explicitly, record the lock's own SHA-256 in the policy JSON, and
  re-run `pip-audit` as a gate rather than a manual note.
- **Verification test:** a test asserting every line of the lock carries at least
  one `--hash=sha256:` entry and that `setup-connector.js` passes
  `--require-hashes`; a CI step failing on `pip-audit` findings.
- **Gate:** **FAIL** for a tester build.

#### M-4 — No complete, durable deletion path for personal and derived data

- **Confidence:** High.
- **Evidence:**
  - `src/store/encrypted-snapshot-store.js:134-144` — `deleteLocalSnapshot()`
    deletes rows only; the `library.sqlite3` file, its size, and its timestamps
    remain. There is no `VACUUM` after deletion (`secure_delete = ON` at `:26`
    helps page content, but the file and any pre-existing journal residue are
    untouched).
  - `connector/atnr_connector/custody.py:220-231` — `delete()` is implemented for
    the credential envelope, but no code path ever deletes `identity.bin`; the
    account-key HMAC seed survives disconnect, delete-local, and reconnect
    (`service.py:258-267`).
  - No API route or UI control erases *everything* (credentials + snapshot +
    identity key + sync state + database file) in one confirmed action;
    `serve.js:172-177` offers only `delete-local`.
- **Exploit/failure scenario:** A user who believes they have removed ATnR's data
  leaves behind a stable pseudonymous account identifier seed and a database file
  whose free pages, size, and mtime still evidence the library. `APP_DESCRIPTION.md`
  ("Allow export and permanent deletion of stored user data"; deletion must cover
  derived artifacts) is not yet satisfied.
- **Fix:** add a confirmed "Delete all ATnR data" operation that (a) closes the
  database, (b) overwrites and unlinks `library.sqlite3` and any `-journal`
  sibling, (c) deletes `identity.bin` via the existing `SecureJsonStore.delete()`,
  (d) removes the private root directory, and (e) reports what was removed. Run
  `VACUUM` after any partial deletion. Document that filesystem-level erasure is
  best-effort on SSD/NTFS (see L-2) and state backup/OneDrive exclusions explicitly.
- **Verification test:** an integration test against a temporary root asserting
  that after "delete all" no file remains under the private root and a fresh
  `status()` reports fully disconnected, empty state; plus a residue inventory
  recorded in the release evidence.
- **Gate:** **FAIL** for a tester build; **must-fix before any release gate G2/G3**.

#### M-5 — The provider login URL is navigated, and seeded with Amazon init cookies, without origin validation

- **Confidence:** Medium.
- **Evidence:** `connector/atnr_connector/service.py:66-73` — cookies from
  `build_init_cookies()` are attached to the caller-supplied `url` and
  `page.goto(url)` is executed before any origin check. The **callback** is
  properly validated afterwards (`service.py:76-85`).
- **Exploit/failure scenario:** The `url` originates in the pinned unofficial
  dependency. A compromised or upgraded `audible` package, or any future code
  path that supplies this callback, would cause ATnR to drive a headed browser to
  an attacker-chosen page with Amazon-shaped cookies attached and a 10-minute
  request-interception window — a credible phishing surface presented by the
  user's own trusted application.
- **Fix:** before `add_cookies`/`goto`, require `https` and hostname
  `amazon.com` or `*.amazon.com` using the same predicate already written at
  `service.py:78-83`; factor that predicate into one function used by both checks.
- **Verification test:** a Python test asserting the callback raises
  `authorization-url-invalid` for `http://`, for `amazon.com.evil.test`, and for
  a non-Amazon host, with no Playwright launch attempted.
- **Gate:** **FAIL** for a tester build (cheap fix, high leverage).

#### M-6 — Automated egress/credential scanning covers JavaScript only; the connector is unscanned

- **Confidence:** High.
- **Evidence:** `test/scan.test.js:35` — `SCANNED_DIRS = ['src', 'ui/js', 'scripts']`.
  No `.py` file is scanned by any rule, and no test asserts that the connector's
  public status object excludes the `auth` envelope or that the connector never
  writes to a log file.
- **Exploit/failure scenario:** The excellent JS scanner creates a false sense of
  full coverage while the *only* component that holds credentials is exempt. A
  future `print(auth)`, a re-enabled logger, an added `requests` import, or an
  added key in `_public_status()` would pass every test in the repository.
- **Fix:** add a Python-side scan (forbidden modules: `requests`, `urllib`,
  `socket`, `webbrowser`, `smtplib`; forbidden `print(`/`logging` re-enable
  outside `rpc.py`'s single stdout write; forbidden credential-shaped
  identifiers), plus a unit test asserting `set(_public_status(envelope))` equals
  an exact allowlist that excludes `auth`, and a test that `rpc.main()` writes
  exactly one JSON object to stdout for every error class.
- **Verification test:** as described, including a deliberate hostile-sample
  positive control mirroring `scan.test.js:206-221`.
- **Gate:** **FAIL** for a tester build.

#### M-7 — The Node snapshot store creates its data directory without asserting the hardened ACL

- **Confidence:** Medium.
- **Evidence:** `src/store/encrypted-snapshot-store.js:20-23` — `mkdirSync(root, {recursive:true})`
  then `new DatabaseSync(path)`. The user-only ACL is applied only by the Python
  side (`custody.py:143-156`), and only because `private-alpha-runtime.js:8-10`
  happens to call `connector.status()` before constructing the store.
- **Exploit/failure scenario:** Any reordering, any direct use of the store
  (tests, future tooling, a future non-connector mode), or a connector failure
  path that still constructs the store leaves `library.sqlite3` in a directory
  with inherited ACLs. Content remains DPAPI-sealed, so this is defense-in-depth,
  not a disclosure — but the change-control document asserts the ACL as a control,
  and an asserted control must be verified, not inherited by luck.
- **Fix:** have the Node store verify the directory ACL (or call a connector
  `harden_root` RPC) and refuse to open the database if the private root is not
  user-restricted. Fail closed with `private-path-acl-unverified`.
- **Verification test:** a Windows test that creates a root with inherited ACLs
  and asserts the store refuses to open.
- **Gate:** **PASS with condition** — acceptable for a tester build only if the
  ordering is asserted by a test in the interim.

---

### LOW

| ID | Finding | Evidence | Fix | Gate |
|---|---|---|---|---|
| L-1 | DPAPI entropy is a hard-coded, published constant, so the seal is bounded entirely by the Windows user context; `unseal_snapshot` is reachable as a user-scoped decryption oracle over the RPC. | `connector/atnr_connector/custody.py:19`; `connector/atnr_connector/rpc.py:45-46` | Acceptable design for user-scoped DPAPI, but disclose it plainly in the README's residual-risk list rather than implying key-based protection; consider an additional user-supplied passphrase-derived entropy for tester builds. | PASS (disclose) |
| L-2 | Credential shredding overwrites in place; on NTFS/SSD this does not guarantee erasure of prior copies. | `connector/atnr_connector/custody.py:220-231` | Keep the overwrite, but state the limitation and rely on DPAPI for confidentiality; document BitLocker as the real control. | PASS (disclose) |
| L-3 | `child.kill()` on connector timeout may not terminate the Playwright/Edge process tree, leaving a headed authorization window open unattended. | `src/adapters/connector-process.js:80-84`, `88-91`, `96-100` | Use tree termination (`taskkill /T` equivalent or `detached` + process-group kill) and ensure `browser.close()` runs in a `finally` that also covers launch failure (`service.py:60-77`). | FIX SOON |
| L-4 | Port is taken from `PORT`/argv without validation; a non-numeric `PORT` yields `NaN` and an unpredictable ephemeral port. | `scripts/serve.js:312` | Validate 1024–65535 and fail closed with a fixed message. | PASS |
| L-5 | The plaintext library snapshot crosses the stdio pipe and lives in Node and browser memory; it can reach a crash dump or the pagefile. | `connector/atnr_connector/service.py:220-233`; `src/sync/private-alpha-service.js:70-96` | Acceptable for alpha; disclose it, and prefer streaming only the sealed blob plus counts once the UI can decrypt on demand. | PASS (disclose) |
| L-6 | Connector error codes are relayed verbatim to the browser and to disk (`last_error_code`). | `scripts/serve.js:246-252`; `encrypted-snapshot-store.js:120-133` | Codes are a closed lowercase vocabulary and carry no personal data; keep the regex guard and add an explicit allowlist. | PASS |
| L-7 | `identity.bin` HMAC key never rotates, so the pseudonymous `accountKey` is stable and correlatable across reconnects. | `connector/atnr_connector/service.py:258-267` | Intentional for account isolation; rotate on full deletion (folded into M-4). | PASS |
| L-8 | The `README.md` "Current verification" section asserts "no known vulnerabilities" without recording the tool version, date, and lock hash it applies to. | `code/Alpha0.x/README.md`, "Current verification" | Record tool, version, lock digest, and date so the claim is falsifiable. | PASS (documentation) |

---

## 5. Verification evidence

All checks were run at commit `6145f98` with synthetic data only.

| Check | Command | Result |
|---|---|---|
| Node test suite | `npm test` (Node v24.18.0) | **155 passed, 0 failed, 1 skipped** (symlink-containment test skips without elevation — an environment limitation, not a pass) |
| Connector unit tests | `.venv\Scripts\python.exe -m unittest discover test` | **9 passed** (includes a real Windows DPAPI protect/unprotect round trip and a "never writes plaintext" assertion) |
| H-1 exploit reproduction | in-process `createStaticServer` with a **stub** service, no personal data | `GET /api/v1/session` → `200` + token with no `Origin`/`Sec-Fetch-Site`; `GET /api/v1/library` → stub payload returned; `POST /api/v1/disconnect` with that token → `200`, stub `disconnect` invoked. **Confirmed.** |
| Repository secret scan | `git show --stat 6145f98`; tracked-file inspection | No token, cookie, key, ASIN, account identifier, or callback URL is tracked. `.gitignore` covers `credentials.bin`, `identity.bin`, `*.sqlite3*`, `.venv/`, `local-data/`. |
| Static egress/credential scan | `test/scan.test.js` | Passes; allowances are exactly `node:http`→`serve.js`, `fetch`→`connection-api.js`, `child_process`→`setup-connector.js` + `connector-process.js`, each asserted narrowly. Python is **not** covered (M-6). |
| Server hardening | `test/ui-server.test.js` | Path traversal, prefix look-alike directories, malformed URLs, non-GET methods, directory listings, Host allowlist, and headers-on-errors are all covered. |
| Packaging gate | `test/private-alpha-policy.test.js`, `scripts/private-alpha-policy.js` | `prepack` blocks packaging; policy schema is enforced in Node and Python independently. |

Actions deliberately **not** taken, per instruction: no live sync, no
disconnect/deregistration, no deletion, no reading of `%LOCALAPPDATA%\ATnR`,
no running server stopped, no implementation change made.

---

## 6. Residual risk

1. **The access route is unofficial and reverse-engineered.** No contract, no
   support, no guarantee. Amazon may change or revoke it, and account-level
   consequences are the user's to bear. Unchanged from prior review.
2. **DPAPI is user-scoped.** Any code executing as this Windows user can unseal
   both the credentials and the snapshot. H-1 and H-2 both convert "local code
   execution" into "Audible account impact"; even after they are fixed, the
   local-malware threat remains out of reach of this design.
3. **Packet-level egress is still unproven.** The scan is source-shape evidence.
   A network capture demonstrating destinations, request counts, and byte
   ceilings has not been produced.
4. **Deletion residue is not inventoried.** Backups, OneDrive/Known Folder
   redirection, Volume Shadow Copies, and SSD wear-leveling are untested and
   undocumented (M-4, L-2).
5. **Legal and licensing exposure (AGPL-3.0 + Audible/Amazon terms) is
   unreviewed by a named reviewer.** Conveying a build to a named tester is a
   conveyance. This remains the governing block on any distribution.
6. **The symlink-containment control is asserted but unproven on Windows.**
7. **No LLM surface exists yet**, so the prompt-injection controls required by
   `APP_DESCRIPTION.md` are untested in practice. The inert-storage discipline
   present today is the right foundation; it is not yet the defense.

---

## 7. Security pass/fail summary

| ID | Severity | Finding | Tester-build gate |
|---|---|---|---|
| H-1 | High | No API authentication; CSRF token vended unauthenticated | **FAIL** |
| H-2 | High | Bare-name Windows helper/interpreter execution from a writable cwd | **FAIL** |
| M-1 | Medium | One bad record permanently blocks the whole library sync | **FAIL** |
| M-2 | Medium | Contributor cap mismatch (100 vs 50) forces whole-snapshot rejection | **FAIL** |
| M-3 | Medium | Dependency lock not hash- or index-pinned | **FAIL** |
| M-4 | Medium | No complete durable deletion of primary and derived data | **FAIL** |
| M-5 | Medium | Login URL navigated and cookie-seeded without origin validation | **FAIL** |
| M-6 | Medium | Egress/credential scanning excludes the connector | **FAIL** |
| M-7 | Medium | Node store does not verify the private-root ACL | PASS with condition |
| L-1…L-8 | Low | See table in §4 | PASS (L-3 fix soon) |

**Overall security verdict: REQUIRE CHANGES.**
Owner-only private-alpha use may continue with H-1 and H-2 as explicitly
accepted risks. No build may be conveyed to a named tester until H-1, H-2, and
M-1 through M-6 are remediated and re-verified with the tests named above.
Commercial, public, hosted, store, and package shipping remain **NO-GO**,
pending named legal review, renewed security review, and Captain change control.

Remediation sequencing is handed to Riker: H-1 and H-2 first (one sprint,
independent), then M-5 and M-2 (small, deterministic), then M-1, M-3, M-6, and
M-4 (the deletion and residue inventory is the largest item and should not be
compressed).

The defenses here are real and were built deliberately. That is why the
remaining gaps must be closed rather than explained away. A warrior does not
abandon his post because standing is uncomfortable.
