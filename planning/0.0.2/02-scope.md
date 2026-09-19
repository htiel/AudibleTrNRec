# Alpha 0.0.2 scope and hierarchy

See [charter](01-release-charter.md), [canonical stories](03-backlog.md) and
[gates](05-risks-and-release-gates.md). IDs continue rather than reuse 0.0.1
IDs. Each feature has one same-numbered story: F14 → S014 through F43 → S043.
All point figures are estimates. The inventory is **112 points**, not a
delivery forecast.

The [review consensus](09-review-consensus.md) and
[backlog correction requirements](03-backlog.md#review-correction-acceptance-addendum)
refine these existing slices; they add no feature, story or points.
S031 owns the revision-frozen **persisted** schema as well as the domain
contract. S028/S029/S030 consume that revision before S032 implements storage;
this removes a design-ownership cycle without changing execution dependencies.

## Themes and epics

| Theme | Outcome | Epic | Features / stories | Points |
| --- | --- | --- | --- | --- |
| ATR-T04 — Trustworthy private foundation | Safe access and correct durable library | ATR-E06 — Boundary remediation | F14–F20 / S014–S020 | 24 |
| ATR-T04 | Same | ATR-E07 — Source and identity integrity | F21–F27 / S021–S027 | 26 |
| ATR-T05 — Durable private feedback | User owns and can remove their feedback | ATR-E08 — Lifecycle and migration | F28–F30 / S028–S030 | 15 |
| ATR-T05 | Same | ATR-E09 — Per-book feedback | F31–F33 / S031–S033 | 13 |
| ATR-T06 — Accessible library control | Understand, navigate and recover without lost context | ATR-E10 — LCARS and evidence honesty | F34–F36 / S034–S036 | 10 |
| ATR-T06 | Same | ATR-E11 — Facets and feedback-aware navigation | F37–F38 / S037–S038 | 6 |
| ATR-T07 — Evidence before clearance | Prove or explicitly stop; no implied permission | ATR-E12 — Gated source feasibility | F40–F41 / S040–S041 | 6 |
| ATR-T07 | Same | ATR-E13 — Verification and release control | F39, F42–F43 / S039, S042–S043 | 12 |

Theme totals: T04 **50**, T05 **28**, T06 **16**, T07 **18**.
Totals: **4 themes / 8 epics / 30 features / 30 stories / 112 points**.

## Feature inventory and traceability

Names define independently reviewable capability slices; implementation details
are negotiated at design review without weakening acceptance criteria.

| Feature | Story | Capability | Product brief section / inherited finding |
| --- | --- | --- | --- |
| ATR-F14 | S014 | Approved boundary and recovery contracts | Privacy; synchronization; A003–A005, A016–A017, A049 |
| ATR-F15 | S015 | Owner-only loopback session boundary | Account connection/privacy; A001, A047; manual local authentication removed by owner change control on 2026-09-18 |
| ATR-F16 | S016 | Trusted executables and custody order | Security; A002, A021 |
| ATR-F17 | S017 | Provider-origin validation and owned-browser cleanup | Account connection; A019, A046 |
| ATR-F18 | S018 | Verified dependency provenance | Security/terms; A018 |
| ATR-F19 | S019 | Supported runtime preflight | Deployment evidence; A010 |
| ATR-F20 | S020 | Python disclosure/egress guard coverage | Security; A020, A048 |
| ATR-F21 | S021 | Correct progress units | Library/progress; A003 |
| ATR-F22 | S022 | Complete bounded pagination | Synchronization; A004, A037 |
| ATR-F23 | S023 | Recoverable malformed records and contributor limits | Synchronization; A005, A006 |
| ATR-F24 | S024 | Durable removed-entry reconciliation and reference integrity | Local authority/sync; A007, A008, A034 |
| ATR-F25 | S025 | Account-isolated library presentation | Security; A009 |
| ATR-F26 | S026 | Canonical contributor/book IDs and migration mapping | Catalog person/model; A011, A012 |
| ATR-F27 | S027 | Truthful attempts and durable-success status | Synchronization; A029, A030, A039, A051 |
| ATR-F28 | S028 | Complete safe export | Export/privacy; A016 |
| ATR-F29 | S029 | Deletion, retention and key lifecycle | Deletion/privacy; A017, A045 |
| ATR-F30 | S030 | Versioned migration and rollback recovery | Persistence/testing; A012 |
| ATR-F31 | S031 | Explicit private per-book feedback contract | Ratings/comments, User Review; former deferred ratings inventory |
| ATR-F32 | S032 | Encrypted account-keyed feedback persistence | Local authority/privacy |
| ATR-F33 | S033 | Accessible create/edit/delete feedback | Ratings/comments, accessibility |
| ATR-F34 | S034 | LCARS responsive, keyboard and AT workflow | Accessibility; A022, A023, A041 |
| ATR-F35 | S035 | Truthful synthetic/live, unknown and error states | Evidence/UX; A015, A024, A028 |
| ATR-F36 | S036 | Category-only candidate diagnostics | Untrusted-input handling; A033 |
| ATR-F37 | S037 | User-controlled facet browsing | Library facets; A025, A026, A043 (navigation only) |
| ATR-F38 | S038 | Preserved filters and feedback-aware views | Library sort/filter/control; A042, A044 |
| ATR-F39 | S039 | Automated failure, recovery and migration evidence | Testing; A049 |
| ATR-F40 | S040 | Listening-history route investigation | Feasibility; A013 |
| ATR-F41 | S041 | Non-owned catalog route investigation | Feasibility; A014 |
| ATR-F42 | S042 | Witnessed gates and officer closure | Release readiness; A049 |
| ATR-F43 | S043 | Accurate documentation and Captain decision | Release/change control; A050 |

## Current architecture: observed, not selected as the final product

**Updated after implementation review, 2026-09-17.** The inventory above is
unchanged; [11](11-implementation-release-verdict.md) distinguishes implemented
owner-use capability from unfinished gate evidence and source feasibility.

The [OF-007 native direction](07-native-iphone-direction.md) makes Swift/native
iPhone the intended destination. The current web/Python alpha remains disposable
feasibility evidence until a reviewed native architecture exists. S014 records
that boundary; S042 collects the existing A2-G4 architecture decision evidence.
No native spike, migration or implementation is added to this inventory.
OF-006's iPhone Air Safari work remains web-alpha UX evidence only.

Read against [implementation README](../../code/Alpha0.x/README.md) and
[package](../../code/Alpha0.x/package.json):

- Node ESM, zero npm dependencies, no build step, static HTML/CSS/modules and
  hash-routed UI with default LCARS and opt-in Liquid Glass appearance. The
  private user-facing path is real-encrypted-data-only;
  fixtures are test/demo infrastructure, never a private bootstrap fallback.
- The optional Windows-local composition is Node loopback service → serialized
  stdio RPC → isolated Python community connector → provider-hosted Edge
  authorization. Credentials stay on the Python side.
- SQLite revision 3 now includes encrypted private feedback, snapshot/sync,
  migration receipts and an opaque local account anchor: exactly five tables.
  Data's amendment accepts migration/feedback/isolation for owner use; the
  supplied real migration receipt contains schema/process evidence only.
- The service reconciles and durably promotes same-account state, exposes
  truthful attempts/success/suppression, and preserves retained feedback
  authority. Review limitations and incomplete source proof remain in 11.
- Supported Node/SQLite preflight is implemented; it does not select a final
  platform/backend. Supply-chain clean-install/audit evidence is still blocked.
- Current application implementation is 0.0.2; storage revision is 3. The
  version-shaped legacy custody root is retained as migration input, not
  automatically relocated. This verdict task performed no migration.

Implemented owner-use feedback boundary: session-protected local UI/API → bounded domain
validation → account/target-keyed encrypted local authority store.
The removed per-start key is not replaced with local-process authentication;
same-user process trust is accepted for the dedicated owner computer only.
Source-sync code has no write authority over annotations. Versioned migrations
can remap identities only through reviewed, transactional, collision-aware
mappings; ambiguous identity stays unresolved, never a name-based guess.
Current officer acceptance and remaining CP/evidence conditions are in 11.
Preserve existing safe DOM/URL rendering, commercial
exclusion and policy controls. Do not select a UI framework, hosted service or
LLM by inertia.

## Feedback and facets boundary

- One active private record per local account and canonical feedback target.
  Books support overall, story/content, and narration/performance dimensions.
  Author/narrator display groups and known series support an overall rating,
  comment, and tags from their group heading; they never inherit or overwrite
  book feedback. Equal-name contributor groups retain source IDs and disclose
  multi-source membership; this is not canonical identity merging. There is no
  automatic prior-feedback migration when group membership changes.
  The UI offers five whole-star radio choices; story/content and
  narration/performance are independent optional dimensions. Unrated is null,
  not zero or an inferred score. The persistence validator continues to accept
  legacy half-star values so existing feedback is never silently rounded.
- Comments/tags may exist without a rating. Created/updated timestamps, explicit
  source and revision/conflict semantics accompany local data. Users can edit,
  clear a dimension, delete feedback, export it and permanently delete local
  data. Exact proposed bounds and conflict behavior are in S031–S033.
- Facets cover available authors, narrators and series, plus status and local
  tags/rating filters. Genre/category is included only if approved source
  metadata can populate it automatically through a deterministic mapping;
  otherwise every visible Genre surface is removed rather than left
  permanently Unknown. Detail/matching-book views expose
  **book-level** feedback plus explicit author/narrator/series feedback. No
  genre rating editor, inferred affinity, ideology classification or automatic
  preference extraction in 0.0.2.
- Preserve filter/sort/group state during navigation, refresh and feedback
  saves within the local session. By owner change control on 2026-09-18, the
  last valid state is retained in versioned, bounded tab-scoped session storage
  so refresh does not reset the Library. Private query/tag values never enter
  URLs, logs, or long-lived local storage. Browser session restoration can
  retain tab state; this is not encrypted custody or guaranteed erasure.
  Cross-session saved searches still require new review.
- Settings (`#/settings`, header gear and sidebar) persists only a closed theme
  identifier in `localStorage`; LCARS remains default. The Liquid Glass web
  interpretation references verified Apple iOS 27/iPadOS 27 resources, not a
  native SDK or copied assets. [12](12-accumulated-implementation.md) records
  provenance, degraded-storage behavior and web/native/accessibility limits.

## Mandatory inherited work and explicit deferrals

All 0.0.1 release-blocking P0/P1 work is mandatory. The source register uses
severity plus Block/Hold/fix-before-evidence rather than a uniform P0/P1 field;
this plan preserves those distinctions rather than relabeling everything.
For scheduling, P0 = exposure/correctness stop work, P1 = remaining mandatory
clearance work, P2 = selected enhancements. See the full
[finding disposition matrix](03-backlog.md#inherited-finding-disposition).

The 30 mandatory IDs are A001–A011, A013–A024, A028–A030, A033–A034, A046,
A049. A029's mandatory portion is attempt recording, not a new retry policy.
A012 becomes mandatory before persistent feedback. No HOLD becomes PASS through
scope wording; A022 focus contrast is an evidence hold, not a proven ratio
failure. The 51 findings all receive explicit dispositions.

## Explicitly out of scope

Recommendation candidate generation, scoring/ranking, recommendation feedback,
LLM integration (local or hosted), generated explanations, embeddings and
sentiment analysis; public/cloud/multi-user/commercial deployment or conveyance
without clearance; native mobile/client migration and final implementation
selection (native iPhone product intent is recorded, architecture is gated);
Audible library/progress/rating writes; social/public reviews; genre ratings,
favorites/abandoned/listen-again editing; cross-device sync; remote covers/fonts;
new marketplaces; automatic retries/backoff or increased caps; production
background-sync infrastructure; manual personal-export import as a replacement
route (previously rejected, requires new change control).

Camera/barcode ingestion of non-Audible physical titles and user-initiated
Audible product/purchase-page handoff are explicitly
[future-backlog capabilities](07-native-iphone-direction.md#future-backlog).
They grant no camera/network permission, catalog endpoint, recommendation
generation or new 0.0.2 feature/story/points.

The only existing provider mutation preserved is explicitly authorized device
registration/deregistration lifecycle, not audiobook data mutation. Ads,
sponsored placement, credential capture and ideological profiling are
**prohibited**, not merely deferred.
