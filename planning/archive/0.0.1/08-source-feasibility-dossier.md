# ATR-S001 — Audible source feasibility dossier

- **Research date:** 2026-09-16
- **Marketplace / language:** United States / English
- **Participant scope:** Browser-session probes plus one separately authorized,
  isolated external-browser PKCE/device-registration experiment
- **Method:** Public documentation, pinned community-client source review, and
  bounded read-only GETs recorded below
- **Result:** PRIVATE-ALPHA CONDITIONAL GO — unofficial automated technical
  reachability is proven; no supported vendor route was found
- **Captain decisions:** manual export/import rejected; pinned community route
  approved for a private, non-commercial alpha on 2026-09-17

No credential, cookie, browser-profile, authenticated DOM, or response content
was inspected or extracted. No personal-data field was returned, displayed,
stored, or committed.

## Executive decision

No public, documented Audible API or Login with Amazon scope was found for a
customer's Audible library, listening history, or playback position. The app
must not use authenticated-page scraping, browser automation, session cookies,
mobile/private APIs, or reverse-engineered clients without separate explicit
technical, legal, security, licensing, and maintenance change control.

The user-supplied
[External Audible API documentation](https://audible.readthedocs.io/en/latest/misc/external_api.html)
does list a reverse-engineered `GET /1.0/library` shape, including metadata and
progress response groups. It also states that there is no publicly available
Audible API documentation, that the referenced client does not document
authentication, that few endpoints are fully documented, and that most calls
require authentication. It therefore corroborates technical endpoint shape but
does not supply a supported authorization grant, permission, or stable API
contract. A remembered first-party browser session must not be repurposed as
that missing authorization mechanism.

## Captain-directed browser-session probes

On 2026-09-17, after explicit repeated direction from the Captain, one
read-only request was issued from the already authenticated Audible browser
page to:

`GET https://api.audible.com/1.0/library?num_results=1&page=1`

The request asked for JSON and allowed the browser to apply its own credential
policy. ATR did not read, copy, print, or persist cookies or other credential
material. The recorded result was:

- HTTP status: `403`
- Content type: `application/json`
- Top-level response keys: `message`
- Library item count: unavailable
- Library item fields: none
- Local database writes: none

This proves only that an authenticated `www.audible.com` browser session did
not authorize this `api.audible.com/1.0/library` request. It does not prove that
the endpoint is absent, and it does not identify or authorize another
authentication mechanism. The later one-time client experiment was authorized
by the narrower amendment below.

On 2026-09-17 the Captain then directed a second test with authentication left
entirely to the human-managed browser. The same library request was opened as a
top-level browser navigation, eliminating cross-origin fetch/CORS behavior as a
possible explanation. It returned:

- HTTP status: `403`
- JSON response: `{"message":"Request could not be authenticated"}`
- Library items and metadata: none
- Local database writes: none

The second result confirms that the existing Audible website session is not
accepted as authorization by the documented API host. Repeating query or
response-group variations cannot correct a missing API authentication context.

## External-browser PKCE/device-registration experiment

After reading the community client's authorization, authentication,
registration, persistence, and deregistration documentation and pinned 0.12.0
source, the Captain authorized one isolated experiment under
[the narrow amendment](09-unofficial-client-experiment.md).

The participant authenticated only on an Amazon-controlled Edge page. The
client completed its PKCE flow, registered one temporary virtual Audible
device, and issued exactly one:

`GET /1.0/library?num_results=1&page=1`

Sanitized result:

- Authorization: successful.
- Request: successful.
- Item count: `1`.
- Field-name coverage: identity, title, authors, narrators, series, categories,
  runtime, language, publisher, images, purchase date, rights, availability,
  library/listening state, completion state, percentage complete, ratings,
  reviews, and relationships were represented.
- ASINs, titles, account identifiers, tokens, cookies, callback URL, and all
  metadata values: not printed or persisted.
- Device deregistration: confirmed successful.
- Isolated local experiment state: destroyed.
- Retries and local database writes: none.

This proves that the pinned community client can currently obtain a library
record and the data shape needed for the proposed app. It also confirms that
the route requires a distinct private API authorization/device context rather
than ordinary Audible website cookies.

The result does **not** convert the route into an official API. The client is
community-maintained, reverse-engineered, Beta, AGPL-3.0-only, and uses
non-public Audible/Amazon services. Continued operation does not establish
vendor endorsement, permission, support, stability, or notice of breaking
changes.

## Persistent private-alpha implementation

Under the later
[persistent connector change control](10-private-alpha-connector-change-control.md),
ATnR completed one permanent provider authorization/registration and retained
the device across a server restart. Automatic startup synchronization promoted
one complete encrypted snapshot:

- Snapshot: complete and non-empty for the bounded library request
- Book/library-entry counts: matched
- People/facets: normalized and referentially valid
- Marketplace: United States
- Local provider credentials: DPAPI sealed
- Local snapshot: DPAPI sealed inside SQLite
- Provider device: remains registered until explicit user Disconnect

No participant-specific count, title, ASIN, account identifier, token, cookie,
key, callback URL, or metadata value is included in the repository.

Amazon does provide an official privacy data-request process. Public,
non-authoritative parsers corroborate that delivered archives can contain
`Audible.Library.csv`, `Audible.Listening.csv`, and
`Audible.PurchaseHistory.csv`. The supported alpha direction is therefore:

1. The user independently requests and downloads their official Amazon export.
2. The user selects only the Audible CSV files for local import.
3. ATR previews the detected fields and imports only explicitly selected data.
4. Progress is labeled **as of export** and remains experimental.

The Captain rejected import-first scope and then approved a separate
[persistent private-alpha change control](10-private-alpha-connector-change-control.md).
Alpha implementation may therefore continue for the owner and no more than ten
named testers using the pinned community route. Commercial/public shipping
remains stopped until a supported vendor route or named legal/licensing,
security, and Captain approval is obtained.

## Four-domain decision

| Domain | Decision | Route | Limitation |
| --- | --- | --- | --- |
| Library titles | Conditional GO | User-selected Audible library file from official Amazon data export | Exact schema and completeness require one bounded export test |
| Listening history | Conditional GO | User-selected Audible listening file from official Amazon data export | Asynchronous event export, not a live feed; retention/completeness unknown |
| Current progress | Experimental snapshot only | Latest valid exported end position divided by book length, when present | Freshness, rewind, offline merge and completion authority are unknown; no live-sync claim |
| Non-owned Audible catalog | NO-GO for broad access | Manual title/ASIN entry only for alpha | No supported Audible catalog API found; scraping is prohibited; Creators API coverage and eligibility are unsuitable/unverified |

## Route assessment

| Route | Library | History | Progress | Non-owned catalog | Disposition |
| --- | --- | --- | --- | --- | --- |
| Public Audible API | No supported route found | No | No | No Audible-specific route found | Reject |
| Login with Amazon | Profile scopes only | No | No | Not applicable | May authenticate an app user, but never represents Audible authorization |
| Official Amazon data request | Likely; test required | Likely; test required | Possible exported snapshot | No | Preferred source route |
| Manual upload of official export | Conditional GO | Conditional GO | Experimental | No | Alpha candidate |
| Manual user-created CSV | User supplied | User supplied | User maintained | Small/manual set | Fallback requiring Captain acceptance |
| Amazon Creators API | No | No | No | Unverified Audible coverage; affiliate eligibility/purpose | Do not adopt without written use-case/coverage approval |
| Community client/private API | Technically reachable in one bounded test | Not tested | Progress fields present; values not tested | Not tested | Product use unapproved; requires separate change control |
| Browser cookies, DOM scraping or authenticated-page automation | Unapproved | Unapproved | Unapproved | Unapproved | Disqualified |

## Capability details to verify

Public third-party parsers provide format corroboration, not an Amazon schema
guarantee. A bounded export experiment must verify:

- Library ASIN, title, ownership, completion, acquisition and marketplace fields.
- Author and narrator representation, including multiple/full-cast narrators and
  whether names have stable identifiers or are unlinked strings.
- Series name, nullable/fractional position and omnibus representation.
- Listening start/end time, event duration, start/end position, book length,
  audio type, preview/sample distinction and narration speed.
- Completeness across marketplaces, household profiles and retention periods.
- Export generation time and whether the newest event reflects the visible
  first-party position after rewind and offline listening.

Missing fields remain unknown. Acquisition is not listening history. The newest
position is not authoritative until the experiment demonstrates its semantics.

## Proposed export experiment — rejected

1. The participant independently opens Amazon's data-request page and requests
   available Audible datasets.
2. ATR receives no password, passkey, token, cookie, session, or full Amazon
   archive.
3. Before any import implementation, the participant supplies only filenames,
   CSV headers, and up to three redacted or synthetic representative rows from
   the Audible library/listening files.
4. Data maps fields to the locked S003 authority and identity contract.
5. Worf confirms the files contain no credentials or inseparable third-party
   data before a later consented import.
6. One position is compared manually with the first-party Audible display,
   including rewind and offline-listening cases.

Success requires consistent library/listening parsing, ASIN joins, and a
position sufficiently coherent to label as an export-time snapshot. Missing
files, materially incomplete records, absent position fields, or unexplained
position mismatch stop the route.

The Captain rejected export/import as a product route on 2026-09-17, so this
experiment is not authorized and must not be executed.

## Resume condition

The supported-route path remains provider-facing: obtain public documentation
or written Audible/Amazon confirmation for an automated, revocable
authorization route that permits library, listening-history, and progress
retrieval and refresh. A remembered browser login, browser profile, session
cookie, or authenticated-page DOM does not satisfy this condition.

The community-client path may proceed only through a separate Captain-approved
change control that explicitly accepts its unofficial/private status and
includes legal/terms review, AGPL-3.0 licensing review, credential-custody
architecture, dependency/cryptography review, account-device lifecycle,
marketplace isolation, rate limits, failure behavior, and a reversible adapter
boundary. The one-time experiment is not that product authorization.

## Permission and privacy constraints

- A privacy export is user access to personal information, not permission to
  scrape Audible or redistribute catalog content.
- Prefer local parsing and explicit file selection; never upload the entire
  Amazon archive when only Audible files are needed.
- Household/profile records may belong to another person and require a stop if
  they cannot be safely separated.
- Hosted processing, retention, catalog redistribution, cover art,
  descriptions, model training and branded “Audible integration” claims require
  separate privacy/legal review.
- Absence of a prohibition is not approval.

## Public sources

Authoritative sources, accessed 2026-09-16:

- [Amazon Privacy Notice](https://www.amazon.com/privacy)
- [Amazon Request My Data](https://www.amazon.com/hz/contact-us/request-data)
- [Login with Amazon overview](https://developer.amazon.com/docs/login-with-amazon/documentation-overview.html)
- [Login with Amazon authorization grants](https://developer.amazon.com/docs/login-with-amazon/authorization-grants.html)
- [Login with Amazon customer profile scopes](https://developer.amazon.com/docs/login-with-amazon/customer-profile.html)
- [Amazon Conditions of Use](https://www.amazon.com/gp/help/customer/display.html?nodeId=508088)
- [Audible Conditions of Use](https://www.audible.com/legal/conditions-of-use)
- [Audible content license](https://www.audible.com/legal/license-agreement)
- [Amazon Creators API introduction](https://affiliate-program.amazon.com/creatorsapi/docs/en-us/introduction)
- [Creators API United States locale](https://affiliate-program.amazon.com/creatorsapi/docs/en-us/locale-reference/united-states)

Format corroboration only, accessed 2026-09-16:

- [Reverse-engineered External Audible API endpoint shapes](https://audible.readthedocs.io/en/latest/misc/external_api.html)
- [Human Data Income Amazon export file names](https://github.com/humandataincome/hudi-packages-connectors/blob/00eeaa422dcc787cfa5418cf043010e6b085cb89/src/source/amazon/enum.amazon.ts#L12-L14)
- [ccpa.party Amazon Audible export parser](https://github.com/btidor/ccpa.party/blob/d76d3a6ce04320c0ec2c3fad08df3af9fb35cbaa/src/parsers/amazon.tsx#L155-L192)
- [Oak Audible listening export parser](https://github.com/flpm/oak/blob/7bd6b6992f77a6293c81acf3199bc8e116cbea20/commands/utils/audible.py#L14-L95)
- [Audiotrail export models](https://github.com/Flowm/audiotrail/blob/14a7d6baaa6816bc7c206438ea1c974a21205bee/src/types/models.ts#L11-L34)

These third-party repositories establish plausible observed file formats only.
They do not establish permission, completeness, or a stable Amazon contract.
