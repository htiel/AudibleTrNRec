# Alpha 0.0.2 accumulated implementation record

**Reconciliation date:** 2026-09-21 (owner-local date; post-delayed-Data-audit evidence)

**Basis:** current tracked diff and new files against `1d1e946`
(`Complete Alpha 0.0.2 private library UX`), inspected implementation/tests,
and the Captain's definitive post-audit test/capture results supplied on
2026-09-21, with the previously supplied live matrix retained as earlier
evidence. Code and documentation were inspected for this reconciliation;
the suites, capture and private matrix were not rerun by this documentation
task. Earlier accumulated behavior was audited against
`53fc550`; that is historical provenance, not the current comparison base.
The Captain reports all three implementation streams green. This documentation
verification is not a new full-team sign-off, issue closure or release.

The implementation version remains `0.0.2`, storage revision **3**. The
[verdict](11-implementation-release-verdict.md) remains owner-only
**APPROVE WITH CONDITIONS**; named testers and distribution remain **NO-GO**.
This record supersedes stale implementation descriptions, not release gates.
Historical plans/reviews retain their original requirements and evidence dates.

## Integrated remediation: issues #1–#14

Geordi's shell/UI stream, Data's normalization/state/pagination stream and
Worf's export/capture stream are integrated. The table records **implementation
disposition**, not a declaration that every issue acceptance criterion or A2
gate passed. No GitHub issue was edited or closed by this task.

Paths in this table are under `code/Alpha0.x/`.

| Issue | Integrated behavior | Evidence and remaining boundary |
| --- | --- | --- |
| #1 | Filter text/boundary styling and increased-contrast/reduced-transparency treatments revised in shared components and themes | CSS/source regression coverage; complete rendered/composited contrast matrix not rerun here |
| #2 | Debounced search/tag updates replace results, not the active toolbar inputs | `views/library-view.js` and UI regression tests; physical mobile keyboard/selection/IME journey not proven here |
| #3 | `normalize.py::plain_text_from_markup` emits bounded inert synopsis text with paragraph breaks | Connector normalization tests cover markup/entities/malformed input; Book Detail stays text-only |
| #4 | `seriesEvidence` and shared `seriesPresentation()` consistently distinguish unknown from supplied series | Model/library/private-store/normalization tests; `confirmed-standalone` is reserved, no current ingestion path produces it |
| #5 | Search-first controls; advanced filters closed on mobile; compact LCARS mobile chrome | Chromium regression coverage exercises actual private view/store with a fabricated one-book snapshot in both themes at 320×844 and 390×844 |
| #6 | Empty Library-control region collapses off Library routes | Shell/CSS regression coverage; no claim of a fresh all-route visual audit |
| #7 | Visible export warning and strict affirmative pre-request consent in private and synthetic views | `export-consent`, `deletion-consent` and `connection-api` tests; cancel/dismiss obtains/spends no nonce, requests nothing and creates no file |
| #8 | Evidence-derived health replaces credential-only success copy; failed sync refreshes recorded status and rerenders the Data status/header | Connector/service/bootstrap and Data-view tests; unreachable refresh is marked stale, not invented revocation; current provider revocation remains untested |
| #9 | Main-content bottom/scroll padding and Apple tab-bar safe-area clearance added | CSS/source guards; complete bottom-element geometry and 200% zoom matrix still needs acceptance evidence |
| #10 | Hard 50-row maximum with reachable row/group/child Previous/Next controls, complete counts and no "Show all"; dirty drafts block paging | Core/store regression fixtures plus supplied live private matrix: 50 rows, page 1 of 4, Next reaches 51–100; no latency benchmark claimed |
| #11 | LCARS filter overflow has a persistent cue, with keyboard-reachable scrolling | Shell/CSS guards; constrained-height/200% zoom/AT matrix remains to be witnessed |
| #12 | Settings describes browser-supported preference handling without universal accessibility guarantees | Updated view and suite; no WCAG certificate, native setting integration or physical-device claim |
| #13 | Button-like anchors receive neutral shared button decoration/focus styling | UI style guards; do not infer a full computed-style/theme/zoom matrix |
| #14 | Synthetic-default capture selects and verifies both themes in the live DOM, with neutral artifacts, ignore controls and per-run private consent/retention | Actual supplied `--theme all` run wrote 12 neutral PNGs plus manifest, then purge verified; driver remains undeclared/unpinned |

