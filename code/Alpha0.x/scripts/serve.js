#!/usr/bin/env node
/**
 * Dependency-free loopback server for the alpha UI.
 *
 * Serves only `ui/` (the app shell) and `src/` (so the UI's ES module
 * imports of the platform-neutral core resolve) from this package
 * directory. No other path is served, no directory listing is generated,
 * The default mode remains static and synthetic. `--private-alpha` adds a
 * same-origin API backed by the isolated Python connector process; this Node
 * process never receives Audible credentials.
 */

import http from 'node:http';
import { createReadStream } from 'node:fs';
import { stat, realpath } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { FeedbackError, FEEDBACK_ERROR_CODES, FEEDBACK_LIMITS } from '../src/core/feedback.js';
import { safeId } from '../src/index.js';
import { ALPHA_VERSION } from '../src/version.js';
import { ACCOUNT_QUARANTINE_CODE, PrivateAlphaServiceError } from '../src/sync/private-alpha-service.js';
import { LocalApiAuth } from '../src/security/local-api-auth.js';
import { SecurityEventLog, recordSafely } from '../src/security/security-events.js';
import {
  describeRuntimeDataSource,
  isSyntheticModulePath,
} from '../src/security/runtime-data-source.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const PACKAGE_ROOT = path.resolve(__dirname, '..');

const ALLOWED_ROOTS = Object.freeze(['ui', 'src']);

/** Loopback-only Host allowlist (DNS-rebinding protection). */
export const ALLOWED_HOSTNAMES = Object.freeze(['127.0.0.1', 'localhost', '::1', '[::1]']);

/**
 * Response headers applied to every response, including errors. `connect-src
 * 'none'` is the enforceable statement that this prototype makes no outbound
 * request of any kind from the page.
 */
export const SECURITY_HEADERS = Object.freeze({
  'content-security-policy': [
    "default-src 'none'",
    "script-src 'self'",
    "style-src 'self'",
    "img-src 'self'",
    "font-src 'self'",
    "connect-src 'none'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "base-uri 'none'",
    "form-action 'none'",
  ].join('; '),
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer',
  'cross-origin-resource-policy': 'same-origin',
  'cross-origin-opener-policy': 'same-origin',
  'permissions-policy': 'geolocation=(), microphone=(), camera=(), interest-cohort=()',
  'cache-control': 'no-store',
});

export const PRIVATE_ALPHA_SECURITY_HEADERS = Object.freeze({
  ...SECURITY_HEADERS,
  'content-security-policy': SECURITY_HEADERS['content-security-policy']
    .replace("connect-src 'none'", "connect-src 'self'"),
});

const MIME_TYPES = Object.freeze({
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
});

function mimeFor(filePath) {
  return MIME_TYPES[path.extname(filePath).toLowerCase()] ?? 'application/octet-stream';
}

/** Fixed-text response. No error detail, no request echo, ever. */
function respond(res, status, body, extraHeaders = {}, headers = SECURITY_HEADERS) {
  res.writeHead(status, { ...headers, 'content-type': 'text/plain; charset=utf-8', ...extraHeaders });
  res.end(body);
}

function respondJson(res, status, value, headers) {
  const body = JSON.stringify(value);
  res.writeHead(status, {
    ...headers,
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
  });
  res.end(body);
}

/**
 * Deliver an export document.
 *
 * The body is the owner's own data, so it is served as a download rather than
 * as a renderable document: a fixed ASCII filename (never derived from stored
 * content), `nosniff`, `no-store` and an attachment disposition together stop
 * the browser from treating it as markup, caching it to disk, or letting a
 * stored title steer the filename. The response is bounded; over the ceiling it
 * fails closed rather than shipping a truncated document that looks complete.
 */
function respondExport(res, result, headers) {
  const body = JSON.stringify({
    ok: true,
    result: {
      document: result.document,
      feedbackIncluded: result.feedbackIncluded === true,
      libraryRetained: result.libraryRetained === true,
    },
  });
  const length = Buffer.byteLength(body);
  if (length > MAX_EXPORT_RESPONSE_BYTES) {
    respondJson(res, 413, { ok: false, error: { code: 'export-too-large' } }, headers);
    return;
  }
  res.writeHead(200, {
    ...headers,
    'content-type': 'application/json; charset=utf-8',
    'content-disposition': 'attachment; filename="atnr-export.json"',
    'cache-control': 'no-store',
    'content-length': length,
  });
  res.end(body);
}

