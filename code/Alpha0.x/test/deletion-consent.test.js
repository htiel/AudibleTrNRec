/**
 * Informed-consent tests for aggregate local deletion.
 *
 * Erasing everything is irreversible, so the owner must first be shown what is
 * actually retained and what deletion cannot reach — including copies they
 * have already exported, which leave this application's control entirely.
 *
 * Two properties matter and are asserted here:
 *
 *   1. The consent text is rendered from the closed inventory and states the
 *      limitations honestly. It carries counts and fixed statements only, never
 *      a title, an identifier or a comment.
 *   2. A failure to load the inventory *blocks* the destructive flow. A
 *      confirmation prompt must never be presented over a guess, and no purge
 *      may be attempted when the application cannot say what it holds.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import {
  NEUTRAL_COMPONENTS,
  CONNECTION_REFRESH_METHODS,
  STALE_CONNECTION_NOTICE,
  INVENTORY_PRIVACY_NOTICE,
  INVENTORY_SOURCES,
  IMPORT_BASIS_NOTES,
  SYNC_RECONCILIATION_METHOD,
  UNKNOWN_INVENTORY_VALUE,
  componentClass,
  connectionStateOf,
  describeConnectionState,
  describeDeletionInventory,
  describeImportProvenance,
  describeRetainedArtifacts,
  readPrivateInventory,
  refreshConnectionState,
  staleConnectionAfterUnreachableRefresh,
  summarizePrivateInventory,
  INVENTORY_LABELS,
} from '../ui/js/views/data-view.js';
import { PrivateAppStore } from '../ui/js/private-store.js';
import { CONNECTION_STATES, resolveConnectionState } from '../ui/js/bootstrap-state.js';
import { deletionInventory } from '../src/store/export.js';
import { buildLargeLibrarySnapshot } from '../src/fixtures/large-library.js';
import { ConnectionApi, ConnectionApiError } from '../ui/js/connection-api.js';
import { ROUTE_POLICY } from '../src/security/local-api-auth.js';
import { IMPLEMENTED_API_ROUTES, INVENTORY_ITEM_IDS } from '../scripts/serve.js';

const uiRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'ui');

function populatedInventory() {
  return deletionInventory({
    hasSnapshot: true,
    activeReviews: 4,
    tombstones: 2,
    hasSyncState: true,
    hasAccountAnchor: true,
    hasCredentials: true,
    managedBackups: 1,
  });
}

test('the consent text enumerates what goes and what deletion cannot reach', () => {
  const text = describeDeletionInventory(populatedInventory());

  assert.match(text, /This will permanently erase:/);
  assert.match(text, /Encrypted library snapshot/);
  assert.match(text, /Private ratings and comments \(4\)/);
  assert.match(text, /Retained pre-migration rollback copy/);

  // Provider credentials and the identity seed are NOT erased by this action:
  // only a confirmed Disconnect removes them. Claiming otherwise would
  // overstate the erasure, which is worse than performing none.
  assert.match(text, /does NOT erase your Audible provider credentials or the local identity seed/);
  assert.equal(text.includes('• Audible provider credentials'), false);
  assert.equal(text.includes('• Identity seed'), false);

  // Auto-sync suppression, so an erased library is not silently re-imported.
  assert.match(text, /Automatic background sync is suppressed/);

  // Connector-owned artifacts are stated as unchecked, never as removed.
  assert.match(text, /Not checked by this screen:/);
  assert.match(text, /not reported as removed/);

  // The honest limits, including the copy the owner exported themselves.
  assert.match(text, /What deletion cannot reach:/);
  assert.match(text, /exported is outside this application/);
  assert.match(text, /not cryptographic erasure/);
  assert.match(text, /does not deregister the provider device/);
});

test('the retained-credentials statement is unconditional, not inferred', () => {
  // The service currently reports `hasCredentials: false`. If the copy were
  // driven by that flag it would silently stop warning the owner, and the
  // action would read as a complete erasure that it is not.
  const text = describeDeletionInventory(deletionInventory({ hasSnapshot: true, hasCredentials: false, hasIdentitySeed: false }));
  assert.match(text, /does NOT erase your Audible provider credentials or the local identity seed/);
});

test('the action is labelled as a library and feedback purge, not a total erasure', () => {
  const source = readFileSync(path.join(uiRoot, 'js', 'views', 'data-view.js'), 'utf8');
  const start = source.indexOf("'data-private-operation': 'delete-all'");
  const handler = source.slice(start, source.indexOf('}) }));', start));
  // Credentials and the identity seed survive, so the control must not promise
  // to delete "all local ATnR data".
  assert.equal(/text: 'Delete all local ATnR data'/.test(source), false);
  assert.match(source, /text: 'Delete library and feedback data'/);
  assert.match(handler, /Delete all local library and feedback data\?/);
  // The owner is told the browser session will be invalidated by the purge.
  assert.match(handler, /current session will end and the page will reload/);
});

test('the consent text states an empty store honestly rather than inventing residue', () => {
  const text = describeDeletionInventory(deletionInventory({}));
  assert.match(text, /No local library or feedback data is currently retained\./);
  assert.equal(text.includes('This will permanently erase:'), false);
});

test('every inventory item the API can return has a human-readable label', () => {
  for (const id of INVENTORY_ITEM_IDS) {
    assert.equal(typeof INVENTORY_LABELS[id], 'string', `${id} has no label`);
    assert.notEqual(INVENTORY_LABELS[id], id, `${id} renders its raw identifier`);
  }
});

test('the consent text contains no personal identifier, title or path', () => {
  const text = describeDeletionInventory(populatedInventory());
  assert.equal(/aud-us-|B0[A-Z0-9]{8}|[a-f0-9]{32,}|[A-Za-z]:\\/.test(text), false);
});

test('the inventory route is read strength and has both a policy and a handler', () => {
  const policy = ROUTE_POLICY['GET /api/v1/inventory'];
  assert.ok(policy, 'the inventory route must have a closed policy');
  assert.equal(policy.class, 'read');
  // A live session is required; no nonce is needed because this is what the
  // owner reads in order to consent.
  assert.equal(policy.session, true);
  assert.equal(policy.confirm, null);
  assert.ok(IMPLEMENTED_API_ROUTES.includes('GET /api/v1/inventory'));
});

test('route policy and handler tables remain exactly in parity', () => {
  assert.deepEqual([...Object.keys(ROUTE_POLICY)].sort(), [...IMPLEMENTED_API_ROUTES].sort());
});

test('the delete-all flow loads the inventory before it asks for confirmation', () => {
  const source = readFileSync(path.join(uiRoot, 'js', 'views', 'data-view.js'), 'utf8');
  const start = source.indexOf("'data-private-operation': 'delete-all'");
  assert.notEqual(start, -1, 'expected a delete-all control');
  const handler = source.slice(start, source.indexOf('}) }));', start));

  const inventoryAt = handler.indexOf('deletionInventory()');
  const confirmAt = handler.indexOf('confirmAction(');
  const purgeAt = handler.indexOf('deleteAllLocal()');

  assert.notEqual(inventoryAt, -1, 'the flow must load the deletion inventory');
  assert.ok(inventoryAt < confirmAt, 'the inventory must be loaded before the confirmation prompt');
  assert.ok(confirmAt < purgeAt, 'the purge must follow an explicit confirmation');
  assert.match(handler, /describeDeletionInventory\(inventory\)/);
  // The load is awaited, so a rejection propagates and the flow stops.
  assert.match(handler, /await store\.connectionApi\.deletionInventory\(\)/);

  // The snapshot-only control is preserved and remains distinct.
  assert.ok(source.includes("operation: 'delete-local'"));
  assert.ok(source.includes('deleteLocal()'));
});

test('a failed inventory load blocks the purge instead of guessing', async () => {
  const requests = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options = {}) => {
    requests.push({ url, method: options.method ?? 'GET' });
    return {
      ok: false,
      status: 409,
      headers: { get: () => 'application/json' },
      json: async () => ({ ok: false, error: { code: 'inventory-unavailable' } }),
      text: async () => JSON.stringify({ ok: false, error: { code: 'inventory-unavailable' } }),
    };
  };
  try {
    const api = new ConnectionApi({
      capability: 'capability-token',
      sessionId: 'session-123',
      csrfToken: 'csrf-12345678901234567890123456789012',
      requestCapability: async () => { throw new Error('a capability must not be requested when the inventory failed'); },
    });
    await assert.rejects(
      () => api.deletionInventory(),
      (error) => error instanceof ConnectionApiError && error.code === 'inventory-unavailable',
    );
  } finally {
    globalThis.fetch = originalFetch;
  }

  // The rejection propagates out of the awaited load, so nothing downstream
  // runs: no confirmation nonce is requested and no purge is attempted.
  assert.deepEqual(requests.map(({ url }) => url), ['/api/v1/inventory']);
});

test('loading the inventory needs only the active browser session and no nonce', async () => {
  const requests = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options = {}) => {
    requests.push({ url, method: options.method ?? 'GET', headers: options.headers ?? {}, body: options.body ?? null });
    return {
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      json: async () => ({ ok: true, result: { items: [], limitations: [] } }),
      text: async () => '{}',
    };
  };
  try {
    const api = new ConnectionApi({
      sessionId: 'session-123',
      csrfToken: 'csrf-12345678901234567890123456789012',
    });
    await api.deletionInventory();
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(requests.length, 1);
  const [read] = requests;
  assert.equal(read.method, 'GET');
  assert.equal(read.body, null);
  assert.equal(read.headers.Authorization, undefined);
  assert.equal(read.headers['X-ATnR-Session'], 'session-123');
});

// --- Theme-independent components (Data view migration) ---------------------

test('the Data view renders neutral component roles and no theme class at all', () => {
  const source = readFileSync(path.join(uiRoot, 'js', 'views', 'data-view.js'), 'utf8');
  // Not "no theme class in markup" — no theme class anywhere, including any
  // alias table. A neutral component that borrows a theme name is not neutral.
  assert.doesNotMatch(source, /lcars/i, 'the Data view must not name a theme anywhere');
  assert.doesNotMatch(source, /liquid-glass/i, 'the Data view must not name a theme anywhere');
  assert.equal(source.includes('LEGACY_THEME_ALIASES'), false, 'the legacy alias layer must be gone');
  const code = source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .split('\n')
    .map((line) => line.replace(/(^|[^:])\/\/.*$/, '$1'))
    .join('\n');
  assert.doesNotMatch(code, /class: '(?!\$)/, 'every class attribute must be resolved through componentClass()');
});

test('every component role resolves to neutral classes only', () => {
  for (const role of Object.keys(NEUTRAL_COMPONENTS)) {
    const resolved = componentClass(role);
    assert.equal(resolved, NEUTRAL_COMPONENTS[role]);
    assert.ok(resolved.startsWith('atnr-'), `role ${role} must resolve to a neutral class`);
  }
  const pair = componentClass('button', 'buttonPrimary').split(' ');
  assert.deepEqual(pair, [NEUTRAL_COMPONENTS.button, NEUTRAL_COMPONENTS.buttonPrimary]);
  assert.equal(pair.some((name) => /lcars|liquid-glass/i.test(name)), false);
  assert.equal(new Set(pair).size, pair.length);
  assert.throws(() => componentClass('not-a-role'), /unknown-component-role/);
});

test('every neutral role the Data view can emit is styled by the neutral stylesheet', () => {
  const components = readFileSync(path.join(uiRoot, 'css', 'components.css'), 'utf8');
  for (const className of Object.values(NEUTRAL_COMPONENTS)) {
    assert.match(
      components,
      new RegExp(`\\.${className}\\b`),
      `${className} has no rule in components.css — removing the alias would strip its appearance`,
    );
  }
});

// --- Connection-state contract (consumed, not re-derived) -------------------

test('the Data view consumes the runtime connection-state contract instead of its own rule', () => {
  const source = readFileSync(path.join(uiRoot, 'js', 'views', 'data-view.js'), 'utf8');
  assert.match(source, /import \{ CONNECTION_STATES, resolveConnectionState \} from '\.\.\/bootstrap-state\.js';/);
  // No local connected/disconnected inference survives in this view.
  assert.doesNotMatch(source, /info\.connected \?/);
  assert.doesNotMatch(source, /info\.connected ===/);
});

test('a state already resolved by the store is reused unchanged', () => {
  const resolved = resolveConnectionState({ credentialsPresent: true, connectionState: 'verified' });
  assert.equal(connectionStateOf({ connectionState: resolved }), resolved);
  assert.equal(resolved.verified, true);
});

test('an unresolved, malformed or absent state is re-resolved through the contract, never trusted', () => {
  for (const held of [undefined, null, 'verified', { state: 'invented' }, { state: 42 }, {}]) {
    const resolved = connectionStateOf({ connectionState: held, connectionInfo: null });
    assert.ok(CONNECTION_STATES.includes(resolved.state), `unexpected state ${resolved.state}`);
    assert.equal(resolved.connected, false, 'an unresolved state is never reported as connected');
  }
});

test('stored credentials alone are disclosed as unverified, not as a connection (issue #8)', () => {
  const credentialsOnly = connectionStateOf({ connectionInfo: { credentialsPresent: true } });
  assert.equal(credentialsOnly.state, 'unverified');
  assert.equal(credentialsOnly.connected, false);
  assert.equal(credentialsOnly.credentialsPresent, true);

  const text = describeConnectionState(credentialsOnly);
  assert.match(text, /unverified/i);
  // The recovery the contract supplies is shown, so the owner can confirm it.
  assert.match(text, /Sync now/i);

  // ...and the controls that perform that confirmation are still offered.
  const source = readFileSync(path.join(uiRoot, 'js', 'views', 'data-view.js'), 'utf8');
  assert.match(source, /if \(!connection\.credentialsPresent\) \{/);
});

test('a verified connection states its evidence, and a failure states the recovery', () => {
  const verified = connectionStateOf({
    connectionInfo: { credentialsPresent: true, connectionState: 'verified', lastVerifiedAt: '2026-09-19T12:00:00.000Z' },
  });
  assert.equal(verified.connected, true);
  assert.match(describeConnectionState(verified), /Last confirmed by a provider interaction/);

  const failed = connectionStateOf({ connectionInfo: { credentialsPresent: true, connectionState: 'authorization-failed' } });
  assert.equal(failed.connected, false);
  assert.match(describeConnectionState(failed), /Reconnect Audible/i);
});

test('every state in the closed vocabulary is disclosed honestly and exactly once', () => {
  const cases = {
    disconnected: { credentialsPresent: false },
    unverified: { credentialsPresent: true },
    verified: { credentialsPresent: true, connectionState: 'verified' },
    'authorization-failed': { credentialsPresent: true, connectionState: 'authorization-failed' },
  };
  assert.deepEqual(Object.keys(cases).sort(), [...CONNECTION_STATES].sort(), 'a new state needs disclosure here');

  for (const [state, connectionInfo] of Object.entries(cases)) {
    const connection = connectionStateOf({ connectionInfo });
    assert.equal(connection.state, state);
    // Only `verified` may claim a connection. Everything else is custody at best.
    assert.equal(connection.connected, state === 'verified', `${state} misreports connected`);
    assert.equal(connection.verified, state === 'verified', `${state} misreports verified`);
    assert.equal(connection.credentialsPresent, state !== 'disconnected');

    const text = describeConnectionState(connection);
    assert.ok(text.startsWith('ATnR connection: '), `${state} must disclose a connection line`);
    assert.ok(text.includes(connection.detail), `${state} must show the contract's detail verbatim`);
    if (state !== 'verified') {
      assert.ok(connection.recovery, `${state} must offer recovery guidance`);
      assert.ok(text.includes(connection.recovery), `${state} must show its recovery guidance`);
      assert.doesNotMatch(text, /Last confirmed by a provider interaction/, `${state} must not imply verification`);
    }
  }
});

test('an unverified or failed state never renders the vocabulary of a working connection', () => {
  for (const connectionInfo of [
    { credentialsPresent: true },
    { credentialsPresent: true, connectionState: 'authorization-failed' },
    { credentialsPresent: true, local: { lastErrorCode: 'stored-authorization-invalid' } },
  ]) {
    const text = describeConnectionState(connectionStateOf({ connectionInfo }));
    assert.doesNotMatch(text, /\bverified\b/i, 'holding a credential is not verification');
    assert.doesNotMatch(text, /\bconnected\b/i, 'holding a credential is not a connection');
  }
});

test('a stale authorization reported only through local diagnostics still shows recovery', () => {
  const failed = connectionStateOf({
    connectionInfo: { credentialsPresent: true, local: { lastErrorCode: 'account-mismatch-local-data-quarantined' } },
  });
  assert.equal(failed.state, 'authorization-failed');
  assert.equal(failed.connected, false);
  assert.match(describeConnectionState(failed), /Reconnect Audible/i);
});

test('control gating and headings follow credential custody, never a claimed connection', () => {
  const source = readFileSync(path.join(uiRoot, 'js', 'views', 'data-view.js'), 'utf8');
  assert.match(source, /connection\.credentialsPresent \? 'Connection controls' : 'Connect this private alpha'/);
  // `connected`/`verified` must never be the gate: an unverified credential
  // still needs the controls that let the owner confirm or replace it.
  assert.doesNotMatch(source, /if \(!connection\.connected\)/);
  assert.doesNotMatch(source, /if \(!connection\.verified\)/);
});

// --- Authorization-state refresh after a failed sync ------------------------
//
// The regression: a verified connection whose authorization is then refused by
// the provider left the previous "Audible verified" claim on screen, because
// the view resolved the state once at render time and a failed sync only
// printed an error. A refusal must re-resolve and repaint. A *timeout* must
// not be dressed up as a refusal.
//
// These tests drive Data's **real** `PrivateAppStore`, through its published
// `noteSyncFailure()` / `refreshConnectionState()` API, over a stubbed
// transport. No Data file is modified and no Data behaviour is re-implemented.

const VERIFIED_INFO = Object.freeze({
  connected: true,
  credentialsPresent: true,
  connectionState: 'verified',
  lastVerifiedAt: '2026-09-19T12:00:00.000Z',
  local: Object.freeze({ hasLocalSnapshot: true, lastSuccessAt: '2026-09-19T12:00:00.000Z' }),
});

const REVOKED_INFO = Object.freeze({
  connected: false,
  credentialsPresent: true,
  connectionState: 'authorization-failed',
  lastAuthorizationFailureAt: '2026-09-19T12:05:00.000Z',
  local: Object.freeze({ hasLocalSnapshot: true, lastErrorCode: 'stored-authorization-invalid' }),
});

/** A verified private store whose next `status()` answers however we say. */
function verifiedStore(statusHandler) {
  const calls = { status: 0, sync: 0 };
  const store = new PrivateAppStore({
    connectionInfo: VERIFIED_INFO,
    connectionApi: {
      status: async () => { calls.status += 1; return statusHandler(calls.status); },
      sync: async () => { calls.sync += 1; throw new ConnectionApiError('library-sync-failed'); },
    },
  });
  return { store, calls };
}

