import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(here, '..');
const connectorRoot = path.join(packageRoot, 'connector');

export function assertPrivateAlphaPolicy({
  packageJson = JSON.parse(readFileSync(path.join(packageRoot, 'package.json'), 'utf8')),
  policy = JSON.parse(readFileSync(path.join(packageRoot, 'connector', 'private-alpha-policy.json'), 'utf8')),
} = {}) {
  if (packageJson.private !== true) throw new Error('package-must-remain-private');
  if ('publishConfig' in packageJson) throw new Error('publish-config-prohibited');
  if (policy.distribution !== 'private-alpha') throw new Error('private-alpha-distribution-required');
  if (policy.commercialShippingBlocked !== true) throw new Error('commercial-shipping-must-be-blocked');
  if (policy.appAbbreviation !== 'ATnR') throw new Error('private-alpha-app-identity');
  if (!Number.isInteger(policy.maximumNamedTesters) || policy.maximumNamedTesters > 10) {
    throw new Error('private-alpha-tester-limit');
  }
  return policy;
}

/** Approved package index hosts. Anything else is an unreviewed source. */
export const APPROVED_INDEX_HOSTS = Object.freeze(['pypi.org', 'files.pythonhosted.org']);

export const REQUIRED_INSTALL_FLAGS = Object.freeze([
  '--require-hashes',
  '--no-deps',
  '--only-binary',
  ':all:',
]);

function digestOf(file) {
  return createHash('sha256').update(readFileSync(file)).digest('hex');
}

/**
 * Parses the pinned lock into structured entries.
 *
 * Expected shape per distribution, written by `scripts/record-dependency-hashes.py`:
 *
 *   # anyio-4.15.1-py3-none-any.whl
 *   anyio==4.15.1 \
 *       --hash=sha256:<64 hex>
 *
 * The filename comment records which artifact the digest belongs to, so a
 * source distribution can never be smuggled in behind `--only-binary :all:`
 * without being visible in the digest-protected lock.
 */
function parseLock(lockText) {
  const entries = [];
  let pendingFilename = null;
  let current = null;
  for (const raw of lockText.split('\n')) {
    const line = raw.trim();
    if (line.length === 0) continue;
    if (line.startsWith('#')) {
      pendingFilename = line.slice(1).trim();
      continue;
    }
    if (line.startsWith('--hash=sha256:')) {
      if (!current) throw new Error('dependency-lock-malformed');
      const digest = line.slice('--hash=sha256:'.length).trim();
      if (!/^[a-f0-9]{64}$/.test(digest)) throw new Error('dependency-lock-malformed');
      current.hashes.push(digest);
      continue;
    }
    const requirement = line.replace(/\\$/, '').trim();
    const match = /^([A-Za-z0-9._-]+)==([A-Za-z0-9._+!-]+)$/.exec(requirement);
    if (!match) throw new Error('dependency-lock-malformed');
    current = { name: match[1], version: match[2], filename: pendingFilename, hashes: [] };
    entries.push(current);
    pendingFilename = null;
  }
  return entries;
}

const WHEEL_SUFFIX = '.whl';

/**
 * Dependency provenance guard (A2-WP018 / ATR-S018).
 *
 * Verifies that the recorded manifest digests still match the files on disk,
 * that the approved index is an HTTPS host on the approved list, and that the
 * hash-pinned install flags have not been weakened. A tampered lock, a swapped
 * requirements file or an index override fails closed.
 *
 * `requireArtifactHashes` additionally refuses to proceed until every locked
 * distribution carries a `--hash=` entry, and until every source distribution
 * in the lock is covered by an accepted, hash-bound exception. No install is
 * performed here.
 */
