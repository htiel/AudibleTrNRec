# Wesley Crusher — Product Gap & Behavior Review: Alpha 0.0.1

- **Reviewer:** Wesley Crusher, Creative Technologist & Innovation Advisor
- **Target Commit:** `6145f98` ("Add private alpha Audible connector")
- **Review Date:** 2026-09-17
- **Authority Documents:**
  - `APP_DESCRIPTION.md`
  - `planning/0.0.1/01-release-charter.md`
  - `planning/0.0.1/02-requirements-and-hierarchy.md`
  - `planning/0.0.1/03-user-stories.md`
  - `planning/0.0.1/05-risks-and-release-gates.md`
  - `planning/0.0.1/10-private-alpha-connector-change-control.md`
- **Output Artifact:** `planning/0.0.1/feedback-and-bugs/wesley-product-gap-review.md`

---

## 1. Tested Scope

This review examines the full product behavior and implementation of Audible Track and Recommend (ATnR) at commit `6145f98`. The scope covers:

1. **Architecture & Trust Alignment:** Evaluation against the core requirements of `APP_DESCRIPTION.md` and the release charter (`01-release-charter.md`), specifically verifying the boundaries between imported source facts, personal opinions, trust rules, and feasibility gates.
2. **User Interface & LCARS Evidence Inspector:** Thorough line-by-line inspection of all UI layers (`code/Alpha0.x/ui/index.html`, `tokens.css`, `base.css`, `layout.css`, `components.css`, `app.js`, `store.js`, `router.js`, `dom.js`, `format.js`, `connection-api.js`, and all views under `ui/js/views/`).
3. **Core Platform-Neutral Logic:** Verification of data modeling, schema validation, snapshot merges, sorting, filtering, grouping, and trust assertions in `code/Alpha0.x/src/` (`model.js`, `library.js`, `contract.js`, `trust.js`, `validate.js`, `errors.js`, `version.js`).
4. **Private Alpha Synchronization & Connector Pipeline:** Review of `scripts/serve.js`, `scripts/private-alpha-runtime.js`, `scripts/private-alpha-policy.js`, `src/sync/private-alpha-service.js`, `src/sync/live-snapshot.js`, `src/store/encrypted-snapshot-store.js`, `src/adapters/connector-process.js`, and the isolated Python connector (`connector/atnr_connector/service.py`, `normalize.py`, `custody.py`, `policy.py`, `rpc.py`).
5. **Executable Test Coverage:**
   - Executed full Node test suite: 156 tests (155 passed, 0 failed, 1 environment-dependent symlink skip).
   - Executed Python connector unit tests: 9 tests (9 passed, 0 failed).
   - Validated machine-readable policy enforcement: `npm run policy:check` confirmed private-alpha validity and commercial shipping block.
6. **Live Environment & Browser Page Inspection:**
   - Evaluated the active loopback server running on `http://127.0.0.1:4310/?private-alpha=1#/data` (PID 7832). Tested HTTP status, headers, and API endpoints (`/api/v1/session`, `/api/v1/status`).
   - Inspected shared browser page ID `01ed1ad7-2f55-4bbe-b34f-642d1f435015`: remote debugging protocol is not exposed via standard DevTools ports on this environment, but complete DOM structure, view state transitions, and API interactions were verified via direct code analysis and loopback HTTP probes.
7. **Privacy & Safety Rails Enforced:**
   - **Zero disclosure:** In accordance with explicit instructions, no personal library contents, book titles, author/narrator names, ASINs, or participant-specific item counts are printed, disclosed, or stored in this document.
   - **Zero mutation:** No data was mutated, no database records were modified, no Disconnect or Delete actions were triggered, and the running background server was not stopped.

---

## 2. Key Product Strengths

1. **Ironclad Credential Isolation & DPAPI Custody:**
   The implementation of the persistent private connector (`atnr_connector/custody.py` and `src/adapters/connector-process.js`) is an engineering triumph. Audible authentication occurs strictly within an Amazon-controlled headed Edge browser window. The Node application and browser frontend never receive, handle, or store Amazon passwords, session cookies, or tokens. Provider credentials remain locked in the isolated Python process, sealed via Windows user-scoped DPAPI, and stored strictly outside the repository in `%LOCALAPPDATA%`.
