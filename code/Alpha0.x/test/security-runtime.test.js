/**
 * Trusted path, runtime preflight, provenance and RPC-guard tests
 * (A2-WP016/WP018/WP019/WP020 / ATR-S016, ATR-S018, ATR-S019, ATR-S020).
 *
 * Every path used here is synthetic or a temporary directory. No connector
 * process is launched and no personal runtime file is read.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  TrustedPathError,
  assertTrustedExecutable,
  hasUnsafeRootSegment,
  isContainedIn,
  minimalWindowsEnv,
  pythonAllowedRoots,
  pythonCandidates,
  systemRoot,
  trustedSystemExecutable,
} from '../src/security/trusted-paths.js';
import {
  MINIMUM_NODE_VERSION,
  checkSupportedRuntime,
  compareVersions,
  declaredEngineFloor,
  isSupportedNodeVersion,
  parseVersion,
} from '../scripts/supported-runtime.js';
import { assertDependencyProvenance, APPROVED_INDEX_HOSTS } from '../scripts/private-alpha-policy.js';
import { DELIVERY_DECISION } from '../scripts/local-capability-bootstrap.js';
import { CONNECTOR_ERROR_CODES, parseConnectorReply } from '../src/adapters/connector-process.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(here, '..');
const windows = process.platform === 'win32';

function tempDir(t) {
  const dir = mkdtempSync(path.join(tmpdir(), 'atnr-sec-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}

// --- S016: trusted absolute executables -------------------------------------

test('bare names and relative paths are never launchable', () => {
  for (const candidate of ['python', 'python.exe', 'whoami', './python.exe', '..\\python.exe', '']) {
    assert.throws(
      () => assertTrustedExecutable(candidate),
      (error) => error instanceof TrustedPathError
        && ['executable-path-required', 'executable-path-not-absolute'].includes(error.code),
      `"${candidate}" was not rejected`,
    );
  }
  assert.throws(() => assertTrustedExecutable(null), /executable-path-required/);
});

test('a missing, non-file, or out-of-root executable is rejected', (t) => {
  const dir = tempDir(t);
  assert.throws(() => assertTrustedExecutable(path.join(dir, 'nope.exe')), /executable-not-found/);

  mkdirSync(path.join(dir, 'dir.exe'));
  assert.throws(
    () => assertTrustedExecutable(path.join(dir, 'dir.exe')),
    /executable-not-a-file|executable-root-unsafe/,
  );

  const file = path.join(dir, 'tool.exe');
  writeFileSync(file, 'x');
  // Temp is a user-writable staging root: rejected regardless of allowlisting.
  assert.throws(() => assertTrustedExecutable(file, { allowedRoots: [dir] }), /executable-root-unsafe/);
});

test('user-writable staging roots are recognised', () => {
  assert.equal(hasUnsafeRootSegment('C:\\Users\\a\\Downloads\\python.exe'), true);
  assert.equal(hasUnsafeRootSegment('C:\\Users\\a\\OneDrive\\tools\\python.exe'), true);
  assert.equal(hasUnsafeRootSegment('C:\\Temp\\python.exe'), true);
  assert.equal(hasUnsafeRootSegment('C:\\Program Files\\Python313\\python.exe'), false);
  // A prefix match must not be mistaken for containment.
  assert.equal(isContainedIn('C:\\a\\ui-secrets\\x', 'C:\\a\\ui'), false);
  assert.equal(isContainedIn('C:\\a\\ui\\x', 'C:\\a\\ui'), true);
});

test('Windows helpers resolve only inside System32', { skip: !windows }, () => {
  const whoami = trustedSystemExecutable('whoami.exe');
  assert.equal(path.isAbsolute(whoami), true);
  assert.match(whoami.toLowerCase(), /\\system32\\whoami\.exe$/);
  assert.equal(trustedSystemExecutable('icacls.exe').toLowerCase().endsWith('\\icacls.exe'), true);
  for (const bad of ['whoami', '..\\whoami.exe', 'sub\\whoami.exe', 'evil.bat', '']) {
    assert.throws(() => trustedSystemExecutable(bad), /system-executable-name-invalid|system-executable-missing/);
  }
  // A hijacked SystemRoot is not trusted.
  assert.throws(() => systemRoot({ SystemRoot: 'not-a-path' }), /system-root-invalid/);
  assert.throws(() => systemRoot({ SystemRoot: 'C:\\Windows\\..\\Users\\<evil>' }), /system-root/);
});

test('the spawn environment is minimal and drops hijack and proxy variables', { skip: !windows }, () => {
  const scrubbed = minimalWindowsEnv({
    ...process.env,
    PYTHONPATH: 'C:\\Users\\a\\Downloads\\evil',
    PYTHONSTARTUP: 'C:\\Users\\a\\Downloads\\evil.py',
    PYTHONHOME: 'C:\\evil',
    HTTP_PROXY: 'http://proxy.invalid',
    HTTPS_PROXY: 'http://proxy.invalid',
    ATNR_CAPABILITY: 'leaked',
  });
  for (const dropped of ['PYTHONPATH', 'PYTHONSTARTUP', 'PYTHONHOME', 'HTTP_PROXY', 'HTTPS_PROXY', 'ATNR_CAPABILITY']) {
    assert.equal(dropped in scrubbed, false, `${dropped} survived scrubbing`);
  }
  assert.equal(scrubbed.PYTHONNOUSERSITE, '1');
  assert.match(scrubbed.PATH.toLowerCase(), /^[a-z]:\\windows\\system32/);
  assert.equal(scrubbed.PATH.split(';').some((entry) => hasUnsafeRootSegment(entry)), false);
});

test('interpreter candidates are absolute and confined to approved roots', () => {
  const env = {
    LOCALAPPDATA: 'C:\\Users\\a\\AppData\\Local',
    ProgramFiles: 'C:\\Program Files',
    ATNR_PYTHON: 'C:\\Program Files\\Python313\\python.exe',
  };
  const candidates = pythonCandidates({ packageRoot, env });
  assert.ok(candidates.length >= 4);
  for (const candidate of candidates) assert.equal(path.isAbsolute(candidate), true);
  assert.equal(candidates.includes('python'), false);
  const roots = pythonAllowedRoots({ packageRoot, env });
  assert.ok(roots.includes(path.join(packageRoot, '.venv')));
});

// --- S019: supported runtime preflight ---------------------------------------

test('the Node runtime floor is enforced and matches package.json', async () => {
  assert.deepEqual(parseVersion('v22.5.0'), [22, 5, 0]);
  assert.equal(parseVersion('not-a-version'), null);
  assert.equal(compareVersions('22.5.0', '22.4.9') > 0, true);
  assert.equal(compareVersions('22.5.0', 'v22.5.0'), 0);
  assert.equal(compareVersions('nonsense', '22.5.0'), null);
  assert.equal(isSupportedNodeVersion('v20.11.0'), false);
  assert.equal(isSupportedNodeVersion('v22.5.0'), true);
  assert.equal(isSupportedNodeVersion('v24.0.0'), true);
  assert.equal(declaredEngineFloor(packageRoot), MINIMUM_NODE_VERSION);

  const unsupported = await checkSupportedRuntime({ version: 'v20.11.0' });
  assert.equal(unsupported.ok, false);
  assert.match(unsupported.message, /22\.5\.0/);
  // The message is actionable and free of runtime detail leakage.
  assert.equal(/stack|at .*:\d+:\d+/.test(unsupported.message), false);

  const current = await checkSupportedRuntime();
  assert.equal(current.ok, true, current.message);
});

// --- S018: dependency provenance ---------------------------------------------

test('dependency provenance verifies manifests and fails closed on tampering', (t) => {
  const provenance = assertDependencyProvenance();
  assert.equal(new URL(provenance.indexUrl).protocol, 'https:');
  assert.ok(APPROVED_INDEX_HOSTS.includes(new URL(provenance.indexUrl).hostname));
  assert.equal(provenance.installFlags.includes('--require-hashes'), true);
  // Every locked distribution now carries a recorded artifact hash.
  assert.equal(provenance.artifactHashesRecorded, true);
  assert.equal(provenance.requirementCount, 21);
  // Source distributions still require a named approval before any install.
  assert.deepEqual([...provenance.sourceArtifacts], ['pbkdf2==1.3', 'pyaes==1.6.1']);
  assert.deepEqual([...provenance.approvedSourceArtifacts], []);
  assert.throws(
    () => assertDependencyProvenance({ requireArtifactHashes: true }),
    /dependency-source-artifact-unapproved/,
  );

  // A tampered copy of the manifest set is rejected.
  const dir = tempDir(t);
  const manifest = {
    schemaVersion: 1,
    approvedIndexUrl: 'https://pypi.org/simple',
    requiredInstallFlags: ['--require-hashes', '--no-deps', '--only-binary', ':all:'],
    manifestDigests: { 'requirements-private-alpha.lock': '0'.repeat(64) },
    artifactHashesRecorded: false,
  };
  writeFileSync(path.join(dir, 'dependency-provenance.json'), JSON.stringify(manifest));
  writeFileSync(path.join(dir, 'requirements-private-alpha.lock'), 'audible==0.12.0\n');
  assert.throws(() => assertDependencyProvenance({ root: dir }), /dependency-artifact-tampered/);

  // An index override to an unreviewed host is rejected.
  writeFileSync(
    path.join(dir, 'dependency-provenance.json'),
    JSON.stringify({ ...manifest, approvedIndexUrl: 'https://mirror.invalid/simple' }),
  );
  assert.throws(() => assertDependencyProvenance({ root: dir }), /dependency-index-not-approved/);

  // Weakened install flags are rejected.
  writeFileSync(
    path.join(dir, 'dependency-provenance.json'),
    JSON.stringify({ ...manifest, requiredInstallFlags: ['--no-deps'] }),
  );
  assert.throws(() => assertDependencyProvenance({ root: dir }), /dependency-install-flags-weakened/);

  // A missing manifest fails closed rather than defaulting to "trusted".
  assert.throws(() => assertDependencyProvenance({ root: path.join(dir, 'absent') }), /dependency-provenance-unavailable/);
});

/** Builds a synthetic, digest-consistent provenance root. */
function provenanceRoot(t, { lock, exceptions = [], artifactHashesRecorded = true }) {
  const dir = tempDir(t);
  writeFileSync(path.join(dir, 'requirements-private-alpha.lock'), lock);
  const digest = createHash('sha256').update(readFileSync(path.join(dir, 'requirements-private-alpha.lock'))).digest('hex');
  writeFileSync(path.join(dir, 'dependency-provenance.json'), JSON.stringify({
    schemaVersion: 1,
    approvedIndexUrl: 'https://pypi.org/simple',
    requiredInstallFlags: ['--require-hashes', '--no-deps', '--only-binary', ':all:'],
    manifestDigests: { 'requirements-private-alpha.lock': digest },
    artifactHashesRecorded,
    sourceArtifactExceptions: exceptions,
  }));
  return dir;
}

