# Alpha 0.0.1 — final review consensus

- **Prepared:** 2026-09-16, William Riker
- **Disposition:** Unanimously approved and locked planning baseline
- **G0:** PASSED 2026-09-16 — ATR-S001 ready; no real-data authorization
- **Scope:** Bounded planning reconciliation only; no commit, push or publication

## Source record and disposition vocabulary

Read the current [product brief](../../../APP_DESCRIPTION.md),
[planning README](../../README.md) and all six canonical plan documents, plus all
four original reviews. Reviews remain unchanged:

- [Data](reviews/data-review.md): conditional approval with nine required blockers.
- [Geordi](reviews/geordi-review.md): conditional approval with seven blockers.
- [Worf](reviews/worf-review.md): security approval withheld; fourteen blockers.
- [Wesley](reviews/wesley-review.md): conditional approval; three blockers and
  five final-approval conditions including the metadata card and crew signatures.

**Reconciled** below means exact requirements are now in the canonical plan,
not that implementation tests passed. Final officer approval is recorded in
the sign-off documents. **Accepted/bounded** retains
the objective while resolving conflicting scope or sequencing; reason is explicit.
**Deferred/rejected** is not omitted work disguised as approval.
Every disposition was re-reviewed by its originating officer. No original
conditional review was silently converted to approval.

Canonical implementation acceptance lives in [detailed stories](03-user-stories.md),
including the S003 normative evidence contract and S002 normative experiment
boundary. Evidence gates live in [risks/gates](05-risks-and-release-gates.md).
Owners in the tables implement/reconcile the requirement; the named review's
officer confirms closure. All evidence named below is **required future evidence**.

## Change-control decisions and revised inventory

| Decision | Resolution / reason | Impact / authority still required |
| --- | --- | --- |
| Shared G2 preflight cycle | Add **ATR-F13 / ATR-S013**, sole harness/test-runner owner. Shared guarded parser, normalization security core and inert renderer are fixture-tested before S009/G2; S004/S006/S008 reuse and revalidate final mapping/UI | Only new ID pair; 5 points in E03/T03. Approved by Data, Worf, and Geordi |
| Lifecycle estimate | S009 3→5; complete crypto-erase, containment, egress and consent validation, independent contract JSON reload, not premature S006 normalization | +2 E03; approved by Data and Worf |
| Other underestimates | S002 3→5 for security/consent/incident/archive design; S003 3→5 for canonical authority/identity/grounding/corpus; S007 3→5 for digest/order/batch/replay/merge/split/fault coverage | +6 points, no new user feature; approved by Riker and crew |
| Catalog serialization | Remove S004 prerequisite from S005. S005 depends on G1/G2 and may precede S004, with private non-ownership verification at G3 | No point change. Stronger than Data's proposed G1 public-runtime shortcut: all actual source/catalog data activity waits for Worf G2 |
| G3 measurement join | Add S007 to existing S004/S005/S006 join so Data's G3 digests/repeat evidence precede S011 | No scope duplication; critical-path and wave updates |
| Repeat-capture ambiguity | Alpha proves repeat **fixture import**, not repeat live capture or continuous synchronization | Charter/S004/S007 now agree; real rerun requires new dated consent/capture |
| No semantic scope creep | Evidence graph is a minimal relation schema and synthetic fixtures/card, not a graph database, ranker or explanation generator | S010 stays 2 points, S008 stays 3 through shared renderer/control reuse |
| Approval language | Reconciled candidate only; G0 needs explicit final crew re-review and Captain revised-baseline acceptance | No claim of final approval, successful release or runtime validation |

### Revised arithmetic

