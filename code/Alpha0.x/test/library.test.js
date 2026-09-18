import test from 'node:test';
import assert from 'node:assert/strict';

import { buildLibraryView, sortLibrary, filterLibrary, facetCounts, groupLibrary, SORT_FIELDS, FILTER_FIELDS } from '../src/core/library.js';
import { Catalog, mergeLibrarySnapshot } from '../src/core/model.js';
import { ValidationError } from '../src/core/errors.js';
import { isUnknown } from '../src/core/validate.js';
import { SYNTHETIC_NOW } from '../src/version.js';
import {
  SYNTHETIC_PEOPLE, SYNTHETIC_FACETS, SYNTHETIC_BOOKS, SYNTHETIC_SNAPSHOT,
} from '../src/fixtures/synthetic.js';

const view = () => {
  const catalog = new Catalog(
    { people: SYNTHETIC_PEOPLE, facets: SYNTHETIC_FACETS, books: SYNTHETIC_BOOKS },
    { source: 'synthetic-fixture', observedAt: SYNTHETIC_NOW },
  );
  const { entries } = mergeLibrarySnapshot([], SYNTHETIC_SNAPSHOT, { observedAt: SYNTHETIC_NOW });
  return buildLibraryView(catalog, entries);
};

test('the inspector view joins catalog records to the imported snapshot', () => {
  const rows = view();
  const ring = rows.find((r) => r.bookId === 'b-ring-1');
  assert.equal(ring.status, 'completed');          // source-owned
  assert.deepEqual(ring.authors, ['Marin Ashgrove']);
  assert.deepEqual(ring.narrators, ['Del Wheatly']);
  assert.equal(ring.series, 'The Ring Bearer');
  assert.equal(ring.provenance.source, 'synthetic-fixture');
  assert.equal(ring.provenance.entrySource, 'synthetic-fixture');
});

test('the source-owned library view exposes no rating, comment, tag, or favorite column', () => {
  const deferred = ['overallRating', 'storyRating', 'performanceRating', 'favorite', 'tags', 'comment', 'comments'];
  for (const row of view()) {
    for (const field of deferred) {
      assert.equal(field in row, false, `row exposes deferred field ${field}`);
    }
  }
  for (const field of deferred) {
    assert.equal(SORT_FIELDS.includes(field), false);
    assert.equal(FILTER_FIELDS.includes(field), false);
  }
  assert.equal(FILTER_FIELDS.includes('minOverallRating'), false);
  assert.equal(FILTER_FIELDS.includes('unrated'), false);
});

test('every sort field is supported and sorting is stable and deterministic', () => {
  const rows = view();
  for (const field of SORT_FIELDS) {
    const a = sortLibrary(rows, { field }).map((r) => r.bookId);
    const b = sortLibrary(rows.slice().reverse(), { field }).map((r) => r.bookId);
    assert.deepEqual(a, b, `sort by ${field} is not order-independent`);
  }
  assert.throws(() => sortLibrary(rows, { field: 'nope' }), ValidationError);
  assert.throws(() => sortLibrary(rows, { field: 'title', direction: 'sideways' }), ValidationError);
});

test('unknown values sort last in both directions instead of pretending to be extremes', () => {
  const rows = view();
  for (const field of ['durationMinutes', 'completedAt']) {
    for (const direction of ['asc', 'desc']) {
      const sorted = sortLibrary(rows, { field, direction });
      const firstUnknown = sorted.findIndex((r) => isUnknown(r[field]));
      const lastKnown = sorted.map((r) => !isUnknown(r[field])).lastIndexOf(true);
      assert.ok(firstUnknown === -1 || firstUnknown > lastKnown, `unknown ${field} leaked to the front (${direction})`);
    }
  }
});

test('series entries sort by position with the title as the grouping key', () => {
  const ordered = sortLibrary(view(), { field: 'series', direction: 'asc' })
    .filter((r) => r.series === 'The Ring Bearer')
    .map((r) => r.seriesPosition);
  assert.deepEqual(ordered, [...ordered].sort((a, b) => a - b));
});

test('filters cover status, facets, duration, text, provenance and unknowns', () => {
  const rows = view();
  assert.deepEqual(filterLibrary(rows, { status: ['completed'] }).map((r) => r.bookId).sort(), ['b-ring-1', 'b-stars-quiet']);
  assert.deepEqual(filterLibrary(rows, { authorId: 'p-ashgrove' }).map((r) => r.bookId).sort(), ['b-ring-1', 'b-ring-2']);
  assert.deepEqual(filterLibrary(rows, { narratorId: 'p-reyes' }).map((r) => r.bookId), ['b-dungeon-1']);
  assert.deepEqual(filterLibrary(rows, { seriesId: 's-ringbearer' }).map((r) => r.bookId).sort(), ['b-ring-1', 'b-ring-2']);
  assert.deepEqual(filterLibrary(rows, { genreId: 'g-litrpg' }).map((r) => r.bookId), ['b-dungeon-1']);
  assert.deepEqual(filterLibrary(rows, { query: 'ring bearer' }).map((r) => r.bookId).sort(), ['b-ring-1', 'b-ring-2']);
  assert.deepEqual(filterLibrary(rows, { hasUnknownFields: true }).map((r) => r.bookId).includes('b-field-notes'), true);
  assert.deepEqual(filterLibrary(rows, { hasUnknownFields: false }).map((r) => r.bookId).includes('b-field-notes'), false);
  assert.equal(
    filterLibrary(rows, { hasUnknownFields: true }).length + filterLibrary(rows, { hasUnknownFields: false }).length,
    rows.length,
  );
  assert.deepEqual(filterLibrary(rows, { missingFromSource: true }).map((r) => r.bookId), []);
  assert.throws(() => filterLibrary(rows, { bogus: 1 }), ValidationError);
  assert.throws(() => filterLibrary(rows, { minOverallRating: 4 }), ValidationError);
});

test('unknown values never satisfy a numeric threshold filter', () => {
  const rows = view();
  const unknownDuration = rows.filter((r) => isUnknown(r.durationMinutes)).map((r) => r.bookId);
  assert.ok(unknownDuration.includes('b-field-notes'));
  assert.equal(filterLibrary(rows, { maxDurationMinutes: 100000 }).map((r) => r.bookId).includes('b-field-notes'), false);
});

test('facets are selectable with counts and an honest unknown bucket', () => {
  const rows = view();
  const authors = facetCounts(rows, 'authors');
  assert.deepEqual(authors[0], { value: 'Marin Ashgrove', count: 2 });
  const narrators = facetCounts(rows, 'narrators');
  assert.ok(narrators.some((f) => f.value === 'unknown' && f.count === 1));
  const series = facetCounts(rows, 'series');
  assert.ok(series.some((f) => f.value === 'unknown'));
  assert.throws(() => facetCounts(rows, 'publisher'), ValidationError);
  assert.throws(() => facetCounts(rows, 'tags'), ValidationError);
});

test('grouping produces deterministic, sorted buckets', () => {
  const rows = view();
  const groups = groupLibrary(rows, 'status').map((g) => g.value);
  assert.deepEqual(groups, [...groups].sort());
  assert.equal(groupLibrary(rows, 'series').find((g) => g.value === 'The Ring Bearer').items.length, 2);
});
