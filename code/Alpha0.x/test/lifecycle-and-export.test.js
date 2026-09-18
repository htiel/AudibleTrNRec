/**
 * Ownership-anchor, rollback-envelope, export and aggregate-deletion lifecycle
 * (Alpha 0.0.2 final review fixes).
 *
 * Everything here runs against a real SQLite container in a temporary
 * directory, built entirely from synthetic material. No personal state is
 * opened, and no assertion carries a real title, ASIN, item count or account.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, existsSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { EncryptedSnapshotStore } from '../src/store/encrypted-snapshot-store.js';
import { PrivateFeedbackStore, ABSENT_REVISION } from '../src/store/feedback-store.js';
import { restoreExportDocument, EXPORT_KEYS, PROHIBITED_EXPORT_KEYS } from '../src/store/export.js';
import { PrivateAlphaService, PrivateAlphaServiceError } from '../src/sync/private-alpha-service.js';
import { EXPORT_SCHEMA_VERSION, STORAGE_SCHEMA_REVISION } from '../src/version.js';

const ACCOUNT = 'a'.repeat(64);
const OTHER_ACCOUNT = 'b'.repeat(64);
const BOOK = 'aud-us-book-synthetic';
const NOW = '2026-09-17T12:00:00.000Z';

function book(id) {
  return {
    bookId: id,
    workId: `${id}-work`,
    title: `Synthetic ${id}`,
    authorIds: [],
    narratorIds: [],
    genreIds: [],
    themeIds: [],
    language: 'en',
    available: true,
  };
}

function snapshotValue(ids = [BOOK]) {
  return {
    schemaVersion: 1,
    source: 'audible-community-private-api',
    marketplace: 'us',
    observedAt: NOW,
    catalog: { people: [], facets: [], books: ids.map(book) },
    entries: ids.map((id) => ({ bookId: id, status: 'not-started' })),
  };
}

function sealedFor(value) {
  return Buffer.concat([
    Buffer.from('ATNR-DPAPI-1\0'),
    Buffer.from(JSON.stringify(value), 'utf8'),
  ]).toString('base64');
}

/** Reversible stand-in for DPAPI: sealed bytes are never plaintext on disk. */
function fakeSealer() {
  return {
    async seal(plaintext) {
      return Buffer.from(Buffer.from(plaintext, 'utf8').map((b) => b ^ 0x5a)).toString('base64');
    },
    async unseal(sealed) {
      return Buffer.from(Buffer.from(sealed, 'base64').map((b) => b ^ 0x5a)).toString('utf8');
    },
  };
}

function connectorAs(accountKey, { syncable = false } = {}) {
  const connector = {
    calls: { status: 0, sync: 0 },
    status: async () => {
      connector.calls.status += 1;
      return { connected: accountKey !== null, accountKey, marketplace: 'us' };
    },
    syncLibrary: async () => {
      connector.calls.sync += 1;
      if (!syncable) throw new Error('no live call is permitted in this suite');
      const value = snapshotValue();
      return {
        status: { accountKey, marketplace: 'us' },
        itemCount: value.entries.length,
        completeness: { complete: true, basis: 'short-final-page' },
        snapshot: value,
        sealedSnapshot: sealedFor(value),
      };
    },
    disconnect: async () => {},
    unsealSnapshot: async (sealed) => JSON.parse(
      Buffer.from(sealed, 'base64').subarray(13).toString('utf8'),
    ),
  };
  return connector;
}

/**
 * A real store, a real feedback store and the service that joins them.
 * `connectedAs` is the account the connector currently reports.
 */
