# Worf — final security sign-off for alpha 0.0.1

**Officer:** Worf, Son of Mogh — Chief Security Officer
**Sign-off date:** 2026-09-16
**Scope of this document:** G0 security sign-off only. This is a re-review of the
revised canonical plan against my prior review
[worf-review.md](worf-review.md) and the reconciliation
[07-review-consensus.md](../07-review-consensus.md).
**Artifacts re-read:** [APP_DESCRIPTION.md](../../../APP_DESCRIPTION.md),
[planning/README.md](../../README.md),
[01-release-charter.md](../01-release-charter.md),
[02-requirements-and-hierarchy.md](../02-requirements-and-hierarchy.md),
[03-user-stories.md](../03-user-stories.md),
[04-sequencing.md](../04-sequencing.md),
[05-risks-and-release-gates.md](../05-risks-and-release-gates.md),
[06-backlog-index.md](../06-backlog-index.md),
[07-review-consensus.md](../07-review-consensus.md).
**Repository state:** planning documents only. No code, runtime, dependency
manifest, CI, captured data, or executed test exists. Nothing was executed,
committed, or pushed for this sign-off. No canonical plan file was modified.

---

## 1. Verdict

**APPROVED — G0 security sign-off granted.**

All fourteen WORF blocking findings are reconciled in the canonical plan text,
not merely acknowledged in the consensus document. My four G0-blocking findings
(B01–B04) are resolved as charter stop rules and story acceptance criteria.
B05–B14 are committed, testable acceptance criteria attached to existing stories
and gates, with stable test numbers 1–15 and named owners. All twelve hardening
items H01–H12 are placed. No blocker was silently downgraded, and no security
requirement was converted into a recommendation.

Scope discipline was held: one enabler pair (ATR-F13/ATR-S013) isolates the
shared pre-G2 safety work that S009 previously implied. No new feature, platform,
provider, or product surface was added in exchange for my approval.

**This approval covers the plan, and only the plan.** It is not permission to
authorize an account, to request source or catalog data, to open an export
archive, or to touch one byte of the participant's library. G2 remains my post
and it does not move.

**My remaining approval sequence:**

- G0 — **approved by this document.**
- G1 — approved when S001/S002/S003 evidence satisfies the G1 conditions below.
- G2 — approved, in writing and explicitly, only when S013/S009 produce passing
  recorded evidence for tests 1–12 in my presence, fixtures only.
- G3/G4/G5 — approved only on the actual-run and final-component evidence named
  below.

---

## 2. Assets and trust boundaries — confirmed unchanged

The asset ranking (A1 credentials, A2 tokens, A3 raw capture, A4 normalized
personal history, A5 synthetic sentinels, A6 untrusted catalog text, A7 evidence
pack, A8 consent record, A9 repository, A10 workstation) and the boundary chain
B1→B8 from my review remain accurate for the revised plan.

Three boundary rules I required are now written, not implied:

- **B1→B2** is provider-rendered sign-in in the OS default browser or a
  sanctioned authentication session only — charter *Access and security stop
  rules*; S002 *Normative experiment boundary*.
- **B3** is the only component with outbound access, to an approved allowlist;
  normalizer, renderer, and import have zero — S009 AC8, S008 AC8, S006 AC.
- **B7** is one-directional and sanitized — DoD-A item 4,
  [planning/README.md](../../README.md) conventions, S008 AC10, S012 AC1/AC3.

The S013 insertion does not create a new boundary: it is a fixture-only harness
inside B4/B6 with no account, consent collection, or source request authority
(S013 Specific DoD).

---

## 3. Blocker-by-blocker closure evidence

