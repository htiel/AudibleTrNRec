/**
 * Runtime data-source tests (Alpha 0.0.2 runtime requirement).
 *
 * The user-facing private runtime must be backed by the real encrypted local
 * state inside the protected custody boundary, and must never fall back to,
 * serve, or bootstrap into synthetic fixture data.
 *
 * Every path here is a temporary directory. No personal custody root is
 * created, read, hardened or deleted, and no library content is touched.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync, rmSync } from 'node:fs';
import { tmpdir, homedir } from 'node:os';
import path from 'node:path';

import {
  REQUIRED_RUNTIME_DATA_SOURCE,
  RUNTIME_CONTRACT_VERSION,
  RUNTIME_DATA_SOURCES,
  RuntimeDataSourceError,
  assertCustodyContained,
  assertCustodyRoot,
  assertRealDataRuntime,
  describeRuntimeDataSource,
  isSyntheticModulePath,
} from '../src/security/runtime-data-source.js';
import { createStaticServer } from '../scripts/serve.js';
import { LocalApiAuth, generateCapability } from '../src/security/local-api-auth.js';

/**
 * A custody-root stand-in outside the staging roots the policy refuses. It is
 * created under the home directory and removed immediately afterwards, so no
 * personal state is involved.
 */
function custodyRoot(t) {
  const base = mkdtempSync(path.join(homedir(), '.atnr-custody-test-'));
  t.after(() => rmSync(base, { recursive: true, force: true }));
  const root = path.join(base, 'ATnR', 'Alpha0.0.1', 'private-alpha');
  mkdirSync(root, { recursive: true });
  return root;
}

test('the runtime data source is a closed set and only real state is accepted', (t) => {
  const root = custodyRoot(t);
  const storePath = path.join(root, 'library.sqlite3');
  writeFileSync(storePath, 'sealed-bytes-placeholder');

  const descriptor = assertRealDataRuntime({
    dataSource: 'local-encrypted',
    custodyRoot: root,
    storePath,
    backupPath: `${storePath}.migration-backup`,
  });
  assert.equal(descriptor.dataSource, REQUIRED_RUNTIME_DATA_SOURCE);
  assert.equal(descriptor.synthetic, false);
  assert.equal(descriptor.custodyVerified, true);
  assert.equal(descriptor.hasExistingState, true);
  assert.equal(descriptor.rollbackEnvelopeContained, true);

  // The descriptor is safe to record and to hand to the browser: it carries no
  // count, title, identifier, timestamp or path.
  const serialized = JSON.stringify(descriptor);
  assert.equal(serialized.includes(root), false);
  assert.equal(serialized.includes('library.sqlite3'), false);
  assert.equal(/\d/.test(serialized.replace(RUNTIME_CONTRACT_VERSION, '')), false);

  assert.deepEqual(RUNTIME_DATA_SOURCES, ['local-encrypted', 'synthetic-fixture']);
  // A synthetic runtime may never reach a user-facing private session.
  assert.throws(
    () => assertRealDataRuntime({ dataSource: 'synthetic-fixture', custodyRoot: root, storePath }),
    (error) => error instanceof RuntimeDataSourceError && error.code === 'runtime-data-source-refused',
  );
  assert.throws(
    () => assertRealDataRuntime({ dataSource: 'demo', custodyRoot: root, storePath }),
    /runtime-data-source-unknown/,
  );
});

test('a missing local state is reported honestly, never substituted', (t) => {
  const root = custodyRoot(t);
  const descriptor = assertRealDataRuntime({
    custodyRoot: root,
    storePath: path.join(root, 'library.sqlite3'),
  });
  // Empty real state is a fact, not a reason to seed a demo library.
  assert.equal(descriptor.hasExistingState, false);
  assert.equal(descriptor.synthetic, false);
  assert.equal(descriptor.rollbackEnvelopeContained, null);
});

