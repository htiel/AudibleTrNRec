import test from 'node:test';
import assert from 'node:assert/strict';

import {
  applyRuntimeChrome,
  isPrivateAlphaRequested,
  resolveBootstrapState,
  resolveConnectionState,
  retryPrivateAlphaHref,
  CONNECTION_STATES,
} from '../ui/js/bootstrap-state.js';

test('private-alpha bootstrap failures resolve to an explicit fail-closed state', () => {
  const state = resolveBootstrapState({
    privateModeRequested: true,
    connectionApi: null,
    bootstrapError: 'private-alpha-runtime-source-refused',
  });

  assert.equal(state.mode, 'private-refused');
  assert.equal(state.failClosed, true);
  assert.equal(state.errorCode, 'private-alpha-runtime-source-refused');
  assert.match(state.message, /did not prove/i);
  assert.doesNotMatch(state.chrome.status, /synthetic/i);
  assert.match(state.chrome.footer, /No synthetic fallback/i);
});

test('successful private bootstrap resolves to private chrome without synthetic copy', () => {
  const state = resolveBootstrapState({
    privateModeRequested: true,
    connectionApi: {},
    connectionInfo: { connected: true },
  });

  assert.equal(state.mode, 'private-alpha');
  assert.equal(state.failClosed, false);
  assert.match(state.chrome.status, /Private alpha/i);
  assert.doesNotMatch(state.chrome.status, /synthetic/i);
  // Issue #8: a held credential alone is custody, not proof, so the chrome
  // must not announce a working Audible connection.
  assert.equal(state.connectionState.state, 'unverified');
  assert.doesNotMatch(state.chrome.status, /Audible verified/i);
});

test('a stored credential alone is never reported as a working connection', () => {
  const held = resolveConnectionState({ connected: true });
  assert.equal(held.state, 'unverified');
  assert.equal(held.credentialsPresent, true);
  assert.equal(held.verified, false);
  assert.equal(held.connected, false, 'connected must mean verified, not "a file exists"');
  assert.match(held.detail, /no recent provider interaction/i);
  assert.match(held.recovery, /Sync now/i);
});

test('connection state covers the four states and nothing else', () => {
  assert.deepEqual([...CONNECTION_STATES], ['disconnected', 'unverified', 'verified', 'authorization-failed']);

  const cases = [
    [null, 'disconnected'],
    [{}, 'disconnected'],
    [{ connected: false }, 'disconnected'],
    [{ credentialsPresent: true }, 'unverified'],
    [{ connected: true, connectionState: 'unverified' }, 'unverified'],
    [{ connected: true, connectionState: 'verified' }, 'verified'],
    [{ connected: true, connectionState: 'authorization-failed' }, 'authorization-failed'],
  ];
  for (const [info, expected] of cases) {
    assert.equal(resolveConnectionState(info).state, expected, JSON.stringify(info));
  }
  for (const info of cases) {
    assert.ok(CONNECTION_STATES.includes(resolveConnectionState(info[0]).state));
  }
});

test('connection state fails towards caution and never invents verification', () => {
  // An unrecognized or hostile connector answer must not be believed.
  for (const claim of ['VERIFIED', 'connected', 'probably-fine', '', 42, null, {}]) {
    const resolved = resolveConnectionState({ connected: true, connectionState: claim });
    assert.equal(resolved.state, 'unverified', `claim ${JSON.stringify(claim)}`);
  }
  // A connector claiming "disconnected" while a credential is held is a
  // contradiction; caution wins, and the owner is prompted to check.
  assert.equal(resolveConnectionState({ connected: true, connectionState: 'disconnected' }).state, 'unverified');
  // Verification claimed with no credential at all is still disconnected.
  assert.equal(resolveConnectionState({ connected: false, connectionState: 'verified' }).state, 'disconnected');
});

