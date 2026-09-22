# Native iPhone direction — OF-007

**Date:** 2026-09-17

**Status:** Owner product direction recorded; architecture and implementation
unapproved. Planning only, no runtime or connection change.

**Final web-alpha clarification — 2026-09-21:** Settings selects independently
constructed default LCARS or opt-in Apple-style Liquid Glass shell markup,
with a persistent browser-only theme preference. Apple mode has its own
navigation bar, Library/Data/Settings tabs and contextual back navigation;
LCARS chrome is not instantiated then hidden. Shared neutral views/state are
retained with neutral `--atnr-*` tokens. Apple styling references no `--lcars-*`
tokens and disables both LCARS-only sheets; activation is generation-guarded
against stale imports.
[12's provenance record](12-accumulated-implementation.md#apple-design-resource-provenance-and-native-limits)
verifies Apple's iOS 27/iPadOS 27 resource listing and Materials guidance.
This is a semantic HTML/CSS/JS interpretation, not imported Apple artwork,
native refraction/Dynamic Type, direct OS accessibility integration, or proof of
iOS support. It does not select SwiftUI/UIKit, change minimum OS support,
authorize native custody or permit phone access to the private loopback server.

Apple HIG, documented Apple APIs and Design Resources are normative. Google
image search is permitted only as non-normative inspiration: no copying,
tracing, bundling or hotlinking third-party imagery/UI assets, and no uploading
private data or captures. The final #1–#14 remediation, independent-review
fixes, both-theme synthetic capture/purge and live private page/theme matrix
are web-prototype evidence, not UIKit/SwiftUI
equivalence, physical iPhone/Safari/VoiceOver validation or an Apple endorsement.
Native client/service selection still follows supported-access evidence and
A2-G3/G4; [12](12-accumulated-implementation.md) records remaining gaps.

The delayed Data-audit fixes (separate completion/position evidence, closed
provenance, contextual private diagnostics, non-destructive inventory,
schema-only filter migration and truthful persisted sync counts) refine this
web evidence only. The account-bound last-import sidecar is not an iOS storage
design or portable credential mechanism; parsing a snapshot remains Unknown /
not an import. No physical-device/VoiceOver or current provider-revocation
evidence is inferred from the updated automated suite.

Authority: [product description](../../APP_DESCRIPTION.md),
[OF-007](06-owner-feedback.md#of-007--native-iphone-destination-and-future-capturehandoff),
[scope](02-scope.md) and [A2 gates](05-risks-and-release-gates.md).

## Scope placement

The intended destination is a **native iPhone app with a Swift client**.
SwiftUI versus UIKit/composition, minimum iOS/device support, storage engine,
service topology and connector implementation remain reviewed decisions.
The web/Node/Python Windows alpha is disposable feasibility evidence until a
reviewed native architecture exists, not a production core to wrap by default.
Disposable implementation does not mean disposable user data.

| Placement | Decision |
| --- | --- |
| Alpha 0.0.2, existing S014 | Record native intent and runtime-neutral authority/portability constraints in existing boundary decisions |
| Alpha 0.0.2, existing S042/A2-G4 | Collect existing measured architecture/ADR evidence after A2-G3; test assumptions against native intent and record blockers, not a native build or new spike |
| Future native plan | Detailed native design, implementation, migration, deployment and the two capabilities below; separately reviewed and baselined |

**Inventory unchanged:** 4 themes, 8 epics, 30 features, 30 stories,
112 estimated points; unchanged dependencies, execution waves, gate states and
20% capacity buffer. Future estimates below are not added to that inventory.
No recommendation generation, ranking, recommendation feedback, LLM, camera,
native migration or Audible handoff implementation belongs in 0.0.2.
OF-006's iPhone Air Safari target remains web-alpha usability evidence, not
permission to expose loopback over a LAN, alter the running connection or
claim Safari tests prove native readiness.

## Architecture decision and portability

Data owns the existing S042/A2-G4 comparison/ADR with Worf threat review,
Geordi accessibility and Wesley usefulness input; Captain approves the final
architecture. None of those approvals is claimed here. Cite actual A2-G3
library/history/progress/non-owned catalog evidence, rights, missingness and
reversal triggers. If unavailable, record HOLD/STOPPED; native intent cannot
waive the four-domain gate or silently replace it with a manual import route.

The comparison must distinguish native on-device integration, any separately
approved service/adapter boundary, and prototype-only evidence. Measure actual
constraints with approved evidence rather than assume a backend is required
or permitted. No new hosted service, personal experiment or connector port is
authorized within this clarification. Work exceeding the existing decision
story requires explicit re-estimation and change control, not hidden points.

- **Authentication:** Prefer documented supported provider authorization.
  A future reviewed iOS provider-hosted browser/authentication session must
  validate origin, state, PKCE and callback ownership as applicable. Never
  collect, relay, implement or automate provider passwords, passkeys/WebAuthn,
  MFA codes or session cookies. No embedded credential form, password-manager
  SDK/CLI, vault access, browser-profile extraction or clipboard credential
  capture. Provider authentication alone does not grant API access.
- **Key custody:** iOS Keychain is the intended custody facility for approved
  tokens and encryption keys, not ordinary files, preferences or logs.
  Worf must choose accessibility class, device-only/non-synchronizing policy,
  access groups, locked-device behavior and revocation/rotation. Do not enable
  iCloud Keychain/backup transfer or relax key accessibility merely to run in
  background. Same-user compromise, runtime plaintext and device compromise
  remain threat-model limits; uninstall is not proven Keychain deletion.
- **Local encrypted persistence:** Encrypt library, history, progress, ratings,
  comments, tags and derived private data, with reviewed key lifecycle and iOS
  Data Protection. A local database or device lock alone is not sufficient
  evidence. Include sidecars, temporary files, backups, logs, crash reports,
  retention, locked-device failures and interrupted writes. Explain external
  export-copy limits; no forensic-erasure promise.
- **Background refresh:** iOS scheduling is opportunistic, not a guaranteed
  15-minute service. Suspension, force-quit, low power, locked keys and network
  loss may prevent work. Foreground/manual refresh and honest last-attempt/
  last-durable-success/stale states must remain useful. Bound and cancel work,
  checkpoint atomically and preserve idempotency. No silent retries, new caps,
  remote push infrastructure or source-access expansion follows from intent.
- **Accessible native LCARS:** Geordi approves mobile-first hierarchy,
  safe-area/keyboard handling, Dynamic Type including accessibility sizes,
  VoiceOver order/labels/announcements, Switch Control and external keyboard
  journeys, reduced motion, contrast and non-color status. Target at least
  44×44 pt primary controls; CSS px evidence is not an iOS point measurement.
  Preserve native interaction semantics over decorative LCARS framing and
  test actual supported devices/assistive technology before clearance.
- **Portable contracts, not runtime reuse:** Preserve versioned normalized
  book/contributor IDs, account isolation, provenance, explicit unknowns,
  progress units, sync checkpoints, local annotation authority and conflict
  semantics. Reuse contract specifications and invented golden fixtures, not
  assumptions about Node/Python/DPAPI or byte-compatible SQLite stores.
  S026/S028–S032 supply identity/export/lifecycle evidence, not an iOS importer.
- **Future migration:** Require an explicitly user-initiated, separately
  reviewed export/import path with version validation, bounded parsing,
  collision/ambiguity resolution, semantic round trips and rollback.
  Never copy provider credentials, DPAPI keys or live state into a native
  bundle; reauthorize separately by an approved route. Re-encrypt under iOS
  custody. Preserve private feedback, removed entries, provenance and source
  uncertainty; failed transfer must leave the original intact. No automatic
  Windows-store migration, cloud sync or source-import exception is granted.

## Community connector and rights boundary

The existing `audible` 0.12.0 connector is unofficial, community-maintained
and reverse-engineered. Its narrow private US/library-only exception,
Windows/Python custody and “Audible for iPhone” provider device label are
**not** proof of an iOS implementation, supported mobile API or distribution
rights. Do not claim the current Python connector can ship inside an iPhone
app. Its label must not be repurposed as compatibility or affiliation evidence.

Research official documented API/export options first. Any reuse, port,
reimplementation or remote connector service needs named qualified legal
review of Audible/Amazon terms, upstream and transitive GPL/AGPL obligations,
source/conveyance and network-service obligations where applicable, and Apple
distribution compatibility. Rewriting in Swift or placing Python behind a
service does not automatically resolve licensing or provider terms.
Record dated authoritative support and legal disposition; technical success
is not permission. Worf/Data must review maintenance, endpoint changes,
revocation and incident response. Do not grant new routes/caps or sidestep
the previously rejected personal-export source route.

## Future backlog

These are **two uncommitted feature candidates**, not new ATR-S014–S043
stories or a native sprint commitment. Split into INVEST-sized stories with
per-story estimates/criteria before implementation; do not count both feature
and child estimates. Relative planning scores use BV/TC/RR 1–5 and
WSJF = (BV + TC + RR) / Size; sorted descending. Re-score at future planning.

| ID | Title | BV | TC | RR | CoD | Size | WSJF | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| NAT-F02 | User-initiated Open in Audible | 4 | 2 | 3 | 9 | 3 | 3.00 | HIGH |
| NAT-F01 | Camera/barcode physical-title ingestion | 5 | 2 | 3 | 10 | 8 | 1.25 | LOW |

Priority reflects relative future value/size, not permission. Handoff is a
small useful action once catalog/recommendation prerequisites exist; ingestion
is broader identity/privacy/metadata work with no current release deadline.
Security findings block regardless of score; accessibility defects are HIGH.
Future-only indicative total **11 points** is excluded from the 112 points.

### NAT-F01 — Camera/barcode physical-title ingestion

**Story intent:** As a listener, I want to scan a physical book or other
non-Audible physical media so that I can confirm and keep it in my local
library without pretending it is an Audible acquisition.

**Status:** FUTURE / NOT AUTHORIZED. **Owner:** Data; Geordi owns capture UX.
**Reviewers:** Worf, Geordi, Wesley, named metadata-rights reviewer.
**Dependencies:** Approved native architecture/security design; camera design
and Captain new-surface approval; licensed metadata route; native identity,
local-authority, encrypted persistence, export/deletion and migration contracts.
S026/S028–S032 are prerequisite evidence, not delivered native components.
**Enables:** User-confirmed non-Audible local holdings; no source-progress
mutation or recommendation generation.

Acceptance criteria for future decomposition:

1. Ask for explicit camera permission only after the user chooses Scan, with a
   clear purpose. Denial, revocation, cancellation and unavailable camera leave
   manual entry usable. Scan on-device where feasible; no photo-library access
   or retained images/video by default, including caches, logs or diagnostics.
2. Validate supported ISBN-10/ISBN-13 and EAN forms/check digits, lengths and
   normalization; a syntactically valid code does not prove a book match.
   Unsupported/ambiguous media identifiers lead to correction/manual entry,
   not arbitrary QR URL navigation or guessed ASIN conversion.
3. Before any hosted metadata lookup, disclose destination, purpose and exact
   fields leaving the device and obtain explicit consent. No hosted image/code/
   title egress without it. Declining or being offline preserves manual entry.
   Default remains no image retention; any future opt-in image path needs new
   review rather than treating camera permission as upload consent.
   Hosted OCR and photo-library access are separate permissions/reviews, not
   implied by Scan. Decoded barcode/QR text is untrusted input, never executable
   content or an arbitrary navigation/lookup command.
4. Use only approved metadata sources with documented rights, attribution,
   caching/export/deletion limits and field-level provenance/retrieval time.
   Do not scrape or infer rights from a publicly reachable lookup. Missing or
   conflicting metadata remains explicit.
5. Show candidate title, contributors, edition and media format for user
   confirmation before saving. Allow correction and manual fields, preserve
   user overrides separately from fetched provenance, and label unresolved
   identity. No silent addition on scanning or lookup success.
6. Repeated scans identify duplicates using validated identifiers and edition/
   format distinctions. Offer explicit keep separate/link/resolve choices;
   never merge by title/name alone or transfer ratings silently. Distinguish
   print, physical audio and Audible digital editions; source/ownership is
   separate from media format. A physical holding confers no Audible ownership,
   completion or progress.
7. Local holdings, corrections and feedback remain locally authoritative;
   Audible sync cannot remove or overwrite them. Include all new fields and
   provenance in encrypted storage, portable export and genuine local deletion,
   with external-copy limits disclosed.
8. Test denied permission, offline/no consent, bad check digits, unknown codes,
   multiple matches, wrong edition, repeated scan, save interruption and
   export/delete. VoiceOver, Dynamic Type, focus and manual fallback provide
   an equivalent usable journey; no camera-only task.

### NAT-F02 — User-initiated Open in Audible

**Story intent:** As a listener viewing a future recommendation or title,
I want to open its Audible product/purchase page so that I can inspect it
and decide for myself in Audible.

**Status:** FUTURE / NOT AUTHORIZED. **Owner:** Geordi; Data owns link contract.
**Reviewers:** Worf, Data, Wesley and named legal/store-policy reviewer.
**Dependencies:** Approved native architecture; approved recommendation/catalog
phase with lawful product metadata and marketplace identity; documented link
support and store/commerce-policy review; Captain-approved handoff UX.
S041 catalog feasibility alone does not approve that phase or a recommender.
**Enables:** Explicit external navigation only, not purchase or rank generation.

Acceptance criteria for future decomposition:

1. Use only dated documented Audible-supported universal/deep links, verified
   for the intended marketplace and target product. If undocumented or
   unreliable, use only an approved allowlisted HTTPS product-page fallback;
   do not invent a custom scheme or claim direct app routing is guaranteed.
2. Build destinations from trusted fixed templates and a validated ASIN/product
   identifier plus approved marketplace mapping. Enforce identifier syntax and
   provenance/product match; ISBN alone is not an ASIN. Reject missing/malformed/
   mismatched IDs, arbitrary URLs, injected paths/queries, credentials and
   unapproved hosts/schemes. External text cannot supply a navigation target.
3. A clearly labeled, accessible **Open in Audible** action names the title and
   explains the external handoff. Only a deliberate user action opens it;
   no auto-open on recommendation display, scan or refresh. No automatic
   purchase, cart mutation, credential collection or payment handling.
4. Test installed-app routing, Audible absent, unsupported link, unavailable
   regional product, no network and browser/open failure. Offer the approved
   HTTPS fallback with clear browser disclosure, or a truthful unavailable
   state; never force installation or navigate to an arbitrary replacement.
5. Opening a link proves neither page arrival nor purchase success. Do not
   mark purchased/owned/completed or change listening state on callback/return.
   Preserve browsing context and usable return focus; no purchase-success
   tracking or background polling.
   Do not probe installed-app presence in the background or retain an app
   inventory. Any platform capability check must be separately reviewed,
   user-action-scoped and non-persistent; prefer the approved direct handoff
   and truthful failure path.
6. No affiliate identifiers, attribution/tracking parameters, referral revenue
   or outbound analytics. Disclose unavoidable contact with Audible on handoff;
   do not attach private history/comments. Availability of a handoff cannot
   influence candidate eligibility, ranking or explanations, and no retailer
   or commercial signal enters the recommendation contract.
7. Negative identifier/URL fixtures and real approved device evidence cover
   VoiceOver names, Dynamic Type, touch/keyboard access, return flow and
   app-absent fallback. A visually correct button is not route proof.

### Future definition of done and sequencing

Both candidates require a separate reviewed native plan and reconciled specs
before code: Wesley/Geordi design, Data architecture/performance, blocking Worf
security, named legal/metadata/store review as applicable, Captain new-surface
approval. Child stories need tests for every criterion and failure path,
synthetic fixtures, privacy/egress canaries, lifecycle and accessibility proof,
updated docs and zero blocking findings. Live device/provider tests require
specific authorization. Full team review and Captain release approval remain
mandatory; DONE for code is not distribution permission.

Future order: source/rights proof → reviewed native architecture and custody →
native contracts/lifecycle/accessibility → dependency-ready child stories in
WSJF order. Camera metadata rights and identity must precede ingestion;
approved recommendation/catalog phase and documented links precede handoff.
No LLM is necessary for either; deterministic useful behavior remains required.

## Future native risks

Initial estimates only; no mitigations executed or residuals approved.
S/O/D are 1–10, RPN = S×O×D; occurrence is not a measured probability.
These are future design risks, not new A2 delivery commitments.

| Risk | Failure / effect | S | O | D | RPN | Current control / gap; action and owner |
| --- | --- | --- | --- | --- | --- | --- |
| NAT-R01 | Connector/AGPL/terms or Apple rules prohibit intended shipping | 10 | 7 | 6 | 420 | Private NO-GO; native rights unproven. Named legal review and supported-route/STOP decision; Riker/Worf |
| NAT-R02 | Key/backup/migration exposes or loses private feedback | 9 | 5 | 6 | 270 | Runtime-neutral contracts only. Native custody, residue, semantic round-trip and rollback evidence; Worf/Data |
| NAT-R03 | Background limits cause false freshness or weaken key protection | 7 | 7 | 5 | 245 | No native scheduler evidence. Locked/suspended/offline tests and manual refresh; Data |
| NAT-R04 | Camera metadata leaks or wrong edition corrupts local identity | 8 | 5 | 6 | 240 | No capture route approved. Consent, no-image default, rights, confirmation and duplicate fixtures; Worf/Data |
| NAT-R05 | Malicious/unsupported handoff misroutes or implies purchase | 8 | 5 | 5 | 200 | No link support proven. Documented templates, identifier validation, absent-app and no-success tests; Worf/Geordi |
| NAT-R06 | Native capture/LCARS excludes assistive-technology users | 7 | 5 | 5 | 175 | Safari evidence not native proof. Device AT tests and equivalent manual flow; Geordi |

Before future implementation, reconcile design mitigations and blocking
reviews; before release, execute controls and re-score every applicable RPN
below 100. Security/legal/accessibility blockers cannot be waived by a score.

## Deployment and release gates

All pending; no upload, packaging, signing, TestFlight or App Store submission
is authorized by this document.

1. **Architecture:** A2-G3 source evidence and existing A2-G4 decision remain
   required; approve a separate detailed native plan/threat model and updated
   FMEA before implementation. Product intent is not architecture proof.
2. **Rights and custody:** Named legal review must clear actual connector,
   dependencies, metadata, provider terms, branding and Apple commerce/
   external-link rules for the chosen audience/region. Worf must approve
   actual iOS custody, egress, authentication and incident controls.
3. **Native device readiness:** Validate supported iOS/device matrix, accessible
   workflows, lifecycle/export/delete/migration, offline/background/locked-key
   behavior, revoked auth and handoff fallbacks. Record measured budgets and
   synthetic evidence; real data tests stay separately consented.
4. **Deployment/TestFlight:** Signing identity, provisioning, entitlements,
   privacy manifest/required-reason API declarations, camera purpose text,
   dependency/license inventory, privacy disclosures and retention/support
   policy must be reviewed. TestFlight is conveyance/distribution, not a
   loophole: current package/binary/store NO-GO requires explicit new Captain
   change control plus legal/security approval before even a private upload.
5. **Audience and stores:** Preserve owner + at most ten named testers as a
   ceiling, not clearance; any source conveyance also needs existing gates.
   Commercial/public/App Store shipping remains **HARD NO-GO**. A future
   public release needs separate scope/audience authorization, full officer
   review, legal/licensing clearance, Apple review and explicit Captain release
   decision. Do not disable existing mechanical shipping guards.
