/**
 * Lifecycle binding-invalidation tests.
 *
 * `LocalApiAuth` has always carried an `accountGeneration` on every session and
 * every confirmation nonce, and `invalidateBindings()` to advance it — but
 * nothing ever called it. A nonce issued before a connect, a disconnect or a
 * complete erasure therefore survived that transition and remained spendable
 * against a world that no longer existed.
 *
 * The semantics asserted here are deliberately asymmetric:
 *
 *   - connect / disconnect / delete-all change *whose* data this is, or remove
 *     the state every authorization was granted against. They drop sessions
 *     and nonces: the owner re-unlocks.
 *   - snapshot deletion and review deletion change protected state without
 *     changing account identity. They drop outstanding nonces only. Logging the
 *     owner out for erasing their own snapshot would be disproportionate.
 *   - a routine scheduled sync drops nothing. It cannot change account
 *     identity — the service refuses a mismatch rather than importing it — and
 *     a capability prompt every fifteen minutes trains the owner to dismiss it.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';

import { createStaticServer } from '../scripts/serve.js';
import { LocalApiAuth, generateCapability } from '../src/security/local-api-auth.js';
import { ConnectionApi } from '../ui/js/connection-api.js';
import { EVENT_OUTCOMES } from '../src/security/security-events.js';

function listen(server) {
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve(server.address().port));
  });
}

function request(port, target, { method = 'GET', headers = {}, body = '' } = {}) {
  return new Promise((resolve, reject) => {
    const finalHeaders = body ? { ...headers, 'Content-Length': Buffer.byteLength(body) } : headers;
    const req = http.request({ host: '127.0.0.1', port, path: target, method, headers: finalHeaders }, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        let value = null;
        try { value = JSON.parse(text); } catch { value = null; }
        resolve({ status: res.statusCode, value, text });
      });
    });
    req.on('error', reject);
    req.end(body);
  });
}

function browserHeaders(port, extra = {}) {
  return {
    Host: `127.0.0.1:${port}`,
    Origin: `http://127.0.0.1:${port}`,
    'Sec-Fetch-Site': 'same-origin',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Dest': 'empty',
    ...extra,
  };
}

function lifecycleService() {
  return {
    status: async () => ({ connected: true, local: { itemCount: 1 } }),
    library: async () => null,
    connect: async () => ({ connected: true }),
    sync: async () => ({ ok: true, itemCount: 1 }),
    disconnect: async () => ({ connected: false }),
    exportAll: async () => ({ document: { exportSchemaVersion: 1 }, feedbackIncluded: true, libraryRetained: true }),
    deletionInventory: async () => ({ items: [], limitations: [], localDataRemoved: true, residualItemIds: [], storageSchemaRevision: 1 }),
    deleteLocalSnapshotVerified: async () => ({ itemCount: 0 }),
    purgeAllLocalData: async () => ({ complete: true, inventory: { localDataRemoved: true } }),
    feedbackStore: {
      get: async (bookId) => ({ bookId, record: null, revision: 'rev-1', generation: 1, deleted: false }),
      save: async (bookId) => ({ bookId, revision: 'rev-2', generation: 2, deleted: false, record: null }),
      delete: async (bookId) => ({ bookId, revision: 'rev-3', generation: 3, deleted: true, record: null }),
    },
  };
}

async function startServer(t) {
  const capability = generateCapability();
  const auth = new LocalApiAuth({ digest: capability.digest });
  const server = createStaticServer({ privateAlphaService: lifecycleService(), auth });
  const port = await listen(server);
  t.after(() => server.close());
  return { auth, capability, port };
}

async function openSession(port, capability) {
  const response = await request(port, '/api/v1/session', {
    headers: browserHeaders(port, { Authorization: `ATnR-Capability ${capability.display}` }),
  });
  assert.equal(response.status, 200);
  const session = response.value.session;
  return browserHeaders(port, {
    Authorization: `ATnR-Capability ${capability.display}`,
    'Content-Type': 'application/json',
    'X-ATnR-Session': session.sessionId,
    'X-ATnR-CSRF': session.csrfToken,
    'X-ATnR-Reauth': capability.display,
  });
}

async function issueNonce(port, headers, action, resource = null) {
  const issued = await request(port, '/api/v1/confirmation', {
    method: 'POST',
    headers,
    body: JSON.stringify(resource === null ? { action } : { action, resource }),
  });
  assert.equal(issued.status, 200);
  return issued.value.result.confirmation;
}

for (const [label, route, action] of [
  ['connect', '/api/v1/connect', null],
  ['disconnect', '/api/v1/disconnect', 'disconnect'],
  ['delete-all', '/api/v1/delete-all', 'delete-all'],
]) {
  test(`a successful ${label} invalidates every session and outstanding nonce`, async (t) => {
    const { auth, capability, port } = await startServer(t);
    const headers = await openSession(port, capability);

    // An export nonce is outstanding across the transition.
    const strayNonce = await issueNonce(port, headers, 'export');
    const generationBefore = auth.accountGeneration;
    assert.equal(auth.activeSessions, 1);
    assert.ok(auth.pendingConfirmations >= 1);

    const body = action === null
      ? JSON.stringify({ accountAlias: 'Personal Audible US' })
      : JSON.stringify({ confirmation: await issueNonce(port, headers, action) });
    const performed = await request(port, route, { method: 'POST', headers, body });
    assert.equal(performed.status, 200, `${label} should succeed`);

    // The generation advanced; nothing bound to the old one survives.
    assert.equal(auth.accountGeneration, generationBefore + 1);
    assert.equal(auth.activeSessions, 0);
    assert.equal(auth.pendingConfirmations, 0);

    // The old session is refused outright.
    const afterRead = await request(port, '/api/v1/status', { headers });
    assert.equal(afterRead.status, 401);
    assert.equal(afterRead.value.error.code, 'local-api-session-invalid');

    // The stray nonce cannot cross the generation, even with a fresh session.
    const renewed = await openSession(port, capability);
    const replayed = await request(port, '/api/v1/export', {
      method: 'POST', headers: renewed, body: JSON.stringify({ confirmation: strayNonce }),
    });
    assert.equal(replayed.status, 409);
    assert.equal(replayed.value.error.code, 'confirmation-required');
  });
}

test('snapshot deletion drops outstanding nonces but does not log the owner out', async (t) => {
  const { auth, capability, port } = await startServer(t);
  const headers = await openSession(port, capability);

  const strayNonce = await issueNonce(port, headers, 'export');
  const generationBefore = auth.accountGeneration;

  const nonce = await issueNonce(port, headers, 'delete-local');
  const deleted = await request(port, '/api/v1/delete-local', {
    method: 'POST', headers, body: JSON.stringify({ confirmation: nonce }),
  });
  assert.equal(deleted.status, 200);

  // The account did not change, so the session binding is still honest.
  assert.equal(auth.accountGeneration, generationBefore);
  assert.equal(auth.activeSessions, 1);
  const stillWorks = await request(port, '/api/v1/status', { headers });
  assert.equal(stillWorks.status, 200);

  // But the nonce issued before the erasure did not survive it.
  assert.equal(auth.pendingConfirmations, 0);
  const replayed = await request(port, '/api/v1/export', {
    method: 'POST', headers, body: JSON.stringify({ confirmation: strayNonce }),
  });
  assert.equal(replayed.status, 409);
  assert.equal(replayed.value.error.code, 'confirmation-required');
});

test('erasing a review drops outstanding nonces and keeps the session', async (t) => {
  const { auth, capability, port } = await startServer(t);
  const headers = await openSession(port, capability);

  const strayNonce = await issueNonce(port, headers, 'export');
  const nonce = await issueNonce(port, headers, 'delete-feedback', 'aud-us-book-one:rev-1');
  const erased = await request(port, '/api/v1/feedback/aud-us-book-one', {
    method: 'DELETE', headers, body: JSON.stringify({ expectedRevision: 'rev-1', confirmation: nonce }),
  });
  assert.equal(erased.status, 200);

  assert.equal(auth.activeSessions, 1);
  assert.equal(auth.pendingConfirmations, 0);
  const replayed = await request(port, '/api/v1/export', {
    method: 'POST', headers, body: JSON.stringify({ confirmation: strayNonce }),
  });
  assert.equal(replayed.status, 409);
});

test('a routine sync changes no binding and never forces a re-unlock', async (t) => {
  const { auth, capability, port } = await startServer(t);
  const headers = await openSession(port, capability);

  const nonce = await issueNonce(port, headers, 'export');
  const generationBefore = auth.accountGeneration;

  for (let i = 0; i < 3; i += 1) {
    const synced = await request(port, '/api/v1/sync', { method: 'POST', headers, body: '{}' });
    assert.equal(synced.status, 200);
  }

  // Scheduled background work must not drop the owner's session; a capability
  // prompt every fifteen minutes is a prompt nobody reads.
  assert.equal(auth.accountGeneration, generationBefore);
  assert.equal(auth.activeSessions, 1);
  assert.equal(auth.pendingConfirmations, 1);

  // A nonce issued before the syncs is still spendable afterwards.
  const exported = await request(port, '/api/v1/export', {
    method: 'POST', headers, body: JSON.stringify({ confirmation: nonce }),
  });
  assert.equal(exported.status, 200);
});

test('an export does not invalidate anything: reading is not a state change', async (t) => {
  const { auth, capability, port } = await startServer(t);
  const headers = await openSession(port, capability);

  const first = await issueNonce(port, headers, 'export');
  const second = await issueNonce(port, headers, 'delete-local');
  const exported = await request(port, '/api/v1/export', {
    method: 'POST', headers, body: JSON.stringify({ confirmation: first }),
  });
  assert.equal(exported.status, 200);

  assert.equal(auth.activeSessions, 1);
  // The unrelated deletion nonce survives an export.
  const deleted = await request(port, '/api/v1/delete-local', {
    method: 'POST', headers, body: JSON.stringify({ confirmation: second }),
  });
  assert.equal(deleted.status, 200);
});

test('invalidateConfirmations spares sessions; invalidateBindings does not', () => {
  const capability = generateCapability();
  const auth = new LocalApiAuth({ digest: capability.digest });
  const session = auth.createSession();
  auth.issueConfirmation({ action: 'export', sessionId: session.sessionId });
  assert.equal(auth.activeSessions, 1);
  assert.equal(auth.pendingConfirmations, 1);

  auth.invalidateConfirmations();
  assert.equal(auth.activeSessions, 1, 'a state transition must not log the owner out');
  assert.equal(auth.pendingConfirmations, 0);
  assert.equal(auth.verifySession(session.sessionId).ok, true);

  auth.issueConfirmation({ action: 'export', sessionId: session.sessionId });
  const generation = auth.accountGeneration;
  auth.invalidateBindings();
  assert.equal(auth.accountGeneration, generation + 1);
  assert.equal(auth.activeSessions, 0);
  assert.equal(auth.pendingConfirmations, 0);
  assert.equal(auth.verifySession(session.sessionId).code, 'local-api-session-invalid');
});

test('the invalidation event outcome is part of the closed vocabulary', () => {
  assert.ok(EVENT_OUTCOMES.includes('invalidated'));
});

test('the client discards a session the server invalidated and says so truthfully', async () => {
  const requests = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options = {}) => {
    requests.push({ url, headers: options.headers ?? {} });
    if (url === '/api/v1/confirmation') {
      return {
        ok: true, status: 200, headers: { get: () => 'application/json' },
        json: async () => ({ ok: true, result: { confirmation: 'nonce-12345678901234567890', expiresInMs: 120_000 } }),
        text: async () => '{}',
      };
    }
    return {
      ok: true, status: 200, headers: { get: () => 'application/json' },
      json: async () => ({ ok: true, result: { connected: false } }),
      text: async () => '{}',
    };
  };
  try {
    const api = new ConnectionApi({
      capability: 'capability-token',
      sessionId: 'session-123',
      csrfToken: 'csrf-12345678901234567890123456789012',
      requestCapability: async () => 'reentered-capability',
    });
    assert.equal(api.bindingsInvalidated, false);
    await api.disconnect();
    // The server dropped every binding as it disconnected. Continuing to
    // present the dead session identifier would produce an unexplained 401.
    assert.equal(api.bindingsInvalidated, true);

    await api.status().catch(() => {});
    const last = requests.at(-1);
    assert.equal(last.headers['X-ATnR-Session'], '');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('a session-invalid response marks the client bindings invalid', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: false, status: 401, headers: { get: () => 'application/json' },
    json: async () => ({ ok: false, error: { code: 'local-api-session-invalid' } }),
    text: async () => '{}',
  });
  try {
    const api = new ConnectionApi({
      capability: 'capability-token',
      sessionId: 'session-123',
      csrfToken: 'csrf-12345678901234567890123456789012',
      requestCapability: async () => 'reentered-capability',
    });
    await assert.rejects(() => api.status());
    assert.equal(api.bindingsInvalidated, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
