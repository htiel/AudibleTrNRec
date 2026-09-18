/**
 * Production migration path for the real encrypted local library state
 * (Alpha 0.0.2 runtime requirement).
 *
 * The user-facing runtime runs on the owner's existing encrypted Alpha 0.0.1
 * state. That state is irreplaceable: it cannot be regenerated from a fixture,
 * and re-deriving it would require another full authorized source read. Every
 * decision here is therefore made in this order:
 *
 *   1. *look* at the container without writing to it (read-only probe);
 *   2. *decide* what would happen, as a pure function of shape (plan);
 *   3. only then open for write, with a rollback envelope already in place.
 *
 * Refusals happen in step 1 or 2, before a single byte is written, so an
 * unrecognised or newer container is left exactly as it was found.
 *
 * Two prohibitions are structural rather than advisory:
 *  - **no synthetic substitution.** There is no code path here that produces a
 *    library when the real state is absent or unreadable. The functions either
 *    return the real container or throw. A believable demo library presented as
 *    someone's listening history is worse than a blunt refusal.
 *  - **no personal detail in evidence.** Everything returned by `planMigration`
 *    and `migrationEvidence` is a closed enum, a small integer revision or a
 *    boolean. No title, ASIN, item count, account key, timestamp or path is
 *    carried, so the result is safe to print, log and hand to a reviewer.
 */

import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import { assertCustodyContained, assertCustodyRoot } from '../security/runtime-data-source.js';
import {
  CURRENT_FINGERPRINT,
  INTERIM_FINGERPRINT,
  INTERIM_STORAGE_SCHEMA_VERSION,
  LEGACY_FINGERPRINT,
  LEGACY_STORAGE_SCHEMA_VERSION,
  STORAGE_SCHEMA_REVISION,
  STORAGE_SCHEMA_VERSION,
  databaseFingerprint,
  fingerprintMatches,
  readUserVersion,
} from './schema.js';

export class ProductionMigrationError extends Error {
  constructor(code) {
    super(code);
    this.name = 'ProductionMigrationError';
    this.code = code;
  }
}

/** Closed vocabulary for what a container *is*. */
export const CONTAINER_SHAPES = Object.freeze([
  'absent', 'empty', 'legacy', 'interim', 'current', 'current-unmarked', 'unknown', 'newer', 'unreadable',
]);

/** Closed vocabulary for what the runtime *would do* about it. */
export const MIGRATION_ACTIONS = Object.freeze([
  'initialize', 'migrate', 'adopt-marker', 'none', 'refuse',
]);

/**
 * Shapes that count as real, usable existing state.
 *
 * `empty` is excluded on purpose: a container that exists but holds no schema
 * is not the owner's library. Initializing it in production would present an
 * empty shelf that is indistinguishable from one whose contents were lost.
 */
export const RECOGNIZED_EXISTING_SHAPES = Object.freeze(new Set([
  'legacy', 'interim', 'current', 'current-unmarked',
]));

/** Failures that occur after the rollback envelope exists and must restore it. */const RESTORABLE_CODES = Object.freeze(new Set([
  'migration-interrupted',
  'migration-failed',
  'migration-verification-failed',
  'storage-schema-unexpected',
]));

/**
 * Classify an open container by structure alone.
 *
 * Only the schema shape is inspected; no row is read, so classification cannot
 * observe library content.
 */
export function classifyContainer({ userVersion, fingerprint }) {
  if (!Number.isInteger(userVersion) || userVersion < 0) return 'unknown';
  if (userVersion > STORAGE_SCHEMA_VERSION) return 'newer';
  if (userVersion === STORAGE_SCHEMA_VERSION) {
    return fingerprintMatches(fingerprint, CURRENT_FINGERPRINT) ? 'current' : 'unknown';
  }
  if (userVersion === LEGACY_STORAGE_SCHEMA_VERSION) {
    return fingerprintMatches(fingerprint, LEGACY_FINGERPRINT) ? 'legacy' : 'unknown';
  }
  if (userVersion === INTERIM_STORAGE_SCHEMA_VERSION) {
    return fingerprintMatches(fingerprint, INTERIM_FINGERPRINT) ? 'interim' : 'unknown';
  }
  // Unversioned: the marker predates the registry, so structure decides.
  if (Object.keys(fingerprint ?? {}).length === 0) return 'empty';
  if (fingerprintMatches(fingerprint, LEGACY_FINGERPRINT)) return 'legacy';
  if (fingerprintMatches(fingerprint, INTERIM_FINGERPRINT)) return 'interim';
  if (fingerprintMatches(fingerprint, CURRENT_FINGERPRINT)) return 'current-unmarked';
  return 'unknown';
}

