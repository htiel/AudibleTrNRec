import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import { ABSENT_REVISION, PrivateFeedbackStore } from '../src/store/feedback-store.js';
import { ConnectorLocalSealer, LocalSealerError } from '../src/store/local-sealer.js';
import { migrateDatabase } from '../src/store/migration.js';

const ACCOUNT = 'a'.repeat(64);
const OTHER_ACCOUNT = 'b'.repeat(64);
const BOOK = 'aud-us-book-one';

/**
 * Reversible stand-in for DPAPI custody. It is deliberately not plaintext, so
 * "no clear text on disk" is a real assertion rather than a coincidence.
 */
function fakeSealer() {
  const sealer = {
    sealCalls: 0,
    failNext: null,
    async seal(plaintext) {
      sealer.sealCalls += 1;
      if (sealer.failNext) { const error = sealer.failNext; sealer.failNext = null; throw error; }
      return Buffer.from(Buffer.from(plaintext, 'utf8').map((b) => b ^ 0x5a)).toString('base64');
    },
    async unseal(sealed) {
      return Buffer.from(Buffer.from(sealed, 'base64').map((b) => b ^ 0x5a)).toString('utf8');
    },
  };
  return sealer;
}

function openStore(t, { accountKey = ACCOUNT, sealer = fakeSealer(), database = null, clock } = {}) {
  let db = database;
  if (!db) {
    const root = mkdtempSync(path.join(tmpdir(), 'atnr-feedback-'));
    db = new DatabaseSync(path.join(root, 'library.sqlite3'));
    // Close the handle before removing the directory: Windows keeps the file
    // locked while the database is open.
    t.after(() => { try { db.close(); } catch { /* already closed */ } });
    t.after(() => rmSync(root, { recursive: true, force: true }));
    migrateDatabase({ database: db });
  }
  return {
    database: db,
    sealer,
    store: new PrivateFeedbackStore({ database: db, sealer, accountKey, clock }),
  };
}

test('a first save requires the absent-revision token and returns a record', async (t) => {
  const { store } = openStore(t, { clock: () => '2026-09-17T12:00:00.000Z' });
  const empty = await store.get(BOOK);
  assert.equal(empty.record, null);
  assert.equal(empty.revision, ABSENT_REVISION);

  const saved = await store.save(BOOK, { overallRating: 4.5, comment: 'held up', tags: ['Noir'] }, { expectedRevision: ABSENT_REVISION });
  assert.equal(saved.record.overallRating, 4.5);
  assert.equal(saved.record.createdAt, '2026-09-17T12:00:00.000Z');
  assert.equal(saved.generation, 1);

  const read = await store.get(BOOK);
  assert.deepEqual(read.record, saved.record);
  assert.equal(store.count(), 1);
});

test('a canonical person target persists through the encrypted feedback store', async (t) => {
  const { store, database } = openStore(t);
  const targetId = 'person:author:catalog-person-one';
  const saved = await store.save(
    targetId,
    { overallRating: 4.5, comment: 'Consistently strong work', tags: ['favorite-author'] },
    { expectedRevision: ABSENT_REVISION },
  );
  const read = await store.get(targetId);
  assert.deepEqual(read.record, saved.record);
  const row = database.prepare('SELECT sealed_payload FROM private_review WHERE book_id = ?').get(targetId);
  assert.ok(row?.sealed_payload);
  assert.equal(Buffer.from(row.sealed_payload).toString('utf8').includes('Consistently strong work'), false);
});

test('nothing readable is written outside the sealed payload', async (t) => {
  const { store, database } = openStore(t);
  await store.save(BOOK, { overallRating: 5, comment: 'unmistakable-secret-phrase', tags: ['private-tag'] }, { expectedRevision: ABSENT_REVISION });
  const row = database.prepare('SELECT * FROM private_review').get();
  const clear = JSON.stringify({ ...row, sealed_payload: undefined });
  assert.equal(clear.includes('unmistakable-secret-phrase'), false);
  assert.equal(clear.includes('private-tag'), false);
  assert.equal(Buffer.from(row.sealed_payload).toString('utf8').includes('unmistakable-secret-phrase'), false);
  assert.equal(row.account_key, ACCOUNT);
  assert.equal(row.book_id, BOOK);
});

