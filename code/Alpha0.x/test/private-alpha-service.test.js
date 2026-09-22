import test from 'node:test';
import assert from 'node:assert/strict';

import { PrivateAlphaService, PrivateAlphaServiceError, CONNECTION_STATES } from '../src/sync/private-alpha-service.js';
import { CONNECTION_STATES as UI_CONNECTION_STATES } from '../ui/js/bootstrap-state.js';

const ACCOUNT = 'a'.repeat(64);
const OTHER_ACCOUNT = 'b'.repeat(64);

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

function snapshot({ ids = ['aud-us-book-synthetic'], observedAt = '2026-09-17T12:00:00.000Z' } = {}) {
  return {
    schemaVersion: 1,
    source: 'audible-community-private-api',
    marketplace: 'us',
    observedAt,
    catalog: { people: [], facets: [], books: ids.map(book) },
    entries: ids.map((id) => ({ bookId: id, status: 'not-started' })),
  };
}

function sealedFor(snapshotValue) {
  return Buffer.concat([
    Buffer.from('ATNR-DPAPI-1\0'),
    Buffer.from(JSON.stringify(snapshotValue), 'utf8'),
  ]).toString('base64');
}

/** In-memory stand-in with the same authority rules as the SQLite store. */
function fakeStore() {
  const state = {
    snapshot: null,
    lastAttemptAt: null,
    lastSuccessAt: null,
    lastErrorCode: null,
    generation: 0,
    failures: [],
  };
  return {
    state,
    status: () => ({
      hasLocalSnapshot: Boolean(state.snapshot),
      accountKey: state.snapshot?.accountKey ?? null,
      marketplace: state.snapshot?.marketplace ?? null,
      itemCount: state.snapshot?.itemCount ?? 0,
      observedAt: state.snapshot?.observedAt ?? null,
      snapshotGeneration: state.generation,
      lastAttemptAt: state.lastAttemptAt,
      lastSuccessAt: state.lastSuccessAt,
      lastErrorCode: state.lastErrorCode,
    }),
    recordAttempt: (at) => { state.lastAttemptAt = at; },
    save: (value) => {
      if (state.snapshot && state.snapshot.accountKey !== value.accountKey) {
        throw new Error('account isolation must be enforced before save');
      }
      state.generation += 1;
      state.snapshot = { ...value };
      state.lastSuccessAt = value.committedAt;
      state.lastErrorCode = null;
      return state.generation;
    },
    recordFailure: (code, at) => {
      state.failures.push(code);
      state.lastErrorCode = code;
      state.lastAttemptAt = at ?? state.lastAttemptAt;
    },
    encryptedSnapshot: () => state.snapshot?.sealedSnapshot ?? null,
    deleteLocalSnapshot: () => { state.snapshot = null; },
    close: () => {},
  };
}

function fakeConnector(overrides = {}) {
  const candidate = overrides.snapshot ?? snapshot();
  return {
    calls: { sync: 0, disconnect: 0, seal: 0 },
    status: async () => ({ connected: true, accountKey: ACCOUNT, marketplace: 'us' }),
    syncLibrary: async function syncLibrary() {
      this.calls.sync += 1;
      return {
        status: { accountKey: overrides.accountKey ?? ACCOUNT, marketplace: 'us' },
        itemCount: candidate.entries.length,
        completeness: overrides.completeness ?? { complete: true, basis: 'short-final-page' },
        snapshot: candidate,
        sealedSnapshot: sealedFor(candidate),
      };
    },
    disconnect: async function disconnect() { this.calls.disconnect += 1; },
    unsealSnapshot: async (sealed) => JSON.parse(
      Buffer.from(sealed, 'base64').subarray(13).toString('utf8'),
    ),
    ...overrides.connector,
  };
}

function clockFrom(values) {
  let i = 0;
  return () => values[Math.min(i++, values.length - 1)];
}

test('sync validates before atomically saving and disconnect is explicit', async () => {
  const connector = fakeConnector();
  const store = fakeStore();
  const service = new PrivateAlphaService({ connector, snapshotStore: store });

  const result = await service.sync();
  assert.equal(result.itemCount, 1);
  assert.equal(store.state.snapshot.itemCount, 1);
  assert.equal(connector.calls.disconnect, 0, 'normal sync must not deregister the persistent device');
  await service.disconnect();
  assert.equal(connector.calls.disconnect, 1, 'only explicit disconnect deregisters');
});