/**
 * Decide the migration outcome for a shape without touching the container.
 *
 * Pure and total: every shape maps to exactly one action, so there is no
 * default branch that could quietly "repair" an unrecognised database by
 * recreating it.
 */
export function planMigration({ userVersion, fingerprint, exists = true } = {}) {
  const shape = exists === false ? 'absent' : classifyContainer({ userVersion, fingerprint });
  const plan = {
    shape,
    action: 'refuse',
    from: null,
    to: STORAGE_SCHEMA_VERSION,
    revision: STORAGE_SCHEMA_REVISION,
    rollbackEnvelopeRequired: false,
    preservesExistingState: true,
    reasonCode: null,
  };
  switch (shape) {
    case 'absent':
    case 'empty':
      // First run of a container: nothing exists to preserve, and nothing is
      // invented either. An empty real container is still a real container.
      return Object.freeze({ ...plan, action: 'initialize', from: 0 });
    case 'legacy':
      return Object.freeze({
        ...plan,
        action: 'migrate',
        from: LEGACY_STORAGE_SCHEMA_VERSION,
        rollbackEnvelopeRequired: true,
      });
    case 'interim':
      return Object.freeze({
        ...plan,
        action: 'migrate',
        from: INTERIM_STORAGE_SCHEMA_VERSION,
        rollbackEnvelopeRequired: true,
      });
    case 'current-unmarked':
      return Object.freeze({ ...plan, action: 'adopt-marker', from: STORAGE_SCHEMA_VERSION });
    case 'current':
      return Object.freeze({ ...plan, action: 'none', from: STORAGE_SCHEMA_VERSION });
    case 'newer':
      return Object.freeze({ ...plan, reasonCode: 'schema-newer-refused' });
    case 'unreadable':
      return Object.freeze({ ...plan, reasonCode: 'storage-container-unreadable' });
    default:
      return Object.freeze({ ...plan, reasonCode: 'schema-unknown-refused' });
  }
}

/**
 * Read-only inspection of the real container.
 *
 * The handle is opened read-only, so this can be run against the owner's live
 * state as verification evidence without any possibility of mutating it: no
 * migration, no marker write, no journal rewrite of user data.
 */
export function probeStorageContainer({ databasePath }) {
  if (typeof databasePath !== 'string' || !path.isAbsolute(databasePath)) {
    throw new ProductionMigrationError('storage-path-invalid');
  }
  if (!existsSync(databasePath)) {
    return Object.freeze({
      exists: false,
      readable: false,
      userVersion: null,
      shape: 'absent',
      plan: planMigration({ exists: false }),
    });
  }
  let database = null;
  try {
    database = new DatabaseSync(databasePath, { readOnly: true });
    const userVersion = readUserVersion(database);
    const fingerprint = databaseFingerprint(database);
    const shape = classifyContainer({ userVersion, fingerprint });
    return Object.freeze({
      exists: true,
      readable: true,
      userVersion,
      shape,
      plan: planMigration({ userVersion, fingerprint }),
    });
  } catch {
    // An unreadable container is reported, never replaced.
    return Object.freeze({
      exists: true,
      readable: false,
      userVersion: null,
      shape: 'unreadable',
      plan: planMigration({ userVersion: -1, fingerprint: {}, exists: true }),
    });
  } finally {
    try { database?.close(); } catch { /* already closed */ }
  }
}

/**
 * Redact a migration result into publishable evidence.
 *
 * Booleans and closed enums only. The rollback envelope is reported as a
 * boolean rather than a path so that evidence never discloses where the
 * owner's encrypted state lives.
 */
