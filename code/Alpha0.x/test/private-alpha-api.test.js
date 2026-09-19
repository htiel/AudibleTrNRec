/**
 * Loopback API perimeter tests (A2-WP015 / ATR-S015, ATR-S017).
 *
 * Everything here is synthetic: a fake service, a browser session, an
 * ephemeral port. No personal runtime file, connector process, or real
 * Audible path is touched.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';

import {
  createStaticServer,
  PRIVATE_ALPHA_SECURITY_HEADERS,
  MAX_CONTROL_BODY_BYTES,
  MAX_FEEDBACK_BODY_BYTES,
  MAX_EXPORT_RESPONSE_BYTES,
  IMPLEMENTED_API_ROUTES,
  INVENTORY_ITEM_IDS,
} from '../scripts/serve.js';
import { deletionInventory } from '../src/store/export.js';
import { LocalApiAuth, ROUTE_POLICY } from '../src/security/local-api-auth.js';
import {
  ACCOUNT_QUARANTINE_CODE,
  PrivateAlphaServiceError,
} from '../src/sync/private-alpha-service.js';

function listen(server) {
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve(server.address().port));
  });
}
function request(port, target, { method = 'GET', headers = {}, body = '' } = {}) {
  return new Promise((resolve, reject) => {
    const finalHeaders = body && !Object.keys(headers).some((key) => key.toLowerCase() === 'content-length')
      ? { ...headers, 'Content-Length': Buffer.byteLength(body) }
      : headers;
    const req = http.request({ host: '127.0.0.1', port, path: target, method, headers: finalHeaders }, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        let value = null;
        try { value = JSON.parse(text); } catch { value = null; }
        resolve({ status: res.statusCode, headers: res.headers, value, text });
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

function syntheticService(calls = [], { quarantined = false, exportDocument = null, exportFails = null, inventory = undefined } = {}) {
  const feedback = new Map();
  return {
    calls,
    status: async () => ({ connected: false, commercialShippingBlocked: true, local: { itemCount: 0 } }),
    library: async () => null,
    deletionInventory: async () => {
      calls.push(['inventory']);
      return inventory === undefined
        ? deletionInventory({ hasSnapshot: true, activeReviews: 3, tombstones: 1, hasSyncState: true, hasAccountAnchor: true, managedBackups: 1 })
        : inventory;
    },
    connect: async (body) => { calls.push(['connect', body]); return { connected: true }; },
    sync: async () => { calls.push(['sync']); return { itemCount: 1 }; },
    disconnect: async () => { calls.push(['disconnect']); return { connected: false }; },
    exportAll: async () => {
      calls.push(['export']);
      if (exportFails) throw new PrivateAlphaServiceError(exportFails);
      return {
        document: exportDocument ?? { exportSchemaVersion: 1, generatedAt: '2026-09-17T12:00:00.000Z', libraryRetained: true },
        feedbackIncluded: true,
        libraryRetained: true,
      };
    },
    purgeAllLocalData: async () => {
      calls.push(['purge:join-resolved']);
      if (quarantined) throw new PrivateAlphaServiceError(ACCOUNT_QUARANTINE_CODE);
      calls.push(['purge']);
      return {
        complete: true,
        accountAnchorRemoved: true,
        rollbackEnvelopeRetained: false,
        retainedReviewRows: 0,
        inventory: { localDataRemoved: true, activeReviews: 0, tombstones: 0, managedBackups: 0 },
      };
    },
    // The synchronous form depends on a previously cached account-join
    // verdict. The route must never reach it; calling it is a defect.
    deleteLocalSnapshot: () => { calls.push(['delete:stale-form']); return { itemCount: 0 }; },
    deleteLocalSnapshotVerified: async () => {
      calls.push(['delete:join-resolved']);
      if (quarantined) throw new PrivateAlphaServiceError(ACCOUNT_QUARANTINE_CODE);
      calls.push(['delete']);
      return { itemCount: 0 };
    },
    feedbackStore: {
      list: async () => [...feedback.values()],
      get: async (bookId) => { calls.push(['feedback:get', bookId]); return feedback.get(bookId) ?? { bookId, record: null, revision: 'rev-0-absent', generation: 0, deleted: false }; },
      save: async (bookId, payload, expectedRevision) => {
        calls.push(['feedback:save', bookId, payload, expectedRevision]);
        const generation = expectedRevision === 'rev-0-absent' ? 1 : 2;
        const result = {
          bookId,
          revision: generation === 1 ? 'rev-1' : 'rev-2',
          generation,
          deleted: false,
          record: {
            overallRating: payload.overallRating ?? null,
            storyRating: payload.storyRating ?? null,
            narrationRating: payload.narrationRating ?? null,
            comment: payload.comment ?? null,
            tags: payload.tags ?? [],
            createdAt: '2026-09-17T12:00:00.000Z',
            updatedAt: '2026-09-17T12:05:00.000Z',
          },
        };
        feedback.set(bookId, result);
        return result;
      },
      delete: async (bookId, expectedRevision) => {
        calls.push(['feedback:delete', bookId, expectedRevision]);
        const current = feedback.get(bookId);
        if (!current) { const error = new Error('record-not-found'); error.code = 'record-not-found'; throw error; }
        const result = { bookId, revision: 'rev-3', generation: 3, deleted: true, record: null };
        feedback.set(bookId, result);
        return result;
      },
    },
  };
}

async function startPrivateServer(t, options = {}) {
  const calls = [];
  const auth = new LocalApiAuth();
  const server = createStaticServer({ privateAlphaService: syntheticService(calls, options), auth });
  const port = await listen(server);
  t.after(() => server.close());
  return { calls, auth, server, port };
}

async function openSession(port) {
  const response = await request(port, '/api/v1/session', {
    headers: browserHeaders(port),
  });
  assert.equal(response.status, 200);
  return response.value.session;
}

test('the private API may not exist without a session controller', () => {
  assert.throws(
    () => createStaticServer({ privateAlphaService: syntheticService() }),
    /local-api-session-controller-required/,
  );
});

test('session bootstrap needs browser metadata and later routes need its session', async (t) => {
  const { port } = await startPrivateServer(t);
  const probe = await request(port, '/api/v1/session', { headers: browserHeaders(port) });
  assert.equal(probe.status, 200);
  assert.match(probe.value.session.sessionId, /^[A-Za-z0-9_-]{20,}$/);
  assert.match(probe.value.session.csrfToken, /^[A-Za-z0-9_-]{20,}$/);

  for (const [method, route] of [
    ['GET', '/api/v1/status'],
    ['GET', '/api/v1/library'],
    ['GET', '/api/v1/inventory'],
    ['POST', '/api/v1/sync'],
    ['POST', '/api/v1/connect'],
    ['POST', '/api/v1/disconnect'],
    ['POST', '/api/v1/delete-local'],
    ['POST', '/api/v1/delete-all'],
    ['POST', '/api/v1/export'],
    ['POST', '/api/v1/confirmation'],
    ['GET', '/api/v1/feedback/aud-us-book-one'],
    ['PUT', '/api/v1/feedback/aud-us-book-one'],
    ['DELETE', '/api/v1/feedback/aud-us-book-one'],
  ]) {
    const denied = await request(port, route, {
      method,
      headers: browserHeaders(port, { 'Content-Type': 'application/json' }),
      body: method === 'POST' ? '{}' : '',
    });
    assert.equal(denied.status, 401, `${method} ${route} was reachable without a session`);
    assert.equal(denied.value.error.code, 'local-api-session-invalid');
  }

  const session = await openSession(port);
  assert.match(session.sessionId, /^[A-Za-z0-9_-]{20,}$/);
  assert.match(session.csrfToken, /^[A-Za-z0-9_-]{20,}$/);
  assert.equal(session.contractVersion, 'atnr-local-api-1');
});

test('CSRF and fetch-metadata remain enforced as defence in depth', async (t) => {
  const { capability, port } = await startPrivateServer(t);
  const session = await openSession(port, capability);
  const authed = {};

  const noCsrf = await request(port, '/api/v1/sync', {
    method: 'POST',
    headers: browserHeaders(port, {
      ...authed,
      'Content-Type': 'application/json',
      'X-ATnR-Session': session.sessionId,
    }),
    body: '{}',
  });
  assert.equal(noCsrf.status, 403);
  assert.equal(noCsrf.value.error.code, 'csrf-token-invalid');

  const crossSite = await request(port, '/api/v1/status', {
    headers: {
      Host: `127.0.0.1:${port}`,
      Origin: 'https://attacker.invalid',
      'Sec-Fetch-Site': 'cross-site',
      'Sec-Fetch-Mode': 'cors',
      'Sec-Fetch-Dest': 'empty',
      ...authed,
    },
  });
  assert.equal(crossSite.status, 403);
  assert.equal(crossSite.value.error.code, 'browser-metadata-rejected');

  // A navigation/extension-shaped request (dest != empty) is refused too.
  const navigation = await request(port, '/api/v1/status', {
    headers: browserHeaders(port, { ...authed, 'Sec-Fetch-Dest': 'document', 'Sec-Fetch-Mode': 'navigate' }),
  });
  assert.equal(navigation.status, 403);
  assert.equal(navigation.value.error.code, 'browser-metadata-rejected');
});

test('a hostile Host header is refused before any route runs', async (t) => {
  const { port } = await startPrivateServer(t);
  const rebind = await request(port, '/api/v1/status', { headers: { Host: 'evil.example' } });
  assert.equal(rebind.status, 403);
  assert.equal(rebind.text, 'Forbidden');

  // Correct hostname, wrong port: still a different local service.
  const wrongPort = await request(port, '/api/v1/status', { headers: { Host: '127.0.0.1:1' } });
  assert.equal(wrongPort.status, 403);
});

test('lifecycle routes run with capability + session + CSRF', async (t) => {
  const { calls, capability, port } = await startPrivateServer(t);
  const session = await openSession(port, capability);
  const headers = browserHeaders(port, {
    'Content-Type': 'application/json',
    'X-ATnR-Session': session.sessionId,
    'X-ATnR-CSRF': session.csrfToken,
  });

  const status = await request(port, '/api/v1/status', { headers });
  assert.equal(status.status, 200);
  assert.equal(status.value.result.commercialShippingBlocked, true);
  assert.equal(
    status.headers['content-security-policy'],
    PRIVATE_ALPHA_SECURITY_HEADERS['content-security-policy'],
  );
  assert.match(status.headers['content-security-policy'], /connect-src 'self'/);

  const connect = await request(port, '/api/v1/connect', {
    method: 'POST',
    headers,
    body: JSON.stringify({ accountAlias: 'Synthetic account' }),
  });
  assert.equal(connect.status, 200);
  assert.deepEqual(calls, [['connect', { accountAlias: 'Synthetic account' }]]);

  const unknown = await request(port, '/api/v1/unknown', { method: 'POST', headers, body: '{}' });
  assert.equal(unknown.status, 404);
  assert.equal(unknown.value.error.code, 'api-route-not-found');
});

test('destructive routes require a single-use session-bound nonce', async (t) => {
  const { calls, capability, port } = await startPrivateServer(t);
  const session = await openSession(port, capability);
  const base = browserHeaders(port, {
    'Content-Type': 'application/json',
    'X-ATnR-Session': session.sessionId,
    'X-ATnR-CSRF': session.csrfToken,
  });
  const reauthed = base;

  // Without a confirmation nonce the destructive route is refused.
  const noNonce = await request(port, '/api/v1/delete-local', {
    method: 'POST', headers: base, body: '{}',
  });
  assert.equal(noNonce.status, 409);
  assert.equal(noNonce.value.error.code, 'confirmation-required');

  const issued = await request(port, '/api/v1/confirmation', {
    method: 'POST', headers: reauthed, body: JSON.stringify({ action: 'delete-local' }),
  });
  assert.equal(issued.status, 200);
  const { confirmation } = issued.value.result;
  assert.equal(issued.value.result.expiresInMs, 120_000);

  // A nonce issued for one action does not authorize another.
  const wrongAction = await request(port, '/api/v1/disconnect', {
    method: 'POST', headers: reauthed, body: JSON.stringify({ confirmation }),
  });
  assert.equal(wrongAction.status, 409);
  assert.equal(wrongAction.value.error.code, 'confirmation-required');

  const deleted = await request(port, '/api/v1/delete-local', {
    method: 'POST', headers: reauthed, body: JSON.stringify({ confirmation }),
  });
  assert.equal(deleted.status, 200);
  // The join is resolved immediately before the erase, by the route itself.
  assert.deepEqual(calls, [['delete:join-resolved'], ['delete']]);

  // Replay of the same nonce fails: it is single-use.
  const replay = await request(port, '/api/v1/delete-local', {
    method: 'POST', headers: reauthed, body: JSON.stringify({ confirmation }),
  });
  assert.equal(replay.status, 409);
  assert.equal(replay.value.error.code, 'confirmation-required');
  assert.deepEqual(calls, [['delete:join-resolved'], ['delete']]);
});

test('local deletion resolves the account join at the moment of erasure', async (t) => {
  const { calls, capability, port } = await startPrivateServer(t);
  const session = await openSession(port, capability);
  const reauthed = browserHeaders(port, {
    'Content-Type': 'application/json',
    'X-ATnR-Session': session.sessionId,
    'X-ATnR-CSRF': session.csrfToken,
  });
  const issued = await request(port, '/api/v1/confirmation', {
    method: 'POST', headers: reauthed, body: JSON.stringify({ action: 'delete-local' }),
  });
  const deleted = await request(port, '/api/v1/delete-local', {
    method: 'POST', headers: reauthed, body: JSON.stringify({ confirmation: issued.value.result.confirmation }),
  });
  assert.equal(deleted.status, 200);
  // The stale-dependent synchronous form must never be reached: a cached
  // verdict is not evidence of ownership at the moment of deletion.
  assert.equal(calls.some((entry) => entry[0] === 'delete:stale-form'), false);
  assert.equal(calls[0][0], 'delete:join-resolved');
});

test('an account mismatch refuses deletion with a closed code and erases nothing', async (t) => {
  const { calls, capability, port } = await startPrivateServer(t, { quarantined: true });
  const session = await openSession(port, capability);
  const reauthed = browserHeaders(port, {
    'Content-Type': 'application/json',
    'X-ATnR-Session': session.sessionId,
    'X-ATnR-CSRF': session.csrfToken,
  });
  const issued = await request(port, '/api/v1/confirmation', {
    method: 'POST', headers: reauthed, body: JSON.stringify({ action: 'delete-local' }),
  });
  const refused = await request(port, '/api/v1/delete-local', {
    method: 'POST', headers: reauthed, body: JSON.stringify({ confirmation: issued.value.result.confirmation }),
  });

  assert.equal(refused.status, 409);
  // A mapped, closed code: the owner learns the join failed and nothing more.
  assert.equal(refused.value.error.code, 'account-mismatch-local-data-quarantined');
  assert.deepEqual(Object.keys(refused.value.error), ['code']);
  // Zero deletions of any kind.
  assert.equal(calls.some((entry) => entry[0] === 'delete'), false);
  assert.equal(calls.some((entry) => entry[0] === 'delete:stale-form'), false);
  assert.deepEqual(calls, [['delete:join-resolved']]);
});

/** Destructive-strength headers for an active browser session. */
async function destructiveHeaders(port) {
  const session = await openSession(port);
  return browserHeaders(port, {
    'Content-Type': 'application/json',
    'X-ATnR-Session': session.sessionId,
    'X-ATnR-CSRF': session.csrfToken,
  });
}

