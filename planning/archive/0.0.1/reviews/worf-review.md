# Worf — security and privacy review of alpha 0.0.1

**Reviewer:** Worf, Son of Mogh — Chief Security Officer
**Review date:** 2026-09-16
**Artifacts reviewed:** `APP_DESCRIPTION.md` (working-tree content),
`planning/README.md`, `planning/0.0.1/01-release-charter.md`,
`02-requirements-and-hierarchy.md`, `03-user-stories.md`, `04-sequencing.md`,
`05-risks-and-release-gates.md`, `06-backlog-index.md`
**Gate under review:** G0 — initial design/plan review
**Repository state at review:** planning documents only; no code, no test runner,
no dependency manifest, no CI, no captured data. Nothing was executed, committed,
or pushed for this review.

---

## 1. Verdict

**REQUIRE CHANGES. Worf security approval for G0 is WITHHELD.**

The plan's security posture is the strongest I have reviewed in this project's
short life. It refuses to assume an API exists, refuses password capture, gates
real personal data behind a tested lifecycle story (S009/G2), forbids all LLM
egress in the alpha, and treats a no-go as an honorable outcome. That discipline
is honorable and I will not weaken it.

It is still not safe to execute. The plan names the right controls but leaves
nine security decisions to be improvised by whoever happens to be holding the
keyboard. Improvisation with another person's Amazon account and listening
history is how accounts are lost. Fourteen blocking findings follow. None of
them expands alpha scope; all of them are constraints, stop rules, or acceptance
criteria attached to stories that already exist. Feasibility scope is preserved:
I add no new feature, no new platform, and no new engineering deliverable beyond
one small enabler already implied by S009 (WORF-B10).

A plan is not secure because no exploit was found in it. It is secure when the
failure paths are written down and tested. Ours are not yet.

**Approval sequence I will honor:**

- Apply the fourteen blocking changes → I approve G0.
- S001/S002/S003 evidence satisfies WORF-B01…B06 → I approve G1.
- S009 fixture evidence satisfies WORF-B07…B12 in my presence → I approve G2.
- Nothing touches a real account before G2. Not one request.

---

## 2. Assets and trust boundaries

### 2.1 Assets, ranked by what their loss costs the user

| # | Asset | Where it lives in alpha | Loss impact |
| --- | --- | --- | --- |
| A1 | Amazon/Audible account credentials (password, MFA, session cookies, device registration material) | **Never in our custody — by design** | Catastrophic: full Amazon account takeover, payment instruments, orders |
| A2 | Delegated tokens / export download links / signed URLs (if an API or export route exists) | Prototype secret store | Account data exfiltration until revocation |
| A3 | Raw source capture (export archive or API payloads) | Approved experiment environment only, transient | Full personal data exposure; likely contains far more than Audible data |
| A4 | Normalized listening library, history, progress | Prototype storage | Behavioral profile: beliefs, health, religion, politics inferable from titles |
| A5 | Synthetic local-annotation sentinel (S003/S007) | Prototype storage | Low directly; becomes A4-class the moment real ratings/comments ship (D01) |
| A6 | Catalog metadata and descriptions (S005) | Prototype storage | Untrusted **input**, plus rights/licensing exposure |
| A7 | Evidence pack, capability report, screenshots, logs, crash output | Repository / review attachments | Highest-probability leak path in this alpha |
| A8 | Consent record and test-participant identity | Experiment environment | Privacy of the consenting listener |
| A9 | Repository and its history | GitHub `htiel/AudibleTrNRec` | Irreversible: a committed secret or capture is public forever |
| A10 | Developer workstation / harness runtime | TBD (D06) | Compromise defeats every other control |

### 2.2 Trust boundaries in the alpha

```text
[B1] Amazon/Audible authorization surface (provider-controlled)
       |  password/MFA NEVER crosses inward; only a token or a user-chosen file
       v
[B2] User-mediated handoff (system browser hand-back, or file the user selects)
       |  everything crossing here is UNTRUSTED and UNVALIDATED
       v
[B3] Access/import adapter  (S004, S005)
       |  schema validation, size/time/rate limits, provenance stamping
       v
[B4] Normalizer            (S006, S007)   <-- no network, no I/O beyond storage
       |  typed, bounded, quarantined records; injection payloads stay inert data
       v
[B5] Prototype storage     (S009)          encrypted-at-rest; key-destroyable
       |
       v
[B6] Inspector / export    (S008, S009)   <-- untrusted text rendered inert
       |
       v
[B7] Repository, review pack, logs (S012)  <-- SANITIZED ONLY. Hard boundary.

[B8] Everything else — network egress, AI providers, telemetry, cloud backup,
     crash reporting, package registries at runtime — is DENIED in alpha.
```

**Boundary rules the plan currently implies but does not state:**

- B1→B2 must be provider-rendered UI in a **system browser**, never an embedded
  webview, headless browser, or automated form fill (WORF-B02).
- B3 is the only component permitted outbound network access, to an allowlist
  (WORF-B09). B4, B6 have none.
- B7 is one-directional and sanitized. Nothing personal moves rightward. Ever.
- B8 is enforced, not merely promised (WORF-B09).

### 2.3 Actors

Consenting listener (likely the developer — self-consent still requires a written
record, WORF-B05); test operator (S002 names one, undefined identity); reviewing
officers (Worf witnesses process at S004/S009 — **not content**, WORF-B14);
Amazon/Audible as an external authority with binding terms; the catalog source;
future attackers of the repository, the workstation, and — through book
descriptions — the future model.

