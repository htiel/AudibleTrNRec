# Alpha 0.0.1 — detailed stories

**Locked baseline, unanimously approved on 2026-09-16.**
G0 passed: ATR-S001 is `READY`; the other 12 stories remain `BLOCKED` by named
dependencies. No story has implementation or test evidence.
Stable IDs S001–S012 are retained. S013 isolates previously implicit shared
security/harness work so G2 has no dependency on a real-data story.
Full-prefix IDs and aliases resolve in [hierarchy](02-requirements-and-hierarchy.md);
scores and execution order are in [sequencing](04-sequencing.md).

## Shared definition of done (DoD-A)

1. Record pass/fail evidence for every numbered AC and referenced contract.
   A planned test, source claim, or fixture is not real-access proof.
2. Owner delivers a separately reviewable bounded artifact. Every named reviewer
   records approval or required changes; no approval is inferred. Specifications
   precede implementation. Security and accessibility findings block dependent work.
3. Executable work uses S013's sole test runner, documented exact commands,
   pinned environment, automated happy/boundary/failure tests, and earlier regressions.
   S001–S003 are design artifacts; no runner or test result exists yet.
4. Only synthetic fixtures and approved sanitized outputs enter the repository.
   No personal data, credentials, screenshots of real captures, or debug leftovers.
5. Update status, evidence links, limits, recovery instructions and risks together.
   Worf approves every post-G2 change to route, runtime, dependencies, storage,
   or egress allowlist before use. Changed surfaces remain fixture-only until approved.
6. Validate in the approved disposable harness, not an assumed product platform.
   No password/MFA/session-cookie custody, AI SDK, AI request, ranker, or real rating UI.
7. Complete prerequisites means completed stories plus passed gates. Required
   design review inside a story precedes that story's code. No hidden partial-story
   dependency is used. G2 tests use shared components delivered by S013/S009;
   downstream stories reuse them and re-run security tests before real inputs.

## Normative evidence contract — owned by ATR-S003

S003 publishes a versioned JSON Schema and data dictionary implementing this
contract; S013 tests it. Fixtures, stores and S009 JSON exports are instances,
not harness-native objects. Every object rejects unknown properties. Named ports:
source adapter, catalog adapter, normalizer, store, clock, identifier generator.
Adapter types never cross the contract in either direction. One participant is
configured internally; no imported/external user ID is trusted for tenancy.

### Identity and canonical equality

- Book/work, edition, person, series and other facet keys prefer a documented
  source namespace + marketplace + entity kind + stable source ID. A work/edition
  relation exists only with explicit source evidence; never equate editions by title.
- Person roles are a set (`author`, `narrator`); role edges use book/edition key +
  person key + role. One evidenced person can have both roles. Homonymous people
  remain distinct. Facets include kind in their key.
- Library key = internal participant key + edition key + source namespace.
  History key uses source event ID; absent that, a documented stable event tuple
  (edition, event kind, source event time and source sequence) is permitted only
  if unique under source semantics. Otherwise preserve ambiguity in quarantine:
  content hash is not proof that two identical listening events are one event.
  Progress key = library key + source progress/session identity when available.
- Missing stable IDs: use documented alternate source identifiers only when their
  uniqueness is proven. Otherwise content-address a canonical record for quarantine,
  retaining multiplicity; no title-only/name-only join or fabricated trusted entity.
  Store alias / `superseded_by` relations with source provenance. Merge/split
  conflicts preserve local sentinel and old target; quarantine unresolved links,
  never silently delete or repoint annotations.
- Snapshot manifest declares its approved scope/predicate and expected partitions/
  record counts, plus source completion evidence (final cursor or validated file
  completion/count). A deliberately bounded sample is complete only for that
  disclosed scope, never for the whole library. Missing partitions, unknown
  completion, cap-triggered abort or parse failure cannot promote a snapshot;
  retain last complete state. Scope changes are explicit, not inferred deletions.
- Canonical logical state: schema version included; object keys lexically sorted;
  Unicode NFC; ordinal Unicode-code-point collation (no locale collation);
  sets sorted by canonical key; semantic ordered arrays retain their order.
  Canonical decimal numbers have no redundant zeros or negative zero; no NaN,
  infinities or locale notation. UTC RFC3339 timestamps use fixed millisecond
  precision; unknown timezone remains unknown, not guessed UTC.
  UTF-8 serialization without insignificant whitespace; SHA-256 digest.
- Explicit digest exclusions: operational attempt/start/end/capture times,
  run IDs, transport cursors, page/batch/sequence counters used only for transport,
  measured durations, retry counts and diagnostic ordering. Source event sequence,
  source update/event times, schema version, provenance identity, logical counts,
  aliases and local sentinel content remain included. New exclusions need Data review.
- Normalizer takes injected clock and deterministic identifier generator; no direct
  wall-clock, randomness, environment/locale dependence, network, or uncontrolled I/O.
  Fixed injections yield identical output; transport order cannot change identity.

### Field authority and freshness

The dictionary enumerates **every field** against this exhaustive owner policy;
unclassified fields fail validation. Source timestamps and units are validated first.

