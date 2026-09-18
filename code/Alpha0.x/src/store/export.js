/**
 * Portable export document and deletion inventory (ATR-S028 / ATR-S029 data).
 *
 * The export is a closed, versioned schema. It carries what the user owns -
 * catalog, entries (including entries the source no longer lists), provenance,
 * the limits the data was captured under, and their private ratings, comments,
 * tags and timestamps - and nothing else. Credentials, authorization material,
 * the identity seed, the account key, raw diagnostics and internal file paths
 * are excluded by construction, not by filtering after the fact.
 *
 * `restoreExportDocument` is a semantic round trip for verification. It is not
 * a personal source-import route and grants no provider access.
 */

import {
  FEEDBACK_LIMITS,
  FeedbackError,
  validateComment,
  validateRating,
  validateTags,
  assertZoneQualifiedInstant,
} from '../core/feedback.js';
import { compareText, deepFreeze } from '../core/validate.js';
import { SOURCE_CONTRACT } from '../core/source-contract.js';
import {
  EXPORT_SCHEMA_VERSION,
  FEEDBACK_CONTRACT_VERSION,
  STORAGE_SCHEMA_REVISION,
  SCHEMA_VERSION,
} from '../version.js';

export class ExportError extends Error {
  constructor(code, field = null) {
    super(code);
    this.name = 'ExportError';
    this.code = code;
    this.field = field;
  }
}

export const EXPORT_KEYS = Object.freeze([
  'exportSchemaVersion', 'generatedAt', 'runtimeLabel', 'sourceLabel',
  'coreSchemaVersion', 'storageSchemaRevision', 'sourceContractRevision',
  'feedbackContractVersion', 'limits', 'marketplace', 'libraryRetained',
  'library', 'feedback',
]);

export const LIBRARY_KEYS = Object.freeze(['observedAt', 'catalog', 'entries']);

/** Fields that must never appear anywhere in an export document. */
export const PROHIBITED_EXPORT_KEYS = Object.freeze([
  'accountKey', 'auth', 'authorization', 'accessToken', 'refreshToken', 'cookie',
  'identityKey', 'identitySeed', 'deviceSerial', 'adpToken', 'privateKey',
  'sealedSnapshot', 'sealedPayload', 'lastErrorCode', 'stack', 'path', 'filePath',
]);

function assertNoProhibitedKeys(node, path = 'export', depth = 0) {
  if (depth > 12 || node === null || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    node.forEach((item, i) => assertNoProhibitedKeys(item, `${path}[${i}]`, depth + 1));
    return;
  }
  for (const key of Object.keys(node)) {
    if (PROHIBITED_EXPORT_KEYS.includes(key)) throw new ExportError('prohibited-export-field', `${path}.${key}`);
    assertNoProhibitedKeys(node[key], `${path}.${key}`, depth + 1);
  }
}

/**
 * Build the export document.
 *
 * @param snapshot reconciled snapshot (catalog + entries), or `null` when the
 *   owner has deleted the imported library but still owns their feedback
 * @param feedback canonical private feedback records
 * @param generatedAt zone-qualified instant
 */
