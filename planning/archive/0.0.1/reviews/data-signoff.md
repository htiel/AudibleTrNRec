# Data — final G0 sign-off for alpha 0.0.1

**Officer:** Lieutenant Commander Data (architecture, data model, synchronization,
catalog normalization, recommendation pipeline, provider boundaries, performance)
**Artifact re-reviewed:** `planning/0.0.1/` documents 01–06 plus
[07-review-consensus.md](../07-review-consensus.md), against my original
[data-review.md](data-review.md)
**Date:** 2026-09-16 **Gate:** G0 — final domain sign-off
**Scope:** verification only. No canonical plan file was modified, no scope added,
no commit or push performed.

---

## 1. Verdict

**APPROVED.**

All nine DATA blockers are closed in the canonical documents, all nine
recommendations carry an explicit disposition, and my five remaining approval
conditions are satisfied. The three CTQ outcomes I declared untestable are now
testable: Repeatability compares SHA-256 canonical digests, Honest data is
governed by an exhaustive field-authority table, and Trust validation is a
fail-closed allowlist that also rejects retrieval ordinal.

I found **no contradiction, no broken dependency, no untestable CTQ, and no
architectural or provider lock-in**. Roll-up arithmetic, WSJF ordering, dependency
edges and critical-path values reconcile exactly across documents 01, 02, 04, 06
and 07 (recomputed independently below). My approval is of the **plan**; it is
not evidence of any executed test, and G0 still requires the other three officers
and Captain baseline acceptance.

---

## 2. Evidence for every prior blocking item

| Finding | Required outcome | Canonical evidence | Status |
| --- | --- | --- | --- |
| DATA-B01 | Identity keys, canonical form, exclusion list; digest comparison | `03` normative "Identity and canonical equality": source-namespace keys with precedence and ambiguity quarantine, lexical key order, NFC, ordinal code-point collation, canonical decimals, fixed-precision UTC RFC3339, SHA-256; explicit exclusion of attempt/capture times, run IDs, transport cursors/counters, durations, retries. S003 AC1/AC3; S007 AC1 compares three equal digests with zero duplicates | **CLOSED** |
| DATA-B02 | Field-level authority and freshness, including absent timestamp | `03` normative "Field authority and freshness" table classifies every field source/local/derived/operational; absent ⇒ retain + quarantine conflict, equal ⇒ no-op or quarantine, older ⇒ retain trusted; unclassified fields fail validation. Progress explicitly **not** globally monotonic; evidenced restart only. S003 AC2, S007 AC3 | **CLOSED** |
| DATA-B03 | Runtime-neutral versioned contract; harness types excluded | `03` normative preamble: versioned JSON Schema + dictionary, fixtures/stores/exports are instances, unknown properties rejected, named ports (source, catalog, normalizer, store, clock, ID generator), adapter types never cross the boundary. S003 AC1, S006 AC4, S013 AC1–AC2, charter "Non-scope and platform neutrality", `05` G1 checklist | **CLOSED** |
| DATA-B04 | Merge/split fixtures and annotation survival with alias trail | `03` identity section: alias / `superseded_by` with provenance, merge/split conflicts preserve sentinel and old target, quarantine unresolved links, never silent delete or repoint. S003 AC4, S007 AC4; CTQ "Failure/local authority" at G3/G5 | **CLOSED** |
| DATA-B05 | Order/batch/replay/post-deletion coverage and normalizer determinism | S007 AC2 (reorder, overlapping batches, interrupted-then-complete replay), AC5 (atomic promotion under malformed/partial/timeout/cancel), AC6 (re-import after deletion restores source-owned state without resurrecting local sentinels). Determinism: injected clock and ID generator, no wall clock, randomness, locale, network or uncontrolled I/O (`03` normative; S006 AC3) | **CLOSED** |
| DATA-B06 | Fail-closed allowlist, novel-field rejection, ordinal excluded | S010 AC1: versioned allowlist-only contract rejecting unknown fields **at every nesting level**, named novel probe `nebula_weight`, commercial families excluded, **source ordinal / retrieval rank excluded**, route provenance rejects affiliate/advertising-bound sources. Reinforced at S005 AC4/AC5 and charter access rules | **CLOSED** |
| DATA-B07 | Decouple S005 from S004 | `04` dependency table: `S005 → G1, G2`; no S004 edge. `06` prerequisites match. Wave 5 runs S005 first by WSJF 4.67, parallel to S004. Non-ownership verification moved to the G3 join, preserving the S004+S005+S006(+S007) join I required | **CLOSED — accepted stricter** (see §3.1) |
| DATA-B08 | One named runner owner; S009 re-sized; contract-level round trip | S013 is sole runner/version-source owner (AC1), consumed by S009 AC1; DoD-A item 3 names it exclusively. S009 = L/5. S009 AC2 states the round trip is contract-level schema load and canonical compare of S003 instances, **not** S006 normalization; gate test 10 matches. `02`/`04`/`06`/`07` updated together to 51 points | **CLOSED** |
| DATA-B09 | Sanitized derivative before raw destruction | `03` normative experiment boundary: Worf-approved non-personal derivative (field-presence/type/shape counts, enumerated source states, bucketed length histograms, unit/timezone observations, observed-but-unmodeled field names) produced before destruction, rare combinations suppressed; recapture requires new dated consent. S004 AC6, S006 AC2, gate test 14 | **CLOSED** |

