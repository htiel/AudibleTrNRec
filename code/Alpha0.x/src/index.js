/**
 * Public surface of the alpha 0.0.1 core.
 *
 * Scope is the locked 0.0.1 charter: versioned evidence/schema validation,
 * synthetic snapshot merge, the read-only evidence inspector, provenance and
 * unknown handling, the trust/commercial contract, and a minimal
 * ExplainabilityTrace contract that is explicitly NOT a recommendation.
 *
 * Deliberately platform-neutral: no HTTP server, no UI framework, no storage
 * adapter, no AI provider, no ratings feature, no ranker.
 */

export {
  ALPHA_VERSION, SCHEMA_VERSION, CONTRACT_VERSION, POLICY_VERSION,
  RUNTIME_PROFILE, PRIVATE_ALPHA_RUNTIME_PROFILE, SYNTHETIC_NOW,
} from './version.js';

export {
  ValidationError, TrustViolationError, GroundingError, ContractViolationError,
  DIAGNOSTIC_CATEGORIES, classifyDiagnostic,
} from './core/errors.js';

export {
  UNKNOWN, isUnknown, safeId, safeText, safeEnum, safeNumber, safeRating,
  safeIsoDate, safeBoolean, safeTags, safeObject, LIMITS,
} from './core/validate.js';

export {
  PROHIBITED_COMMERCIAL_TOKENS, PROHIBITED_PROFILE_TOKENS, SCORING_VIEW_KEYS,
  ALLOWED_EVIDENCE_ROUTES, PROHIBITED_EVIDENCE_ROUTES, ROUTE_POLICY,
  isCommercialKey, isProfilingKey, findProhibitedKeys, stripCommercialFields,
  assertCommercialFree, assertNoIdentityProfiling, assertAllowedRoute, toScoringView,
} from './core/trust.js';

export {
  Catalog, mergeLibrarySnapshot, normalizeBook, normalizePerson, normalizeFacet,
  normalizeLibraryEntry, LISTENING_STATUSES, FACET_TYPES, SOURCE_OWNED_FIELDS,
  LOCAL_OWNED_FIELDS,
} from './core/model.js';

export {
  buildLibraryView, sortLibrary, filterLibrary, facetCounts, groupLibrary,
  SORT_FIELDS, FILTER_FIELDS, FACET_FIELDS,
} from './core/library.js';

export {
  CONTRACT_SCOPE, CANDIDATE_LABELS, CANDIDATE_KEYS, TRACE_EDGE_KEYS,
  PROVENANCE_KEYS, BASELINE_KEYS, FACTOR_KINDS, TARGET_KINDS, EDGE_TYPES,
  EVIDENCE_BASES, BASELINE_THRESHOLDS,
  validateCandidate, validateCandidateSet, canonicalJson, catalogTopicIds,
} from './core/contract.js';

export {
  AUDIBLE_PRIVATE_SOURCE, validateLiveSnapshot,
} from './sync/live-snapshot.js';
