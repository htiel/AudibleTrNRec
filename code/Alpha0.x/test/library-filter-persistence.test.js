import test from 'node:test';
import assert from 'node:assert/strict';

import {
  LIBRARY_FILTER_STORAGE_KEY,
  LEGACY_LIBRARY_FILTER_STORAGE_KEYS,
  deserializeLibraryFilterState,
  loadLibraryFilterState,
  saveLibraryFilterState,
  serializeLibraryFilterState,
} from '../ui/js/library-filter-persistence.js';
import { createLibrarySessionState } from '../ui/js/library-session-state.js';
import { ALPHA_VERSION } from '../src/version.js';

function memoryStorage() {
  const values = new Map();
  return {
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) { values.set(key, value); },
    has(key) { return values.has(key); },
  };
}

test('library filters round trip while transient editor and focus state stay out of storage', () => {
  const storage = memoryStorage();
  const state = createLibrarySessionState({
    query: 'narrator search',
    statuses: ['completed', 'in-progress'],
    sortField: 'narrator',
    sortDirection: 'desc',
    groupBy: 'narrators',
    overallRatingFilter: 'rated',
    hasComment: true,
    tagQuery: 'favorite',
    collapsedGroupKeys: ['narrator-label:0123456789abcdef'],
    activeEditorBookId: 'private-book',
    draftDirty: true,
    returnFocusBookId: 'private-book',
    scrollTop: 500,
  });

  assert.equal(saveLibraryFilterState(state, storage).ok, true);
  const stored = JSON.parse(storage.getItem(LIBRARY_FILTER_STORAGE_KEY));
  assert.equal(Object.hasOwn(stored.state, 'activeEditorBookId'), false);
  assert.equal(Object.hasOwn(stored.state, 'draftDirty'), false);
  assert.equal(Object.hasOwn(stored.state, 'returnFocusBookId'), false);
  assert.equal(Object.hasOwn(stored.state, 'scrollTop'), false);

  const loaded = loadLibraryFilterState(storage);
  assert.equal(loaded.ok, true);
  assert.equal(loaded.state.query, 'narrator search');
  assert.equal(loaded.state.groupBy, 'narrators');
  assert.deepEqual(loaded.state.statuses, ['completed', 'in-progress']);
  assert.equal(loaded.state.activeEditorBookId, null);
  assert.equal(loaded.state.draftDirty, false);
});

test('missing storage is an ordinary empty state', () => {
  assert.deepEqual(loadLibraryFilterState(memoryStorage()), {
    ok: true, code: null, state: null, reset: false, migrated: false,
  });
});

test('malformed, unknown-version, oversized, and widened states fail closed', () => {
  assert.equal(deserializeLibraryFilterState('{').code, 'library-filter-state-invalid');
  assert.equal(deserializeLibraryFilterState(JSON.stringify({ version: 2, state: {} })).code, 'library-filter-state-invalid');
  assert.equal(deserializeLibraryFilterState('x'.repeat(33 * 1024)).code, 'library-filter-state-too-large');
  const state = createLibrarySessionState();
  const serialized = serializeLibraryFilterState(state);
  const widened = JSON.parse(serialized.serialized);
  widened.state.accountId = 'must-not-be-accepted';
  assert.equal(deserializeLibraryFilterState(JSON.stringify(widened)).code, 'library-filter-state-invalid');
});

test('unavailable browser storage is surfaced with a closed error code', () => {
  const unavailable = {
    getItem() { throw new Error('private browser detail'); },
    setItem() { throw new Error('private browser detail'); },
  };
  assert.equal(loadLibraryFilterState(unavailable).code, 'library-filter-storage-unavailable');
  assert.equal(saveLibraryFilterState(createLibrarySessionState(), unavailable).code, 'library-filter-storage-unavailable');
});