| Field family / owner | Re-import rule | Absent / equal / older source update time |
| --- | --- | --- |
| Metadata, source identity, library/history/progress values and source timestamps — source | Initial supported values admitted; later changes need evidence of freshness | Absent: retain existing value, quarantine conflicting incoming value. Equal: identical is no-op, conflict quarantined. Older: retain trusted value and quarantine conflict. Initial absent-time data is labeled freshness unknown |
| Synthetic rating/comment/tag and narrator/series sentinel — local | Import cannot write, delete, or repoint it; explicit test action only | All timestamps irrelevant to local authority |
| Percentage, normalized sort fields, evidence edges — derived | Recompute deterministically from accepted source/local inputs with rule version and pointers | Never use quarantined/stale conflict to recompute trusted values |
| Attempt/success/capture times, counters, run diagnostics — operational | Inject clock; success advances only after atomic complete-snapshot promotion | Never substitute capture time for absent source freshness |

Progress is **not globally monotonic**. Newer, explicit source restart/session
evidence may set position to zero with a recorded restart reason. A decrease
without that evidence is quarantined, even with a newer timestamp; retain trusted
progress. Unknown is not zero/not-started. Derive percentage only for compatible
known duration/position; reject out-of-bounds or contradictory values. Missing
records and incomplete captures cannot delete retained state.

### Grounding and adversarial fixtures

Minimal `ExplainabilityTrace`: candidate ID → matching-factor/facet ID →
known synthetic history node or explicit synthetic preference ID, with edge type,
source provenance, confidence/uncertainty, and rule version. A relation is not an
explanation generator or graph database. CatalogPerson supports multiple roles
and full casts. SeriesFacet includes sourced name, nullable fractional sequence,
and nullable omnibus flag; never guess reading order from publication order.
Source strings carry `trust: untrusted-source` through normalize/store/export/display.
No inferred political/sensitive identity or publisher/topic/category ideology proxy.

Versioned corpus **ATR-ADV-1** contains expected accept-as-inert / reject /
quarantine outcomes for HTML/script/SVG/events; javascript/data URLs; prompt and
fabricated system/tool directives and invented preferences in title/description/
series; zero-width/bidi controls (visibly escaped); template/format/expression
syntax; spreadsheet prefixes; traversal, absolute and UNC paths; symlinks;
archive bombs/member limits; oversized/deep structures; malformed encodings/lone
surrogates; duplicate/colliding IDs; remote SSRF/tracking URLs.
Unsafe encoding/oversized inputs are rejected before rendering, with safe codes;
admissible malicious strings are inert, visibly escaped, fully inspectable text.
No payload executes, navigates, fetches, escapes layout or silently disappears.
Additional fixtures: absent/zero/stale/conflicting progress; reordered/overlapping
batches; missing/partial records; edition ambiguity; person dual roles; identifier
merge/split; long title/author lists; full cast; sequence 2.5; late-published prequel;
omnibus; position greater than duration. All records are invented, not redacted users.

## Normative experiment boundary — owned by ATR-S002

- Permission authority per route: dated official document/title/URL and named
  qualified legal person/body for ambiguity, assigned by Captain before G1.
  An engineer's opinion cannot grant permission. Unknown authority means blocked.
- Provider-rendered authentication only in the OS default browser or sanctioned
  authentication session our code cannot observe/script/autofill/intercept.
  No embedded webview, headless/automated browser, profile/cookie extraction,
  password, MFA code or session-cookie code path. Delegated tokens only if supported.
- Default experiment ceilings (G1 may lower; increases need reviewed rebaseline):
  100 library entries, 500 history records, 10 catalog lookups, 100 requests/run,
  25 MiB transferred/run, 50 MiB total retained encrypted data, 10 minutes/run,
  at most 2 retries/request. Honor stricter provider limits and Retry-After;
  capped backoff, no retry beyond run deadline. Import mode makes zero requests.
  Archives: at most 100 listed members, 5 MiB/member, 25 MiB expanded total,
  10:1 expansion ratio, nesting depth 16, string length 16 KiB. No nested archives,
  symlinks, traversal/absolute/UNC destinations. Excess aborts, never silent truncation.
- Pre-ingest allowlist names only necessary Audible artifacts; inspect the archive
  directory solely to select allowed members, never read/decompress/copy/index/log
  refused member content or names. Encrypted scratch only. If packaging cannot
  separate non-Audible/household/third-party data safely, stop; do not open wholesale.
- Dated signed private consent records participant (self-consent allowed), categories,
  purpose, storage, expiry, no AI, and withdrawal method. No pre-check; decline as
  visible/reachable and no more steps than accept. Plain language, keyboard/AT
  announcement before access. Refusal collects nothing. Withdraw: stop immediately,
  destroy app-managed data/keys within 24 hours, record sanitized receipt.
- Dedicated OS account or isolated container, no cloud-sync paths, verified backup,
  indexing/thumbnail, telemetry and crash reporting off. One encrypted container
  holds all app-managed personal artifacts; secret facility protects its key.
  TLS for approved transfers; source/catalog adapters alone may access approved
  destinations. No source-supplied URL is fetched or activated, even covers.
- Raw data expires after validation, before session end, and unconditionally within
  24 hours of capture. Retained normalized data requires separate explicit consent,
  expires at experiment closure or 7 days after capture, whichever first. Recapture
  needs a new dated consented run; never retain raw data to aid debugging.
