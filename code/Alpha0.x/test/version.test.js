import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';

import { ALPHA_VERSION, SCHEMA_VERSION, CONTRACT_VERSION, POLICY_VERSION, RUNTIME_PROFILE } from '../src/version.js';

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

test('0.0.1 is declared in exactly one place and package.json agrees', () => {
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  assert.equal(ALPHA_VERSION, '0.0.1');
  assert.equal(pkg.version, ALPHA_VERSION);
  assert.equal(SCHEMA_VERSION, 'atr-schema-0.0.1');
  assert.equal(CONTRACT_VERSION, 'atr-evidence-contract-0.0.1');
  assert.equal(POLICY_VERSION, 'atr-trust-policy-0.0.1');
});

test('no version literal is hard-coded outside version.js', () => {
  for (const file of allSourceFiles(srcDir)) {
    if (file.endsWith(`${join('src', 'version.js')}`)) continue;
    const text = readFileSync(file, 'utf8');
    assert.equal(/['"`]0\.0\.1['"`]/.test(text), false, `${relative(root, file)} hard-codes the version`);
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

test('platform-neutral core imports nothing external and touches no I/O, network, or credential API', () => {
  const forbiddenImport = /from\s+['"](?!\.\.?\/)[^'"]+['"]/;
  const forbiddenApi = /\b(fetch|XMLHttpRequest|WebSocket|require|eval|child_process|localStorage|process\.env)\b|node:(fs|http|https|net|tls|dns|child_process|crypto)/;
  const platformNeutral = allSourceFiles(srcDir).filter((file) => {
    const rel = relative(srcDir, file).split('\\').join('/');
    return !rel.startsWith('adapters/')
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