---

## 3. Blocking requirements

Each finding: **ID · severity · confidence · evidence · required action.**
Severity: CRITICAL blocks G0; HIGH blocks the named gate.

### WORF-B01 — "Approved route" has no named legal authority or disqualification list
**Severity: CRITICAL (blocks G0) · Confidence: High**
**Evidence:** `01-release-charter.md` "Access decision and stop rules";
`03-user-stories.md` S001 AC1/AC4.

S001 requires "qualified clarification" for unclear permission but never names
who is qualified, and no document lists the routes that are already disqualified.
The public ecosystem is full of unofficial `audible` Python libraries, Audible
"device registration" flows, and community catalog mirrors. An engineer under
delivery pressure will find them in ten minutes and they look official enough to
rationalize. Absence of a prohibition is not approval, and the plan already says
so — but it does not say which specific things are prohibited.

**Required action:** S001 gains an explicit disqualification list and a named
authority. See §5, S001 AC6 / AC7.

### WORF-B02 — "Normal login on the provider's surface" is undefined and exploitable
**Severity: CRITICAL (blocks G0) · Confidence: High**
**Evidence:** `01-release-charter.md`: "Normal login on the provider's own
supported authorization surface is not credential collection by this application."

That sentence is correct and dangerous. It is true only when the password is
typed into provider-rendered UI that our process cannot read. It is false for an
embedded `WKWebView`/Electron/CEF window, a Selenium or Playwright session, a
headless browser, a cookie-jar import from the user's browser profile, or a
password-manager autofill into our harness. Every one of those "looks like normal
login" and every one of them puts A1 inside our trust boundary. Left as written,
this clause is the single most likely path to violating Prime Directive 1.

**Required action:** narrow the clause and prohibit the mechanisms. See §5,
charter amendment C2 and S002 AC6.

### WORF-B03 — Catalog route (S005) may drag affiliate coupling into the product
**Severity: CRITICAL (blocks G0) · Confidence: Medium-High**
**Evidence:** S005 AC1–AC4; `APP_DESCRIPTION.md` "No Advertising or Paid
Placement"; `02-requirements-and-hierarchy.md` ATR-PR08.

S005 must prove permitted metadata access for a **non-owned** Audible title. The
obvious candidate route for Amazon-family catalog data is the Product Advertising
API, which is an **Associates/affiliate** program: it requires an affiliate
account and its terms govern tracking identifiers and link usage. Adopting it
would embed a commercial relationship into the candidate pipeline and contradict
the product's non-negotiable trust principle before a single recommendation
exists. S005 AC4 forbids commercial *fields* in the contract; it does not forbid
a commercially *bound* source. Third-party catalog sources carry their own
redistribution and rate terms.

**Required action:** S005 gains an explicit affiliate-coupling stop rule and a
route-eligibility test. See §5, S005 AC6.

### WORF-B04 — Export-route over-collection is unaddressed
**Severity: CRITICAL (blocks G0) · Confidence: High**
**Evidence:** S004 AC1 ("consumes a user-selected file"); S002 AC1; no document
discusses archive contents or pre-ingest minimization.

The realistic supported export path is a full account data-request archive. Such
archives characteristically contain far more than audiobook data — order and
purchase history, addresses, device and advertising identifiers, support
correspondence, other services' activity. If our harness ingests, indexes, logs,
or even decompresses that archive wholesale, we have collected sensitive data
with no feature justification, and S009's deletion inventory becomes wrong on
day one. This directly violates Prime Directive 4 and data minimization.

**Required action:** mandatory pre-ingest allowlist and out-of-scope-file
refusal, before parsing. See §5, S002 AC7 and S004 AC6.

### WORF-B05 — Consent is specified as content, not as a recorded, revocable act
**Severity: HIGH (blocks G1) · Confidence: High**
**Evidence:** S002 AC2 describes what consent must *say*; nothing requires it be
*recorded*, dated, scoped, or revocable, and no document handles self-consent by
the developer or the presence of household/third-party data.

Consent that exists only as a paragraph in a design document cannot be audited
or withdrawn. If the consenting listener is the developer, self-consent is
acceptable but must still be written, because it defines the deletion promise we
will be held to.

**Required action:** see §5, S002 AC8.

### WORF-B06 — No incident-response or revocation runbook exists
**Severity: HIGH (blocks G1) · Confidence: High**
**Evidence:** No story, gate, or risk row covers accidental exposure. R04 lists
preventive controls only; S012 AC5 covers rollback of a *release*, not of a leak.

We will handle live tokens and a real person's history. Before that begins, we
must know — in writing, in advance — how to revoke a token, how to purge a
committed secret or capture from git history, when to force key rotation, and who
is told. Composing that procedure during an incident guarantees a slow, partial
response.

**Required action:** see §5, S002 AC9.

### WORF-B07 — Dependency and supply-chain review arrives after real data
**Severity: HIGH (blocks G2) · Confidence: High**
**Evidence:** `03-user-stories.md` S012 AC3 places "dependency/license checks" in
the final decision pack; `05-risks-and-release-gates.md` G2 evidence list omits
dependencies entirely; no risk row covers supply chain.

