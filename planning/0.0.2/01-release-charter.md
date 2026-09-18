# Alpha 0.0.2 release charter

**Release:** private, single-user alpha 0.0.2

**Status:** implemented build accepted for **owner-only private evaluation with
conditions**; named-tester/public release remains NO-GO. See
[11 — implementation verdict](11-implementation-release-verdict.md).
The [planning consensus](09-review-consensus.md) remains historical; requirements
below are retained, not blanket claims of completed gates or measured CTQs.

**Date:** 2026-09-17

**Champion / final authority:** Captain

**Execution / Black Belt:** Riker

## Problem and goal

The [0.0.1 verdict](../archive/0.0.1/feedback-and-bugs/alpha-0.0.1-release-verdict.md)
is HOLD/FAIL. Its 51-finding register includes 30 blocking or gate-evidence
items. The existing read-only inspector cannot safely become a feedback-writing
product merely by adding controls. Security, source correctness, local identity,
durability, lifecycle and evidence gaps come first.

Deliver a useful private library in which a user can find a book, understand
its source/progress uncertainty, record and revise private feedback, and keep,
export or delete that feedback safely. At the release decision, every applicable
blocker must have executed closure evidence. No deadline or velocity is assumed.
Source feasibility remains the program constraint, not UI polish.

## Authority and scope lock

The Captain approved archiving 0.0.1 and opening 0.0.2 for UI optimization and
private feedback/rating collection and storage. The additional safety, library
control and evidence work is decomposed in [scope](02-scope.md) and
[backlog](03-backlog.md): **4 themes, 8 epics, 30 features, 30 stories,
112 estimated points**. Review reconciliation preserves this estimated baseline;
it does not certify that unresolved design work fits those estimates.

OF-007 records [native iPhone as the intended destination](07-native-iphone-direction.md),
not a native architecture or migration commitment. Direction and portability
constraints map to existing S014 and S042/A2-G4; no stories or points are added.

This approval does **not** approve detailed designs, new provider routes,
personal experiments, data retention changes, a platform implementation,
distribution, or any release gate. The [product brief](../../APP_DESCRIPTION.md)
remains authority;
its broader MVP is neither delivered nor rewritten here. All four officers
must review the relevant designs before implementation. New UX surfaces require
Captain design review before implementation; final release always requires the
Captain's explicit decision.

## Business case and scope

- **In:** inherited mandatory remediation; accessible LCARS refinement;
  encrypted local per-book overall/story/performance ratings, comments and
  tags; explicit local authority and edit/delete; facets/filter preservation;
  export/deletion; automated tests; migration/recovery; gated source research.
- **Out:** recommendation generation or feedback on generated recommendations;
  LLM/provider integration; author/narrator/genre/series rating editors;
  public reviews/social features; cloud, multi-user, mobile-platform migration,
  public/commercial distribution; source library/progress/rating mutation;
  camera/barcode ingestion and Audible product-page handoff (future backlog).
- No personal state or implementation code changes in this transition.
  Existing runtime version, storage root, connection and process remain intact.

## Private-data and access boundary

1. Never collect an Audible/Amazon password, passkey/WebAuthn ceremony, MFA code
   or session-cookie relay; no password-manager integration, vault/clipboard
   reads, browser-profile extraction or app-rendered credential fields.
   Authentication stays on the provider-controlled external browser surface.
2. The existing exception is unofficial community `audible` 0.12.0,
   US marketplace, one persistent device and library-only `GET` grant.
   Provider credentials stay in Python, never Node/browser/planning/logs.
   No new endpoint, retry policy, ceiling or source route follows from this plan.
3. Keep the provider's fixed “Audible for iPhone” device name and truthful local
   ATnR disclosure. Ordinary sync/shutdown must not deregister. Only explicitly
   confirmed **Disconnect Audible** performs normal deregistration and
   credential destruction; local deletion is distinct. Do not silently abandon
   a registered device if cleanup fails.
4. Ratings, comments, tags, queries, library/history/progress and exports are
   private. Store sensitive local content encrypted outside the repository and
   cloud-sync locations, under the approved Windows-user DPAPI boundary.
   DPAPI does not protect against same-user malware, runtime plaintext, dumps,
   pagefiles, backups or user-held copies. Do not claim full-disk or forensic
   erasure from a SQLite delete, VACUUM or overwrite.
5. No hosted-model egress, local LLM, telemetry, remote cover/font fetch,
   comment analysis, inferred affinity or ideological profiling. Feedback is
   inert local data, never a provider request or instruction.
6. Review fixtures are invented. Never copy real titles, identifiers, personal
   counts, paths, callback URLs, tokens, exports, comments or real-capture
   screenshots into the repository. Witness controls, not content. Personal
   consent/evidence remain in approved encrypted custody; publish only
   by-construction sanitized process attestations.
7. Owner plus at most ten named testers is a ceiling, not clearance.
   **Any conveyance**, including private source, needs named legal review of
   Audible/Amazon terms and GPL/AGPL obligations, Worf approval and Captain
   clearance. Public/cloud/store/installer/package/binary/commercial shipping
   remains mechanically **NO-GO**. Do not bypass `private: true` or `prepack`.

