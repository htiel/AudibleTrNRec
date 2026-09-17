# Alpha 0.0.2 canonical backlog and stories

This document owns status, estimates, WSJF, dependencies and acceptance criteria.
See [hierarchy](02-scope.md), [sequence](04-sequencing.md) and
[gates](05-risks-and-release-gates.md). Short S/F/A IDs mean permanent `ATR-`
IDs. **30 stories / 112 estimated points**; no implementation is DONE.

OF-007's [native direction and future backlog](07-native-iphone-direction.md)
do not add S/F IDs or points here. Existing S014 records the direction and
runtime-neutral boundary; S042/A2-G4 retains the architecture evidence decision.
Two future capability estimates are separate from this release inventory.

## WSJF scoring

BV, TC and RR each range 1–5; CoD = BV + TC + RR. Size is relative points:
XS=1, S=2, M=3, L=5, XL=8. The table is sorted by exact WSJF descending,
then CoD descending, then ID. ≥4 CRITICAL; ≥2.5 HIGH; ≥1.5 MEDIUM; else LOW.
`*` = blocking security/privacy/evidence or at least three downstream items
requires CRITICAL regardless of score. `†` = accessibility minimum HIGH.
Scores are estimates, not evidence of incidence or elapsed time. Dependencies
and mandatory gates outrank the numeric order; P2 polish cannot displace P0/P1.

| ID | Title | BV | TC | RR | CoD | Size | WSJF | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| S019 | Supported runtime preflight | 4 | 4 | 4 | 12 | 2 | 6.00 | CRITICAL |
| S027 | Attempt and durable-success status | 4 | 4 | 4 | 12 | 2 | 6.00 | CRITICAL |
| S036 | Safe candidate diagnostics | 4 | 4 | 4 | 12 | 2 | 6.00 | CRITICAL |
| S043 | Release decision and documentation | 4 | 4 | 4 | 12 | 2 | 6.00 | CRITICAL |
| S014 | Boundary and recovery contracts | 5 | 5 | 5 | 15 | 3 | 5.00 | CRITICAL |
| S021 | Progress-unit correctness | 5 | 5 | 5 | 15 | 3 | 5.00 | CRITICAL |
| S018 | Dependency provenance | 5 | 4 | 5 | 14 | 3 | 4.67 | CRITICAL |
| S023 | Malformed-record recovery | 5 | 4 | 5 | 14 | 3 | 4.67 | CRITICAL |
| S025 | Account presentation isolation | 5 | 4 | 5 | 14 | 3 | 4.67 | CRITICAL |
| S017 | Provider origin and browser cleanup | 4 | 4 | 5 | 13 | 3 | 4.33 | CRITICAL |
| S020 | Python disclosure and egress guards | 4 | 4 | 5 | 13 | 3 | 4.33 | CRITICAL |
| S035 | Truthful evidence and error states | 5 | 4 | 4 | 13 | 3 | 4.33 | CRITICAL |
| S031 | Private feedback domain contract | 5 | 3 | 4 | 12 | 3 | 4.00 | CRITICAL |
| S040 | Listening-history feasibility | 4 | 3 | 5 | 12 | 3 | 4.00 | CRITICAL |
| S041 | Non-owned catalog feasibility | 4 | 3 | 5 | 12 | 3 | 4.00 | CRITICAL |
| S037 | User-controlled facets | 4 | 3 | 3 | 10 | 3 | 3.33 | HIGH |
| S038 | Filter state and feedback views | 4 | 3 | 3 | 10 | 3 | 3.33 | HIGH |
| S015 | Loopback API authentication | 5 | 5 | 5 | 15 | 5 | 3.00 | CRITICAL* |
| S016 | Trusted executables and custody | 5 | 5 | 5 | 15 | 5 | 3.00 | CRITICAL* |
| S022 | Complete bounded pagination | 5 | 5 | 5 | 15 | 5 | 3.00 | CRITICAL* |
| S024 | Durable reconciliation and integrity | 5 | 5 | 5 | 15 | 5 | 3.00 | CRITICAL* |
| S026 | Stable contributor and book identity | 5 | 5 | 5 | 15 | 5 | 3.00 | CRITICAL* |
| S029 | Deletion and key lifecycle | 5 | 5 | 5 | 15 | 5 | 3.00 | CRITICAL* |
| S039 | Automated regression and recovery evidence | 5 | 5 | 5 | 15 | 5 | 3.00 | CRITICAL* |
| S042 | Gate evidence and officer closure | 5 | 5 | 5 | 15 | 5 | 3.00 | CRITICAL* |
| S028 | Safe complete export | 5 | 4 | 5 | 14 | 5 | 2.80 | CRITICAL* |
| S030 | Versioned migration and recovery | 5 | 4 | 5 | 14 | 5 | 2.80 | CRITICAL* |
| S032 | Encrypted feedback persistence | 5 | 4 | 5 | 14 | 5 | 2.80 | CRITICAL* |
| S034 | LCARS responsive accessibility | 5 | 4 | 4 | 13 | 5 | 2.60 | HIGH |
| S033 | Accessible feedback editing | 5 | 3 | 4 | 12 | 5 | 2.40 | HIGH† |

## Ownership, status and dependencies

Feature Fnn has the same title and owner as S0nn. A row lists **direct**
dependencies; transitive prerequisites also apply. S014 produces A2-G0 design
readiness; all implementation stories require approved designs under A2-G0.
Live activity additionally requires A2-G2 and route-specific
authorization. PLANNED does not mean READY. Each story extends the existing
S013 harness with its own tests before DONE; S039 assembles final coverage.

