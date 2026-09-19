/**
 * Browser-session and destructive-confirmation tests for the owner-only
 * loopback prototype. No personal data or connector process is involved.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  LocalApiAuth,
  ROUTE_POLICY,
  CONFIRMABLE_ACTIONS,
  CONFIRMATION_LIFETIME_MS,
  MAX_ACTIVE_SESSIONS,
  MAX_SESSION_MINTS_PER_MINUTE,
  SESSION_IDLE_LIFETIME_MS,
  SESSION_ABSOLUTE_LIFETIME_MS,
  evaluateBrowserMetadata,
} from '../src/security/local-api-auth.js';

function makeAuth() {
  let clock = 0;
  const auth = new LocalApiAuth({ now: () => clock });
  return { auth, advance: (ms) => { clock += ms; } };
}

test('sessions are bounded in count, idle time, and absolute lifetime', () => {
  const { auth, advance } = makeAuth();
  const sessions = [];
  for (let i = 0; i < MAX_SESSION_MINTS_PER_MINUTE; i += 1) sessions.push(auth.createSession());
  assert.equal(auth.createSession(), null);
  assert.equal(auth.verifySession(sessions[0].sessionId).ok, true);

  const live = sessions.at(-1);
  advance(SESSION_IDLE_LIFETIME_MS + 1);
  assert.equal(auth.verifySession(live.sessionId).code, 'local-api-session-invalid');

  const fresh = auth.createSession();
  for (let elapsed = 0; elapsed < SESSION_ABSOLUTE_LIFETIME_MS; elapsed += 60_000) {
    advance(60_000);
    auth.verifySession(fresh.sessionId);
  }
  advance(60_000);
  assert.equal(auth.verifySession(fresh.sessionId).code, 'local-api-session-invalid');
  assert.ok(MAX_ACTIVE_SESSIONS > MAX_SESSION_MINTS_PER_MINUTE);
});

test('CSRF is verified by digest and only when the route demands it', () => {
  const { auth } = makeAuth();
  const session = auth.createSession();
  assert.equal(auth.verifySession(session.sessionId, { requireCsrf: false }).ok, true);
  assert.equal(
    auth.verifySession(session.sessionId, { requireCsrf: true, csrfToken: 'wrong' }).code,
    'csrf-token-invalid',
  );
  assert.equal(
    auth.verifySession(session.sessionId, { requireCsrf: true, csrfToken: session.csrfToken }).ok,
    true,
  );
  assert.equal(auth.verifySession('fabricated-session-id').code, 'local-api-session-invalid');
});

test('confirmation nonces are single-use, session-bound, and expire', () => {
  const { auth, advance } = makeAuth();
  const session = auth.createSession();
  const other = auth.createSession();
  assert.equal(
    auth.issueConfirmation({ action: 'not-an-action', sessionId: session.sessionId }).code,
    'confirmation-action-invalid',
  );

  const issued = auth.issueConfirmation({ action: 'delete-local', sessionId: session.sessionId });
  assert.equal(issued.expiresInMs, CONFIRMATION_LIFETIME_MS);
  assert.equal(
    auth.consumeConfirmation({ nonce: issued.nonce, action: 'delete-local', sessionId: other.sessionId }).code,
    'confirmation-binding-invalid',
  );

  const valid = auth.issueConfirmation({ action: 'delete-local', sessionId: session.sessionId });
  assert.equal(
    auth.consumeConfirmation({ nonce: valid.nonce, action: 'delete-local', sessionId: session.sessionId }).ok,
    true,
  );
  assert.equal(
    auth.consumeConfirmation({ nonce: valid.nonce, action: 'delete-local', sessionId: session.sessionId }).code,
    'confirmation-required',
  );

  const expiring = auth.issueConfirmation({ action: 'export', sessionId: session.sessionId });
  advance(CONFIRMATION_LIFETIME_MS);
  assert.equal(
    auth.consumeConfirmation({ nonce: expiring.nonce, action: 'export', sessionId: session.sessionId }).code,
    'confirmation-required',
  );
});

test('an account generation change invalidates sessions and pending nonces', () => {
  const { auth } = makeAuth();
  const session = auth.createSession();
  const issued = auth.issueConfirmation({ action: 'disconnect', sessionId: session.sessionId });
  auth.invalidateBindings();
  assert.equal(auth.verifySession(session.sessionId).code, 'local-api-session-invalid');
  assert.equal(
    auth.consumeConfirmation({ nonce: issued.nonce, action: 'disconnect', sessionId: session.sessionId }).code,
    'confirmation-required',
  );
});

test('the route policy is closed and export carries destructive strength', () => {
  for (const [route, policy] of Object.entries(ROUTE_POLICY)) {
    assert.match(route, /^(GET|PUT|POST|DELETE) \/api\/v1\/[a-z-]+$/);
    assert.equal(Object.isFrozen(policy), true);
  }
  const exportPolicy = ROUTE_POLICY['POST /api/v1/export'];
  const destructive = ROUTE_POLICY['POST /api/v1/delete-local'];
  assert.equal(exportPolicy.session, destructive.session);
  assert.equal(exportPolicy.csrf, destructive.csrf);
  assert.equal(exportPolicy.confirm, 'export');
  for (const action of CONFIRMABLE_ACTIONS) {
    assert.ok(Object.values(ROUTE_POLICY).some((policy) => policy.confirm === action));
  }
});

test('erasing a review has its own destructive policy', () => {
  const deletion = ROUTE_POLICY['DELETE /api/v1/feedback'];
  const destructive = ROUTE_POLICY['POST /api/v1/delete-local'];
  assert.equal(deletion.class, 'destructive');
  assert.equal(deletion.session, destructive.session);
  assert.equal(deletion.csrf, destructive.csrf);
  assert.equal(deletion.confirm, 'delete-feedback');
});

test('a review-deletion nonce is bound to one record and revision', () => {
  const { auth } = makeAuth();
  const session = auth.createSession();
  const resource = 'aud-us-book-one:rev-1-abc';
  const issued = auth.issueConfirmation({ action: 'delete-feedback', resource, sessionId: session.sessionId });
  assert.equal(issued.ok, true);
  for (const other of ['aud-us-book-two:rev-1-abc', 'aud-us-book-one:rev-2-def']) {
    assert.equal(
      auth.consumeConfirmation({ nonce: issued.nonce, action: 'delete-feedback', resource: other, sessionId: session.sessionId }).code,
      'confirmation-required',
    );
  }
  const reissued = auth.issueConfirmation({ action: 'delete-feedback', resource, sessionId: session.sessionId });
  assert.equal(
    auth.consumeConfirmation({ nonce: reissued.nonce, action: 'delete-feedback', resource, sessionId: session.sessionId }).ok,
    true,
  );
});

test('resource-bound and generic confirmations may not be swapped', () => {
  const { auth } = makeAuth();
  const session = auth.createSession();
  assert.equal(
    auth.issueConfirmation({ action: 'delete-feedback', sessionId: session.sessionId }).code,
    'confirmation-resource-invalid',
  );
  assert.equal(
    auth.issueConfirmation({ action: 'delete-local', resource: 'book:rev-1', sessionId: session.sessionId }).code,
    'confirmation-resource-invalid',
  );
});

test('authorize refuses unknown routes before session evaluation', () => {
  const { auth } = makeAuth();
  const decision = auth.authorize({
    method: 'POST',
    pathname: '/api/v1/nope',
    headers: {},
    expectedOrigin: 'http://127.0.0.1:4310',
  });
  assert.equal(decision.code, 'api-route-not-found');
});

test('fetch metadata rejects cross-site, navigation, and origin mismatch', () => {
  const origin = 'http://127.0.0.1:4310';
  const good = {
    'sec-fetch-site': 'same-origin',
    'sec-fetch-mode': 'cors',
    'sec-fetch-dest': 'empty',
    origin,
  };
  assert.equal(evaluateBrowserMetadata(good, { expectedOrigin: origin }), null);
  assert.equal(
    evaluateBrowserMetadata({ ...good, 'sec-fetch-site': 'cross-site' }, { expectedOrigin: origin }),
    'browser-metadata-rejected',
  );
  assert.equal(
    evaluateBrowserMetadata({ ...good, 'sec-fetch-dest': 'document' }, { expectedOrigin: origin }),
    'browser-metadata-rejected',
  );
  assert.equal(
    evaluateBrowserMetadata({ ...good, origin: 'http://127.0.0.1:9999' }, { expectedOrigin: origin }),
    'origin-not-allowed',
  );
  assert.equal(evaluateBrowserMetadata({}, { expectedOrigin: origin }), 'browser-metadata-rejected');
});

test('same-origin safe reads may omit Origin; mutations may not', () => {
  const origin = 'http://127.0.0.1:4310';
  const safe = {
    host: '127.0.0.1:4310',
    'sec-fetch-site': 'same-origin',
    'sec-fetch-mode': 'cors',
    'sec-fetch-dest': 'empty',
  };
  for (const method of ['GET', 'HEAD']) {
    assert.equal(evaluateBrowserMetadata(safe, { expectedOrigin: origin, method }), null);
  }
  for (const method of ['POST', 'PUT', 'DELETE', 'PATCH']) {
    assert.equal(evaluateBrowserMetadata(safe, { expectedOrigin: origin, method }), 'origin-not-allowed');
    assert.equal(evaluateBrowserMetadata({ ...safe, origin }, { expectedOrigin: origin, method }), null);
  }
});

test('a foreign Referer is refused even with same-origin fetch metadata', () => {
  const origin = 'http://127.0.0.1:4310';
  const base = {
    'sec-fetch-site': 'same-origin',
    'sec-fetch-mode': 'cors',
    'sec-fetch-dest': 'empty',
  };
  assert.equal(evaluateBrowserMetadata(base, { expectedOrigin: origin, method: 'GET' }), null);
  assert.equal(
    evaluateBrowserMetadata({ ...base, referer: 'http://evil.invalid/' }, { expectedOrigin: origin, method: 'GET' }),
    'origin-not-allowed',
  );
});
