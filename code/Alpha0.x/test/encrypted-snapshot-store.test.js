import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { EncryptedSnapshotStore } from '../src/store/encrypted-snapshot-store.js';

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
