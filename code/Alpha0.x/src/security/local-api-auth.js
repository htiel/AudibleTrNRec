/**
 * Browser-session protection for the owner-only loopback prototype.
 *
 * The project owner explicitly accepts that other processes running as the
 * same Windows user can reach this prototype. The stronger per-start manual
 * capability was removed because this build is not distributed and will be
 * replaced by a native iPhone implementation.
 *
 * The remaining controls still bind the server to loopback, reject foreign
 * browser origins and fetch metadata, require bounded browser sessions and
 * CSRF tokens, and use single-use action/resource/revision-bound nonces for
 * destructive operations. This is not a production authentication boundary.
 */

import { randomBytes, createHash, timingSafeEqual } from 'node:crypto';

export const CONFIRMATION_LIFETIME_MS = 120_000;
export const MAX_ACTIVE_SESSIONS = 64;
export const MAX_SESSION_MINTS_PER_MINUTE = 16;
export const SESSION_ABSOLUTE_LIFETIME_MS = 12 * 60 * 60 * 1_000;
export const SESSION_IDLE_LIFETIME_MS = 60 * 60 * 1_000;

export const SESSION_HEADER = 'x-atnr-session';
export const CSRF_HEADER = 'x-atnr-csrf';

/**
 * Closed route policy. Export and destructive operations require a fresh
 * single-use confirmation nonce in addition to the browser session and CSRF
 * token. Routes absent from this table do not exist.
 */
export const ROUTE_POLICY = Object.freeze({
  'GET /api/v1/session': Object.freeze({ class: 'bootstrap', session: false, csrf: false, confirm: null }),
  'GET /api/v1/status': Object.freeze({ class: 'read', session: true, csrf: false, confirm: null }),
  'GET /api/v1/library': Object.freeze({ class: 'read', session: true, csrf: false, confirm: null }),
  // The deletion inventory is read-strength: it is what the owner reads in
  // order to consent to an erasure, so demanding a nonce to see it would make
  // informed consent harder than the destructive act it precedes. It still
  // requires a live session like every other read.
  'GET /api/v1/inventory': Object.freeze({ class: 'read', session: true, csrf: false, confirm: null }),
  'GET /api/v1/feedback': Object.freeze({ class: 'read', session: true, csrf: false, confirm: null }),
  'PUT /api/v1/feedback': Object.freeze({ class: 'lifecycle', session: true, csrf: true, confirm: null }),
  // Erasing a review is destructive and irreversible for that record, so it
  // carries destructive authority in its own right. It must never borrow a
  // lifecycle policy from another route.
  'DELETE /api/v1/feedback': Object.freeze({ class: 'destructive', session: true, csrf: true, confirm: 'delete-feedback' }),
  'POST /api/v1/connect': Object.freeze({ class: 'lifecycle', session: true, csrf: true, confirm: null }),
  'POST /api/v1/sync': Object.freeze({ class: 'lifecycle', session: true, csrf: true, confirm: null }),
  'POST /api/v1/confirmation': Object.freeze({ class: 'confirmation', session: true, csrf: true, confirm: null }),
  'POST /api/v1/export': Object.freeze({ class: 'export', session: true, csrf: true, confirm: 'export' }),
  'POST /api/v1/disconnect': Object.freeze({ class: 'destructive', session: true, csrf: true, confirm: 'disconnect' }),
  'POST /api/v1/delete-local': Object.freeze({ class: 'destructive', session: true, csrf: true, confirm: 'delete-local' }),
  // Complete local erasure: snapshot, sync state, every review and tombstone,
  // the ownership anchor and the retained rollback envelope. It is deliberately
  // a *separate* route from `delete-local`, because the snapshot-only control
  // is labelled and described as snapshot-only. One nonce must never be able to
  // satisfy both: a user who confirmed "delete the snapshot" has not consented
  // to erasing their private reviews.
  'POST /api/v1/delete-all': Object.freeze({ class: 'destructive', session: true, csrf: true, confirm: 'delete-all' }),
});

/** Actions for which a confirmation nonce may be issued. Closed set. */
export const CONFIRMABLE_ACTIONS = Object.freeze(['export', 'disconnect', 'delete-local', 'delete-all', 'delete-feedback']);

/**
 * Actions whose nonce must additionally be bound to a specific resource. A
 * nonce issued for one record can therefore never erase another, and a nonce
 * issued for a stale revision cannot erase a newer one.
 */
export const RESOURCE_BOUND_ACTIONS = Object.freeze(['delete-feedback']);

/** Methods a browser may issue without an `Origin` header. */
export const SAFE_METHODS = Object.freeze(['GET', 'HEAD']);

