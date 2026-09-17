# Alpha 0.0.2 owner feedback

This log captures the Captain's direct observations for planning disposition.
An entry records intent; it does not mean the implementation is complete or a
release gate has passed. Canonical delivery status remains in
[the backlog](03-backlog.md).

The [review consensus](09-review-consensus.md) clarifies acceptance without
rewriting these owner observations. OF-002 requires root-cause tracing,
privacy-safe attestation or exhaustive removal including stale state/search.
OF-003 includes the actual date/duration sort inventory. OF-004 exposes comment
text only in the single active book editor. OF-005 preserves labeled primary/
lifecycle/diagnostic groups at mobile reflow. OF-006 includes enumerated 44px
controls, text spacing and keyboard-open reachability with an isolated synthetic
device setup; no approved setup means HOLD, not waived device evidence.
These are pending implementation criteria, not completed owner requests.

## OF-001 — Scrub obsolete synthetic-data wording

- **Date:** 2026-09-17
- **Owner observation:** The interface still contains substantial “this is
  synthetic data” language even though private mode now displays live Audible
  library data.
- **Intent:** Make every data-source statement accurate for the active mode.
  Do not describe the whole application, page or active private library as
  synthetic when it is using the encrypted live snapshot.
- **Required distinction:** Synthetic fixtures remain valid for tests, the
  default demonstration mode and any intentionally isolated structural trace.
  Their labels must be local to those components. Live/private screens must
  identify their source truthfully without exposing account identifiers or
  personal details.
- **Surfaces to inventory:** Document title, navigation, page headings, status
  banners, explanatory copy, feasibility cards, structural traces, lifecycle
  dialogs, loading/empty/error states and exported metadata.
- **Acceptance evidence:** A mode-by-mode copy inventory plus automated and
  rendered checks proving that:
  1. private live-data mode contains no blanket synthetic-data claim;
  2. every remaining use of “synthetic” is backed only by bundled fixtures and
     clearly scoped to that component;
  3. switching or failing modes never silently relabels live data as synthetic;
  4. labels reveal no account identifiers or private library content.