| Story | Previous points | Revised points | Reason |
| --- | --- | --- | --- |
| ATR-S001 | 3 | 3 | Dated discovery dossier |
| ATR-S002 | 3 | 5 | Explicit security/lifecycle design and incident response |
| ATR-S003 | 3 | 5 | Canonical/authority/identity/trace/corpus contract |
| ATR-S004 | 5 | 5 | Bounded actual proof reusing shared security core |
| ATR-S005 | 3 | 3 | Bounded catalog proof, no bulk narrator harvest |
| ATR-S006 | 5 | 5 | Actual-source mapping and measurement, shared safety reused |
| ATR-S007 | 3 | 5 | Expanded deterministic and preservation suite |
| ATR-S008 | 3 | 3 | Minimal inspector/card; existing safe renderer/controls reused |
| ATR-S009 | 3 | 5 | Complete fixture lifecycle and G2 evidence |
| ATR-S010 | 2 | 2 | Contract-only validation, runner not owned here |
| ATR-S011 | 2 | 2 | Evidence-led ADR, no platform implementation |
| ATR-S012 | 3 | 3 | Reproduce/assemble existing evidence, not invent tests late |
| ATR-S013 | — | 5 | Sole shared secure harness/test-runner enabler |
| **Total** | **38** | **51** | **+8 resizing +5 isolated enabler = +13** |

3 themes / 5 epics / **13 features / 13 stories**. Epic points:
E01=16, E02=15, E03=13, E04=2, E05=5 (sum 51).
Theme points: T01=21, T02=15, T03=15 (sum 51).
All IDs S001–S012/F01–F12 retained; only S013/F13 added, no renumbering.
At reconciliation, execution was blocked by G0. Final sign-off subsequently
passed G0; ATR-S001 is now READY and zero implementation is completed.

Longest gate-expanded weighted chains:
S001 → S002 **or S003** → S013 → S009 → S004 → S006 → S007 →
S011 → S012 = **38 points**. Inspector branch = **34 points**.
This is not duration or total capacity. Total backlog = 51, not historical 38.
WSJF recalculated using unchanged CoD scores and revised sizes; security/
dependency overrides explicit. Reserve 20% of measured capacity; velocity unknown.

## Data — every named blocker

| Finding | Disposition and canonical acceptance | Owner / verification |
| --- | --- | --- |
| DATA-B01 | Reconciled: S003 AC1/3 and identity/canonical section define source-key precedence, ambiguity, JSON ordering/numbers/NFC/UTC, explicit volatile exclusions; S007 AC1/2 compare SHA-256 canonical digests | Data; G1 contract, G3/G5 repeated digests |
| DATA-B02 | Reconciled: S003 AC2 and normative field authority table classify every field; absent retains/quarantines conflict, equal conflict quarantines, older retained; progress decrease requires evidenced newer restart, never blanket monotonicity | Data; S007 AC3 freshness/restart fixtures |
| DATA-B03 | Reconciled: versioned JSON Schema/dictionary, fixtures/exports instances, no harness-native types; named ports and disposable runtime not product selection | Data; S003/S013/G1, S009 export/G2 |
| DATA-B04 | Reconciled: merge/split/alias/superseded_by corpus and person/facet/narrator/series sentinels preserve or quarantine old links, never silent repoint/loss | Data; S003 AC4, S007 AC4/6; G3/G5 |
| DATA-B05 | Reconciled: injected clock/ID, fixed collation/NFC/UTC; three runs, reordering, overlapping batches, partial→complete replay, deletion→reimport without local resurrection | Data; S006 AC3, S007 AC1–6; G3/G5 |
| DATA-B06 | Reconciled: closed schema at every nesting level, novel `nebula_weight` rejection, source ordinal/retrieval rank non-evidence, route provenance rejects commercial obligations | Data/Worf; S005 AC4/5, S010 AC1/4; G4/G5 |
| DATA-B07 | Accepted with stricter gate: remove S004 edge; S005 can run first after G2. No G1 runtime lookup exception because Captain requires no real-data activity before lifecycle/security gates. Non-owned verification moved to G3 participant join | Data/Worf; S005 AC1 and sequence/gates; final re-review must confirm stronger sequencing |
| DATA-B08 | Reconciled via explicitly permitted split alternative: S013 sole runner/shared preflight; S009 L=5 consumes it. S009 AC2 round trip is schema load/canonical compare, not not-yet-existing S006 normalizer | Data; 51-point roll-ups/WSJF/path updated, G2 evidence |
| DATA-B09 | Reconciled: S002 normative derivative privacy envelope and S004 AC6 create counts/shapes/source-state enumeration/bucketed lengths/units/timezones before raw destruction; no personal values, rare combinations suppressed. New real run needs new consent/capture | Data sufficiency + Worf privacy; G2 design, G3 receipt |