function runtime(t, { connectedAs = ACCOUNT, withSnapshot = true, ids = [BOOK], syncable = false } = {}) {
  const root = mkdtempSync(path.join(tmpdir(), 'atnr-lifecycle-'));
  const store = new EncryptedSnapshotStore({ root });
  // Windows keeps the file locked while the handle is open, and `t.after`
  // hooks run in registration order, so the handle is closed first.
  t.after(() => { try { store.close(); } catch { /* already closed */ } });
  t.after(() => rmSync(root, { recursive: true, force: true }));

  const value = snapshotValue(ids);
  if (withSnapshot) {
    store.save({
      accountKey: ACCOUNT,
      marketplace: 'us',
      itemCount: value.entries.length,
      observedAt: NOW,
      sealedSnapshot: sealedFor(value),
      completenessBasis: 'short-final-page',
      committedAt: NOW,
    });
  }

  const sealer = fakeSealer();
  const connector = connectorAs(connectedAs, { syncable });
  const service = new PrivateAlphaService({
    connector,
    snapshotStore: store,
    clock: () => NOW,
    feedbackStoreFactory: (accountKey) => new PrivateFeedbackStore({
      database: store.database,
      sealer,
      accountKey,
      clock: () => NOW,
    }),
  });
  const feedback = new PrivateFeedbackStore({
    database: store.database, sealer, accountKey: ACCOUNT, clock: () => NOW,
  });
  return { root, store, service, feedback, connector, snapshot: value };
}

test('a complete export carries the library, the feedback and the schema metadata, and no secrets', async (t) => {
  const { service, feedback } = runtime(t);
  await feedback.save(BOOK, {
    overallRating: 4.5, storyRating: 4, narrationRating: 5, comment: 'synthetic note', tags: ['Noir'],
  }, { expectedRevision: ABSENT_REVISION });

  const result = await service.exportAll();
  assert.equal(result.feedbackIncluded, true);
  assert.equal(result.libraryRetained, true);
  assert.deepEqual(Object.keys(result.document).sort(), [...EXPORT_KEYS].sort());
  assert.equal(result.document.exportSchemaVersion, EXPORT_SCHEMA_VERSION);
  assert.equal(result.document.storageSchemaRevision, STORAGE_SCHEMA_REVISION);
  assert.equal(result.document.library.entries.length, 1);
  assert.equal(result.document.feedback.length, 1);
  assert.equal(result.document.feedback[0].overallRating, 4.5);
  assert.equal(result.document.feedback[0].narrationRating, 5);

  // Secrets are excluded by construction; this re-checks the serialized form.
  const serialized = JSON.stringify(result.document);
  assert.equal(serialized.includes(ACCOUNT), false, 'no account key is exported');
  for (const forbidden of PROHIBITED_EXPORT_KEYS) {
    assert.equal(serialized.includes(`"${forbidden}"`), false, `${forbidden} must not be exported`);
  }

  const restored = restoreExportDocument(result.document);
  assert.equal(restored.snapshot.entries[0].bookId, BOOK);
  assert.equal(restored.feedback[0].bookId, BOOK);
});

test('deleting the imported library keeps the owner feedback exportable and honestly labelled', async (t) => {
  const { service, store, feedback } = runtime(t);
  await feedback.save(BOOK, { overallRating: 3 }, { expectedRevision: ABSENT_REVISION });

  const deletion = await service.deleteLocalSnapshotVerified();
  assert.equal(deletion.hasLocalSnapshot, false);
  assert.equal(deletion.deletion.snapshotDeleted, true);
  assert.equal(deletion.deletion.accountAnchorRetained, true, 'the owner anchor outlives the import');
  assert.equal(deletion.deletion.retainedReviewRows, 1);

  // The anchor, not the deleted snapshot row, now carries ownership.
  assert.equal(store.status().accountKey, ACCOUNT);
  assert.equal(store.status().hasAccountAnchor, true);
  assert.equal(store.status().hasLocalSnapshot, false);

  const result = await service.exportAll();
  assert.equal(result.libraryRetained, false);
  assert.equal(result.document.libraryRetained, false);
  assert.equal(result.document.library.entries.length, 0);
  assert.equal(result.document.feedback.length, 1);
  assert.equal(result.document.sourceLabel, 'unknown');
  assert.equal(restoreExportDocument(result.document).snapshot, null);

  // The same owner can still read, edit and delete their own feedback.
  const held = await feedback.get(BOOK);
  assert.equal(held.record.overallRating, 3);
  await feedback.delete(BOOK, { expectedRevision: held.revision });
  assert.equal((await feedback.get(BOOK)).record, null);
});