- **Backlog mapping:** [ATR-S035 — Truthful evidence and error states](03-backlog.md#atr-s035--truthful-evidence-and-error-states)
- **Status:** Captured for design and implementation; not started.

## OF-002 — Populate Genre automatically or remove it

- **Date:** 2026-09-17
- **Owner observation:** Genre is consistently displayed as Unknown in the
  current live-data UI. Useful values would include categories such as LitRPG
  or Business.
- **Intent:** Retain Genre only if approved Audible metadata can populate it
  automatically and usefully. A permanently unknown control adds no value.
- **Source rule:** Data must investigate the already requested categories and
  category-ladder fields and define a deterministic, source-backed mapping.
  Do not infer genre from title, synopsis, listening behavior or an LLM. Do not
  introduce manual genre classification in this release.
- **Decision rule:** If the approved source cannot provide reliable automatic
  genre values, remove Genre from the Alpha 0.0.2 UI, including cards, detail
  views, search hints, filters, sorting and grouping. The optional schema field
  may remain for future evidence, but it must not create an always-Unknown
  visible facet.
- **Acceptance evidence:** Source fixtures and a sanitized live-field
  attestation either prove deterministic genre/category population and
  meaningful values such as LitRPG or Business, or rendered tests prove that
  every Genre surface has been removed without leaving empty headings, stale
  controls or misleading search examples.
- **Backlog mapping:** [ATR-S037 — User-controlled facets](03-backlog.md#atr-s037--user-controlled-facets)
- **Status:** Captured; source investigation and retain/remove decision pending.

## OF-003 — Optimize library columns for user value

- **Date:** 2026-09-17
- **Owner observation:** The library uses space for non-user-facing columns,
  including Source, while more useful book and tracking information needs a
  clearer layout.
- **Intent:** Optimize the primary library view around information that helps
  the listener identify, choose and track a book. Do not make the main table an
  implementation or provenance inspector.
- **Default column priority:** Title, author, narrator, series, progress or
  completion state, and available private rating/feedback indicators. Exact
  order and responsive behavior require Geordi design review and rendered
  evidence.
- **Remove or relocate:** Source/provider labels, provenance, internal IDs,
  raw synchronization fields and other implementation metadata do not belong
  as repeated primary-library columns. When needed for transparency or
  troubleshooting, show concise operational information once in the
  Data/Connection view without exposing account identifiers.
- **Column audit:** Geordi and Wesley must review every existing and proposed
  column with the Captain. Each retained column needs a user task, supported
  data semantics and a responsive presentation; unsupported or redundant
  columns are removed rather than filled with repetitive Unknown values.
- **Acceptance evidence:** Approved desktop and narrow-screen column matrix,
  rendered 320 CSS px and 200% zoom checks, keyboard/screen-reader table or
  list semantics, and tests proving technical metadata is absent from book
  rows but necessary connection/source transparency remains available once in
  the appropriate lifecycle view.
- **Backlog mapping:** [ATR-S038 — Filter state and feedback-aware views](03-backlog.md#atr-s038--filter-state-and-feedback-aware-views) and [ATR-S034 — LCARS responsive accessibility](03-backlog.md#atr-s034--lcars-responsive-accessibility)
- **Status:** Captured for UI design; not started.

## OF-004 — Collapsible groups with inline book feedback

- **Date:** 2026-09-17
- **Owner observation:** Grouping and sorting need to become more useful. Grouped
  results should be collapsible, and the compact item should provide a place to
  add a rating and comment.
- **Intent:** Let the listener choose a supported grouping and sort order,
  expand or collapse group sections, and add or edit private feedback from the
  grouped library without losing browsing context.
- **Feedback authority:** Ratings and comments remain attached to the individual
  book. Author, narrator, series, status and any retained genre/category are
  navigation groups, not separately rated entities. Each compact book item may
  expose an inline disclosure/editor or a clearly associated edit action.
- **Grouping behavior:** Provide accessible expand/collapse controls on each
  group plus clear Expand all and Collapse all actions when multiple groups
  exist. Sorting within groups is deterministic and uses the selected direction;
  group order and item order are defined separately where needed.
- **State behavior:** Preserve grouping, sorting, expanded/collapsed sections,
  active filters, scroll/return focus and unsaved-edit safeguards across a
  feedback save, detail/back navigation and recoverable refresh failure.
  Reset remains explicit.
- **Accessibility:** Group and book disclosures use native controls or equivalent
  `aria-expanded`/`aria-controls` semantics, have visible focus, announce save
  results once and remain operable by keyboard and assistive technology.
- **Acceptance evidence:** Rendered desktop/narrow and keyboard/screen-reader
  journeys cover grouping, collapse/expand, inline create/edit/clear/delete,
  validation failure, save failure and successful save without context loss.
  Tests prove feedback persists against the correct book and never against the
  group heading.
- **Backlog mapping:** [ATR-S033 — Accessible feedback editing](03-backlog.md#atr-s033--accessible-feedback-editing), [ATR-S037 — User-controlled facets](03-backlog.md#atr-s037--user-controlled-facets), and [ATR-S038 — Filter state and feedback-aware views](03-backlog.md#atr-s038--filter-state-and-feedback-aware-views)
- **Status:** Captured for interaction design; not started.

## OF-005 — Separate primary navigation from diagnostics

- **Date:** 2026-09-17
- **Owner observation:** Final user-facing navigation should appear at the top
  of the navigation rail, while diagnostic destinations should move to the
  bottom with a gray filler block between the two groups.
- **Intent:** Make the information architecture read as a product first and an
  evidence/diagnostic tool second, while retaining private-alpha diagnostics
  for authorized troubleshooting.
- **Navigation groups:** Geordi and Wesley must classify every destination.
  Listener-facing library and feedback workflows belong in the top primary
  group. Diagnostic, feasibility and developer evidence destinations belong
  in the bottom utility group. Connection, synchronization, export, disconnect
  and deletion controls remain discoverable according to their user lifecycle
  importance rather than being mislabeled as developer-only diagnostics.
- **Filler block:** A neutral gray LCARS segment visually fills the flexible
  space between groups. It is decorative, contains no hidden action or status,
  is excluded from the accessibility tree and tab order, and does not obscure
  content at narrow widths or 200% zoom.
- **Responsive behavior:** On layouts where a vertical rail is not viable, the
  same primary-before-utility hierarchy remains clear without relying on empty
  fixed-height space.
- **Acceptance evidence:** Approved navigation inventory plus rendered desktop,
  320 CSS px and 200% zoom checks prove primary items remain first, diagnostic
  items remain last, the gray segment fills only available space, active/focus
  states remain visible, landmarks/names are clear, and keyboard order matches
  the visual and semantic order.
- **Backlog mapping:** [ATR-S034 — LCARS responsive accessibility](03-backlog.md#atr-s034--lcars-responsive-accessibility) and [ATR-S035 — Truthful evidence and error states](03-backlog.md#atr-s035--truthful-evidence-and-error-states)
- **Status:** Captured for navigation design; not started.

## OF-006 — Optimize mobile-first for iPhone Air

- **Date:** 2026-09-17
- **Owner observation:** Alpha 0.0.2 should focus on the iPhone Air screen size
  and optimize the experience for mobile use.
- **Intent:** Treat iPhone Air Safari in portrait as the primary interaction and
  layout target, not a compressed desktop afterthought. Landscape and desktop
  remain supported. The existing 320 CSS px requirement remains a smaller
  viewport accessibility stress case, not the primary design canvas.
- **Viewport authority:** Geordi must record the current iPhone Air Safari CSS
  viewport, device-pixel ratio, browser chrome behavior and safe-area insets
  from an authoritative specification or measured device evidence before
  freezing breakpoints. Do not design from physical display pixels alone.
- **Mobile behavior:** Use mobile-first information hierarchy, single-axis
  reading, safe-area-aware LCARS framing, dynamic viewport units where
  appropriate, no required hover, and touch targets of at least 44 by 44 CSS
  px for primary controls. The grouped library, inline feedback editor,
  dialogs, keyboard, and primary/diagnostic navigation must remain usable with
  the on-screen keyboard open.
- **Data density:** Prefer compact progressive disclosure over wide tables.
  Essential title, state, primary action and feedback controls remain visible;
  lower-priority metadata reflows or moves into disclosure without horizontal
  page scrolling.
- **Acceptance evidence:** Real iPhone Air Safari or an approved equivalent
  device/simulator records portrait and landscape journeys for navigation,
  search/filter/group, expand/collapse, rating/comment editing, validation,
  save failure, lifecycle dialogs and return focus. Automated viewport tests
  supplement but do not replace rendered touch and assistive-technology checks.
- **Backlog mapping:** [ATR-S034 — LCARS responsive accessibility](03-backlog.md#atr-s034--lcars-responsive-accessibility), [ATR-S033 — Accessible feedback editing](03-backlog.md#atr-s033--accessible-feedback-editing), and [ATR-S038 — Filter state and feedback-aware views](03-backlog.md#atr-s038--filter-state-and-feedback-aware-views)
- **Status:** Captured as the primary mobile design target; exact measured CSS
  viewport evidence pending.

## OF-007 — Native iPhone destination and future capture/handoff

- **Date:** 2026-09-17
- **Owner direction:** The intended product should ultimately be a native
  iPhone app. Add future capabilities to scan non-Audible titles/physical media
  with the iPhone camera and to open the Audible iPhone app at a recommended
  book's product/purchase page.
- **Disposition:** Swift/native iPhone is the intended client destination,
  not an approved architecture. The current web/Python alpha remains disposable
  feasibility evidence until a reviewed native architecture exists. OF-006
  remains the web-alpha mobile design target; it does not authorize native
  migration or exposing the local service to a phone.
- **Alpha 0.0.2 placement:** Record direction and portability in existing
  [S014](03-backlog.md#atr-s014--boundary-and-recovery-contracts);
  evaluate it through existing
  [S042](03-backlog.md#atr-s042--gate-evidence-and-officer-closure)/A2-G4
  architecture evidence after source proof. No added native spike or story.
- **Future placement:** [NAT-F01 camera/barcode ingestion and NAT-F02 Audible
  handoff](07-native-iphone-direction.md#future-backlog) are uncommitted future
  capability candidates, not additions to 0.0.2. Recommendation generation,
  ranking and recommendation feedback remain excluded; handoff requires an
  approved recommendation/catalog phase and verified link/identifier support.
- **Acceptance evidence:** The linked direction document records native
  custody, persistence, background limits, accessible design, portability,
  connector/legal constraints, future acceptance criteria and shipping gates.
  Future approval requires executed evidence; this entry proves intent only.
- **Inventory impact:** None: **4 themes / 8 epics / 30 features / 30 stories /
  112 estimated points**; no changes to A2 dependencies, waves or capacity.
- **Authority boundary:** No direct password/passkey handling, no claim that
  the current Python connector can ship inside iOS, no new egress or permission.
  Commercial/public shipping stays **NO-GO**; named-tester and legal/security
  gates remain intact.
- **Status:** Captured for planning; native architecture, future capability
  designs and all deployment approvals remain pending.
