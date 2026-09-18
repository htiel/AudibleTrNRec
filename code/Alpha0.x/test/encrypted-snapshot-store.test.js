import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import { EncryptedSnapshotStore } from '../src/store/encrypted-snapshot-store.js';
import { CURRENT_FINGERPRINT, databaseFingerprint, fingerprintMatches, readUserVersion, STORAGE_SCHEMA_VERSION } from '../src/store/schema.js';

const SEALED = Buffer.from('ATNR-DPAPI-1\0synthetic-sealed-payload').toString('base64');

async function openStore(t) {
  const root = await mkdtemp(path.join(tmpdir(), 'atnr-store-test-'));
  const store = new EncryptedSnapshotStore({ root });
  t.after(async () => {
    try { store.close(); } catch { /* already closed */ }
    await rm(root, { recursive: true, force: true });
  });
  return { root, store };
}

test('stores only a sealed snapshot and enforces account isolation', async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), 'atnr-store-test-'));
  const store = new EncryptedSnapshotStore({ root });
  t.after(async () => {
    store.close();
    await rm(root, { recursive: true, force: true });
  });

  const sealedSnapshot = Buffer.from('ATNR-DPAPI-1\0synthetic-sealed-payload').toString('base64');
  store.save({
    accountKey: 'a'.repeat(64),
    marketplace: 'us',
    itemCount: 1,
    observedAt: '2026-09-17T12:00:00.000Z',
    sealedSnapshot,
  });
  assert.equal(store.status().itemCount, 1);
  assert.equal(store.encryptedSnapshot(), sealedSnapshot);

  assert.throws(() => store.save({
    accountKey: 'b'.repeat(64),
    marketplace: 'us',
    itemCount: 1,
    observedAt: '2026-09-17T12:00:00.000Z',
    sealedSnapshot,
  }), /different-account-local-data-exists/);

  store.deleteLocalSnapshot();
  assert.equal(store.status().hasLocalSnapshot, false);
});

test('a new store opens at the current revision with the private review table present', async (t) => {
  const { store } = await openStore(t);
  assert.equal(store.migration.outcome, 'initialized');
  assert.equal(readUserVersion(store.database), STORAGE_SCHEMA_VERSION);
  assert.ok(fingerprintMatches(databaseFingerprint(store.database), CURRENT_FINGERPRINT));
});

test('an attempt is recorded without ever implying a success', async (t) => {
  const { store } = await openStore(t);
  const status = store.recordAttempt('2026-09-17T12:00:05.000Z');
  assert.equal(status.lastAttemptAt, '2026-09-17T12:00:05.000Z');
  assert.equal(status.lastSuccessAt, null);
  assert.equal(status.hasLocalSnapshot, false);
});

test('the durable commit time is the success authority, and the source observation is kept apart', async (t) => {
  const { store } = await openStore(t);
  store.recordAttempt('2026-09-17T12:00:05.000Z');
  const generation = store.save({
    accountKey: 'a'.repeat(64),
    marketplace: 'us',
    itemCount: 2,
    observedAt: '2026-09-17T12:00:00.000Z',
    sealedSnapshot: SEALED,
    completenessBasis: 'short-final-page',
    committedAt: '2026-09-17T12:00:09.000Z',
  });
  const status = store.status();
  assert.equal(generation, 1);
  assert.equal(status.snapshotGeneration, 1);
  assert.equal(status.lastSuccessAt, '2026-09-17T12:00:09.000Z');
  assert.equal(status.observedAt, '2026-09-17T12:00:00.000Z');
  assert.equal(status.sourceObservedAt, '2026-09-17T12:00:00.000Z');
  assert.equal(status.completenessBasis, 'short-final-page');
  assert.notEqual(status.lastSuccessAt, status.observedAt);
});

