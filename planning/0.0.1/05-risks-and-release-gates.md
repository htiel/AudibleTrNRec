# Risks, review gates, and decisions

**Current disposition:** Locked baseline plus Captain-approved persistent
private-connector change control. G0 passed. The unofficial route is approved
only for personal implementation and no more than ten named testers; formal
G2/G3 evidence and every commercial/public release approval remain pending.

## FMEA risk register

S = severity, O = occurrence, D = difficulty of detection, each 1–10; RPN=S×O×D.
These are initial expert planning estimates, **not observed failure rates**.
Controls named below are planned unless explicitly described as repository facts.
All RPN >=100 require mitigation and evidence-based re-scoring before release.
Worf blockers apply even below that threshold.

| Risk / failure mode | Effect / cause | Probability / impact | S | O | D | RPN | Controls / action | Owner | Gate |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| R01 No approved route | Product built on nonexistent or impermissible access | High / High | 9 | 7 | 3 | 189 | S001 preference-ordered evidence; permission review; stop rather than assume API/OAuth | Data + Worf | G1/G3 |
| R02 Library export lacks history/progress | Demo falsely claims tracking or live sync | High / High | 8 | 7 | 4 | 224 | Four-domain matrix, witnessed samples, explicit unknowns and no-go for missing domains | Data | G3 |
| R03 Catalog access/rights unavailable | Cannot establish legal non-owned candidate evidence | High / High | 8 | 6 | 4 | 192 | S005 independent of S004 after G2; reject affiliate-bound sources, source rank and tracking; no owned-only/LLM substitution | Data + Worf | G1/G3 |
| R04 Credential or history exposure | Account compromise or privacy loss from logs/files/egress | Medium / High | 10 | 4 | 6 | 240 | Supported system-browser handoff only; credential absence, signed consent, encryption, default-deny egress, diagnostic allowlist, incident runbook | Worf | G2/G3/G5 |
| R05 Invalid input or stale/partial import | Corrupted progress, duplicates, erased local information | Medium / High | 8 | 5 | 4 | 160 | S003 identity/canonical/authority rules; S007 digests, order/batch/replay/restart/merge/split and atomic promotion | Data | G3/G5 |
| R06 Incomplete deletion | Personal data survives in caches/backups/exports | Medium / High | 9 | 4 | 5 | 180 | At most one active account container; key destruction before replacement, expanded inventory, restart/canary re-scan, hard retention, user-copy/vault/SSD limits | Worf | G2/G5 |
| R07 Untrusted catalog text executes/tracks | Injection or unintended requests in inspector | Medium / High | 9 | 4 | 5 | 180 | ATR-ADV-1 in S013 preflight, S009 G2 and final S006/S008; URLs inert/nonactivatable, no renderer/normalizer egress | Worf + Geordi | G2/G5 |
| R08 Commercial signals enter future ranking boundary | Trust lost through sponsored eligibility/rank | Medium / High | 9 | 4 | 6 | 216 | Allowlisted contract, rejected commercial fields, paired-offer fixtures; actual ranking tests deferred explicitly | Data + Worf | G5 |
| R09 Diversity becomes profiling or false balance | Echo chamber, harmful content, unsupported user claims | Medium / High | 9 | 5 | 6 | 270 | No recommender in alpha; forbid identity inference; source uncertainty and quality-first policy, future set-level tests | Wesley + Worf | G5 |
| R10 Inaccessible or misleading inspector | User cannot inspect, consent, or delete safely | Medium / High | 8 | 5 | 4 | 160 | Geordi pre-code design; S009 consent/lifecycle before G2; S008 full-flow contrast/target/reflow/focus/motion/source/confirmation tests | Geordi | G2/G5 |
| R11 Platform/LLM selected prematurely | Rework, privacy exposure, vendor coupling | Medium / High | 7 | 5 | 4 | 140 | G3 before product selection; disposable harness only; no LLM SDK or egress | Data + Riker | G4 |
| R12 Alpha expands into full MVP | Critical feasibility delayed; unreviewable increment | High / Medium | 7 | 6 | 4 | 168 | Locked feature inventory, 20% capacity buffer, WIP limits, scope change control | Riker | Every gate |
| R13 Working name implies affiliation | Confusion/legal risk on public distribution | Medium / Medium | 6 | 4 | 4 | 96 | Private technical alpha only; naming/legal review before any public release | Riker | G6 / future public gate |
| R14 Export-archive over-collection | Unrelated account/household data collected during extraction | High / High | 9 | 6 | 5 | 270 | Pre-ingest named-artifact allowlist, member/byte/ratio/path caps, encrypted scratch, inseparable-data stop | Worf | G1/G2 |
| R15 Harness supply-chain compromise | Runtime/dependency exfiltrates tokens or data | Medium / High | 9 | 4 | 6 | 216 | S013 minimal pinned/locked dependencies, no install scripts, dated vulnerability/license check, post-G2 reapproval | Worf | G2 |
| R16 Secret or capture committed to git | Persistent disclosure beyond reliable recall | Medium / High | 10 | 3 | 4 | 120 | Storage outside repo/cloud-sync; ignore defense, fail-closed pre-commit/staged scans, incident rotation/revocation | Worf | G2 |
| R17 Witness/reviewer exposure | Review reveals participant behavioral profile | Medium / High | 6 | 4 | 5 | 120 | Process-only attestation, participant content check, no real screenshots, derivative/report excludes personal fields | Worf | G2/G3 |
| R18 Credential-provider autofill into a controlled surface | Passkey or password enters an app-rendered or app-driven browser and places authentication inside the app boundary | Low / Critical | 10 | 2 | 5 | 100 | Charter passkey boundary; no rendered credential field; extended test 3; no embedded/automated browser or password-manager integration | Worf | G2 |
| R19 Ambient session causes account/marketplace ambiguity | Artifact from a different or household account merges into the snapshot | Medium / High | 8 | 4 | 6 | 192 | S002 AC9 attestation; one active account container; prior closure/key destruction/receipt before new consent/capture; source-marketplace mismatch quarantined; no provider customer ID for tenancy; inseparable-data stop | Worf + Data | G1/G3 |
| R20 Private API or client changes without notice | Persistent sync breaks, fields drift, or registration behavior changes because no vendor contract exists | High / High | 9 | 6 | 5 | 270 | Pin 0.12.0 and transitive lock; closed response schema; preserve last complete snapshot; no auth retry; reversible process adapter; re-review before every upgrade | Data + Worf | G2/G3 |
| R21 Persistent virtual device remains active unexpectedly | Account credential remains usable after abandoned install, failed disconnect, or tester turnover | Medium / Critical | 10 | 4 | 5 | 200 | One-device invariant; user-visible status; explicit disconnect+deregister; retain credentials on unconfirmed deregistration; manual Amazon-removal incident path; tester offboarding checklist | Worf | G2/G6 |

