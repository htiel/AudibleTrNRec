# AudibleTrNRec

## Application Idea and Product Plan

## Product Summary

AudibleTrNRec is a personal audiobook tracking and recommendation application.
It connects to a user's Audible account, keeps their listening history and
progress up to date, lets them rate and comment on books, and recommends what
they should listen to next.

Each recommendation includes a short, understandable explanation based on the
user's listening history, ratings, comments, preferences, and current progress.
The application may use a local large language model (LLM) or a hosted AI
service. The final deployment platform and AI provider are intentionally still
to be determined.

The working name can be understood as:

- **Tr**: Tracking
- **N**: and
- **Rec**: Recommendations

## Product Vision

Give audiobook listeners a private, useful record of what they have listened
to and a trustworthy answer to a recurring question:

> What audiobook should I listen to next, and why?

Audible already contains library and listening information, but the user should
be able to add their own structured ratings and personal notes, keep a durable
history, and receive recommendations that reflect what they actually enjoyed.

## Target User

The initial target user is an individual Audible listener who:

- Owns or follows a growing audiobook library.
- Wants listening progress and history in one view.
- Wants to record personal opinions about completed or active books.
- Finds generic bestseller and storefront recommendations insufficient.
- Wants personalized suggestions with a clear reason for each suggestion.
- Values control over their account data and AI-provider choice.

The first release should optimize for a single user. Multi-user households,
social features, and public reviews can be considered later.

## Core User Journey

1. The user signs in and authorizes access to their Audible data.
2. The application imports their library, listening history, and progress.
3. The application keeps that data synchronized.
4. The user rates books and writes private comments such as:
   - "I loved this book."
   - "Good story arc."
   - "Great narrator, but the pacing was slow."
5. The application uses the user's history, ratings, comments, and catalog
   metadata to generate ranked recommendations.
6. The user sees a short description of each suggested title and a concise
   explanation of why it matches their preferences.
7. The user can accept, dismiss, save, or provide feedback on a recommendation.
8. Recommendation feedback improves future results.

## Product Goals

- Keep Audible library and listening-progress data current.
- Provide a useful personal record for every audiobook.
- Capture both structured ratings and free-form opinions.
- Recommend relevant titles the user has not already completed.
- Explain recommendations using evidence from the user's own history.
- Allow the Audible integration, deployment platform, and LLM provider to
  evolve independently.
- Protect account credentials, listening history, and private comments.
- Make AI behavior visible, configurable, and replaceable.

## Non-Goals for the First Release

- Selling or streaming Audible content directly.
- Replacing the Audible player.
- Hosting audiobook files.
- Publishing ratings or comments publicly.
- Building a social network for audiobook listeners.
- Supporting every audiobook provider at launch.
- Training a custom foundation model.
- Allowing an LLM to perform account authentication or directly modify source
  history.
- Guaranteeing that every recommendation will be enjoyable.

## Functional Scope

### 1. Audible Account Connection

The application should provide a secure way for the user to connect their
Audible account and explicitly authorize available access.

The implementation must not assume that a supported public Audible API or
OAuth flow exists. Audible integration feasibility is a Phase 0 investigation.
Preferred approaches, in order, are:

1. An official, documented Audible or Amazon API and authorization flow.
2. A supported user data export that can be imported and refreshed.
3. A user-approved, legally compliant integration that does not collect or
   store the user's Audible password.

Screen scraping, browser automation, private API usage, or credential capture
must not be adopted without a specific technical, legal, security, and
maintenance review. The application should clearly tell the user what is being
accessed and how it will be stored.

### 2. Library and Listening History

For each available title, the application should track:

- Audible or catalog identifier.
- Title and subtitle.
- Author or authors.
- Narrator or narrators.
- Series name and sequence, when available.
- Genres, categories, and descriptive tags.
- Publisher description or synopsis.
- Cover image reference.
- Total duration.
- Date acquired or added, when available.
- Listening status.
- Current listening position and completion percentage.
- Last listened date.
- Completion date, when available.
- Last successful synchronization time.

Suggested listening states are:

- Not started
- In progress
- Completed
- Abandoned
- Want to listen
- Unknown

