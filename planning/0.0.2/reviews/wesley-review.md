# Wesley Crusher — Product & Innovation Review: Alpha 0.0.2 Plan

- **Reviewer:** Wesley Crusher, Creative Technologist & Innovation Advisor
- **Date:** 2026-09-17
- **Authority Documents:**
  - `APP_DESCRIPTION.md`
  - `planning/0.0.2/01-release-charter.md`
  - `planning/0.0.2/02-scope.md`
  - `planning/0.0.2/03-backlog.md`
  - `planning/0.0.2/04-sequencing.md`
  - `planning/0.0.2/05-risks-and-release-gates.md`
  - `planning/0.0.2/06-owner-feedback.md`
  - `planning/0.0.2/07-native-iphone-direction.md`
  - `planning/0.0.2/08-implementation-plan.md`
  - `planning/archive/0.0.1/feedback-and-bugs/alpha-0.0.1-release-verdict.md`
  - `planning/archive/0.0.1/feedback-and-bugs/bug-register.md`
  - `planning/archive/0.0.1/feedback-and-bugs/wesley-product-gap-review.md`
- **Output Target:** `planning/0.0.2/reviews/wesley-review.md`

---

## 1. Executive Summary & Verdict

### Verdict: CONDITIONAL APPROVAL

The Alpha 0.0.2 product and implementation plan represents an exceptional leap forward in engineering rigor, architectural honesty, and user-centered design. It confronts the archived 0.0.1 **HOLD/FAIL** verdict head-on, methodically addressing all 30 inherited blocking findings without evasion. Crucially, it translates every single piece of Captain/owner feedback (**OF-001 through OF-007**) into traceable, accountable stories and work packages, establishing an authentic foundation for a personal listening tracker.

The plan successfully avoids the dangerous temptation to rush into a premature recommendation engine. By strictly gating recommendations behind proven catalog access, legal review, and durable local identity, it protects user trust while keeping the scope pinned to **4 themes, 8 epics, 30 features, 30 stories, and 112 relative points**.

My approval is **CONDITIONAL** upon addressing specific interaction, mobile ergonomics, and usability risks:
1. **Preventing Local Capability Bootstrap Lockout:** The loopback API authentication mechanism (CP-02 / S015 / A2-WP015) must not impose an unusable or inaccessible manual secret-entry barrier that paralyzes evaluation.
2. **Mobile Safari Viewport & Keyboard Stability:** Inline editing and collapsible grouping on iPhone Air (OF-004 / OF-006 / S033 / S034 / S038) must account for virtual keyboard occlusion and scroll jumps using modern CSS viewport units and scroll-docking.
3. **Single-Draft State Synchronization:** Inline editors within multi-group memberships (OF-004 / S033 / S037) must guarantee single-draft integrity to prevent divergent or clobbered notes.
4. **Coordinated Genre Excising:** The prove-or-remove genre rule (OF-002 / S037) must cleanly scrub search hints, placeholder text, and query filters if automatic genre mapping cannot be established.
5. **Truthful Separation of Live and Synthetic Evidence:** S035 / A2-WP035 must eliminate all blanket "synthetic" claims from live mode while maintaining rigorous canary isolation in structural traces.
6. **Preserving a Clean Native Architectural Runway:** OF-007 and document 07 must guide contract portability (S014 / S042) without introducing premature native build artifacts or unauthorized network bridges.

---

## 2. Product & UX Strengths

1. **Transforming an Inspector into a Personal Listening Journal:**
   The plan successfully elevates ATnR from a passive, read-only "Evidence Inspector" into a valuable personal tool. Introducing multi-dimensional ratings (overall, story/content, narration/performance in 0.5-star increments) and private, unconstrained notes (up to 4,000 code points) gives listeners real ownership of their listening journey.
