import { ConnectorProcessError } from '../adapters/connector-process.js';
import { SnapshotStoreError } from '../store/encrypted-snapshot-store.js';
import { validateLiveSnapshot } from './live-snapshot.js';

export class PrivateAlphaServiceError extends Error {
  constructor(code) {
    super(code);
    this.name = 'PrivateAlphaServiceError';
    this.code = code;
  }
}

function errorCode(error) {
  if (error instanceof ConnectorProcessError || error instanceof SnapshotStoreError) return error.code;
  if (error?.name === 'ValidationError' && typeof error.code === 'string') {
    return `snapshot-${error.code}`;
  }
  return 'private-alpha-operation-failed';
}

export class PrivateAlphaService {
  constructor({ connector, snapshotStore }) {
    this.connector = connector;
    this.snapshotStore = snapshotStore;
    this.timer = null;
    this.syncPromise = null;
  }

  async status() {
    const connection = await this.connector.status();
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

  async sync() {
    if (this.syncPromise) return this.syncPromise;
    this.syncPromise = this.#sync();
    try {
      return await this.syncPromise;
    } finally {
      this.syncPromise = null;
    }
  }

  async #sync() {
    try {
      const result = await this.connector.syncLibrary();
      const validated = validateLiveSnapshot(result.snapshot);
      if (validated.entries.length !== result.itemCount) {
        throw new PrivateAlphaServiceError('library-count-mismatch');
      }
      this.snapshotStore.save({
        accountKey: result.status.accountKey,
        marketplace: result.status.marketplace,
        itemCount: result.itemCount,
        observedAt: result.snapshot.observedAt,
        sealedSnapshot: result.sealedSnapshot,
      });
      return {
        ok: true,
        itemCount: result.itemCount,
        observedAt: result.snapshot.observedAt,
      };
    } catch (error) {
      const code = error instanceof PrivateAlphaServiceError ? error.code : errorCode(error);
      this.snapshotStore.recordFailure(code);
      throw new PrivateAlphaServiceError(code);
    }
  }

  async library() {
    const sealedSnapshot = this.snapshotStore.encryptedSnapshot();
    if (!sealedSnapshot) return null;
    try {
      const snapshot = await this.connector.unsealSnapshot(sealedSnapshot);
      validateLiveSnapshot(snapshot);
      return snapshot;
    } catch (error) {
      throw new PrivateAlphaServiceError(errorCode(error));
    }
  }

  async disconnect() {
    try {
      await this.connector.disconnect();
      return this.status();
    } catch (error) {
      throw new PrivateAlphaServiceError(errorCode(error));
    }
  }

  deleteLocalSnapshot() {
    this.snapshotStore.deleteLocalSnapshot();
    return this.snapshotStore.status();
  }

  startScheduler(intervalMinutes = 15) {
    if (this.timer) return;
    const run = async () => {
      if (this.syncPromise) return;
      try {
        const status = await this.connector.status();
        if (status.connected) await this.sync();
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