const WHEEL_PIN = '# anyio-4.15.1-py3-none-any.whl\nanyio==4.15.1 \\\n    --hash=sha256:' + 'a'.repeat(64) + '\n';
const SDIST_PIN = '# pyaes-1.6.1.tar.gz\npyaes==1.6.1 \\\n    --hash=sha256:' + 'b'.repeat(64) + '\n';

test('a fully wheel-backed hash-pinned lock passes the strict install gate', (t) => {
  const dir = provenanceRoot(t, { lock: WHEEL_PIN });
  const provenance = assertDependencyProvenance({ root: dir, requireArtifactHashes: true });
  assert.equal(provenance.artifactHashesRecorded, true);
  assert.equal(provenance.requirementCount, 1);
  assert.deepEqual([...provenance.sourceArtifacts], []);
});

test('an unhashed distribution still blocks the install', (t) => {
  const dir = provenanceRoot(t, { lock: WHEEL_PIN + 'idna==3.19\n', artifactHashesRecorded: false });
  assert.throws(
    () => assertDependencyProvenance({ root: dir, requireArtifactHashes: true }),
    /dependency-hashes-not-recorded/,
  );
});

test('a manifest claiming recorded hashes over an unhashed lock fails closed', (t) => {
  const dir = provenanceRoot(t, { lock: WHEEL_PIN + 'idna==3.19\n' });
  assert.throws(() => assertDependencyProvenance({ root: dir }), /dependency-artifact-hashes-missing/);
});