### Recommendation dispositions

DATA-R01…R09 each carry an accept/decline disposition with a stated reason in
`07`. All nine are accepted; R01 is accepted in a bounded form that relocates the
reusable fixture security core to S013 rather than splitting S006 acceptance. I
accept that substitution: it achieves the same de-serialization benefit while
keeping S006 a single honest actual-mapping story. R02 (S001 AC6), R03 (S002
numeric ceilings), R04 (S006 AC2), R05 (S003 AC6 / S009 AC2), R06 (S003, S010
AC5), R07 (alias/`superseded_by`), R08 (S013 AC1 single version source) and R09
(S012 AC5, `05` re-scoring restrictions) are each traceable to canonical text.

### Approval conditions from `data-review.md` §8

1. **Met** — nine blockers closed with finding ID, story ID and amended text, under
   Riker's change record in `07` and the `06` change log.
2. **Met** — documents 02, 04, 06 (and 01, 07) agree. Recomputed independently:
   stories 3+5+5+5+3+5+5+3+5+2+2+3+5 = **51**; epics 16+15+13+2+5 = **51**;
   themes 21+15+15 = **51**; longest weighted chain S001→S002→S013→S009→S004→
   S006→S007→S011→S012 = **38**; inspector branch = **34**; every WSJF quotient
   and the descending WSJF→CoD→ID sort verified exact. Every prerequisite list in
   `06` matches `04`'s normative table and each story's own metadata; the graph is
   acyclic.
3. **Met** — S013 is the single named harness/test-runner enabler; S010 explicitly
   does not own it.
4. **Met** — charter item 7, S004 specific DoD and S007 specific DoD now state the
   same thing once: alpha proves **fixture** repeat-import invariance; no repeat
   live capture is claimed, and any real rerun requires new dated consent.
5. **Met** — all nine recommendations dispositioned with reasons.
6. **Met** — no trust rule weakened. No commercial, affiliate, sponsorship,
   promotional, margin, provider-preference or retrieval-ordinal signal is
   admissible; no ranker, recommendation, LLM, AI SDK or AI egress appears; no
   inferred identity field or publisher/topic/category proxy is stored; the
   annotation sentinel remains synthetic-only and is never presented as a shipped
   ratings feature.

### Architecture and performance conditions A1–A14 / P1–P5

Carried without loss. A1–A5 appear in the `05` G1 checklist; A6–A8 in the G2 row
and tests 8–12; P1–P5 in "G3 measurements and G4 decision criteria" plus S004 AC6,
S005 AC6, S006 AC6 and S007 AC1–AC2; A9–A11 in S011 AC1–AC5 and the G4 row;
A12–A14 in S012 AC1–AC4 and the G5 revalidation of tests 1–15. No performance
target, improvement or capacity claim is made anywhere from the empty baseline.

