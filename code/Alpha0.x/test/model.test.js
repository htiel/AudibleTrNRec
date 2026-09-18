import test from 'node:test';
import assert from 'node:assert/strict';

import {
  Catalog, mergeLibrarySnapshot, normalizeBook, normalizeLibraryEntry,
  SOURCE_OWNED_FIELDS, LOCAL_OWNED_FIELDS,
} from '../src/core/model.js';
import { ValidationError } from '../src/core/errors.js';
import { isUnknown } from '../src/core/validate.js';
import { SYNTHETIC_PEOPLE, SYNTHETIC_FACETS, SYNTHETIC_BOOKS, SYNTHETIC_SNAPSHOT, SYNTHETIC_SNAPSHOT_V2, SYNTHETIC_LOCAL_SENTINELS } from '../src/fixtures/synthetic.js';
import { SCHEMA_VERSION, SYNTHETIC_NOW } from '../src/version.js';

const catalog = () => new Catalog({ people: SYNTHETIC_PEOPLE, facets: SYNTHETIC_FACETS, books: SYNTHETIC_BOOKS });

test('normalized records are frozen and carry provenance', () => {
  const book = catalog().book('b-ring-1');
  assert.equal(Object.isFrozen(book), true);
  assert.equal(book.provenance.source, 'synthetic-fixture');
  assert.equal(book.provenance.schemaVersion, SCHEMA_VERSION);
  assert.equal(book.provenance.schemaVersion, 'atr-schema-0.0.2');
  assert.throws(() => { 'use strict'; book.title = 'mutated'; }, TypeError);
});

test('unknown data stays unknown and is listed, never invented', () => {
  const book = catalog().book('b-field-notes');
  assert.ok(isUnknown(book.durationMinutes));
  assert.ok(isUnknown(book.synopsis));
  assert.ok(isUnknown(book.viewpoint));
  assert.deepEqual(book.narratorIds, []);
  for (const field of ['durationMinutes', 'synopsis', 'viewpoint', 'narratorIds']) {
    assert.ok(book.provenance.unknownFields.includes(field), `${field} should be reported unknown`);
  }
});

test('viewpoint metadata is stored as uncertain, correctable catalog metadata', () => {
  const book = catalog().book('b-policy-market-a');
  assert.equal(book.viewpoint.appliesTo, 'catalog-title');
  assert.equal(book.viewpoint.correctable, true);
  assert.ok(book.viewpoint.confidence > 0 && book.viewpoint.confidence <= 1);
  assert.equal(typeof book.viewpoint.source, 'string');
});

test('a person with two roles is stored once, not duplicated', () => {
  const reyes = catalog().person('p-reyes');
  assert.deepEqual(reyes.roles, ['author', 'narrator']);
});

test('catalog enforces referential integrity and rejects duplicates', () => {
  assert.throws(() => new Catalog({
    people: SYNTHETIC_PEOPLE, facets: SYNTHETIC_FACETS,
    books: [...SYNTHETIC_BOOKS, { bookId: 'b-ring-1', title: 'dup', available: true }],
  }), ValidationError);
  assert.throws(() => new Catalog({
    people: SYNTHETIC_PEOPLE, facets: SYNTHETIC_FACETS,
    books: [{ bookId: 'b-x', title: 'x', authorIds: ['p-missing'], available: true }],
  }), ValidationError);
});

test('malformed source records are rejected individually, not silently coerced', () => {
  assert.throws(() => normalizeBook({ bookId: 'b-x' }), ValidationError);            // missing title
  assert.throws(() => normalizeLibraryEntry({ bookId: 'b-x', status: 'bogus' }), ValidationError);
  assert.throws(() => normalizeLibraryEntry({ bookId: 'b-x', percentComplete: 140 }), ValidationError);
});