- Before destruction create Worf-approved non-personal derivative: aggregated
  field-presence/type/shape counts, documented source-state enumeration (not free
  text), bucketed value-length histograms, unit/timezone observations, observed
  but unmodeled schema-field names/counts. No user values/IDs/titles/paths/exact
  listening times. Suppress rare/sensitive combinations and dynamic field names.
  Data confirms diagnostic sufficiency; Worf confirms privacy. Otherwise suppress.
- Logs/errors/traces/UI diagnostics allow only counts, application state names,
  error classes/codes, durations, operational timestamps. No tokens, credential URLs,
  user file paths, titles, source IDs, raw bodies, source strings, or personal
  timestamps in stack frames or exit output. No payload debug/verbose mode with
  real data. Private inspector data is not diagnostic output.
- Minimal justified dependencies, pinned versions and lockfile (or explicit
  no-dependency record); no install/postinstall scripts; dated vulnerability and
  license review before G2. No critical/high unresolved dependency vulnerability.
- Incident runbook names Worf incident lead, Data operator, Captain escalation:
  halt collection/egress; revoke via documented provider surface; rotate exposed
  tokens/keys; contain repository leak and purge history/caches with authorized
  procedure (purge cannot retract copies); notify participant promptly and before
  resumption; investigate unexpected egress; record closure and Worf reapproval.
  No automatic destructive git operation is authorized by this plan.

## ATR-S001 — Establish the source feasibility dossier

- **Feature / epic / theme:** ATR-F01 / ATR-E01 / ATR-T01
- **Type / story:** Discovery enabler. As a listener, I want verified access
  options so that I do not entrust my account to an unsupported integration.
- **Priority / size:** CRITICAL / M, **3 points**; WSJF 5.00.
- **Depends on:** G0. **Unblocks:** S002, S003.
- **Owner:** Data. **Review gates:** Worf (permission/security), Wesley (usefulness),
  Riker (scope); Captain obtains qualified legal clarification where needed.
- **Requirements:** ATR-PR01, PR02, PR03, PR05, PR07, PR16.
- **Acceptance criteria:**
  1. Compare official documented API/delegation, supported export, and disqualified
     alternatives in order; dated authority, permissions, eligibility, costs,
     rights, limits and refresh constraints per route. Permission is documented,
     ambiguous or absent; absence of prohibition is unknown, never approval.
  2. Four-domain matrix uses documented-not-tested/proven/partial/unavailable/unknown.
     Explicitly audit narrator IDs vs unlinked strings/full casts; series name,
     fractional sequence/omnibus; progress seconds/percentage/coarse state.
     Missing narrator/series is a documented downstream limitation, not invented data.
  3. Propose one marketplace/language/participant scope without collecting personal
     records; document applicable regional data-protection obligations.
  4. Publish disqualified routes: unofficial/reverse-engineered clients,
     undocumented device registration/private endpoints, scraping/automation,
     browser-profile credential extraction and inferred permission. Credential
     handling stays prohibited without exception; other exceptional routes require
     separate technical/legal/security/maintenance review and explicit scope change.
  5. No route/missing domain stops release; Captain must approve manual import or
     any reduced baseline. No owned-only or synthetic substitution for catalog proof.
  6. Pre-register S011 comparison rules: confidential-client requirements imply
     protected service custody, not client secrets; test client-only feasibility
     first; rate constraints inform (do not automatically mandate) scheduling;
     no hosted custody without justified need, privacy/a11y evidence and re-review.
- **Specific DoD:** DoD-A; dated dossier only, no account request.

## ATR-S002 — Define consent and a safe experiment boundary

- **Feature / epic / theme:** ATR-F02 / ATR-E01 / ATR-T01
- **Type / story:** Security enabler. As a listener, I want scoped revocable
  consent so that the experiment cannot take uncontrolled custody of my data.
- **Priority / size:** CRITICAL / L, **5 points**; WSJF 3.00; security override.
- **Depends on:** S001. **Unblocks:** G1, S013, S009.
- **Owner:** Worf. **Review gates:** Data (flows/storage), Geordi (consent), Riker.
- **Requirements:** ATR-PR01, PR05, PR06, PR10.
- **Acceptance criteria:**
  1. Publish data-flow/storage inventory, operator, route endpoints/file allowlist,
     trust boundaries, all numeric limits and every normative boundary rule above.
  2. Supply signed-consent template and withdrawal/expiry procedure; Geordi approves
     plain-language interaction spec before code. Fixture keyboard/AT script tests
     equally reachable accept/decline, no pre-check and refusal collecting nothing.
  3. Specify credential-absence static review and safe provider handoff; no
     password/MFA/session-cookie code path; Worf checks enforcement at G2.
  4. Specify pre-ingest selection and archive rejection before parsing, including
     third-party-data stop. Nothing real is inspected in this story.
  5. Publish encryption/key custody, retention deadlines, derivative privacy rules,
     logging allowlist, default-deny egress and full deletion inventory.
  6. Publish incident/revocation runbook and dependency/install-script policy;
     dependency review is G2 prerequisite, not deferred to release.