/** Closed control-body limit. Review/export ceilings are defined separately. */
export const MAX_CONTROL_BODY_BYTES = 8192;
export const MAX_FEEDBACK_BODY_BYTES = FEEDBACK_LIMITS.requestBytes;

/**
 * Ceiling on a serialized export response. The export is the owner's whole
 * library and every private review, so it is far larger than a control body,
 * but it is still bounded: an unbounded response is a denial-of-service and a
 * memory-pressure surface. Exceeding it fails closed rather than truncating,
 * because a truncated export that looks complete is worse than no export.
 */
export const MAX_EXPORT_RESPONSE_BYTES = 32 * 1024 * 1024;

/**
 * Closed inventory vocabulary.
 *
 * Deliberately restated here rather than imported: this is the boundary that
 * decides what may leave the process, and it must not widen silently because a
 * storage-side list grew. An unknown item id fails the response closed.
 */
export const INVENTORY_ITEM_IDS = Object.freeze([
  'encrypted-snapshot', 'private-reviews', 'review-tombstones', 'sync-state',
  'account-anchor', 'rollback-envelope', 'local-data-suppression',
  'identity-seed', 'provider-credentials',
]);
const MAX_INVENTORY_COUNT = 1_000_000;
const MAX_LIMITATION_TEXT = 400;
const MAX_LIMITATIONS = 12;

/**
 * Narrow the deletion inventory to a closed, bounded shape.
 *
 * The inventory exists so the owner can give informed consent before erasing
 * everything, so it carries counts and fixed limitation statements — never a
 * title, an ASIN, a comment, an account key or a path. Anything outside the
 * closed vocabulary is refused rather than forwarded.
 */
export function narrowDeletionInventory(value) {
  if (!value || typeof value !== 'object' || !Array.isArray(value.items)) {
    throw new PrivateAlphaServiceError('inventory-unavailable');
  }
  if (value.items.length !== INVENTORY_ITEM_IDS.length) {
    throw new PrivateAlphaServiceError('inventory-unavailable');
  }
  const items = value.items.map((item) => {
    if (!item || typeof item !== 'object' || !INVENTORY_ITEM_IDS.includes(item.id)) {
      throw new PrivateAlphaServiceError('inventory-unavailable');
    }
    const count = Object.hasOwn(item, 'count') ? item.count : null;
    if (count !== null && (!Number.isInteger(count) || count < 0 || count > MAX_INVENTORY_COUNT)) {
      throw new PrivateAlphaServiceError('inventory-unavailable');
    }
    // `retained` is deliberately tri-state. Connector-owned artifacts are not
    // observable from here, and flattening 'unknown' to false would tell the
    // owner their credentials are gone when nothing checked.
    if (item.retained !== true && item.retained !== false && item.retained !== 'unknown') {
      throw new PrivateAlphaServiceError('inventory-unavailable');
    }
    if (item.owner !== 'local' && item.owner !== 'connector') {
      throw new PrivateAlphaServiceError('inventory-unavailable');
    }
    return {
      id: item.id,
      owner: item.owner,
      retained: item.retained,
      count,
      lifecycle: typeof item.lifecycle === 'string' ? item.lifecycle : 'unknown',
      encrypted: item.encrypted === true,
    };
  });
  const limitations = Array.isArray(value.limitations) ? value.limitations : [];
  if (limitations.length > MAX_LIMITATIONS
    || limitations.some((text) => typeof text !== 'string' || text.length > MAX_LIMITATION_TEXT)) {
    throw new PrivateAlphaServiceError('inventory-unavailable');
  }
  const residual = Array.isArray(value.residualItemIds) ? value.residualItemIds : [];
  const residualConnector = Array.isArray(value.residualConnectorItemIds) ? value.residualConnectorItemIds : [];
  if ([...residual, ...residualConnector].some((id) => !INVENTORY_ITEM_IDS.includes(id))) {
    throw new PrivateAlphaServiceError('inventory-unavailable');
  }
  return {
    storageSchemaRevision: typeof value.storageSchemaRevision === 'string' ? value.storageSchemaRevision : null,
    items,
    localDataRemoved: value.localDataRemoved === true,
    residualItemIds: [...residual],
    residualConnectorItemIds: [...residualConnector],
    connectorArtifactsDisclosed: value.connectorArtifactsDisclosed === true,
    limitations: [...limitations],
  };
}