test('a recorded authorization refusal is surfaced, with local data described as untouched', () => {
  const refused = resolveConnectionState({
    connected: true,
    connectionState: 'authorization-failed',
    lastAuthorizationFailureAt: '2026-01-02T03:04:05Z',
  });
  assert.equal(refused.state, 'authorization-failed');
  assert.equal(refused.tone, 'alert');
  assert.equal(refused.lastAuthorizationFailureAt, '2026-01-02T03:04:05Z');
  assert.match(refused.detail, /untouched/i);

  // Local sync diagnostics are also authoritative evidence of refusal.
  const fromLocal = resolveConnectionState({
    connected: true,
    local: { lastErrorCode: 'stored-authorization-invalid' },
  });
  assert.equal(fromLocal.state, 'authorization-failed');

  // A transient failure is not a revocation.
  const transient = resolveConnectionState({
    connected: true,
    local: { lastErrorCode: 'library-sync-failed' },
  });
  assert.equal(transient.state, 'unverified');
});

test('verification evidence is passed through verbatim for display', () => {
  const verified = resolveConnectionState({
    connected: true,
    connectionState: 'verified',
    lastVerifiedAt: '2026-02-03T04:05:06Z',
    lastVerificationBasis: 'library-sync',
  });
  assert.equal(verified.verified, true);
  assert.equal(verified.connected, true);
  assert.equal(verified.lastVerifiedAt, '2026-02-03T04:05:06Z');
  assert.equal(verified.lastVerificationBasis, 'library-sync');
  assert.equal(verified.recovery, null);
});

test('private chrome reports the resolved connection state', () => {
  const verified = resolveBootstrapState({
    privateModeRequested: true,
    connectionApi: {},
    connectionInfo: { connected: true, connectionState: 'verified' },
  });
  assert.match(verified.chrome.status, /Audible verified/);

  const disconnected = resolveBootstrapState({
    privateModeRequested: true,
    connectionApi: {},
    connectionInfo: { connected: false },
  });
  assert.match(disconnected.chrome.status, /Audible disconnected/);
});

test('default bootstrap remains clearly synthetic demo mode', () => {
  const state = resolveBootstrapState({ privateModeRequested: false });
  assert.equal(state.mode, 'synthetic');
  assert.equal(state.failClosed, false);
  assert.match(state.chrome.title, /Synthetic demo/i);
  assert.match(state.chrome.status, /No Audible connection/i);
});

test('private-alpha request detection and retry links preserve private mode', () => {
  assert.equal(isPrivateAlphaRequested('?private-alpha=1'), true);
  assert.equal(isPrivateAlphaRequested('?private-alpha=0'), false);
  assert.equal(retryPrivateAlphaHref('http://127.0.0.1:8787/?private-alpha=1#/data'), '/?private-alpha=1#/library');
});

test('runtime chrome updates the shell copy in place', () => {
  const titleEl = { textContent: '' };
  const headingEl = { textContent: '' };
  const statusEl = { textContent: '' };
  const footerEl = { textContent: '' };
  applyRuntimeChrome({ titleEl, headingEl, statusEl, footerEl }, {
    title: 'A', heading: 'B', status: 'C', footer: 'D',
  });
  assert.equal(titleEl.textContent, 'A');
  assert.equal(headingEl.textContent, 'B');
  assert.equal(statusEl.textContent, 'C');
  assert.equal(footerEl.textContent, 'D');
});

test('a refusal recorded after the last success outranks a stale verified claim', () => {
  const stale = resolveConnectionState({
    connected: true,
    connectionState: 'verified',
    lastVerifiedAt: '2026-09-17T12:00:00.000Z',
    lastAuthorizationFailureAt: '2026-09-18T09:00:00.000Z',
  });
  assert.equal(stale.state, 'authorization-failed', 'a refusal must win over a stale verified claim');
  assert.equal(stale.verified, false);

  // A refusal *older* than the last success is already resolved.
  const recovered = resolveConnectionState({
    connected: true,
    connectionState: 'verified',
    lastVerifiedAt: '2026-09-18T10:00:00.000Z',
    lastAuthorizationFailureAt: '2026-09-18T09:00:00.000Z',
  });
  assert.equal(recovered.state, 'verified');

  // A refusal with no recorded success at all is still a refusal.
  assert.equal(resolveConnectionState({
    connected: true,
    connectionState: 'verified',
    lastAuthorizationFailureAt: '2026-09-18T09:00:00.000Z',
  }).state, 'authorization-failed');
});
