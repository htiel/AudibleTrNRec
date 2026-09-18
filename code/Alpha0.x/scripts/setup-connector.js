#!/usr/bin/env node
/**
 * Connector setup (A2-WP016/WP018 / ATR-S016, ATR-S018).
 *
 * Two hard rules:
 *  1. Only an absolute, existing interpreter inside an approved root is ever
 *     launched. The previous bare-name `python` fallback is removed: it
 *     resolved through PATH, which any writable earlier entry can hijack.
 *  2. No dependency is installed without verified provenance. The install is
 *     hash-pinned, dependency re-resolution is disabled, only reviewed binary
 *     wheels are accepted, and the index is the approved one. Until every
 *     locked distribution carries a recorded artifact hash, and every source
 *     distribution carries a named hash-bound approval, this command fails
 *     closed rather than installing an unverified set.
 */

import { existsSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { assertPrivateAlphaPolicy, assertDependencyProvenance } from './private-alpha-policy.js';
import {
  assertTrustedExecutable,
  minimalWindowsEnv,
  pythonAllowedRoots,
  pythonCandidates,
} from '../src/security/trusted-paths.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const venv = path.join(root, '.venv');
const venvPython = path.join(venv, 'Scripts', 'python.exe');
const connectorRoot = path.join(root, 'connector');
const requirements = path.join(connectorRoot, 'requirements-private-alpha.lock');

function runTrusted(executable, args, { inherit = true } = {}) {
  return spawnSync(executable, args, {
    cwd: root,
    stdio: inherit ? 'inherit' : 'ignore',
    windowsHide: true,
    shell: false,
    env: minimalWindowsEnv(),
  });
}

/** First candidate that is absolute, exists in an approved root, and runs. */
export function findTrustedPython({ env = process.env } = {}) {
  const allowedRoots = pythonAllowedRoots({ packageRoot: root, env });
  for (const candidate of pythonCandidates({ packageRoot: root, env })) {
    let trusted;
    try {
      trusted = assertTrustedExecutable(candidate, { allowedRoots, env });
    } catch {
      continue; // unsafe root, missing file, relative path or bare name
    }
    if (runTrusted(trusted, ['--version'], { inherit: false }).status === 0) return trusted;
  }
  throw new Error([
    'No trusted Python interpreter was found.',
    'Install Python 3.11-3.14 for this user and set ATNR_PYTHON to its full absolute path.',
    'Bare-name and PATH-resolved interpreters are rejected by design.',
  ].join(' '));
}

function run(executable, args) {
  const result = runTrusted(executable, args);
  if (result.status !== 0) throw new Error(`Connector setup command failed (${result.status ?? 'launch'}).`);
}

assertPrivateAlphaPolicy();

let provenance;
try {
  provenance = assertDependencyProvenance({ requireArtifactHashes: true });
} catch (error) {
  if (error.message === 'dependency-hashes-not-recorded') {
    console.error([
      'ATnR connector install is blocked: artifact hashes are not recorded.',
      'Run `node scripts/record-dependency-hashes.py` (via the trusted interpreter)',
      'to record a --hash=sha256: entry for every locked distribution in',
      'connector/requirements-private-alpha.lock, set artifactHashesRecorded',
      'to true in connector/dependency-provenance.json, and obtain Worf/Data',
      'approval (A2-WP018 / ATR-S018) before installing.',
    ].join(' '));
    process.exit(1);
  }
  if (error.message === 'dependency-source-artifact-unapproved') {
    console.error([
      'ATnR connector install is blocked: the lock contains source distributions',
      'that cannot satisfy --only-binary :all:. Installing a source distribution',
      'executes its build script, so it requires a named, hash-bound approval.',
      'Review each entry in sourceArtifactExceptions in',
      'connector/dependency-provenance.json and set accepted to true only after',
      'Worf/Data sign-off (A2-WP018 / ATR-S018). The install flags are not',
      'relaxed globally: each approved distribution is scoped with --no-binary.',
    ].join(' '));
    process.exit(1);
  }
  console.error(`ATnR connector install is blocked: ${error.message}.`);
  process.exit(1);
}

let python;
if (existsSync(venvPython)) {
  python = assertTrustedExecutable(venvPython, { allowedRoots: [venv] });
} else {
  run(findTrustedPython(), ['-m', 'venv', venv]);
  python = assertTrustedExecutable(venvPython, { allowedRoots: [venv] });
}

// `--only-binary :all:` stays in force. Each named, hash-bound approval is
// scoped to one distribution by name; no wildcard source install is possible.
const sourceExceptionFlags = provenance.approvedSourceArtifacts.flatMap(
  (pin) => ['--no-binary', pin.split('==')[0]],
);

run(python, [
  '-m', 'pip', 'install',
  '--disable-pip-version-check',
  '--no-input',
  '--index-url', provenance.indexUrl,
  '--require-hashes',
  '--no-deps',
  '--only-binary', ':all:',
  ...sourceExceptionFlags,
  '-r', requirements,
]);
console.log('ATnR private-alpha connector is installed. Edge is used for provider authorization.');
