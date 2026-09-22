/**
 * Contract tests for the pure formatting helpers used across every view.
 * No rating or recommendation-kind formatters remain: that product surface
 * is deferred (see `planning/0.0.1/01-release-charter.md` non-scope).
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  formatDuration, formatDate, formatPercent, formatStatus,
  formatFacetKind, formatList, formatBoolean, formatProvenance, formatPercentKnown,
  formatListeningState,
} from '../ui/js/format.js';

test('formatDuration renders hours and minutes, and an honest unknown', () => {
  assert.equal(formatDuration(90), '1h 30m');
  assert.equal(formatDuration(45), '45m');
  assert.equal(formatDuration(null), 'Unknown length');
  assert.equal(formatDuration(undefined), 'Unknown length');
});

test('formatDate renders a deterministic locale-independent date', () => {
  assert.equal(formatDate('2024-02-01T00:00:00.000Z'), '2024-02-01');
  assert.equal(formatDate(null), 'Unknown date');
  assert.equal(formatDate('not-a-date'), 'Unknown date');
});

test('formatPercent is honest about unknown progress, never zero', () => {
  assert.equal(formatPercent(42), '42%');
  assert.equal(formatPercent(0), '0%');
  assert.equal(formatPercent(null), 'Unknown progress');
});

test('formatStatus and formatFacetKind use natural-case labels', () => {
  assert.equal(formatStatus('in-progress'), 'In progress');
  assert.equal(formatStatus('unknown'), 'Unknown status');
  assert.equal(formatStatus(null), 'Unknown status');
  assert.equal(formatFacetKind('narrator'), 'Narrator');
  assert.equal(formatFacetKind('author'), 'Author');
});

test('formatProvenance labels imported vs local/synthetic vs unknown as text, never color/position alone', () => {
  assert.equal(formatProvenance('synthetic-fixture'), 'Imported (synthetic fixture)');
  assert.equal(formatProvenance('local-user'), 'Local/synthetic annotation');
  assert.equal(formatProvenance(null), 'Unknown provenance');
});

/**
 * Issue B3: `audible-community-private-api` is a real, closed-vocabulary
 * provenance source (`PROVENANCE_SOURCES` in `src/core/model.js`) that this
 * map previously had no label for, so it fell through to the raw internal
 * token. The vocabulary is closed: any source this map does not name —
 * whether a real future value or a corrupt/unexpected one — must render as
 * "Unknown provenance", never leak the token itself to the owner-facing UI.
 */
test('formatProvenance gives audible-community-private-api an owner-readable label and never leaks a raw unrecognized token', () => {
  assert.equal(formatProvenance('audible-community-private-api'), 'Imported (Audible, via the community private API connector)');
  assert.equal(formatProvenance('derived'), 'Derived');
  assert.equal(formatProvenance('some-unrecognized-internal-token'), 'Unknown provenance');
});

test('formatPercentKnown renders a coverage percentage and an honest unknown', () => {
  assert.equal(formatPercentKnown(100), '100%');
  assert.equal(formatPercentKnown(0), '0%');
  assert.equal(formatPercentKnown(null), 'Unknown');
});

test('formatList and formatBoolean', () => {
  assert.equal(formatList(['a', 'b']), 'a, b');
  assert.equal(formatList([]), 'Unknown');
  assert.equal(formatBoolean(true), 'Yes');
  assert.equal(formatBoolean(false), 'No');
  assert.equal(formatBoolean(null), 'Not set');
});

/**
 * Issue B2: `status` and `percentComplete` are independent source-owned
 * fields, so a completed title's `percentComplete` can be stale or a later
 * re-listen position. `formatListeningState()` must never present that as
 * "Completed · 36%", which reads as a completion percentage.
 */
test('formatListeningState never pairs "Completed" with a bare, ambiguous percentage', () => {
  assert.equal(formatListeningState({ status: 'completed', percentComplete: 36 }), 'Completed', 'a completed title with no disambiguating position field must render status alone');
  assert.equal(formatListeningState({ status: 'completed', percentComplete: null }), 'Completed');
});

test('formatListeningState labels a forthcoming current-position field explicitly as a position, once supplied', () => {
  assert.equal(
    formatListeningState({ status: 'completed', percentComplete: 100, currentPositionPercent: 36 }),
    'Completed · Currently re-listening at 36%',
  );
});

test('formatListeningState keeps status · percent for every non-completed status, which is unambiguous', () => {
  assert.equal(formatListeningState({ status: 'in-progress', percentComplete: 42 }), 'In progress · 42%');
  assert.equal(formatListeningState({ status: 'abandoned', percentComplete: 18 }), 'Abandoned · 18%');
  assert.equal(formatListeningState({ status: 'not-started', percentComplete: null }), 'Not started · Unknown progress');
  assert.equal(formatListeningState({ status: null, percentComplete: null }), 'Unknown status · Unknown progress');
});
