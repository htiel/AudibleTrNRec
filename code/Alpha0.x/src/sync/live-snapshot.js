import { Catalog, mergeLibrarySnapshot } from '../core/model.js';
import { ValidationError } from '../core/errors.js';
import { isZoneQualifiedInstant, SOURCE_CONTRACT } from '../core/source-contract.js';

export const AUDIBLE_PRIVATE_SOURCE = 'audible-community-private-api';

const TOP_LEVEL_KEYS = Object.freeze([
  'schemaVersion', 'source', 'marketplace', 'observedAt', 'sourceContractRevision',
  'catalog', 'entries',
]);

const CATALOG_KEYS = Object.freeze(['people', 'facets', 'books']);

/**
 * Validate a snapshot produced by the isolated connector.
 *
 * Live input never inherits the synthetic fixture clock: `observedAt` must be
 * a zone-qualified instant supplied by the source capture, and every entry
 * must resolve to a catalog book before anything can be promoted.
 */
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
  if (!isZoneQualifiedInstant(raw.observedAt)) {
    throw new ValidationError('snapshot.observedAt: expected a zone-qualified instant', 'snapshot.observedAt');
  }
  if (raw.sourceContractRevision !== undefined
    && raw.sourceContractRevision !== SOURCE_CONTRACT.contractRevision) {
    throw new ValidationError('snapshot.sourceContractRevision: unsupported', 'snapshot.sourceContractRevision');
  }
  if (!raw.catalog || typeof raw.catalog !== 'object' || Array.isArray(raw.catalog)) {
    throw new ValidationError('snapshot.catalog: expected object', 'snapshot.catalog');
  }
  for (const key of Object.keys(raw.catalog)) {
    if (!CATALOG_KEYS.includes(key)) {
      throw new ValidationError(`snapshot.catalog.${key}: unknown field`, `snapshot.catalog.${key}`);
    }
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
  // Entry -> catalog referential integrity: a current or retained entry may
  // never point at a book the snapshot does not carry.
  for (const entry of merge.entries) {
    if (!catalog.book(entry.bookId)) {
      throw new ValidationError(
        `snapshot.entries: ${entry.bookId} has no catalog book`,
        'snapshot.entries',
        'missing-required-field',
      );
    }
  }
  return { snapshot: raw, catalog, entries: merge.entries, report: merge.report };
}
