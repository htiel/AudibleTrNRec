/**
 * Runtime data-source contract (Alpha 0.0.2 runtime requirement).
 *
 * The user-facing private runtime must run on the real, encrypted local
 * library state held under the protected custody root. Synthetic fixtures are
 * permitted **only** inside automated and adversarial tests, so that personal
 * data is never committed and demo data is never presented as a library.
 *
 * The danger this module closes is a *silent* fallback: a runtime that cannot
 * reach its encrypted state, or a bootstrap that fails authentication, must
 * stop and say so. It must never quietly seed a populated synthetic library
 * and describe it as connected. A believable lie about someone's library is
 * worse than a blunt refusal.
 *
 * Nothing here reads, decrypts, counts, or describes library content. It
 * validates custody *shape* only: identity of the declared source, and
 * containment of the paths that hold it.
 */

import { lstatSync, statSync } from 'node:fs';
import path from 'node:path';

import { hasUnsafeRootSegment, isContainedIn } from './trusted-paths.js';

export class RuntimeDataSourceError extends Error {
  constructor(code) {
    super(code);
    this.name = 'RuntimeDataSourceError';
    this.code = code;
  }
}

/** Closed vocabulary. A runtime that declares anything else does not run. */
export const RUNTIME_DATA_SOURCES = Object.freeze(['local-encrypted', 'synthetic-fixture']);

/** The only data source the user-facing private runtime may present. */
export const REQUIRED_RUNTIME_DATA_SOURCE = 'local-encrypted';

/** Contract identifier exchanged with the browser client at bootstrap. */
export const RUNTIME_CONTRACT_VERSION = 'atnr-runtime-source-1';

/**
 * Served paths that must not exist in a private-alpha page. Synthetic fixture
 * modules are test material; the private runtime refuses to serve them so a
 * demo library cannot be loaded into a real session even by accident.
 */
export const SYNTHETIC_MODULE_PREFIXES = Object.freeze(['src/fixtures/']);

function toPosix(value) {
  return value.split(path.sep).join('/');
}