2. **Exemplary Alignment with Owner Feedback (OF-001–OF-007):**
   Riker and the team have done an outstanding job systematically ingesting the Captain's observations:
   - **OF-001 (Truth in Evidence):** Fully operationalized in S035 / A2-WP035.
   - **OF-002 (Genre Decision Rule):** Strict "prove or remove" rule in S037 / A2-WP037.
   - **OF-003 (Useful Columns):** Eliminates technical clutter (Source, internal IDs) in favor of listener-centric metadata (S034 / S038).
   - **OF-004 (Collapsible Groups & Inline Editing):** Seamless in-context feedback creation and editing (S033 / S037 / S038).
   - **OF-005 (Navigation Hierarchy & Gray Filler):** Clear separation of primary user workflows from diagnostic utilities via decorative LCARS filler blocks (S034 / S035).
   - **OF-006 (Mobile-First iPhone Air Safari):** Prioritizes touch ergonomics (≥44×44 CSS px) and responsive layouts (S033 / S034 / S038).
   - **OF-007 (Native Destination & Future Handoff):** Establishes portable contracts and cleanly isolates future barcode scanning (NAT-F01) and Audible deep linking (NAT-F02) in the future backlog (07-native-iphone-direction.md).
3. **Zero-Dependency Architectural Discipline:**
   The implementation maintains zero npm dependencies, avoids heavy client-side frameworks, leverages standard ES modules, and preserves strict Content Security Policy (`default-src 'none'`, `script-src 'self'`, `style-src 'self'`). This keeps the attack surface minimal and ensures predictable performance.
4. **Integrity in Local Data Ownership & DPAPI Custody:**
   Private reviews and snapshots are stored locally and encrypted under Windows-user DPAPI. The plan explicitly forbids provider-credential egress, cloud sync, telemetry, and automated LLM prompt construction. Deletion, export, and migration are treated as first-class, verifiable lifecycle operations.
5. **Acyclic, Risk-Driven Sequencing:**
   The execution sequence (W0 through W7) enforces proper causality: identity and reconciliation must be solved before ratings are stored; storage and migration must be solved before UI controls are wired; synthetic evidence must be verified before live access is gated.

---

## 3. Severity-Ranked Findings with Exact Plan Citations

### 3.1. Critical Findings

#### WES-002-CRIT-01: Local Capability Bootstrap Usability & Accessibility Trap
- **Plan Reference:** `planning/0.0.2/08-implementation-plan.md:122, 280–295`; `planning/0.0.2/03-backlog.md:165–175`; CP-02, S015, A2-WP015.
- **Finding:**
  The plan mandates that every `/api/v1/*` route require an independently delivered 256-bit random capability generated per server start. To prevent local malware from reading the token, the proposed design states:
  > *"a launcher-owned transient local unlock display, protected by the approved OS-user boundary, supplies a capability the owner enters in a clearly labeled local ATnR unlock... No clipboard read, command-line argument, environment dump, console/log, file, URL/fragment, referrer or browser persistent storage carries it."* (`08-implementation-plan.md:283–286`)
  If the launcher displays a raw 256-bit token (64 hexadecimal characters) and forbids clipboard access, URL parameters, and file exchange, the user is forced to manually type a 64-character random string on every session start! This creates severe friction, will inevitably lead to high typing error rates, and completely fails accessibility for users relying on screen readers or switch controls. While the plan notes that if this channel cannot be proven, S015 stops for another reviewed design, failing to specify a human-usable exchange mechanism creates an immediate blocker for Wave 1.
- **Impact:** Wave 1 execution blockage, severe accessibility violation, and catastrophic user onboarding friction.

---

### 3.2. High Findings

#### WES-002-HIGH-01: Mobile Safari Viewport Occlusion & Scroll Instability in Inline Feedback
- **Plan Reference:** `planning/0.0.2/08-implementation-plan.md:565–585, 633–640`; `planning/0.0.2/06-owner-feedback.md:165–175`; S033, S034, S038, A2-WP033, A2-WP038.
- **Finding:**
  On iPhone Air Safari in portrait mode, the on-screen keyboard consumes roughly 40% to 50% of the visible viewport height (reducing the usable viewport from ~844px to ~400–450px). An inline book disclosure containing overall stars, story stars, narration stars, comment `<textarea>`, tags input, and Save/Cancel buttons easily exceeds 380px in height. When the user taps into the comment textarea, Safari's default scroll behavior will aggressively scroll the active field into view, frequently shoving the group header, book title, and Save/Cancel action buttons off-screen.
  While the plan mentions dynamic viewport units (`dvh`) and safe-area insets (`08-implementation-plan.md:636`), it lacks specific layout rules for docked/sticky actions or scroll-padding during mobile keyboard focus.