The source system remains authoritative for imported listening progress. Local
ratings, comments, tags, and recommendation feedback remain authoritative in
AudibleTrNRec.

### 3. Ratings and Personal Comments

The user should be able to add:

- An overall rating.
- Optional story/content rating.
- Optional narration/performance rating.
- A private free-form comment.
- Personal tags such as "comfort listen," "strong characters," or "too slow."
- A favorite marker.
- An abandoned marker and optional reason.
- A "listen again" preference.

The initial rating scale should be five stars with half-star values. This is
familiar, expressive enough for recommendations, and easy to change later if
user testing indicates a better option.

Ratings and comments must autosave or clearly indicate unsaved changes. The
user's data must not be overwritten by a history synchronization.

### 4. Recommendations

The application should recommend titles that are relevant and available to the
user through Audible, while avoiding:

- Titles already completed.
- Titles the user explicitly dismissed.
- Duplicate editions of books already completed, unless requested.
- Later series entries when earlier required entries have not been completed.
- Titles outside user-defined content or language preferences.

Recommendation inputs may include:

- Overall, story, and narration ratings.
- Positive and negative language in comments.
- Favorite authors, narrators, genres, themes, and series.
- Completed, abandoned, replayed, and dismissed titles.
- Listening recency and completion behavior.
- Preferred duration or complexity.
- Saved recommendation feedback.
- Catalog metadata for candidate titles.

Each result should include:

- Title, author, narrator, cover, and short synopsis.
- A recommendation score or confidence indicator.
- A brief "Why this was recommended" explanation.
- Specific supporting signals, such as a highly rated author, narrator, genre,
  theme, or similar book.
- Any uncertainty or missing data that materially affects the suggestion.
- Actions to save, dismiss, open in Audible, or provide feedback.

Example:

> **Recommended because:** You rated two character-driven space operas highly,
> praised this narrator in another title, and said you prefer long series with
> strong story arcs.

Explanations must be grounded in stored user and catalog data. The application
must not invent book details, user preferences, or relationships between
titles.

### 5. Recommendation Feedback

For each recommendation, the user should be able to choose:

- Interested
- Not interested
- Already listened
- Save for later
- Recommend something similar
- Recommend something different

An optional reason, such as "wrong genre," "too long," or "already know the
story," can improve future ranking.

### 6. Synchronization

The application should:

- Perform an initial full import.
- Refresh data when the user signs in or opens the application.
- Support a manual refresh.
- Support scheduled background refresh where the selected platform permits it.
- Record the last attempted and last successful synchronization times.
- Show sync progress and actionable failures.
- Retry transient failures with bounded backoff.
- Avoid duplicate books and duplicate history records.
- Preserve local ratings, comments, and recommendation feedback.
- Reconcile source deletions or missing titles without silently deleting local
  user data.

Synchronization must be idempotent: repeating the same import should produce
the same stored state without duplicating records.

## Recommendation Strategy

The recommendation system should use a hybrid design instead of asking an LLM
to make an unconstrained guess.

### Candidate Retrieval

First, retrieve possible titles from trustworthy catalog data. Filter by
availability, language, series order, prior listening, dismissals, and user
preferences.

### Deterministic Ranking

Score candidates using observable factors such as:

- Similarity to highly rated titles.
- Author, narrator, series, genre, and theme affinity.
- Negative signals from low ratings, abandonment, and dismissals.
- Recency and diversity controls.
- Explicit user preferences.

The scoring factors should be inspectable and testable even if an LLM is not
configured.

### LLM-Assisted Analysis

An LLM may:

- Summarize preferences from user comments.
- Extract themes and positive or negative signals from notes.
- Rerank a bounded candidate set.
- Produce concise, natural-language recommendation explanations.

The LLM should receive only the minimum data required for the task. It should
not be the source of truth for book metadata, user history, or catalog
availability.

### Provider Abstraction

The application should define a provider-neutral AI interface so that it can
support one or more of:

- A locally hosted model.
- Azure OpenAI or another Azure AI model endpoint.
- The OpenAI API.
- A Copilot-related model service if a suitable licensed API is available.
- A non-LLM deterministic mode.

