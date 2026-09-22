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
    feedbackList: async () => {
      calls.push(['list']);
      return [...state.values()];
    },
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

test('author and narrator groups use distinct encrypted feedback targets', async () => {
  const api = connectionApi();
  const store = new PrivateAppStore({
    liveSnapshot: liveSnapshot(),
    connectionApi: api,
    connectionInfo: { connected: true, local: { hasLocalSnapshot: true } },
  });

  store.setLibrarySession({ groupBy: 'authors' });
  const authorGroup = store.queryLibrary().groups[0];
  const authorTarget = store.groupFeedbackTarget(authorGroup);
  assert.match(authorTarget.targetId, /^person:author:/);

  const opened = await store.openGroupFeedbackEditor(authorGroup);
  assert.equal(opened.status, 'opened');
  assert.equal(store.activeDraftFor(authorTarget.targetId).targetType, 'group');
  store.updateFeedbackDraft({ overallRating: 4.5, comment: 'Consistently strong work' });
  const saved = await store.saveFeedbackDraft();
  assert.equal(saved.ok, true);

  // Asserted semantically, not positionally: opening a target now also reads
  // its legacy aliases, so the *number* and order of reads is an
  // implementation detail. What must hold is where the write went.
  const writes = api.calls.filter(([verb]) => verb === 'save' || verb === 'delete');
  assert.equal(writes.length, 1, 'exactly one write per save');
  assert.deepEqual(writes[0].slice(0, 2), ['save', authorTarget.targetId]);

  // Alias lookups are reads only. A legacy identifier must never be written
  // to, and must never receive this group's review.
  const aliasIds = new Set(authorTarget.aliasTargetIds);
  assert.ok(aliasIds.size > 0, 'this group has legacy identifiers to check');
  assert.equal(aliasIds.has(authorTarget.targetId), false, 'canonical id is not one of its own aliases');
  for (const [verb, target] of api.calls) {
    if (aliasIds.has(target)) {
      assert.equal(verb, 'get', `alias ${target} was written to with ${verb}`);
    }
  }
  const reads = api.calls.filter(([verb]) => verb === 'get').map(([, target]) => target);
  for (const target of reads) {
    assert.ok(
      target === authorTarget.targetId || aliasIds.has(target),
      `read an unrelated target ${target}`,
    );
  }
  assert.equal(store.activeDraftFor(authorTarget.targetId).targetLabel, authorGroup.label);

  store.discardFeedbackDraft();
  store.setLibrarySession({ groupBy: 'narrators' });
  const narratorTarget = store.groupFeedbackTarget(store.queryLibrary().groups[0]);
  assert.match(narratorTarget.targetId, /^person:narrator:/);
  assert.notEqual(narratorTarget.targetId, authorTarget.targetId);
});

test('repeated name-only narrator identities form one display group without duplicate books', () => {
  const snapshot = liveSnapshot();
  snapshot.catalog.people.push({
    personId: 'p-narrator-occurrence-two',
    displayName: '  NARRATOR   ONE  ',
    roles: ['narrator'],
    identityBasis: 'source-record-occurrence',
  });
  snapshot.catalog.books[1].narratorIds = ['p-narrator-occurrence-two'];
  const store = new PrivateAppStore({
    liveSnapshot: snapshot,
    connectionApi: connectionApi(),
    connectionInfo: { connected: true, local: { hasLocalSnapshot: true } },
  });

  store.setLibrarySession({ groupBy: 'narrators' });
  const groups = store.queryLibrary().groups;
  assert.equal(groups.length, 1);
  assert.deepEqual(groups[0].items.map((row) => row.bookId).sort(), ['aud-us-book-one', 'aud-us-book-two']);
  assert.deepEqual(groups[0].personIds, ['p-narrator', 'p-narrator-occurrence-two']);
  assert.match(groups[0].key, /^narrator-label:[a-f0-9]{16}$/);
  const target = store.groupFeedbackTarget(groups[0]);
  assert.match(target.targetId, /^person:narrator:display-[a-f0-9]{16}$/);
  assert.equal(target.sourceIdentityCount, 2);
});

