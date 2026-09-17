# Alpha 0.0.1 — canonical bug and gate register

**Release lead:** William Riker
**Date:** 2026-09-17
**Code baseline:** `6145f9833281f8e9fb81a190377285b73892feff`
**Status:** Reconciled; no remediation implemented or closure asserted.

## Conventions

- Stable IDs are `ATR-A001`–`ATR-A051`. Tables abbreviate them as `A001`, etc.
  Do not renumber on closure or reprioritization.
- Sources: **D** = [Data](data-review.md), **G** =
  [Geordi](geordi-ui-accessibility-review.md), **W** =
  [Worf](worf-security-review.md), **Y** =
  [Wesley](wesley-product-gap-review.md). Source suffixes are their original IDs.
- Implementation evidence paths below are relative to **`code/Alpha0.x/`**.
  `planning/…` and `APP_DESCRIPTION.md` paths are relative to the repository root. Line numbers refer
  to the code baseline, not the line numbers of copied snippets in reports.
- **Block** = must close before the specified release gate; **Hold** = evidence
  or an approved design decision is missing, not a confirmed exploit;
  **Defer** = outside the alpha increment or nonblocking debt;
  **Accept** = bounded alpha limitation, not permission to bypass another gate.
- Severity describes impact: Blocker / Critical / High / Medium / Low.
  Evidence gaps and deferred requests are identified explicitly.
  Owners are accountable officers; implementing personnel are not presumed.
- Gate references are to `planning/0.0.1/05-risks-and-release-gates.md:62-76`.
  No entry changes an original gate or approves an additional source request.
  All acceptance tests below are **required future evidence**, not tests run
  in this reconciliation. Use synthetic fixtures and temporary roots; any
  necessary actual source evidence requires consent and Worf's approval.

## Canonical findings

### Security, source correctness, and access evidence

