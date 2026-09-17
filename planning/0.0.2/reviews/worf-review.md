# Worf — Alpha 0.0.2 security and privacy plan review

- **Reviewer:** Worf, Son of Mogh, Chief Security Officer
- **Date:** 2026-09-17
- **Subject:** Alpha 0.0.2 planning baseline (`planning/0.0.2/01`–`08`, including
  `08-implementation-plan.md` and `07-native-iphone-direction.md`)
- **Baseline consulted:** archived 0.0.1
  [security review](../../archive/0.0.1/feedback-and-bugs/worf-security-review.md),
  [51-finding register](../../archive/0.0.1/feedback-and-bugs/bug-register.md),
  [HOLD/FAIL verdict](../../archive/0.0.1/feedback-and-bugs/alpha-0.0.1-release-verdict.md),
  and [product authority](../../../APP_DESCRIPTION.md), read in full first.
- **Constraints honored:** documentation review only. No personal runtime state
  under `%LOCALAPPDATA%\ATnR` was opened, no app, connector, sync, disconnect,
  deletion, migration, install or packaging command was run, no running process
  was stopped, and no plan or application file was modified. Code was read
  read-only from tracked `code/Alpha0.x` sources solely to confirm that the
  plan's described surfaces match the implementation it proposes to change.

---

## 1. Verdict

**REQUIRE CHANGES.** The plan is the most disciplined security planning this
project has produced, and it correctly refuses to convert planning into
permission. It is not yet approvable as written.

| Decision surface | Disposition |
|---|---|
| A2-G0 design readiness — Worf security concurrence | **WITHHELD** pending C-1, H-2, H-3, H-4 and the Medium corrections in §5 |
| Alpha 0.0.2 direction, gate structure and stop rules | **ENDORSED in principle**; the gate architecture, no-egress boundary and lifecycle scope are sound |
| Owner-only continued use of the running 0.0.1 build | **CONDITIONAL** — only with the interim compensating controls in C-1 explicitly recorded and accepted by the Captain; A001/A002 remain open and exploitable |
| Conveyance to any named tester, including private source | **FAIL / NO-GO** — unchanged. A2-G1 legal review, A2-G2 safety evidence and A2-G6 decision are all open |
| Public, cloud, hosted, multi-user, store, installer, package, binary, TestFlight or commercial distribution | **HARD NO-GO** — unchanged, mechanically and by policy |
| Native iPhone direction (OF-007) | **RECORDED, NOT APPROVED**; no iOS custody, connector port, camera or handoff design is cleared |

No plan defect rises to Critical *as a planning error*. C-1 is Critical because
the **currently running** implementation still carries the reproduced 0.0.1
exploit while this plan schedules the fix for a future wave and offers the owner
no interim control. Planning that leaves an open exploit unattended is not
neutral; it is a decision.

---

## 2. Assets and trust boundaries under the 0.0.2 plan

### Assets, ranked

1. Audible/Amazon device registration material — `adp_token`, device private
   key, refresh/access tokens, cookies. Confined to Python
   (`01-release-charter.md:70`; `08-implementation-plan.md:371-374`).
2. **New in 0.0.2:** private per-book ratings, story/narration dimensions,
   free-text comments and personal tags — the user's opinions, which are more
   sensitive than the library itself (`03-backlog.md:355-375`).
3. Normalized library snapshot: titles, contributors, series, progress,
   acquisition dates, synopses.
4. Local container identity: `accountKey`, HMAC/identity seed, container
   generation (`08-implementation-plan.md:400`).
5. Local data keys and DPAPI-sealed envelopes; migration backups and their keys
   (`08-implementation-plan.md:456-476`).
6. Exported plaintext JSON — a user-held copy outside all app controls
   (`08-implementation-plan.md:344`, `735-740`).
7. Release-integrity controls: `private: true`, `prepack`, private-alpha policy,
   dependency lock (`08-implementation-plan.md:98-100`).

### Trust boundaries and their 0.0.2 treatment

