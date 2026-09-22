import test from 'node:test';
import assert from 'node:assert/strict';

import { buildLibraryView, sortLibrary, filterLibrary, facetCounts, groupLibrary, seriesPresentation, progressPresentation, SORT_FIELDS, FILTER_FIELDS, SERIES_UNKNOWN_LABEL, SERIES_STANDALONE_LABEL } from '../src/core/library.js';
import { Catalog, mergeLibrarySnapshot, normalizeLibraryEntry } from '../src/core/model.js';
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

const buildCatalog = () => new Catalog(
  { people: SYNTHETIC_PEOPLE, facets: SYNTHETIC_FACETS, books: SYNTHETIC_BOOKS },
  { source: 'synthetic-fixture', observedAt: SYNTHETIC_NOW },
);

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

test('a title with no series metadata is presented as unknown, not as a standalone', () => {
  const rows = view();
  const unknownSeries = rows.filter((r) => isUnknown(r.series));
  assert.ok(unknownSeries.length > 0, 'fixture must contain at least one title without series metadata');
  for (const row of unknownSeries) {
    // Issue #4: absence of provider metadata is not evidence of standalone.
    assert.equal(row.seriesEvidence, 'unknown');
    assert.equal(row.seriesKnown, false);
    assert.equal(row.seriesLabel, SERIES_UNKNOWN_LABEL);
    assert.notEqual(row.seriesLabel, SERIES_STANDALONE_LABEL);
  }
});

test('a provider-supplied series is labelled with its own name', () => {
  const ring = view().find((r) => r.bookId === 'b-ring-1');
  assert.equal(ring.seriesEvidence, 'provider-supplied');
  assert.equal(ring.seriesKnown, true);
  assert.equal(ring.seriesLabel, 'The Ring Bearer');
});

test('only authoritative evidence may claim a title is a standalone', () => {
  assert.equal(seriesPresentation({}).label, SERIES_UNKNOWN_LABEL);
  assert.equal(seriesPresentation({ series: null, seriesEvidence: 'unknown' }).label, SERIES_UNKNOWN_LABEL);
  // A provider-supplied claim with no series name proves nothing either.
  assert.equal(seriesPresentation({ series: null, seriesEvidence: 'provider-supplied' }).label, SERIES_UNKNOWN_LABEL);

  const standalone = seriesPresentation({ seriesEvidence: 'confirmed-standalone' });
  assert.equal(standalone.label, SERIES_STANDALONE_LABEL);
  assert.equal(standalone.known, true);
  assert.equal(standalone.positionLabel, null);

  const positioned = seriesPresentation({ series: 'The Ring Bearer', seriesEvidence: 'provider-supplied', seriesPosition: 2 });
  assert.equal(positioned.positionLabel, 'Book 2');
});

test('groups report a true total and an honest unknown-series label', () => {
  const rows = view();
  for (const group of groupLibrary(rows, 'status')) {
    assert.equal(group.total, group.items.length);
    assert.equal(typeof group.key, 'string');
  }
  const unknownSeriesGroup = groupLibrary(rows, 'series').find((g) => g.value === 'unknown');
  assert.equal(unknownSeriesGroup.label, SERIES_UNKNOWN_LABEL);
  assert.notEqual(unknownSeriesGroup.label, SERIES_STANDALONE_LABEL);
});

test('a finished status and a partial playback position are two separate facts (B2)', () => {
  const finishedButPartial = progressPresentation({
    status: 'completed',
    percentComplete: 36,
    source: 'audible-community-private-api',
  });

  // Both facts survive, individually attributable, neither rewritten.
  assert.equal(finishedButPartial.status, 'completed');
  assert.equal(finishedButPartial.percentComplete, 36);
  assert.equal(finishedButPartial.statusLabel, 'Marked finished by Audible');
  assert.equal(finishedButPartial.progressLabel, 'playback position 36%');
  assert.equal(finishedButPartial.statusProgressConflict, true);

  // The contract never hands back one pre-joined sentence.
  assert.deepEqual(finishedButPartial.parts.map((part) => part.kind), ['status', 'progress']);
  assert.equal(finishedButPartial.parts.map((part) => part.text).join(' · '),
    'Marked finished by Audible · playback position 36%');

  // Agreement is not a conflict, and 0% is a real position, not an absence.
  assert.equal(progressPresentation({ status: 'completed', percentComplete: 100, source: 'audible-community-private-api' }).statusProgressConflict, false);
  const zero = progressPresentation({ status: 'completed', percentComplete: 0, source: 'audible-community-private-api' });
  assert.equal(zero.statusProgressConflict, true);
  assert.equal(zero.progressLabel, 'playback position 0%');
  assert.equal(zero.progressKnown, true);

  // An unknown position is never printed as 0, and an unknown status never
  // borrows the provider's voice.
  const unknownProgress = progressPresentation({ status: 'in-progress', percentComplete: null, source: 'audible-community-private-api' });
  assert.equal(unknownProgress.progressKnown, false);
  assert.equal(unknownProgress.progressLabel, 'playback position unknown');
  const unknownStatus = progressPresentation({ status: 'unknown', percentComplete: 12, source: 'audible-community-private-api' });
  assert.equal(unknownStatus.statusLabel, 'Listening status unknown');
  assert.equal(unknownStatus.statusKnown, false);
  assert.equal(unknownStatus.progressLabel, 'playback position 12%');

  // An unrecognized source does not leak its token into the sentence.
  const strange = progressPresentation({ status: 'completed', percentComplete: 50, source: 'mystery-importer' });
  assert.equal(strange.statusLabel, 'Marked finished by an unknown source');
  assert.equal(strange.statusSourceLabel, 'Unknown provenance');
});

test('library rows carry the progress presentation without altering source fields (B2)', () => {
  const catalog = buildCatalog();
  const entries = [normalizeLibraryEntry({
    bookId: 'b-ring-1', status: 'completed', percentComplete: 36,
  }, { source: 'audible-community-private-api', observedAt: '2026-09-17T12:00:00.000Z' })];
  const [row] = buildLibraryView(catalog, entries);

  assert.equal(row.status, 'completed', 'source status is untouched');
  assert.equal(row.percentComplete, 36, 'source progress is untouched');
  assert.equal(row.progress.statusLabel, 'Marked finished by Audible');
  assert.equal(row.progress.progressLabel, 'playback position 36%');
  assert.equal(row.progress.statusProgressConflict, true);
  assert.equal(Object.isFrozen(row.progress), true);
});

test('a prototype key is not a listening status (B2)', () => {
  for (const hostile of ['constructor', 'toString', '__proto__', 'hasOwnProperty']) {
    const resolved = progressPresentation({ status: hostile, percentComplete: 10, source: 'audible-community-private-api' });
    assert.equal(resolved.statusLabel, 'Listening status unknown', hostile);
  }
});