test('rollback envelopes must stay inside the custody boundary', (t) => {
  const root = custodyRoot(t);
  const storePath = path.join(root, 'library.sqlite3');
  writeFileSync(storePath, 'sealed-bytes-placeholder');

  for (const escape of [
    path.join(tmpdir(), 'library.sqlite3.backup'),
    path.join(root, '..', 'library.sqlite3.backup'),
    path.join(path.dirname(root), 'OneDrive', 'library.backup'),
    'library.sqlite3.backup',
  ]) {
    assert.throws(
      () => assertRealDataRuntime({ custodyRoot: root, storePath, backupPath: escape }),
      (error) => error instanceof RuntimeDataSourceError,
      `escape not refused: ${escape}`,
    );
  }

  // A "rollback envelope" that is the live file protects nothing.
  assert.throws(
    () => assertRealDataRuntime({ custodyRoot: root, storePath, backupPath: storePath }),
    /custody-rollback-path-conflict/,
  );
});

test('custody containment refuses links, traversal and staging roots', (t) => {
  const root = custodyRoot(t);
  assert.throws(() => assertCustodyContained('', root), /custody-path-required/);
  assert.throws(() => assertCustodyContained('relative.db', root), /custody-path-not-absolute/);
  assert.throws(
    () => assertCustodyContained(path.join(tmpdir(), 'x.db'), root),
    /custody-path-unsafe-root|custody-path-outside-boundary/,
  );

  const target = path.join(root, 'real.db');
  writeFileSync(target, 'x');
  const link = path.join(root, 'link.db');
  let linked = true;
  try {
    symlinkSync(target, link);
  } catch {
    linked = false; // symlink creation needs elevation on default Windows
  }
  if (linked) {
    assert.throws(() => assertCustodyContained(link, root), /custody-path-link-refused/);
  }

  assert.throws(() => assertCustodyRoot('not-absolute'), /custody-root-invalid/);
  assert.throws(() => assertCustodyRoot(path.join(root, 'absent')), /custody-root-missing/);
  assert.throws(() => assertCustodyRoot(target), /custody-root-not-a-directory/);
  assert.equal(assertCustodyRoot(root), path.resolve(root));
});

test('synthetic fixture modules are recognised regardless of separator or case', () => {
  for (const candidate of [
    'src/fixtures/synthetic.js',
    'src\\fixtures\\synthetic.js',
    '/src/fixtures/contract-fixtures.js',
    'SRC/FIXTURES/synthetic.js',
  ]) {
    assert.equal(isSyntheticModulePath(candidate), true, `not recognised: ${candidate}`);
  }
  for (const candidate of ['src/core/model.js', 'ui/js/store.js', 'src/fixture-notes.js', null]) {
    assert.equal(isSyntheticModulePath(candidate), false, `false positive: ${candidate}`);
  }
});

test('the bootstrap descriptor never reports an unverified runtime as real', () => {
  assert.deepEqual(
    describeRuntimeDataSource({ dataSource: 'local-encrypted' }),
    { dataSource: 'local-encrypted', contractVersion: RUNTIME_CONTRACT_VERSION, synthetic: false },
  );
  for (const hostile of [null, undefined, { dataSource: 'synthetic-fixture' }, { dataSource: 'local-encrypted ' }]) {
    assert.equal(describeRuntimeDataSource(hostile).dataSource, 'unverified');
    assert.equal(describeRuntimeDataSource(hostile).synthetic, false);
  }
});

// --- server behaviour ---------------------------------------------------------

function listen(server) {
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve(server.address().port));
  });
}

function request(port, target, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, path: target, method: 'GET', headers }, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => resolve({ status: res.statusCode, text: Buffer.concat(chunks).toString('utf8') }));
    });
    req.on('error', reject);
    req.end();
  });
}

const syntheticService = () => ({
  status: async () => ({ connected: false, commercialShippingBlocked: true, local: { itemCount: 0 } }),
  library: async () => null,
  connect: async () => ({ connected: true }),
  sync: async () => ({ itemCount: 0 }),
  disconnect: async () => ({ connected: false }),
  deleteLocalSnapshot: () => ({ itemCount: 0 }),
});

