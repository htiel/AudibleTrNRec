import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, existsSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import {
  MigrationError,
  discardBackup,
  migrateDatabase,
  migrationOperationCount,
  restoreBackup,
} from '../src/store/migration.js';
import {
  CREATE_REVISION_2,
  CURRENT_FINGERPRINT,
  INTERIM_FINGERPRINT,
  INTERIM_STORAGE_SCHEMA_VERSION,
  LEGACY_FINGERPRINT,
  LEGACY_STORAGE_SCHEMA_VERSION,
  MIGRATION_1_TO_2,
  MIGRATION_2_TO_3,
  STORAGE_SCHEMA_VERSION,
  accountAnchorViolation,
  databaseFingerprint,
  fingerprintMatches,
  readUserVersion,
  writeUserVersion,
} from '../src/store/schema.js';

/** Byte-for-byte revision 1 DDL, as shipped in the previous alpha. */
const LEGACY_DDL = `
  CREATE TABLE encrypted_snapshot (
    singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
    account_key TEXT NOT NULL,
    marketplace TEXT NOT NULL,
    item_count INTEGER NOT NULL CHECK (item_count >= 0),
    observed_at TEXT NOT NULL,
    sealed_payload BLOB NOT NULL
  ) STRICT;
  CREATE TABLE sync_state (
    singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
    last_attempt_at TEXT,
    last_success_at TEXT,
    last_error_code TEXT
  ) STRICT;
`;

