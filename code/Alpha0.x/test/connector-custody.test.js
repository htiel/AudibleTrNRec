/**
 * Connector custody capability tests (ATR-S016/S020/S032).
 *
 * These cover the adapter's fixed-command custody routes: `sealSnapshot`,
 * `sealLocal` and `unsealLocal`. Every payload here is synthetic, no connector
 * process is launched, no personal runtime file is read and no sealed material
 * is ever asserted against a real key.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  CONNECTOR_ERROR_CODES,
  CONNECTOR_METHODS,
  ConnectorProcess,
  ConnectorProcessError,
  isSealableSnapshot,
  narrowCustodyProof,
  narrowSealedReply,
} from '../src/adapters/connector-process.js';
import {
  ConnectorLocalSealer,
  LocalSealerError,
  supportsLocalCustody,
} from '../src/store/local-sealer.js';
import { ABSENT_REVISION, PrivateFeedbackStore } from '../src/store/feedback-store.js';
import { migrateDatabase } from '../src/store/migration.js';
import { reconcileSnapshot } from '../src/sync/reconcile.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(here, '..');

function adapter() {
  // A non-existent interpreter is deliberate: every assertion below must fail
  // on schema grounds before any process could be started.
  return new ConnectorProcess({ packageRoot, pythonPath: path.join(packageRoot, '.venv', 'Scripts', 'python.exe') });
}

function syntheticSnapshot() {
  return {
    schemaVersion: 1,
    source: 'audible-live',
    marketplace: 'us',
    observedAt: '2026-09-17T12:00:00.000Z',
    catalog: {
      people: [],
      facets: [],
      books: [{ bookId: 'aud-us-book-synthetic', title: 'Synthetic Title' }],
    },
    entries: [{ bookId: 'aud-us-book-synthetic', percentComplete: 0 }],
  };
}

// --- closed command selection -----------------------------------------------

test('every custody capability maps to a fixed, allow-listed command', () => {
  for (const method of ['verify_custody', 'seal_snapshot', 'seal_local', 'unseal_local']) {
    assert.ok(CONNECTOR_METHODS.includes(method), `${method} missing from the closed table`);
  }
  assert.ok(Object.isFrozen(CONNECTOR_METHODS));
});

test('no caller-selectable command surface is exposed', () => {
  const process_ = adapter();
  for (const name of ['invoke', 'enqueue', 'call', 'send', 'request', 'rpc']) {
    assert.equal(typeof process_[name], 'undefined', `${name} must not be reachable`);
  }
  const api = new Set(Object.getOwnPropertyNames(ConnectorProcess.prototype));
  for (const name of api) {
    assert.ok(
      ['constructor', 'trustedInterpreter', 'status', 'verifyCustody', 'localArtifactInventory',
        'connect', 'syncLibrary',
        'disconnect', 'unsealSnapshot', 'sealSnapshot', 'sealLocal', 'unsealLocal'].includes(name),
      `unexpected public method ${name}`,
    );
  }
});

test('the custody error codes stay inside the closed vocabulary', () => {
  for (const code of ['seal-payload-invalid', 'local-payload-invalid', 'local-payload-too-large',
    'custody-proof-invalid', 'envelope-purpose-invalid', 'envelope-purpose-mismatch']) {
    assert.ok(CONNECTOR_ERROR_CODES.includes(code));
  }
  assert.equal(new ConnectorProcessError('local-payload-invalid').code, 'local-payload-invalid');
  // A hostile connector cannot introduce a new code through a custody route.
  assert.equal(new ConnectorProcessError('seal-anything-you-like').code, 'connector-operation-failed');
});

test('a custody proof is accepted only in its exact closed shape', () => {
  const valid = {
    custodyVerified: true,
    aclVerified: true,
    rootHardened: true,
    protector: 'windows-dpapi',
  };
  assert.deepEqual(narrowCustodyProof(valid), valid);
  assert.ok(Object.isFrozen(narrowCustodyProof(valid)));

  for (const bad of [
    null, undefined, 'ok', 42, [],
    {},
    { custodyVerified: true },
    { ...valid, extra: true },
    // Truthy but not true: a partial proof must not read as success.
    { ...valid, custodyVerified: 'true' },
    { ...valid, aclVerified: 1 },
    { ...valid, rootHardened: null },
    { ...valid, protector: 'plaintext' },
    // Omitting the ACL proof is the exact regression this guards.
    { custodyVerified: true, rootHardened: true, protector: 'windows-dpapi' },
  ]) {
    assert.throws(() => narrowCustodyProof(bad), (error) => {
      assert.equal(error.code, 'custody-proof-invalid');
      return true;
    }, `accepted a bad proof: ${JSON.stringify(bad)}`);
  }
});

// --- closed input schemas (refused before a process exists) ------------------

test('sealSnapshot refuses anything that is not a reconciled snapshot envelope', async () => {
  const process_ = adapter();
  const rejected = [
    null, 'snapshot', 42, [], {},
    { ...syntheticSnapshot(), catalog: [] },
    { ...syntheticSnapshot(), entries: {} },
  ];
  for (const value of rejected) {
    await assert.rejects(
      () => process_.sealSnapshot(value),
      (error) => error instanceof ConnectorProcessError && error.code === 'seal-payload-invalid',
      `value was not refused: ${JSON.stringify(value)}`,
    );
  }
  const missing = syntheticSnapshot();
  delete missing.marketplace;
  await assert.rejects(() => process_.sealSnapshot(missing), /seal-payload-invalid/);
});

test('sealLocal accepts only a purpose-tagged local record within its ceiling', async () => {
  const process_ = adapter();
  for (const value of [null, 'payload', [], {}, { purpose: 'snapshot' }, { purpose: 'private-review-x' }]) {
    await assert.rejects(
      () => process_.sealLocal(value),
      (error) => error instanceof ConnectorProcessError && error.code === 'local-payload-invalid',
    );
  }
  const huge = { purpose: 'private-review', note: 'x'.repeat(300 * 1024) };
  await assert.rejects(
    () => process_.sealLocal(huge),
    (error) => error instanceof ConnectorProcessError && error.code === 'local-payload-too-large',
  );
});

test('unsealLocal refuses non-base64 and oversized sealed input', async () => {
  const process_ = adapter();
  for (const value of [null, 42, '', 'not base64!', '../../etc/passwd', 'A'.repeat(64 * 1024 * 1024)]) {
    await assert.rejects(
      () => process_.unsealLocal(value),
      (error) => error instanceof ConnectorProcessError && error.code === 'local-payload-invalid',
    );
  }
});

test('a refused custody payload never echoes its content', async () => {
  const process_ = adapter();
  const secret = 'do-not-leak-this-title';
  await assert.rejects(
    () => process_.sealLocal({ purpose: 'wrong', note: secret }),
    (error) => !JSON.stringify({ message: error.message, code: error.code }).includes(secret),
  );
});

// --- closed output schemas ---------------------------------------------------

test('a custody reply is narrowed to exactly one bounded base64 field', () => {
  assert.equal(narrowSealedReply({ sealedSnapshot: 'QUJD' }, 'sealedSnapshot'), 'QUJD');
  const rejected = [
    null,
    {},
    { sealedSnapshot: 'QUJD', extra: 1 },
    { sealedPayload: 'QUJD' },
    { sealedSnapshot: '' },
    { sealedSnapshot: 42 },
    { sealedSnapshot: { toString: () => 'QUJD' } },
    { sealedSnapshot: '<script>alert(1)</script>' },
    { sealedSnapshot: 'A'.repeat(64 * 1024 * 1024) },
  ];
  for (const value of rejected) {
    assert.throws(
      () => narrowSealedReply(value, 'sealedSnapshot'),
      (error) => error instanceof ConnectorProcessError && error.code === 'connector-response-invalid',
      `reply was not refused: ${JSON.stringify(value)}`,
    );
  }
});

// --- integration: the adapter satisfies the custodian contracts --------------

test('the adapter is recognised as a local custody provider', () => {
  assert.equal(supportsLocalCustody(adapter()), true);
  assert.equal(typeof adapter().sealSnapshot, 'function');
});

/** In-memory stand-in for DPAPI custody with the connector's exact shapes. */
function stubCustodian(overrides = {}) {
  return {
    sealLocal: async (payload) => ({
      sealedPayload: Buffer.from(JSON.stringify(payload), 'utf8').toString('base64'),
    }),
    unsealLocal: async (sealedPayload) => JSON.parse(
      Buffer.from(sealedPayload, 'base64').toString('utf8'),
    ),
    ...overrides,
  };
}