| Story | Owner | Required reviewers | Dependencies | Status |
| --- | --- | --- | --- | --- |
| S014 | Riker | Data, Worf, Geordi, Wesley | Captain scope direction (received); detailed decisions open | PLANNED |
| S015 | Worf | Data, Geordi | S014, S019 | BLOCKED |
| S016 | Worf | Data | S014, S019 | BLOCKED |
| S017 | Worf | Data, Geordi | S016 | BLOCKED |
| S018 | Worf | Data | S014 | BLOCKED |
| S019 | Data | Worf | S014 | BLOCKED |
| S020 | Worf | Data | S016, S018 | BLOCKED |
| S021 | Data | Wesley | S014 | BLOCKED |
| S022 | Data | Worf, Wesley | S021, S023 | BLOCKED |
| S023 | Data | Worf | S014 | BLOCKED |
| S024 | Data | Worf, Wesley | S022, S026 | BLOCKED |
| S025 | Data | Worf, Geordi | S015, S016 | BLOCKED |
| S026 | Data | Worf, Wesley | S014 | BLOCKED |
| S027 | Data | Worf, Geordi | S024, S025 | BLOCKED |
| S028 | Data | Worf, Geordi | S015, S024, S025, S031 | BLOCKED |
| S029 | Worf | Data, Geordi | S016, S025, S031 | BLOCKED |
| S030 | Data | Worf | S024, S026, S028, S029 | BLOCKED |
| S031 | Data | Worf, Geordi, Wesley | S014, S026 | BLOCKED |
| S032 | Data | Worf | S015, S024, S028, S029, S030, S031 | BLOCKED |
| S033 | Geordi | Data, Worf, Wesley | S032, S034, S035 | BLOCKED |
| S034 | Geordi | Worf, Wesley, Data | S014 | BLOCKED |
| S035 | Wesley | Geordi, Data, Worf | S027, S034 | BLOCKED |
| S036 | Data | Worf, Wesley | S014 | BLOCKED |
| S037 | Geordi | Data, Wesley | S026, S034, S032 | BLOCKED |
| S038 | Geordi | Data, Worf, Wesley | S033, S037 | BLOCKED |
| S039 | Data | Worf, Geordi, Wesley | S017, S018, S020, S030, S038, S036 | BLOCKED |
| S040 | Data | Worf, Wesley, Riker | S014; bounded route decision; S039 and A2-G2 before live proof | BLOCKED |
| S041 | Wesley | Data, Worf, Riker | S014; bounded route/rights decision; S039 and A2-G2 before live proof | BLOCKED |
| S042 | Riker | Data, Worf, Geordi, Wesley | S039, S040, S041; legal and A2-G3/G4 evidence | BLOCKED |
| S043 | Riker | Data, Worf, Geordi, Wesley | S042; A2-G5; Captain A2-G6 decision | BLOCKED |

## Shared definition of done

Each story is a bounded INVEST slice: one capability, testable below, relative
estimate above, named dependencies and reviewer. Re-split before implementation
if it cannot fit a sprint; assign new IDs, preserve traceability and re-score.
No claim that 112 points fit one PI.

Done means reviewed design, implementation and negative-path tests on approved
synthetic fixtures, relevant officer re-review, no open blocking findings,
updated documentation, and recorded sanitized evidence for each criterion.
No debug output, personal data, remote egress, surprise dependencies or weakened
shipping controls. Domain tests and DOM/AT tests are not interchangeable.
Future live evidence requires separate authorization; a synthetic story DONE
does not grant it. Failed/unavailable feasibility is STOPPED with evidence, not
successful access. Final release remains gated even if all code stories pass.

## Stories and acceptance criteria

### ATR-S014 — Boundary and recovery contracts

As an owner, I want approved safety and completeness contracts so that new
feedback does not rest on unsafe assumptions.

1. Record source-specific progress units, completeness/duplicate/malformed
   policy, identity ambiguity, attempt/scheduler semantics, custody/retention
   and export/delete design decisions with Data/Worf concurrence.
2. Inventory tests 1–15 and applicable archived gates. Record narrow connector
   exception separately from outstanding permission/evidence; do not authorize
   thresholds, retries, extra pages or personal captures.
3. Geordi/Wesley review wireframes for feedback, facets and lifecycle; Captain
   approves new surfaces before their implementation. Record initial budgets,
   FMEA and consent/incident controls; open decisions block dependent work.
   Record OF-007's native iPhone intent and portability constraints within
   these existing boundary decisions; the web/Python alpha is disposable
   evidence, not an approved native architecture. No native implementation
   or extra feasibility experiment is authorized by this clarification.

### ATR-S015 — Loopback API authentication

As an owner, I want every local API route authenticated so that an unrelated
local client cannot read my library or change my state.

1. Worf-approved per-start capability of at least 256 random bits protects
   **every** `/api/v1/*` route, including session bootstrap. Remove public
   token vending. Bootstrap is not accessible through unauthenticated static
   content/API; keep secrets out of URLs, logs, response diagnostics/referrers
   and persistent browser storage. Use constant-time verification.
2. Preserve Host/Origin/CSP defenses; fail closed on missing/invalid fetch
   metadata on protected data/mutation requests. Validate ports and use an
   approved ephemeral-port launch flow; absence of a valid credential is 401,
   rejected browser-origin metadata is 403. Neither guard substitutes for auth.
3. Matrix covers all reads/writes and forged/missing/replayed credentials.
   Export/disconnect/delete require re-entered capability plus fresh single-use
   confirmation bound to action/session/account/resource/generation. Nonces
   expire at 120 seconds; one outstanding per action/resource, invalidated by
   lock/rotation/account change. CP-02 must prove accessible full-entropy
   delivery, anti-phishing, throttling/lockout and extension threat controls.
   No feedback endpoint can ship without this evidence.