async function nonceFor(port, headers, action) {
  const issued = await request(port, '/api/v1/confirmation', {
    method: 'POST', headers, body: JSON.stringify({ action }),
  });
  assert.equal(issued.status, 200);
  return issued.value.result.confirmation;
}

test('the deletion inventory requires a session and is closed and free of personal text', async (t) => {
  const { capability, port } = await startPrivateServer(t);

  const unauthenticated = await request(port, '/api/v1/inventory', { headers: browserHeaders(port) });
  assert.equal(unauthenticated.status, 401);
  assert.equal(unauthenticated.value.error.code, 'local-api-session-invalid');

  const session = await openSession(port, capability);
  const authed = browserHeaders(port, {
    'X-ATnR-Session': session.sessionId,
  });

  // A live session is required after bootstrap.
  const noSession = await request(port, '/api/v1/inventory', {
    headers: browserHeaders(port),
  });
  assert.equal(noSession.status, 401);

  const loaded = await request(port, '/api/v1/inventory', { headers: authed });
  assert.equal(loaded.status, 200);
  const result = loaded.value.result;

  assert.deepEqual(Object.keys(result).sort(), ['connectorArtifactsDisclosed', 'items', 'limitations', 'localDataRemoved', 'residualConnectorItemIds', 'residualItemIds', 'storageSchemaRevision']);
  assert.deepEqual(result.items.map((item) => item.id), [...INVENTORY_ITEM_IDS]);
  for (const item of result.items) {
    assert.deepEqual(Object.keys(item).sort(), ['count', 'encrypted', 'id', 'lifecycle', 'owner', 'retained']);
    assert.ok(item.retained === true || item.retained === false || item.retained === 'unknown');
    assert.ok(item.count === null || Number.isInteger(item.count));
  }
  // Connector-owned artifacts are reported as unknown, never as removed: a
  // false reassurance about credentials is worse than admitting ignorance.
  const connector = result.items.filter((item) => item.owner === 'connector');
  assert.equal(connector.length, 2);
  assert.ok(connector.every((item) => item.retained === 'unknown'));
  assert.equal(result.connectorArtifactsDisclosed, true);
  // The owner is told what deletion cannot reach, including copies they have
  // already exported beyond this application's control.
  assert.ok(result.limitations.some((text) => text.includes('exported')));
  assert.equal(result.localDataRemoved, false);
  assert.ok(result.residualItemIds.every((id) => INVENTORY_ITEM_IDS.includes(id)));

  // Counts and fixed statements only — never a title, identifier, comment,
  // account key or path.
  assert.equal(/aud-us-|B0[A-Z0-9]{8}|[a-f0-9]{64}|[A-Za-z]:\\\\/.test(loaded.text), false);
});

