# Worf — Alpha 0.0.2 final security & privacy implementation review

**Reviewer:** Worf, Son of Mogh — Chief Security Officer
**Original review:** 2026-09-17 16:52 — verdict *REQUIRE CHANGES*
**Amendment 1:** 2026-09-17 18:22 — post-remediation re-review, verdict revised
**Scope:** Complete uncommitted Alpha 0.0.2 working tree in `code/Alpha0.x`,
against [APP_DESCRIPTION](../../../APP_DESCRIPTION.md),
[08 implementation plan](../08-implementation-plan.md),
[09 review consensus](../09-review-consensus.md) and
[10 runtime data requirement](../10-runtime-data-requirement.md).
**Method:** read-only source review of the changed files plus non-personal
verification commands. No personal runtime content, no capability value, no
library/API call, no sync, disconnect, delete or account mutation. No code
edited. Only this report was amended.

---

## 1. Final verdict (Amendment 1)

> **APPROVE WITH CONDITIONS — owner-only operation cleared. Named-tester
> conveyance NO-GO. Public/commercial distribution NO-GO.**

All four blocking defects from my original review are **closed by construction,
not by assertion**, and each closure is visible in source and covered by new
regression tests. The remediation did not merely patch my findings; in three
cases it removed the *class* of defect:

- the nonce-burning phantom route became a **general route/handler interlock**
  (`IMPLEMENTED_API_ROUTES`), so no future policy entry can ever burn a
  confirmation and answer 404;
- the missing ACL proof became a **`CustodyProofGate`** that the migration's own
  custody check is wrapped in, so *no write can occur* before the connector has
  re-read the OS ACL;
- the unbound legacy decryption route became a **purpose-bound envelope header**
  matched before ciphertext ever reaches the protector, with legacy untagged
  envelopes readable only for `library-snapshot`.

That is how a defect should be answered. The remaining items are residuals and
evidence gaps, not exploitable defects.

**Change from original verdict:** REQUIRE CHANGES → APPROVE WITH CONDITIONS
(owner-only). Named-tester and public dispositions are **unchanged**; the
blockers there were never code defects.

---

## 2. Security summary table (amended)

| # | Area | State after remediation | Sev | Conf | Disposition |
|---|---|---|---|---|---|
| A | Authenticated loopback (`/api/v1/*`) | Unchanged and still correct; live evidence now shows unauthenticated API → **401** | — | High | **PASS** |
| B | Capability bootstrap / delivery | Readiness token + fail-closed on spawn error, early exit and 15 s timeout | Low | High | **PASS** (CP-02 `liveProof` flag still `false`, R-11) |
| C | Browser metadata & CSRF | Unchanged | — | High | **PASS** |
| D | Confirmation nonces | Now additionally invalidated on account-changing lifecycle events | — | High | **PASS** |
| E | Account quarantine / ownership anchor | Opaque anchor; every destructive and export path resolves the join first | — | High | **PASS** |
| F | Custody / migration / rollback | Connector ACL proof gated **before** any write; rollback envelope discharged only after validated migration and a positively matched account | — | High | **PASS** |
| G | Connector RPC surface | Purpose-bound envelopes; `verify_custody` added; closed method/param table retained | — | High | **PASS** |
| H | Feedback encryption | Unchanged; now sealed under an explicit `private-review` purpose header | — | High | **PASS** |
| I | Feedback export | Implemented: `POST /api/v1/export` at destructive strength, bounded, attachment-dispositioned, prohibited-key sweep | — | High | **PASS** |
| J | Feedback delete / delete-all | `delete-all` added with recomputed post-deletion inventory, purge suppression and manual-only resume | — | High | **PASS** |
| K | Runtime-only real data | Unchanged; UI suppression copy finalized | — | High | **PASS** |
| L | Dependency provenance | Unchanged guard; connector artifact inventory now truthful (tri-state `retained`) | Med | High | **PASS (blocking by design)** |
| M | Commercial / public block | Re-verified this session | — | High | **PASS** |
| N | Security events | Memory-only; new `invalidated` outcome recorded | Low | High | **ACCEPTED-INTERIM** (RC-08 open) |
| O | Documentation accuracy | README gap removed; one planning document still stale | Low | High | **OPEN** (F-6b) |

---

## 3. Original findings — resolved status

### F-1 — export route declared but unhandled — **RESOLVED (verified)**
- `scripts/serve.js:233-249` — new `IMPLEMENTED_API_ROUTES` allowlist;
  `serve.js:408-412` refuses any policy-declared route without a handler with
  `api-route-not-found` **before** the `policy.confirm` block can consume a
  nonce. The interlock is documented as exactly this defect class.