---

## 3. Findings recorded but not blocking

### 3.1 S005 is gated at G2 rather than G1

The reconciliation rejected my proposed G1 public-lookup exception and requires
G2 before any actual catalog request. The objective of DATA-B07 — removing the
false S004 edge so R03 is not discovered at the end of the personal-data spine —
is fully achieved. The residual effect is that a *runtime* catalog no-go cannot
surface before G2. I accept this deliberately stricter sequencing: catalog lookup
still crosses a network boundary and ingests untrusted text, so subordinating it
to the lifecycle gate is the safer error. The documentary rights no-go remains
available at G1 through S001 and D08, which is where most of R03's probability
mass sits. **Accepted; not a blocker.**

### 3.2 S006 retains a whole-story dependency on S004

The 38-point chain still runs through S004→S006. This is a consequence of the
R01 substitution above and is a scope diagnostic, not a defect. No action.

### 3.3 Watch items for implementation, not plan changes

- Any addition to the canonical digest exclusion list requires my review; `03`
  already states this. Enforce it.
- The measurement set (requests, pages, bytes, durations, retries, rate-limit
  spacing, cursor semantics, lookup latency, cache TTL, match ambiguity,
  normalized bytes/record, raw:normalized ratio, fixture runtime/peak memory) must
  be recorded with measured/estimated/not-applicable labels and environment. An
  unlabeled number is not a measurement.
- Digest equality is meaningless if the injected clock or ID generator is bypassed
  during a real-adapter run. Assert the injection, not only the output.

**No remaining blocker. I raise none.**

---

## 4. Final release-gate conditions

These restate conditions already written into `05-risks-and-release-gates.md`.
They add no scope; they are the items on which my later gate signatures depend.

- **G1** — runtime-neutral versioned schema and dictionary published; identity
  keys, canonical form and exclusion list published; exhaustive field-authority
  and freshness table published with the absent-timestamp rule; named ports
  defined; harness recorded as disposable and non-binding on D04/D05/D06;
  S011 comparison rules pre-registered in S001 AC6.
- **G2** — export/reload proven as a contract-level canonical compare independent
  of S006 (test 10), unknown version rejected; numeric capture and archive caps
  enforced; sanitized derivative defined and privacy-approved before any
  destruction rule is exercised.
- **G3** — full measurement table populated from the real path with labels and
  environment; S007 repeat, order, overlapping-batch and replay digests recorded
  and equal; zero duplicate logical records in every variant;
  observed-but-unmodeled source fields published; no target or improvement claimed.
- **G4** — every backend, storage and refresh conclusion cites a specific
  measurement or a documented source constraint; ports and platform-change impact
  carried into the ADR; LLM provider remains TBD with no SDK, credential or egress;
  reversal triggers stated as observable conditions.
- **G5** — allowlist tests pass including the novel unknown field and the
  retrieval-ordinal rejection; sentinel survival across identifier merge and split
  demonstrated with alias trail; a second officer reproduces the idempotency
  digests from the documented commands.
- **Standing** — any post-G2 change to route, runtime, dependencies, storage or
  egress allowlist requires re-approval before use. A failed access outcome is a
  documented no-go, never a relaxed scope.

---

## 5. Closing statement

The reconciliation added thirteen points and one identifier pair, and it added no
product capability. It converted three statements of intent into three comparable
measurements. That is the correct direction of change. I note with interest that
the plan grew by 34 percent in estimate while its critical path did not grow at
all — the added work was previously implicit, and making it explicit cost nothing
in sequence length. Humans, I understand, call this *paying attention to what was
already there*.

**Verdict: APPROVED.** No implementation, real-data activity, commit, push or
release is authorized by this signature. G0 remains pending the other three
officers and Captain acceptance of the 51-point baseline.

**Data — Lieutenant Commander, Chief Operations Officer.**