### Interim owner-only exposure controls — 2026-09-17

**Historical 0.0.1 exposure:** A001 (unauthenticated local API) and A002
(executable substitution) were open at planning review. Scheduling S015/S016
did not itself provide protection. The later 0.0.2 fixes and Worf's conditional
owner acceptance are recorded in 11; do not apply this historical paragraph
as a claim that the current code still vends unauthenticated capabilities.
Worf C-1 requires a dated Captain decision explicitly accepting both risks for
owner-only continued use, with these interim operating controls: private mode
only while actively used, owner-controlled loopback-service shutdown when idle,
a dedicated extension-free browser profile, and no untrusted local tooling on
the host while it runs. These reduce exposure, not same-user compromise.
The planning-stage record did not contain Captain acceptance; current Worf
owner-use conditions are retained by 11 without inventing an earlier signature.

This is a proposed operating agreement for the Captain, **not authorization for
this documentation task to stop, disconnect, deregister or alter the app**.
S014 records the decision and incident procedure; S015/S016 supply actual fixes
and A2-T01/T03 evidence. No testers are cleared. See
[RC-01 and open decisions](09-review-consensus.md#remaining-decisions-and-blockers).

## Measurable CTQs

All targets below are **planned**, not measured achievements. Baseline evidence
is historical: 156 Node tests (155 pass, one Windows symlink skip), nine Python
tests passing. These counts do not close incorrect assertions or missing gates.

| CTQ | Release target | Measurement / owner |
| --- | --- | --- |
| Local API boundary | Zero unauthorized data reads/writes; no public token vending; destructive confirmation non-replayable | Synthetic route matrix and adversarial local clients; Worf |
| Correct source semantics | 0–100 progress contract exact; unknown never zero/completed; no false complete sync | Boundary/unit/page mutation fixtures; Data |
| Local authority | Zero lost/duplicated/reassigned feedback records across replay, failure, migration or removal | Three equal canonical semantic digests plus mutation/failure matrix; Data |
| Feedback validation | Only null or 0.5–5.0 in 0.5 steps; separate optional dimensions; bounded inert comments/tags | Cross-boundary validator tests and accessible editing; Data/Geordi |
| Privacy/lifecycle | Zero feedback in provider/model traffic, logs or plaintext application storage; complete export/delete coverage | Canary, restart, residue and egress receipts; Worf |
| Accessible LCARS | WCAG 2.2 AA including text spacing; 320 CSS px reflow; 200% zoom; keyboard/AT complete workflows; 44×44 CSS px enumerated primary controls, otherwise 24×24 px or valid WCAG spacing | Rendered synthetic desktop/narrow screens and manual AT evidence; Geordi; primary scope in implementation plan |
| Contrast/status | Text 4.5:1 (large 3:1), non-text/focus 3:1 against actual adjacent surfaces; one announcement per event | Rendered states and assistive-technology checks; Geordi |
| Recovery | Interrupted writes/migrations preserve last valid state; actionable failures, no false save/sync success | Injected disk/crypto/process failure and restart; Data |
| Evidence honesty | No synthetic trace consumes private snapshot; exact missingness, explicit provenance | Canary separation and empty/partial fixtures; Wesley |
| Performance | Measure repeatable synthetic baseline before optimization; approve p95 budget before implementation, no unsupported “faster” claim | Fixed dataset/environment, repeated paired runs and declared sample counts; Data |

## Team, method and control

Riker owns scope/WSJF, risk register and release decision packet. Data owns
contracts, identity, storage, synchronization, tests and performance. Worf owns
security, custody, lifecycle and access gates. Geordi owns LCARS, keyboard,
responsive and accessibility review. Wesley owns usefulness, honest labels and
bounded feasibility learning.

**SIPOC:** suppliers (Captain, archived reviews, approved source) → inputs
(constraints, invented fixtures, gated source evidence) → process (design,
remediate, verify, collect privately, review) → outputs (safe library/feedback,
sanitized gate packet) → customer (one private listener).

Apply DMAIC to inherited defects: define from stable A-IDs, measure with
reproductions, analyze mechanism, implement bounded fix, control with regression
tests. Apply DMADV to feedback design. Use statistics for quantitative claims
only when repeatability and sample size support them; no invented sigma levels.
No new parallel test runner; extend ATR-S013's existing harness.

Milestones are evidence-based, not time promises: design review → synthetic
boundary closure → data/lifecycle closure → feedback/UI → authorized feasibility
→ final review → Captain decision. Reserve 20% of measured PI capacity for
unplanned work; [sequencing](04-sequencing.md) defines readiness.

Every change record names reason, affected IDs/points/gates, risk impact,
officer concurrence and Captain decision where required. Top risks are local
data exposure, annotation loss and unproven source rights; the
[FMEA and gates](05-risks-and-release-gates.md) block release until resolved.
