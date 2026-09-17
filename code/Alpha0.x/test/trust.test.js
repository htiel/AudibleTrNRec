import test from 'node:test';
import assert from 'node:assert/strict';

import {
  isCommercialKey, isProfilingKey, findProhibitedKeys, stripCommercialFields,
  assertCommercialFree, assertNoIdentityProfiling, assertAllowedRoute, toScoringView,
  SCORING_VIEW_KEYS, ALLOWED_EVIDENCE_ROUTES, PROHIBITED_EVIDENCE_ROUTES,
} from '../src/core/trust.js';
import { TrustViolationError } from '../src/core/errors.js';
import { Catalog } from '../src/core/model.js';
import { validateCandidateSet, canonicalJson } from '../src/core/contract.js';
import { PAIRED_SET_A, PAIRED_SET_B, buildKnownNodes } from '../src/fixtures/contract-fixtures.js';
import { SYNTHETIC_PEOPLE, SYNTHETIC_FACETS, SYNTHETIC_BOOKS } from '../src/fixtures/synthetic.js';

test('commercial key detection covers the prohibited vocabulary', () => {
  for (const key of ['sponsoredRank', 'affiliatePayoutUsd', 'promotionTier', 'retailerMargin',
    'adCampaignId', 'paid_placement', 'bidAmount', 'cpcValue', 'revenueShare', 'featuredSlot',
    'commissionRate', 'discountPercent', 'retrievalRank', 'sourceOrdinal', 'bestsellerPosition',
    'providerPromotionTier']) {
    assert.equal(isCommercialKey(key), true, `${key} should be prohibited`);
  }
  for (const key of ['title', 'narratorIds', 'seriesPosition', 'durationMinutes', 'addedAt', 'readiness']) {
    assert.equal(isCommercialKey(key), false, `${key} should be allowed`);
  }
});

test('identity/ideology profiling keys are prohibited on the user side', () => {
  for (const key of ['politicalLeaning', 'religion', 'ethnicity', 'genderIdentity', 'partyAlignment', 'healthStatus']) {
    assert.equal(isProfilingKey(key), true, `${key} should be prohibited`);
  }
  assert.throws(() => assertNoIdentityProfiling({ inferredPoliticalLeaning: 'left' }), TrustViolationError);
  assert.doesNotThrow(() => assertNoIdentityProfiling({ languages: ['en'], familiarBalance: 0.7 }));
});

test('deep scan finds nested and array-nested commercial fields', () => {
  const found = findProhibitedKeys({ a: { b: [{ sponsoredRank: 1 }] }, ok: 2 });
  assert.deepEqual(found, ['a.b[0].sponsoredRank']);
  assert.throws(() => assertCommercialFree({ promo: { tier: 'gold' } }, 'candidate'), TrustViolationError);
});

test('ingestion strips commercial fields and records the removal honestly', () => {
  const { clean, dropped } = stripCommercialFields({ title: 'x', sponsoredRank: 1, nested: { affiliateId: 'a' } });
  assert.deepEqual(Object.keys(clean).sort(), ['nested', 'title']);
  assert.deepEqual(dropped.sort(), ['nested.affiliateId', 'sponsoredRank']);
});

test('normalized catalog drops commercial fields and notes it in provenance', () => {
  const catalog = new Catalog({ people: SYNTHETIC_PEOPLE, facets: SYNTHETIC_FACETS, books: SYNTHETIC_BOOKS });
  const paid = catalog.book('b-paid-special');
  assert.equal('sponsoredRank' in paid, false);
  assert.equal('affiliatePayoutUsd' in paid, false);
  assert.match(paid.provenance.notes.join(' '), /dropped prohibited commercial fields/);
  assert.deepEqual(findProhibitedKeys(paid), []);
});

test('the scoring view is an allowlist, so commercial fields have no path into ranking', () => {
  const catalog = new Catalog({ people: SYNTHETIC_PEOPLE, facets: SYNTHETIC_FACETS, books: SYNTHETIC_BOOKS });
  const smuggled = { ...catalog.book('b-ring-1'), sponsoredRank: 1, promotionTier: 'gold' };
  const view = toScoringView(smuggled);
  assert.deepEqual(Object.keys(view).filter((k) => !SCORING_VIEW_KEYS.includes(k)), []);
  assert.equal('sponsoredRank' in view, false);
  assert.equal(Object.isFrozen(view), true);
});

test('paired fixtures differing only in commercial offers and retrieval order yield identical accepted evidence', () => {
  const boosted = SYNTHETIC_BOOKS.map((b) => (b.bookId === 'b-policy-community-a'
    ? { ...b, sponsoredRank: 1, affiliatePayoutUsd: 99, promotionTier: 'platinum', retailerMargin: 0.9 }
    : b));
  const cleanCatalog = new Catalog({ people: SYNTHETIC_PEOPLE, facets: SYNTHETIC_FACETS, books: SYNTHETIC_BOOKS });
  const boostedCatalog = new Catalog({ people: SYNTHETIC_PEOPLE, facets: SYNTHETIC_FACETS, books: boosted });

  const a = validateCandidateSet(PAIRED_SET_A, { catalog: cleanCatalog, knownNodes: buildKnownNodes(cleanCatalog) });
  const b = validateCandidateSet(PAIRED_SET_B, { catalog: boostedCatalog, knownNodes: buildKnownNodes(boostedCatalog) });

  const canon = (r) => canonicalJson([...r.accepted].sort((x, y) => (x.candidateId < y.candidateId ? -1 : 1)));
  assert.equal(canon(a), canon(b));
  assert.deepEqual(a.rejected, []);
  assert.deepEqual(b.rejected, []);
});

test('accepted contract records are commercial-free and carry no generated recommendation', () => {
  const catalog = new Catalog({ people: SYNTHETIC_PEOPLE, facets: SYNTHETIC_FACETS, books: SYNTHETIC_BOOKS });
  const result = validateCandidateSet(PAIRED_SET_A, { catalog, knownNodes: buildKnownNodes(catalog) });
  assert.deepEqual(findProhibitedKeys(result), []);
  assert.doesNotThrow(() => assertCommercialFree(result, 'contract result'));
  assert.equal(result.scope.isRecommendation, false);
  assert.equal(result.scope.producesOrdering, false);
  assert.equal(result.scope.usesAiProvider, false);
});

test('evidence routes are allowlisted, so affiliate and advertising sources are rejected wholesale', () => {
  for (const route of ALLOWED_EVIDENCE_ROUTES) {
    assert.equal(assertAllowedRoute(route), route);
  }
  for (const route of PROHIBITED_EVIDENCE_ROUTES) {
    assert.throws(() => assertAllowedRoute(route), TrustViolationError);
  }
  assert.throws(() => assertAllowedRoute(undefined), TrustViolationError);
});