No residual RPN is claimed yet. At review, append mitigation evidence, residual
S/O/D/RPN, reviewer, and date for each risk. Controls must be tested, not merely
written, before lowering detection/occurrence scores. R08/R09 mitigations only
cover alpha's contracts and lack of a ranker; full recommendation risks must be
reopened before a later engine ships.

**Re-scoring restrictions:** R04 detection cannot decrease until security tests
1, 3, 7 and 8 below execute. R06 cannot decrease until test 9 includes restart
and canary re-scan/key-destruction evidence. R07 cannot decrease until tests 5
and 6 run the full ATR-ADV-1 through actual shared components and final surfaces.
R08/R09 residual entries must say **alpha-contract-only; reopen before ranking**.
R14–R17 have no residual acceptance yet. R18 cannot decrease until tests 3 and
11 execute; R19 cannot decrease until test 13 executes. At G2 relevant safety
risks with RPN >=100 require executed mitigation/re-score <100, not deferral to
G5; at G5 every risk must be below 100 and have no open security/a11y blocker
regardless of score.

Residual watch items (not approvals): workstation compromise; SSD unlinked blocks;
provider/user-held copies; self-consent limitations; changing catalog rights and
unknown source failures. Worf reviews disclosures and containment. Permission
ambiguity or inseparable data remains a stop, not an accepted residual.

## Gates and required evidence

