/**
 * Encrypted snapshot persistence with durable-success authority (ATR-S024/S027).
 *
 * Authority rules:
 *  - an attempt is recorded before the connector is started, so a crash during
 *    startup still leaves an honest "last attempted" record;
 *  - `last_success_at` is the **service commit time**, not the connector's
 *    observation time. The source observation is persisted separately;
 *  - a failed validation, seal, disk write or commit leaves the previous
 *    durable snapshot and its success time untouched, including the `null`
 *    success of a first-sync failure;
 *  - this class cannot write private feedback. It owns no statement against
 *    `private_review`; the separate `PrivateFeedbackStore` does.
 */

import { mkdirSync, existsSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import { isContainedIn } from '../security/trusted-paths.js';
import { migrateDatabase, restoreBackup, discardBackup } from './migration.js';
import { isRestorableFailure } from './production-migration.js';
import {
  CURRENT_FINGERPRINT,
  accountAnchorViolation,
  databaseFingerprint,
  fingerprintMatches,
} from './schema.js';
import { PRIVATE_DATA_DIRECTORY } from '../version.js';

export class SnapshotStoreError extends Error {
  constructor(code) {
    super(code);
    this.name = 'SnapshotStoreError';
    this.code = code;
  }
}

export function privateDataRoot() {
  const localAppData = process.env.LOCALAPPDATA;
  if (!localAppData) throw new SnapshotStoreError('local-app-data-unavailable');
  // Pinned to the legacy release directory: a version bump must never relocate
  // the owner's existing encrypted state. See version.js PRIVATE_DATA_DIRECTORY.
  return path.join(localAppData, 'ATnR', PRIVATE_DATA_DIRECTORY, 'private-alpha');
}

const SEALED_MAGIC = Buffer.from('ATNR-DPAPI-1\0');

/** Closed reason recorded when the owner deletes local data. */
export const LOCAL_DATA_SUPPRESSION_REASON = 'local-data-deleted-by-owner';

export class EncryptedSnapshotStore {
  /**
   * `failAfterStatements` is a test-only recovery hook, forwarded verbatim to
   * the migration so the rollback path can be exercised deterministically. It
   * is `null` in every production call.
   */
  constructor({ root = privateDataRoot(), migrationBackupPath = null, failAfterStatements = null } = {}) {
    mkdirSync(root, { recursive: true });
    this.path = path.join(root, 'library.sqlite3');
    this.backupPath = migrationBackupPath ?? `${this.path}.migration-backup`;
    /**
     * Records that the owner deleted their local data, so an automatic sync
     * cannot silently restore it on the next tick or the next restart.
     *
     * It is a file rather than a row because it must survive the deletion of
     * every row, and it lives inside the same protected custody root as the
     * state it refers to. It holds a timestamp and a closed reason only: no
     * account key, title, identifier or count.
     */
    this.suppressionPath = path.join(root, 'local-data-suppressed.json');
    // The rollback envelope must live inside the same protected custody root as
    // the state it protects. A backup written elsewhere would move the owner's
    // encrypted library outside the boundary that the local ACL, the DPAPI user
    // scope and the deletion inventory all apply to. (The production entry
    // point additionally validates the root itself; see
    // `openRealLibraryState`.)
    const resolvedBackup = path.resolve(this.backupPath);
    if (!isContainedIn(resolvedBackup, path.resolve(root))) {
      throw new SnapshotStoreError('custody-rollback-path-outside-boundary');
    }
    if (resolvedBackup === path.resolve(this.path)) {
      throw new SnapshotStoreError('custody-rollback-path-conflict');
    }
    this.database = new DatabaseSync(this.path);
    try {
      // The storage root is a frozen migration input. An unknown or newer schema
      // fails closed here rather than being rewritten or reseeded.
      this.migration = migrateDatabase({
        database: this.database,
        databasePath: this.path,
        backupPath: this.backupPath,
        failAfterStatements,
      });
      if (!fingerprintMatches(databaseFingerprint(this.database), CURRENT_FINGERPRINT)) {
        throw new SnapshotStoreError('storage-schema-unexpected');
      }
      const violation = accountAnchorViolation(this.database);
      if (violation !== null) throw new SnapshotStoreError(violation);
    } catch (error) {
      // Release the file handle so a refused container is left exactly as found.
      try { this.database.close(); } catch { /* handle already gone */ }
      // A failure *after* the envelope was written may have left a partially
      // migrated file. Restore the envelope so the owner keeps the last
      // complete state; a refusal that happened before any write is left alone.
      if (isRestorableFailure(error?.code) && existsSync(this.backupPath)) {
        restoreBackup({ databasePath: this.path, backupPath: this.backupPath });
        error.restoredFromRollback = true;
      }
      throw error;
    }
  }

  status() {
    const snapshot = this.database.prepare(
      `SELECT account_key, marketplace, item_count, observed_at, snapshot_generation,
              source_observed_at, completeness_basis
         FROM encrypted_snapshot WHERE singleton = 1`,
    ).get();
    const sync = this.database.prepare(
      `SELECT last_attempt_at, last_success_at, last_error_code, snapshot_generation,
              last_candidate_observed_at
         FROM sync_state WHERE singleton = 1`,
    ).get();
    const anchor = this.accountAnchor();
    return {
      hasLocalSnapshot: Boolean(snapshot),
      // The anchor is the durable ownership record. It outlives the imported
      // snapshot so locally owned reviews stay reachable, exportable and
      // deletable by the same owner after the import is erased.
      accountKey: snapshot?.account_key ?? anchor?.accountKey ?? null,
      hasAccountAnchor: anchor !== null,
      marketplace: snapshot?.marketplace ?? anchor?.marketplace ?? null,
      itemCount: snapshot?.item_count ?? 0,
      observedAt: snapshot?.observed_at ?? null,
      sourceObservedAt: snapshot?.source_observed_at ?? null,
      completenessBasis: snapshot?.completeness_basis ?? null,
      snapshotGeneration: snapshot?.snapshot_generation ?? 0,
      lastAttemptAt: sync?.last_attempt_at ?? null,
      lastSuccessAt: sync?.last_success_at ?? null,
      lastErrorCode: sync?.last_error_code ?? null,
      lastCandidateObservedAt: sync?.last_candidate_observed_at ?? null,
      // Surfaced in status so the UI can explain why nothing is syncing, and
      // so a restart reaches the same conclusion as the session that deleted.
      localDataSuppressed: this.localDataSuppressed(),
    };
  }

  /** Record an attempt before any connector work begins. Never touches success. */
  recordAttempt(attemptedAt = new Date().toISOString()) {
    this.database.prepare(`
      INSERT INTO sync_state (singleton, last_attempt_at, last_success_at, last_error_code, snapshot_generation)
      VALUES (1, ?, NULL, NULL, 0)
      ON CONFLICT(singleton) DO UPDATE SET last_attempt_at = excluded.last_attempt_at
    `).run(attemptedAt);
    return this.status();
  }

  save({
    accountKey,
    marketplace,
    itemCount,
    observedAt,
    sealedSnapshot,
    completenessBasis = null,
    committedAt = new Date().toISOString(),
  }) {
    const existing = this.status();
    if (existing.accountKey && existing.accountKey !== accountKey) {
      throw new SnapshotStoreError('different-account-local-data-exists');
    }
    if (existing.marketplace && existing.marketplace !== marketplace) {
      throw new SnapshotStoreError('different-marketplace-local-data-exists');
    }
    if (!/^[a-f0-9]{64}$/.test(accountKey)) throw new SnapshotStoreError('account-key-invalid');
    if (marketplace !== 'us') throw new SnapshotStoreError('marketplace-not-allowed');
    if (!Number.isInteger(itemCount) || itemCount < 0 || itemCount > 20_000) {
      throw new SnapshotStoreError('item-count-invalid');
    }
    const payload = Buffer.from(sealedSnapshot, 'base64');
    if (
      payload.length === 0
      || payload.length > 32 * 1024 * 1024
      || payload.toString('base64') !== sealedSnapshot
      || !payload.subarray(0, SEALED_MAGIC.length).equals(SEALED_MAGIC)
    ) {
      throw new SnapshotStoreError('sealed-snapshot-invalid');
    }

    const generation = existing.snapshotGeneration + 1;
    this.database.exec('BEGIN IMMEDIATE');
    try {
      this.database.prepare(`
        INSERT INTO encrypted_snapshot
          (singleton, account_key, marketplace, item_count, observed_at, sealed_payload,
           snapshot_generation, source_observed_at, completeness_basis)
        VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(singleton) DO UPDATE SET
          account_key = excluded.account_key,
          marketplace = excluded.marketplace,
          item_count = excluded.item_count,
          observed_at = excluded.observed_at,
          sealed_payload = excluded.sealed_payload,
          snapshot_generation = excluded.snapshot_generation,
          source_observed_at = excluded.source_observed_at,
          completeness_basis = excluded.completeness_basis
      `).run(
        accountKey, marketplace, itemCount, observedAt, payload,
        generation, observedAt, completenessBasis,
      );
      this.database.prepare(`
        INSERT INTO sync_state
          (singleton, last_attempt_at, last_success_at, last_error_code,
           snapshot_generation, last_candidate_observed_at)
        VALUES (1, ?, ?, NULL, ?, ?)
        ON CONFLICT(singleton) DO UPDATE SET
          last_attempt_at = excluded.last_attempt_at,
          last_success_at = excluded.last_success_at,
          last_error_code = NULL,
          snapshot_generation = excluded.snapshot_generation,
          last_candidate_observed_at = excluded.last_candidate_observed_at
      `).run(committedAt, committedAt, generation, observedAt);
      // The ownership anchor is written in the same transaction as the
      // snapshot. A committed snapshot therefore always has a durable owner,
      // and that owner survives a later deletion of the snapshot itself.
      this.database.prepare(`
        INSERT INTO local_account (singleton, account_key, marketplace, established_at, last_confirmed_at)
        VALUES (1, ?, ?, ?, ?)
        ON CONFLICT(singleton) DO UPDATE SET
          marketplace = excluded.marketplace,
          last_confirmed_at = excluded.last_confirmed_at
      `).run(accountKey, marketplace, committedAt, committedAt);
      this.database.exec('COMMIT');
    } catch (error) {
      this.database.exec('ROLLBACK');
      throw error;
    }
    // A durable snapshot exists again, so the suppression no longer describes
    // reality. Only an owner-authorized path reaches this point: an automatic
    // sync is refused before it can produce a snapshot to save.
    this.clearLocalDataSuppression();
    return generation;
  }

  encryptedSnapshot() {
    const row = this.database.prepare(
      'SELECT sealed_payload FROM encrypted_snapshot WHERE singleton = 1',
    ).get();
    return row ? Buffer.from(row.sealed_payload).toString('base64') : null;
  }

  recordFailure(code, attemptedAt = new Date().toISOString()) {
    const safeCode = typeof code === 'string' && /^[a-z0-9-]{1,64}$/.test(code)
      ? code
      : 'private-alpha-operation-failed';
    this.database.prepare(`
      INSERT INTO sync_state
        (singleton, last_attempt_at, last_success_at, last_error_code, snapshot_generation)
      VALUES (1, ?, NULL, ?, 0)
      ON CONFLICT(singleton) DO UPDATE SET
        last_attempt_at = excluded.last_attempt_at,
        last_error_code = excluded.last_error_code
    `).run(attemptedAt, safeCode);
  }

  /**
   * The durable ownership anchor, or `null` when this installation has never
   * been bound to an account. Only the opaque local account key is stored -
   * never an email, customer id or device serial.
   */
  accountAnchor() {
    const row = this.database.prepare(
      'SELECT account_key, marketplace, established_at, last_confirmed_at FROM local_account WHERE singleton = 1',
    ).get();
    if (!row) return null;
    return Object.freeze({
      accountKey: row.account_key,
      marketplace: row.marketplace,
      establishedAt: row.established_at,
      lastConfirmedAt: row.last_confirmed_at,
    });
  }

  /**
   * Bind this installation to an account, or refresh the confirmation time.
   *
   * Re-anchoring to a *different* account is refused: the existing anchor is
   * what keeps the current owner's reviews reachable, and silently repointing
   * it would hand one account's private records to another.
   */
  recordAccountAnchor({ accountKey, marketplace, at = new Date().toISOString() }) {
    if (!/^[a-f0-9]{64}$/.test(accountKey ?? '')) throw new SnapshotStoreError('account-key-invalid');
    const existing = this.accountAnchor();
    if (existing && existing.accountKey !== accountKey) {
      throw new SnapshotStoreError('different-account-local-data-exists');
    }
    this.database.prepare(`
      INSERT INTO local_account (singleton, account_key, marketplace, established_at, last_confirmed_at)
      VALUES (1, ?, ?, ?, ?)
      ON CONFLICT(singleton) DO UPDATE SET
        marketplace = excluded.marketplace,
        last_confirmed_at = excluded.last_confirmed_at
    `).run(accountKey, marketplace, at, at);
    return this.accountAnchor();
  }

  /** Number of private review rows, tombstones included, for any account. */
  #reviewRowCount() {
    return Number(this.database
      .prepare('SELECT COUNT(*) AS total FROM private_review')
      .get()?.total ?? 0);
  }

  /** True when a rollback envelope from a migration is still on disk. */
  rollbackEnvelopeRetained() {
    return existsSync(this.backupPath);
  }

  /**
   * Whether automatic repopulation is currently suppressed because the owner
   * deleted their local data. Derived from the marker on disk, so a restart
   * reaches the same conclusion as the session that wrote it.
   */
  localDataSuppressed() {
    if (!existsSync(this.suppressionPath)) return false;
    try {
      const parsed = JSON.parse(readFileSync(this.suppressionPath, 'utf8'));
      return parsed?.reason === LOCAL_DATA_SUPPRESSION_REASON;
    } catch {
      // An unreadable marker still means a deletion happened: fail closed
      // towards *not* repopulating rather than towards restoring data.
      return true;
    }
  }

  /** The closed, content-free suppression record, or `null`. */
  localDataSuppression() {
    if (!this.localDataSuppressed()) return null;
    try {
      const parsed = JSON.parse(readFileSync(this.suppressionPath, 'utf8'));
      return Object.freeze({
        reason: LOCAL_DATA_SUPPRESSION_REASON,
        suppressedAt: typeof parsed?.suppressedAt === 'string' ? parsed.suppressedAt : null,
      });
    } catch {
      return Object.freeze({ reason: LOCAL_DATA_SUPPRESSION_REASON, suppressedAt: null });
    }
  }

  recordLocalDataSuppression(at = new Date().toISOString()) {
    writeFileSync(this.suppressionPath, JSON.stringify({
      schemaVersion: 1,
      reason: LOCAL_DATA_SUPPRESSION_REASON,
      suppressedAt: at,
    }), { encoding: 'utf8' });
    return this.localDataSuppression();
  }

  /**
   * Clear the suppression. Only an explicit owner action - a manual sync or a
   * reconnect - may call this; an automatic path must never clear its own
   * refusal.
   */
  clearLocalDataSuppression() {
    if (!existsSync(this.suppressionPath)) return false;
    rmSync(this.suppressionPath, { force: true });
    return !existsSync(this.suppressionPath);
  }

  /**
   * Discharge the rollback envelope at a safe checkpoint.
   *
   * "Safe" means the migrated state has already been opened, verified and
   * used successfully by the runtime. Until then the envelope is the only
   * copy of the pre-migration library, so it is never discarded automatically
   * at the end of the migration itself.
   *
   * The result is honest: if the file cannot be removed it reports that it is
   * still retained rather than claiming a discharge that did not happen.
   */
  dischargeRollbackEnvelope() {
    if (!this.rollbackEnvelopeRetained()) {
      return Object.freeze({ discharged: false, retained: false, reason: 'no-envelope' });
    }
    let removed = false;
    try {
      removed = discardBackup(this.backupPath);
    } catch {
      removed = false;
    }
    return Object.freeze({
      discharged: removed,
      retained: this.rollbackEnvelopeRetained(),
      reason: removed ? null : 'envelope-removal-failed',
    });
  }

  /**
   * Delete the imported snapshot and sync state.
   *
   * Private feedback has a separate, explicit lifecycle and is deliberately
   * untouched. The ownership anchor is retained while any review row depends
   * on it, and removed with the last dependent record, so deleting the import
   * never strands the owner's own reviews.
   *
   * The rollback envelope *is* removed: it holds a complete copy of the
   * pre-migration encrypted library, so leaving it behind after the owner
   * asked for the local copy to be deleted would be residue.
   */
  deleteLocalSnapshot({ at = new Date().toISOString() } = {}) {
    this.database.exec('BEGIN IMMEDIATE');
    try {
      this.database.exec('DELETE FROM encrypted_snapshot; DELETE FROM sync_state;');
      const dependents = this.#reviewRowCount();
      if (dependents === 0) this.database.exec('DELETE FROM local_account');
      this.database.exec('COMMIT');
    } catch (error) {
      this.database.exec('ROLLBACK');
      throw error;
    }
    const envelope = this.dischargeRollbackEnvelope();
    const anchor = this.accountAnchor();
    // Without this, the next scheduler tick would download the library the
    // owner just deleted, which is not a deletion at all.
    this.recordLocalDataSuppression(at);
    return Object.freeze({
      snapshotDeleted: true,
      accountAnchorRetained: anchor !== null,
      retainedReviewRows: this.#reviewRowCount(),
      rollbackEnvelopeRemoved: envelope.discharged,
      rollbackEnvelopeRetained: envelope.retained,
      localDataSuppressed: this.localDataSuppressed(),
    });
  }

  /**
   * Erase every local record this store owns: snapshot, sync state, all
   * private reviews and tombstones, the ownership anchor and the rollback
   * envelope.
   *
   * The result states what is actually gone, and `contentPurgeComplete` is the
   * honest claim: every piece of *content this store owns* is removed. It says
   * nothing about connector-owned credential or identity artifacts, which this
   * class cannot see and must not pretend to have deleted.
   *
   * Nothing here claims cryptographic erasure, and no VACUUM is performed or
   * cited as proof: reclaiming free pages is not evidence that the bytes are
   * unrecoverable.
   */
  purgeAllLocalData({ at = new Date().toISOString() } = {}) {
    this.database.exec('BEGIN IMMEDIATE');
    try {
      this.database.exec(
        'DELETE FROM encrypted_snapshot; DELETE FROM sync_state; DELETE FROM private_review; DELETE FROM local_account;',
      );
      this.database.exec('COMMIT');
    } catch (error) {
      this.database.exec('ROLLBACK');
      throw error;
    }
    const envelope = this.dischargeRollbackEnvelope();
    // Written last, and only after the content is actually gone, so the marker
    // can never claim a deletion that did not complete.
    this.recordLocalDataSuppression(at);
    return Object.freeze({
      snapshotDeleted: true,
      reviewsDeleted: true,
      accountAnchorRemoved: this.accountAnchor() === null,
      retainedReviewRows: this.#reviewRowCount(),
      rollbackEnvelopeRemoved: envelope.discharged,
      rollbackEnvelopeRetained: envelope.retained,
      localDataSuppressed: this.localDataSuppressed(),
      contentPurgeComplete: this.#reviewRowCount() === 0
        && this.accountAnchor() === null
        && this.status().hasLocalSnapshot === false
        && !envelope.retained,
    });
  }

  close() {
    this.database.close();
  }
}
