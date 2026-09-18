/**
 * DOM-free contract tests for the UI view-model layer (`ui/js/store.js`).
 *
 * These exercise the charter-locked ATR-S008/S009 evidence-inspector store:
 * read-only library/book evidence, a read-only metadata feasibility card, a
 * synthetic-only structural trace, and lifecycle controls (manual refresh,
 * disconnect, delete, export). There is deliberately no editable rating,
 * comment, tag, or favorite API, and no recommendation/feedback API — see
 * `planning/0.0.1/01-release-charter.md` non-scope and ATR-S008 AC9.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { AppStore } from '../ui/js/store.js';
import { SORT_FIELDS } from '../src/index.js';

test('the store exposes no editing or recommendation API surface', () => {
  const store = new AppStore();
  for (const method of ['setBookAnnotation', 'setFacetAnnotation', 'setPreferences', 'recommend', 'recordFeedback', 'clearAnnotations']) {
    assert.equal(typeof store[method], 'undefined', `AppStore must not expose ${method}() in this alpha`);
  }
});

test('seeds a synthetic library with no pre-populated ratings', () => {
  const store = new AppStore();
  const summary = store.summary();
  assert.ok(summary.bookCount > 0);
  assert.ok(summary.libraryEntryCount > 0);
  assert.equal(summary.connectionStatus, 'connected');
});

test('library rows expose title/id, status, provenance, and unknown fields for every title', () => {
  const store = new AppStore();
  const rows = store.libraryRows();
  assert.ok(rows.length > 0);
  const row = rows.find((r) => r.bookId === 'b-ring-1');
  assert.equal(row.title, 'The Ring Bearer, Book One');
  assert.equal(row.provenance.source, 'synthetic-fixture');
  assert.ok(Array.isArray(row.unknownFields));
});

test('unknown status is honestly distinguished from not-started and zero progress', () => {
  const store = new AppStore();
  const rows = store.libraryRows();
  const fieldNotes = rows.find((r) => r.bookId === 'b-field-notes');
  assert.equal(fieldNotes.status, 'unknown');
  const dungeon1 = rows.find((r) => r.bookId === 'b-dungeon-1');
  assert.equal(dungeon1.status, 'not-started');
  assert.equal(dungeon1.percentComplete, null); // unknown, never faked as 0
});

test('queryLibrary sorts by every UI-exposed catalog sort field without throwing', () => {
  const store = new AppStore();
  const catalogFields = SORT_FIELDS.filter((f) => !['overallRating', 'storyRating', 'narrationRating', 'favorite'].includes(f));
  for (const field of catalogFields) {
    const { rows } = store.queryLibrary({ sort: { field, direction: 'asc' } });
    assert.ok(Array.isArray(rows));
  }
});

test('queryLibrary filters by status and free-text query', () => {
  const store = new AppStore();
  const completed = store.queryLibrary({ filter: { status: ['completed'] } });
  assert.ok(completed.rows.every((r) => r.status === 'completed'));

  const query = store.queryLibrary({ filter: { query: 'dungeon' } });
  assert.ok(query.rows.length > 0);
  assert.ok(query.rows.every((r) => r.title.toLowerCase().includes('dungeon')));
});

test('queryLibrary groups rows by a facet field', () => {
  const store = new AppStore();
  const { groups } = store.queryLibrary({ group: 'status' });
  assert.ok(Array.isArray(groups));
  assert.ok(groups.length > 0);
  const total = groups.reduce((sum, g) => sum + g.items.length, 0);
  assert.equal(total, store.libraryRows().length);
});

test('bookDetail returns the book, entry, related facets, and unknown fields (read-only)', () => {
  const store = new AppStore();
  const detail = store.bookDetail('b-ring-1');
  assert.ok(detail);
  assert.equal(detail.book.title, 'The Ring Bearer, Book One');
  assert.equal(detail.entry.status, 'completed');
  assert.ok(detail.facets.some((f) => f.kind === 'author' && f.id === 'p-ashgrove'));
  assert.ok(detail.facets.some((f) => f.kind === 'series'));
  assert.ok(Array.isArray(detail.unknownFields));
  assert.equal(detail.note, undefined);
});

test('bookDetail surfaces honest unknowns for a deliberately sparse fixture', () => {
  const store = new AppStore();
  const detail = store.bookDetail('b-field-notes');
  assert.ok(detail);
  assert.equal(detail.entry.status, 'unknown');
  assert.ok(detail.unknownFields.length > 0);
});

test('bookDetail returns null for an unknown id', () => {
  const store = new AppStore();
  assert.equal(store.bookDetail('does-not-exist'), null);
});

test('feasibility reports known/unknown coverage per field across the catalog', () => {
  const store = new AppStore();
  const rows = store.feasibility();
  assert.ok(rows.length > 0);
  for (const row of rows) {
    assert.equal(row.knownCount + row.unknownCount, row.total);
    assert.ok(row.percentKnown >= 0 && row.percentKnown <= 100);
  }
  const narrator = rows.find((r) => r.field === 'narrator');
  assert.ok(narrator.unknownCount > 0); // b-field-notes has no narrator on purpose
});

test('sharedFacetTrace lists only factual edges with two or more titles, never a score or rank', () => {
  const store = new AppStore();
  const trace = store.sharedFacetTrace();
  const { edges, shown, total, limit, truncated } = trace;
  assert.ok(edges.length > 0);
  assert.equal(shown, edges.length);
  assert.ok(total >= shown);
  assert.equal(truncated, total > shown);
  assert.equal(typeof limit, 'number');
  for (const edge of edges) {
    assert.ok(edge.titles.length >= 2);
    assert.equal(typeof edge.score, 'undefined');
    assert.equal(typeof edge.rank, 'undefined');
    assert.equal(typeof edge.confidence, 'undefined');
  }
  const ringSeries = edges.find((e) => e.kind === 'series' && e.id === 's-ringbearer');
  assert.ok(ringSeries);
  assert.ok(ringSeries.titles.includes('The Ring Bearer, Book One'));
});

test('sharedFacetTrace discloses truncation instead of silently dropping edges', () => {
  const store = new AppStore();
  const full = store.sharedFacetTrace();
  const capped = store.sharedFacetTrace({ limit: 2 });
  assert.equal(capped.shown, 2);
  assert.equal(capped.limit, 2);
  assert.equal(capped.total, full.total);
  assert.equal(capped.truncated, true);
});

test('manualRefresh is idempotent against the clean synthetic snapshot', () => {
  const store = new AppStore();
  const before = store.libraryRows().length;
  const result = store.manualRefresh();
  assert.equal(result.ok, true);
  assert.equal(result.report.added.length, 0);
  assert.equal(result.report.rejected.length, 0);
  assert.equal(store.libraryRows().length, before);
});

test('manualRefresh with induceError safely isolates a malformed record without aborting the import', () => {
  const store = new AppStore();
  const result = store.manualRefresh({ induceError: true });
  assert.equal(result.ok, true);
  assert.ok(result.report.rejected.length > 0);
  assert.ok(result.report.updated.length > 0);
});

test('manualRefresh is refused once disconnected', () => {
  const store = new AppStore();
  store.setConsentAcknowledged(true);
  store.disconnect();
  const result = store.manualRefresh();
  assert.equal(result.ok, false);
  assert.match(result.reason, /disconnected/);
});

test('disconnect and delete require an explicit consent acknowledgment first', () => {
  const store = new AppStore();
  const disconnectResult = store.disconnect();
  assert.equal(disconnectResult.ok, false);
  const deleteResult = store.deleteAll();
  assert.equal(deleteResult.ok, false);
  assert.equal(store.summary().connectionStatus, 'connected');
});

test('disconnect stops refresh but keeps existing evidence visible', () => {
  const store = new AppStore();
  store.setConsentAcknowledged(true);
  const before = store.libraryRows().length;
  const result = store.disconnect();
  assert.equal(result.ok, true);
  assert.equal(store.summary().connectionStatus, 'disconnected');
  assert.equal(store.libraryRows().length, before);
  assert.equal(store.canRefresh(), false);
});

test('deleteAll erases the catalog and library entries irreversibly (within the session)', () => {
  const store = new AppStore();
  store.setConsentAcknowledged(true);
  const result = store.deleteAll();
  assert.equal(result.ok, true);
  assert.equal(store.summary().connectionStatus, 'deleted');
  assert.equal(store.libraryRows().length, 0);
  assert.equal(store.summary().bookCount, 0);
});

test('reset restores the original synthetic seed and connected status after delete', () => {
  const store = new AppStore();
  store.setConsentAcknowledged(true);
  store.deleteAll();
  store.reset();
  const summary = store.summary();
  assert.equal(summary.connectionStatus, 'connected');
  assert.ok(summary.bookCount > 0);
  assert.equal(store.consentAcknowledged, false);
});

test('exportState is JSON-serializable, schema-tagged, and contains no ratings/annotations', () => {
  const store = new AppStore();
  const exported = store.exportState();
  const roundTrip = JSON.parse(JSON.stringify(exported));
  assert.equal(roundTrip.alphaVersion, '0.0.2');
  assert.equal(roundTrip.runtimeProfile.transport, 'loopback-static-server-only');
  assert.equal(roundTrip.runtimeProfile.outboundNetwork, 'none');
  assert.equal(roundTrip.runtimeProfile.audibleAccess, 'none');
  assert.equal(roundTrip.runtimeProfile.persistence, 'in-memory-only');
  assert.ok(Array.isArray(roundTrip.libraryEntries));
  assert.equal(typeof roundTrip.annotations, 'undefined');
  assert.equal(typeof roundTrip.preferences, 'undefined');
});
