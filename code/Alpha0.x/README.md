# Alpha 0.0.1 — evidence harness and private Audible connector

Read-only LCARS evidence inspector, platform-neutral domain contracts, and
executable tests for Audible Track and Recommend.

**Default mode:** a self-contained, zero-npm-dependency Node.js ESM core,
loopback server, and browser UI exercised entirely against invented fixtures.

**Private alpha mode:** a Windows-local, single-user connector using the pinned
community `audible` 0.12.0 client. Human authentication occurs in an
Amazon-controlled Edge page. Provider credentials remain in the isolated
Python process and are sealed with user-scoped Windows DPAPI. Node receives
normalized library data only and stores a DPAPI-encrypted snapshot blob in
SQLite outside the repository.

This remains an architecture experiment, not a final platform decision. The
connector is unofficial and reverse-engineered. Commercial/public shipping,
hosting, package publication, installers, and app-store submission are blocked.

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

Windows 11, Edge, Node 24+, and Python 3.11–3.14 x64 are required.

```text
cd code\Alpha0.x
npm run connector:setup
npm run connector:test
npm run policy:check
npm run private-alpha
```

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

It must never be copied into the repository or a cloud-synchronized folder.

## Layout

```
src/version.js          0.0.1 source of truth (schema/contract/policy versions, runtime profile)
src/index.js            public, platform-neutral surface
src/core/errors.js      ValidationError, TrustViolationError, GroundingError, ContractViolationError
src/core/validate.js    bounded, pollution-safe validators; unknown = null
src/core/trust.js       commercial-input exclusion + evidence allowlist + route allowlist + anti-profiling
src/core/model.js       Catalog, normalization, provenance, idempotent snapshot merge
src/core/library.js     evidence-inspector projection: sorting, filtering, faceting, grouping
src/core/contract.js    closed evidence/ExplainabilityTrace contract validator (NOT a recommender)
src/fixtures/synthetic.js          synthetic catalog, snapshots, local sentinels, adversarial records
src/fixtures/contract-fixtures.js  synthetic trace candidates + 26 adversarial rejection fixtures
scripts/serve.js        dependency-free loopback static server for ui/ (no persistence or outbound requests)
scripts/private-alpha-runtime.js  opt-in local connector/runtime composition
scripts/private-alpha-policy.js   hard private/non-commercial shipping gate
scripts/setup-connector.js        creates the ignored connector virtual environment
connector/                        isolated Python Audible adapter, DPAPI custody, lockfile, tests, notices
src/adapters/connector-process.js fixed-command stdio boundary; no credential fields
src/store/encrypted-snapshot-store.js local SQLite containing only a DPAPI-sealed snapshot
src/sync/live-snapshot.js         closed validation of normalized Audible snapshots
src/sync/private-alpha-service.js sync, account isolation, scheduler, and explicit disconnect lifecycle
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

### H1–H6

| ID | Fix | Where |
|----|-----|-------|
| H1 | Malformed URL (bad percent-encoding, NUL) returns a fixed `400 Bad request` with no error detail; internal failures return a bare `Internal error`. | `scripts/serve.js` |
| H2 | `realpath()` symlink containment plus a separator-safe `isContained()` check, so `ui-secrets/` cannot pass a `ui` prefix test and a symlink cannot escape the served root. Non-files 404. | `scripts/serve.js` |
| H3 | `SECURITY_HEADERS` on **every** response including errors: CSP (`default-src 'none'`, `connect-src 'none'`, `frame-ancestors 'none'`), `nosniff`, `no-referrer`, CORP/COOP `same-origin`, `permissions-policy`, `no-store`; plus a loopback-only `Host` allowlist (403 otherwise) against DNS rebinding. | `scripts/serve.js` |
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

- a witnessed persistent real-account connect, restart, automatic refresh, and
  explicit disconnect/reconnect drill;
- packet-level destination evidence and measured request/byte/runtime ceilings;
- vulnerability and license review of the pinned Python dependency lock;
- verified cleanup after interrupted registration and failed deregistration;
- full durable deletion/residue inventory, backup disclosure, and reboot test;
- source-field coverage measurements over the complete private library;
- legal review before any copy is conveyed even without payment.

## Current verification

Verified on Windows 11 on 2026-09-17:

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

## UI (alpha 0.0.1) — synthetic fixture evidence inspector only

**This UI is intentionally NOT a ratings/recommendation product.** Per the
locked `planning/archive/0.0.1/01-release-charter.md` scope (item 8) and
`planning/archive/0.0.1/03-user-stories.md` (ATR-S008, ATR-S009), the alpha 0.0.1 UI
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

Explicitly **out of scope** for this alpha, and removed from an earlier draft
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
  local annotation store in this alpha; inert `SYNTHETIC_LOCAL_SENTINELS`
  fixtures prove `mergeLibrarySnapshot` has no parameter or code path that can
  write, delete, or repoint locally owned records.
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
