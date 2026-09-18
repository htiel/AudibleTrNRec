/**
 * Normalized, platform-neutral domain model.
 *
 * Authority rule (structural, not conventional):
 *  - Source-owned fields (listening status/progress/dates) live in `Catalog`/`LibraryEntry`.
 *  - Locally-owned fields (ratings, comments, tags, favorites, dismissals) live in
 *    a separate `AnnotationStore`. A repeat import therefore cannot reach them.
 *
 * Every record carries provenance and an explicit list of unknown fields.
 */

import {
  UNKNOWN, isUnknown, safeId, safeText, safeEnum, safeNumber, safeIsoDate,
  safeBoolean, safeIdList, safeTags, safeObject, compareText, deepFreeze, LIMITS,
} from './validate.js';
import { ValidationError, classifyDiagnostic } from './errors.js';
import { stripCommercialFields, assertCommercialFree } from './trust.js';
import { IDENTITY_BASES } from './source-contract.js';
import { SCHEMA_VERSION, SYNTHETIC_NOW } from '../version.js';

export const LISTENING_STATUSES = Object.freeze([
  'not-started', 'in-progress', 'completed', 'abandoned', 'want-to-listen', 'unknown',
]);

export const FACET_TYPES = Object.freeze(['genre', 'category', 'theme', 'series']);
export const PERSON_ROLES = Object.freeze(['author', 'narrator']);

/** Imported, source-authoritative fields. Local edits never win here. */
export const SOURCE_OWNED_FIELDS = Object.freeze([
  'status', 'percentComplete', 'positionSeconds', 'acquiredAt',
  'lastListenedAt', 'completedAt',
]);

/** Locally-authoritative fields. A sync must never modify these. */
export const LOCAL_OWNED_FIELDS = Object.freeze([
  'overallRating', 'storyRating', 'narrationRating', 'comment', 'tags',
  'favorite', 'abandonedReason', 'listenAgain', 'dismissed',
]);

const PROVENANCE_SOURCES = Object.freeze([
  'synthetic-fixture', 'audible-community-private-api', 'local-user', 'derived', 'unknown',
]);

function provenance({ source, observedAt, fields = {}, unknownFields = [], notes = [] }) {
  return {
    schemaVersion: SCHEMA_VERSION,
    source: safeEnum(source, PROVENANCE_SOURCES, 'provenance.source', { required: true }),
    observedAt: safeIsoDate(observedAt ?? SYNTHETIC_NOW, 'provenance.observedAt', { required: true }),
    fields,
    unknownFields: unknownFields.slice().sort(),
    notes,
  };
}

function trackUnknown(unknownFields, field, value) {
  if (isUnknown(value)) unknownFields.push(field);
  return value;
}

/**
 * Declared basis for a catalog identity. `unspecified` is recorded as an
 * unknown field: it is an admission that separation is not proven, never a
 * licence to merge two records because their names are equal.
 */
export const DECLARED_IDENTITY_BASES = Object.freeze([...IDENTITY_BASES, 'unspecified']);

export function normalizePerson(input, { source = 'synthetic-fixture', observedAt } = {}) {
  const raw = safeObject(input, 'person', { required: true });
  const unknownFields = [];
  const displayName = safeText(raw.displayName, 'person.displayName', { required: true });
  const roles = [];
  for (const [i, role] of (Array.isArray(raw.roles) ? raw.roles : []).entries()) {
    const r = safeEnum(role, PERSON_ROLES, `person.roles[${i}]`, { required: true });
    if (!roles.includes(r)) roles.push(r);
  }
  if (roles.length === 0) throw new ValidationError('person.roles: at least one role required', 'person.roles');
  const identityBasis = isUnknown(raw.identityBasis)
    ? 'unspecified'
    : safeEnum(raw.identityBasis, DECLARED_IDENTITY_BASES, 'person.identityBasis', { required: true });
  if (identityBasis === 'unspecified') unknownFields.push('identityBasis');
  return deepFreeze({
    personId: safeId(raw.personId, 'person.personId'),
    displayName,
    sortName: trackUnknown(unknownFields, 'sortName', safeText(raw.sortName, 'person.sortName')) ?? displayName,
    roles: roles.slice().sort(),
    identityBasis,
    provenance: provenance({ source, observedAt, unknownFields }),
  });
}