| # | Boundary | 0.0.2 planned control | Assessment |
|---|---|---|---|
| B1 | Amazon-controlled Edge page ↔ connector | Shared HTTPS Amazon-domain predicate before navigation/cookie setup; owned-descendant cleanup (`03-backlog.md:171-179`) | Correct; closes archived M-5/L-3 (A019/A046) |
| B2 | Unofficial Audible API ↔ connector | Complete-or-stop pagination, existing caps, no retry, no new route (`08-implementation-plan.md:495-503`) | Correct, and explicitly refuses cap/route creep |
| B3 | Connector ↔ Node stdio | Closed versioned methods, bounded single JSON reply, fixed error vocabulary; credentials never cross (`08-implementation-plan.md:363-380`) | Strong, with one gap — see M-1 |
| B4 | Node ↔ SQLite at rest | Sealed reviews, CAS generations, custody preflight before open, minimization of clear columns (`08-implementation-plan.md:456-462`) | Strong; key lifecycle still unproven by design (CP-03) |
| B5 | Loopback HTTP ↔ browser | Per-start ≥256-bit capability on **every** `/api/v1/*` route, removal of public token vending, constant-time compare, metadata as defense-in-depth only (`03-backlog.md:140-156`; `08-implementation-plan.md:293-325`) | Right design; delivery channel unproven — H-2, H-3 |
| B6 | DOM ↔ untrusted catalog text and user comments | Inert text, no HTML/links/formula execution, visible suspicious controls (`08-implementation-plan.md:425-428`) | Correct; user comments are properly classified as untrusted-to-render, inert-to-everything |
| B7 | Repository ↔ personal runtime state | Invented fixtures only; process-only attestations; raw captures in encrypted custody (`01-release-charter.md:85-90`; `05-risks-and-release-gates.md:69-73`) | Excellent discipline; one exception — M-4 |
| B8 | PyPI/npm ↔ build | Hash-pinned, index-pinned, no re-resolution, dated audit (`03-backlog.md:184-191`) | Correct as far as it goes — M-3 widens it |
| B9 | **New:** user → local unlock/capability entry | Launcher-owned transient unlock display, never a credential form (`08-implementation-plan.md:296-303`) | The weakest new boundary; H-2 |
| B10 | Future iOS custody (out of scope) | Keychain intent, class/policy chosen by Worf, no credential copying (`07-native-iphone-direction.md:59-68`, `94-97`) | Appropriately gated, not approved |

LLM/prompt-injection surface remains **not applicable** in 0.0.2: no model,
no embeddings, no sentiment analysis, no inferred affinity
(`01-release-charter.md:83-85`; `08-implementation-plan.md:918-923`). The plan's
insistence that private feedback is inert local data — never a provider request,
prompt or instruction — is exactly the foundation a future model boundary needs.

---

## 3. Positive controls (earned, and named specifically)

1. **Feedback writes are gated behind the security and lifecycle boundary, not
   before it.** `S032` depends on `S015, S024, S028, S029, S030, S031`
   (`03-backlog.md:117`); W3 exit requires "no feedback writes before lifecycle"
   (`04-sequencing.md:79`). Collecting private notes on an unauthenticated API
   would have been the cardinal error. The plan refuses it.
2. **Public token vending is deleted, not patched.** `03-backlog.md:140-145`
   requires the capability on session bootstrap itself and forbids secrets in
   URLs, logs, referrers and browser persistent storage. This is the correct
   remedy for archived H-1 (`scripts/serve.js:131-132,139-142`).
3. **Metadata is explicitly demoted to defense-in-depth.**
   "Metadata is defense-in-depth, never a replacement for the capability"
   (`08-implementation-plan.md:320`). 401 for missing credential, 403 for
   rejected origin metadata (`03-backlog.md:147-149`). Correct layering.
4. **Destructive actions require fresh, single-use, action/session/account/
   resource-bound confirmation with TOCTOU re-checks at commit**
   (`08-implementation-plan.md:341`, `352-355`). Replay, ABA deletion and stale
   revision resurrection are each addressed (`08-implementation-plan.md:415`).
5. **Custody precedes storage.** ACL readback rather than trusting exit code 0,
   any custody failure prevents SQLite open (`03-backlog.md:158-163`) — closes
   archived H-2 and M-7 (`custody.py:128-150`, `setup-connector.js:26`).
6. **Deletion honesty.** No overwrite/VACUUM-as-crypto-erasure claim; explicit
   DPAPI/SSD/pagefile/dump/VSS/cloud-copy limitations; failed cleanup stays
   visible rather than reporting false success (`03-backlog.md:333-336`;
   `08-implementation-plan.md:741-746`).
