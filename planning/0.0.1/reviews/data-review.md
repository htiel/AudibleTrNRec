# Data — G0 architecture, data model, synchronization, and performance review

**Reviewer:** Lieutenant Commander Data (architecture, data model, synchronization,
catalog normalization, recommendation pipeline, provider boundaries, performance)
**Artifact under review:** `planning/0.0.1/` (documents 01–06), baseline locked 2026-09-16
**Product source of truth:** `APP_DESCRIPTION.md` (working-tree content, unmodified)
**Review date:** 2026-09-16
**Gate:** G0 — initial design/plan review
**Scope of this document:** review findings only. The plan is not modified here.

---

## 1. Verdict

**APPROVE WITH REQUIRED CHANGES — conditional G0 sign-off.**

The baseline is structurally sound, correctly scoped as a feasibility prototype,
and does not violate any Non-Negotiable Trust Principle. I do not require a
rebaseline of themes, epics, features, or story IDs. I do require **nine blocking
corrections (DATA-B01 … DATA-B09)** before G0 is recorded as passed, because in
their current form three CTQ outcomes in `01-release-charter.md` are **not
testable as written**:

| Charter CTQ | Current testability | Cause |
| --- | --- | --- |
| Repeatability — "three identical imports produce identical logical state" | **Not testable** | No defined identity key, canonical form, or excluded-field list (DATA-B01) |
| Honest data — "every imported field has source/provenance or explicit unknown" | **Partially testable** | No source-owned vs. locally-owned authority table; freshness rules referenced but never specified (DATA-B02) |
| Trust — "commercial inputs rejected by contract" | **Testable but bypassable** | Contract validation is specified as rejection of named commercial fields, not as a fail-closed allowlist (DATA-B06) |

My assessment of the four validation questions posed to this review:

| Question | Finding |
| --- | --- |
| Remains a realistic feasibility prototype? | **Yes**, with one estimate defect. Non-scope in `01-release-charter.md` is explicit and correct; no ranker, no LLM, no production sync. ATR-S009 is under-pointed and carries undeclared test-infrastructure scope (DATA-B08). |
| Platform and LLM neutral? | **Yes in intent; not yet enforced.** D04–D07 remain TBD and ATR-S011 AC3/AC4 protect the sequence. The evidence contract is not yet required to be expressed in a runtime-neutral form, so the disposable harness can silently become the platform decision (DATA-B03). |
| Safe for local ratings/annotations? | **Yes in principle; incomplete in coverage.** The synthetic sentinel is correctly separated from source-owned fields, but no fixture exercises a catalog **identifier merge or split**, which is the exact failure `APP_DESCRIPTION.md` §3 requires to be survivable (DATA-B04). |
| Testably idempotent? | **Not yet.** Identical-input repetition is necessary but insufficient; ordering, batch-boundary, resume, and re-import-after-delete cases are absent, and determinism of the normalizer is not constrained (DATA-B01, DATA-B05). |

No finding below requires adding a product feature, a ranking engine, an AI
provider, or a platform commitment to alpha 0.0.1.

---

## 2. Strengths

1. **The gate spine is correct.** G0 → S001 → S002/S003 → G1 → S009 → G2 → S004 is
   the right ordering: permission, then boundary, then contract, then safety
   controls, and only then real personal data. Placing ATR-S009 *before* G2 and
   before ATR-S004 is the single best decision in this plan. Most feasibility
   prototypes capture first and build deletion later; this one cannot.
2. **Evidence-verdict vocabulary is disciplined.** `documented-not-tested` /
   `proven` / `partial` / `unavailable` / `unknown` (S001 AC2) plus S004 AC3
   ("a fixture success cannot mark actual access `proven`") removes the most
   common failure of feasibility work: mock-driven false confidence.
3. **Source-owned and locally-owned data are separated at schema definition time**
   (S003 AC3), not retrofitted. This is the correct point to introduce the
   distinction and it directly serves `APP_DESCRIPTION.md` §2 authority rules.