2. **Defensive Loopback Architecture & Strict CSP:**
   `scripts/serve.js` enforces a textbook loopback security perimeter. Responses carry `default-src 'none'`, `script-src 'self'`, `style-src 'self'`, `object-src 'none'`, `frame-ancestors 'none'`, and `connect-src 'self'`. DNS-rebinding protection (`isAllowedHost`) restricts Host headers to loopback. Same-origin checks and high-entropy CSRF tokens protect all state-changing API endpoints.
3. **Flawless Realization of the Trust Contract (WES-B02 / WES-B03):**
   `src/core/contract.js` and `src/core/trust.js` faithfully realize the grounded explainability and anti-echo-chamber mechanisms established during our G0 review. The closed contract enforces tripartite labeling (`DIRECT_MATCH`, `EXPLORATORY`, `PERSPECTIVE_BROADENING`), bans sensitive-trait or political profiling, enforces baseline quality/relevance/credibility floors, and forbids commercial, affiliate, and sponsored tokens by construction.
4. **Resilient Idempotent Synchronization & Failure Isolation:**
   `mergeLibrarySnapshot` (`src/core/model.js:246`) safely isolates malformed incoming records into a diagnostic category without crashing or aborting the batch. Re-running the sync produces identical deterministic states, and source deletions are flagged (`missingFromSource: true`) rather than silently deleting local state.
5. **Accessible LCARS Visual Language:**
   The UI delivers authentic 2369-era Star Trek LCARS aesthetics without sacrificing accessibility. Text content (titles, notes, synopses) remains readable natural-case prose (`base.css:26-53`), while chrome uppercase is restricted to headings and labels. Unobscured focus outlines (`outline: 3px solid var(--lcars-border-focus)`), `prefers-reduced-motion` suppression, and live ARIA status regions (`#live-polite`, `#live-assertive`) provide a strong WCAG 2.2 AA foundation.
6. **Transparent Device Disclosures:**
   The UI honestly informs the user that the upstream provider registration identifies as "Audible for iPhone" due to upstream library constraints, while ATnR identifies itself locally. No deceptive spoofing or renaming occurs.

---

## 3. Severity-Ranked Bugs, Gaps, and Behavioral Confusions

### Summary Matrix

| ID | Title | Severity | Impacted Files & Lines | Category |
|---|---|---|---|---|
| **BUG-01** | Contributor Dual-Role Hash Collision Duplicates Entities | **Critical** | `atnr_connector/normalize.py:69-74` | Data Model / Canonical Schema |
| **BUG-02** | Feasibility Trace Inaccurately Claims "Synthetic" on Real Data | **High** | `ui/js/views/feasibility-view.js:14, 38-40, 50-51`<br>`ui/js/store.js:166-200` | Truth in Evidence / UX Confusion |
| **BUG-03** | Missing JSON Export Control in Private Alpha UI | **High** | `ui/js/views/data-view.js:105-235`<br>`ui/js/store.js:255-266` | Charter Non-Compliance / User Control |
| **BUG-04** | Incomplete Feasibility Domains: Zero Listening History & Timestamps | **High** | `atnr_connector/normalize.py:195-202` | Feasibility Gate G3 Gap |
| **BUG-05** | Search Filter Fails on Genre Queries Despite UI Placeholder | **Medium** | `src/core/library.js:106`<br>`ui/js/views/library-view.js:58-63` | Functional Search Defect |
| **BUG-06** | Plural/Singular Grouping Key Collision Causes Empty Headings | **Medium** | `ui/js/views/library-view.js:29-31`<br>`src/core/library.js:47-53, 125-135` | UI Grouping Defect |
| **BUG-07** | Non-Owned Candidate Catalog Lookup Missing from Connector | **Medium** | `atnr_connector/service.py:190-244` | Feasibility Gate G3 Gap |
| **BUG-08** | Hardcoded 2,000-Char Limit Discards Long Audiobook Synopses | **Medium** | `atnr_connector/normalize.py:34-37, 185-189`<br>`src/core/validate.js:14` | Data Loss / Truncation Policy |
| **BUG-09** | Non-Clickable Facets and Ephemeral Filter State Loss | **Medium** | `ui/js/views/library-view.js:94-118`<br>`ui/js/views/book-detail-view.js:46-50` | UX Gap / Discovery Friction |
| **BUG-10** | Mathematical Rounding Hides Uncertainty in Feasibility Card | **Low** | `ui/js/store.js:154`<br>`ui/js/views/feasibility-view.js:31` | Statistical Honesty |

