# Dependency order, WSJF, and critical path

**Locked baseline — G0 passed on 2026-09-16; ATR-S001 is READY.**

## Scoring policy

BV/TC/RR each 1–5; CoD = BV+TC+RR; WSJF = CoD/story points.
XS=1, S=2, M=3, L=5, XL=8. No elapsed-time estimates.
Score priority: >=4 CRITICAL; >=2.5 HIGH; >=1.5 MEDIUM; otherwise LOW.
Security work and enablers blocking at least three downstream items are CRITICAL
regardless of score. Accessibility is at least HIGH and always release-blocking.
Scores are planning judgments, not measured velocity. Sort by descending exact
WSJF, descending CoD, then ID. Highest-scored **ready** work executes first;
dependencies/security/feasibility gates override score.

| ID | Title | BV | TC | RR | CoD | Size | WSJF | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ATR-S010 | Trust contract | 4 | 2 | 5 | 11 | S=2 | 5.50 | CRITICAL |
| ATR-S001 | Feasibility dossier | 5 | 5 | 5 | 15 | M=3 | 5.00 | CRITICAL |
| ATR-S011 | Architecture decision | 4 | 2 | 4 | 10 | S=2 | 5.00 | CRITICAL |
| ATR-S005 | Candidate catalog proof | 5 | 4 | 5 | 14 | M=3 | 4.67 | CRITICAL |
| ATR-S012 | Alpha decision pack | 5 | 3 | 5 | 13 | M=3 | 4.33 | CRITICAL |
| ATR-S008 | Accessible inspector | 4 | 3 | 4 | 11 | M=3 | 3.67 | HIGH |
| ATR-S002 | Consent and safe boundary | 5 | 5 | 5 | 15 | L=5 | 3.00 | CRITICAL — security |
| ATR-S004 | Approved source proof | 5 | 5 | 5 | 15 | L=5 | 3.00 | CRITICAL — dependency |
| ATR-S009 | Data lifecycle controls | 5 | 5 | 5 | 15 | L=5 | 3.00 | CRITICAL — security |
| ATR-S013 | Fixture-only secure harness | 5 | 5 | 5 | 15 | L=5 | 3.00 | CRITICAL — security/dependency |
| ATR-S003 | Evidence schema | 4 | 4 | 5 | 13 | L=5 | 2.60 | CRITICAL — dependency |
| ATR-S006 | Normalize snapshot | 5 | 3 | 5 | 13 | L=5 | 2.60 | CRITICAL — dependency |
| ATR-S007 | Repeat import safety | 4 | 3 | 5 | 12 | L=5 | 2.40 | CRITICAL — security |

Existing CoD scores retained; changed size, not inflated value, explains changed
rank. S002 expands security design; S003 defines identity/authority/grounding;
S007 adds digest/order/batch/merge/fault cases; S009 covers complete lifecycle:
each 3→5. S013 is 5 points. Total **51**, formerly 38. S010 stays 2 because it
does not own the runner or generate explanations. S008 stays 3 because it reuses
the S013 renderer and S009 controls. Estimates require final crew concurrence.

## Direct dependency contract

This table is normative and mirrored by story/backlog metadata. Gate prerequisites
are zero-point joins, not additional stories.

| Node | Direct prerequisites |
| --- | --- |
| G0 | PASSED — final crew approval and Captain baseline acceptance recorded |
| S001 | G0 |
| S002 | S001 |
| S003 | S001 |
| G1 | S001, S002, S003; approved route/permission, design and disposable runtime |
| S013 | S002, S003, G1 |
| S009 | S002, S003, S013, G1 |
| S010 | S003, S013, G1 |
| G2 | S009; Worf explicitly approves S013/S009 security tests 1–12 |
| S004 | S009, G2 |
| S005 | G1, G2 |
| S006 | S003, S004, S013 |
| S007 | S006, S009 |
| S008 | S006, S009, S013 |
| G3 | S004, S005, S006, S007; participant non-ownership attestation and actual security evidence |
| S011 | G3, S010 |
| G4 | S011; accepted ADR and dated platform threat model |
| S012 | S007, S008, S009, S010, S011, S013, G4 |
| G5 | S012; all-officer validation, risk residual and regression evidence |
| G6 | G5; explicit Captain private-release decision |

