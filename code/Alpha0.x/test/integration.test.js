import test from 'node:test';
import assert from 'node:assert/strict';

import * as api from '../src/index.js';
import { Catalog, mergeLibrarySnapshot } from '../src/core/model.js';
import { buildLibraryView, sortLibrary, filterLibrary } from '../src/core/library.js';
import { validateCandidateSet, canonicalJson } from '../src/core/contract.js';
import { VALID_CANDIDATES, buildKnownNodes } from '../src/fixtures/contract-fixtures.js';
import {
  SYNTHETIC_PEOPLE, SYNTHETIC_FACETS, SYNTHETIC_BOOKS,
  SYNTHETIC_SNAPSHOT, SYNTHETIC_SNAPSHOT_V2,
} from '../src/fixtures/synthetic.js';
import { SYNTHETIC_NOW } from '../src/version.js';

const catalog = () => new Catalog(
  { people: SYNTHETIC_PEOPLE, facets: SYNTHETIC_FACETS, books: SYNTHETIC_BOOKS },
  { source: 'synthetic-fixture', observedAt: SYNTHETIC_NOW },
);

test('the public surface exposes the 0.0.1 core without exposing a platform', () => {
  for (const name of ['Catalog', 'mergeLibrarySnapshot', 'buildLibraryView', 'sortLibrary',
    'filterLibrary', 'facetCounts', 'assertCommercialFree', 'validateCandidate',
    'validateCandidateSet', 'CONTRACT_SCOPE', 'ALPHA_VERSION', 'SCHEMA_VERSION', 'CONTRACT_VERSION']) {
    assert.ok(name in api, `missing export: ${name}`);
  }
  for (const name of Object.keys(api)) {
    assert.equal(/server|http|client|storage|database|provider|sdk/i.test(name), false, `platform-coupled export: ${name}`);
  }
});

test('deferred product features are absent from the public surface', () => {
  for (const name of ['AnnotationStore', 'recommend', 'computeAffinities', 'affinityFor',
    'normalizePreferences', 'DEFAULT_PREFERENCES', 'selectPerspectiveCandidates', 'perspectiveSlots',
    'buildExplanation', 'PERSPECTIVE_RULE', 'WEIGHTS', 'DIVERSITY_CAPS', 'FEEDBACK_VERDICTS']) {
    assert.equal(name in api, false, `deferred feature is still exported: ${name}`);
  }
  assert.equal(api.RUNTIME_PROFILE.ratingsFeature, 'deferred');
  assert.equal(api.RUNTIME_PROFILE.recommendationEngine, 'deferred');
});

test('end-to-end: import, inspect, re-import, inspect again', () => {
  const cat = catalog();
  const first = mergeLibrarySnapshot([], SYNTHETIC_SNAPSHOT, { observedAt: SYNTHETIC_NOW });
  const rows = buildLibraryView(cat, first.entries);

  assert.equal(sortLibrary(rows, { field: 'title' })[0].title, 'Dungeon Cycle: Respawn');
  assert.equal(filterLibrary(rows, { status: ['in-progress'] }).length, 1);

  // Repeated import with the same data must not change the inspector at all.
  const repeat = mergeLibrarySnapshot(first.entries, SYNTHETIC_SNAPSHOT, { observedAt: SYNTHETIC_NOW });
  assert.equal(canonicalJson(buildLibraryView(cat, repeat.entries)), canonicalJson(rows));
  assert.deepEqual(repeat.report.added, []);
  assert.deepEqual(repeat.report.updated, []);

  // New source data updates source-owned fields only, and reports its failures.
  const updated = mergeLibrarySnapshot(repeat.entries, SYNTHETIC_SNAPSHOT_V2, { observedAt: SYNTHETIC_NOW });
  const updatedRows = buildLibraryView(cat, updated.entries);
  assert.equal(updatedRows.find((r) => r.bookId === 'b-ring-2').percentComplete, 55);
  assert.ok(updatedRows.some((r) => r.bookId === 'b-dungeon-2'));
  assert.ok(updated.report.rejected.length > 0);
});

test('the inspector projection is JSON-serializable, frozen, and free of hidden state', () => {
  const cat = catalog();
  const { entries } = mergeLibrarySnapshot([], SYNTHETIC_SNAPSHOT, { observedAt: SYNTHETIC_NOW });
  const rows = buildLibraryView(cat, entries);
  assert.equal(rows.every((r) => Object.isFrozen(r)), true);
  const roundTrip = JSON.parse(JSON.stringify(rows));
  assert.deepEqual(roundTrip.map((r) => r.bookId), rows.map((r) => r.bookId));
});

test('ordering of input records does not change any output', () => {
  const cat = catalog();
  const forward = mergeLibrarySnapshot([], SYNTHETIC_SNAPSHOT, { observedAt: SYNTHETIC_NOW });
  const reversed = mergeLibrarySnapshot([], SYNTHETIC_SNAPSHOT.slice().reverse(), { observedAt: SYNTHETIC_NOW });
  assert.equal(
    canonicalJson(buildLibraryView(cat, forward.entries)),
    canonicalJson(buildLibraryView(cat, reversed.entries)),
  );
});

test('the evidence contract accepts the synthetic trace fixtures and never emits a recommendation', () => {
  const cat = catalog();
  const result = validateCandidateSet(VALID_CANDIDATES, { catalog: cat, knownNodes: buildKnownNodes(cat) });
  assert.equal(result.accepted.length, VALID_CANDIDATES.length);
  assert.deepEqual(result.rejected, []);
  assert.equal(result.scope.isRecommendation, false);
  assert.equal(result.scope.selectsCandidates, false);
  assert.equal(result.scope.generatesExplanationText, false);
  // Input order is preserved: the contract never reorders anything.
  assert.deepEqual(result.accepted.map((c) => c.candidateId), VALID_CANDIDATES.map((c) => c.candidateId));
});