test('a different connected account is quarantined even when only the anchor remains', async (t) => {
  const { service, store, feedback } = runtime(t, { connectedAs: OTHER_ACCOUNT });
  const owner = new PrivateFeedbackStore({
    database: store.database, sealer: fakeSealer(), accountKey: ACCOUNT, clock: () => NOW,
  });
  await owner.save(BOOK, { overallRating: 5 }, { expectedRevision: ABSENT_REVISION });
  const before = store.status();

  for (const call of [
    () => service.library(),
    () => service.exportAll(),
    () => service.deletionInventory(),
    () => service.purgeAllLocalData(),
    () => service.assertFeedbackAccess(ACCOUNT),
  ]) {
    await assert.rejects(call, (error) => (
      error instanceof PrivateAlphaServiceError
      && error.code === 'account-mismatch-local-data-quarantined'
    ));
  }
  assert.throws(() => service.deleteLocalSnapshot(), /account-mismatch-local-data-quarantined/);

  // Nothing was mutated on behalf of the wrong account.
  assert.deepEqual(store.status(), before);
  assert.equal((await feedback.get(BOOK)).record.overallRating, 5);

  // The checkpoint is withheld rather than discharging another account's envelope.
  const checkpoint = await service.completeStartupCheckpoint();
  assert.equal(checkpoint.checkpoint, 'withheld');
  assert.equal(checkpoint.reason, 'account-quarantined');
  assert.equal(checkpoint.dischargedEnvelope, false);
});

test('the rollback envelope is discharged only at a verified startup checkpoint', async (t) => {
  const { service, store } = runtime(t);
  writeFileSync(store.backupPath, 'synthetic-pre-migration-envelope');
  assert.equal(store.rollbackEnvelopeRetained(), true);
  assert.equal(service.startupContract().rollbackEnvelopeRetained, true);
  assert.equal(service.startupContract().startupCheckpointComplete, false);

  const checkpoint = await service.completeStartupCheckpoint();
  assert.equal(checkpoint.checkpoint, 'complete');
  assert.equal(checkpoint.dischargedEnvelope, true);
  assert.equal(checkpoint.rollbackEnvelopeRetained, false);
  assert.equal(existsSync(store.backupPath), false);
  assert.equal(service.startupContract().startupCheckpointComplete, true);

  // A second checkpoint is honest about there being nothing left to discharge.
  const again = await service.completeStartupCheckpoint();
  assert.equal(again.dischargedEnvelope, false);
  assert.equal(again.rollbackEnvelopeRetained, false);
});

test('a disconnected session keeps the envelope rather than discharging on unconfirmed ownership', async (t) => {
  const { service, store } = runtime(t, { connectedAs: null });
  writeFileSync(store.backupPath, 'synthetic-pre-migration-envelope');
  const checkpoint = await service.completeStartupCheckpoint();
  assert.equal(checkpoint.checkpoint, 'withheld');
  assert.equal(checkpoint.reason, 'account-not-connected');
  assert.equal(checkpoint.rollbackEnvelopeRetained, true);
  assert.equal(existsSync(store.backupPath), true, 'the only pre-migration copy survives');

  // A disconnected owner may still delete their own local data, and that
  // deletion must take the retained envelope with it.
  const result = await service.purgeAllLocalData();
  assert.equal(result.rollbackEnvelopeRemoved, true);
  assert.equal(result.complete, true);
  assert.equal(existsSync(store.backupPath), false);
});

test('the deletion inventory reports the retained envelope as residue', async (t) => {
  const { service, store, feedback } = runtime(t);
  await feedback.save(BOOK, { overallRating: 2 }, { expectedRevision: ABSENT_REVISION });
  writeFileSync(store.backupPath, 'synthetic-pre-migration-envelope');

  const inventory = await service.deletionInventory();
  const item = (id) => inventory.items.find((entry) => entry.id === id);
  assert.equal(item('encrypted-snapshot').retained, true);
  assert.equal(item('private-reviews').retained, true);
  assert.equal(item('account-anchor').retained, true);
  assert.equal(item('rollback-envelope').retained, true);
  assert.equal(inventory.localDataRemoved, false);
  assert.ok(inventory.residualItemIds.includes('rollback-envelope'));
  assert.ok(inventory.limitations.some((text) => text.includes('VACUUM')));
});