The new shell requirement is implemented as **independent markup, neutral
shared tokens and exclusive theme stylesheets**:
`app.js` dynamically mounts exactly one of `shells/apple-shell.js` and
`shells/lcars-shell.js` into `#shell-root`. Apple mode builds its own compact
navigation bar, Library/Data/Settings tabs, contextual back navigation and
responsive reading column. Feasibility remains accessible from Data. LCARS
retains separately constructed elbows, sidebar and footer. Shared views use
neutral `atnr-*` classes and keep the same store across a shell switch.

Apple styling no longer references `--lcars-*`; shared tokens/components use
`--atnr-*`. `applyTheme()` invokes `syncThemeStylesheets()` to disable both
LCARS-only sheets (`layout.css`, `theme-lcars.css`) in Apple mode and enable
`theme-liquid-glass.css`. LCARS mode reverses those states, leaving neutral
sheets active. The final live private matrix starts in Apple with **zero
LCARS classes** and confirms rapid Apple→LCARS switching ends with the Apple
sheet disabled, both LCARS sheets enabled, and no errors. These results resolve
the earlier token/stylesheet-independence discrepancies.
See [Geordi's implementation record](13-independent-theme-ui-spec.md), read
with the final evidence and remaining device/tooling limits below.

## Independent code-review findings and fixes

These are the integrated independent-review corrections, not a newly
commissioned review or a new release sign-off:

| Finding | Fix and regression evidence |
| --- | --- |
| Pagination was bounded in the core/store but unreachable in the view | `views/library-view.js` now consumes the shared pagination/summary contract and renders Previous/Next controls for ungrouped rows, group pages and expanded-group child pages. Dirty drafts announce/refocus the editor and block page changes until saved or discarded. Core/store fixtures and the supplied live 1–50 → 51–100 matrix verify reachability. |
| Person feedback target changed when display-group membership changed | `private-store.js` always uses `person:<author|narrator>:display-<normalized-label hash>`, independent of member count. Legacy source-ID targets remain readable aliases; canonical records win. A successful canonical save precedes alias retirement using the alias's own revision. Failure preserves both copies and reports `aliasMigration`; multiple populated aliases set `aliasConflict` and are not automatically migrated/deleted. `private-library-state.test.js` covers identity stability, legacy migration, failure and ambiguity. |
| A slower dynamic import could overwrite the last selected theme | `app.js` uses a monotonic activation generation; stale completions return before DOM/chrome/route mutation. Supplied rapid-switch live evidence ends in the last selected LCARS theme without errors. |
| Theme-scoped stylesheet links were not actually toggled | `theme-preference.js::syncThemeStylesheets()` is called by `applyTheme()` and updates each scoped link's `disabled` state. Neutral sheets stay enabled; theme-preference tests and the final live sheet-state matrix cover the correction. |
| Failed sync left a stale verified claim on screen | Service/store refresh recorded connector evidence after failure, without a new provider probe; Data rerenders connection disclosure and header status. Refusal evidence outranks prior verification. If status cannot be reread, the view labels custody-only state stale rather than claiming verification or inventing revocation. Connector, service, private-store, bootstrap and Data-view regressions cover this path. |

Stable display-label hashes are presentation identities, not proof of canonical
person resolution or cryptographic integrity. Migration is a save-time feedback
alias migration, not a new storage-schema or credential migration.

## Delayed Data audit remediation

The following follow-up fixes are integrated after the preceding independent
review. They do not select a platform or establish new provider access:

| Audit finding | Implemented correction |
| --- | --- |
| Completed status plus a partial percentage read as one contradictory fact | Source status and percentage remain independent, unchanged evidence. Core progress presentation separates attribution from position and flags disagreement. The current Library/Detail formatter does not place a bare historical percentage beside Completed; a separately supplied current position is explicitly labeled. No completion or re-listen position is inferred from the other value. |
| Internal provenance tokens leaked into owner-facing copy | Owner-facing provenance uses a closed label vocabulary, including the unofficial Audible connector and an Unknown fallback; arbitrary source strings are not displayed as authority. |
| Private Feasibility appeared as a routine navigation destination | Private primary navigation excludes Feasibility in both shells. It remains context-linked from Data, with the route retained for direct/synthetic diagnostics; it does not pretend synthetic trace evidence is private-account evidence. |
| Data did not present a safe current inventory | A non-destructive inventory reports held titles, feedback and last-import evidence, keeping `known` separate from counts. Reading it does not synchronize, export, delete or spend a confirmation nonce. Missing/unreadable evidence is Unknown, not zero. The pre-deletion inventory remains a separate consent surface. |
| Release bumps orphaned valid saved filters | The canonical session key is schema-only, `atnr:private-library-filters:v2`. Valid legacy release-scoped state is copied only when the canonical key is absent; canonical state wins, and legacy/unrelated browser state is not deleted. Migration failures are reported. |
| Status and feedback instructions were duplicated | The filter fieldset has one Status label. Book Detail has one actionable feedback guidance link back to Library, using the existing return-focus mechanism instead of duplicating an editor or a second instruction. |
| Snapshot parsing looked like a fresh import, and actual sync counts vanished on reload | Actual sync reconciliation is persisted in an account/snapshot-bound `last-import-counts.json` sidecar and restored from status. Parsing a retained snapshot alone stays **Unknown / not an import**; it never manufactures imported counts. |

### Last-import evidence survives reload

`PrivateAlphaService` writes a version-1, non-sensitive operational summary
beside the existing protected-custody sidecars, not a new database table.
The record declares `basis: sync-reconciliation` and
`authority: requested-sync`, observation/recording timestamps, snapshot
generation, a one-way account binding and the measured counts `added`,
`updated`, `reappeared`, `missingFromSource`. It contains no book titles,
book identifiers, account key, marketplace or private feedback. It is not an
encrypted content export or a new authentication boundary.

Adoption validates version/basis/authority, timestamps, count bounds,
account binding and the retained snapshot generation. Quarantined, malformed,
missing or superseded evidence stays Unknown. `status().local.lastImport`
withholds the binding; reading status adds no provider probe. The private
store restores valid persisted status after reload, while a current in-session
sync measurement takes precedence. Unmeasured `unchanged` and `rejected`
counts stay null/Unknown, not zero.

The store distinguishes `sync-reconciliation` / `requested-sync` from
`snapshot-load` / `local-snapshot-parse`. Loading a snapshot is never sufficient
to say an import occurred, even if parsing produces apparent added-row counts.
Actual reconciliation plus its persisted receipt is the authority.

Failed receipt persistence does not turn a completed durable sync into a
failed sync; it leaves reload evidence unavailable rather than inventing
counts. Snapshot/local-data deletion removes the derived receipt; account and
generation checks also prevent stale/cross-account adoption. Disconnect retains
the receipt alongside the retained snapshot. Source/storage revisions remain
unchanged. See [Data's contracts](../../code/Alpha0.x/docs/data-contracts.md)
for the bounded record and lifecycle.

Regression evidence is in the existing library/model/format, filter-persistence,
private-library-state/private-alpha-service, UI follow-up, navigation/shell and
Data-view inventory tests. The definitive suite result below includes this
follow-up; no new physical-device or current provider-revocation proof follows.

## Connection and current trust boundary

- **Retained:** external-browser Audible device registration through
  `audible.Authenticator.from_login_external`, the pinned unofficial
  `audible` 0.12.0 connector and provider-controlled Edge authentication.
  ATnR does not collect passwords, passkeys or OTPs. Node/browser receive
  normalized data, not provider credentials.
- The private UI reads the real encrypted library snapshot and available
  progress; missing/unverified local/account state fails closed, never to synthetic fixtures.
  Default `npm run serve` remains a separate synthetic evidence inspector.
- The virtual device persists through sync and shutdown. Confirmed Disconnect
  deregisters it; failed deregistration retains credentials for retry.
  Credentials and private state remain under Windows current-user DPAPI in the
  existing ACL-verified legacy `Alpha0.0.1` custody root. This work does not
  relocate/re-key that state or demonstrate a new migration.
- **Removed by owner change control, 2026-09-18:** manual per-start local key,
  launcher unlock window, capability header and re-entry prompts. This is not
  removal of Audible authorization.
- `GET /api/v1/session` now mints an in-memory browser session after browser
  metadata checks, without a local secret. Other API routes require the
  session; mutations retain CSRF and exact-origin checks. Loopback binding to
  `127.0.0.1`, verified Host, same-origin fetch metadata and Referer checks
  remain. Session limits are 64 active sessions, 16 mints/minute, one-hour
  idle and twelve-hour absolute expiry.
- Export, disconnect and deletion retain single-use, action/session/account-
  generation-bound confirmation nonces with a 120-second lifetime. Review
  deletion additionally binds the target/revision. Confirmation is not
  reauthentication; different actions cannot share a nonce.
- **Accepted exposure:** same-user local processes can obtain sessions and
  access private operations. Request headers do not establish process identity.
  This is neither a shared-machine nor an OS-user isolation guarantee. Use only
  the owner's dedicated trusted computer/profile, stop the service when idle,
  and do not expose it through LAN binding, tunnels or phone access.
- DPAPI does not protect against same-user compromise, live plaintext,
  extensions, dumps/pagefile, backups or user-held exports. Purpose headers
  are checked before dispatch but do not provide independently keyed
  cryptographic purpose isolation. SQLite deletion is not forensic erasure.

Evidence anchors: `scripts/serve.js`, `src/security/local-api-auth.js`,
`ui/js/connection-api.js`, `connector/atnr_connector/service.py` and `custody.py`
under [the implementation](../../code/Alpha0.x/README.md).

### Provider-health evidence, not credential presence

`connectionState` is `disconnected`, `unverified`, `verified` or
`authorization-failed`. Successful device registration or library sync supplies
`lastVerifiedAt` and its basis; the freshness horizon is **24 hours**. Future
timestamps do not verify a connection; a refusal at or after the last success
wins. HTTP 401/403 or recognized authorization exceptions record failure;
ordinary network/timeouts are not called revocation. `status()` performs no
provider probe. Existing scheduled sync behavior is not a new verification
poller.

The connector's legacy `connected` boolean still means an authorization
envelope is held, for lifecycle compatibility. UI health uses the new state,
not that boolean. Last verification is separate from last durable sync
success, and an account mismatch remains a quarantine condition. This is
recent evidence, not a continuously verified connection or instant revocation
detection.

After failed sync, `PrivateAlphaService.sync()` rereads connector status and
the UI uses `noteSyncFailure()` / `refreshConnectionState()` to apply that
evidence. A newer refusal takes precedence even when its persistence failed
and only process-lifetime evidence remains. An unreachable status refresh
does not fabricate a provider refusal: the store retains prior evidence while
the Data presentation is custody-only/stale. Library, feedback and drafts are
untouched. This correction does not itself prove current provider revocation.

No new reauthorization endpoint or credential-replacement flow was introduced.
The UI advises reconnection; existing `connect()` still refuses an existing
envelope, and failed deregistration retains it. End-to-end revoked-credential
recovery remains unproven; do not instruct owners to delete custody files to
work around that limitation.

### Synopsis and series contracts

Normalization converts known provider markup to a single plain-text synopsis.
Known active-content tags are removed with their contents; paragraph/line
boundaries become blank-line separation. Entities decode after tag removal,
so encoded markup and ordinary comparisons remain inert literal text.
Input over 64 KiB is refused; output over 2,000 characters is omitted rather
than truncated. Rendering remains text-only with paragraph whitespace.

`seriesEvidence` uses `provider-supplied`, `unknown`, or reserved
`confirmed-standalone`. Absence/empty data is not standalone evidence; no
current ingestion producer confirms standalone. Cards, groups and detail use
one presentation contract. Source-contract revision and storage revision did
not change. [Data's contracts](../../code/Alpha0.x/docs/data-contracts.md)
record the implementation details.

## Startup and feedback data path

The blank-page cause was a browser import of the Node persistence module
(`node:sqlite`/`node:crypto`). `ABSENT_REVISION` now lives in browser-safe
`src/core/feedback.js`; `src/store/feedback-store.js` re-exports it for Node.
The served-module regression test rejects unresolved bare imports.

The router renders before feedback hydration. One session-protected
`GET /api/v1/feedback` request lists active account-bound reviews, replacing
per-book startup requests; the list also includes namespaced group targets.
Bootstrap/hydration errors render a visible, focusable fail-closed state.
This is a request-count improvement, not a measured latency claim.

## Library feedback and browsing

- Books have independent overall/story/narration ratings, comment and tags.
  Known Author, Narrator and Series groups have a separate overall rating,
  comment and tags through **Rate & Review**, even when their books are
  collapsed. Opening a group editor need not expand those books. Unknown or
  invalid target identities have no false review target. Book Detail directs
  editing back to Library rather than duplicating the editor.
- Group targets use `person:author:*`, `person:narrator:*` and `series:*` keys
  in the existing account/target feedback store; group feedback never copies
  onto member books. Existing encryption, revision conflict, tombstone,
  export/deletion and sync-preservation contracts apply; no schema bump.
- Author/narrator **display** grouping normalizes case, whitespace and Unicode
  names, retains contributing source person IDs and deduplicates books. Equal
  names are not proof of the same person. Multi-source groups disclose that
  fact. Person targets now always use the normalized-label hash, independent
  of member count; Series still groups by source ID. Legacy source-ID feedback
  remains readable through aliases and migrates after a successful canonical
  save, with revision-safe retirement and explicit ambiguity/failure handling.
  Display hashes are not canonical identity or
  cryptographic integrity; equal-name people can share a display group.
- Each rating dimension offers five native radio choices with exact spoken
  labels and progressive fill: choosing 3 fills 1–3. Clear restores `null`
  (Unrated). Existing half-star values remain explicitly disclosed and unchanged
  unless deliberately replaced or cleared; the domain validator still accepts
  half-steps. Explicit Save remains required; typing does not imply persistence.
- Search/tag controls precede advanced filters, which default closed on mobile.
  LCARS retains independent desktop main/filter scrolling above 640 CSS px;
  narrower screens use document flow and compact chrome. Apple mode instead
  uses its own toolbar, navigation/tab bars and responsive reading column.
- `paginate.js` caps ungrouped pages at **50 rows**, or grouped pages at
  **five groups × ten child rows**. Collapsed groups render zero children;
  counts retain whole-result/group totals. There is no unbounded "Show all".
  Reachable Previous/Next controls consume the same count/page contract.
  Listing changes reset pages; dirty drafts block paging until saved or
  discarded, with an announcement and editor focus. Large synthetic fixtures
  validate the paging contract; supplied live evidence confirms 50 rendered
  rows and Next-page reachability, not a measured latency improvement.
- Validated, bounded, versioned `sessionStorage` saves filter/sort/group and
  collapsed-group/page state across refreshes in a tab (filter state version
  **2**, including validated per-group child pages). The canonical storage key
  is schema-only, `atnr:private-library-filters:v2`, not application-version
  scoped. Valid legacy release keys migrate by copy only if canonical state
  is absent; no key is deleted. It may contain private query
  and tag text: it is browser storage, **not DPAPI-encrypted custody**. No draft,
  active editor, focus target or scroll position is serialized; no query/tag
  content enters URLs or durable theme storage. Invalid/unavailable filter
  storage produces a warning/default state without substituting demo data.
  Browser session restoration may retain tab state; tab closure is not secure
  erasure or a guaranteed purge. Reset preserves an in-progress feedback draft.
- Focus uses `preventScroll` to avoid route-entry jumps; bootstrap refusal owns
  its heading focus. Explicit disclosure chevrons, wrapping/minimum-width fixes,
  safe-area padding, viewport-bounded dialogs and 44-CSS-pixel primary targets
  have regression coverage. Static CSS/source tests are not rendered WCAG proof.

## Settings and theme persistence

`#/settings` is reachable through LCARS navigation or the Apple tab bar in both
synthetic and private modes. Its semantic HTML radio group switches between
default **LCARS** and opt-in Apple-style **Liquid Glass**. The shell remounts,
while the shared store/route and in-memory draft state are retained; selection
does not initiate provider authorization.

Only the closed theme value (`lcars` or `liquid-glass`) is durably stored under
`localStorage` key `atnr:ui-theme:v1`; it survives refresh/restart for that browser
origin/profile, not across devices. It contains no private library/query data.
Invalid or unavailable storage falls back to LCARS on load. A failed save still
applies the selected appearance for the visit and reports it could not be
remembered. The theme is applied before network/bootstrap work, but a brief
default-theme flash before module execution remains possible.

Liquid Glass has its own shell markup and scoped CSS using translucency,
backdrop blur, rounded surfaces and local system typography. Reduced-motion, reduced-transparency and
increased-contrast media-query handling are present; browser support and actual
rendered contrast must still be verified. No remote assets/fonts, Apple SDK,
private framework or copied template artwork are bundled.

### Apple design-resource provenance and native limits

Public first-party pages were retrieved successfully on **2026-09-19**:

1. [Apple Design Resources](https://developer.apple.com/design/resources/)
   lists **iOS 27 and iPadOS 27** UI resources, including the linked Figma UI kit
   and icon templates. Its HTML uses `&nbsp;` between the platform name and
   version; a plain literal-space search alone misses that heading.
2. [Human Interface Guidelines — Materials](https://developer.apple.com/design/human-interface-guidelines/materials)
   (verified through Apple's
   [documentation JSON](https://developer.apple.com/tutorials/data/design/human-interface-guidelines/materials.json))
   describes Liquid Glass, regular/clear variants, legibility and accessibility
   adaptation. These are design references, not downloaded implementation assets.

The code's theme comments and Settings description cite these resources.
The resource listing verifies iOS 27 provenance, **not** native implementation,
pixel parity, an Apple endorsement, conformance certification or a minimum
supported iOS version. This project's semantic HTML/CSS/JS interpretation
cannot reproduce native real-time specular/refraction rendering, Dynamic Type
or direct OS accessibility-setting integration. CSS media features are
approximations; 44 CSS px is not proof of native 44 pt sizing.

The [native iPhone direction](07-native-iphone-direction.md) remains gated.
This appearance option does not select SwiftUI/UIKit, port the connector,
authorize a phone-to-loopback route or clear TestFlight/App Store conveyance.

Apple HIG, documented Apple API behavior and Apple Design Resources are the
normative design sources. **Google image search is non-normative inspiration
only.** It cannot justify requirements or acceptance. Do not copy, trace,
bundle or hotlink third-party imagery, screenshots, fonts, icons or UI assets;
do not upload private captures/data to search services. No new image-search
session or Apple-resource retrieval was performed for this documentation
verification; the dated retrieval above remains historical evidence.

Independent web shells do not establish UIKit/SwiftUI equivalence, native
materials/Dynamic Type, Apple endorsement or physical iPhone validation.

## Export consent and capture policy

The export page visibly names titles, progress, ratings, comments and tags,
warns that JSON is plaintext outside ATnR protection, and explains that later
local deletion cannot recall the copy. `runGuardedExport()` requires strict
`true` confirmation before requesting export. Cancel/dismiss obtains/spends
no nonce, makes no request and produces no file. Both synthetic and private
flows use the gate; the private flow retains existing session/CSRF/action-bound
nonce protections. No owner export was performed by this documentation task.

`node scripts/capture-ui.js` starts a separate synthetic loopback server with
production shells/views and no private service. Default output is ignored
`.capture-out/synthetic/`, with neutral allowlisted filenames and manifest
metadata. The runner takes page-only screenshots, disables extra recordings,
and blocks requests outside the capture origin.

Both themes are selected by default; `--theme all` explicitly requests
`lcars` and `liquid-glass`. The runner operates the production Settings controls,
verifies the chosen theme in the live DOM before screenshots, and builds the
manifest from rendered themes rather than a caller-supplied label. The final
actual synthetic run produced **12 neutral PNGs plus a manifest** (six targets
× two themes), followed by verified purge. No private screenshot is included
in that evidence.

Real mode requires explicit per-invocation consent/acknowledgements, an external
non-synced output location, empty output and a **1–24-hour** retention deadline.
Protected custody is a handling obligation; the runner does not encrypt images
or establish a new OS custody proof. Purge removes files and verifies absence,
not forensic erasure or deletion of backups/copies. Never commit/attach real
captures. See [Worf's capture procedure](../../code/Alpha0.x/docs/visual-capture.md).

Fixed targets omit book-detail deep links. Runtime-specific tab titles are
unchanged (page-only screenshots omit the tab strip). Successful both-theme
capture/purge is evidence for that procedure, not physical-device/VoiceOver
validation or a complete visual/a11y certification.

## Executed evidence and limitations

**Definitive post-delayed-audit results supplied by the Captain on 2026-09-21**, reconciled
against current code/tests and the latest workstream records. These are not
fresh executions by this documentation task. Earlier locally executed
2026-09-19 environment details (Node v24.18.0, Python 3.13.15, Playwright 1.63.0)
are historical, not an independently rechecked final environment inventory.

| Command / evidence | Result | Boundary |
| --- | --- | --- |
| `npm test` | **685 total / 684 pass / 0 fail / 1 skip**, **87.7 seconds** | Definitive post-audit suite result; environment symlink skip, not a passing control |
| `npm run connector:test` | **128 total / 126 pass / 0 fail / 2 skips** | Final supplied connector result; not current provider-revocation proof |
| `npm run policy:check` | **PASS**, commercial shipping blocked | Final supplied result; does not remove source-artifact approvals or conveyance gates |
| `node scripts/capture-ui.js --theme all` | **12 neutral PNGs + manifest**, both themes verified in live DOM | Actual synthetic capture, not just capture-policy unit tests |
| Capture purge | **Verified** | Generated synthetic artifacts removed; no forensic-erasure claim |
| Earlier live private Library, initial Apple | **0 LCARS classes; 50 rows; `Showing 1–50 of 180 (page 1 of 4)`** | Previously supplied live DOM/count observation, not rerun after the delayed audit |
| Earlier live private Next | **51–100** | Previously verified second-page reachability under the same hard row bound |
| Earlier rapid Apple→LCARS activation | **Ends LCARS; Apple sheet disabled; both LCARS sheets enabled; no errors** | Previously supplied live matrix, distinct from current provider health or physical-device proof |
| Apple public documentation reads | Not rerun | Earlier 2026-09-19 HTTP 200 record above is historical |

The Node skip is the Windows symlink-containment control; Python skipped
`CustodyArtifactTests.test_a_linked_artifact_is_refused` and
`PrivateRootTests.test_a_symlinked_root_is_refused` because symlink creation was
not permitted. Skipped controls are not passing evidence.

`test/apple-independence-rendered.test.js` retains three regression tests: Apple
shell class independence on the exercised routes (390×844, plus desktop
Library at 1440×900), default LCARS chrome, and actual private view/store
geometry with a fabricated one-book snapshot in both themes at 320×844 and
390×844. The final test measures heading/count bottoms and first-card **top**,
not visibility of the entire card or an arbitrary-size private library.

The definitive results supersede all earlier suite totals as current evidence,
without rewriting historical results. The earlier default-theme-only capture
and incomplete token-isolation findings are resolved, not residual blockers.
The supplied private matrix proves the stated DOM/paging/switching behavior,
not a current provider revocation test or complete device/AT coverage.
No suites, capture/purge or private runtime were invoked during this final
documentation task. No physical iPhone/Safari/VoiceOver, new latency benchmark,
packaging or external secret-scan result is claimed.

## Remaining restrictions and evidence limits

- `pbkdf2==1.3` and `pyaes==1.6.1` source-artifact approvals remain absent.
  Fresh connector setup fails closed; current-environment tests do not prove
  reproducible installation, downloaded-byte verification, pip-audit or SBOM.
- Same-user process trust must be replaced with a reviewed platform-appropriate
  boundary before tester/release use. Removed CP-02 unlock/liveProof mechanisms
  cannot be cited as current controls or unfinished instructions to enter a key.
- RC-08 durable/startup security-event evidence, full lifecycle/egress/retention
  receipts, rendered-device/accessibility evidence (including both themes),
  history and non-owned catalog proof, source-led architecture, legal and
  Captain audience gates remain open. Technical use of an unofficial connector
  does not prove a supported/lawful public access path.
- The earlier package-description discrepancy is resolved: the inspected
  manifest now says alpha 0.0.2. No manifest was edited by this task.
- Playwright remains dynamically imported, undeclared and unpinned; no
  lockfile or reproducible browser-tool provenance gate was added. The
  application's zero-declared-npm-dependency assertion still passes. Rendered
  tests can skip when Playwright cannot import; a green clean-environment suite
  must not be mistaken for rendered evidence. No `test:browser` or
  `capture:synthetic` npm script was added; use the actual commands above.
- Physical-device/VoiceOver and current provider-revocation evidence remain
  open. The final browser/capture/live matrix is not blanket visual/a11y
  certification or end-to-end revoked-credential recovery. Green stream
  reports and integrated fixes are not equivalent to release clearance.
- Plan choices changed: series evidence now has an additive reserved enum;
  paging positions are persisted in filter state v2 rather than memory-only.
  The existing source/storage revisions remain unchanged. Unsaved drafts are
  retained in memory, not persisted; the UI now blocks paging while a draft is
  dirty until the owner saves or discards it.
- Workstream document 13 retains earlier counts and material/target-size
  language in historical sections; this post-audit evidence record controls
  current suite totals. CSS pixels
  are not native points or proof of native control sizing. Officer-owned
  documents were not rewritten by this documentation task.
- Historical officer reports are preserved, not extended into approval of all
  subsequent working-tree changes. No new release authorization is inferred.

Current backlog accounting is **22 IMPLEMENTED / 1 OWNER-ACCEPTED DEVIATION
(S015) / 4 IN_REVIEW / 3 BLOCKED / 0 full-DoD DONE**. The 30-story,
112-point planning baseline remains an estimate, not earned delivery or a
re-estimate of the accumulated follow-ups.

## Documentation validation

The earlier documentation-only audit checked **20 changed/new Markdown files**:
**212 local link targets and 40 anchors**, with zero errors. Backlog/verdict
status parity, all 30 WSJF rows, descending score order, arithmetic and the
112-point total passed. `git diff --check` for tracked Markdown and equivalent
`--no-index --check` checks for the two new documents produced no whitespace
diagnostics. Nothing was staged, committed or pushed; application code,
agent files, ignore policy and dependency manifests were not edited.

The 2026-09-19 documentation task updated **13 Riker-owned Markdown files**.
Its validation found **147 local link targets and 26 anchors, zero errors**;
the issue matrix contains exactly #1–#14. WSJF arithmetic/order, 30 stories,
112 points, status counts and current evidence/contract checks passed.
Repository-normalized `git diff --check` returned **0**, with no whitespace
errors (Git emitted existing LF/CRLF conversion warnings). These results are
separate from the historical counts above. Application/test/agent files,
officer-owned documents and manifests were not edited by this task; pre-existing
integrated changes remain in the worktree. No commit, push or issue closure
was performed.

The preceding 2026-09-21 reconciliation updated the same **13 owned documents**.
Its documentation checks found **148 local link targets and 26 anchors,
zero errors**. Final test/capture/live-matrix facts, independent-review fixes,
the #1–#14 matrix, WSJF arithmetic/order, 30 stories, 112 points and unchanged
status counts passed consistency checks. Repository-normalized
`git diff --check` passed (line-ending warnings only). These are this task's
executed checks; the definitive application results above remain supplied
evidence. No code/test changes, commit, push or issue closure were performed.

This post-delayed-audit update checked **13 owned documents, 151 local link
targets and 26 anchors, with zero errors**. Superseded Node totals are absent
from those documents; definitive evidence, delayed-audit coverage, the #1–#14
matrix, WSJF arithmetic/order, 30 stories, 112 points and unchanged status
counts passed consistency checks. Repository-normalized `git diff --check`
passed (line-ending warnings only). Application tests and capture are recorded
from the Captain's definitive results, not rerun by this task. No code/test
edits, commit, push or issue closure were performed.