| ID | Deduplicated finding / severity | Source report | Exact evidence | Gate; disposition | Owner | Acceptance test / closure evidence |
| --- | --- | --- | --- | --- | --- | --- |
| A001 | Unauthenticated loopback API exposes data and obtains its own mutation token — **High** | W H-1; corrects Y strength 2 | `scripts/serve.js:92-103,124-150` | G2/G5; **Block**, including owner evaluation sign-off; no recorded acceptance of these specific Highs | Worf | Synthetic server: every private API route denies a caller lacking independent authorization; obtaining a session response cannot bootstrap unauthorized access; valid authorized browser works; destructive confirmation cannot be replayed. Preserve Origin/Host controls and do not leak capabilities in logs/referrers. |
| A002 | Bare-name Windows helpers/interpreter discovery permit executable substitution — **High** | W H-2 | `connector/atnr_connector/custody.py:127-150`; `scripts/setup-connector.js:20-36`; `src/adapters/connector-process.js:64-68` | G2/G5; **Block** | Worf + Data | Verify trusted absolute helper/interpreter paths and ACL result; a synthetic earlier-PATH/cwd executable is never invoked. No real credentials in the probe. Default runtime venv path is already explicit; setup discovery and helpers still need correction. |
| A003 | Progress scale is guessed from magnitude — **Blocker** | D B1 | `connector/atnr_connector/normalize.py:137-154,189`; `connector/test/test_normalize.py:22,36`; `connector/test/test_service.py:88,136` | G3/G5; **Block** | Data | Record a dated source-specific unit contract. If percentage scale is confirmed, 0, 0.5, 1, 25, 42.9, 99.9, 100 remain those percentages; invalid values are unknown/rejected. UI must not turn 1% into 100%. Fraction sources require explicit adapter scale, never magnitude inference. |
| A004 | Duplicate identity aborts paginated sync; completeness is not demonstrated across changing pages — **Critical** | D C2; duplicate subcase of W M-1 | `connector/atnr_connector/normalize.py:167-175`; `connector/atnr_connector/service.py:191-215,234-235` | G3/G5; **Block** | Data | Overlapping/mutating synthetic pages yield either a provably complete deterministic snapshot or a classified stop preserving the last complete snapshot. Never call an omitted item a successful full import. Resolve paging/completeness policy before adding dedupe or another request. |
| A005 | One malformed required record prevents whole-library refresh; no bounded recovery/isolation policy — **Critical** | D C3; W M-1 excluding A004 | `connector/atnr_connector/normalize.py:19-34,75,102,167-171`; `connector/atnr_connector/service.py:234-235`; `src/sync/live-snapshot.js:27-33`; compare `src/core/model.js:239-252` | G3/G5 and W tester gate; **Block** | Data + Worf | Three-record fixture with a malformed middle record produces bounded category-only diagnostics and preserves last complete state. Any quarantine/partial-view design is explicit and cannot promote a partial capture as complete. Approved recovery must not fail forever or silently weaken required identity fields. |
| A006 | Connector/core contributor limits disagree (100 versus 50) — **Medium** | W M-2; related to A005, different cause | `connector/atnr_connector/normalize.py:177-185,198-199`; `src/core/validate.js:19,131-141` | G2/G3/G5; **Block** per Worf | Data | End-to-end 50/51/60/100 distinct-contributor fixtures enforce one reviewed limit and clear missingness/rejection semantics. No silent truncation or whole-library surprise at the second runtime boundary. |
| A007 | Live snapshots replace rather than reconcile source-removed entries — **Critical** | D C4; corrects Y strength 4 | `src/sync/live-snapshot.js:27-35`; `src/sync/private-alpha-service.js:63-74`; `src/store/encrypted-snapshot-store.js:88-106`; compare `src/core/model.js:267-271` | G3/G5; **Block** | Data | Synthetic A has two books, B one: retained entry AND catalog metadata for the absent book survive with `missingFromSource`; B replay preserves canonical semantic digest and local sentinels. Compare normalized content excluding declared freshness fields, not randomized DPAPI ciphertext. Persist the reconciled result, not merely validate it. |
| A008 | Live validation omits entry-to-book referential integrity — **High** | D H1 | `src/sync/live-snapshot.js:25-35`; `src/core/library.js:35-38` | G3/G5; **Block** per Data | Data | Orphan `entry.bookId` is rejected before promotion; valid snapshot entry count equals displayed row count. Update the rule explicitly if non-owned catalog books are later admitted; do not require all catalog books to be library entries. |
| A009 | Failed cross-account registration rollback permits mixed-account presentation — **High** | D H2 | `src/sync/private-alpha-service.js:29-47,87-96`; `src/store/encrypted-snapshot-store.js:63-70` | G2/G3/G5; **Block** | Data + Worf | Stub account B, retained snapshot A, failing disconnect: status explicitly shows mismatch and library is withheld/quarantined; no cross-account write or misleading combined status. Still permit retained A to be viewed after a normal A disconnect. |
| A010 | Declared Node 20.6 floor cannot import `node:sqlite` — **High** | D H3 | `package.json:8-10`; `src/store/encrypted-snapshot-store.js:3`; `scripts/private-alpha-runtime.js:1-10` | G5/G6 supported environment; **Block** for distribution | Data | Declare and test an actually supported Node baseline (supplied evidence is Node 24.18.0); unsupported startup returns an actionable message before the static SQLite import crashes. Test minimum supported runtime and unsupported-runtime handling. Merely naming 22.5 without required flags is not sufficient. |
| A011 | Same source person is split by author/narrator role — **Critical** | D H5 + Y BUG-01 | `connector/atnr_connector/normalize.py:75-89`; `APP_DESCRIPTION.md:576-577` | G1/G3/G5 canonical identity; **Block** | Data | Same source person ID in both roles creates one person with both roles, with all book references resolving; existing identifier migration is explicit. This is role-dependent identity fragmentation, **not a hash collision**. Name equality alone must not merge unrelated people. |
| A012 | Name fallback and later source identifiers have no identity migration link — **High** | D H4 | `connector/atnr_connector/normalize.py:76,103,129,190-195` | G3 limitation; future D01/D02 prerequisite; **Defer** alias-migration capability | Data | Before feedback persistence, fixtures cover no-ID→ID, spelling changes, same-name different people, and work-ID changes; retain basis/ambiguity and migrate or quarantine annotations without guessing. No current personal-rating loss claimed; ratings do not exist in alpha. |
| A013 | Genuine listening-history evidence absent; position/history dates always unknown — **High** | Y BUG-04 + D M1 (history portion) | `connector/atnr_connector/normalize.py:227-235`; `ui/js/views/library-view.js:16-24,78-79`; `planning/0.0.1/01-release-charter.md:151-157` | G3; **Block / missing domain** | Data + Wesley | Approved source/route proves at least one genuine listening-history datum and documents granularity; current state/purchase date alone are not history. Missing position/dates remain unknown and inert sorts are labeled/disabled. If unavailable, record no-go or obtain explicit rebaseline; do not invent timestamps. |
| A014 | Non-owned candidate catalog proof is missing and outside the current endpoint grant — **High** gate impact | Y BUG-07 | `connector/atnr_connector/service.py:185-215`; `planning/0.0.1/10-private-alpha-connector-change-control.md:25-39`; `planning/0.0.1/05-risks-and-release-gates.md:70-72` | G1/G3; **Block / missing domain** | Data + Worf; Captain authorizes route | First approve a bounded catalog route and metadata rights; then obtain consented, sanitized proof plus participant confirmation of at least one non-owned title. Owned-library metadata or a mocked lookup is not proof. Do not add a catalog endpoint/manual ASIN flow under the library-only grant. |
| A015 | Real catalog drives a trace labeled entirely synthetic — **High** | Y BUG-02 | `ui/js/store.js:85-90,179-190,205-228`; `ui/js/views/feasibility-view.js:21,64-74` | G3/G5, S008; **Block** | Geordi + Wesley; Data implementation | With synthetic canary data standing in for a private snapshot, feasibility card truthfully labels active source, while the separately labeled structural trace uses only bundled synthetic fixtures and contains no private-snapshot canary. Relabeling a live trace alone does not meet the locked separate-synthetic-trace requirement. |
| A016 | Private UI has no JSON export; existing export lacks catalog and uses synthetic profile — **High** | Y BUG-03 | `ui/js/views/data-view.js:105-235,260-264,336-340`; `ui/js/store.js:299-311` | G2/G5, S009; **Block** | Data + Geordi + Worf | Confirmed user export produces versioned closed-schema catalog+entries+provenance+limits with correct runtime source, no credentials/account secret or unbounded diagnostics; import/validate round trip has equal canonical digest. Explain user-held plaintext copy, retention, and deletion limits. Extend the approved data-handling design before exposing it. |
| A017 | No complete app-managed deletion/identity-key lifecycle or residue proof — **Medium** security, blocking | W M-4 + L-7; L-2 erasure limitation | `src/store/encrypted-snapshot-store.js:134-143`; `connector/atnr_connector/custody.py:220-231`; `connector/atnr_connector/service.py:239-247,258-267`; `scripts/serve.js:172-177` | G2/G5; **Block** | Worf + Data + Geordi | In temporary roots, confirmed full lifecycle covers credential/identity envelopes, database/sidecars/temp state, derived data, retention expiry, restart and canary inventory. Keep Disconnect and local deletion distinct; deleting credentials cannot silently abandon a registered device. Prove key destruction where claimed and document Windows-user DPAPI/SSD/backups/user-copy limits; overwrite/unlink or VACUUM alone is not crypto-erasure. |
| A018 | Dependency content/index integrity and dated audit provenance incomplete — **Medium** | W M-3 + L-8 | `connector/requirements-private-alpha.lock:1-21`; `scripts/setup-connector.js:42`; `README.md:177-180` | G2/G5/conveyance; **Block** | Worf + Data | Hash-verified approved artifacts and controlled index/install configuration reject altered files and hostile index overrides; record audit tool/version/date, lock digest, license result and vulnerability disposition. Pins and an undated “no known vulnerabilities” statement are not content verification. |
| A019 | Initial provider login URL is not validated before navigation/cookie seeding — **Medium** | W M-5 | `connector/atnr_connector/service.py:56-85` | G2/G5; **Block** per Worf | Worf + Data | Non-HTTPS, look-alike and unapproved origins are rejected before browser launch/cookie attachment/navigation; sanctioned origin passes. Validate the initial URL independently of callback validation; keep the no-credential-observation boundary. |
| A020 | Credential-bearing Python boundary lacks equivalent automated scan/RPC disclosure guards — **Medium** | W M-6; D test-gap assessment | `test/scan.test.js:35,133`; `connector/atnr_connector/service.py:269-289`; `connector/atnr_connector/rpc.py:31-59` | G2/G5; **Block** | Worf + Data | Python-focused positive/negative canary checks, exact public-status key allowlist and single bounded JSON RPC output cover errors and malicious changes. Review approved imports/authorization code semantically; a blanket ban on currently needed URL parsing is not a workable scanner. |
| A021 | Node store relies on startup ordering for private-root ACL assurance — **Medium** | W M-7 | `src/store/encrypted-snapshot-store.js:20-23`; `scripts/private-alpha-runtime.js:8-10`; `connector/atnr_connector/custody.py:143-160` | G2/G5; **Hold** Worf's conditional pass until ordering evidence | Data + Worf | Synthetic startup asserts successful root hardening precedes SQLite open and failure prevents open; Windows ACL test verifies unsafe roots fail closed. Current ordering reduces exposure; direct store callers still need an explicit contract. |

