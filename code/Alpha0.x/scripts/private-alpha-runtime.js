import { ConnectorProcess } from '../src/adapters/connector-process.js';
import { EncryptedSnapshotStore, privateDataRoot } from '../src/store/encrypted-snapshot-store.js';
import { PrivateFeedbackStore } from '../src/store/feedback-store.js';
import { ConnectorLocalSealer, supportsLocalCustody } from '../src/store/local-sealer.js';
import { openRealLibraryState, assertProductionCustody } from '../src/store/production-migration.js';
import { CustodyProofGate } from '../src/security/runtime-data-source.js';
import { PrivateAlphaService } from '../src/sync/private-alpha-service.js';
import { assertPrivateAlphaPolicy } from './private-alpha-policy.js';

function feedbackRuntimeError(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

/**
 * Compose the user-facing private runtime on the owner's real, encrypted local
 * library state.
 *
 * Ordering is a security property here, not a style choice:
 *   1. the trusted connector proves the OS custody boundary (ACL re-read);
 *   2. only then may `openRealLibraryState` probe, migrate, or write a
 *      rollback envelope, and it does so behind a gate that refuses without
 *      that proof;
 *   3. the rollback envelope stays inside the same protected custody root.
 *
 * If any step throws, startup stops: no synthetic or demo library is ever
 * substituted.
 *
 * `requireExistingState` is mandatory for production 0.0.2: the encrypted
 * 0.0.1 state must already exist. Initializing a fresh container here would
 * present an empty library that is indistinguishable from one that had been
 * silently discarded, so a missing state is a refusal instead.
 */
export async function createPrivateAlphaRuntime({ packageRoot, root = privateDataRoot() }) {
  const policy = assertPrivateAlphaPolicy();

  // Custody proof first. The OS-level ACL re-read happens inside the trusted
  // connector, and it must complete before `openRealLibraryState` is allowed
  // to write a rollback envelope or run a migration. Verifying afterwards
  // would mean the owner's library had already been written into a directory
  // whose permissions were never proven.
  const connector = new ConnectorProcess({ packageRoot });
  const custodyGate = new CustodyProofGate();
  try {
    custodyGate.record(await connector.verifyCustody());
    await connector.status();
    if (!supportsLocalCustody(connector)) throw feedbackRuntimeError('local-custody-unavailable');
  } catch (error) {
    // Nothing has been opened or written yet; close the connector and stop.
    try { connector.close?.(); } catch { /* nothing to close */ }
    throw error;
  }

  const opened = openRealLibraryState({
    root,
    requireExistingState: true,
    openStore: (options) => new EncryptedSnapshotStore(options),
    // The migration's own boundary check is wrapped by the gate, so a future
    // reordering that moved a write ahead of the proof fails closed instead of
    // silently regressing.
    verifyCustody: custodyGate.guard(assertProductionCustody),
  });

  const feedbackSealer = new ConnectorLocalSealer(connector);

  const service = new PrivateAlphaService({
    connector,
    snapshotStore: opened.store,
    dataSource: 'local-encrypted',
    // Service-level export and aggregate purge need the owner's feedback. The
    // factory is called only after `assertFeedbackAccess` has resolved the
    // account join, and it is bound to the account that owns the stored data.
    feedbackStoreFactory: (accountKey) => new PrivateFeedbackStore({
      database: opened.store.database,
      sealer: feedbackSealer,
      accountKey,
    }),
  });

  /**
   * Feedback is keyed by the account that owns the *stored* library, never by
   * whichever account happens to be connected. `assertFeedbackAccess` resolves
   * the account join first, so a mismatched session is refused instead of
   * reading or writing another account's records.
   */
  const feedbackFor = async () => {
    const status = await service.status();
    const accountKey = status.local?.accountKey ?? null;
    if (typeof accountKey !== 'string' || accountKey.length === 0) {
      throw feedbackRuntimeError('feedback-account-unavailable');
    }
    await service.assertFeedbackAccess(accountKey);
    return new PrivateFeedbackStore({
      database: opened.store.database,
      sealer: feedbackSealer,
      accountKey,
    });
  };

  service.feedbackStore = {
    get: async (bookId) => (await feedbackFor()).get(bookId),
    save: async (bookId, payload, expectedRevision) => (
      (await feedbackFor()).save(bookId, payload, { expectedRevision })
    ),
    delete: async (bookId, expectedRevision) => (
      (await feedbackFor()).delete(bookId, { expectedRevision })
    ),
  };
  service.migrationEvidence = opened.evidence;
  // Resolve the account join before any read can be served, so credentials for
  // one account cannot open another account's stored library.
  await service.startupJoinCheck();
  // Only now - schema verified at open, join resolved, status readable - is it
  // safe to discharge the migration rollback envelope. A withheld checkpoint
  // keeps the envelope; it is never discarded on an unverified startup.
  service.startupCheckpoint = await service.completeStartupCheckpoint();
  service.startScheduler(policy.automaticSyncIntervalMinutes);
  return service;
}