| ID | Prior severity | Closure evidence in canonical plan | Status |
| --- | --- | --- | --- |
| **WORF-B01** — no named permission authority, no disqualification list | CRITICAL (G0) | Charter *Access and security stop rules* disqualifies unofficial/reverse-engineered clients, undocumented device registration, private endpoints, scraping/automation, and permission inferred from silence, pending separate written technical/legal/security review and scope change. S001 AC1 grades permission documented/ambiguous/absent and records absence as `unknown`, never approval; S001 AC4 publishes the disqualified list; S002 boundary rule 1 requires a dated official document/title/URL and a Captain-assigned qualified legal person for ambiguity, and states an engineer's opinion cannot grant permission. G1 checklist requires dated authority per route. | **CLOSED** |
| **WORF-B02** — "normal login" undefined and exploitable | CRITICAL (G0) | Charter replaces the dangerous clause: provider-rendered sign-in only in the OS default browser or sanctioned auth session our process cannot observe, script, autofill, or intercept; no embedded webview, headless/automated browser, or credential-handling code path; password/MFA/session-cookie collection and browser-profile extraction are **prohibited without exception, not candidates for a scope waiver**. Mirrored verbatim in S002 boundary rule 2 and S002 AC3; enforced by test 3 (static credential-absence, including no webview/automation dependency) at G2, and by the *Credential safety* CTQ. | **CLOSED** |
| **WORF-B03** — affiliate/commercial coupling of the catalog route | CRITICAL (G0) | Charter stop rules: affiliate/Associates/advertising/revenue-sharing requirements, compulsory tracking IDs, or promotional links disqualify a catalog route "even for metadata only." S005 AC4 makes such a route ineligible and requires stop/escalation as a trust conflict if it is the sole route; S005 AC3 records contractual basis, attribution, cache/redistribution rights. S010 AC1 makes route provenance a required candidate field and rejects bound **sources**, not only bound fields; source ordinal/retrieval rank excluded. R03/R08 carry the risk to G1/G3/G5. | **CLOSED** |
| **WORF-B04** — export-archive over-collection | CRITICAL (G0) | S002 boundary rules define a pre-ingest named-artifact allowlist, directory inspection solely to select allowed members, and prohibit reading, decompressing, copying, indexing, or **logging the names** of refused members; encrypted scratch only; inseparable non-Audible/household/third-party packaging is a stop. Numeric archive ceilings are explicit: ≤100 members, 5 MiB/member, 25 MiB expanded, 10:1 ratio, depth 16, 16 KiB strings, no nested archives/symlinks/traversal/absolute/UNC; excess aborts, never silent truncation. S002 AC4 specifies refusal before parsing; S004 AC5 proves refused counts without content access; S013 AC4 and test 4 execute it at G2. New risk R14 (RPN 270) owns it at G1/G2. | **CLOSED** |
| **WORF-B05** — consent as prose, not a recorded revocable act | HIGH (G1) | S002 boundary: dated signed private consent naming participant (self-consent explicitly allowed), categories, purpose, storage, expiry, no-AI commitment, and withdrawal method; no pre-check; decline equally reachable with no extra steps; refusal collects nothing; withdrawal stops immediately and destroys app-managed data and keys **within 24 hours** with a sanitized receipt. S002 AC2 requires the template plus Geordi-approved plain-language spec and fixture keyboard/AT tests; S009 AC1 fixture-proves refusal, expiry, and withdrawal; G3 requires consent in force at run time. Third-party/household scope remains a stop, not a waiver. | **CLOSED** |
| **WORF-B06** — no incident-response or revocation runbook | HIGH (G1) | S002 boundary final rule names Worf incident lead, Data operator, Captain escalation, and covers halt, revoke via documented provider surface, token/key rotation, authorized repository/history purge with the honest statement that purge cannot retract copies, unexpected-egress investigation, prompt participant notification before resumption, closure, and Worf reapproval. It explicitly authorizes **no automatic destructive git operation**. S002 AC6 publishes it; S009 AC9 runs an incident drill at G2; gates carry the standing halt-until-closure condition. | **CLOSED** |
| **WORF-B07** — dependency review arrived after real data | HIGH (G2) | Charter locked-scope item 4 states dependency/supply-chain review and S009 lifecycle verification **precede Worf's G2 approval**. S002 AC6 makes dependency review a G2 prerequisite "not deferred to release"; S013 AC1 pins minimal justified dependencies with lockfile and no install scripts; S009 AC6 requires dated dependency/vulnerability/license/lockfile checks with unresolved critical/high blocking; test 12 is a G2 test; S012 AC3 reports G5 checks as **re-verified, first done at G2**. R15 (RPN 216) added. Post-G2 dependency change requires Worf re-approval **before use**, not notification. | **CLOSED** |
| **WORF-B08** — repository secret/capture hygiene asserted, not enforced | HIGH (G2) | S009 AC7: no personal store, export, key, or credential is ever created in the repository or a cloud-sync path; ignore rules as defense in depth; fail-closed local pre-commit secret/canary scan and staged-diff check demonstrated **without committing**. Test 8 at G2; [planning/README.md](../../README.md) prohibits personal data and real-capture screenshots and requires custody outside the tree; R16 (RPN 120) added. | **CLOSED** |
| **WORF-B09** — egress denial unmeasured | HIGH (G2) | Charter *Egress* CTQ is now a control, not a claim: zero AI or non-allowlisted successful egress, measured by enforced default-deny and recorded negative/observed-set tests at G2/G3/G5. S009 AC8 enforces default-deny with allowed/observed destination records and fail-closed non-allowlisted, AI, and source-URL probes, exercised with **controlled synthetic network fixtures before G2, never real endpoints**. S008 AC8 gives the inspector zero outbound requests, no remote assets or prefetch, non-activatable source URLs, and a verified restrictive CSP for a web harness. Tests 1, 2, and 15 carry it to G2 and G3. | **CLOSED** |
| **WORF-B10** — adversarial corpus named but undefined | HIGH (G2) | **ATR-ADV-1** is defined by name and content in the S003 normative contract: HTML/script/SVG/event handlers; `javascript:`/`data:` URLs; prompt-injection and fabricated system/tool directives and invented preferences in title/description/series; zero-width and bidi controls; template/format/expression payloads; spreadsheet prefixes; traversal/absolute/UNC paths and symlinks; archive bombs and member limits; oversized/deep structures; malformed encodings and lone surrogates; duplicate/colliding IDs; remote SSRF/tracking URLs — each with expected accept-inert/reject/quarantine outcome. Referenced by S013 AC3, S009 AC9, S006, S007 AC7, S008 AC8, and the deferred LLM suite in S010 AC6. Tests 5 and 6 at G2, re-run at G3/G5. | **CLOSED** |
| **WORF-B11** — deletion missed surviving residue | HIGH (G2) | S009 AC5 mandates crypto-erase: one encrypted container, key destruction, and a tested inventory covering raw/normalized/temp/extraction/caches/snapshots/credentials, database WAL/journal/shm, OS index and thumbnails, editor swap/undo, shell history, clipboard, dumps/core, terminal scrollback, and prior app-managed exports, with spill prevention and verified absence rather than planting real data in those locations. Honest disclosure of provider records, user-held export copies, and SSD unlinked blocks; no secure-overwrite guarantee claimed. Participant verifies MFA and reviews connected apps/devices. Test 9 at G2 with restart and canary re-scan; R06 cannot be re-scored until test 9 executes. | **CLOSED** |
| **WORF-B12** — "redaction" undefined | HIGH (G2) | S002 boundary defines a diagnostic **allowlist**: only counts, application state names, error classes/codes, durations, operational timestamps. Prohibited everywhere — logs, errors, traces, stack frames, exit output, UI diagnostics: tokens, credential URLs, user file paths, titles, source IDs, raw bodies, source strings, personal timestamps. No payload debug/verbose mode with real data; crash reporting and telemetry off. S009 AC9 asserts by **category, not canary alone**; S007 AC7 covers fault paths; tests 7 and 11 at G2; derivative privacy rules bound what may survive destruction. | **CLOSED** |
| **WORF-B13** — G3 reachable without a security verdict | HIGH (G1) | G3 required evidence now includes actual-run security tests 13–15 plus, in the gate conditions, consent in force, the **exact approved route/config fingerprint with no substitution**, redaction verification, process-only witness attestation, participant content check, and non-ownership attestation. S004 AC1 requires the G1 fingerprint match and Worf reapproval on any change; S004 AC6 requires the sanitized destruction receipt. Coverage evidence alone no longer passes G3. | **CLOSED** |
| **WORF-B14** — witnessed runs exposed the participant's library | MEDIUM-HIGH (G2) | S004 AC7: the witness sees consent presence, control attestations, approved-route fingerprint, egress/redaction checks, and the destruction receipt — **not library content**; the participant performs content verification on a sanitized checklist. Reinforced by [planning/README.md](../../README.md) ("Reviewers witness controls, not library content", no real-capture screenshots), S008 AC10 by-construction sanitized report model, S012 AC1/AC2, and new risk R17 (RPN 120). The S009 witness remains fixtures-only (S009 AC10). | **CLOSED** |

