/**
 * Prior-snapshot reconciliation and canonical semantic digests (ATR-S024).
 *
 * Platform-neutral and side-effect free: it takes the last complete snapshot
 * plus a *complete* candidate capture and returns the snapshot that should be
 * sealed and promoted. Its rules:
 *
 *  - reconciliation never runs on a partial or failed capture;
 *  - an entry the source stopped listing is retained and flagged
 *    `missingFromSource`, with its `lastSeenAt` frozen at the last observation
 *    that actually listed it, and with every catalog record it references
 *    retained so nothing is left dangling;
 *  - a verified reappearance clears the flag;
 *  - a source snapshot can never create, edit or clear a local review: local
 *    feedback is not reachable from here by construction;
 *  - the digest compares semantics only. Ciphertext randomness and declared
 *    freshness fields are excluded; private review values, revisions and
 *    created/updated timestamps are not.
 */

import { compareText, deepFreeze } from '../core/validate.js';
import { isZoneQualifiedInstant } from '../core/source-contract.js';

export class ReconcileError extends Error {
  constructor(code) {
    super(code);
    this.name = 'ReconcileError';
    this.code = code;
  }
}

/** Fields excluded from a canonical semantic digest, and why. */
export const DECLARED_FRESHNESS_FIELDS = Object.freeze([
  'observedAt', 'lastSyncedAt', 'sourceObservedAt',
]);

function canonicalValue(node) {
  if (Array.isArray(node)) return node.map(canonicalValue);
  if (node && typeof node === 'object') {
    const out = {};
    for (const key of Object.keys(node).sort(compareText)) {
      if (DECLARED_FRESHNESS_FIELDS.includes(key)) continue;
      out[key] = canonicalValue(node[key]);
    }
    return out;
  }
  return node;
}

/** Canonical JSON of the semantic content of any snapshot-like value. */
export function canonicalSnapshotJson(snapshot) {
  return JSON.stringify(canonicalValue(snapshot));
}

/**
 * Deterministic 64-bit FNV-1a digest. It is a change detector for replay and
 * restart comparison, not a security primitive, and is documented as such.
 */
export function semanticDigest(value) {
  const text = typeof value === 'string' ? value : canonicalSnapshotJson(value);
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  const mask = 0xffffffffffffffffn;
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash ^ BigInt(text.codePointAt(i) & 0xff)) * prime & mask;
    hash = (hash ^ BigInt((text.codePointAt(i) >> 8) & 0xff)) * prime & mask;
  }
  return hash.toString(16).padStart(16, '0');
}

function indexById(records, key) {
  const map = new Map();
  for (const record of records ?? []) map.set(record[key], record);
  return map;
}

function assertReferentialIntegrity(catalog, entries) {
  const books = indexById(catalog.books, 'bookId');
  const people = indexById(catalog.people, 'personId');
  const facets = indexById(catalog.facets, 'facetId');
  for (const entry of entries) {
    if (!books.has(entry.bookId)) throw new ReconcileError('entry-book-missing');
  }
  for (const book of catalog.books) {
    for (const personId of [...(book.authorIds ?? []), ...(book.narratorIds ?? [])]) {
      if (!people.has(personId)) throw new ReconcileError('book-person-missing');
    }
    const facetIds = [...(book.genreIds ?? []), ...(book.themeIds ?? [])];
    if (book.seriesId) facetIds.push(book.seriesId);
    for (const facetId of facetIds) {
      if (!facets.has(facetId)) throw new ReconcileError('book-facet-missing');
    }
  }
}

/**
 * Reconcile a complete candidate capture against the last complete snapshot
 * for the **same account**.
 *
 * @param previous last complete snapshot, or `null` for a genuine first import
 * @param candidate validated complete candidate snapshot
 * @param complete explicit completeness evidence from the capture
 */