---

### Detailed Findings

#### BUG-01: Contributor Dual-Role Hash Collision Duplicates Entities
- **Severity:** Critical (Alpha Blocker — Violates Canonical Data Model)
- **Exact Location:** `code/Alpha0.x/connector/atnr_connector/normalize.py:69-74`
- **Behavior & Evidence:**
  In `_contributor()`, the person identifier is computed as:
  ```python
  # normalize.py:69
  person_id = _identifier("person", f"{role}:{source_id}")
  existing = people.get(person_id)
  if existing:
      if role not in existing["roles"]:
          existing["roles"].append(role)
          existing["roles"].sort()
  ```
  Because `role` is embedded directly into the hash input string (`f"{role}:{source_id}"`), an author Neil Gaiman hashes to `aud-us-person-<hashA>`, while a narrator Neil Gaiman hashes to `aud-us-person-<hashB>`. Consequently, `existing = people.get(person_id)` is **never** found when the same individual appears in a different role. Lines 71–74 are unreachable dead code.
- **User Impact:**
  Directly violates `APP_DESCRIPTION.md` Section "Proposed Data Model - Catalog Person":
  > *"One person may have multiple roles and must not be duplicated merely because they appear as both an author and a narrator."*
  Dual-role creators (e.g., author-narrators like Wil Wheaton, Neil Gaiman, Stephen King) are fractured into duplicate person entities across the catalog. This corrupts narrator affinity tracking and future recommendation scoring.
- **Proposed Fix:**
  Derive the person ID from `source_id` alone (e.g., `person_id = _identifier("person", source_id)`). When `existing = people.get(person_id)` finds a match, append the new role to `existing["roles"]`.
- **Acceptance Test:**
  Normalizing a library item list containing the same ASIN/name as author on Book 1 and narrator on Book 2 must yield exactly one entity in `catalog.people` with `roles: ['author', 'narrator']`.

---

#### BUG-02: Feasibility View & Structural Trace Inaccurately Claims "Entirely Synthetic" on Real Data
- **Severity:** High (Truth in Evidence / User Confusion)
- **Exact Location:**
  - `code/Alpha0.x/ui/js/views/feasibility-view.js:14, 38-40, 50-51`
  - `code/Alpha0.x/ui/js/store.js:166-200`
- **Behavior & Evidence:**
  When booted with `--private-alpha`, `store.catalog` is loaded with the user's decrypted real Audible library. However, `feasibility-view.js` statically asserts:
  ```javascript
  // feasibility-view.js:14
  h('caption', { text: 'Read-only metadata feasibility card (catalog-wide, synthetic data only)' })

  // feasibility-view.js:50-51
  h('p', { class: 'lcars-status-statement', text: 'This trace is entirely synthetic. It is a factual listing of which invented titles share a catalog attribute. It is not a recommendation, it does not rank titles, and it never mixes in any participant preference or listening record.' })
  ```
  In reality, `store.sharedFacetTrace()` executes across `this.catalog.books.values()`, displaying the participant's **real, personal audiobook titles** grouped by shared author, narrator, series, and genre.
- **User Impact:**
  The user is told their data is "invented titles" and "entirely synthetic" while looking directly at their private library titles. Furthermore, this breaches Release Charter Section "Locked scope" Item 8 and story ATR-S008 AC9, which mandate that the trace must remain a *clearly marked separate synthetic trace* so that real user records are never confused with mock recommendation demonstrations.