test('a widened or malformed inventory fails the response closed', async (t) => {
  for (const broken of [
    null,
    { items: 'nope' },
    { items: [{ id: 'surprise-new-item', owner: 'local', retained: true }] },
    { items: [{ id: 'encrypted-snapshot', owner: 'local', retained: true, count: -1 }] },
    // A connector artifact flattened to a definite "not retained" is a false
    // reassurance and must be refused, not forwarded.
    { items: [{ id: 'identity-seed', owner: 'connector', retained: 'probably-not' }] },
  ]) {
    const { calls, capability, port } = await startPrivateServer(t, { inventory: broken });
    const session = await openSession(port, capability);
    const response = await request(port, '/api/v1/inventory', {
      headers: browserHeaders(port, {
        'X-ATnR-Session': session.sessionId,
      }),
    });
    assert.equal(response.status, 409);
    assert.equal(response.value.error.code, 'inventory-unavailable');
    assert.deepEqual(Object.keys(response.value.error), ['code']);
    assert.deepEqual(calls, [['inventory']]);
  }
});

test('export requires a single-use confirmation nonce and never runs weakly', async (t) => {
  const { calls, capability, port } = await startPrivateServer(t);
  const reauthed = await destructiveHeaders(port, capability);
  const noNonce = await request(port, '/api/v1/export', { method: 'POST', headers: reauthed, body: '{}' });
  assert.equal(noNonce.status, 409);
  assert.equal(noNonce.value.error.code, 'confirmation-required');

  // Nothing was exported by the refused attempt.
  assert.deepEqual(calls, []);

  const confirmation = await nonceFor(port, reauthed, 'export');

  // A nonce issued for an export does not authorize a deletion, and vice versa.
  const borrowed = await request(port, '/api/v1/delete-local', {
    method: 'POST', headers: reauthed, body: JSON.stringify({ confirmation }),
  });
  assert.equal(borrowed.status, 409);
  assert.equal(borrowed.value.error.code, 'confirmation-required');

  const exported = await request(port, '/api/v1/export', {
    method: 'POST', headers: reauthed, body: JSON.stringify({ confirmation }),
  });
  assert.equal(exported.status, 200);
  assert.equal(exported.value.ok, true);
  assert.equal(exported.value.result.document.exportSchemaVersion, 1);
  assert.deepEqual(calls, [['export']]);

  // Single use: the same nonce cannot export a second copy.
  const replay = await request(port, '/api/v1/export', {
    method: 'POST', headers: reauthed, body: JSON.stringify({ confirmation }),
  });
  assert.equal(replay.status, 409);
  assert.equal(replay.value.error.code, 'confirmation-required');
  assert.deepEqual(calls, [['export']]);
});