export function buildExportDocument({ snapshot, feedback = [], generatedAt, runtimeLabel = 'windows-local-private-alpha' }) {
  assertZoneQualifiedInstant(generatedAt, 'generatedAt');
  if (snapshot !== null && (!snapshot || typeof snapshot !== 'object')) {
    throw new ExportError('snapshot-invalid', 'snapshot');
  }
  // A deleted library is an expected state, not an error: the owner's ratings,
  // comments and tags are theirs, and they must remain exportable after the
  // imported catalog is gone. The document says so explicitly rather than
  // presenting an empty library as if the source had returned nothing.
  const libraryRetained = snapshot !== null;

  const entryBookIds = new Set((snapshot?.entries ?? []).map((e) => e.bookId));
  if (libraryRetained) {
    for (const record of feedback) {
      if (!entryBookIds.has(record.bookId)) {
        // Feedback for a retained but source-removed book is expected; feedback
        // for a book the export does not carry at all is a dangling reference.
        throw new ExportError('feedback-book-missing', record.bookId);
      }
    }
  }

  const document = {
    exportSchemaVersion: EXPORT_SCHEMA_VERSION,
    generatedAt,
    runtimeLabel,
    sourceLabel: snapshot?.source ?? 'unknown',
    coreSchemaVersion: SCHEMA_VERSION,
    storageSchemaRevision: STORAGE_SCHEMA_REVISION,
    sourceContractRevision: SOURCE_CONTRACT.contractRevision,
    feedbackContractVersion: FEEDBACK_CONTRACT_VERSION,
    limits: {
      contributorLimit: SOURCE_CONTRACT.contributorLimit,
      maxPages: SOURCE_CONTRACT.pagination.maxPages,
      pageSize: SOURCE_CONTRACT.pagination.pageSize,
      commentCodePoints: FEEDBACK_LIMITS.commentCodePoints,
      maxTags: FEEDBACK_LIMITS.maxTags,
      tagCodePoints: FEEDBACK_LIMITS.tagCodePoints,
    },
    marketplace: snapshot?.marketplace ?? 'unknown',
    libraryRetained,
    library: {
      observedAt: snapshot?.observedAt ?? generatedAt,
      catalog: {
        people: [...(snapshot?.catalog?.people ?? [])].sort((a, b) => compareText(a.personId, b.personId)),
        facets: [...(snapshot?.catalog?.facets ?? [])].sort((a, b) => compareText(a.facetId, b.facetId)),
        books: [...(snapshot?.catalog?.books ?? [])].sort((a, b) => compareText(a.bookId, b.bookId)),
      },
      entries: [...(snapshot?.entries ?? [])].sort((a, b) => compareText(a.bookId, b.bookId)),
    },
    feedback: [...feedback].sort((a, b) => compareText(a.bookId, b.bookId)),
  };
  assertNoProhibitedKeys(document);
  return deepFreeze(document);
}

/** Validate a closed export document, including unsafe-text refusal. */
export function validateExportDocument(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new ExportError('export-invalid', 'export');
  for (const key of Object.keys(raw)) {
    if (!EXPORT_KEYS.includes(key)) throw new ExportError('unknown-export-field', key);
  }
  for (const key of EXPORT_KEYS) {
    if (raw[key] === undefined) throw new ExportError('missing-export-field', key);
  }
  if (raw.exportSchemaVersion !== EXPORT_SCHEMA_VERSION) throw new ExportError('unsupported-export-version', 'exportSchemaVersion');
  if (raw.sourceContractRevision !== SOURCE_CONTRACT.contractRevision) throw new ExportError('unsupported-source-contract', 'sourceContractRevision');
  assertZoneQualifiedInstant(raw.generatedAt, 'generatedAt');
  assertNoProhibitedKeys(raw);

  const library = raw.library;
  if (!library || typeof library !== 'object') throw new ExportError('export-invalid', 'library');
  for (const key of Object.keys(library)) {
    if (!LIBRARY_KEYS.includes(key)) throw new ExportError('unknown-export-field', `library.${key}`);
  }
  assertZoneQualifiedInstant(library.observedAt, 'library.observedAt');

  const books = new Set((library.catalog?.books ?? []).map((b) => b.bookId));
  const people = new Set((library.catalog?.people ?? []).map((p) => p.personId));
  const facets = new Set((library.catalog?.facets ?? []).map((f) => f.facetId));
  for (const book of library.catalog?.books ?? []) {
    for (const personId of [...(book.authorIds ?? []), ...(book.narratorIds ?? [])]) {
      if (!people.has(personId)) throw new ExportError('dangling-reference', `book.${book.bookId}.person`);
    }
    const facetIds = [...(book.genreIds ?? []), ...(book.themeIds ?? [])];
    if (book.seriesId) facetIds.push(book.seriesId);
    for (const facetId of facetIds) {
      if (!facets.has(facetId)) throw new ExportError('dangling-reference', `book.${book.bookId}.facet`);
    }
  }
  for (const entry of library.entries ?? []) {
    if (!books.has(entry.bookId)) throw new ExportError('dangling-reference', `entry.${entry.bookId}`);
  }

  if (typeof raw.libraryRetained !== 'boolean') throw new ExportError('export-invalid', 'libraryRetained');
  if (!Array.isArray(raw.feedback)) throw new ExportError('export-invalid', 'feedback');
  for (const record of raw.feedback) {
    // With the library deleted there is no catalog left to point at, so the
    // reference check applies only while the library is retained.
    if (raw.libraryRetained && !books.has(record?.bookId)) {
      throw new ExportError('dangling-reference', 'feedback.bookId');
    }
    if (record.source !== 'local-user') throw new ExportError('feedback-source-invalid', 'feedback.source');
    try {
      validateRating(record.overallRating ?? null, 'overallRating');
      validateRating(record.storyRating ?? null, 'storyRating');
      validateRating(record.narrationRating ?? null, 'narrationRating');
      validateComment(record.comment ?? null);
      validateTags(record.tags ?? null);
      assertZoneQualifiedInstant(record.createdAt, 'feedback.createdAt');
      assertZoneQualifiedInstant(record.updatedAt, 'feedback.updatedAt');
    } catch (error) {
      if (error instanceof FeedbackError) throw new ExportError(`feedback-${error.code}`, error.field);
      throw error;
    }
  }
  return true;
}