- **Specific DoD:** DoD-A; written G1 design, not runtime security approval.

## ATR-S003 — Define source evidence and synthetic fixtures

- **Feature / epic / theme:** ATR-F03 / ATR-E02 / ATR-T02
- **Type / story:** Architecture enabler. As a reviewer, I want a neutral,
  falsifiable contract so that observed, missing and inferred data cannot be confused.
- **Priority / size:** CRITICAL / L, **5 points**; WSJF 2.60; dependency override.
- **Depends on:** S001. **Unblocks:** G1, S013, S006, S010.
- **Owner:** Data. **Review gates:** Worf (privacy/input), Geordi (semantics), Wesley (grounding).
- **Requirements:** ATR-PR02, PR04, PR05, PR07, PR09, PR12, PR13.
- **Acceptance criteria:**
  1. Publish runtime-neutral schema/dictionary implementing every normative evidence
     rule, identity key/precedence, explicit unknowns, units, source/capture times.
  2. Enumerate every field's source/local/derived/operational authority and update
     behavior, including absent/equal/older time and evidenced restart from zero.
  3. Publish canonical serialization/digest exclusions and injected clock/ID contract.
  4. Publish ATR-ADV-1, semantic fixtures and expected normalized outputs, including
     merge/split aliases and narrator/series sentinels; no real ratings feature.
  5. Define multi-role/full-cast people, fractional/unknown/omnibus series, minimal
     ExplainabilityTrace edges and source trust markers through every boundary.
  6. No user-ID input, political/sensitive identity inference or ideology proxy;
     versioned closed properties and unknown-version rejection specified.
- **Specific DoD:** DoD-A; design/fixtures reviewed, no database/runtime selected.

## ATR-S004 — Prove one approved Audible capture/import route

- **Feature / epic / theme:** ATR-F04 / ATR-E01 / ATR-T01
- **Type / story:** Feasibility proof. As a consenting listener, I want an approved
  capture so that actual library/history/progress feasibility is demonstrated.
- **Priority / size:** CRITICAL / L, **5 points**; WSJF 3.00; dependency override.
- **Depends on:** S009, G2. **Unblocks:** S006; contributes to G3.
- **Owner:** Data. **Review gates:** Worf (actual route/control evidence), Wesley (semantics).
- **Requirements:** ATR-PR01, PR02, PR05, PR11.
- **Acceptance criteria:**
  1. Reuse S013/S009 guarded components; run their fixture security suite against
     the final adapter before Worf authorizes any real input. Route/config matches
     the G1-approved fingerprint; a change requires Worf reapproval.
  2. With current private signed consent, demonstrate real library records, at
     least one source history datum and one progress datum with actual semantics.
     Explicitly audit narrator representation, full-cast support and series sequence.
  3. Unsupported history/progress is partial/unavailable; no fixture, guessed
     percentage or acquisition date masquerades as listening history.
  4. Test cancellation, denied authorization/invalid input, timeout and bounded
     retries; enforce request/byte/runtime caps and provider limits; no unsafe fallback.
  5. Export route proves refused artifact counts without reading content, copying,
     retaining or logging refused names. If safe separation fails, stop.
  6. Before raw destruction produce approved derivative and sanitized receipt
     (artifact category/storage alias, time, method; not actual path/value).
     Record real request/page/byte counts, per-page/total durations, retries,
     rate-limit signals/spacing and cursor semantics; mark not-applicable honestly.
  7. Witness sees consent-presence/control attestations, approved-route fingerprint,
     egress/redaction checks and destruction receipt, **not library content**.
     Participant performs content verification on a sanitized checklist.
- **Specific DoD:** DoD-A; successful criteria yield DONE. Failed access yields
  documented investigation and STOPPED, not DONE/G3 pass. No repeated real capture
  required for idempotency; S007 proves fixture import invariance only.

## ATR-S005 — Prove candidate catalog metadata access

- **Feature / epic / theme:** ATR-F05 / ATR-E01 / ATR-T01
- **Type / story:** Feasibility proof. As a listener, I want permitted candidate
  metadata so that future candidates need not be fabricated.
- **Priority / size:** CRITICAL / M, **3 points**; WSJF 4.67.
- **Depends on:** G1, G2. No S004 dependency. **Unblocks:** contributes to G3.
- **Owner:** Data. **Review gates:** Worf (route/rights), Wesley (usefulness).
- **Requirements:** ATR-PR03, PR05, PR08, PR13.
- **Acceptance criteria:**
  1. Prove bounded permitted metadata/availability lookup for a publicly chosen
     Audible title: source ID, title, marketplace, provenance, availability evidence.
     Before G2 documentation research only; no actual catalog request or library
     comparison. Participant confirms at G3 that at least one proven title is
     outside their library; this is a G3 join, not a serial S004 prerequisite.
  2. Audit author/narrator entities/full cast, language/duration, series/sequence/
     omnibus, descriptions/covers, categories and quality/viewpoint evidence.
     Test whether supported narrator/series lookup exists with bounded examples
     or documented unavailability, never harvesting an entire back-catalog.
  3. Record contractual authority, attribution, cache TTL/storage/redistribution
     rights, refresh/rate limits and ID matching constraints. Unknown availability
     is ineligible; no completeness claim or protected-content republication.
  4. Affiliate/Associates/advertising/revenue-sharing obligations, mandatory tracking
     or promotional links make the route ineligible, even for metadata only.
     If sole route, stop/escalate trust conflict, not adopt silently.
  5. Validate schema before storage; source URLs stay inert text, never fetched.
     Commercial fields and source ordinal/retrieval rank are not candidate evidence.
  6. Test missing title/availability, malformed text and request failure. Record
     lookup latency, limits, cache TTL, ID match success/ambiguity and request caps.
