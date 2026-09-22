# Alpha 0.0.2 — evidence harness and private Audible connector

Private library/feedback prototype, separate read-only synthetic evidence
inspector, platform-neutral domain contracts, and executable tests.
See the [root changelog](../../CHANGELOG.md) and
[accumulated implementation record](../../planning/0.0.2/12-accumulated-implementation.md)
for current working-tree behavior, evidence and release restrictions.

**Default mode:** a self-contained, zero-npm-dependency Node.js ESM core,
loopback server, and browser UI exercised entirely against invented fixtures.

**Private alpha mode:** a Windows-local, single-user connector using the pinned
community `audible` 0.12.0 client. Human authentication occurs in an
Amazon-controlled Edge page. Provider credentials remain in the isolated
Python process and are sealed with user-scoped Windows DPAPI. Node receives
normalized library data only and stores a DPAPI-encrypted snapshot blob in
SQLite outside the repository.

Private feedback supports separate book, author, narrator, and series targets.
Author, narrator, and known-series groups retain a Rate & Review action while
collapsed; group ratings/comments remain encrypted locally and are never
copied onto grouped books.

Rating editors use a compact five-circle whole-star meter rather than
half-step dropdowns. Choosing circle 3 fills circles 1–3; the underlying
controls retain native radio semantics and exact spoken labels. Clear restores
Unrated. Legacy stored half-star values remain readable and unchanged until
the owner deliberately selects a new whole-star value.

The Library's last valid grouping, sort, Status, rating, text/tag filters,
collapsed groups and page positions survive a page refresh in validated
version-2 tab-scoped `sessionStorage`. The key is schema-only
(`atnr:private-library-filters:v2`), not release-scoped. Valid legacy release
keys are copied only when the canonical key is absent; canonical state wins.
No legacy/unrelated state is deleted, and migration errors remain visible. Search
and tag text never enters the URL or long-lived `localStorage`, and the saved
control state is scoped to that browser tab/session. Browser session restoration
can retain it; tab closure is not secure erasure. This storage can contain private
queries/tags and is not DPAPI-encrypted. Open editors, unsaved feedback, focus,
and scroll position are never serialized.

Author/narrator display groups combine normalized equal names and deduplicate
books while retaining all source person IDs. This is presentation grouping, not
proof of a shared canonical identity; multi-source groups disclose that fact.
Series grouping remains ID-based. Person targets always use the normalized-label
hash, independent of member count. Legacy source-ID aliases remain readable;
canonical feedback wins. On successful canonical save, a single legacy alias
is retired using its own revision; retirement failure preserves both copies
and reports the outcome. Multiple populated aliases are flagged as ambiguous,
not automatically migrated or deleted.

Library search and tag fields precede advanced filters, which default closed
on mobile. Text filtering updates results without replacing the active inputs.
LCARS keeps its independently scrolling desktop rail/main pane above 640 CSS
px and document flow on narrower screens; Apple mode has its own toolbar and
responsive content column. Disclosure, overflow-cue, footer-clearance, focus,
wrapping and CSS target-size changes have regression guards, not blanket
rendered accessibility certification.

Pages cap at **50 book rows** ungrouped, or **five groups × ten child rows**
when grouped. Full-library/filter/group counts remain accurate; collapsed
groups render no children. There is no "Show all". Listing changes reset page
positions. Previous/Next controls reach ungrouped, group and child pages;
dirty drafts block paging with an announcement/editor focus until saved or
discarded. See [data contracts](docs/data-contracts.md).

Provider synopsis markup is converted to bounded inert text with paragraph
separation. Missing series evidence displays **Series unknown**; the reserved
confirmed-standalone state has no current ingestion producer.

### Delayed Data-audit presentation fixes

Completion status and partial percentage are independent evidence, not one
undifferentiated fact. The core retains both values with separate attribution/
position labels; current Library/Detail presentation suppresses a bare historical
percentage next to Completed unless a separate current position is supplied
and explicitly labeled. No completion/position value is inferred or rewritten.
Provenance has closed owner-readable labels and an Unknown fallback rather
than exposing arbitrary internal source tokens.

Private Feasibility is absent from primary navigation in both shells but stays
context-linked from Data; synthetic/direct diagnostic routing remains.
The filter fieldset has a single Status label. Book Detail has one actionable
feedback-guidance link to the Library editor, using return focus rather than
duplicating instructions or creating another editor.

Data's inventory is non-destructive: title/feedback/import counts distinguish
known evidence from Unknown and are separate from the pre-deletion manifest.
Reading it triggers no sync, export, deletion or confirmation nonce.

Actual completed-sync reconciliation is persisted in `last-import-counts.json`
in the protected custody root: a versioned, non-sensitive sidecar containing
measured counts, timestamps, snapshot generation and a one-way account binding,
not titles, book identifiers, account key, marketplace or private text.
`status().local.lastImport` withholds the binding and adds no provider probe.
Valid account/generation-bound evidence survives reload; current in-session
measurement wins. Invalid, missing or quarantined evidence stays Unknown.
Unmeasured unchanged/rejected counts are null, not zero.

Parsing the retained snapshot remains **Unknown / not an import**. It cannot
produce a known last-import claim; only actual sync reconciliation or its
validated persisted receipt can. Snapshot/local-data deletion removes the
sidecar, while disconnect retains it with the snapshot. A receipt write failure
does not undo a completed sync or invent reload evidence. No source/storage
schema revision changed. See [data contracts](docs/data-contracts.md).

### Settings and appearance

Open **Settings** (`#/settings`) from LCARS navigation or the Apple tab bar. Both modes
offer default **LCARS** and opt-in **Liquid Glass**. Selection applies immediately
and stores only `lcars` or `liquid-glass` in `localStorage` at
`atnr:ui-theme:v1`, surviving restart for the same browser origin/profile.
It does not store library data or change the Audible connection.

Missing preference defaults to LCARS; invalid/unavailable storage fails to the
default on load. If saving fails, Settings reports that the appearance changed
for this visit but could not be remembered.

`app.js` mounts exactly one independent shell: `shells/lcars-shell.js` or
`shells/apple-shell.js`. Apple mode constructs a compact navigation bar,
Library/Data/Settings tabs and contextual back navigation; Feasibility is
reachable from Data. It never constructs hidden LCARS elbows/sidebar/filler.
Both shells share route/store state and neutral `atnr-*` view components;
switching shells retains the store rather than reconnecting to Audible.