- **Impact:** Users will lose their browsing and group context, struggle to find the Save button, or accidentally dismiss drafts when trying to dismiss the keyboard.

#### WES-002-HIGH-02: Single-Draft DOM Race Conditions in Multi-Group Book Membership
- **Plan Reference:** `planning/0.0.2/08-implementation-plan.md:568–572`; `planning/0.0.2/06-owner-feedback.md:95–105`; S033, S037, A2-WP033, A2-WP037.
- **Finding:**
  The plan notes: *"One shared draft per book avoids divergent editors when a multi-contributor book appears in multiple groups."* (`08-implementation-plan.md:569–570`).
  However, it does not specify the DOM and interaction behavior when a book appears simultaneously in two visible expanded groups (for example, an anthology co-authored by Author A and Author B when grouped by Author). If both group instances expose an inline disclosure, having two active editor forms bound to the same book in the DOM can create input focus racing, duplicate event listeners, and out-of-sync draft rendering.
- **Impact:** Divergent drafts, focus confusion, and potential loss of user commentary during multi-group browsing.

#### WES-002-HIGH-03: Primary Navigation Rail Reflow & Visual Landmark Separation
- **Plan Reference:** `planning/0.0.2/08-implementation-plan.md:207, 542–550`; `planning/0.0.2/06-owner-feedback.md:122–150`; S034, A2-WP034.
- **Finding:**
  OF-005 mandates placing primary user navigation at the top of the rail, diagnostic destinations at the bottom, and a neutral gray LCARS filler block in between.
  The plan states that at narrow widths (320–390 CSS px) or 200% zoom, the filler collapses. However, if the desktop vertical sidebar transforms into a top horizontal or drawer navigation on mobile, the concept of "top vs. bottom" must be translated into an accessible visual and semantic hierarchy. If the filler block is merely hidden via `display: none`, the plan must ensure that the diagnostic items do not unexpectedly merge with primary items into a single undifferentiated list.
- **Impact:** Mobile users may encounter confusingly grouped navigation links, obscuring lifecycle controls (sync, disconnect) or cluttering primary library access.

---

### 3.3. Medium Findings

#### WES-002-MED-01: Search Filter & Placeholder Contradiction upon Genre Removal
- **Plan Reference:** `planning/0.0.2/08-implementation-plan.md:595–601, 615–620`; `planning/0.0.2/06-owner-feedback.md:32–55`; `planning/0.0.2/03-backlog.md:518–525`; S037, A2-WP037; `code/Alpha0.x/ui/js/views/library-view.js:61`; `code/Alpha0.x/src/core/library.js:106`.
- **Finding:**
  In the current implementation, `ui/js/views/library-view.js:61` sets the search placeholder to:
  `placeholder: 'e.g. dungeon, Ashgrove, fantasy'` (where "fantasy" is explicitly a genre keyword). Furthermore, `src/core/library.js:106` searches across `row.genres`.
  Under OF-002 and S037 AC5, if automatic genre mapping cannot be established, Genre must be removed from the UI. The plan requires removing Genre from "cards, detail views, search hints, filters, sorting and grouping" (`03-backlog.md:522–524`). However, `08-implementation-plan.md:618` does not specifically trace this requirement to scrubbing `library.js:106` query matching and updating the search input placeholder in `library-view.js:61`.
- **Impact:** If Genre is removed from cards and tables but remains searchable in code, or if the placeholder still suggests "fantasy", users will experience confusing search behavior.