/**
 * Routes with a real handler below.
 *
 * A route may only consume a single-use confirmation nonce if it can actually
 * perform the action. Without this interlock a policy entry added ahead of its
 * handler would burn the owner's nonce and then answer 404 — the user re-enters
 * the capability, confirms a destructive action, and nothing happens.
 */
export const IMPLEMENTED_API_ROUTES = Object.freeze([
  'GET /api/v1/session',
  'GET /api/v1/status',
  'GET /api/v1/library',
  'GET /api/v1/inventory',
  'GET /api/v1/feedback',
  'PUT /api/v1/feedback',
  'DELETE /api/v1/feedback',
  'POST /api/v1/confirmation',
  'POST /api/v1/connect',
  'POST /api/v1/sync',
  'POST /api/v1/export',
  'POST /api/v1/disconnect',
  'POST /api/v1/delete-local',
  'POST /api/v1/delete-all',
]);

/**
 * Closed service-error vocabulary. Anything else collapses to a single fixed
 * category, so a storage/connector failure can never describe itself.
 */
const SERVICE_ERROR_CODES = Object.freeze([
  'account-mismatch',
  // A deletion refused because the connected account does not own the stored
  // data. The owner must be told exactly this and nothing else about it.
  ACCOUNT_QUARANTINE_CODE,
  'connector-not-installed',
  'connector-timeout',
  'connector-launch-failed',
  'connector-response-invalid',
  'connector-response-too-large',
  'connector-stderr-limit',
  'connector-operation-failed',
  'connect-request-invalid',
  'sync-request-invalid',
  'disconnect-request-invalid',
  'delete-request-invalid',
  'inventory-unavailable',
  'export-request-invalid',
  'export-too-large',
  'export-unavailable',
  'request-body-invalid',
  'request-body-too-large',
  'request-content-type-invalid',
  'sync-already-running',
  'not-connected',
]);

function classifyFeedbackError(error) {
  const code = error instanceof FeedbackError ? error.code : error?.code;
  if (typeof code !== 'string') return null;
  if (code === 'invalid-identifier' || code === 'unsafe-key') return { status: 400, code: 'invalid-book-id' };
  if (FEEDBACK_ERROR_CODES.includes(code)) {
    if (code === 'record-not-found') return { status: 404, code };
    if (code === 'revision-conflict' || code === 'account-mismatch') return { status: 409, code };
    if (code === 'aggregate-limit-exceeded' || code === 'request-too-large') return { status: 413, code };
    return { status: 400, code };
  }
  if (['feedback-store-unavailable', 'feedback-account-unavailable', 'local-custody-unavailable'].includes(code)) {
    return { status: 409, code };
  }
  return null;
}

function classifyApiError(error) {
  const feedback = classifyFeedbackError(error);
  if (feedback) return feedback;
  const code = error instanceof PrivateAlphaServiceError ? error.code : null;
  if (typeof code === 'string' && SERVICE_ERROR_CODES.includes(code)) {
    return { status: code.startsWith('request-body-too-large') ? 413 : 409, code };
  }
  return { status: 409, code: 'private-alpha-operation-failed' };
}

/**
 * Bounded JSON body reader. Bytes are counted as they stream, so a chunked
 * request cannot bypass the ceiling by omitting Content-Length.
 */
async function readJsonBody(req, maximum = MAX_CONTROL_BODY_BYTES) {
  const type = req.headers['content-type'];
  if (typeof type === 'string' && type.length > 0
    && !/^application\/json\s*(;.*)?$/i.test(type)) {
    throw new PrivateAlphaServiceError('request-content-type-invalid');
  }
  const chunks = [];
  let length = 0;
  for await (const chunk of req) {
    length += chunk.length;
    if (length > maximum) throw new PrivateAlphaServiceError('request-body-too-large');
    chunks.push(chunk);
  }
  if (length === 0) return {};
  try {
    const value = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error();
    return value;
  } catch {
    throw new PrivateAlphaServiceError('request-body-invalid');
  }
}

function confirmationValue(body) {
  const value = body.confirmation;
  return typeof value === 'string' && value.length > 0 && value.length <= 256 ? value : null;
}