export function normalizeFacet(input, { source = 'synthetic-fixture', observedAt } = {}) {
  const raw = safeObject(input, 'facet', { required: true });
  const unknownFields = [];
  const identityBasis = isUnknown(raw.identityBasis)
    ? 'unspecified'
    : safeEnum(raw.identityBasis, DECLARED_IDENTITY_BASES, 'facet.identityBasis', { required: true });
  if (identityBasis === 'unspecified') unknownFields.push('identityBasis');
  return deepFreeze({
    facetId: safeId(raw.facetId, 'facet.facetId'),
    type: safeEnum(raw.type, FACET_TYPES, 'facet.type', { required: true }),
    name: safeText(raw.name, 'facet.name', { required: true }),
    identityBasis,
    provenance: provenance({ source, observedAt, unknownFields }),
  });
}

function normalizeViewpoint(input, unknownFields) {
  if (isUnknown(input)) {
    unknownFields.push('viewpoint');
    return UNKNOWN;
  }
  const raw = safeObject(input, 'book.viewpoint', { required: true });
  return {
    // Catalog viewpoint labels are uncertain metadata, never objective fact,
    // and never a statement about the user.
    label: safeText(raw.label, 'book.viewpoint.label', { required: true }).toLowerCase(),
    confidence: safeNumber(raw.confidence, 'book.viewpoint.confidence', { min: 0, max: 1, required: true }),
    source: safeText(raw.source, 'book.viewpoint.source', { required: true }),
    appliesTo: 'catalog-title',
    correctable: true,
  };
}

export function normalizeBook(input, { source = 'synthetic-fixture', observedAt } = {}) {
  const stripped = stripCommercialFields(safeObject(input, 'book', { required: true, maxKeys: LIMITS.objectKeys }));
  const raw = stripped.clean;
  const unknownFields = [];
  // Count only: a dropped key name is attacker-controlled source content and
  // must not reach provenance, the UI, or an export (Worf review finding W-1).
  const notes = stripped.dropped.length > 0
    ? [`dropped prohibited commercial fields at ingestion: ${stripped.dropped.length}`]
    : [];

  const book = {
    bookId: safeId(raw.bookId, 'book.bookId'),
    workId: safeId(raw.workId ?? raw.bookId, 'book.workId'),
    title: safeText(raw.title, 'book.title', { required: true }),
    subtitle: trackUnknown(unknownFields, 'subtitle', safeText(raw.subtitle, 'book.subtitle')),
    authorIds: safeIdList(raw.authorIds, 'book.authorIds'),
    narratorIds: safeIdList(raw.narratorIds, 'book.narratorIds'),
    seriesId: trackUnknown(unknownFields, 'seriesId', isUnknown(raw.seriesId) ? UNKNOWN : safeId(raw.seriesId, 'book.seriesId')),
    seriesPosition: trackUnknown(unknownFields, 'seriesPosition', safeNumber(raw.seriesPosition, 'book.seriesPosition', { min: 0, max: 999 })),
    genreIds: safeIdList(raw.genreIds, 'book.genreIds'),
    themeIds: safeIdList(raw.themeIds, 'book.themeIds'),
    topicId: trackUnknown(unknownFields, 'topicId', isUnknown(raw.topicId) ? UNKNOWN : safeId(raw.topicId, 'book.topicId')),
    language: safeText(raw.language, 'book.language', { max: 16 }) ?? 'unknown',
    durationMinutes: trackUnknown(unknownFields, 'durationMinutes', safeNumber(raw.durationMinutes, 'book.durationMinutes', { min: 0, max: 100000 })),
    releaseDate: trackUnknown(unknownFields, 'releaseDate', safeIsoDate(raw.releaseDate, 'book.releaseDate')),
    coverRef: trackUnknown(unknownFields, 'coverRef', safeText(raw.coverRef, 'book.coverRef')),
    synopsis: trackUnknown(unknownFields, 'synopsis', safeText(raw.synopsis, 'book.synopsis', { max: LIMITS.commentLength })),
    contentFlags: safeTags(raw.contentFlags, 'book.contentFlags'),
    qualityScore: trackUnknown(unknownFields, 'qualityScore', safeNumber(raw.qualityScore, 'book.qualityScore', { min: 0, max: 1 })),
    credibilityScore: trackUnknown(unknownFields, 'credibilityScore', safeNumber(raw.credibilityScore, 'book.credibilityScore', { min: 0, max: 1 })),
    viewpoint: normalizeViewpoint(raw.viewpoint, unknownFields),
    available: safeBoolean(raw.available, 'book.available') ?? false,
  };

  if (book.narratorIds.length === 0) unknownFields.push('narratorIds');

  book.provenance = provenance({
    source,
    observedAt,
    unknownFields,
    notes,
    fields: Object.fromEntries(Object.keys(book).map((f) => [f, 'source'])),
  });
  assertCommercialFree(book, `book ${book.bookId}`);
  return deepFreeze(book);
}

