/**
 * Bounded Library presentation gates (issue #10).
 *
 * The alpha Library rendered every title it held: 180 titles produced a
 * single page taller than 57,000 px on mobile. These tests are the gate that
 * keeps that from returning. They assert *row counts*, not pixels, because a
 * row count is what the runtime controls and what a view cannot argue with.
 *
 * Fixture sizes 180 / 1,000 / 20,000 are exercised deliberately: the bound
 * must be a property of the contract, not of a library that happens to be
 * small. Timings are recorded as observations only - see the note on the
 * measurement test before quoting any number from this file.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  paginateRows,
  paginateGroups,
  describePage,
  clampPage,
  pageCountFor,
  LIBRARY_PAGE_SIZE,
  LIBRARY_GROUP_PAGE_SIZE,
  LIBRARY_GROUP_ROW_PAGE_SIZE,
  LIBRARY_GROUPED_ROW_CEILING,
  LIBRARY_ROW_CEILING,
} from '../src/core/paginate.js';
import { buildLargeLibrarySnapshot, LARGE_LIBRARY_SIZES } from '../src/fixtures/large-library.js';
import { PrivateAppStore } from '../ui/js/private-store.js';
import { SERIES_UNKNOWN_LABEL } from '../src/core/library.js';

const storeFor = (count, session = {}) => new PrivateAppStore({
  liveSnapshot: buildLargeLibrarySnapshot(count),
  connectionInfo: { connected: true, connectionState: 'verified' },
  initialLibrarySession: session,
});

const rowsOf = (result) => (result.groups
  ? result.groups.reduce((sum, group) => sum + group.items.length, 0)
  : result.rows.length);

test('the bound is a stated contract, not an emergent property', () => {
  assert.equal(LIBRARY_PAGE_SIZE, 50);
  assert.equal(LIBRARY_GROUP_PAGE_SIZE, 5);
  assert.equal(LIBRARY_GROUP_ROW_PAGE_SIZE, 10);
  assert.equal(LIBRARY_GROUPED_ROW_CEILING, 50);
  assert.equal(LIBRARY_ROW_CEILING, 50);
});

test('pagination refuses every attempt to render an unbounded page', () => {
  const rows = Array.from({ length: 5000 }, (_, i) => ({ bookId: `b-${i}` }));
  // There is no "show all" parameter; hostile or hopeful inputs are clamped.
  for (const page of [0, -1, 1.9, NaN, Infinity, 10 ** 9, 'all', null, undefined]) {
    const result = paginateRows(rows, { page });
    assert.equal(result.rows.length, LIBRARY_PAGE_SIZE, `page=${String(page)}`);
    assert.ok(result.page >= 1 && result.page <= result.pageCount);
  }
  // Extra options are inert: nothing opts out of the ceiling.
  assert.equal(paginateRows(rows, { page: 1, pageSize: 5000, showAll: true }).rows.length, LIBRARY_PAGE_SIZE);
});

test('page arithmetic is total-preserving and empty-safe', () => {
  assert.equal(pageCountFor(0, 50), 1);
  assert.equal(pageCountFor(50, 50), 1);
  assert.equal(pageCountFor(51, 50), 2);
  assert.equal(clampPage(99, 3), 3);
  assert.equal(clampPage(-4, 3), 1);

  const empty = paginateRows([], {});
  assert.equal(empty.total, 0);
  assert.equal(empty.firstIndex, 0);
  assert.equal(empty.lastIndex, 0);
  assert.equal(empty.hasNext, false);
});

test('every page of a large ungrouped library is bounded and covers the library exactly once', () => {
  const rows = Array.from({ length: 20000 }, (_, i) => ({ bookId: `b-${i}` }));
  const seen = new Set();
  const pageCount = paginateRows(rows, { page: 1 }).pageCount;
  assert.equal(pageCount, 400);
  for (let page = 1; page <= pageCount; page += 1) {
    const result = paginateRows(rows, { page });
    assert.ok(result.rows.length <= LIBRARY_PAGE_SIZE);
    for (const row of result.rows) {
      assert.equal(seen.has(row.bookId), false, `row ${row.bookId} rendered twice`);
      seen.add(row.bookId);
    }
  }
  // Bounded pages hide nothing: the whole library is still reachable.
  assert.equal(seen.size, 20000);
});

test('grouped pages bound both the number of groups and the rows inside them', () => {
  const groups = Array.from({ length: 300 }, (_, g) => ({
    key: `g-${g}`,
    label: `Group ${g}`,
    items: Array.from({ length: 400 }, (_, i) => ({ bookId: `b-${g}-${i}` })),
  }));
  const page = paginateGroups(groups, { groupPage: 1 });
  assert.equal(page.groups.length, LIBRARY_GROUP_PAGE_SIZE);
  for (const group of page.groups) {
    assert.ok(group.items.length <= LIBRARY_GROUP_ROW_PAGE_SIZE);
    // The count shown beside the group is the real one, not the page's.
    assert.equal(group.total, 400);
    assert.equal(group.truncated, true);
    assert.equal(group.pageCount, 40);
  }
  assert.equal(page.renderedRowCount, LIBRARY_GROUPED_ROW_CEILING);
  assert.equal(page.groupTotal, 300);
  assert.equal(page.groupPageCount, 60);
});

test('a collapsed group renders no rows and still reports its true size', () => {
  const groups = [
    { key: 'a', items: Array.from({ length: 120 }, (_, i) => ({ bookId: `a-${i}` })) },
    { key: 'b', items: Array.from({ length: 7 }, (_, i) => ({ bookId: `b-${i}` })) },
  ];
  const page = paginateGroups(groups, { isExpanded: (key) => key !== 'a' });
  const [collapsed, expanded] = page.groups;
  assert.equal(collapsed.expanded, false);
  assert.equal(collapsed.items.length, 0);
  assert.equal(collapsed.total, 120, 'a collapsed group must not understate itself');
  assert.equal(expanded.items.length, 7);
  assert.equal(page.renderedRowCount, 7);
});

test('child paging reaches every row of a very large group', () => {
  const items = Array.from({ length: 2000 }, (_, i) => ({ bookId: `b-${i}` }));
  const seen = new Set();
  const pageCount = paginateGroups([{ key: 'g', items }]).groups[0].pageCount;
  for (let page = 1; page <= pageCount; page += 1) {
    const group = paginateGroups([{ key: 'g', items }], { groupRowPages: { g: page } }).groups[0];
    assert.ok(group.items.length <= LIBRARY_GROUP_ROW_PAGE_SIZE);
    group.items.forEach((row) => seen.add(row.bookId));
  }
  assert.equal(seen.size, 2000);
});

test('the announced summary matches the rows actually rendered', () => {
  const rows = Array.from({ length: 180 }, (_, i) => ({ bookId: `b-${i}` }));
  const page = paginateRows(rows, { page: 2 });
  const sentence = describePage(page, { matched: 180, total: 180, noun: 'titles' });
  assert.match(sentence, /Showing 51–100 of 180 titles \(page 2 of 4\)\./);

  const filtered = describePage(paginateRows(rows.slice(0, 60), { page: 1 }), { matched: 60, total: 180, noun: 'titles' });
  assert.match(filtered, /Showing 1–50 of 60 of 180 titles/);

  const grouped = describePage(
    paginateGroups(Array.from({ length: 12 }, (_, g) => ({ key: `g-${g}`, items: rows.slice(0, 3) }))),
    { matched: 36, total: 180, noun: 'titles' },
  );
  assert.match(grouped, /Showing groups 1–5 of 12 \(page 1 of 3\)/);
});

for (const size of LARGE_LIBRARY_SIZES) {
  test(`a ${size}-title private library renders at most ${LIBRARY_ROW_CEILING} rows per page, ungrouped`, () => {
    const store = storeFor(size);
    const result = store.queryLibrary();
    assert.equal(result.total, size);
    assert.equal(result.matched, size);
    assert.ok(result.rows.length <= LIBRARY_PAGE_SIZE, `${result.rows.length} rows rendered`);
    assert.equal(result.rows.length, Math.min(size, LIBRARY_PAGE_SIZE));
    assert.equal(result.pagination.pageCount, Math.ceil(size / LIBRARY_PAGE_SIZE));
    // The count the owner reads is the whole library, not the page.
    assert.match(result.summary, new RegExp(`of ${size} private library titles`));
  });

  test(`a ${size}-title private library renders at most ${LIBRARY_GROUP_PAGE_SIZE} groups and ${LIBRARY_GROUPED_ROW_CEILING} rows per page, grouped`, () => {
    for (const groupBy of ['series', 'authors', 'narrators', 'status']) {
      const store = storeFor(size, { groupBy });
      const result = store.queryLibrary();
      assert.equal(result.total, size, groupBy);
      assert.ok(result.groups.length <= LIBRARY_GROUP_PAGE_SIZE, `${groupBy}: ${result.groups.length} groups`);
      assert.ok(rowsOf(result) <= LIBRARY_GROUPED_ROW_CEILING, `${groupBy}: ${rowsOf(result)} rows`);
      assert.equal(result.rows.length, 0, 'grouped pages must not also emit a flat row list');
      for (const group of result.groups) {
        assert.ok(group.items.length <= LIBRARY_GROUP_ROW_PAGE_SIZE);
        assert.ok(group.total >= group.items.length);
      }
    }
  });
}

test('the large fixture is deterministic and its attributes are decorrelated', () => {
  assert.deepEqual(buildLargeLibrarySnapshot(180), buildLargeLibrarySnapshot(180));
  const snapshot = buildLargeLibrarySnapshot(1000);
  const statuses = new Map();
  snapshot.entries.forEach((entry, index) => {
    const key = `${entry.status}|${snapshot.catalog.books[index].seriesId ? 'series' : 'no-series'}`;
    statuses.set(key, (statuses.get(key) ?? 0) + 1);
  });
  // Every status must occur both with and without series metadata, or the
  // fixture would quietly test an easier shape than a real library.
  for (const status of ['completed', 'in-progress', 'not-started', 'want-to-listen', 'abandoned', 'unknown']) {
    assert.ok(statuses.get(`${status}|series`) > 0, `${status} with series`);
    assert.ok(statuses.get(`${status}|no-series`) > 0, `${status} without series`);
  }
});

test('grouping a large library keeps every group reachable and every count true', () => {
  const store = storeFor(1000, { groupBy: 'series' });
  const first = store.queryLibrary();
  const groupTotal = first.pagination.groupTotal;
  assert.ok(groupTotal > LIBRARY_GROUP_PAGE_SIZE);

  let summedRows = 0;
  const keys = new Set();
  for (let page = 1; page <= first.pagination.groupPageCount; page += 1) {
    store.setGroupPage(page);
    const result = store.queryLibrary();
    assert.ok(result.groups.length <= LIBRARY_GROUP_PAGE_SIZE);
    for (const group of result.groups) {
      assert.equal(keys.has(group.key), false, `group ${group.key} rendered on two pages`);
      keys.add(group.key);
      summedRows += group.total;
    }
  }
  assert.equal(keys.size, groupTotal);
  // Series grouping is one row per title, so the group totals must add up.
  assert.equal(summedRows, 1000);
});

test('an unknown-series group is labelled unknown, never standalone, at scale', () => {
  const store = storeFor(1000, { groupBy: 'series' });
  const unknown = [];
  for (let page = 1; page <= store.queryLibrary().pagination.groupPageCount; page += 1) {
    store.setGroupPage(page);
    unknown.push(...store.queryLibrary().groups.filter((g) => g.key === 'series:unknown'));
  }
  assert.equal(unknown.length, 1);
  assert.equal(unknown[0].label, SERIES_UNKNOWN_LABEL);
  // Derived from the fixture rather than hard-coded, so the gate checks the
  // count is *true*, not that it matches a number written down once.
  const expectedUnknown = buildLargeLibrarySnapshot(1000).catalog.books.filter((b) => !b.seriesId).length;
  assert.ok(expectedUnknown > 0);
  assert.equal(unknown[0].total, expectedUnknown);
  assert.ok(unknown[0].items.length <= LIBRARY_GROUP_ROW_PAGE_SIZE);
});

test('paging is deterministic: the same page of the same library is identical', () => {
  const ids = (n) => storeFor(1000, { page: n }).queryLibrary().rows.map((r) => r.bookId);
  assert.deepEqual(ids(3), ids(3));
  assert.notDeepEqual(ids(3), ids(4));
  const all = new Set();
  for (let page = 1; page <= 20; page += 1) ids(page).forEach((id) => all.add(id));
  assert.equal(all.size, 1000);
});

test('filters, collapse, drafts and feedback targets survive paging', async () => {
  const store = storeFor(1000, { groupBy: 'series' });
  const firstGroupKey = store.queryLibrary().groups[0].key;
  store.toggleGroup(firstGroupKey);
  await store.openFeedbackEditor('b-title-000001');
  store.updateFeedbackDraft({ comment: 'in progress' });
  store.setLibrarySession({ statuses: ['completed'] });
  const matchedWithFilter = store.queryLibrary().matched;
  assert.ok(matchedWithFilter > 0 && matchedWithFilter < 1000);

  store.setGroupPage(2);
  const paged = store.queryLibrary();
  assert.equal(paged.matched, matchedWithFilter, 'paging must not change the filter');
  assert.deepEqual(store.librarySession.statuses, ['completed']);
  assert.ok(store.librarySession.collapsedGroupKeys.includes(firstGroupKey), 'collapse must survive paging');
  // An in-progress, unsaved draft must never be discarded by navigation.
  assert.equal(store.activeDraftFor('b-title-000001').draft.comment, 'in progress');
  assert.equal(store.activeDraftFor('b-title-000001').dirty, true);

  // A group carried through pagination is still a usable feedback target.
  const namedGroup = paged.groups.find((group) => !group.key.endsWith(':unknown'));
  const target = store.groupFeedbackTarget(namedGroup);
  assert.ok(target, 'pagination must preserve the fields a feedback target needs');
  assert.match(target.targetId, /^series:/);
  assert.equal(target.label, namedGroup.label);
});

test('a listing-changing filter resets paging; a presentation change does not', () => {
  const store = storeFor(1000);
  store.setPage(7);
  assert.equal(store.librarySession.page, 7);

  store.setLibrarySession({ query: 'Synthetic Title 000123' });
  assert.equal(store.librarySession.page, 1, 'a new result set must start at page 1');

  store.setPage(3);
  store.noteScrollPosition(400);
  store.noteReturnFocus('b-title-000001');
  assert.equal(store.librarySession.page, 3, 'scroll and focus are not listing changes');
});

test('expand-all and collapse-all act on every group, not only the visible page', () => {
  const store = storeFor(1000, { groupBy: 'series' });
  store.queryLibrary();
  const groupCount = store.lastLibraryGroups.length;
  assert.ok(groupCount > LIBRARY_GROUP_PAGE_SIZE);
  store.collapseAllGroups();
  assert.equal(store.librarySession.collapsedGroupKeys.length, groupCount);
  const collapsedPage = store.queryLibrary();
  assert.equal(rowsOf(collapsedPage), 0, 'a fully collapsed page renders no rows at all');
  assert.equal(collapsedPage.matched, 1000, 'and still reports the whole library');
  store.expandAllGroups();
  assert.equal(store.librarySession.collapsedGroupKeys.length, 0);
});

/**
 * Observation, not a performance claim.
 *
 * This records how long one bounded page takes to produce on the machine that
 * ran the suite. It is a single unrepeated sample on unspecified hardware
 * under a test runner, so it is not a benchmark and must not be quoted as a
 * performance characteristic. The assertion is only a generous smoke ceiling
 * that catches an accidental quadratic, not a target.
 */
test('bounded pages are produced for every fixture size (timing recorded, not asserted as a benchmark)', (t) => {
  const observations = [];
  for (const size of LARGE_LIBRARY_SIZES) {
    const buildStart = performance.now();
    const store = storeFor(size);
    const buildMs = performance.now() - buildStart;

    const queryStart = performance.now();
    const result = store.queryLibrary();
    const queryMs = performance.now() - queryStart;

    assert.equal(result.total, size);
    assert.ok(result.rows.length <= LIBRARY_PAGE_SIZE);
    observations.push({ size, buildMs: buildMs.toFixed(1), pageMs: queryMs.toFixed(1), renderedRows: result.rows.length });
  }
  t.diagnostic(`bounded-page observations: ${JSON.stringify(observations)}`);
  // Deliberately loose: this detects a complexity regression, nothing finer.
  assert.ok(Number(observations.at(-1).pageMs) < 10000);
});