The harness (D06) will be chosen and built at G1–G2 and will handle A2/A3/A4.
A malicious or vulnerable transitive package, or a package `postinstall` script,
executes inside the exact environment holding tokens and a real library. Checking
licenses at G5 is auditing the stable after the targ has bolted.

**Required action:** dependency gate moves to G2. See §5, S002 AC10, S009 AC6,
and gate amendment G2-e.

### WORF-B08 — Secret and capture hygiene for the repository is asserted, not enforced
**Severity: HIGH (blocks G2) · Confidence: High**
**Evidence:** `planning/README.md` conventions and DoD-A item 2 prohibit personal
data in the repo; S009 AC5 checks canaries in logs/reports/repository. No
mechanism prevents the mistake, and no rule keeps captures out of the working
tree in the first place.

A prohibition without a control is a wish. Git makes the mistake permanent: a
single `git add -A` in a directory holding a capture publishes it, and rewriting
public history is not a reliable remedy.

**Required action:** captures live outside the repository tree; ignore rules,
pre-commit secret/canary scan, and a staged-diff check. See §5, S009 AC7.

### WORF-B09 — Network egress denial is a policy statement with no enforcement test
**Severity: HIGH (blocks G2) · Confidence: High**
**Evidence:** S002 AC3 requires "an allowlist for required network destinations";
S010 AC6 forbids AI egress; charter CTQ claims "zero AI network requests"
measured by "contract/egress tests" — but no story owns an executable egress
test, and S008/S008 AC5 covers only image loads in the inspector.

"Zero AI network requests" is a measurable claim. Measure it or delete it. Any
dependency, telemetry hook, crash reporter, font/CDN fetch, or update check can
falsify it silently, and cover-image URLs from untrusted catalog text are a
textbook SSRF and tracking vector (R07 acknowledges only the inspector case).

**Required action:** executable egress denial with a default-deny allowlist and a
recorded negative test; no fetch of any source-supplied URL in alpha. See §5,
S009 AC8 and S008 AC6.

### WORF-B10 — Untrusted-input adversarial corpus is named but not defined
**Severity: HIGH (blocks G2) · Confidence: High**
**Evidence:** S003 AC4 lists "Unicode, untrusted text" among fixtures; S008 AC5
requires inert rendering; S002 AC4 forbids "execution of imported text". No
document enumerates the attack classes, so "untrusted text" will become one
`<script>` string and a checkbox.

The alpha's parsers, normalizer, inspector, and exporter are all reachable by
attacker-influenced content: a book description, a title, a filename inside an
archive, a series name. This is where Prime Directive 6 is won or lost, and it
must be won *now*, because these fixtures are the regression suite that protects
the future LLM stage.

**Required action:** define a named, versioned adversarial corpus with required
classes. See §5, S003 AC6.

### WORF-B11 — Deletion does not cover the artifacts that actually survive
**Severity: HIGH (blocks G2) · Confidence: High**
**Evidence:** S009 AC4 covers "raw/normalized data, caches, temp files,
credentials, and snapshots" plus a restart check.

That list omits the residue that defeats real deletion: temporary archive
extraction directories, SQLite WAL/journal/`-shm` files, OS search-index and
thumbnail caches, editor swap/undo files, shell history containing file paths,
clipboard contents, crash dumps and core files, terminal scrollback, prior
export copies, and — decisively — unlinked blocks on an SSD, which overwriting
cannot reliably reclaim. R06 rates detection difficulty 5 and is right to.

**Required action:** crypto-erase design (all personal data inside one encrypted
container; deletion destroys the key) plus an expanded, tested inventory. See
§5, S009 AC9.

### WORF-B12 — Log, error, and diagnostic redaction has no verifiable rule
**Severity: HIGH (blocks G2) · Confidence: Medium-High**
**Evidence:** S002 AC3 "redacted error/log policy"; S007 AC5 "errors give a
recovery action without exposing private values"; S009 AC5 canary checks.

"Redacted" is undefined. Debug logging of an HTTP response body, an exception
trace carrying a URL with a token, or an error message quoting a book title are
all individually reasonable-seeming and all violate Prime Directive 4. Canaries
detect only the strings we planted.

**Required action:** allowlist-based logging (counts, codes, durations, states —
never values), default log level with no payloads, crash reporting off, and a
verification test. See §5, S002 AC11 and S009 AC10.

### WORF-B13 — G3 can be reached without a security verdict on the proven route
**Severity: HIGH (blocks G1) · Confidence: Medium**
**Evidence:** `05-risks-and-release-gates.md` G3 lists Data + Worf as authority
but its evidence list is entirely about coverage; S004/S005 name me as reviewer
of "runtime access/privacy" and "terms/input safety" with no criteria.

I will not sign a gate whose evidence list contains nothing I can verify. G3
must require the security artifacts from the *actual* run — egress record,
redaction check, raw-capture destruction receipt — not only the four-domain
coverage matrix.

**Required action:** see §5, gate amendment G3-e.

### WORF-B14 — Witnessed runs expose the participant's private library to reviewers
**Severity: MEDIUM-HIGH (blocks G2) · Confidence: High**
**Evidence:** S004 specific DoD "a witnessed consented run"; S009 specific DoD
"Worf witnesses fixture export/disconnect/deletion".

A witness watching a screen full of a listener's audiobook titles has been given
a behavioral profile the plan elsewhere protects rigorously. The S009 witness is
fine — fixtures only. The S004 witness is not.

**Required action:** witness attests process and control evidence, not content.
See §5, S004 AC7.

---