### ATR-S016 — Trusted executables and custody

As an owner, I want only trusted tools launched after custody preflight so that
PATH or working-directory substitution cannot steal my data.

1. Validate absolute existing interpreter and trusted Windows system executable
   paths; reject bare-name resolution, unsafe roots and shadow modules.
   Read back ACLs rather than trusting successful process exit.
2. Assert hardening precedes SQLite open; any custody failure prevents open.
   Earlier-PATH/cwd executable and unsafe-root fixtures fail closed.
3. Test only disposable roots and test-owned children; never inspect, move or
   terminate the owner's running processes or state to obtain evidence.

### ATR-S017 — Provider origin and browser cleanup

As an owner, I want authorization confined to the provider and cancellable so
that an unexpected URL or timeout cannot leave an uncontrolled login process.

1. A shared reviewed HTTPS Amazon-domain predicate runs before any browser
   navigation/cookie setup and validates callbacks. HTTP, deceptive suffixes
   and non-Amazon hosts fail without launching a browser.
2. Cancel/timeout cleanup reaches all app-owned test browser descendants and
   returns initiating focus; never terminate a pre-existing user browser.
3. Tests prove no password, passkey, MFA, cookie-jar or credential observation;
   retain human provider-hosted authentication and explicit-disconnect rules.

### ATR-S018 — Dependency provenance

As a private builder, I want reproducible verified dependencies so that
untrusted replacements cannot enter the credential boundary.

1. Pin direct/transitive versions and artifact hashes, approved index and lock
   digest; installation requires hashes, no dependency re-resolution and
   reviewed binary provenance. Tampered artifacts/index overrides fail closed.
2. Record audit tool/version/date, licenses and vulnerability dispositions;
   no unresolved critical/high dependency findings at the security gate.
3. Preserve commercial/public packaging blocks. Named legal review covers
   Audible/Amazon terms and GPL/AGPL before any conveyance.

### ATR-S019 — Supported runtime preflight

As a private builder, I want an accurate runtime requirement so that startup
fails helpfully rather than crashing at an unsupported SQLite import.

1. Prove the declared minimum Node runtime can load `node:sqlite` with the
   documented flags; align package/setup/docs in future implementation.
2. Unsupported runtimes return a fixed actionable error **before** the
   incompatible static import; test minimum-supported and unsupported cases.
3. Record Windows/Node/Python environment without user paths; no version bump
   or runtime alteration is part of this planning transition.

### ATR-S021 — Progress-unit correctness

As a listener, I want faithful percentages so that 1% does not look completed.

1. Source percent fixtures 0, 0.5, 1, 25, 42.9, 99.9 and 100 retain those
   percentages. Invalid/out-of-range values remain unknown or are rejected.
2. Fractional sources require an explicit adapter-scale contract; never infer
   units from magnitude. Completion semantics are separate from conversion.
3. Replace incorrect existing expectations and test Python → Node → rendered
   text/progress; 1% never renders 100% or falsely completed.

### ATR-S020 — Python disclosure and egress guards

As an owner, I want the credential-holding process covered by guardrails so
that error/status handling cannot disclose secrets.

1. Extend the shared preflight to Python with positive/negative controls and
   reviewed egress policy; necessary URL parsing is not treated as networking.
2. Public status uses exact keys excluding auth; RPC emits one bounded JSON
   object with closed error vocabulary. Unknown canaries collapse to fixed
   categories, including lowercase syntactically valid hostile codes.
3. Assert stdout/stderr bounds, timeout/error paths and stripped proxy/logging
   behavior. A source scan is not packet-level containment evidence.

### ATR-S022 — Complete bounded pagination

As a listener, I want complete imports or an honest stop so that missing books
are never silently reported as a successful full library.

1. Overlapping/mutating pages and duplicates produce a provably complete
   deterministic result or a classified stop retaining the last complete
   snapshot. Dedupe alone cannot prove completeness.
2. Enforce existing count/request/byte/time/page caps; at exactly the page cap,
   classify completeness only with approved evidence. No page-21 probe,
   higher ceiling or automatic retry is implied.
3. Test reordered pages, duplicate/conflicting IDs, cap exhaustion, cancellation
   and repeat imports with fixed invented fixtures and semantic digests.

### ATR-S023 — Malformed-record recovery

As a listener, I want recoverable validation failures so that one bad record
does not destroy my last good library or create a permanent silent failure.

1. Three-record fixture with malformed middle produces bounded positional
   category-only diagnostics and preserves the last complete promoted state.
2. Shared reviewed contributor limit agrees across runtimes; 50/51/60/100
   distinct-contributor fixtures prove behavior. Never truncate silently or
   weaken required identity validation.
3. Provide actionable retry-after-source-correction/recovery without automatic
   auth retry; corrected fixture succeeds. Partial/quarantine policy must be
   explicitly approved, labeled incomplete and never masquerade as full import.

### ATR-S024 — Durable reconciliation and integrity

As a listener, I want removed source entries retained safely so that sync cannot
erase my local feedback or leave dangling books.

1. A→B removal retains entry **and** catalog metadata with `missingFromSource`;
   reconnection/reappearance clears it correctly. Views distinguish current
   source membership from locally retained records.
2. Reject orphan references and missing/malformed/zone-free observation
   timestamps before promotion; live input never inherits the synthetic clock.
3. Persist the reconciled result, not raw input; repeat restart/replay preserves
   canonical semantic digests and all local records. Compare semantics, not
   DPAPI ciphertext or incidental refreshed timestamps.