### Hardening items

H01 (single-user property — S003 AC6 and the contract's "no imported/external user
ID is trusted for tenancy"), H02 (S011 AC4), H03 (S009 AC2 JSON-only, no CSV/TSV),
H04 (S012 AC1 runtime/OS build/lockfile hash), H05 (`trust: untrusted-source`
markers through every boundary — S003 AC5, test 6), H06 (S001 AC3 regional
data-protection obligations), H07 (README screenshot prohibition), H08 (raw data
destroyed after validation, before session end, unconditionally within 24 hours;
normalized data expires at closure or 7 days), H09 (dedicated OS account or
isolated container, no cloud-sync paths, backup/indexing/telemetry/crash verified
off), H10 (S009 AC5 MFA and connected-device review), H11 (numeric per-run caps
in S002, enforced by S004 AC4 and test 13), H12 (S011 AC6 dated platform-specific
threat model at G4) — **all placed.**

---

## 4. Specifically verified items named in this sign-off request

1. **Permitted access authority** — every permission conclusion cites a dated
   official authority; ambiguity routes to a Captain-named qualified legal
   person; "no qualified answer means blocked." Silence is never permission.
   *Verified: charter stop rules, S001 AC1/AC4, S002 boundary rule 1, G1 checklist.*
2. **Prohibited login mechanisms** — prohibited **without exception** and
   explicitly outside the scope-waiver path, which is the correction I demanded.
   *Verified: charter, S002 boundary rule 2, S002 AC3, test 3.*
3. **Export allowlisting and archive limits** — allowlist before parsing, refused
   names never logged, and concrete numeric archive ceilings including expansion
   ratio, depth, symlink, traversal, and UNC refusal. *Verified: S002 boundary,
   S002 AC4, S004 AC5, S013 AC4, test 4, R14.*
4. **Source commercial coupling** — bound **routes** are ineligible, not merely
   commercial fields; provenance is required on every candidate; sole-route case
   escalates instead of adopting. *Verified: charter, S005 AC4/AC5, S010 AC1, R03/R08.*
5. **Dependency timing** — moved ahead of real data and re-verified at G5.
   *Verified: charter locked scope item 4, S002 AC6, S013 AC1, S009 AC6, test 12,
   S012 AC3, R15.*
6. **AI-network test** — the "zero AI" claim is now a measured control with a
   negative probe and no AI SDK, endpoint, credential, or egress path.
   *Verified: charter Egress CTQ, S009 AC8, S010 AC6, test 2.*
7. **Retention and crypto-erasure** — single encrypted container, key destruction,
   expanded residue inventory, restart and canary re-scan, hard wall-clock
   retention deadlines, and honest disclosure of what cannot be erased.
   *Verified: S002 boundary, S009 AC5, test 9, R06 re-scoring restriction.*
8. **Logs** — allowlist by category with an explicit prohibition list and
   category-level assertion rather than canary-only checking.
   *Verified: S002 boundary, S009 AC9, S007 AC7, tests 7 and 11.*
9. **Witness privacy** — controls and attestations only; participant does content
   verification; no real screenshots; sanitized report excludes personal fields by
   construction. *Verified: S004 AC7, S008 AC10, README, R17.*
10. **G2 ordering** — S002/S003 → G1 → **S013 → S009 → G2** → S004/S005. No G2
    evidence depends on a real-data story, and S005 waits for G2 despite losing
    its S004 dependency. The proposed pre-G2 public-lookup shortcut was correctly
    refused. *Verified: 04-sequencing dependency contract, graph, ready queue, and
    critical path; charter "No real-data activity … before S009 completion and
    explicit Worf G2 approval."*

One reconciliation decision deserves specific praise: the consensus refused
Data's G1 public-runtime lookup optimization and chose the stricter sequencing.
That is what standing a post looks like.

---

## 5. Remaining blockers

**None at G0.** I record no new blocking finding and I introduce no new scope.

Two clarifications, already consistent with the plan text, that I will enforce at
the gate rather than raise as new requirements:

- Pre-G2 network tests use controlled synthetic fixtures only; exercising the
  allowlist routing logic is not authorization to contact a real endpoint
  (S009 AC8 already states this).
- At G3, "observed destinations are a justified subset of the allowlist" means a
  subset, never a mandate to contact every allowed host (test 15 already states this).

---

## 6. Residual risks — accepted, not eliminated

| # | Residual risk | Disposition |
| --- | --- | --- |
| RR1 | Developer workstation compromise (A10) defeats every other control | Mitigated by dedicated account/container and cloud-sync/backup/indexing controls; not eliminated. Watch item. |
| RR2 | SSD unlinked blocks and any device backup taken before deletion | Honestly disclosed in S009 AC5; no secure-overwrite guarantee is claimed. Accepted. |
| RR3 | Provider-side records and user-directed export copies leave our custody | Disclosed before confirm (S008 AC7); outside our erasure authority. Accepted. |
| RR4 | Self-consent by the developer is weaker than independent consent | Mitigated by a dated signed record with scope, expiry, and withdrawal. Accepted for a single-participant private alpha only. |
| RR5 | Catalog rights and provider terms may change after G1 | Standing gate condition requires Worf re-approval before use of any changed route. |
| RR6 | Unknown source failure modes in a route never executed | This is precisely what G2 and G3 exist to discover; fail-closed behavior is required throughout. |
| RR7 | All twelve G2 tests are currently unwritten and unrun | Not a plan defect — the plan says so plainly. It is the substance of my G2 gate. |
| RR8 | Prompt-injection and model-grounding defenses are deferred to D05 | Acceptable only because no LLM, SDK, credential, or egress exists in alpha and the deferred suite has concrete content (S010 AC6). |

No residual RPN is claimed for R14–R17, and R04/R06/R07 may not be re-scored
until their named tests execute. That restraint is correct and I hold it.

---

## 7. Final release-gate conditions

These restate existing gate conditions. They add nothing.

- **G0** — satisfied by this sign-off for the security domain. Final baseline
  acceptance remains the Captain's, and the other three officers sign their own
  domains.
- **G1** — I approve when: disqualified-route list and dated per-route authority
  published (S001 AC1/AC4); consent template, withdrawal, and expiry published
  (S002 AC2); incident/revocation runbook published (S002 AC6); credential
  prohibitions written into the boundary (S002 AC3); pre-ingest allowlist and
  archive/capture caps defined (S002 AC4); ATR-ADV-1 published (S003 AC4).
  Ambiguous permission is escalated, never inferred. No harness touches real data.
- **G2 — my blocking gate.** I approve, explicitly and in writing, only when
  tests 1–12 pass with recorded output from S013/S009 shared components; the
  dependency review is complete and clean of critical/high; storage is outside
  the repository with fail-closed containment demonstrated; crypto-erase is
  verified by restart and canary re-scan; the accessible consent, export,
  disconnect, and delete path is approved by Geordi; and the incident drill is
  complete. Until then: **fixtures only. No authorization, no export file, no
  account, no source or catalog request.**
- **G3** — requires tests 13–15, consent in force, byte-for-byte route/config
  fingerprint match, redaction verification, destruction receipt, process-only
  witness attestation, and the participant's sanitized content and non-ownership
  checks. Coverage evidence alone does not pass.
- **G4** — requires the dated platform-specific threat model and the re-review
  obligations it creates (S011 AC6).
- **G5** — requires the complete security annex (S012 AC3), tests 1–15 re-run
  against final adapter, normalizer, and inspector, no open Worf blocker, and
  re-scoring only against executed controls.
- **G6** — Captain's decision; alpha wording must state plainly that this is a
  private feasibility prototype with no synchronization service, and, if
  applicable, "import-based prototype; no automatic synchronization."
- **Standing condition** — any post-G2 change to route, runtime, dependencies,
  storage location, or egress allowlist requires my **re-approval before use**.
  An incident halts the experiment until runbook closure and reapproval.

---

## 8. Positive controls worth naming

- Prohibited credential mechanisms were placed **outside** the scope-waiver path.
  Most plans would have left that door ajar. This one welded it shut.
- Test numbers 1–15 are stable, owned, and gate-bound, so security evidence
  cannot be renamed into existence.
- Refused archive member **names** are not logged. Few teams think that far.
- The non-personal derivative requires both Data's sufficiency confirmation and
  my privacy confirmation before raw destruction — dual authority on the one
  artifact that outlives the capture.
- The plan states honestly what it cannot erase. Honesty about limits is a
  security control, not a weakness.

A warrior does not abandon his post because standing is uncomfortable. The plan
is approved. The post at G2 remains manned.

*Qapla'.*

**Signed:** Worf, Son of Mogh — Chief Security Officer, 2026-09-16
**Security domain sign-off: APPROVED for G0. G1–G5 approvals remain pending
evidence.**