test('concurrent refresh requests share one connector sync', async () => {
  let release;
  const wait = new Promise((resolve) => { release = resolve; });
  const base = fakeConnector();
  const connector = {
    ...base,
    calls: base.calls,
    syncLibrary: async () => {
      base.calls.sync += 1;
      await wait;
      const candidate = snapshot();
      return {
        status: { accountKey: ACCOUNT, marketplace: 'us' },
        itemCount: 1,
        completeness: { complete: true, basis: 'short-final-page' },
        snapshot: candidate,
        sealedSnapshot: sealedFor(candidate),
      };
    },
  };
  const service = new PrivateAlphaService({ connector, snapshotStore: fakeStore() });
  const first = service.sync();
  const second = service.sync();
  release();
  await Promise.all([first, second]);
  assert.equal(base.calls.sync, 1);
});

test('the attempt is recorded before the connector starts and failure never becomes a success', async () => {
  const store = fakeStore();
  const connector = fakeConnector();
  connector.syncLibrary = async () => { throw new Error('provider unreachable'); };
  const service = new PrivateAlphaService({
    connector,
    snapshotStore: store,
    clock: clockFrom(['2026-09-17T12:00:05.000Z']),
  });

  await assert.rejects(service.sync(), (error) => error instanceof PrivateAlphaServiceError);
  assert.equal(store.state.lastAttemptAt, '2026-09-17T12:00:05.000Z');
  assert.equal(store.state.lastSuccessAt, null, 'a failed first sync has no success time');
  assert.equal(store.state.snapshot, null, 'nothing is promoted on failure');
});

test('last success is the durable commit time, not the source observation time', async () => {
  const store = fakeStore();
  const service = new PrivateAlphaService({
    connector: fakeConnector(),
    snapshotStore: store,
    clock: clockFrom(['2026-09-17T12:00:05.000Z', '2026-09-17T12:00:09.000Z']),
  });
  await service.sync();
  assert.equal(store.state.snapshot.observedAt, '2026-09-17T12:00:00.000Z');
  assert.equal(store.state.lastSuccessAt, '2026-09-17T12:00:09.000Z');
  assert.notEqual(store.state.lastSuccessAt, store.state.snapshot.observedAt);
});

test('a snapshot from a different account is refused and the stored snapshot survives', async () => {
  const store = fakeStore();
  const first = new PrivateAlphaService({ connector: fakeConnector(), snapshotStore: store });
  await first.sync();
  const generationBefore = store.state.generation;

  const intruder = new PrivateAlphaService({
    connector: fakeConnector({ accountKey: OTHER_ACCOUNT }),
    snapshotStore: store,
  });
  await assert.rejects(intruder.sync(), (error) => error.code === 'different-account-local-data-exists');
  assert.equal(store.state.generation, generationBefore);
  assert.equal(store.state.snapshot.accountKey, ACCOUNT);
});

test('an incomplete capture is never promoted', async () => {
  const store = fakeStore();
  const service = new PrivateAlphaService({
    connector: fakeConnector({ completeness: { complete: false, basis: null, stopReason: 'library-page-limit' } }),
    snapshotStore: store,
  });
  await assert.rejects(service.sync(), (error) => error.code === 'library-capture-incomplete');
  assert.equal(store.state.snapshot, null);
  assert.deepEqual(store.state.failures, ['library-capture-incomplete']);
});

test('a count mismatch between evidence and entries stops the transaction', async () => {
  const store = fakeStore();
  const connector = fakeConnector();
  const original = connector.syncLibrary.bind(connector);
  connector.syncLibrary = async () => ({ ...(await original()), itemCount: 7 });
  const service = new PrivateAlphaService({ connector, snapshotStore: store });
  await assert.rejects(service.sync(), (error) => error.code === 'library-count-mismatch');
  assert.equal(store.state.snapshot, null);
});

