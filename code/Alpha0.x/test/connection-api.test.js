import test from 'node:test';
import assert from 'node:assert/strict';

import { ConnectionApi, ConnectionApiError } from '../ui/js/connection-api.js';

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

function recordingFetch(requests, respond) {
  return async (url, options = {}) => {
    requests.push({
      url,
      method: options.method ?? 'GET',
      headers: options.headers ?? {},
      body: options.body ?? null,
    });
    return respond(url, options);
  };
}

function makeApi() {
  return new ConnectionApi({
    sessionId: 'session-123',
    csrfToken: 'csrf-12345678901234567890123456789012',
  });
}

function destructiveResponder(result) {
  return (url) => {
    if (url === '/api/v1/confirmation') {
      return jsonResponse({
        ok: true,
        result: { confirmation: 'nonce-12345678901234567890', expiresInMs: 120_000 },
      });
    }
    return jsonResponse({ ok: true, result });
  };
}

test('discover obtains a browser session without a local key prompt', async () => {
  const calls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options = {}) => {
    calls.push([url, options.method ?? 'GET', options.headers ?? {}]);
    return jsonResponse({
      ok: true,
      session: {
        sessionId: 'session-12345678901234567890',
        csrfToken: 'csrf-12345678901234567890123456789012',
        runtime: { dataSource: 'local-encrypted', synthetic: false },
      },
    });
  };
  try {
    const api = await ConnectionApi.discover();
    assert.ok(api instanceof ConnectionApi);
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], '/api/v1/session');
  assert.equal(calls[0][2].Authorization, undefined);
});

test('discover refuses an unverified runtime source', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => jsonResponse({
    ok: true,
    session: {
      sessionId: 'session-12345678901234567890',
      csrfToken: 'csrf-12345678901234567890123456789012',
      runtime: { dataSource: 'synthetic-fixture', synthetic: true },
    },
  });
  try {
    await assert.rejects(
      ConnectionApi.discover(),
      (error) => error instanceof ConnectionApiError && error.code === 'private-alpha-runtime-source-refused',
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('feedback read and save use the session and csrf contract', async () => {
  const requests = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = recordingFetch(requests, (url, options) => {
    if (options.method === 'GET') {
      return jsonResponse({ ok: true, result: { bookId: 'aud-us-book-one', record: null, revision: 'rev-0-absent' } });
    }
    return jsonResponse({ ok: true, result: { bookId: 'aud-us-book-one', revision: 'rev-1' } });
  });
  try {
    const api = makeApi();
    await api.feedbackGet('aud-us-book-one');
    await api.feedbackSave('aud-us-book-one', { overallRating: 4.5 }, 'rev-0-absent');
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.equal(requests[0].headers['X-ATnR-Session'], 'session-123');
  assert.equal(requests[0].headers['X-ATnR-CSRF'], undefined);
  assert.equal(requests[1].headers['X-ATnR-CSRF'], 'csrf-12345678901234567890123456789012');
  for (const request of requests) {
    assert.equal(request.headers.Authorization, undefined);
  }
});

test('feedback list hydrates saved reviews with one session-authenticated request', async () => {
  const requests = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = recordingFetch(requests, () => jsonResponse({
    ok: true,
    result: [{ bookId: 'aud-us-book-one', revision: 'rev-1' }],
  }));
  try {
    const result = await makeApi().feedbackList();
    assert.equal(result.length, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.deepEqual(
    requests.map(({ method, url }) => [method, url]),
    [['GET', '/api/v1/feedback']],
  );
  assert.equal(requests[0].headers['X-ATnR-Session'], 'session-123');
  assert.equal(requests[0].headers['X-ATnR-CSRF'], undefined);
});

for (const [label, action] of [
  ['disconnect', (api) => api.disconnect()],
  ['delete-local', (api) => api.deleteLocal()],
  ['delete-all', (api) => api.deleteAllLocal()],
  ['export', (api) => api.exportAll()],
]) {
  test(`the confirmed ${label} flow uses a session-bound nonce without a key prompt`, async () => {
    const requests = [];
    const originalFetch = globalThis.fetch;
    globalThis.fetch = recordingFetch(requests, destructiveResponder({ connected: false }));
    try {
      await action(makeApi());
    } finally {
      globalThis.fetch = originalFetch;
    }
    assert.equal(requests.length, 2);
    assert.equal(requests[0].url, '/api/v1/confirmation');
    assert.equal(JSON.parse(requests[0].body).action, label);
    assert.equal(requests[1].headers['X-ATnR-CSRF'], 'csrf-12345678901234567890123456789012');
    assert.equal(JSON.parse(requests[1].body).confirmation, 'nonce-12345678901234567890');
  });
}

test('erasing a review binds the nonce to the record and revision', async () => {
  const requests = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = recordingFetch(
    requests,
    destructiveResponder({ bookId: 'aud-us-book-one', revision: 'rev-2', deleted: true }),
  );
  try {
    const result = await makeApi().feedbackDelete('aud-us-book-one', 'rev-1');
    assert.equal(result.deleted, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.deepEqual(
    requests.map(({ method, url }) => [method, url]),
    [['POST', '/api/v1/confirmation'], ['DELETE', '/api/v1/feedback/aud-us-book-one']],
  );
  assert.equal(JSON.parse(requests[0].body).resource, 'aud-us-book-one:rev-1');
  assert.equal(JSON.parse(requests[1].body).expectedRevision, 'rev-1');
});

test('nothing exports without an explicit export call', async () => {
  const requests = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = recordingFetch(requests, () => jsonResponse({ ok: true, result: {} }));
  try {
    const api = makeApi();
    await api.status();
    await api.library();
    await api.sync();
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.equal(requests.some(({ url }) => url === '/api/v1/export'), false);
});

test('an export request carries only its confirmation nonce', async () => {
  const requests = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = recordingFetch(
    requests,
    destructiveResponder({ document: { exportSchemaVersion: 1 }, feedbackIncluded: true }),
  );
  try {
    const result = await makeApi().exportAll();
    assert.equal(result.document.exportSchemaVersion, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.deepEqual(Object.keys(JSON.parse(requests[0].body)), ['action']);
  assert.deepEqual(Object.keys(JSON.parse(requests[1].body)), ['confirmation']);
});

test('a failed nonce issuance never reaches the destructive route', async () => {
  const requests = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = recordingFetch(
    requests,
    () => jsonResponse({ ok: false, error: { code: 'confirmation-resource-invalid' } }, 400),
  );
  try {
    await assert.rejects(
      () => makeApi().feedbackDelete('aud-us-book-one', 'rev-1'),
      (error) => error instanceof ConnectionApiError && error.code === 'confirmation-resource-invalid',
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, '/api/v1/confirmation');
});