function constantTimeEquals(left, right) {
  if (!Buffer.isBuffer(left) || !Buffer.isBuffer(right) || left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

function monotonicNow() {
  return Number(process.hrtime.bigint() / 1_000_000n);
}

function singleHeader(headers, name) {
  const raw = headers?.[name];
  return typeof raw === 'string' && raw.length > 0 && raw.length <= 512 ? raw : null;
}

/**
 * A `Referer`, when the browser sends one, must name this exact origin.
 * Absence is normal under a strict referrer policy and is not evidence of
 * anything, so it is permitted; a foreign value never is.
 */
function refererIsSameOrigin(referer, expectedOrigin) {
  if (referer === undefined) return true;
  if (typeof referer !== 'string' || referer.length > 2048) return false;
  return referer === expectedOrigin || referer.startsWith(`${expectedOrigin}/`);
}

/**
 * Fetch-metadata, Origin and Referer policy for protected routes. Defence in
 * depth: passing this check authenticates nothing, and a failure fails closed.
 *
 * Same-origin Fetch Metadata plus the already-verified Host/port is what
 * establishes locality for a safe method. Browsers legitimately omit `Origin`
 * on a same-origin `GET`/`HEAD`, so demanding it there would have broken the
 * real bootstrap while adding no authority. Every state-changing method still
 * requires an exact `Origin`.
 */
export function evaluateBrowserMetadata(headers, { expectedOrigin, method = 'POST' } = {}) {
  const site = headers['sec-fetch-site'];
  const mode = headers['sec-fetch-mode'];
  const dest = headers['sec-fetch-dest'];
  if (site !== 'same-origin') return 'browser-metadata-rejected';
  if (mode !== 'cors' && mode !== 'same-origin') return 'browser-metadata-rejected';
  if (dest !== 'empty') return 'browser-metadata-rejected';

  const origin = headers.origin;
  const safe = SAFE_METHODS.includes(method);
  if (origin === undefined) {
    // A mutation without an Origin is never accepted.
    if (!safe) return 'origin-not-allowed';
  } else if (typeof origin !== 'string' || origin !== expectedOrigin) {
    return 'origin-not-allowed';
  }
  if (!refererIsSameOrigin(headers.referer, expectedOrigin)) return 'origin-not-allowed';
  return null;
}

export class LocalApiAuth {
  #sessions = new Map();

  #confirmations = new Map();

  #sessionMints = [];

  constructor({ now = monotonicNow, accountGeneration = 0 } = {}) {
    this.now = now;
    this.accountGeneration = accountGeneration;
  }

  /**
   * Account/generation change invalidates every session and pending nonce.
   *
   * Use this only for a transition that changes *whose* data this is, or that
   * invalidates the state every outstanding authorization was granted against:
   * connect, disconnect, and complete local erasure. The browser obtains a new
   * session after reload because the previous one was bound to a world that no
   * longer exists.
   */
  invalidateBindings(accountGeneration = this.accountGeneration + 1) {
    this.accountGeneration = accountGeneration;
    this.#sessions.clear();
    this.#confirmations.clear();
  }

  /**
   * Discard every outstanding confirmation while leaving sessions intact.
   *
   * A protected state transition — erasing the snapshot, erasing a review —
   * changes the facts a pending confirmation was granted against, so no nonce
   * issued before it may survive it. Logging the owner out for that would be
   * disproportionate: the account has not changed, so the session binding is
   * still honest.
   */
  invalidateConfirmations() {
    this.#confirmations.clear();
  }

  /** Outstanding confirmation count. Diagnostic only; never a nonce value. */
  get pendingConfirmations() {
    return this.#confirmations.size;
  }

  /** Active session count. Diagnostic only; never a session identifier. */
  get activeSessions() {
    return this.#sessions.size;
  }

  createSession() {
    const now = this.now();
    for (const [id, session] of this.#sessions) {
      if (this.#expired(session, now)) this.#sessions.delete(id);
    }
    this.#sessionMints = this.#sessionMints.filter((mintedAt) => now - mintedAt < 60_000);
    if (this.#sessions.size >= MAX_ACTIVE_SESSIONS
      || this.#sessionMints.length >= MAX_SESSION_MINTS_PER_MINUTE) return null;
    const sessionId = randomBytes(18).toString('base64url');
    const csrfToken = randomBytes(32).toString('base64url');
    this.#sessions.set(sessionId, {
      csrfDigest: createHash('sha256').update(csrfToken, 'ascii').digest(),
      issuedAt: now,
      lastSeenAt: now,
      accountGeneration: this.accountGeneration,
    });
    this.#sessionMints.push(now);
    return { sessionId, csrfToken };
  }

  #expired(session, now) {
    return now - session.issuedAt > SESSION_ABSOLUTE_LIFETIME_MS
      || now - session.lastSeenAt > SESSION_IDLE_LIFETIME_MS
      || session.accountGeneration !== this.accountGeneration;
  }

  verifySession(sessionId, { csrfToken = null, requireCsrf = false } = {}) {
    if (typeof sessionId !== 'string' || !this.#sessions.has(sessionId)) {
      return { ok: false, status: 401, code: 'local-api-session-invalid' };
    }
    const session = this.#sessions.get(sessionId);
    const now = this.now();
    if (this.#expired(session, now)) {
      this.#sessions.delete(sessionId);
      return { ok: false, status: 401, code: 'local-api-session-invalid' };
    }
    if (requireCsrf) {
      const presented = typeof csrfToken === 'string'
        ? createHash('sha256').update(csrfToken, 'ascii').digest()
        : null;
      if (presented === null || !constantTimeEquals(presented, session.csrfDigest)) {
        return { ok: false, status: 403, code: 'csrf-token-invalid' };
      }
    }
    session.lastSeenAt = now;
    return { ok: true, status: 200, code: null, sessionId };
  }

  /**
   * Issue a single-use confirmation nonce. One outstanding nonce per
   * action+resource: re-issuing atomically invalidates the previous one.
   */
  issueConfirmation({ action, resource = '*', sessionId }) {
    if (!CONFIRMABLE_ACTIONS.includes(action)) {
      return { ok: false, status: 400, code: 'confirmation-action-invalid' };
    }
    if (typeof resource !== 'string' || resource.length === 0 || resource.length > 128) {
      return { ok: false, status: 400, code: 'confirmation-resource-invalid' };
    }
    // A resource-bound action may not be confirmed generically, and a
    // generic action may not smuggle in a resource that consumption would
    // never look for.
    if (RESOURCE_BOUND_ACTIONS.includes(action) === (resource === '*')) {
      return { ok: false, status: 400, code: 'confirmation-resource-invalid' };
    }
    const now = this.now();
    this.#pruneConfirmations(now);
    const nonce = randomBytes(32).toString('base64url');
    this.#confirmations.set(`${action}:${resource}`, {
      digest: createHash('sha256').update(nonce, 'ascii').digest(),
      action,
      resource,
      sessionId,
      accountGeneration: this.accountGeneration,
      issuedAt: now,
    });
    return { ok: true, status: 200, code: null, nonce, expiresInMs: CONFIRMATION_LIFETIME_MS };
  }

  #pruneConfirmations(now) {
    for (const [key, record] of this.#confirmations) {
      if (now - record.issuedAt >= CONFIRMATION_LIFETIME_MS
        || record.accountGeneration !== this.accountGeneration) {
        this.#confirmations.delete(key);
      }
    }
  }

  /** Atomic single-use consumption bound to action/resource/session/generation. */
  consumeConfirmation({ nonce, action, resource = '*', sessionId }) {
    const now = this.now();
    this.#pruneConfirmations(now);
    const key = `${action}:${resource}`;
    const record = this.#confirmations.get(key);
    if (!record) return { ok: false, status: 409, code: 'confirmation-required' };
    this.#confirmations.delete(key); // single use: consumed even when invalid
    if (now - record.issuedAt >= CONFIRMATION_LIFETIME_MS) {
      return { ok: false, status: 409, code: 'confirmation-expired' };
    }
    if (record.sessionId !== sessionId || record.accountGeneration !== this.accountGeneration) {
      return { ok: false, status: 409, code: 'confirmation-binding-invalid' };
    }
    const presented = typeof nonce === 'string' && nonce.length > 0 && nonce.length <= 256
      ? createHash('sha256').update(nonce, 'ascii').digest()
      : null;
    if (presented === null || !constantTimeEquals(presented, record.digest)) {
      return { ok: false, status: 409, code: 'confirmation-invalid' };
    }
    return { ok: true, status: 200, code: null };
  }

  /**
   * Full per-request decision for one `/api/v1` route.
   * Returns `{ ok: true, policy, sessionId }` or `{ ok: false, status, code }`.
   */
  authorize({ method, pathname, headers, expectedOrigin }) {
    const policy = ROUTE_POLICY[`${method} ${pathname}`];
    if (!policy) return { ok: false, status: 404, code: 'api-route-not-found' };

    const metadata = evaluateBrowserMetadata(headers, { expectedOrigin, method });
    if (metadata) return { ok: false, status: 403, code: metadata };

    if (!policy.session) return { ok: true, status: 200, code: null, policy, sessionId: null };

    const session = this.verifySession(singleHeader(headers, SESSION_HEADER), {
      csrfToken: singleHeader(headers, CSRF_HEADER),
      requireCsrf: policy.csrf,
    });
    if (!session.ok) return session;

    return { ok: true, status: 200, code: null, policy, sessionId: session.sessionId };
  }
}