#### WES-002-MED-02: Performance Baseline Timing vs. UI Refactoring Architecture
- **Plan Reference:** `planning/0.0.2/08-implementation-plan.md:128, 549, 725, 868–875`; S034, S039, CP-06.
- **Finding:**
  The plan establishes that repeatable synthetic rendering and interaction baselines must be measured before optimization, locking a p95 budget (CP-06).
  However, the existing 0.0.1 UI consists of a static 10-column table with no collapsible disclosures, no inline editors, and no mobile-first card reflow. Measuring performance on the legacy 0.0.1 table before implementing the new collapsible card layout will produce an invalid baseline that does not reflect the DOM complexity of the new architecture.
- **Impact:** Misleading performance comparisons, invalid regression gating, and wasted benchmarking effort on discarded UI code.

#### WES-002-MED-03: Disconnect vs. Delete Local Data Distinction in Mobile UX
- **Plan Reference:** `planning/0.0.2/08-implementation-plan.md:338–344, 755–768`; `planning/0.0.2/03-backlog.md:320–340`; S029, A2-WP029.
- **Finding:**
  The plan cleanly separates `POST /api/v1/disconnect` (Audible deregistration, retaining local reviews) from `POST /api/v1/delete-local` (wiping local encrypted reviews and snapshots).
  However, on a mobile screen where dialogs must be compact and easily understood, having two distinct destructive lifecycle actions in close proximity creates severe user error risk. A listener might tap "Delete local data" intending merely to un-link their account, or tap "Disconnect" expecting all personal data to vanish.
- **Impact:** Accidental deletion of private ratings and comments, or confusion regarding data retention after disconnection.

---

### 3.4. Low Findings

#### WES-002-LOW-01: Group Header vs. Intra-Group Sort Direction Clarity
- **Plan Reference:** `planning/0.0.2/08-implementation-plan.md:573–577`; `planning/0.0.2/06-owner-feedback.md:100–108`; S038, A2-WP038.
- **Finding:**
  When library items are grouped (e.g., by Author or Series), the toolbar provides "Sort by" and "Sort direction" controls. The plan notes that group headings use stable ordering (normalized label + canonical ID tie-break) while items within groups follow the selected sort direction.
  In the UI, if the user selects "Sort by: Date Acquired / Descending", it must be visibly obvious that the books *inside* each group are sorted by date, while the author groups themselves remain alphabetically arranged.
- **Impact:** Minor cognitive friction if the listener expects group headings themselves to reorder based on intra-book attributes.

#### WES-002-LOW-02: Save Feedback Latency Indication for Multi-Second DPAPI Operations
- **Plan Reference:** `planning/0.0.2/08-implementation-plan.md:435–445, 565–570`; S032, S033, A2-WP033.
- **Finding:**
  Saving private feedback triggers validation, JSON serialization, stdio RPC invocation to the Python helper, Windows DPAPI encryption, SQLite transactional write, and file commit. On a busy or low-spec Windows host, this pipeline may take 150ms to 400ms.
  The plan mandates explicit Save with distinct draft/saving/saved states (`08-implementation-plan.md:566`). To avoid perceived sluggishness or double-taps on mobile, the UI must immediately disable the Save button and display an authentic LCARS pulsing busy state.
- **Impact:** Potential user double-taps or perception of UI jank during local crypto operations.

---

## 4. Concrete Corrections & Design Recommendations

### 4.1. Correction for Capability Bootstrap (Resolving WES-002-CRIT-01)
To reconcile Worf’s strict loopback isolation with Geordi’s accessibility and Wesley’s usability standards:
- **Adopt a Human-Friendly Ephemeral Pairing Passphrase:** Instead of a raw 64-hex-character string, have the launcher display a 4-word Diceware passphrase (e.g., `corbomite-tarsus-polaris-nexus`) or a formatted 6-digit numeric PIN tied to a high-entropy internal salt.
- **Automated Local Token File Exchange (Alternative Option):** If approved under CP-02, the launcher writes an ephemeral, random authorization nonce to an OS-user ACL-restricted file in `%LOCALAPPDATA%\AudibleTrNRec\run\session.token` readable only by the current user SID. The browser cannot read files directly, so upon launch, the launcher opens `http://127.0.0.1:4310/?auth=prompt`, where the user simply pastes or inputs the short pairing phrase displayed in the launcher window.
- **Clear Error & Retry UX:** Provide an accessible, high-contrast modal input with distinct audible/ARIA feedback and zero clipboard auto-read.

