import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';

import {
  createStaticServer,
  PRIVATE_ALPHA_SECURITY_HEADERS,
} from '../scripts/serve.js';

function listen(server) {
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve(server.address().port));
  });
}

function request(port, target, { method = 'GET', headers = {}, body = '' } = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      host: '127.0.0.1',
      port,
      path: target,
      method,
      headers,
    }, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => resolve({
        status: res.statusCode,
        headers: res.headers,
        value: JSON.parse(Buffer.concat(chunks).toString('utf8')),
      }));
    });
    req.on('error', reject);
    req.end(body);
  });
}

test('private API is same-origin, CSRF-protected, and exposes fixed routes only', async (t) => {
  const calls = [];
  const service = {
    status: async () => ({ connected: false, commercialShippingBlocked: true, local: { itemCount: 0 } }),
    library: async () => null,
    connect: async (body) => { calls.push(['connect', body]); return { connected: true }; },
    sync: async () => { calls.push(['sync']); return { itemCount: 1 }; },
    disconnect: async () => { calls.push(['disconnect']); return { connected: false }; },
    deleteLocalSnapshot: () => { calls.push(['delete']); return { itemCount: 0 }; },
  };
  const csrfToken = 'synthetic-csrf-token-with-adequate-length';
  const server = createStaticServer({ privateAlphaService: service, csrfToken });
  const port = await listen(server);
  t.after(() => server.close());
  const origin = `http://127.0.0.1:${port}`;

  const status = await request(port, '/api/v1/status');
  assert.equal(status.status, 200);
  assert.equal(status.value.result.commercialShippingBlocked, true);
  assert.equal(
    status.headers['content-security-policy'],
    PRIVATE_ALPHA_SECURITY_HEADERS['content-security-policy'],
  );
  assert.match(status.headers['content-security-policy'], /connect-src 'self'/);

  const noToken = await request(port, '/api/v1/sync', {
    method: 'POST',
    headers: { Origin: origin, 'Content-Type': 'application/json' },
    body: '{}',
  });
  assert.equal(noToken.status, 403);
  assert.equal(noToken.value.error.code, 'csrf-token-invalid');

  const hostileOrigin = await request(port, '/api/v1/session', {
    headers: { Origin: 'https://attacker.invalid', 'Sec-Fetch-Site': 'cross-site' },
  });
  assert.equal(hostileOrigin.status, 403);
  assert.equal(hostileOrigin.value.error.code, 'origin-not-allowed');

  const connect = await request(port, '/api/v1/connect', {
    method: 'POST',
    headers: {
      Origin: origin,
      'Content-Type': 'application/json',
      'X-ATnR-CSRF': csrfToken,
    },
    body: JSON.stringify({ accountAlias: 'Synthetic account' }),
  });
  assert.equal(connect.status, 200);
  assert.deepEqual(calls, [['connect', { accountAlias: 'Synthetic account' }]]);

  const unknown = await request(port, '/api/v1/unknown', {
    method: 'POST',
    headers: {
      Origin: origin,
      'Content-Type': 'application/json',
      'X-ATnR-CSRF': csrfToken,
    },
    body: '{}',
  });
  assert.equal(unknown.status, 404);
  assert.equal(unknown.value.error.code, 'api-route-not-found');
});

test('synthetic server does not expose the private API', async (t) => {
  const server = createStaticServer();
  const port = await listen(server);
  t.after(() => server.close());

  const response = await new Promise((resolve, reject) => {
    http.get({ host: '127.0.0.1', port, path: '/api/v1/status' }, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => resolve({
        status: res.statusCode,
        body: Buffer.concat(chunks).toString('utf8'),
      }));
    }).on('error', reject);
  });
  assert.equal(response.status, 404);
  assert.equal(response.body, 'Not found');
});