## 4. Non-blocking hardening

| ID | Recommendation | Where |
| --- | --- | --- |
| WORF-H01 | Document the single-user assumption as a security property: no multi-tenant storage shape, no user-ID parameter that could be trusted from input later. Prevents the classic BOLA class before it can exist. | S003, S011 |
| WORF-H02 | Add an explicit "deterministic mode is the product, LLM is an option" statement to S011 AC4 so the future consent design cannot become coercive. | S011 |
| WORF-H03 | Require export format to be JSON (not CSV/TSV) to avoid spreadsheet formula-injection in downstream tools; if CSV is ever added, prefix-escape `= + - @ TAB CR`. | S009 AC2 |
| WORF-H04 | Record provenance of the *harness* itself: runtime version, package lockfile hash, OS build, in the evidence pack — reproducibility is a security control. | S012 AC1 |
| WORF-H05 | Give every untrusted string field a persistent `trust: untrusted-source` marker in the S003 schema so the future LLM adapter cannot lose that context at a layer boundary. Cheap now, invaluable at D05. | S003 |
| WORF-H06 | Treat the consenting listener's marketplace/region as a privacy input, not only a coverage input — regional data-protection obligations differ. | S001 AC3 |
| WORF-H07 | Add a "no screenshots of real captures" rule to review conventions; screenshots are the most common accidental disclosure in evidence packs. | `planning/README.md` |
| WORF-H08 | Set an explicit wall-clock retention limit for raw captures (e.g. destroyed within the same working session, and unconditionally within 24 hours) rather than "before the session ends". | S002 AC5 |
| WORF-H09 | Require the harness to run under a dedicated OS account or container with no cloud-sync folder in its path, and with file-sync/backup clients verified off. | S002 AC3 |
| WORF-H10 | Add MFA verification and a "review connected apps/devices afterward" step to the participant's post-experiment instructions. | S009 AC4 |
| WORF-H11 | Rate-limit and cap the prototype's own request volume explicitly (max requests, max bytes, max runtime per run) so a retry bug cannot become abuse of the provider. | S004 AC4 |
| WORF-H12 | Record a dated re-threat-model obligation at G4 for whichever platform is selected; iOS Keychain/ATS, Azure identity, and local-first threat models are not interchangeable. | S011, G4 |

---

## 5. Exact proposed changes by story / feature ID

I do not edit the plan. Riker owns reconciliation. Below is the precise text I
require, by ID. Additions are new numbered criteria; amendments quote the
existing clause.

### Charter — `01-release-charter.md`

**C1 (WORF-B01), "Access decision and stop rules" — append:**
> Disqualified by default, pending a separate written technical/legal/security
> review and an approved scope change: unofficial or reverse-engineered Audible
> client libraries, Audible device-registration flows not documented for
> third-party use, private/undocumented endpoints, browser automation, HTML
> scraping, extraction of cookies or tokens from a browser profile, and any route
> whose permission rests on the absence of an explicit prohibition.

**C2 (WORF-B02) — replace** "Normal login on the provider's own supported
authorization surface is not credential collection by this application." **with:**
> The user may sign in on the provider's own authorization surface only when that
> surface is rendered by software we do not control — the operating system's
> default browser or a platform-sanctioned authentication session — and our
> process can neither observe, script, autofill, nor intercept the credential
> entry. Embedded web views, headless or automated browsers, imported browser
> profiles, and any credential handling by this application are password
> collection and are prohibited without exception.

**C3 (WORF-B09) — amend the "Trust" CTQ row:** change the measurement from a
claim to a control: "zero AI network requests **and zero non-allowlisted egress,
verified by a default-deny network control and a recorded negative test (S009)**".

**C4 (WORF-B07) — amend the "Locked scope" item 3:** the disposable harness
choice at G1 additionally requires a recorded dependency and supply-chain review
before any personal data enters it at G2.

### ATR-S001 / ATR-F01 — feasibility dossier (Data; Worf review)

**Add AC6 (WORF-B01):**
> Record an explicit disqualified-route list matching the charter stop rules, and
> state for each considered route whether permission is *documented*, *ambiguous*,
> or *absent*. Absence of prohibition is recorded as `unknown`, never as permitted.

**Add AC7 (WORF-B01):**
> Name the authority relied upon for each permission conclusion (document title,
> URL, publication/access date, and — where terms are ambiguous — the qualified
> person or body who must clarify). An engineering opinion is not a legal
> conclusion and must be labeled as an open question routed to the Captain.

**Add AC8 (WORF-H06):** record the candidate marketplace's applicable
data-protection regime and any resulting consent, retention, or deletion
obligations for the test participant.

### ATR-S002 / ATR-F02 — consent and safe experiment boundary (Worf; owner)

**Add AC6 (WORF-B02):**
> Enumerate prohibited credential-handling mechanisms verbatim from charter C2.
> The boundary document states that the harness has no code path capable of
> reading, storing, transmitting, or automating entry of an Audible/Amazon
> password, MFA code, or session cookie, and names the review step that verifies
> this before G2.

**Add AC7 (WORF-B04):**
> If the route is an account data export, specify a pre-ingest file allowlist:
> only the named Audible/audiobook artifacts are read. All other archive members
> are refused, never parsed, never copied, never logged by name, and never
> indexed. Define archive-safety limits before extraction — member count, member
> size, total expansion ratio, path-traversal rejection, symlink rejection, and
> extraction only to a dedicated encrypted scratch location.

