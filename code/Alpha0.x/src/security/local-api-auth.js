/**
 * Per-start local API capability authentication (A2-WP015 / ATR-S015).
 *
 * Security model implemented here:
 *  - Exactly one capability of 256 random bits is generated per server start.
 *    Only its SHA-256 digest is retained by the verifier; the plaintext value
 *    exists solely inside the launcher-owned transient unlock display and,
 *    transiently, in the owner's browser tab memory.
 *  - EVERY `/api/v1/*` route, including session bootstrap, requires that
 *    capability in an `Authorization` header and is verified in constant time.
 *    There is no public token-vending endpoint and no unauthenticated
 *    bootstrap: static content never contains the capability.
 *  - Host/Origin/fetch-metadata/CSRF remain enforced as defence in depth.
 *    None of them authenticates a local process, and none of them may be
 *    accepted in place of the capability.
 *  - Destructive and export-class actions require the capability to be
 *    re-entered AND a fresh single-use confirmation nonce bound to
 *    action, resource, session and account generation, valid for 120 seconds.
 *    Erasing a private review is one of them: it holds destructive authority
 *    in its own right and never borrows a lifecycle policy from another route.
 *  - Local abuse protection: bounded failures per capability generation with
 *    a doubling delay and a terminal lock. Recovery is only possible through
 *    the trusted launcher; nothing here ever vends a replacement over HTTP.
 *
 * This module holds no personal data, writes nothing to disk, and emits no
 * diagnostic text derived from a request.
 */

import { randomBytes, createHash, timingSafeEqual } from 'node:crypto';

/** RFC 4648 base32 alphabet: case-insensitive, safe for manual entry. */
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export const CAPABILITY_BYTES = 32; // 256 bits, the CP-02 minimum entropy.
export const CAPABILITY_GROUP_SIZE = 4;
export const CONFIRMATION_LIFETIME_MS = 120_000;
export const MAX_CAPABILITY_FAILURES = 5;
export const MIN_FAILURE_DELAY_MS = 1_000;
export const MAX_FAILURE_DELAY_MS = 30_000;
export const MAX_ACTIVE_SESSIONS = 4;
export const SESSION_ABSOLUTE_LIFETIME_MS = 12 * 60 * 60 * 1_000;
export const SESSION_IDLE_LIFETIME_MS = 60 * 60 * 1_000;

export const AUTHORIZATION_SCHEME = 'ATnR-Capability';
export const CAPABILITY_HEADER = 'authorization';
export const REAUTH_HEADER = 'x-atnr-reauth';
export const SESSION_HEADER = 'x-atnr-session';
export const CSRF_HEADER = 'x-atnr-csrf';

/**
 * Closed route policy. `read`, `export` and `destructive` classes all require
 * the same capability authority; export is deliberately specified at
 * destructive strength (re-entered capability + fresh nonce) so it can never
 * ship later as a weaker read. Routes absent from this table do not exist.
 */