7. **Deregistration remains user-owned and failure-safe.** "Do not silently
   strand a registered device"; uncertain disconnect stays recoverable
   (`08-implementation-plan.md:85-87`, `346`).
8. **Provider device label is not misrepresented.** The "Audible for iPhone"
   label is disclosed, never patched or reused as compatibility evidence
   (`01-release-charter.md:75-77`; `07-native-iphone-direction.md:106-112`).
9. **Zero hosted egress, zero telemetry, zero remote assets** remains a tested
   invariant, not a promise (`01-release-charter.md:83-85`; test family
   `A2-T05`, `08-implementation-plan.md:623`).
10. **Evidence honesty is treated as a security property.** "`unknown`,
    `unavailable` and skipped are never synonyms for PASS"
    (`05-risks-and-release-gates.md:56`); the Windows symlink skip must be
    executed, not counted (`03-backlog.md:441-443`).
11. **Conveyance is blocked mechanically and legally.** Named-tester ceiling is
    "a ceiling, not clearance" (`01-release-charter.md:91-95`); public/commercial
    is HARD NO-GO regardless of the private gates
    (`05-risks-and-release-gates.md:28-31`); TestFlight is explicitly named as
    conveyance and not a loophole (`07-native-iphone-direction.md:293-296`).
12. **Camera and handoff futures are specified defensively before anyone wants
    them:** consent-after-action, no retained images, check-digit validation, no
    arbitrary QR navigation, fixed link templates, no affiliate or tracking
    parameters, no purchase inference (`07-native-iphone-direction.md:174-233`).

---

## 4. Findings

Severity reflects risk to the owner's Audible account and private history in the
approved single-user Windows private alpha. Confidence is stated per finding.

### CRITICAL

#### C-1 — The plan schedules the A001/A002 fixes but gives the owner no interim control for the build that is running today
- **Severity:** Critical (operational). **Confidence:** High.
- **Evidence:** the exploit surface is unchanged in tracked code —
  `code/Alpha0.x/scripts/serve.js:131-132` returns the CSRF token from an
  unauthenticated `GET /api/v1/session`; `:139-142` returns the decrypted
  library with no credential; `:148` gates POSTs on only that vended token;
  `:312` defaults to fixed port 4310; `connector/atnr_connector/custody.py:128`
  and `:146` still launch bare `whoami`/`icacls`;
  `scripts/setup-connector.js:26` still falls back to bare `python`.
  The plan records the risk (`05-risks-and-release-gates.md:101`, RPN 378) and
  correctly declines to touch the running app
  (`08-implementation-plan.md:74-76`, `84`), but no document states what the
  owner should do **between now and S015/S016**.
- **Why it matters:** any local process, build tool, editor plugin or browser
  extension with `http://127.0.0.1/*` permission can still read the whole
  library and force deregistration. Deferral without a compensating control is
  an unrecorded acceptance of a reproduced High.
- **Required correction:** add a dated interim-control entry to
  `01-release-charter.md` §Private-data and access boundary and to A2-R01:
  (a) run private mode only while actively using it and stop the loopback
  service when idle; (b) use a dedicated browser profile with no extensions for
  the private UI; (c) install no untrusted local tooling on the host while the
  service runs; (d) record the Captain's explicit acceptance of A001/A002 for
  owner-only use, naming both findings, per the archived conditional pass.
  This is a documentation control, not an instruction to stop the app.

### HIGH

#### H-2 — The capability bootstrap is a single unproven channel with no anti-phishing, throttling or lockout requirements
- **Severity:** High. **Confidence:** High.
- **Evidence:** `08-implementation-plan.md:296-303` proposes one "launcher-owned
  transient local unlock display" and honestly states that if the channel cannot
  be proven "**S015 stops for another reviewed design**". `03-backlog.md:140-146`
  sets the token strength but no verification-failure policy.
  `08-implementation-plan.md:350-351` bounds rate/burst protection only for
  "local confirmation/write endpoints" — not for capability verification itself.
- **Why it matters:** S015 blocks S025, S028, S029, S032 and every feedback
  write; a single unproven channel is a single point of programme failure. More
  seriously, training the owner to type a secret string into a browser field
  builds exactly the habit that credential phishing exploits, and an unbounded
  verification endpoint gives a local process a silent, unlogged oracle.
