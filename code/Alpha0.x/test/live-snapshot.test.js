import test from 'node:test';
import assert from 'node:assert/strict';

import { validateLiveSnapshot } from '../src/sync/live-snapshot.js';

function liveSnapshot() {
  return {
    schemaVersion: 1,
    source: 'audible-community-private-api',
    marketplace: 'us',
    observedAt: '2026-09-17T12:00:00.000Z',
    catalog: {
      people: [],
      facets: [],
      books: [{
        bookId: 'aud-us-book-synthetic',
        workId: 'aud-us-work-synthetic',
        title: 'Synthetic Live Book',
        authorIds: [],
        narratorIds: [],
        genreIds: [],
        themeIds: [],
        language: 'en',
        available: true,
      }],
    },
    entries: [{
      bookId: 'aud-us-book-synthetic',
      status: 'in-progress',
      percentComplete: 25,
    }],
  };
}

test('validates a closed private-Audible snapshot through the existing core', () => {
  const result = validateLiveSnapshot(liveSnapshot());
  assert.equal(result.catalog.books.size, 1);
  assert.equal(result.entries.length, 1);
  assert.equal(result.entries[0].provenance.source, 'audible-community-private-api');
});

test('rejects unknown top-level fields and unsupported marketplaces', () => {
  assert.throws(
    () => validateLiveSnapshot({ ...liveSnapshot(), token: 'synthetic' }),
    /unknown field/,
  );
  assert.throws(
    () => validateLiveSnapshot({ ...liveSnapshot(), marketplace: 'uk' }),
    /expected us/,
  );
});