### Data recommendations and additional gate requests

| Recommendation | Disposition / canonical location / reason |
| --- | --- |
| DATA-R01 | Accepted in bounded form: move reusable fixture security core to S013 before G2; keep S006 a complete actual-mapping story rather than ambiguous half-DONE dependencies. Removes unsafe late preflight without building full normalization before feasibility |
| DATA-R02 | Accepted: S001 AC6 pre-registers criteria; S011 AC1/2 applies them with evidence. Rate limits inform scheduling but alone do not prove backend necessity |
| DATA-R03 | Accepted: S002 normative numeric caps for entries/history/requests/bytes/runtime/archive expansion; S004/S005 enforce; increases need reviewed rebaseline |
| DATA-R04 | Accepted: S006 AC2 observed-but-unmodeled field names/counts via Worf derivative filter; dynamic/personal field names suppressed |
| DATA-R05 | Accepted: S003/S009 versioned JSON; unknown/newer schema version fails closed |
| DATA-R06 | Accepted: S003/S010 prohibit publisher/imprint/topic/category ideological proxies; D04 proxy-leakage suite required |
| DATA-R07 | Accepted: S003 alias/superseded_by provenance and S007 merge/split preservation |
| DATA-R08 | Accepted: S013 AC1 owns one release-version source, not copied constants; concrete file chosen with runtime at G1 |
| DATA-R09 | Accepted: S012 AC5 and residual rules mark R08/R09 alpha-contract-only and reopen before ranking |

Data's additional architecture/performance conditions A1–A14/P1–P5 are carried
into G1 neutral schema/identity/authority/ports/disposability; G2 contract reload,
caps and derivative; G3 complete descriptive measurement table, S007 digest/
duplicate evidence and unmodeled fields; G4 cited backend/storage/refresh
decisions, no LLM and observable reversals; G5 allowlist/merge tests and second-
officer digest reproduction. No benchmark superiority or unmeasured budget claimed.

## Geordi — every named blocker

Original review labels B1–B7 are retained; prefix below disambiguates officer.
These are AC refinements, not new UI features or a separate a11y epic.

| Finding | Disposition and canonical acceptance | Owner / verification |
| --- | --- | --- |
| GEORDI-B1 (B1) | Reconciled: S008 AC4 >=24×24 CSS px target or equivalent spacing; reduced motion and nonanimated alternative. S013/S009 apply before G2 | Geordi; keyboard/target/motion evidence G2/G5 |
| GEORDI-B2 (B2) | Reconciled: S008 AC4 explicit focus not fully/predominantly obscured by sticky chrome; tab every action | Geordi; manual focus script G5 |
| GEORDI-B3 (B3) | Reconciled: S008 AC7 and S009 AC4 labeled delete/disconnect dialog, correct focus containment, keyboard confirm/cancel, return to trigger/logical successor | Geordi; G2 lifecycle and G5 full flow |
| GEORDI-B4 (B4) | Reconciled: S008 AC5 320 CSS px equivalent, 200% text zoom and text spacing; no horizontal scroll/loss; accessible full long text | Geordi; long-title/author-list fixtures G2/G5 |
| GEORDI-B5 (B5) | Reconciled: S008 AC2 each mixed-source field/record has text/accessibility provenance, imported vs local/synthetic, not positional/color-only; synthetic trace stays separate | Geordi/Data; AT reading script |
| GEORDI-B6 (B6) | Reconciled with contrast clarification: S008 AC6 normal text including small status >=4.5:1; only qualifying large text and non-text UI >=3:1, per token/color pair. Small “status” text is not exempt | Geordi; measured contrast record |
| GEORDI-B7 (B7) | Reconciled: backlog D01/D02/D04 promotion dependencies now explicit on half-star keyboard/numeric/explicit-inferred semantics, facet controls/results/landmarks, explanation disclosure and uncertainty text; D03 status also carried forward | Geordi; future promotion gate, no alpha feature work |

### Geordi recommendations and consolidated gaps

The source numbers its seven recommendations but does not give IDs; G-R1–G-R7
below are disposition aliases, not new story IDs.

