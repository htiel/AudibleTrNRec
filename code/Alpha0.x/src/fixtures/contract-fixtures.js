/**
 * Synthetic ExplainabilityTrace fixtures (ATR-S010).
 *
 * THESE ARE NOT RECOMMENDATIONS. Nothing here was produced by a ranker, a
 * scorer, a selector, or a model. Each record is hand-written synthetic
 * evidence used to exercise the closed contract in `src/core/contract.js`:
 * labels are asserted by the fixture author, and the contract's only job is to
 * accept or reject the structure.
 */

import { CONTRACT_VERSION } from '../version.js';

/** Synthetic "known history" nodes: what a future build would have observed. */
export const SYNTHETIC_HISTORY_NODES = Object.freeze([
  Object.freeze({ nodeId: 'h-completed-b-ring-1', bookId: 'b-ring-1', kind: 'completed' }),
  Object.freeze({ nodeId: 'h-completed-b-stars-quiet', bookId: 'b-stars-quiet', kind: 'completed' }),
  Object.freeze({ nodeId: 'h-completed-b-policy-market-a', bookId: 'b-policy-market-a', kind: 'completed' }),
]);

/** Synthetic explicit preference nodes. Declared fixture data, never inferred. */
export const SYNTHETIC_PREFERENCE_NODES = Object.freeze([
  Object.freeze({ preferenceId: 'pref-author-p-ashgrove', subjectKind: 'author', subjectId: 'p-ashgrove', stance: 'explicitly-liked' }),
  Object.freeze({ preferenceId: 'pref-genre-g-fantasy', subjectKind: 'genre', subjectId: 'g-fantasy', stance: 'explicitly-liked' }),
]);

/** Build the pointer-resolution sets the contract validates against. */
export function buildKnownNodes(catalog, {
  historyNodes = SYNTHETIC_HISTORY_NODES,
  preferenceNodes = SYNTHETIC_PREFERENCE_NODES,
} = {}) {
  return Object.freeze({
    'history-node': new Set(historyNodes.map((n) => n.nodeId)),
    'explicit-preference': new Set(preferenceNodes.map((n) => n.preferenceId)),
    'catalog-node': new Set([...catalog.books.keys()]),
  });
}

const provenance = (overrides = {}) => ({
  source: 'synthetic-fixture',
  observedAt: '2026-01-01T00:00:00.000Z',
  correctable: true,
  ...overrides,
});

const DIRECT_MATCH = Object.freeze({
  candidateId: 'cand-direct-ring-2',
  catalogId: 'b-ring-2',
  label: 'DIRECT_MATCH',
  route: 'synthetic-fixture',
  contractVersion: CONTRACT_VERSION,
  ruleVersion: CONTRACT_VERSION,
  trace: [
    {
      factorId: 'p-ashgrove', factorKind: 'author', edgeType: 'matches-explicit-preference',
      targetId: 'pref-author-p-ashgrove', targetKind: 'explicit-preference',
      basis: 'explicit-preference', confidence: 0.9, ruleVersion: CONTRACT_VERSION,
      provenance: provenance({ correctable: true }),
    },
    {
      factorId: 's-ringbearer', factorKind: 'series', edgeType: 'shares-series',
      targetId: 'h-completed-b-ring-1', targetKind: 'history-node',
      basis: 'facet-identity', confidence: 1, ruleVersion: CONTRACT_VERSION,
      provenance: provenance(),
    },
  ],
  uncertainty: [],
});

const EXPLORATORY = Object.freeze({
  candidateId: 'cand-exploratory-dungeon-1',
  catalogId: 'b-dungeon-1',
  label: 'EXPLORATORY',
  route: 'synthetic-fixture',
  contractVersion: CONTRACT_VERSION,
  ruleVersion: CONTRACT_VERSION,
  trace: [
    {
      factorId: 't-long-arc', factorKind: 'theme', edgeType: 'shares-theme',
      targetId: 'h-completed-b-ring-1', targetKind: 'history-node',
      basis: 'facet-identity', confidence: 0.6, ruleVersion: CONTRACT_VERSION,
      provenance: provenance(),
    },
  ],
  uncertainty: ['Adjacent-theme evidence only; not an explicit preference match.'],
});

