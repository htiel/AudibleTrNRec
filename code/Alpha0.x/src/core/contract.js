/**
 * Closed evidence contract and minimal ExplainabilityTrace (ATR-S010 / ATR-F10).
 *
 * THIS IS NOT A RECOMMENDER. It contains no scoring, no ranking, no candidate
 * selection, no set assembly, and no generated prose. It only answers one
 * question about an already-written synthetic fixture record:
 *
 *   "Is this candidate structure admissible under the current alpha trust
 *    contract, and does every claim it makes resolve to a known node?"
 *
 * Contract rules implemented here:
 *  - versioned allowlist-only fields at every nesting level; unknown fields such
 *    as `nebula_weight` are rejected (AC1)
 *  - commercial/affiliate/sponsorship/promotion/margin and source ordinal or
 *    retrieval rank excluded; the evidence route itself must be approved (AC1)
 *  - every trace pointer resolves to a known catalog/history/preference node;
 *    missing, dangling, and floating claims are rejected (AC2)
 *  - exact label rules, including "category difference alone is not proof of
 *    viewpoint" and no mislabeling as DIRECT_MATCH (AC3)
 *  - canonical form for paired fixtures so contract invariance is testable (AC4)
 *  - political/sensitive identity and ideology proxies rejected (AC5)
 */

import { safeObject, safeId, safeEnum, safeNumber, safeText, compareText, deepFreeze, LIMITS } from './validate.js';
import { ContractViolationError, DIAGNOSTIC_CATEGORIES } from './errors.js';
import { assertCommercialFree, assertNoIdentityProfiling, assertAllowedRoute, isProfilingKey, findProhibitedKeys } from './trust.js';
import { CONTRACT_VERSION, POLICY_VERSION } from '../version.js';

/** Declares, in code, what this module is not. */
export const CONTRACT_SCOPE = deepFreeze({
  id: 'closed-evidence-contract',
  isRecommendation: false,
  producesOrdering: false,
  scoresCandidates: false,
  selectsCandidates: false,
  generatesExplanationText: false,
  usesAiProvider: false,
  validatesStructureOnly: true,
});

export const CANDIDATE_LABELS = Object.freeze(['DIRECT_MATCH', 'EXPLORATORY', 'PERSPECTIVE_BROADENING']);

export const CANDIDATE_KEYS = Object.freeze([
  'candidateId', 'catalogId', 'label', 'route', 'contractVersion', 'ruleVersion',
  'trace', 'uncertainty', 'baseline',
]);

export const TRACE_EDGE_KEYS = Object.freeze([
  'factorId', 'factorKind', 'edgeType', 'targetId', 'targetKind',
  'basis', 'provenance', 'confidence', 'ruleVersion',
]);

export const PROVENANCE_KEYS = Object.freeze(['source', 'observedAt', 'correctable', 'uncertainty']);

export const BASELINE_KEYS = Object.freeze([
  'relevance', 'quality', 'credibility', 'languagePass', 'contentSafetyPass', 'accessibilityPass',
]);

export const FACTOR_KINDS = Object.freeze(['author', 'narrator', 'series', 'genre', 'theme', 'topic']);
export const TARGET_KINDS = Object.freeze(['history-node', 'explicit-preference', 'catalog-node']);

export const EDGE_TYPES = Object.freeze([
  'shares-author', 'shares-narrator', 'shares-series', 'shares-genre', 'shares-theme',
  'matches-explicit-preference', 'diverges-in-viewpoint',
]);

export const EVIDENCE_BASES = Object.freeze(['facet-identity', 'explicit-preference', 'sourced-viewpoint-label', 'category-difference']);

export const BASELINE_THRESHOLDS = deepFreeze({ minRelevance: 0.25, minQuality: 0.6, minCredibility: 0.6 });

const DIRECT_MATCH_MIN_CONFIDENCE = 0.5;

function reject(code, message, details = {}) {
  throw new ContractViolationError(message, { code, ...details });
}

/** Topics are book-level catalog metadata rather than facet records. */
export function catalogTopicIds(catalog) {
  const topics = new Set();
  for (const book of catalog.books.values()) {
    if (typeof book.topicId === 'string') topics.add(book.topicId);
  }
  return topics;
}

