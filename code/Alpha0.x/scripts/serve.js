#!/usr/bin/env node
/**
 * Dependency-free loopback server for the alpha 0.0.1 UI.
 *
 * Serves only `ui/` (the app shell) and `src/` (so the UI's ES module
 * imports of the platform-neutral core resolve) from this package
 * directory. No other path is served, no directory listing is generated,
 * The default mode remains static and synthetic. `--private-alpha` adds a
 * same-origin API backed by the isolated Python connector process; this Node
 * process never receives Audible credentials.
 */

import http from 'node:http';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { stat, realpath } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { PrivateAlphaServiceError } from '../src/sync/private-alpha-service.js';

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

function sameOrigin(req) {
  const origin = req.headers.origin;
  const fetchSite = req.headers['sec-fetch-site'];
  const fetchSiteAllowed = fetchSite === undefined || fetchSite === 'same-origin' || fetchSite === 'none';
  return fetchSiteAllowed && (origin === undefined || origin === `http://${req.headers.host}`);
}

function tokenMatches(actual, expected) {
  if (typeof actual !== 'string') return false;
  const left = Buffer.from(actual);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

async function readJsonBody(req, maximum = 8192) {
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

async function handlePrivateAlphaApi(req, res, { service, csrfToken, headers }) {
  const url = new URL(req.url ?? '/', `http://${req.headers.host}`);
  if (!sameOrigin(req)) {
    respondJson(res, 403, { ok: false, error: { code: 'origin-not-allowed' } }, headers);
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/v1/session') {
    respondJson(res, 200, { ok: true, csrfToken }, headers);
    return;
  }
  if (req.method === 'GET' && url.pathname === '/api/v1/status') {
    respondJson(res, 200, { ok: true, result: await service.status() }, headers);
    return;
  }
  if (req.method === 'GET' && url.pathname === '/api/v1/library') {
    respondJson(res, 200, { ok: true, result: await service.library() }, headers);
    return;
  }

  if (req.method !== 'POST') {
    respondJson(res, 405, { ok: false, error: { code: 'method-not-allowed' } }, headers);
    return;
  }
  if (!tokenMatches(req.headers['x-atnr-csrf'], csrfToken)) {
    respondJson(res, 403, { ok: false, error: { code: 'csrf-token-invalid' } }, headers);
    return;
  }

  const body = await readJsonBody(req);
  if (url.pathname === '/api/v1/connect') {
    if (Object.keys(body).length !== 1 || typeof body.accountAlias !== 'string') {
      throw new PrivateAlphaServiceError('connect-request-invalid');
    }
    respondJson(res, 200, { ok: true, result: await service.connect(body) }, headers);
    return;
  }
  if (url.pathname === '/api/v1/sync') {
    if (Object.keys(body).length !== 0) throw new PrivateAlphaServiceError('sync-request-invalid');
    respondJson(res, 200, { ok: true, result: await service.sync() }, headers);
    return;
  }
  if (url.pathname === '/api/v1/disconnect') {
    if (Object.keys(body).length !== 0) throw new PrivateAlphaServiceError('disconnect-request-invalid');
    respondJson(res, 200, { ok: true, result: await service.disconnect() }, headers);
    return;
  }
  if (url.pathname === '/api/v1/delete-local') {
    if (Object.keys(body).length !== 0) throw new PrivateAlphaServiceError('delete-request-invalid');
    respondJson(res, 200, { ok: true, result: service.deleteLocalSnapshot() }, headers);
    return;
  }
  respondJson(res, 404, { ok: false, error: { code: 'api-route-not-found' } }, headers);
}

export function isAllowedHost(hostHeader) {
  if (typeof hostHeader !== 'string' || hostHeader.length === 0 || hostHeader.length > 255) return false;
  const hostname = hostHeader.startsWith('[')
    ? hostHeader.slice(0, hostHeader.indexOf(']') + 1)
    : hostHeader.split(':')[0];
  return ALLOWED_HOSTNAMES.includes(hostname);
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
  csrfToken = randomBytes(32).toString('base64url'),
} = {}) {
  const headers = privateAlphaService ? PRIVATE_ALPHA_SECURITY_HEADERS : SECURITY_HEADERS;
  return http.createServer((req, res) => {
    (async () => {
      if (!isAllowedHost(req.headers.host)) {
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
            csrfToken,
            headers,
          });
        } catch (error) {
          const code = error instanceof PrivateAlphaServiceError
            ? error.code
            : 'private-alpha-operation-failed';
          respondJson(res, 409, { ok: false, error: { code } }, headers);
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
}

function isMainModule() {
  return process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
}

if (isMainModule()) {
  const portArg = process.argv.slice(2).find((arg) => /^\d+$/.test(arg));
  const port = Number(process.env.PORT ?? portArg ?? 4310);
  const privateMode = process.argv.includes('--private-alpha');
  const runtime = privateMode
    ? await import('./private-alpha-runtime.js').then(({ createPrivateAlphaRuntime }) => (
      createPrivateAlphaRuntime({ packageRoot: PACKAGE_ROOT })
    ))
    : null;
  const server = createStaticServer({ privateAlphaService: runtime });
  server.on('close', () => runtime?.close());
  server.listen(port, '127.0.0.1', () => {
    console.log(`Alpha 0.0.1 ${privateMode ? 'private' : 'synthetic'} UI: http://127.0.0.1:${port}/${privateMode ? '?private-alpha=1#/data' : ''}`);
    console.log(privateMode
      ? 'ATnR private alpha only. Commercial/public shipping is blocked.'
      : 'Loopback static server only. No outbound requests, persistence, or real Audible data.');
  });
}