- **Specific DoD:** DoD-A; public evidence can complete independently. No usable
  route means STOPPED/G3 blocked; owned-only or LLM fallback cannot pass alpha.

## ATR-S006 — Normalize an inspectable source snapshot

- **Feature / epic / theme:** ATR-F06 / ATR-E02 / ATR-T02
- **Type / story:** Prototype feature. As a listener, I want a truthful snapshot
  so that I can inspect exactly what the source supplied.
- **Priority / size:** CRITICAL / L, **5 points**; WSJF 2.60; dependency override.
- **Depends on:** S003, S004, S013. **Unblocks:** S007, S008; contributes to G3.
- **Owner:** Data. **Review gates:** Worf (validation), Geordi (state semantics).
- **Requirements:** ATR-PR02, PR05, PR07, PR11.
- **Acceptance criteria:**
  1. Reuse S013 validation/normalization security core; implement source field mapping
     under S003 authority/identity rules. Unknown sequence stays null; fractional
     sequences sort numerically; publication date does not imply reading order.
  2. Reconcile input/accepted/rejected/ambiguous counts; invalid progress is rejected
     or quarantined, never coerced. Report observed-but-unmodeled field names/counts
     through the approved derivative privacy filter.
  3. Fixture expected outputs match, fixed clock/ID injections produce identical
     output; full-cast/dual-role, aliases and edition ambiguity preserved.
  4. No source/provider/framework types cross named ports; assert no network or
     filesystem access outside designated store. Quarantine trust markers persist;
     retry cannot promote rejected data.
  5. Before loading real data, re-run ATR-ADV-1 through actual mapped normalizer and
     Worf reviews any changed boundary. No executable text/control-flow/identity/path injection.
  6. Record fixture count/bytes, duration, peak memory, runtime/OS, normalized
     bytes/record and per 100 entries (label extrapolation), raw:normalized ratio.
     Measurements only; no speed claim or invented performance threshold.
- **Specific DoD:** DoD-A; sanitized field map/counts and measurements.

## ATR-S007 — Repeat imports without corrupting retained state

- **Feature / epic / theme:** ATR-F07 / ATR-E02 / ATR-T02
- **Type / story:** Reliability/security feature. As a listener, I want repeat
  import and safe failure so that refresh cannot destroy retained data.
- **Priority / size:** CRITICAL / L, **5 points**; WSJF 2.40; security override.
- **Depends on:** S006, S009. **Unblocks:** G3, S012.
- **Owner:** Data. **Review gates:** Worf (failure/log safety), Wesley (edge cases).
- **Requirements:** ATR-PR04, PR05, PR11, PR12.
- **Acceptance criteria:**
  1. Three identical fixture imports have equal S003 canonical SHA-256 state digests,
     equal logical counts and zero duplicate library/history records; record each digest.
  2. Same set reordered and delivered in overlapping pages/batches equals one clean
     batch. Interrupted/partial then complete replay equals clean complete import.
  3. Absent/equal/older/conflicting timestamps follow S003 authority table; evidenced
     restart may reset progress, unsupported decrease cannot regress trusted state.
  4. Book/narrator/series/facet synthetic sentinels survive repeat/change/title change,
     missing/ambiguous records, merge/split and failures. Preserve alias trail;
     unresolved links quarantined, no silent loss or repointing.
  5. Atomic complete-snapshot promotion preserves last complete state on malformed,
     partial, interrupted, timeout and cancelled runs; separate attempt/success times.
  6. After S009 deletion, reimport recreates source-owned state without resurrecting
     deleted local sentinels. Verify with restart and logical digests.
  7. Run ATR-ADV-1 through repeat/partial/fault paths; error output only allowed
     diagnostic categories, no title/ID/path/token/body/source string. Recovery
     action names a safe retry/reimport/stop, not private values.
- **Specific DoD:** DoD-A; fixture invariance only, no live sync/real recapture claim.

## ATR-S008 — Inspect evidence through an accessible prototype

- **Feature / epic / theme:** ATR-F08 / ATR-E03 / ATR-T03
- **Type / story:** Prototype UX. As a listener, I want accessible evidence and
  lifecycle actions so that I can understand and control the experiment.
