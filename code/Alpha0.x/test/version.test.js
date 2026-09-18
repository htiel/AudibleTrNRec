import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';

import {
  ALPHA_VERSION, LEGACY_ALPHA_VERSION, SCHEMA_VERSION, LEGACY_SCHEMA_VERSION,
  CONTRACT_VERSION, POLICY_VERSION, RUNTIME_PROFILE, PRIVATE_ALPHA_RUNTIME_PROFILE,
  PRIVATE_DATA_DIRECTORY, STORAGE_SCHEMA_VERSION, LEGACY_STORAGE_SCHEMA_VERSION,
  INTERIM_STORAGE_SCHEMA_VERSION,
  STORAGE_SCHEMA_REVISION,
} from '../src/version.js';
import { privateDataRoot } from '../src/store/encrypted-snapshot-store.js';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const srcDir = join(root, 'src');

function allSourceFiles(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...allSourceFiles(full));
    else if (name.endsWith('.js')) out.push(full);
  }
  return out;
}

test('the implemented release is declared in exactly one place and package.json agrees', () => {
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  assert.equal(ALPHA_VERSION, '0.0.2');
  assert.equal(pkg.version, ALPHA_VERSION);
  assert.equal(SCHEMA_VERSION, 'atr-schema-0.0.2');
  assert.equal(CONTRACT_VERSION, 'atr-evidence-contract-0.0.2');
  assert.equal(POLICY_VERSION, 'atr-trust-policy-0.0.2');
  assert.equal(RUNTIME_PROFILE.release, 'alpha 0.0.2');
  assert.equal(PRIVATE_ALPHA_RUNTIME_PROFILE.release, 'alpha 0.0.2');
});

test('the connector package declares the same implemented release', () => {
  const init = readFileSync(join(root, 'connector', 'atnr_connector', '__init__.py'), 'utf8');
  assert.match(init, /CONNECTOR_VERSION = "0\.0\.2"/);
  assert.match(init, /LEGACY_CUSTODY_RELEASE = "0\.0\.1"/);
});

test('the legacy release identity is immutable so existing state stays reachable', () => {
  // A release bump must not relocate custody, retire the legacy record label,
  // or make the revision-1 container unrecognizable.
  assert.equal(LEGACY_ALPHA_VERSION, '0.0.1');
  assert.equal(LEGACY_SCHEMA_VERSION, 'atr-schema-0.0.1');
  assert.equal(PRIVATE_DATA_DIRECTORY, 'Alpha0.0.1');
  assert.notEqual(LEGACY_ALPHA_VERSION, ALPHA_VERSION);
  assert.equal(PRIVATE_DATA_DIRECTORY.includes(ALPHA_VERSION), false);
});

test('storage identities are not inferred from the release string', () => {
  assert.equal(STORAGE_SCHEMA_VERSION, 3);
  assert.equal(INTERIM_STORAGE_SCHEMA_VERSION, 2);
  assert.equal(LEGACY_STORAGE_SCHEMA_VERSION, 1);
  assert.equal(STORAGE_SCHEMA_REVISION, 'atr-storage-r3');
  // Every historical revision must stay distinct and independently named, so a
  // container written by any earlier release remains classifiable.
  assert.equal(new Set([
    STORAGE_SCHEMA_VERSION, INTERIM_STORAGE_SCHEMA_VERSION, LEGACY_STORAGE_SCHEMA_VERSION,
  ]).size, 3);
  for (const value of [STORAGE_SCHEMA_REVISION, String(STORAGE_SCHEMA_VERSION)]) {
    assert.equal(value.includes(ALPHA_VERSION), false);
    assert.equal(value.includes(LEGACY_ALPHA_VERSION), false);
  }
});

test('the private custody root follows the legacy directory, not the release', () => {
  const previous = process.env.LOCALAPPDATA;
  process.env.LOCALAPPDATA = join('C:', 'synthetic-localappdata');
  try {
    const resolved = privateDataRoot();
    assert.equal(resolved.includes(join('ATnR', 'Alpha0.0.1', 'private-alpha')), true);
    assert.equal(resolved.includes(`Alpha${ALPHA_VERSION}`), false);
  } finally {
    if (previous === undefined) delete process.env.LOCALAPPDATA;
    else process.env.LOCALAPPDATA = previous;
  }
});