export function assertDependencyProvenance({
  root = connectorRoot,
  requireArtifactHashes = false,
} = {}) {
  const manifestPath = path.join(root, 'dependency-provenance.json');
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  } catch {
    throw new Error('dependency-provenance-unavailable');
  }
  if (manifest.schemaVersion !== 1) throw new Error('dependency-provenance-version');

  let index;
  try {
    index = new URL(String(manifest.approvedIndexUrl));
  } catch {
    throw new Error('dependency-index-invalid');
  }
  if (index.protocol !== 'https:' || !APPROVED_INDEX_HOSTS.includes(index.hostname)) {
    throw new Error('dependency-index-not-approved');
  }

  const flags = Array.isArray(manifest.requiredInstallFlags) ? manifest.requiredInstallFlags : [];
  for (const flag of REQUIRED_INSTALL_FLAGS) {
    if (!flags.includes(flag)) throw new Error('dependency-install-flags-weakened');
  }

  const digests = manifest.manifestDigests ?? {};
  const names = Object.keys(digests);
  if (names.length === 0) throw new Error('dependency-provenance-empty');
  for (const name of names) {
    if (!/^[A-Za-z0-9._-]+$/.test(name)) throw new Error('dependency-provenance-entry-invalid');
    let actual;
    try {
      actual = digestOf(path.join(root, name));
    } catch {
      throw new Error('dependency-artifact-missing');
    }
    if (actual !== digests[name]) throw new Error('dependency-artifact-tampered');
  }

  const lockText = readFileSync(path.join(root, 'requirements-private-alpha.lock'), 'utf8');
  const entries = parseLock(lockText);
  if (entries.length === 0) throw new Error('dependency-provenance-empty');
  const artifactHashesRecorded = entries.every((entry) => entry.hashes.length > 0);
  if (manifest.artifactHashesRecorded === true && !artifactHashesRecorded) {
    throw new Error('dependency-artifact-hashes-missing');
  }
  if (requireArtifactHashes && !artifactHashesRecorded) {
    throw new Error('dependency-hashes-not-recorded');
  }

  const exceptions = Array.isArray(manifest.sourceArtifactExceptions)
    ? manifest.sourceArtifactExceptions
    : [];
  const sourceArtifacts = entries.filter(
    (entry) => typeof entry.filename === 'string' && !entry.filename.endsWith(WHEEL_SUFFIX),
  );

  // An accepted exception is bound to the exact artifact bytes. A stale or
  // unbound exception is itself a failure: approval must never widen silently.
  for (const exception of exceptions) {
    if (exception?.accepted !== true) continue;
    const covered = sourceArtifacts.some(
      (entry) => entry.name === exception.name
        && entry.version === exception.version
        && entry.filename === exception.filename
        && entry.hashes.includes(exception.sha256),
    );
    if (!covered) throw new Error('dependency-source-exception-unmatched');
  }

  const approvedSourceNames = new Set(
    exceptions
      .filter((exception) => exception?.accepted === true)
      .map((exception) => `${exception.name}==${exception.version}`),
  );
  const unapprovedSourceArtifacts = sourceArtifacts
    .filter((entry) => !approvedSourceNames.has(`${entry.name}==${entry.version}`))
    .map((entry) => `${entry.name}==${entry.version}`);
  if (requireArtifactHashes && unapprovedSourceArtifacts.length > 0) {
    throw new Error('dependency-source-artifact-unapproved');
  }

  return Object.freeze({
    indexUrl: index.href,
    installFlags: Object.freeze([...flags]),
    artifactHashesRecorded,
    requirementCount: entries.length,
    sourceArtifacts: Object.freeze(sourceArtifacts.map((entry) => `${entry.name}==${entry.version}`)),
    approvedSourceArtifacts: Object.freeze([...approvedSourceNames]),
    unapprovedSourceArtifacts: Object.freeze(unapprovedSourceArtifacts),
  });
}

function isMainModule() {
  return process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
}

if (isMainModule()) {
  assertPrivateAlphaPolicy();
  const provenance = assertDependencyProvenance();
  if (process.argv.includes('--block-pack')) {
    console.error('Commercial/public packaging is blocked for the ATnR private alpha.');
    process.exitCode = 1;
  } else {
    console.log('ATnR private-alpha policy: valid; commercial shipping blocked.');
    console.log(provenance.artifactHashesRecorded
      ? `Dependency provenance: manifest digests verified; artifact hashes recorded for ${provenance.requirementCount} distributions.`
      : 'Dependency provenance: manifest digests verified; artifact hashes NOT recorded - connector install is blocked.');
    if (provenance.unapprovedSourceArtifacts.length > 0) {
      console.log(`Dependency provenance: source distributions awaiting named approval: ${provenance.unapprovedSourceArtifacts.join(', ')} - connector install is blocked.`);
    }
  }
}