test('a provider refusal after a verified sync re-resolves to authorization-failed with recovery', async () => {
  const { store, calls } = verifiedStore(() => REVOKED_INFO);

  // Before: the screen may honestly claim verification.
  assert.equal(connectionStateOf(store).state, 'verified');
  assert.equal(store.connectionState.verified, true);

  // The provider refuses the stored authorization during a requested sync.
  await assert.rejects(() => store.connectionApi.sync(), (error) => error.code === 'library-sync-failed');

  const next = await refreshConnectionState(store, new ConnectionApiError('library-sync-failed'));
  assert.equal(next.via, 'noteSyncFailure', "Data's failure-aware path is the one consumed");
  assert.equal(calls.status, 1, 'the refresh is an evidence read through the store, not a new probe');
  assert.equal(next.fresh, true);
  assert.equal(next.connection.state, 'authorization-failed');
  assert.equal(next.connection.verified, false);
  assert.equal(next.connection.connected, false);
  assert.equal(next.connection.credentialsPresent, true, 'the credential is still held; only its standing changed');
  // Data recorded the failing code for its own diagnostics.
  assert.equal(store.lastSyncErrorCode, 'library-sync-failed');

  const text = describeConnectionState(next.connection);
  assert.doesNotMatch(text, /\bverified\b/i, 'the stale verified claim must be gone');
  assert.match(text, /refused the stored authorization/i);
  assert.match(text, /Reconnect Audible/i, 'a refusal must state its recovery');
  assert.match(text, /local library snapshot and private feedback are untouched/i);
});

