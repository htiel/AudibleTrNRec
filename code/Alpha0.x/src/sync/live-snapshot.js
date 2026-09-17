import { Catalog, mergeLibrarySnapshot } from '../core/model.js';
import { ValidationError } from '../core/errors.js';

export const AUDIBLE_PRIVATE_SOURCE = 'audible-community-private-api';

const TOP_LEVEL_KEYS = Object.freeze([
  'schemaVersion', 'source', 'marketplace', 'observedAt', 'catalog', 'entries',
]);

export function validateLiveSnapshot(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new ValidationError('snapshot: expected object', 'snapshot');
  }
  for (const key of Object.keys(raw)) {
    if (!TOP_LEVEL_KEYS.includes(key)) {
      throw new ValidationError(`snapshot.${key}: unknown field`, `snapshot.${key}`);
    }
  }
  if (raw.schemaVersion !== 1) throw new ValidationError('snapshot.schemaVersion: unsupported', 'snapshot.schemaVersion');
  if (raw.source !== AUDIBLE_PRIVATE_SOURCE) throw new ValidationError('snapshot.source: unapproved source', 'snapshot.source');
  if (raw.marketplace !== 'us') throw new ValidationError('snapshot.marketplace: expected us', 'snapshot.marketplace');
  if (!raw.catalog || typeof raw.catalog !== 'object' || Array.isArray(raw.catalog)) {
    throw new ValidationError('snapshot.catalog: expected object', 'snapshot.catalog');
  }
  if (!Array.isArray(raw.entries)) throw new ValidationError('snapshot.entries: expected array', 'snapshot.entries');

  const catalog = new Catalog(raw.catalog, { source: AUDIBLE_PRIVATE_SOURCE, observedAt: raw.observedAt });
  const merge = mergeLibrarySnapshot([], raw.entries, {
    source: AUDIBLE_PRIVATE_SOURCE,
    observedAt: raw.observedAt,
  });
  if (merge.report.rejected.length > 0 || merge.entries.length !== raw.entries.length) {
    throw new ValidationError('snapshot.entries: one or more records rejected', 'snapshot.entries');
  }
  return { snapshot: raw, catalog, entries: merge.entries, report: merge.report };
}