function parseFeedbackRoute(pathname) {
  const match = /^\/api\/v1\/feedback\/([^/]+)$/.exec(pathname);
  if (!match) return null;
  return safeId(decodeURIComponent(match[1]), 'bookId');
}

/**
 * Collapse `/api/v1/feedback/:bookId` onto its own policy key. The HTTP method
 * is preserved, so a review deletion is authorized as the destructive action
 * it is instead of borrowing the policy of an unrelated route.
 */
function authorizePath(method, pathname) {
  const bookId = parseFeedbackRoute(pathname);
  if (bookId === null) return { method, pathname, bookId: null };
  return { method, pathname: '/api/v1/feedback', bookId };
}

/**
 * Resource a confirmation nonce is bound to. A review deletion binds to the
 * record and the exact revision the owner confirmed, so the nonce cannot be
 * redirected to another book or replayed across a newer revision.
 * Returns `null` when the request cannot supply a valid binding.
 */
function confirmationResource(policy, route, body) {
  if (policy.confirm !== 'delete-feedback') return '*';
  const revision = body.expectedRevision;
  if (typeof route.bookId !== 'string'
    || typeof revision !== 'string'
    || revision.length === 0
    || revision.length > 64) {
    return null;
  }
  return `${route.bookId}:${revision}`;
}

/**
 * Browser metadata is checked before any private route is handled. All routes
 * after bootstrap require a bounded session; mutations additionally require
 * CSRF, and destructive actions consume single-use confirmation nonces.
 */