test('a book removed at the source is retained and flagged, then cleared on reappearance', async () => {
  const store = fakeStore();
  const sealCalls = [];
  const withSeal = (candidate) => {
    const connector = fakeConnector({ snapshot: candidate });
    connector.sealSnapshot = async (value) => {
      sealCalls.push(value);
      return { sealedSnapshot: sealedFor(value) };
    };
    return connector;
  };

  const both = ['aud-us-book-one', 'aud-us-book-two'];
  await new PrivateAlphaService({
    connector: withSeal(snapshot({ ids: both })),
    snapshotStore: store,
  }).sync();
  assert.equal(store.state.snapshot.itemCount, 2);

  const removed = await new PrivateAlphaService({
    connector: withSeal(snapshot({ ids: ['aud-us-book-one'], observedAt: '2026-09-18T12:00:00.000Z' })),
    snapshotStore: store,
  }).sync();
  assert.equal(removed.reconciliation.missingFromSource, 1);
  assert.equal(store.state.snapshot.itemCount, 2, 'the removed book is retained, not deleted');
  const retained = sealCalls.at(-1).entries.find((e) => e.bookId === 'aud-us-book-two');
  assert.equal(retained.missingFromSource, true);
  assert.equal(retained.lastSeenAt, '2026-09-17T12:00:00.000Z', 'lastSeenAt freezes at the last listing');
  assert.ok(sealCalls.at(-1).catalog.books.some((b) => b.bookId === 'aud-us-book-two'), 'catalog stays whole');

  const back = await new PrivateAlphaService({
    connector: withSeal(snapshot({ ids: both, observedAt: '2026-09-19T12:00:00.000Z' })),
    snapshotStore: store,
  }).sync();
  assert.equal(back.reconciliation.reappeared, 1);
  assert.equal(sealCalls.at(-1).entries.every((e) => e.missingFromSource === false), true);
});

test('without a custodian able to seal the reconciled result, a delta stops instead of storing a lie', async () => {
  const store = fakeStore();
  await new PrivateAlphaService({
    connector: fakeConnector({ snapshot: snapshot({ ids: ['aud-us-book-one', 'aud-us-book-two'] }) }),
    snapshotStore: store,
  }).sync();
  const before = store.state.snapshot;

  const service = new PrivateAlphaService({
    connector: fakeConnector({ snapshot: snapshot({ ids: ['aud-us-book-one'], observedAt: '2026-09-18T12:00:00.000Z' }) }),
    snapshotStore: store,
  });
  await assert.rejects(service.sync(), (error) => error.code === 'reconciled-seal-unavailable');
  assert.equal(store.state.snapshot, before, 'the last complete snapshot is preserved');
});

test('an invalid snapshot is rejected before any write', async () => {
  const store = fakeStore();
  const broken = snapshot();
  broken.entries = [{ bookId: 'aud-us-book-unlisted', status: 'not-started' }];
  const service = new PrivateAlphaService({
    connector: fakeConnector({ snapshot: broken }),
    snapshotStore: store,
  });
  await assert.rejects(service.sync(), (error) => error.code.startsWith('snapshot-'));
  assert.equal(store.state.snapshot, null);
});


/* ---- Alpha 0.0.2 runtime data requirement -------------------------------- */

test('the service refuses to exist on any source other than the real encrypted state', () => {
  for (const dataSource of ['synthetic-fixture', 'demo', '', null]) {
    assert.throws(
      () => new PrivateAlphaService({
        connector: fakeConnector(),
        snapshotStore: fakeStore(),
        dataSource,
      }),
      (error) => error instanceof PrivateAlphaServiceError
        && error.code === 'runtime-data-source-refused',
    );
  }
  const service = new PrivateAlphaService({ connector: fakeConnector(), snapshotStore: fakeStore() });
  assert.equal(service.dataSource, 'local-encrypted');
});

test('the startup contract is redacted: closed enums and booleans only', async () => {
  const store = fakeStore();
  const service = new PrivateAlphaService({ connector: fakeConnector(), snapshotStore: store });
  store.migration = { outcome: 'migrated' };

  const before = service.startupContract();
  assert.equal(before.dataSource, 'local-encrypted');
  assert.equal(before.synthetic, false);
  assert.equal(before.syntheticFallback, 'prohibited');
  assert.equal(before.hasLocalSnapshot, false);
  assert.equal(before.hasCompletedSync, false);

  await service.sync();
  const after = service.startupContract();
  assert.equal(after.hasLocalSnapshot, true);
  assert.equal(after.hasCompletedSync, true);
  assert.equal(after.migrationOutcome, 'migrated');

  const serialized = JSON.stringify(after);
  assert.ok(!serialized.includes(ACCOUNT), 'no account key in startup evidence');
  assert.ok(!/\d{4}-\d{2}-\d{2}T/.test(serialized), 'no timestamp in startup evidence');
  assert.ok(!/"[a-zA-Z]+":\s*[1-9]\d*/.test(serialized), 'no count in startup evidence');
  assert.ok(!serialized.toLowerCase().includes('synthetic '), 'no title in startup evidence');
});

