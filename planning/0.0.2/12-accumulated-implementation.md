# Alpha 0.0.2 accumulated implementation record

**Audit date:** 2026-09-19

**Basis:** tracked working-tree diff and new files against `53fc550`
(`Build Alpha 0.0.2 private library`, 2026-09-17), plus current code/tests and
the existing planning records. This is not a new release or an officer sign-off.

The implementation version remains `0.0.2`, storage revision **3**. The
[verdict](11-implementation-release-verdict.md) remains owner-only
**APPROVE WITH CONDITIONS**; named testers and distribution remain **NO-GO**.
This record supersedes stale implementation descriptions, not release gates.
Historical plans/reviews retain their original requirements and evidence dates.

## Connection and current trust boundary

- **Retained:** external-browser Audible device registration through
  `audible.Authenticator.from_login_external`, the pinned unofficial
  `audible` 0.12.0 connector and provider-controlled Edge authentication.
  ATnR does not collect passwords, passkeys or OTPs. Node/browser receive
  normalized data, not provider credentials.
- The private UI reads the real encrypted library snapshot and available
  progress; missing/unverified state fails closed, never to synthetic fixtures.
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
  fact and use a display-label hash target; Series still groups by source ID.
  No automatic migration of older person-target feedback is implemented when
  group membership changes. Display hashes are not canonical identity or
  cryptographic integrity; equal-name people can share a display group.
- Each rating dimension offers five native radio choices with exact spoken
  labels and progressive fill: choosing 3 fills 1–3. Clear restores `null`
  (Unrated). Existing half-star values remain explicitly disclosed and unchanged
  unless deliberately replaced or cleared; the domain validator still accepts
  half-steps. Explicit Save remains required; typing does not imply persistence.
- Grouping, Status, ratings, search/tag filters and sort controls occupy the
  sidebar. Above 640 CSS px, the viewport-bound desktop frame keeps navigation,
  header and footer in place while main content and the filter area scroll
  independently. At 640 CSS px and below, normal document flow returns.
- Validated, bounded, versioned `sessionStorage` saves filter/sort/group and
  collapsed-group state across refreshes in a tab. It may contain private query
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

`#/settings` is reachable through an accessible header gear and sidebar link
in both synthetic and private modes. Its native radio group switches immediately
between default **LCARS** and opt-in **Liquid Glass**, without changing library,
feedback, connection or provider state.

Only the closed theme value (`lcars` or `liquid-glass`) is durably stored under
`localStorage` key `atnr:ui-theme:v1`; it survives refresh/restart for that browser
origin/profile, not across devices. It contains no private library/query data.
Invalid or unavailable storage falls back to LCARS on load. A failed save still
applies the selected appearance for the visit and reports it could not be
remembered. The theme is applied before network/bootstrap work, but a brief
default-theme flash before module execution remains possible.

Liquid Glass is scoped CSS using translucency, backdrop blur, rounded surfaces
and local system typography. Reduced-motion, reduced-transparency and
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

## Executed evidence and limitations

Documentation audit on Windows, Node **v24.18.0**, existing connector venv
Python **3.13.15**. Commands ran from `code/Alpha0.x`; no new installation,
live provider authorization, private-store query, migration, sync, export,
disconnect or deletion was performed.

| Command / evidence | Result | Boundary |
| --- | --- | --- |
| `npm test` | **487 total / 486 pass / 0 fail / 1 skip** | Automated synthetic/source/fake-DOM tests; not a new rendered-browser audit |
| `npm run connector:test` | **98 total / 96 pass / 0 fail / 2 skip** | Existing environment; synthetic connector/custody tests, not live Audible proof |
| `npm run policy:check` | **PASS**, commercial shipping blocked | Manifest digests verified and hashes recorded for 21 distributions; two source artifacts still unapproved |
| Apple public documentation reads | HTTP 200 for both resources above | Public text inspected; no UI kit, font or SDK installed |

The Node skip is the Windows symlink-containment control; Python skipped
`CustodyArtifactTests.test_a_linked_artifact_is_refused` and
`PrivateRootTests.test_a_symlinked_root_is_refused` because symlink creation was
not permitted. Skipped controls are not passing evidence.

New regression coverage includes module-graph safety, one-request feedback
hydration, separate group targets/narrator grouping, filter validation and
persistence, progressive whole-star markup, Settings and theme preferences.
Fake-DOM/source checks do not establish physical Safari/VoiceOver, visual
contrast, actual keyboard/touch behavior or degraded-storage UI rendering.
Previously recorded Chromium observations in 11 remain **reported 2026-09-18
evidence**, not rerun here and not evidence for the later Liquid Glass theme.

## Remaining restrictions and discrepancies

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
- The package manifest's description still says alpha 0.0.1 although its
  version and implementation are 0.0.2. It was left unchanged under this
  documentation-only task's prohibition on dependency-manifest edits.
- Historical officer reports are preserved, not extended into approval of all
  subsequent working-tree changes. No new release authorization is inferred.

Current backlog accounting is **22 IMPLEMENTED / 1 OWNER-ACCEPTED DEVIATION
(S015) / 4 IN_REVIEW / 3 BLOCKED / 0 full-DoD DONE**. The 30-story,
112-point planning baseline remains an estimate, not earned delivery or a
re-estimate of the accumulated follow-ups.

## Documentation validation

The documentation-only audit checked **20 changed/new Markdown files**:
**212 local link targets and 40 anchors**, with zero errors. Backlog/verdict
status parity, all 30 WSJF rows, descending score order, arithmetic and the
112-point total passed. `git diff --check` for tracked Markdown and equivalent
`--no-index --check` checks for the two new documents produced no whitespace
diagnostics. Nothing was staged, committed or pushed; application code,
agent files, ignore policy and dependency manifests were not edited.
