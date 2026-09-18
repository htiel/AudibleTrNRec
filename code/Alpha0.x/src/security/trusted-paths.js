/**
 * Trusted absolute executable resolution (A2-WP016 / ATR-S016).
 *
 * PATH order, the working directory and user-writable staging areas are all
 * attacker-influenced on a normal Windows profile. Nothing in this project may
 * launch an interpreter or a Windows system helper by bare name, by relative
 * path, or from an unsafe root. Every launch target must be:
 *
 *   1. an absolute path,
 *   2. an existing regular file (resolved through any link),
 *   3. inside an approved root, and
 *   4. outside every known user-writable staging root.
 *
 * This module performs no process execution of its own.
 */

import { realpathSync, statSync } from 'node:fs';
import path from 'node:path';

export class TrustedPathError extends Error {
  constructor(code) {
    super(code);
    this.name = 'TrustedPathError';
    this.code = code;
  }
}

/** Directory names that must never contain a launch target. */
const UNSAFE_SEGMENTS = Object.freeze([
  'downloads',
  'temp',
  'tmp',
  'public',
  '$recycle.bin',
  'onedrive',
  'inetpub',
  'node_modules',
]);

function normalizedRealPath(candidate) {
  try {
    return realpathSync.native ? realpathSync.native(candidate) : realpathSync(candidate);
  } catch {
    return null;
  }
}

