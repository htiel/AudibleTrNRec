# Alpha 0.0.1 — release charter

- **Baseline:** locked and unanimously approved, 2026-09-16
- **Release lead / Black Belt:** William Riker
- **Champion / approval authority:** Captain
- **Working name:** Audible Track and Recommend
- **Release type:** Private, single-user technical feasibility alpha
- **State:** G0 passed; ATR-S001 ready; no real-data activity or release authorized

## Problem, baseline and goal

Legal, secure, maintainable access to Audible library, history, progress and
non-owned candidate catalog metadata is unproven. No public API or OAuth flow
may be assumed. Repository baseline has product/planning documents, not an app,
test runner, CI, measured velocity or actual access evidence.
[APP_DESCRIPTION.md](../../APP_DESCRIPTION.md) remains the product authority;
its pre-existing working-tree changes are not modified by this reconciliation.

At the release decision, demonstrate one reproducible password-free approved
route, truthful data semantics and a small disposable inspector, sufficient to
make the next architecture decision. A documented **no-go is a valid investigation
outcome, not a successful alpha release**. Fixtures do not prove Audible access.
This reduces the primary adoption/rework risk without building the eventual MVP.

## Locked scope

1. Dated, cited route/permission and four-domain capability dossier, one marketplace,
   one language and one participant; documented narrator/series/progress granularity.
2. Plain-language revocable consent, incident runbook and safe experiment design.
3. Runtime-neutral versioned schema/dictionary, canonical identity/authority rules,
   synthetic adversarial/semantic fixtures and a disposable shared harness.
4. **S013 owns the test runner and shared fixture security preflight**; dependency/
   supply-chain review and **S009 lifecycle verification precede Worf's G2 approval**.
5. One actual approved library/history/progress capture/import and bounded catalog
   lookup proving at least one non-owned Audible title at the G3 join.
6. Normalized snapshot with sourced semantics, missingness and no fabricated values.
7. Manual **fixture** repeat-import/order/batch/replay tests with canonical digests
   and synthetic annotation preservation. Repeat real capture/live synchronization
   is not an alpha idempotency claim; any real rerun needs new consent/capture.
8. Accessible minimal LCARS evidence inspector, lifecycle controls and read-only
   metadata feasibility card. A separate clearly synthetic trace illustrates
   relations, not a generated explanation, rating feature or recommendation.
9. JSON export, disconnect/stop, bounded retention and crypto-erase verified across
   every app-managed location; explicit limits on provider/user-held copies.
10. Closed future recommendation evidence contract: no commercial fields or bound
    routes/retrieval rank, identity inference/proxies or unsafe false balance.
    Exact synthetic DIRECT_MATCH/EXPLORATORY/PERSPECTIVE_BROADENING validation;
    no engine, semantic diversity guarantee or LLM.
11. Evidence-led architecture decision and reproducible sanitized decision pack.

**13 features / 13 stories / 51 relative points**, not a capacity or date promise.
No new product capability was added: F13/S013 isolates previously implicit
pre-G2 shared safety work; other changes make existing criteria testable.
See [consensus](07-review-consensus.md) for the 38→51 reconciliation and decisions.
The Captain accepted this baseline after final approval from Data, Geordi,
Worf, and Wesley. Scope changes require change control and renewed review by
affected officers.

## Non-scope and platform neutrality

No full MVP, persistent book/facet ratings/comments/tags, rich library navigation,
recommendation/feedback engine, AI explanation, LLM SDK/provider/credential,
public distribution, production hosting/service, scheduled sync, cross-device,
multi-user/multi-marketplace, streaming/download/DRM, or affiliate/advertising links.
Sentinels and traces are synthetic tests, not hidden user features.

Client/framework/database/backend/hosting remain TBD until G3 evidence and G4
decision. The G1 disposable runtime choice does not bind the product. Contract,
fixtures and JSON exports exclude native runtime types; ports separate source,
catalog, normalizer, store, clock and ID generation. LLM provider stays TBD even
at G4. Useful deterministic recommendations are a future release, not this alpha.

## Access and security stop rules

Prefer documented official authorization/API, then supported export with Captain
approval and clear “import-based prototype; no automatic synchronization” labeling.
Every permission conclusion cites a dated official authority; ambiguity goes to
a qualified legal person/body named by Captain. No qualified answer means blocked.

Disqualified pending separate written technical/legal/security/maintenance review
and approved scope change: unofficial/reverse-engineered clients, undocumented
device registration/private endpoints, scraping/automation and permission inferred
from silence. Password/MFA/session-cookie collection and browser-profile extraction
are **prohibited without exception**, not candidates for a scope waiver.
Provider-rendered sign-in may use only the OS default browser or sanctioned auth
session that our process cannot observe, script, autofill or intercept. No
embedded webview/headless/automated browser or credential-handling code path.