### ATR-S025 — Account presentation isolation

As an owner, I want account mismatch quarantined so that a new connection
cannot expose or overwrite another account's library or feedback.

1. Account-B stub with retained A plus failed disconnect yields explicit
   mismatch, withheld/quarantined library and no cross-account writes.
2. Normal A disconnect retains A's readable local snapshot and feedback under
   its account identity. Reconnect uses verified identity, never display alias.
3. Cover credentials/local-store mismatches at startup and every read/write;
   errors contain no account identifiers or source content.

### ATR-S026 — Stable contributor and book identity

As a listener, I want feedback attached to durable identities so that changing
metadata cannot silently repoint my opinions.

1. Same source person in author and narrator roles yields one person with both
   roles and resolving book references. Equal names alone never merge people.
2. Define canonical book IDs, provider-ID arrival/rekey, collisions, aliases and
   explicit migration maps. Preserve role distinctions and provenance.
3. Synthetic legacy→new mapping proves no lost/orphaned local records.
   Ambiguous mappings stop or quarantine for explicit resolution; no heuristic
   repointing. A012 closes before any persistent feedback.

### ATR-S027 — Attempt and durable-success status

As a listener, I want truthful refresh status so that a failed save never
appears to be my latest successful synchronization.

1. Record attempts even when connector startup throws. Save/validation/seal
   failures cannot advance success beyond the last durable snapshot.
2. Fake-clock tests distinguish approved 15-minute scheduling from retries;
   no auth retry or exponential backoff. Preserve primary failure codes.
3. After reload, show last attempt, last durable success and actionable
   failure/staleness distinctly, including local retained/disconnected mode.

### ATR-S028 — Safe complete export

As an owner, I want a complete portable export so that my private library and
feedback are not trapped in this prototype.

1. Versioned closed schema covers catalog, entries, references, provenance,
   limits, local ratings/comments/tags/timestamps and source/runtime label;
   exclude credentials, auth material, raw diagnostics and identity secrets.
2. Synthetic export→validate→restore round trip retains canonical semantics,
   including missing-source entries and unpopulated/cleared feedback.
   Export restore tests do not approve a personal source-import route.
3. Export requires authenticated explicit action; disclose any user-held
   plaintext copy, location/retention limits and that app deletion cannot erase
   external copies, including cloud-sync/Known-Folder redirection and backups.
   Require fresh confirmation plus re-entered capability, rate limits and
   replay rejection. Test invalid schema versions, references and unsafe text.
   Export data contains requested book metadata; errors/headers/filename do not.

### ATR-S029 — Deletion and key lifecycle

As an owner, I want explicit deletion and disconnection choices so that I
control retention without accidentally stranding a registered device.

1. Approved lifecycle enumerates local reviews, snapshot, sync state, identity
   envelope/HMAC seed, credentials, temp files, DB sidecars and derived data.
   Separate delete-feedback, delete-local-data and confirmed disconnect.
   Explain retained items and prevent silent registration abandonment.
2. Disposable-root canary tests cover interrupted cleanup, retention expiry,
   key destruction where claimed, restart and residue inventory. A failed
   cleanup remains visible/recoverable, not a false deletion success.
3. Plain-language DPAPI/SSD/pagefile/dump/backup/VSS/cloud-copy limitations;
   no overwrite/VACUUM-as-crypto-erasure claim. Prove selected key lifecycle
   before accepting personal feedback; never exercise the owner's live state.

### ATR-S030 — Versioned migration and recovery

As an owner, I want reversible, explicit migrations so that an upgrade cannot
destroy my library or private reviews.

1. Synthetic 0.0.1 schema→0.0.2 migration introduces empty feedback safely,
   preserves account/catalog/entry semantics and handles explicit ID maps.
   Unknown/newer schemas fail closed without rewriting.
2. Transactional promotion, encrypted approved backup/restore and interrupted
   migration/crypto/disk-failure tests retain the last valid state. Backup
   retention/deletion is included in S029, not a new plaintext copy.
3. Repeat migration is idempotent; downgrade is refused safely or follows an
   explicitly tested restore path. No automatic migration or new storage root
   for the currently running owner instance; future owner action is explicit.

### ATR-S031 — Private feedback domain contract

As a listener, I want expressive optional ratings and notes so that I can
record my own opinion without inventing scores for missing dimensions.

1. One active record per account/canonical book. Overall, story/content and
   narration/performance each accept null or 0.5–5.0 in 0.5 increments.
   Comments/tags without a rating are valid; no default zero, coerced string,
   NaN, infinity, inferred dimension or source-rating overwrite.
2. Proposed reviewable bounds: comment ≤4,000 Unicode code points; ≤20 tags,
   each trimmed nonempty ≤40 code points; deterministic normalized tag
   deduplication; bounded total request ≤64 KiB. Reject excess atomically with
   field errors, never silent truncation. Treat text as inert, show suspicious
   controls safely and apply identical server/domain validation.
3. Explicit local source, immutable createdAt, updatedAt and revision token;
   stale writes conflict rather than overwrite. Clear dimension, edit comment,
   remove tag and delete whole record are distinct. Schema/export/migration
   contracts reviewed before persistence; no facet preferences or models.

### ATR-S032 — Encrypted feedback persistence

As an owner, I want private feedback durably encrypted and locally authoritative
so that it survives restart and every source synchronization.

1. Authenticated account/book-keyed CRUD uses reviewed encrypted payloads in
   the approved local boundary; no comments/tags in plaintext SQLite columns,
   sidecars, temp state, logs, browser localStorage or provider/model payloads.