Provider names, models, credentials, token limits, costs, and data-handling
terms must be configuration rather than business logic. Consumer chat products
should not be treated as APIs unless the provider offers a supported
application integration.

## Deployment Direction

The deployment target remains **TBD**. Likely options include:

### Native or Cross-Platform iPhone App

Potential benefits:

- Strong personal-device experience.
- Secure platform credential storage.
- Notifications and background refresh capabilities.
- Easy deep linking into Audible.

Questions:

- Whether Audible authorization works reliably in a mobile application.
- iOS background refresh limitations.
- Whether local models are practical on target devices.
- Whether a separate backend is still required for catalog and AI access.

### Azure-Hosted Web Application

Potential benefits:

- Accessible across devices.
- Centralized synchronization and recommendation jobs.
- Natural integration with Azure identity, storage, and Azure AI services.
- Faster deployment and update cycle.

Questions:

- Secure account authorization and token storage.
- Ongoing hosting and AI cost.
- Browser and mobile-web experience.
- Privacy implications of server-side listening data.

### Other Viable Shapes

- Progressive Web App with an API backend.
- Cross-platform mobile app with a hosted backend.
- Local-first desktop application.
- Shared core services with web and mobile clients.

The final choice should follow the Audible integration feasibility study,
privacy requirements, background-sync needs, expected usage, and operating
cost—not precede them.

## Proposed System Boundaries

Regardless of platform, the design should separate:

- **Client application:** sign-in, library, progress, ratings, comments,
  recommendations, settings, and sync status.
- **Audible integration adapter:** authorization, import, normalization,
  pagination, rate limits, and source-specific errors.
- **Catalog service:** title metadata and recommendation candidates.
- **Synchronization service:** initial import, incremental refresh,
  reconciliation, retry, and checkpoints.
- **Recommendation engine:** candidate filtering, deterministic scoring,
  diversity, and feedback.
- **AI provider adapter:** prompt construction, data minimization, model calls,
  structured output validation, and provider errors.
- **Persistence layer:** normalized books, listening state, reviews, comments,
  recommendation runs, feedback, and sync state.
- **Security layer:** secrets, encryption, consent, audit events, and deletion.

These boundaries should allow the application to change Audible access methods,
LLM providers, hosting platforms, or user interfaces without rewriting the
entire product.

## Proposed Data Model

### User

- Unique identifier
- Locale and preferred language
- Recommendation preferences
- AI data-sharing consent and provider selection
- Created and updated timestamps

### External Account

- User identifier
- Provider name and regional marketplace
- Provider account identifier
- Authorization state and scopes
- Secure token reference, never a plaintext password
- Last successful authorization time

### Book

- Internal identifier
- External catalog identifiers
- Title, subtitle, authors, and narrators
- Series and sequence
- Description
- Genres, categories, and themes
- Duration, language, release date, and cover reference
- Metadata source and last refresh time

### Library Entry

- User and book identifiers
- Acquisition or library state
- Listening state
- Position and completion percentage
- Last listened and completion timestamps
- Source update timestamp
- Last synchronized timestamp

### User Review

- User and book identifiers
- Overall rating
- Optional story and narration ratings
- Private comment
- Personal tags
- Favorite, abandoned, and listen-again indicators
- Created and updated timestamps

### Recommendation

- User and book identifiers
- Recommendation-run identifier
- Rank and score
- Structured supporting signals
- Generated explanation
- Model or algorithm version
- Creation and expiration timestamps

### Recommendation Feedback

- Recommendation identifier
- Feedback type
- Optional reason
- Created timestamp

### Synchronization Checkpoint

- User and provider identifiers
- Sync type and state
- Cursor or checkpoint
- Attempted and successful timestamps
- Imported, updated, and failed counts
- Actionable error details

## Privacy and Security Requirements

- Never collect or store an Audible password directly.
- Prefer delegated authorization with revocable, narrowly scoped tokens.
- Encrypt provider tokens and sensitive user data at rest and in transit.
- Store secrets using the selected platform's secure secret facility.
- Do not include tokens, private comments, or detailed history in logs.
- Require explicit consent before sending personal history or comments to a
  hosted AI provider.
