#!/usr/bin/env node
/**
 * Supported-runtime preflight (A2-WP019 / ATR-S019).
 *
 * The private-alpha runtime composes an SQLite-backed store through a static
 * import. On an unsupported Node build that import throws a raw internal
 * error long after startup has claimed success. This preflight runs *before*
 * the private runtime module is imported and returns one fixed, actionable
 * message instead.
 *
 * The declared engine floor, the tested profile and this check are the same
 * number in three places; `test/supported-runtime.test.js` asserts that.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** `node:sqlite` first shipped (behind a flag) in Node 22.5.0. */
export const MINIMUM_NODE_VERSION = '22.5.0';
/** From this version `node:sqlite` no longer needs an experimental flag. */
export const UNFLAGGED_NODE_VERSION = '23.4.0';

export const UNSUPPORTED_RUNTIME_MESSAGE = [
  `ATnR private alpha requires Node ${MINIMUM_NODE_VERSION} or newer for node:sqlite.`,
  `Install Node ${UNFLAGGED_NODE_VERSION}+ (recommended), or run Node ${MINIMUM_NODE_VERSION}+`,
  'with --experimental-sqlite. The private alpha will not start on this runtime.',
].join(' ');

export const SQLITE_UNAVAILABLE_MESSAGE = [
  'ATnR private alpha cannot load node:sqlite on this runtime.',
  `Use Node ${UNFLAGGED_NODE_VERSION}+, or start Node ${MINIMUM_NODE_VERSION}+ with --experimental-sqlite.`,
  'Startup stopped before opening any local store.',
].join(' ');

export function parseVersion(value) {
  const match = /^v?(\d+)\.(\d+)\.(\d+)/.exec(String(value ?? ''));
  if (!match) return null;
  return match.slice(1, 4).map(Number);
}

export function compareVersions(left, right) {
  const a = parseVersion(left);
  const b = parseVersion(right);
  if (a === null || b === null) return null;
  for (let i = 0; i < 3; i += 1) {
    if (a[i] !== b[i]) return a[i] < b[i] ? -1 : 1;
  }
  return 0;
}

export function isSupportedNodeVersion(version) {
  const ordering = compareVersions(version, MINIMUM_NODE_VERSION);
  return ordering !== null && ordering >= 0;
}

/**
 * Full preflight. Never throws: it returns a closed result so the caller can
 * fail closed with a fixed message and a non-zero exit code.
 */
export async function checkSupportedRuntime({
  version = process.versions.node,
  loadSqlite = () => import('node:sqlite'),
} = {}) {
  if (!isSupportedNodeVersion(version)) {
    return { ok: false, code: 'unsupported-node-runtime', message: UNSUPPORTED_RUNTIME_MESSAGE };
  }
  try {
    const sqlite = await loadSqlite();
    if (typeof sqlite?.DatabaseSync !== 'function') {
      return { ok: false, code: 'sqlite-unavailable', message: SQLITE_UNAVAILABLE_MESSAGE };
    }
  } catch {
    return { ok: false, code: 'sqlite-unavailable', message: SQLITE_UNAVAILABLE_MESSAGE };
  }
  return { ok: true, code: null, message: null };
}

/** The engine floor declared to npm, read without importing package.json. */
export function declaredEngineFloor(packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')) {
  const pkg = JSON.parse(readFileSync(path.join(packageRoot, 'package.json'), 'utf8'));
  const declared = pkg?.engines?.node ?? '';
  const match = /^>=\s*(\d+\.\d+\.\d+)$/.exec(String(declared).trim());
  return match ? match[1] : null;
}