**Add AC8 (WORF-B05):**
> Produce a dated, signed consent record naming the participant (self-consent by
> the developer is acceptable and still required in writing), the exact data
> categories, purpose, storage locations, retention limit, the no-AI-egress
> commitment, and the withdrawal method. Withdrawal at any point triggers the
> S009 deletion path within a stated period. No household member's or third
> party's data is in scope; if the source cannot separate it, that is a stop
> condition escalated to the Captain.

**Add AC9 (WORF-B06):**
> Publish an incident-response runbook before G2 covering: token/authorization
> revocation steps and the provider's revocation surface; response to a secret or
> capture reaching the repository, including history purge and mandatory
> rotation; response to unexpected egress; notification of the participant; and
> the requirement that the experiment halts until the incident is closed.

**Add AC10 (WORF-B07):**
> Define supply-chain rules for the harness: minimal direct dependencies with a
> stated justification each; pinned versions with a committed lockfile; no
> install/postinstall scripts; recorded vulnerability and license check with a
> date; no dependency added after G2 without re-review.

**Add AC11 (WORF-B12):**
> Define logging by allowlist: permitted fields are record counts, state names,
> error classes/codes, durations, and timestamps. Prohibited in all logs, error
> messages, exception traces, stack frames, and UI diagnostics: tokens, URLs
> containing credentials, file paths of user-supplied files, raw request/response
> bodies, titles, identifiers, and any free-text source content. Default log
> level carries no payloads; verbose modes are unavailable when real data is
> loaded. Platform crash reporting and telemetry are disabled.

**Amend AC5 (WORF-H08):** replace "before the session ends" with a stated
wall-clock maximum and a destruction receipt recorded in the evidence pack.

### ATR-S003 / ATR-F03 — evidence schema and fixtures (Data; Worf review)

**Add AC6 (WORF-B10):**
> Define a versioned adversarial fixture corpus, referenced by name from S006,
> S007, S008 and S009, covering at minimum: HTML/script/SVG/event-handler
> payloads; `javascript:` and `data:` URLs; prompt-injection strings in
> descriptions, titles and series names ("ignore previous instructions",
> fabricated system/tool directives, invented user preferences, hidden
> zero-width and bidirectional-control text); template/format-string and
> expression-syntax payloads; spreadsheet formula prefixes; path traversal and
> absolute paths in identifiers and filenames; oversized fields and deeply nested
> structures; malformed encodings and lone surrogates; duplicate and colliding
> identifiers; and remote-resource URLs used as SSRF/tracking probes. Each fixture
> states its expected inert outcome.

**Add AC7 (WORF-H05):** every source-derived string field carries a persistent
trust marker distinguishing source-supplied untrusted text from application-owned
values, preserved through normalization, storage, export, and display.

**Add AC8 (WORF-H01):** the schema records the single-user assumption explicitly;
no user identifier is ever accepted from imported or external input.

### ATR-S004 / ATR-F04 — approved capture/import proof (Data; Worf review)

**Add AC6 (WORF-B04):**
> Demonstrate that non-allowlisted export content was refused before parsing:
> report counts of accepted and refused artifacts and confirm no refused artifact
> was read, copied, named in a log, or retained.

**Add AC7 (WORF-B14):**
> The witness attests to process and controls — consent record present, route
> matches G1 approval, egress record clean, redaction check passed, raw capture
> destroyed — and is not shown the participant's library content. Content-level
> verification is performed by the participant themselves against a sanitized
> checklist.

**Add AC8 (WORF-H11):** declare and enforce per-run caps on request count, total
bytes, and wall-clock duration; exceeding a cap aborts the run rather than
continuing.

**Amend AC5:** raw-capture cleanup produces a recorded destruction receipt
(what, where, when, method) rather than an assertion of cleanup.

### ATR-S005 / ATR-F05 — candidate catalog metadata proof (Data; Worf review)

**Add AC6 (WORF-B03):**
> A catalog route whose terms require an affiliate, associates, advertising, or
> revenue-sharing relationship, or that mandates tracking identifiers or
> promotional link formats, is **ineligible** for the candidate pipeline. If such
> a route is the only available one, S005 records a blocked finding and escalates
> to the Captain as a trust-principle conflict; it is not adopted "for metadata
> only". Record for the chosen route: contractual basis, tracking obligations,
> redistribution/caching rights, and attribution requirements.

**Add AC7 (WORF-B10 / SSRF):** catalog responses are validated against the S003
schema before storage; cover images and any source-supplied URL are stored as
inert text and never fetched during alpha.

### ATR-S006 / ATR-F06 — normalized snapshot (Data; Worf review)

**Add AC6:**
> The normalizer performs no network I/O and no filesystem access outside the
> designated storage location; this is asserted by test. Rejected and quarantined
> records retain their trust markers and are never promoted by a retry path.

### ATR-S007 / ATR-F07 — repeat import and failure isolation (Data; Worf review)

**Add AC6 (WORF-B12):**
> Fault-injection cases assert on error *content*: no failure path emits titles,
> identifiers, file paths, tokens, or raw source text into logs, UI errors, or
> exit output. The adversarial corpus (S003 AC6) is included in repeat, partial,
> and interrupted import runs.

### ATR-S008 / ATR-F08 — accessible inspector (Geordi; Worf review)

