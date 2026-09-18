import test from 'node:test';
import assert from 'node:assert/strict';

import { ABSENT_REVISION } from '../src/store/feedback-store.js';
import { PrivateAppStore } from '../ui/js/private-store.js';

function liveSnapshot() {
  return {
    schemaVersion: 1,
    source: 'audible-community-private-api',
    marketplace: 'us',
    observedAt: '2026-09-17T12:00:00.000Z',
    catalog: {
      people: [
        { personId: 'p-alpha', displayName: 'Alpha Author', roles: ['author'] },
        { personId: 'p-beta', displayName: 'Beta Author', roles: ['author'] },
        { personId: 'p-narrator', displayName: 'Narrator One', roles: ['narrator'] },
      ],
      facets: [
        { facetId: 's-private-series', type: 'series', name: 'Private Series' },
      ],
      books: [
        {
          bookId: 'aud-us-book-one',
          workId: 'aud-us-book-one-work',
          title: 'Book One',
          authorIds: ['p-alpha', 'p-beta'],
          narratorIds: ['p-narrator'],
          genreIds: [],
          themeIds: [],
          seriesId: 's-private-series',
          seriesPosition: 1,
          language: 'en',
          available: true,
        },
        {
          bookId: 'aud-us-book-two',
          workId: 'aud-us-book-two-work',
          title: 'Book Two',
          authorIds: ['p-alpha'],
          narratorIds: [],
          genreIds: [],
          themeIds: [],
          language: 'en',
          available: true,
        },
      ],
    },
    entries: [
      { bookId: 'aud-us-book-one', status: 'completed', percentComplete: 100 },
      { bookId: 'aud-us-book-two', status: 'not-started' },
    ],
  };
}

function connectionApi() {
  const state = new Map();
  const calls = [];
  return {
    calls,
    feedbackGet: async (bookId) => {
      calls.push(['get', bookId]);
      return state.get(bookId) ?? { bookId, record: null, revision: ABSENT_REVISION, generation: 0, deleted: false };
    },
    feedbackSave: async (bookId, payload, expectedRevision) => {
      calls.push(['save', bookId, payload, expectedRevision]);
      const result = {
        bookId,
        revision: expectedRevision === ABSENT_REVISION ? 'rev-1' : 'rev-2',
        generation: expectedRevision === ABSENT_REVISION ? 1 : 2,
        deleted: false,
        record: {
          overallRating: payload.overallRating ?? null,
          storyRating: payload.storyRating ?? null,
          narrationRating: payload.narrationRating ?? null,
          comment: payload.comment ?? null,
          tags: payload.tags ?? [],
          createdAt: '2026-09-17T12:00:00.000Z',
          updatedAt: '2026-09-17T12:05:00.000Z',
        },
      };
      state.set(bookId, result);
      return result;
    },
    feedbackDelete: async (bookId, expectedRevision) => {
      calls.push(['delete', bookId, expectedRevision]);
      const result = { bookId, revision: 'rev-3', generation: 3, deleted: true, record: null };
      state.set(bookId, result);
      return result;
    },
  };
}

test('private store keeps one draft per book across duplicate grouped appearances', async () => {
  const api = connectionApi();
  const store = new PrivateAppStore({
    liveSnapshot: liveSnapshot(),
    connectionApi: api,
    connectionInfo: { connected: true, local: { hasLocalSnapshot: true } },
  });

  store.setLibrarySession({ groupBy: 'authors' });
  const grouped = store.queryLibrary().groups;
  assert.equal(grouped.length, 2);
  assert.equal(grouped[0].items.some((row) => row.bookId === 'aud-us-book-one'), true);
  assert.equal(grouped[1].items.some((row) => row.bookId === 'aud-us-book-one'), true);

  const opened = await store.openFeedbackEditor('aud-us-book-one');
  assert.equal(opened.status, 'opened');
  assert.equal(store.librarySession.activeEditorBookId, 'aud-us-book-one');
  assert.equal(store.activeDraftFor('aud-us-book-one').bookId, 'aud-us-book-one');
  assert.equal(store.activeDraftFor('aud-us-book-two'), null);
});

test('private store preserves grouping, collapse, focus, and scroll across a save', async () => {
  const api = connectionApi();
  const store = new PrivateAppStore({
    liveSnapshot: liveSnapshot(),
    connectionApi: api,
    connectionInfo: { connected: true, local: { hasLocalSnapshot: true } },
  });

  store.setLibrarySession({ groupBy: 'authors' });
  store.queryLibrary();
  store.collapseAllGroups();
  await store.openFeedbackEditor('aud-us-book-one');
  store.noteReturnFocus('aud-us-book-one');
  store.noteScrollPosition(240);
  store.updateFeedbackDraft({ overallRating: 4.5, comment: 'Held up well', tagsText: 'favorite, revisit' });

  const result = await store.saveFeedbackDraft();
  assert.equal(result.ok, true);
  assert.equal(store.librarySession.groupBy, 'authors');
  assert.ok(store.librarySession.collapsedGroupKeys.length > 0);
  assert.equal(store.librarySession.returnFocusBookId, 'aud-us-book-one');
  assert.equal(store.librarySession.scrollTop, 240);
  assert.equal(store.librarySession.activeEditorBookId, 'aud-us-book-one');
  assert.equal(store.librarySession.draftDirty, false);
  assert.equal(store.activeDraftFor('aud-us-book-one').saved, true);
});

test('private feedback filters and unrated-last sorting behave honestly', () => {
  const api = connectionApi();
  const store = new PrivateAppStore({
    liveSnapshot: liveSnapshot(),
    connectionApi: api,
    connectionInfo: { connected: true, local: { hasLocalSnapshot: true } },
  });

  store.feedbackByBookId.set('aud-us-book-one', {
    bookId: 'aud-us-book-one',
    revision: 'rev-1',
    generation: 1,
    deleted: false,
    record: { overallRating: 4.5, storyRating: null, narrationRating: null, comment: 'Thoughtful', tags: ['favorite'], createdAt: '2026-09-17T12:00:00.000Z', updatedAt: '2026-09-17T12:00:00.000Z' },
  });

  store.setLibrarySession({ overallRatingFilter: 'rated', hasComment: true, tagQuery: 'fav', sortField: 'overallRating', sortDirection: 'asc' });
  const filtered = store.queryLibrary();
  assert.deepEqual(filtered.rows.map((row) => row.bookId), ['aud-us-book-one']);

  store.setLibrarySession({ overallRatingFilter: 'any', hasComment: false, tagQuery: '', sortField: 'overallRating', sortDirection: 'desc' });
  const sorted = store.queryLibrary();
  assert.deepEqual(sorted.rows.map((row) => row.bookId), ['aud-us-book-one', 'aud-us-book-two']);
});

test('a dirty draft blocks switching to another book until the current draft is resolved', async () => {
  const api = connectionApi();
  const store = new PrivateAppStore({
    liveSnapshot: liveSnapshot(),
    connectionApi: api,
    connectionInfo: { connected: true, local: { hasLocalSnapshot: true } },
  });

  await store.openFeedbackEditor('aud-us-book-one');
  store.updateFeedbackDraft({ overallRating: 3.5 });
  const blocked = await store.openFeedbackEditor('aud-us-book-two');
  assert.equal(blocked.status, 'blocked-dirty');
  assert.equal(blocked.activeBookId, 'aud-us-book-one');
});
