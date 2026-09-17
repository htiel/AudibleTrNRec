import test from 'node:test';
import assert from 'node:assert/strict';

import {
  validateCandidate, validateCandidateSet, canonicalJson, CONTRACT_SCOPE,
  CANDIDATE_LABELS, BASELINE_THRESHOLDS,
} from '../src/core/contract.js';
import { ContractViolationError, TrustViolationError } from '../src/core/errors.js';
import { Catalog } from '../src/core/model.js';
import { CONTRACT_VERSION } from '../src/version.js';
import { SYNTHETIC_PEOPLE, SYNTHETIC_FACETS, SYNTHETIC_BOOKS } from '../src/fixtures/synthetic.js';
import {
  VALID_CANDIDATES, REJECTED_CANDIDATES, SYNTHETIC_HISTORY_NODES,
  SYNTHETIC_PREFERENCE_NODES, buildKnownNodes,
} from '../src/fixtures/contract-fixtures.js';

const catalog = new Catalog({ people: SYNTHETIC_PEOPLE, facets: SYNTHETIC_FACETS, books: SYNTHETIC_BOOKS });
const context = { catalog, knownNodes: buildKnownNodes(catalog) };

test('the contract declares in code that it is not a recommender', () => {
  assert.equal(CONTRACT_SCOPE.isRecommendation, false);
  assert.equal(CONTRACT_SCOPE.producesOrdering, false);
  assert.equal(CONTRACT_SCOPE.scoresCandidates, false);
  assert.equal(CONTRACT_SCOPE.selectsCandidates, false);
  assert.equal(CONTRACT_SCOPE.generatesExplanationText, false);
  assert.equal(CONTRACT_SCOPE.usesAiProvider, false);
  assert.equal(CONTRACT_SCOPE.validatesStructureOnly, true);
});

test('exactly three labels exist and each synthetic fixture is accepted', () => {
  assert.deepEqual([...CANDIDATE_LABELS], ['DIRECT_MATCH', 'EXPLORATORY', 'PERSPECTIVE_BROADENING']);
  const seen = new Set();
  for (const candidate of VALID_CANDIDATES) {
    const accepted = validateCandidate(candidate, context);
    seen.add(accepted.label);
    assert.equal(Object.isFrozen(accepted), true);
    assert.equal(accepted.contractVersion, CONTRACT_VERSION);
    assert.equal(accepted.ruleVersion, CONTRACT_VERSION);
    assert.ok(accepted.trace.length >= 1);
  }
  assert.deepEqual([...seen].sort(), [...CANDIDATE_LABELS].sort());
});

test('every accepted trace edge resolves to a known catalog node and a known history/preference node', () => {
  const historyIds = new Set(SYNTHETIC_HISTORY_NODES.map((n) => n.nodeId));
  const preferenceIds = new Set(SYNTHETIC_PREFERENCE_NODES.map((n) => n.preferenceId));
  for (const candidate of VALID_CANDIDATES) {
    const accepted = validateCandidate(candidate, context);
    assert.ok(catalog.book(accepted.catalogId), 'candidate must point at a real catalog title');
    for (const edge of accepted.trace) {
      assert.equal(typeof edge.factorId, 'string');
      assert.equal(edge.ruleVersion, CONTRACT_VERSION);
      assert.equal(typeof edge.confidence, 'number');
      assert.equal(typeof edge.provenance.source, 'string');
      if (edge.targetKind === 'history-node') assert.ok(historyIds.has(edge.targetId));
      if (edge.targetKind === 'explicit-preference') assert.ok(preferenceIds.has(edge.targetId));
      if (edge.targetKind === 'catalog-node') assert.ok(catalog.book(edge.targetId));
    }
  }
});

test('every adversarial fixture is rejected with the expected contract code', () => {
  for (const { why, expectedCode, candidate } of REJECTED_CANDIDATES) {
    assert.throws(
      () => validateCandidate(candidate, context),
      (error) => {
        assert.ok(error instanceof ContractViolationError || error instanceof TrustViolationError, `${why}: wrong error type`);
        const code = error.code ?? error.details?.rule;
        assert.equal(code, expectedCode, `${why}: expected ${expectedCode}, got ${code} (${error.message})`);
        return true;
      },
      why,
    );
  }
});

test('perspective broadening requires an explicit baseline above the quality/credibility floor', () => {
  assert.ok(BASELINE_THRESHOLDS.minQuality > 0.5);
  assert.ok(BASELINE_THRESHOLDS.minCredibility > 0.5);
  const broadening = VALID_CANDIDATES.find((c) => c.label === 'PERSPECTIVE_BROADENING');
  const accepted = validateCandidate(broadening, context);
  assert.ok(accepted.baseline.relevance >= BASELINE_THRESHOLDS.minRelevance);
  assert.equal(accepted.baseline.contentSafetyPass, true);
  assert.equal(accepted.baseline.languagePass, true);
  assert.equal(accepted.baseline.accessibilityPass, true);
  assert.ok(accepted.uncertainty.length > 0, 'broadening must disclose uncertainty');
});

test('the contract does not infer user ideology: no user identity input exists', () => {
  const broadening = VALID_CANDIDATES.find((c) => c.label === 'PERSPECTIVE_BROADENING');
  const accepted = validateCandidate(broadening, context);
  const serialized = canonicalJson(accepted);
  for (const token of ['political', 'ideolog', 'religio', 'leaning', 'alignment', 'userId', 'profile']) {
    assert.equal(serialized.toLowerCase().includes(token.toLowerCase()), false, `contract output mentions ${token}`);
  }
  // The validator takes (candidate, { catalog, knownNodes}) only: no user model.
  assert.equal(validateCandidate.length, 2);
});

test('a candidate set isolates failures instead of failing the whole batch', () => {
  const mixed = [VALID_CANDIDATES[0], REJECTED_CANDIDATES[0].candidate, VALID_CANDIDATES[1]];
  const result = validateCandidateSet(mixed, context);
  assert.equal(result.accepted.length, 2);
  assert.equal(result.rejected.length, 1);
  assert.equal(result.rejected[0].code, REJECTED_CANDIDATES[0].expectedCode);
  assert.equal(Object.isFrozen(result), true);
});

test('validation is deterministic and side-effect free', () => {
  const before = JSON.stringify(VALID_CANDIDATES);
  const a = canonicalJson(validateCandidateSet(VALID_CANDIDATES, context));
  const b = canonicalJson(validateCandidateSet(VALID_CANDIDATES, context));
  assert.equal(a, b);
  assert.equal(JSON.stringify(VALID_CANDIDATES), before, 'fixtures were mutated');
});