test('private search and tag bounds prevent unbounded refresh state', () => {
  assert.equal(serializeLibraryFilterState(createLibrarySessionState({ query: 'x'.repeat(501) })).code, 'library-filter-state-invalid');
  assert.equal(serializeLibraryFilterState(createLibrarySessionState({ tagQuery: 'x'.repeat(201) })).code, 'library-filter-state-invalid');
});

test('paging position is restored with the filters it belongs to', () => {
  const storage = memoryStorage();
  const state = createLibrarySessionState({
    groupBy: 'series',
    page: 4,
    groupPage: 3,
    groupRowPages: { 'series:s-series-000001': 2 },
  });
  assert.equal(saveLibraryFilterState(state, storage).ok, true);
  const loaded = loadLibraryFilterState(storage);
  assert.equal(loaded.ok, true);
  assert.equal(loaded.state.page, 4);
  assert.equal(loaded.state.groupPage, 3);
  assert.deepEqual(loaded.state.groupRowPages, { 'series:s-series-000001': 2 });
});

test('stored paging values are validated, not trusted', () => {
  const base = createLibrarySessionState();
  const serialized = JSON.parse(serializeLibraryFilterState(base).serialized);
  const withPage = (value, field = 'page') => {
    const copy = structuredClone(serialized);
    copy.state[field] = value;
    return deserializeLibraryFilterState(JSON.stringify(copy));
  };
  for (const bad of [0, -1, 1.5, '3', null, Number.MAX_SAFE_INTEGER, 1_000_001]) {
    assert.equal(withPage(bad).code, 'library-filter-state-invalid', `page ${String(bad)}`);
    assert.equal(withPage(bad, 'groupPage').code, 'library-filter-state-invalid', `groupPage ${String(bad)}`);
  }
  for (const bad of [[], null, 'x', { 'bad key!': 2 }, { 'series:a': 0 }]) {
    assert.equal(withPage(bad, 'groupRowPages').code, 'library-filter-state-invalid', JSON.stringify(bad));
  }
  const tooMany = Object.fromEntries(Array.from({ length: 201 }, (_, i) => [`series:g-${i}`, 2]));
  assert.equal(withPage(tooMany, 'groupRowPages').code, 'library-filter-state-invalid');
});

test('the storage key is scoped to the state schema, not the release (B10)', () => {
  assert.match(LIBRARY_FILTER_STORAGE_KEY, /:v2$/);
  assert.equal(LIBRARY_FILTER_STORAGE_KEY.includes(ALPHA_VERSION), false,
    'a patch bump must not silently orphan schema-compatible saved controls');

  // An incompatible schema is a *reset*, reported as such, not "invalid".
  const v1 = JSON.stringify({ version: 1, state: { query: '', statuses: [] } });
  const outdated = deserializeLibraryFilterState(v1);
  assert.equal(outdated.code, 'library-filter-state-outdated');
  assert.equal(outdated.reset, true);
  assert.equal(outdated.state, null);

  // Corruption is still corruption, and is never reported as a schema reset.
  for (const bad of ['{', JSON.stringify({ version: 'two', state: {} }), JSON.stringify({ version: 2, state: {} })]) {
    const result = deserializeLibraryFilterState(bad);
    assert.equal(result.code, 'library-filter-state-invalid', bad);
    assert.equal(result.reset, false, bad);
  }
});