test('a fixture-shaped snapshot is refused rather than served as a library', async () => {
  const store = fakeStore();
  const connector = fakeConnector();
  const service = new PrivateAlphaService({ connector, snapshotStore: store });
  await service.sync();

  // Someone replaces the sealed body with demo material of the correct shape.
  const demo = { ...snapshot(), source: 'synthetic-fixture' };
  store.state.snapshot.sealedSnapshot = sealedFor(demo);

  await assert.rejects(
    service.library(),
    (error) => error instanceof PrivateAlphaServiceError
      && error.code === 'snapshot-invalid-field-value',
  );
});

test('an empty real container reports nothing rather than substituting a library', async () => {
  const service = new PrivateAlphaService({ connector: fakeConnector(), snapshotStore: fakeStore() });
  assert.equal(await service.library(), null);
  assert.equal(service.startupContract().hasLocalSnapshot, false);
});


/* ---- Account join: credentials for B must never open A's library --------- */

function storedFor(store, accountKey) {
  const candidate = snapshot();
  store.state.snapshot = {
    accountKey,
    marketplace: 'us',
    itemCount: candidate.entries.length,
    observedAt: candidate.observedAt,
    sealedSnapshot: sealedFor(candidate),
  };
  store.state.generation = 1;
  store.state.lastSuccessAt = '2026-09-17T12:00:01.000Z';
}

function connectorAs(accountKey, overrides = {}) {
  const base = fakeConnector();
  return {
    ...base,
    status: async () => ({ connected: true, accountKey, marketplace: 'us' }),
    ...overrides,
  };
}

test('status withholds the stored library when the connected account differs', async () => {
  const store = fakeStore();
  storedFor(store, ACCOUNT);
  const service = new PrivateAlphaService({ connector: connectorAs(OTHER_ACCOUNT), snapshotStore: store });

  const status = await service.status();
  assert.equal(status.local.quarantined, true);
  assert.equal(status.local.accountMismatch, true);
  assert.equal(status.local.accountKey, null);
  assert.equal(status.local.itemCount, 0);
  assert.equal(status.local.observedAt, null);
  assert.equal(status.local.lastSuccessAt, null);
  assert.equal(status.local.lastErrorCode, 'account-mismatch-local-data-quarantined');
  // Quarantine is a refusal, not a write: the stored snapshot is untouched.
  assert.equal(store.state.snapshot.accountKey, ACCOUNT);
  assert.equal(store.state.generation, 1);
  assert.deepEqual(store.state.failures, []);
  assert.ok(!JSON.stringify(status.local).includes(ACCOUNT), 'no raw stored account key is exposed');
});

test('library refuses a mismatched account without unsealing anything', async () => {
  const store = fakeStore();
  storedFor(store, ACCOUNT);
  let unsealed = 0;
  const connector = connectorAs(OTHER_ACCOUNT, {
    unsealSnapshot: async () => { unsealed += 1; return snapshot(); },
  });
  const service = new PrivateAlphaService({ connector, snapshotStore: store });

  await assert.rejects(
    service.library(),
    (error) => error instanceof PrivateAlphaServiceError
      && error.code === 'account-mismatch-local-data-quarantined',
  );
  assert.equal(unsealed, 0, 'the sealed body must never be opened for another account');
  assert.equal(store.state.snapshot.accountKey, ACCOUNT);
});

test('feedback access is refused for a mismatched or foreign account key', async () => {
  const store = fakeStore();
  storedFor(store, ACCOUNT);
  const mismatched = new PrivateAlphaService({ connector: connectorAs(OTHER_ACCOUNT), snapshotStore: store });
  await assert.rejects(
    mismatched.assertFeedbackAccess(ACCOUNT),
    (error) => error.code === 'account-mismatch-local-data-quarantined',
  );

  const matched = new PrivateAlphaService({ connector: connectorAs(ACCOUNT), snapshotStore: store });
  await assert.rejects(
    matched.assertFeedbackAccess(OTHER_ACCOUNT),
    (error) => error.code === 'account-mismatch-local-data-quarantined',
  );
  const join = await matched.assertFeedbackAccess(ACCOUNT);
  assert.equal(join.matched, true);
});

