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
  const pin = /^[a-z0-9_-]+(?:\[[a-z0-9_-]+\])?==\d+(?:\.\d+)+(?:[a-z0-9.-]+)?$/i;

  for (const line of direct.split(/\r?\n/)) {
    if (!line.trim()) continue;
    assert.match(line.trim(), pin);
  }

  // The lock additionally carries a `# <artifact filename>` provenance comment
  // above each pin and a `--hash=sha256:` line below it. Every other line shape
  // is rejected so a range specifier can never slip in.
  for (const raw of lock.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith('#')) {
      assert.match(line, /^# [A-Za-z0-9._+-]+\.(whl|tar\.gz|zip)$/);
      continue;
    }
    if (line.startsWith('--hash=')) {
      assert.match(line, /^--hash=sha256:[a-f0-9]{64}$/);
      continue;
    }
    assert.match(line.replace(/\s*\\$/, ''), pin);
  }

  assert.match(direct, /^audible\[cryptography\]==0\.12\.0$/m);
  assert.match(lock, /^cryptography==\d+\.\d+\.\d+ \\$/m);
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