test('a release-scoped key written by an earlier build is migrated, not discarded (B10)', () => {
  for (const legacyKey of LEGACY_LIBRARY_FILTER_STORAGE_KEYS) {
    const storage = memoryStorage();
    const state = createLibrarySessionState({
      query: 'kept across the upgrade',
      groupBy: 'narrators',
      collapsedGroupKeys: ['narrator-label:0123456789abcdef'],
      page: 3,
      groupPage: 2,
      groupRowPages: { 'narrator-label:0123456789abcdef': 4 },
    });
    storage.setItem(legacyKey, serializeLibraryFilterState(state).serialized);

    const loaded = loadLibraryFilterState(storage);
    assert.equal(loaded.ok, true, legacyKey);
    assert.equal(loaded.migrated, true, legacyKey);
    assert.equal(loaded.reset, false, legacyKey);
    assert.equal(loaded.code, null, legacyKey);

    // Tab scope, bounds and validation all survive the move.
    assert.equal(loaded.state.query, 'kept across the upgrade');
    assert.equal(loaded.state.groupBy, 'narrators');
    assert.deepEqual(loaded.state.collapsedGroupKeys, ['narrator-label:0123456789abcdef']);
    assert.equal(loaded.state.page, 3);
    assert.equal(loaded.state.groupPage, 2);
    assert.deepEqual({ ...loaded.state.groupRowPages }, { 'narrator-label:0123456789abcdef': 4 });
    assert.equal(loaded.state.activeEditorBookId, null, 'transient state is still not persisted');

    // Carried forward under the canonical key. The legacy value is left
    // untouched - this module never erases browser state - and is simply
    // never consulted again while the canonical key exists.
    assert.equal(storage.has(LIBRARY_FILTER_STORAGE_KEY), true, legacyKey);
    assert.equal(loadLibraryFilterState(storage).state.query, 'kept across the upgrade');
    assert.equal(loadLibraryFilterState(storage).migrated, false, 'migration runs once');

    // Proof the second read came from the canonical key, not the legacy one.
    storage.setItem(LIBRARY_FILTER_STORAGE_KEY, serializeLibraryFilterState(createLibrarySessionState({ query: 'newer' })).serialized);
    assert.equal(loadLibraryFilterState(storage).state.query, 'newer', legacyKey);
  }
});

test('migration never overwrites state the current build already saved (B10)', () => {
  const storage = memoryStorage();
  storage.setItem(LIBRARY_FILTER_STORAGE_KEY, serializeLibraryFilterState(createLibrarySessionState({ query: 'current' })).serialized);
  storage.setItem(LEGACY_LIBRARY_FILTER_STORAGE_KEYS[0], serializeLibraryFilterState(createLibrarySessionState({ query: 'stale' })).serialized);

  const loaded = loadLibraryFilterState(storage);
  assert.equal(loaded.state.query, 'current');
  assert.equal(loaded.migrated, false);
});

test('an unreadable legacy value is reported, not silently swallowed (B10)', () => {
  const storage = memoryStorage();
  storage.setItem(LEGACY_LIBRARY_FILTER_STORAGE_KEYS[0], JSON.stringify({ version: 1, state: {} }));
  const loaded = loadLibraryFilterState(storage);
  assert.equal(loaded.code, 'library-filter-state-outdated');
  assert.equal(loaded.reset, true);
  assert.equal(loaded.state, null);
  // Nothing is written in response to an unreadable value, and nothing is
  // erased: this module never removes browser state.
  assert.equal(storage.has(LIBRARY_FILTER_STORAGE_KEY), false);
  assert.equal(storage.has(LEGACY_LIBRARY_FILTER_STORAGE_KEYS[0]), true);

  // Once the owner saves any valid state, the legacy value stops being read.
  assert.equal(saveLibraryFilterState(createLibrarySessionState({ query: 'fresh' }), storage).ok, true);
  assert.equal(loadLibraryFilterState(storage).state.query, 'fresh');

  const corrupt = memoryStorage();
  corrupt.setItem(LEGACY_LIBRARY_FILTER_STORAGE_KEYS[0], '{');
  assert.equal(loadLibraryFilterState(corrupt).code, 'library-filter-state-invalid');
});

test('a storage that throws on the legacy read still fails closed (B10)', () => {
  const unavailable = {
    getItem(key) {
      if (key === LIBRARY_FILTER_STORAGE_KEY) return null;
      throw new Error('denied');
    },
    setItem() {},
  };
  assert.equal(loadLibraryFilterState(unavailable).code, 'library-filter-storage-unavailable');
});