- **Proposed Fix:**
  Branch `renderFeasibilityView`:
  1. In synthetic mode, retain the synthetic notices.
  2. In private-alpha mode, either decouple the structural trace to run strictly against the bundled synthetic fixture (`SYNTHETIC_BOOKS`), or update the copy to state: `"Private Library Facet Graph: Factual clustering of your synchronized Audible library across shared authors, narrators, and series."`
- **Acceptance Test:**
  When `store.runtimeMode === 'private-alpha'`, the trace must either display synthetic fixtures with the synthetic disclaimer, or truthfully describe live library relations without claiming they are invented.

---

#### BUG-03: Missing JSON Export Control in Private Alpha UI
- **Severity:** High (Charter Non-Compliance / User Data Sovereignty)
- **Exact Location:**
  - `code/Alpha0.x/ui/js/views/data-view.js:105-235`
  - `code/Alpha0.x/ui/js/store.js:255-266`
- **Behavior & Evidence:**
  In `renderDataView` (synthetic mode), an "Export synthetic snapshot as JSON" button triggers `downloadJson`.
  In `renderPrivateAlphaDataView` (private alpha mode), there are buttons for `Sync now`, `Disconnect Audible`, and `Delete local library snapshot`, but **zero export button exists**.
  Furthermore, `store.exportState()` hardcodes:
  ```javascript
  // store.js:258-265
  runtimeProfile: RUNTIME_PROFILE, // says dataSource: 'synthetic-fixtures'
  libraryEntries: this.entries,    // omits catalog, books, people, and facets!
  ```
- **User Impact:**
  Violates Release Charter Section "Locked scope" Item 9 and `APP_DESCRIPTION.md` MVP Criterion 10 ("Export and permanently delete their application data"). A user running the private alpha has no way to export their normalized library snapshot to inspect or back it up outside SQLite.
- **Proposed Fix:**
  1. Add an "Export private library snapshot as JSON" button to `renderPrivateAlphaDataView`.
  2. Update `store.exportState()` to serialize the normalized catalog (books, people, facets) and library entries with `PRIVATE_ALPHA_RUNTIME_PROFILE` when running in private alpha.
- **Acceptance Test:**
  Clicking "Export private library snapshot as JSON" in private alpha mode downloads a valid JSON file containing the full normalized catalog, library entries, and private-alpha runtime profile.

---

#### BUG-04: Incomplete Feasibility Domains: Zero Listening History & Timestamps
- **Severity:** High (Feasibility Gate G3 Gap)
- **Exact Location:** `code/Alpha0.x/connector/atnr_connector/normalize.py:195-202`
- **Behavior & Evidence:**
  In `normalize_library()`, imported library entries are hardcoded to:
  ```python
  # normalize.py:195-202
  entries.append(
      {
          "bookId": book_id,
          "status": _status(raw, percent),
          "percentComplete": percent,
          "positionSeconds": None,
          "acquiredAt": _date(raw.get("purchase_date")),
          "lastListenedAt": None,
          "completedAt": None,
      }
  )
  ```
  Exact playback position in seconds (`positionSeconds`), last listened timestamp (`lastListenedAt`), and completed timestamp (`completedAt`) are hardcoded to `None`.
- **User Impact:**
  `APP_DESCRIPTION.md` Section 2 ("Library and Listening History") and Gate G3 require proving all four domains: Library, History, Progress, and Catalog.
  While percentage progress and status are captured, listening history and exact playback position are completely absent. In the UI, sorting by `Last listened` or `Date completed` produces an uninformative list where 100% of rows are unknown, and Book Detail renders `"Last listened: Unknown date"` for every book.
- **Proposed Fix:**
  Audit the raw `audible` 0.12.0 `library` response groups (`listening_status`, `product_details`) for any playback position attributes or event dates. If unexposed by `GET /1.0/library`, update the Feasibility Card and documentation to explicitly state that listening history timestamps require event-stream exports, preventing misleading empty sorting controls.