- `scripts/serve.js:549-556` — real `POST /api/v1/export` handler calling
  `service.exportAll()`.
- `src/sync/private-alpha-service.js:467-487` — `exportAll()` calls
  `assertPrivateDataAccess()` first; a quarantined session cannot export.
- `scripts/serve.js:110-131` — `respondExport()`: fixed ASCII filename
  `atnr-export.json` never derived from stored content, `attachment`
  disposition, `nosniff`, `no-store`, and a 32 MiB ceiling that **fails closed
  with `export-too-large`** rather than shipping a truncated document that looks
  complete. Only fixed outcome flags are event-recorded — no count, title or
  byte length, because a size is itself a measure of the library.
- RC-04 export pack is now implementable evidence rather than an empty policy row.

### F-2 — rollback envelope written before any ACL proof — **RESOLVED (verified)**
- `scripts/private-alpha-runtime.js:38-62` — order inverted: the connector is
  constructed, `connector.verifyCustody()` is awaited and recorded into a
  `CustodyProofGate`, and only then does `openRealLibraryState` run — with
  `verifyCustody: custodyGate.guard(assertProductionCustody)`.
- `src/security/runtime-data-source.js:129-160` — `CustodyProofGate` accepts a
  proof only when `custodyVerified === true && aclVerified === true`, and
  `guard()` throws `custody-proof-missing` otherwise. A migration therefore
  cannot write behind an unproven boundary even if the call order regressed.
- `connector/atnr_connector/custody.py:309` — `verify_custody_boundary()`
  performs the OS-level ACL re-read behind the new `verify_custody` RPC.
- *Residual (cosmetic, R-12):* `scripts/serve.js:844` still derives
  `custodyRoot: path.dirname(snapshotStore.path)` for the startup descriptor, so
  that containment assertion remains tautological. It is no longer material —
  the authority now comes from the connector proof — but it should take
  `privateDataRoot()` so the assertion means what it says.

### F-3 — unbound legacy `unseal_snapshot` (RC-06) — **RESOLVED (verified)**
- `connector/atnr_connector/custody.py:22-46` — `PURPOSE_MAGIC_PREFIX`, closed
  `ENVELOPE_PURPOSES` (`library-snapshot`, `private-review`), and
  `LEGACY_READABLE_PURPOSES = {library-snapshot}` only.
- `custody.py:411-455` — `seal_purpose()` / `unseal_purpose()` bind purpose in
  the header and match it **before** the ciphertext reaches the protector; a
  0.0.1 untagged envelope is readable only for the one purpose that predates
  0.0.2. A sealed private review can no longer be opened through the snapshot
  route.
- `connector/atnr_connector/rpc.py:45-48` — `unseal_snapshot` documented and
  bound to the snapshot purpose. `custody.py:362` additionally refuses a
  purpose-bound envelope where a credential envelope is expected.
- New coverage: `connector/test/test_envelope_purpose.py`.
- RC-06's stated condition is now met; no re-ratification is required.

### F-4 — unlock-display failure swallowed — **RESOLVED (verified)**
- `scripts/local-capability-bootstrap.js:88-92` — fixed `UNLOCK_READY_TOKEN`
  (carries no capability material) and a 15 s `UNLOCK_READY_TIMEOUT_MS`.
- `:134` — the token is emitted from the WinForms `Shown` event, i.e. only after
  the window is actually displayed.
- `:213-225` — timeout, `error`, `exit` and `close` all fail closed with
  `unlock-display-not-ready` / `unlock-display-unavailable`. Startup can no
  longer proceed to `listen()` behind a capability no human ever saw.

### F-5 — `TEMP`/`TMP` forwarded to the connector — **RESOLVED (verified)**
- `src/security/trusted-paths.js:145-147` — both variables are now deliberately
  omitted, with the reason recorded: the connector stages every file inside the
  hardened custody root and has no legitimate need for a temporary directory.
  The Node and Python minimal environments now agree.

### F-6 — stale security documentation — **PARTIALLY RESOLVED**
- **Resolved:** the "Known coordination gap" block is gone from
  `code/Alpha0.x/README.md`; the private UI path is accurately described.
- **F-6b, still open (Low):** `planning/0.0.2/10-runtime-data-requirement.md:70`
  still heads a section "Required Data-side contract (**not yet landed**)". It
  landed. I did not amend it in this pass because this amendment is confined to
  my own report; it is handed to Riker as a one-line documentation correction.

### F-7 — security events memory-only — **UNCHANGED, ACCEPTED-INTERIM**
Still correct in schema and bounds, now also recording an `invalidated` outcome
for lifecycle nonce/session invalidation. Encrypted on-disk custody, retention
ratification and the export-exclusion proof remain RC-08 work. Acceptable
owner-only; not acceptable for a named tester.