test('a confirmed complete deletion removes every class, including the rollback envelope', async (t) => {
  const { service, store, feedback } = runtime(t);
  await feedback.save(BOOK, { overallRating: 4, comment: 'synthetic' }, { expectedRevision: ABSENT_REVISION });
  const held = await feedback.get(BOOK);
  await feedback.delete(BOOK, { expectedRevision: held.revision });
  writeFileSync(store.backupPath, 'synthetic-pre-migration-envelope');

  const result = await service.purgeAllLocalData();
  assert.equal(result.snapshotDeleted, true);
  assert.equal(result.reviewsDeleted, true);
  assert.equal(result.accountAnchorRemoved, true);
  assert.equal(result.retainedReviewRows, 0, 'tombstones are erased too');
  assert.equal(result.rollbackEnvelopeRemoved, true);
  assert.equal(result.rollbackEnvelopeRetained, false);
  assert.equal(result.complete, true);
  assert.equal(result.inventory.localDataRemoved, true);
  assert.deepEqual(result.inventory.residualItemIds, []);
  assert.equal(existsSync(store.backupPath), false, 'no envelope residue survives');

  // Re-read from the container rather than trusting the returned claim.
  assert.equal(store.status().hasLocalSnapshot, false);
  assert.equal(store.status().hasAccountAnchor, false);
  assert.equal(store.accountAnchor(), null);
  assert.equal(
    store.database.prepare('SELECT COUNT(*) AS n FROM private_review').get().n, 0,
  );
  // Deletion is honest about its limits: no erasure claim is made anywhere.
  assert.ok(result.inventory.limitations.some((text) => text.includes('not cryptographic erasure')));
  assert.equal(result.contentPurgeComplete, true);
});

test('a purge does not claim to have erased connector-owned artifacts', async (t) => {
  const { service, connector } = runtime(t);
  connector.localArtifactInventory = async () => ({
    credentialsRetained: true,
    identitySeedRetained: true,
    protector: 'windows-dpapi',
    removedBy: 'confirmed-disconnect-only',
  });

  const result = await service.purgeAllLocalData();
  assert.equal(result.connectorArtifactsErased, false);
  assert.equal(result.connectorArtifacts.credentialsRetained, true);
  assert.equal(result.connectorArtifacts.identitySeedRetained, true);
  assert.equal(result.connectorArtifacts.source, 'connector');
  const item = (id) => result.inventory.items.find((entry) => entry.id === id);
  assert.equal(item('provider-credentials').retained, true, 'a retained credential is not reported as gone');
  assert.equal(item('identity-seed').retained, true);
  assert.deepEqual(result.inventory.residualConnectorItemIds, ['identity-seed', 'provider-credentials']);
  // Local content is gone and the connector residue is disclosed: that, and
  // only that, is what completion means.
  assert.equal(result.contentPurgeComplete, true);
  assert.equal(result.inventory.connectorArtifactsDisclosed, true);
  assert.equal(result.complete, true);
});

test('an unreachable connector is reported as unknown, never as removed', async (t) => {
  const { service, connector } = runtime(t);
  connector.localArtifactInventory = async () => { throw new Error('connector unavailable'); };
  const result = await service.purgeAllLocalData();
  assert.equal(result.connectorArtifacts.source, 'unreadable');
  assert.equal(result.connectorArtifacts.credentialsRetained, 'unknown');
  const item = (id) => result.inventory.items.find((entry) => entry.id === id);
  assert.equal(item('provider-credentials').retained, 'unknown');
  assert.equal(item('identity-seed').retained, 'unknown');
  assert.equal(result.contentPurgeComplete, true, 'local content is still verifiably gone');
});

test('a purged installation cannot be silently repopulated by an automatic sync', async (t) => {
  const { service, store, connector } = runtime(t, { syncable: true });
  const result = await service.purgeAllLocalData();
  assert.equal(result.automaticSyncSuppressed, true);
  assert.equal(result.resumeRequires, 'explicit-owner-sync-or-reconnect');
  assert.equal(store.localDataSuppressed(), true);

  const callsBefore = { ...connector.calls };
  await assert.rejects(
    () => service.sync({ trigger: 'automatic' }),
    (error) => error instanceof PrivateAlphaServiceError && error.code === 'local-data-suppressed',
  );
  // Refused before anything is recorded and before the connector is contacted.
  assert.deepEqual(connector.calls, callsBefore);
  assert.equal(store.status().hasLocalSnapshot, false);
  assert.equal(store.status().lastAttemptAt, null);
  assert.equal(service.startupContract().localDataSuppressed, true);
});