test('the startup join check quarantines before any read is served', async () => {
  const store = fakeStore();
  storedFor(store, ACCOUNT);
  const service = new PrivateAlphaService({ connector: connectorAs(OTHER_ACCOUNT), snapshotStore: store });

  const contract = await service.startupJoinCheck();
  assert.equal(contract.accountJoin, 'mismatch');
  assert.equal(contract.quarantined, true);
  assert.equal(contract.hasCompletedSync, false);
  const serialized = JSON.stringify(contract);
  assert.ok(!serialized.includes(ACCOUNT) && !serialized.includes(OTHER_ACCOUNT), 'no raw account keys');
});

test('matching, absent and disconnected accounts are not quarantined', async () => {
  const store = fakeStore();
  storedFor(store, ACCOUNT);
  const matched = new PrivateAlphaService({ connector: connectorAs(ACCOUNT), snapshotStore: store });
  assert.equal((await matched.status()).local.itemCount, 1);
  assert.equal((await matched.startupJoinCheck()).accountJoin, 'matched');
  assert.ok(await matched.library());

  const disconnected = new PrivateAlphaService({
    connector: connectorAs(ACCOUNT, { status: async () => ({ connected: false, accountKey: null }) }),
    snapshotStore: store,
  });
  const contract = await disconnected.startupJoinCheck();
  assert.equal(contract.accountJoin, 'not-connected');
  assert.equal(contract.quarantined, false);
  assert.ok(await disconnected.library(), 'an explicit disconnect must not look like data loss');

  const empty = new PrivateAlphaService({ connector: connectorAs(ACCOUNT), snapshotStore: fakeStore() });
  assert.equal((await empty.startupJoinCheck()).accountJoin, 'no-local-data');
});

test('an unreachable connector is unverified, not a mismatch, and still refuses reads', async () => {
  const store = fakeStore();
  storedFor(store, ACCOUNT);
  const service = new PrivateAlphaService({
    connector: connectorAs(ACCOUNT, { status: async () => { throw new Error('connector-unavailable'); } }),
    snapshotStore: store,
  });
  const contract = await service.startupJoinCheck();
  assert.equal(contract.accountJoin, 'unverified');
  assert.equal(contract.quarantined, false);
  await assert.rejects(service.library());
  assert.equal(store.state.snapshot.accountKey, ACCOUNT, 'no mutation on an unverifiable join');
});


test('a quarantined session cannot sync: no attempt is recorded and no library is fetched', async () => {
  const store = fakeStore();
  storedFor(store, ACCOUNT);
  let syncCalls = 0;
  const connector = connectorAs(OTHER_ACCOUNT, {
    syncLibrary: async () => { syncCalls += 1; throw new Error('must not be reached'); },
  });
  const service = new PrivateAlphaService({ connector, snapshotStore: store });

  await assert.rejects(
    service.sync(),
    (error) => error instanceof PrivateAlphaServiceError
      && error.code === 'account-mismatch-local-data-quarantined',
  );
  assert.equal(syncCalls, 0, 'the connector must not be asked for another account library');
  assert.equal(store.state.lastAttemptAt, null, 'no attempt may be recorded against stored data');
  assert.deepEqual(store.state.failures, [], 'no failure diagnostic may be written either');
  assert.equal(store.state.snapshot.accountKey, ACCOUNT);
  assert.equal(store.state.generation, 1);
});

test('a quarantined session cannot delete the other account local data', async () => {
  const store = fakeStore();
  storedFor(store, ACCOUNT);
  const service = new PrivateAlphaService({ connector: connectorAs(OTHER_ACCOUNT), snapshotStore: store });

  await assert.rejects(
    service.deleteLocalSnapshotVerified(),
    (error) => error instanceof PrivateAlphaServiceError
      && error.code === 'account-mismatch-local-data-quarantined',
  );
  // The synchronous form the local API uses refuses on the cached verdict too.
  await service.status();
  assert.throws(
    () => service.deleteLocalSnapshot(),
    (error) => error.code === 'account-mismatch-local-data-quarantined',
  );
  assert.ok(store.state.snapshot, 'the stored snapshot must survive a mismatched delete');
  assert.equal(store.state.snapshot.accountKey, ACCOUNT);
  assert.equal(store.state.generation, 1);
});