4. **Trust rules are made executable rather than aspirational** (S010 AC2–AC5),
   and the plan honestly labels them *contract* tests rather than ranking-invariance
   proofs. The statement "no ranker exists" in S010 AC3 is precisely the kind of
   claim discipline I expect.
5. **Non-scope is explicit and load-bearing.** The note that the annotation
   sentinel "is not a shipped ratings/comments feature" closes the usual path by
   which an MVP feature enters an alpha through a test fixture.
6. **Normalizer isolation is stated** (S006 AC5: no framework or provider-specific
   types in the evidence contract). This is the correct boundary rule.
7. **No performance or quality superiority is claimed from an empty baseline**
   (charter, CTQ section; S006 specific DoD). Correct. There is no baseline.
8. **Commercial and profiling items are marked prohibited, not deferred**
   (`06-backlog-index.md`). Deferral implies eventual admission; prohibition does not.

---

## 3. Blocking requirements

Each must be closed before G0 is recorded as passed. All are specification or
sequencing corrections; none adds product capability.

### DATA-B01 — Idempotency is asserted but not defined; ATR-S007 AC1 is currently unfalsifiable

`ATR-S007` AC1 requires "equal logical normalized state and counts, excluding
operational attempt timestamps." Nothing in `ATR-S003` defines:

- the **stable identity key** for a book, edition, person, facet, series, library
  entry, history datum, or progress datum, or its derivation precedence when the
  preferred source identifier is absent;
- the **canonical serialization** used for the equality comparison (key ordering,
  numeric representation, Unicode normalization form, collation, timezone form);
- the **explicit exclusion list** of volatile/operational fields.

Without all three, "equal logical state" is a human judgement, and the charter's
Repeatability CTQ cannot produce a pass/fail. **Required:** ATR-S003 must define
identity keys, a canonical form, and the exclusion list; ATR-S007 must compare a
canonical-form digest, not an informal inspection.

### DATA-B02 — Field-level authority and freshness rules have no specification home

`ATR-S007` AC2 relies on "documented freshness rules," and `APP_DESCRIPTION.md` §2
makes source/local authority a product invariant. No story owns that document.

**Required:** ATR-S003 must add a field-level authority table covering, for every
schema field: owner (`source` | `local` | `derived` | `operational`), update rule
on re-import, and behaviour when the **source update timestamp is absent, equal,
or older than the retained value**. The absent-timestamp case is the dangerous one
and is currently unaddressed: an import with no source timestamp must have a
single specified outcome (I recommend: retain, quarantine for review, and never
silently overwrite). Progress regression rules must state whether position is
treated as monotonic and what happens on a legitimate restart from zero.

### DATA-B03 — Platform neutrality is asserted but not structurally enforced

The charter permits a disposable harness after G1 and states it "does not select
the product platform." However, if the evidence contract, fixtures, and export
format are expressed in harness-native types, the harness becomes the de facto
platform decision before G4, which is exactly risk R11.

**Required:** ATR-S003 must state that the evidence contract is defined in a
runtime-neutral, machine-readable form (a versioned JSON Schema or equivalent plus
a written data dictionary), that fixtures and the ATR-S009 export are instances of
that schema, and that harness-native types are an implementation detail that may
not appear in the contract, fixtures, or export. This is the cheapest available
insurance against R11 and preserves the platform-neutral boundary demanded by
`APP_DESCRIPTION.md` → Proposed System Boundaries.

### DATA-B04 — No fixture exercises catalog identifier merge or split

`APP_DESCRIPTION.md` §3 requires: "If a catalog merge changes an author, narrator,
series, or genre identifier, existing feedback must be safely reconciled rather
than discarded." ATR-S003 AC4 and ATR-S007 AC3 cover ambiguity and missing records,
but **not** the case where a previously seen identifier is replaced, merged into
another, or split into two on a later capture. That is the specific event that
destroys locally owned user data in real catalog systems.