export const ROUTE_POLICY = Object.freeze({
  'GET /api/v1/session': Object.freeze({ class: 'bootstrap', session: false, csrf: false, reauth: false, confirm: null }),
  'GET /api/v1/status': Object.freeze({ class: 'read', session: true, csrf: false, reauth: false, confirm: null }),
  'GET /api/v1/library': Object.freeze({ class: 'read', session: true, csrf: false, reauth: false, confirm: null }),
  // The deletion inventory is read-strength: it is what the owner reads in
  // order to consent to an erasure, so demanding a nonce to see it would make
  // informed consent harder than the destructive act it precedes. It still
  // requires the per-start capability and a live session like every other read.
  'GET /api/v1/inventory': Object.freeze({ class: 'read', session: true, csrf: false, reauth: false, confirm: null }),
  'GET /api/v1/feedback': Object.freeze({ class: 'read', session: true, csrf: false, reauth: false, confirm: null }),
  'PUT /api/v1/feedback': Object.freeze({ class: 'lifecycle', session: true, csrf: true, reauth: false, confirm: null }),
  // Erasing a review is destructive and irreversible for that record, so it
  // carries destructive authority in its own right. It must never borrow a
  // lifecycle policy from another route.
  'DELETE /api/v1/feedback': Object.freeze({ class: 'destructive', session: true, csrf: true, reauth: true, confirm: 'delete-feedback' }),
  'POST /api/v1/connect': Object.freeze({ class: 'lifecycle', session: true, csrf: true, reauth: false, confirm: null }),
  'POST /api/v1/sync': Object.freeze({ class: 'lifecycle', session: true, csrf: true, reauth: false, confirm: null }),
  'POST /api/v1/confirmation': Object.freeze({ class: 'confirmation', session: true, csrf: true, reauth: true, confirm: null }),
  'POST /api/v1/export': Object.freeze({ class: 'export', session: true, csrf: true, reauth: true, confirm: 'export' }),
  'POST /api/v1/disconnect': Object.freeze({ class: 'destructive', session: true, csrf: true, reauth: true, confirm: 'disconnect' }),
  'POST /api/v1/delete-local': Object.freeze({ class: 'destructive', session: true, csrf: true, reauth: true, confirm: 'delete-local' }),
  // Complete local erasure: snapshot, sync state, every review and tombstone,
  // the ownership anchor and the retained rollback envelope. It is deliberately
  // a *separate* route from `delete-local`, because the snapshot-only control
  // is labelled and described as snapshot-only. One nonce must never be able to
  // satisfy both: a user who confirmed "delete the snapshot" has not consented
  // to erasing their private reviews.
  'POST /api/v1/delete-all': Object.freeze({ class: 'destructive', session: true, csrf: true, reauth: true, confirm: 'delete-all' }),
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

function base32Encode(bytes) {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

/**
 * Normalize an entered capability: case-insensitive, separator-insensitive.
 * Formatting aids entry; it never reduces entropy.
 */
export function normalizeCapability(value) {
  if (typeof value !== 'string' || value.length > 512) return null;
  const cleaned = value.toUpperCase().replace(/[^A-Z2-7]/g, '');
  return cleaned.length === 0 ? null : cleaned;
}

export function formatCapability(compact) {
  return compact.replace(new RegExp(`.{1,${CAPABILITY_GROUP_SIZE}}`, 'g'), '$&-').replace(/-$/, '');
}

export function capabilityDigest(value) {
  const normalized = normalizeCapability(value);
  if (normalized === null) return null;
  return createHash('sha256').update(normalized, 'ascii').digest();
}

/**
 * Generate a fresh per-start capability. The formatted value is intended for
 * the trusted launcher display only; the digest is all the verifier keeps.
 */
export function generateCapability() {
  const compact = base32Encode(randomBytes(CAPABILITY_BYTES));
  return Object.freeze({
    display: formatCapability(compact),
    digest: capabilityDigest(compact),
  });
}

function constantTimeEquals(left, right) {
  if (!Buffer.isBuffer(left) || !Buffer.isBuffer(right) || left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

function monotonicNow() {
  return Number(process.hrtime.bigint() / 1_000_000n);
}

/** Header extraction: exact scheme, single value, no list forms. */
export function readCapabilityHeader(headers) {
  const raw = headers?.[CAPABILITY_HEADER];
  if (typeof raw !== 'string') return null;
  const prefix = `${AUTHORIZATION_SCHEME} `;
  if (!raw.startsWith(prefix)) return null;
  return raw.slice(prefix.length).trim() || null;
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
  #digest;

  #sessions = new Map();

  #confirmations = new Map();

  constructor({ digest, now = monotonicNow, accountGeneration = 0 } = {}) {
    if (!Buffer.isBuffer(digest) || digest.length !== 32) {
      throw new Error('local-api-capability-digest-required');
    }
    this.#digest = Buffer.from(digest);
    this.now = now;
    this.accountGeneration = accountGeneration;
    this.failures = 0;
    this.nextAttemptAt = 0;
    this.locked = false;
  }

  /** Terminal local lock: capability, sessions and nonces are all destroyed. */
  lock() {
    this.locked = true;
    this.#digest.fill(0);
    this.#sessions.clear();
    this.#confirmations.clear();
  }

  /**
   * Account/generation change invalidates every session and pending nonce.
   *
   * Use this only for a transition that changes *whose* data this is, or that
   * invalidates the state every outstanding authorization was granted against:
   * connect, disconnect, and complete local erasure. The owner must re-unlock,
   * which is correct — their previous session was bound to a world that no
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
   * still honest. Re-entering the capability for the *next* destructive action
   * is required regardless.
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

  get failureDelayMs() {
    if (this.failures === 0) return 0;
    const delay = MIN_FAILURE_DELAY_MS * 2 ** (this.failures - 1);
    return Math.min(delay, MAX_FAILURE_DELAY_MS);
  }

  /**
   * Constant-time capability check with bounded local abuse protection.
   * An absent credential does not consume the failure budget (it is not an
   * attempt); a wrong credential does.
   */
  verifyCapability(presented, { countFailure = true } = {}) {
    if (this.locked) return { ok: false, status: 401, code: 'local-api-locked' };
    if (presented === null || presented === undefined) {
      return { ok: false, status: 401, code: 'local-api-capability-required' };
    }
    const now = this.now();
    if (now < this.nextAttemptAt) {
      return { ok: false, status: 429, code: 'local-api-throttled' };
    }
    const presentedDigest = capabilityDigest(presented);
    const ok = presentedDigest !== null && constantTimeEquals(presentedDigest, this.#digest);
    if (ok) return { ok: true, status: 200, code: null };
    if (!countFailure) return { ok: false, status: 401, code: 'local-api-capability-invalid' };
    this.failures += 1;
    if (this.failures >= MAX_CAPABILITY_FAILURES) {
      this.lock();
      return { ok: false, status: 401, code: 'local-api-locked' };
    }
    this.nextAttemptAt = now + this.failureDelayMs;
    return { ok: false, status: 401, code: 'local-api-capability-invalid' };
  }

  createSession() {
    if (this.locked) return null;
    const now = this.now();
    for (const [id, session] of this.#sessions) {
      if (this.#expired(session, now)) this.#sessions.delete(id);
    }
    while (this.#sessions.size >= MAX_ACTIVE_SESSIONS) {
      const oldest = this.#sessions.keys().next().value;
      this.#sessions.delete(oldest);
    }
    const sessionId = randomBytes(18).toString('base64url');
    const csrfToken = randomBytes(32).toString('base64url');
    this.#sessions.set(sessionId, {
      csrfDigest: createHash('sha256').update(csrfToken, 'ascii').digest(),
      issuedAt: now,
      lastSeenAt: now,
      accountGeneration: this.accountGeneration,
    });
    return { sessionId, csrfToken };
  }

  #expired(session, now) {
    return now - session.issuedAt > SESSION_ABSOLUTE_LIFETIME_MS
      || now - session.lastSeenAt > SESSION_IDLE_LIFETIME_MS
      || session.accountGeneration !== this.accountGeneration;
  }

  verifySession(sessionId, { csrfToken = null, requireCsrf = false } = {}) {
    if (this.locked) return { ok: false, status: 401, code: 'local-api-locked' };
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
    if (this.locked) return { ok: false, status: 401, code: 'local-api-locked' };
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
    if (this.locked) return { ok: false, status: 401, code: 'local-api-locked' };
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

    const capability = this.verifyCapability(readCapabilityHeader(headers));
    if (!capability.ok) return capability;

    if (!policy.session) return { ok: true, status: 200, code: null, policy, sessionId: null };

    const session = this.verifySession(singleHeader(headers, SESSION_HEADER), {
      csrfToken: singleHeader(headers, CSRF_HEADER),
      requireCsrf: policy.csrf,
    });
    if (!session.ok) return session;

    if (policy.reauth) {
      const reauth = this.verifyCapability(singleHeader(headers, REAUTH_HEADER));
      if (!reauth.ok) {
        const code = reauth.code === 'local-api-capability-required'
          ? 'local-api-reauth-required'
          : reauth.code;
        return { ok: false, status: reauth.status, code };
      }
    }

    return { ok: true, status: 200, code: null, policy, sessionId: session.sessionId };
  }
}
