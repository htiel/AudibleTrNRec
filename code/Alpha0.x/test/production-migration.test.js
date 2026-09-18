/**
 * Production migration path and real-data runtime contract (Alpha 0.0.2).
 *
 * These tests use synthetic containers in a temporary directory only. No real
 * library state is opened, and nothing asserted here carries a title, ASIN,
 * item count or account identifier.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import { EncryptedSnapshotStore } from '../src/store/encrypted-snapshot-store.js';
import {
  CONTAINER_SHAPES,
  MIGRATION_ACTIONS,
  ProductionMigrationError,
  RECOGNIZED_EXISTING_SHAPES,
  assertProductionCustody,
  classifyContainer,
  isRestorableFailure,
  migrationEvidence,
  openRealLibraryState,
  planMigration,
  probeStorageContainer,
} from '../src/store/production-migration.js';
import {
  CURRENT_FINGERPRINT,
  INTERIM_FINGERPRINT,
  LEGACY_FINGERPRINT,
  LEGACY_STORAGE_SCHEMA_VERSION,
  STORAGE_SCHEMA_VERSION,
  databaseFingerprint,
} from '../src/store/schema.js';
import { ALPHA_VERSION, LEGACY_ALPHA_VERSION } from '../src/version.js';

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
  const root = mkdtempSync(path.join(tmpdir(), 'atnr-production-'));
  const closables = [];
  // On Windows a live SQLite handle blocks directory removal, and `t.after`
  // hooks run in registration order, so every handle is closed here first.
  t.after(() => {
    for (const closable of closables) {
      try { closable.close(); } catch { /* already closed */ }
    }
    rmSync(root, { recursive: true, force: true });
  });
  return { root, keep: (closable) => { closables.push(closable); return closable; } };
}

/** A temporary root is a user-writable staging area, so tests bypass the
 *  strict boundary check the production caller uses. The default is asserted
 *  separately below. */
const permissiveCustody = () => true;

function legacyContainer(root, { withRow = true } = {}) {
  const file = path.join(root, 'library.sqlite3');
  const database = new DatabaseSync(file);
  database.exec(LEGACY_DDL);
  if (withRow) {
    database.prepare(
      `INSERT INTO encrypted_snapshot (singleton, account_key, marketplace, item_count, observed_at, sealed_payload)
       VALUES (1, ?, 'us', 3, '2026-01-01T00:00:00.000Z', ?)`,
    ).run('a'.repeat(64), Buffer.from('sealed-test-bytes'));
  }
  database.close();
  return file;
}

test('every shape maps to exactly one closed action', () => {
  for (const shape of CONTAINER_SHAPES) {
    const plan = shape === 'absent'
      ? planMigration({ exists: false })
      : planMigration({ userVersion: 0, fingerprint: {}, exists: true });
    assert.ok(MIGRATION_ACTIONS.includes(plan.action));
  }
  assert.equal(planMigration({ exists: false }).action, 'initialize');
  assert.equal(planMigration({ userVersion: 0, fingerprint: {} }).action, 'initialize');
  assert.equal(planMigration({ userVersion: 0, fingerprint: LEGACY_FINGERPRINT }).action, 'migrate');
  assert.equal(planMigration({ userVersion: 1, fingerprint: LEGACY_FINGERPRINT }).action, 'migrate');
  assert.equal(planMigration({ userVersion: 2, fingerprint: INTERIM_FINGERPRINT }).action, 'migrate');
  assert.equal(planMigration({ userVersion: 0, fingerprint: INTERIM_FINGERPRINT }).action, 'migrate');
  assert.equal(planMigration({ userVersion: 3, fingerprint: CURRENT_FINGERPRINT }).action, 'none');
  assert.equal(planMigration({ userVersion: 0, fingerprint: CURRENT_FINGERPRINT }).action, 'adopt-marker');
});