test('the synchronous delete refuses an unresolved or stale account join', async () => {
  const store = fakeStore();
  storedFor(store, ACCOUNT);
  const clock = clockFrom([
    '2026-09-17T12:00:00.000Z', // join resolved
    '2026-09-17T12:10:00.000Z', // ten minutes later
  ]);
  const service = new PrivateAlphaService({
    connector: connectorAs(ACCOUNT), snapshotStore: store, clock,
  });

  assert.throws(
    () => service.deleteLocalSnapshot(),
    (error) => error.code === 'account-join-stale',
    'an unresolved join must not authorize a destructive action',
  );
  await service.status();
  assert.throws(
    () => service.deleteLocalSnapshot(),
    (error) => error.code === 'account-join-stale',
  );
  assert.ok(store.state.snapshot, 'nothing is deleted on a stale join');
});

test('the owner may still delete local data while disconnected', async () => {
  const store = fakeStore();
  storedFor(store, ACCOUNT);
  const service = new PrivateAlphaService({
    connector: connectorAs(ACCOUNT, { status: async () => ({ connected: false, accountKey: null }) }),
    snapshotStore: store,
  });

  const status = await service.deleteLocalSnapshotVerified();
  assert.equal(status.hasLocalSnapshot, false);
  assert.equal(store.state.snapshot, null);
});

test('a matching connected account may sync and delete as before', async () => {
  const store = fakeStore();
  storedFor(store, ACCOUNT);
  const service = new PrivateAlphaService({ connector: connectorAs(ACCOUNT), snapshotStore: store });

  const result = await service.sync();
  assert.equal(result.ok, true);
  assert.equal(typeof store.state.lastAttemptAt, 'string');
  // A fresh join from the sync above backs the synchronous local-API form.
  const status = service.deleteLocalSnapshot();
  assert.equal(status.hasLocalSnapshot, false);
});

test('the runtime copies the connector connection state and never infers one', async () => {
  const connector = fakeConnector();
  connector.status = async () => ({
    connected: true,
    accountKey: ACCOUNT,
    marketplace: 'us',
    connectionState: 'verified',
    lastVerifiedAt: '2026-09-17T12:00:00.000Z',
  });
  const service = new PrivateAlphaService({ connector, snapshotStore: fakeStore() });

  // Before any status read, nothing has been proven.
  assert.equal(service.startupContract().connectionState, 'unverified');
  assert.equal(service.lastVerifiedAt, null);

  await service.status();
  assert.equal(service.startupContract().connectionState, 'verified');
  assert.equal(service.lastVerifiedAt, '2026-09-17T12:00:00.000Z');
});

test('a held credential with no connector verdict is reported as unverified, never connected', async () => {
  const connector = fakeConnector();
  // The connector reports custody only: an envelope exists.
  connector.status = async () => ({ connected: true, accountKey: ACCOUNT, marketplace: 'us' });
  const service = new PrivateAlphaService({ connector, snapshotStore: fakeStore() });
  await service.status();
  assert.equal(service.startupContract().connectionState, 'unverified');
});

test('an unrecognized connection state claim is not believed', async () => {
  for (const claim of ['healthy', 'CONNECTED', '', 3, null, {}]) {
    const connector = fakeConnector();
    connector.status = async () => ({ connected: true, accountKey: ACCOUNT, marketplace: 'us', connectionState: claim });
    const service = new PrivateAlphaService({ connector, snapshotStore: fakeStore() });
    await service.status();
    assert.equal(service.startupContract().connectionState, 'unverified', JSON.stringify(claim));
  }
});

test('a reported authorization failure is carried into startup evidence', async () => {
  const connector = fakeConnector();
  connector.status = async () => ({
    connected: true, accountKey: ACCOUNT, marketplace: 'us', connectionState: 'authorization-failed',
  });
  const service = new PrivateAlphaService({ connector, snapshotStore: fakeStore() });
  await service.status();
  const contract = service.startupContract();
  assert.equal(contract.connectionState, 'authorization-failed');
  // Startup evidence stays redacted: closed enums and booleans only.
  assert.equal(CONNECTION_STATES.includes(contract.connectionState), true);
  assert.equal(Object.values(contract).some((v) => typeof v === 'string' && v.includes(ACCOUNT)), false);
});