const PERSPECTIVE_BROADENING = Object.freeze({
  candidateId: 'cand-perspective-community-a',
  catalogId: 'b-policy-community-a',
  label: 'PERSPECTIVE_BROADENING',
  route: 'synthetic-fixture',
  contractVersion: CONTRACT_VERSION,
  ruleVersion: CONTRACT_VERSION,
  trace: [
    {
      factorId: 'topic-urban-housing', factorKind: 'topic', edgeType: 'diverges-in-viewpoint',
      targetId: 'h-completed-b-policy-market-a', targetKind: 'history-node',
      basis: 'sourced-viewpoint-label', confidence: 0.65, ruleVersion: CONTRACT_VERSION,
      provenance: provenance({
        source: 'synthetic-catalog-classifier',
        correctable: true,
        uncertainty: 'Viewpoint label is a low-confidence catalog classification and can be corrected.',
      }),
    },
    {
      factorId: 'g-policy', factorKind: 'genre', edgeType: 'shares-genre',
      targetId: 'h-completed-b-policy-market-a', targetKind: 'history-node',
      basis: 'facet-identity', confidence: 1, ruleVersion: CONTRACT_VERSION,
      provenance: provenance(),
    },
  ],
  uncertainty: ['Same topic, differently sourced viewpoint. The label may be wrong and is correctable.'],
  baseline: {
    relevance: 0.7, quality: 0.82, credibility: 0.85,
    languagePass: true, contentSafetyPass: true, accessibilityPass: true,
  },
});

/** Valid synthetic candidates, one per label. */
export const VALID_CANDIDATES = Object.freeze([DIRECT_MATCH, EXPLORATORY, PERSPECTIVE_BROADENING]);

const clone = (value) => JSON.parse(JSON.stringify(value));

/**
 * Paired fixtures for contract invariance (ATR-S010 AC4). Set B presents the
 * same evidence in a different retrieval order. Commercial variation is applied
 * to the catalog source records, which ingestion strips.
 */
export const PAIRED_SET_A = Object.freeze(VALID_CANDIDATES.map(clone));
export const PAIRED_SET_B = Object.freeze([...VALID_CANDIDATES].reverse().map(clone));