test('the refreshed state is the renderable contract object, not Data\'s report envelope', async () => {
  const { store } = verifiedStore(() => REVOKED_INFO);
  const report = await store.noteSyncFailure(new ConnectionApiError('library-sync-failed'));
  // Data's report carries a bare state string and no presentation fields...
  assert.equal(report.state, 'authorization-failed');
  assert.equal(report.refreshed, true);
  assert.equal(report.label, undefined);

  // ...so the view must read the resolved object the store applied to itself.
  const next = await refreshConnectionState(verifiedStore(() => REVOKED_INFO).store, null);
  for (const field of ['state', 'label', 'detail', 'recovery', 'verified', 'connected', 'credentialsPresent']) {
    assert.notEqual(next.connection[field], undefined, `${field} must be present for rendering`);
  }
  assert.doesNotMatch(describeConnectionState(next.connection), /undefined/);
});

test('a timeout or offline runtime is reported as unverified and stale, never as a revocation', async () => {
  for (const failure of [
    new ConnectionApiError('local-api-unreachable'),
    new ConnectionApiError('local-api-timeout'),
    new TypeError('Failed to fetch'),
  ]) {
    const { store } = verifiedStore(() => { throw failure; });
    const next = await refreshConnectionState(store, new ConnectionApiError('library-sync-failed'));

    assert.equal(next.fresh, false, 'an unreachable runtime is not a fresh answer');
    assert.equal(next.connection.state, 'unverified', 'custody remains, verification does not');
    assert.notEqual(next.connection.state, 'authorization-failed', 'a network failure is not a revocation');
    assert.equal(next.connection.credentialsPresent, true, 'the stored authorization is still held');
    assert.equal(next.connection.verified, false);

    const text = describeConnectionState(next.connection);
    assert.doesNotMatch(text, /refused/i, 'nothing was refused by the provider');
    assert.doesNotMatch(text, /Reconnect Audible/i, 'the owner is not told to reconnect over a network error');
    assert.match(text, /Sync now/i, 'the owner is told how to confirm');
    assert.match(STALE_CONNECTION_NOTICE, /Nothing was revoked/i);
    assert.match(STALE_CONNECTION_NOTICE, /out of date/i);

    // Data's own record is left intact; only the screen stops claiming proof.
    assert.equal(store.connectionState.state, 'verified');
  }
});