**Required:** add merge and split fixtures to ATR-S003, and extend ATR-S007 AC3 so
a synthetic annotation attached to a facet or person identifier survives an
identifier merge and an identifier split with a recorded alias/provenance trail.
A "cannot reconcile" outcome is acceptable in alpha **only** if it quarantines and
preserves the annotation; silent loss or silent re-pointing is not.

### DATA-B05 — Idempotency coverage is too narrow, and normalizer determinism is unconstrained

Three identical runs of one identical file is the weakest idempotency test that
can be written. Real duplication arises from ordering and boundaries.

**Required — ATR-S007 must add:**
1. **Order invariance:** the same record set in a different order yields an equal
   canonical digest.
2. **Batch/pagination boundary:** the same logical set delivered as one batch and
   as several overlapping batches yields an equal digest and zero duplicates.
3. **Partial-then-complete replay:** an interrupted import followed by a full
   re-import yields the same digest as a single clean import.
4. **Re-import after deletion:** re-importing after ATR-S009 deletion recreates
   source-owned state without resurrecting deleted local annotations.

**Required — ATR-S003/ATR-S006 must constrain determinism:** the normalizer takes
time and identifier generation as injected dependencies, performs no wall-clock,
random, locale-, or environment-dependent behaviour, and emits UTC with an explicit
Unicode normalization form and a fixed collation. An idempotency test over a
non-deterministic normalizer measures nothing.

### DATA-B06 — Trust contract validation must be a fail-closed allowlist, not a rejection of named commercial fields

`ATR-S010` AC2 enumerates advertising, sponsorship, affiliate value, promotional
priority, retailer margin, and provider preference. A denylist of names is defeated
by renaming a field. `APP_DESCRIPTION.md` states paid recommendation must be
"impossible by design, not merely prohibited by policy."

**Required:** ATR-S010 AC1/AC2 must specify allowlist-only validation — any field
not in the versioned evidence allowlist is rejected — plus a test proving that an
**arbitrary, novel, non-commercially-named unknown field** is rejected. Additionally,
the **source result ordinal / retrieval rank** from any catalog lookup must be
explicitly named as non-evidence and excluded from the allowlist: a sponsored-first
source ordering leaks commercial influence through position even after commercial
fields are stripped. This is a genuine channel and it is currently open.

### DATA-B07 — ATR-S005 is serialized behind ATR-S004 without a data dependency, deferring the plan's second-largest stop risk to the latest possible moment

`06-backlog-index.md` lists ATR-S005 prerequisites as "S004, approved catalog route
at G1/G2," and `04-sequencing.md` places it in Wave 5. Catalog lookup for a
**non-owned** title uses no personal data and no captured library content. R03
(catalog access/rights unavailable, RPN 192) is a G3 stop condition; the current
sequence discovers it only after the entire personal-data spine has been built.

**Required:** decouple ATR-S005 from ATR-S004. Its prerequisite is G1 catalog-route
approval (and G2 only if the route touches personal data, which it should not).
It may then run in parallel with ATR-S009/ATR-S004. G3 still joins S004 + S005 +
S006 — that join is correct and must not be relaxed. This surfaces a stop condition
earlier at zero added scope and removes a false edge from the critical path.

### DATA-B08 — ATR-S009 carries undeclared test-infrastructure scope and is under-pointed; harness ownership is ambiguous

ATR-S009 AC1 says the test runner is "introduced by the first executable increment
(**S010 or this story**)." Two candidate owners means neither owns it, and DoD-A
item 4 explicitly states test infrastructure is absent and must be introduced.
ATR-S009 additionally implies a storage layer, encryption at rest, secret handling,
a network allowlist, log redaction, a versioned export **and a reimport path**, a
deletion sweep across an inventory, and canary assertions — at M = 3 points, the
same size as writing the ATR-S001 dossier.

**Required:**
1. Name exactly one story as the harness/test-runner enabler. I recommend
   **ATR-S010** (smaller, fixture-only, no personal data, already first in WSJF
   order) and that ATR-S009 consume it.
2. Re-size ATR-S009 to **L = 5** or split the harness/storage enabler into a new
   story ID (do not reuse a retired ID). Update the 38-point total, the WSJF table,
   the roll-ups, and the critical-path arithmetic together.