async function handlePrivateAlphaApi(req, res, { service, auth, headers, events, runtimeSource }) {
  const url = new URL(req.url ?? '/', `http://${req.headers.host}`);
  const method = req.method === 'HEAD' ? 'GET' : req.method ?? 'GET';
  const expectedOrigin = `http://${req.headers.host}`;
  const route = authorizePath(method, url.pathname);

  const decision = auth.authorize({
    method: route.method,
    pathname: route.pathname,
    headers: req.headers,
    expectedOrigin,
  });
  if (!decision.ok) {
    recordSafely(events, 'local-auth', 'denied');
    respondJson(res, decision.status, { ok: false, error: { code: decision.code } }, headers);
    return;
  }
  recordSafely(events, 'local-auth', 'allowed');

  const { policy } = decision;

  // No nonce may be consumed by a route that cannot act. See
  // IMPLEMENTED_API_ROUTES.
  if (!IMPLEMENTED_API_ROUTES.includes(`${route.method} ${route.pathname}`)) {
    respondJson(res, 404, { ok: false, error: { code: 'api-route-not-found' } }, headers);
    return;
  }

  if (url.pathname === '/api/v1/session') {
    const session = auth.createSession();
    if (!session) {
      respondJson(res, 429, { ok: false, error: { code: 'local-api-session-capacity' } }, headers);
      return;
    }
    respondJson(res, 200, {
      ok: true,
      session: {
        sessionId: session.sessionId,
        csrfToken: session.csrfToken,
        contractVersion: 'atnr-local-api-1',
        confirmationLifetimeMs: 120_000,
        runtime: describeRuntimeDataSource(runtimeSource),
      },
    }, headers);
    return;
  }
  if (url.pathname === '/api/v1/status') {
    respondJson(res, 200, { ok: true, result: await service.status() }, headers);
    return;
  }
  if (url.pathname === '/api/v1/library') {
    respondJson(res, 200, { ok: true, result: await service.library() }, headers);
    return;
  }
  if (url.pathname === '/api/v1/inventory') {
    if (typeof service.deletionInventory !== 'function') {
      throw new PrivateAlphaServiceError('inventory-unavailable');
    }
    respondJson(res, 200, {
      ok: true,
      result: narrowDeletionInventory(await service.deletionInventory()),
    }, headers);
    return;
  }
  if (url.pathname === '/api/v1/feedback' && method === 'GET') {
    if (!service.feedbackStore || typeof service.feedbackStore.list !== 'function') {
      throw Object.assign(new Error('feedback-store-unavailable'), { code: 'feedback-store-unavailable' });
    }
    respondJson(res, 200, { ok: true, result: await service.feedbackStore.list() }, headers);
    return;
  }
  if (route.bookId && method === 'GET') {
    if (!service.feedbackStore || typeof service.feedbackStore.get !== 'function') throw Object.assign(new Error('feedback-store-unavailable'), { code: 'feedback-store-unavailable' });
    respondJson(res, 200, { ok: true, result: await service.feedbackStore.get(route.bookId) }, headers);
    return;
  }

  const body = await readJsonBody(req, route.bookId ? MAX_FEEDBACK_BODY_BYTES : MAX_CONTROL_BODY_BYTES);

  if (url.pathname === '/api/v1/confirmation') {
    const keys = Object.keys(body);
    if (keys.length > 2
      || keys.some((key) => key !== 'action' && key !== 'resource')
      || typeof body.action !== 'string'
      || (Object.hasOwn(body, 'resource') && typeof body.resource !== 'string')) {
      respondJson(res, 400, { ok: false, error: { code: 'confirmation-request-invalid' } }, headers);
      return;
    }
    const issued = auth.issueConfirmation({
      action: body.action,
      resource: Object.hasOwn(body, 'resource') ? body.resource : '*',
      sessionId: decision.sessionId,
    });
    recordSafely(events, 'confirmation', issued.ok ? 'allowed' : 'denied');
    if (!issued.ok) {
      respondJson(res, issued.status, { ok: false, error: { code: issued.code } }, headers);
      return;
    }
    respondJson(res, 200, {
      ok: true,
      result: { confirmation: issued.nonce, expiresInMs: issued.expiresInMs },
    }, headers);
    return;
  }

  if (policy.confirm) {
    const resource = confirmationResource(policy, route, body);
    if (resource === null) throw new FeedbackError('invalid-field-type', 'revision');
    const consumed = auth.consumeConfirmation({
      nonce: confirmationValue(body),
      action: policy.confirm,
      resource,
      sessionId: decision.sessionId,
    });
    recordSafely(events, 'confirmation', consumed.ok ? 'allowed' : 'denied');
    if (!consumed.ok) {
      respondJson(res, consumed.status, { ok: false, error: { code: consumed.code } }, headers);
      return;
    }
  }

  if (route.bookId && method === 'PUT') {
    if (!service.feedbackStore || typeof service.feedbackStore.save !== 'function') throw Object.assign(new Error('feedback-store-unavailable'), { code: 'feedback-store-unavailable' });
    if (Object.keys(body).length !== 2 || !Object.hasOwn(body, 'payload') || typeof body.expectedRevision !== 'string') {
      throw new FeedbackError('invalid-field-type', 'feedback');
    }
    recordSafely(events, 'lifecycle', 'allowed');
    respondJson(res, 200, { ok: true, result: await service.feedbackStore.save(route.bookId, body.payload, body.expectedRevision) }, headers);
    return;
  }
  if (route.bookId && method === 'DELETE') {
    if (!service.feedbackStore || typeof service.feedbackStore.delete !== 'function') throw Object.assign(new Error('feedback-store-unavailable'), { code: 'feedback-store-unavailable' });
    if (Object.keys(body).length !== 2 || typeof body.expectedRevision !== 'string' || typeof body.confirmation !== 'string') {
      throw new FeedbackError('invalid-field-type', 'revision');
    }
    recordSafely(events, 'lifecycle', 'allowed');
    const erased = await service.feedbackStore.delete(route.bookId, body.expectedRevision);
    // A protected transition completed. Every other outstanding confirmation
    // was granted against the previous state, so none may survive it. The
    // account is unchanged, so the session stands.
    auth.invalidateConfirmations();
    recordSafely(events, 'confirmation', 'invalidated');
    respondJson(res, 200, { ok: true, result: erased }, headers);
    return;
  }

  if (url.pathname === '/api/v1/connect') {
    if (Object.keys(body).length !== 1 || typeof body.accountAlias !== 'string') {
      throw new PrivateAlphaServiceError('connect-request-invalid');
    }
    recordSafely(events, 'lifecycle', 'allowed');
    const connected = await service.connect(body);
    // An account identity now exists where none did, or a different one does.
    // Every session and nonce predates it and must not survive it.
    auth.invalidateBindings();
    recordSafely(events, 'local-auth', 'invalidated');
    respondJson(res, 200, { ok: true, result: connected }, headers);
    return;
  }
  if (url.pathname === '/api/v1/sync') {
    if (Object.keys(body).length !== 0) throw new PrivateAlphaServiceError('sync-request-invalid');
    recordSafely(events, 'lifecycle', 'allowed');
    // Deliberately no invalidation. A sync cannot change account identity: the
    // service resolves the account join first and refuses a mismatch with
    // `different-account-local-data-exists` rather than importing it.
    respondJson(res, 200, { ok: true, result: await service.sync() }, headers);
    return;
  }
  if (url.pathname === '/api/v1/export') {
    if (Object.keys(body).length !== 1) throw new PrivateAlphaServiceError('export-request-invalid');
    const result = await service.exportAll();
    // Only the fixed outcome flags are recorded. Never a count, a title, or a
    // byte length — a size is itself a measure of the owner's library.
    recordSafely(events, 'lifecycle', 'allowed');
    respondExport(res, result, headers);
    return;
  }
  if (url.pathname === '/api/v1/disconnect') {
    if (Object.keys(body).length !== 1) throw new PrivateAlphaServiceError('disconnect-request-invalid');
    recordSafely(events, 'lifecycle', 'allowed');
    const disconnected = await service.disconnect();
    // The provider session this authorization was granted against is gone.
    auth.invalidateBindings();
    recordSafely(events, 'local-auth', 'invalidated');
    respondJson(res, 200, { ok: true, result: disconnected }, headers);
    return;
  }
  if (url.pathname === '/api/v1/delete-local') {
    if (Object.keys(body).length !== 1) throw new PrivateAlphaServiceError('delete-request-invalid');
    recordSafely(events, 'lifecycle', 'allowed');
    // Verified form only: it resolves the account join immediately before
    // erasing, so the ownership check cannot be satisfied by a stale verdict
    // and there is no window between the check and the deletion.
    const deleted = await service.deleteLocalSnapshotVerified();
    // The snapshot a pending confirmation referred to no longer exists. The
    // account is unchanged, so the session survives and the owner is not
    // logged out for erasing their own snapshot.
    auth.invalidateConfirmations();
    recordSafely(events, 'confirmation', 'invalidated');
    respondJson(res, 200, { ok: true, result: deleted }, headers);
    return;
  }
  if (url.pathname === '/api/v1/delete-all') {
    if (Object.keys(body).length !== 1) throw new PrivateAlphaServiceError('delete-request-invalid');
    recordSafely(events, 'lifecycle', 'allowed');
    // Aggregate erasure. `purgeAllLocalData()` resolves the account join first,
    // so a quarantined session cannot erase data it does not own, and returns
    // an inventory recomputed from the post-deletion state rather than an
    // assertion that the deletion worked.
    const purged = await service.purgeAllLocalData();
    // The ownership anchor is gone. Every session and nonce was bound to an
    // account generation that no longer has any local data behind it, so the
    // browser obtains a fresh session before anything else happens.
    auth.invalidateBindings();
    recordSafely(events, 'local-auth', 'invalidated');
    respondJson(res, 200, { ok: true, result: purged }, headers);
    return;
  }
  respondJson(res, 404, { ok: false, error: { code: 'api-route-not-found' } }, headers);
}