test('Data\'s plain refresh path is used when no failure-aware path exists', async () => {
  const calls = { refresh: 0 };
  const store = {
    connectionInfo: VERIFIED_INFO,
    connectionState: resolveConnectionState(VERIFIED_INFO),
    refreshConnectionState: async function refresh() {
      calls.refresh += 1;
      this.connectionInfo = REVOKED_INFO;
      this.connectionState = resolveConnectionState(REVOKED_INFO);
      return Object.freeze({ ok: true, state: this.connectionState.state, code: null });
    },
  };
  const next = await refreshConnectionState(store, null);
  assert.equal(next.via, 'refreshConnectionState');
  assert.equal(calls.refresh, 1);
  assert.equal(next.connection.state, 'authorization-failed');
  assert.match(describeConnectionState(next.connection), /Reconnect Audible/i);

  // `ok: false` is a stale answer, never an upgrade and never a revocation.
  const unreachable = {
    connectionInfo: VERIFIED_INFO,
    connectionState: resolveConnectionState(VERIFIED_INFO),
    refreshConnectionState: async () => Object.freeze({ ok: false, state: 'verified', code: 'local-api-unreachable' }),
  };
  const stale = await refreshConnectionState(unreachable, null);
  assert.equal(stale.fresh, false);
  assert.equal(stale.connection.state, 'unverified');
});