export function isContainedIn(child, parent) {
  const rel = path.relative(parent, child);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

/** The Windows installation root, taken only from a validated environment value. */
export function systemRoot(env = process.env) {
  const candidate = env.SystemRoot ?? env.windir ?? 'C:\\Windows';
  if (typeof candidate !== 'string' || !/^[A-Za-z]:\\[^<>"|?*]*$/.test(candidate)) {
    throw new TrustedPathError('system-root-invalid');
  }
  const real = normalizedRealPath(candidate);
  if (real === null) throw new TrustedPathError('system-root-unavailable');
  return real;
}

/**
 * Resolve a Windows system executable (for example `whoami.exe`) to its
 * absolute System32 path. Bare names, separators and traversal are rejected.
 */
export function trustedSystemExecutable(name, env = process.env) {
  if (typeof name !== 'string' || !/^[A-Za-z0-9._-]+\.exe$/i.test(name)) {
    throw new TrustedPathError('system-executable-name-invalid');
  }
  const resolved = path.join(systemRoot(env), 'System32', name);
  const real = normalizedRealPath(resolved);
  if (real === null || !statSync(real).isFile()) {
    throw new TrustedPathError('system-executable-missing');
  }
  if (!isContainedIn(real, path.join(systemRoot(env), 'System32'))) {
    throw new TrustedPathError('system-executable-outside-system32');
  }
  return real;
}

/** True when the path lies inside a user-writable staging root. */
export function hasUnsafeRootSegment(candidate) {
  const segments = candidate.toLowerCase().split(/[\\/]+/);
  return UNSAFE_SEGMENTS.some((segment) => segments.includes(segment));
}

/**
 * Validate an interpreter/helper path before it is ever spawned.
 * `allowedRoots` is a closed list of absolute approved directories.
 */
export function assertTrustedExecutable(candidate, { allowedRoots = [], env = process.env } = {}) {
  if (typeof candidate !== 'string' || candidate.length === 0) {
    throw new TrustedPathError('executable-path-required');
  }
  if (!path.isAbsolute(candidate)) {
    // Bare names resolve through PATH and relative names through the working
    // directory; both are hijackable.
    throw new TrustedPathError('executable-path-not-absolute');
  }
  const real = normalizedRealPath(candidate);
  if (real === null) throw new TrustedPathError('executable-not-found');
  let stats;
  try {
    stats = statSync(real);
  } catch {
    throw new TrustedPathError('executable-not-found');
  }
  if (!stats.isFile()) throw new TrustedPathError('executable-not-a-file');
  if (process.platform === 'win32' && !/\.exe$/i.test(real)) {
    throw new TrustedPathError('executable-extension-rejected');
  }
  if (hasUnsafeRootSegment(real)) throw new TrustedPathError('executable-root-unsafe');
  const roots = allowedRoots.filter((root) => typeof root === 'string' && path.isAbsolute(root));
  if (roots.length > 0 && !roots.some((root) => isContainedIn(real, root))) {
    throw new TrustedPathError('executable-outside-approved-root');
  }
  void env;
  return real;
}

/**
 * Minimal, explicit environment for a spawned local helper. Proxy, Python
 * path/home/startup and every credential-shaped variable are dropped; PATH is
 * reduced to System32 so a helper cannot resolve a shadowed tool.
 */
export function minimalWindowsEnv(env = process.env) {
  const root = systemRoot(env);
  const system32 = path.join(root, 'System32');
  const out = {
    SystemRoot: root,
    windir: root,
    PATH: [system32, path.join(system32, 'Wbem'), path.join(system32, 'WindowsPowerShell', 'v1.0')].join(';'),
    PATHEXT: '.EXE;.COM',
    COMSPEC: path.join(system32, 'cmd.exe'),
    PYTHONDONTWRITEBYTECODE: '1',
    PYTHONIOENCODING: 'utf-8',
    PYTHONUTF8: '1',
    PYTHONNOUSERSITE: '1',
  };
  // Values the connector legitimately needs for DPAPI custody and for the
  // provider-hosted browser. Copied only when present and string-shaped.
  //
  // TEMP/TMP are deliberately omitted. The connector stages every file inside
  // the hardened custody root, so it has no legitimate need for a temporary
  // directory, and passing one through would offer a writable location outside
  // the custody boundary for personal bytes to land in.
  for (const name of [
    'SystemDrive', 'LOCALAPPDATA', 'APPDATA', 'USERPROFILE', 'HOMEDRIVE', 'HOMEPATH',
    'ProgramFiles', 'ProgramFiles(x86)', 'ProgramData', 'NUMBER_OF_PROCESSORS',
    'PROCESSOR_ARCHITECTURE', 'OS',
  ]) {
    const value = env[name];
    if (typeof value === 'string' && value.length > 0 && value.length < 1024) out[name] = value;
  }
  return out;
}

/**
 * Ordered candidate interpreters for connector setup. An explicit override is
 * honoured only if it is absolute and passes the trusted-executable checks.
 */
export function pythonCandidates({ packageRoot, env = process.env } = {}) {
  const local = env.LOCALAPPDATA;
  const programs = typeof local === 'string' ? path.join(local, 'Programs', 'Python') : null;
  return [
    env.ATNR_PYTHON,
    packageRoot ? path.join(packageRoot, '.venv', 'Scripts', 'python.exe') : null,
    programs ? path.join(programs, 'Python313-x64', 'python.exe') : null,
    programs ? path.join(programs, 'Python313', 'python.exe') : null,
    programs ? path.join(programs, 'Python313-arm64', 'python.exe') : null,
    programs ? path.join(programs, 'Python312', 'python.exe') : null,
    env.ProgramFiles ? path.join(env.ProgramFiles, 'Python313', 'python.exe') : null,
  ].filter((value) => typeof value === 'string' && value.length > 0);
}

/** Approved roots for a Python interpreter used by this package. */
export function pythonAllowedRoots({ packageRoot, env = process.env } = {}) {
  const roots = [];
  if (packageRoot) roots.push(path.join(packageRoot, '.venv'));
  if (typeof env.LOCALAPPDATA === 'string') roots.push(path.join(env.LOCALAPPDATA, 'Programs', 'Python'));
  if (typeof env.ProgramFiles === 'string') roots.push(env.ProgramFiles);
  if (typeof env['ProgramFiles(x86)'] === 'string') roots.push(env['ProgramFiles(x86)']);
  return roots;
}
