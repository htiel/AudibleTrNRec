# Audible Track and Recommend

Track Audible listening history, record personal ratings and comments, and get
explainable recommendations for what to listen to next.

See [the application idea and product plan](./APP_DESCRIPTION.md) for the
current vision, scope, and delivery plan.

The current alpha is [0.0.2](./planning/0.0.2/README.md):
release-blocker remediation, independent web shells, UI/accessibility fixes, encrypted book and
Author/Narrator/Series group feedback, library facets, and migration/recovery
evidence. The integrated working tree implements remediation for issues
#1–#14, search-first mobile controls, bounded pagination, tab-scoped filter/page
persistence, progressive whole-star controls, informed export consent and
synthetic-default visual capture.
Its [implementation verdict](./planning/0.0.2/11-implementation-release-verdict.md)
is **APPROVE WITH CONDITIONS for the existing owner's private evaluation**.
Named testers and public/commercial distribution remain **NO-GO**; implemented
code is not proof that all source, accessibility, supply-chain or release gates
passed.

Alpha 0.0.1 is preserved as an
[archived HOLD/FAIL evidence baseline](./planning/archive/README.md), including
the release verdict and all four officer reviews.

The alpha implementation is in
[code/Alpha0.x](./code/Alpha0.x/README.md). The Windows-local private runtime
uses the existing real encrypted library and private ratings/comments/tags;
unavailable or unverified local/account state fails closed, never to synthetic demo data.
Fixtures remain test/demo infrastructure. The private connector uses the pinned
community `audible` 0.12.0 client, provider-hosted Edge authorization,
DPAPI-protected credentials, an encrypted SQLite store and a persistent virtual
Audible device.

The prototype local unlock key has been removed; **Audible's external-browser
registration is retained**. Loopback, Host/origin checks, sessions, CSRF and
confirmation nonces remain, but do not authenticate local processes. The owner
accepts same-user process access only on the dedicated test computer; stop the
server when idle and do not use it on a shared/untrusted machine.

Application implementation is 0.0.2; storage revision remains 3. See the
[changelog](CHANGELOG.md) and
[accumulated implementation/evidence record](planning/0.0.2/12-accumulated-implementation.md)
for the blank-page/bulk-feedback fixes, grouped-feedback semantics, Apple
iOS 27 design-resource provenance and web/native limitations.

### Independent web shells

Settings selects default **LCARS** or opt-in **Liquid Glass**, retaining the
existing browser theme identifiers. Apple mode constructs its own navigation
bar, Library/Data/Settings tabs, contextual back navigation and responsive
content column; it does not construct or hide LCARS elbows/sidebar/filler.
LCARS retains separate console chrome. Both consume shared state and neutral
`atnr-*` views and neutral tokens. Apple styling uses no `--lcars-*` references;
both LCARS-only stylesheets are disabled in Apple mode. Theme activation is
generation-guarded so a stale asynchronous import cannot replace the last choice.

Apple HIG, documented Apple APIs and Design Resources are normative. Google
image search is non-normative inspiration only: **no copied/traced/bundled or
hotlinked third-party imagery or UI assets**, and no private uploads.
The result is a responsive HTML/CSS/JS prototype, not UIKit/SwiftUI equivalence,
Apple endorsement or physical iPhone validation.

### Data and privacy behavior

- Provider synopsis markup becomes bounded inert text; absent series evidence
  is **Series unknown**, not a manufactured standalone claim.
- Connection states are disconnected, unverified, verified and
  authorization-failed. Verification has a 24-hour evidence horizon;
  stored credentials alone never imply health, and status reads do not probe
  Audible. Failed sync refreshes recorded evidence and displayed status;
  unreachable refresh is marked stale, not invented revocation.
- Pages render at most 50 book rows: 50 ungrouped, or five groups with ten
  children each. Previous/Next controls reach row, group and child pages;
  dirty drafts must be saved/discarded before paging. Counts remain complete;
  there is no "Show all".
- Person feedback IDs use a stable normalized-display-label hash regardless
  of member count. Legacy aliases remain readable and migrate after canonical
  save with revision-safe retirement; ambiguous aliases are not auto-migrated.
- Export consent precedes any request/nonce/file. The plaintext copy is outside
  ATnR protection and cannot be recalled by deleting local data.
- [Visual capture](code/Alpha0.x/docs/visual-capture.md) defaults to synthetic
  data. Private capture requires per-run consent, protected handling, a bounded
  retention deadline and purge verification; removal is not forensic erasure.
- Delayed-audit fixes keep completion and partial position evidence distinct,
  close provenance labels, move private Feasibility out of primary navigation
  to a Data context link, and add non-destructive Data inventory. Status and
  Book-detail feedback guidance each appear once.
- Filter persistence is schema-only with validated legacy-key migration.
  Actual sync reconciliation persists in the account/snapshot-bound,
  non-sensitive `last-import-counts.json` sidecar and survives reload.
  Snapshot parsing alone remains **Unknown / not an import**.

Post-audit evidence supplied on 2026-09-21: **685 Node tests / 684 pass / 0 fail /
1 environment symlink skip**, **87.7 seconds**; **128 connector tests /
126 pass / 0 fail / 2 skips**; policy PASS. Actual synthetic `--theme all`
capture verified both themes in the live DOM, wrote **12 neutral PNGs plus
manifest**, then purge verified.

The previously supplied live private matrix starts Apple with **zero LCARS classes, 50 rows and
`Showing 1–50 of 180 (page 1 of 4)`**; Next reaches **51–100**. Rapid
Apple→LCARS switching ends LCARS with the Apple stylesheet disabled and both
LCARS sheets enabled, without errors. These supplied results were reconciled,
not rerun during the final documentation task.

Playwright remains optional, undeclared and unpinned. Physical-device/
VoiceOver and current provider revocation remain evidence limits; the matrix
is not blanket accessibility certification. See the
[final remediation evidence and limits](planning/0.0.2/12-accumulated-implementation.md)
before treating a green suite as acceptance or issue closure.
Fresh connector installation remains blocked by unapproved source artifacts.
The connector is
community-tested, reverse-engineered, and unofficial. The private exception is
bounded to the owner and no more than ten named testers, but the cap is not
named-tester clearance: release gates and named legal/licensing review must pass
before any conveyance. Commercial/public shipping remains mechanically blocked
and requires renewed legal, licensing, security, and Captain change control.