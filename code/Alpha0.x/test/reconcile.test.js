import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ReconcileError,
  canonicalSnapshotJson,
  reconcileSnapshot,
  semanticDigest,
} from '../src/sync/reconcile.js';

function book(id) {
  return {
    bookId: id,
    workId: `${id}-work`,
    title: `Synthetic ${id}`,
    authorIds: ['aud-us-person-one'],
    narratorIds: ['aud-us-person-one'],
    genreIds: ['aud-us-genre-one'],
    themeIds: [],
    seriesId: null,
    language: 'en',
    available: true,
  };
}

function snapshot(ids, observedAt) {
  return {
    schemaVersion: 1,
    source: 'audible-community-private-api',
    marketplace: 'us',
    observedAt,
    catalog: {
      people: [{ personId: 'aud-us-person-one', name: 'Synthetic Person', roles: ['author', 'narrator'] }],
      facets: [{ facetId: 'aud-us-genre-one', type: 'genre', name: 'Synthetic Genre' }],
      books: ids.map(book),
    },
    entries: ids.map((id) => ({ bookId: id, status: 'not-started', percentComplete: null })),
  };
}

const DAY_ONE = '2026-09-17T12:00:00.000Z';
const DAY_TWO = '2026-09-18T12:00:00.000Z';
const DAY_THREE = '2026-09-19T12:00:00.000Z';

test('a first import has nothing to reconcile against', () => {
  const { snapshot: result, report } = reconcileSnapshot({
    previous: null,
    candidate: snapshot(['aud-us-book-one'], DAY_ONE),
    complete: true,
  });
  assert.equal(result.entries.length, 1);
  assert.deepEqual(report.added, ['aud-us-book-one']);
  assert.deepEqual(report.missingFromSource, []);
  assert.equal(result.entries[0].lastSeenAt, DAY_ONE);
});

test('a book the source stopped listing is retained, flagged, and keeps its catalog records', () => {
  const previous = reconcileSnapshot({
    previous: null,
    candidate: snapshot(['aud-us-book-one', 'aud-us-book-two'], DAY_ONE),
    complete: true,
  }).snapshot;

  const { snapshot: result, report } = reconcileSnapshot({
    previous,
    candidate: snapshot(['aud-us-book-one'], DAY_TWO),
    complete: true,
  });
  assert.equal(result.entries.length, 2, 'removal at the source is not deletion of the record');
  const retained = result.entries.find((e) => e.bookId === 'aud-us-book-two');
  assert.equal(retained.missingFromSource, true);
  assert.equal(retained.lastSeenAt, DAY_ONE, 'lastSeenAt freezes at the last observation that listed it');
  assert.equal(retained.sourceObservedAt, DAY_TWO);
  assert.deepEqual(report.missingFromSource, ['aud-us-book-two']);
  assert.ok(result.catalog.books.some((b) => b.bookId === 'aud-us-book-two'));
  assert.ok(result.catalog.people.some((p) => p.personId === 'aud-us-person-one'));
});

test('a verified reappearance clears the flag and advances lastSeenAt', () => {
  const day1 = reconcileSnapshot({ previous: null, candidate: snapshot(['a1', 'a2'], DAY_ONE), complete: true }).snapshot;
  const day2 = reconcileSnapshot({ previous: day1, candidate: snapshot(['a1'], DAY_TWO), complete: true }).snapshot;
  const { snapshot: day3, report } = reconcileSnapshot({
    previous: day2,
    candidate: snapshot(['a1', 'a2'], DAY_THREE),
    complete: true,
  });
  const back = day3.entries.find((e) => e.bookId === 'a2');
  assert.equal(back.missingFromSource, false);
  assert.equal(back.lastSeenAt, DAY_THREE);
  assert.deepEqual(report.reappeared, ['a2']);
});

test('a retained entry stays retained across many captures without duplicating', () => {
  let current = reconcileSnapshot({ previous: null, candidate: snapshot(['a1', 'a2'], DAY_ONE), complete: true }).snapshot;
  for (const day of [DAY_TWO, DAY_THREE, '2026-09-20T12:00:00.000Z']) {
    current = reconcileSnapshot({ previous: current, candidate: snapshot(['a1'], day), complete: true }).snapshot;
  }
  assert.equal(current.entries.length, 2);
  assert.equal(current.entries.filter((e) => e.bookId === 'a2').length, 1);
  assert.equal(current.entries.find((e) => e.bookId === 'a2').lastSeenAt, DAY_ONE);
});

test('an incomplete capture is never reconciled', () => {
  assert.throws(
    () => reconcileSnapshot({ previous: null, candidate: snapshot(['a1'], DAY_ONE), complete: false }),
    (error) => error instanceof ReconcileError && error.code === 'incomplete-capture-not-reconcilable',
  );
});

test('a dangling entry or an unqualified instant is refused', () => {
  const broken = snapshot(['a1'], DAY_ONE);
  broken.entries.push({ bookId: 'not-in-catalog', status: 'not-started' });
  assert.throws(
    () => reconcileSnapshot({ previous: null, candidate: broken, complete: true }),
    (error) => error.code === 'entry-book-missing',
  );

  const noPerson = snapshot(['a1'], DAY_ONE);
  noPerson.catalog.people = [];
  assert.throws(
    () => reconcileSnapshot({ previous: null, candidate: noPerson, complete: true }),
    (error) => error.code === 'book-person-missing',
  );

  assert.throws(
    () => reconcileSnapshot({ previous: null, candidate: snapshot(['a1'], '2026-09-17 12:00:00'), complete: true }),
    (error) => error.code === 'observed-at-invalid',
  );
});

test('a duplicated entry in the candidate is refused, never silently merged', () => {
  const duplicated = snapshot(['a1'], DAY_ONE);
  duplicated.entries.push({ bookId: 'a1', status: 'finished' });
  assert.throws(
    () => reconcileSnapshot({ previous: null, candidate: duplicated, complete: true }),
    (error) => error.code === 'candidate-duplicate-entry',
  );
});

test('the semantic digest ignores declared freshness but not real content', () => {
  const a = snapshot(['a1'], DAY_ONE);
  const b = snapshot(['a1'], DAY_TWO);
  assert.equal(semanticDigest(a), semanticDigest(b), 'a new observation time alone is not a change');

  const changed = snapshot(['a1'], DAY_ONE);
  changed.entries[0].status = 'finished';
  assert.notEqual(semanticDigest(a), semanticDigest(changed));

  const reordered = snapshot(['a1'], DAY_ONE);
  reordered.catalog.books[0] = Object.fromEntries(Object.entries(reordered.catalog.books[0]).reverse());
  assert.equal(semanticDigest(a), semanticDigest(reordered), 'key order is not content');
  assert.equal(canonicalSnapshotJson(a).includes('observedAt'), false);
});

test('reconciliation is deterministic: the same inputs give the same digest', () => {
  const previous = snapshot(['a1', 'a2'], DAY_ONE);
  const first = reconcileSnapshot({ previous, candidate: snapshot(['a1'], DAY_TWO), complete: true });
  const second = reconcileSnapshot({ previous, candidate: snapshot(['a1'], DAY_TWO), complete: true });
  assert.equal(first.digest, second.digest);
  assert.deepEqual(first.snapshot.entries.map((e) => e.bookId), second.snapshot.entries.map((e) => e.bookId));
});