function assertClosedKeys(value, allowed, path) {
  const keys = Object.keys(value);
  for (const key of keys) {
    if (!allowed.includes(key)) {
      reject('unknown-field', `${path}.${key}: unknown field rejected by the closed contract`, { path: `${path}.${key}` });
    }
    if (isProfilingKey(key)) {
      reject('identity-proxy', `${path}.${key}: sensitive-trait or ideology proxy rejected`, { path: `${path}.${key}` });
    }
  }
  return keys;
}

function validateProvenance(raw, path) {
  const provenance = safeObject(raw, path, { required: true });
  assertClosedKeys(provenance, PROVENANCE_KEYS, path);
  return {
    source: safeText(provenance.source, `${path}.source`, { required: true }),
    observedAt: safeText(provenance.observedAt, `${path}.observedAt`, { required: true, max: 40 }),
    correctable: provenance.correctable === true,
    uncertainty: safeText(provenance.uncertainty, `${path}.uncertainty`, { max: LIMITS.commentLength }),
  };
}

function validateEdge(raw, index, { catalog, knownNodes }) {
  const path = `candidate.trace[${index}]`;
  const edge = safeObject(raw, path, { required: true });
  assertClosedKeys(edge, TRACE_EDGE_KEYS, path);

  const factorKind = safeEnum(edge.factorKind, FACTOR_KINDS, `${path}.factorKind`, { required: true });
  const factorId = safeId(edge.factorId, `${path}.factorId`);
  const edgeType = safeEnum(edge.edgeType, EDGE_TYPES, `${path}.edgeType`, { required: true });
  const targetKind = safeEnum(edge.targetKind, TARGET_KINDS, `${path}.targetKind`, { required: true });
  const targetId = safeId(edge.targetId, `${path}.targetId`);
  const basis = safeEnum(edge.basis, EVIDENCE_BASES, `${path}.basis`, { required: true });
  const confidence = safeNumber(edge.confidence, `${path}.confidence`, { min: 0, max: 1, required: true });
  const ruleVersion = safeText(edge.ruleVersion, `${path}.ruleVersion`, { required: true, max: 64 });

  if (isProfilingKey(factorId) || isProfilingKey(targetId)) {
    reject('identity-proxy', `${path}: ideology or sensitive-identity proxy pointer rejected`, { factorId, targetId });
  }

  // Matching factor must resolve to a real catalog node (AC2).
  const factorExists = factorKind === 'topic'
    ? catalogTopicIds(catalog).has(factorId)
    : (factorKind === 'author' || factorKind === 'narrator')
      ? catalog.person(factorId) !== null
      : catalog.facet(factorId) !== null;
  if (!factorExists) reject('dangling-pointer', `${path}.factorId: ${factorId} does not resolve to a known catalog node`, { factorId });

  const pool = knownNodes[targetKind];
  if (!pool || !pool.has(targetId)) {
    reject('dangling-pointer', `${path}.targetId: ${targetId} does not resolve to a known ${targetKind}`, { targetId, targetKind });
  }

  return {
    factorId, factorKind, edgeType, targetId, targetKind, basis, confidence, ruleVersion,
    provenance: validateProvenance(edge.provenance, `${path}.provenance`),
  };
}

function validateBaseline(raw, path) {
  const baseline = safeObject(raw, path, { required: true });
  assertClosedKeys(baseline, BASELINE_KEYS, path);
  return {
    relevance: safeNumber(baseline.relevance, `${path}.relevance`, { min: 0, max: 1, required: true }),
    quality: safeNumber(baseline.quality, `${path}.quality`, { min: 0, max: 1, required: true }),
    credibility: safeNumber(baseline.credibility, `${path}.credibility`, { min: 0, max: 1, required: true }),
    languagePass: baseline.languagePass === true,
    contentSafetyPass: baseline.contentSafetyPass === true,
    accessibilityPass: baseline.accessibilityPass === true,
  };
}