test('an export is delivered as a bounded, non-renderable download', async (t) => {
  const { capability, port } = await startPrivateServer(t);
  const reauthed = await destructiveHeaders(port, capability);
  const confirmation = await nonceFor(port, reauthed, 'export');
  const exported = await request(port, '/api/v1/export', {
    method: 'POST', headers: reauthed, body: JSON.stringify({ confirmation }),
  });

  assert.equal(exported.headers['content-type'], 'application/json; charset=utf-8');
  // The browser must not render it, sniff it, or cache it to disk.
  assert.equal(exported.headers['content-disposition'], 'attachment; filename="atnr-export.json"');
  assert.equal(exported.headers['x-content-type-options'], 'nosniff');
  assert.equal(exported.headers['cache-control'], 'no-store');
  // The filename is a fixed ASCII literal: stored content can never steer it.
  assert.equal(/^attachment; filename="[a-z0-9.\-]+"$/.test(exported.headers['content-disposition']), true);
  assert.equal(Number(exported.headers['content-length']), Buffer.byteLength(exported.text));
  assert.ok(Buffer.byteLength(exported.text) <= MAX_EXPORT_RESPONSE_BYTES);

  // No session, CSRF, or confirmation material is echoed into the body.
  for (const secret of [reauthed['X-ATnR-Session'], reauthed['X-ATnR-CSRF'], confirmation]) {
    assert.equal(exported.text.includes(secret), false);
  }
});

