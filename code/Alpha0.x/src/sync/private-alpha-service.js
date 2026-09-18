import { ConnectorProcessError } from '../adapters/connector-process.js';
import {
  REQUIRED_RUNTIME_DATA_SOURCE,
  RUNTIME_CONTRACT_VERSION,
} from '../security/runtime-data-source.js';
import { SnapshotStoreError } from '../store/encrypted-snapshot-store.js';
import { ExportError, buildExportDocument, deletionInventory as buildDeletionInventory } from '../store/export.js';
import { STORAGE_SCHEMA_REVISION } from '../version.js';
import { validateLiveSnapshot } from './live-snapshot.js';
import { ReconcileError, reconcileSnapshot } from './reconcile.js';

export class PrivateAlphaServiceError extends Error {
  constructor(code) {
    super(code);
    this.name = 'PrivateAlphaServiceError';
    this.code = code;
  }
}

function errorCode(error) {
  if (error instanceof ConnectorProcessError || error instanceof SnapshotStoreError) return error.code;
  if (error instanceof ReconcileError) return `reconcile-${error.code}`;
  if (error instanceof ExportError) return `export-${error.code}`;
  if (error?.name === 'ValidationError' && typeof error.code === 'string') {
    return `snapshot-${error.code}`;
  }
  return 'private-alpha-operation-failed';
}

/** Snapshot with validated, normalized entries - the input reconciliation needs. */
function candidateOf(validated) {
  return { ...validated.snapshot, entries: validated.entries };
}

/**
 * Join the connected account against the account that owns the stored data.
 *
 * Credentials for account B must never unlock account A's library. The join is
 * computed from opaque account keys and returns a verdict only: raw keys never
 * appear in the result, so it is safe to carry into status, evidence and UI.
 *
 * Being disconnected is *not* a mismatch. The local snapshot belongs to this
 * Windows user either way, and refusing to show it after an explicit
 * disconnect would look like data loss rather than protection.
 */
export function accountJoin({ connectedAccountKey = null, storedAccountKey = null } = {}) {
  if (!storedAccountKey) {
    return Object.freeze({ verdict: 'no-local-data', matched: true, quarantined: false });
  }
  if (!connectedAccountKey) {
    return Object.freeze({ verdict: 'not-connected', matched: true, quarantined: false });
  }
  const matched = connectedAccountKey === storedAccountKey;
  return Object.freeze({
    verdict: matched ? 'matched' : 'mismatch',
    matched,
    quarantined: !matched,
  });
}

/** Refusal code used everywhere a mismatched account is denied private data. */
export const ACCOUNT_QUARANTINE_CODE = 'account-mismatch-local-data-quarantined';

/**
 * How long a resolved account join may back a synchronous destructive action.
 * Matched to the local API's destructive-confirmation lifetime, so a delete
 * authorized by a live confirmation is also backed by a live join.
 */
export const ACCOUNT_JOIN_FRESHNESS_MS = 120_000;

/**
 * Content-free local status for a quarantined account join. Every field that
 * would describe the stored library is withheld; only the fact that state
 * exists, and the reason it is withheld, remain.
 */
function quarantinedLocalStatus({ hasLocalSnapshot = true } = {}) {
  return Object.freeze({
    hasLocalSnapshot,
    hasAccountAnchor: true,
    quarantined: true,
    accountMismatch: true,
    accountKey: null,
    marketplace: null,
    itemCount: 0,
    observedAt: null,
    sourceObservedAt: null,
    completenessBasis: null,
    snapshotGeneration: 0,
    lastAttemptAt: null,
    lastSuccessAt: null,
    lastCandidateObservedAt: null,
    lastErrorCode: ACCOUNT_QUARANTINE_CODE,
  });
}

export class PrivateAlphaService {
  /**
   * The service is bound to the owner's real encrypted local state. The data
   * source is a constructor-time gate rather than a runtime branch so that no
   * code path inside this class can substitute fixture material: a service
   * asked to run on anything other than `local-encrypted` does not exist.
   */
  constructor({
    connector,
    snapshotStore,
    clock = () => new Date().toISOString(),
    dataSource = REQUIRED_RUNTIME_DATA_SOURCE,
    feedbackStoreFactory = null,
  }) {
    if (dataSource !== REQUIRED_RUNTIME_DATA_SOURCE) {
      throw new PrivateAlphaServiceError('runtime-data-source-refused');
    }
    this.dataSource = REQUIRED_RUNTIME_DATA_SOURCE;
    this.connector = connector;
    this.snapshotStore = snapshotStore;
    this.clock = clock;
    this.timer = null;
    this.syncPromise = null;
    /**
     * Builds an account-bound feedback store. Optional: without it the service
     * still works, and export/purge report honestly that feedback could not be
     * included rather than silently omitting it.
     */
    this.feedbackStoreFactory = feedbackStoreFactory;
    /** Cached account-join verdict; `unverified` until a read resolves it. */
    this.accountJoinVerdict = 'unverified';
    this.accountJoinAt = null;
    this.quarantined = false;
    this.startupCheckpointAt = null;
  }