| Gate | Required evidence | Decision authority | Failure behavior |
| --- | --- | --- | --- |
| G0 — Initial design/plan review | **PASSED 2026-09-16.** All 33 named blockers reconciled; full crew approved revised criteria/contracts/owners/51-point inventory; Captain accepted baseline | Riker coordinated; [Data](reviews/data-signoff.md), [Geordi](reviews/geordi-signoff.md), [Worf](reviews/worf-signoff.md), [Wesley](reviews/wesley-signoff.md), and Captain approved | ATR-S001 becomes READY; all later work remains dependency/gate controlled |
| G1 — Approved experiment route/design | **PRIVATE EXCEPTION APPROVED 2026-09-17.** S001 complete; Captain accepted pinned unofficial route, US marketplace, one persistent device, DPAPI custody, bounded GET-only sync, explicit disconnect, tester cap, and commercial block. Remaining original G1 criteria still gate broader scope | Captain change control with Data/Worf design constraints; formal legal review still required before conveyance | No route substitution, extra endpoint, marketplace, tester expansion, or public/commercial use |
| G2 — Safe to handle real data | S009 complete using S013; tests 1–12 pass with recorded evidence; dependency review, crypto-erase, containment, accessible controls, derivative privacy and safety risk mitigation | Worf explicit blocking approval; Data validates implementation; Geordi approves consent/lifecycle usability | Fixtures only; no authorization, account, personal export, actual source/catalog request or data |
| G3 — Actual access feasibility | S004/S005/S006/S007 complete; all four domains proven, participant non-owned attestation, required measurements/digests plus actual-run security tests 13–15 and consent/route verification | Data + Worf; Wesley semantic usefulness; Riker records verdict | Stop platform selection/release; missing domain, security evidence or digest blocks; no-go or explicit rebaseline |
| G4 — Evidence-led architecture | S011 with G3 measurements and S010 contracts; accepted dated platform threat model; reversal triggers and unresolved future obligations recorded; LLM TBD | Data with Worf/Geordi/Wesley review; Riker records decision | Product choices remain TBD until accepted; no speculative product build |
| G5 — Full team validation | S012 annex and earlier gates; tests 1–15 on final components/approved-run evidence; full accessible workflow; no open blocker; all residual RPN <100 and scope-qualified | All four officers; Riker verifies closure | Fix/retest or rebaseline; no assertion-only closure or silence waiver |
| G6 — Private alpha release decision | Sanitized changelog/limitations, capability matrix, test and officer reviews, risk residuals, supported environment, cleanup/rollback instructions | Captain explicitly approves or holds | Do not publish. An investigation no-go is not a shipped alpha |

Passing G3 is **not** proof of full session history, complete catalog coverage,
automatic sync, production reliability, or recommendation quality. The evidence
must bound those claims. If import mode is used, G6 wording must explicitly say
“import-based prototype; no automatic synchronization.”

Final crew sign-off and Captain baseline acceptance passed G0 on 2026-09-16.
This authorizes ATR-S001 planning execution only; every later activity remains
subject to its dependencies and gates. No use of legacy Home Assistant version
files, HACS, or release branches applies. Version is locked to **0.0.1** for
this alpha; any later packaging convention requires review. G0 does not
authorize real-data activity, a tag, deployment, or release publication.

### G1 architecture, security and accessibility checklist

- Dated authority/terms per route, permission verdict and qualified clarification
  of ambiguity; affiliate/tracking disqualification; route/config fingerprint.
- S002 boundary, signed-consent template/withdrawal, incident/revocation runbook,
  explicit credential prohibitions, pre-ingest allowlist and archive/capture caps.
- Runtime-neutral versioned schema/dictionary, stable keys and canonical digest
  exclusions, per-field authority/freshness/restart policy, named ports and ATR-ADV-1.
- Disposable harness explicitly non-binding on product choices; design reviewed
  before code including accessible consent and S013 fixture renderer.
- S001 architecture comparison rules pre-registered. Narrator/series/history/
  progress granularity audit domains and synthetic grounding/label design explicit.

### Required security evidence — stable test numbers from Worf review

No test is currently run or passed. **S013 supplies shared preflight components;
S009 completes G2 evidence**. S004/S006/S008 reuse them and re-run tests against
their actual adapters/mapping/UI before personal input; they are not hidden G2
prerequisites. Network preflight uses controlled fixtures, not real source calls.