test('a canonical series group has its own encrypted feedback target', async () => {
  const api = connectionApi();
  const store = new PrivateAppStore({
    liveSnapshot: liveSnapshot(),
    connectionApi: api,
    connectionInfo: { connected: true, local: { hasLocalSnapshot: true } },
  });
  store.setLibrarySession({ groupBy: 'series' });
  const seriesGroup = store.queryLibrary().groups.find((group) => group.key !== 'series:unknown');
  const target = store.groupFeedbackTarget(seriesGroup);
  assert.deepEqual(target, {
    targetId: 'series:s-private-series',
    kind: 'series',
    label: 'Private Series',
    sourceIdentityCount: 0,
  });

  const opened = await store.openGroupFeedbackEditor(seriesGroup);
  assert.equal(opened.status, 'opened');
  store.updateFeedbackDraft({ overallRating: 5, comment: 'Strong throughout' });
  const saved = await store.saveFeedbackDraft();
  assert.equal(saved.ok, true);
  assert.equal(api.calls[0][1], 'series:s-private-series');
  assert.equal(api.calls[1][1], 'series:s-private-series');
  assert.equal(store.feedbackFor('aud-us-book-one').record, null);
});

test('unknown person groups never expose a review target', () => {
  const store = new PrivateAppStore({
    liveSnapshot: liveSnapshot(),
    connectionApi: connectionApi(),
    connectionInfo: { connected: true, local: { hasLocalSnapshot: true } },
  });
  assert.equal(store.groupFeedbackTarget({ field: 'authors', key: 'author:unknown', label: 'Unknown author' }), null);
  assert.equal(store.groupFeedbackTarget({ field: 'series', key: 'series:unknown', label: 'Unknown series' }), null);
  assert.equal(store.groupFeedbackTarget({ field: 'status', key: 'status:completed', label: 'Completed' }), null);
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

test('an unknown series is presented as unknown in rows, groups and book detail', () => {
  const store = new PrivateAppStore({ liveSnapshot: liveSnapshot(), connectionInfo: { connected: true } });
  const rows = store.libraryRows();

  const inSeries = rows.find((row) => row.bookId === 'aud-us-book-one');
  assert.equal(inSeries.seriesEvidence, 'provider-supplied');
  assert.equal(inSeries.seriesLabel, 'Private Series');
  assert.equal(inSeries.seriesKnown, true);

  const noSeries = rows.find((row) => row.bookId === 'aud-us-book-two');
  assert.equal(noSeries.seriesEvidence, 'unknown');
  assert.equal(noSeries.seriesLabel, 'Series unknown');
  assert.equal(noSeries.seriesKnown, false);
  assert.notEqual(noSeries.seriesLabel, 'Not part of a series');

  // The detail pane must not contradict the row.
  assert.equal(store.bookDetail('aud-us-book-two').seriesLabel, 'Series unknown');
  assert.equal(store.bookDetail('aud-us-book-one').seriesLabel, 'Private Series');
  assert.equal(store.bookDetail('aud-us-book-one').seriesPositionLabel, 'Book 1');

  store.setLibrarySession({ groupBy: 'series' });
  const unknownGroup = store.queryLibrary().groups.find((group) => group.key === 'series:unknown');
  assert.equal(unknownGroup.label, 'Series unknown');
  assert.equal(unknownGroup.total, 1);
});

test('the private store reports connection state separately from credential custody', () => {
  const held = new PrivateAppStore({ liveSnapshot: liveSnapshot(), connectionInfo: { connected: true } });
  assert.equal(held.summary().connectionStatus, 'connected', 'custody is unchanged');
  assert.equal(held.summary().connectionState, 'unverified', 'but nothing has been verified');
  assert.equal(held.connectionState.verified, false);

  const verified = new PrivateAppStore({
    liveSnapshot: liveSnapshot(),
    connectionInfo: { connected: true, connectionState: 'verified', lastVerifiedAt: '2026-09-17T12:00:00.000Z' },
  });
  assert.equal(verified.summary().connectionState, 'verified');
  assert.equal(verified.connectionState.lastVerifiedAt, '2026-09-17T12:00:00.000Z');

  const none = new PrivateAppStore({ liveSnapshot: liveSnapshot(), connectionInfo: null });
  assert.equal(none.summary().connectionState, 'disconnected');
});

test('a small private library is returned whole, with page metadata that says so', () => {
  const store = new PrivateAppStore({ liveSnapshot: liveSnapshot(), connectionInfo: { connected: true } });
  const result = store.queryLibrary();
  assert.equal(result.rows.length, 2);
  assert.equal(result.matched, 2);
  assert.equal(result.total, 2);
  assert.equal(result.pagination.pageCount, 1);
  assert.equal(result.pagination.hasNext, false);
  assert.match(result.summary, /Showing 1–2 of 2 private library titles \(page 1 of 1\)\./);
});

/** A second provider identity carrying the same display name as `p-alpha`. */
function snapshotWithDuplicateAuthor() {
  const snapshot = liveSnapshot();
  snapshot.catalog.people.push({
    personId: 'p-alpha-occurrence-two',
    displayName: '  ALPHA   AUTHOR  ',
    roles: ['author'],
    identityBasis: 'source-record-occurrence',
  });
  snapshot.catalog.books[1].authorIds = ['p-alpha-occurrence-two'];
  return snapshot;
}

const authorGroupOf = (store) => {
  store.setLibrarySession({ groupBy: 'authors' });
  return store.queryLibrary().groups.find((group) => group.label.trim().toLowerCase() === 'alpha author');
};

test('a group feedback target does not move when a sync adds or removes a duplicate identity', () => {
  const single = new PrivateAppStore({ liveSnapshot: liveSnapshot(), connectionInfo: { connected: true } });
  const before = store_target(single);

  // A later sync introduces a second source identity for the same name.
  single.loadPrivateSnapshot(snapshotWithDuplicateAuthor(), { connected: true });
  const merged = store_target(single);
  assert.equal(merged.sourceIdentityCount, 2);
  assert.equal(merged.targetId, before.targetId, 'feedback identity must survive a merge');

  // And a later sync drops it again.
  single.loadPrivateSnapshot(liveSnapshot(), { connected: true });
  const split = store_target(single);
  assert.equal(split.sourceIdentityCount, 1);
  assert.equal(split.targetId, before.targetId, 'feedback identity must survive a split');

  // The identity is a display identity, never a source identifier.
  assert.match(before.targetId, /^person:author:display-[a-f0-9]{16}$/);
  assert.equal(before.targetId.includes('p-alpha'), false);
});

function store_target(store) {
  return store.groupFeedbackTarget(authorGroupOf(store));
}

test('feedback written under the legacy per-identity scheme survives and is migrated once', async () => {
  const api = connectionApi();
  const legacyId = 'person:author:p-alpha';
  // Simulate a record saved by the previous scheme, when the group had one
  // source identity.
  await api.feedbackSave(legacyId, { overallRating: 5, comment: 'Legacy review', tags: ['keep'] }, ABSENT_REVISION);
  api.calls.length = 0;

  const store = new PrivateAppStore({
    liveSnapshot: liveSnapshot(),
    connectionApi: api,
    connectionInfo: { connected: true },
  });
  const target = store_target(store);
  assert.ok(target.aliasTargetIds.includes(legacyId));

  // The legacy record is found and shown under the canonical target.
  const opened = await store.openGroupFeedbackEditor(authorGroupOf(store));
  assert.equal(opened.status, 'opened');
  assert.equal(opened.aliasSourceId, legacyId);
  const draft = store.activeDraftFor(target.targetId);
  assert.equal(draft.original.comment, 'Legacy review');
  assert.equal(draft.draft.comment, 'Legacy review');
  assert.equal(draft.revision, ABSENT_REVISION, 'the canonical target is still unwritten');

  const saved = await store.saveFeedbackDraft();
  assert.equal(saved.ok, true);
  assert.equal(saved.saved.bookId, target.targetId);
  assert.equal(saved.saved.record.comment, 'Legacy review', 'content is carried, not lost');
  assert.deepEqual(saved.aliasMigration, { ok: true, from: legacyId, code: null });

  // Canonical first, alias retired second - never the other way round.
  const writes = api.calls.filter(([verb]) => verb !== 'get');
  assert.deepEqual(writes.map(([verb, id]) => [verb, id]), [
    ['save', target.targetId],
    ['delete', legacyId],
  ]);
  // The alias delete used the alias's own revision, not a fabricated one.
  assert.notEqual(writes[1][2], ABSENT_REVISION);

  // A later sync that merges a duplicate identity still finds the record.
  store.loadPrivateSnapshot(snapshotWithDuplicateAuthor(), { connected: true });
  const after = store.groupFeedback(authorGroupOf(store));
  assert.equal(after.targetId, target.targetId);
  assert.equal(after.record.comment, 'Legacy review');
  assert.equal(after.aliasTargetId, null, 'the record now lives under the canonical identity');
});

test('a failed alias retirement keeps both copies and reports it, losing nothing', async () => {
  const api = connectionApi();
  const legacyId = 'person:author:p-alpha';
  await api.feedbackSave(legacyId, { overallRating: 4, comment: 'Legacy review' }, ABSENT_REVISION);
  api.feedbackDelete = async () => { const error = new Error('refused'); error.code = 'feedback-revision-conflict'; throw error; };

  const store = new PrivateAppStore({ liveSnapshot: liveSnapshot(), connectionApi: api, connectionInfo: { connected: true } });
  const target = store_target(store);
  await store.openGroupFeedbackEditor(authorGroupOf(store));
  const saved = await store.saveFeedbackDraft();

  assert.equal(saved.ok, true, 'the canonical write still succeeded');
  assert.deepEqual(saved.aliasMigration, { ok: false, from: legacyId, code: 'feedback-revision-conflict' });
  // The canonical record wins on read, so the owner sees exactly one review.
  const shown = store.groupFeedback(authorGroupOf(store));
  assert.equal(shown.aliasTargetId, null);
  assert.equal(shown.record.comment, 'Legacy review');
});

test('two legacy records for one group are never silently merged or deleted', async () => {
  const api = connectionApi();
  await api.feedbackSave('person:author:p-alpha', { overallRating: 5, comment: 'First' }, ABSENT_REVISION);
  await api.feedbackSave('person:author:p-alpha-occurrence-two', { overallRating: 2, comment: 'Second' }, ABSENT_REVISION);
  api.calls.length = 0;

  const store = new PrivateAppStore({
    liveSnapshot: snapshotWithDuplicateAuthor(),
    connectionApi: api,
    connectionInfo: { connected: true },
  });
  await store.openGroupFeedbackEditor(authorGroupOf(store));
  const resolved = store.groupFeedback(authorGroupOf(store));
  assert.equal(resolved.aliasConflict, true);
  assert.ok(resolved.record, 'the owner still sees a review rather than nothing');

  const saved = await store.saveFeedbackDraft();
  assert.equal(saved.ok, true);
  assert.equal(saved.aliasMigration, null, 'an ambiguous alias set is never migrated automatically');
  assert.equal(api.calls.some(([verb]) => verb === 'delete'), false, 'nothing is deleted on a guess');
});

test('a revoked authorization is visible after the sync that observed it', async () => {
  let status = { connected: true, connectionState: 'verified', lastVerifiedAt: '2026-09-17T12:00:00.000Z' };
  const api = connectionApi();
  api.status = async () => status;
  api.sync = async () => { const error = new Error('sync failed'); error.code = 'library-sync-failed'; throw error; };

  const store = new PrivateAppStore({ liveSnapshot: liveSnapshot(), connectionApi: api, connectionInfo: status });
  assert.equal(store.summary().connectionState, 'verified');

  // Audible revokes the authorization; the next requested sync observes it.
  status = {
    connected: true,
    connectionState: 'authorization-failed',
    lastVerifiedAt: '2026-09-17T12:00:00.000Z',
    lastAuthorizationFailureAt: '2026-09-18T09:00:00.000Z',
  };
  let failureCode = null;
  try {
    await api.sync();
  } catch (error) {
    failureCode = error.code;
  }
  assert.equal(failureCode, 'library-sync-failed', 'the code is still the generic one');

  const outcome = await store.noteSyncFailure(failureCode);
  assert.equal(outcome.refreshed, true);
  assert.equal(outcome.state, 'authorization-failed');
  assert.equal(store.summary().connectionState, 'authorization-failed');
  assert.equal(store.summary().lastSyncErrorCode, 'library-sync-failed');
  assert.equal(store.connectionState.tone, 'alert');
  assert.match(store.connectionState.recovery, /Reconnect/i);

  // The local library is untouched by a refusal: it is still readable.
  assert.equal(store.queryLibrary().total, 2);
  assert.equal(store.summary().connectionStatus, 'connected', 'custody is unchanged');
});

test('a sync failure that is not a refusal does not manufacture an authorization failure', async () => {
  const api = connectionApi();
  api.status = async () => ({ connected: true, connectionState: 'verified', lastVerifiedAt: '2026-09-17T12:00:00.000Z' });
  const store = new PrivateAppStore({ liveSnapshot: liveSnapshot(), connectionApi: api, connectionInfo: await api.status() });

  const outcome = await store.noteSyncFailure('library-sync-failed');
  assert.equal(outcome.state, 'verified', 'a transient failure is not a revocation');
  assert.equal(store.summary().lastSyncErrorCode, 'library-sync-failed');
});

test('an unreachable runtime never upgrades or invents a connection state', async () => {
  const api = connectionApi();
  api.status = async () => { const error = new Error('unreachable'); error.code = 'private-alpha-runtime-unavailable'; throw error; };
  const store = new PrivateAppStore({
    liveSnapshot: liveSnapshot(),
    connectionApi: api,
    connectionInfo: { connected: true, connectionState: 'verified', lastVerifiedAt: '2026-09-17T12:00:00.000Z' },
  });

  const outcome = await store.noteSyncFailure('library-sync-failed');
  assert.equal(outcome.refreshed, false);
  assert.equal(outcome.state, 'verified', 'the last known state stands; nothing is invented');
  const refresh = await store.refreshConnectionState();
  assert.equal(refresh.code, 'private-alpha-runtime-unavailable');
});

test('the Data inventory reports only counts it has evidence for (B7)', async () => {
  const api = connectionApi();
  const store = new PrivateAppStore({
    liveSnapshot: liveSnapshot(),
    connectionApi: api,
    connectionInfo: { connected: true, connectionState: 'verified', lastVerifiedAt: '2026-09-17T12:00:00.000Z' },
  });

  const before = store.inventory();
  assert.equal(before.titles.known, true);
  assert.equal(before.titles.count, 2);
  assert.equal(before.titles.libraryEntryCount, 2);
  // Nothing has looked at the feedback store yet, so the count is unknown -
  // never reported as zero.
  assert.equal(before.feedback.known, false);
  assert.equal(before.feedback.count, null);
  assert.equal(before.feedback.reason, 'feedback-not-loaded');
  // Loading the retained snapshot is not a provider import, so there is no
  // latest-import evidence at startup.
  assert.equal(before.lastImport.known, false);
  assert.equal(before.lastImport.counts, null);
  assert.equal(before.lastImport.basis, 'snapshot-load');

  // Reading the inventory is non-destructive: it starts nothing and writes
  // nothing.
  assert.deepEqual(api.calls, []);

  const loaded = await store.loadInventory();
  assert.equal(loaded.feedback.known, true);
  assert.equal(loaded.feedback.count, 0, 'an empty store, having actually been read, is zero');
  assert.deepEqual(api.calls.map((call) => call[0]), ['list']);

  // Saving one review is reflected, and still no destructive call was made.
  await store.openFeedbackEditor('aud-us-book-one');
  store.updateFeedbackDraft({ overallRating: 4 });
  await store.saveFeedbackDraft();
  assert.equal(store.inventory().feedback.count, 1);
  assert.equal(api.calls.some((call) => call[0] === 'feedbackDelete' || call[0] === 'delete'), false);

  // The library is untouched by any of it.
  assert.equal(store.summary().bookCount, 2);
  assert.equal(store.queryLibrary().total, 2);
});

test('the Data inventory admits ignorance rather than inventing zeros (B7)', () => {
  // No snapshot, and no local evidence about whether one exists.
  const blind = new PrivateAppStore({ connectionInfo: { connected: false } });
  const unknownInventory = blind.inventory();
  assert.equal(unknownInventory.titles.known, false);
  assert.equal(unknownInventory.titles.count, null);
  assert.equal(unknownInventory.titles.libraryEntryCount, null);
  assert.equal(unknownInventory.titles.reason, 'no-snapshot-read');
  assert.equal(unknownInventory.lastImport.known, false);
  assert.equal(unknownInventory.lastImport.counts, null);
  assert.equal(unknownInventory.lastImport.reason, 'no-import-in-session');

  // Local evidence that there is no snapshot *is* evidence for zero.
  const empty = new PrivateAppStore({ connectionInfo: { connected: true, local: { hasLocalSnapshot: false } } });
  assert.equal(empty.inventory().titles.known, true);
  assert.equal(empty.inventory().titles.count, 0);
});

test('an unreadable feedback store leaves the inventory unknown, not empty (B7)', async () => {
  const store = new PrivateAppStore({
    liveSnapshot: liveSnapshot(),
    connectionApi: { feedbackList: async () => { throw Object.assign(new Error('denied'), { code: 'private-alpha-feedback-unavailable' }); } },
    connectionInfo: { connected: true },
  });
  const inventory = await store.loadInventory();
  assert.equal(inventory.feedback.known, false);
  assert.equal(inventory.feedback.count, null);
  assert.equal(inventory.titles.count, 2, 'one unreadable section does not suppress the others');
});

test('saved Library controls reset is reported as a reset, not a fault (B10)', () => {
  const reset = new PrivateAppStore({ libraryStateWarning: 'library-filter-state-outdated' });
  assert.equal(reset.libraryStateNotice.kind, 'reset');
  assert.match(reset.libraryStateNotice.text, /were reset/);
  assert.equal(reset.libraryStateNotice.text.includes('library-filter-state'), false, 'no machine token on screen');

  const broken = new PrivateAppStore({ libraryStateWarning: 'library-filter-state-invalid' });
  assert.equal(broken.libraryStateNotice.kind, 'error');

  assert.equal(new PrivateAppStore({}).libraryStateNotice, null);
  for (const hostile of ['constructor', 'toString', 'made-up-code']) {
    const notice = new PrivateAppStore({ libraryStateWarning: hostile }).libraryStateNotice;
    assert.equal(notice.kind, 'error', hostile);
    assert.equal(typeof notice.text, 'string', hostile);
    assert.equal(notice.text.includes(hostile), false, hostile);
  }
});

function snapshotWithTitles(count) {
  const snapshot = liveSnapshot();
  snapshot.catalog.books = Array.from({ length: count }, (_, index) => ({
    bookId: `aud-us-retained-${index + 1}`,
    workId: `aud-us-retained-${index + 1}-work`,
    title: `Retained Title ${index + 1}`,
    authorIds: ['p-alpha'],
    narratorIds: ['p-narrator'],
    genreIds: [],
    themeIds: [],
    language: 'en',
    available: true,
  }));
  snapshot.entries = snapshot.catalog.books.map((book) => ({ bookId: book.bookId, status: 'not-started' }));
  return snapshot;
}

test('12 retained titles at startup are not reported as 12 newly imported titles', async () => {
  const store = new PrivateAppStore({
    liveSnapshot: snapshotWithTitles(12),
    connectionApi: connectionApi(),
    connectionInfo: { connected: true, connectionState: 'verified', lastVerifiedAt: '2026-09-17T12:00:00.000Z' },
  });

  // The underlying parse really does call all 12 `added` - which is exactly
  // why it may not be published as an import.
  assert.equal(store.lastImportReport.added.length, 12);

  const startup = store.inventory();
  assert.equal(startup.titles.known, true);
  assert.equal(startup.titles.count, 12, 'the titles are genuinely held and are reported');
  assert.equal(startup.lastImport.known, false, 'a snapshot parse is not a provider import');
  assert.equal(startup.lastImport.counts, null, 'no fabricated added/updated counts');
  assert.equal(startup.lastImport.basis, 'snapshot-load');
  assert.equal(startup.lastImport.authority, 'local-snapshot-parse');
  assert.equal(startup.lastImport.reason, 'snapshot-parse-only');

  // The basis is explicit, so no consumer needs a numeric heuristic: the
  // "added == title count" coincidence is present and must not be consulted.
  assert.equal(startup.lastImport.known, false);
  assert.notEqual(startup.lastImport.basis, 'sync-reconciliation');
});

test('only a real requested sync reconciliation may report known import counts', () => {
  const store = new PrivateAppStore({
    liveSnapshot: snapshotWithTitles(12),
    connectionApi: connectionApi(),
    connectionInfo: { connected: true },
  });
  assert.equal(store.inventory().lastImport.known, false);

  // The shape handed back by `connectionApi.sync()`.
  const accepted = store.noteSyncReconciliation({
    ok: true,
    itemCount: 13,
    observedAt: '2026-09-21T18:00:00.000Z',
    snapshotGeneration: 4,
    reconciliation: { added: 1, updated: 2, reappeared: 0, missingFromSource: 0 },
  });
  assert.deepEqual(accepted, { ok: true, code: null });

  const after = store.inventory();
  assert.equal(after.lastImport.known, true);
  assert.equal(after.lastImport.basis, 'sync-reconciliation');
  assert.equal(after.lastImport.authority, 'requested-sync');
  assert.equal(after.lastImport.observedAt, '2026-09-21T18:00:00.000Z');
  assert.equal(after.lastImport.counts.added, 1, 'one new title, not twelve');
  assert.equal(after.lastImport.counts.updated, 2);
  assert.equal(after.lastImport.counts.missingFromSource, 0);
  // Reconciliation does not measure these, so they are null, never 0.
  assert.equal(after.lastImport.counts.unchanged, null);
  assert.equal(after.lastImport.counts.rejected, null);
});

test('a sync result without a reconciliation block is refused, not guessed at', () => {
  const store = new PrivateAppStore({ liveSnapshot: snapshotWithTitles(12), connectionInfo: { connected: true } });
  for (const bad of [undefined, null, {}, { ok: true }, { reconciliation: null }, { reconciliation: 'added: 12' }]) {
    const result = store.noteSyncReconciliation(bad);
    assert.deepEqual(result, { ok: false, code: 'sync-reconciliation-missing' }, JSON.stringify(bad ?? null));
    assert.equal(store.inventory().lastImport.known, false);
    assert.equal(store.inventory().lastImport.basis, 'snapshot-load');
  }

  // Non-integer or negative counts are not adopted as numbers.
  store.noteSyncReconciliation({ reconciliation: { added: -1, updated: 1.5, reappeared: 'many', missingFromSource: 3 } });
  const counts = store.inventory().lastImport.counts;
  assert.deepEqual(
    { added: counts.added, updated: counts.updated, reappeared: counts.reappeared, missingFromSource: counts.missingFromSource },
    { added: null, updated: null, reappeared: null, missingFromSource: 3 },
  );
});

test('a reload with no persisted evidence returns to unknown rather than re-deriving counts', () => {
  const store = new PrivateAppStore({
    liveSnapshot: snapshotWithTitles(12),
    connectionInfo: { connected: true },
  });
  store.noteSyncReconciliation({ observedAt: '2026-09-21T18:00:00.000Z', reconciliation: { added: 1, updated: 0, reappeared: 0, missingFromSource: 0 } });
  assert.equal(store.inventory().lastImport.known, true);

  // Loading the freshly stored snapshot is what a page reload does. With no
  // persisted record on the status, the in-session reconciliation is not
  // retained, and is not reconstructed from the snapshot parse.
  store.loadPrivateSnapshot(snapshotWithTitles(13), { connected: true });
  const afterReload = store.inventory();
  assert.equal(afterReload.titles.count, 13);
  assert.equal(afterReload.lastImport.known, false);
  assert.equal(afterReload.lastImport.counts, null);
  assert.equal(afterReload.lastImport.basis, 'snapshot-load');
});

// --- persisted import evidence restored from status ------------------------

/** The shape the connector persists and returns on `status().local.lastImport`. */
function persistedImport(overrides = {}) {
  return {
    version: 1,
    basis: 'sync-reconciliation',
    authority: 'requested-sync',
    observedAt: '2026-09-21T18:00:00.000Z',
    recordedAt: '2026-09-21T18:00:05.000Z',
    snapshotGeneration: 4,
    counts: {
      added: 1, updated: 2, reappeared: 0, missingFromSource: 0, unchanged: null, rejected: null,
    },
    ...overrides,
  };
}

function statusWithImport(record) {
  return { connected: true, connectionState: 'verified', local: { hasLocalSnapshot: true, lastImport: record } };
}

test('a reload adopts the persisted reconciliation the connector recorded for that sync', () => {
  const store = new PrivateAppStore({
    liveSnapshot: snapshotWithTitles(13),
    connectionInfo: statusWithImport(persistedImport()),
  });

  const inventory = store.inventory();
  assert.equal(inventory.titles.count, 13);
  assert.equal(inventory.lastImport.known, true, 'a measured sync survives the reload that follows it');
  assert.equal(inventory.lastImport.basis, 'sync-reconciliation');
  assert.equal(inventory.lastImport.authority, 'requested-sync');
  assert.equal(inventory.lastImport.source, 'persisted-status');
  assert.equal(inventory.lastImport.observedAt, '2026-09-21T18:00:00.000Z');
  assert.equal(inventory.lastImport.counts.added, 1, 'one new title, not thirteen');
  assert.equal(inventory.lastImport.counts.updated, 2);
  assert.equal(inventory.lastImport.counts.unchanged, null);
});

test('an unsupported, malformed or absent persisted record leaves the import unknown', () => {
  const refused = [
    ['absent', undefined],
    ['null', null],
    ['not an object', 'added: 1'],
    ['older schema', persistedImport({ version: 0 })],
    ['wrong basis', persistedImport({ basis: 'snapshot-load' })],
    ['wrong authority', persistedImport({ authority: 'local-snapshot-parse' })],
    ['no counts', persistedImport({ counts: null })],
    ['negative count', persistedImport({ counts: { added: -1, updated: 0, reappeared: 0, missingFromSource: 0 } })],
    ['fractional count', persistedImport({ counts: { added: 1.5, updated: 0, reappeared: 0, missingFromSource: 0 } })],
    ['missing count', persistedImport({ counts: { added: 1, updated: 0, reappeared: 0 } })],
    ['no observation instant', persistedImport({ observedAt: null })],
  ];
  for (const [label, record] of refused) {
    const store = new PrivateAppStore({
      liveSnapshot: snapshotWithTitles(12),
      connectionInfo: statusWithImport(record),
    });
    const section = store.inventory().lastImport;
    assert.equal(section.known, false, label);
    assert.equal(section.counts, null, label);
    assert.equal(section.basis, 'snapshot-load', label);
    assert.equal(section.reason, 'snapshot-parse-only', label);
  }
});

test('an in-session measurement is never replaced by a persisted record', () => {
  const store = new PrivateAppStore({
    liveSnapshot: snapshotWithTitles(12),
    connectionInfo: { connected: true },
  });
  store.noteSyncReconciliation({
    observedAt: '2026-09-22T09:00:00.000Z',
    reconciliation: { added: 3, updated: 0, reappeared: 0, missingFromSource: 1 },
  });

  const outcome = store.noteStatusImport(statusWithImport(persistedImport()));
  assert.deepEqual(outcome, { ok: false, code: 'in-session-measurement-retained' });
  const section = store.inventory().lastImport;
  assert.equal(section.source, 'in-session-sync');
  assert.equal(section.counts.added, 3);
  assert.equal(section.observedAt, '2026-09-22T09:00:00.000Z');
});

test('a status refresh may supply import evidence without rebuilding the store', () => {
  const store = new PrivateAppStore({
    liveSnapshot: snapshotWithTitles(12),
    connectionInfo: { connected: true },
  });
  assert.equal(store.inventory().lastImport.known, false);

  const outcome = store.noteStatusImport(statusWithImport(persistedImport()));
  assert.deepEqual(outcome, { ok: true, code: null });
  assert.equal(store.inventory().lastImport.known, true);
  assert.equal(store.inventory().lastImport.source, 'persisted-status');

  // The same path runs on the connection refresh a failed sync triggers.
  const refreshed = new PrivateAppStore({ liveSnapshot: snapshotWithTitles(12), connectionInfo: { connected: true } });
  refreshed.applyConnectionInfo(statusWithImport(persistedImport()));
  assert.equal(refreshed.inventory().lastImport.known, true);
});

test('a quarantined or account-changed status carries no import evidence to adopt', () => {
  // The connector withholds the record when the join does not resolve to this
  // account, so the store simply has nothing to adopt and stays unknown.
  const store = new PrivateAppStore({
    liveSnapshot: snapshotWithTitles(12),
    connectionInfo: { connected: true, local: { hasLocalSnapshot: true, lastImport: null, accountMismatch: true } },
  });
  assert.equal(store.inventory().lastImport.known, false);
  assert.equal(store.inventory().lastImport.reason, 'snapshot-parse-only');
});
