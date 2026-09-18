import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  COMPLETENESS_BASES,
  CONTRIBUTOR_LIMIT,
  IDENTITY_BASES,
  SOURCE_CONTRACT,
  convertDeclaredProgress,
  isZoneQualifiedInstant,
} from '../src/core/source-contract.js';

const root = path.dirname(fileURLToPath(import.meta.url));
const artifactPath = path.join(root, '..', 'contracts', 'source-contract.json');
const artifact = JSON.parse(readFileSync(artifactPath, 'utf8'));
const pythonMirror = readFileSync(path.join(root, '..', 'connector', 'atnr_connector', 'contract.py'), 'utf8');

test('the Node mirror is byte-for-byte equivalent to the reviewed artifact', () => {
  assert.deepEqual(JSON.parse(JSON.stringify(SOURCE_CONTRACT)), artifact);
  assert.equal(SOURCE_CONTRACT.contractRevision, 'atr-source-contract-r1');
  assert.equal(CONTRIBUTOR_LIMIT, artifact.contributorLimit);
  assert.deepEqual([...IDENTITY_BASES], artifact.identity.personBasis);
  assert.deepEqual([...COMPLETENESS_BASES], artifact.pagination.completenessBases);
});

test('the Python loader reads the same artifact and pins the same revision', () => {
  assert.ok(pythonMirror.includes('CONTRACT_REVISION = "atr-source-contract-r1"'));
  assert.ok(pythonMirror.includes('"contracts" / "source-contract.json"'));
  // Every limit the connector uses is derived from the artifact, never inlined.
  for (const derived of ['contributorLimit', 'categoryLadders', 'maxPages', 'pageSize', 'maxItems']) {
    assert.ok(pythonMirror.includes(derived), `${derived} must be read from the contract`);
  }
});

test('progress conversion uses the declared scale and never guesses from magnitude', () => {
  for (const value of [0, 0.5, 1, 25, 42.9, 99.9, 100]) {
    assert.deepEqual(convertDeclaredProgress('percent_complete', value), { ok: true, percent: value });
  }
  assert.deepEqual(convertDeclaredProgress('percent_complete', null), { ok: true, percent: null });
  assert.deepEqual(convertDeclaredProgress('percent_complete', undefined), { ok: true, percent: null });
  for (const bad of [-1, 101, 1000]) {
    assert.equal(convertDeclaredProgress('percent_complete', bad).ok, false);
    assert.equal(convertDeclaredProgress('percent_complete', bad).reason, 'progress-value-out-of-range');
  }
  for (const bad of ['50', Number.NaN, Infinity, true, {}]) {
    assert.equal(convertDeclaredProgress('percent_complete', bad).reason, 'progress-value-invalid');
  }
  assert.equal(convertDeclaredProgress('unknown_field', 1).reason, 'undeclared-progress-field');
});

test('only zone-qualified instants are accepted as observations', () => {
  for (const good of ['2026-09-17T12:00:00Z', '2026-09-17T12:00:00.000Z', '2026-09-17T12:00:00.123456+02:00']) {
    assert.equal(isZoneQualifiedInstant(good), true);
  }
  for (const bad of ['2026-09-17T12:00:00', '2026-09-17 12:00:00Z', '2026-09-17', 'now', '', null, 17]) {
    assert.equal(isZoneQualifiedInstant(bad), false);
  }
});

test('the contract states its completeness and byte-accounting honesty explicitly', () => {
  assert.equal(SOURCE_CONTRACT.pagination.byteAccountingIsWireProof, false, 'a decoded estimate is not wire proof');
  assert.equal(SOURCE_CONTRACT.pagination.capPolicy, 'stop-no-probe');
  assert.equal(SOURCE_CONTRACT.pagination.duplicatePolicy, 'stop');
  assert.equal(SOURCE_CONTRACT.recordPolicy.malformed, 'stop-whole-capture');
  assert.equal(SOURCE_CONTRACT.recordPolicy.partialPromotion, 'prohibited');
  assert.equal(SOURCE_CONTRACT.identity.nameEquivalence, 'never');
  assert.equal(SOURCE_CONTRACT.identity.crossRoleEquivalence, 'provider-id-only');
  assert.equal(SOURCE_CONTRACT.status, 'proposed-pending-CP-01', 'the contract is not yet source-verified');
});