| Recommendation | Disposition / canonical location |
| --- | --- |
| G-R1 | Accepted: S011 AC1 compares accessibility API maturity/AT evidence alongside authorization/privacy/cost |
| G-R2 | Accepted as future constraint only: S011 AC5 and D07 audio off by default, optional/supplemental, never competing with playback; no alpha audio |
| G-R3 | Accepted: D01 and D02 keyboard half-star radio-group/slider, numeric equivalent, Geordi pre-promotion approval |
| G-R4 | Accepted: D02 landmarks/headings and table/grid/list semantics before code |
| G-R5 | Accepted: D04 real disclosure button/aria-expanded or native equivalent; concise natural-case body copy and adjacent textual uncertainty |
| G-R6 | Accepted: D03 persistent non-modal status with AT announcement/no focus interruption; S008 AC3 already uses it |
| G-R7 | Accepted: S008 AC1 explicit Geordi wireframe approval before code; also S002/S013/S009 pre-code design |

Additional Section 5 gaps accepted: plain-language consent with equal-step
decline/no precheck; screen-reader script across status/unknown/error/lifecycle;
long-title/full-text access; irreversible-copy limitations announced before
confirm; recovery error programmatically associated. These reside in S002,
S009 AC4 and S008 AC3–7/10.
LCARS standing design constraints in Section 6 are in S008 AC6 and future D07:
semantic tokens, flat vector form, natural-case data, restrained asymmetry,
one family/three sizes subject to user scaling, never color/audio-only status.
No new admin surface or mandatory platform-specific widget is introduced.

Geordi's “no point/count change from these a11y refinements” condition is
respected for S008 and deferred UX; aggregate increases arise from separately
required security/architecture work. That combined revision still needs Geordi
re-review; conditional historical language is not a current approval.

## Worf — every named blocker

| Finding | Disposition and canonical acceptance | Owner / verification |
| --- | --- | --- |
| WORF-B01 | Reconciled: charter disqualification list; S001 AC1/4 identifies dated official authority and named qualified legal clarification; ambiguity/absence blocks, not engineering permission | Data with Worf; G0 text/G1 authority |
| WORF-B02 | Reconciled: charter/S002 normative system-browser or sanctioned auth only; process cannot observe/script/autofill/intercept; no embedded/automated browser/profile/password/MFA/cookie path, no exception | Worf design; Data S013/S009 credential scan; G2 test 3 |
| WORF-B03 | Reconciled: S005 AC4 rejects affiliate/Associates/advertising/revenue/tracking-bound routes even metadata-only; S010 AC1 requires route provenance and rejects bound candidates | Data/Worf; G1/G3/G4 |
| WORF-B04 | Reconciled: S002 pre-ingest named-artifact allowlist/caps/encrypted scratch; S013 test 4; S004 AC5 refuses before content parsing, no refused-name logs; inseparable household/non-Audible data stops | Data/Worf; G1/G2/G3 |
| WORF-B05 | Reconciled: signed/dated private consent including self-consent, scope/location/expiry/no-AI/withdrawal; refuse collects nothing, no third-party scope; stop immediately and delete within 24h | Worf S002, Data S009; Geordi consent G2 |
| WORF-B06 | Reconciled: S002 runbook names Worf lead/Data operator/Captain escalation, revoke/rotate, authorized repo purge with irretrievable-copy warning, unexpected egress, participant notification, halt until closure | Worf; S009 AC9 fixture incident drill, G1/G2 |
| WORF-B07 | Reconciled: dependency gate moved before real data; S013 minimal pinned runner, no install scripts; S009 AC6 dated lock/license/vulnerability checks, critical/high unresolved blocks; G5 rechecks | Data/Worf; test 12 G2/G5 |
| WORF-B08 | Reconciled: S009 AC7 outside-repo/cloud encrypted storage, ignore defense, fail-closed local pre-commit secret/canary and staged-diff checks; no commit needed to prove hook rejection | Data/Worf; test 8 G2 |
| WORF-B09 | Reconciled: S009 AC8 enforced default-deny/negative tests and destination records; renderer/normalizer/import no outbound; S008 AC8 no remote assets/prefetch/activatable URLs, restrictive CSP if web | Data/Geordi; Worf tests 1/2/15 G2/G3/G5 |
| WORF-B10 | Reconciled: named ATR-ADV-1 with every required attack class; S013 shared parser/normalizer/renderer preflight, S009 G2 assembly, final S006/S007/S008 regression; no delayed safety behind real-data story | Data/Geordi; Worf tests 4–7/11 and D05 deferred suite |
| WORF-B11 | Reconciled: S009 AC5 one encrypted container, key destruction, expanded residue/export inventory, restart/canary search, spill prevention, honest provider/user-copy/SSD limits | Data/Worf; test 9 G2/G5, R06 restriction |
| WORF-B12 | Reconciled: S002 normative diagnostic allowlist, no source values/IDs/paths/payloads in logs/traces/UI errors; verbose/crash/telemetry off; S009 AC9 and S007 AC7 assert categories, not canaries alone | Data/Worf; tests 7/11 |
| WORF-B13 | Reconciled: G3 explicitly requires actual-run egress/redaction/destruction receipts, consent in force, exact approved route/config fingerprint, not coverage alone | Worf; S004 AC1/6/7 and tests 13–15 |
| WORF-B14 | Reconciled: S004 AC7 process/control witness only; participant private content checklist; no screenshots/private exports to officers, sanitized report has no personal fields | Data/Worf; S008 AC10/S012 annex, R17 |

