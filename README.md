# Audible Track and Recommend

Track Audible listening history, record personal ratings and comments, and get
explainable recommendations for what to listen to next.

See [the application idea and product plan](./APP_DESCRIPTION.md) for the
current vision, scope, and delivery plan.

The current alpha is [0.0.2](./planning/0.0.2/README.md):
release-blocker remediation, LCARS UI/accessibility optimization, private
per-book ratings and feedback, library facets, and migration/recovery evidence.
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

Application implementation is 0.0.2; storage revision 3 migration evidence is
recorded in the verdict without personal content. The documentation verdict
changes no runtime code, personal state or active connection. The connector is
community-tested, reverse-engineered, and unofficial. The private exception is
bounded to the owner and no more than ten named testers, but the cap is not
named-tester clearance: release gates and named legal/licensing review must pass
before any conveyance. Commercial/public shipping remains mechanically blocked
and requires renewed legal, licensing, security, and Captain change control.