function feedbackStore(connector) {
  const database = new DatabaseSync(':memory:');
  migrateDatabase({ database });
  return new PrivateFeedbackStore({
    database,
    sealer: new ConnectorLocalSealer(connector),
    accountKey: 'a'.repeat(64),
    clock: () => '2026-09-17T12:00:00.000Z',
  });
}

test('PrivateFeedbackStore gets a working custodian from the connector shapes', async () => {
  const store = feedbackStore(stubCustodian());
  const empty = await store.get('aud-us-book-synthetic');
  assert.equal(empty.record, null);
  await store.save(
    'aud-us-book-synthetic',
    { overallRating: 4.5, comment: 'synthetic note' },
    { expectedRevision: ABSENT_REVISION },
  );
  const saved = await store.get('aud-us-book-synthetic');
  assert.equal(saved.record.overallRating, 4.5);
  assert.equal(saved.record.comment, 'synthetic note');
});

test('a review is refused rather than stored in the clear when custody is absent', async () => {
  const store = feedbackStore({});
  await assert.rejects(
    () => store.save('aud-us-book-synthetic', { overallRating: 3 }, { expectedRevision: ABSENT_REVISION }),
    (error) => error instanceof LocalSealerError && error.code === 'local-custody-unavailable',
  );
});

test('malformed and oversized custody replies fail closed at the sealer', async () => {
  const replies = [
    { sealedPayload: '' },
    { sealedPayload: 42 },
    { sealedPayload: 'not base64!' },
    { wrongKey: 'QUJD' },
  ];
  for (const reply of replies) {
    const sealer = new ConnectorLocalSealer(stubCustodian({ sealLocal: async () => reply }));
    await assert.rejects(
      () => sealer.seal(JSON.stringify({ purpose: 'private-review', record: {} })),
      (error) => error instanceof LocalSealerError && error.code === 'local-seal-invalid',
      `reply was not refused: ${JSON.stringify(reply)}`,
    );
  }
  const wrongPurpose = new ConnectorLocalSealer(stubCustodian({
    unsealLocal: async () => ({ purpose: 'snapshot', record: {} }),
  }));
  await assert.rejects(
    () => wrongPurpose.unseal('QUJD'),
    (error) => error instanceof LocalSealerError && error.code === 'local-payload-invalid',
  );
});

test('a reconciled snapshot passes the custody gate and its reply is narrowed', () => {
  // No process is started: the reconciled envelope is checked against the same
  // gate `sealSnapshot` applies, then a connector-shaped reply is narrowed.
  const { snapshot } = reconcileSnapshot({
    previous: null,
    candidate: syntheticSnapshot(),
    complete: true,
  });
  assert.equal(isSealableSnapshot(snapshot), true);
  const sealed = Buffer.from(JSON.stringify(snapshot), 'utf8').toString('base64');
  assert.equal(narrowSealedReply({ sealedSnapshot: sealed }, 'sealedSnapshot'), sealed);
  assert.equal(isSealableSnapshot({ ...snapshot, entries: undefined }), false);
});