### Worf hardening recommendations

| Recommendation | Disposition / canonical location |
| --- | --- |
| WORF-H01 | Accepted: S003 single internally configured participant, no externally trusted user ID; S011 threat model preserves single-user boundary |
| WORF-H02 | Accepted: S011 AC4 deterministic future product useful alone, LLM optional/noncoercive |
| WORF-H03 | Accepted: S009 AC2 JSON only; future tabular formats need formula-prefix escaping, not shipped now |
| WORF-H04 | Accepted: S012 AC1 runtime/OS build/lockfile hash and reproducible commands |
| WORF-H05 | Accepted: S003 persistent untrusted-source marker through normalization/store/export/display, rejected/quarantined paths included |
| WORF-H06 | Accepted: S001 AC3 marketplace-specific privacy obligations, not coverage alone |
| WORF-H07 | Accepted: planning README/DoD/S004/S012 prohibit real-capture screenshots |
| WORF-H08 | Accepted: raw deadline validation/session end and <=24h; sanitized destruction receipt; normalized consent expires closure or 7 days |
| WORF-H09 | Accepted: S002 dedicated OS account/isolated container, cloud-sync/backup/indexing/crash controls checked |
| WORF-H10 | Accepted: S009 AC5 participant MFA verification and post-experiment connected-app/device review |
| WORF-H11 | Accepted: S002 numeric request/byte/time/retry/record caps; S004/S005 enforcement, no silent continuation |
| WORF-H12 | Accepted: S011 AC6 dated platform-specific threat model accepted at G4, Worf re-review before future platform implementation |

All Worf gate amendments are reflected: G1 permission/consent/runbook/archive
design; G2 tests 1–12 and lifecycle/supply-chain/containment/crypto-erase; G3
tests 13–15 plus actual control evidence; G4 platform threat model; G5 complete
security annex and final-component regression; G6 private/no-sync wording.
Post-G2 route/runtime/dependency/storage/allowlist changes require **approval,
not notification**. Risks R14=270, R15=216, R16=120, R17=120 added; no residual
score fabricated. R04/R06/R07 re-scoring restrictions preserved.

Clarifications that do not waive controls: archive directory metadata may be
examined only to select allowlisted members, not to read/index unrelated content;
malformed/oversized inputs are safely rejected rather than forced into a renderer;
valid hostile strings are escaped and fully inspectable. Pre-G2 routing tests use
controlled fixtures; real successful destinations after G2 must be a justified
subset of the allowlist, not forced contact with every allowed host.

## Wesley — every named blocker and final conditions