### 4.2. Correction for Mobile Safari Keyboard Occlusion (Resolving WES-002-HIGH-01)
- **Implement a Docked Sticky Action Bar:** On viewports `< 768px`, when an inline editor is expanded, lock the `Save` and `Cancel` controls to a docked bar at the bottom of the visible viewport (`bottom: env(safe-area-inset-bottom, 0px); position: sticky;`).
- **Leverage Modern CSS Viewport Units & Scroll Margins:** Use `height: 100dvh` for full-height views and add `scroll-margin-bottom: 80px;` to all form inputs (`input`, `textarea`, `select`) so that Safari’s virtual keyboard never obscures the active field or its immediate label.
- **Preserve Scroll Position on Dismiss:** Listen for `focusout` on the form container; when the keyboard dismisses, smooth-scroll the book container back to its pre-edit anchor.

### 4.3. Correction for Multi-Group Single-Draft Integrity (Resolving WES-002-HIGH-02)
- **Exclusive Inline Disclosure Policy:** Enforce that only one inline book editor may be open across the entire library view at any given moment.
- **Focus Redirection:** If a user is viewing an anthology that appears under both "Author A" and "Author B", opening the editor in Author A's group automatically closes or disables the editor in Author B's group, synchronizing any draft edits via `AppStore.getDraft(bookId)`. If Author B's instance is tapped, focus smoothly shifts to the active editor.

### 4.4. Correction for Genre Removal Coordination (Resolving WES-002-MED-01)
- **Scrub Search Hints and Query Evaluator:** If S037 determines that Genre cannot be populated automatically from approved source metadata:
  1. Remove `row.genres` matching from `src/core/library.js:106`.
  2. Update `ui/js/views/library-view.js:61` placeholder text to:
     `placeholder: 'e.g. dungeon, Ashgrove, Bobiverse'` (strictly Title, Author, Narrator, Series).
  3. Verify via automated DOM tests that no genre references exist in search labels, table headers, or facet lists.

### 4.5. Correction for Performance Baseline Timing (Resolving WES-002-MED-02)
- **Two-Stage Benchmarking Protocol:**
  - *Stage 1 (Core Invariants):* Measure synthetic dataset query/filter/sort performance in `src/core/library.js` independently of the DOM.
  - *Stage 2 (Rendered UI Baseline):* Establish the formal p95 interactive rendering budget (S034) immediately after the modular card/group component structure is committed in Wave 4, comparing subsequent visual and accessibility refinements against that true modular architecture.

---

## 5. Acceptance Tests (Extensions for W4 / W5 / W6)

To guarantee that the corrections above are rigorously validated, the following test cases must be added to the S039 / A2-Txx test matrix:

### A2-T28 (Interactive / Mobile): iPhone Air Safari Virtual Keyboard Reflow
- **Target:** S033, S034, S038 (Wave 4)
- **Environment:** Real iPhone Air Safari or Playwright WebKit mobile viewport (`390×844`, DPR 3.0).
- **Procedure:**
  1. Load synthetic library grouped by Series in portrait orientation.
  2. Expand a series group and tap "Edit Rating & Note" on a book item.
  3. Focus the comment `<textarea>` to invoke the virtual keyboard (simulated viewport height reduction to `420px`).
  4. Verify that:
     - The book title remains visible or easily scrollable.
     - The active text cursor is not occluded by the virtual keyboard.
     - The `Save` and `Cancel` buttons remain accessible via a docked sticky bar or clear one-touch scroll.
     - No horizontal viewport overflow occurs (`window.innerWidth === document.documentElement.clientWidth`).
     - Tapping `Save` triggers the commit and dismisses the keyboard without jumping scroll to the top of the page.