test('without any store refresh path the read-only status route is used and nothing is mutated', async () => {
  const calls = { status: 0 };
  const store = {
    connectionInfo: VERIFIED_INFO,
    connectionState: resolveConnectionState(VERIFIED_INFO),
    connectionApi: { status: async () => { calls.status += 1; return REVOKED_INFO; } },
  };
  const next = await refreshConnectionState(store, null);
  assert.equal(next.via, 'connectionApi.status');
  assert.equal(calls.status, 1);
  assert.equal(next.connection.state, 'authorization-failed');
  assert.equal(next.fresh, true);
  // This fallback reports; it does not write back into a store it does not own.
  assert.equal(store.connectionInfo.connectionState, 'verified');
  assert.equal(store.connectionState.state, 'verified');
});

test('a refusal recorded only in local diagnostics also clears the verified claim', async () => {
  const { store } = verifiedStore(() => ({
    credentialsPresent: true,
    local: { hasLocalSnapshot: true, lastErrorCode: 'stored-authorization-invalid' },
  }));
  const next = await refreshConnectionState(store, new ConnectionApiError('library-sync-failed'));
  assert.equal(next.fresh, true);
  assert.equal(next.connection.state, 'authorization-failed');
  assert.match(describeConnectionState(next.connection), /Reconnect Audible/i);
});

test('the stale downgrade drops verification evidence without inventing a state', () => {
  const stale = staleConnectionAfterUnreachableRefresh(VERIFIED_INFO);
  assert.equal(stale.state, 'unverified');
  assert.equal(stale.verified, false);
  assert.ok(CONNECTION_STATES.includes(stale.state), 'the state stays inside the contract vocabulary');
  // A disconnected device stays disconnected; custody is not invented either.
  assert.equal(staleConnectionAfterUnreachableRefresh({}).state, 'disconnected');
  assert.equal(staleConnectionAfterUnreachableRefresh(null).state, 'disconnected');
  // An authorization failure the runtime already recorded is preserved.
  assert.equal(
    staleConnectionAfterUnreachableRefresh({ credentialsPresent: true, local: { lastErrorCode: 'authorization-failed' } }).state,
    'authorization-failed',
  );
});

test('the view repaints the connection panel on sync failure and still reports the error', () => {
  const source = readFileSync(path.join(uiRoot, 'js', 'views', 'data-view.js'), 'utf8');
  const sync = source.slice(source.indexOf('const performSync ='), source.indexOf('const syncOnClick'));
  assert.match(sync, /catch \(error\)/);
  assert.match(sync, /await refreshConnectionState\(store, error\)/);
  assert.match(sync, /paintConnection\(next, \{ fresh: next\.fresh \}\)/);
  // Explicit error reporting is preserved: the failure is rethrown to `run()`,
  // which renders it as an alert. A refresh must never swallow the error.
  assert.match(sync, /throw error;/);
  assert.ok(sync.indexOf('refreshConnectionState') < sync.indexOf('throw error'), 'refresh happens before the error surfaces');
  // Success still reloads; a failure never reloads away from the message.
  assert.ok(sync.indexOf('throw error') < sync.indexOf('window.location.reload()'));

  // The panel repaints in place rather than leaving the prior claim behind.
  assert.match(source, /id: 'connection-status-items'/);
  assert.match(source, /clear\(connectionList\)/);
  assert.match(source, /id: 'connection-recovery'/);
  assert.match(source, /id: 'connection-stale-notice'/);
  // The view never assigns a connection state itself.
  assert.doesNotMatch(source, /state: 'authorization-failed'/);
  assert.doesNotMatch(source, /= 'authorization-failed'/);
});

test('the Data view consumes Data\'s published refresh contract, not a private copy', () => {
  const store = new PrivateAppStore({ connectionInfo: VERIFIED_INFO, connectionApi: { status: async () => VERIFIED_INFO } });
  for (const method of Object.values(CONNECTION_REFRESH_METHODS)) {
    assert.equal(typeof store[method], 'function', `Data must still publish ${method}()`);
  }
  assert.equal(CONNECTION_REFRESH_METHODS.afterFailure, 'noteSyncFailure');
  assert.equal(CONNECTION_REFRESH_METHODS.refresh, 'refreshConnectionState');
});

test('recovery guidance is surfaced as an alert whenever the connection is not verified', () => {
  const source = readFileSync(path.join(uiRoot, 'js', 'views', 'data-view.js'), 'utf8');
  const paint = source.slice(source.indexOf('const paintConnection ='), source.indexOf('const status = h('));
  assert.match(paint, /next\.connection\.recovery/);
  assert.match(paint, /!next\.connection\.verified/);
  assert.match(paint, /setAttribute\('role', 'alert'\)/);
  assert.match(paint, /connectionStaleNotice\.hidden = fresh/);
});


// --- Non-destructive inventory (B7) -----------------------------------------

const ROW = (rows, id) => rows.find((row) => row.id === id);

const IMPORT_ROW_IDS = Object.freeze([
  'inventory-import-added',
  'inventory-import-updated',
  'inventory-import-reappeared',
  'inventory-import-missing',
  'inventory-import-unchanged',
  'inventory-import-rejected',
]);

/** Data's published `loadInventory()` shape, fully populated. */
function reportedInventory(overrides = {}) {
  return {
    titles: { known: true, count: 137, libraryEntryCount: 140, observedAt: '2026-09-20T10:00:00Z', basis: 'loaded-snapshot', reason: null },
    feedback: { known: true, count: 4, basis: 'feedback-store-read', reason: null },
    lastImport: {
      known: true,
      basis: 'sync-reconciliation',
      authority: 'requested-sync',
      observedAt: '2026-09-20T10:00:00Z',
      reason: null,
      counts: { added: 3, updated: 2, reappeared: 1, missingFromSource: 1, unchanged: null, rejected: null },
    },
    ...overrides,
  };
}

/** A store that has parsed a retained snapshot, as at startup. */
function loadedStore(snapshotEntries = 2) {
  return new PrivateAppStore({
    liveSnapshot: buildLargeLibrarySnapshot(snapshotEntries),
    connectionInfo: { connected: true, credentialsPresent: true, local: { hasLocalSnapshot: true, itemCount: snapshotEntries } },
    connectionApi: { feedbackList: async () => [] },
  });
}