- Show whether recommendation processing is local or remote.
- Allow the user to disconnect Audible without immediately losing locally
  created ratings and comments.
- Allow export and permanent deletion of stored user data.
- Define retention, backup, and deletion behavior before production use.
- Validate all model output before displaying or storing it.
- Treat book descriptions and imported metadata as untrusted input.
- Protect recommendation prompts from instructions embedded in catalog text or
  user comments.
- Follow Audible, Amazon, catalog-provider, AI-provider, and app-store terms.

## Accessibility and User Experience

- Support keyboard and assistive-technology navigation where applicable.
- Meet WCAG 2.2 AA for a web interface.
- Use readable rating controls with text alternatives.
- Never rely on color alone for progress, rating, sync, or recommendation
  status.
- Clearly distinguish imported data from personal data.
- Display last-sync status without interrupting normal use.
- Explain errors in user terms and provide a retry or recovery action.
- Keep recommendation explanations concise, specific, and optional to expand.

## Delivery Plan

### Phase 0: Feasibility and Product Decisions

- Confirm the official meaning and public name of AudibleTrNRec.
- Investigate supported Audible/Amazon authorization and data access.
- Identify available fields for library history and listening progress.
- Confirm catalog search and metadata options for books not in the library.
- Review applicable API terms, rate limits, privacy rules, and app-store rules.
- Decide whether a manual data import is an acceptable fallback.
- Compare iPhone, web, and hybrid deployment options.
- Define local versus hosted data and AI processing requirements.
- Select the first AI provider while preserving provider abstraction.
- Define the initial marketplace, language, and user scope.

**Exit criteria:** A legal, secure, and maintainable data-access path is proven
with a small prototype, and the initial platform and architecture are selected.

### Phase 1: Local Library and Review Prototype

- Create the application shell.
- Define normalized book, library, progress, review, and sync models.
- Load a consented sample or export of Audible history.
- Build the library, book details, progress, rating, and comments views.
- Add search, sorting, filtering, and local persistence.

**Exit criteria:** A user can browse imported history and safely create,
update, and retain ratings and comments.

### Phase 2: Audible Synchronization

- Implement the approved account authorization or import method.
- Build full and incremental synchronization.
- Add checkpoints, deduplication, reconciliation, retry, and sync status.
- Verify local reviews survive every sync path.
- Add disconnect, export, and deletion controls.

**Exit criteria:** Listening history and progress stay current without duplicate
records, lost local data, or direct password storage.

### Phase 3: Recommendation Engine

- Implement candidate retrieval and eligibility filtering.
- Add deterministic preference scoring.
- Add series-order, completed-title, duplicate-edition, and dismissal rules.
- Store recommendation runs and supporting signals.
- Add recommendation cards and feedback actions.

**Exit criteria:** The application produces useful, reproducible
recommendations without requiring an LLM.

### Phase 4: LLM Integration and Explanations

- Implement the provider-neutral AI adapter.
- Integrate the selected local or hosted model.
- Extract preferences from comments using structured outputs.
- Generate grounded explanations from approved evidence.
- Add consent, data-minimization, timeout, cost, and usage controls.
- Test hallucination resistance and prompt-injection boundaries.

**Exit criteria:** AI-enhanced recommendations remain grounded, explainable,
optional, and safe when the model is unavailable or misbehaves.

### Phase 5: Release Readiness

- Complete privacy, security, accessibility, and dependency reviews.
- Add migrations, monitoring, backup, and recovery procedures.
- Test synchronization conflicts, provider outages, rate limits, and expired
  authorization.
- Measure recommendation quality with user feedback.
- Document setup, limitations, data handling, and support procedures.
- Package and deploy to the selected platform.

**Exit criteria:** The end-to-end sync, review, recommend, explain, feedback,
export, and deletion workflows pass release checks.

## Testing Strategy

### Unit Tests

- Rating and progress validation.
- Listening-state transitions.
- Candidate eligibility and exclusion rules.
- Deterministic scoring.
- Series-order handling.
- Sync merge and conflict behavior.
- AI request construction and structured response validation.

### Integration Tests