/** Each entry: a fixture that MUST be rejected, plus the expected contract code. */
export const REJECTED_CANDIDATES = Object.freeze([
  Object.freeze({
    why: 'novel field at the top level',
    expectedCode: 'unknown-field',
    candidate: { ...clone(DIRECT_MATCH), nebula_weight: 0.42 },
  }),
  Object.freeze({
    why: 'novel field nested inside a trace edge',
    expectedCode: 'unknown-field',
    candidate: (() => {
      const c = clone(DIRECT_MATCH);
      c.trace[0].nebula_weight = 0.42;
      return c;
    })(),
  }),
  Object.freeze({
    why: 'novel field nested inside edge provenance',
    expectedCode: 'unknown-field',
    candidate: (() => {
      const c = clone(DIRECT_MATCH);
      c.trace[1].provenance.nebula_weight = 0.42;
      return c;
    })(),
  }),
  Object.freeze({
    why: 'commercial placement field',
    expectedCode: 'no-advertising-or-paid-placement',
    candidate: { ...clone(DIRECT_MATCH), sponsoredPlacement: 1 },
  }),
  Object.freeze({
    why: 'affiliate payout nested in a trace edge',
    expectedCode: 'no-advertising-or-paid-placement',
    candidate: (() => {
      const c = clone(DIRECT_MATCH);
      c.trace[0].affiliatePayoutUsd = 1.25;
      return c;
    })(),
  }),
  Object.freeze({
    why: 'source ordinal / retrieval rank',
    expectedCode: 'no-advertising-or-paid-placement',
    candidate: { ...clone(DIRECT_MATCH), retrievalRank: 1 },
  }),
  Object.freeze({
    why: 'provider preference field',
    expectedCode: 'no-advertising-or-paid-placement',
    candidate: { ...clone(DIRECT_MATCH), providerPromotionTier: 'gold' },
  }),
  Object.freeze({
    why: 'affiliate-bound evidence route',
    expectedCode: 'prohibited-route',
    candidate: { ...clone(DIRECT_MATCH), route: 'affiliate-feed' },
  }),
  Object.freeze({
    why: 'advertising-bound evidence route',
    expectedCode: 'prohibited-route',
    candidate: { ...clone(DIRECT_MATCH), route: 'advertising-network' },
  }),
  Object.freeze({
    why: 'unknown contract version',
    expectedCode: 'unknown-contract-version',
    candidate: { ...clone(DIRECT_MATCH), contractVersion: '0.9.9-unreleased' },
  }),
  Object.freeze({
    why: 'floating claim: no trace edges at all',
    expectedCode: 'floating-claim',
    candidate: { ...clone(DIRECT_MATCH), trace: [] },
  }),
  Object.freeze({
    why: 'dangling pointer to a history node that does not exist',
    expectedCode: 'dangling-pointer',
    candidate: (() => {
      const c = clone(EXPLORATORY);
      c.trace[0].targetId = 'h-invented-listen';
      return c;
    })(),
  }),
  Object.freeze({
    why: 'invented history: catalog title is not in the catalog',
    expectedCode: 'dangling-pointer',
    candidate: { ...clone(EXPLORATORY), catalogId: 'b-does-not-exist' },
  }),
  Object.freeze({
    why: 'dangling matching factor',
    expectedCode: 'dangling-pointer',
    candidate: (() => {
      const c = clone(EXPLORATORY);
      c.trace[0].factorId = 't-invented-theme';
      return c;
    })(),
  }),
  Object.freeze({
    why: 'ideology proxy as a matching factor',
    expectedCode: 'identity-proxy',
    candidate: (() => {
      const c = clone(EXPLORATORY);
      c.trace[0].factorId = 'ideology-left-leaning';
      return c;
    })(),
  }),
  Object.freeze({
    why: 'inferred political leaning attached to the candidate',
    expectedCode: 'no-user-identity-inference',
    candidate: { ...clone(EXPLORATORY), userPoliticalLeaning: 'centre-left' },
  }),
  Object.freeze({
    why: 'exploratory-grade evidence mislabeled as DIRECT_MATCH',
    expectedCode: 'mislabeled-direct-match',
    candidate: { ...clone(EXPLORATORY), label: 'DIRECT_MATCH' },
  }),
  Object.freeze({
    why: 'divergent-viewpoint evidence mislabeled as DIRECT_MATCH',
    expectedCode: 'mislabeled-direct-match',
    candidate: { ...clone(PERSPECTIVE_BROADENING), label: 'DIRECT_MATCH' },
  }),
  Object.freeze({
    why: 'divergent-viewpoint evidence mislabeled as EXPLORATORY',
    expectedCode: 'unsupported-exploratory',
    candidate: { ...clone(PERSPECTIVE_BROADENING), label: 'EXPLORATORY' },
  }),
  Object.freeze({
    why: 'perspective label with no divergent-viewpoint evidence',
    expectedCode: 'unsupported-perspective-label',
    candidate: { ...clone(EXPLORATORY), label: 'PERSPECTIVE_BROADENING' },
  }),
  Object.freeze({
    why: 'category difference offered as proof of viewpoint',
    expectedCode: 'category-difference-is-not-viewpoint',
    candidate: (() => {
      const c = clone(PERSPECTIVE_BROADENING);
      c.trace[0].basis = 'category-difference';
      return c;
    })(),
  }),
  Object.freeze({
    why: 'viewpoint label presented as non-correctable fact',
    expectedCode: 'unsupported-perspective-label',
    candidate: (() => {
      const c = clone(PERSPECTIVE_BROADENING);
      c.trace[0].provenance.correctable = false;
      return c;
    })(),
  }),
  Object.freeze({
    why: 'viewpoint label with undisclosed uncertainty',
    expectedCode: 'undisclosed-uncertainty',
    candidate: (() => {
      const c = clone(PERSPECTIVE_BROADENING);
      delete c.trace[0].provenance.uncertainty;
      return c;
    })(),
  }),
  Object.freeze({
    why: 'unsafe, low-quality false balance (fringe title below the baseline)',
    expectedCode: 'below-baseline',
    candidate: (() => {
      const c = clone(PERSPECTIVE_BROADENING);
      c.candidateId = 'cand-perspective-fringe';
      c.catalogId = 'b-policy-fringe';
      c.baseline = {
        relevance: 0.7, quality: 0.3, credibility: 0.2,
        languagePass: true, contentSafetyPass: true, accessibilityPass: true,
      };
      return c;
    })(),
  }),
  Object.freeze({
    why: 'perspective candidate failing the content-safety gate',
    expectedCode: 'preference-gate-failed',
    candidate: (() => {
      const c = clone(PERSPECTIVE_BROADENING);
      c.baseline.contentSafetyPass = false;
      return c;
    })(),
  }),
  Object.freeze({
    why: 'perspective candidate with no baseline record',
    expectedCode: 'missing-baseline',
    candidate: (() => {
      const c = clone(PERSPECTIVE_BROADENING);
      delete c.baseline;
      return c;
    })(),
  }),
]);
