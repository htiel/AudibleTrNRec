/**
 * Frozen persisted schema for the private-alpha local store (ATR-S031).
 *
 * This module is the single revision-frozen description of the SQLite shape.
 * Every consumer (snapshot store, feedback store, migration, export, deletion
 * inventory) cites `STORAGE_SCHEMA_REVISION` rather than re-deriving DDL, so
 * the schema cannot be designed after its consumers.
 *
 * Storage revisions are independent of the application version. A release bump
 * never creates a new storage root, and a storage revision is never inferred
 * from a version string.
 *
 *  revision 1 (legacy alpha 0.0.1): `encrypted_snapshot` + `sync_state`, no
 *             `user_version`, recognized only by exact fingerprint.
 *  revision 2: adds durable-success/generation columns, the encrypted
 *             `private_review` table and the migration registry.
 *  revision 3: adds `local_account`, the durable ownership anchor. Before it,
 *             `encrypted_snapshot` held the only account key, so deleting the
 *             imported snapshot orphaned the owner's own reviews.
 */

import {
  STORAGE_SCHEMA_VERSION,
  LEGACY_STORAGE_SCHEMA_VERSION,
  INTERIM_STORAGE_SCHEMA_VERSION,
  STORAGE_SCHEMA_REVISION,
} from '../version.js';

export {
  STORAGE_SCHEMA_VERSION,
  LEGACY_STORAGE_SCHEMA_VERSION,
  INTERIM_STORAGE_SCHEMA_VERSION,
  STORAGE_SCHEMA_REVISION,
};

/** Exact legacy fingerprint. Anything else with `user_version = 0` fails closed. */
export const LEGACY_FINGERPRINT = Object.freeze({
  encrypted_snapshot: Object.freeze([
    'account_key', 'item_count', 'marketplace', 'observed_at', 'sealed_payload', 'singleton',
  ]),
  sync_state: Object.freeze([
    'last_attempt_at', 'last_error_code', 'last_success_at', 'singleton',
  ]),
});

/** Revision 2 shape: current tables minus the account anchor. */
export const INTERIM_FINGERPRINT = Object.freeze({
  encrypted_snapshot: Object.freeze([
    'account_key', 'completeness_basis', 'item_count', 'marketplace', 'observed_at',
    'sealed_payload', 'singleton', 'snapshot_generation', 'source_observed_at',
  ]),
  sync_state: Object.freeze([
    'last_attempt_at', 'last_candidate_observed_at', 'last_error_code', 'last_success_at',
    'singleton', 'snapshot_generation',
  ]),
  private_review: Object.freeze([
    'account_key', 'book_id', 'deleted', 'generation', 'revision', 'sealed_payload',
  ]),
  schema_migration: Object.freeze(['applied_at', 'checksum', 'migration_id']),
});

/** Revision 3 table shape, asserted after every create and every migration. */
export const CURRENT_FINGERPRINT = Object.freeze({
  encrypted_snapshot: Object.freeze([
    'account_key', 'completeness_basis', 'item_count', 'marketplace', 'observed_at',
    'sealed_payload', 'singleton', 'snapshot_generation', 'source_observed_at',
  ]),
  local_account: Object.freeze([
    'account_key', 'established_at', 'last_confirmed_at', 'marketplace', 'singleton',
  ]),
  sync_state: Object.freeze([
    'last_attempt_at', 'last_candidate_observed_at', 'last_error_code', 'last_success_at',
    'singleton', 'snapshot_generation',
  ]),
  private_review: Object.freeze([
    'account_key', 'book_id', 'deleted', 'generation', 'revision', 'sealed_payload',
  ]),
  schema_migration: Object.freeze(['applied_at', 'checksum', 'migration_id']),
});

/**
 * Durability pragmas for this baseline. A pragma is not durability proof; the
 * interruption tests in `test/migration.test.js` and
 * `test/feedback-store.test.js` exercise the failure paths that matter.
 */
export const DURABILITY_PRAGMAS = Object.freeze([
  'PRAGMA journal_mode = DELETE;',
  'PRAGMA synchronous = FULL;',
  'PRAGMA secure_delete = ON;',
  'PRAGMA foreign_keys = ON;',
]);

export const CREATE_REVISION_2 = Object.freeze([
  `CREATE TABLE IF NOT EXISTS encrypted_snapshot (
     singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
     account_key TEXT NOT NULL,
     marketplace TEXT NOT NULL,
     item_count INTEGER NOT NULL CHECK (item_count >= 0),
     observed_at TEXT NOT NULL,
     sealed_payload BLOB NOT NULL,
     snapshot_generation INTEGER NOT NULL DEFAULT 1,
     source_observed_at TEXT,
     completeness_basis TEXT
   ) STRICT;`,
  `CREATE TABLE IF NOT EXISTS sync_state (
     singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
     last_attempt_at TEXT,
     last_success_at TEXT,
     last_error_code TEXT,
     snapshot_generation INTEGER NOT NULL DEFAULT 0,
     last_candidate_observed_at TEXT
   ) STRICT;`,
  // Only opaque account/book keys and the CAS generation are in the clear.
  // Ratings, comments, tags and their timestamps live inside sealed_payload.
  `CREATE TABLE IF NOT EXISTS private_review (
     account_key TEXT NOT NULL,
     book_id TEXT NOT NULL,
     generation INTEGER NOT NULL CHECK (generation > 0),
     revision TEXT NOT NULL,
     deleted INTEGER NOT NULL CHECK (deleted IN (0, 1)),
     sealed_payload BLOB,
     PRIMARY KEY (account_key, book_id)
   ) STRICT;`,
  `CREATE TABLE IF NOT EXISTS schema_migration (
     migration_id TEXT PRIMARY KEY,
     applied_at TEXT NOT NULL,
     checksum TEXT NOT NULL
   ) STRICT;`,
]);