function assertLabelRules(label, edges, baseline, uncertainty) {
  const explicitEdges = edges.filter((e) => e.edgeType === 'matches-explicit-preference'
    && e.targetKind === 'explicit-preference' && e.basis === 'explicit-preference');
  const adjacentEdges = edges.filter((e) => e.edgeType.startsWith('shares-') && e.basis === 'facet-identity');
  const divergentEdges = edges.filter((e) => e.edgeType === 'diverges-in-viewpoint');

  if (label === 'DIRECT_MATCH') {
    const strong = explicitEdges.filter((e) => e.confidence >= DIRECT_MATCH_MIN_CONFIDENCE);
    if (strong.length === 0) {
      reject('mislabeled-direct-match', 'DIRECT_MATCH requires explicit high-affinity preference evidence');
    }
    if (divergentEdges.length > 0) {
      reject('mislabeled-direct-match', 'a divergent-viewpoint candidate cannot be labeled DIRECT_MATCH');
    }
    return;
  }

  if (label === 'EXPLORATORY') {
    if (adjacentEdges.length === 0) {
      reject('unsupported-exploratory', 'EXPLORATORY requires supported adjacent-facet evidence');
    }
    if (divergentEdges.length > 0) {
      reject('unsupported-exploratory', 'a divergent-viewpoint claim must use PERSPECTIVE_BROADENING');
    }
    return;
  }

  // PERSPECTIVE_BROADENING
  if (divergentEdges.length === 0) {
    reject('unsupported-perspective-label', 'PERSPECTIVE_BROADENING requires a sourced divergent-viewpoint edge');
  }
  for (const edge of divergentEdges) {
    if (edge.basis === 'category-difference') {
      reject('category-difference-is-not-viewpoint', 'category or genre difference alone is not proof of viewpoint');
    }
    if (edge.basis !== 'sourced-viewpoint-label') {
      reject('unsupported-perspective-label', 'divergent-viewpoint evidence must cite a sourced viewpoint label');
    }
    if (!edge.provenance.correctable) {
      reject('unsupported-perspective-label', 'viewpoint labels must be recorded as correctable metadata');
    }
    if (!edge.provenance.uncertainty) {
      reject('undisclosed-uncertainty', 'viewpoint label uncertainty must be disclosed');
    }
  }
  if (!baseline) {
    reject('missing-baseline', 'PERSPECTIVE_BROADENING requires an explicit baseline relevance/quality/credibility record');
  }
  if (baseline.relevance < BASELINE_THRESHOLDS.minRelevance
    || baseline.quality < BASELINE_THRESHOLDS.minQuality
    || baseline.credibility < BASELINE_THRESHOLDS.minCredibility) {
    reject('below-baseline', 'PERSPECTIVE_BROADENING candidate fails the baseline relevance/quality/credibility floor');
  }
  if (!baseline.languagePass || !baseline.contentSafetyPass || !baseline.accessibilityPass) {
    reject('preference-gate-failed', 'PERSPECTIVE_BROADENING requires content, language, safety and accessibility passes');
  }
  if (uncertainty.length === 0) {
    reject('undisclosed-uncertainty', 'PERSPECTIVE_BROADENING must disclose its uncertainty to the reader');
  }
}

/**
 * Validate one synthetic candidate record against the closed contract.
 * @returns frozen canonical candidate record (never a recommendation).
 */