### Inspector semantics, synchronization state, and normalization limits

| ID | Deduplicated finding / severity | Source report | Exact evidence | Gate; disposition | Owner | Acceptance test / closure evidence |
| --- | --- | --- | --- | --- | --- | --- |
| A022 | Reported focus-ring contrast failure not established against actual adjacent surface — **High evidence hold**, not confirmed numeric failure | G 3.1; qualifies Y strength 5 | `ui/css/base.css:72-79`; `ui/css/tokens.css:28-43`; `ui/css/layout.css:98-105,117-136`; `ui/css/components.css:9-39` | G2/G5 accessible lifecycle; **Hold**, supersede proposed blanket black-ring fix | Geordi | Render synthetic screens and inspect actual ring pixels in every state, keyboard navigation, destructive dialogs, 320px/zoom/spacing and focus obscuration. Offset is 3px on black surroundings; test that actual boundary, not ring versus button fill. Demonstrate ≥3:1 UI contrast and visible/unobscured focus. Do not change to black on a black surround merely to satisfy a regex test. |
| A023 | Duplicate live-region publication can repeat operation messages — **Medium** impact; accessibility priority High | G 3.2 | `ui/js/views/data-view.js:62,75-85,307-313,322-328` | G5 entire-flow AT; **Block closure pending fix/AT verification** | Geordi | With a screen reader and synthetic operations, success/failure is announced once through one persistent channel; visible status survives. Source confirms duplicate publication, not exact speech cadence in every AT/browser. |
| A024 | Missing-title route neither focuses nor announces its error; copy assumes synthetic mode — **Medium** impact; accessibility priority High | G 3.3; Y BUG-02 related copy concern | `ui/js/views/book-detail-view.js:61-90`; `ui/js/app.js:58-63` | G5 error-path accessibility; **Block** | Geordi | Stale synthetic and private-mode canary hashes focus an appropriate heading or announce an actionable error exactly once, with truthful source wording and a keyboard-operable return link. |
| A025 | Search prompt suggests genre queries but haystack omits genres — **Medium** | Y BUG-05 | `ui/js/views/library-view.js:71-74`; `src/core/library.js:134-137` | S008/G5; **Fix**, nonblocking by itself | Data + Geordi | Genre-only query matches a synthetic title with no matching title/author/series text, or prompt explicitly limits search. Preserve existing deterministic filters. |
| A026 | Plural grouping keys stringify contributor arrays, including empty headings — **Medium** | Y BUG-06 | `ui/js/views/library-view.js:28-35`; `src/core/library.js:20,159-171` | S008/G5; **Fix**, nonblocking by itself | Data + Geordi | Empty author/narrator/genre arrays yield an explicit Unknown group; multiple contributors follow a reviewed deterministic grouping rule. Keep UI/core keys aligned, including existing facet-count callers. |
| A027 | Over-limit optional synopsis is deliberately unknown but omission reason is lost; covers deliberately absent — **Medium** limitation | D L3 + Y BUG-08; D M1 cover portion | `connector/atnr_connector/normalize.py:19-35,212-218`; `ui/js/views/book-detail-view.js:76-78`; `planning/0.0.1/10-private-alpha-connector-change-control.md:91-94` | G3 metadata limitations; **Accept** unknown/no remote cover, **Defer** reason marker/richer text | Data + Geordi | Preserve 2,001/3,500-character synthetic prose as explicit policy omission (not fabricated or silently truncated) when reason metadata is added; source absence and policy omission are distinguishable. Keep covers inert/no fetch. Raising limits or accepting external URLs needs boundary review. |
| A028 | Rounded coverage can claim all fields known despite nonzero unknown count — **Medium** semantic impact | Y BUG-10 coverage portion | `ui/js/store.js:179-190`; `ui/js/views/feasibility-view.js:35-38` | G3/G5 semantic honesty; **Block** | Wesley + Data | One unknown among 1,000 keeps the uncertainty note and exact count; zero-row catalog never claims comprehensive evidence. Rounded display percentages must not drive completeness decisions. |
| A029 | Attempt time not recorded before work; retry/backoff proposal conflicts with approved no-retry policy — **High** state accuracy | D H6 | `src/sync/private-alpha-service.js:61-82,113-126`; `src/store/encrypted-snapshot-store.js:100-106,121-131`; `planning/0.0.1/10-private-alpha-connector-change-control.md:62-66` | G3/G5 state evidence; **Fix** attempt recording; **Defer** production backoff | Data + Worf | Crash/throw before connector response still records attempted time without advancing success; fake-clock tests distinguish approved scheduled refresh from immediate retry. No authorization retries. Any terminal-error latch or changed schedule/backoff requires approved policy clarification. |
| A030 | Connector advertises success before Node validation/durable promotion — **High** | D H7; Y BUG-10 status portion related | `connector/atnr_connector/service.py:223-230,287`; `src/sync/private-alpha-service.js:29-32,63-74`; `ui/js/views/data-view.js:96` | G3/G5 truthful sync state; **Fix before gate evidence** | Data | Inject save/validation failure: UI and exported status never report a success newer than last durable snapshot, including first-sync failure with no local success. Define one durable-success authority; do not discard necessary refreshed credential persistence. |
| A031 | Date-only values become unknown; timezone-free instants rejected — **Medium** | D M2 | `connector/atnr_connector/normalize.py:54-64,209-211` | G3 limitations; **Defer** day-granularity schema support | Data | Day-only fixture retains day precision under a reviewed date contract, or remains explicitly unknown with reason; ambiguous zone-free datetime is not guessed. Do not label invented midnight UTC as a source instant. |
| A032 | Only first series membership retained, with no proven primary ordering — **Medium** | D M3 | `connector/atnr_connector/normalize.py:93-107,187,200-201` | G3 fidelity disclosure; D04 prerequisite; **Defer** schema expansion | Data + Wesley | Multi-series fixture preserves all memberships under revised schema and deterministic displayed primary; do not treat arbitrary first series/lowest sequence as evidence of prerequisite reading order. Until then disclose the alpha limitation. |
| A033 | Fixture candidate rejection returns raw ID/message despite closed-diagnostic claim — **Medium** | D M4; qualifies W strength 8 / Y strength 3 | `src/core/contract.js:283-299`; compare `src/core/model.js:243-247` | G4/G5 contract diagnostics; **Block** safe evidence-pack use | Data + Worf | Hostile synthetic ID and error-message canaries never appear in returned/logged/exported rejection diagnostics; positional index and closed category only. This is not evidence of a current live recommendation leak: no live ranker exists. |
| A034 | Live top-level `observedAt` format/requiredness not enforced at boundary — **Medium** | D M5 | `src/sync/live-snapshot.js:6-35`; `src/store/encrypted-snapshot-store.js:96-106`; `src/core/model.js:234` | G3/G5 provenance; **Fix before gate evidence** | Data | Missing, malformed and zone-free timestamps reject before promotion; valid source observation time survives. Live input cannot acquire the fixture clock by default. |
| A035 | Serialized connector queue and duplicate plaintext/sealed transport threaten size/latency limits — **Medium**, projected not measured | D M6 | `src/adapters/connector-process.js:5-6,37-52`; `connector/atnr_connector/service.py:226-230`; `src/sync/private-alpha-service.js:87-93` | G3/G4 measurements; **Defer** optimization, **Hold** capacity claim | Data | Measure synthetic size tiers, serialized response bytes, peak memory and latency; prove bounded failure leaves prior snapshot intact. Choose consistent supported caps and cache/queue semantics; do not claim the report's projected 70 MB or process counts were observed. |
| A036 | Page-byte accounting reserializes each response — **Medium** performance hypothesis | D M7 | `connector/atnr_connector/service.py:206-210` | G4 performance evidence; **Defer** | Data + Worf | Profile representative synthetic pages before optimizing. Any replacement enforces actual cumulative size, including compressed/chunked/missing-Content-Length responses; do not replace the cap with trust in a header or item count alone. |
| A037 | Exactly 20 full pages fail because completeness needs another observation — **Low** boundary limitation | D L1 | `connector/atnr_connector/service.py:194-215`; `src/store/encrypted-snapshot-store.js:73-74` | G3 supported size disclosure; **Defer** larger boundary support | Data + Worf | Boundary fixtures document the largest provably complete set; an approved total/count mechanism distinguishes exactly-full from overflow. Do not simply remove the fail-closed page limit or issue page 21 under unchanged caps. |
| A038 | PID-based exclusive temp name can collide with a stale file — **Low** | D L2 | `connector/atnr_connector/custody.py:201-218` | G5 resilience; **Defer** | Data | Synthetic stale-temp collision does not permanently block writes; use collision-resistant creation and a reviewed private-root cleanup policy. Never sweep arbitrary files or weaken ACLs. |
| A039 | Failure while recording a sync failure masks the primary error — **Low** | D L4 | `src/sync/private-alpha-service.js:80-83` | G5 diagnostics; **Defer** | Data | Inject connector failure plus `recordFailure` failure; caller retains the safe primary code and prior snapshot. |
| A040 | Repeated SID/ACL helper launches during custody writes — **Low**, cost unmeasured | D L5 | `connector/atnr_connector/custody.py:127-160,201-216` | G4 performance; **Defer** after A002 | Data + Worf | Count synthetic helper invocations, benchmark if material, and verify unchanged ACL protection across replacement. Do not weaken hardening to achieve an unmeasured speed gain. |