- **Required correction:** (1) CP-02 must enumerate at least two candidate
  delivery channels with a written threat comparison (e.g. launcher-owned
  unlock display vs. an OS-protected file readable only by the owner and
  consumed once by the launcher), and name the decision criteria before S015
  implementation; (2) the unlock surface must be visually and textually distinct
  from any provider credential surface, must state that ATnR will never ask for
  an Amazon password, passkey or OTP, and must be reviewed by Geordi for
  accessible entry without weakening the control; (3) specify failed-verification
  throttling, a bounded attempt ceiling, capability rotation on ceiling breach,
  and a privacy-safe local record of the event (see M-2); (4) state explicitly
  that capability entry is not a user authentication factor and does not upgrade
  the trust of the process that holds it.

#### H-3 — The browser-extension threat to the in-memory capability is not named in the threat model
- **Severity:** High. **Confidence:** High.
- **Evidence:** `08-implementation-plan.md:305-309` addresses memory-resident
  secrets only as "same-user malware with access to runtime memory". The
  archived exploit path explicitly included "a browser extension holding
  `http://127.0.0.1/*` permission"
  ([worf-security-review.md §H-1](../../archive/0.0.1/feedback-and-bugs/worf-security-review.md)).
  An extension with host permission runs *inside* the app's origin: it can read
  the capability from page memory, issue authenticated requests, and obtain
  confirmation nonces — defeating B5 and B9 entirely.
- **Required correction:** name the extension/content-script threat explicitly
  in CP-02, record it as a residual with the dedicated-profile mitigation from
  C-1, and add an `A2-T01` case asserting that a page or request outside the
  application's own served origin cannot obtain a capability, and that the
  capability is never placed in `window`-reachable globals, `postMessage`
  payloads, DOM attributes or storage.

#### H-4 — Export is the weakest-gated private-data egress in the new API
- **Severity:** High. **Confidence:** High.
- **Evidence:** `POST /api/v1/export` requires only "Explicit user consent/action
  after plaintext-copy disclosure" (`08-implementation-plan.md:344`), while
  `/delete-local`, `/disconnect` and review deletion each require a **fresh**
  confirmation nonce (`:343`, `:345-346`). Yet export produces a complete
  plaintext JSON copy of the library *and* every private comment
  (`03-backlog.md:339-345`), and `08-implementation-plan.md:735-737` acknowledges
  the copy leaves all app controls.
- **Why it matters:** in the threat model where a local client holds a stolen
  capability, export is quieter and more valuable than `/library` — one request,
  a complete durable exfiltration, delivered to a folder that may be redirected
  into OneDrive Known Folders.
- **Required correction:** (1) require export to consume a fresh, single-use,
  action-bound confirmation nonce and a re-entered capability (or equivalent OS
  user-presence check), identical in strength to `disconnect`/`delete-local`;
  (2) rate-limit export explicitly; (3) require the pre-export disclosure to name
  cloud-sync/Known-Folder redirection and backup capture, not only "app deletion
  cannot erase downloads"; (4) extend `A2-T16` with a replayed/absent
  confirmation case and an assertion that the response body, headers and file
  name contain no account identifiers or titles.

### MEDIUM

#### M-1 — The legacy `unseal_snapshot` decryption oracle survives, and two more seal/unseal methods are added around it
- **Severity:** Medium. **Confidence:** Medium-High.
- **Evidence:** `08-implementation-plan.md:363-364` retains `unseal_snapshot`
  unchanged; `:369-374` adds `seal_local_envelope`/`unseal_local_envelope` with
  purpose/account/version binding. The binding requirement is written for the
  *new* methods. `connector/atnr_connector/custody.py:19` still uses a published
  constant entropy, so the seal is bounded entirely by the Windows user context
  (archived L-1 / A045), and `08-implementation-plan.md:243` correctly warns that
  "Fixed entropy is not a destroyable per-container key" without requiring a
  decision on the legacy method.
- **Required correction:** CP-03 must explicitly dispose of `unseal_snapshot`:
  retire it, or re-bind it to the same purpose/account/envelope-version contract
  and reject cross-purpose unseal. Record the entropy/key decision (retain DPAPI
  constant entropy with disclosed limits, or adopt a random container data key
  sealed under DPAPI as `:466-470` prefers) as a named A045 disposition — a
  disclosure is not a waiver of A001/A002 or of the review payload's higher
  sensitivity. Extend `A2-T15` to include a legacy-method cross-purpose case.