### A2-T29 (State Integrity): Multi-Group Single-Draft Synchronization
- **Target:** S033, S037 (Wave 4)
- **Procedure:**
  1. Load a synthetic library containing a book co-authored by two distinct people (e.g., Book 1 authored by Person A and Person B).
  2. Group library by `Author`. Both Person A and Person B groups contain Book 1.
  3. Expand Person A's group and open the inline editor for Book 1.
  4. Enter a 3.5 overall rating and the comment draft: `"Brilliant collaboration."`. Do not save.
  5. Scroll to Person B's group and inspect Book 1.
  6. Verify that Person B's instance reflects the active draft state or clearly indicates `"Editing in Person A group"`.
  7. Opening the editor in Person B's group smoothly transfers focus to the existing draft without data loss or duplicate form submission.

### A2-T30 (Usability & Accessibility): Capability Bootstrap Pairing Journey
- **Target:** S015, A2-WP015 (Wave 1)
- **Procedure:**
  1. Launch the local server with the approved bootstrap mechanism.
  2. Launcher presents the human-friendly pairing token.
  3. Navigate to `http://127.0.0.1:4310/` in an unauthenticated browser session.
  4. Verify that the unlock screen:
     - Contains an explicit LCARS heading: `Local ATnR Authorization`.
     - Has an accessible `<input>` with label, `autocomplete="off"`, and `spellcheck="false"`.
     - Supports standard keyboard entry and screen reader announcements.
     - Rejects incorrect tokens with an accessible inline error message without locking out the user permanently.
     - Successfully transitions to the library view upon valid entry within < 200ms.

---

## 6. Story & Work-Package Traceability Matrix

The table below evaluates the complete Alpha 0.0.2 backlog from a product, usability, and innovation perspective:

| Story / Package | Capability | Owner Feedback / Inherited Finding | User Value & Innovation Assessment | Wesley Verdict |
|---|---|---|---|---|
| **S014 / WP014** | Boundary & Recovery Contracts | A003–005, A016–017; OF-007 | Essential foundation. Locks down portable schemas and native destination constraints without overbuilding. | **PASS** |
| **S015 / WP015** | Loopback API Auth | A001, A047 | Crucial security barrier. Must heed WES-002-CRIT-01 to avoid bootstrap UX paralysis. | **CONDITIONAL** |
| **S016 / WP016** | Trusted Executables & Custody | A002, A021 | Eliminates DLL/exe hijacking on Windows. Solid infrastructure. | **PASS** |
| **S017 / WP017** | Origin & Browser Cleanup | A019, A046 | Clean provider authentication sandbox; ensures owned browser processes are purged. | **PASS** |
| **S018 / WP018** | Dependency Provenance | A018 | Locks requirements hashes and enforces zero-npm runtime policy. | **PASS** |
| **S019 / WP019** | Runtime Preflight | A010 | Resolves Node/SQLite version mismatch before code executes. | **PASS** |
| **S020 / WP020** | Python Egress Guards | A020, A048 | Sanitizes RPC boundary and prevents secret leakage in diagnostics. | **PASS** |
| **S021 / WP021** | Progress Units | A003 | Fixes the embarrassing 1% -> 100% progress bug. Critical for listener tracking. | **PASS** |
| **S022 / WP022** | Complete Pagination | A004, A037 | Prevents missing library books from being falsely claimed as a complete sync. | **PASS** |
| **S023 / WP023** | Malformed Recovery | A005, A006 | Isolates bad records so one corrupt book doesn't abort the entire library sync. | **PASS** |
| **S024 / WP024** | Durable Reconciliation | A007, A008, A034 | Retains removed books with local ratings/notes. Absolute must-have for durability. | **PASS** |
| **S025 / WP025** | Account Isolation | A009 | Prevents cross-account data contamination and accidental library overwrite. | **PASS** |
| **S026 / WP026** | Canonical Identity | A011, A012; OF-007 | Unifies author/narrator personas and establishes durable book IDs for native portability. | **PASS** |
| **S027 / WP027** | Truthful Sync Status | A029, A030, A039, A051 | Distinguishes attempts from durable commits; fixes false success indicators. | **PASS** |
| **S028 / WP028** | Safe Complete Export | A016; OF-007 | Pure user empowerment: lets listeners take their data anywhere in clean JSON. | **PASS** |
| **S029 / WP029** | Delete & Key Lifecycle | A017, A045; OF-007 | Genuine data deletion with truthful disclosure of OS residue limits. | **PASS** |
| **S030 / WP030** | Versioned Migration | A012; OF-007 | Safe, transactional database upgrades with rollback protections. | **PASS** |
| **S031 / WP031** | Feedback Domain Contract | OF-004; New Scope | Beautifully designed: 0.5 half-stars, optional dimensions, inert comments/tags. | **PASS** |
| **S032 / WP032** | Encrypted Feedback Store | OF-004, OF-007; New Scope | Locks private thoughts behind DPAPI; prevents source sync from touching annotations. | **PASS** |
| **S033 / WP033** | Accessible Feedback Editing | OF-004, OF-006; New Scope | Delivers inline rating and notes inside grouped results. High listener delight. | **CONDITIONAL** |
| **S034 / WP034** | LCARS Responsive Accessibility | A022–023, A041; OF-003, OF-005, OF-006 | Mobile-first reflow, authentic LCARS gray filler, and WCAG 2.2 AA compliance. | **PASS** |
| **S035 / WP035** | Evidence Honesty & Copy Audit | A015, A024, A028; OF-001, OF-005 | Scrubs misleading "synthetic" labels in live mode. Restores truthful user perception. | **PASS** |
| **S036 / WP036** | Safe Diagnostics | A033 | Category-only error reporting; prevents hostile trace injections. | **PASS** |
| **S037 / WP037** | User-Controlled Facets & Genre | A025–026, A043; OF-002, OF-004 | Collapsible groups and disciplined genre prove-or-remove decision. | **CONDITIONAL** |
| **S038 / WP038** | Preserved Filter Context & Columns | A042, A044; OF-003, OF-004, OF-006 | Eliminates useless columns; preserves scroll, sort, and search across edits. | **PASS** |
| **S039 / WP039** | Automated Integrated Evidence | A049; OF-001–006 | Comprehensive synthetic regression evidence across all 30 work packages. | **PASS** |
| **S040 / WP040** | History Feasibility | A013; Feasibility | Gated research into real listening timestamps. Honest stop if unsupported. | **PASS** |
| **S041 / WP041** | Catalog Feasibility | A014; Feasibility | Gated research into non-owned candidate access. Protects against fake catalog promises. | **PASS** |
| **S042 / WP042** | Gate Evidence & Closure | A049; OF-007 | Maps all 30 blockers to executed tests; evaluates native iPhone destination. | **PASS** |
| **S043 / WP043** | Release Decision & Docs | A050; OF-007 | Final Captain decision packet; guarantees zero commercial/store distribution. | **PASS** |

---

## 7. Clearly Separated Future Ideas (What if we tried...)

*Note: In accordance with our operating principles, these are uncommitted creative explorations for future native and post-0.0.2 milestones. None of these concepts add points, dependencies, or scope to Alpha 0.0.2.*

### Idea 1: View Transitions API for Authentic LCARS Panel Switches
- **The Concept:** What if we tried using the native web **View Transitions API** (`document.startViewTransition()`) to animate LCARS panel navigations (e.g., jumping from Library to Data & Lifecycle, or expanding an inline book card)?
- **Visual Pattern:** An authentic Star Trek LCARS horizontal wipe or vertical segment reveal, where the LCARS structural bar stays fixed while the content area smoothly morphs.
- **Platform Support:** Chrome 111+, Safari 18+, Edge 111+, Firefox 144+ (Baseline Newly Available).
- **Cost / Dependencies:** Zero external dependencies. Uses ~25 lines of CSS (`::view-transition-old`, `::view-transition-new`) and a progressive enhancement check in JS:
  ```javascript
  function navigateWithTransition(updateDOM) {
    if (!document.startViewTransition || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      updateDOM();
      return;
    }
    document.startViewTransition(updateDOM);
  }
  ```