/** Canonical semantics compared across an export -> restore round trip. */
export function canonicalExportSemantics(document) {
  return JSON.stringify({
    marketplace: document.marketplace,
    libraryRetained: document.libraryRetained,
    observedAt: document.library.observedAt,
    books: document.library.catalog.books.map((b) => b.bookId).sort(compareText),
    people: document.library.catalog.people.map((p) => `${p.personId}:${[...p.roles].sort().join('+')}`).sort(compareText),
    facets: document.library.catalog.facets.map((f) => `${f.facetId}:${f.type}`).sort(compareText),
    entries: document.library.entries
      .map((e) => `${e.bookId}:${e.status}:${e.percentComplete ?? 'unknown'}:${e.missingFromSource === true}`)
      .sort(compareText),
    feedback: document.feedback
      .map((f) => [
        f.bookId, f.overallRating ?? 'null', f.storyRating ?? 'null', f.narrationRating ?? 'null',
        f.comment ?? 'null', (f.tags ?? []).join('|'), f.createdAt, f.updatedAt,
      ].join('::'))
      .sort(compareText),
  });
}

/** Restore the semantic content of a validated export document. */
export function restoreExportDocument(raw) {
  validateExportDocument(raw);
  return deepFreeze({
    snapshot: raw.libraryRetained ? {
      schemaVersion: 1,
      source: raw.sourceLabel,
      marketplace: raw.marketplace,
      observedAt: raw.library.observedAt,
      sourceContractRevision: raw.sourceContractRevision,
      catalog: raw.library.catalog,
      entries: raw.library.entries,
    } : null,
    feedback: raw.feedback,
  });
}

/**
 * Enumerate everything the local installation retains, with an honest
 * statement of what deletion can and cannot achieve. Nothing here claims
 * cryptographic erasure.
 *
 * `hasIdentitySeed` and `hasCredentials` describe artifacts owned by the
 * isolated connector, not by this store. They accept `true`, `false` or
 * `'unknown'`, and `'unknown'` is what is reported when the connector cannot
 * be asked. Reporting `false` for an artifact this process cannot observe
 * would be a claim, not a fact.
 */
