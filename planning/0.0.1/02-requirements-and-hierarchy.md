# Requirements, themes, epics, and features

**Baseline:** locked alpha 0.0.1 plan; unanimously approved on 2026-09-16.
G0 passed; ATR-S001 is ready and later work remains dependency-gated. See
[final consensus](07-review-consensus.md).

## Product traceability

References below use exact section names in
[APP_DESCRIPTION.md](../../APP_DESCRIPTION.md). Planning IDs are stable aliases,
not replacements for the source text. “Slice” means the eventual requirement is
not fully delivered by alpha. Product “first release”/MVP success criteria remain
future outcomes unless explicitly included here.

| ID | Product section / requirement | Alpha disposition | Stories |
| --- | --- | --- | --- |
| ATR-PR01 | Functional Scope → 1. Audible Account Connection; Immediate Next Step | Prove permitted route with named authority; no assumed API/OAuth or credential custody | S001, S002, S004 |
| ATR-PR02 | Functional Scope → 2. Library and Listening History | Slice: narrator/series/progress granularity audit, canonical snapshot, honest unknowns | S001, S003, S004, S006, S008 |
| ATR-PR03 | Delivery Plan → Phase 0; Recommendation Strategy → Candidate Retrieval | Slice: permitted non-owned catalog metadata and availability evidence, not candidate ranking | S001, S005 |
| ATR-PR04 | Functional Scope → 6. Synchronization; source/local authority in section 2 | Slice: manual repeated snapshot import and failure safety, not continuous sync | S003, S007 |
| ATR-PR05 | Privacy and Security Requirements | Required on every surface: route authority, adversarial input, supply chain, egress, crypto-erase, consent and incident response before real data | S001, S002, S003, S004, S005, S006, S007, S008, S009, S010, S011, S012, S013 |
| ATR-PR06 | Accessibility and User Experience | Measurable consent/lifecycle/inspector flow; future rating/facet/explanation obligations carried into deferred inventory | S002, S008, S009, S012, S013 |
| ATR-PR07 | Deployment Direction; Proposed System Boundaries; Immediate Next Step | Neutral schema/ports and disposable harness; pre-registered decision rules, actual measurements before platform decision | S001, S003, S006, S011, S013 |
| ATR-PR08 | Non-Negotiable Trust Principles → No Advertising or Paid Placement | No ads or affiliates; future ranking contract and adversarial fixtures | S005, S010, S012 |
| ATR-PR09 | Non-Negotiable Trust Principles → Minimize Echo Chambers; Trust and Diversity Guardrails | Contract forbids identity inference/false balance; ranking implementation deferred | S003, S010 |
| ATR-PR10 | Provider Abstraction; LLM-Assisted Analysis; Product Goals | No model/SDK/provider choice; enforced no-AI egress; future deterministic operation cannot require AI consent | S002, S008, S009, S010, S011, S012, S013 |
| ATR-PR11 | Testing Strategy; Delivery Plan → Phase 5 | Slice: owned shared test runner, repeat/digest/failure controls, descriptive measurements and reproducible security/a11y evidence | S004, S006, S007, S009, S012, S013 |
| ATR-PR12 | Functional Scope → 3. Ratings, Preferences, and Personal Comments | Deferred user feature; synthetic annotation preservation only | S003, S007 (enablers only) |
| ATR-PR13 | Functional Scope → 4. Recommendations; Deterministic Ranking | Deferred engine/explanations; minimal relation/label contracts with synthetic grounding pointers only | S003, S005, S010 (enablers only) |
| ATR-PR14 | Functional Scope → 5. Recommendation Feedback | Deferred entirely | Future inventory D04 |
| ATR-PR15 | Library sorting/filtering/facets in section 2; Minimum Viable Product | Deferred rich navigation; minimal inspector only | S008 (slice); D02 |
| ATR-PR16 | Delivery Plan → Phase 0; Key Risks → name/branding | Working name only; region/language selected for experiment, public branding deferred | S001, S011; D08 |