- **Fallback:** Instant DOM update on older browsers or when `prefers-reduced-motion` is enabled.
- **Handoff:** Geordi for LCARS visual language review.

### Idea 2: Zero-JS Popover Tooltips via CSS Anchor Positioning
- **The Concept:** What if we tried using the native HTML `popover` attribute and CSS Anchor Positioning to display contributor biographies, format details, and provenance badges on compact mobile cards?
- **Platform Support:** CSS Anchor Positioning is supported in Chromium 125+ and under active implementation in Safari/Firefox; HTML Popover API is Baseline Widely Available (supported across all major browsers since 2023).
- **Cost / Dependencies:** Zero JavaScript floating libraries (no Popper.js or Floating UI). Pure semantic HTML and CSS:
  ```html
  <button popovertarget="tag-info-1" class="lcars-badge-pill">Space Opera</button>
  <div id="tag-info-1" popover class="lcars-popover">User tag: 3 books marked</div>
  ```
- **Fallback:** Standard progressive disclosure or native accessible disclosure patterns.
- **Handoff:** Geordi for accessibility and focus order validation.

### Idea 3: On-Device Taste Graph via Apple CoreML & NaturalLanguage (Native iPhone Milestone)
- **The Concept:** For the future native Swift app (07-native-iphone-direction.md), what if we tried generating recommendation embeddings **100% locally on-device** using Apple's built-in `NaturalLanguage` framework (or an ultra-light quantized CoreML embedding model like `all-MiniLM-L6-v2`)?
- **Why It Matters:**
  1. **Absolute Privacy:** User listening history, ratings, and intimate personal comments never leave the iPhone. Zero cloud egress.
  2. **Zero Cloud Cost:** No hosted API fees, no token limits, and no third-party LLM privacy policies to negotiate.
  3. **Explainability by Design:** Cosine similarity across local vectors can directly point to specific user notes (e.g., *"Recommended because you rated books with 'great pacing and dry humor' 5 stars"*).
- **Platform Support:** iOS 17+ via CoreML and `NLContextualEmbedding`.
- **Handoff:** Data for embedding mathematics and vector storage; Worf for on-device threat modeling.

### Idea 4: Progressive Barcode Ingestion via Web `BarcodeDetector` API Prototype
- **The Concept:** While NAT-F01 camera/barcode ingestion is deferred to the native iOS app, what if we built a tiny, disposable experimental spike using the standard web `BarcodeDetector` API in an isolated prototype branch?
- **Why It Matters:** The `BarcodeDetector` API runs directly in WebKit/Safari on iOS 17+ with zero external scanning libraries. We could validate ISBN check-digit parsing, barcode focus ergonomics, and edition lookup schemas right in the mobile browser before writing a single line of Swift!
- **Discipline:** Purely a disposable research spike. No camera permissions or scanning code will be merged into the 0.0.2 alpha codebase.
- **Handoff:** Data for ISBN-to-work resolution; Worf for camera permission lifecycle.

---

## 8. Final Officer Conclusion

The Alpha 0.0.2 plan is solid, disciplined, and deeply respectful of user trust. It honors the lessons of 0.0.1, addresses all 30 blockers, and charts a clear, exciting path toward a truly personal, private audiobook journal.

With the conditions specified in Section 4 incorporated into the Wave 1 (CP-02) and Wave 4 (interaction/mobile) designs, I enthusiastically recommend moving forward to **A2-G0 Design Readiness**.

*Signed,*
**Wesley Crusher**
Creative Technologist & Innovation Advisor, USS Enterprise / ATnR Team