- **Priority / size:** HIGH / M, **3 points**; WSJF 3.67; accessibility blocking.
- **Depends on:** S006, S009, S013. **Unblocks:** S012.
- **Owner:** Geordi. **Review gates:** Data (binding), Worf (rendering/egress), Wesley (clarity).
- **Requirements:** ATR-PR02, PR05, PR06, PR10, PR15.
- **Acceptance criteria:**
  1. Geordi approves wireframe/interaction spec before UI code. Reuse S013 safe
     renderer and S009 accessible consent/export/delete controls, not a new client.
     All import/inspect/export/disconnect/delete actions have a discoverable path.
  2. Show title/ID, history/progress semantics, counts, source/capture times and limits.
     Unknown differs from zero/not-started; unavailable differs from failure.
     Each mixed-source field/record has text or accessible-description provenance:
     imported versus local/synthetic, never merely color/position.
  3. Label import-only/manual refresh. Persistent non-modal polite status updates;
     errors programmatically associated with recovery controls. No lost focus.
  4. Keyboard and chosen harness screen reader cover consent, status, unknowns,
     induced error, export, disconnect and delete. Focus visible and not fully or
     predominantly obscured by sticky chrome. Web target >=24×24 CSS px or
     equivalent spacing; native equivalent documented. Reduced-motion preference
     honored with nonanimated status alternative.
  5. Reflow at 320 CSS px equivalent, 200% text zoom and WCAG text-spacing overrides:
     no horizontal scrolling/content loss. Long titles/author lists wrap or expose
     full text accessibly; tooltip/title attribute alone insufficient.
  6. Record contrast per token/color pair: normal text (including small status)
     >=4.5:1; qualifying large text and non-text UI >=3:1. Named semantic tokens,
     flat LCARS vector styling, no gradients/glows/shadows/3D; one family/three
     type sizes subject to user scaling. Natural-case data, restrained asymmetric
     frame; aesthetics never override readability or semantic platform controls.
  7. Delete/disconnect confirmation has distinct accessible name, keyboard
     confirm/cancel, correct dialog focus containment and return to trigger (or
     logical successor if removed). Before confirm announce irreversible scope
     and provider/user-export-copy limitations as text, not icon/tooltip.
  8. Inspector sends zero outbound requests; no remote fonts/images/styles/scripts,
     analytics, prefetch or activatable source URLs. Web uses verified restrictive
     CSP, no remote origins or inline scripts; other harness has equivalent denial.
     Re-run full ATR-ADV-1 against actual UI before private data; safe escaping
     makes admissible payloads fully inspectable, rejection exposes only safe codes.
  9. Read-only metadata/explainability feasibility card shows narrator/series/
     category coverage and uncertainty. Separate clearly marked **synthetic-only**
     trace demonstrates shared-facet edges, never mixes mock preferences with
     the participant's records or presents a recommendation.
  10. Sanitized report model excludes all personal fields by construction.
      Geordi records manual/automated applicable WCAG 2.2 AA or equivalent native
      checks; platform/runtime and AT version recorded.
- **Specific DoD:** DoD-A; full exposed-flow security/a11y regression, not polish.
  If a 500-book synthetic rendering fixture is used, record load/render duration,
  peak memory, fixture size and runtime as descriptive measurements only; no
  100ms/50MB pass claim and no increase to the real-data capture limits.

## ATR-S009 — Enforce prototype data lifecycle controls

- **Feature / epic / theme:** ATR-F09 / ATR-E03 / ATR-T03
- **Type / story:** Security/privacy feature. As a participant, I want tested
  export/stop/deletion so that consent does not surrender control of my data.
- **Priority / size:** CRITICAL / L, **5 points**; WSJF 3.00; security override.
- **Depends on:** S002, S003, S013, G1. **Unblocks:** G2, S004.
- **Owner:** Data. **Review gates:** Worf (blocking runtime gate), Geordi (consent/controls).
- **Requirements:** ATR-PR05, PR06, PR10, PR11.
- **Acceptance criteria:**
  1. Consume S013 runner/shared security components. Fixture-prove every S002
     boundary rule including refusal/no collection, signed consent/expiry/
     withdrawal, encryption, protected keys, retention and derivative suppression.
  2. Versioned JSON export contains only schema-allowed snapshot/provenance/limits,
     never secrets. Unknown/newer versions rejected. Round trip is contract-level
     schema load/canonical compare of S003 instances, **not S006 source normalization**.
     No CSV/TSV; future tabular export needs formula-injection controls.
  3. Stop/disconnect prevents subsequent access, cancels in-flight work and removes
     local tokens; revoke by supported mechanism or give explicit provider steps.
     Import mode forgets file references. Disconnect retains normalized data/
     sentinel until separate delete/expiry. Test restart and blocked future access.
  4. Geordi approves and tests accessible consent/export/disconnect/delete surface
     before G2 using S008 AC4–7 standards; no dependence on later S008 completion.
     Decline is equally reachable. Export privacy warning and deletion limits
     announced before action, not after.
  5. Crypto-erase all app-managed personal data in one encrypted container by
     destroying its key and deleting managed artifacts; test restart and canary
     searches across raw/normalized/temp/extraction/cache/snapshots/credentials,
     database WAL/journal/shm, OS index/thumbnails, swap/undo, shell history,
     clipboard, dumps/core, terminal scrollback, and prior app-managed exports.
     Prevent spill to those external locations, verify absence; do not place actual
     personal data there. User-directed export copies leave custody only with warning.
     Disclose provider/user-held copies and SSD unlinked-block limits; no secure-
     overwrite guarantee. Participant verifies MFA and reviews connected apps/devices.
  6. Complete dated dependency/vulnerability/license/lockfile and credential-absence
     checks before G2; unresolved critical/high vulnerability blocks. Runtime,
     package and boundary changes require Worf reapproval, not notification.
  7. Personal storage/exports/keys never created in repo/cloud-sync path. Enforce
     ignore rules as defense in depth, local pre-commit secret/canary scan and
     staged-diff check; demonstrate fail-closed canary rejection without committing.
  8. Default-deny egress enforced and observed: import/inspector/normalizer have zero
     outbound destinations; API fixture probes reach only approved destinations
     (exercise routing with controlled synthetic network fixtures before G2,
     never actual source/catalog endpoints). Nonallowlisted/AI/
     source-URL probes fail closed with safe error; record allowed/observed sets.
  9. Run realistic fixtures and ATR-ADV-1; assert diagnostic **category** allowlist
     across logs/errors/traces/exit output, not just canary absence. Crash/telemetry
     off. Incident drill proves stop/revoke/notify/escalate/closure procedure.
  10. Present all G2 tests 1–12 from the gates with evidence from S013/S009 shared
      components; Worf witnesses fixtures only. No claim that actual-adapter G3/G5
      regression is already approved.