- **Acceptance Test:**
  Unit tests confirm whether timestamp fields exist in raw provider payloads, and the UI disables or annotates sort fields that are 100% unknown across the active catalog.

---

#### BUG-05: Search Filter Fails on Genre Queries Despite UI Placeholder
- **Severity:** Medium (Functional Search Defect)
- **Exact Location:**
  - `code/Alpha0.x/src/core/library.js:106`
  - `code/Alpha0.x/ui/js/views/library-view.js:58-63`
- **Behavior & Evidence:**
  The search input placeholder explicitly instructs the user:
  ```javascript
  // library-view.js:59
  placeholder: 'e.g. dungeon, Ashgrove, fantasy',
  ```
  However, `filterLibrary` in `src/core/library.js` builds its search haystack as:
  ```javascript
  // library.js:106
  const haystack = [row.title, row.subtitle ?? '', ...row.authors, ...row.narrators, row.series ?? '']
    .join(' ').toLowerCase();
  if (!haystack.includes(query)) return false;
  ```
  `...row.genres` is completely omitted from `haystack`.
- **User Impact:**
  When a user follows the exact placeholder prompt and types `"fantasy"` (or any genre name), the search returns `0` titles, unless the word "fantasy" happens to appear in the book title.
- **Proposed Fix:**
  Add `...row.genres` to the `haystack` array in `code/Alpha0.x/src/core/library.js:106`.
- **Acceptance Test:**
  `filterLibrary(rows, { query: 'fantasy' })` matches books where `row.genres` contains `"Fantasy"`.

---

#### BUG-06: Plural/Singular Grouping Key Collision Produces Empty Group Headings
- **Severity:** Medium (UI Grouping Defect)
- **Exact Location:**
  - `code/Alpha0.x/ui/js/views/library-view.js:29-31`
  - `code/Alpha0.x/src/core/library.js:47-53, 125-135`
- **Behavior & Evidence:**
  In `library-view.js`:
  ```javascript
  // library-view.js:29-31
  { value: 'authors', label: 'Author' },
  { value: 'narrators', label: 'Narrator' },
  { value: 'genres', label: 'Genre' },
  ```
  When grouped, `groupLibrary(rows, field)` calls `sortValue(row, field)`.
  In `library.js`:
  ```javascript
  // library.js:47-53
  switch (field) {
    case 'author': return row.authors[0] ?? UNKNOWN;
    case 'narrator': return row.narrators[0] ?? UNKNOWN;
    case 'genre': return row.genres[0] ?? UNKNOWN;
    default: return row[field];
  }
  ```
  Because `library-view.js` passes `'authors'` (plural), `sortValue` skips the singular cases and hits `default: return row['authors']`, which returns the array.
  In `groupLibrary`:
  `value = String(sortValue(row, field) ?? 'unknown')`
  If a book has no authors, `String([])` evaluates to `""` (empty string), NOT `'unknown'`.
- **User Impact:**
  Selecting "Group by: Author" for titles with no author creates a group with an empty string heading: `<h3 class="lcars-group-heading"> (1)</h3>` and an empty table caption `<table class="lcars-table"><caption> titles</caption>`. Additionally, multi-author books group into comma-joined strings like `"Author A,Author B"`.
- **Proposed Fix:**
  1. Align `GROUP_FIELDS` in `library-view.js` to singular (`'author'`, `'narrator'`, `'genre'`).
  2. In `groupLibrary()`, explicitly handle empty lists and nulls to return `'unknown'`.
- **Acceptance Test:**
  Grouping titles with empty author or narrator lists produces an `"Unknown (N)"` heading, never an empty string heading.

---

#### BUG-07: Non-Owned Candidate Catalog Lookup Missing from Connector
- **Severity:** Medium (Feasibility Gate G3 Gap — Blocks Phase 3)
- **Exact Location:** `code/Alpha0.x/connector/atnr_connector/service.py:190-244`
- **Behavior & Evidence:**
  `ConnectorService` implements only `sync_library` (`GET /1.0/library`). There is no RPC method, adapter method, or UI mechanism to look up or import candidate metadata for a non-owned Audible title.