test('no release literal is hard-coded outside version.js', () => {
  for (const file of allSourceFiles(srcDir)) {
    if (file.endsWith(`${join('src', 'version.js')}`)) continue;
    const text = readFileSync(file, 'utf8');
    assert.equal(/['"`]0\.0\.[12]['"`]/.test(text), false, `${relative(root, file)} hard-codes the version`);
    assert.equal(/['"`]Alpha0\.0\.\d+['"`]/.test(text), false, `${relative(root, file)} hard-codes the custody directory`);
  }
});

test('Node package declares zero npm dependencies', () => {
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  assert.deepEqual(pkg.dependencies, {});
  assert.deepEqual(pkg.devDependencies, {});
  assert.equal(pkg.type, 'module');
  assert.equal(pkg.scripts.test, 'node --test "test/*.test.js"');
});

test('runtime profile records that no platform, provider, or account access is selected', () => {
  assert.equal(RUNTIME_PROFILE.platform, 'undecided');
  assert.equal(RUNTIME_PROFILE.transport, 'loopback-static-server-only');
  assert.equal(RUNTIME_PROFILE.outboundNetwork, 'none');
  assert.equal(RUNTIME_PROFILE.aiProvider, 'none');
  assert.equal(RUNTIME_PROFILE.audibleAccess, 'none');
  assert.equal(RUNTIME_PROFILE.credentialHandling, 'none');
  assert.equal(RUNTIME_PROFILE.browserAutomation, 'none');
  assert.equal(RUNTIME_PROFILE.dataSource, 'synthetic-fixtures');
});

test('runtime profile records the deferred features this alpha does not ship', () => {
  assert.equal(RUNTIME_PROFILE.ratingsFeature, 'deferred');
  assert.equal(RUNTIME_PROFILE.recommendationEngine, 'deferred');
});

test('the private runtime profile describes the feature it actually ships', () => {
  // The synthetic demo still defers ratings; the private runtime does not, and
  // the two profiles must not be allowed to drift into a single untrue claim.
  assert.notEqual(PRIVATE_ALPHA_RUNTIME_PROFILE.ratingsFeature, 'deferred');
  assert.equal(
    PRIVATE_ALPHA_RUNTIME_PROFILE.ratingsFeature,
    'local encrypted ratings, comments and tags',
  );
  assert.equal(PRIVATE_ALPHA_RUNTIME_PROFILE.recommendationEngine, 'deferred');
  assert.equal(PRIVATE_ALPHA_RUNTIME_PROFILE.dataSource, 'community-tested unofficial Audible API');
});

test('platform-neutral core imports nothing external and touches no I/O, network, or credential API', () => {
  const forbiddenImport = /from\s+['"](?!\.\.?\/)[^'"]+['"]/;
  const forbiddenApi = /\b(fetch|XMLHttpRequest|WebSocket|require|eval|child_process|localStorage|process\.env)\b|node:(fs|http|https|net|tls|dns|child_process|crypto)/;
  const platformNeutral = allSourceFiles(srcDir).filter((file) => {
    const rel = relative(srcDir, file).split('\\').join('/');
    return !rel.startsWith('adapters/')
      && !rel.startsWith('security/')
      && !rel.startsWith('store/')
      && rel !== 'sync/private-alpha-service.js';
  });
  for (const file of platformNeutral) {
    const text = readFileSync(file, 'utf8');
    for (const line of text.split('\n')) {
      if (line.trimStart().startsWith('*') || line.trimStart().startsWith('//')) continue;
      assert.equal(forbiddenImport.test(line), false, `${relative(root, file)}: external import -> ${line.trim()}`);
      assert.equal(forbiddenApi.test(line), false, `${relative(root, file)}: forbidden API -> ${line.trim()}`);
    }
  }
});