export function normalizeLibraryEntry(input, { source = 'synthetic-fixture', observedAt } = {}) {
  const raw = safeObject(input, 'libraryEntry', { required: true });
  const unknownFields = [];
  const entry = {
    bookId: safeId(raw.bookId, 'libraryEntry.bookId'),
    status: safeEnum(raw.status ?? 'unknown', LISTENING_STATUSES, 'libraryEntry.status', { required: true }),
    percentComplete: trackUnknown(unknownFields, 'percentComplete', safeNumber(raw.percentComplete, 'libraryEntry.percentComplete', { min: 0, max: 100 })),
    positionSeconds: trackUnknown(unknownFields, 'positionSeconds', safeNumber(raw.positionSeconds, 'libraryEntry.positionSeconds', { min: 0, max: 10_000_000 })),
    acquiredAt: trackUnknown(unknownFields, 'acquiredAt', safeIsoDate(raw.acquiredAt, 'libraryEntry.acquiredAt')),
    lastListenedAt: trackUnknown(unknownFields, 'lastListenedAt', safeIsoDate(raw.lastListenedAt, 'libraryEntry.lastListenedAt')),
    completedAt: trackUnknown(unknownFields, 'completedAt', safeIsoDate(raw.completedAt, 'libraryEntry.completedAt')),
    lastSyncedAt: safeIsoDate(observedAt ?? SYNTHETIC_NOW, 'libraryEntry.lastSyncedAt', { required: true }),
    /** Source observation instant, kept distinct from the local commit time. */
    sourceObservedAt: safeIsoDate(raw.sourceObservedAt ?? observedAt ?? SYNTHETIC_NOW, 'libraryEntry.sourceObservedAt', { required: true }),
    /** Last observation in which the source actually listed this entry. */
    lastSeenAt: safeIsoDate(raw.lastSeenAt ?? observedAt ?? SYNTHETIC_NOW, 'libraryEntry.lastSeenAt', { required: true }),
    missingFromSource: safeBoolean(raw.missingFromSource, 'libraryEntry.missingFromSource') ?? false,
  };
  entry.provenance = provenance({
    source,
    observedAt,
    unknownFields,
    fields: Object.fromEntries(SOURCE_OWNED_FIELDS.map((f) => [f, 'source'])),
  });
  return deepFreeze(entry);
}

/** Immutable catalog index built once from synthetic fixtures. */
export class Catalog {
  constructor({ people = [], facets = [], books = [] } = {}, options = {}) {
    this.people = new Map();
    this.facets = new Map();
    this.books = new Map();
    for (const p of people) {
      const person = normalizePerson(p, options);
      if (this.people.has(person.personId)) throw new ValidationError(`duplicate personId ${person.personId}`, 'personId');
      this.people.set(person.personId, person);
    }
    for (const f of facets) {
      const facet = normalizeFacet(f, options);
      if (this.facets.has(facet.facetId)) throw new ValidationError(`duplicate facetId ${facet.facetId}`, 'facetId');
      this.facets.set(facet.facetId, facet);
    }
    for (const b of books) {
      const book = normalizeBook(b, options);
      if (this.books.has(book.bookId)) throw new ValidationError(`duplicate bookId ${book.bookId}`, 'bookId');
      this.books.set(book.bookId, book);
    }
    this.#assertReferentialIntegrity();
  }