3. ATR-S009 AC2 requires an export/reimport round trip. State explicitly whether
   that reimport uses the ATR-S006 normalizer (which does not exist yet at G2) or a
   contract-level load/compare of ATR-S003 instances. It must be the latter, or
   ATR-S009 duplicates ATR-S006.

### DATA-B09 — Raw-capture retention rule conflicts with reproducibility and defect diagnosis

ATR-S002 AC5 requires raw test captures to be removed after validation and before
the session ends. ATR-S004 AC2 requires recorded field semantics and missingness,
ATR-S006 AC1 requires retained raw source semantics, and ATR-S012 AC2 requires
another officer to reproduce the workflow. Once the raw capture is destroyed, a
normalization defect discovered later cannot be diagnosed or re-derived, and a
second consented capture becomes mandatory.

**Required:** define a **sanitized derivative** that survives raw destruction —
field-presence counts, type/shape observations, enumerated source state values,
value-length histograms, and unit/timezone observations, with **no personal field
values** — produced before the raw capture is deleted. State plainly that
re-running against real data requires a new consented capture. Worf owns the
privacy envelope of this derivative; I own its sufficiency for the ATR-S011 decision.

---

## 4. Non-blocking recommendations

| ID | Recommendation | Rationale |
| --- | --- | --- |
| DATA-R01 | Split ATR-S006 acceptance: ACs implementable on ATR-S003 fixtures may begin after ATR-S003; only the real-source field-mapping and reconciliation ACs require ATR-S004. | Removes a false serialization on the 25-point chain without changing scope or IDs. |
| DATA-R02 | Pre-register the ATR-S011 decision rules in ATR-S001 (e.g., "token refresh requiring a confidential client ⇒ backend required"; "server-side rate limiting ⇒ centralized scheduler"). | Prevents post-hoc rationalization of a platform already chosen by harness convenience. Two points of decision work cannot also invent its own criteria. |
| DATA-R03 | Bound the alpha capture explicitly (maximum library items, maximum catalog lookups, maximum retained bytes). | Data minimization and bounded measurement. Unbounded capture is both a privacy and a measurement defect. |
| DATA-R04 | Record the count and names of **source fields observed but not modeled** in ATR-S006. | The most valuable schema-evolution signal available from a one-shot capture, and it is free. |
| DATA-R05 | Add schema-version handling to the ATR-S009 export: version field present, unknown/newer version rejected rather than best-effort parsed. | Fail-closed is the correct default for a contract that will outlive the harness. |
| DATA-R06 | Extend ATR-S010 AC5 to prohibit **proxy variables** for viewpoint (publisher/imprint, topic cluster, or category used as an ideology stand-in), and list it in the deferred test inventory. | Direct-field prohibition without proxy prohibition reproduces the profiling harm through a permitted column. |
| DATA-R07 | Add a `superseded_by` / alias relation to the ATR-S003 provenance model when DATA-B04 is addressed. | Merge reconciliation is impossible without a durable alias trail; defining it now costs one field. |
| DATA-R08 | Name a single version source of truth when the harness is created; do not copy `0.0.1` into multiple files. | Duplicated version constants drift. I have observed this failure mode repeatedly. |
| DATA-R09 | In ATR-S012, record that R08/R09 residual RPN reductions are **scope-limited** (justified only by the absence of a ranker) and must be reopened in full before any ranking increment. | `05-risks-and-release-gates.md` says this in prose; the residual table should carry it so a future reader cannot mistake it for a mitigated risk. |

---

## 5. Exact proposed changes by story / feature ID

Proposals only. Riker applies them under baseline change control; IDs are not reused.

### ATR-S003 / ATR-F03 — Evidence schema
- **Add AC6 (DATA-B01):** define stable identity keys and derivation precedence for
  book, edition, person, role, series, facet, library entry, history datum, and
  progress datum; define the canonical serialization (key order, numeric form,
  Unicode normalization form, UTC timestamps, fixed collation) used for logical
  equality; publish the explicit excluded-field list (operational attempt/capture
  timestamps, run identifiers, sequence counters).
