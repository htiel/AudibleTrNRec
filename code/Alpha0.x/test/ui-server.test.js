/**
 * Contract tests for the dependency-free static server (`scripts/serve.js`).
 * Verifies MIME types, path-traversal/allowlist protection, and that a
 * successful request never reaches outside `ui/` and `src/`.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import { symlink, rm } from 'node:fs/promises';

import {
  createStaticServer,
  PACKAGE_ROOT,
  isContained,
  isAllowedHost,
  resolveRequestPath,
} from '../scripts/serve.js';

function listen(server) {
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve(server.address().port));
  });
}

function get(port, urlPath, { method = 'GET', host } = {}) {
  return new Promise((resolve, reject) => {
    const headers = host === undefined ? {} : { Host: host };
    const req = http.request({ host: '127.0.0.1', port, path: urlPath, method, headers }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString('utf8') }));
    });
    req.on('error', reject);
    req.end();
  });
}

test('serves the app shell at / with an html content type', async (t) => {
  const server = createStaticServer({ root: PACKAGE_ROOT });
  const port = await listen(server);
  t.after(() => server.close());

  const res = await get(port, '/');
  assert.equal(res.status, 200);
  assert.match(res.headers['content-type'], /text\/html/);
  assert.match(res.body, /Audible Track and Recommend/);
});

test('serves core ES modules with a javascript content type', async (t) => {
  const server = createStaticServer({ root: PACKAGE_ROOT });
  const port = await listen(server);
  t.after(() => server.close());

  const res = await get(port, '/src/index.js');
  assert.equal(res.status, 200);
  assert.match(res.headers['content-type'], /javascript/);
  assert.match(res.body, /export/);
});

test('serves ui stylesheets with a css content type', async (t) => {
  const server = createStaticServer({ root: PACKAGE_ROOT });
  const port = await listen(server);
  t.after(() => server.close());

  const res = await get(port, '/ui/css/tokens.css');
  assert.equal(res.status, 200);
  assert.match(res.headers['content-type'], /text\/css/);
});

test('rejects paths outside the ui/ and src/ allowlist', async (t) => {
  const server = createStaticServer({ root: PACKAGE_ROOT });
  const port = await listen(server);
  t.after(() => server.close());

  const pkg = await get(port, '/package.json');
  assert.equal(pkg.status, 404);
  const testDir = await get(port, '/test/ui-store.test.js');
  assert.equal(testDir.status, 404);
});

test('rejects path traversal attempts', async (t) => {
  const server = createStaticServer({ root: PACKAGE_ROOT });
  const port = await listen(server);
  t.after(() => server.close());

  const traversal = await get(port, '/ui/../package.json');
  assert.equal(traversal.status, 404);
  const encoded = await get(port, '/ui/%2e%2e/package.json');
  assert.equal(encoded.status, 404);
});

test('returns 404 for a missing file instead of a directory listing', async (t) => {
  const server = createStaticServer({ root: PACKAGE_ROOT });
  const port = await listen(server);
  t.after(() => server.close());

  const missing = await get(port, '/ui/js/does-not-exist.js');
  assert.equal(missing.status, 404);
  const directory = await get(port, '/ui/js');
  assert.equal(directory.status, 404);
});

test('rejects non-GET/HEAD methods', async (t) => {
  const server = createStaticServer({ root: PACKAGE_ROOT });
  const port = await listen(server);
  t.after(() => server.close());

  const res = await get(port, '/ui/index.html', { method: 'POST' });
  assert.equal(res.status, 405);
});

// --- Worf review hardening H1-H3 ------------------------------------------

test('a malformed URL returns a fixed 400 with no error detail', async (t) => {
  const server = createStaticServer({ root: PACKAGE_ROOT });
  const port = await listen(server);
  t.after(() => server.close());

  const res = await get(port, '/ui/%E0%A4%A');
  assert.equal(res.status, 400);
  assert.equal(res.body, 'Bad request');
  assert.equal(/URI|decode|malformed|Error|stack/i.test(res.body), false);

  const nul = await get(port, '/ui/%00/index.html');
  assert.equal(nul.status, 400);
  assert.equal(nul.body, 'Bad request');
});

test('path resolution is separator-safe and refuses prefix look-alike directories', () => {
  assert.equal(isContained(path.join(PACKAGE_ROOT, 'ui-secrets', 'x.js'), path.join(PACKAGE_ROOT, 'ui')), false);
  assert.equal(isContained(path.join(PACKAGE_ROOT, 'ui', 'index.html'), path.join(PACKAGE_ROOT, 'ui')), true);
  assert.equal(isContained(path.join(PACKAGE_ROOT, 'ui'), path.join(PACKAGE_ROOT, 'ui')), true);
  assert.equal(isContained(path.join(PACKAGE_ROOT, 'package.json'), path.join(PACKAGE_ROOT, 'ui')), false);

  assert.equal(resolveRequestPath(PACKAGE_ROOT, '/ui-secrets/x.js').ok, false);
  assert.equal(resolveRequestPath(PACKAGE_ROOT, '/ui/../../etc/passwd').ok, false);
  assert.equal(resolveRequestPath(PACKAGE_ROOT, '/ui/%ZZ').status, 400);
  assert.equal(resolveRequestPath(PACKAGE_ROOT, '/ui/index.html').ok, true);
});

test('a symlink escaping the served root is refused', async (t) => {
  const server = createStaticServer({ root: PACKAGE_ROOT });
  const port = await listen(server);
  t.after(() => server.close());

  const linkPath = path.join(PACKAGE_ROOT, 'ui', 'escape-link.json');
  let created = false;
  try {
    await symlink(path.join(PACKAGE_ROOT, 'package.json'), linkPath, 'file');
    created = true;
  } catch {
    t.skip('symlink creation is not permitted in this environment');
    return;
  }
  t.after(async () => { if (created) await rm(linkPath, { force: true }); });

  const res = await get(port, '/ui/escape-link.json');
  assert.equal(res.status, 404);
  assert.equal(res.body.includes('"name"'), false);
});

test('every response carries the security headers, including error responses', async (t) => {
  const server = createStaticServer({ root: PACKAGE_ROOT });
  const port = await listen(server);
  t.after(() => server.close());

  for (const target of ['/', '/ui/does-not-exist.js', '/package.json']) {
    const res = await get(port, target);
    assert.equal(res.headers['x-content-type-options'], 'nosniff', target);
    assert.equal(res.headers['referrer-policy'], 'no-referrer', target);
    assert.equal(res.headers['cross-origin-resource-policy'], 'same-origin', target);
    assert.equal(res.headers['cross-origin-opener-policy'], 'same-origin', target);
    assert.equal(res.headers['cache-control'], 'no-store', target);
    assert.match(res.headers['content-security-policy'], /default-src 'none'/, target);
    assert.match(res.headers['content-security-policy'], /connect-src 'none'/, target);
    assert.match(res.headers['content-security-policy'], /frame-ancestors 'none'/, target);
  }
});

test('only loopback Host headers are served (DNS-rebinding protection)', async (t) => {
  const server = createStaticServer({ root: PACKAGE_ROOT });
  const port = await listen(server);
  t.after(() => server.close());

  for (const host of ['127.0.0.1', 'localhost', '[::1]', `127.0.0.1:${port}`]) {
    assert.equal(isAllowedHost(host), true, host);
  }
  for (const host of ['evil.example.com', 'attacker.test:80', '', undefined, 'a'.repeat(300)]) {
    assert.equal(isAllowedHost(host), false, String(host));
  }

  const res = await get(port, '/', { host: 'evil.example.com' });
  assert.equal(res.status, 403);
  assert.equal(res.body, 'Forbidden');
});

// --- Browser-realistic asset resolution -----------------------------------
//
// A rendered-browser check found that GET / returned 200 while every asset
// 404'd: the shell used document-relative URLs (`./css/*.css`, `./js/app.js`)
// that resolve against `/`, not `/ui/`, so nothing under the `/ui` allowlist
// was ever requested. A 200 on the shell alone is a false-positive smoke
// test; these tests resolve and request what a browser would actually fetch.

/** Extract every href/src a browser would load from a document. */
function extractDocumentAssets(html) {
  const assets = [];
  for (const m of html.matchAll(/<link\b[^>]*\bhref=["']([^"']+)["'][^>]*>/gi)) {
    if (/rel=["']?stylesheet/i.test(m[0])) assets.push(m[1]);
  }
  for (const m of html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["']/gi)) assets.push(m[1]);
  for (const m of html.matchAll(/<img\b[^>]*\bsrc=["']([^"']+)["']/gi)) assets.push(m[1]);
  return assets;
}

/** Extract static/dynamic ES module specifiers, as the browser loader would. */
function extractModuleSpecifiers(source) {
  const specifiers = [];
  for (const m of source.matchAll(/\bfrom\s*["']([^"']+)["']/g)) specifiers.push(m[1]);
  for (const m of source.matchAll(/\bimport\s*["']([^"']+)["']/g)) specifiers.push(m[1]);
  for (const m of source.matchAll(/\bimport\s*\(\s*["']([^"']+)["']\s*\)/g)) specifiers.push(m[1]);
  // Only relative/absolute URLs are resolvable by the server; bare specifiers
  // would mean an external dependency, which is asserted against elsewhere.
  return specifiers.filter((s) => s.startsWith('.') || s.startsWith('/'));
}

test('every asset referenced by the app shell resolves to 200 from GET /', async (t) => {
  const server = createStaticServer({ root: PACKAGE_ROOT });
  const port = await listen(server);
  t.after(() => server.close());

  const base = `http://127.0.0.1:${port}/`;
  const shell = await get(port, '/');
  assert.equal(shell.status, 200);

  const assets = extractDocumentAssets(shell.body);
  assert.ok(assets.length >= 5, `expected the shell to reference stylesheets and a module, found ${assets.length}`);

  for (const asset of assets) {
    // Resolved exactly as a browser resolves it against the document URL `/`.
    const url = new URL(asset, base);
    const res = await get(port, url.pathname);
    assert.equal(res.status, 200, `asset ${asset} resolved to ${url.pathname} -> ${res.status}`);
    assert.ok(res.body.length > 0, `asset ${asset} is empty`);
    if (url.pathname.endsWith('.css')) assert.match(res.headers['content-type'], /text\/css/, asset);
    if (url.pathname.endsWith('.js')) assert.match(res.headers['content-type'], /javascript/, asset);
  }
});

test('the whole ES module graph reachable from the shell resolves to 200', async (t) => {
  const server = createStaticServer({ root: PACKAGE_ROOT });
  const port = await listen(server);
  t.after(() => server.close());

  const base = `http://127.0.0.1:${port}/`;
  const shell = await get(port, '/');
  const entryPoints = extractDocumentAssets(shell.body)
    .map((a) => new URL(a, base))
    .filter((u) => u.pathname.endsWith('.js'));
  assert.equal(entryPoints.length, 1, 'expected exactly one module entry point');

  const seen = new Set();
  const queue = entryPoints.map((u) => u.pathname);
  while (queue.length > 0) {
    const pathname = queue.shift();
    if (seen.has(pathname)) continue;
    seen.add(pathname);
    const res = await get(port, pathname);
    assert.equal(res.status, 200, `module ${pathname} -> ${res.status}`);
    assert.match(res.headers['content-type'], /javascript/, pathname);
    const allSpecifiers = [];
    for (const m of res.body.matchAll(/\bfrom\s*["']([^"']+)["']/g)) allSpecifiers.push(m[1]);
    for (const m of res.body.matchAll(/\bimport\s*["']([^"']+)["']/g)) allSpecifiers.push(m[1]);
    for (const m of res.body.matchAll(/\bimport\s*\(\s*["']([^"']+)["']\s*\)/g)) allSpecifiers.push(m[1]);
    for (const specifier of allSpecifiers) {
      assert.match(specifier, /^(?:\.{1,2}\/|\/)/, `browser module ${pathname} imports unresolvable bare specifier ${specifier}`);
    }
    for (const specifier of extractModuleSpecifiers(res.body)) {
      queue.push(new URL(specifier, new URL(pathname, base)).pathname);
    }
  }

  // The graph must actually cross from ui/ into the platform-neutral core.
  assert.ok(seen.size > 10, `module graph unexpectedly small: ${seen.size}`);
  assert.ok([...seen].some((p) => p.startsWith('/ui/js/views/')), 'no view module was loaded');
  assert.ok([...seen].some((p) => p.startsWith('/src/core/')), 'the core was never reached from the shell');
});

test('the shell uses root-absolute asset URLs so it renders identically at / and /ui/index.html', async (t) => {
  const server = createStaticServer({ root: PACKAGE_ROOT });
  const port = await listen(server);
  t.after(() => server.close());

  const direct = await get(port, '/ui/index.html');
  assert.equal(direct.status, 200);
  const assets = extractDocumentAssets(direct.body);
  for (const asset of assets) {
    assert.equal(asset.startsWith('/ui/'), true, `${asset} is document-relative and breaks when served at /`);
    const res = await get(port, asset);
    assert.equal(res.status, 200, `${asset} -> ${res.status}`);
  }
});