2. Atomic writes acknowledge saved only after durability; stale revision
   conflicts preserve both committed state and recoverable unsaved draft.
   Crypto/storage failures roll back with classified actionable errors.
3. Sync/replay/removal/reappearance/rekey/export/restore/delete tests preserve
   exact feedback semantics; source adapter cannot write annotations by
   construction. Extend tested export/deletion schemas before enabling writes.

### ATR-S033 — Accessible feedback editing

As a keyboard or screen-reader user, I want clear private rating and note
controls so that I can create, revise and delete feedback confidently.

1. Accessible labeled overall/optional story/performance half-star controls
   expose exact textual values, unrated and clear actions; keyboard operation
   never relies on star shape/color alone. Comments/tags have labels and limits.
2. Use explicit Save for the initial design: visible unsaved/saving/saved/error
   states, draft preserved on failed save, stale revision recovery and a
   navigation warning. No implicit save-success announcement before durability.
3. Confirm deletion, restore sensible focus, announce outcomes once; render
   hostile synthetic text inertly. Private/local/no-model wording is truthful;
   no recommendation or public-review surface.
4. The grouped library offers a compact book-level feedback disclosure or a
   clearly associated edit action. Create/edit/clear/delete can complete
   without navigating away, and the editor cannot attach feedback to a group
   heading, contributor, series, status or genre/category.

### ATR-S034 — LCARS responsive accessibility

As a listener using a narrow screen or assistive technology, I want readable
LCARS navigation so that important controls and data never disappear.

1. Render synthetic library, detail and lifecycle/error screens at 320 CSS px,
   representative desktop widths and 200% zoom; no clipped required content
   or unintended two-axis scrolling. Preserve readable typography and LCARS
   language without remote assets or unnecessary animation.
2. Keyboard/AT test skip links, landmarks, route focus, dialog trap/escape/
   return, ≥24×24 px targets or valid spacing, non-obscured focus and reduced
   motion. Test actual adjacent-surface focus contrast ≥3:1; A022 is a
   measurement hold, not permission for a blanket black-outline change.
3. One announcement dispatcher delivers each event to exactly one persistent
   polite/status or assertive/alert region; ordinary save/sync uses polite,
   urgent blocking errors assertive. Visible status is not another live region.
   Record synthetic baseline before optimization and approve p95 budgets at
   CP-06; changed layouts get separate comparable measurement cohorts.
4. Place listener-facing product destinations at the top of the navigation
   rail and diagnostic/evidence destinations at the bottom. A flexible neutral
   gray LCARS segment separates them; it is decorative, has no action/status,
   is hidden from assistive technology and never enters the tab order.
5. Preserve the primary-before-utility hierarchy when the rail reflows at
   320 CSS px or 200% zoom. Visual, DOM and keyboard-order evidence confirms
   that flexible filler space never clips, obscures or separates a destination
   from its accessible name, active state or focus indicator.
6. Treat iPhone Air Safari portrait as the primary mobile design target after
   recording its authoritative or measured CSS viewport, device-pixel ratio,
   browser-chrome behavior and safe-area insets. Physical display pixels do not
   define CSS breakpoints. Verify landscape and retain 320 CSS px as a smaller
   accessibility stress case.
7. Mobile-first views use safe-area-aware framing, single-axis reading, no
   required hover and at least 44 by 44 CSS px primary touch targets. With the
   on-screen keyboard open, navigation, grouped results, inline feedback,
   validation errors, save controls and lifecycle dialogs remain reachable and
   do not create horizontal page scrolling.
8. The implementation plan's primary-control enumeration and 44px token change
   are mandatory; the current 40px token does not meet that target. Test WCAG
   1.4.12: line height 1.5×, paragraph spacing 2×, letter spacing 0.12× and word
   spacing 0.16× font size together, without content or function loss.

### ATR-S035 — Truthful evidence and error states

As a listener, I want clear evidence labels and recoverable errors so that I
can distinguish my source data from a synthetic illustration.

1. Feasibility card labels active source accurately; structural trace consumes
   bundled synthetic fixtures only. Private-snapshot canary never enters trace
   output, even if the UI label says synthetic.
2. Exact missingness counts drive completeness, not rounded percentages:
   1/1,000 unknown still warns; zero-row data never claims completeness.
   Source absence/policy omission remain unknown, never fabricated metadata.
3. Empty/loading/stale/partial/error and stale-book-hash cases have truthful
   messages, focus or one announcement, keyboard-operable recovery and retained
   useful state. No hidden switch from live to synthetic on failure.
4. Complete a copy inventory across page titles, navigation, banners, headings,
   help text, lifecycle dialogs, empty/error states and exports. In private
   live-data mode, remove or rewrite blanket claims that the application or
   active library is synthetic. Use “synthetic” only for a component actually
   backed by bundled fixtures, scope that label to the component, and label the
   active private library source truthfully without exposing account details.
5. Classify navigation destinations truthfully as primary listener workflows,
   user lifecycle controls or diagnostics. Do not hide synchronization, export,
   disconnect or deletion merely because their implementation is technical,
   and do not present feasibility/developer evidence as a finished user feature.

### ATR-S036 — Safe candidate diagnostics

As an owner, I want rejected synthetic evidence sanitized so that hostile
metadata cannot leak through diagnostics.

1. Rejections expose only positional index and closed category; arbitrary
   candidate IDs/messages never appear in returned, logged or exported errors.
2. Test hostile ID/error canaries through all final diagnostic surfaces using
   the shared adversarial suite; preserve safe DOM/URL and bidi controls.
3. Label this as structural-contract hardening, not a live recommender fix;
   no candidate generator, scoring or LLM is added.