- **User Impact:**
  Gate G3 states:
  > *"All four domains have dated authority and actual proof; participant confirms >=1 demonstrated catalog title non-owned."*
  In the live private alpha, 100% of books in the catalog are owned titles. Without a mechanism to retrieve candidate metadata for non-owned books, candidate retrieval and recommendation ranking (Phase 3) cannot be implemented or validated on live data.
- **Proposed Fix:**
  Add a bounded candidate lookup method in `service.py` (e.g., `lookup_catalog_title(asin)`) or provide a manual ASIN entry field as specified in `08-source-feasibility-dossier.md`.
- **Acceptance Test:**
  The connector can resolve a non-owned ASIN into a normalized `book` object with `available: true` and no corresponding `libraryEntry`.

---

#### BUG-08: Hardcoded 2,000-Char Limit Discards Long Audiobook Synopses
- **Severity:** Medium (Data Loss / Truncation Policy)
- **Exact Location:**
  - `code/Alpha0.x/connector/atnr_connector/normalize.py:34-37, 185-189`
  - `code/Alpha0.x/src/core/validate.js:14`
- **Behavior & Evidence:**
  `LIMITS.commentLength` in `validate.js` is set to `2000` (designed for user comments). `normalize.py` reuses this limit for publisher summaries:
  ```python
  # normalize.py:34-37
  if len(cleaned) > maximum:
      if required:
          raise NormalizeError("text-too-long")
      return None  # Discards the entire text!
  ```
- **User Impact:**
  Audiobook publisher summaries frequently exceed 2,000 characters (e.g., epic fantasy novels with series recaps, chapter breakdowns, and reviews). For every such title, the synopsis is silently discarded to `None`. In the UI, the Book Detail view displays: `"No synopsis is available for this title."`
- **Proposed Fix:**
  Define a dedicated `synopsisLength` limit (e.g., 10,000 characters) in `validate.js` and `normalize.py`, or safely truncate with an explicit ellipsis and provenance note rather than discarding the entire summary.
- **Acceptance Test:**
  An audiobook with a 3,500-character publisher summary retains its synopsis text in the normalized catalog.

---

#### BUG-09: Non-Clickable Facets and Ephemeral Filter State Loss
- **Severity:** Medium (UX Discovery Gap)
- **Exact Location:**
  - `code/Alpha0.x/ui/js/views/library-view.js:94-118`
  - `code/Alpha0.x/ui/js/views/book-detail-view.js:46-50`
- **Behavior & Evidence:**
  1. In `library-view.js` and `book-detail-view.js`, authors, narrators, genres, and series are rendered as inert text (`formatList(...)`). The user cannot click a narrator to see other books by that narrator.
  2. When a user applies search/sort/filter options in `library-view.js`, clicks a book link, and then clicks "Back to library evidence", the router destroys the old view and calls `renderLibraryView` fresh. All filter and search states are lost.
- **User Impact:**
  `APP_DESCRIPTION.md` Section 2 states:
  > *"Author, narrator, series, and genre names should be selectable facets. Selecting one opens its detail view, shows matching books, and exposes the user's rating and feedback for that facet."*
  Having unclickable facets forces tedious manual typing into the search bar, and losing search state on back-navigation creates navigation friction.
- **Proposed Fix:**
  1. Wrap author, narrator, series, and genre names in hash links (e.g., `#/library?narratorId=...`).
  2. Persist active filter state in `AppStore` or in the URL hash query so back-navigation restores filters.
- **Acceptance Test:**
  Clicking a narrator in Book Detail navigates to the Library view filtered to that narrator, and returning from a book preserves previously entered search queries.

---

#### BUG-10: Mathematical Rounding Hides Uncertainty in Feasibility Card
- **Severity:** Low (Statistical Honesty & Status Feedback)
- **Exact Location:**
  - `code/Alpha0.x/ui/js/store.js:154`
  - `code/Alpha0.x/ui/js/views/feasibility-view.js:31`
  - `code/Alpha0.x/ui/js/views/data-view.js:180`
