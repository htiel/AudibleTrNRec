# Captain amendment — unofficial Audible client experiment

- **Date:** 2026-09-17
- **Status:** Completed; temporary device deregistered and local state destroyed
- **Scope:** Personal technical reachability test only
- **Release impact:** None; S001 and alpha 0.0.1 remain STOPPED

After reviewing the documented external-browser authorization flow and being
informed that it registers an Audible/Amazon device and creates durable device
credentials, the Captain explicitly directed the team to retry using that
flow.

## Narrow authorization

For one experiment only, the prior “no mutations” rule is narrowed to permit:

1. One device registration required by the unofficial client authorization.
2. One read-only `GET /1.0/library` request with `num_results=1`.
3. Immediate device deregistration after the request or any failure.

No library, wishlist, collection, purchase, playback-position, review,
annotation, or content mutation is permitted.

## Sanitized result

The one authorized experiment completed successfully on 2026-09-17:

- Human Amazon authorization: completed in a separate provider-controlled Edge
  window.
- Virtual Audible device registration: completed.
- Request: one `GET /1.0/library` request with `num_results=1`.
- Response: success with exactly one library item.
- Metadata coverage: field names confirmed for identity, title, authors,
  narrators, series, categories, runtime, language, publisher, images, purchase
  date, library/listening state, completion state, percentage complete,
  ratings, reviews, relationships, rights, and availability.
- Personal response values: not printed or persisted.
- Request retries: none.
- Device deregistration: confirmed successful.
- Local authenticator/token file: none created.
- Isolated experiment directory: destroyed after deregistration.
- Clipboard: cleared.
- Repository credential/personal-data scan: required before closure.

The client emitted a warning that its default signing path used legacy
`pyaes`, `rsa`, and `pbkdf2` libraries. This did not change the bounded result,
but product use would require a current dependency and cryptography review.

This result proves technical library reachability through the pinned
community client. It does not prove Audible/Amazon endorsement, permission,
stability, or product suitability.

## Mandatory controls

- The participant enters passkey/password/OTP/CVF only on an
  Amazon-controlled external browser page.
- ATR never renders, relays, stores, or logs those credentials.
- Callback URL, authorization code, access/refresh token, device key, ADP
  token, cookies, customer identifiers, ASINs, titles, and metadata values must
  not enter chat, tool output, logs, source control, or repository files.
- The experiment runs in an isolated per-experiment directory outside the
  repository with access restricted to the current Windows user.
- No authenticator/token file is persisted unless required by the installed
  client; any required file must be encrypted and destroyed after confirmed
  deregistration.
- Output is limited to success/failure, HTTP status, item count, and sorted
  response field names.
- Any callback validation failure, exception, non-200 response, timeout, or
  deregistration uncertainty stops the experiment without retry.

## Cleanup and incident rule

Device deregistration must be attempted in `finally` before local cleanup. If
automatic deregistration cannot be confirmed, the experiment is a security
incident: the participant must remove the device through Amazon account device
management. If that cannot be confirmed, invalidate Amazon sessions and change
the account password before resuming.

After confirmed deregistration, destroy all experiment state, clear the
clipboard, and verify that no experiment credential or personal data entered
the repository.

## Standing limitations

This is a user-directed test of a community-maintained, reverse-engineered
client. It is not evidence of official Audible endorsement, a supported API
contract, legal approval, G2 approval, or authorization for product code.
Only sanitized reachability may be added to the feasibility dossier. The
release remains stopped pending a supported route or separate change control.

The separate change control was granted later on 2026-09-17 for a persistent,
private, non-commercial alpha. See
[10-private-alpha-connector-change-control.md](10-private-alpha-connector-change-control.md).
