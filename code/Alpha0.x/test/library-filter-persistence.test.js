import test from 'node:test';
import assert from 'node:assert/strict';

import {
  LIBRARY_FILTER_STORAGE_KEY,
  deserializeLibraryFilterState,
  loadLibraryFilterState,
  saveLibraryFilterState,
  serializeLibraryFilterState,
} from '../ui/js/library-filter-persistence.js';
import { createLibrarySessionState } from '../ui/js/library-session-state.js';

function memoryStorage() {
  const values = new Map();
  return {
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) { values.set(key, value); },
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
  assert.deepEqual(loadLibraryFilterState(memoryStorage()), { ok: true, code: null, state: null });
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