| Test | Exact required result | Owner / implementation | Gate |
| --- | --- | --- | --- |
| 1 | Default-deny egress; import/render/normalizer zero outbound; fixture API destination set matches exercised allowlist, blocked destination fails closed with safe error | Data S013/S009; Worf reviews | G2 |
| 2 | No AI SDK/endpoint/credential/egress path; AI negative probe denied | Data S013/S009 | G2 |
| 3 | Static credential absence across source, direct and transitive dependencies, lockfile and build configuration: no password/MFA/OTP/CVF/session-cookie handling; browser-profile/cookie-jar access; embedded webview or browser automation; WebAuthn/FIDO/passkey API/library; password-manager SDK, Connect, service-account variable, CLI, agent or extension channel; clipboard/pasteboard read; or rendered credential input | Data S013/S009; Worf boundary review | G2 |
| 4 | Archive traversal/absolute/UNC/symlink/bomb/member-size/count/ratio caps rejected; refused content never parsed/copied/indexed/logged | Data S013/S009 | G2 |
| 5 | Full ATR-ADV-1 through shared renderer: admissible payload inert/visibly escaped/full-text accessible, no execution/navigation/network/layout escape; invalid inputs safely rejected | Data S013; Geordi/Worf review; S009 collects evidence | G2 |
| 6 | Corpus through shared normalization core: trust markers preserved, no control/identity/path/query injection or unauthorized I/O; quarantine not promoted by retry | Data S013/S009 | G2 |
| 7 | Logs/errors/traces/exit output pass category allowlist, not only canary test; no payload debug/crash/telemetry | Data S013/S009 | G2 |
| 8 | Encrypted storage outside repo/cloud sync; pre-commit/staged canary/secret scan demonstrably fails closed | Data S009 | G2 |
| 9 | Key destruction, full storage/residue inventory, restart and canary re-scan find no recoverable app-managed data; provider-held, vault-service, user-held and SSD limitations disclosed | Data S009; Worf witnesses | G2 |
| 10 | Versioned JSON contract-level export/reload equal digest; no token/secret/disallowed field; unknown version rejected; no tabular formula-execution path | Data S009 | G2 |
| 11 | Synthetic app-visible cancel/denied/malformed/interrupted/timeout outcomes produce a safe, actionable plain-language stop, preserve or return focus to the initiating control, and contain no private diagnostic category. ATR never observes or probes vault/authenticator state or provider credential choices and never retries or supplies an alternate credential-handling path | Data S013/S009; Geordi reviews focus and copy | G2 |
| 12 | Pinned/locked minimal dependencies, no install scripts, dated vulnerability/license scan; no unresolved critical/high issue | Data S013/S009 | G2 |
| 13 | Actual adapter per-run request/byte/runtime caps enforce abort, not silent truncation; safe fixture fault validation plus bounded actual-run counts. Snapshot manifest binds non-identifying attested alias/marketplace to the internal participant key; mismatch with source-evidenced marketplace quarantines and cannot promote; a second account cannot coexist or merge without prior container closure, crypto-erasure, receipt, and new consent | Data S004/S005; Worf validates provenance boundary | G3 |
| 14 | Raw capture destruction receipt includes safe category/storage alias/time/method; approved derivative created first, no personal values | Data S004; Worf validates | G3 |
| 15 | Actual-run allowed/observed destinations recorded: import zero, API subset of approved allowlist with every observed destination justified; no exceptions | Data S004/S005; Worf validates | G3 |

At G2 also verify consent/deletion accessible-path tests, retention expiry and
withdrawal drill. At G3 require consent in force, exact approved route/config
fingerprint (no substitution), redaction verification, process-only witness
attestation, participant content check and non-ownership attestation.

G5 revalidates tests 1–15 using final implementations and actual-run records.
Do not induce a leak, denial or archive bomb using real personal data; adversarial/
failure probes use fixtures against the same binaries. Any new actual capture
requires new consent and receipts. Missing applicable evidence blocks the gate;
not-applicable items need Worf's reasoned recorded disposition, never a fictitious pass.

### G3 measurements and G4 decision criteria