- **Specific DoD:** DoD-A; completed lifecycle artifact allows G2 review, not self-approval.

## ATR-S010 — Lock executable recommendation trust contracts

- **Feature / epic / theme:** ATR-F10 / ATR-E04 / ATR-T03
- **Type / story:** Trust enabler. As a listener, I want a closed evidence boundary
  so that future ranking cannot admit paid influence or invented preferences.
- **Priority / size:** CRITICAL / S, **2 points**; WSJF 5.50.
- **Depends on:** S003, S013, G1. **Unblocks:** S011, S012.
- **Owner:** Data. **Review gates:** Worf (profiling/route policy), Wesley (discovery), Geordi (honesty).
- **Requirements:** ATR-PR05, PR08, PR09, PR10, PR13.
- **Acceptance criteria:**
  1. Versioned allowlist-only candidate/result contract rejects unknown fields at
     every nesting level, including arbitrary novel field `nebula_weight`.
     Commercial/affiliate/sponsorship/promotion/margin/provider-preference and
     source ordinal/retrieval rank excluded. Required route provenance rejects
     affiliate/advertising-bound sources, not merely fields.
  2. Every accepted synthetic candidate carries resolvable ExplainabilityTrace
     pointers to known history/preference and catalog nodes, supporting signals,
     rule/algorithm version and uncertainty. Missing/dangling/floating claims rejected.
  3. Test exact labels: DIRECT_MATCH requires explicit high-affinity evidence;
     EXPLORATORY requires supported adjacent-facet evidence; PERSPECTIVE_BROADENING
     requires sourced uncertain/correctable divergent-viewpoint or category evidence
     plus explicit baseline relevance/quality/credibility and user content/language/
     safety/accessibility passes. Category difference alone is not proof of viewpoint.
     Exploratory/broadening cannot mislabel itself DIRECT_MATCH.
  4. Paired fixtures vary commercial offers and retrieval order: accepted canonical
     evidence identical or both rejected; unknown fields rejected. This proves
     contract invariance only, not ranker invariance.
  5. Fixtures reject political/sensitive identity and ideology proxies, unsupported
     perspective labels, unsafe/low-quality false balance and invented history.
     Missing viewpoint evidence disclosed; only supported exploratory label allowed.
     Future familiar/exploratory controls cannot deliberately enforce ideological isolation.
  6. No engine, generated explanation, recommendation, model, AI SDK/credential or
     egress. Deferred suite explicitly covers ranking quality/set concentration,
     grounding and proxy leakage; prompt instruction/data separation, candidate/ID
     containment, invented title/metadata/history rejection, no model tool/network/
     credential/database authority, cross-user/embedding isolation and hosted-consent security.
- **Specific DoD:** DoD-A; synthetic contract tests only, no semantic ranking claim.

## ATR-S011 — Decide architecture from measured access evidence

- **Feature / epic / theme:** ATR-F11 / ATR-E05 / ATR-T01
- **Type / story:** Decision enabler. As the Captain, I want evidence-led choices
  so that the next increment does not inherit a speculative platform.
- **Priority / size:** CRITICAL / S, **2 points**; WSJF 5.00.
- **Depends on:** G3, S010. **Unblocks:** G4, S012.
- **Owner:** Data. **Review gates:** Worf, Geordi, Wesley, Riker.
- **Requirements:** ATR-PR05, PR07, PR10, PR16.
- **Acceptance criteria:**
  1. Compare native/cross-platform iPhone, hosted web and local-first/import shapes
     under S001 pre-registered rules and actual S004/S005/S006 measurements.
     Label measured/estimated/not-applicable; no invented speed or memory budget.
     Include privacy/cost, authorization, storage, background limits and accessibility
     API maturity with VoiceOver/TalkBack or screen-reader-tested web evidence as applicable.
  2. Propose client/service/backend/storage boundaries with named ports and what a
     platform change affects. Every backend/refresh/storage conclusion cites a
     measurement or documented constraint; reject unsupported assertions and scraping.
  3. Only after G3 may product technology be proposed; G4 accepts before future
     implementation. If G3 fails, Riker issues no-go; this story remains blocked/
     STOPPED and all product choices remain TBD.
  4. Deterministic operation is the future useful product; LLM optional and provider
     TBD, consent never coerced. No SDK or provider choice here.
  5. Record observable reversal triggers (permission revoked, measured caps exceeded,
     required field absent, accessibility API fails target), experiment scope and
     public-branding/privacy questions. No alpha audio; any future audio off by
     default, optional, supplemental and never competing with audiobook playback.
  6. Dated platform-specific threat model/re-review at G4: iOS key classes,
     background/deep-link/pasteboard/lock-screen exposure; hosted token custody,
     sessions/CSRF/TLS/headers/data custody; local disk/backups/shared workstation.
     Record chosen model and required Worf re-review before implementation.