### Accepted risks, deferred UX, and release evidence

| ID | Deduplicated finding / severity | Source report | Exact evidence | Gate; disposition | Owner | Acceptance test / closure evidence |
| --- | --- | --- | --- | --- | --- | --- |
| A041 | Route focus target differs between main and book heading — **Low** consistency debt | G 3.4 | `ui/js/app.js:54-63`; `ui/js/views/book-detail-view.js:73,89-90` | G5 UX; **Defer**, not a demonstrated failure by itself | Geordi | All routes have understandable focus/announcement behavior under AT; shared helper is optional, not the acceptance criterion. A024 remains blocking separately. |
| A042 | Reset-sort default depends on option order — **Low** latent coupling | G 3.5 | `ui/js/views/library-view.js:78-90`; `src/core/library.js:15-18` | Future regression; **Defer** | Geordi + Data | Reorder options in a synthetic DOM test; Reset still selects Title. Current order is correct, so do not report a present reset malfunction. |
| A043 | Facet links/detail/preference navigation not implemented — **Medium** product request, not alpha defect | Y BUG-09 facet portion; G scope; backlog D01/D02 | `ui/js/views/library-view.js:132-135`; `ui/js/views/book-detail-view.js:85-86`; `planning/0.0.1/06-backlog-index.md:58-60` | Future D01/D02; **Defer by locked scope** | Geordi + Wesley | After access and architecture gates, decompose accessible facet navigation/preferences with saved state and identity guarantees. No ratings or rich facet pages added to alpha remediation. |
| A044 | Library filters are lost when route remounts — **Medium** UX debt | Y BUG-09 state portion | `ui/js/views/library-view.js:187-205`; `ui/js/app.js:58-63` | S008 improvement; **Defer**, separate from rich facet request | Geordi | Set synthetic search/sort/group, visit detail, return: approved navigation state restored without persisting personal queries unnecessarily. |
| A045 | User-scoped DPAPI and plaintext processing do not defeat same-user malware, pagefile or dumps — **Low residual risk** | W L-1 + L-5, residual risk 2 | `connector/atnr_connector/custody.py:19,83`; `connector/atnr_connector/rpc.py:45-46`; `connector/atnr_connector/service.py:226-230`; `src/sync/private-alpha-service.js:87-93` | G2/G6 disclosures; **Accept bounded design**, not A001/A002 waiver | Worf | Plain-language disclosure distinguishes encrypted storage from runtime plaintext and OS-user protection; document workstation/disk protections and excluded threat model. No provider credentials added to Node/browser. |
| A046 | Child timeout may leave authorization browser descendants alive — **Low** | W L-3 | `src/adapters/connector-process.js:80-100`; `connector/atnr_connector/service.py:61-77` | G2 timeout/cancel evidence; **Hold** lifecycle test, fix if failure confirmed | Data + Worf + Geordi | Synthetic/fake browser process tree times out/cancels with all app-owned children closed and initiating focus restored; test context-creation failure too. Never terminate the user's existing browser/server to test this. |
| A047 | Port input is unvalidated — **Low**; exact NaN behavior not proven | W L-4 | `scripts/serve.js:312,321` | G5 startup robustness; **Defer** | Data | Invalid, negative, fractional, unavailable and out-of-range ports produce bounded actionable errors; selected valid port is reported. Do not repeat the unsupported assertion that NaN necessarily selects an ephemeral port. |
| A048 | Error-code forwarding is syntax-bounded rather than an exact semantic allowlist — **Low** | W L-6 | `src/adapters/connector-process.js:110-117`; `src/store/encrypted-snapshot-store.js:121-131`; `scripts/serve.js:246-252` | G2/G5 diagnostics; **Accept current fixed producers**, strengthen with A020 | Worf + Data | Unknown lowercase canary code collapses to a known category; existing valid errors remain actionable and no source text appears. Regex alone is not proof of a closed vocabulary for future producers. |
| A049 | Formal G2/G3/G5 evidence, residual risk closure, and conveyance approvals incomplete — **Blocker evidence gap** | W residual risks/verification; D test-gap assessment; G tooling limitation; all reviews | `planning/0.0.1/05-risks-and-release-gates.md:3-6,40-57,62-76,104-136`; `planning/0.0.1/10-private-alpha-connector-change-control.md:83-108`; `test/ui-server.test.js:143-155` | G2–G6; **Block** | Riker coordinates; Worf/Data/Geordi approve; Captain + named legal reviewer decide conveyance | Supply applicable tests 1–15 or explicit Worf N/A dispositions, egress/retention/consent/lifecycle receipts, Windows containment execution, measurements/canonical digests, actual four-domain proof and process-only attestation, full rendered/AT workflow, dated residual FMEA rescoring and legal/security/Captain approvals. Existing suite counts are not substitutes. |
| A050 | Planning status contains historical contradictions after connector amendment — **Low** documentation debt | Reconciliation of charter/gates/backlog/change control | `planning/0.0.1/01-release-charter.md:3-38,96-108`; `planning/0.0.1/06-backlog-index.md:33-45,86-89`; `planning/0.0.1/05-risks-and-release-gates.md:104-105,167-180` | G5/G6 decision pack; **Fix later in authorized documentation change** | Riker | Distinguish planning approval, implementation evidence and gate completion; remove stale S001-stop/blanket-no-experiment conclusions without marking dependent stories done. Preserve dated history. This task deliberately does not edit those files. |
| A051 | Full reload discards transient sync confirmation — **Low** UX limitation | Y BUG-10 reload portion | `ui/js/views/data-view.js:75-85,125-132,153-158` | S008 status polish; **Defer** | Geordi | Synthetic successful sync produces a durable accessible confirmation once after refresh, without retaining private status unnecessarily in browser storage. A030 owns correctness of durable timestamps. |

