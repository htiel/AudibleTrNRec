# Audible Track and Recommend

Track Audible listening history, record personal ratings and comments, and get
explainable recommendations for what to listen to next.

See [the application idea and product plan](./APP_DESCRIPTION.md) for the
current vision, scope, and delivery plan.

The current planned release is [alpha 0.0.2](./planning/0.0.2/README.md):
release-blocker remediation, LCARS UI/accessibility optimization, private
per-book ratings and feedback, library facets, and migration/recovery evidence.
This is an initial plan, not implemented functionality or release clearance.

Alpha 0.0.1 is preserved as an
[archived HOLD/FAIL evidence baseline](./planning/archive/README.md), including
the release verdict and all four officer reviews.

The alpha implementation is in
[code/Alpha0.x](./code/Alpha0.x/README.md). Its default mode remains the
fixture-only synthetic evidence harness. An optional Windows-local private
alpha mode uses the pinned community `audible` 0.12.0 client, provider-hosted
Edge authorization, DPAPI-protected credentials, an encrypted SQLite snapshot,
and a persistent virtual Audible device.

The implementation remains version 0.0.1; this planning transition changes no
runtime code, personal state, or active connection. The connector is
community-tested, reverse-engineered, and unofficial. The private exception is
bounded to the owner and no more than ten named testers, but the cap is not
named-tester clearance: release gates and named legal/licensing review must pass
before any conveyance. Commercial/public shipping remains mechanically blocked
and requires renewed legal, licensing, security, and Captain change control.