test('an oversized export fails closed rather than shipping a truncated copy', async (t) => {
  const { capability, port } = await startPrivateServer(t, {
    exportDocument: { exportSchemaVersion: 1, filler: 'a'.repeat(MAX_EXPORT_RESPONSE_BYTES + 1) },
  });
  const reauthed = await destructiveHeaders(port, capability);
  const confirmation = await nonceFor(port, reauthed, 'export');
  const exported = await request(port, '/api/v1/export', {
    method: 'POST', headers: reauthed, body: JSON.stringify({ confirmation }),
  });

  assert.equal(exported.status, 413);
  assert.equal(exported.value.error.code, 'export-too-large');
  assert.equal(exported.headers['content-disposition'], undefined);
});

test('an export failure reports a closed code and no detail', async (t) => {
  const { capability, port } = await startPrivateServer(t, { exportFails: 'prohibited-export-field' });
  const reauthed = await destructiveHeaders(port, capability);
  const confirmation = await nonceFor(port, reauthed, 'export');
  const exported = await request(port, '/api/v1/export', {
    method: 'POST', headers: reauthed, body: JSON.stringify({ confirmation }),
  });

  assert.equal(exported.status, 409);
  // An internal export-builder code is not part of the API vocabulary and must
  // collapse to the fixed category rather than describe the failure.
  assert.equal(exported.value.error.code, 'private-alpha-operation-failed');
  assert.deepEqual(Object.keys(exported.value.error), ['code']);
});

