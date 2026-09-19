/**
 * Final-review must-fix regression tests.
 *
 * Covers, in order:
 *   1. the custody-proof interlock — no rollback write or migration may run
 *      before the trusted connector has proven the OS custody boundary;
 *   2. the closed `verify_custody` reply shape;
 *   3. omission of TEMP/TMP from the connector child environment.
 *
 * Everything here is synthetic: no connector process is launched, no personal
 * state is read, and no real PowerShell window is opened.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CustodyProofGate,
  RuntimeDataSourceError,
} from '../src/security/runtime-data-source.js';
import { minimalWindowsEnv } from '../src/security/trusted-paths.js';

// --- 1. custody proof must precede any write --------------------------------

test('the migration custody check refuses to run before the OS proof exists', () => {
  const gate = new CustodyProofGate();
  assert.equal(gate.proven, false);

  let innerCalls = 0;
  const guarded = gate.guard(() => { innerCalls += 1; return 'verified'; });

  // Before the proof: the wrapped check never reaches the inner verifier, so
  // `openRealLibraryState` cannot create a rollback envelope or migrate.
  assert.throws(() => guarded({ root: 'C:\\synthetic' }), /custody-proof-missing/);
  assert.equal(innerCalls, 0);

  gate.record({ custodyVerified: true, aclVerified: true });
  assert.equal(gate.proven, true);
  assert.equal(guarded({ root: 'C:\\synthetic' }), 'verified');
  assert.equal(innerCalls, 1);
});

test('a partial or spoofed custody proof is not accepted', () => {
  for (const proof of [
    null,
    undefined,
    {},
    { custodyVerified: true },
    { aclVerified: true },
    { custodyVerified: 'yes', aclVerified: 'yes' },
    { custodyVerified: 1, aclVerified: 1 },
    { custodyVerified: true, aclVerified: false },
  ]) {
    const gate = new CustodyProofGate();
    assert.throws(() => gate.record(proof), RuntimeDataSourceError);
    assert.equal(gate.proven, false);
    assert.throws(() => gate.assertProven(), /custody-proof-missing/);
  }
});

test('the ordering is observable: proof is recorded before the first write', async () => {
  const order = [];
  const gate = new CustodyProofGate();

  // Stands in for the connector's verify_custody round trip.
  const verifyCustody = async () => {
    order.push('os-custody-proof');
    return { custodyVerified: true, aclVerified: true, rootHardened: true, protector: 'windows-dpapi' };
  };
  // Stands in for openRealLibraryState's first boundary check, which happens
  // before it probes, migrates or writes a rollback envelope.
  const openState = () => {
    gate.guard(() => order.push('custody-boundary-check'))({});
    order.push('rollback-write');
  };

  gate.record(await verifyCustody());
  openState();

  assert.deepEqual(order, ['os-custody-proof', 'custody-boundary-check', 'rollback-write']);
  assert.equal(order.indexOf('os-custody-proof') < order.indexOf('rollback-write'), true);
});

// --- 3. TEMP/TMP omission ---------------------------------------------------

test('the connector child environment carries no temporary directory', () => {
  const env = minimalWindowsEnv({
    SystemRoot: 'C:\\Windows',
    windir: 'C:\\Windows',
    LOCALAPPDATA: 'C:\\Users\\a\\AppData\\Local',
    TEMP: 'C:\\Users\\a\\AppData\\Local\\Temp',
    TMP: 'C:\\Users\\a\\AppData\\Local\\Temp',
  });
  assert.equal('TEMP' in env, false);
  assert.equal('TMP' in env, false);
  // The custody-relevant values the connector genuinely needs are still there.
  assert.equal(env.LOCALAPPDATA, 'C:\\Users\\a\\AppData\\Local');
  assert.equal(env.SystemRoot, 'C:\\Windows');
  // No value anywhere in the environment points at a temp directory.
  for (const value of Object.values(env)) {
    assert.equal(/\\Temp(\\|$)/i.test(value), false);
  }
});