- **Behavior & Evidence:**
  In `store.js`:
  `percentKnown: total > 0 ? Math.round((knownCount / total) * 100) : 0`
  In `feasibility-view.js`:
  `const uncertain = rows.filter((r) => r.percentKnown < 100);`
  If a catalog has 1 unknown field out of 1,000 titles (99.9% known), `Math.round` produces `100`. Then `percentKnown < 100` evaluates to `false`.
  The UI displays: `"Every measured field is fully known across the current synthetic catalog."` despite the presence of an unknown field.
  Additionally, clicking `Sync now` in `data-view.js` executes `window.location.reload()`, which reloads without displaying a persistent success confirmation banner.
- **User Impact:**
  Contradicts our core principle of strict semantic honesty regarding missing data.
- **Proposed Fix:**
  Filter uncertain fields by `unknownCount > 0` rather than `percentKnown < 100`. Store a transient `syncSuccess` flag in `sessionStorage` to render an affirmative confirmation banner upon reload.
- **Acceptance Test:**
  A catalog with 1 unknown entry out of 1,000 displays the uncertainty note and lists the specific unknown count.

---

## 4. Release Verdict for Alpha 0.0.1

### Verdict: **CONDITIONAL PASS for Private Technical Feasibility Alpha 0.0.1**

- **Private Alpha Status:** **PASS (CONDITIONAL ON PRE-DISTRIBUTION FIXES)**
  The implementation at commit `6145f98` achieves its primary mission: proving the technical feasibility of password-free, persistent, DPAPI-encrypted Audible synchronization within a strictly bounded loopback environment.
  However, before expanding access to the up to ten named testers authorized by Captain change control, **three critical blockers must be patched:**
  1. **BUG-01 (Dual-Role Contributor Collision):** Fix person ID hashing so authors who also narrate do not fracture into duplicate catalog entities.
  2. **BUG-02 (Feasibility & Trace Copy Mismatch):** Correct the Feasibility and Trace copy so real user library titles are not presented under an "entirely synthetic / invented titles" disclaimer.
  3. **BUG-03 (Missing JSON Export):** Restore the user-facing JSON snapshot export button in the private alpha Data view.
- **Commercial / Public Shipping Status:** **HARD NO-GO**
  In strict accordance with Captain Change Control (`10-private-alpha-connector-change-control.md`) and package policy, commercial use, public hosting, binary distribution, installer generation, and store publication remain mechanically blocked pending named legal/licensing review and renewed crew sign-off.

---

## 5. Next-Release Innovation Opportunities (Alpha 0.0.2 / Phase 1 & 2)

As we transition from proving technical access feasibility to building the actual tracking and review companion, here are four high-impact opportunities:

1. **Interactive LCARS Facet Matrix (Phase 1):**
   Turn authors, narrators, and series into primary interactive entities. Clicking Wil Wheaton or Michael Kramer opens a dedicated Narrator dossier showing total listening hours, completed titles, and series connections.
2. **Visual Bipartite Explainability Graph (Phase 3 / 4):**
   Upgrade the flat structural trace into an authentic visual LCARS circuit diagram. Render horizontal structural bars connecting candidate books to matching history nodes via swept LCARS elbow connectors, giving users a visceral, intuitive answer to *"Why was this recommended?"*
3. **Privacy-Preserving On-Device AI Spikes (Phase 4):**
   Investigate lightweight in-browser or local-first models (e.g., WebLLM with quantized Gemma/Llama running locally via WebGPU) to synthesize natural-language explanations from deterministic graph traces without sending a single byte of listening data to cloud APIs.
4. **Narrator & Series Continuity Guardrail Engine:**
   Implement deterministic series sequencing rules ("Never suggest Book 4 if Book 1 is unfinished") and narrator continuity alerts ("This title switches narrators mid-series; listeners often find this jarring"), solving a classic audiobook listener pain point.

---

*Report authored and submitted by:*
**Wesley Crusher**
Creative Technologist & Innovation Advisor, USS Enterprise / Audible Track and Recommend Team
