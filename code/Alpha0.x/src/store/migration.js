/**
 * Versioned, explicit storage migration and recovery (ATR-S030).
 *
 * Rules enforced here:
 *  - a genuinely empty container is *initialized*, which is a different path
 *    from migrating an existing one;
 *  - an unversioned database is migrated only if it matches the exact legacy
 *    fingerprint. Unknown, partially created or newer schemas fail closed and
 *    are never rewritten or "repaired" by deleting/reseeding;
 *  - an encrypted file-level backup is taken before a structural migration and
 *    restored if the migration fails or is interrupted, so the last valid
 *    state survives;
 *  - repeat migration is idempotent; a downgrade is refused safely.
 */

import { copyFileSync, existsSync, renameSync, rmSync } from 'node:fs';

import {
  CREATE_REVISION_3,
  CURRENT_FINGERPRINT,
  DURABILITY_PRAGMAS,
  INTERIM_FINGERPRINT,
  INTERIM_STORAGE_SCHEMA_VERSION,
  LEGACY_FINGERPRINT,
  LEGACY_STORAGE_SCHEMA_VERSION,
  MIGRATION_CHAIN,
  STORAGE_SCHEMA_REVISION,
  STORAGE_SCHEMA_VERSION,
  accountAnchorViolation,
  databaseFingerprint,
  fingerprintMatches,
  readUserVersion,
  writeUserVersion,
} from './schema.js';

export class MigrationError extends Error {
  constructor(code) {
    super(code);
    this.name = 'MigrationError';
    this.code = code;
  }
}

export const MIGRATION_OUTCOMES = Object.freeze([
  'initialized', 'already-current', 'migrated', 'restored',
]);

function isEmptyDatabase(fingerprint) {
  return Object.keys(fingerprint).length === 0;
}

function applyPragmas(database) {
  for (const pragma of DURABILITY_PRAGMAS) database.exec(pragma);
}

function initialize(database) {
  // Structure and marker commit together: an interrupted initialize must not
  // leave tables behind without the marker that identifies them.
  database.exec('BEGIN IMMEDIATE');
  try {
    for (const statement of CREATE_REVISION_3) database.exec(statement);
    writeUserVersion(database, STORAGE_SCHEMA_VERSION);
    database.exec('COMMIT');
  } catch (error) {
    database.exec('ROLLBACK');
    throw error instanceof MigrationError ? error : new MigrationError('migration-failed');
  }
}

/** Structural revisions still to apply, in order, from a known starting point. */
function pendingMigrations(fromVersion) {
  return MIGRATION_CHAIN.filter((step) => step.from >= fromVersion);
}

/**
 * Countable operations in a migration chain: every structural statement, every
 * migration receipt, and the version marker.
 *
 * Exported so an interruption test can target an exact window - in particular
 * the post-structure/pre-marker window at `count - 1` - instead of relying on
 * a magic number that silently stops meaning what it meant.
 */
export function migrationOperationCount(from) {
  return pendingMigrations(from)
    .reduce((total, step) => total + step.statements.length + 1, 0) + 1;
}

/**
 * Bring an open database to the current revision.
 *
 * @param database open `node:sqlite` handle
 * @param databasePath file path, required when a backup is requested
 * @param backupPath optional managed backup location
 * @param now zone-qualified instant used for the migration receipt
 * @param failAfterStatements test hook: abort mid-migration to prove recovery
 */
export function migrateDatabase({
  database,
  databasePath = null,
  backupPath = null,
  now = new Date().toISOString(),
  failAfterStatements = null,
}) {
  applyPragmas(database);
  const version = readUserVersion(database);
  const fingerprint = databaseFingerprint(database);

  if (version > STORAGE_SCHEMA_VERSION) throw new MigrationError('schema-newer-refused');

  if (version === 0) {
    if (isEmptyDatabase(fingerprint)) {
      initialize(database);
      return Object.freeze({
        outcome: 'initialized',
        from: 0,
        to: STORAGE_SCHEMA_VERSION,
        revision: STORAGE_SCHEMA_REVISION,
      });
    }
    if (fingerprintMatches(fingerprint, LEGACY_FINGERPRINT)) {
      return runStructuralMigration({
        database, databasePath, backupPath, now, failAfterStatements,
        from: LEGACY_STORAGE_SCHEMA_VERSION,
      });
    }
    if (fingerprintMatches(fingerprint, INTERIM_FINGERPRINT)) {
      // Unversioned but structurally revision 2: upgrade, do not adopt.
      return runStructuralMigration({
        database, databasePath, backupPath, now, failAfterStatements,
        from: INTERIM_STORAGE_SCHEMA_VERSION,
      });
    }
    if (fingerprintMatches(fingerprint, CURRENT_FINGERPRINT)) {
      // Structure is current but the marker is absent: adopt the marker
      // without rewriting any row.
      writeUserVersion(database, STORAGE_SCHEMA_VERSION);
      return Object.freeze({
        outcome: 'already-current',
        from: STORAGE_SCHEMA_VERSION,
        to: STORAGE_SCHEMA_VERSION,
        revision: STORAGE_SCHEMA_REVISION,
      });
    }
    throw new MigrationError('schema-unknown-refused');
  }

  if (version === LEGACY_STORAGE_SCHEMA_VERSION) {
    if (!fingerprintMatches(fingerprint, LEGACY_FINGERPRINT)) {
      throw new MigrationError('schema-partially-created-refused');
    }
    return runStructuralMigration({
      database, databasePath, backupPath, now, failAfterStatements,
      from: LEGACY_STORAGE_SCHEMA_VERSION,
    });
  }

  if (version === INTERIM_STORAGE_SCHEMA_VERSION) {
    if (!fingerprintMatches(fingerprint, INTERIM_FINGERPRINT)) {
      throw new MigrationError('schema-partially-created-refused');
    }
    return runStructuralMigration({
      database, databasePath, backupPath, now, failAfterStatements,
      from: INTERIM_STORAGE_SCHEMA_VERSION,
    });
  }

  if (version === STORAGE_SCHEMA_VERSION) {
    if (!fingerprintMatches(databaseFingerprint(database), CURRENT_FINGERPRINT)) {
      throw new MigrationError('schema-partially-created-refused');
    }
    return Object.freeze({
      outcome: 'already-current',
      from: version,
      to: version,
      revision: STORAGE_SCHEMA_REVISION,
    });
  }

  throw new MigrationError('schema-unknown-refused');
}