#### M-2 — No privacy-safe security event record exists, so local abuse would be undetectable
- **Severity:** Medium. **Confidence:** High.
- **Evidence:** `08-implementation-plan.md:325` forbids access logs containing
  bodies, authorization, query or book/account keys — correct — but nothing in
  the plan records *that* a disconnect, delete, export or repeated auth failure
  occurred. The incident runbook is referenced (`04-sequencing.md:120`;
  `08-implementation-plan.md:84`) with no input to feed it.
- **Required correction:** specify a minimal local security event record —
  timestamp, closed action category, outcome category, capability-verification
  failure counter — containing no book IDs, account key, titles, comment text or
  file paths; bound its size and retention; include it in the S029 deletion
  inventory and exclude it from export (`A2-T16`). Add its canary assertions to
  `A2-T15`.

#### M-3 — Supply-chain provenance stops at pip and omits the rest of the credential-boundary toolchain
- **Severity:** Medium. **Confidence:** High.
- **Evidence:** `03-backlog.md:184-191` and `08-implementation-plan.md:192`
  cover direct/transitive Python versions, hashes, index pinning, lock digest
  and audit receipts. Current code still installs without hash enforcement
  (`scripts/setup-connector.js:42`). Not covered anywhere: the Node runtime and
  `node:sqlite` provenance that S019 merely version-checks; the Playwright driver
  and, critically, the **system Edge channel** the connector drives
  (`connector/atnr_connector/service.py:63`, `channel="msedge"`), which is an
  auto-updating third-party binary inside the authorization path; and `pip`/venv
  bootstrap itself.
- **Required correction:** widen S018/`A2-T24` scope to record the runtime,
  driver and browser-channel provenance actually used, pin/record what can be
  pinned, and register the Edge auto-update channel as a named residual with a
  re-review trigger on major channel change. Confirm `--require-hashes
  --no-deps --only-binary :all:` with an explicit index in the reviewed installer.

#### M-4 — The Genre "gated sanitized live-field attestation" risks putting personal-library evidence into planning artifacts
- **Severity:** Medium. **Confidence:** Medium.
- **Evidence:** `08-implementation-plan.md:592` requires a post-G2 "gated
  sanitized live-field attestation" to justify retaining Genre. The charter's
  rule is that publishable artifacts are process-only and contain no personal
  counts (`01-release-charter.md:85-90`).
- **Required correction:** define the attestation schema before it is produced:
  permitted content is field names/paths, presence-or-absence, and coverage
  expressed as a bounded qualitative band — never titles, ASINs, per-value
  counts or any figure that discloses library size or composition. Route raw
  field samples to the same approved encrypted custody as other private evidence.

#### M-5 — Confirmation-nonce lifetime is deferred without an upper bound
- **Severity:** Medium. **Confidence:** High.
- **Evidence:** "Exact expiry is approved at CP-02; never a durable permission"
  (`08-implementation-plan.md:341`). Invalidation on rotation/restart/account
  change is specified (`:301-302`), but no ceiling is stated, and CP-02 could
  ratify a permissive value under schedule pressure.
- **Required correction:** record a maximum permissible lifetime in the plan
  (I require ≤120 seconds), single-use semantics, one outstanding nonce per
  action/resource, and invalidation on any capability rotation, account
  generation change or lock. `A2-T02` should test the boundary value, not only
  "expired".

#### M-6 — The incident-response and credential-revocation runbook is referenced but is not a required artifact
- **Severity:** Medium. **Confidence:** High.
- **Evidence:** stop rules invoke "the approved incident runbook"
  (`08-implementation-plan.md:84`; `04-sequencing.md:120`), and A2-G2 requires
  "consent/lifecycle/incident controls"
  (`05-risks-and-release-gates.md:21`), yet the required artifact set
  (`08-implementation-plan.md:860-872`) lists incident controls only as a phrase
  inside the security pack, with no owner, contents or acceptance criterion.
- **Required correction:** name the runbook as a discrete Worf-owned artifact
  covering: suspected local compromise, capability leak, connector/dependency
  compromise, Amazon-side device removal and re-authorization, local key
  destruction ordering, evidence preservation, and the explicit rule that
  recovery never silently re-registers a device or deletes credentials still
  needed to close a registration (`08-implementation-plan.md:743-746`).