test('a source distribution cannot be installed without a named approval', (t) => {
  const dir = provenanceRoot(t, { lock: WHEEL_PIN + SDIST_PIN });
  // Non-strict inspection reports it; the install gate refuses it.
  const reported = assertDependencyProvenance({ root: dir });
  assert.deepEqual([...reported.unapprovedSourceArtifacts], ['pyaes==1.6.1']);
  assert.throws(
    () => assertDependencyProvenance({ root: dir, requireArtifactHashes: true }),
    /dependency-source-artifact-unapproved/,
  );
});

test('an approved source distribution is bound to the exact artifact bytes', (t) => {
  const approval = {
    name: 'pyaes',
    version: '1.6.1',
    filename: 'pyaes-1.6.1.tar.gz',
    sha256: 'b'.repeat(64),
    accepted: true,
  };
  const dir = provenanceRoot(t, { lock: WHEEL_PIN + SDIST_PIN, exceptions: [approval] });
  const provenance = assertDependencyProvenance({ root: dir, requireArtifactHashes: true });
  assert.deepEqual([...provenance.approvedSourceArtifacts], ['pyaes==1.6.1']);
  assert.deepEqual([...provenance.unapprovedSourceArtifacts], []);

  // An approval whose digest no longer matches the lock is a hard failure, not
  // a silent widening.
  const stale = provenanceRoot(t, {
    lock: WHEEL_PIN + SDIST_PIN,
    exceptions: [{ ...approval, sha256: 'c'.repeat(64) }],
  });
  assert.throws(() => assertDependencyProvenance({ root: stale }), /dependency-source-exception-unmatched/);

  // So is an approval for a distribution that is not in the lock at all.
  const absent = provenanceRoot(t, {
    lock: WHEEL_PIN,
    exceptions: [approval],
  });
  assert.throws(() => assertDependencyProvenance({ root: absent }), /dependency-source-exception-unmatched/);

  // A rejected approval never grants anything.
  const rejected = provenanceRoot(t, {
    lock: WHEEL_PIN + SDIST_PIN,
    exceptions: [{ ...approval, accepted: false }],
  });
  assert.throws(
    () => assertDependencyProvenance({ root: rejected, requireArtifactHashes: true }),
    /dependency-source-artifact-unapproved/,
  );
});