`Snnn` in tables means `ATR-Snnn`. `Dnn` is a deferred inventory reference,
not a committed story ID.

## Themes and measurable outcomes

| Theme | Name | Alpha outcome |
| --- | --- | --- |
| ATR-T01 | Prove access before committing architecture | Four-domain evidence and an explicit go/no-go; no platform selected on assumption |
| ATR-T02 | Make source data inspectable and repeatable | A truthful snapshot with reproducible merge/failure behavior |
| ATR-T03 | Earn trust and retain user control | No credential leakage, accessible inspection, export/deletion, trust contracts |

These themes may span later releases, but only the following slices are committed
to the alpha baseline.

## Epics mapped to themes

| Epic | Theme | Measurable alpha result | Points | Owner |
| --- | --- | --- | --- | --- |
| ATR-E01 — Approved access evidence | ATR-T01 | Reviewed permitted route and real library/history/progress/catalog demonstration | 16 | Data; Worf owns S002 and blocks unsafe routes |
| ATR-E02 — Evidence model and repeatable snapshot | ATR-T02 | Canonical authority/identity contract, normalized snapshot, repeat/failure tests | 15 | Data |
| ATR-E03 — Private, accessible inspection | ATR-T03 | Shared pre-G2 secure harness, lifecycle controls and accessible inspector | 13 | Data implements S009/S013; Geordi owns S008; Worf gates |
| ATR-E04 — Trust boundary contract | ATR-T03 | Commercial and profiling exclusions executable as contract tests | 2 | Data |
| ATR-E05 — Evidence-led alpha decision | ATR-T01 | Architecture record and reviewed release evidence pack | 5 | Riker |

Epics are outcome containers, not extra work added on top of story estimates.

## Feature-to-story mapping (complete alpha feature inventory)

Each feature is intentionally one bounded story. Dependencies may prevent
independent execution, but each produces a separately reviewable artifact.

| Feature | Epic | Capability / artifact | Story |
| --- | --- | --- | --- |
| ATR-F01 | ATR-E01 | Source and marketplace feasibility dossier | ATR-S001 |
| ATR-F02 | ATR-E01 | Consent and safe experiment boundary | ATR-S002 |
| ATR-F03 | ATR-E02 | Evidence schema and fixture contract | ATR-S003 |
| ATR-F04 | ATR-E01 | Approved Audible capture/import proof | ATR-S004 |
| ATR-F05 | ATR-E01 | Non-owned candidate metadata proof | ATR-S005 |
| ATR-F06 | ATR-E02 | Normalized snapshot | ATR-S006 |
| ATR-F07 | ATR-E02 | Repeat import and failure isolation | ATR-S007 |
| ATR-F08 | ATR-E03 | Accessible evidence inspector | ATR-S008 |
| ATR-F09 | ATR-E03 | Prototype export, stop/disconnect, deletion | ATR-S009 |
| ATR-F10 | ATR-E04 | Recommendation trust contract, no engine | ATR-S010 |
| ATR-F11 | ATR-E05 | Evidence-led architecture decision record | ATR-S011 |
| ATR-F12 | ATR-E05 | Alpha validation and decision pack | ATR-S012 |
| ATR-F13 | ATR-E03 | Fixture-only shared secure harness and sole test runner | ATR-S013 |

There are 3 themes, 5 epics, 13 features, and 13 stories totaling **51 points**.
Theme totals: T01=21, T02=15, T03=15. Each feature has exactly one story.
F13/S013 is the only new ID pair; it separates the previously implicit shared
pre-G2 security/test infrastructure, not a product capability. S002/S003/S007/S009
each rise 3→5 points; the new enabler is 5 points (38+8+5=51).
Full story metadata is in [03-user-stories.md](03-user-stories.md);
canonical statuses and deferred inventory are in
[06-backlog-index.md](06-backlog-index.md).