/**
 * Loopback Host allowlist. When the actual listener port is known it must also
 * match, so a Host header cannot name a different local service.
 */
export function isAllowedHost(hostHeader, { port = null } = {}) {
  if (typeof hostHeader !== 'string' || hostHeader.length === 0 || hostHeader.length > 255) return false;
  const bracketed = hostHeader.startsWith('[');
  const hostname = bracketed
    ? hostHeader.slice(0, hostHeader.indexOf(']') + 1)
    : hostHeader.split(':')[0];
  if (!ALLOWED_HOSTNAMES.includes(hostname)) return false;
  if (port === null) return true;
  const rest = hostHeader.slice(hostname.length);
  if (rest === '') return false; // an explicit listener port must be named
  return rest === `:${port}`;
}

/**
 * Validate a requested listen port. Explicit ephemeral `0` is allowed;
 * NaN, fractional, negative and out-of-range values fail closed.
 */
export function validatePort(value) {
  if (typeof value === 'number') {
    return Number.isInteger(value) && value >= 0 && value <= 65535 ? value : null;
  }
  if (typeof value !== 'string' || !/^\d{1,5}$/.test(value.trim())) return null;
  const parsed = Number(value.trim());
  return parsed >= 0 && parsed <= 65535 ? parsed : null;
}

