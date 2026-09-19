# Audible Track and Recommend

Track Audible listening history, record personal ratings and comments, and get
explainable recommendations for what to listen to next.

See [the application idea and product plan](./APP_DESCRIPTION.md) for the
current vision, scope, and delivery plan.

The current alpha is [0.0.2](./planning/0.0.2/README.md):
release-blocker remediation, UI/accessibility optimization, encrypted book and
Author/Narrator/Series group feedback, library facets, and migration/recovery
evidence. The accumulated working tree adds sidebar filters and a fixed desktop
rail, tab-scoped filter persistence, progressive whole-star controls, and
Settings with persistent LCARS/Liquid Glass appearance selection.
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
unavailable or unverified state fails closed, never to synthetic demo data.
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
iOS 27 design-resource provenance and web/native limitations. Liquid Glass is
a local HTML/CSS interpretation, not a native iOS implementation or endorsement.

On 2026-09-19, Node tests passed **486/487 (1 skip)**, Python connector tests
passed **96/98 (2 skips)**, and policy checks passed. Skips are unverified
symlink controls; no new live-account or rendered-device proof is claimed.
Fresh connector installation remains blocked by unapproved source artifacts.
The connector is
community-tested, reverse-engineered, and unofficial. The private exception is
bounded to the owner and no more than ten named testers, but the cap is not
named-tester clearance: release gates and named legal/licensing review must pass
before any conveyance. Commercial/public shipping remains mechanically blocked
and requires renewed legal, licensing, security, and Captain change control.