| Finding | Disposition and canonical acceptance | Owner / verification |
| --- | --- | --- |
| WES-B01 | Reconciled: S001 AC2, S003 AC5, S004 AC2 and S005 AC2 explicitly audit narrator discrete/string/missing/full-cast and canonical/fractional/omnibus series; absent data partial/unavailable with impact; no guessed sequence | Data; Wesley G1/G3 usefulness review |
| WES-B02 | Reconciled: S003 minimal ExplainabilityTrace candidate→factor→known synthetic history/preference; S010 AC2 required resolvable evidence pointers, floating/dangling/unattributed claims rejected | Data; Wesley/Worf S010 fixtures, no graph engine |
| WES-B03 | Reconciled: S010 AC3 exact tripartite label criteria, baseline relevance/quality/credibility/content/language/safety/a11y passes; exploratory/broadening cannot claim DIRECT_MATCH; no ideology proxy or category-only viewpoint claim | Data; Wesley/Worf contract tests, semantic ranking deferred |

Final conditions 1–3 map to the three blockers above. **Condition 4 accepted**:
S008 AC9 metadata/explainability feasibility card, read-only source coverage and
separately labeled synthetic trace, accessible and never a live recommendation.
**Condition 5 is satisfied**: all four officers explicitly approved after
re-review in their final sign-off documents.

### Wesley recommendations, experiments and scope decisions

| Source suggestion | Disposition / rationale / canonical location |
| --- | --- |
| Ranked recommendation 1: bipartite graph fixture | Accepted as minimal schema/fixture relations in S003/S010 and synthetic card in S008. Reject graph database/template generator/automatic fallback as alpha implementation; no engine or explanation product ships |
| Ranked recommendation 2: tripartite diversity fixtures | Accepted as contract tests. Reject publisher balance/topic clustering as ideology proxies; require sourced uncertain evidence and safety/quality first. No set-level ranker or “radicalization prevention” effectiveness claim |
| Ranked recommendation 3: vanilla web-component harness | Deferred as one candidate for G1 disposable runtime review, not selected now. No claim native web features meet WCAG “out of the box”; Geordi/Worf must verify actual browser/CSP behavior |
| EXP-01 narrator/series >=90% | Accepted audit, rejected arbitrary pass threshold. Report observed numerator/denominator, known standalone/missing/partial cases and downstream impact; sparse metadata does not falsify legal four-domain access |
| EXP-02 100% grounded synthetic traces | Accepted for **accepted valid fixtures**: every trace resolves >=1 known history/preference relation, zero floating claims. Invalid adversarial fixtures must be rejected, not forced to emit traces; no generated explanations |
| EXP-03 inject >=1 alternate into a concentrated set | Deferred engine behavior to D04; alpha tests label evidence and unsafe/unsupported rejection, not insertion/reranking. Contract cannot prove set-level anti-echo-chamber performance |
| EXP-04 500-book <100ms/<50MB | Accept descriptive optional 500-book **synthetic** render baseline within approved fixture limits; reject fixed speed/heap targets before runtime/baseline. S006/S011 measurements guide architecture; never apply real-data cap to fabricate a 500-book capture |
| S005 full narrator back-catalog/series retrieval | Bound to documented support and at most approved lookup examples, absent capability reported. Bulk “all titles” harvest violates thin alpha and request limits |
| S011 backend “for scraping/session management” | Rejected scraping/credential-session premise. Compare only approved access paths, privacy, measurements and documented confidential-client requirements |
| Access fallback to supported manual import | Accepted only with Captain G1 approval and explicit import/no-auto-sync labels; not an automatic product pivot |
| Public/open metadata fallback | Candidate research only, same documented rights/security/availability proof and G2 runtime gate. ISBN/ASIN alone cannot prove edition equivalence or Audible availability |
| Owned-library-only catalog fallback | Rejected for this baseline: violates required non-owned catalog proof. Requires explicit Captain rebaseline, cannot pass G3/G6 silently |
| Deterministic templates as future LLM fallback | Deferred to D04/D05; deterministic product direction retained, but no “zero downtime/cost/hallucinations” guarantee from a fixture |
| Indexed facets/O(N²) concern | Accept stable relation/port design, defer database/index/algorithm selection; no candidate evaluation engine in alpha, no premature relational storage mandate |
| Web-only CSP/keyboard specifics | Apply restrictive CSP if web, equivalent default-deny otherwise; semantic tables/lists use platform keyboard conventions, no needless custom ARIA grid. S008/Geordi verifies actual flow |

## Cross-document reconciliation and unresolved items