export function deletionInventory({
  hasSnapshot = false,
  activeReviews = 0,
  tombstones = 0,
  hasSyncState = false,
  hasAccountAnchor = false,
  hasIdentitySeed = 'unknown',
  hasCredentials = 'unknown',
  managedBackups = 0,
  localDataSuppressed = false,
} = {}) {
  const connectorState = (value) => (value === true || value === false ? value : 'unknown');
  const items = [
    { id: 'encrypted-snapshot', owner: 'local', retained: hasSnapshot, lifecycle: 'delete-local-data', encrypted: true },
    { id: 'private-reviews', owner: 'local', retained: activeReviews > 0, count: activeReviews, lifecycle: 'delete-feedback', encrypted: true },
    { id: 'review-tombstones', owner: 'local', retained: tombstones > 0, count: tombstones, lifecycle: 'delete-feedback', encrypted: false, contains: 'keys-and-generation-only' },
    { id: 'sync-state', owner: 'local', retained: hasSyncState, lifecycle: 'delete-local-data', encrypted: false, contains: 'timestamps-and-closed-error-codes' },
    { id: 'account-anchor', owner: 'local', retained: hasAccountAnchor, lifecycle: 'retained-while-any-dependent-record-exists', encrypted: false, contains: 'opaque-account-key-and-timestamps' },
    { id: 'rollback-envelope', owner: 'local', retained: managedBackups > 0, count: managedBackups, lifecycle: 'discharged-at-startup-checkpoint-or-deletion', encrypted: true, contains: 'pre-migration-copy-of-the-encrypted-container' },
    // Deliberately retained after a deletion: it is what stops an automatic
    // sync from silently restoring what the owner just removed. It holds no
    // library content, and an explicit owner-initiated sync or reconnect
    // clears it.
    { id: 'local-data-suppression', owner: 'local', retained: localDataSuppressed, lifecycle: 'cleared-by-explicit-owner-sync-or-reconnect', encrypted: false, contains: 'timestamp-and-closed-reason-only', content: false },
    { id: 'identity-seed', owner: 'connector', retained: connectorState(hasIdentitySeed), lifecycle: 'confirmed-disconnect-only', encrypted: true },
    { id: 'provider-credentials', owner: 'connector', retained: connectorState(hasCredentials), lifecycle: 'confirmed-disconnect-only', encrypted: true },
  ];
  // Locally deletable *content* only. Connector-owned artifacts belong to the
  // confirmed-disconnect lifecycle and are disclosed rather than counted as
  // residue of a local deletion, and the suppression record is not content.
  const localResidue = items.filter((item) => (
    item.owner === 'local' && item.content !== false && item.retained === true
  ));
  const connectorResidue = items.filter((item) => item.owner === 'connector' && item.retained !== false);
  return deepFreeze({
    storageSchemaRevision: STORAGE_SCHEMA_REVISION,
    items,
    localDataRemoved: localResidue.length === 0,
    residualItemIds: localResidue.map((item) => item.id),
    // Disclosure, not erasure: these are reported so the owner knows what a
    // local deletion does *not* remove.
    connectorArtifactsDisclosed: true,
    residualConnectorItemIds: connectorResidue.map((item) => item.id),
    localDataSuppressed,
    limitations: [
      'Windows DPAPI protects data at rest for this user account; it cannot defeat same-user malware, memory dumps, the pagefile, Volume Shadow Copies, SSD remnants or external backups.',
      'Deleting a row or a file is not cryptographic erasure. No overwrite or VACUUM in this prototype is claimed to be forensic erasure, and none is cited as proof of removal.',
      'Any copy the user exported is outside this application. Application deletion cannot erase an external, cloud-synced or Known-Folder-redirected copy.',
      'Deleting local data does not deregister the provider device, and does not remove the connector-owned credential or identity artifacts. Only a confirmed Disconnect does that.',
      'Connector-owned artifacts are reported as observed, or as unknown when the connector cannot be asked. They are never reported as removed by a local deletion.',
    ],
  });
}