test('a private session never serves synthetic fixture modules', async (t) => {
  const capability = generateCapability();
  const server = createStaticServer({
    privateAlphaService: syntheticService(),
    auth: new LocalApiAuth({ digest: capability.digest }),
    runtimeSource: { dataSource: 'local-encrypted' },
  });
  const port = await listen(server);
  t.after(() => server.close());

  for (const target of ['/src/fixtures/synthetic.js', '/src/fixtures/contract-fixtures.js']) {
    const blocked = await request(port, target, { Host: `127.0.0.1:${port}` });
    assert.equal(blocked.status, 403, `${target} was served to a private session`);
    assert.equal(blocked.text, 'Forbidden');
  }
  // Real core modules are still served.
  const core = await request(port, '/src/core/model.js', { Host: `127.0.0.1:${port}` });
  assert.equal(core.status, 200);

  // The refusal is recorded as a bounded, content-free security event.
  const events = server.securityEvents.list();
  assert.ok(events.some((event) => event.category === 'data-source' && event.outcome === 'denied'));
  assert.equal(JSON.stringify(events).includes('fixtures'), false);
});

test('the synthetic build still serves its fixtures (tests and demos are unaffected)', async (t) => {
  const server = createStaticServer();
  const port = await listen(server);
  t.after(() => server.close());
  const response = await request(port, '/src/fixtures/synthetic.js', { Host: `127.0.0.1:${port}` });
  assert.equal(response.status, 200);
});

test('the authenticated bootstrap declares the real-data runtime contract', async (t) => {
  const capability = generateCapability();
  const server = createStaticServer({
    privateAlphaService: syntheticService(),
    auth: new LocalApiAuth({ digest: capability.digest }),
    runtimeSource: { dataSource: 'local-encrypted' },
  });
  const port = await listen(server);
  t.after(() => server.close());

  const response = await request(port, '/api/v1/session', {
    Host: `127.0.0.1:${port}`,
    Origin: `http://127.0.0.1:${port}`,
    'Sec-Fetch-Site': 'same-origin',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Dest': 'empty',
    Authorization: `ATnR-Capability ${capability.display}`,
  });
  assert.equal(response.status, 200);
  const { session } = JSON.parse(response.text);
  assert.deepEqual(session.runtime, {
    dataSource: 'local-encrypted',
    contractVersion: RUNTIME_CONTRACT_VERSION,
    synthetic: false,
  });
});

test('an unverified runtime is declared unverified, so the client refuses it', async (t) => {
  const capability = generateCapability();
  const server = createStaticServer({
    privateAlphaService: syntheticService(),
    auth: new LocalApiAuth({ digest: capability.digest }),
    runtimeSource: null, // custody was never verified
  });
  const port = await listen(server);
  t.after(() => server.close());

  const response = await request(port, '/api/v1/session', {
    Host: `127.0.0.1:${port}`,
    Origin: `http://127.0.0.1:${port}`,
    'Sec-Fetch-Site': 'same-origin',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Dest': 'empty',
    Authorization: `ATnR-Capability ${capability.display}`,
  });
  const { session } = JSON.parse(response.text);
  assert.equal(session.runtime.dataSource, 'unverified');
});

test('the browser client fails closed instead of falling back to synthetic data', async () => {
  const source = await import('node:fs').then(({ readFileSync }) => readFileSync(
    new URL('../ui/js/connection-api.js', import.meta.url),
    'utf8',
  ));
  // A 404 probe must throw, not return null: returning "nothing" is what lets
  // a caller seed a demo library and present it as the owner's history.
  assert.match(source, /private-alpha-runtime-unavailable/);
  assert.doesNotMatch(source, /return null;\s*\/\/ synthetic/);
  assert.match(source, /private-alpha-runtime-source-refused/);
  assert.match(source, /REQUIRED_DATA_SOURCE = 'local-encrypted'/);
  // The client module must not import or fetch fixture material.
  assert.doesNotMatch(source, /from\s+['"][^'"]*fixtures[^'"]*['"]/i);
  assert.doesNotMatch(source, /fetch\s*\(\s*['"][^'"]*fixtures/i);
});