test('unknown and newer containers are refused, never rewritten', () => {
  const newer = planMigration({ userVersion: STORAGE_SCHEMA_VERSION + 1, fingerprint: CURRENT_FINGERPRINT });
  assert.equal(newer.action, 'refuse');
  assert.equal(newer.reasonCode, 'schema-newer-refused');
  assert.equal(newer.preservesExistingState, true);

  const foreign = planMigration({ userVersion: 0, fingerprint: { other_table: ['id'] } });
  assert.equal(foreign.action, 'refuse');
  assert.equal(foreign.reasonCode, 'schema-unknown-refused');

  assert.equal(classifyContainer({ userVersion: 1, fingerprint: CURRENT_FINGERPRINT }), 'unknown');
  assert.equal(classifyContainer({ userVersion: -1, fingerprint: {} }), 'unknown');
});

test('the probe is read-only: it neither migrates nor marks the container', (t) => {
  const { root, keep } = workspace(t);
  const file = legacyContainer(root);
  const before = readFileSync(file);

  const probed = probeStorageContainer({ databasePath: file });
  assert.equal(probed.exists, true);
  assert.equal(probed.readable, true);
  assert.equal(probed.shape, 'legacy');
  assert.equal(probed.plan.action, 'migrate');
  assert.equal(probed.plan.rollbackEnvelopeRequired, true);

  assert.deepEqual(readFileSync(file), before);
  const database = keep(new DatabaseSync(file));
  assert.ok(!('schema_migration' in databaseFingerprint(database)));
});

test('an absent container probes as absent and an unreadable one is reported, not replaced', (t) => {
  const { root, keep } = workspace(t);
  const missing = path.join(root, 'library.sqlite3');
  const absent = probeStorageContainer({ databasePath: missing });
  assert.deepEqual(
    { exists: absent.exists, shape: absent.shape, action: absent.plan.action },
    { exists: false, shape: 'absent', action: 'initialize' },
  );

  writeFileSync(missing, 'this is not a database');
  const garbage = probeStorageContainer({ databasePath: missing });
  assert.equal(garbage.exists, true);
  assert.equal(garbage.readable, false);
  assert.equal(garbage.plan.action, 'refuse');
  assert.equal(readFileSync(missing, 'utf8'), 'this is not a database');
});

test('probe rejects a relative path rather than resolving it against the cwd', () => {
  assert.throws(
    () => probeStorageContainer({ databasePath: 'library.sqlite3' }),
    (error) => error instanceof ProductionMigrationError && error.code === 'storage-path-invalid',
  );
});

test('openRealLibraryState migrates real legacy state behind a rollback envelope', (t) => {
  const { root, keep } = workspace(t);
  legacyContainer(root);

  const opened = openRealLibraryState({
    root,
    openStore: (options) => new EncryptedSnapshotStore(options),
    verifyCustody: permissiveCustody,
  });
  keep(opened.store);

  assert.equal(opened.hasExistingState, true);
  assert.equal(opened.containerShapeBefore, 'legacy');
  assert.equal(opened.evidence.outcome, 'migrated');
  assert.equal(opened.evidence.rollbackEnvelopeRetained, true);
  assert.equal(opened.store.status().hasLocalSnapshot, true);
  // The envelope stays inside the same protected root.
  assert.equal(path.dirname(opened.store.backupPath), root);
  assert.ok(existsSync(opened.store.backupPath));
});

test('redacted evidence carries no path, count, identifier or timestamp', (t) => {
  const { root, keep } = workspace(t);
  legacyContainer(root);
  const opened = openRealLibraryState({
    root,
    openStore: (options) => new EncryptedSnapshotStore(options),
    verifyCustody: permissiveCustody,
  });
  keep(opened.store);

  const serialized = JSON.stringify(opened.evidence);
  assert.ok(!serialized.includes(root));
  assert.ok(!serialized.includes('sqlite'));
  assert.ok(!/\d{4}-\d{2}-\d{2}T/.test(serialized));
  assert.ok(!serialized.includes('a'.repeat(64)));
  assert.deepEqual(Object.keys(opened.evidence).sort(), [
    'from', 'migrationId', 'outcome', 'restoredFromRollback',
    'revision', 'rollbackEnvelopeRetained', 'to',
  ]);
  assert.equal(migrationEvidence(undefined).outcome, 'unknown');
});