export function migrationEvidence(result) {
  return Object.freeze({
    outcome: typeof result?.outcome === 'string' ? result.outcome : 'unknown',
    from: Number.isInteger(result?.from) ? result.from : null,
    to: Number.isInteger(result?.to) ? result.to : STORAGE_SCHEMA_VERSION,
    revision: STORAGE_SCHEMA_REVISION,
    migrationId: typeof result?.migrationId === 'string' ? result.migrationId : null,
    rollbackEnvelopeRetained: typeof result?.backupPath === 'string' && result.backupPath.length > 0,
    restoredFromRollback: result?.restoredFromRollback === true,
  });
}

/** True when a failure happened after the rollback envelope was written. */
export function isRestorableFailure(code) {
  return RESTORABLE_CODES.has(code);
}

/**
 * Open the real encrypted local library state for the user-facing runtime.
 *
 * `openStore` is injected so this stays testable without a real container; the
 * production caller passes the `EncryptedSnapshotStore` constructor. There is
 * deliberately no fixture, seed or demo branch: if the real state cannot be
 * opened, this throws and the runtime stops.
 *
 * `verifyCustody` defaults to the security module's boundary assertion, which
 * rejects links, traversal and user-writable staging roots. It is injectable
 * only so that tests can run against a temporary root; the production caller
 * passes nothing and therefore gets the strict check.
 */
export function openRealLibraryState({
  root,
  openStore,
  requireExistingState = false,
  probe = probeStorageContainer,
  verifyCustody = assertProductionCustody,
} = {}) {
  if (typeof openStore !== 'function') throw new ProductionMigrationError('store-factory-required');
  if (typeof root !== 'string' || root.length === 0) {
    throw new ProductionMigrationError('custody-root-required');
  }
  const databasePath = path.join(root, 'library.sqlite3');
  const backupPath = `${databasePath}.migration-backup`;
  const rootExists = existsSync(root);
  // Verify the boundary before reading anything inside it. A root that does
  // not exist yet is verified after it is created, below.
  if (rootExists) verifyCustody({ root, databasePath, backupPath });

  const probed = probe({ databasePath });

  if (requireExistingState && !RECOGNIZED_EXISTING_SHAPES.has(probed.shape)) {
    // Strict mode: the caller asserted that real state must already be present
    // *and* recognizable. This refusal happens before any directory or file is
    // created, so a missing or unusable library can never be "resolved" by
    // quietly making a new one. Reporting "connected, empty" here would be
    // indistinguishable from a library that had been silently discarded.
    if (!probed.exists) throw new ProductionMigrationError('real-local-state-missing');
    if (probed.shape === 'empty') throw new ProductionMigrationError('real-local-state-empty');
    throw new ProductionMigrationError(probed.plan.reasonCode ?? 'real-local-state-unrecognized');
  }
  if (probed.plan.action === 'refuse') {
    throw new ProductionMigrationError(probed.plan.reasonCode ?? 'storage-container-refused');
  }

  if (!rootExists) {
    // Creating the custody directory is non-destructive and keeps a genuine
    // first run working; it never creates or seeds a library.
    mkdirSync(root, { recursive: true });
    verifyCustody({ root, databasePath, backupPath });
  }

  const store = openStore({ root });
  return Object.freeze({
    store,
    hasExistingState: probed.exists,
    containerShapeBefore: probed.shape,
    evidence: migrationEvidence(store.migration),
  });
}

/**
 * Strict production custody assertion: the state and its rollback envelope must
 * both sit inside the protected root, which must itself be a real directory
 * outside every user-writable staging area.
 */
export function assertProductionCustody({ root, databasePath, backupPath }) {
  try {
    const resolved = assertCustodyRoot(root);
    assertCustodyContained(databasePath, resolved);
    assertCustodyContained(backupPath, resolved);
    return resolved;
  } catch (error) {
    throw new ProductionMigrationError(
      typeof error?.code === 'string' ? error.code : 'custody-boundary-refused',
    );
  }
}