test('complete deletion erases everything and is separate from snapshot deletion', async (t) => {
  const { calls, capability, port } = await startPrivateServer(t);
  const reauthed = await destructiveHeaders(port, capability);

  // A snapshot-deletion nonce must not satisfy the aggregate purge: confirming
  // "delete the snapshot" is not consent to erase private reviews.
  const snapshotNonce = await nonceFor(port, reauthed, 'delete-local');
  const borrowed = await request(port, '/api/v1/delete-all', {
    method: 'POST', headers: reauthed, body: JSON.stringify({ confirmation: snapshotNonce }),
  });
  assert.equal(borrowed.status, 409);
  assert.equal(borrowed.value.error.code, 'confirmation-required');
  assert.deepEqual(calls, []);

  const confirmation = await nonceFor(port, reauthed, 'delete-all');
  const purged = await request(port, '/api/v1/delete-all', {
    method: 'POST', headers: reauthed, body: JSON.stringify({ confirmation }),
  });
  assert.equal(purged.status, 200);
  assert.deepEqual(calls, [['purge:join-resolved'], ['purge']]);

  // The response states residue honestly, recomputed rather than asserted.
  const result = purged.value.result;
  assert.equal(result.complete, true);
  assert.equal(result.inventory.localDataRemoved, true);
  assert.equal(result.inventory.activeReviews, 0);
  assert.equal(result.inventory.tombstones, 0);
  assert.equal(result.inventory.managedBackups, 0);
  assert.equal(result.accountAnchorRemoved, true);
  assert.equal(result.rollbackEnvelopeRetained, false);

  const replay = await request(port, '/api/v1/delete-all', {
    method: 'POST', headers: reauthed, body: JSON.stringify({ confirmation }),
  });
  // Stronger than a spent-nonce refusal: the purge invalidated every binding,
  // so the session itself is gone and the replay never reaches the nonce check.
  assert.equal(replay.status, 401);
  assert.equal(replay.value.error.code, 'local-api-session-invalid');
  assert.deepEqual(calls, [['purge:join-resolved'], ['purge']]);
});

test('an account mismatch refuses the aggregate purge and erases nothing', async (t) => {
  const { calls, capability, port } = await startPrivateServer(t, { quarantined: true });
  const reauthed = await destructiveHeaders(port, capability);
  const confirmation = await nonceFor(port, reauthed, 'delete-all');
  const refused = await request(port, '/api/v1/delete-all', {
    method: 'POST', headers: reauthed, body: JSON.stringify({ confirmation }),
  });

  assert.equal(refused.status, 409);
  assert.equal(refused.value.error.code, 'account-mismatch-local-data-quarantined');
  assert.deepEqual(Object.keys(refused.value.error), ['code']);
  assert.deepEqual(calls, [['purge:join-resolved']]);
});

test('a policy-bearing route without a handler can never consume a nonce', () => {
  // A confirmation nonce is the owner's re-entered authority, spent once. If a
  // policy entry ever outruns its handler, the nonce would be burned and the
  // request answered 404 — the action silently not performed.
  for (const key of Object.keys(ROUTE_POLICY)) {
    assert.ok(
      IMPLEMENTED_API_ROUTES.includes(key),
      `${key} has a route policy but no handler`,
    );
  }
  for (const key of IMPLEMENTED_API_ROUTES) {
    assert.ok(Object.hasOwn(ROUTE_POLICY, key), `${key} is handled but has no route policy`);
  }
});

test('an unimplemented /api/v1 path is refused without touching the service', async (t) => {
  const { calls, capability, port } = await startPrivateServer(t);
  const reauthed = await destructiveHeaders(port, capability);
  const missing = await request(port, '/api/v1/purge-everything', {
    method: 'POST', headers: reauthed, body: '{}',
  });
  assert.equal(missing.status, 404);
  assert.equal(missing.value.error.code, 'api-route-not-found');
  assert.deepEqual(calls, []);
});

test('control bodies are bounded and typed, and errors never describe themselves', async (t) => {
  const { capability, port } = await startPrivateServer(t);
  const session = await openSession(port, capability);
  const headers = browserHeaders(port, {
    'Content-Type': 'application/json',
    'X-ATnR-Session': session.sessionId,
    'X-ATnR-CSRF': session.csrfToken,
  });

  const oversize = await request(port, '/api/v1/sync', {
    method: 'POST',
    headers,
    body: JSON.stringify({ padding: 'a'.repeat(MAX_CONTROL_BODY_BYTES + 100) }),
  });
  assert.equal(oversize.status, 413);
  assert.equal(oversize.value.error.code, 'request-body-too-large');

  const wrongType = await request(port, '/api/v1/sync', {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'text/plain' },
    body: '{}',
  });
  assert.equal(wrongType.status, 409);
  assert.equal(wrongType.value.error.code, 'request-content-type-invalid');

  const malformed = await request(port, '/api/v1/sync', { method: 'POST', headers, body: '{' });
  assert.equal(malformed.status, 409);
  assert.equal(malformed.value.error.code, 'request-body-invalid');
  assert.deepEqual(Object.keys(malformed.value.error), ['code']);
});