test('a foreign container is refused before the store is ever opened', (t) => {
  const { root, keep } = workspace(t);
  const file = path.join(root, 'library.sqlite3');
  const database = new DatabaseSync(file);
  database.exec('CREATE TABLE somebody_elses_data (id TEXT) STRICT');
  database.close();
  const before = readFileSync(file);

  let opened = 0;
  assert.throws(
    () => openRealLibraryState({
      root,
      openStore: () => { opened += 1; return null; },
      verifyCustody: permissiveCustody,
    }),
    (error) => error instanceof ProductionMigrationError && error.code === 'schema-unknown-refused',
  );
  assert.equal(opened, 0, 'the container must not be opened for write after a refusal');
  assert.deepEqual(readFileSync(file), before);
});

test('strict mode refuses to start when no real state exists and invents nothing', (t) => {
  const { root } = workspace(t);
  const fresh = path.join(root, 'never-created');
  let opened = 0;
  assert.throws(
    () => openRealLibraryState({
      root: fresh,
      requireExistingState: true,
      openStore: () => { opened += 1; return null; },
      verifyCustody: permissiveCustody,
    }),
    (error) => error instanceof ProductionMigrationError && error.code === 'real-local-state-missing',
  );
  assert.equal(opened, 0);
  // Nothing at all is created: not the container, and not even its directory.
  assert.ok(!existsSync(fresh), 'a missing library must not be resolved by making one');
});

test('strict mode refuses an existing but empty container before any write', (t) => {
  const { root, keep } = workspace(t);
  const file = path.join(root, 'library.sqlite3');
  // A container that exists but holds no schema: present, yet not a library.
  keep(new DatabaseSync(file)).close();
  const before = readFileSync(file);

  let opened = 0;
  assert.throws(
    () => openRealLibraryState({
      root,
      requireExistingState: true,
      openStore: () => { opened += 1; return null; },
      verifyCustody: permissiveCustody,
    }),
    (error) => error instanceof ProductionMigrationError && error.code === 'real-local-state-empty',
  );
  assert.equal(opened, 0, 'an empty container must not be opened for write');
  assert.deepEqual(readFileSync(file), before, 'and it must not be initialized');

  // Non-strict callers (tests, first-run tooling) may still initialize it.
  const opened2 = openRealLibraryState({
    root,
    openStore: (options) => new EncryptedSnapshotStore(options),
    verifyCustody: permissiveCustody,
  });
  keep(opened2.store);
  assert.equal(opened2.evidence.outcome, 'initialized');
});

test('strict mode admits only recognized existing shapes', (t) => {
  const { root, keep } = workspace(t);
  const file = path.join(root, 'library.sqlite3');
  const foreign = keep(new DatabaseSync(file));
  foreign.exec('CREATE TABLE somebody_elses_data (id TEXT) STRICT');
  foreign.close();

  let opened = 0;
  assert.throws(
    () => openRealLibraryState({
      root,
      requireExistingState: true,
      openStore: () => { opened += 1; return null; },
      verifyCustody: permissiveCustody,
    }),
    (error) => error instanceof ProductionMigrationError && error.code === 'schema-unknown-refused',
  );
  assert.equal(opened, 0);
  assert.deepEqual([...RECOGNIZED_EXISTING_SHAPES].sort(), ['current', 'current-unmarked', 'interim', 'legacy']);
});

test('strict mode accepts the real legacy shape it exists for', (t) => {
  const { root, keep } = workspace(t);
  legacyContainer(root);
  const opened = openRealLibraryState({
    root,
    requireExistingState: true,
    openStore: (options) => new EncryptedSnapshotStore(options),
    verifyCustody: permissiveCustody,
  });
  keep(opened.store);
  assert.equal(opened.containerShapeBefore, 'legacy');
  assert.equal(opened.evidence.outcome, 'migrated');
});

test('the release bump leaves the revision-1 probe recognizable', (t) => {
  // The 0.0.2 release must still detect the 0.0.1 container it has to migrate.
  // Classification reads the storage revision and fingerprint, never a release
  // string, so bumping ALPHA_VERSION cannot orphan the owner's existing state.
  const { root } = workspace(t);
  const file = legacyContainer(root);
  const probe = probeStorageContainer({ databasePath: file });
  assert.equal(probe.shape, 'legacy');
  // The legacy container carries no user_version: it is recognized by exact
  // fingerprint, so no release string participates in the decision.
  assert.equal(probe.userVersion, 0);
  assert.equal(probe.plan.action, 'migrate');
  assert.equal(probe.plan.from, LEGACY_STORAGE_SCHEMA_VERSION);
  assert.equal(probe.plan.to, STORAGE_SCHEMA_VERSION);
  assert.notEqual(ALPHA_VERSION, LEGACY_ALPHA_VERSION);
});