- **Add AC7 (DATA-B02):** field-level authority table — owner
  (`source` | `local` | `derived` | `operational`), re-import update rule, and
  behaviour for absent / equal / older source update timestamps; progress
  monotonicity policy and legitimate-restart handling.
- **Amend AC1 (DATA-B03):** contract expressed as a versioned runtime-neutral schema
  plus data dictionary; harness-native types prohibited in contract, fixtures, and export.
- **Amend AC4 (DATA-B04):** add identifier-merge and identifier-split fixtures.
- **Add AC8 (DATA-B05):** normalizer determinism contract — injected clock and
  identifier generation; no random, locale, or environment dependence.
- **Add (DATA-R07):** `superseded_by` / alias provenance relation.

### ATR-S006 / ATR-F06 — Normalized snapshot
- **Amend AC5:** name the ports explicitly — source adapter, catalog adapter,
  normalizer, store, clock, identifier generator — and state that no adapter type
  crosses the evidence-contract boundary in either direction.
- **Add AC6 (DATA-R04):** report observed-but-unmodeled source fields (names and counts).
- **Amend the specific DoD (§7 gates):** add the measurement set listed below.
- **Amend prerequisites (DATA-R01):** fixture-satisfiable ACs depend on ATR-S003;
  real-mapping ACs depend on ATR-S004.

### ATR-S007 / ATR-F07 — Repeat import
- **Amend AC1 (DATA-B01):** compare a canonical-form digest of logical state, not an
  informal comparison; record the digest in the evidence pack.
- **Add AC6 (DATA-B05):** order invariance; batch/pagination boundary and overlap;
  partial-then-complete replay; re-import after deletion.
- **Amend AC3 (DATA-B04):** the synthetic annotation sentinel must also survive an
  identifier merge and an identifier split, preserved or quarantined — never lost
  and never silently re-pointed.
- **Amend AC2 (DATA-B02):** cite the ATR-S003 authority table as the normative source
  of freshness behaviour, including the absent-timestamp case.
- **Consider (charter item 7):** the charter scopes "user-triggered repeat capture/import."
  ATR-S007 tests fixtures only. Either state that repeat-capture idempotency against the
  real source is out of scope for 0.0.1, or add a single witnessed second capture to
  ATR-S004. Do not leave the charter and the story disagreeing.

### ATR-S004 / ATR-F04 — Approved source proof
- **Add AC6 (performance gate):** record request/page counts, bytes transferred,
  observed rate-limit signals, per-page and total wall-clock duration, retry counts,
  and any pagination cursor semantics. These are the primary quantitative inputs to
  ATR-S011; without them the architecture decision is qualitative.
- **Amend AC5 (DATA-B09):** produce the sanitized derivative before raw-capture destruction.
- **Consider (DATA-R03):** state the bounded capture size.

### ATR-S005 / ATR-F05 — Catalog proof
- **Amend prerequisites (DATA-B07):** depends on G1 catalog-route approval, not ATR-S004.
  G3 continues to require S004 + S005 + S006 jointly.
- **Add AC6 (performance gate):** record per-lookup latency, rate limits, permitted
  cache TTL, and identifier-match success/ambiguity counts.
- **Amend AC4 (DATA-B06):** explicitly exclude the source result ordinal / retrieval
  rank from the candidate contract as non-evidence.

### ATR-S009 / ATR-F09 — Lifecycle controls
- **Amend AC1 (DATA-B08):** remove the "S010 or this story" ambiguity; consume the
  harness introduced by the named enabler story.
- **Amend AC2 (DATA-B08):** state that the export round trip is a contract-level
  load/compare of ATR-S003 instances, independent of the ATR-S006 normalizer.
- **Add (DATA-R05):** export schema version present; unknown version rejected.
- **Re-size to L = 5**, or split the harness/storage enabler into a new story ID, and
  update `02`, `04`, and `06` totals and the critical-path arithmetic together.

