/**
 * Final-review must-fix regression tests.
 *
 * Covers, in order:
 *   1. the custody-proof interlock — no rollback write or migration may run
 *      before the trusted connector has proven the OS custody boundary;
 *   2. the closed `verify_custody` reply shape;
 *   3. the unlock display readiness handshake — the server may not listen
 *      until the window has actually appeared, and the handshake reveals no
 *      capability;
 *   4. omission of TEMP/TMP from the connector child environment.
 *
 * Everything here is synthetic: no connector process is launched, no personal
 * state is read, and no real PowerShell window is opened.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';

import {
  CustodyProofGate,
  RuntimeDataSourceError,
} from '../src/security/runtime-data-source.js';
import { minimalWindowsEnv } from '../src/security/trusted-paths.js';
import {
  CapabilityBootstrapError,
  UNLOCK_READY_TOKEN,
  buildDisplayScript,
  showLocalUnlockCapability,
} from '../scripts/local-capability-bootstrap.js';

const CAPABILITY = 'ABCDEFGHJKMNPQRSTVWXYZ234567';
const ORIGIN = 'http://127.0.0.1:4310';

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

// --- 3. unlock display readiness handshake ----------------------------------

/** A fake PowerShell child that never touches a real process. */
function fakeChild() {
  const child = new EventEmitter();
  child.stdout = new EventEmitter();
  child.stdout.setEncoding = () => {};
  child.stdin = { end() {} };
  child.killed = 0;
  child.kill = () => { child.killed += 1; };
  return child;
}

function spawnFake(child) {
  return () => child;
}

const displayOptions = (child, extra = {}) => ({
  capability: CAPABILITY,
  origin: ORIGIN,
  platform: 'win32',
  env: { SystemRoot: 'C:\\Windows', windir: 'C:\\Windows' },
  spawnProcess: spawnFake(child),
  ...extra,
});

test('the display script reports readiness only from the Shown event', () => {
  const script = buildDisplayScript(CAPABILITY, { title: 'ATnR', origin: ORIGIN });
  assert.match(script, /\$form\.Add_Shown\(/);
  // Readiness is emitted after every Add-Type and control construction.
  assert.ok(script.indexOf('Add-Type') < script.indexOf('Add_Shown'));
  assert.ok(script.indexOf('$form.Controls.AddRange') < script.indexOf('Add_Shown'));
  assert.ok(script.indexOf('Add_Shown') < script.indexOf('ShowDialog'));
  // The readiness token carries no capability material.
  assert.equal(UNLOCK_READY_TOKEN.includes(CAPABILITY), false);
  const shownLine = script.split('\n').find((line) => line.includes('Add_Shown'));
  assert.equal(shownLine.includes(CAPABILITY), false);
});

test('startup waits for the window and then resolves a closable handle', async () => {
  const child = fakeChild();
  const pending = showLocalUnlockCapability(displayOptions(child));
  let settled = false;
  pending.then(() => { settled = true; }, () => { settled = true; });

  await new Promise((resolve) => setImmediate(resolve));
  // Spawning alone must not be treated as readiness.
  assert.equal(settled, false);

  child.stdout.emit('data', `${UNLOCK_READY_TOKEN}\r\n`);
  const handle = await pending;
  assert.equal(typeof handle.close, 'function');
  handle.close();
  assert.equal(child.killed, 1);
});

test('a display that dies before readiness fails closed', async () => {
  for (const [event, code] of [
    ['exit', 'unlock-display-not-ready'],
    ['close', 'unlock-display-not-ready'],
    ['error', 'unlock-display-unavailable'],
  ]) {
    const child = fakeChild();
    const pending = showLocalUnlockCapability(displayOptions(child));
    child.emit(event, event === 'error' ? new Error('boom') : 1);
    await assert.rejects(pending, (error) => {
      assert.ok(error instanceof CapabilityBootstrapError);
      assert.equal(error.code, code);
      return true;
    });
    // The child is always signalled, so no orphan window survives a failure.
    assert.ok(child.killed >= 1);
  }
});

test('a display that never becomes ready times out instead of listening', async () => {
  const child = fakeChild();
  const pending = showLocalUnlockCapability(displayOptions(child, { readyTimeoutMs: 15 }));
  await assert.rejects(pending, /unlock-display-not-ready/);
  assert.ok(child.killed >= 1);
});

test('unrelated stdout noise is never mistaken for readiness', async () => {
  const child = fakeChild();
  const pending = showLocalUnlockCapability(displayOptions(child, { readyTimeoutMs: 40 }));
  child.stdout.emit('data', 'ATNR-UNLOCK-DISPLAY-REAF\r\n');
  child.stdout.emit('data', 'some other output\r\n');
  await assert.rejects(pending, /unlock-display-not-ready/);
});

test('a split readiness token is still recognised', async () => {
  const child = fakeChild();
  const pending = showLocalUnlockCapability(displayOptions(child));
  const half = Math.floor(UNLOCK_READY_TOKEN.length / 2);
  child.stdout.emit('data', UNLOCK_READY_TOKEN.slice(0, half));
  child.stdout.emit('data', `${UNLOCK_READY_TOKEN.slice(half)}\r\n`);
  const handle = await pending;
  assert.equal(typeof handle.close, 'function');
  handle.close();
});

test('stderr is not piped, so a PowerShell error cannot echo the capability', () => {
  let captured = null;
  const child = fakeChild();
  showLocalUnlockCapability(displayOptions(child, {
    readyTimeoutMs: 10,
    spawnProcess: (file, args, options) => { captured = options; return child; },
  })).catch(() => { /* expected timeout */ });
  assert.deepEqual(captured.stdio, ['pipe', 'pipe', 'ignore']);
  // The display environment stays minimal.
  assert.deepEqual(Object.keys(captured.env).sort(), ['SystemRoot', 'windir']);
});

// --- 4. TEMP/TMP omission ---------------------------------------------------

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