- **Specific DoD:** DoD-A; decision record only, no platform build/migration.

## ATR-S012 — Assemble a reproducible alpha decision pack

- **Feature / epic / theme:** ATR-F12 / ATR-E05 / ATR-T01
- **Type / story:** Release enabler. As the Captain, I want reproducible evidence
  so that I can approve or stop without confusing feasibility with the MVP.
- **Priority / size:** CRITICAL / M, **3 points**; WSJF 4.33.
- **Depends on:** S007, S008, S009, S010, S011, S013, G4. **Unblocks:** G5, then G6.
- **Owner:** Riker. **Review gates:** Data, Geordi, Worf, Wesley; Captain decides release.
- **Requirements:** ATR-PR05, PR06, PR08, PR10, PR11.
- **Acceptance criteria:**
  1. Exact setup/commands, runtime/OS build/lockfile hash, fixture/version source,
     route/rights/coverage, storage/retention, recovery and limitations; no private
     exports/screenshots. Reproduce sanitized workflow by a second officer.
  2. Publish fixture digests, descriptive measurement table, source semantic audit,
     uncertainty and observed-unmodeled summary; participant's sanitized real-path
     attestation, not personal content. Real replay needs new consent/capture.
  3. Security annex contains negative egress and redaction records, deletion
     inventory/restart/canary scans, dated dependency/license/vulnerability rechecks
     (first done at G2), destruction receipts, private consent reference only,
     disqualified routes and incident runbook. Missing item blocks G5.
  4. Record tests 1–15 against final adapter/normalizer/inspector via safe fixtures
     and approved-run control evidence; actual egress/cleanup from consented run.
     Full a11y flow and trust tests; no pass on unrun test or unsafe live fault injection.
  5. All officers review; re-score FMEA on executed evidence, no open security/a11y
     blocker or residual RPN >=100. R08/R09 residuals explicitly alpha-contract-only,
     reopened before any ranker; R04/R06/R07 re-scoring restrictions apply.
  6. Changelog draft, private feasibility/import-only wording, no sync service,
     supported environment, cleanup/rollback, deferred features and G6 request.
- **Specific DoD:** DoD-A; ready-for-decision is not permission to publish/commit/push.

## ATR-S013 — Build the fixture-only secure harness

- **Feature / epic / theme:** ATR-F13 / ATR-E03 / ATR-T03
- **Type / story:** Shared security/test enabler. As a participant, I want attack
  and failure paths tested before collection so that safety is not built afterward.
- **Priority / size:** CRITICAL / L, **5 points**; WSJF 3.00; security/dependency override.
- **Depends on:** S002, S003, G1. **Unblocks:** S009, S010, S006, S008.
- **Owner:** Data. **Review gates:** Worf (preflight), Geordi (safe renderer/controls),
  Wesley (fixture clarity). Runtime choice requires G1, not a product-platform choice.
- **Requirements:** ATR-PR05, PR06, PR07, PR10, PR11.
- **Acceptance criteria:**
  1. Sole owner of minimal disposable harness/test runner and one release-version
     source of truth; no duplicated constants. Record runtime and justified pinned
     dependencies/lockfile; no install scripts, AI SDK or product-stack commitment.
  2. Build reusable bounded pre-ingest/parser, schema-validation/normalization
     security core, inert fixture renderer, guarded store/clock/ID ports, diagnostic
     allowlist and default-deny network wrapper. No real adapter field mapping,
     polished inspector, persistent reviews or recommendation engine.
  3. Before any real-data story, execute ATR-ADV-1 through parser, normalization
     core, renderer/export boundary and fault paths: cancellation, denial, malformed
     input, interruption, timeout. No code/control/path/identity injection, navigation,
     outbound renderer request, trust-marker loss or private-category diagnostics.
  4. Test archive selection/caps/traversal/UNC/symlink/bomb refusal; credential-absence
     scan; dependency/egress probes and safe error handling. Provide reusable
     evidence commands for G2 tests 1–8 and 10–12; S009 completes lifecycle tests.
  5. Geordi reviews renderer/reflow/focus/text/status with synthetic fixtures before
     code and verifies it afterward against S008 relevant AC4–8. Worf verifies
     shared security boundary. Downstream mapping/UI must reuse these components
     and re-run corpus before personal inputs; this is not blanket approval.
- **Specific DoD:** DoD-A; fixture-only shared preflight. No account, personal
  export, signed real consent collection or actual source request is authorized.