Updated consistently: [charter](01-release-charter.md),
[requirements/hierarchy](02-requirements-and-hierarchy.md),
[stories](03-user-stories.md), [sequence](04-sequencing.md),
[risks/gates](05-risks-and-release-gates.md), [backlog](06-backlog-index.md),
and [planning README](../../README.md). Requirements now include all security/
egress owners and S013; no feature is unrepresented. Deferred UX/security
promotion constraints do not enter the 51-point alpha backlog.

**No named blocker is left without a disposition and canonical requirement.**
This is not “no open risk”: implementation evidence is wholly absent.
Remaining decisions are intentional gated unknowns, not implied approvals:

| Unresolved item | Owner / required resolution |
| --- | --- |
| Final domain sign-off on all reconciled findings, new enabler/estimates and stricter catalog gate | **Resolved at G0:** Data, Geordi, Worf, and Wesley approved |
| Acceptance of 51-point candidate baseline; manual-import fallback and experiment region/language | **Baseline resolved at G0:** Captain accepted; fallback and region/language remain G1 decisions |
| Supported route, named qualified permission authority where needed, catalog rights | Data + Worf, Captain secures qualified clarification; G1 |
| Actual history/progress/catalog coverage and narrator/series fidelity | Data + Wesley; only approved runs after G2, verdict G3 |
| Disposable runtime, exact boundary/encryption/dependency implementation, test command evidence | S002/S003/S013/S009; G1 design and G2 runtime approval |
| Product client/backend/storage, platform-specific threat model | S011 after G3; G4 acceptance |
| All runtime test results, residual risk acceptance and release approval | G2–G5 officers, G6 Captain; none granted |
| LLM provider, future ranking quality/diversity/grounding and public branding | Deferred inventory; no alpha provider selection or ranker |

## Validation record

Validation is of planning consistency, not application behavior.
The reconciliation uses local read-only checks for Markdown file/fragment links,
stable IDs, story-feature-epic-theme membership, requirement/story coverage,
cross-document dependencies and cycle absence, points/roll-ups, exact WSJF sort
and gate-expanded longest paths. Original reviews and APP_DESCRIPTION.md must
remain unmodified; git whitespace/status checks cover only this planning task.

**Validation execution/results (2026-09-16):** local Node.js assertions passed
across 8 canonical/README files: **62 local file/heading links, 13 stable story/
feature mappings, 16 bidirectional requirement mappings, 20 acyclic story/gate
nodes, 17 FMEA products, 33 blocker dispositions and 28 numbered recommendation
dispositions**. Consecutive AC numbering, required owner/reviewer/DoD metadata,
BLOCKED statuses, story/backlog/dependency-table agreement, WSJF arithmetic and
both sorted tables passed. Story sum 51, epic/theme roll-ups 51, longest path 38,
inspector branch 34 verified independently from parsed documents.
Python was unavailable; validation used the installed Node runtime without
installing packages or writing a test harness to the repository.
Git whitespace checking includes the untracked planning files via no-index
comparison, not only the tracked diff; Markdown trailing-space line breaks
were replaced with metadata lists. The four original review files retain their
original sizes and pre-task modification times; the pre-existing product-brief
modification is untouched.
No application tests are available or claimed; no actual data, dependencies,
account operations, commit or push.

## Final consensus statement

Riker's reconciliation establishes a coherent, bounded data-access feasibility
alpha: safety before actual data, evidence before platform, deterministic
contracts without a ranker, and no LLM/provider commitment. All 33 named blockers
have a concrete plan disposition; accepted recommendations and constrained/
rejected suggestions have explicit rationale. Stable IDs remain intact except
one necessary new shared-enabler pair.

Data, Geordi, Worf, and Wesley independently re-reviewed the canonical plan and
recorded **APPROVED** verdicts:

- [Data final sign-off](reviews/data-signoff.md)
- [Geordi final sign-off](reviews/geordi-signoff.md)
- [Worf final sign-off](reviews/worf-signoff.md)
- [Wesley final sign-off](reviews/wesley-signoff.md)

Riker accepts the reconciled execution plan, and the Captain's request to lock
alpha 0.0.1 records baseline acceptance. **The crew is unanimous. G0 is passed,
the 51-point baseline is locked, and ATR-S001 is READY.** No real-data activity
is authorized before G2, and no private alpha release is authorized before G6.

## Passkey and account-provenance amendment