test('a stale revision conflicts instead of overwriting the committed record', async (t) => {
  const { store } = openStore(t);
  const first = await store.save(BOOK, { overallRating: 3 }, { expectedRevision: ABSENT_REVISION });
  await store.save(BOOK, { overallRating: 4 }, { expectedRevision: first.revision });

  await assert.rejects(
    store.save(BOOK, { overallRating: 1 }, { expectedRevision: first.revision }),
    (error) => error.code === 'revision-conflict',
  );
  assert.equal((await store.get(BOOK)).record.overallRating, 4, 'the committed edit survives the stale write');
});

test('repeating an acknowledged save is a no-op, not a duplicate or a false edit', async (t) => {
  let ticks = 0;
  const clock = () => ['2026-09-17T12:00:00.000Z', '2026-09-17T13:00:00.000Z'][Math.min(ticks++, 1)];
  const { store } = openStore(t, { clock });
  const first = await store.save(BOOK, { overallRating: 4 }, { expectedRevision: ABSENT_REVISION });
  const repeat = await store.save(BOOK, { overallRating: 4 }, { expectedRevision: first.revision });
  assert.equal(repeat.unchanged, true);
  assert.equal(repeat.generation, first.generation);
  assert.equal(repeat.record.updatedAt, '2026-09-17T12:00:00.000Z');
  assert.equal(store.count(), 1);
});

test('clearing a dimension is an explicit edit, not a rejection', async (t) => {
  const { store } = openStore(t);
  const first = await store.save(BOOK, { overallRating: 4, storyRating: 5, comment: 'draft' }, { expectedRevision: ABSENT_REVISION });
  const cleared = await store.save(BOOK, { overallRating: 4, storyRating: null, comment: null }, { expectedRevision: first.revision });
  assert.equal(cleared.record.storyRating, null);
  assert.equal(cleared.record.comment, null);
  assert.equal(cleared.record.overallRating, 4);
  assert.equal(cleared.record.createdAt, first.record.createdAt, 'createdAt is immutable across edits');
});

test('delete leaves a content-free tombstone and blocks stale resurrection (ABA)', async (t) => {
  const { store, database } = openStore(t);
  const first = await store.save(BOOK, { overallRating: 4, comment: 'traceable-comment' }, { expectedRevision: ABSENT_REVISION });
  const deleted = await store.delete(BOOK, { expectedRevision: first.revision });
  assert.equal(deleted.deleted, true);
  assert.equal(store.count(), 0);

  const row = database.prepare('SELECT * FROM private_review WHERE book_id = ?').get(BOOK);
  assert.equal(row.sealed_payload, null, 'no residual content remains in the tombstone');
  assert.equal(row.deleted, 1);
  assert.ok(row.generation > first.generation);

  await assert.rejects(
    store.save(BOOK, { overallRating: 1 }, { expectedRevision: first.revision }),
    (error) => error.code === 'revision-conflict',
  );

  const recreated = await store.save(BOOK, { overallRating: 2 }, { expectedRevision: deleted.revision });
  assert.equal(recreated.record.overallRating, 2);
  assert.notEqual(recreated.record.createdAt, undefined);
  assert.equal(store.count(), 1);
});

test('a sealing failure rolls back and leaves the previously committed record intact', async (t) => {
  const { store, sealer, database } = openStore(t);
  const first = await store.save(BOOK, { overallRating: 4 }, { expectedRevision: ABSENT_REVISION });
  sealer.failNext = new Error('custody unavailable');
  await assert.rejects(store.save(BOOK, { overallRating: 1 }, { expectedRevision: first.revision }));
  assert.equal((await store.get(BOOK)).record.overallRating, 4);
  assert.equal(database.prepare('SELECT COUNT(*) AS n FROM private_review').get().n, 1);
});