Apple styling no longer references `--lcars-*`; shared tokens are `--atnr-*`.
`applyTheme()` actively enables/disables scoped links: Apple mode disables
`layout.css` and `theme-lcars.css`, while LCARS disables
`theme-liquid-glass.css`. Neutral sheets remain enabled. A monotonic activation
generation prevents stale shell imports from overwriting the latest choice.

The web material uses original CSS translucency, backdrop blur, rounded
surfaces and local system fonts. Apple's iOS 27/iPadOS 27 resource listing and
Materials guidance are the [verified design references](../../planning/0.0.2/12-accumulated-implementation.md#apple-design-resource-provenance-and-native-limits),
not bundled artwork, SDKs or an endorsement. CSS cannot reproduce native
refraction, Dynamic Type or direct OS accessibility integration. Apple HIG,
documented APIs and Design Resources are normative. Google image search is
non-normative inspiration only: no copying, tracing, bundling or hotlinking
third-party imagery/UI assets, and no uploading private screenshots or data.
No UIKit/SwiftUI equivalence or physical iPhone validation is claimed.

#### Residual limitations

- A brief LCARS flash is possible before the theme module executes.
- CSS reduced-transparency/contrast features depend on browser support.
  Source/fake-DOM tests are not measured contrast or keyboard/touch evidence.
  Chromium regression coverage plus the supplied live private matrix verify
  shell/page/switch behavior; they are not physical-device/VoiceOver validation
  or blanket contrast/zoom/AT certification.
- Browser preferences are separate from encrypted library/feedback custody;
  local data deletion is not a claim to purge browser storage or restored tabs.

This remains an architecture experiment, not a final platform decision. The
connector is unofficial and reverse-engineered. Commercial/public shipping,
hosting, package publication, installers, and app-store submission are blocked.

### Connection evidence

Health is the closed `connectionState`: `disconnected`, `unverified`,
`verified` or `authorization-failed`. The legacy connector `connected` flag
means credentials are held, **not** that Audible currently accepts them.
Successful registration/library-sync evidence supports verification for
24 hours; a newer refusal takes precedence. Status reads perform no provider
probe. This is not continuous revocation detection or a successful durable-sync
claim. Local snapshot/feedback and account-quarantine controls remain separate.
Failed sync rereads recorded connector evidence (no new provider probe) and
refreshes the Data disclosure/header. New refusal evidence outranks verification;
if refresh is unreachable, the screen is custody-only/stale, not falsely
verified or automatically labeled revoked. Local data and drafts are retained.
Recovery copy directs the owner to Data; no new credential-replacement flow
was added, and failed deregistration can still block reconnection.

### Privacy-safe visual capture

Run `node scripts/capture-ui.js --theme all` only with a separately reviewed local browser
driver. The default starts a separate synthetic loopback server, uses production
shells/views, and writes page-only images plus a neutral manifest to the ignored
`.capture-out/synthetic/` directory. It opens no private store. Both themes are
selected by default; `--theme all` is explicit, or select one with
`--theme lcars` / `--theme liquid-glass`. The runner uses production Settings
controls and verifies theme selection in the live DOM before capture.
The final supplied actual run produced **12 neutral PNGs plus manifest** and
then verified purge. These screenshots are synthetic, separate from the live
private matrix, and are not the complete private-style regression matrix.

[The capture procedure](docs/visual-capture.md) requires per-run consent,
acknowledgements, an external non-synced output location and a 1–24-hour
retention deadline for real data. Treat protected custody as an owner
obligation, not encryption supplied by the runner. Purge verifies file removal,
not forensic erasure. Never commit or attach real-data images/manifests.
The runner disables additional recordings and blocks non-origin requests.

Playwright is dynamically loaded, **undeclared and unpinned**, with no lockfile.
Missing tooling refuses capture; rendered tests can skip when its import is
unavailable. Reproducible browser-tool provenance remains a release-evidence
gap. There are no `test:browser` or `capture:synthetic` npm scripts; the rendered
tests are part of `npm test`, and capture uses the direct command above.

## Run

```
cd code/Alpha0.x
npm test          # node --test "test/*.test.js"
npm run demo      # deterministic console walkthrough: import, inspector, evidence contract
npm run serve     # dependency-free static server for the UI (http://127.0.0.1:4310/)
```

Then open `http://127.0.0.1:4310/` in a browser. `PORT=4321 npm run serve` (or
`npm run serve -- 4321`) picks a different port.

## Run the private alpha

Windows 11, Edge, Node 22.5+ (24 LTS recommended), and Python 3.11–3.14 x64 are
required. The runtime floor is enforced at startup: the private mode refuses to
start on an unsupported Node build rather than failing later inside storage.

```text
cd code\Alpha0.x
npm run connector:setup
npm run connector:test
npm run policy:check
npm run private-alpha
```

> **`npm run connector:setup` still fails closed**, now with
> `dependency-source-artifact-unapproved`. Artifact hashes *are* recorded: all
> 21 locked distributions carry a `--hash=sha256:` entry taken from the
> approved index (`https://pypi.org/simple`), and each pin records the exact
> artifact filename it belongs to. Two of them — `pbkdf2==1.3` and
> `pyaes==1.6.1` — have never published a wheel, so they cannot satisfy
> `--only-binary :all:`. They are not optional: `audible`'s provider registry
> imports them unconditionally. Installing a source distribution executes its
> build script, so each one needs a named, hash-bound approval in
> `sourceArtifactExceptions` in `connector/dependency-provenance.json`
> (A2-WP018 / ATR-S018). Approval is scoped per distribution with `--no-binary
> <name>`; the global flags are never relaxed. An existing 0.0.1 environment is
> unaffected.

### Runtime data requirement (Alpha 0.0.2)

**The private runtime uses the real, encrypted local library state only.**
Synthetic fixtures are test material; they are never presented as a library.

- Before the private server listens, the encrypted store and any rollback
  envelope are verified to sit inside the protected custody boundary
  (`%LOCALAPPDATA%\ATnR\Alpha0.0.1\private-alpha`). A failure prints a fixed
  reason code and stops startup — it never degrades to a demo library.
- A private session cannot fetch `src/fixtures/**`; the server answers `403`.
- The session bootstrap declares `{ dataSource: 'local-encrypted',
  synthetic: false }`, and the browser client refuses any session that does not.
- An *empty* real library is reported honestly as empty. Empty is a fact; it is
  never a reason to seed demo data.
- Migration is non-destructive and fail-closed: the 0.0.1 encrypted source and
  the last complete snapshot are preserved, and an unknown or newer schema is
  refused rather than rewritten. Rollback envelopes stay inside the same
  custody boundary.
- **The OS custody proof comes first.** Before any migration runs or any
  rollback envelope is written, the trusted connector re-reads the custody
  root's ACL with `icacls` and proves that only the current user is granted and
  that no inherited ACE survived (`verify_custody`). Path containment alone is
  not sufficient — a directory can sit perfectly inside the boundary and still
  be world-readable. The migration's own boundary check runs behind a
  `CustodyProofGate` that refuses without that proof, so the ordering cannot
  regress silently. The proof reply is a closed set of booleans: no path, user
  name, SID or count crosses the boundary.
- **Sealed envelopes are purpose-bound.** A sealed library snapshot and a
  sealed private review no longer share a header, so the snapshot-opening route
  can no longer be used to decrypt private reviews (or the reverse). The
  purpose is matched before the ciphertext reaches the protector, so a
  cross-purpose envelope is refused without any decryption attempt. Existing
  0.0.1 untagged envelopes still open **as library snapshots only**. The
  purpose header extends the 0.0.1 magic rather than replacing it, so the
  storage container's sealed-payload check still accepts a freshly sealed
  snapshot; the credential reader refuses a purpose-bound envelope outright.
- No title, ASIN, identifier, count or content is printed, logged, or recorded
  in a security event. Evidence is process-only or redacted.

> **Resolved (final review):** the earlier coordination gap is closed. `ui/js/app.js`
> selects `ui/js/private-store.js` for a private session and only loads
> `ui/js/store.js` — the fixture-seeded synthetic view-model — for the synthetic
> build, so the private UI can no longer reach the fixtures through a dynamic
> import. `ui/js/bootstrap-state.js` and `ui/js/private-alpha-messages.js`
> carry explicit refusal states for `private-alpha-runtime-unavailable` and
> `private-alpha-runtime-source-refused`, rendered by
> `ui/js/views/bootstrap-failure-view.js`. See
> `planning/0.0.2/10-runtime-data-requirement.md`. The synthetic build
> (`npm run serve`) is unaffected.

### Owner-only loopback session

The project owner explicitly removed the 0.0.2 per-start manual unlock on
2026-09-18. This private prototype runs only on the owner's dedicated test
computer, is bound to `127.0.0.1`, and is not approved for release or use on a
shared/untrusted machine. Same-user local processes are therefore inside the
accepted prototype trust boundary. This decision does not change Audible
authorization: **Connect Audible in Edge** still opens Amazon's browser flow
and registers the device, while **Sync now** uses that encrypted authorization.

- `GET /api/v1/session` creates a bounded in-memory browser session without
  asking for a local key. Other API routes require that session.
- Host, same-origin fetch metadata, Origin/Referer checks, and CSRF protection
  remain enforced. These reduce browser-origin attacks but do not authenticate
  another process running as the same Windows user.
- **Disconnect**, **Delete local library snapshot**, **Delete all local ATnR
  data**, **Export my data**, and **erasing a saved review** retain single-use
  confirmation nonces that expire in 120 seconds. Export remains destructive
  strength because it copies private history. A review-deletion nonce remains
  bound to the specific book and revision.
- Each of those actions carries its **own** nonce action, and a nonce is never
  transferable between them. Confirming "delete the snapshot" is not consent to
  erase private reviews, and an export nonce cannot delete anything.
- A nonce can only be spent by a route that can actually act. A route policy
  without a handler is refused before the nonce is consumed.

**Export and deletion.**

- **Export my data as JSON** is user-triggered only. Nothing exports on
  startup, on a timer, or as a side effect of a read or a sync. The document
  excludes credentials, tokens, the identity seed, the account key and file
  paths *by construction*, not by filtering afterwards.
- A visible warning and confirmation precede private and synthetic exports,
  naming titles, progress, ratings, comments, tags and the unencrypted file's
  loss of ATnR protection. Only an explicit true confirmation requests export.
  Cancel/dismiss makes no request, obtains/spends no nonce and creates no file.
  Later local deletion cannot recall the saved copy.
- The response is served as a bounded download — `attachment` with a fixed
  ASCII filename that stored content cannot steer, `nosniff`, and `no-store` —
  so the browser cannot render it as markup or cache it to disk. Over the
  ceiling it fails closed rather than delivering a truncated document that
  looks complete. Once saved, the file is outside ATnR's protection; the UI
  says so.
- **Delete local library snapshot** erases the snapshot only, and says so.
  **Delete all local ATnR data** first loads the deletion inventory and shows
  the owner exactly what is retained — and what deletion cannot reach,
  including that a copy they already exported is outside this application
  entirely, that deleting a row is not cryptographic erasure, and that local
  deletion does not deregister the provider device. Only then does an explicit
  confirmation and a single-use nonce perform the purge.
- **If the inventory cannot be loaded, the purge is blocked.** A destructive
  confirmation is never presented over a guess: the load is awaited, so a
  failure stops the flow before any prompt appears and no purge is attempted.
- `GET /api/v1/inventory` is read strength — a live session and no nonce,
  because it is what the owner reads *in order to* consent. Its
  response is narrowed to a closed, bounded vocabulary of fixed item
  identifiers, booleans, bounded counts and fixed limitation statements. An
  unknown item identifier or an out-of-range count fails the response closed
  rather than forwarding it. No title, ASIN, comment, account key or path can
  appear in it.
- Both deletions resolve the account join immediately before erasing, so a
  quarantined session can never destroy data it does not own, and the aggregate
  purge returns an inventory **recomputed from the post-deletion state** rather
  than an assertion that it worked.
- Host, Origin, fetch-metadata and CSRF checks remain enforced as defence in
  depth. None of them authenticates anything on their own. Same-origin Fetch
  Metadata plus the verified loopback Host/port establishes locality for `GET`
  and `HEAD`, which browsers legitimately send without an `Origin` header;
  every state-changing method still requires an exact `Origin`, and a foreign
  `Referer` is refused on all of them.

Open `http://127.0.0.1:4310/#/data`, acknowledge the private/unofficial status,
enter a local account label, and choose **Connect Audible in Edge**. Enter
passkey/password/OTP only on Amazon's page.

The private server redirects that URL to
`http://127.0.0.1:4310/?private-alpha=1#/data`; the query marker prevents the
default synthetic build from probing a connector endpoint.

- ATnR registers one persistent virtual device.
- The provider-side device label remains the upstream client's fixed
  **Audible for iPhone**; the local app label is **ATnR**.
- A full library sync runs after connection, on server startup, every 15
  minutes while the server runs, and when **Sync now** is chosen.
- The device remains registered across refreshes and app shutdown.
- **Disconnect Audible** is the only normal action that deregisters the device
  and deletes provider credentials. The encrypted local library remains until
  separately deleted.
- If deregistration cannot be confirmed, credentials are retained for retry
  and the UI directs the user to Amazon device management.

Private state is under:

`%LOCALAPPDATA%\ATnR\Alpha0.0.1\private-alpha`

The directory name is pinned to the 0.0.1 release on purpose. `version.js`
exports `PRIVATE_DATA_DIRECTORY` and `LEGACY_ALPHA_VERSION` as immutable
constants, and the connector pins the same directory and the same DPAPI
entropy, so bumping the release never relocates or re-keys existing state. It
must never be copied into the repository or a cloud-synchronized folder.

## Layout

```
src/version.js          0.0.2 source of truth (schema/contract/policy versions, runtime profile)
                        plus the immutable legacy 0.0.1 storage/custody identity
src/index.js            public, platform-neutral surface
src/core/errors.js      ValidationError, TrustViolationError, GroundingError, ContractViolationError
src/core/validate.js    bounded, pollution-safe validators; unknown = null
src/core/trust.js       commercial-input exclusion + evidence allowlist + route allowlist + anti-profiling
src/core/model.js       Catalog, normalization, provenance, idempotent snapshot merge
src/core/library.js     evidence-inspector projection: sorting, filtering, faceting, grouping
src/core/contract.js    closed evidence/ExplainabilityTrace contract validator (NOT a recommender)
src/fixtures/synthetic.js          synthetic catalog, snapshots, local sentinels, adversarial records
src/fixtures/contract-fixtures.js  synthetic trace candidates + 26 adversarial rejection fixtures
scripts/serve.js        loopback static server; opt-in private API composes persistence/connector
scripts/supported-runtime.js      Node/`node:sqlite` preflight; private mode refuses an unsupported runtime
scripts/private-alpha-runtime.js  opt-in local connector/runtime composition
scripts/private-alpha-policy.js   hard private/non-commercial shipping gate + dependency provenance guard
scripts/setup-connector.js        trusted-interpreter, hash-pinned connector environment setup
scripts/record-dependency-hashes.py  records one index-attested artifact hash per pin from pypi.org
src/security/local-api-auth.js    browser sessions, CSRF, confirmation nonces, route policy
src/security/runtime-data-source.js  real-encrypted-state runtime contract + custody containment
src/security/security-events.js   bounded, memory-only, privacy-safe local security events
src/security/trusted-paths.js     absolute trusted executable resolution + minimal spawn environment
connector/dependency-provenance.json  approved index, required install flags, manifest digests, residuals
connector/                        isolated Python Audible adapter, DPAPI custody, lockfile, tests, notices
src/adapters/connector-process.js fixed-command stdio boundary; no credential fields
contracts/source-contract.json    declared source units, limits, pagination caps (proposed, pending CP-01)
src/core/source-contract.js       frozen Node mirror of the source contract artifact
src/core/feedback.js              private feedback domain contract (ratings, comment, tags, revisions)
src/store/encrypted-snapshot-store.js local SQLite containing only a DPAPI-sealed snapshot
src/store/schema.js               frozen persisted schema revisions and fingerprints
src/store/migration.js            explicit versioned migration, verification, backup and rollback
src/store/production-migration.js read-only probe, pure plan, and fail-closed real-state entry point
src/store/feedback-store.js       encrypted account/target-keyed private reviews (CAS, tombstones)
src/store/local-sealer.js         connector-backed custody for locally owned records
src/store/export.js               complete portable export document + deletion inventory
src/sync/live-snapshot.js         closed validation of normalized Audible snapshots
src/sync/reconcile.js             prior-snapshot reconciliation and semantic change digest
src/sync/private-alpha-service.js sync, account isolation, scheduler, and explicit disconnect lifecycle
docs/data-contracts.md            data, sync, storage, feedback and export contracts (Data)
ui/index.html           single-page app shell (LCARS-styled, hash-routed)
ui/css/                 design tokens + base/layout/component styles (no gradients/shadows/glows)
ui/js/store.js          DOM-free read-only view-model + lifecycle controls (no editing/recommend API)
ui/js/format.js         DOM-free display formatting helpers
ui/js/dom.js            minimal DOM builder, live-region announcer, accessible confirm dialog
ui/js/router.js         minimal hash router (#/library, #/book/:id, #/feasibility, #/data)
ui/js/views/            one render function per screen (library, book detail, feasibility & trace, data & lifecycle)
test/                   contract tests for the core and the UI's DOM-free layers
test/fixtures/          adversarial payload fixtures (ATR-ADV-1); never imported by src/
```

## Security posture (Worf review remediation)

### W-1 — rejected-record diagnostics carry no attacker-controlled content

A rejected record now produces exactly `{ recordIndex, category }` and nothing
else. There is no `record`, `reason`, `field`, or `message` key anywhere in the
merge report.

- `src/core/errors.js` exports the closed `DIAGNOSTIC_CATEGORIES` vocabulary
  (`invalid-identifier`, `missing-required-field`, `invalid-field-value`,
  `unsupported-record-shape`, `unsafe-key`, `duplicate-record`,
  `unclassified`). `ValidationError` carries an allowlisted `.code`.
- `classifyDiagnostic(error)` maps an error to a category **by `error.code`
  only** — it never inspects message text, so hostile input cannot influence
  or reach the classification.
- `mergeLibrarySnapshot` emits positional diagnostics sorted by `recordIndex`.
- The provenance note for stripped commercial fields reports a **count**, not
  the dropped key names.
- `ui/js/format.js#formatDiagnostic` renders `Record at position N —
  Rejected: <closed-vocabulary phrase>`; an unrecognized category renders as
  `unclassified validation problem`.
- Canary tests (`test/adversarial.test.js`) push hostile strings through the
  merge report, the rendered diagnostic output, the provenance notes, and the
  `exportState()` JSON, asserting none of them appear.
- **ATR-S036 (0.0.2):** the same rule now holds on the contract boundary.
  `validateCandidateSet()` emits exactly `{ index, code }`, where `code` comes
  from the closed `CONTRACT_REJECTION_CODES` vocabulary via
  `closedRejectionCode()`. The rejected candidate's identifier, field values
  and `error.message` no longer cross the boundary, so a hostile catalog record
  cannot place its own text into a diagnostic, a log line or an export
  (`test/security-events.test.js`).

### H1–H6

| ID | Fix | Where |
|----|-----|-------|
| H1 | Malformed URL (bad percent-encoding, NUL) returns a fixed `400 Bad request` with no error detail; internal failures return a bare `Internal error`. | `scripts/serve.js` |
| H2 | `realpath()` symlink containment plus a separator-safe `isContained()` check, so `ui-secrets/` cannot pass a `ui` prefix test and a symlink cannot escape the served root. Non-files 404. | `scripts/serve.js` |
| H3 | `SECURITY_HEADERS` on **every** response including errors: restrictive CSP (`default-src 'none'`, `frame-ancestors 'none'`; private mode permits same-origin API connections), `nosniff`, `no-referrer`, CORP/COOP `same-origin`, `permissions-policy`, `no-store`; plus a loopback-only `Host` allowlist (403 otherwise) against DNS rebinding. | `scripts/serve.js` |
| H4 | `Object.hasOwn(routes, name)` so `constructor`/`toString`/`__proto__` route names fall back to the default route. | `ui/js/router.js` |
| H5 | `sharedFacetTrace()` returns `{ edges, shown, total, limit, truncated }`; the feasibility view discloses the cap instead of silently dropping edges. | `ui/js/store.js`, `ui/js/views/feasibility-view.js` |
| H6 | `ROUTE_POLICY` states in code that the route allowlist is **schema admissibility only** (`grantsAuthorization: false`, `provesLawfulAccess: false`, `isAccessControl: false`). It is not authorization and must never be cited as such. | `src/core/trust.js` |

### ATR-ADV-1 adversarial coverage

`test/adversarial.test.js` + `test/fixtures/adversarial.js` exercise markup,
`<script>`/SVG/event payloads, `javascript:`/`data:`/`vbscript:`/`file:` and
protocol-relative URLs, prompt-injection directives, bidi/invisible/control
characters, oversized text and identifiers, deeply nested and oversized
objects, and a hostile snapshot including a JSON-parsed own `__proto__` key.
Every payload must be inert or rejected, and every diagnostic must be
category-only.

Renderer guarantees: `h()` refuses `script/iframe/object/embed/link/meta/base/style/template`,
throws on `html`/`innerHTML`/`outerHTML`/`srcdoc`/`style` props, accepts event
handlers only as functions, and routes every URL attribute through
`safeHref()` (unsafe → a `data-unsafe-url-removed` marker, never the URL).
`formatText()` renders invisible/bidi characters visibly as `[U+XXXX]`.

The adversarial fixtures live under `test/fixtures/` deliberately: `src/` is
statically scanned by `test/version.test.js` for forbidden API tokens, and a
payload string containing e.g. `fetch(` must never be introduced there.

### Remaining private-alpha gaps — NOT claimed, NOT complete

The implementation does not grant a production or commercial G2/G3 approval.
Still required:

- **named approval for the two source-only dependencies** — artifact hashes are
  now recorded for all 21 distributions and an OSV.dev advisory query over
  every pin returned zero advisories, but `pbkdf2==1.3` and `pyaes==1.6.1`
  ship no wheel and `connector:setup` stays blocked until each is approved in
  `sourceArtifactExceptions`;
- **local byte-level verification of the recorded hashes** — egress to
  `files.pythonhosted.org` is blocked on this host, so the digests are
  index-attested from the verified `pypi.org` JSON API rather than computed
  from downloaded bytes. `pip` still fails the install closed on any mismatch;
  the first successful hash-verified install closes this;
- **a full `pip-audit` run** — the tool is not installed and cannot be
  installed here for the same reason;
- **accepted owner-only local exposure**: on 2026-09-18 the owner removed the
  manual local unlock for this dedicated prototype computer. Any process
  running as the same Windows user can obtain a browser session and reach
  private API operations. Keep the server stopped when idle; do not use this
  build on a shared or untrusted machine; do not convey it to testers;
- a witnessed persistent real-account connect, restart, automatic refresh, and
  explicit disconnect/reconnect drill;
- packet-level destination evidence and measured request/byte/runtime ceilings;
- verified cleanup after interrupted registration and failed deregistration;
- full durable deletion/residue inventory, backup disclosure, and reboot test;
- source-field coverage measurements over the complete private library;
- named legal review (Audible/Amazon terms, AGPL conveyance) before any copy is
  conveyed even without payment; Microsoft Edge remains an auto-updating system
  channel and is deliberately not falsely pinned.

### Alpha 0.0.2 security foundation (S015–S020, S036)

- `src/security/local-api-auth.js` — bounded in-memory browser sessions with
  CSRF and single-use confirmation nonces bound to action, resource, session
  and account generation. `ROUTE_POLICY` is a closed table. This owner-only
  prototype deliberately does not authenticate same-user local processes.
  Erasing a private review is classified destructive in
  its own right — it never borrows the policy of a lifecycle route — and its
  nonce is resource-bound to the book and revision the owner confirmed. Export
  and the aggregate purge each carry their own action, so no confirmation is
  transferable between a copy and an erasure.
- `src/security/security-events.js` — memory-only, closed-schema local security
  events (sequence, second-truncated timestamp, enumerated category/outcome,
  bounded failure counter). No identifier, path, header or request text is
  recordable, and a recording failure can never alter a security decision.
- `src/security/trusted-paths.js` — absolute, existence-checked, approved-root
  executable resolution plus a minimal spawn environment. Bare-name and
  PATH/cwd resolution of Python, `whoami` and `icacls` is removed. `TEMP` and
  `TMP` are deliberately **not** forwarded to the connector: it stages every
  file inside the hardened custody root, so a temporary directory would only
  offer a writable location outside the boundary for personal bytes to land in.
- `connector/atnr_connector/custody.py` — the ACL is re-read and proven to
  grant only the current user before the private root is used; inherited ACEs
  and symlinked roots fail closed.
- `scripts/private-alpha-policy.js` — manifest-digest, approved-index and
  install-flag verification. A tampered manifest, an index override, or a
  weakened flag set fails closed. The commercial/public shipping block is
  unchanged.
- `src/adapters/connector-process.js` — closed reply shape, closed error-code
  vocabulary, bounded output, timeouts and kill escalation, so the connector
  can never author the text the UI shows. Every capability selects a fixed RPC
  command literal from a frozen table; the local custody routes
  (`sealSnapshot`, `sealLocal`, `unsealLocal`) accept only their closed payload
  shape within a bounded size and narrow the reply to a single base64 field, so
  neither a caller nor a hostile reply can turn custody into a general-purpose
  encryption oracle.
- `src/security/runtime-data-source.js` — the user-facing private runtime is
  admitted only when it declares `local-encrypted` state whose store and
  rollback paths are contained in the verified custody root. Synthetic fixture
  modules are not served to a private session, and the browser client refuses a
  session that does not declare the real-data contract, so there is no silent
  fallback to demo data.
- `connector/atnr_connector/custody.py#custody_artifact_path` — a migration or
  rollback envelope may only be a plain file directly inside the hardened
  private root, resolved after the root's ACL is verified.

## Current verification

**Definitive post-delayed-audit results supplied by the Captain — 2026-09-21:**
`npm test` **685 total / 684 pass / 0 fail / 1 environment symlink skip**,
**87.7 seconds**; `npm run connector:test`
**128 total / 126 pass / 0 fail / 2 skips**;
`npm run policy:check` **PASS**, with both unapproved source artifacts still
blocking fresh installation. Skips are symlink controls, not passing evidence.
Actual `node scripts/capture-ui.js --theme all` verified both themes in the
live DOM, wrote 12 neutral PNGs plus manifest, and purge verified.
Previously supplied live private evidence: initial Apple has zero LCARS classes, 50 rows and
`Showing 1–50 of 180 (page 1 of 4)`; Next reaches 51–100. Rapid Apple→LCARS
ends LCARS with Apple CSS disabled and both LCARS sheets enabled, no errors.
These operations were not rerun by this documentation task. Physical-device/
VoiceOver and current provider-revocation evidence remain open.
The [evidence record](../../planning/0.0.2/12-accumulated-implementation.md#executed-evidence-and-limitations)
distinguishes definitive supplied results from historical evidence below.

The blank-page regression is fixed by importing the feedback sentinel from the
browser-safe core instead of Node persistence. Routing starts before a single
bulk `GET /api/v1/feedback` hydration request; failures show a focusable refusal.
Module-graph, bulk-feedback, group-target, filter-persistence, rating, Settings
and theme tests guard those behaviors without claiming native/device proof.

### Historical workstream evidence

Alpha 0.0.2 data/sync/persistence foundation, verified on Windows 11 on
2026-09-17 (data workstream):

- 368 Node tests: 367 passed, 0 failed, 1 environment-dependent symlink skip.
- **Verified deletion:** the local API's `delete-local` route awaits
  `deleteLocalSnapshotVerified()`, which resolves the account join immediately
  before erasing. The route never depends on a cached verdict and has no window
  between the ownership check and the deletion. A mismatch returns the closed
  code `account-mismatch-local-data-quarantined` with zero delete calls.
- **Release identity:** the implemented release is 0.0.2 in `src/version.js`,
  `package.json`, `atnr_connector.CONNECTOR_VERSION`, both runtime profiles and
  the server's startup line. The legacy 0.0.1 identity stays named and asserted:
  `LEGACY_ALPHA_VERSION`, `LEGACY_SCHEMA_VERSION`, `PRIVATE_DATA_DIRECTORY`,
  `LEGACY_STORAGE_SCHEMA_VERSION`, `LEGACY_FINGERPRINT` and the connector's
  DPAPI entropy are unchanged, so the revision-1 container is still recognized
  and the existing custody root is neither relocated nor re-keyed.
- 87 Python connector tests: 85 passed, 0 failed, 2 skipped (symlink creation
  is not permitted without elevation).
- **Account join:** stored library state is served only when the connected
  account matches the account that owns it. A mismatch quarantines every
  private read — status withholds all content, `library()` refuses before the
  sealed body is opened, `sync()` refuses before an attempt is recorded or the
  connector is contacted, deletion is refused, and feedback access is denied —
  without writing anything. Deletion after an explicit disconnect remains
  available to the owner. Raw account keys never appear in status, startup
  evidence or UI.
- **Runtime data requirement:** the user-facing runtime opens the owner's
  existing encrypted local state through `openRealLibraryState()` with
  `requireExistingState: true`: a missing 0.0.1 container stops startup and is
  never silently initialized. Migration is probed read-only, planned purely,
  refused before any file or directory is created for an unknown, newer,
  absent or empty container, and performed only behind a rollback envelope
  inside the same protected custody root; an interrupted migration restores
  that envelope and keeps the last complete state. Startup and migration
  evidence is closed enums and booleans only. See `docs/data-contracts.md` §11.
- A read-only probe of the existing encrypted local state (no migration, no
  sync, no disconnect) classified it as a revision-1 container whose plan is
  `migrate` behind a rollback envelope. Across the probe the file's hash, size
  and modification time were unchanged, confirming the inspection is
  non-mutating. Only these closed values were observed; no title, identifier,
  count or payload was read or printed.
- The previously reported `percentComplete` failure is resolved: the declared
  source scale is `percent-0-100`, so `0.5` stays `0.5`. The two tests that
  asserted magnitude-based rescaling were incorrect and were replaced.
- Reconciling a snapshot that retained a source-removed book requires a
  connector-adapter `sealSnapshot` capability. It is now exposed behind a
  closed payload gate and a narrowed reply, so that case seals the reconciled
  snapshot instead of stopping with `reconciled-seal-unavailable`. The stop
  remains in place for a custodian that does not offer the capability. See
  `docs/data-contracts.md` §7.
- No live provider call was made. All fixtures are synthetic or temporary.

Alpha 0.0.2 security foundation, verified on Windows 11 on 2026-09-17:

- 463 Node tests: 462 passed, 0 failed, 1 environment-dependent symlink skip.
- 98 Python connector tests: 96 passed, 0 failed, 2 skipped (symlink creation
  is not permitted without elevation).
- Connector artifact inventory (`test/connector-artifact-inventory.test.js`):
  the `localArtifactInventory` capability is a named adapter method bound to
  the fixed `local_artifact_inventory` command, takes no parameter, and
  narrows its reply to two existence booleans plus two closed labels. Both
  boolean answers are legitimate — unlike a custody proof, `false` here is a
  fact to report, not a failure — but a non-boolean is never coerced, because
  the deletion report decides what to tell the owner from these values. An
  extra key carrying a path, account alias, identity seed, customer id or byte
  size is refused, as is a missing key, an unrecognised protector label or a
  non-object reply. The service treats a refusal or an absent capability as
  `unknown`, so an unreadable connector can never read as "erased".
- Connector custody capabilities (`sealSnapshot`, `sealLocal`, `unsealLocal`)
  verified with synthetic payloads and an in-memory stand-in custodian only.
  No connector process was launched, no DPAPI operation was performed and no
  personal record was sealed, opened or read.
- The same-origin `GET` bootstrap accepts the browser's normal omission of an
  `Origin` header, while mutations still require an exact origin. Review
  deletion has its own destructive policy with a record- and revision-bound
  nonce instead of borrowing the sync route's policy.
- Runtime data-source and custody-boundary controls verified with temporary
  directories and synthetic paths only. No personal custody root was created,
  read, hardened or deleted; no sync, disconnect or delete was invoked; no
  count, title, identifier or path appears in any assertion output.
- `connector:setup` fails closed with `dependency-source-artifact-unapproved`,
  as designed. Artifact hashes are recorded for all 21 locked distributions
  from the approved index; the two source-only distributions await a named,
  hash-bound approval. A hash-verified `pip download` into a temporary
  directory was attempted and refused by the network at
  `files.pythonhosted.org` (TLS handshake failure), leaving local byte-level
  verification outstanding; the active `.venv` was not modified. `pip check`
  reported no broken requirements, and an OSV.dev query across all 21 pins
  returned zero advisories.
- Three retained must-fixes from the final security review are implemented and covered by
  regression tests (`test/final-review-fixes.test.js`,
  `connector/test/test_envelope_purpose.py`): the OS custody proof now precedes
  any rollback write or migration through a `verify_custody` RPC and a
  `CustodyProofGate`; sealed envelopes are purpose-bound so the snapshot route
  cannot decrypt a private review, refusing before the protector is called; and
  `TEMP`/`TMP` are no longer forwarded to the connector child
  process. Every assertion uses temporary directories and stand-in protectors.
  The connector was not launched, no DPAPI call was made and no real custody
  root was touched.
- Lifecycle HTTP surfaces (`POST /api/v1/export`, `POST /api/v1/delete-all`)
  verified against a stand-in service with synthetic documents only: browser
  sessions, nonce issuance, cross-action nonce refusal, replay refusal, account
  mismatch with zero erasures, download headers, the size ceiling, and a closed
  error for an internal export failure. No export was written, no deletion was
  performed against stored data, and no session, CSRF or nonce
  value appears in an export body.
- Informed-consent deletion flow (`test/deletion-consent.test.js`): the
  inventory route is authenticated and read-strength, its response is closed
  and bounded, a widened or malformed inventory fails closed, the consent text
  states the limitations including exported copies, and a failed inventory load
  blocks the purge without prompting or erasing. Route policy and handler
  tables are asserted to be in exact parity. Connector-owned artifacts are
  observed through the adapter's narrowed `local_artifact_inventory` reply.
  If that capability is unavailable or fails, they remain `unknown`, not
  falsely reported as "not retained".
- Lifecycle binding invalidation (`test/lifecycle-bindings.test.js`) is wired
  after every successful mutation and before its response, with deliberately
  asymmetric strength:
  - A successful connect, disconnect or complete deletion calls
    `invalidateBindings()`. The account generation advances, every session and
    every outstanding confirmation is dropped, and the reloaded page obtains a
    fresh session. A nonce issued against the previous account or state
    generation cannot be spent against the next one.
  - A successful snapshot deletion or review deletion calls
    `invalidateConfirmations()`. Outstanding nonces are dropped; the session
    survives. These transitions change what a pending confirmation refers to
    without changing who is connected.
  - A scheduled sync deliberately invalidates nothing. The service resolves
    the account join first and refuses a mismatch with
    `different-account-local-data-exists` rather than importing it, so a sync
    cannot change account identity. Dropping the session every fifteen minutes
    would interrupt the owner without improving account isolation.
  Review nonces remain bound to record and revision, so ordinary editing is
  unaffected. The client reports an invalidated binding truthfully and asks the
  owner to reload for a fresh session instead of silently retrying.
- The complete-deletion control is labelled "Delete library and feedback data",
  not "delete everything". Provider credentials, the local identity seed and
  the Audible device registration survive it; only a confirmed Disconnect
  removes those. The consent copy states this unconditionally rather than
  relying on an inventory flag, so a service that under-reports retention
  cannot silently turn the warning off.
- Final review lifecycle fixes are implemented and covered by regression tests
  (`test/lifecycle-and-export.test.js`, `test/migration.test.js`): storage
  revision 3 adds a durable, privacy-safe ownership anchor so deleting the
  imported library no longer strands the owner's own ratings and comments; the
  migration rollback envelope is discharged at exactly one verified startup
  checkpoint, disclosed as residue until then, and removed by a confirmed
  complete deletion; the service exposes a complete export (library plus
  feedback plus schema/source metadata, no secrets or raw provider ids) and an
  aggregate purge that recomputes its inventory from the container instead of
  asserting success. No VACUUM is performed or cited as proof of erasure.
  Every assertion runs against synthetic containers in temporary directories.
- Two blockers from the final review are fixed and covered by regression tests:
  the `PRAGMA user_version` marker now commits and is verified inside the same
  transaction as the structure it describes (with an interruption test aimed at
  the exact post-structure/pre-marker window, and recognized recovery
  afterwards); and a local deletion no longer overstates itself — it writes a
  content-free suppression record that survives a restart and blocks automatic
  repopulation until the owner explicitly syncs or reconnects, while
  connector-owned credential and identity artifacts are disclosed through a
  closed existence-only capability, or reported as `unknown`, never as erased.

Alpha 0.0.2 data lifecycle foundation, verified on Windows 11 on 2026-09-17:

- 453 Node tests: 452 passed, 0 failed, 1 environment-dependent symlink skip.
- 98 Python connector tests: 96 passed, 0 failed, 2 skipped (symlink creation
  is not permitted without elevation).
- No personal state was opened, migrated, synchronized or deleted, and no live
  provider call was made.

Earlier alpha 0.0.1 evidence, verified on Windows 11 on 2026-09-17:

- 156 Node tests: 155 passed, 0 failed, 1 environment-dependent symlink skip.
- 9 Python connector tests: 9 passed.
- Windows DPAPI protect/unprotect round trip passed.
- Pinned dependency audit: no known vulnerabilities.
- Modern `CryptographyProvider` selected by `audible` 0.12.0.
- Persistent provider registration survived server restart.
- Automatic startup sync promoted a complete, non-empty encrypted library
  snapshot with matching book and entry counts.
- Live UI rendered the complete synchronized snapshot and exposed connected
  status, explicit Disconnect, and the commercial-shipping block.
- `npm pack --dry-run` was rejected by the shipping gate.

No participant-specific counts, title, ASIN, account identifier, token, cookie,
key, callback URL, or metadata value is recorded here.

The symlink-containment test **skips** where the OS forbids symlink creation
without elevation (default Windows); it is only evidence on a platform that
allowed it to run.

## UI (synthetic mode) — synthetic fixture evidence inspector only

**This UI is intentionally NOT a ratings/recommendation product.** Per the
locked `planning/archive/0.0.1/01-release-charter.md` scope (item 8) and
`planning/archive/0.0.1/03-user-stories.md` (ATR-S008, ATR-S009), the synthetic UI
is restricted to:

- A read-only **library evidence table** (`#/library`, `#/book/:id`): sort,
  filter, and group by the catalog fields the core already tracks (title,
  author, narrator, series, genre, status, progress, duration), with explicit
  text-based provenance and unknown-field labeling — unknown is never shown as
  zero.
- A read-only **metadata feasibility card** and a clearly separated,
  explicitly labeled **synthetic-only structural trace** (`#/feasibility`)
  that illustrates shared-facet edges (same author/narrator/genre/series)
  between synthetic fixture books. This trace is explicitly labeled
  "not a recommendation" everywhere it appears — it carries no score, rank,
  or confidence value, and never mixes mock preference data with the
  library's records.
- **Lifecycle controls** (`#/data`): a consent-acknowledgment gate;
  manual-only refresh (clean and safe induced-error variants, since nothing
  here ever refreshes automatically or on a timer); disconnect (stops further
  access but keeps the already-imported synthetic data until deletion);
  delete (irreversibly erases all in-memory synthetic state); and export
  (a versioned JSON snapshot of the current in-memory state only).

Explicitly **out of scope for the synthetic inspector**, and removed from an earlier draft
of this UI during a scope correction: editable book/facet ratings, comments,
tags, or favorites; any recommendation, ranking, or feedback surface; and the
future DIRECT_MATCH/EXPLORATORY/PERSPECTIVE_BROADENING trust-contract
vocabulary (owned by a separate future story, ATR-S010, and intentionally
absent from this UI's output).

Implemented as static HTML/CSS/ES modules with no build step, no UI
framework, and no external dependency. It is explicitly labeled synthetic,
import-only, and disconnected from any real Audible/Amazon account (see the
"Data & lifecycle" view and `RUNTIME_PROFILE`). See `ui/index.html` and
`ui/js/app.js` for the entry points, and `test/ui-*.test.js` for its
dependency-free contract tests (view-model/lifecycle logic, formatting, the
static server, and static-asset compliance scans for gradients/shadows/remote
assets/network calls/out-of-scope recommendation or editing code paths).

The canonical LCARS typeface (Antonio) is a webfont and is intentionally not
loaded, since this prototype makes no remote requests of any kind; a local
condensed system-font stack approximates it instead.

## Design rules under test

- **Authority split.** Imported progress lives in library entries. There is no
  source-sync authority over the private alpha's encrypted annotation store;
  inert `SYNTHETIC_LOCAL_SENTINELS` fixtures additionally prove
  `mergeLibrarySnapshot` cannot write, delete, or repoint local records.
- **Commercial exclusion by construction.** Commercial fields are stripped at
  ingestion, the evidence projection is an allowlist (`toScoringView`), the
  evidence *route* is allowlisted (`assertAllowedRoute`), source ordinal and
  retrieval rank are prohibited tokens, and accepted contract output is
  re-scanned before it is returned.
- **Contract invariance, not ranker invariance.** Paired fixtures that differ
  only in commercial offers and retrieval order produce byte-identical
  canonical accepted evidence (`canonicalJson`).
- **Resolvable claims only.** Every ExplainabilityTrace edge must resolve to a
  known catalog node *and* a known synthetic history or explicit-preference
  node; missing, dangling, and floating claims are rejected.
- **No ideology inference.** The validator takes `(candidate, { catalog,
  knownNodes })` — there is no user model, no user ID, and no identity input.
  Ideology proxies, unsupported perspective labels, category-difference-as-
  viewpoint, and unsafe/low-quality false balance are all rejected.
- **Honest unknowns.** Unknown stays `null`, is listed in provenance, sorts last
  in both directions, and never satisfies a threshold filter.

## Charter traceability (locked alpha 0.0.1 scope)

Historical scope-correction record only: its “no feedback store/API” and
unchanged-UI statements describe 0.0.1, not the current private 0.0.2 runtime.
Current 0.0.2 behavior and evidence are documented above.

| Charter item | How this core complies |
|---|---|
| **ATR-PR12** — ratings/comments deferred; synthetic annotation preservation only | No ratings/comments/tags/favorites API, store, column, sort field, or filter. Only inert `SYNTHETIC_LOCAL_SENTINELS` fixtures + a merge-cannot-touch-local test. |
| **ATR-PR13** — recommendation engine/explanations deferred; minimal relation/label contracts with synthetic grounding pointers only | `src/core/contract.js` validates structure only: no scoring, ranking, selection, assembly, or generated prose. `CONTRACT_SCOPE` asserts this in code and in tests. |
| **ATR-PR14** — recommendation feedback deferred entirely | No feedback verdicts, store, or API anywhere in `src/`. |
| **ATR-PR15** — rich navigation deferred; minimal inspector only | `src/core/library.js` is a read-only projection (sort/filter/facet/group) over catalog + snapshot. |
| **ATR-PR08** — no ads/affiliates; future ranking contract + adversarial fixtures | Prohibited-token scan, ingestion stripping, evidence + route allowlists, and 7 commercial/route adversarial fixtures. |
| **ATR-PR09** — no identity inference or false balance | `assertNoIdentityProfiling`, ideology-proxy pointer rejection, baseline quality/credibility floor, content/language/accessibility gates. |
| **ATR-S003 AC4–AC6** — synthetic fixtures, no real ratings feature, local sentinels, versioned closed properties, unknown-version rejection | `src/fixtures/synthetic.js` (multi-role people, duplicate edition, unknown-narrator record, viewpoint cluster, sentinels) + `unknown-contract-version` rejection. |
| **ATR-S010 AC1–AC6** — allowlist-only versioned contract, resolvable traces, exact labels, paired-fixture invariance, adversarial rejection, no engine/model/egress | `test/contract.test.js` (26 adversarial fixtures, one per rule) and `test/trust.test.js` (paired-set invariance, route allowlist). |
| **ATR-S008/S009** — read-only evidence inspector + lifecycle | `ui/` and `test/ui-*.test.js`, unchanged by this trim except for the removal of deferred core imports. |

### Removed during the scope correction

Modules deleted because they implemented deferred future-product behavior:
`src/core/annotations.js`, `src/core/affinity.js`, `src/core/preferences.js`,
`src/core/perspective.js`, `src/core/explain.js`, `src/core/recommend.js`,
`src/fixtures/scenarios.js`, and their tests `test/annotations.test.js`,
`test/perspective.test.js`, `test/recommend.test.js`, `test/explain.test.js`.