- External account authorization and revocation.
- Full and incremental synchronization.
- Pagination, rate limiting, retries, and expired tokens.
- Persistence of ratings and comments across syncs.
- Catalog lookup and candidate retrieval.
- AI-provider success, timeout, malformed output, and refusal behavior.

### End-to-End Tests

- Connect account to populated library.
- Update a rating and comment.
- Refresh changed listening progress.
- Generate and explain recommendations.
- Dismiss a recommendation and verify it does not immediately return.
- Disconnect, reconnect, export, and permanently delete data.

### Recommendation Quality Tests

- Never recommend an already completed edition by default.
- Respect explicit negative feedback.
- Avoid invalid series order.
- Cite only real user or catalog signals in explanations.
- Produce useful results when comments are absent.
- Produce usable deterministic results when no LLM is configured.
- Avoid collapsing all recommendations into one favorite genre or author.

## Key Risks and Mitigations

| Risk | Mitigation |
| --- | --- |
| No supported Audible API provides the required data | Make integration feasibility the first milestone; support user data import if permitted and useful. |
| Audible access changes or is rate-limited | Isolate it behind an adapter, checkpoint syncs, honor rate limits, and surface failures. |
| Account or listening data is exposed | Use delegated authorization, encrypted secrets, least privilege, redacted logs, and explicit consent. |
| The LLM invents reasons or book facts | Retrieve authoritative metadata, pass bounded evidence, require structured output, and validate every claim. |
| Hosted AI creates privacy or cost concerns | Offer clear consent and controls, minimize payloads, cache safe results, and preserve local/deterministic options. |
| Recommendations become repetitive | Add diversity, recency, negative feedback, and exploration controls to deterministic ranking. |
| Sync overwrites personal ratings or comments | Keep imported and local fields separate, use idempotent merges, and test reconciliation. |
| Deployment choice creates rework | Keep integration, sync, recommendation, AI, and persistence logic behind platform-neutral boundaries. |
| Product name is confused with Audible branding | Treat it as a working name and complete legal and naming review before public release. |

## Open Decisions

1. What should the product's final public name be?
2. Is the first client an iPhone app, responsive website, or another platform?
3. Is a backend required for synchronization and recommendations?
4. What supported Audible authorization or export mechanism is available?
5. Which Audible marketplace or regions must be supported first?
6. How frequently should listening progress synchronize?
7. Should the application operate offline?
8. Where should history, ratings, and comments be stored?
9. Is cross-device synchronization required for the first release?
10. Which AI provider should be implemented first?
11. Must a fully local model be supported at launch or only by the architecture?
12. What user data may be sent to a hosted model?
13. Should recommendations include only Audible titles, owned titles, or the
    wider audiobook catalog?
14. Should recommendations optimize for the next purchase, the next title
    already owned, or both?
15. Which rating dimensions are most useful beyond an overall score?
16. Should ratings and comments remain private permanently?

## Minimum Viable Product

The MVP should allow one user to:

1. Securely connect an approved Audible data source or import their history.
2. View their audiobook library and listening progress.
3. Refresh that data without duplicates or loss of local information.
4. Rate books and save private comments.
5. Receive a ranked list of eligible next-title recommendations.
6. Read a short, evidence-based explanation for each recommendation.
7. Save, dismiss, or respond to recommendations.
8. Export and permanently delete their application data.

If live Audible synchronization is not feasible, a clearly labeled import-based
prototype can validate the review and recommendation experience, but it should
not be presented as meeting the final synchronization goal.

## Success Criteria

The first release is successful when:

- Listening history and progress synchronize accurately and reliably.
- User ratings and comments are never lost during synchronization.
- Recommendations exclude clearly ineligible titles.
- Every AI-generated explanation is supported by known data.
- Users can understand why a title was recommended.
- Feedback changes future recommendations in expected ways.
- The application remains useful when the selected LLM is unavailable.
- Users know where their data is stored and when it is sent to an AI service.
- Users can export, disconnect, and permanently delete their data.

## Immediate Next Step

Before selecting a UI framework, hosting service, database, or LLM, build a
small technical feasibility prototype for approved Audible account access,
library history, listening progress, and catalog metadata. That result should
drive the platform and architecture decision for the rest of the application.
