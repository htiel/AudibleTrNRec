import test from 'node:test';
import assert from 'node:assert/strict';

import { PrivateAlphaService } from '../src/sync/private-alpha-service.js';

function snapshot() {
  return {
    schemaVersion: 1,
    source: 'audible-community-private-api',
    marketplace: 'us',
    observedAt: '2026-09-17T12:00:00.000Z',
    catalog: {
      people: [],
      facets: [],
      books: [{
        bookId: 'aud-us-book-synthetic',
        workId: 'aud-us-work-synthetic',
        title: 'Synthetic Live Book',
        authorIds: [],
        narratorIds: [],
        genreIds: [],
        themeIds: [],
        language: 'en',
        available: true,
      }],
    },
    entries: [{ bookId: 'aud-us-book-synthetic', status: 'not-started' }],
  };
}

test('sync validates before atomically saving and disconnect is explicit', async () => {
  let disconnected = 0;
  let saved = null;
  const connector = {
    status: async () => ({ connected: true, accountKey: 'a'.repeat(64), marketplace: 'us' }),
    syncLibrary: async () => ({
      status: { accountKey: 'a'.repeat(64), marketplace: 'us' },
      itemCount: 1,
      snapshot: snapshot(),
      sealedSnapshot: Buffer.from('ATNR-DPAPI-1\0sealed').toString('base64'),
    }),
    disconnect: async () => { disconnected += 1; },
    unsealSnapshot: async () => snapshot(),
  };
  const snapshotStore = {
    status: () => ({ hasLocalSnapshot: Boolean(saved), accountKey: saved?.accountKey ?? null }),
    save: (value) => { saved = value; },
    recordFailure: () => {},
    encryptedSnapshot: () => saved?.sealedSnapshot ?? null,
    deleteLocalSnapshot: () => { saved = null; },
    close: () => {},
  };
  const service = new PrivateAlphaService({ connector, snapshotStore });

  await service.sync();
  assert.equal(saved.itemCount, 1);
  assert.equal(disconnected, 0, 'normal sync must not deregister the persistent device');
  await service.disconnect();
  assert.equal(disconnected, 1, 'only explicit disconnect deregisters');
});

test('concurrent refresh requests share one connector sync', async () => {
  let syncCalls = 0;
  let release;
  const wait = new Promise((resolve) => { release = resolve; });
  const connector = {
    syncLibrary: async () => {
      syncCalls += 1;
      await wait;
      return {
        status: { accountKey: 'a'.repeat(64), marketplace: 'us' },
        itemCount: 1,
        snapshot: snapshot(),
        sealedSnapshot: Buffer.from('ATNR-DPAPI-1\0sealed').toString('base64'),
      };
    },
  };
  const snapshotStore = {
    save: () => {},
    recordFailure: () => {},
  };
  const service = new PrivateAlphaService({ connector, snapshotStore });
  const first = service.sync();
  const second = service.sync();
  release();
  await Promise.all([first, second]);
  assert.equal(syncCalls, 1);
});