test('the production composition requires the existing encrypted state', async (t) => {
  const { root } = workspace(t);
  const source = readFileSync(
    new URL('../scripts/private-alpha-runtime.js', import.meta.url), 'utf8',
  );
  assert.ok(
    /requireExistingState:\s*true/.test(source),
    'production startup must require the existing 0.0.1 encrypted state',
  );
  const module = await import('../scripts/private-alpha-runtime.js');
  await assert.rejects(
    module.createPrivateAlphaRuntime({
      packageRoot: process.cwd(),
      root: path.join(root, 'no-state'),
    }),
    (error) => error.code === 'real-local-state-missing',
    'a missing store must stop startup before a connector is ever launched',
  );
  assert.ok(!existsSync(path.join(root, 'no-state')));
});

test('the default custody check refuses a user-writable staging root', (t) => {
  const { root, keep } = workspace(t);
  legacyContainer(root);
  assert.throws(
    () => openRealLibraryState({ root, openStore: () => null }),
    (error) => error instanceof ProductionMigrationError
      && ['custody-root-unsafe', 'custody-path-unsafe-root'].includes(error.code),
  );
  assert.throws(
    () => assertProductionCustody({
      root,
      databasePath: path.join(root, 'library.sqlite3'),
      backupPath: path.join(root, 'library.sqlite3.migration-backup'),
    }),
    (error) => error instanceof ProductionMigrationError,
  );
});

test('an interrupted migration restores the rollback envelope and keeps the last complete state', (t) => {
  const { root, keep } = workspace(t);
  const file = legacyContainer(root);
  const before = readFileSync(file);

  assert.throws(
    () => new EncryptedSnapshotStore({ root, failAfterStatements: 1 }),
    (error) => error.code === 'migration-interrupted' && error.restoredFromRollback === true,
  );
  // The live file is byte-identical to the pre-migration state, and the
  // envelope that produced it is still available inside the same root.
  assert.deepEqual(readFileSync(file), before);
  assert.ok(existsSync(`${file}.migration-backup`));

  // The restored state is still migratable: recovery is not a dead end.
  const store = keep(new EncryptedSnapshotStore({ root }));
  assert.equal(store.migration.outcome, 'migrated');
  assert.equal(store.status().hasLocalSnapshot, true);
});

test('a rollback envelope outside the custody boundary is refused before any write', (t) => {
  const { root, keep } = workspace(t);
  const file = legacyContainer(root);
  const before = readFileSync(file);

  assert.throws(
    () => new EncryptedSnapshotStore({ root, migrationBackupPath: path.join(root, '..', 'escaped.bak') }),
    (error) => error.code === 'custody-rollback-path-outside-boundary',
  );
  assert.throws(
    () => new EncryptedSnapshotStore({ root, migrationBackupPath: file }),
    (error) => error.code === 'custody-rollback-path-conflict',
  );
  assert.deepEqual(readFileSync(file), before, 'a refused custody path must not touch the state');
});

test('the runtime composition module wires the real-state entry point', async () => {
  const module = await import('../scripts/private-alpha-runtime.js');
  assert.equal(typeof module.createPrivateAlphaRuntime, 'function');
  const source = readFileSync(
    new URL('../scripts/private-alpha-runtime.js', import.meta.url), 'utf8',
  );
  assert.ok(source.includes('openRealLibraryState'), 'startup must go through the real-state path');
  assert.ok(
    !/from\s+['"][^'"]*fixtures/.test(source),
    'the composition root must not import fixture material',
  );
});

test('restorable failure codes are exactly the post-envelope ones', () => {
  for (const code of [
    'migration-interrupted', 'migration-failed',
    'migration-verification-failed', 'storage-schema-unexpected',
  ]) {
    assert.equal(isRestorableFailure(code), true);
  }
  for (const code of ['schema-newer-refused', 'schema-unknown-refused', undefined, null]) {
    assert.equal(isRestorableFailure(code), false);
  }
});