export function reconcileSnapshot({ previous = null, candidate, complete = false }) {
  if (complete !== true) throw new ReconcileError('incomplete-capture-not-reconcilable');
  if (!candidate || typeof candidate !== 'object') throw new ReconcileError('candidate-invalid');
  if (!isZoneQualifiedInstant(candidate.observedAt)) throw new ReconcileError('observed-at-invalid');

  const observedAt = candidate.observedAt;
  const candidateEntries = candidate.entries ?? [];
  const candidateCatalog = {
    people: candidate.catalog?.people ?? [],
    facets: candidate.catalog?.facets ?? [],
    books: candidate.catalog?.books ?? [],
  };
  assertReferentialIntegrity(candidateCatalog, candidateEntries);

  const previousEntries = indexById(previous?.entries ?? [], 'bookId');
  const previousObservedAt = isZoneQualifiedInstant(previous?.observedAt)
    ? previous.observedAt
    : observedAt;
  const previousBooks = indexById(previous?.catalog?.books ?? [], 'bookId');
  const previousPeople = indexById(previous?.catalog?.people ?? [], 'personId');
  const previousFacets = indexById(previous?.catalog?.facets ?? [], 'facetId');

  const entries = new Map();
  const report = { added: [], updated: [], reappeared: [], missingFromSource: [], retainedCatalogBooks: [] };

  for (const entry of candidateEntries) {
    if (entries.has(entry.bookId)) throw new ReconcileError('candidate-duplicate-entry');
    const before = previousEntries.get(entry.bookId) ?? null;
    entries.set(entry.bookId, {
      ...entry,
      missingFromSource: false,
      sourceObservedAt: observedAt,
      lastSeenAt: observedAt,
    });
    if (!before) report.added.push(entry.bookId);
    else if (before.missingFromSource === true) report.reappeared.push(entry.bookId);
    else report.updated.push(entry.bookId);
  }

  const books = new Map(candidateCatalog.books.map((b) => [b.bookId, b]));
  const people = new Map(candidateCatalog.people.map((p) => [p.personId, p]));
  const facets = new Map(candidateCatalog.facets.map((f) => [f.facetId, f]));

  for (const [bookId, before] of previousEntries) {
    if (entries.has(bookId)) continue;
    // Retain the entry and everything it points at. Removal at the source is
    // not deletion of the user's record.
    entries.set(bookId, {
      ...before,
      missingFromSource: true,
      sourceObservedAt: observedAt,
      // Frozen at the last observation that actually listed the book. If the
      // stored entry predates these fields, the previous snapshot's own
      // observation time is the last proof of listing - never "now".
      lastSeenAt: before.lastSeenAt ?? before.sourceObservedAt ?? previousObservedAt,
    });
    report.missingFromSource.push(bookId);
    const book = previousBooks.get(bookId);
    if (book) {
      if (!books.has(bookId)) {
        books.set(bookId, book);
        report.retainedCatalogBooks.push(bookId);
      }
      for (const personId of [...(book.authorIds ?? []), ...(book.narratorIds ?? [])]) {
        if (!people.has(personId) && previousPeople.has(personId)) people.set(personId, previousPeople.get(personId));
      }
      const facetIds = [...(book.genreIds ?? []), ...(book.themeIds ?? [])];
      if (book.seriesId) facetIds.push(book.seriesId);
      for (const facetId of facetIds) {
        if (!facets.has(facetId) && previousFacets.has(facetId)) facets.set(facetId, previousFacets.get(facetId));
      }
    }
  }

  const snapshot = {
    ...candidate,
    catalog: {
      people: [...people.values()].sort((a, b) => compareText(a.personId, b.personId)),
      facets: [...facets.values()].sort((a, b) => compareText(a.facetId, b.facetId)),
      books: [...books.values()].sort((a, b) => compareText(a.bookId, b.bookId)),
    },
    entries: [...entries.values()].sort((a, b) => compareText(a.bookId, b.bookId)),
  };

  assertReferentialIntegrity(snapshot.catalog, snapshot.entries);
  for (const key of ['added', 'updated', 'reappeared', 'missingFromSource', 'retainedCatalogBooks']) {
    report[key].sort(compareText);
  }

  return {
    snapshot,
    report: deepFreeze({ ...report, observedAt, entryCount: snapshot.entries.length }),
    digest: semanticDigest(snapshot),
  };
}
