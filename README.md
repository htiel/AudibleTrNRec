# Audible Track and Recommend

Track Audible listening history, record personal ratings and comments, and get
explainable recommendations for what to listen to next.

See [the application idea and product plan](./APP_DESCRIPTION.md) for the
current vision, scope, and delivery plan.

The current locked planning baseline is
[alpha 0.0.1](./planning/0.0.1/01-release-charter.md).

The alpha implementation is in
[code/Alpha0.x](./code/Alpha0.x/README.md). Its default mode remains the
fixture-only synthetic evidence harness. An optional Windows-local private
alpha mode uses the pinned community `audible` 0.12.0 client, provider-hosted
Edge authorization, DPAPI-protected credentials, an encrypted SQLite snapshot,
and a persistent virtual Audible device.

Alpha 0.0.1 is authorized to proceed only as a personal build for the owner and
no more than ten named testers. The connector is community-tested,
reverse-engineered, and unofficial. Commercial/public shipping is mechanically
blocked and still requires legal, licensing, security, and Captain approval.