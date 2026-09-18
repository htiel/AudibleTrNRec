/**
 * Connector artifact inventory capability tests (ATR-S016/S020).
 *
 * The connector owns two artifacts this process cannot see: the provider
 * credential envelope and the local identity seed. A local deletion cannot
 * remove them. This route is the only honest way to report their existence,
 * so its reply schema is closed hard: booleans and closed labels, nothing
 * that could carry a path, an account identifier or credential material.
 *
 * Every reply here is a synthetic literal. No connector process is launched,
 * no DPAPI call is made and no personal runtime file is read.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  CONNECTOR_ERROR_CODES,
  CONNECTOR_METHODS,
  ConnectorProcess,
  ConnectorProcessError,
  narrowArtifactInventory,
} from '../src/adapters/connector-process.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(here, '..');

const VALID = Object.freeze({
  credentialsRetained: true,
  identitySeedRetained: true,
  protector: 'windows-dpapi',
  removedBy: 'confirmed-disconnect-only',
});

test('the inventory capability is a fixed, allow-listed command with a named method', () => {
  assert.ok(CONNECTOR_METHODS.includes('local_artifact_inventory'));
  const process_ = new ConnectorProcess({
    packageRoot,
    pythonPath: path.join(packageRoot, '.venv', 'Scripts', 'python.exe'),
  });
  assert.equal(typeof process_.localArtifactInventory, 'function');
  // No parameter is accepted, so there is nothing for a caller to influence.
  assert.equal(ConnectorProcess.prototype.localArtifactInventory.length, 0);
  assert.ok(CONNECTOR_ERROR_CODES.includes('artifact-inventory-invalid'));
});

test('a well-formed inventory is accepted and frozen', () => {
  const result = narrowArtifactInventory({ ...VALID });
  assert.deepEqual(result, VALID);
  assert.ok(Object.isFrozen(result));
});

test('both boolean answers are legitimate, including "not retained"', () => {
  // Unlike a custody proof, `false` here is a fact to be reported, not a
  // failure. Value-matching would make the route unable to say "gone".
  for (const credentialsRetained of [true, false]) {
    for (const identitySeedRetained of [true, false]) {
      const result = narrowArtifactInventory({ ...VALID, credentialsRetained, identitySeedRetained });
      assert.equal(result.credentialsRetained, credentialsRetained);
      assert.equal(result.identitySeedRetained, identitySeedRetained);
    }
  }
});

test('a non-boolean existence value fails closed rather than becoming truthy', () => {
  // 'unknown', 'false', 0 and 1 must never be coerced: the deletion report
  // decides what to tell the owner from these, and a coerced value is a lie.
  for (const value of ['unknown', 'false', 'true', 0, 1, null, [], {}]) {
    assert.throws(
      () => narrowArtifactInventory({ ...VALID, credentialsRetained: value }),
      (error) => error instanceof ConnectorProcessError && error.code === 'artifact-inventory-invalid',
      `credentialsRetained: ${JSON.stringify(value)} must be refused`,
    );
  }
});

test('labels are accepted only from their closed sets', () => {
  for (const protector of ['windows-dpapi-v2', 'plaintext', '', null, true]) {
    assert.throws(() => narrowArtifactInventory({ ...VALID, protector }),
      (error) => error.code === 'artifact-inventory-invalid');
  }
  for (const removedBy of ['anything', 'delete-all', '', null]) {
    assert.throws(() => narrowArtifactInventory({ ...VALID, removedBy }),
      (error) => error.code === 'artifact-inventory-invalid');
  }
});

test('an extra key cannot smuggle a path, identifier or credential out', () => {
  const smuggled = [
    { credentialPath: 'C:/Users/owner/AppData/Local/atnr/credentials.bin' },
    { accountAlias: 'owner@example.test' },
    { identitySeed: 'a'.repeat(64) },
    { customerId: 'A1B2C3' },
    { sizeBytes: 4096 },
  ];
  for (const extra of smuggled) {
    assert.throws(
      () => narrowArtifactInventory({ ...VALID, ...extra }),
      (error) => error instanceof ConnectorProcessError && error.code === 'artifact-inventory-invalid',
      `${Object.keys(extra)[0]} must be refused`,
    );
  }
});

test('a missing key fails closed instead of reading as absent', () => {
  for (const key of Object.keys(VALID)) {
    const partial = { ...VALID };
    delete partial[key];
    assert.throws(() => narrowArtifactInventory(partial),
      (error) => error.code === 'artifact-inventory-invalid', `missing ${key} must be refused`);
  }
});

test('a non-object reply fails closed', () => {
  for (const reply of [null, undefined, 'ok', 42, true, [VALID]]) {
    assert.throws(() => narrowArtifactInventory(reply),
      (error) => error.code === 'artifact-inventory-invalid');
  }
});

test('the narrowed result carries only the four closed fields', () => {
  const result = narrowArtifactInventory({ ...VALID });
  assert.deepEqual(
    Object.keys(result).sort(),
    ['credentialsRetained', 'identitySeedRetained', 'protector', 'removedBy'],
  );
  const serialised = JSON.stringify(result);
  // No separator that could indicate a path or an address survives narrowing.
  assert.ok(!serialised.includes('\\') && !serialised.includes('@'));
});

test('a refused inventory raises a code inside the closed vocabulary', () => {
  try {
    narrowArtifactInventory({ ...VALID, protector: 'plaintext' });
    assert.fail('expected a refusal');
  } catch (error) {
    assert.ok(CONNECTOR_ERROR_CODES.includes(error.code));
    assert.equal(error.code, 'artifact-inventory-invalid');
  }
});