## Conflict resolutions and implementation guardrails

1. **Security verdicts:** Worf's H-1 synthetic reproduction and the current API
   code outweigh Wesley's “textbook perimeter” characterization. Same-origin
   and CSRF defenses are real but are not caller authentication. Worf's
   owner-only conditional pass required acceptance of named Highs; the earlier
   connector implementation approval is not such acceptance. A001/A002 stay open.
2. **Core versus live:** Wesley's merge praise applies to the fixture/core path.
   Live validation starts with an empty prior set, and Node saves the connector's
   sealed snapshot, not a reconciled result. A004/A005/A007 are not closed by
   passing core tests. No current personal-rating loss is asserted.
3. **Fail closed versus availability:** the amendment expressly stops on malformed,
   incomplete or over-limit responses. A004/A005 remain Critical product
   correctness/recoverability blockers, but current refusal is safer than partial
   promotion and is consistent with that rule. Data's “dedupe then succeed”
   example with an omitted item and the reports' differing 2%/10% quarantine
   thresholds are **not approved fixes**. Required identity cannot become an
   anonymous book. Agree on completeness, diagnostics and recovery first.
4. **Progress:** source code proves the ambiguous `<=1` heuristic. This
   reconciliation did not obtain new provider documentation proving Data's
   universal 0–100 claim. That uncertainty strengthens, rather than closes,
   the semantic blocker. Also, `_status` does not automatically mark 100% as
   completed; it may say in-progress. The proven defect is the unsupported
   unit conversion, not a reproduced completion-status decision.