  /**
   * Redacted startup evidence: closed enums and booleans only. Deliberately no
   * item count, account key, title, identifier or path, so this value is safe
   * to print at startup and to keep as verification evidence.
   */
  startupContract() {
    const local = this.snapshotStore.status();
    return Object.freeze({
      dataSource: this.dataSource,
      contractVersion: RUNTIME_CONTRACT_VERSION,
      synthetic: false,
      syntheticFallback: 'prohibited',
      storageRevision: STORAGE_SCHEMA_REVISION,
      migrationOutcome: this.snapshotStore.migration?.outcome ?? 'unknown',
      hasLocalSnapshot: local.hasLocalSnapshot === true,
      hasAccountAnchor: local.hasAccountAnchor === true,
      rollbackEnvelopeRetained: this.#envelopeRetained(),
      startupCheckpointComplete: this.startupCheckpointAt !== null,
      localDataSuppressed: this.localDataSuppressed(),
      hasCompletedSync: this.quarantined ? false : typeof local.lastSuccessAt === 'string',
      accountJoin: this.accountJoinVerdict,
      quarantined: this.quarantined,
    });
  }

  /** True when a migration rollback envelope is still on disk. */
  #envelopeRetained() {
    return typeof this.snapshotStore.rollbackEnvelopeRetained === 'function'
      && this.snapshotStore.rollbackEnvelopeRetained() === true;
  }

  /**
   * Safe checkpoint for the rollback envelope.
   *
   * The envelope is the only copy of the pre-migration container, so it is
   * discharged only after the migrated state has been fully validated *and*
   * actually used: the schema verified at open, the account join resolved, and
   * a status read served without error. Anything less would discard the
   * fallback while it might still be needed.
   *
   * A quarantined or unverified session never discharges: that state is not
   * this session's to finalize. Nor does a disconnected one - `not-connected`
   * confirms nothing about ownership. The result is redacted and honest - it
   * reports retention rather than claiming a discharge that did not happen.
   */
  async completeStartupCheckpoint() {
    const join = await this.#resolveAccountJoin().catch(() => null);
    const local = this.snapshotStore.status();
    const migrationOutcome = this.snapshotStore.migration?.outcome ?? 'unknown';
    const verified = join !== null
      && join.quarantined === false
      // Only a positively matched account discharges. `not-connected` is a
      // legitimate state but confirms nothing, and the envelope is the only
      // copy of the pre-migration container: withholding costs a retained
      // file that the inventory discloses and deletion removes.
      && join.verdict === 'matched'
      && ['migrated', 'already-current', 'initialized'].includes(migrationOutcome)
      && (local.hasLocalSnapshot === true || local.hasAccountAnchor === true);

    if (!verified) {
      let reason = 'startup-not-verified';
      if (join?.quarantined === true) reason = 'account-quarantined';
      else if (join?.verdict === 'not-connected') reason = 'account-not-connected';
      return Object.freeze({
        checkpoint: 'withheld',
        reason,
        rollbackEnvelopeRetained: this.#envelopeRetained(),
        dischargedEnvelope: false,
      });
    }

    const result = typeof this.snapshotStore.dischargeRollbackEnvelope === 'function'
      ? this.snapshotStore.dischargeRollbackEnvelope()
      : { discharged: false, retained: false };
    this.startupCheckpointAt = this.clock();
    return Object.freeze({
      checkpoint: 'complete',
      reason: null,
      rollbackEnvelopeRetained: result.retained === true,
      dischargedEnvelope: result.discharged === true,
    });
  }

  /**
   * Resolve the account join once at startup so a mismatched session is
   * quarantined before any read is served. This does not throw: the runtime
   * still needs to start and explain itself. Reads refuse individually.
   */
  async startupJoinCheck() {
    try {
      await this.#resolveAccountJoin();
    } catch {
      // A connector that cannot be asked is not a mismatch; reads re-check.
      this.accountJoinVerdict = 'unverified';
    }
    return this.startupContract();
  }

  /**
   * Compare the connected account against the stored one and cache the verdict.
   * Never writes: a mismatch must leave the stored snapshot exactly as it is,
   * because the other account's data is not this session's to modify.
   */
  async #resolveAccountJoin(connection = null) {
    const local = this.snapshotStore.status();
    const status = connection ?? (local.accountKey ? await this.connector.status() : null);
    const join = accountJoin({
      connectedAccountKey: status?.accountKey ?? null,
      storedAccountKey: local.accountKey ?? null,
    });
    this.accountJoinVerdict = join.verdict;
    this.accountJoinAt = this.clock();
    this.quarantined = join.quarantined;
    return join;
  }

  /**
   * Single gate for every private read (library, and any future feedback
   * exposure). Refuses with a code that carries no account identifier.
   */
  async assertPrivateDataAccess() {
    const join = await this.#resolveAccountJoin();
    if (join.quarantined) throw new PrivateAlphaServiceError(ACCOUNT_QUARANTINE_CODE);
    return join;
  }

  /**
   * Private feedback is account-keyed. A caller may only reach the records of
   * the account that owns the stored library in this verified session.
   */
  async assertFeedbackAccess(accountKey) {
    await this.assertPrivateDataAccess();
    const expected = this.snapshotStore.status().accountKey ?? null;
    if (!expected || accountKey !== expected) {
      throw new PrivateAlphaServiceError(ACCOUNT_QUARANTINE_CODE);
    }
    return Object.freeze({ verdict: 'matched', matched: true, quarantined: false });
  }

  async status() {
    const connection = await this.connector.status();
    const join = await this.#resolveAccountJoin(connection);
    if (join.quarantined) {
      // The stored library belongs to another account: report the refusal, not
      // its contents, and change nothing on disk.
      const local = this.snapshotStore.status();
      return { ...connection, local: quarantinedLocalStatus({ hasLocalSnapshot: local.hasLocalSnapshot === true }) };
    }
    return { ...connection, local: this.snapshotStore.status() };
  }

  async connect({ accountAlias }) {
    let connection;
    try {
      connection = await this.connector.connect({ marketplace: 'us', accountAlias });
      const local = this.snapshotStore.status();
      if (local.accountKey && local.accountKey !== connection.accountKey) {
        await this.connector.disconnect();
        throw new PrivateAlphaServiceError('different-account-local-data-exists');
      }
      await this.sync();
      return this.status();
    } catch (error) {
      if (error instanceof PrivateAlphaServiceError) throw error;
      throw new PrivateAlphaServiceError(errorCode(error));
    }
  }

  async sync({ trigger = 'manual' } = {}) {
    if (this.syncPromise) return this.syncPromise;
    this.syncPromise = this.#sync(trigger);
    try {
      return await this.syncPromise;
    } finally {
      this.syncPromise = null;
    }
  }

  /** Whether automatic repopulation is currently suppressed by a deletion. */
  localDataSuppressed() {
    return typeof this.snapshotStore.localDataSuppressed === 'function'
      && this.snapshotStore.localDataSuppressed() === true;
  }

  async #sync(trigger = 'manual') {
    // After the owner deletes their local data, an automatic sync would
    // silently restore it - on the next scheduler tick, or on the next
    // restart. Only an explicit owner action may resume, and the refusal
    // happens before any attempt is recorded or any connector call is made.
    if (trigger !== 'manual' && this.localDataSuppressed()) {
      throw new PrivateAlphaServiceError('local-data-suppressed');
    }

    // The account join is resolved *before* anything is recorded or fetched.
    // A mismatched session must not write an attempt, request a library, or
    // otherwise touch data that belongs to another account. Asking the
    // connector for its current account identity is the only way to know
    // whose session this is; it is a status read, not a sync.
    const join = await this.#resolveAccountJoin();
    if (join.quarantined) throw new PrivateAlphaServiceError(ACCOUNT_QUARANTINE_CODE);

    // An explicit owner-initiated sync is the sanctioned way to resume after a
    // deletion. Clearing here - after the account join, before the attempt -
    // means a refused or mismatched session never clears it.
    if (trigger === 'manual' && this.localDataSuppressed()) {
      this.snapshotStore.clearLocalDataSuppression();
    }

    // The attempt is recorded before the connector is started so an
    // interrupted run is still visibly an attempt, and so a failure can never
    // masquerade as the last success.
    const before = this.snapshotStore.status();
    this.snapshotStore.recordAttempt(this.clock());
    try {
      const result = await this.connector.syncLibrary();
      if (before.accountKey && result.status?.accountKey !== before.accountKey) {
        // Stored data belongs to a different account. Refuse before touching it.
        throw new PrivateAlphaServiceError('different-account-local-data-exists');
      }
      const validated = validateLiveSnapshot(result.snapshot);
      if (validated.entries.length !== result.itemCount) {
        throw new PrivateAlphaServiceError('library-count-mismatch');
      }
      const completeness = result.completeness ?? null;
      if (completeness && completeness.complete !== true) {
        // A partial capture is never promoted; the previous snapshot stands.
        throw new PrivateAlphaServiceError('library-capture-incomplete');
      }

      const previous = before.hasLocalSnapshot ? await this.#previousSnapshot() : null;
      const { snapshot, report } = reconcileSnapshot({
        previous,
        candidate: candidateOf(validated),
        complete: true,
      });
      const sealedSnapshot = await this.#sealReconciled(snapshot, report, result.sealedSnapshot);

      const generation = this.snapshotStore.save({
        accountKey: result.status.accountKey,
        marketplace: result.status.marketplace,
        itemCount: snapshot.entries.length,
        observedAt: snapshot.observedAt,
        sealedSnapshot,
        completenessBasis: completeness?.basis ?? null,
        // Durable commit time, produced here - not the connector's observation.
        committedAt: this.clock(),
      });
      return {
        ok: true,
        itemCount: snapshot.entries.length,
        observedAt: snapshot.observedAt,
        snapshotGeneration: generation,
        reconciliation: {
          added: report.added.length,
          updated: report.updated.length,
          reappeared: report.reappeared.length,
          missingFromSource: report.missingFromSource.length,
        },
      };
    } catch (error) {
      const code = error instanceof PrivateAlphaServiceError ? error.code : errorCode(error);
      this.snapshotStore.recordFailure(code, this.clock());
      throw new PrivateAlphaServiceError(code);
    }
  }

  /** Open the last durable snapshot for reconciliation. */
  async #previousSnapshot() {
    const sealed = this.snapshotStore.encryptedSnapshot();
    if (!sealed) return null;
    const snapshot = await this.connector.unsealSnapshot(sealed);
    return candidateOf(validateLiveSnapshot(snapshot));
  }

  /**
   * Seal the reconciled result. When the custodian exposes sealing, the
   * reconciled snapshot is what gets stored. When it does not, the connector's
   * candidate blob is only acceptable if reconciliation retained nothing extra;
   * otherwise this is a classified stop that preserves the prior snapshot.
   */
  async #sealReconciled(snapshot, report, candidateSealed) {
    if (typeof this.connector.sealSnapshot === 'function') {
      const sealed = await this.connector.sealSnapshot(snapshot);
      const value = sealed?.sealedSnapshot ?? sealed;
      if (typeof value !== 'string' || value.length === 0) {
        throw new PrivateAlphaServiceError('reconciled-seal-invalid');
      }
      return value;
    }
    if (report.missingFromSource.length > 0 || report.retainedCatalogBooks.length > 0) {
      throw new PrivateAlphaServiceError('reconciled-seal-unavailable');
    }
    return candidateSealed;
  }

  async library() {
    const sealedSnapshot = this.snapshotStore.encryptedSnapshot();
    if (!sealedSnapshot) return null;
    // The account join is resolved before the sealed body is opened: account
    // B's credentials must never unseal account A's library.
    await this.assertPrivateDataAccess();
    try {
      const snapshot = await this.connector.unsealSnapshot(sealedSnapshot);
      // `validateLiveSnapshot` refuses any source other than the approved live
      // one, so a fixture-shaped snapshot can never be served as a library.
      validateLiveSnapshot(snapshot);
      return snapshot;
    } catch (error) {
      throw new PrivateAlphaServiceError(errorCode(error));
    }
  }

  /**
   * Open the account-bound feedback store for the owner of the stored data.
   * Returns `null` when the runtime did not supply a factory, so callers can
   * report that honestly instead of pretending there is no feedback.
   */
  async #feedbackStore() {
    if (typeof this.feedbackStoreFactory !== 'function') return null;
    const accountKey = this.snapshotStore.status().accountKey ?? null;
    if (typeof accountKey !== 'string' || accountKey.length === 0) return null;
    await this.assertFeedbackAccess(accountKey);
    return this.feedbackStoreFactory(accountKey);
  }

  /**
   * Complete export of everything the owner owns locally: the reconciled
   * library, their private ratings/comments/tags, and the schema, source and
   * limit metadata needed to read the document later.
   *
   * Credentials, the identity seed, the account key and file paths are
   * excluded by construction in `buildExportDocument`, not filtered afterwards.
   * A deleted library is an expected case: the document records
   * `libraryRetained: false` and still carries the owner's feedback.
   */
  async exportAll({ generatedAt = this.clock() } = {}) {
    await this.assertPrivateDataAccess();
    try {
      const snapshot = await this.library();
      const store = await this.#feedbackStore();
      const feedback = store ? await store.exportRecords() : [];
      const document = buildExportDocument({
        snapshot: snapshot ?? null,
        feedback,
        generatedAt,
      });
      return Object.freeze({
        document,
        feedbackIncluded: store !== null,
        libraryRetained: document.libraryRetained,
      });
    } catch (error) {
      if (error instanceof PrivateAlphaServiceError) throw error;
      throw new PrivateAlphaServiceError(errorCode(error));
    }
  }

  /**
   * Truthful state of the artifacts the *connector* owns.
   *
   * This process cannot see the connector's credential or identity files, so
   * it asks through a closed capability and reports `'unknown'` when the
   * capability is absent or the call fails. Reporting `false` for something
   * that was never observed would be a claim, not a fact - and in a deletion
   * report, a false reassurance.
   */
  async #connectorArtifacts() {
    if (typeof this.connector.localArtifactInventory !== 'function') {
      return Object.freeze({ credentialsRetained: 'unknown', identitySeedRetained: 'unknown', source: 'capability-unavailable' });
    }
    try {
      const reported = await this.connector.localArtifactInventory();
      const flag = (value) => (value === true || value === false ? value : 'unknown');
      return Object.freeze({
        credentialsRetained: flag(reported?.credentialsRetained),
        identitySeedRetained: flag(reported?.identitySeedRetained),
        source: 'connector',
      });
    } catch {
      return Object.freeze({ credentialsRetained: 'unknown', identitySeedRetained: 'unknown', source: 'unreadable' });
    }
  }

  /**
   * Enumerate everything this installation retains, with the honest statement
   * of what deletion can and cannot achieve. Read-only.
   */
  async deletionInventory() {
    await this.assertPrivateDataAccess();
    const local = this.snapshotStore.status();
    const store = await this.#feedbackStore();
    const feedback = store ? store.inventory() : { activeReviews: 0, tombstones: 0 };
    const connectorArtifacts = await this.#connectorArtifacts();
    return buildDeletionInventory({
      hasSnapshot: local.hasLocalSnapshot === true,
      activeReviews: feedback.activeReviews,
      tombstones: feedback.tombstones,
      hasSyncState: typeof local.lastAttemptAt === 'string' || typeof local.lastSuccessAt === 'string',
      hasAccountAnchor: local.hasAccountAnchor === true,
      hasIdentitySeed: connectorArtifacts.identitySeedRetained,
      hasCredentials: connectorArtifacts.credentialsRetained,
      managedBackups: this.#envelopeRetained() ? 1 : 0,
      localDataSuppressed: this.localDataSuppressed(),
    });
  }

  /**
   * User-confirmed complete local deletion: snapshot, sync state, every
   * private review and tombstone, the ownership anchor and the retained
   * rollback envelope.
   *
   * The account join is resolved first, so a mismatched session can never
   * erase data it does not own, and the returned inventory is recomputed from
   * the post-deletion state rather than asserted.
   *
   * Completion is defined precisely: `contentPurgeComplete` means every piece
   * of local content is gone *and* automatic repopulation is suppressed.
   * Connector-owned credential and identity artifacts are **disclosed, not
   * erased** - only a confirmed Disconnect removes those - and they are
   * reported as observed, or explicitly as unknown.
   */
  async purgeAllLocalData() {
    const join = await this.#resolveAccountJoin();
    if (join.quarantined) throw new PrivateAlphaServiceError(ACCOUNT_QUARANTINE_CODE);
    const connectorArtifacts = await this.#connectorArtifacts();
    const result = this.snapshotStore.purgeAllLocalData({ at: this.clock() });
    const local = this.snapshotStore.status();
    const inventory = buildDeletionInventory({
      hasSnapshot: local.hasLocalSnapshot === true,
      activeReviews: 0,
      tombstones: result.retainedReviewRows ?? 0,
      hasSyncState: typeof local.lastAttemptAt === 'string' || typeof local.lastSuccessAt === 'string',
      hasAccountAnchor: local.hasAccountAnchor === true,
      hasIdentitySeed: connectorArtifacts.identitySeedRetained,
      hasCredentials: connectorArtifacts.credentialsRetained,
      managedBackups: result.rollbackEnvelopeRetained === true ? 1 : 0,
      localDataSuppressed: this.localDataSuppressed(),
    });
    const contentPurgeComplete = result.contentPurgeComplete === true
      && inventory.localDataRemoved === true
      && this.localDataSuppressed() === true;
    return Object.freeze({
      ...result,
      contentPurgeComplete,
      // Not "everything is gone": everything this application owns is gone,
      // and what it does not own is disclosed.
      complete: contentPurgeComplete && inventory.connectorArtifactsDisclosed === true,
      automaticSyncSuppressed: this.localDataSuppressed(),
      resumeRequires: 'explicit-owner-sync-or-reconnect',
      connectorArtifacts,
      connectorArtifactsErased: false,
      inventory,
    });
  }

  async disconnect() {
    try {
      await this.connector.disconnect();
      return this.status();
    } catch (error) {
      throw new PrivateAlphaServiceError(errorCode(error));
    }
  }

  /**
   * Erase the local snapshot. This is an owner-controlled lifecycle action, so
   * it stays available while disconnected: the stored data belongs to this
   * Windows user whether or not a provider session is currently live.
   *
   * A *mismatched connected account* is different. Deleting under someone
   * else's credentials would destroy data that session never owned, so the
   * join must have been resolved, recently, and in this session's favour.
   *
   * This method is synchronous because the local API calls it that way, so it
   * cannot re-ask the connector. It therefore requires a *fresh* verdict and
   * refuses a stale or unresolved one: a refusal is recoverable, a wrong
   * deletion is not. `deleteLocalSnapshotVerified()` resolves the join first
   * and is the preferred entry point.
   */
  deleteLocalSnapshot() {
    if (this.quarantined) throw new PrivateAlphaServiceError(ACCOUNT_QUARANTINE_CODE);
    if (!this.#accountJoinIsFresh()) throw new PrivateAlphaServiceError('account-join-stale');
    const result = this.snapshotStore.deleteLocalSnapshot({ at: this.clock() });
    return { ...this.snapshotStore.status(), deletion: result ?? null };
  }

  /** Resolve the account join, then delete. Preferred over the sync form. */
  async deleteLocalSnapshotVerified() {
    const join = await this.#resolveAccountJoin();
    if (join.quarantined) throw new PrivateAlphaServiceError(ACCOUNT_QUARANTINE_CODE);
    const result = this.snapshotStore.deleteLocalSnapshot({ at: this.clock() });
    return { ...this.snapshotStore.status(), deletion: result ?? null };
  }

  /**
   * True when the cached verdict was resolved recently enough to act on. The
   * window matches the destructive-confirmation lifetime, so a delete that is
   * authorized by a live confirmation is also backed by a live account join.
   */
  #accountJoinIsFresh() {
    if (this.accountJoinVerdict === 'unverified') return false;
    const resolvedAt = Date.parse(this.accountJoinAt ?? '');
    if (!Number.isFinite(resolvedAt)) return false;
    const now = Date.parse(this.clock());
    if (!Number.isFinite(now)) return false;
    return now - resolvedAt <= ACCOUNT_JOIN_FRESHNESS_MS;
  }

  startScheduler(intervalMinutes = 15) {
    if (this.timer) return;
    const run = async () => {
      if (this.syncPromise) return;
      // Checked here as well as inside sync(), so a suppressed installation
      // does not even ask the connector for its status on every tick.
      if (this.localDataSuppressed()) return;
      try {
        const status = await this.connector.status();
        if (status.connected) await this.sync({ trigger: 'automatic' });
      } catch {
        // The closed diagnostic is persisted by sync(); no personal detail is logged.
      }
    };
    this.timer = setInterval(run, intervalMinutes * 60_000);
    this.timer.unref();
    setTimeout(run, 2_000).unref();
  }

  stopScheduler() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  close() {
    this.stopScheduler();
    this.snapshotStore.close();
  }
}