Data requires S004 requests/pages/bytes, per-page/total duration, retry/backoff and
rate-limit/spacing/cursor observations; S005 lookup latency, allowed cache TTL and
ID matching success/ambiguity; S006 fixture size/runtime/peak memory/environment,
normalized bytes/record and per 100 entries, raw:normalized ratio and observed
unmodeled fields; S007 repeat/order/batch/replay digests and zero duplicates.
Label measured/estimated/not-applicable, sample denominators and sanitized output.
No target/improvement claim from one participant. Wesley reviews narrator/series
fidelity percentages as descriptive evidence, not a mandatory 90% cutoff.
S010 accepted synthetic traces must resolve and label safely; no ranking efficacy
or anti-echo-chamber outcome claimed by a contract.

G4 backend/storage/refresh conclusions each cite these measurements or a documented
constraint. Require accessibility API comparison, port substitution impacts,
observable reversal triggers and a dated platform-specific threat model: iOS key/
background/deep-link/pasteboard/notification risks, hosted session/CSRF/token/
transport/custody, or local disk/backups/shared workstation as applicable.
No LLM choice, SDK or egress; future deterministic product remains useful alone.

**Standing gate condition:** route, runtime, dependencies, storage location or
egress allowlist change after G2 requires Worf **re-approval before use**, not
notification. An incident halts the experiment until runbook closure and reapproval.

## Decision register

| Decision | Current value | Evidence / owner / deadline gate |
| --- | --- | --- |
| D01 Access route | Private alpha: pinned community `audible` 0.12.0 external-browser PKCE plus persistent virtual device; unofficial and unsupported. Public/commercial route remains TBD | [Change control](10-private-alpha-connector-change-control.md), Data + Worf, G2/G3 proof |
| D02 Manual import fallback acceptable? | Pending Captain approval; must remain clearly labeled | S001, Captain, G1 |
| D03 Experiment marketplace/language | TBD; one of each only | Source capability and consenting user, S001/G1 |
| D04 Client/platform/framework | TBD | S011 after G3; accepted at G4 |
| D05 Backend/storage/hosting | TBD; no cloud selection implied | Privacy/access measurements, S011/G4 |
| D06 Prototype harness/runtime | TBD; minimal/disposable, no product commitment | S002/S003 design, G1; runtime safety G2 |
| D07 LLM provider/model/data sharing | TBD / no provider integrated; no AI sharing in alpha | Revisit only after a deterministic recommendation release is scoped |
| D08 Catalog route and metadata rights | TBD | S001/S005; G1 permission, G3 proof |
| D09 Real source coverage | Unknown in all four domains; repeatability untested | S004–S007; G3 including non-owned attestation and security evidence |
| D10 Working name/public branding | Working name only; no affiliation claim | Riker + qualified legal/naming review before public distribution |
| D11 Full-history/refresh expectations | TBD beyond captured source semantics; manual experiment only | S001/S004/G3; later sync release |
| D12 Shared runner ownership | S013 sole owner; S009 consumes, no S006 round-trip dependency | Approved by Data and Worf at G0 |
| D13 Revised estimate / scope | 51 points, 13 features/stories; locked baseline | Riker [change record](07-review-consensus.md); unanimous crew and Captain acceptance at G0 |

## Officer review handoff

| Officer | Requested review | Current sign-off |
| --- | --- | --- |
| Data | Nine blockers plus recommendations reconciled; schema/digests, measurements, runner/estimates and G3 join | **APPROVED** — [final sign-off](reviews/data-signoff.md) |
| Geordi | Seven blockers plus deferred UX obligations reconciled; exact a11y criteria and reused pre-G2 controls | **APPROVED** — [final sign-off](reviews/geordi-signoff.md) |
| Worf | Fourteen blockers, tests 1–15, lifecycle/route gates and R14–R17 incorporated | **APPROVED** — [final sign-off](reviews/worf-signoff.md) |
| Wesley | Three blockers, metadata card condition and bounded synthetic experiments reconciled | **APPROVED** — [final sign-off](reviews/wesley-signoff.md) |
| Riker | Reconcile documents, record every disposition and validate consistency | **APPROVED** — [final consensus](07-review-consensus.md) |
| Captain | Accept G0 baseline; resolve fallback/test scope at G1 and release decision at G6 | **G0 BASELINE ACCEPTED**; later decisions remain gated |

Use review findings with unique finding IDs, affected story/requirement, severity,
required action, owner, evidence, and closure disposition. Do not mark a gate
passed simply because a review was requested.