function runStructuralMigration({ database, databasePath, backupPath, now, failAfterStatements, from }) {
  const steps = pendingMigrations(from);
  if (steps.length === 0) throw new MigrationError('schema-unknown-refused');

  let backedUp = false;
  if (backupPath && databasePath) {
    // The backup copies the file as it is on disk: the snapshot body and every
    // review payload inside it stay sealed. No plaintext copy is created.
    copyFileSync(databasePath, backupPath);
    backedUp = true;
  }

  // Every pending revision, its receipt, the version marker and the
  // verification all happen inside one transaction. A container is therefore
  // never left at an intermediate revision, and never left with migrated
  // structure but the previous marker: either the whole chain commits, or the
  // container is exactly as it was and the envelope stands.
  database.exec('BEGIN IMMEDIATE');
  try {
    let applied = 0;
    const tick = () => {
      if (failAfterStatements !== null && applied >= failAfterStatements) {
        throw new MigrationError('migration-interrupted');
      }
      applied += 1;
    };
    for (const step of steps) {
      for (const statement of step.statements) {
        tick();
        database.exec(statement);
      }
      tick();
      database.prepare(
        'INSERT OR REPLACE INTO schema_migration (migration_id, applied_at, checksum) VALUES (?, ?, ?)',
      ).run(step.id, now, step.checksum);
    }
    // The marker is part of the same transaction as the structure it
    // describes. Committing structure first would leave a window in which the
    // container is revision 3 but still claims to be revision 1 or 2.
    tick();
    writeUserVersion(database, STORAGE_SCHEMA_VERSION);
    if (!fingerprintMatches(databaseFingerprint(database), CURRENT_FINGERPRINT)) {
      throw new MigrationError('migration-verification-failed');
    }
    if (accountAnchorViolation(database) !== null) {
      throw new MigrationError('migration-verification-failed');
    }
    database.exec('COMMIT');
  } catch (error) {
    database.exec('ROLLBACK');
    throw error instanceof MigrationError ? error : new MigrationError('migration-failed');
  }

  // The rollback envelope is deliberately retained here. It is discharged only
  // at an explicit post-startup checkpoint, once the migrated state has been
  // opened and used successfully, or through the deletion inventory.
  return Object.freeze({
    outcome: 'migrated',
    from: steps[0].from,
    to: STORAGE_SCHEMA_VERSION,
    revision: STORAGE_SCHEMA_REVISION,
    migrationId: steps[steps.length - 1].id,
    migrationIds: Object.freeze(steps.map((step) => step.id)),
    backupPath: backedUp ? backupPath : null,
  });
}

/**
 * Restore a managed backup over a failed or interrupted migration. The caller
 * must have closed the database handle first; a missing backup is a refusal,
 * never a silent fresh start.
 */
export function restoreBackup({ databasePath, backupPath }) {
  if (!backupPath || !existsSync(backupPath)) throw new MigrationError('backup-unavailable');
  const staging = `${databasePath}.restore-staging`;
  copyFileSync(backupPath, staging);
  renameSync(staging, databasePath);
  return Object.freeze({ outcome: 'restored', databasePath, backupPath });
}

/** Discharge a managed backup once the caller has confirmed it is no longer needed. */
export function discardBackup(backupPath) {
  if (!backupPath || !existsSync(backupPath)) return false;
  rmSync(backupPath, { force: true });
  return !existsSync(backupPath);
}
