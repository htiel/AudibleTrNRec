# Alpha 0.0.2 risks and release gates

**No full A2 gate packet is declared passed by this verdict.**
[11](11-implementation-release-verdict.md) records an implemented, usable
**owner-only build APPROVED WITH CONDITIONS**, separately from named-tester/
public release clearance. Amended officer implementation approvals replace
their earlier planning verdicts; unresolved CP/source/evidence/legal records
are not retroactively approved. This document supplements,
not replaces, the archived
[gate requirements](../archive/0.0.1/05-risks-and-release-gates.md),
[private connector change control](../archive/0.0.1/10-private-alpha-connector-change-control.md)
and [HOLD/FAIL verdict](../archive/0.0.1/feedback-and-bugs/alpha-0.0.1-release-verdict.md).
The latter remains the historical 0.0.1 assessment; 11 controls the current
0.0.2 implementation assessment. Old planning sign-offs do not close gates.

## Gate matrix

The `A2-` prefix avoids overwriting historical G0–G6. No gate is inferred from
a test total, plan approval or an already running private connection.

| Gate | Scope / mandatory evidence | Authority | Current state |
| --- | --- | --- | --- |
| A2-G0 — Design readiness | S014; approved contracts/wireframes/CTQs/FMEA, all mandatory RC corrections reconciled into CP specifications; dated officer concurrence and Captain decisions before code | Wesley + Geordi design; Worf + Data review; Riker reconciliation; Captain new-surface approval | INCOMPLETE: implementation approved within owner/UI scope; missing CP/Captain records not retroactively passed |
| A2-G1 — Permission and source plan | Dated supported-route research first; narrow unofficial library exception described precisely; route-specific legal/security/maintenance decision before new domains; formal named legal/licensing review **before any conveyance** | Captain + named qualified legal reviewer; Worf/Data technical review | PENDING; no new route/conveyance approved |
| A2-G2 — Safety before new real-data activity | Executed applicable security tests 1–12, authenticated API, trusted executables, safe custody, pinned/audited dependencies, consent/lifecycle/incident controls, encrypted feedback and no-egress boundary, synthetic export/delete/migration/residue proof; S039 evidence; applicable safety residual RPN <100 and no blocker | Worf blocking approval; Data and Geordi concurrence | PARTIAL owner evidence; BLOCKED for expansion: supply chain, CP-02 full live proof and RC-08 event evidence remain |
| A2-G3 — Source correctness and four-domain proof | G2 plus bounded route authorization; genuine library/history/progress/non-owned catalog evidence with semantics, completeness, identity and caps; applicable tests 13–15; participant non-owned attestation; private packet-level egress evidence and sanitized process receipts | Data + Worf + Wesley | BLOCKED |
| A2-G4 — Architecture evidence | Measured comparison/ADR citing G3, supported runtime and reversal triggers, platform-specific threat model; retain adapter/local-authority boundaries. Evaluate OF-007 native iPhone intent under the [native constraints](07-native-iphone-direction.md#architecture-decision-and-portability); current Windows/Node/Python/SQLite is disposable evidence, not proof of a shippable native connector | Data; Worf threat review; Captain future architecture decision | BLOCKED |
| A2-G5 — Full team readiness | Tests 1–15 on final components or explicit Worf N/A; all 30 mandatory A-IDs plus promoted A012 closed; all selected stories accepted or separately rebaselined; rendered keyboard/AT journey; migration/export/delete recovery; all applicable residual RPN <100; zero security/a11y blockers | Data, Geordi, Worf, Wesley; Riker evidence audit | BLOCKED |
| A2-G6 — Release and audience | S043 packet, dated G0–G5 approvals, named legal/licensing approval before conveyance, explicit residual acceptance, exact audience/build and tester roster in private custody; Captain PASS/HOLD/FAIL decision | Captain only | BLOCKED |

The owner's existing authenticated runtime and process-only revision-3 migration
evidence are acknowledged in 11; they do not authorize another account, install,
new provider route, phone connection or copy. Named testers remain NO-GO for
the complete blocker set in 11, including physical rendered evidence. A2-G6
remains blocked for release/conveyance despite conditional existing-owner use.

Public/cloud/multi-user/store/installer/package/binary/commercial distribution
remains **HARD NO-GO regardless of these private-alpha gates**. Changing it needs
new legal/licensing/security review and Captain change control, outside 0.0.2.
Do not disable mechanical shipping guards to pass tests or send a tester build.
The owner + ≤10 named testers ceiling does not bypass any gate.

Native product intent creates no TestFlight/App Store exception. The
[future native deployment gates](07-native-iphone-direction.md#deployment-and-release-gates)
remain separate and pending; even private TestFlight/binary conveyance is not
authorized by A2-G6. No iOS credential-custody or connector design is approved.

### Feasibility failure is an allowed investigation outcome, not a release PASS

S040/S041 can produce a useful STOPPED/no-go report after lawful research. It
does not satisfy A2-G3, retroactively pass 0.0.1, or clear named testers.
No reduced-domain gate is approved here. Any proposal to release only the
private library/feedback subset must explicitly name unresolved A013/A014 and
the resulting G3/G4 consequences, obtain Captain change control plus renewed
Worf/Data/Geordi/Wesley and applicable legal review, and change all current
planning documents together. Until then, HOLD remains.

## Mandatory evidence packet

Riker owns a future sanitized manifest with: stable story/finding/test ID,
criterion, fixture version, code revision, runtime/tool versions, command,
executed result, denominator, evidence type, reviewer/date, gate and disposition.
Label measurements **measured**, targets **estimated**, and true exclusions
**not-applicable** with reason. `unknown`, `unavailable` and skipped are never
synonyms for PASS. Do not invent a future revision or sign-off today.

Required evidence:

- All 30 inherited blocking/evidence items plus A012's feedback prerequisites;
  [disposition matrix](03-backlog.md#inherited-finding-disposition) covers all
  51 findings. Each closure links implementation, reproduction/regression,
  officer re-review and gate decision. Archive reports remain unchanged.
- Retain security test numbers **1–15** from the archived gate document; extend
  the existing S013 harness. Preserve their original criteria. Only Worf may
  record a specific reasoned N/A when the approved connector supersedes an
  import/archive-only test; this cannot waive equivalent lifecycle protection.
- Egress containment first against synthetic/stub targets at G2; actual bounded
  provider packet-level evidence only **after** G2 under explicit authorization,
  for G3. Scanners are not containment proof. Record allowed destinations and
  measured limits without exposing account identifiers, callback URLs or data.
- Raw packet captures, consent records, source values and participant checks
  stay outside repository/cloud sync in approved encrypted custody. Public
  artifacts are process-only attestations, not “redacted” library dumps.
- Export schema and semantic round trip; encryption/key lifecycle inventory;
  deletion/retention/restart canaries; interrupted migration/rollback/restore;
  cross-account rejection; feedback preservation across every sync path.
- Actual rendered synthetic LCARS states, keyboard/screen reader journey,
  narrow/zoom/focus/contrast evidence; A022 is an unresolved measurement hold.
  Do not reproduce unsupported ring-vs-fill claims or “fix” a regex.
- Execute Windows symlink-containment in a capable disposable environment.
  Historical one-skip baseline is not evidence of that control.
- Hash-pinned dependency provenance, license/vulnerability review and mechanical
  private-only policy tests. A prior clean audit does not prove a new lock.
- Repeatable performance baseline and preapproved budget on fixed synthetic
  datasets. State sample size/environment; use paired evidence and effect size
  for “faster” claims rather than a single run. No optimization claims today.
- Full four-officer final review and Captain decision. Prior reports are
  consulted evidence, **not new 0.0.2 sign-offs**.

## FMEA and risk register

Scores below are **initial planning estimates**, not measured failure
probabilities or approved residuals. S = severity, O = occurrence,
D = difficulty of detection (1–10); RPN = S×O×D. Probability/impact are
qualitative planning judgments. Mitigation implementation/evidence is pending;
no residual is pre-assigned. All RPN ≥100 must be addressed before release.
Worf security and Geordi accessibility blockers remain blocking at any RPN.

| Risk | Failure mode / effect | Prob. / impact | S | O | D | RPN | Initial planning control / gap | Action / owner |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| A2-R01 | Unauthenticated local API exposes or mutates private data | High / High | 9 | 7 | 6 | 378 | Proven 0.0.1 bypass at planning review; 11 records later capability/custody fixes and conditional owner acceptance, not a measured residual re-score | S014 dated interim agreement; S015 capability/extension/bootstrap/nonce/export proof T01/T02; Worf |
| A2-R02 | Executable/module substitution compromises credential boundary | Medium / High | 9 | 5 | 6 | 270 | Isolated process but resolution/custody evidence incomplete | S016–S020 trusted resolution, cleanup, provenance and guards; Worf |
| A2-R03 | Wrong units or incomplete import lies about progress/library | High / High | 8 | 7 | 5 | 280 | Validators exist; current expectations/whole-sync gaps | S021–S024 explicit units, complete-or-stop fixtures; Data |
| A2-R04 | Identity/reconciliation/account mismatch loses or misattributes feedback | Medium / High | 9 | 6 | 6 | 324 | Account-keyed snapshot; no persistent annotation proof | S024–S026, S030, S032 transaction and ambiguity tests; Data |
| A2-R05 | Export/deletion omits private material or overclaims erasure | High / High | 9 | 6 | 7 | 378 | DPAPI at rest; lifecycle/residue evidence absent | S028–S030 complete inventory, keys, retention and disclosure; Worf |
| A2-R06 | Feedback write/migration fails after UI reports success | Medium / High | 8 | 5 | 6 | 240 | New mutation surface not built | S030–S033 durable acknowledgement, revision conflicts, rollback; Data |
| A2-R07 | LCARS clips content or hides focus/errors from AT users | Medium / High | 7 | 6 | 5 | 210 | DOM-free tests; rendered focus/AT hold | S033–S038 actual synthetic rendered/AT workflow; Geordi |
| A2-R08 | Private data enters synthetic trace/diagnostics/model traffic | Medium / High | 9 | 5 | 6 | 270 | Safe DOM and synthetic contract; mixed-source label gaps | S020, S032, S035–S036 canaries and zero-model-egress tests; Worf/Wesley |
| A2-R09 | History/catalog unavailable or rights mistaken for technical access | High / High | 9 | 8 | 4 | 288 | Library-only exception; no four-domain proof | S040–S041 supported research, legal route decision or STOPPED; Wesley/Data |
| A2-R10 | Missing receipts mistaken for clearance; unauthorized conveyance | Medium / High | 10 | 5 | 7 | 350 | Mechanical no-publish guards; legal/evidence gates open | S042–S043 dated approvals and mandatory ID coverage; Riker/Worf |
| A2-R11 | UI/storage optimization weakens controls without measurable gain | Medium / Medium | 6 | 5 | 5 | 150 | No reproducible performance baseline for new surfaces | S034/S039 measure budgets, retain hardening, regression gate; Data |

OF-007 clarifies, without closing or re-scoring, A2-R04/R05 (portable identity,
encrypted custody and migration), A2-R07 (Safari evidence is not native
accessibility proof), A2-R09 (community connector rights/availability are not
iOS feasibility) and A2-R10 (native intent is not distribution permission).
The [future native FMEA](07-native-iphone-direction.md#future-native-risks)
is outside current release scope and must be reviewed before native work;
no new A2 story, dependency or gate is introduced.

Review risk refinements (not measured residual reductions): R01 includes
bootstrap phishing, extension/content-script access and export egress; R02
includes Node/SQLite/Playwright/Edge provenance and major-channel re-review;
R04–R06 include identity-seed loss, legacy unseal and cross-file migration
recovery; R07 includes text spacing, keyboard occlusion and unavailable isolated
mobile evidence. R08 includes event/instrumentation leakage. R11 includes
aggregate bounds, spawn/stall costs and invalid layout comparisons.
[RC-01–RC-32](09-review-consensus.md#reconciled-findings-and-dispositions)
map these to existing owners/tests. Scores remain unchanged until execution.

At A2-G2, applicable safety risks must have executed mitigations and residual
RPN <100. At A2-G5, **all applicable** risks must be re-scored with evidence
and residual RPN <100; no missing review/permission is accepted numerically.
Security tests and archived FMEA restrictions still apply. The archived
recommendation/trust risks R08/R09 remain **alpha-contract-only; reopen before
ranking**; no recommendation work is authorized here.

## Decisions still required

| Decision | Owner | Blocks |
| --- | --- | --- |
| Complete-or-stop malformed/duplicate policy and source units | Data + Worf | S014, S021–S024 |
| Canonical identities, ambiguity mapping and migration versions | Data + Worf | S026, S030–S032 |
| Feedback payload bounds, revision conflicts, explicit Save and new-surface wireframes | Data + Geordi + Worf + Wesley; Captain design approval | S031–S033, S037–S038 |
| Retention/key lifecycle/backup and export copy disclosure | Worf + Data + Geordi; Captain for changed retention | S028–S030, A2-G2 |
| Auth bootstrap, executable roots, supported runtime/dependency profile | Worf + Data | S015–S020, A2-G2 |
| History/catalog route rights and bounded live experiment | Named legal authority + Captain + Worf | S040–S041 live activity, A2-G3 |
| Measured architecture comparison for intended native iPhone, not assumed connector portability or shipping clearance | Data + Worf; Captain | Existing S042/A2-G4; future native plan |
| Any reduced-domain release proposal | Captain with full officer and legal review | Cannot bypass A2-G3 under this plan |
| Named-tester conveyance and exact audience | Named legal authority + Worf + Captain | A2-G6 and every copy conveyed |
| Interim owner-only acceptance of A001 AND A002 and proposed operating controls | Captain, Worf records; no app action by this task | A2-G0 concurrence; not a finding closure |
| Full-entropy usable bootstrap and extension-free profile residual | Worf/Data/Geordi; Captain new surface | CP-02, S015 |
| Direct-DPAPI baseline/A045 limits, seed retention, migration and aggregate/event/backup retention limits | Data/Worf; Captain changed retention | CP-03/04, S028–S032 |
| Isolated iPhone/equivalent evidence route, column/sort audit and new UX approval | Geordi/Worf/Data/Wesley; Captain | CP-05, OF-006, A2-G5/G6 |

## Control plan and review status

Automated regressions enforce validators, complete-or-stop promotion, local
authority, encrypted storage, schema migrations, canary-safe diagnostics,
account isolation, policy and no-model-egress. Manual rendered/AT, private
packet evidence and named legal review remain separate gates. On failure,
block promotion, preserve last valid state and invoke the relevant incident/
recovery runbook; never weaken a control just to make a test pass.

**Current implementation verdicts:** Data APPROVE; Geordi FULL APPROVE (UI
scope); Wesley PASS (private evaluation); Worf APPROVE WITH CONDITIONS
(owner-only). See [implementation reviews](implementation-reviews/README.md)
and [11](11-implementation-release-verdict.md). Earlier planning positions
remain historical in 09; no blanket RC closure or residual RPN reduction is
inferred from test totals.
**Owner-only runtime conditional GO; named/public release NO-GO.**
This documentation task reads no
personal store and runs no app, provider, migration, disconnect/delete,
packaging or runtime test. It leaves the owner's active app and connection
untouched. Markdown link and diff validation are documentation checks only.