test('the connection-state vocabulary is identical on both sides of the UI boundary', () => {
  assert.deepEqual([...CONNECTION_STATES], [...UI_CONNECTION_STATES]);
  assert.deepEqual([...CONNECTION_STATES], ['disconnected', 'unverified', 'verified', 'authorization-failed']);
});

test('a sync that the provider refuses leaves the cached state authorization-failed', async () => {
  const connector = fakeConnector();
  let refused = false;
  connector.status = async () => ({
    connected: true,
    accountKey: ACCOUNT,
    marketplace: 'us',
    connectionState: refused ? 'authorization-failed' : 'verified',
    lastVerifiedAt: '2026-09-17T12:00:00.000Z',
    lastAuthorizationFailureAt: refused ? '2026-09-18T09:00:00.000Z' : null,
  });
  connector.syncLibrary = async () => {
    refused = true;
    // The connector records the refusal locally and reports the generic,
    // allow-listed code; nothing distinguishes it here.
    const error = new PrivateAlphaServiceError('library-sync-failed');
    throw error;
  };
  const store = fakeStore();
  const service = new PrivateAlphaService({ connector, snapshotStore: store });

  await service.status();
  assert.equal(service.connectionEvidence().connectionState, 'verified');

  let thrown = null;
  try {
    await service.sync();
  } catch (error) {
    thrown = error;
  }
  assert.ok(thrown instanceof PrivateAlphaServiceError);
  assert.equal(thrown.code, 'library-sync-failed', 'the public error code is unchanged');
  assert.equal(store.state.lastErrorCode, 'library-sync-failed');
  // The evidence recorded during that same requested sync is read back, so
  // the runtime does not keep reporting a connection that no longer works.
  assert.equal(thrown.connectionState, 'authorization-failed');
  assert.equal(service.connectionEvidence().connectionState, 'authorization-failed');
  assert.equal(service.startupContract().connectionState, 'authorization-failed');
});

test('a transient sync failure does not become an authorization failure', async () => {
  const connector = fakeConnector();
  connector.status = async () => ({
    connected: true, accountKey: ACCOUNT, marketplace: 'us',
    connectionState: 'verified', lastVerifiedAt: '2026-09-17T12:00:00.000Z',
  });
  connector.syncLibrary = async () => { throw new Error('provider unreachable'); };
  const service = new PrivateAlphaService({ connector, snapshotStore: fakeStore() });

  await assert.rejects(() => service.sync());
  assert.equal(service.connectionEvidence().connectionState, 'verified');
});

test('a connector that cannot be asked after a failure never changes the failure', async () => {
  const connector = fakeConnector();
  let statusCalls = 0;
  connector.status = async () => {
    statusCalls += 1;
    if (statusCalls > 1) throw new Error('connector gone');
    return { connected: true, accountKey: ACCOUNT, marketplace: 'us', connectionState: 'verified', lastVerifiedAt: '2026-09-17T12:00:00.000Z' };
  };
  connector.syncLibrary = async () => { throw new PrivateAlphaServiceError('library-sync-failed'); };
  const service = new PrivateAlphaService({ connector, snapshotStore: fakeStore() });

  await service.status();
  await assert.rejects(() => service.sync(), (error) => error.code === 'library-sync-failed');
  // Evidence gathering is best-effort and must never rewrite the outcome.
  assert.equal(service.connectionEvidence().connectionState, 'verified');
});

// --- persisted latest-import evidence (continuity across reload) -----------

import { mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const IMPORT_FILE = 'last-import-counts.json';

/** A fake store that also has a custody root, so the record has somewhere to live. */
function rootedStore(t) {
  const root = mkdtempSync(path.join(tmpdir(), 'atnr-import-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const store = fakeStore();
  store.path = path.join(root, 'library.sqlite3');
  store.root = root;
  store.purgeAllLocalData = () => {
    store.state.snapshot = null;
    return { contentPurgeComplete: true, retainedReviewRows: 0 };
  };
  store.localDataSuppressed = () => false;
  return store;
}

function recordFile(store) {
  return path.join(store.root, IMPORT_FILE);
}

function readRecord(store) {
  return JSON.parse(readFileSync(recordFile(store), 'utf8'));
}

test('a requested sync persists its reconciliation counts as non-sensitive integers', async (t) => {
  const store = rootedStore(t);
  const service = new PrivateAlphaService({ connector: fakeConnector(), snapshotStore: store });

  await service.sync();

  const raw = readRecord(store);
  assert.equal(raw.version, 1);
  assert.equal(raw.basis, 'sync-reconciliation');
  assert.equal(raw.authority, 'requested-sync');
  assert.deepEqual(raw.counts, { added: 1, updated: 0, reappeared: 0, missingFromSource: 0 });
  assert.equal(raw.snapshotGeneration, store.state.generation);

  const text = readFileSync(recordFile(store), 'utf8');
  assert.equal(text.includes(ACCOUNT), false, 'the account key must never be written outside the container');
  assert.equal(text.includes('Synthetic'), false, 'no title may be written');
  assert.equal(text.includes('aud-us-book-synthetic'), false, 'no identifier may be written');
});

test('measured counts survive a reload: a new service over the same state reports them', async (t) => {
  const store = rootedStore(t);
  const service = new PrivateAlphaService({ connector: fakeConnector(), snapshotStore: store });
  await service.sync();

  const reloaded = new PrivateAlphaService({ connector: fakeConnector(), snapshotStore: store });
  const status = await reloaded.status();
  assert.equal(status.local.lastImport.basis, 'sync-reconciliation');
  assert.equal(status.local.lastImport.authority, 'requested-sync');
  assert.deepEqual(status.local.lastImport.counts, {
    added: 1, updated: 0, reappeared: 0, missingFromSource: 0, unchanged: null, rejected: null,
  });
});

test('a record bound to another account is never adopted', async (t) => {
  const store = rootedStore(t);
  const service = new PrivateAlphaService({ connector: fakeConnector(), snapshotStore: store });
  await service.sync();
  const raw = readRecord(store);
  writeFileSync(recordFile(store), JSON.stringify({ ...raw, accountBinding: 'f'.repeat(64) }), 'utf8');

  const status = await service.status();
  assert.equal(status.local.lastImport, null);
});

test('superseded, older, or malformed records read as unknown', async (t) => {
  const store = rootedStore(t);
  const service = new PrivateAlphaService({ connector: fakeConnector(), snapshotStore: store });
  await service.sync();
  const raw = readRecord(store);

  writeFileSync(recordFile(store), JSON.stringify({ ...raw, snapshotGeneration: raw.snapshotGeneration + 1 }), 'utf8');
  assert.equal((await service.status()).local.lastImport, null, 'a generation that is not the stored one is unknown');

  writeFileSync(recordFile(store), JSON.stringify({ ...raw, version: 0 }), 'utf8');
  assert.equal((await service.status()).local.lastImport, null, 'an older schema is unknown');

  writeFileSync(recordFile(store), JSON.stringify({ ...raw, counts: { added: -1, updated: 0, reappeared: 0, missingFromSource: 0 } }), 'utf8');
  assert.equal((await service.status()).local.lastImport, null, 'a negative count is unknown');

  writeFileSync(recordFile(store), '{ not json', 'utf8');
  assert.equal((await service.status()).local.lastImport, null, 'an unreadable record is unknown');
});

test('deleting or purging local data removes the derived import record', async (t) => {
  const store = rootedStore(t);
  const service = new PrivateAlphaService({ connector: fakeConnector(), snapshotStore: store });
  await service.sync();
  assert.equal(existsSync(recordFile(store)), true);

  await service.deleteLocalSnapshotVerified();
  assert.equal(existsSync(recordFile(store)), false, 'derived evidence must not outlive the snapshot');

  await service.sync();
  assert.equal(existsSync(recordFile(store)), true);
  await service.purgeAllLocalData();
  assert.equal(existsSync(recordFile(store)), false, 'a purge removes the derived record too');
});

test('a store without a custody root persists nothing and reports unknown', async () => {
  const store = fakeStore();
  const service = new PrivateAlphaService({ connector: fakeConnector(), snapshotStore: store });
  const result = await service.sync();
  assert.equal(result.ok, true, 'a sync must not fail because evidence could not be persisted');
  const status = await service.status();
  assert.equal(status.local.lastImport, null);
});