---

## 4. Additional fixes reviewed this pass

| Fix | Evidence | Assessment |
|---|---|---|
| Lifecycle nonce/session invalidation | `serve.js:525-531` (connect), `:558-565` (disconnect), `:571-581` (delete-local → `invalidateConfirmations()` only), `:583-599` (delete-all → `invalidateBindings()`) | **Correct and well-reasoned.** Sync deliberately does *not* invalidate, with the reason stated: dropping the session every 15 minutes would train the owner to re-enter the capability on reflex, which is how a prompt becomes worthless. That is exactly the right security judgement. `delete-local` invalidates nonces but not the session — the account did not change, and logging the owner out for erasing their own snapshot would look like punishment. |
| Deletion inventory | `serve.js:154-227` `narrowDeletionInventory()` | Closed 9-item vocabulary re-stated at the boundary so it cannot widen silently; bounded counts; bounded limitation text; unknown id fails closed. Carries counts and fixed statements only — no title, ASIN, comment, account key or path. |
| Truthful connector artifact inventory | `serve.js:190-193`, `test/connector-artifact-inventory.test.js` | **Notable integrity.** `retained` is tri-state, and the comment states the reason: flattening `'unknown'` to `false` would tell the owner their credentials are gone when nothing checked. An honest "unknown" is worth more than a comforting lie. |
| `delete-all` / purge suppression / manual resume | `private-alpha-service.js:553-581`, `:310-338` | Purge resolves the join first, returns an inventory **recomputed from post-deletion state** rather than asserting success, sets `localDataSuppressed`, and only an explicit owner-initiated (`manual`) sync clears suppression. Automatic sync refuses with `local-data-suppressed`. Erased data cannot silently reappear. |
| Ownership anchor + rollback lifecycle | `private-alpha-service.js:79,147,167-212,530,564` | Anchor is opaque; the rollback envelope is discharged only after the migrated state validates **and** a positively matched account — `not-connected`, quarantined and unverified states retain it and report retention rather than claiming a discharge that did not happen. |
| Migration marker atomicity | `migration.js:57-62`, `:194-222` | Structure, receipt and `user_version` marker commit inside one `BEGIN IMMEDIATE`; the interrupted-migration test now targets the former post-structure/pre-marker window. No interruption can leave tables without the marker that identifies them. |
| UI fixes (bootstrap-failure focus, reset collapsed groups, ratings profile, suppression copy) | `ui/js/views/bootstrap-failure-view.js`, `local-data-suppression-ui.test.js`, `final-ui-followups.test.js` | Reviewed for security impact only: refusal states still carry closed codes, no library content, and no capability material. No security objection. |

---

## 5. Verification evidence (Amendment 1)

Non-personal commands only. No private-alpha server started, no connector
launched, no DPAPI operation, no custody root read/created/hardened/deleted, no
capability observed.

| Check | Command / source | Result |
|---|---|---|
| Node suite | `node --test --test-reporter=tap "test/*.test.js"` | **471 tests, 470 pass, 0 fail, 1 skip** — matches reported figure exactly (was 368/367/1). Skip is the Windows symlink/System32 environment guard. |
| Policy + provenance | `npm run policy:check` | valid; commercial shipping blocked; 21 manifest digests verified; `pbkdf2==1.3` and `pyaes==1.6.1` still blocking connector install. |
| Commercial block | `npm run prepack` | refused, exit 1. |
| Secret scan | `git diff -- code/Alpha0.x` + new `src/security`, `ui/js/security`, `src/store`, `scripts` files, scanned for private keys, bearer tokens, `adp_token`, `refresh_token`, `access_token`, cookies, base32 capability-shaped strings | **Clean.** Sole match is a `for forbidden in ("key", "token", "cookie", "customer", …)` guard clause — a control, not a secret. |
| Python suite | *not re-run by this review* | Reported **98 / 96 pass / 2 skip** accepted as workstream evidence. Deliberately not re-executed: connector custody tests exercise helpers whose defaults resolve to the owner's real private root. |
| Live metadata evidence | reported: revision 3 exact schema, two migration records, opaque anchor, rollback discharged, unauthenticated API 401, server healthy | Accepted as workstream evidence, **consistent with source**: two receipts match the revision chain committed in `migration.js:194-222`; discharge-after-match matches `private-alpha-service.js:167-212`; 401 matches `authorize()` verifying the capability before every route. Not independently re-executed — doing so requires the owner's real container and the live capability. |