function workspace(t) {
  const root = mkdtempSync(path.join(tmpdir(), 'atnr-migration-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return root;
}

function legacyDatabase(file) {
  const database = new DatabaseSync(file);
  database.exec(LEGACY_DDL);
  database.prepare(
    'INSERT INTO encrypted_snapshot (singleton, account_key, marketplace, item_count, observed_at, sealed_payload) VALUES (1, ?, ?, ?, ?, ?)',
  ).run('a'.repeat(64), 'us', 3, '2026-09-17T12:00:00.000Z', Buffer.from('ATNR-DPAPI-1\0legacy'));
  database.prepare(
    'INSERT INTO sync_state (singleton, last_attempt_at, last_success_at, last_error_code) VALUES (1, ?, ?, NULL)',
  ).run('2026-09-17T12:00:00.000Z', '2026-09-17T12:00:01.000Z');
  return database;
}

test('an empty container is initialized, which is not the same path as a migration', (t) => {
  const file = path.join(workspace(t), 'library.sqlite3');
  const database = new DatabaseSync(file);
  const result = migrateDatabase({ database, databasePath: file });
  assert.equal(result.outcome, 'initialized');
  assert.equal(readUserVersion(database), STORAGE_SCHEMA_VERSION);
  assert.ok(fingerprintMatches(databaseFingerprint(database), CURRENT_FINGERPRINT));
  database.close();
});

test('a legacy database migrates in place, keeping every stored row and its success time', (t) => {
  const root = workspace(t);
  const file = path.join(root, 'library.sqlite3');
  const backup = path.join(root, 'library.backup');
  const database = legacyDatabase(file);

  const result = migrateDatabase({ database, databasePath: file, backupPath: backup });
  assert.equal(result.outcome, 'migrated');
  assert.equal(result.from, 1);
  assert.equal(result.to, STORAGE_SCHEMA_VERSION);
  assert.ok(existsSync(backup), 'the pre-migration state is preserved');

  const row = database.prepare('SELECT * FROM encrypted_snapshot WHERE singleton = 1').get();
  assert.equal(row.item_count, 3);
  assert.equal(row.observed_at, '2026-09-17T12:00:00.000Z');
  assert.equal(Buffer.from(row.sealed_payload).toString('utf8'), 'ATNR-DPAPI-1\0legacy');
  assert.equal(row.source_observed_at, null, 'an unknown value stays unknown, it is not back-filled');
  const sync = database.prepare('SELECT * FROM sync_state WHERE singleton = 1').get();
  assert.equal(sync.last_success_at, '2026-09-17T12:00:01.000Z');
  assert.equal(
    database.prepare("SELECT COUNT(*) AS n FROM schema_migration WHERE migration_id = 'atr-storage-0001-private-feedback'").get().n,
    1,
  );
  database.close();
});

test('repeat migration is idempotent and a second open is a no-op', (t) => {
  const root = workspace(t);
  const file = path.join(root, 'library.sqlite3');
  const database = legacyDatabase(file);
  migrateDatabase({ database, databasePath: file });
  const second = migrateDatabase({ database, databasePath: file });
  assert.equal(second.outcome, 'already-current');
  assert.ok(fingerprintMatches(databaseFingerprint(database), CURRENT_FINGERPRINT));
  database.close();
});

test('an interrupted migration rolls back and the backup restores the last valid state', (t) => {
  const root = workspace(t);
  const file = path.join(root, 'library.sqlite3');
  const backup = path.join(root, 'library.backup');
  const database = legacyDatabase(file);
  const sizeBefore = statSync(file).size;

  assert.throws(
    () => migrateDatabase({ database, databasePath: file, backupPath: backup, failAfterStatements: 2 }),
    (error) => error instanceof MigrationError && error.code === 'migration-interrupted',
  );
  // The transaction rolled back: no half-applied structure is visible.
  assert.equal(fingerprintMatches(databaseFingerprint(database), CURRENT_FINGERPRINT), false);
  assert.equal(database.prepare('SELECT item_count FROM encrypted_snapshot WHERE singleton = 1').get().item_count, 3);
  database.close();

  const restored = restoreBackup({ databasePath: file, backupPath: backup });
  assert.equal(restored.outcome, 'restored');
  const reopened = new DatabaseSync(file);
  assert.equal(reopened.prepare('SELECT item_count FROM encrypted_snapshot WHERE singleton = 1').get().item_count, 3);
  assert.ok(statSync(file).size >= sizeBefore - 4096);
  // After recovery the legacy database can still be migrated forward.
  assert.equal(migrateDatabase({ database: reopened, databasePath: file }).outcome, 'migrated');
  reopened.close();

  assert.equal(discardBackup(backup), true);
  assert.equal(existsSync(backup), false);
});

test('an unknown or partially created schema fails closed instead of being reseeded', (t) => {
  const file = path.join(workspace(t), 'foreign.sqlite3');
  const database = new DatabaseSync(file);
  database.exec('CREATE TABLE something_else (id INTEGER PRIMARY KEY) STRICT;');
  assert.throws(
    () => migrateDatabase({ database, databasePath: file }),
    (error) => error.code === 'schema-unknown-refused',
  );
  assert.equal(
    database.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE name = 'something_else'").get().n,
    1,
    'the foreign container is left untouched',
  );
  database.close();
});

test('a newer schema is refused rather than downgraded', (t) => {
  const file = path.join(workspace(t), 'future.sqlite3');
  const database = new DatabaseSync(file);
  database.exec(`PRAGMA user_version = ${STORAGE_SCHEMA_VERSION + 1}`);
  assert.throws(
    () => migrateDatabase({ database, databasePath: file }),
    (error) => error.code === 'schema-newer-refused',
  );
  database.close();
});

test('a missing backup is a refusal, never a silent fresh start', (t) => {
  const root = workspace(t);
  assert.throws(
    () => restoreBackup({ databasePath: path.join(root, 'library.sqlite3'), backupPath: path.join(root, 'absent') }),
    (error) => error.code === 'backup-unavailable',
  );
});

/** A revision-2 container: everything current except the ownership anchor. */
function interimDatabase(file, { withRow = true, marked = true } = {}) {
  const database = new DatabaseSync(file);
  for (const statement of CREATE_REVISION_2) database.exec(statement);
  if (withRow) {
    database.prepare(
      'INSERT INTO encrypted_snapshot (singleton, account_key, marketplace, item_count, observed_at, sealed_payload) VALUES (1, ?, ?, ?, ?, ?)',
    ).run('a'.repeat(64), 'us', 2, '2026-09-17T12:00:00.000Z', Buffer.from('ATNR-DPAPI-1\0interim'));
  }
  if (marked) writeUserVersion(database, INTERIM_STORAGE_SCHEMA_VERSION);
  return database;
}

test('a revision-2 container gains the ownership anchor, back-filled from the stored account', (t) => {
  const root = workspace(t);
  const file = path.join(root, 'library.sqlite3');
  const backup = path.join(root, 'library.backup');
  const database = interimDatabase(file);

  const result = migrateDatabase({ database, databasePath: file, backupPath: backup });
  assert.equal(result.outcome, 'migrated');
  assert.equal(result.from, INTERIM_STORAGE_SCHEMA_VERSION);
  assert.equal(result.to, STORAGE_SCHEMA_VERSION);
  assert.deepEqual(result.migrationIds, [MIGRATION_2_TO_3.id]);
  assert.ok(existsSync(backup), 'the envelope is retained until a verified startup discharges it');

  const anchor = database.prepare('SELECT * FROM local_account WHERE singleton = 1').get();
  assert.equal(anchor.account_key, 'a'.repeat(64));
  assert.equal(anchor.marketplace, 'us');
  assert.equal(anchor.established_at, '2026-09-17T12:00:00.000Z');
  assert.equal(accountAnchorViolation(database), null);
  database.close();
});

test('a revision-2 container with no snapshot migrates without inventing an owner', (t) => {
  const root = workspace(t);
  const file = path.join(root, 'library.sqlite3');
  const database = interimDatabase(file, { withRow: false });
  assert.equal(migrateDatabase({ database, databasePath: file }).outcome, 'migrated');
  assert.equal(database.prepare('SELECT COUNT(*) AS n FROM local_account').get().n, 0);
  assert.equal(accountAnchorViolation(database), null);
  database.close();
});

test('an unmarked revision-2 container is recognized by fingerprint, not by its version number', (t) => {
  const root = workspace(t);
  const file = path.join(root, 'library.sqlite3');
  const database = interimDatabase(file, { marked: false });
  assert.equal(readUserVersion(database), 0);
  const result = migrateDatabase({ database, databasePath: file });
  assert.equal(result.outcome, 'migrated');
  assert.equal(result.from, INTERIM_STORAGE_SCHEMA_VERSION);
  assert.equal(readUserVersion(database), STORAGE_SCHEMA_VERSION);
  database.close();
});

test('a legacy container crosses both revisions in one transaction and records both steps', (t) => {
  const root = workspace(t);
  const file = path.join(root, 'library.sqlite3');
  const database = legacyDatabase(file);

  const result = migrateDatabase({ database, databasePath: file });
  assert.deepEqual(result.migrationIds, [MIGRATION_1_TO_2.id, MIGRATION_2_TO_3.id]);
  assert.equal(
    database.prepare('SELECT COUNT(*) AS n FROM schema_migration').get().n,
    2,
    'both structural steps are registered',
  );
  assert.equal(
    database.prepare('SELECT account_key FROM local_account WHERE singleton = 1').get().account_key,
    'a'.repeat(64),
  );
  database.close();
});

test('an interrupted chained migration leaves neither revision half-applied', (t) => {
  const root = workspace(t);
  const file = path.join(root, 'library.sqlite3');
  const backup = path.join(root, 'library.backup');
  const database = legacyDatabase(file);

  // The counter spans the whole chain, so this interrupts inside the second
  // step, after the first has already made structural changes.
  assert.throws(
    () => migrateDatabase({ database, databasePath: file, backupPath: backup, failAfterStatements: 8 }),
    (error) => error instanceof MigrationError && error.code === 'migration-interrupted',
  );
  const fingerprint = databaseFingerprint(database);
  assert.equal(fingerprintMatches(fingerprint, CURRENT_FINGERPRINT), false);
  assert.equal('local_account' in fingerprint, false, 'no partial revision-3 structure survives');
  assert.equal('private_review' in fingerprint, false, 'no partial revision-2 structure survives');
  assert.equal(database.prepare('SELECT item_count FROM encrypted_snapshot WHERE singleton = 1').get().item_count, 3);
  database.close();

  // Recovery from the envelope, then a clean forward migration.
  assert.equal(restoreBackup({ databasePath: file, backupPath: backup }).outcome, 'restored');
  const reopened = new DatabaseSync(file);
  assert.equal(migrateDatabase({ database: reopened, databasePath: file }).outcome, 'migrated');
  assert.ok(fingerprintMatches(databaseFingerprint(reopened), CURRENT_FINGERPRINT));
  assert.equal(accountAnchorViolation(reopened), null);
  reopened.close();
});

test('the version marker commits with the structure it describes, never after it', (t) => {
  const root = workspace(t);
  const file = path.join(root, 'library.sqlite3');
  const backup = path.join(root, 'library.backup');
  const database = legacyDatabase(file);

  // The exact post-structure/pre-marker window: every statement and receipt
  // has been applied, and the marker is the next operation. Committing the
  // structure before the marker would leave a revision-3 container still
  // claiming to be revision 1 - recognized later as partially created and
  // refused, with the owner's library inside it.
  const operations = migrationOperationCount(LEGACY_STORAGE_SCHEMA_VERSION);
  assert.throws(
    () => migrateDatabase({
      database, databasePath: file, backupPath: backup, failAfterStatements: operations - 1,
    }),
    (error) => error instanceof MigrationError && error.code === 'migration-interrupted',
  );

  // The whole transaction rolled back: marker, structure and receipts alike.
  assert.equal(readUserVersion(database), 0, 'the marker did not advance');
  assert.ok(fingerprintMatches(databaseFingerprint(database), LEGACY_FINGERPRINT));
  assert.equal(database.prepare('SELECT item_count FROM encrypted_snapshot WHERE singleton = 1').get().item_count, 3);

  // The container is still a recognized legacy shape, so recovery is a normal
  // forward migration rather than a refusal.
  const recovered = migrateDatabase({ database, databasePath: file, backupPath: backup });
  assert.equal(recovered.outcome, 'migrated');
  assert.equal(readUserVersion(database), STORAGE_SCHEMA_VERSION);
  assert.ok(fingerprintMatches(databaseFingerprint(database), CURRENT_FINGERPRINT));
  database.close();

  // The envelope still restores the pre-migration state after all of this.
  assert.equal(restoreBackup({ databasePath: file, backupPath: backup }).outcome, 'restored');
  const reopened = new DatabaseSync(file);
  assert.equal(readUserVersion(reopened), 0);
  assert.equal(reopened.prepare('SELECT item_count FROM encrypted_snapshot WHERE singleton = 1').get().item_count, 3);
  reopened.close();
});

test('the marker window is closed for the 2 to 3 chain as well', (t) => {
  const root = workspace(t);
  const file = path.join(root, 'library.sqlite3');
  const database = interimDatabase(file);
  const operations = migrationOperationCount(INTERIM_STORAGE_SCHEMA_VERSION);

  assert.throws(
    () => migrateDatabase({ database, databasePath: file, failAfterStatements: operations - 1 }),
    (error) => error instanceof MigrationError && error.code === 'migration-interrupted',
  );
  assert.equal(readUserVersion(database), INTERIM_STORAGE_SCHEMA_VERSION);
  assert.ok(fingerprintMatches(databaseFingerprint(database), INTERIM_FINGERPRINT));
  assert.equal(
    database.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE name = 'local_account'").get().n,
    0,
    'no anchor table survives a rolled-back migration',
  );

  // Recognized as revision 2 on the next open, and migrated cleanly.
  assert.equal(migrateDatabase({ database, databasePath: file }).outcome, 'migrated');
  assert.equal(readUserVersion(database), STORAGE_SCHEMA_VERSION);
  assert.equal(accountAnchorViolation(database), null);
  database.close();
});

test('the anchor invariant fails closed when a review has no anchored owner', (t) => {
  const file = path.join(workspace(t), 'library.sqlite3');
  const database = new DatabaseSync(file);
  migrateDatabase({ database, databasePath: file });
  database.prepare(
    'INSERT INTO private_review (account_key, book_id, generation, revision, deleted, sealed_payload) VALUES (?, ?, 1, ?, 0, ?)',
  ).run('a'.repeat(64), 'aud-us-book-one', 'rev-1', Buffer.from('sealed'));
  assert.equal(accountAnchorViolation(database), 'review-without-account-anchor');

  database.prepare(
    'INSERT INTO local_account (singleton, account_key, marketplace, established_at, last_confirmed_at) VALUES (1, ?, ?, ?, ?)',
  ).run('b'.repeat(64), 'us', '2026-09-17T12:00:00.000Z', '2026-09-17T12:00:00.000Z');
  assert.equal(accountAnchorViolation(database), 'review-account-not-anchored');
  database.close();
});
