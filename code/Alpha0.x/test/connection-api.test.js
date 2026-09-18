import test from 'node:test';
import assert from 'node:assert/strict';

import { ConnectionApi, ConnectionApiError } from '../ui/js/connection-api.js';

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

test('discover refuses an unverified runtime source instead of loading private mode', async () => {
  const calls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options = {}) => {
    calls.push([url, options.method ?? 'GET', options.headers ?? {}]);
    if (calls.length === 1) return jsonResponse({ ok: false, error: { code: 'local-api-capability-required' } }, 401);
    return jsonResponse({
      ok: true,
      session: {
        sessionId: 'session-12345678901234567890',
        csrfToken: 'csrf-12345678901234567890123456789012',
        runtime: { dataSource: 'synthetic-fixture', synthetic: true },
      },
    });
  };
  try {
    await assert.rejects(
      ConnectionApi.discover({ requestCapability: async () => 'capability-token' }),
      (error) => error instanceof ConnectionApiError && error.code === 'private-alpha-runtime-source-refused',
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.equal(calls.length, 2);
});

test('feedback read and save use the authenticated session and csrf contract', async () => {
  const requests = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options = {}) => {
    requests.push({ url, method: options.method ?? 'GET', headers: options.headers ?? {}, body: options.body ?? null });
    if (url === '/api/v1/feedback/aud-us-book-one' && options.method === 'GET') {
      return jsonResponse({ ok: true, result: { bookId: 'aud-us-book-one', record: null, revision: 'rev-0-absent', generation: 0, deleted: false } });
    }
    if (url === '/api/v1/feedback/aud-us-book-one' && options.method === 'PUT') {
      return jsonResponse({ ok: true, result: { bookId: 'aud-us-book-one', revision: 'rev-1', generation: 1, deleted: false, record: { overallRating: 4.5, storyRating: null, narrationRating: null, comment: 'held up', tags: ['favorite'], createdAt: '2026-09-17T12:00:00.000Z', updatedAt: '2026-09-17T12:00:00.000Z' } } });
    }
    throw new Error(`unexpected request: ${options.method ?? 'GET'} ${url}`);
  };

  try {
    const api = new ConnectionApi({
      capability: 'capability-token',
      sessionId: 'session-123',
      csrfToken: 'csrf-12345678901234567890123456789012',
      requestCapability: async () => 'unused',
    });

    await api.feedbackGet('aud-us-book-one');
    await api.feedbackSave('aud-us-book-one', { overallRating: 4.5, comment: 'held up', tags: ['favorite'] }, 'rev-0-absent');
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.deepEqual(
    requests.map(({ url, method }) => [method, url]),
    [
      ['GET', '/api/v1/feedback/aud-us-book-one'],
      ['PUT', '/api/v1/feedback/aud-us-book-one'],
    ],
  );
  for (const request of requests) {
    assert.equal(request.headers.Authorization, 'ATnR-Capability capability-token');
    assert.equal(request.headers['X-ATnR-Session'], 'session-123');
    // A read or a save must never carry destructive re-authentication.
    assert.equal(request.headers['X-ATnR-Reauth'], undefined);
  }
  assert.equal(requests[0].headers['X-ATnR-CSRF'], undefined);
  assert.equal(requests[1].headers['X-ATnR-CSRF'], 'csrf-12345678901234567890123456789012');
  assert.equal(JSON.parse(requests[1].body).expectedRevision, 'rev-0-absent');
});

/** Record every request the production client actually issues. */
function recordingFetch(requests, respond) {
  return async (url, options = {}) => {
    requests.push({ url, method: options.method ?? 'GET', headers: options.headers ?? {}, body: options.body ?? null });
    return respond(url, options);
  };
}

function destructiveResponder(result) {
  return (url, options) => {
    if (url === '/api/v1/confirmation') return jsonResponse({ ok: true, result: { confirmation: 'nonce-12345678901234567890', expiresInMs: 120_000 } });
    return jsonResponse({ ok: true, result });
  };
}

for (const [label, action] of [
  ['disconnect', (api) => api.disconnect()],
  ['delete-local', (api) => api.deleteLocal()],
  ['delete-all', (api) => api.deleteAllLocal()],
  ['export', (api) => api.exportAll()],
]) {
  test(`the confirmed ${label} flow re-authenticates the destructive request itself`, async () => {
    const requests = [];
    const prompts = [];
    const originalFetch = globalThis.fetch;
    globalThis.fetch = recordingFetch(requests, destructiveResponder({ connected: false }));
    try {
      const api = new ConnectionApi({
        capability: 'capability-token',
        sessionId: 'session-123',
        csrfToken: 'csrf-12345678901234567890123456789012',
        requestCapability: async (options) => { prompts.push(options.purpose); return 'reentered-capability'; },
      });
      await action(api);
    } finally {
      globalThis.fetch = originalFetch;
    }

    assert.deepEqual(prompts, ['confirm']);
    assert.equal(requests.length, 2);
    const [issuance, destructive] = requests;
    assert.equal(issuance.url, '/api/v1/confirmation');
    assert.equal(JSON.parse(issuance.body).action, label);
    // The defect: re-authentication was sent for issuance only, so the
    // destructive call itself arrived without it and could never succeed.
    assert.equal(issuance.headers['X-ATnR-Reauth'], 'reentered-capability');
    assert.equal(destructive.headers['X-ATnR-Reauth'], 'reentered-capability');
    assert.equal(destructive.headers['X-ATnR-CSRF'], 'csrf-12345678901234567890123456789012');
    assert.equal(JSON.parse(destructive.body).confirmation, 'nonce-12345678901234567890');
  });
}

test('erasing a review re-authenticates, confirms, and binds the nonce to the record', async () => {
  const requests = [];
  const prompts = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = recordingFetch(requests, destructiveResponder({ bookId: 'aud-us-book-one', revision: 'rev-2', generation: 2, deleted: true, record: null }));
  try {
    const api = new ConnectionApi({
      capability: 'capability-token',
      sessionId: 'session-123',
      csrfToken: 'csrf-12345678901234567890123456789012',
      requestCapability: async (options) => { prompts.push(options.purpose); return 'reentered-capability'; },
    });
    const result = await api.feedbackDelete('aud-us-book-one', 'rev-1');
    assert.equal(result.deleted, true);
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.deepEqual(prompts, ['confirm']);
  assert.deepEqual(
    requests.map(({ method, url }) => [method, url]),
    [['POST', '/api/v1/confirmation'], ['DELETE', '/api/v1/feedback/aud-us-book-one']],
  );
  const issuance = JSON.parse(requests[0].body);
  assert.equal(issuance.action, 'delete-feedback');
  assert.equal(issuance.resource, 'aud-us-book-one:rev-1');
  for (const request of requests) {
    assert.equal(request.headers['X-ATnR-Reauth'], 'reentered-capability');
    assert.equal(request.headers['X-ATnR-CSRF'], 'csrf-12345678901234567890123456789012');
  }
  const deletion = JSON.parse(requests[1].body);
  assert.deepEqual(Object.keys(deletion).sort(), ['confirmation', 'expectedRevision']);
  assert.equal(deletion.expectedRevision, 'rev-1');
});

test('a cancelled confirmation performs no destructive request at all', async () => {
  const requests = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = recordingFetch(requests, destructiveResponder({ deleted: true }));
  try {
    const api = new ConnectionApi({
      capability: 'capability-token',
      sessionId: 'session-123',
      csrfToken: 'csrf-12345678901234567890123456789012',
      requestCapability: async () => null,
    });
    for (const attempt of [() => api.feedbackDelete('aud-us-book-one', 'rev-1'), () => api.deleteLocal(), () => api.deleteAllLocal(), () => api.exportAll(), () => api.disconnect()]) {
      await assert.rejects(attempt, (error) => error instanceof ConnectionApiError && error.code === 'local-api-confirmation-cancelled');
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.deepEqual(requests, []);
});

test('nothing exports without an explicit user-triggered call', async () => {
  const requests = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = recordingFetch(requests, () => jsonResponse({ ok: true, result: {} }));
  try {
    const api = new ConnectionApi({
      capability: 'capability-token',
      sessionId: 'session-123',
      csrfToken: 'csrf-12345678901234567890123456789012',
      requestCapability: async () => { throw new Error('a capability prompt must not appear for a read'); },
    });
    await api.status();
    await api.library();
    await api.sync();
  } finally {
    globalThis.fetch = originalFetch;
  }
  // An export is a complete copy of private history leaving the store. It
  // happens only when the owner asks for it — never on startup, on a timer, or
  // as a side effect of a read or a sync.
  assert.equal(requests.some(({ url }) => url === '/api/v1/export'), false);
});

test('an export request carries the nonce and nothing else', async () => {
  const requests = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = recordingFetch(requests, destructiveResponder({ document: { exportSchemaVersion: 1 }, feedbackIncluded: true, libraryRetained: true }));
  try {
    const api = new ConnectionApi({
      capability: 'capability-token',
      sessionId: 'session-123',
      csrfToken: 'csrf-12345678901234567890123456789012',
      requestCapability: async () => 'reentered-capability',
    });
    const result = await api.exportAll();
    assert.equal(result.document.exportSchemaVersion, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
  const [issuance, exportRequest] = requests;
  assert.deepEqual(Object.keys(JSON.parse(issuance.body)), ['action']);
  assert.deepEqual(Object.keys(JSON.parse(exportRequest.body)), ['confirmation']);
  assert.equal(exportRequest.method, 'POST');
  assert.equal(exportRequest.url, '/api/v1/export');
});

test('a failed nonce issuance never reaches the destructive route', async () => {
  const requests = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = recordingFetch(requests, () => jsonResponse({ ok: false, error: { code: 'confirmation-resource-invalid' } }, 400));
  try {
    const api = new ConnectionApi({
      capability: 'capability-token',
      sessionId: 'session-123',
      csrfToken: 'csrf-12345678901234567890123456789012',
      requestCapability: async () => 'reentered-capability',
    });
    await assert.rejects(
      () => api.feedbackDelete('aud-us-book-one', 'rev-1'),
      (error) => error instanceof ConnectionApiError && error.code === 'confirmation-resource-invalid',
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, '/api/v1/confirmation');
});