/**
 * Durable ownership anchor (revision 3).
 *
 * Only the opaque, locally derived account key is stored - never an email,
 * customer id, device serial or any other provider identifier. The anchor
 * outlives the imported snapshot on purpose: locally owned reviews belong to
 * the owner, not to a copy of the provider's library, and deleting the import
 * must not strand them.
 */
export const CREATE_LOCAL_ACCOUNT = `CREATE TABLE IF NOT EXISTS local_account (
     singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
     account_key TEXT NOT NULL,
     marketplace TEXT NOT NULL,
     established_at TEXT NOT NULL,
     last_confirmed_at TEXT NOT NULL
   ) STRICT;`;

export const CREATE_REVISION_3 = Object.freeze([...CREATE_REVISION_2, CREATE_LOCAL_ACCOUNT]);

/** Ordered structural migration steps from revision 1 to revision 2. */
export const MIGRATION_1_TO_2 = Object.freeze({
  id: 'atr-storage-0001-private-feedback',
  checksum: 'r1-to-r2-columns+private_review+schema_migration',
  from: LEGACY_STORAGE_SCHEMA_VERSION,
  to: INTERIM_STORAGE_SCHEMA_VERSION,
  statements: Object.freeze([
    'ALTER TABLE encrypted_snapshot ADD COLUMN snapshot_generation INTEGER NOT NULL DEFAULT 1;',
    'ALTER TABLE encrypted_snapshot ADD COLUMN source_observed_at TEXT;',
    'ALTER TABLE encrypted_snapshot ADD COLUMN completeness_basis TEXT;',
    'ALTER TABLE sync_state ADD COLUMN snapshot_generation INTEGER NOT NULL DEFAULT 0;',
    'ALTER TABLE sync_state ADD COLUMN last_candidate_observed_at TEXT;',
    CREATE_REVISION_2[2],
    CREATE_REVISION_2[3],
  ]),
});

/**
 * Revision 2 to 3: create the anchor and backfill it from the snapshot that is
 * already present. The backfill is part of the same transaction as the DDL, so
 * a container can never end up with the anchor table but no ownership record
 * while a snapshot exists.
 */
export const MIGRATION_2_TO_3 = Object.freeze({
  id: 'atr-storage-0002-local-account-anchor',
  checksum: 'r2-to-r3-local_account+backfill-from-snapshot',
  from: INTERIM_STORAGE_SCHEMA_VERSION,
  to: STORAGE_SCHEMA_VERSION,
  statements: Object.freeze([
    CREATE_LOCAL_ACCOUNT,
    `INSERT INTO local_account (singleton, account_key, marketplace, established_at, last_confirmed_at)
       SELECT 1, account_key, marketplace, observed_at, observed_at
         FROM encrypted_snapshot WHERE singleton = 1
     ON CONFLICT(singleton) DO NOTHING;`,
  ]),
});

/** Every structural migration, in application order. */
export const MIGRATION_CHAIN = Object.freeze([MIGRATION_1_TO_2, MIGRATION_2_TO_3]);

/** Read the actual table/column shape of an open database. */
export function databaseFingerprint(database) {
  const tables = database
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
    .all()
    .map((row) => row.name);
  const fingerprint = {};
  for (const table of tables) {
    fingerprint[table] = database
      .prepare(`PRAGMA table_info(${table})`)
      .all()
      .map((row) => row.name)
      .sort();
  }
  return fingerprint;
}

export function fingerprintMatches(actual, expected) {
  const actualTables = Object.keys(actual).sort();
  const expectedTables = Object.keys(expected).sort();
  if (actualTables.length !== expectedTables.length) return false;
  return expectedTables.every((table, i) => (
    actualTables[i] === table
    && Array.isArray(actual[table])
    && actual[table].length === expected[table].length
    && expected[table].every((column, j) => actual[table][j] === column)
  ));
}

export function readUserVersion(database) {
  const row = database.prepare('PRAGMA user_version').get();
  return Number(row?.user_version ?? 0);
}

export function writeUserVersion(database, version) {
  database.exec(`PRAGMA user_version = ${Number(version)}`);
}

/**
 * Schema invariant for revision 3: a private review may only exist for the
 * anchored account.
 *
 * SQLite cannot express "every review belongs to the single anchored account"
 * as a foreign key without rebuilding `private_review`, and rebuilding a table
 * that already holds the owner's encrypted reviews is a larger risk than the
 * invariant it would enforce. It is therefore checked explicitly, fails closed,
 * and is asserted after every open and every ownership write.
 *
 * Returns a closed reason code, or `null` when the invariant holds.
 */
export function accountAnchorViolation(database) {
  const anchor = database
    .prepare('SELECT account_key FROM local_account WHERE singleton = 1')
    .get() ?? null;
  const reviews = Number(database
    .prepare('SELECT COUNT(*) AS total FROM private_review')
    .get()?.total ?? 0);
  if (reviews === 0) return null;
  if (!anchor) return 'review-without-account-anchor';
  const foreign = Number(database
    .prepare('SELECT COUNT(*) AS total FROM private_review WHERE account_key <> ?')
    .get(anchor.account_key)?.total ?? 0);
  return foreign > 0 ? 'review-account-not-anchored' : null;
}