**Add AC6 (WORF-B09 / SSRF):**
> The inspector issues zero outbound network requests. No remote images, fonts,
> styles, scripts, analytics, or link prefetch. Source-supplied URLs are displayed
> as text and are not activatable in alpha. If the harness is web-based, apply a
> restrictive Content-Security-Policy with no remote origins and no inline script,
> and verify it.

**Add AC7 (WORF-B10):** render the full adversarial corpus and record evidence
that every payload appears as inert, visible text — no execution, no navigation,
no hidden request, no layout escape, and no truncation that hides a payload.

**Amend AC5:** exported review reports omit personal content **by construction**
(personal fields are not in the report data model), not merely "by default".

### ATR-S009 / ATR-F09 — prototype data lifecycle controls (Data; Worf blocking)

**Add AC6 (WORF-B07):** record the completed dependency inventory,
vulnerability scan, license check, and lockfile state as G2 evidence; unresolved
critical/high vulnerabilities in the harness's dependency tree block G2.

**Add AC7 (WORF-B08):**
> No capture, normalized store, export, key, or credential is ever created inside
> the repository working tree; storage lives in a separate, documented, encrypted
> location. Add ignore rules as defense in depth, a pre-commit canary/secret scan,
> and a staged-diff check demonstrated to fail closed on a planted canary.

**Add AC8 (WORF-B09):**
> Enforce default-deny egress for the harness with an explicit destination
> allowlist limited to the approved source/catalog endpoints. Record a negative
> test: with real-shaped fixtures loaded, the observed destination set is empty
> (import mode) or exactly the allowlist (API mode), and an attempted
> non-allowlisted request fails closed and is surfaced as an error — never
> silently swallowed.

**Add AC9 (WORF-B11):**
> Deletion is designed as crypto-erase: all personal data resides in a single
> encrypted container whose key is destroyed on deletion. The tested inventory
> additionally covers archive extraction directories, database journal/WAL/shm
> files, OS thumbnail and search-index entries, editor swap/undo files, shell
> history, clipboard, crash dumps/core files, terminal scrollback, and prior
> export copies. Disclose honestly what we cannot erase: the provider's records,
> user-held export copies, and unlinked storage blocks on solid-state media.
> Verify by restart **and** by a search of the documented storage locations for
> planted canaries after deletion.

**Add AC10 (WORF-B12):** demonstrate the S002 AC11 logging allowlist by test:
run the adversarial and realistic fixtures at the default log level and assert the
absence of every prohibited category, not merely of planted canaries.

**Amend AC2 (WORF-H03):** export is JSON; if any tabular format is later added,
formula-injection escaping is mandatory.

### ATR-S010 / ATR-F10 — recommendation trust contract (Data; Worf review)

**Add AC7 (WORF-B03):** the contract rejects not only commercial *fields* but
candidate records whose source route carries an affiliate/advertising obligation;
route provenance is a required field on every candidate.

**Add AC8 (WORF-B10 → future D05):** record, as a deferred-test list entry with
concrete content, the prompt-injection and grounding tests that must pass before
any LLM stage ships: strict separation of system instructions from untrusted
catalog text and user comments; output validated against the candidate set and
allowed identifiers; no tool, credential, network, or database authority for the
model; rejection of invented titles, metadata, and user history.

### ATR-S011 / ATR-F11 — architecture decision record (Data; Worf review)

**Add AC6 (WORF-H12):** the ADR includes a platform-specific threat-model
obligation: for iOS, Keychain classes, background-refresh exposure, deep-link and
pasteboard handling, and lock-screen/notification disclosure; for hosted web,
token custody, session and CSRF controls, transport and header policy, and
server-side custody of listening data; for local-first, disk encryption, backup
inclusion, and multi-user-workstation exposure. The decision records which
threat model is accepted and what re-review G4 requires.

**Add AC7 (WORF-H02):** record that deterministic operation remains fully useful
without any model, so future hosted-model consent can never be coerced.

### ATR-S012 / ATR-F12 — alpha decision pack (Riker; Worf review)

**Add AC6:**
> Include a security evidence annex: egress negative-test record, logging
> redaction test record, deletion inventory with canary re-scan results,
> dependency/vulnerability/license record with dates, raw-capture destruction
> receipts, consent record reference (not its contents), disqualified-route list,
> and the incident runbook. Any missing item blocks G5.

**Amend AC3:** dependency/license checks are reported as *re-verified* at G5,
having first been performed at G2 (WORF-B07).

### Requirements matrix — `02-requirements-and-hierarchy.md`

- **ATR-PR05** additionally maps to S003, S006, S007, S010, S011 — privacy and
  security controls now carry acceptance criteria in those stories.
- **ATR-PR08** additionally maps to S005 for the affiliate-coupling stop rule.
- **ATR-PR10** additionally maps to S008 and S009 for egress denial evidence.

---

## 6. Missing acceptance criteria and security tests

The plan's test thinking is honest about what does not exist. These are the
security tests it still lacks. All are fixture-based and none requires new
product features.

**Must exist before G2 (fixtures only):**

1. **Egress denial test** — default-deny proven; allowlisted destinations exactly
   as approved; non-allowlisted request fails closed and is visible. (S009 AC8)
2. **No-AI-egress test** — no AI SDK present in the dependency tree; no AI
   endpoint reachable or referenced. Backs the charter's "zero AI network
   requests" CTQ. (S009 AC8 / S010 AC6)