test('the inventory consumes Data\'s published loadInventory contract', async () => {
  const store = new PrivateAppStore({ connectionInfo: { connected: false }, connectionApi: null });
  assert.equal(INVENTORY_SOURCES.store, 'loadInventory');
  assert.equal(SYNC_RECONCILIATION_METHOD, 'noteSyncReconciliation');
  assert.equal(typeof store[INVENTORY_SOURCES.store], 'function', 'Data must still publish loadInventory()');
  assert.equal(typeof store[SYNC_RECONCILIATION_METHOD], 'function', 'Data must still publish noteSyncReconciliation()');

  const published = await store.loadInventory();
  for (const section of ['titles', 'feedback', 'lastImport']) {
    assert.equal(typeof published[section], 'object', `loadInventory() must report a ${section} section`);
    assert.equal(typeof published[section].known, 'boolean', `${section}.known must remain the authority`);
  }
  // The exact nested field names this view reads.
  assert.ok(Object.hasOwn(published.titles, 'count'));
  assert.ok(Object.hasOwn(published.titles, 'libraryEntryCount'));
  assert.ok(Object.hasOwn(published.feedback, 'count'));
  for (const field of ['basis', 'authority', 'observedAt', 'counts', 'reason']) {
    assert.ok(Object.hasOwn(published.lastImport, field), `lastImport must keep the ${field} field`);
  }
});

test('at startup a parsed snapshot leaves every import count unknown', async () => {
  const store = loadedStore(2);
  const published = await store.loadInventory();

  // Data's declared startup state, verbatim.
  assert.equal(published.lastImport.basis, 'snapshot-load');
  assert.equal(published.lastImport.authority, 'local-snapshot-parse');
  assert.equal(published.lastImport.known, false);
  assert.equal(published.lastImport.counts, null);
  assert.equal(published.lastImport.reason, 'snapshot-parse-only');

  const rows = summarizePrivateInventory({ reported: published });
  // The titles it genuinely read are shown...
  assert.equal(ROW(rows, 'inventory-titles').value, '2');
  // ...and not one import number is claimed.
  for (const id of IMPORT_ROW_IDS) {
    assert.equal(ROW(rows, id).known, false, `${id} must not be claimed from a snapshot parse`);
    assert.notEqual(ROW(rows, id).value, '0');
    assert.match(ROW(rows, id).value, /snapshot-parse-only/);
  }

  // The basis copy says plainly why, and never implies a provider import.
  const basis = describeImportProvenance(published.lastImport);
  assert.match(basis, /No synchronization has run in this session/);
  assert.match(basis, /measures nothing about what Audible changed/);
  assert.match(basis, /not by contacting Audible/);
});

test('a completed in-session sync renders the measured counts it actually measured', async () => {
  const store = loadedStore(2);
  // The unchanged sync result, exactly as `connectionApi.sync()` returns it.
  const syncResult = {
    ok: true,
    itemCount: 5,
    observedAt: '2026-09-21T09:00:00Z',
    snapshotGeneration: 4,
    reconciliation: { added: 3, updated: 2, reappeared: 1, missingFromSource: 0 },
  };
  const noted = store.noteSyncReconciliation(syncResult);
  assert.deepEqual({ ...noted }, { ok: true, code: null });

  const rows = summarizePrivateInventory({ reported: await store.loadInventory() });
  assert.equal(ROW(rows, 'inventory-import-added').value, '3');
  assert.equal(ROW(rows, 'inventory-import-updated').value, '2');
  assert.equal(ROW(rows, 'inventory-import-reappeared').value, '1');
  assert.equal(ROW(rows, 'inventory-import-missing').value, '0');

  // Sync does not measure these two, so they are unknown — never zero.
  for (const id of ['inventory-import-unchanged', 'inventory-import-rejected']) {
    assert.equal(ROW(rows, id).known, false, `${id} is not measured by a sync and must not be printed`);
    assert.notEqual(ROW(rows, id).value, '0');
    assert.match(ROW(rows, id).value, /^Unknown/);
  }

  const published = await store.loadInventory();
  assert.equal(published.lastImport.basis, 'sync-reconciliation');
  assert.equal(published.lastImport.authority, 'requested-sync');
  const basis = describeImportProvenance(published.lastImport);
  assert.match(basis, /compare what Audible returned against the snapshot stored before it/);
  assert.match(basis, /Buckets a synchronization does not measure are shown as unknown/);
  assert.match(basis, /Measured by the synchronization you requested/);
  assert.match(basis, /Observed at 2026-09-21T09:00:00Z/);
});