export function validateCandidate(rawCandidate, { catalog, knownNodes }) {
  const candidate = safeObject(rawCandidate, 'candidate', { required: true });
  // Trust checks run first so a commercial or profiling field is reported as
  // such rather than as a generic unknown field.
  assertCommercialFree(candidate, 'candidate');
  assertNoIdentityProfiling(candidate, 'candidate');
  assertClosedKeys(candidate, CANDIDATE_KEYS, 'candidate');

  const contractVersion = safeText(candidate.contractVersion, 'candidate.contractVersion', { required: true, max: 64 });
  if (contractVersion !== CONTRACT_VERSION) {
    reject('unknown-contract-version', `candidate.contractVersion: ${contractVersion} is not ${CONTRACT_VERSION}`, { contractVersion });
  }

  const candidateId = safeId(candidate.candidateId, 'candidate.candidateId');
  const catalogId = safeId(candidate.catalogId, 'candidate.catalogId');
  if (!catalog.book(catalogId)) {
    reject('dangling-pointer', `candidate.catalogId: ${catalogId} does not resolve to a known catalog title`, { catalogId });
  }
  try {
    assertAllowedRoute(candidate.route, 'candidate.route');
  } catch (error) {
    reject('prohibited-route', error.message, { route: candidate.route });
  }

  const label = safeEnum(candidate.label, CANDIDATE_LABELS, 'candidate.label', { required: true });
  const ruleVersion = safeText(candidate.ruleVersion, 'candidate.ruleVersion', { required: true, max: 64 });

  if (!Array.isArray(candidate.trace) || candidate.trace.length === 0) {
    reject('floating-claim', 'candidate.trace: at least one resolvable ExplainabilityTrace edge is required');
  }
  if (candidate.trace.length > LIMITS.arrayItems) {
    reject('oversized-trace', `candidate.trace: exceeds ${LIMITS.arrayItems} edges`);
  }
  const trace = candidate.trace.map((edge, i) => validateEdge(edge, i, { catalog, knownNodes }));

  const uncertainty = (candidate.uncertainty ?? []).map((note, i) => safeText(note, `candidate.uncertainty[${i}]`, { required: true, max: LIMITS.commentLength }));
  const baseline = candidate.baseline === undefined ? null : validateBaseline(candidate.baseline, 'candidate.baseline');

  assertLabelRules(label, trace, baseline, uncertainty);

  const record = deepFreeze({
    candidateId,
    catalogId,
    label,
    route: candidate.route,
    contractVersion,
    ruleVersion,
    policyVersion: POLICY_VERSION,
    trace: trace.sort((a, b) => compareText(`${a.factorId}${a.targetId}`, `${b.factorId}${b.targetId}`)),
    uncertainty: uncertainty.slice().sort(compareText),
    baseline,
  });
  if (findProhibitedKeys(record).length > 0) {
    reject('commercial-field', 'accepted candidate still carries a prohibited field');
  }
  return record;
}

/**
 * Closed rejection vocabulary for candidate diagnostics (ATR-S036).
 *
 * A rejection may expose only a positional index and one of these fixed
 * categories. Candidate identifiers, field values and exception messages are
 * attacker-controlled text and never cross this boundary — not in a return
 * value, not in a log line, not in an export.
 */
export const CONTRACT_REJECTION_CODES = Object.freeze([
  // structural contract rules
  'unknown-field',
  'unknown-contract-version',
  'prohibited-route',
  'dangling-pointer',
  'floating-claim',
  'oversized-trace',
  'identity-proxy',
  'mislabeled-direct-match',
  'unsupported-exploratory',
  'unsupported-perspective-label',
  'category-difference-is-not-viewpoint',
  'undisclosed-uncertainty',
  'missing-baseline',
  'below-baseline',
  'preference-gate-failed',
  'commercial-field',
  // trust-policy rules
  'no-advertising-or-paid-placement',
  'no-user-identity-inference',
  'approved-evidence-route-only',
  // shared validation categories
  ...DIAGNOSTIC_CATEGORIES,
  // terminal fallback
  'contract-violation',
]);

/** Map any thrown error to a closed category without reading its message. */
export function closedRejectionCode(error) {
  const code = error?.code ?? error?.details?.rule;
  return CONTRACT_REJECTION_CODES.includes(code) ? code : 'contract-violation';
}

/**
 * Validate a set of fixture candidates. Order in, order out — the contract does
 * not reorder, score, or select anything.
 */
export function validateCandidateSet(rawCandidates, context) {
  const accepted = [];
  const rejected = [];
  for (const [index, raw] of [...rawCandidates].entries()) {
    try {
      accepted.push(validateCandidate(raw, context));
    } catch (error) {
      // Positional index and closed category only (ATR-S036).
      rejected.push({ index, code: closedRejectionCode(error) });
    }
  }
  return deepFreeze({
    contractVersion: CONTRACT_VERSION,
    policyVersion: POLICY_VERSION,
    scope: CONTRACT_SCOPE,
    accepted,
    rejected,
  });
}

/** Canonical serialization used to compare paired fixtures (AC4). */
export function canonicalJson(value) {
  const walk = (node) => {
    if (Array.isArray(node)) return node.map(walk);
    if (node && typeof node === 'object') {
      const out = {};
      for (const key of Object.keys(node).sort(compareText)) out[key] = walk(node[key]);
      return out;
    }
    return node;
  };
  return JSON.stringify(walk(value));
}