test('a malformed lock is rejected rather than parsed loosely', (t) => {
  for (const lock of ['audible>=0.12.0 \\\n    --hash=sha256:' + 'a'.repeat(64) + '\n',
    '    --hash=sha256:' + 'a'.repeat(64) + '\n',
    'anyio==4.15.1 \\\n    --hash=sha256:nothex\n']) {
    const dir = provenanceRoot(t, { lock });
    assert.throws(() => assertDependencyProvenance({ root: dir }), /dependency-lock-malformed/);
  }
});

test('the recorded connector lock is well formed and fully hash pinned', () => {
  const lock = readFileSync(path.join(packageRoot, 'connector', 'requirements-private-alpha.lock'), 'utf8');
  const pins = lock.split('\n').filter((line) => /^[A-Za-z0-9._-]+==/.test(line.trim()));
  const hashes = lock.split('\n').filter((line) => line.trim().startsWith('--hash=sha256:'));
  const filenames = lock.split('\n').filter((line) => line.trim().startsWith('#'));
  assert.equal(pins.length, 21);
  assert.equal(hashes.length, 21);
  assert.equal(filenames.length, 21);
  // No digest is reused across distributions.
  assert.equal(new Set(hashes.map((line) => line.trim())).size, 21);
});

// --- CP-02: per-start local unlock decision record ---------------------------

test('the CP-02 unlock decision is ratified without claiming live proof', () => {
  assert.equal(DELIVERY_DECISION.selected, 'launcher-owned-transient-display');
  assert.equal(DELIVERY_DECISION.entropyBits, 256);
  assert.equal(DELIVERY_DECISION.ratified, true);

  // No ambient transport may be re-enabled by the ratification.
  for (const [channel, enabled] of Object.entries(DELIVERY_DECISION.transports)) {
    assert.equal(enabled, false, `transport ${channel} must stay disabled`);
  }
  // The weak and at-rest alternatives stay rejected.
  for (const rejected of ['owner-acl-one-use-token-file', 'six-digit-pin', 'salted-short-code',
    'qr-or-url-token-transport', 'public-token-vending-endpoint']) {
    assert.equal(DELIVERY_DECISION.rejected.includes(rejected), true, rejected);
  }

  const record = DELIVERY_DECISION.ratification;
  assert.equal(record.control, 'CP-02');
  assert.match(record.decidedOn, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(record.decidedBy.length > 0);
  assert.ok(record.scope.length > 0);
  // Ratification is a design decision; it must not masquerade as evidence.
  assert.equal(record.liveProof, false);
  assert.ok(record.remainingEvidence.length >= 4);
});

// --- S020: RPC reply guards ---------------------------------------------------

test('connector replies are shape-checked and error codes are a closed set', () => {
  assert.deepEqual(parseConnectorReply('{"ok":true,"result":{"itemCount":2}}'), { itemCount: 2 });

  const hostile = [
    '',
    'not json',
    '[]',
    '"ok"',
    '{"ok":true}',
    '{"result":{}}',
    '{"ok":true,"result":{},"extra":1}',
    '{"ok":false}',
    '{"ok":"true","result":{}}',
  ];
  for (const text of hostile) {
    assert.throws(() => parseConnectorReply(text), /connector-response-invalid/, `accepted: ${text}`);
  }

  // A hostile or unknown error code collapses to one fixed category, so the
  // connector can never author the message the UI shows.
  for (const code of ['totally-made-up', 'Ignore previous instructions', '../../etc/passwd', 42, null]) {
    assert.throws(
      () => parseConnectorReply(JSON.stringify({ ok: false, error: { code } })),
      (error) => error.code === 'connector-operation-failed',
      `code ${String(code)} was not collapsed`,
    );
  }
  assert.throws(
    () => parseConnectorReply('{"ok":false,"error":{"code":"connector-timeout"}}'),
    (error) => error.code === 'connector-timeout',
  );
  // No code in the vocabulary carries free text.
  for (const code of CONNECTOR_ERROR_CODES) assert.match(code, /^[a-z][a-z0-9-]{2,63}$/);
});