### ATR-S010 / ATR-F10 — Trust contract
- **Amend AC2 (DATA-B06):** fail-closed allowlist validation; unknown fields rejected.
- **Add AC7 (DATA-B06):** test that an arbitrary, novel, non-commercially-named field
  is rejected; and that source result ordinal is not admissible evidence.
- **Amend AC5 (DATA-R06):** prohibit proxy variables for viewpoint inference and add
  proxy-leakage checks to the deferred test list.
- **Confirm as the harness enabler** if DATA-B08 is resolved as recommended.

### ATR-S011 / ATR-F11 — Architecture decision
- **Amend AC1:** require the ATR-S004/ATR-S005 measurements and the ATR-S006 fixture
  measurements to appear as named inputs, each labeled measured or estimated.
- **Add AC6 (DATA-R02):** evaluate against decision rules pre-registered in ATR-S001.
- **Amend AC2:** require the named port list from ATR-S006 AC5 to be carried into the
  proposed architecture, with a statement of which ports a platform change would affect.

### ATR-S012 / ATR-F12 — Decision pack
- **Add to AC3:** publish the canonical-state digests from ATR-S007 and the measurement
  table below so a reviewer can re-derive repeatability rather than trust a claim.
- **Add to AC4 (DATA-R09):** mark R08/R09 residuals scope-limited and reopened-on-ranking.

### ATR-S001 / ATR-F01, ATR-S002 / ATR-F02
- **ATR-S001 (DATA-R02):** add pre-registered architecture decision rules.
- **ATR-S002 (DATA-B09, DATA-R03):** reconcile the raw-destruction rule with the sanitized
  derivative; state bounded capture limits.

---

## 6. Missing acceptance criteria, tests, and measurements

### Missing tests
| # | Missing test | Story | Finding |
| --- | --- | --- | --- |
| 1 | Canonical-digest equality across repeated imports | S007 | B01 |
| 2 | Record-order invariance | S007 | B05 |
| 3 | Batch/pagination boundary and overlapping-batch duplication | S007 | B05 |
| 4 | Interrupted-then-complete replay equals clean import | S007 | B05 |
| 5 | Re-import after deletion (source-owned restored; local annotations not resurrected) | S007/S009 | B05 |
| 6 | Identifier merge and split with annotation survival | S003/S007 | B04 |
| 7 | Absent / equal / older source timestamp update behaviour | S003/S007 | B02 |
| 8 | Unknown-field rejection by allowlist, using a novel non-commercial name | S010 | B06 |
| 9 | Source result ordinal rejected as evidence | S005/S010 | B06 |
| 10 | Export schema version unknown ⇒ rejected | S009 | R05 |
| 11 | Normalizer determinism: two runs, injected fixed clock, identical output | S006 | B05 |

### Missing measurements
All are measurements, not targets. No target may be set from an empty baseline.

| Measurement | Story | Purpose |
| --- | --- | --- |
| Request count, page count, bytes transferred per capture | S004 | Sync cost model; backend-necessity input to S011 |
| Observed rate-limit signals and minimum safe request spacing | S004/S005 | Determines whether refresh needs centralized scheduling |
| Per-page and total capture wall-clock | S004 | Feasibility of foreground/manual refresh on a client |
| Retry count and backoff behaviour actually exercised | S004 | Validates bounded-retry claim |
| Catalog lookup latency, permitted cache TTL, identifier-match ambiguity rate | S005 | Candidate-retrieval cost and match-quality floor |
| Normalized bytes per record and per 100 library entries; raw:normalized ratio | S006 | Storage growth for D05 |
| Fixture size, run duration, peak memory, environment (already specified) | S006 | Retained as-is; correct |
| Count of observed-but-unmodeled source fields | S006 | Schema evolution and honest coverage |
| Canonical digest of logical state per repeat run | S007 | Repeatability evidence |

### Missing acceptance criteria
Enumerated in §5. The largest single gaps are the field-level authority table
(DATA-B02) and the identity/canonical-form definition (DATA-B01); both belong in
ATR-S003 and both are prerequisites for ATR-S007 being a real test.