#### M-7 — The iPhone Air evidence environment prohibits LAN exposure but does not specify isolation positively
- **Severity:** Medium. **Confidence:** Medium.
- **Evidence:** `08-implementation-plan.md:609-613` requires a "reviewed isolated
  static/stub arrangement with no private connector, account data or shipping
  artifact" and forbids LAN, tunnel, public host and phone-to-service
  connections. It does not require that the harness process carry no capability
  secret, run from a disposable root, or be torn down and attested.
- **Required correction:** require the OF-006/`A2-T23` environment to (a) serve
  only bundled synthetic fixtures from a separate disposable root, (b) never set
  the private-alpha flag or hold any capability/credential, (c) be recorded with
  its bind address and teardown in the evidence manifest. Geordi's device
  evidence must not become an unreviewed second data path.

### LOW

| ID | Finding | Evidence | Required correction | Confidence |
|---|---|---|---|---|
| L-1 | No aggregate bound on the review store: per-record bounds exist, total does not. A 20,000-item library × 4,000-code-point comments is a large plaintext export and memory footprint. | `03-backlog.md:362-366`; `08-implementation-plan.md:497` (20,000 item bound) | Add a CP-04 aggregate record/byte ceiling and an export-size bound with a truthful stop, not truncation. | High |
| L-2 | Future camera criteria forbid retained images and unconsented hosted lookup, but do not forbid photo-library access or hosted OCR by name, nor classify decoded barcode/QR text as untrusted input to any later model or query path. | `07-native-iphone-direction.md:176-190` | Add: no photo-library or hosted OCR route without new review; decoded payloads are untrusted text, never navigation targets, query fragments or prompt content. | Medium |
| L-3 | Handoff criteria omit app-presence probing. Custom-scheme or universal-link probing to detect whether Audible is installed is a device-fingerprinting behavior. | `07-native-iphone-direction.md:214-222` | Forbid installed-app probing for any purpose other than the user-initiated open itself; rely on system-reported failure and the approved HTTPS fallback. | Medium |
| L-4 | `A2-T25` performance work touches serialized RPC bytes, peak memory and seal/commit latency — measurement code that can incidentally capture private payloads. | `08-implementation-plan.md:633` | Require performance instrumentation to record sizes and durations only, never payload samples, and to run on invented fixtures exclusively. | Medium |
| L-5 | The review-text validator is specified to reject or visibly mark suspicious controls, but the plan does not state that the *export* and any future diagnostics render the same text inertly outside the app's own DOM builder. | `08-implementation-plan.md:425-428`, `:628` | State that exported text is data-only JSON with no CSV/formula path (partly covered at `:628`) and that no external viewer is assumed safe; disclose it in the export warning. | Medium |

---

## 5. Required corrections before Worf concurrence at A2-G0

1. **C-1** interim owner controls and explicit named acceptance of A001/A002,
   recorded in the charter and A2-R01.
2. **H-2** two-candidate bootstrap comparison, anti-phishing unlock semantics,
   verification throttling/ceiling/rotation.
3. **H-3** browser-extension threat named in CP-02 with a residual and tests.
4. **H-4** export raised to disconnect-strength gating, rate limiting and
   cloud-sync disclosure.
5. **M-1** explicit disposition of `unseal_snapshot` and of the DPAPI entropy/key
   decision (A045 as disposition, never waiver).
6. **M-2** privacy-safe security event record, bounded, deletable, non-exported.
7. **M-3** toolchain provenance beyond pip, including the Edge channel residual.
8. **M-4** attestation schema for the Genre live-field evidence.
9. **M-5** confirmation-nonce maximum lifetime recorded in the plan.
10. **M-6** named incident/revocation runbook artifact with owner and contents.
11. **M-7** positively specified, disposable, secret-free mobile evidence
    environment.

Low findings may be folded into their owning stories without a separate gate.
None of these corrections changes the 30-story/112-point inventory; all are
refinements of CP-02, CP-03, CP-04 and the evidence artifact set. If any of
them cannot fit the owning story's relative size, Riker re-splits it under new
permanent IDs rather than hiding the effort.

---

## 6. Verification tests I will require at A2-G2 and A2-G5

Mapped to the plan's existing families so no second harness appears.