**Stated limit of this evidence.** I have still not personally observed a real
launch or the unlock window. `DELIVERY_DECISION.ratification.liveProof` remains
`false` at `scripts/local-capability-bootstrap.js:76`. The reported live
metadata is credible and internally consistent, but it is workstream evidence,
not my direct observation.

---

## 6. Remaining blockers and residuals

### Blocking a named-tester build
| ID | Item | Owner |
|---|---|---|
| B-1 | `connector:setup` fails closed — `pbkdf2==1.3` / `pyaes==1.6.1` have no wheel and no accepted, hash-bound approval. A tester cannot install the connector at all. | Worf/Data |
| B-2 | No `pip-audit` / SBOM run; OSV.dev zero-advisory query is not equivalent. | Worf |
| B-3 | Artifact digests are index-attested, not locally computed (egress to `files.pythonhosted.org` blocked). Closed by the first hash-verified install. | Data |
| B-4 | Security events remain memory-only (RC-08): a tester incident cannot be reconstructed after restart. | Worf |
| B-5 | CP-02 `liveProof: false`; the four recorded `remainingEvidence` observations are unwitnessed by me. | Worf |

### Blocking any conveyance (public, commercial, or free copy)
| ID | Item | Owner |
|---|---|---|
| B-6 | No approved, documented Audible/Amazon API or authorization path exists. `audible` 0.12.0 is AGPL-3.0-only and reverse-engineered. Named legal review has not occurred. | Captain / legal |

### Residuals accepted for owner-only operation
| ID | Residual |
|---|---|
| R-1 | A browser extension with app-origin permission, main-world injection or debugger access can read the typed capability and page memory. Mitigated only by the dedicated extension-free profile. |
| R-2 | Same-user local malware already holds DPAPI authority. Purpose-bound envelopes narrow but do not eliminate what it can open. |
| R-6 | Microsoft Edge stable channel auto-updates; deliberately not falsely pinned. A major channel change triggers re-review. |
| R-8 | `pbkdf2` (2011) and `pyaes` are unmaintained pure-Python crypto packages unconditionally imported by `audible`'s provider registry. Approval withheld. |
| R-9 | Any 0.0.1 server started before this change served an unauthenticated local API. Treat pre-0.0.2 sessions as exposed. |
| R-10 | Single-user assumption: a shared interactive machine is out of scope, and nothing structurally prevents that mode from being entered. |
| R-11 | CP-02 ratification is a design decision with `liveProof: false`; update the flag only from an observed launch, never from confidence. |
| R-12 | `serve.js:844` derives the descriptor's custody root from the store path — now cosmetic, but the assertion should mean what it says. |
| R-13 | The export response holds the whole library and every review in one bounded (32 MiB) in-memory JSON. Bounded and fail-closed, but it is the largest single personal-data surface in the process. |
| R-14 | `planning/0.0.2/10-runtime-data-requirement.md:70` is stale (F-6b). |

---

## 7. Disposition

### Owner-only, single workstation, owner's own Windows account
**GO, with standing conditions.** The four blocking defects are closed and
verified. The owner may run the private alpha on the real encrypted state under
the existing interim operating agreement: active use only, shut down when idle,
dedicated extension-free browser profile, no untrusted local tools. Conditions
that remain standing:

1. Do not claim RC-08 (encrypted security-event custody/retention) as satisfied;
   it is interim-accepted, not delivered.
2. Update `liveProof` only from an observed launch (R-11).
3. Close R-12 and F-6b in the next increment — small, but they are claims about
   security that are not yet literally true.

### Named tester (≤10, per policy)
**NO-GO — unchanged.** Blocked by B-1 … B-5. None of these is a code defect;
all are evidence and supply-chain obligations. Do not convey a copy: conveyance
also engages B-6.

### Public / commercial distribution
**NO-GO — unchanged and not negotiable in this increment.** Enforced in code
(`private: true`, no `publishConfig`, `prepack` refusal) and re-verified above.

---

## 8. Handoff to Riker

No remediation stories remain from my findings. Outstanding, in order:

1. **B-1 / B-3** — named, hash-bound source-artifact decision and the first
   hash-verified install (closes two items at once).
2. **B-2** — `pip-audit` on a host with package egress.
3. **B-5** — CP-02 live-launch evidence pack; then flip `liveProof`.
4. **B-4 / RC-08** — encrypted security-event custody and retention ratification.
5. **R-12, F-6b** — two-line truthfulness corrections.
6. **B-6** — Captain-level legal review; nothing is conveyed before it.

---

*The defects were met properly: not patched, but removed as classes. The shields
now hold where they were struck, and the crew proved it rather than claiming it.
That is how honor is earned. Qapla'.*
