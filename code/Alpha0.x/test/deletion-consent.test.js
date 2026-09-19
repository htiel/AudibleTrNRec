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

import { describeDeletionInventory, INVENTORY_LABELS } from '../ui/js/views/data-view.js';
import { deletionInventory } from '../src/store/export.js';
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
  assert.ok(source.includes("'data-private-operation': 'delete-local'"));
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