/** Separator-safe containment check that also rejects a bare prefix match. */
export function isContained(child, parent) {
  const rel = path.relative(parent, child);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

/**
 * Resolve a request path to an on-disk file, refusing anything outside the
 * allowlisted directories or the package root (no path traversal, no
 * exposure of package.json/scripts/test/node internals).
 *
 * Returns `{ ok: true, filePath }`, `{ ok: false, status: 400 }` for a
 * malformed URL, or `{ ok: false, status: 404 }` for anything not allowlisted.
 */
export function resolveRequestPath(root, urlPath) {
  let decoded;
  try {
    decoded = decodeURIComponent(String(urlPath).split('?')[0].split('#')[0] || '/');
  } catch {
    return { ok: false, status: 400 }; // malformed percent-encoding (H1)
  }
  if (decoded.includes('\u0000')) return { ok: false, status: 400 };
  const withoutQuery = decoded === '/' ? '/ui/index.html' : decoded;
  const normalized = path.normalize(withoutQuery).replace(/^([/\\])+/, '');
  const [first] = normalized.split(/[/\\]/);
  if (!ALLOWED_ROOTS.includes(first)) return { ok: false, status: 404 };
  const resolved = path.resolve(root, normalized);
  // Separator-safe containment: `ui-secrets/` must not pass a `ui` prefix test.
  if (!isContained(resolved, path.join(root, first))) return { ok: false, status: 404 };
  return { ok: true, filePath: resolved, allowedRoot: path.join(root, first) };
}

export function createStaticServer({
  root = PACKAGE_ROOT,
  privateAlphaService = null,
  auth = null,
  securityEvents = null,
  runtimeSource = null,
} = {}) {
  // Fail closed: the private API may not exist without its session controller.
  if (privateAlphaService && !(auth instanceof LocalApiAuth)) {
    throw new Error('local-api-session-controller-required');
  }
  const events = securityEvents ?? (privateAlphaService ? new SecurityEventLog() : null);
  const headers = privateAlphaService ? PRIVATE_ALPHA_SECURITY_HEADERS : SECURITY_HEADERS;
  const server = http.createServer((req, res) => {
    (async () => {
      if (!isAllowedHost(req.headers.host, { port: privateAlphaService ? req.socket.localPort : null })) {
        respond(res, 403, 'Forbidden', {}, headers);
        return;
      }
      if (privateAlphaService && req.method === 'GET' && (req.url === '/' || req.url === '')) {
        res.writeHead(302, { ...headers, location: '/?private-alpha=1#/data' });
        res.end();
        return;
      }
      if ((req.url ?? '').startsWith('/api/')) {
        if (!privateAlphaService) {
          respond(res, 404, 'Not found', {}, headers);
          return;
        }
        try {
          await handlePrivateAlphaApi(req, res, {
            service: privateAlphaService,
            auth,
            headers,
            events,
            runtimeSource,
          });
        } catch (error) {
          const { status, code } = classifyApiError(error);
          recordSafely(events, 'lifecycle', 'error');
          respondJson(res, status, { ok: false, error: { code } }, headers);
        }
        return;
      }
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        respond(res, 405, 'Method not allowed', {}, headers);
        return;
      }
      const resolution = resolveRequestPath(root, req.url ?? '/');
      if (!resolution.ok) {
        respond(res, resolution.status, resolution.status === 400 ? 'Bad request' : 'Not found', {}, headers);
        return;
      }

      // Runtime data-source rule: a private-alpha page is never allowed to
      // load synthetic fixture modules. Demo data must not be reachable from
      // a session that presents itself as the owner's real library.
      if (privateAlphaService && isSyntheticModulePath(path.relative(root, resolution.filePath))) {
        recordSafely(events, 'data-source', 'denied');
        respond(res, 403, 'Forbidden', {}, headers);
        return;
      }

      // Symlink containment (H2): the *real* path must still live inside the
      // allowlisted root, so a symlink cannot escape the served directory.
      let realFilePath;
      let realRoot;
      try {
        realFilePath = await realpath(resolution.filePath);
        realRoot = await realpath(resolution.allowedRoot);
      } catch {
        respond(res, 404, 'Not found', {}, headers);
        return;
      }
      if (!isContained(realFilePath, realRoot)) {
        respond(res, 404, 'Not found', {}, headers);
        return;
      }

      let stats;
      try {
        stats = await stat(realFilePath);
      } catch {
        respond(res, 404, 'Not found', {}, headers);
        return;
      }
      if (!stats.isFile()) {
        respond(res, 404, 'Not found', {}, headers);
        return;
      }
      res.writeHead(200, {
        ...headers,
        'content-type': mimeFor(realFilePath),
        'content-length': stats.size,
      });
      if (req.method === 'HEAD') { res.end(); return; }
      createReadStream(realFilePath).pipe(res);
    })().catch(() => {
      // Fixed text only: an internal error never describes itself to a client.
      respond(res, 500, 'Internal error', {}, headers);
    });
  });
  server.securityEvents = events;
  return server;
}