test('security events are recorded without any personal or request-derived text', async (t) => {
  const { capability, port, server } = await startPrivateServer(t);
  await openSession(port, capability);
  await request(port, '/api/v1/status', { headers: browserHeaders(port) });

  const records = server.securityEvents.list();
  assert.ok(records.length >= 2);
  const serialized = JSON.stringify(records);
  for (const record of records) {
    assert.deepEqual(
      Object.keys(record).sort(),
      ['at', 'category', 'failureCount', 'outcome', 'sequence'],
    );
    // Second-granularity only: a higher-resolution timestamp is a correlation
    // handle for local activity.
    assert.match(record.at, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.000Z$/);
    assert.equal(typeof record.failureCount, 'number');
  }
  assert.ok(records.some((r) => r.category === 'local-auth' && r.outcome === 'allowed'));
  assert.ok(records.some((r) => r.category === 'local-auth' && r.outcome === 'denied'));
});

test('synthetic server does not expose the private API', async (t) => {
  const server = createStaticServer();
  const port = await listen(server);
  t.after(() => server.close());

  const response = await request(port, '/api/v1/status');
  assert.equal(response.status, 404);
  assert.equal(response.text, 'Not found');
});


test('feedback read and save use the session contract; deletion needs confirmation', async (t) => {
  const { calls, capability, port } = await startPrivateServer(t);
  const session = await openSession(port, capability);
  const getHeaders = browserHeaders(port, {
    'X-ATnR-Session': session.sessionId,
  });
  const writeHeaders = browserHeaders(port, {
    'Content-Type': 'application/json',
    'X-ATnR-Session': session.sessionId,
    'X-ATnR-CSRF': session.csrfToken,
  });

  const initial = await request(port, '/api/v1/feedback/aud-us-book-one', { headers: getHeaders });
  assert.equal(initial.status, 200);
  assert.equal(initial.value.result.revision, 'rev-0-absent');

  const saved = await request(port, '/api/v1/feedback/aud-us-book-one', {
    method: 'PUT',
    headers: writeHeaders,
    body: JSON.stringify({
      payload: { overallRating: 4.5, comment: 'Held up', tags: ['favorite'] },
      expectedRevision: 'rev-0-absent',
    }),
  });
  assert.equal(saved.status, 200);
  assert.equal(saved.value.result.record.overallRating, 4.5);

  const listed = await request(port, '/api/v1/feedback', { headers: getHeaders });
  assert.equal(listed.status, 200);
  assert.equal(listed.value.result.length, 1);
  assert.equal(listed.value.result[0].bookId, 'aud-us-book-one');

  // The old defect: a bare delete once passed on the sync route's policy.
  const bare = await request(port, '/api/v1/feedback/aud-us-book-one', {
    method: 'DELETE',
    headers: writeHeaders,
    body: JSON.stringify({ expectedRevision: 'rev-1' }),
  });
  assert.equal(bare.status, 409);
  assert.equal(bare.value.error.code, 'confirmation-required');
  assert.equal(calls.some((entry) => entry[0] === 'feedback:delete'), false);
});

test('erasing a review demands a nonce bound to that record and revision', async (t) => {
  const { calls, capability, port } = await startPrivateServer(t);
  const session = await openSession(port, capability);
  const base = browserHeaders(port, {
    'Content-Type': 'application/json',
    'X-ATnR-Session': session.sessionId,
    'X-ATnR-CSRF': session.csrfToken,
  });
  const reauthed = base;

  await request(port, '/api/v1/feedback/aud-us-book-one', {
    method: 'PUT',
    headers: base,
    body: JSON.stringify({ payload: { overallRating: 4.5 }, expectedRevision: 'rev-0-absent' }),
  });

  // An unconfirmed deletion is refused.
  const noNonce = await request(port, '/api/v1/feedback/aud-us-book-one', {
    method: 'DELETE',
    headers: reauthed,
    body: JSON.stringify({ expectedRevision: 'rev-1', confirmation: 'x' }),
  });
  assert.equal(noNonce.status, 409);
  assert.equal(noNonce.value.error.code, 'confirmation-required');

  // A whole-library nonce cannot erase a record.
  const wrongAction = await request(port, '/api/v1/confirmation', {
    method: 'POST', headers: reauthed, body: JSON.stringify({ action: 'delete-local' }),
  });
  const borrowed = await request(port, '/api/v1/feedback/aud-us-book-one', {
    method: 'DELETE',
    headers: reauthed,
    body: JSON.stringify({ expectedRevision: 'rev-1', confirmation: wrongAction.value.result.confirmation }),
  });
  assert.equal(borrowed.status, 409);
  assert.equal(borrowed.value.error.code, 'confirmation-required');

  const issued = await request(port, '/api/v1/confirmation', {
    method: 'POST',
    headers: reauthed,
    body: JSON.stringify({ action: 'delete-feedback', resource: 'aud-us-book-one:rev-1' }),
  });
  assert.equal(issued.status, 200);
  const { confirmation } = issued.value.result;

  // The same nonce cannot be redirected to another book...
  const otherBook = await request(port, '/api/v1/feedback/aud-us-book-two', {
    method: 'DELETE', headers: reauthed, body: JSON.stringify({ expectedRevision: 'rev-1', confirmation }),
  });
  assert.equal(otherBook.status, 409);
  assert.equal(otherBook.value.error.code, 'confirmation-required');

  // ...nor to a different revision of the same book.
  const otherRevision = await request(port, '/api/v1/feedback/aud-us-book-one', {
    method: 'DELETE', headers: reauthed, body: JSON.stringify({ expectedRevision: 'rev-9', confirmation }),
  });
  assert.equal(otherRevision.status, 409);
  assert.equal(otherRevision.value.error.code, 'confirmation-required');
  assert.equal(calls.some((entry) => entry[0] === 'feedback:delete'), false);

  const fresh = await request(port, '/api/v1/confirmation', {
    method: 'POST',
    headers: reauthed,
    body: JSON.stringify({ action: 'delete-feedback', resource: 'aud-us-book-one:rev-1' }),
  });
  const deleted = await request(port, '/api/v1/feedback/aud-us-book-one', {
    method: 'DELETE',
    headers: reauthed,
    body: JSON.stringify({ expectedRevision: 'rev-1', confirmation: fresh.value.result.confirmation }),
  });
  assert.equal(deleted.status, 200);
  assert.equal(deleted.value.result.deleted, true);

  // Single use: the nonce cannot be replayed.
  const replay = await request(port, '/api/v1/feedback/aud-us-book-one', {
    method: 'DELETE',
    headers: reauthed,
    body: JSON.stringify({ expectedRevision: 'rev-1', confirmation: fresh.value.result.confirmation }),
  });
  assert.equal(replay.status, 409);
  assert.equal(replay.value.error.code, 'confirmation-required');
  assert.equal(calls.filter((entry) => entry[0] === 'feedback:delete').length, 1);
});

