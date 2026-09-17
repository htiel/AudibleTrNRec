import { ConnectorProcess } from '../src/adapters/connector-process.js';
import { EncryptedSnapshotStore } from '../src/store/encrypted-snapshot-store.js';
import { PrivateAlphaService } from '../src/sync/private-alpha-service.js';
import { assertPrivateAlphaPolicy } from './private-alpha-policy.js';

export async function createPrivateAlphaRuntime({ packageRoot }) {
  const policy = assertPrivateAlphaPolicy();
  const connector = new ConnectorProcess({ packageRoot });
  await connector.status();
  const snapshotStore = new EncryptedSnapshotStore();
  const service = new PrivateAlphaService({ connector, snapshotStore });
  service.startScheduler(policy.automaticSyncIntervalMinutes);
  return service;
}