test('every failure preserves the previous snapshot and its success time', async (t) => {
  const { store } = await openStore(t);
  store.save({
    accountKey: 'a'.repeat(64),
    marketplace: 'us',
    itemCount: 2,
    observedAt: '2026-09-17T12:00:00.000Z',
    sealedSnapshot: SEALED,
    committedAt: '2026-09-17T12:00:09.000Z',
  });
  store.recordAttempt('2026-09-18T12:00:00.000Z');
  store.recordFailure('library-page-limit', '2026-09-18T12:00:03.000Z');
  const status = store.status();
  assert.equal(status.lastSuccessAt, '2026-09-17T12:00:09.000Z');
  assert.equal(status.lastErrorCode, 'library-page-limit');
  assert.equal(status.itemCount, 2);
  assert.equal(store.encryptedSnapshot(), SEALED);
  assert.equal(status.snapshotGeneration, 1, 'a failed attempt never advances the generation');
});

test('a first-sync failure records no success at all', async (t) => {
  const { store } = await openStore(t);
  store.recordAttempt('2026-09-17T12:00:00.000Z');
  store.recordFailure('connector-timeout', '2026-09-17T12:00:30.000Z');
  const status = store.status();
  assert.equal(status.lastSuccessAt, null);
  assert.equal(status.hasLocalSnapshot, false);
  assert.equal(status.lastErrorCode, 'connector-timeout');
});

test('an unrecognized error code is reduced to a closed diagnostic', async (t) => {
  const { store } = await openStore(t);
  store.recordFailure('Personal Detail: user@example.invalid');
  assert.equal(store.status().lastErrorCode, 'private-alpha-operation-failed');
});

test('a corrupt or foreign storage container fails closed rather than being reseeded', async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), 'atnr-store-foreign-'));
  t.after(async () => rm(root, { recursive: true, force: true }));
  const file = path.join(root, 'library.sqlite3');
  const foreign = new DatabaseSync(file);
  foreign.exec('CREATE TABLE unrelated (id INTEGER PRIMARY KEY) STRICT;');
  foreign.close();

  assert.throws(() => new EncryptedSnapshotStore({ root }), (error) => error.code === 'schema-unknown-refused');
  const reopened = new DatabaseSync(file);
  assert.equal(reopened.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE name = 'unrelated'").get().n, 1);
  reopened.close();
});

test('deleting the imported snapshot does not touch private reviews', async (t) => {
  const { store } = await openStore(t);
  store.database.prepare(
    'INSERT INTO private_review (account_key, book_id, generation, revision, deleted, sealed_payload) VALUES (?, ?, 1, ?, 0, ?)',
  ).run('a'.repeat(64), 'aud-us-book-one', 'rev-1-aaaa', Buffer.from('sealed'));
  store.save({
    accountKey: 'a'.repeat(64),
    marketplace: 'us',
    itemCount: 1,
    observedAt: '2026-09-17T12:00:00.000Z',
    sealedSnapshot: SEALED,
  });
  store.deleteLocalSnapshot();
  assert.equal(store.status().hasLocalSnapshot, false);
  assert.equal(store.database.prepare('SELECT COUNT(*) AS n FROM private_review').get().n, 1);
});

test('a malformed sealed payload or item count is refused before any write', async (t) => {
  const { store } = await openStore(t);
  const base = {
    accountKey: 'a'.repeat(64),
    marketplace: 'us',
    itemCount: 1,
    observedAt: '2026-09-17T12:00:00.000Z',
    sealedSnapshot: SEALED,
  };
  assert.throws(() => store.save({ ...base, sealedSnapshot: Buffer.from('not-sealed').toString('base64') }), /sealed-snapshot-invalid/);
  assert.throws(() => store.save({ ...base, itemCount: -1 }), /item-count-invalid/);
  assert.throws(() => store.save({ ...base, accountKey: 'short' }), /account-key-invalid/);
  assert.throws(() => store.save({ ...base, marketplace: 'uk' }), /marketplace-not-allowed/);
  assert.equal(store.status().hasLocalSnapshot, false);
});