| Test | Added or tightened requirement |
|---|---|
| `A2-T01` | Capability-verification failure throttling and ceiling; capability absent from `window`, DOM, `postMessage`, storage, referrer, console and crash output; request from a non-app origin cannot obtain or use a capability; restart invalidates everything |
| `A2-T02` | Nonce lifetime boundary at the approved ceiling; one-outstanding-nonce rule; export replay/absent-confirmation; re-unlock required for disconnect, delete-local, full feedback deletion and export |
| `A2-T03` | Unchanged custody/runtime cases; add assertion that a custody failure path cannot be reached with the store already open |
| `A2-T04` | Unchanged provider-origin cases; add an explicit Worf disposition record for the headed-Edge Playwright path (original test 3) rather than a blanket pass |
| `A2-T05` | Add the security-event record to the canary scan; assert it contains no identifiers or text |
| `A2-T15` | Add legacy `unseal_snapshot` cross-purpose/cross-account/cross-version rejection; assert the chosen key lifecycle's destruction claim is actually demonstrated |
| `A2-T16` | Export confirmation/replay cases; response/header/filename free of titles and account identifiers; disclosure text includes cloud-sync and backup capture |
| `A2-T23` | Evidence-environment attestation: bind address, absence of capability/credentials/private roots, teardown receipt |
| `A2-T24` | Runtime, driver and Edge-channel provenance records; `--require-hashes --no-deps --only-binary` enforced; tamper negative controls |
| `A2-T27` | Unchanged; remains post-G2, post-route-authorization only, process-only attestations |

The archived security tests 1–15 remain the controlling criteria. Any N/A stays
specific and reasoned; I will sign no blanket waiver, and no aggregate test count
substitutes for rendered, packet-level, consent or legal evidence.

---

## 7. Residual risks (after all corrections, assuming full execution)

1. **Same-user compromise defeats everything.** DPAPI, the capability and the
   confirmation nonces all live inside one Windows user context. Honestly stated
   by the plan (`01-release-charter.md:80-82`; `08-implementation-plan.md:305`,
   `:474-476`). It cannot be engineered away in this architecture.
2. **The access route remains unofficial and reverse-engineered.** No contract,
   no support, revocable at Amazon's discretion; account consequences fall on the
   owner. A2-G1 legal review is still open.
3. **Packet-level egress remains unproven until A2-G3.** Source scans and stub
   containment are shape evidence, correctly labeled as such
   (`05-risks-and-release-gates.md:64-67`).
4. **Deletion residue is bounded, not eliminated.** VSS, backups, SSD remnants,
   pagefile and user-held exports persist by design and by disclosure.
5. **Browser-extension and dedicated-profile discipline is a human control**, not
   an enforced one.
6. **Auto-updating Edge sits inside the authorization path** and can change
   behavior without our review.
7. **Four-domain feasibility may simply fail.** A documented STOPPED outcome for
   A013/A014 is honorable and is not a release pass
   (`05-risks-and-release-gates.md:36-45`).
8. **Prompt-injection defenses remain untested in practice** because no model
   exists. The inert-storage discipline is the right foundation and nothing more.

---

## 8. Explicit disposition

- **Owner-only private-alpha use:** may continue **only** as an explicitly
  accepted risk under C-1's interim controls, with A001 and A002 named. This
  review orders no change to the running service, no disconnect, no deletion and
  no deregistration.
- **Named testers (owner + ≤10):** **FAIL / NOT CLEARED.** The ceiling is not
  clearance (`01-release-charter.md:91-95`). Conveyance of any build **or source
  copy** requires named legal review of Audible/Amazon terms and GPL/AGPL
  obligations, executed A2-G2 evidence, renewed Worf approval and a Captain A2-G6
  decision for an exact build and roster. None exists.
- **Public, commercial, cloud, hosted, multi-user, store, installer, package,
  binary or TestFlight distribution:** **HARD NO-GO.** Unchanged, and not
  reachable through any private-alpha gate. Do not weaken `private: true`,
  `prepack` or the policy tests to satisfy a test, a demo or a tester.
- **Native iPhone (OF-007), camera ingestion (NAT-F01), Audible handoff
  (NAT-F02):** direction recorded; no architecture, custody design, permission,
  endpoint or conveyance approved.

This plan does the hard thing: it refuses to let a working prototype become a
claim of readiness. Correct the eleven items in §5 and I will bring my
concurrence to A2-G0. Until then, my post is held.

*A warrior does not abandon his post because standing is uncomfortable.*

— Worf, Son of Mogh, Chief Security Officer