Affiliate/Associates/advertising/revenue-sharing requirements, compulsory tracking
IDs or promotional links disqualify a catalog route even “for metadata only.”
No source-supplied URLs are fetched or activated. No personal data/screenshots in
repo/reviews; encrypted custody outside repo/cloud sync; witnesses see controls,
not content. Whole-account archives cannot be ingested wholesale; only named
Audible artifacts, with refusal before content parsing. Inseparable third-party/
household/non-Audible data is a stop condition.

**No real-data activity, source/catalog requests, real-account authorization or
personal export inspection before S009 completion and explicit Worf G2 approval.**
Public documentation research in S001 is not a runtime experiment. S005 is
decoupled from S004, but still waits for G2; this conservative resolution takes
precedence over the proposed pre-G2 public-lookup optimization.
All pre-G2 executable tests use synthetic inputs and controlled network fixtures.

No approved route or missing library/history/progress/non-owned catalog proof:
stop architecture selection/release, report no-go, or ask Captain to rebaseline.
Owned-only/mock data cannot substitute. History needs a genuine listening-history
datum (not necessarily session-level history); progress needs source position,
percentage or documented state, never guessed completion. Missing narrator/
series metadata must be measured and its impact stated, but is not an arbitrary
90% feasibility cutoff. Missing one of the four required domains does block G3.

## Critical-to-quality outcomes

| CTQ | Exact target | Measurement / owner / gate |
| --- | --- | --- |
| Evidence completeness | All four domains have dated authority and actual proof; participant confirms >=1 demonstrated catalog title non-owned | S001/S004/S005/S006; Data + Worf; G3 |
| Semantic honesty | Every schema field has authority/provenance/unknown and deterministic freshness policy; narrator/series/granularity audit complete | S003/S006; Data + Wesley; G1/G3 |
| Credential safety | Zero password/MFA/session-cookie paths; no private diagnostic/repo/report fields | Static review, category/canary tests; S013/S009; Worf; G2/G5 |
| Egress | Zero AI or nonallowlisted successful egress; inspector/normalizer/import have zero outbound requests | Enforced default-deny, recorded negative/observed-set tests; S009; Worf; G2/G3/G5 |
| Repeatability | 3 equal canonical SHA-256 fixture digests; order/overlap/replay equality; zero duplicate logical records | S003/S007; Data; G3/G5 |
| Failure/local authority | Last complete snapshot survives faults; narrator/series/book sentinels preserved or quarantined across merge/split; none resurrect after deletion | S007 fault/digest tests; Data + Worf; G3/G5 |
| User control | Versioned JSON contract round trip; stop blocks access; crypto-erase/key destruction + restart/canary inventory; withdrawal <=24h | S009; Worf + Geordi; G2/G5 |
| Retention/minimization | Raw removed at validation/session end and <=24h; normalized explicit consent <=7 days/closure; enforced numeric capture/archive caps | S002 boundary/S004 receipts; Worf; G2/G3 |
| Accessibility | Entire flow keyboard/AT operable; 320px reflow, 200% text/spacing, >=24px targets or spacing, unobscured focus, reduced motion, 4.5:1 normal text / 3:1 large text and UI | S008 AC4–10, S009 controls; Geordi; G2/G5 |
| Trust/grounding | Unknown field/route/ordinal/proxy rejected; all accepted synthetic traces resolve; labels have required evidence/safety passes | S010; Data/Worf/Wesley; G4/G5 |
| Reproducibility | Second officer repeats sanitized fixture commands/digests; no actual data in pack | S012; all officers; G5 |

No performance gain, statistical significance or capacity is claimed. Record
request/page/byte/latency/rate/retry, storage growth and fixture runtime/memory
with environment and measured/estimated labels; use these at S011.

## Delivery, ownership and control

Gate milestones, not calendar estimates: Define/reconcile G0; safe design G1;
fixture safety G2; measure/analyze G3; decision G4; verify/control G5; Captain G6.
SIPOC: official authorities/participant → permitted design and bounded source
inputs → guarded capture/normalize/test → sanitized evidence/decision → participant/Captain.
Data owns architecture/evidence, Worf security, Geordi UX/a11y, Wesley semantic
usefulness/trust, Riker coordination and scope. The controlling constraint is
approved access, not platform polish.

Reserve 20% of subsequently measured capacity; no velocity exists. Preserve
fixtures, digests, adversarial corpus, lifecycle/egress/a11y tests as guardrails.
Scope changes record reason, stable IDs, points, risks, reviewer concurrence and
Captain decision. No residual risk reduced merely because this plan names a test.
See [sequencing](04-sequencing.md) and [gates](05-risks-and-release-gates.md).
This task stops at a reconciled plan ready for final re-review: no code,
dependency installation, real-data run, commit, push or publication.