---

## 7. Architecture and performance gates

I request these be recorded as Data-owned conditions inside the existing gates.
No new gate is proposed.

**G1 — architecture conditions**
- A1. Evidence contract is runtime-neutral and versioned; harness types excluded (B03).
- A2. Identity keys, canonical form, and excluded-field list published (B01).
- A3. Field-level authority and freshness table published (B02).
- A4. Named ports defined: source adapter, catalog adapter, normalizer, store, clock,
      identifier generator; no adapter type crosses the contract boundary.
- A5. Harness explicitly recorded as disposable and non-binding on D04/D05/D06.

**G2 — safety conditions (Worf leads; Data validates implementation)**
- A6. Export is a contract-level artifact independent of the not-yet-existing normalizer (B08).
- A7. Bounded capture limits recorded (R03).
- A8. Sanitized derivative defined before any raw-destruction rule is exercised (B09).

**G3 — measurement conditions**
- P1. The §6 measurement table is populated with real-path values, each labeled measured
      or estimated, with environment recorded.
- P2. Repeat/order/boundary/replay digests recorded and equal.
- P3. Zero duplicate logical records across every repeat variant.
- P4. Observed-but-unmodeled source field list published.
- P5. No performance target or improvement is claimed; measurements are descriptive only.

**G4 — decision conditions**
- A9. Backend-necessity, storage-boundary, and refresh-model conclusions each cite a
      specific measurement or a documented source constraint (no unsupported assertions).
- A10. LLM provider remains TBD; no SDK, credential, or egress path introduced.
- A11. Reversal triggers stated as observable conditions, not intentions.

**G5 — control conditions**
- A12. Trust-contract allowlist tests, including the novel-unknown-field case, pass (B06).
- A13. Annotation survival across merge/split demonstrated (B04).
- A14. Idempotency digests reproduced by a second officer from documented commands.

---

## 8. Approval conditions

My G0 sign-off converts from PENDING to APPROVED when all of the following hold:

1. DATA-B01 … DATA-B09 are closed in the plan documents, each with a finding ID,
   affected story ID, the amended criterion text, and Riker's change-control record.
2. `02-requirements-and-hierarchy.md`, `04-sequencing.md`, and `06-backlog-index.md`
   are updated **together** for the ATR-S009 re-size and the ATR-S005 dependency
   change, including the 38-point total, WSJF entries, roll-ups, dependency graph,
   wave table, and critical-path arithmetic. A plan whose four documents disagree
   about totals is worse than a plan with the wrong total.
3. Exactly one story is named as the harness/test-runner enabler.
4. The charter's repeat-capture wording and ATR-S007's fixture-only scope are reconciled
   in one direction and stated once.
5. Non-blocking items DATA-R01 … DATA-R09 receive an accept/decline disposition with a
   recorded reason. Declining is acceptable; ignoring is not.
6. No trust rule is weakened in the course of applying these changes. Specifically:
   no advertising, sponsorship, affiliate, promotional, margin, provider-preference, or
   retrieval-ordinal signal enters any contract; no ranker, no recommendation, no LLM,
   and no AI egress appears in 0.0.1; no inferred political or sensitive identity field
   or proxy is stored; and the annotation sentinel remains synthetic-only and is never
   presented as a shipped ratings feature.

Until conditions 1–4 are satisfied, ATR-S003, ATR-S006, and ATR-S007 are not
implementation-ready, and the Repeatability CTQ cannot be evaluated.

A closing observation. The plan spends 38 points to answer one question — whether a
legal, safe, maintainable path to this data exists — and refuses to build anything that
would be discarded if the answer is no. I find that economical. It is, I believe, what
humans call *not putting the cart before the horse*. My contribution is narrower: three
of its stated outcomes are currently statements of intent rather than measurements, and
intent cannot be compared across two runs.

**Verdict: APPROVE WITH REQUIRED CHANGES.**
**Data — Lieutenant Commander, Chief Operations Officer.**