5. **Identity:** A011 consolidates D H5 and Y BUG-01 at Critical because the
   canonical person requirement explicitly prohibits role-only duplication.
   Data allowed a written deferral; this register instead keeps the small
   present schema violation blocking. A012's broader future annotation
   migration remains deferred with a mandatory promotion prerequisite.
6. **Focus:** the stylesheet uses `#f5f6fa`, not pure white, and a 3px
   offset over black page/sidebar surfaces. G 3.1's quoted fill ratios do
   not establish the actual adjacent contrast; its blanket black-ring
   patch could make things worse. A022 is an unresolved rendered-evidence
   hold, not a confirmed five-color WCAG failure and not an accessibility pass.
7. **Truthful unknowns:** no source response-group name proves fields exist.
   Do not fabricate missing history/position, midnight instants, series
   prerequisites or catalog availability. The approved optional-prose-to-unknown
   correction is not reopened as mandatory truncation. No remote cover loading.
8. **Trace and export:** update mode-aware metadata wording, but preserve a
   genuinely separate synthetic trace. Implementing a live relation graph is
   a scope decision, not a copy fix. Export must satisfy the complete safe
   round-trip contract, not merely download entries with a synthetic label.
9. **Sync clocks/retry:** A030 is real; the UI falls back to connector success
   when local success is absent. The original headline overstates all failures:
   an existing local success takes precedence. Scheduled 15-minute attempts
   are approved; exponential retry is not. Keep attempt/failure/success distinct.