3. **Credential-absence test** — static check that no code path reads, stores, or
   transmits a password, MFA code, or browser cookie jar; no embedded-webview or
   browser-automation dependency present. (S002 AC6, S009 AC6)
4. **Archive-safety tests** — path traversal (`../`, absolute, UNC), symlink
   members, expansion-ratio bomb, member-count and member-size caps, non-allowlisted
   member refusal without parsing. (S002 AC7, S004 AC6)
5. **Adversarial-corpus render test** — every S003 AC6 payload inert in the
   inspector: no script execution, no navigation, no outbound request, no layout
   escape. (S008 AC7)
6. **Injection-through-normalization test** — payloads survive as data with trust
   markers intact and never alter control flow, identity joins, file paths, or
   query construction. (S006 AC6)
7. **Log-redaction test** — realistic and adversarial fixtures at default log
   level produce no prohibited category; assert by pattern class, not only by
   planted canary. (S009 AC10)
8. **Secret/capture containment test** — pre-commit scan fails closed on planted
   canaries; storage path is verified outside the repository tree. (S009 AC7)
9. **Deletion completeness test** — canaries planted across every inventoried
   location, deletion executed, re-scan after restart finds none; key-destruction
   verified. (S009 AC9)
10. **Export-safety test** — export contains no tokens, no secrets, no
    non-allowlisted source fields; round trip preserves logical data; formula
    injection not possible in the chosen format. (S009 AC2)
11. **Failure-path redaction test** — cancellation, denied authorization,
    malformed input, interruption, and timeout each produce actionable errors
    containing no private values. (S007 AC6)
12. **Dependency gate evidence** — lockfile pinned, no install scripts,
    vulnerability and license scan dated and clean of critical/high. (S009 AC6)

**Must exist before G3 (real-path run):**

13. **Per-run cap enforcement** — request/byte/duration caps abort rather than
    continue. (S004 AC8)
14. **Raw-capture destruction receipt** — recorded and verified. (S004 AC5)
15. **Post-run egress record** — observed destinations equal the allowlist, no
    exceptions. (S004, G3 evidence)

**Documented as deferred, with content (not a bare "TBD"):** prompt-injection
resistance suite, model-output schema validation, candidate-set containment,
grounding/no-hallucination checks, cross-user isolation for any future
multi-user or embedding store, consent-flow security for hosted models. (S010 AC8)

---

## 7. Release-blocking gates

I ratify the existing gate structure. It is sound. I bind my approval to the
following additions, expressed as amendments to `05-risks-and-release-gates.md`.

**G0 — initial plan review.** My approval requires WORF-B01, B02, B03, B04
resolved in the documents (they are scope and stop-rule defects, not
implementation work) and B05–B14 accepted as committed acceptance criteria.

**G1-e — approved route/design.** Add to required evidence: disqualified-route
list (S001 AC6); named permission authority per route (S001 AC7); consent record
drafted and revocation path defined (S002 AC8); incident runbook published
(S002 AC9); credential-handling prohibitions written into the boundary
(S002 AC6); export allowlist defined if export route (S002 AC7). **Failure
behavior:** no harness construction touching real data; ambiguous permission is
escalated, never inferred.

**G2-e — safe to handle real data (Worf blocking).** Add to required evidence:
security tests 1–12 of §6 passing with recorded output; dependency and
supply-chain review complete and clean of critical/high (WORF-B07); storage
outside the repository with pre-commit containment proven (WORF-B08);
crypto-erase deletion verified by canary re-scan (WORF-B11). **Failure
behavior:** fixtures only. No authorization, no export file, no account. I will
state this plainly: **G2 is my post. It does not move.**

**G3-e — actual access feasibility.** Add to required evidence: post-run egress
record, redaction verification, raw-capture destruction receipt, consent record
in force at run time, and confirmation the executed route is byte-for-byte the
G1-approved one. Coverage evidence alone does not pass G3 (WORF-B13).

**G4-e — evidence-led architecture.** Add: accepted platform-specific threat
model and the security re-review obligations it creates (WORF-H12).

**G5-e — full team validation.** Add: security evidence annex complete
(S012 AC6); tests 1–15 re-run against the actual adapter and inspector, not only
the fixture harness; no open Worf blocker; R04, R06, R07 re-scored only against
*executed* controls.

**G6 — Captain's release decision.** Unchanged, plus: alpha wording must state
plainly that this is a private feasibility prototype, that no synchronization
service exists, and — if applicable — "import-based prototype; no automatic
synchronization."

**New standing gate condition:** any change to the access route, harness runtime,
dependency set, storage location, or egress allowlist after G2 requires my
re-approval. Not notification. Approval.

---

## 8. Residual risks

Accepted after the changes above, and honestly stated:

| ID | Residual risk | Why it remains | Disposition |
| --- | --- | --- | --- |
| RR1 | Permission ambiguity in provider terms | Terms are not written for our use case; a lawful-seeming route may still be unwelcome | Escalate to Captain with qualified clarification; stop rather than proceed on inference (S001 AC7) |
| RR2 | Workstation compromise defeats every control | The harness runs on a general-purpose developer machine (A10) | Minimize retention, encrypt at rest, destroy raw captures quickly; accept for a private alpha |
| RR3 | Incomplete erasure on solid-state media | Overwrite semantics are not guaranteed by the filesystem | Crypto-erase and disclose the limitation honestly (S009 AC9) |
| RR4 | Provider-side records persist after our deletion | Outside our control entirely | Disclose in consent and deletion UI; direct the participant to the provider's own controls |
| RR5 | User-held export copies outside the harness | The participant may retain the original archive | Consent text and cleanup instructions (S009 AC4) |
| RR6 | Export archive may contain non-Audible personal data we must refuse | Source packaging is not under our control | Refuse before parsing; stop condition if separation is impossible (S002 AC7) |
| RR7 | Unknown unknowns in an unproven route's failure modes | No runtime evidence exists yet | Bounded caps, fail-closed, witnessed run, immediate stop authority (S004) |
| RR8 | Future LLM risks are deferred, not solved | No model ships in alpha | D05 cannot be promoted without the deferred suite in S010 AC8 |
| RR9 | Self-consent by the developer is weaker than independent consent | Single-user alpha, participant is likely the builder | Acceptable for private alpha; written record required; not acceptable for any future participant without review |
| RR10 | Catalog rights may permit access but not retention | Terms vary and may change | Bounded samples only; re-verify before any later release |

**Risk register amendments I require:** add R14 export-archive over-collection
(S9 O6 D5 = 270, owner Worf, gate G1/G2); R15 harness supply-chain compromise
(S9 O4 D6 = 216, owner Worf, gate G2); R16 secret or capture committed to git
(S10 O3 D4 = 120, owner Worf, gate G2); R17 witness/reviewer exposure to private
content (S6 O4 D5 = 120, owner Worf, gate G2). R04 detection difficulty must not
be lowered until tests 1, 3, 7, 8 execute. R06 may not be re-scored until test 9
executes with canary re-scan. R07 may not be re-scored until tests 5 and 6
execute against the full adversarial corpus.

---

## 9. Positive controls — specific praise

I do not give this freely, so understand its weight.

1. **No assumed API.** `01-release-charter.md` refuses to presuppose an Audible
   OAuth flow and makes a documented no-go an honorable outcome. This is the
   single most important security decision in the plan.
2. **Password prohibition is stated in four places** and made a CTQ with zero
   tolerance. The intent is unambiguous; only the mechanism definition needed
   sharpening (WORF-B02).
3. **S009 blocks S004 through G2.** Lifecycle controls are built and tested
   *before* a real person's data can be captured. Most teams do this in reverse
   and lose data learning why. Whoever sequenced this understood the stakes.
4. **Fixture-first discipline.** "Synthetic fixtures are test evidence, never
   proof of actual Audible access" and "A fixture success cannot mark actual
   access `proven`" (S004 AC3) — this refuses the success-shaped fallback my
   directives forbid.
5. **Zero LLM surface in alpha** (S010 AC6, D07), with provider abstraction
   preserved for later. The largest data-egress risk is simply absent.
6. **Trust contracts written before the engine exists** (S010). Commercial
   exclusion and anti-profiling are made executable before anything can be
   retrofitted around them. Prevention, not apology.
7. **Honest unknowns throughout** — `documented-not-tested`, `partial`,
   `unavailable`, `unknown`; "Unknown availability is not treated as eligible"
   (S005 AC5). Refusing to fabricate certainty is a security control.
8. **Schema-level refusal of sensitive inference** (S003 AC5): no field may store
   inferred political affiliation or sensitive identity. Designing the abuse out
   of the data model is superior to policing it later.
9. **Untrusted-source posture already present** (S002 AC4, S007 AC5, S008 AC5,
   R07). The instinct is correct; B10 only makes it rigorous.
10. **"Do not mark a gate passed simply because a review was requested"** and
    "no 'known blocker' waiver by silence" (G5). These two sentences protect
    every other control in the document.

---

## 10. Approval conditions

I will record **APPROVED** for Worf's G0 line in
`05-risks-and-release-gates.md` when all of the following hold:

1. Charter amendments C1–C4 are applied.
2. WORF-B01 through B14 are resolved or accepted as written acceptance criteria
   on the named stories, with no criterion softened in wording.
3. §6 security tests 1–12 are recorded as G2 evidence requirements, and 13–15 as
   G3 evidence requirements, in `05-risks-and-release-gates.md`.
4. Gate amendments G1-e, G2-e, G3-e, G4-e, G5-e and the standing post-G2 change
   condition are added.
5. Risks R14–R17 are added and the re-scoring restrictions on R04, R06, R07 are
   recorded.
6. The requirements matrix additions in §5 are applied.
7. Riker records each change with reason, affected IDs, and scope/point/risk
   impact under the existing change control, and the Captain rebaselines. My
   findings add constraints and tests, not features; I assess the point impact as
   small and confined to S002 and S009. If Riker's analysis differs, the estimate
   is his authority, not mine — but the controls are not negotiable.

**Conditions under which I withdraw approval at any later gate:** an access route
changes without my re-review; an embedded webview, browser automation, or
credential-handling path appears in any form; personal data enters the repository
or a cloud-synced location; an AI SDK or endpoint is added; a dependency is
introduced after G2 without re-review; a security test is marked passed without
recorded output; or a blocking finding is closed by assertion rather than
evidence.

We do not trade a listener's account and the record of their private hours for a
faster demonstration. A warrior does not abandon his post because standing is
uncomfortable.

*Qapla'.* Harden the defenses, and this alpha will be worthy.

— **Worf, Son of Mogh**, Chief Security Officer
*Review submitted for G0. No plan document was modified, and nothing was
committed or pushed.*
