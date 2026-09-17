import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

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
  return path.join(localAppData, 'ATnR', 'Alpha0.0.1', 'private-alpha');
}

export class EncryptedSnapshotStore {
  constructor({ root = privateDataRoot() } = {}) {
    mkdirSync(root, { recursive: true });
    this.path = path.join(root, 'library.sqlite3');
    this.database = new DatabaseSync(this.path);
    this.database.exec(`
      PRAGMA journal_mode = DELETE;
      PRAGMA secure_delete = ON;
      CREATE TABLE IF NOT EXISTS encrypted_snapshot (
        singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
        account_key TEXT NOT NULL,
        marketplace TEXT NOT NULL,
        item_count INTEGER NOT NULL CHECK (item_count >= 0),
        observed_at TEXT NOT NULL,
        sealed_payload BLOB NOT NULL
      ) STRICT;
      CREATE TABLE IF NOT EXISTS sync_state (
        singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
        last_attempt_at TEXT,
        last_success_at TEXT,
        last_error_code TEXT
      ) STRICT;
    `);
  }

  status() {
    const snapshot = this.database.prepare(
      'SELECT account_key, marketplace, item_count, observed_at FROM encrypted_snapshot WHERE singleton = 1',
    ).get();
    const sync = this.database.prepare(
      'SELECT last_attempt_at, last_success_at, last_error_code FROM sync_state WHERE singleton = 1',
    ).get();
    return {
      hasLocalSnapshot: Boolean(snapshot),
      accountKey: snapshot?.account_key ?? null,
      marketplace: snapshot?.marketplace ?? null,
      itemCount: snapshot?.item_count ?? 0,
      observedAt: snapshot?.observed_at ?? null,
      lastAttemptAt: sync?.last_attempt_at ?? null,
      lastSuccessAt: sync?.last_success_at ?? null,
      lastErrorCode: sync?.last_error_code ?? null,
    };
  }

  save({ accountKey, marketplace, itemCount, observedAt, sealedSnapshot }) {
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
      || !payload.subarray(0, 13).equals(Buffer.from('ATNR-DPAPI-1\0'))
    ) {
      throw new SnapshotStoreError('sealed-snapshot-invalid');
    }

    this.database.exec('BEGIN IMMEDIATE');
    try {
      this.database.prepare(`
        INSERT INTO encrypted_snapshot
          (singleton, account_key, marketplace, item_count, observed_at, sealed_payload)
        VALUES (1, ?, ?, ?, ?, ?)
        ON CONFLICT(singleton) DO UPDATE SET
          account_key = excluded.account_key,
          marketplace = excluded.marketplace,
          item_count = excluded.item_count,
          observed_at = excluded.observed_at,
          sealed_payload = excluded.sealed_payload
      `).run(accountKey, marketplace, itemCount, observedAt, payload);
      this.database.prepare(`
        INSERT INTO sync_state (singleton, last_attempt_at, last_success_at, last_error_code)
        VALUES (1, ?, ?, NULL)
        ON CONFLICT(singleton) DO UPDATE SET
          last_attempt_at = excluded.last_attempt_at,
          last_success_at = excluded.last_success_at,
          last_error_code = NULL
      `).run(observedAt, observedAt);
      this.database.exec('COMMIT');
    } catch (error) {
      this.database.exec('ROLLBACK');
      throw error;
    }
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
      INSERT INTO sync_state (singleton, last_attempt_at, last_success_at, last_error_code)
      VALUES (1, ?, NULL, ?)
      ON CONFLICT(singleton) DO UPDATE SET
        last_attempt_at = excluded.last_attempt_at,
        last_error_code = excluded.last_error_code
    `).run(attemptedAt, safeCode);
  }

  deleteLocalSnapshot() {
    this.database.exec('BEGIN IMMEDIATE');
    try {
      this.database.exec('DELETE FROM encrypted_snapshot; DELETE FROM sync_state;');
      this.database.exec('COMMIT');
    } catch (error) {
      this.database.exec('ROLLBACK');
      throw error;
    }
  }

  close() {
    this.database.close();
  }
}