10. **Performance/limits:** preserve actual byte, page and timeout safeguards.
    Treat D M6/M7/L5 costs as projections pending measurement. Idempotency
    compares declared canonical semantics, not fresh timestamps or DPAPI
    ciphertext. Node runtime support must include SQLite's availability/flags.
11. **Diagnostics:** Worf's closed-category praise is correct for library
    rejections, not `validateCandidateSet`'s raw error output. A033 is a
    fixture/evidence-boundary defect; do not invent a live recommendation service.
12. **Distribution:** the population cap is not a conveyance clearance.
    G1 explicitly requires formal legal review before conveyance. Private
    source-only scope does not authorize installers, packages or public hosting.

## WSJF scoring and execution order

Scores are **planning judgments**, not measured failure rates or time estimates.
BV/TC/RR each use 1–5; CoD = BV+TC+RR; Size uses relative points
1/2/3/5/8; WSJF = CoD/Size. The table is sorted descending by WSJF, then CoD;
ties retain ID order. Priority thresholds: ≥4 CRITICAL, ≥2.5 HIGH,
≥1.5 MEDIUM, otherwise LOW. `*` marks mandatory security/critical-path override;
`†` marks minimum HIGH accessibility priority. Accepted/deferred entries are
scored for transparent comparison, **not promoted into alpha scope**.

Execution waves: **R0** authority/design/completeness decisions; **R1** security
boundary/runtime; **R2** normalization/persistence; **R3** user control and
evidence honesty; **R4** actual feasibility, full validation and Captain decision;
**F** deferred/accepted future work. Within an eligible wave use WSJF order.
Dependencies and blocking gates take precedence over a cheap cosmetic task.
This is a remediation assessment, not authorization to implement 51 stories.