test('the suppression survives a restart, so the next startup does not restore it either', async (t) => {
  const { service, store, root } = runtime(t, { syncable: true });
  await service.purgeAllLocalData();
  store.close();

  // A new process on the same custody root: the marker, not session memory,
  // is what carries the decision forward.
  const reopened = new EncryptedSnapshotStore({ root });
  t.after(() => { try { reopened.close(); } catch { /* already closed */ } });
  assert.equal(reopened.localDataSuppressed(), true);
  assert.equal(reopened.status().localDataSuppressed, true);

  const connector = connectorAs(ACCOUNT, { syncable: true });
  const restarted = new PrivateAlphaService({
    connector, snapshotStore: reopened, clock: () => NOW,
  });
  assert.equal(restarted.startupContract().localDataSuppressed, true);
  await assert.rejects(
    () => restarted.sync({ trigger: 'automatic' }),
    (error) => error.code === 'local-data-suppressed',
  );
  assert.equal(reopened.status().hasLocalSnapshot, false);
  // Closed here, not in a hook: the workspace cleanup hook was registered
  // first and Windows will not remove a directory with an open handle in it.
  reopened.close();
});

test('the scheduler does not even contact the connector while a deletion is suppressed', async (t) => {
  const { service, connector } = runtime(t, { syncable: true });
  await service.purgeAllLocalData();
  const callsBefore = { ...connector.calls };

  service.startScheduler(0.001);
  t.after(() => service.stopScheduler());
  await new Promise((resolve) => { setTimeout(resolve, 150); });

  assert.deepEqual(connector.calls, callsBefore, 'no status poll and no sync while suppressed');
  assert.equal(service.snapshotStore.status().hasLocalSnapshot, false);
});

test('an explicit owner sync is the one thing that resumes, and it says so', async (t) => {
  const { service, store, connector } = runtime(t, { syncable: true });
  await service.purgeAllLocalData();
  assert.equal(store.localDataSuppressed(), true);

  // The default trigger is the explicit owner action: the manual route.
  const synced = await service.sync();
  assert.equal(synced.itemCount, 1);
  assert.equal(connector.calls.sync, 1);
  assert.equal(store.localDataSuppressed(), false, 'the suppression is cleared by the owner, not by a timer');
  assert.equal(store.status().hasLocalSnapshot, true);

  // And the scheduler is free to run again afterwards.
  await service.sync({ trigger: 'automatic' });
  assert.equal(connector.calls.sync, 2);
});

test('a quarantined session cannot clear another account suppression', async (t) => {
  const { service, store } = runtime(t, { connectedAs: OTHER_ACCOUNT });
  store.recordLocalDataSuppression(NOW);
  await assert.rejects(
    () => service.sync(),
    (error) => error.code === 'account-mismatch-local-data-quarantined',
  );
  assert.equal(store.localDataSuppressed(), true, 'the refusal is not a resume');
});

test('the anchor refuses to be repointed at another account', async (t) => {
  const { store } = runtime(t);
  assert.equal(store.accountAnchor().accountKey, ACCOUNT);
  assert.throws(
    () => store.recordAccountAnchor({ accountKey: OTHER_ACCOUNT, marketplace: 'us', at: NOW }),
    /different-account-local-data-exists/,
  );
  assert.equal(store.accountAnchor().accountKey, ACCOUNT);
});

test('an installation with no feedback factory reports that honestly instead of omitting silently', async (t) => {
  const { store } = runtime(t, { withSnapshot: true });
  const service = new PrivateAlphaService({
    connector: connectorAs(ACCOUNT),
    snapshotStore: store,
    clock: () => NOW,
  });
  const result = await service.exportAll();
  assert.equal(result.feedbackIncluded, false);
  assert.equal(result.document.feedback.length, 0);
  assert.equal(result.libraryRetained, true);
});