/** True when a served request path targets synthetic fixture material. */
export function isSyntheticModulePath(requestPath) {
  if (typeof requestPath !== 'string') return false;
  const normalized = toPosix(path.normalize(requestPath)).replace(/^\/+/, '').toLowerCase();
  return SYNTHETIC_MODULE_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

/**
 * Custody containment for a state or rollback artifact.
 *
 * A migration backup, rollback envelope or restored copy must live inside the
 * same protected custody root as the state it protects. A path that escapes
 * the root, traverses a link, or lands in a synchronized/temporary staging
 * area would silently move personal data outside the boundary that the ACL,
 * DPAPI sealing and deletion semantics apply to.
 */
export function assertCustodyContained(candidate, custodyRoot, { mustExist = false } = {}) {
  if (typeof candidate !== 'string' || candidate.length === 0) {
    throw new RuntimeDataSourceError('custody-path-required');
  }
  if (!path.isAbsolute(candidate)) throw new RuntimeDataSourceError('custody-path-not-absolute');
  if (hasUnsafeRootSegment(candidate)) throw new RuntimeDataSourceError('custody-path-unsafe-root');
  const resolved = path.resolve(candidate);
  if (!isContainedIn(resolved, custodyRoot)) {
    throw new RuntimeDataSourceError('custody-path-outside-boundary');
  }
  let exists = false;
  try {
    // `lstat`, not `stat`: a link that *points* inside the root still lets the
    // real bytes live somewhere else.
    const stats = lstatSync(resolved);
    if (stats.isSymbolicLink()) throw new RuntimeDataSourceError('custody-path-link-refused');
    exists = true;
  } catch (error) {
    if (error instanceof RuntimeDataSourceError) throw error;
    if (mustExist) throw new RuntimeDataSourceError('custody-path-missing');
  }
  return Object.freeze({ path: resolved, exists });
}

/**
 * Validate the custody root itself: absolute, real directory, not a link, and
 * not inside a cloud-synchronized or temporary staging area.
 */
export function assertCustodyRoot(custodyRoot) {
  if (typeof custodyRoot !== 'string' || !path.isAbsolute(custodyRoot)) {
    throw new RuntimeDataSourceError('custody-root-invalid');
  }
  if (hasUnsafeRootSegment(custodyRoot)) throw new RuntimeDataSourceError('custody-root-unsafe');
  const resolved = path.resolve(custodyRoot);
  let link;
  try {
    link = lstatSync(resolved);
  } catch {
    throw new RuntimeDataSourceError('custody-root-missing');
  }
  if (link.isSymbolicLink()) throw new RuntimeDataSourceError('custody-root-link-refused');
  if (!statSync(resolved).isDirectory()) throw new RuntimeDataSourceError('custody-root-not-a-directory');
  return resolved;
}

/**
 * Custody proof interlock (final review must-fix).
 *
 * The OS-level custody proof — the ACL re-read performed inside the trusted
 * connector — must complete *before* anything writes a rollback envelope or
 * runs a migration. Path-shape validation is not a substitute: a directory can
 * be perfectly contained inside the boundary and still be readable by every
 * account on the machine. Writing the owner's library into such a directory
 * and verifying afterwards protects nothing; the bytes are already exposed.
 *
 * This gate makes the ordering explicit and testable rather than implicit in
 * the order of statements in a startup script. `guard()` wraps the custody
 * check that the migration already calls, so the migration cannot perform its
 * first write unless the proof was recorded first.
 */
export class CustodyProofGate {
  #proven = false;

  get proven() {
    return this.#proven;
  }

  /** Record a verified connector custody proof. Only the exact shape counts. */
  record(proof) {
    if (proof?.custodyVerified !== true || proof?.aclVerified !== true) {
      throw new RuntimeDataSourceError('custody-proof-invalid');
    }
    this.#proven = true;
    return this;
  }

  /** Throw unless the OS proof has already been recorded. */
  assertProven() {
    if (!this.#proven) throw new RuntimeDataSourceError('custody-proof-missing');
  }

  /**
   * Wrap the migration's own custody check so it refuses to run — and
   * therefore refuses to let any write proceed — before the proof exists.
   */
  guard(verifyCustody) {
    return (options) => {
      this.assertProven();
      return verifyCustody(options);
    };
  }
}

/**
 * Full startup assertion for the user-facing private runtime.
 *
 * Returns a frozen descriptor containing booleans and a closed source name
 * only. It deliberately carries no item count, title, identifier, timestamp or
 * path, because this value is safe to record as evidence and to hand to the
 * browser; the moment it carried a count it would describe the library.
 */
export function assertRealDataRuntime({
  dataSource = REQUIRED_RUNTIME_DATA_SOURCE,
  custodyRoot,
  storePath,
  backupPath = null,
} = {}) {
  if (!RUNTIME_DATA_SOURCES.includes(dataSource)) {
    throw new RuntimeDataSourceError('runtime-data-source-unknown');
  }
  if (dataSource !== REQUIRED_RUNTIME_DATA_SOURCE) {
    // A synthetic runtime must never reach a user-facing private session.
    throw new RuntimeDataSourceError('runtime-data-source-refused');
  }
  const root = assertCustodyRoot(custodyRoot);
  const store = assertCustodyContained(storePath, root);
  const backup = backupPath === null ? null : assertCustodyContained(backupPath, root);
  if (backup !== null && backup.path === store.path) {
    // A rollback envelope that is the live file protects nothing.
    throw new RuntimeDataSourceError('custody-rollback-path-conflict');
  }
  return Object.freeze({
    dataSource: REQUIRED_RUNTIME_DATA_SOURCE,
    contractVersion: RUNTIME_CONTRACT_VERSION,
    synthetic: false,
    custodyVerified: true,
    hasExistingState: store.exists,
    rollbackEnvelopeContained: backup === null ? null : true,
  });
}

/**
 * The bootstrap descriptor handed to the browser. Fixed values only: the
 * client uses it to refuse a synthetic or unrecognised runtime, and it can
 * never become a channel for library detail.
 */
export function describeRuntimeDataSource(descriptor) {
  return Object.freeze({
    dataSource: descriptor?.dataSource === REQUIRED_RUNTIME_DATA_SOURCE
      ? REQUIRED_RUNTIME_DATA_SOURCE
      : 'unverified',
    contractVersion: RUNTIME_CONTRACT_VERSION,
    synthetic: false,
  });
}