| ID | Title | BV | TC | RR | CoD | Size | WSJF | Priority | Order / dependency |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| A003 | Explicit progress units | 5 | 5 | 5 | 15 | 2 | 7.50 | CRITICAL | R0 evidence, R2 fix |
| A006 | Contributor cap alignment | 4 | 4 | 5 | 13 | 2 | 6.50 | CRITICAL | R2 after A005 policy |
| A008 | Entry/book integrity | 5 | 4 | 4 | 13 | 2 | 6.50 | CRITICAL | R2 before A007 promotion |
| A009 | Account presentation join | 5 | 4 | 4 | 13 | 2 | 6.50 | CRITICAL | R2; Worf review |
| A019 | Initial login origin check | 4 | 4 | 5 | 13 | 2 | 6.50 | CRITICAL | R1 after boundary design |
| A010 | Supported Node baseline | 4 | 4 | 4 | 12 | 2 | 6.00 | CRITICAL | R1 before tester setup |
| A011 | Role-independent person identity | 5 | 4 | 3 | 12 | 2 | 6.00 | CRITICAL | R2; migrate IDs |
| A015 | Separate synthetic trace | 5 | 4 | 3 | 12 | 2 | 6.00 | CRITICAL | R3 before evidence sharing |
| A030 | Durable success authority | 4 | 4 | 4 | 12 | 2 | 6.00 | CRITICAL | R2 with A007/A034 |
| A034 | Required observation timestamp | 4 | 4 | 4 | 12 | 2 | 6.00 | CRITICAL | R2 before promotion tests |
| A028 | Exact missingness decisions | 4 | 4 | 3 | 11 | 2 | 5.50 | CRITICAL | R3 with A015 |
| A002 | Trusted executable resolution | 5 | 5 | 5 | 15 | 3 | 5.00 | CRITICAL | R1 |
| A021 | ACL ordering contract | 3 | 3 | 4 | 10 | 2 | 5.00 | CRITICAL | R1 after A002 |
| A033 | Safe candidate diagnostics | 3 | 3 | 4 | 10 | 2 | 5.00 | CRITICAL | R3 before decision pack |
| A039 | Preserve primary failure code | 2 | 1 | 2 | 5 | 1 | 5.00 | CRITICAL | F; optional with sync work |
| A024 | Accessible missing-title path | 3 | 3 | 3 | 9 | 2 | 4.50 | CRITICAL | R3 |
| A016 | Complete safe export | 5 | 4 | 3 | 12 | 3 | 4.00 | CRITICAL | R3 after R0 lifecycle design |
| A020 | Python boundary guards | 4 | 4 | 4 | 12 | 3 | 4.00 | CRITICAL | R1 after A002/A019 |
| A023 | Single announcement channel | 3 | 3 | 2 | 8 | 2 | 4.00 | CRITICAL | R3, rendered AT proof |
| A025 | Genre search | 3 | 3 | 2 | 8 | 2 | 4.00 | CRITICAL | R3 if capacity after blockers |
| A026 | Nonempty group headings | 3 | 3 | 2 | 8 | 2 | 4.00 | CRITICAL | R3 if capacity after blockers |
| A050 | Reconcile stale plan statuses | 2 | 2 | 3 | 7 | 2 | 3.50 | HIGH | R4; separate authorized edit |
| A018 | Hash-verified dependencies | 3 | 3 | 4 | 10 | 3 | 3.33 | CRITICAL* | R1 before conveyance |
| A029 | Attempt state/no-retry contract | 4 | 3 | 3 | 10 | 3 | 3.33 | HIGH | R0 clarification, R2 state |
| A001 | Authenticate loopback API | 5 | 5 | 5 | 15 | 5 | 3.00 | CRITICAL* | R1 first security boundary |
| A027 | Omission semantics/no cover fetch | 2 | 2 | 2 | 6 | 2 | 3.00 | HIGH | F; disclose at R4 |
| A031 | Date granularity | 2 | 2 | 2 | 6 | 2 | 3.00 | HIGH | F |
| A037 | Exact page-cap boundary | 2 | 1 | 3 | 6 | 2 | 3.00 | HIGH | F; disclose at R4 |
| A038 | Collision-resistant temp writes | 2 | 1 | 3 | 6 | 2 | 3.00 | HIGH | F after A002 |
| A045 | DPAPI/runtime plaintext disclosure | 2 | 1 | 3 | 6 | 2 | 3.00 | HIGH | Accept; R4 disclosure |
| A048 | Exact error-code vocabulary | 2 | 1 | 3 | 6 | 2 | 3.00 | HIGH | R1 with A020 if feasible |
| A004 | Complete pagination/recovery | 5 | 4 | 5 | 14 | 5 | 2.80 | CRITICAL* | R0 policy, R2 |
| A005 | Malformed-record recovery | 5 | 4 | 5 | 14 | 5 | 2.80 | CRITICAL* | R0 policy, R2 |
| A007 | Preserve source-removed state | 5 | 4 | 5 | 14 | 5 | 2.80 | CRITICAL* | R2 after A008/A034 |
| A013 | Genuine history proof | 5 | 4 | 5 | 14 | 5 | 2.80 | CRITICAL* | R0 route decision, R4 proof |
| A014 | Non-owned catalog proof | 5 | 4 | 5 | 14 | 5 | 2.80 | CRITICAL* | R0 permission, R4 after G2 |
| A017 | Full lifecycle/erasure proof | 5 | 4 | 5 | 14 | 5 | 2.80 | CRITICAL* | R0 design, R3 after A002 |
| A022 | Rendered focus verification | 3 | 3 | 2 | 8 | 3 | 2.67 | HIGH† | R3 after lifecycle UI |
| A046 | Timeout descendant cleanup | 2 | 2 | 4 | 8 | 3 | 2.67 | HIGH | R1 fixture evidence |
| A041 | Consistent route focus | 2 | 1 | 2 | 5 | 2 | 2.50 | HIGH† | F after A024 |
| A042 | Explicit sort reset default | 2 | 1 | 2 | 5 | 2 | 2.50 | HIGH | F |
| A047 | Port validation | 2 | 1 | 2 | 5 | 2 | 2.50 | HIGH | F |
| A051 | Post-reload sync confirmation | 2 | 1 | 2 | 5 | 2 | 2.50 | HIGH | F after A030 |
| A035 | Connector capacity/queue measurements | 3 | 2 | 2 | 7 | 3 | 2.33 | MEDIUM | R4 measure; optimize F |
| A044 | Restore library filter state | 3 | 2 | 1 | 6 | 3 | 2.00 | MEDIUM | F |
| A040 | Custody helper overhead | 1 | 1 | 2 | 4 | 2 | 2.00 | MEDIUM | F after A002 |
| A049 | Gate and conveyance evidence closure | 5 | 5 | 5 | 15 | 8 | 1.88 | CRITICAL* | R0 inventory, R4 closure |
| A012 | Identifier migration/ambiguity | 3 | 2 | 4 | 9 | 5 | 1.80 | MEDIUM | F; before D01/D02 |
| A036 | Page accounting optimization | 1 | 1 | 3 | 5 | 3 | 1.67 | MEDIUM | F after measurement |
| A032 | Multi-series contract | 2 | 1 | 3 | 6 | 5 | 1.20 | LOW | F before D04 |
| A043 | Rich facet navigation/preferences | 2 | 1 | 2 | 5 | 5 | 1.00 | LOW | F; locked D01/D02 |

**Capacity/control:** reserve 20% of subsequently measured capacity. No velocity,
delivery date, improved latency, defect-rate reduction, or residual FMEA score is
claimed here. Split R0/R4 evidence bundles into INVEST-sized stories in the
implementation plan; this register does not alter the locked 51-point baseline.

## Source coverage check

| Original report finding(s) | Canonical IDs |
| --- | --- |
| D B1; C2; C3; C4 | A003; A004; A005; A007 |
| D H1–H7 | A008, A009, A010, A012, A011, A029, A030 |
| D M1–M7 | A013/A027, A031, A032, A033, A034, A035, A036 |
| D L1–L5 | A037, A038, A027, A039, A040 |
| D test-gap assessment | A003–A010, A020, A029–A030, A035, A046, A049 |
| W H-1–H-2 | A001, A002 |
| W M-1–M-7 | A004/A005, A006, A018, A017, A019, A020, A021 |
| W L-1–L-8 | A045, A017, A046, A047, A045, A048, A017, A018 |
| W residual evidence/legal/symlink gaps | A049 |
| G 3.1–3.5 | A022, A023, A024, A041, A042 |
| Y BUG-01–BUG-10 | A011, A015, A016, A013, A025, A026, A014, A027, A043/A044, A028/A051 |
| Reconciliation-only baseline contradiction | A050 |

All original findings have a disposition. No original report was edited and
no defect is marked fixed merely because its report was duplicated.