function isMainModule() {
  return process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
}

if (isMainModule()) {
  const portArg = process.argv.slice(2).find((arg) => /^\d+$/.test(arg));
  const port = validatePort(process.env.PORT ?? portArg ?? 4310);
  if (port === null) {
    console.error('ATnR: the requested port is not a valid TCP port (0-65535). Startup stopped.');
    process.exit(1);
  }
  const privateMode = process.argv.includes('--private-alpha');

  let runtime = null;
  let auth = null;
  let runtimeSource = null;
  if (privateMode) {
    // S019: the runtime check runs *before* the SQLite-dependent import.
    const { checkSupportedRuntime } = await import('./supported-runtime.js');
    const runtimeCheck = await checkSupportedRuntime();
    if (!runtimeCheck.ok) {
      console.error(runtimeCheck.message);
      process.exit(1);
    }
    const { LocalApiAuth: Auth } = await import('../src/security/local-api-auth.js');
    auth = new Auth();
    try {
      runtime = await import('./private-alpha-runtime.js').then(({ createPrivateAlphaRuntime }) => (
        createPrivateAlphaRuntime({ packageRoot: PACKAGE_ROOT })
      ));
    } catch (error) {
      // Fixed text only: no path, count, title or identifier is printed. The
      console.error([
        'ATnR: the private runtime could not be composed on the real encrypted',
        'local state, so startup stopped (fail closed).',
        `Reason: ${typeof error?.code === 'string' ? error.code : 'private-runtime-unavailable'}.`,
      ].join(' '));
      process.exit(1);
    }

    // Runtime data-source gate: the private session must be backed by the real
    // encrypted local state inside the protected custody boundary. A failure
    // here stops startup; it never degrades to a synthetic library.
    const { assertRealDataRuntime } = await import('../src/security/runtime-data-source.js');
    const snapshotStore = runtime?.snapshotStore ?? null;
    try {
      if (!snapshotStore || typeof snapshotStore.path !== 'string') {
        throw new Error('runtime-state-undeclared');
      }
      runtimeSource = assertRealDataRuntime({
        dataSource: 'local-encrypted',
        custodyRoot: path.dirname(snapshotStore.path),
        storePath: snapshotStore.path,
        backupPath: snapshotStore.backupPath ?? null,
      });
    } catch (error) {
      // Fixed text only: no path, count, title or identifier is printed.
      console.error([
        'ATnR: the encrypted local library state could not be verified inside',
        'the protected custody boundary, so the private runtime will not start.',
        'No synthetic library is substituted. Startup stopped (fail closed).',
        `Reason: ${typeof error?.code === 'string' ? error.code : 'runtime-state-unverified'}.`,
      ].join(' '));
      try { runtime?.close(); } catch { /* nothing usable was opened */ }
      process.exit(1);
    }
  }

  const server = createStaticServer({ privateAlphaService: runtime, auth, runtimeSource });
  server.on('close', () => {
    runtime?.close();
  });
  server.listen(port, '127.0.0.1', () => {
    console.log(`Alpha ${ALPHA_VERSION} ${privateMode ? 'private' : 'synthetic'} UI: http://127.0.0.1:${server.address().port}/${privateMode ? '?private-alpha=1#/data' : ''}`);
    console.log(privateMode
      ? 'ATnR owner-only prototype. Local machine access is trusted; commercial/public shipping is blocked.'
      : 'Loopback static server only. No outbound requests, persistence, or real Audible data.');
  });
}