test('records are bound to an account: another account can neither read nor collide', async (t) => {
  const first = openStore(t);
  await first.store.save(BOOK, { overallRating: 4, comment: 'mine' }, { expectedRevision: ABSENT_REVISION });

  const second = openStore(t, {
    accountKey: OTHER_ACCOUNT,
    database: first.database,
    sealer: first.sealer,
  });
  assert.equal(second.store.count(), 0);
  assert.equal((await second.store.get(BOOK)).record, null);
  await second.store.save(BOOK, { overallRating: 1 }, { expectedRevision: ABSENT_REVISION });
  assert.equal((await first.store.get(BOOK)).record.overallRating, 4, 'the other account is unaffected');
  assert.equal(first.store.inventory().otherAccountRows, 1);
});

test('a payload resealed under another book id is refused by the inner binding', async (t) => {
  const { store, database, sealer } = openStore(t);
  await store.save(BOOK, { overallRating: 4 }, { expectedRevision: ABSENT_REVISION });
  const row = database.prepare('SELECT * FROM private_review WHERE book_id = ?').get(BOOK);
  // Move an authentic payload to a different key: the outer columns look fine.
  database.prepare(
    'INSERT INTO private_review (account_key, book_id, generation, revision, deleted, sealed_payload) VALUES (?, ?, ?, ?, 0, ?)',
  ).run(ACCOUNT, 'aud-us-book-two', row.generation, 'rev-1-forged', row.sealed_payload);
  await assert.rejects(store.get('aud-us-book-two'), (error) => error.code === 'invalid-field-type');
  assert.equal(sealer.sealCalls, 1);
});

test('purge removes active records and tombstones for this account only', async (t) => {
  const first = openStore(t);
  const second = openStore(t, { accountKey: OTHER_ACCOUNT, database: first.database, sealer: first.sealer });
  const saved = await first.store.save(BOOK, { overallRating: 4 }, { expectedRevision: ABSENT_REVISION });
  await first.store.delete(BOOK, { expectedRevision: saved.revision });
  await second.store.save(BOOK, { overallRating: 2 }, { expectedRevision: ABSENT_REVISION });

  const inventory = first.store.purge();
  assert.equal(inventory.activeReviews, 0);
  assert.equal(inventory.tombstones, 0);
  assert.equal(second.store.count(), 1, 'another account keeps its records');
});

test('an invalid book id or account key is refused before any storage work', async (t) => {
  const { store } = openStore(t);
  for (const bad of ['', 'x'.repeat(65), 'has space', '../escape']) {
    await assert.rejects(store.get(bad), (error) => error.code === 'invalid-book-id');
  }
  assert.throws(
    () => new PrivateFeedbackStore({ database: null, sealer: null, accountKey: 'short' }),
    (error) => error.code === 'account-mismatch',
  );
});

test('the connector sealer refuses to operate without a custodian and never falls back to plaintext', async () => {
  const sealer = new ConnectorLocalSealer({});
  await assert.rejects(
    sealer.seal(JSON.stringify({ purpose: 'private-review' })),
    (error) => error instanceof LocalSealerError && error.code === 'local-custody-unavailable',
  );
  const bound = new ConnectorLocalSealer({
    sealLocal: async () => ({ sealedPayload: 'AAAA' }),
    unsealLocal: async () => ({ purpose: 'other' }),
  });
  await assert.rejects(
    bound.seal(JSON.stringify({ purpose: 'snapshot' })),
    (error) => error.code === 'local-payload-invalid',
  );
  await assert.rejects(bound.unseal('AAAA'), (error) => error.code === 'local-payload-invalid');
});