test('a sync result without a reconciliation is refused and nothing is fabricated', async () => {
  const store = loadedStore(2);
  const refused = store.noteSyncReconciliation({ ok: true, itemCount: 5 });
  assert.equal(refused.ok, false);
  assert.equal(refused.code, 'sync-reconciliation-missing');

  const rows = summarizePrivateInventory({ reported: await store.loadInventory() });
  for (const id of IMPORT_ROW_IDS) {
    assert.equal(ROW(rows, id).known, false, `${id} must stay unknown after a refused reconciliation`);
  }

  // The view reports the refusal and still completes the sync normally.
  const source = readFileSync(path.join(uiRoot, 'js', 'views', 'data-view.js'), 'utf8');
  const sync = source.slice(source.indexOf('const performSync ='), source.indexOf('const syncOnClick'));
  assert.match(sync, /store\[SYNC_RECONCILIATION_METHOD\]\(result\)/);
  assert.match(sync, /reported no reconciliation/);
  assert.match(sync, /stay unknown/);
  // Stated on the page, not announced into a live region and lost.
  assert.match(sync, /operationStatus\.textContent = message/);
  // Passed through unchanged: the view never edits or supplements the result.
  assert.doesNotMatch(sync, /reconciliation:\s*\{/);
  // The recording happens after a successful sync and before the reload.
  assert.ok(sync.indexOf('SYNC_RECONCILIATION_METHOD') < sync.indexOf('window.location.reload()'));
  assert.ok(sync.indexOf('refreshInventory()') < sync.indexOf('window.location.reload()'));
  // A failed sync still reports its error and records no import.
  assert.ok(sync.indexOf('throw error') < sync.indexOf('SYNC_RECONCILIATION_METHOD'));
});

test('the import basis is declared by the runtime, never inferred from the numbers', () => {
  const source = readFileSync(path.join(uiRoot, 'js', 'views', 'data-view.js'), 'utf8');
  assert.doesNotMatch(source, /describeImportBasis/, 'the numerical heuristic must be gone');
  assert.match(source, /describeImportProvenance/);

  // A parse and a real import produce the same numbers; only the basis differs,
  // and only the basis may decide what the screen says.
  const counts = { added: 12, updated: 0, reappeared: 0, missingFromSource: 0, unchanged: null, rejected: null };
  const measured = describeImportProvenance({ known: true, basis: 'sync-reconciliation', authority: 'requested-sync', counts, observedAt: null });
  const parsed = describeImportProvenance({ known: false, basis: 'snapshot-load', authority: 'local-snapshot-parse', counts: null, observedAt: null });
  assert.notEqual(measured, parsed);
  assert.match(measured, /Measured by the synchronization you requested/);
  assert.match(parsed, /No synchronization has run in this session/);

  assert.match(describeImportProvenance({ basis: 'none', authority: null }), /nothing to report/);
  assert.equal(describeImportProvenance(null), '');
});

test('an unrecognised basis fails closed instead of being described', () => {
  const text = describeImportProvenance({ known: true, basis: 'provider-told-us-so', authority: 'requested-sync', counts: { added: 9 } });
  assert.match(text, /does not recognise/);
  assert.match(text, /treated as unknown/);
  assert.equal(Object.hasOwn(IMPORT_BASIS_NOTES, 'provider-told-us-so'), false);

  // And the counts under it are not rendered, whatever `known` claimed.
  const rows = summarizePrivateInventory({
    reported: reportedInventory({
      lastImport: { known: true, basis: 'provider-told-us-so', authority: 'requested-sync', observedAt: null, reason: null, counts: { added: 9, updated: 9, reappeared: 9, missingFromSource: 9, unchanged: 9, rejected: 9 } },
    }),
  });
  for (const id of IMPORT_ROW_IDS) {
    assert.equal(ROW(rows, id).known, false, `${id} must not be rendered from an unrecognised basis`);
  }
});

test('the nested contract is mapped field by field, with no bucket folded', () => {
  const rows = summarizePrivateInventory({ reported: reportedInventory() });

  assert.equal(ROW(rows, 'inventory-titles').value, '137');
  assert.equal(ROW(rows, 'inventory-library-entries').value, '140');
  assert.equal(ROW(rows, 'inventory-feedback-records').value, '4');
  assert.equal(ROW(rows, 'inventory-import-added').value, '3');
  assert.equal(ROW(rows, 'inventory-import-updated').value, '2');
  assert.equal(ROW(rows, 'inventory-import-reappeared').value, '1');
  assert.equal(ROW(rows, 'inventory-import-missing').value, '1');

  // Each bucket keeps its own label and its own number. A title that came back
  // and a title the source stopped offering were neither changed nor refused.
  assert.match(ROW(rows, 'inventory-import-reappeared').label, /returned to the library/);
  assert.match(ROW(rows, 'inventory-import-missing').label, /no longer offered by the source/);
  assert.equal(ROW(rows, 'inventory-import-updated').value, '2', 'no bucket may inflate updated');
  assert.equal(ROW(rows, 'inventory-import-rejected').known, false, 'an unmeasured bucket stays unknown');
});

test('`known` is the authority, not the presence of a number', () => {
  const rows = summarizePrivateInventory({
    reported: reportedInventory({
      titles: { known: false, count: 99, libraryEntryCount: 99, observedAt: null, basis: 'none', reason: 'no-snapshot-read' },
      feedback: { known: false, count: 12, basis: 'none', reason: 'feedback-not-loaded' },
    }),
  });
  assert.equal(ROW(rows, 'inventory-titles').known, false);
  assert.equal(ROW(rows, 'inventory-titles').value.includes('99'), false);
  assert.equal(ROW(rows, 'inventory-feedback-records').value.includes('12'), false);
  assert.match(ROW(rows, 'inventory-titles').value, /no-snapshot-read/);
  assert.match(ROW(rows, 'inventory-feedback-records').value, /feedback-not-loaded/);

  // A section that claims `known` but carries no usable number is still
  // unknown: "null" must never reach the screen as a count.
  const drifted = summarizePrivateInventory({
    reported: reportedInventory({ feedback: { known: true, count: null, basis: 'feedback-store-read', reason: null } }),
  });
  assert.equal(ROW(drifted, 'inventory-feedback-records').known, false);
  assert.equal(ROW(drifted, 'inventory-feedback-records').value, UNKNOWN_INVENTORY_VALUE);
});

test('an unevidenced count is rendered as an explicit Unknown and never as zero', () => {
  const rows = summarizePrivateInventory({ inventory: null, local: {} });
  for (const row of rows) {
    assert.equal(row.known, false, `${row.id} must not claim a count without evidence`);
    assert.equal(row.value, UNKNOWN_INVENTORY_VALUE);
    assert.notEqual(row.value, '0');
  }
  assert.deepEqual(rows.map((row) => row.id), [
    'inventory-titles',
    'inventory-library-entries',
    'inventory-feedback-records',
    'inventory-feedback-tombstones',
    ...IMPORT_ROW_IDS,
  ]);
});

test('the deletion-inventory fallback still serves a store without the contract', async () => {
  const requests = [];
  const legacyStore = {
    connectionApi: { deletionInventory: async () => { requests.push('inventory'); return populatedInventory(); } },
  };
  const result = await readPrivateInventory(legacyStore);
  assert.equal(result.via, INVENTORY_SOURCES.api);
  assert.equal(result.error, null);
  assert.deepEqual(requests, ['inventory']);

  const rows = summarizePrivateInventory({ inventory: result.inventory, local: { hasLocalSnapshot: true, itemCount: 137 } });
  assert.equal(ROW(rows, 'inventory-titles').value, '137');
  assert.equal(ROW(rows, 'inventory-feedback-records').value, '4');
  assert.equal(ROW(rows, 'inventory-feedback-tombstones').value, '2');
});

test('the store contract wins and the fallback route is not also called', async () => {
  const calls = [];
  const store = {
    loadInventory: async () => { calls.push('store'); return reportedInventory(); },
    connectionApi: { deletionInventory: async () => { calls.push('api'); return populatedInventory(); } },
  };
  const result = await readPrivateInventory(store);
  assert.equal(result.via, INVENTORY_SOURCES.store);
  assert.equal(result.inventory, null);
  assert.deepEqual(calls, ['store'], 'the HTTP route must not be called when the store answers');

  const rows = summarizePrivateInventory({ inventory: result.inventory, local: {}, reported: result.reported });
  assert.equal(ROW(rows, 'inventory-feedback-tombstones').value, UNKNOWN_INVENTORY_VALUE);
});

test('evidenced absence is a genuine zero, but an unobservable artifact is not', () => {
  const empty = summarizePrivateInventory({
    inventory: deletionInventory({ hasSnapshot: false, activeReviews: 0, tombstones: 0 }),
    local: { hasLocalSnapshot: false, itemCount: 0 },
  });
  assert.equal(ROW(empty, 'inventory-titles').value, '0');
  assert.equal(ROW(empty, 'inventory-feedback-records').value, '0');

  const unknown = summarizePrivateInventory({
    inventory: { items: [{ id: 'private-reviews', owner: 'local', retained: 'unknown', count: null }] },
    local: {},
  });
  assert.equal(ROW(unknown, 'inventory-feedback-records').value, UNKNOWN_INVENTORY_VALUE);
});

test('reading the inventory performs no destructive call and spends no nonce', async () => {
  const called = [];
  const trap = (name) => async () => { called.push(name); throw new Error(`${name} must never run for a read-only inventory`); };
  const store = {
    loadInventory: async () => reportedInventory(),
    connectionApi: {
      deletionInventory: async () => populatedInventory(),
      requestCapability: trap('requestCapability'),
      deleteAllLocal: trap('deleteAllLocal'),
      deleteLocal: trap('deleteLocal'),
      disconnect: trap('disconnect'),
      exportAll: trap('exportAll'),
      sync: trap('sync'),
    },
  };
  await readPrivateInventory(store);
  assert.deepEqual(called, []);

  assert.ok(IMPLEMENTED_API_ROUTES.includes('GET /api/v1/inventory'));

  const source = readFileSync(path.join(uiRoot, 'js', 'views', 'data-view.js'), 'utf8');
  const reader = source.slice(source.indexOf('export async function readPrivateInventory'), source.indexOf('function sectionCount'));
  assert.doesNotMatch(reader, /confirmAction|consentConfirmed|delete|requestCapability/i);
});

test('an unreadable inventory reports the failure and claims nothing', async () => {
  const store = { loadInventory: async () => { throw Object.assign(new Error('nope'), { code: 'inventory-unavailable' }); } };
  const result = await readPrivateInventory(store);
  assert.equal(result.error, 'inventory-unavailable');
  assert.equal(result.reported, null);
  for (const row of summarizePrivateInventory({ inventory: result.inventory, local: {}, reported: result.reported })) {
    assert.equal(row.value, UNKNOWN_INVENTORY_VALUE);
  }

  const garbage = await readPrivateInventory({ loadInventory: async () => null });
  assert.equal(garbage.error, 'inventory-unavailable');

  const bare = await readPrivateInventory({});
  assert.equal(bare.via, null);
  assert.equal(bare.error, 'inventory-unavailable');

  const source = readFileSync(path.join(uiRoot, 'js', 'views', 'data-view.js'), 'utf8');
  const paint = source.slice(source.indexOf('const paintInventory ='), source.indexOf('const refreshInventory ='));
  assert.match(paint, /The local inventory could not be read/);
  assert.match(paint, /setAttribute\('role', 'alert'\)/);
  assert.doesNotMatch(paint, /removed|erased|deleted/i);
});

test('the inventory reuses the deletion labels and the connector tri-state', () => {
  const text = describeRetainedArtifacts(populatedInventory());
  assert.match(text, /Also retained on this device:/);
  assert.match(text, /Local ownership record/);
  assert.match(text, /Retained pre-migration rollback copy/);
  assert.equal(text.includes(INVENTORY_LABELS['private-reviews']), false);
  assert.equal(text.includes(INVENTORY_LABELS['encrypted-snapshot']), false);

  const unknown = describeRetainedArtifacts(deletionInventory({ hasSnapshot: true }));
  assert.match(unknown, /not observable from this screen/);
  assert.match(unknown, /not reported as removed/);
  assert.equal(describeRetainedArtifacts(null), '');
});

test('the inventory panel states its privacy limits and shows no private content', () => {
  const source = readFileSync(path.join(uiRoot, 'js', 'views', 'data-view.js'), 'utf8');
  assert.match(INVENTORY_PRIVACY_NOTICE, /Counts only/);
  assert.match(INVENTORY_PRIVACY_NOTICE, /No book title, identifier, rating, comment or tag text/);
  assert.match(INVENTORY_PRIVACY_NOTICE, /no destructive action/);
  assert.match(INVENTORY_PRIVACY_NOTICE, /spends no confirmation code/);
  assert.match(INVENTORY_PRIVACY_NOTICE, /no Audible or Amazon request/);

  const panel = source.slice(source.indexOf('const inventoryList = h('), source.indexOf('const paintInventory ='));
  assert.match(panel, /componentClass\('panel'\)/);
  assert.match(panel, /componentClass\('metaList'\)/);
  assert.match(panel, /id: 'private-inventory'/);
  assert.doesNotMatch(panel, /lcars|liquid-glass/i);

  const paint = source.slice(source.indexOf('const paintInventory ='), source.indexOf('const refreshInventory ='));
  assert.match(paint, /summarizePrivateInventory\(/);
  assert.match(paint, /describeImportProvenance\(result\.reported\?\.lastImport/);
  assert.doesNotMatch(paint, /libraryRows|feedbackByBookId|catalog|bookDetail/);
});
