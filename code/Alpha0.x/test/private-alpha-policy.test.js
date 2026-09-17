import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { assertPrivateAlphaPolicy } from '../scripts/private-alpha-policy.js';

test('private alpha policy blocks commercial/public package shipping', () => {
  const policy = assertPrivateAlphaPolicy();
  assert.equal(policy.appAbbreviation, 'ATnR');
  assert.equal(policy.distribution, 'private-alpha');
  assert.equal(policy.commercialShippingBlocked, true);
  assert.ok(policy.maximumNamedTesters <= 10);
});

test('package prepack hook invokes the blocking shipping gate', () => {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assert.equal(pkg.private, true);
  assert.match(pkg.scripts.prepack, /private-alpha-policy\.js --block-pack/);
  assert.equal(pkg.publishConfig, undefined);
});

test('private connector direct and transitive dependencies are exactly pinned', () => {
  const direct = readFileSync(new URL('../connector/requirements-private-alpha.txt', import.meta.url), 'utf8');
  const lock = readFileSync(new URL('../connector/requirements-private-alpha.lock', import.meta.url), 'utf8');
  for (const line of [...direct.split(/\r?\n/), ...lock.split(/\r?\n/)]) {
    if (!line.trim()) continue;
    assert.match(line, /^[a-z0-9_-]+(?:\[[a-z0-9_-]+\])?==\d+(?:\.\d+)+(?:[a-z0-9.-]+)?$/i);
  }
  assert.match(direct, /^audible\[cryptography\]==0\.12\.0$/m);
  assert.match(lock, /^cryptography==\d+\.\d+\.\d+$/m);
});

test('shipping gate rejects a policy that permits commercial use', () => {
  assert.throws(() => assertPrivateAlphaPolicy({
    packageJson: { private: true },
    policy: {
      appAbbreviation: 'ATnR',
      distribution: 'private-alpha',
      commercialShippingBlocked: false,
      maximumNamedTesters: 10,
    },
  }), /commercial-shipping-must-be-blocked/);
});
