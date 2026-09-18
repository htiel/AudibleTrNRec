/**
 * Unit tests for the local capability verifier (A2-WP015 / ATR-S015).
 *
 * These exercise the authority model directly: capability entropy, constant
 * shape, session lifetime, CSRF, and the confirmation-nonce state machine.
 * No process, file, or personal data is involved.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  LocalApiAuth,
  ROUTE_POLICY,
  CONFIRMABLE_ACTIONS,
  CONFIRMATION_LIFETIME_MS,
  MAX_ACTIVE_SESSIONS,
  MAX_CAPABILITY_FAILURES,
  SESSION_IDLE_LIFETIME_MS,
  SESSION_ABSOLUTE_LIFETIME_MS,
  capabilityDigest,
  evaluateBrowserMetadata,
  formatCapability,
  generateCapability,
  normalizeCapability,
  readCapabilityHeader,
} from '../src/security/local-api-auth.js';

function makeAuth() {
  let clock = 0;
  const capability = generateCapability();
  const auth = new LocalApiAuth({ digest: capability.digest, now: () => clock });
  return { auth, capability, advance: (ms) => { clock += ms; }, at: () => clock };
}

test('the capability carries 256 bits and is never stored in plaintext', () => {
  const first = generateCapability();
  const second = generateCapability();
  assert.notEqual(first.display, second.display);
  assert.equal(normalizeCapability(first.display).length, 52); // ceil(256/5)
  assert.equal(first.digest.length, 32);
  // Only a digest is retained; the instance exposes no capability material.
  const auth = new LocalApiAuth({ digest: first.digest });
  assert.equal(JSON.stringify(auth).includes(normalizeCapability(first.display)), false);
  assert.throws(() => new LocalApiAuth({ digest: Buffer.alloc(8) }), /digest-required/);
});

test('entry formatting is forgiving without reducing entropy', () => {
  const compact = 'ABCD2345EFGH';
  assert.equal(formatCapability(compact), 'ABCD-2345-EFGH');
  assert.equal(normalizeCapability('abcd-2345 efgh'), compact);
  assert.equal(normalizeCapability('ABCD01!8'), 'ABCD'); // 0, 1, 8 are not base32
  assert.equal(normalizeCapability(''), null);
  assert.equal(normalizeCapability('x'.repeat(513)), null);
  assert.deepEqual(capabilityDigest('abcd'), capabilityDigest('A-B-C-D'));
});

test('only the exact Authorization scheme is accepted', () => {
  assert.equal(readCapabilityHeader({ authorization: 'ATnR-Capability ABCD' }), 'ABCD');
  assert.equal(readCapabilityHeader({ authorization: 'Bearer ABCD' }), null);
  assert.equal(readCapabilityHeader({ authorization: 'atnr-capability ABCD' }), null);
  assert.equal(readCapabilityHeader({ authorization: ['ATnR-Capability ABCD'] }), null);
  assert.equal(readCapabilityHeader({}), null);
});

test('an absent credential does not consume the failure budget; a wrong one does', () => {
  const { auth, capability, advance } = makeAuth();
  assert.equal(auth.verifyCapability(null).code, 'local-api-capability-required');
  assert.equal(auth.failures, 0);

  assert.equal(auth.verifyCapability('AAAA-AAAA').code, 'local-api-capability-invalid');
  assert.equal(auth.failures, 1);
  assert.equal(auth.verifyCapability(capability.display).code, 'local-api-throttled');
  advance(2_000);
  assert.equal(auth.verifyCapability(capability.display).ok, true);
  // Success does not reset the budget: the window is per capability generation.
  assert.equal(auth.failures, 1);
});

test('the failure delay doubles and the lock is terminal', () => {
  const { auth, capability, advance } = makeAuth();
  const delays = [];
  for (let attempt = 1; attempt < MAX_CAPABILITY_FAILURES; attempt += 1) {
    auth.verifyCapability('AAAA-AAAA');
    delays.push(auth.failureDelayMs);
    advance(60_000);
  }
  assert.deepEqual(delays, [1_000, 2_000, 4_000, 8_000]);
  auth.verifyCapability('AAAA-AAAA');
  assert.equal(auth.locked, true);
  // The correct capability no longer works, and no session can be minted.
  assert.equal(auth.verifyCapability(capability.display).code, 'local-api-locked');
  assert.equal(auth.createSession(), null);
});

test('sessions are bounded in count, idle time, and absolute lifetime', () => {
  const { auth, advance } = makeAuth();
  const sessions = [];
  for (let i = 0; i < MAX_ACTIVE_SESSIONS + 1; i += 1) sessions.push(auth.createSession());
  // The oldest session was evicted when the ceiling was reached.
  assert.equal(auth.verifySession(sessions[0].sessionId).ok, false);
  assert.equal(auth.verifySession(sessions[MAX_ACTIVE_SESSIONS].sessionId).ok, true);

  const live = sessions[MAX_ACTIVE_SESSIONS];
  advance(SESSION_IDLE_LIFETIME_MS + 1);
  assert.equal(auth.verifySession(live.sessionId).code, 'local-api-session-invalid');

  const fresh = auth.createSession();
  for (let elapsed = 0; elapsed < SESSION_ABSOLUTE_LIFETIME_MS; elapsed += 60_000) {
    advance(60_000);
    auth.verifySession(fresh.sessionId); // stays active while used
  }
  advance(60_000);
  assert.equal(auth.verifySession(fresh.sessionId).code, 'local-api-session-invalid');
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

test('confirmation nonces are single-use, bound, and expire in 120 seconds', () => {
  const { auth, advance } = makeAuth();
  const session = auth.createSession();
  const other = auth.createSession();

  assert.equal(auth.issueConfirmation({ action: 'not-an-action', sessionId: session.sessionId }).code,
    'confirmation-action-invalid');

  const issued = auth.issueConfirmation({ action: 'delete-local', sessionId: session.sessionId });
  assert.equal(issued.expiresInMs, CONFIRMATION_LIFETIME_MS);

  // Another session may not spend it.
  assert.equal(
    auth.consumeConfirmation({ nonce: issued.nonce, action: 'delete-local', sessionId: other.sessionId }).code,
    'confirmation-binding-invalid',
  );

  const reissued = auth.issueConfirmation({ action: 'delete-local', sessionId: session.sessionId });
  // Re-issuing invalidates the previous nonce.
  assert.equal(
    auth.consumeConfirmation({ nonce: issued.nonce, action: 'delete-local', sessionId: session.sessionId }).code,
    'confirmation-invalid',
  );

  const again = auth.issueConfirmation({ action: 'delete-local', sessionId: session.sessionId });
  assert.equal(
    auth.consumeConfirmation({ nonce: again.nonce, action: 'delete-local', sessionId: session.sessionId }).ok,
    true,
  );
  assert.equal(
    auth.consumeConfirmation({ nonce: again.nonce, action: 'delete-local', sessionId: session.sessionId }).code,
    'confirmation-required',
  );
  void reissued;

  const expiring = auth.issueConfirmation({ action: 'export', sessionId: session.sessionId });
  advance(CONFIRMATION_LIFETIME_MS);
  assert.equal(
    auth.consumeConfirmation({ nonce: expiring.nonce, action: 'export', sessionId: session.sessionId }).code,
    'confirmation-required',
  );
});

test('an account/generation change invalidates every session and pending nonce', () => {
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
  // Export must never be weaker than a destructive action (ATR-S017).
  assert.equal(exportPolicy.session, destructive.session);
  assert.equal(exportPolicy.csrf, destructive.csrf);
  assert.equal(exportPolicy.reauth, destructive.reauth);
  assert.equal(exportPolicy.confirm, 'export');
  for (const action of CONFIRMABLE_ACTIONS) {
    assert.ok(Object.values(ROUTE_POLICY).some((p) => p.confirm === action));
  }
  // Read routes still require the capability and a session.
  assert.equal(ROUTE_POLICY['GET /api/v1/status'].session, true);
});

test('erasing a review carries its own destructive policy, not a borrowed one', () => {
  const deletion = ROUTE_POLICY['DELETE /api/v1/feedback'];
  const destructive = ROUTE_POLICY['POST /api/v1/delete-local'];
  assert.equal(deletion.class, 'destructive');
  assert.equal(deletion.session, destructive.session);
  assert.equal(deletion.csrf, destructive.csrf);
  assert.equal(deletion.reauth, destructive.reauth);
  assert.equal(deletion.confirm, 'delete-feedback');
  // It must never inherit the strength of the lifecycle routes it once reused.
  assert.equal(ROUTE_POLICY['POST /api/v1/sync'].reauth, false);
  assert.equal(ROUTE_POLICY['PUT /api/v1/feedback'].reauth, false);
  assert.ok(CONFIRMABLE_ACTIONS.includes('delete-feedback'));
});

test('a review-deletion nonce is bound to one record and one revision', () => {
  const { auth } = makeAuth();
  const session = auth.createSession();
  const resource = 'aud-us-book-one:rev-1-abc';
  const issued = auth.issueConfirmation({ action: 'delete-feedback', resource, sessionId: session.sessionId });
  assert.equal(issued.ok, true);

  // Another book cannot be erased with it, and neither can a newer revision.
  for (const other of ['aud-us-book-two:rev-1-abc', 'aud-us-book-one:rev-2-def']) {
    assert.equal(
      auth.consumeConfirmation({ nonce: issued.nonce, action: 'delete-feedback', resource: other, sessionId: session.sessionId }).code,
      'confirmation-required',
    );
  }
  // Another session holding the nonce cannot use it either.
  const other = auth.createSession();
  assert.equal(
    auth.consumeConfirmation({ nonce: issued.nonce, action: 'delete-feedback', resource, sessionId: other.sessionId }).code,
    'confirmation-binding-invalid',
  );

  const reissued = auth.issueConfirmation({ action: 'delete-feedback', resource, sessionId: session.sessionId });
  assert.equal(
    auth.consumeConfirmation({ nonce: reissued.nonce, action: 'delete-feedback', resource, sessionId: session.sessionId }).ok,
    true,
  );
  // Single use.
  assert.equal(
    auth.consumeConfirmation({ nonce: reissued.nonce, action: 'delete-feedback', resource, sessionId: session.sessionId }).code,
    'confirmation-required',
  );
});

test('resource-bound and generic confirmations may not be swapped', () => {
  const { auth } = makeAuth();
  const session = auth.createSession();
  // A record deletion may not be confirmed generically...
  assert.equal(
    auth.issueConfirmation({ action: 'delete-feedback', sessionId: session.sessionId }).code,
    'confirmation-resource-invalid',
  );
  // ...and a whole-library action may not carry a resource that consumption
  // would never look for.
  assert.equal(
    auth.issueConfirmation({ action: 'delete-local', resource: 'aud-us-book-one:rev-1', sessionId: session.sessionId }).code,
    'confirmation-resource-invalid',
  );
  assert.equal(
    auth.issueConfirmation({ action: 'erase-everything', resource: 'x', sessionId: session.sessionId }).code,
    'confirmation-action-invalid',
  );
});

test('authorize() refuses unknown routes before touching the capability', () => {
  const { auth, capability } = makeAuth();
  const decision = auth.authorize({
    method: 'POST',
    pathname: '/api/v1/nope',
    headers: { authorization: `ATnR-Capability ${capability.display}` },
    expectedOrigin: 'http://127.0.0.1:4310',
  });
  assert.equal(decision.code, 'api-route-not-found');
  assert.equal(auth.failures, 0);
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
  // A request with no fetch metadata at all (a non-browser client) fails closed.
  assert.equal(evaluateBrowserMetadata({}, { expectedOrigin: origin }), 'browser-metadata-rejected');
});

test('a browser-realistic same-origin GET without Origin is admitted; mutations still demand it', () => {
  const origin = 'http://127.0.0.1:4310';
  // Exactly what a browser sends for a same-origin fetch of a safe method:
  // Fetch Metadata present, no Origin header at all.
  const safe = {
    host: '127.0.0.1:4310',
    'sec-fetch-site': 'same-origin',
    'sec-fetch-mode': 'cors',
    'sec-fetch-dest': 'empty',
  };
  for (const method of ['GET', 'HEAD']) {
    assert.equal(evaluateBrowserMetadata(safe, { expectedOrigin: origin, method }), null);
  }
  // A safe method that does send Origin must still send the right one.
  assert.equal(evaluateBrowserMetadata({ ...safe, origin }, { expectedOrigin: origin, method: 'GET' }), null);
  assert.equal(
    evaluateBrowserMetadata({ ...safe, origin: 'http://127.0.0.1:9999' }, { expectedOrigin: origin, method: 'GET' }),
    'origin-not-allowed',
  );
  // Every state-changing method requires an exact Origin.
  for (const method of ['POST', 'PUT', 'DELETE', 'PATCH']) {
    assert.equal(
      evaluateBrowserMetadata(safe, { expectedOrigin: origin, method }),
      'origin-not-allowed',
      `${method} was admitted without an Origin`,
    );
    assert.equal(evaluateBrowserMetadata({ ...safe, origin }, { expectedOrigin: origin, method }), null);
  }
  // Fetch Metadata is still mandatory on a safe method: dropping Origin does
  // not open a metadata-free path.
  assert.equal(
    evaluateBrowserMetadata({ host: '127.0.0.1:4310' }, { expectedOrigin: origin, method: 'GET' }),
    'browser-metadata-rejected',
  );
  assert.equal(
    evaluateBrowserMetadata({ ...safe, 'sec-fetch-site': 'same-site' }, { expectedOrigin: origin, method: 'GET' }),
    'browser-metadata-rejected',
  );
});

test('a foreign Referer is refused even when Fetch Metadata claims same-origin', () => {
  const origin = 'http://127.0.0.1:4310';
  const base = {
    'sec-fetch-site': 'same-origin',
    'sec-fetch-mode': 'cors',
    'sec-fetch-dest': 'empty',
  };
  assert.equal(evaluateBrowserMetadata(base, { expectedOrigin: origin, method: 'GET' }), null);
  assert.equal(evaluateBrowserMetadata({ ...base, referer: origin }, { expectedOrigin: origin, method: 'GET' }), null);
  assert.equal(
    evaluateBrowserMetadata({ ...base, referer: `${origin}/?private-alpha=1` }, { expectedOrigin: origin, method: 'GET' }),
    null,
  );
  for (const referer of ['http://127.0.0.1:4310.attacker.invalid/', 'https://attacker.invalid/', '', 42]) {
    assert.equal(
      evaluateBrowserMetadata({ ...base, referer }, { expectedOrigin: origin, method: 'GET' }),
      'origin-not-allowed',
      `referer ${String(referer)} was admitted`,
    );
  }
});