### ATR-S037 — User-controlled facets

As a listener, I want useful source-backed author, narrator and series facets,
plus Genre only when it can be populated automatically, so that I can navigate
my library deliberately and see my per-book feedback.

1. Selectable available facets show matching-book detail lists and counts.
   Multiple contributors use reviewed deterministic membership; no role
   fragmentation or name-only identity merge.
2. User-controlled facet/status/tag choices expose clear/remove/all actions;
   missing fields remain unknown and are never inferred.
3. Matching books expose saved book ratings/comments indicators; navigation
   remains keyboard/AT accessible. No facet-rating editor, inferred affinity
   or recommendation score.
4. Data traces approved category/category-ladder fields and either defines a
   deterministic automatic mapping that produces useful genre values (for
   example, LitRPG or Business), or records that the source is insufficient.
   No title/synopsis/behavior heuristic, LLM classification or manual genre
   editing is permitted in 0.0.2.
5. If automatic source-backed population is not proven, remove Genre from
   cards, detail views, search hints, filters, sorting and grouping. Rendered
   and DOM tests verify that no always-Unknown genre, empty group heading or
   misleading genre search example remains. Test stale restored/direct state
   and removed option values: they cannot activate Genre or silently select a
   dead path. Remove Genre query matching too, not only visible controls.
6. Group headings are accessible disclosures with item counts and individual
   expand/collapse controls. When multiple groups exist, keyboard-operable
   Expand all and Collapse all actions are available; collapsed content is
   removed from the accessibility tree.

### ATR-S038 — Filter state and feedback-aware views

As a listener, I want my library context preserved so that editing a book does
not reset how I was browsing.

1. Preserve search, facets, sort/direction, grouping and appropriate return
   focus during detail/back navigation, refresh, save and recoverable failure
   within the session. Reset explicitly restores a documented default.
2. Add rated/unrated, has-comment, local-tag and per-dimension rating filters/
   sorts; null stays distinct and sorts last. Combine with source facets
   deterministically; editing immediately updates matching results and counts.
3. Complete a Captain-reviewed column audit for the primary library surface.
   Prioritize title, contributors, series, progress/completion and available
   private-feedback indicators. Remove repeated Source/provider, provenance,
   internal identifier and raw synchronization columns from book rows; retain
   necessary connection transparency once in the Data/Connection view.
4. Every retained column has a documented listener task, supported semantics
   and responsive behavior. Desktop, 320 CSS px, 200% zoom, keyboard and
   screen-reader evidence proves that lower-priority fields reflow or hide
   without obscuring the title, primary action, state or active filter context.
5. Group order and within-group book order are deterministic and documented.
   Preserve each group's expanded/collapsed state, active grouping/sort/filter
   choices, scroll/return focus and draft safeguards across feedback saves,
   detail/back navigation and recoverable refresh failures. Reset is explicit.
6. Keep sensitive query/filter state in session memory only, not URLs/logs/
   hosted services or persistent browser storage. Explain reset on full app
   restart; preserve active controls/focus under rerender.
7. On the iPhone Air target, replace wide-table dependence with compact
   progressive disclosure. Title, current state, primary action and feedback
   controls remain immediately usable while lower-priority metadata reflows or
   moves behind an accessible disclosure.

### ATR-S039 — Automated regression and recovery evidence

As a maintainer, I want reproducible tests so that the safety gains cannot
silently regress on the next change.

1. Extend existing Node/Python harness, not a second runner. Include all story
   boundary tests, pagination/duplicates/malformed records, RPC bounds,
   account/reference integrity, storage atomicity, crypto failure, scheduler,
   identity migration, export/delete, feedback validation and sync preservation.
2. Synthetic end-to-end create/edit/clear/delete → sync/restart → export/restore
   and interruption matrices produce three equal canonical semantic digests.
   Incompatible version/corrupt store/failed migration never overwrites good
   state. No tests contact live services or default to personal storage.
3. Document commands/environment/assertions/results; run the Windows
   symlink-containment test in a capable isolated environment, not count a skip
   as pass. Rendered/AT evidence supplements DOM-free tests, not regex-only UI
   claims. Record measured budgets, sample sizes and dependency/policy checks.

### ATR-S040 — Listening-history feasibility

As a listener, I want proof of actual history access so that current progress
or purchase dates are not advertised as listening history.

1. Research official documented API/export options first, with dated authority,
   fields/granularity, maintenance/security/legal constraints and evidence
   vocabulary. The rejected manual import route is not silently reactivated.
2. No authenticated call or new endpoint before explicit bounded route change
   control and A2-G2. If permitted, prove at least one genuine history datum;
   sanitized process attestation excludes actual personal content/identifiers.
3. Record proven/partial/unavailable/unknown and precise missing fields. No
   route means STOPPED with no-go evidence; do not fabricate timestamps or
   claim the four-domain gate passed. Label or disable unsupported date sorts.

### ATR-S041 — Non-owned catalog feasibility

As a listener, I want proof of lawful candidate metadata access so that future
discovery is not planned around my owned-library snapshot.

1. Wesley/Data document official supported options, metadata rights, non-owned
   coverage, caps and commercial/affiliate disqualifiers; name legal authority
   for ambiguity. Library GET grant does not authorize catalog lookups.
2. Only after bounded Captain route authorization and A2-G2, collect permitted
   non-owned metadata proof with participant non-owned attestation in approved
   custody. Owned metadata or mocked lookups are not proof.
3. Record explicit no-go if unavailable; no search/recommender implementation,
   new source mutation, manual-ASIN escape hatch or public distribution.