S013 owns reusable parser, normalization security core and renderer security
preflight. S009 adds lifecycle evidence, so all Worf tests 1–12 can run **before**
S004/S006/S008 without requiring their completion or using real data.
These later stories reuse and regression-test the same components; real field
mapping/final UX is not falsely claimed tested at G2. Changed code never touches
personal input until Worf reapproves its fixture evidence.

S005 no longer depends on S004. Both may execute after G2, surfacing catalog stop
risk first under WSJF. The proposed public-runtime G1 shortcut is deliberately
not taken: this reconciliation prohibits all actual source/catalog data activity
before Worf lifecycle/security clearance. Public document research remains in S001.
G3 additionally waits for S007: Data's required digest/order/batch/replay
measurements cannot remain a later G5-only requirement while S011 claims them.

## Dependency graph

```text
G0 -> S001 -> [S002 + S003] -> G1 -> S013
S013 -> [S009 + S010]
S009 -> G2 -> [S004 + S005]
S004 -> S006 -> [S007 + S008]
S004 + S005 + S006 + S007 -> G3
G3 + S010 -> S011 -> G4
S007 + S008 + S009 + S010 + S011 + S013 + G4 -> S012 -> G5 -> G6
```

The direct table, not diagram line placement, defines every edge.

## Gate-aware ready queue

| Wave | Work / single-owner ready order | Exit |
| --- | --- | --- |
| 0 | Plan reconciliation and unanimous crew/Captain sign-off | G0 passed |
| 1 | S001 | Dated public-document dossier; no account/data activity |
| 2 | S002 then S003 by WSJF; different owners may draft in parallel | G1 approved design |
| 3 | S013 | Sole shared runner/security preflight; fixtures only |
| 4 | S010 then S009 by WSJF | G2 only after lifecycle evidence and Worf approval |
| 5 | S005 then S004 by WSJF; independent approved routes can overlap with capacity | Catalog/source proof or stop |
| 6 | S006 | Normalized actual-source evidence; pre-use fixture regression |
| 7 | S008 then S007 by ready WSJF (3.67 > 2.40); separate owners may overlap | G3 waits for S007 and four-domain/security join |
| 8 | S011 | G4 accepts measured ADR, not a speculative platform |
| 9 | S012; all officers review | G5; Captain decides G6 later |

A completed investigation with failed access is STOPPED, not DONE; dependent
stories/gates remain blocked. Do not keep spending on a known no-go or silently
relax scope. Synthetic work is not a reason to select a product platform early.

## Critical path and bottleneck

Permission, actual coverage and secure custody are controlling uncertainties.
The hard-gated access spine is:

**G0 → S001 → S002/S003 → G1 → S013 → S009 → G2 →
S004 → S006 → S007 → G3 → S011 → G4.**

Catalog S005 is a mandatory parallel G3 join. S008 is a mandatory release join.
With zero-point gates, the longest weighted dependency chains are:

- S001 → S002 → S013 → S009 → S004 → S006 → S007 → S011 → S012
  = **3+5+5+5+5+5+5+2+3 = 38 points**.
- Substitute S003 for S002: also **38 points**.
- Inspector branch through S008 instead of S007/S011: **34 points**.

These are scope diagnostics, not time forecasts. G1/G2/G3 decisions may dominate
elapsed delay; Data owns most stories and cannot execute them simultaneously.
Total backlog scope is **51**, not the 38-point longest path or historical total.

## Capacity, measures and control

No velocity or date commitment. One discovery objective: evidenced go/no-go and,
only on passed gates, a reviewable private alpha. Commit at most 80% of measured
capacity; reserve 20% for unknown access/security/defect work. Carry unfinished
scope rather than waive tests. WIP: one implementing story per owner.

Track transitions/blocked reasons, attempts, defect categories, AC pass/fail and
source/normalizer measurements. No statistical or performance improvement claim
from an empty baseline. Re-score after evidence/dependency changes, Captain
direction and each PI boundary. Preserve canonical fixtures/digests, ATR-ADV-1,
trust allowlist, retention/crypto-erase/egress and accessible-flow checks in
S013's runner. S012 records exact commands; CI choice follows runtime evidence.
See [gates](05-risks-and-release-gates.md) and [consensus](07-review-consensus.md).