- **Proposed:** 2026-09-16
- **Trigger:** Captain clarified that participant-side Audible/Amazon
  authentication may use a passkey held in 1Password.
- **Accepted:** 2026-09-16
- **Disposition:** Unanimously approved clarification; no runtime authorization
  is granted by this amendment.

### Changed authorities

- [Product brief](../../../APP_DESCRIPTION.md): distinguishes provider
  authentication from application authorization and places all password-manager
  access outside the application trust boundary.
- [Release charter](01-release-charter.md): defines the WebAuthn parties,
  provider-controlled browser boundary, and passkey-neutral credential
  prohibitions.
- [Detailed stories](03-user-stories.md): extends S002 criteria 7–9, the S003
  manifest and field-authority contract, and S009 lifecycle criteria.
- [Risks and gates](05-risks-and-release-gates.md): adds R18/R19, extends tests
  3, 11, and 13, and clarifies D01.
- [Backlog index](06-backlog-index.md): records this append-only amendment.

### Amendment acceptance

1. Audible/Amazon remains the WebAuthn relying party; the OS/browser is the
   client; a user-selected credential manager may act as authenticator. ATR is
   none of these, renders no credential field, and never reads or integrates
   with 1Password or another vault.
2. Successful provider authentication grants ATR no API, token, route, consent,
   or authorization. No delegated route is currently approved. If S001 finds a
   supported delegated route, it still requires G1 design, fixture-tested
   controls, and explicit G2 authorization.
3. Zero-request import mode records a non-identifying participant-attested
   account alias and marketplace in the snapshot manifest. Attestation is
   non-key-forming and not account proof; source-evidenced marketplace remains
   authoritative for catalog identity.
4. An attested/source-evidenced marketplace mismatch quarantines the capture
   and prevents promotion. At most one account container may exist; changing
   the declared account or marketplace requires prior closure, key destruction,
   managed-artifact deletion, receipt, new consent, and new capture.
5. G2 test 11 uses only synthetic app-visible outcomes. ATR neither probes
   authenticator/vault state nor controls provider authentication fallback.
   G3 test 13 records explicit account-provenance and container-isolation
   evidence.
6. Deletion disclosures distinguish app-managed crypto-erasure from
   provider-held, user-held, or vault-synchronized copies outside app custody.

### Scope and baseline invariants

This is a security, provenance, and wording clarification, not a new feature.
The baseline remains **3 themes / 5 epics / 13 features / 13 stories / 51
points**. No ID, priority, estimate, dependency, gate, status, WSJF score, or
release scope changes. G0 remains passed, only ATR-S001 remains READY, G2 still
does not authorize real-data work by itself, and G6 remains required for release.

### Final concurrence

All amendment reviewers independently approved the corrected authorities:

- [Riker change-control approval](reviews/passkey-riker-approval.md)
- [Data provenance sign-off](reviews/passkey-data-signoff.md)
- [Worf security sign-off](reviews/passkey-worf-signoff.md)
- [Geordi accessibility sign-off](reviews/passkey-geordi-signoff.md)

Data's first pass identified one narrow traceability blocker: replacing
`provider-held` with `vault-service` could have weakened an existing deletion
disclosure. The final wording is additive and names provider-held,
vault-service, and user-held copies in S009 and test 9; Data approved the
correction. Riker, Worf, and Geordi found no blocking issue.

The Captain introduced and accepted this requirement as a locked-baseline
clarification. The amendment is accepted without changing story count, points,
readiness, dependencies, gates, or runtime authorization. G0 remains passed and
ATR-S001 remains the only READY story.

## Amendment validation record

Validation is of planning consistency, not application behavior. The final
record verifies Markdown links, whitespace, story count and point arithmetic,
status/readiness invariants, and absence of dependency/gate drift. No Audible
account call, authentication attempt, password-manager access, real-data
operation, commit, or push is part of this amendment.

**Execution/results (2026-09-16):** local Node.js assertions passed for 136
local Markdown file/fragment links, 13 story headings, 13 point declarations
totaling 51, and ATR-S001 as the only READY story. Story priority/size and
dependency metadata, all canonical backlog rows, and all G0–G6 gate definitions
match the locked HEAD baseline. `git diff --check` passed.