### ATR-S042 — Gate evidence and officer closure

As the Captain, I want an auditable decision packet so that approvals are based
on executed controls rather than passing test totals.

1. Map every mandatory A-ID and test 1–15 to patch/design, environment, executed
   output, reviewer and gate decision. Missing evidence is HOLD; any Worf N/A
   is specific and reasoned, never a blanket waiver.
2. Obtain egress/custody/consent/retention/deletion receipts, four-domain
   source dispositions, rendered/AT results, measured architecture comparison
   and dated residual FMEA. Packet captures stay private; sanitize attestations
   by construction. No live capture before A2-G2.
   The existing A2-G4 comparison evaluates the intended native iPhone direction
   against source evidence and security/legal constraints in
   [07](07-native-iphone-direction.md#architecture-decision-and-portability).
   An unsupported native route stays blocked; no connector-portability claim,
   native build or future-capability delivery is required or authorized here.
3. Data/Worf/Geordi/Wesley re-review final changes; zero unresolved mandatory
   findings and required permissions before tester recommendation. Failed
   feasibility retains HOLD/FAIL unless separately rebaselined by Captain with
   renewed reviews; documentation cannot waive it.

### ATR-S043 — Release decision and documentation

As the Captain, I want an honest release summary so that a planning transition
cannot be mistaken for a passed build or distribution permission.

1. Reconcile current README/product release pointers, scope, story status and
   implementation limitations against executed evidence; cite archived A050
   contradictions without editing history. Future implementation version/schema
   changes require their own reviewed plan and migration evidence.
2. Present changelog, final officer dispositions, residual risks, restrictions
   and PASS/HOLD/FAIL recommendation. Captain alone decides A2-G6; no auto-pass
   or legacy patch-release exception.
3. No commit/push/package/release/conveyance from this planning task. A future
   release records exactly the authorized audience and legal clearance; public/
   commercial hard NO-GO remains. Archive only after the actual release outcome.

## Inherited finding disposition

Source: [immutable 51-finding register](../archive/0.0.1/feedback-and-bugs/bug-register.md).
All IDs remain open/accepted/deferred **as historically recorded**; assignment
is not closure. Mandatory set: **30 IDs**, including evidence holds and A029's
attempt-recording portion. Selected nonblocking work is not relabeled as an
old blocker. This table covers every A001–A051 exactly once.

| IDs | 0.0.2 disposition | Responsible story / condition |
| --- | --- | --- |
| A001 | Mandatory P0 security | S015 |
| A002, A021 | Mandatory P0 boundary / custody evidence hold | S016 |
| A003 | Mandatory P0 progress correctness | S014, S021 |
| A004 | Mandatory P0 completeness | S014, S022 |
| A005, A006 | Mandatory P0/P1 validation/recovery | S014, S023 |
| A007, A008, A034 | Mandatory P0/P1 durable reconciliation/reference/provenance | S024 |
| A009 | Mandatory P0 account integrity | S025 |
| A010 | Mandatory P1 runtime | S019 |
| A011 | Mandatory P0 canonical person identity | S026 |
| A012 | Promoted mandatory prerequisite for private feedback | S026, S030 |
| A013 | Mandatory P1 source gate; gated feasibility, not assumed proof | S040 |
| A014 | Mandatory P1 catalog gate; gated feasibility, not assumed proof | S041 |
| A015, A024, A028 | Mandatory P1 labeling/error/missingness | S035 |
| A016 | Mandatory P1 export | S028 |
| A017 | Mandatory P0/P1 deletion/privacy | S029 |
| A018 | Mandatory P0/P1 dependency provenance | S018 |
| A019, A046 | Mandatory P0/P1 origin / cleanup evidence hold | S017 |
| A020 | Mandatory P0/P1 Python disclosure/egress guards | S020 |
| A022, A023 | Mandatory P1 rendered focus hold / announcement bug | S034 |
| A025, A026 | Selected nonblocking search/group fixes | S037 |
| A027 | Accepted optional prose→unknown and no remote covers; richer reason taxonomy deferred | Disclose in S035; never replace with unapproved truncation |
| A029, A030 | Mandatory P1 attempt and durable-success evidence | S027; new retry/backoff deferred |
| A031 | Deferred richer source date granularity | S040 must disclose unknown; never invent midnight UTC |
| A032 | Deferred multi-series contract; first-series limitation disclosure required now | S037/T20 disclosure; richer contract required before future series-order recommendation rules |
| A033 | Mandatory P1 safe structural diagnostics | S036 |
| A035, A036 | Broad queue/capacity and accounting optimization deferred; A036 safety prerequisite retained | S022/T07/T31 must prove cumulative actual-byte enforcement or STOP; re-serialized size is not wire-byte proof. No cap or route increase |
| A037 | Selected cap-boundary classification | S022; no extra request or raised cap |
| A038 | Deferred collision-resistant temp-write improvement | Reopen if new writes introduce risk; S032 must still pass atomic/collision tests |
| A039 | Selected error-code preservation | S027 |
| A040 | Deferred custody-helper performance optimization | No weakening hardening for unmeasured speed |
| A041 | Selected consistent route focus | S034 |
| A042, A044 | Selected reset/filter-state behavior | S038; no claim default order is currently wrong |
| A043 | Selected facet navigation only | S037; separate facet ratings/preferences deferred |
| A045 | Historical bounded DPAPI residual; renewed CP-03/04 disposition required for feedback, not an A001/A002 waiver | S029/S030/S032 direct-DPAPI baseline with erasure limits, legacy binding and migration proof; no new approval claimed |
| A047 | Selected port validation | S015; do not assume NaN selects an ephemeral port |
| A048 | Accepted fixed-producer limit strengthened for new surface | S020 |
| A049 | Mandatory P1 blocking evidence gap | S014, S039, S042 |
| A050 | Selected documentation reconciliation | S043; transition fixes pointers only, no retroactive gate closure |
| A051 | Selected reload sync confirmation | S027 |

## Review correction acceptance addendum

These requirements are part of the named stories' DoD, not optional notes.
The [consensus register](09-review-consensus.md#reconciled-findings-and-dispositions)
records source finding IDs and rationale; implementation plan sections 5–9
and [verification extensions](08-implementation-plan.md#review-verification-extensions)
define tests. Each Snnn maps to A2-WPnnn. Existing estimates, WSJF and
dependencies remain canonical; unresolved checkpoints prevent READY.

| Stories / owner | Mandatory correction work | Tests / artifact |
| --- | --- | --- |
| S014 / Riker with Worf | Interim A001/A002 acceptance or its absence; discrete incident/revocation runbook; CP decisions, not implied sign-offs | RC-01, RC-08; decision register and incident artifact |
| S015 / Worf | Full-entropy accessible bootstrap; compare delivery candidates without file/PIN fallback; anti-phishing, extension residual, bounded failures; fixed nonce and export parity | T01,T02,T22; CP-02 threat/usability record |
| S016,S018,S019,S020 / Worf, Data | Custody before open; runtime/SQLite/driver/Edge provenance and channel-change trigger; hashed binary-only no-deps install; engine/docs/test-interpreter alignment; closed safe errors | T03–05,T24,T30; security/supply-chain pack |
| S022,S024 / Data | Actual-byte/cap envelope and maximum supported size; duplicate default STOP; no prior-snapshot fallback; bounded projection/cache and reconcile-seal failure handling | T07,T09,T25,T31; CP-01/06 sizing record |
| S025,S026 / Data | Seed retained whenever keyed records remain; collision-safe people/series/genre fallback IDs, edition-anchored feedback and explicit work metadata | T10,T11,T28,T33; CP-03 identity map |
| S027 / Data | Separate connector observation from service durable-commit time, including backward clock and failed commit | T12; clock authority contract |
| S028 / Data | Consume S031 revision; re-unlock/nonce/rate-limited export; cloud/backup disclosure, inert JSON, no event log; edition/work fields | T02,T16,T26; export/lifecycle pack |
| S029 / Worf | Seed retention, direct-DPAPI limits/A045 decision, bound unseal routes, event retention/deletion inventory, distinct lifecycle UX and recovery ordering | T15,T18,T28,T29; CP-03/04, incident runbook |
| S030 / Data | Frozen root; pre-decrypt marker; singleton table rebuild; envelope re-seal and cross-file recovery manifest; preserve deregistration and last valid generation | T17,T29,T30; migration pack |
| S031 / Data | Freeze persisted DDL/envelope/generation/tombstone/sidecar/export inventory by revision before consumers; aggregate store/export bounds | T13,T16,T17,T31; CP-03/04 schema artifact |
| S032 / Data | Implement S031 revision; Python-only crypto baseline; explicit durability pragmas; unseal/cache lifetime and memory bounds; no seed loss/ABA | T14,T15,T25,T28,T29,T32; storage pack |
| S033 / Geordi | Comments only in opened editor; one active editor/draft with multi-group focus safety; immediate saving state; keyboard-open actions reachable | T01,T21–23,T32; CP-05 UX pack |
| S034 / Geordi | One dispatcher/two regions; enumerated 44px controls/token; text spacing/focus/forced colors; grouped mobile nav/keyboard-safe layout; isolated mobile evidence | T21–23,T25; CP-05/06 UX pack |
| S035,S036 / Wesley, Data | Truthful mode/diagnostics; closed security events/error vocabulary; no private event contents in exports or instrumentation | T05,T15,T16,T19,T25; security/UI packs |
| S037 / Geordi with Data | Genre cause/mapping-or-removal plus stale state/search negatives and safe attestation; first-series disclosure; canonical membership and exclusive editor | T20,T21,T27,T33; OF-002/004 closure |
| S038 / Geordi | Actual date/duration sorts in Captain column audit; group-sort label; editor/draft/focus persistence and reachable mobile actions | T20–23,T25; OF-003/004/006 matrix |
| S039 / Data | All extensions in existing harness; pre-optimization budgets, equivalent-cohort measurements; three defined digests; explicit test discovery | T01–33 as applicable; evidence manifest |
| S040–S043 / existing owners | Lawful-route STOP rules, mobile HOLD and review corrections block release until evidenced; renewed officer/legal/Captain decisions | T27; decision/finding manifest, final packet |

No new runner, runtime experiment or finding closure is created by this table.
T28–T33 are test families, **not six added stories**.

## Change log

| Date | Change | Authority / evidence |
| --- | --- | --- |
| 2026-09-17 | Initial S014–S043 inventory, 112 estimated points; all criteria and detailed design approvals pending | Captain scope direction; Riker synthesis of archived reviews |
| 2026-09-17 | OF-007 native intent mapped to existing S014/S042 architecture decisions; camera and handoff placed in separate future backlog | Owner direction; no new stories, points, dependencies or delivery approval |
| 2026-09-17 | Reconcile four staged reviews and map all mandatory corrections, including pre-decrypt schema marker | Riker RC-01–RC-32; inventory/dependencies unchanged; CP concurrence and evidence pending |

No waivers are created here. New blockers discovered during implementation
receive new permanent finding IDs and a reviewed disposition, never a recycled
A-ID. Re-score at PI start, dependency changes and Captain direction changes.