  #assertReferentialIntegrity() {
    for (const book of this.books.values()) {
      for (const id of [...book.authorIds, ...book.narratorIds]) {
        if (!this.people.has(id)) throw new ValidationError(`book ${book.bookId}: unknown person ${id}`, 'person');
      }
      for (const id of [...book.genreIds, ...book.themeIds, ...(book.seriesId ? [book.seriesId] : [])]) {
        if (!this.facets.has(id)) throw new ValidationError(`book ${book.bookId}: unknown facet ${id}`, 'facet');
      }
    }
  }

  book(bookId) { return this.books.get(bookId) ?? null; }
  person(personId) { return this.people.get(personId) ?? null; }
  facet(facetId) { return this.facets.get(facetId) ?? null; }

  personName(personId) { return this.person(personId)?.displayName ?? 'unknown'; }
  facetName(facetId) { return this.facet(facetId)?.name ?? 'unknown'; }

  /** Books in a series ordered by position; unknown positions sort last. */
  seriesBooks(seriesId) {
    return [...this.books.values()]
      .filter((b) => b.seriesId === seriesId)
      .sort((a, b) => {
        const ap = isUnknown(a.seriesPosition) ? Infinity : a.seriesPosition;
        const bp = isUnknown(b.seriesPosition) ? Infinity : b.seriesPosition;
        return ap === bp ? compareText(a.bookId, b.bookId) : ap - bp;
      });
  }
}

/**
 * Idempotent snapshot merge. Repeating the same import produces the same state,
 * never duplicates records, and never deletes local annotations (which are not
 * even reachable from here).
 */
export function mergeLibrarySnapshot(previousEntries, incomingRaw, { observedAt = SYNTHETIC_NOW, source = 'synthetic-fixture' } = {}) {
  const previous = new Map((previousEntries ?? []).map((e) => [e.bookId, e]));
  const next = new Map();
  const report = { added: [], updated: [], unchanged: [], missingFromSource: [], rejected: [] };

  for (const [recordIndex, raw] of (incomingRaw ?? []).entries()) {
    let entry;
    try {
      entry = normalizeLibraryEntry(raw, { source, observedAt });
    } catch (error) {
      // Failure isolation: one bad record must not abort the import.
      // Only a positional index and a closed-vocabulary category cross this
      // boundary — never the raw source value and never `error.message`.
      report.rejected.push({ recordIndex, category: classifyDiagnostic(error) });
      continue;
    }
    if (next.has(entry.bookId)) {
      report.rejected.push({ recordIndex, category: 'duplicate-record' });
      continue;
    }
    const before = previous.get(entry.bookId) ?? null;
    if (before && SOURCE_OWNED_FIELDS.every((f) => before[f] === entry[f]) && before.missingFromSource === false) {
      next.set(entry.bookId, deepFreeze({
        ...before,
        lastSyncedAt: entry.lastSyncedAt,
        sourceObservedAt: entry.sourceObservedAt,
        lastSeenAt: entry.lastSeenAt,
      }));
      report.unchanged.push(entry.bookId);
    } else if (before) {
      next.set(entry.bookId, entry);
      report.updated.push(entry.bookId);
    } else {
      next.set(entry.bookId, entry);
      report.added.push(entry.bookId);
    }
  }

  // Source deletions are flagged, never silently dropped.
  for (const [bookId, entry] of previous) {
    if (!next.has(bookId)) {
      next.set(bookId, deepFreeze({ ...entry, missingFromSource: true, lastSyncedAt: observedAt }));
      report.missingFromSource.push(bookId);
    }
  }

  for (const key of ['added', 'updated', 'unchanged', 'missingFromSource']) report[key].sort(compareText);
  report.rejected.sort((a, b) => a.recordIndex - b.recordIndex);
  return {
    entries: [...next.values()].sort((a, b) => compareText(a.bookId, b.bookId)),
    report: deepFreeze({ ...report, observedAt, schemaVersion: SCHEMA_VERSION }),
  };
}
