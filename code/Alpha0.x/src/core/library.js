/**
 * Evidence-inspector projection: a sortable, filterable read-only view of the
 * normalized catalog joined to the imported library snapshot (ATR-S008 slice of
 * ATR-PR15 — minimal inspector only).
 *
 * There is deliberately no rating, comment, tag, or favorite column here: that
 * product surface is deferred (ATR-PR12). Unknown values are never faked. They
 * sort last in both directions, never satisfy a threshold filter, and are
 * reported through `unknownFields`.
 */

import { UNKNOWN, isUnknown, compareText, deepFreeze, safeObject, safeText } from './validate.js';
import { ValidationError } from './errors.js';

export const SORT_FIELDS = Object.freeze([
  'title', 'author', 'narrator', 'series', 'genre', 'status',
  'percentComplete', 'acquiredAt', 'lastListenedAt', 'completedAt', 'durationMinutes',
]);

export const FACET_FIELDS = Object.freeze(['authors', 'narrators', 'genres', 'series', 'status']);

export const FILTER_FIELDS = Object.freeze([
  'status', 'authorId', 'narratorId', 'seriesId', 'genreId',
  'maxDurationMinutes', 'query', 'hasUnknownFields', 'missingFromSource',
]);

const STATUS_ORDER = Object.freeze({
  'in-progress': 0, 'not-started': 1, 'want-to-listen': 2, completed: 3, abandoned: 4, unknown: 5,
});

const names = (catalog, ids, lookup) => ids.map((id) => catalog[lookup](id)).sort(compareText);

/**
 * Joins source-owned records only. Locally owned feedback lives in the
 * encrypted private store and is never merged into this view.
 */
export function buildLibraryView(catalog, entries) {
  const rows = [];
  for (const entry of entries) {
    const book = catalog.book(entry.bookId);
    if (!book) continue;
    rows.push(deepFreeze({
      bookId: book.bookId,
      workId: book.workId,
      title: book.title,
      subtitle: book.subtitle,
      authorIds: book.authorIds,
      narratorIds: book.narratorIds,
      genreIds: book.genreIds,
      seriesId: book.seriesId,
      authors: names(catalog, book.authorIds, 'personName'),
      narrators: names(catalog, book.narratorIds, 'personName'),
      genres: names(catalog, book.genreIds, 'facetName'),
      series: book.seriesId ? catalog.facetName(book.seriesId) : UNKNOWN,
      seriesPosition: book.seriesPosition,
      durationMinutes: book.durationMinutes,
      language: book.language,
      status: entry.status,
      percentComplete: entry.percentComplete,
      acquiredAt: entry.acquiredAt,
      lastListenedAt: entry.lastListenedAt,
      completedAt: entry.completedAt,
      missingFromSource: entry.missingFromSource,
      unknownFields: [...new Set([...book.provenance.unknownFields, ...entry.provenance.unknownFields])].sort(compareText),
      provenance: { source: book.provenance.source, entrySource: entry.provenance.source },
    }));
  }
  return rows.sort((a, b) => compareText(a.bookId, b.bookId));
}

function sortValue(row, field) {
  switch (field) {
    case 'title': return row.title;
    case 'author': return row.authors[0] ?? UNKNOWN;
    case 'narrator': return row.narrators[0] ?? UNKNOWN;
    case 'genre': return row.genres[0] ?? UNKNOWN;
    case 'series': return row.series;
    case 'status': return isUnknown(row.status) ? UNKNOWN : STATUS_ORDER[row.status];
    default: return row[field];
  }
}

/**
 * Stable sort. Unknown values are always placed last, regardless of direction,
 * so "missing" never masquerades as "lowest" or "highest".
 */
export function sortLibrary(rows, { field = 'title', direction = 'asc', secondary = 'seriesPosition' } = {}) {
  if (!SORT_FIELDS.includes(field)) throw new ValidationError(`sort.field: expected one of ${SORT_FIELDS.join(', ')}`, 'sort.field');
  if (!['asc', 'desc'].includes(direction)) throw new ValidationError('sort.direction: expected asc or desc', 'sort.direction');
  const sign = direction === 'asc' ? 1 : -1;

  const compare = (a, b, f) => {
    const av = sortValue(a, f);
    const bv = sortValue(b, f);
    const aUnknown = isUnknown(av);
    const bUnknown = isUnknown(bv);
    if (aUnknown && bUnknown) return 0;
    if (aUnknown) return 1;   // unknown last
    if (bUnknown) return -1;
    if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * sign;
    return compareText(String(av), String(bv)) * sign;
  };

  return rows.slice().sort((a, b) => {
    const primary = compare(a, b, field);
    if (primary !== 0) return primary;
    if (secondary && field !== secondary && SORT_FIELDS.concat('seriesPosition').includes(secondary)) {
      const sec = compare(a, b, secondary);
      if (sec !== 0) return sec;
    }
    return compareText(a.bookId, b.bookId); // deterministic tie-break
  });
}

export function filterLibrary(rows, criteria = {}) {
  const raw = safeObject(criteria, 'filter', { required: true });
  for (const k of Object.keys(raw)) {
    if (!FILTER_FIELDS.includes(k)) throw new ValidationError(`filter.${k}: unsupported field`, `filter.${k}`);
  }
  const query = 'query' in raw ? (safeText(raw.query, 'filter.query') ?? '').toLowerCase() : null;

  return rows.filter((row) => {
    if ('status' in raw) {
      const wanted = Array.isArray(raw.status) ? raw.status : [raw.status];
      if (!wanted.includes(row.status)) return false;
    }
    if ('authorId' in raw && !row.authorIds.includes(raw.authorId)) return false;
    if ('narratorId' in raw && !row.narratorIds.includes(raw.narratorId)) return false;
    if ('genreId' in raw && !row.genreIds.includes(raw.genreId)) return false;
    if ('seriesId' in raw && row.seriesId !== raw.seriesId) return false;
    if ('hasUnknownFields' in raw && (row.unknownFields.length > 0) !== Boolean(raw.hasUnknownFields)) return false;
    if ('missingFromSource' in raw && row.missingFromSource !== Boolean(raw.missingFromSource)) return false;
    if ('maxDurationMinutes' in raw) {
      if (isUnknown(row.durationMinutes)) return false;   // unknown never satisfies a threshold
      if (row.durationMinutes > raw.maxDurationMinutes) return false;
    }
    if (query) {
      const haystack = [row.title, row.subtitle ?? '', ...row.authors, ...row.narrators, row.series ?? '']
        .join(' ').toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    return true;
  });
}

/** Selectable facets with counts; `unknown` is surfaced honestly as its own bucket. */
export function facetCounts(rows, field) {
  if (!FACET_FIELDS.includes(field)) throw new ValidationError(`facet: expected one of ${FACET_FIELDS.join(', ')}`, 'facet');
  const counts = new Map();
  for (const row of rows) {
    let values;
    if (field === 'series') values = [row.series ?? 'unknown'];
    else if (field === 'status') values = [row.status];
    else values = row[field].length > 0 ? row[field] : ['unknown'];
    for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => (b.count - a.count) || compareText(a.value, b.value));
}

export function groupLibrary(rows, field) {
  const groups = new Map();
  for (const row of rows) {
    let value;
    if (field === 'series') value = row.series ?? 'unknown';
    else if (field === 'status') value = row.status;
    else value = String(sortValue(row, field) ?? 'unknown');
    if (!groups.has(value)) groups.set(value, []);
    groups.get(value).push(row);
  }
  return [...groups.entries()]
    .map(([value, items]) => ({ value, items }))
    .sort((a, b) => compareText(a.value, b.value));
}
