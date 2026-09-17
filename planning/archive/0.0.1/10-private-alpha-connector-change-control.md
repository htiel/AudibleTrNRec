# Captain change control — persistent private-alpha Audible connector

- **Date:** 2026-09-17
- **Status:** Approved for implementation and personal validation
- **Population:** Owner plus no more than ten named testers
- **Distribution:** Private source build only
- **Commercial/public shipping:** Blocked
- **Marketplace:** United States

## Decision

The Captain accepts the pinned `audible` 0.12.0 community client as the
technical access method for this private alpha. The route remains unofficial,
reverse-engineered, Beta, and unsupported by an Audible/Amazon public API
contract. Successful community use is interoperability evidence, not vendor
endorsement.

This approval satisfies the prior requirement for explicit technical,
security, licensing, and maintenance change control only for personal
implementation and validation. It is not legal advice and does not authorize
commercial or public release.

## Authorized behavior

1. Human authentication occurs only on an Amazon-controlled headed Edge page.
2. ATnR registers one persistent virtual Audible device.
3. Provider credentials remain in an isolated Python connector and are sealed
   with Windows user-scoped DPAPI outside the repository.
4. Node receives no provider credential and communicates with the connector
   through a fixed-command stdio boundary.
5. Sync may call only `GET /1.0/library`, with bounded pages, bytes, runtime,
   concurrency one, and no authorization retry.
6. A normalized snapshot is validated by the existing closed core before a
   DPAPI-encrypted blob is atomically stored in local SQLite.
7. Sync runs after connect, at startup, every 15 minutes while the server runs,
   and on explicit **Sync now**.
8. Refresh and shutdown never deregister the device.
9. **Disconnect Audible** explicitly deregisters the device and deletes the
   provider credentials only after success. Local library data remains until a
   separate confirmed deletion.

## Device identity

The community client hard-codes `device_name` to an Amazon substitution string
ending in “Audible for iPhone” and hard-codes `app_name` to “Audible.” It
provides no supported naming parameter. This alpha identifies itself locally
as **ATnR** and truthfully discloses the provider label. It does not fork or
patch the private registration profile merely to change a display name.

## Mechanical shipping block

- `package.json` remains `private: true`.
- `prepack` fails intentionally.
- No publish configuration, installer, container, cloud deployment, or
  application-store artifact is permitted.
- The machine-readable policy caps named testers at ten and requires
  `commercialShippingBlocked: true`.
- Direct and transitive Python dependencies are exactly pinned.
- Commercial/public use requires named legal/licensing review, Worf approval,
  and a new Captain change control.

## Failure rules

- Unexpected response shape, incomplete paging, over-limit payload, account or
  marketplace mismatch, invalid local snapshot, authorization error, or timeout
  preserves the last complete snapshot and stops without retry.
- Deregistration uncertainty retains encrypted credentials for retry and
  requires manual Amazon device removal if the API cannot confirm success.
- A different account cannot replace retained local data. The temporary new
  registration is removed and the user must explicitly delete the old local
  snapshot before changing accounts.
- No secret, callback URL, source value, or exception text enters logs,
  diagnostics, repository files, or tool output.

## Release verdict

**Private implementation: GO.**

**Commercial/public shipping: NO-GO.**

## Validation evidence — 2026-09-17

- Permanent provider authorization and device registration completed.
- The encrypted registration survived a local server restart.
- Automatic startup synchronization returned and promoted a complete,
  non-empty library snapshot.
- Normalized book and library-entry counts matched; people/facets were
  referentially valid. Participant-specific counts were not retained.
- Required synopsis over-limit behavior was observed once: the first promotion
  failed closed, preserved no partial snapshot, and surfaced only a diagnostic
  category/field. The adapter was corrected to map over-limit optional prose to
  explicit unknown rather than truncate it; the next bounded sync succeeded.
- DPAPI credential and identity envelopes are ACL-restricted to the current
  Windows user. The encrypted SQLite snapshot inherits the protected
  user-only directory ACL.
- `audible` selected its modern `CryptographyProvider`.
- Dependency consistency check passed; the pinned lock had no known
  vulnerabilities under `pip-audit`.
- 156 Node tests: 155 passed, 0 failed, 1 environment-dependent symlink skip.
- 9 Python connector tests passed.
- Headless local UI validation confirmed the complete synchronized row set,
  connected status, explicit Disconnect, and commercial-shipping disclosure
  without printing title data or retaining participant-specific counts.
- `npm pack --dry-run` failed as required.

The device remains registered. Real disconnect/deregistration was deliberately
not executed because the Captain directed that only the user should break the
persistent connection.