test('repeat import is idempotent: same input, same state, no duplicates', () => {
  const first = mergeLibrarySnapshot([], SYNTHETIC_SNAPSHOT, { observedAt: SYNTHETIC_NOW });
  const second = mergeLibrarySnapshot(first.entries, SYNTHETIC_SNAPSHOT, { observedAt: SYNTHETIC_NOW });
  const third = mergeLibrarySnapshot(second.entries, SYNTHETIC_SNAPSHOT, { observedAt: SYNTHETIC_NOW });

  assert.equal(first.report.added.length, SYNTHETIC_SNAPSHOT.length);
  assert.deepEqual(second.report.added, []);
  assert.deepEqual(second.report.updated, []);
  assert.equal(second.report.unchanged.length, SYNTHETIC_SNAPSHOT.length);
  assert.deepEqual(JSON.parse(JSON.stringify(third.entries)), JSON.parse(JSON.stringify(second.entries)));
});

test('a second import updates source-owned progress and isolates bad records', () => {
  const first = mergeLibrarySnapshot([], SYNTHETIC_SNAPSHOT, { observedAt: SYNTHETIC_NOW });
  const second = mergeLibrarySnapshot(first.entries, SYNTHETIC_SNAPSHOT_V2, { observedAt: SYNTHETIC_NOW });

  assert.deepEqual(second.report.updated, ['b-ring-2']);
  assert.deepEqual(second.report.added, ['b-dungeon-2']);
  assert.equal(second.entries.find((e) => e.bookId === 'b-ring-2').percentComplete, 55);

  const categories = second.report.rejected.map((r) => r.category).sort();
  assert.equal(second.report.rejected.length, 3);
  assert.ok(categories.includes('duplicate-record'));
  assert.ok(categories.includes('invalid-identifier'));
  assert.ok(categories.includes('invalid-field-value'));
  // Diagnostics are positional + closed-vocabulary only: no raw record value,
  // no field name, no error message (Worf review finding W-1).
  for (const diagnostic of second.report.rejected) {
    assert.deepEqual(Object.keys(diagnostic).sort(), ['category', 'recordIndex']);
    assert.equal(Number.isInteger(diagnostic.recordIndex), true);
  }
  assert.deepEqual(
    second.report.rejected.map((r) => r.recordIndex),
    [...second.report.rejected.map((r) => r.recordIndex)].sort((a, b) => a - b),
  );
  // Good records still imported despite the failures.
  assert.ok(second.entries.some((e) => e.bookId === 'b-dungeon-2'));
});

test('titles missing from the source are flagged, never silently deleted', () => {
  const first = mergeLibrarySnapshot([], SYNTHETIC_SNAPSHOT, { observedAt: SYNTHETIC_NOW });
  const shrunk = mergeLibrarySnapshot(first.entries, SYNTHETIC_SNAPSHOT.slice(0, 2), { observedAt: SYNTHETIC_NOW });
  assert.ok(shrunk.report.missingFromSource.includes('b-stars-quiet'));
  assert.equal(shrunk.entries.length, first.entries.length);
  assert.equal(shrunk.entries.find((e) => e.bookId === 'b-stars-quiet').missingFromSource, true);
});

test('repeated synchronization cannot write, delete, or repoint local sentinel records', () => {
  // Alpha 0.0.1 ships no ratings feature; these sentinels are inert fixtures
  // that prove the merge has no parameter, path, or side effect reaching
  // locally owned data (ATR-S003 AC4).
  const before = JSON.stringify(SYNTHETIC_LOCAL_SENTINELS);

  let state = [];
  for (let i = 0; i < 3; i += 1) {
    state = mergeLibrarySnapshot(state, SYNTHETIC_SNAPSHOT_V2, { observedAt: SYNTHETIC_NOW }).entries;
  }
  assert.equal(JSON.stringify(SYNTHETIC_LOCAL_SENTINELS), before);
  for (const sentinel of SYNTHETIC_LOCAL_SENTINELS) {
    assert.equal(Object.isFrozen(sentinel), true);
    assert.equal(sentinel.authority, 'local');
    assert.equal(sentinel.source, 'local-user');
  }

  // The merge accepts no local-data argument at all: (previous, incoming, options).
  assert.equal(mergeLibrarySnapshot.length <= 3, true);

  // Authority sets are disjoint by construction.
  assert.deepEqual(SOURCE_OWNED_FIELDS.filter((f) => LOCAL_OWNED_FIELDS.includes(f)), []);
  for (const entry of state) {
    for (const field of LOCAL_OWNED_FIELDS) assert.equal(field in entry, false, `${field} leaked into source record`);
  }
});