test('a browser-realistic GET without an Origin header completes the bootstrap', async (t) => {
  const { port } = await startPrivateServer(t);
  // Browsers omit Origin on same-origin safe requests. Requiring it here made
  // normal browser bootstrap unreachable while adding no authority.
  const noOrigin = {
    Host: `127.0.0.1:${port}`,
    'Sec-Fetch-Site': 'same-origin',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Dest': 'empty',
    Referer: `http://127.0.0.1:${port}/?private-alpha=1`,
  };

  const probe = await request(port, '/api/v1/session', { headers: noOrigin });
  assert.equal(probe.status, 200);
  const session = probe;

  const status = await request(port, '/api/v1/status', {
    headers: {
      ...noOrigin,
      'X-ATnR-Session': session.value.session.sessionId,
    },
  });
  assert.equal(status.status, 200);

  // A mutation without an Origin is still refused, and so is a foreign Referer.
  const mutation = await request(port, '/api/v1/sync', {
    method: 'POST',
    headers: {
      ...noOrigin,
      'Content-Type': 'application/json',
      'X-ATnR-Session': session.value.session.sessionId,
      'X-ATnR-CSRF': session.value.session.csrfToken,
    },
    body: '{}',
  });
  assert.equal(mutation.status, 403);
  assert.equal(mutation.value.error.code, 'origin-not-allowed');

  const foreignReferer = await request(port, '/api/v1/status', {
    headers: {
      ...noOrigin,
      Referer: 'https://attacker.invalid/',
      'X-ATnR-Session': session.value.session.sessionId,
    },
  });
  assert.equal(foreignReferer.status, 403);
  assert.equal(foreignReferer.value.error.code, 'origin-not-allowed');
});

test('feedback route validation closes invalid ids, malformed bodies, and oversize drafts', async (t) => {
  const { capability, port } = await startPrivateServer(t);
  const session = await openSession(port, capability);
  const headers = browserHeaders(port, {
    'Content-Type': 'application/json',
    'X-ATnR-Session': session.sessionId,
    'X-ATnR-CSRF': session.csrfToken,
  });

  const badId = await request(port, '/api/v1/feedback/not%20allowed', { headers: browserHeaders(port, { 'X-ATnR-Session': session.sessionId }) });
  assert.equal(badId.status, 400);
  assert.equal(badId.value.error.code, 'invalid-book-id');

  const badBody = await request(port, '/api/v1/feedback/aud-us-book-one', {
    method: 'PUT',
    headers,
    body: JSON.stringify({ payload: { overallRating: 4.5 } }),
  });
  assert.equal(badBody.status, 400);
  assert.equal(badBody.value.error.code, 'invalid-field-type');

  const oversize = await request(port, '/api/v1/feedback/aud-us-book-one', {
    method: 'PUT',
    headers,
    body: JSON.stringify({ payload: { comment: 'a'.repeat(MAX_FEEDBACK_BODY_BYTES + 50) }, expectedRevision: 'rev-0-absent' }),
  });
  assert.equal(oversize.status, 413);
  assert.equal(oversize.value.error.code, 'request-body-too-large');
});
